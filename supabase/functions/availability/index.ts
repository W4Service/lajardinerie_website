/**
 * Edge Function: GET /availability
 *
 * Returns available time slots for a given date and guest count.
 *
 * Query params:
 * - date: YYYY-MM-DD
 * - guests: number
 *
 * Response:
 * {
 *   date: string,
 *   services: [
 *     {
 *       name: "midi" | "soir",
 *       display_name: string,
 *       slots: [
 *         { start_at: string (ISO), available_capacity: number }
 *       ]
 *     }
 *   ]
 * }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

interface ServiceWindow {
  id: string;
  name: string;
  display_name: string;
  dow: number;
  start_time: string;
  end_time: string;
  last_reservation_time: string;
  capacity: number;
  slot_interval: number;
  meal_duration: number;
  is_active: boolean;
}

interface Reservation {
  id: string;
  start_at: string;
  end_at: string;
  guests: number;
  status: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const dateParam = url.searchParams.get("date");
    const guestsParam = url.searchParams.get("guests");

    if (!dateParam || !guestsParam) {
      return new Response(
        JSON.stringify({ error: "Missing date or guests parameter" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const guests = parseInt(guestsParam);
    if (isNaN(guests) || guests < 1 || guests > 20) {
      return new Response(
        JSON.stringify({ error: "Invalid guests count (1-20)" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse date and validate
    const date = new Date(dateParam + "T00:00:00");
    if (isNaN(date.getTime())) {
      return new Response(JSON.stringify({ error: "Invalid date format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if date is in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) {
      return new Response(JSON.stringify({ error: "Date is in the past" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get day of week (0 = Sunday)
    const dow = date.getDay();

    // Check if date is closed
    const { data: closure } = await supabase
      .from("closures")
      .select("id")
      .eq("date", dateParam)
      .single();

    if (closure) {
      return new Response(
        JSON.stringify({
          date: dateParam,
          services: [],
          message: "Restaurant fermé cette date",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get service windows for this day
    const { data: serviceWindows, error: swError } = await supabase
      .from("service_windows")
      .select("*")
      .eq("dow", dow)
      .eq("is_active", true)
      .order("start_time");

    if (swError) {
      throw swError;
    }

    if (!serviceWindows || serviceWindows.length === 0) {
      return new Response(
        JSON.stringify({
          date: dateParam,
          services: [],
          message: "Restaurant fermé ce jour",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get existing reservations for this date
    const dayStart = new Date(dateParam + "T00:00:00Z");
    const dayEnd = new Date(dateParam + "T23:59:59Z");

    const { data: existingReservations, error: resError } = await supabase
      .from("reservations")
      .select("id, start_at, end_at, guests, status, service_name")
      .gte("start_at", dayStart.toISOString())
      .lte("start_at", dayEnd.toISOString())
      .eq("status", "confirmed");

    if (resError) {
      throw resError;
    }

    // Build availability for each service
    const services = [];

    for (const sw of serviceWindows as ServiceWindow[]) {
      const slots = [];

      // Generate time slots
      const [startHour, startMin] = sw.start_time.split(":").map(Number);
      const [lastHour, lastMin] = sw.last_reservation_time.split(":").map(Number);

      let currentTime = new Date(date);
      currentTime.setHours(startHour, startMin, 0, 0);

      const lastTime = new Date(date);
      lastTime.setHours(lastHour, lastMin, 0, 0);

      // If today, skip past slots
      const now = new Date();
      if (dateParam === now.toISOString().split("T")[0]) {
        // Add buffer (e.g., 1 hour minimum advance notice)
        now.setHours(now.getHours() + 1);
        while (currentTime < now && currentTime <= lastTime) {
          currentTime.setMinutes(currentTime.getMinutes() + sw.slot_interval);
        }
      }

      while (currentTime <= lastTime) {
        const slotStart = new Date(currentTime);
        const slotEnd = new Date(currentTime);
        slotEnd.setMinutes(slotEnd.getMinutes() + sw.meal_duration);

        // Calculate capacity taken for this slot
        let capacityTaken = 0;
        for (const res of existingReservations || []) {
          if (res.service_name !== sw.name) continue;

          const resStart = new Date(res.start_at);
          const resEnd = new Date(res.end_at);

          // Check overlap
          if (resStart < slotEnd && resEnd > slotStart) {
            capacityTaken += res.guests;
          }
        }

        const availableCapacity = sw.capacity - capacityTaken;

        if (availableCapacity >= guests) {
          slots.push({
            start_at: slotStart.toISOString(),
            available_capacity: availableCapacity,
          });
        }

        currentTime.setMinutes(currentTime.getMinutes() + sw.slot_interval);
      }

      services.push({
        name: sw.name,
        display_name: sw.display_name,
        slots,
      });
    }

    return new Response(
      JSON.stringify({
        date: dateParam,
        services,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
