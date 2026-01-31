/**
 * Supabase client configuration for La Jardinerie reservation system
 */

import { createClient } from "@supabase/supabase-js";

// Environment variables - these should be set in your deployment
const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || "";

// Create Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Types for the reservation system
export interface ServiceWindow {
  id: string;
  name: string;
  dow: number; // Day of week (0 = Sunday, 1 = Monday, etc.)
  start_time: string; // HH:MM format
  end_time: string; // HH:MM format
  capacity: number;
  slot_interval: number; // minutes
  meal_duration: number; // minutes
}

export interface Closure {
  id: string;
  date: string; // YYYY-MM-DD
  reason?: string;
}

export interface Reservation {
  id: string;
  code: string;
  service_name: string;
  start_at: string; // ISO datetime
  end_at: string; // ISO datetime
  guests: number;
  name: string;
  phone: string;
  email?: string;
  notes?: string;
  status: "confirmed" | "cancelled" | "completed";
  created_at: string;
}

export interface AvailabilitySlot {
  start_at: string;
  available_capacity: number;
}

export interface AvailabilityResponse {
  date: string;
  services: {
    name: string;
    display_name: string;
    slots: AvailabilitySlot[];
  }[];
}

export interface BookingRequest {
  start_at: string;
  service_name: string;
  guests: number;
  name: string;
  phone: string;
  email?: string;
  notes?: string;
}

export interface BookingResponse {
  ok: boolean;
  code?: string;
  reservation_id?: string;
  error?: string;
}

// API base URL for Edge Functions
const EDGE_FUNCTIONS_URL = import.meta.env.PUBLIC_SUPABASE_URL
  ? `${import.meta.env.PUBLIC_SUPABASE_URL}/functions/v1`
  : "";

/**
 * Get available slots for a given date
 */
export async function getAvailability(
  date: string,
  guests: number
): Promise<AvailabilityResponse | null> {
  try {
    const response = await fetch(
      `${EDGE_FUNCTIONS_URL}/availability?date=${date}&guests=${guests}`,
      {
        headers: {
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    if (!response.ok) {
      console.error("Availability fetch failed:", response.status);
      return null;
    }

    return response.json();
  } catch (error) {
    console.error("Error fetching availability:", error);
    return null;
  }
}

/**
 * Book a reservation
 */
export async function bookReservation(
  data: BookingRequest
): Promise<BookingResponse> {
  try {
    const response = await fetch(`${EDGE_FUNCTIONS_URL}/book`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        ok: false,
        error: result.error || "Une erreur est survenue"
      };
    }

    return result;
  } catch (error) {
    console.error("Error booking reservation:", error);
    return {
      ok: false,
      error: "Erreur de connexion. Veuillez réessayer."
    };
  }
}

/**
 * Generate date options for the next N days
 */
export function getDateOptions(days: number = 30): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const today = new Date();

  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);

    const value = date.toISOString().split("T")[0];
    const label = date.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long"
    });

    options.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }

  return options;
}

/**
 * Check if a date is a closed day based on day of week
 * 0 = Sunday, 1 = Monday (both closed)
 */
export function isClosedDay(date: Date): boolean {
  const dow = date.getDay();
  return dow === 0 || dow === 1; // Sunday or Monday
}

/**
 * Format time for display
 */
export function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit"
  });
}
