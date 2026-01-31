-- =====================================================
-- LA JARDINERIE - SUPABASE DATABASE SCHEMA
-- =====================================================
-- Execute this SQL in your Supabase SQL Editor to set up the reservation system

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABLES
-- =====================================================

-- Settings table (global configuration)
CREATE TABLE IF NOT EXISTS settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Service windows (when reservations are available)
CREATE TABLE IF NOT EXISTS service_windows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL, -- 'midi' or 'soir'
    display_name TEXT NOT NULL, -- 'Déjeuner' or 'Dîner'
    dow INTEGER NOT NULL CHECK (dow >= 0 AND dow <= 6), -- 0=Sunday, 1=Monday, etc.
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    last_reservation_time TIME NOT NULL, -- Last time a reservation can start
    capacity INTEGER NOT NULL DEFAULT 100,
    slot_interval INTEGER NOT NULL DEFAULT 30, -- minutes between slots
    meal_duration INTEGER NOT NULL DEFAULT 60, -- average meal duration in minutes
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(name, dow)
);

-- Closures (exceptional closing dates)
CREATE TABLE IF NOT EXISTS closures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL UNIQUE,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reservations
CREATE TABLE IF NOT EXISTS reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,
    service_name TEXT NOT NULL,
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    guests INTEGER NOT NULL CHECK (guests > 0 AND guests <= 20),
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'completed', 'no_show')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_reservations_start_at ON reservations(start_at);
CREATE INDEX IF NOT EXISTS idx_reservations_service ON reservations(service_name);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);
CREATE INDEX IF NOT EXISTS idx_reservations_code ON reservations(code);
CREATE INDEX IF NOT EXISTS idx_closures_date ON closures(date);
CREATE INDEX IF NOT EXISTS idx_service_windows_dow ON service_windows(dow);

-- =====================================================
-- INITIAL DATA - SERVICE WINDOWS
-- =====================================================

-- Clear existing data
DELETE FROM service_windows;

-- Wednesday - Friday: Midi (12:00-14:00) and Soir (19:00-21:45)
INSERT INTO service_windows (name, display_name, dow, start_time, end_time, last_reservation_time, capacity, slot_interval, meal_duration) VALUES
-- Wednesday (dow=3)
('midi', 'Déjeuner', 3, '12:00', '14:00', '13:30', 100, 30, 60),
('soir', 'Dîner', 3, '19:00', '23:00', '21:30', 100, 30, 60),
-- Thursday (dow=4)
('midi', 'Déjeuner', 4, '12:00', '14:00', '13:30', 100, 30, 60),
('soir', 'Dîner', 4, '19:00', '23:00', '21:30', 100, 30, 60),
-- Friday (dow=5)
('midi', 'Déjeuner', 5, '12:00', '14:00', '13:30', 100, 30, 60),
('soir', 'Dîner', 5, '19:00', '23:00', '21:30', 100, 30, 60),
-- Saturday (dow=6) - Only evening (opens at 15h)
('soir', 'Dîner', 6, '19:00', '23:00', '21:30', 100, 30, 60),
-- Tuesday (dow=2) - Only evening (opens at 17h)
('soir', 'Dîner', 2, '19:00', '23:00', '21:30', 100, 30, 60);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to generate unique reservation code
CREATE OR REPLACE FUNCTION generate_reservation_code()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    code TEXT := '';
    i INTEGER;
BEGIN
    FOR i IN 1..6 LOOP
        code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    RETURN code;
END;
$$ LANGUAGE plpgsql;

-- Function to check if date is closed
CREATE OR REPLACE FUNCTION is_date_closed(check_date DATE)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM closures WHERE date = check_date);
END;
$$ LANGUAGE plpgsql;

-- Function to get capacity taken for a specific slot
CREATE OR REPLACE FUNCTION get_capacity_taken(
    p_service_name TEXT,
    p_start_at TIMESTAMPTZ,
    p_end_at TIMESTAMPTZ
)
RETURNS INTEGER AS $$
DECLARE
    taken INTEGER;
BEGIN
    SELECT COALESCE(SUM(guests), 0) INTO taken
    FROM reservations
    WHERE service_name = p_service_name
      AND status = 'confirmed'
      AND start_at < p_end_at
      AND end_at > p_start_at;

    RETURN taken;
END;
$$ LANGUAGE plpgsql;

-- Main booking function with transaction lock
CREATE OR REPLACE FUNCTION book_reservation(
    p_service_name TEXT,
    p_start_at TIMESTAMPTZ,
    p_guests INTEGER,
    p_name TEXT,
    p_phone TEXT,
    p_email TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS TABLE(
    ok BOOLEAN,
    code TEXT,
    reservation_id UUID,
    error TEXT
) AS $$
DECLARE
    v_code TEXT;
    v_reservation_id UUID;
    v_date DATE;
    v_dow INTEGER;
    v_time TIME;
    v_service_window service_windows%ROWTYPE;
    v_end_at TIMESTAMPTZ;
    v_capacity INTEGER;
    v_taken INTEGER;
    v_lock_key BIGINT;
BEGIN
    -- Extract date and time
    v_date := p_start_at::DATE;
    v_dow := EXTRACT(DOW FROM p_start_at)::INTEGER;
    v_time := p_start_at::TIME;

    -- Check if date is closed
    IF is_date_closed(v_date) THEN
        RETURN QUERY SELECT FALSE, NULL::TEXT, NULL::UUID, 'Restaurant fermé cette date'::TEXT;
        RETURN;
    END IF;

    -- Get service window
    SELECT * INTO v_service_window
    FROM service_windows
    WHERE name = p_service_name
      AND dow = v_dow
      AND is_active = TRUE;

    IF v_service_window IS NULL THEN
        RETURN QUERY SELECT FALSE, NULL::TEXT, NULL::UUID, 'Service non disponible ce jour'::TEXT;
        RETURN;
    END IF;

    -- Check if time is within service window
    IF v_time < v_service_window.start_time OR v_time > v_service_window.last_reservation_time THEN
        RETURN QUERY SELECT FALSE, NULL::TEXT, NULL::UUID, 'Créneau non disponible'::TEXT;
        RETURN;
    END IF;

    -- Calculate end time
    v_end_at := p_start_at + (v_service_window.meal_duration || ' minutes')::INTERVAL;

    -- Acquire advisory lock for this date/service to prevent race conditions
    v_lock_key := hashtext(v_date::TEXT || p_service_name);
    PERFORM pg_advisory_xact_lock(v_lock_key);

    -- Check capacity
    v_capacity := v_service_window.capacity;
    v_taken := get_capacity_taken(p_service_name, p_start_at, v_end_at);

    IF v_taken + p_guests > v_capacity THEN
        RETURN QUERY SELECT FALSE, NULL::TEXT, NULL::UUID, 'Capacité insuffisante pour ce créneau'::TEXT;
        RETURN;
    END IF;

    -- Generate unique code
    LOOP
        v_code := generate_reservation_code();
        EXIT WHEN NOT EXISTS (SELECT 1 FROM reservations WHERE code = v_code);
    END LOOP;

    -- Insert reservation
    INSERT INTO reservations (code, service_name, start_at, end_at, guests, name, phone, email, notes, status)
    VALUES (v_code, p_service_name, p_start_at, v_end_at, p_guests, p_name, p_phone, p_email, p_notes, 'confirmed')
    RETURNING id INTO v_reservation_id;

    RETURN QUERY SELECT TRUE, v_code, v_reservation_id, NULL::TEXT;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

-- Public read access for service_windows and closures
CREATE POLICY "Allow public read access to service_windows" ON service_windows
    FOR SELECT USING (true);

CREATE POLICY "Allow public read access to closures" ON closures
    FOR SELECT USING (true);

-- Reservations: Allow insert via authenticated or anon (API calls)
CREATE POLICY "Allow insert reservations" ON reservations
    FOR INSERT WITH CHECK (true);

-- Reservations: Users can only read their own reservation by code (for confirmation page)
CREATE POLICY "Allow read own reservation by code" ON reservations
    FOR SELECT USING (true);

-- Settings: Public read
CREATE POLICY "Allow public read settings" ON settings
    FOR SELECT USING (true);

-- =====================================================
-- UPDATED_AT TRIGGER
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_settings_updated_at
    BEFORE UPDATE ON settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_service_windows_updated_at
    BEFORE UPDATE ON service_windows
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reservations_updated_at
    BEFORE UPDATE ON reservations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- INITIAL SETTINGS
-- =====================================================

INSERT INTO settings (key, value) VALUES
('restaurant_name', '"La Jardinerie"'),
('max_group_size', '20'),
('advance_booking_days', '30'),
('contact_email', '"contact@lajardinerie.fr"'),
('contact_phone', '"+33400000000"')
ON CONFLICT (key) DO NOTHING;
