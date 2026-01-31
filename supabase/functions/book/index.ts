/**
 * Edge Function: POST /book
 *
 * Creates a new reservation with anti-double-booking protection.
 *
 * Request body:
 * {
 *   start_at: string (ISO datetime),
 *   service_name: "midi" | "soir",
 *   guests: number,
 *   name: string,
 *   phone: string,
 *   email?: string,
 *   notes?: string
 * }
 *
 * Response:
 * {
 *   ok: boolean,
 *   code?: string,
 *   reservation_id?: string,
 *   error?: string
 * }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface BookingRequest {
  start_at: string;
  service_name: string;
  guests: number;
  name: string;
  phone: string;
  email?: string;
  notes?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body: BookingRequest = await req.json();

    // Validate required fields
    const { start_at, service_name, guests, name, phone, email, notes } = body;

    if (!start_at || !service_name || !guests || !name || !phone) {
      return new Response(
        JSON.stringify({ ok: false, error: "Champs requis manquants" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate service name
    if (!["midi", "soir"].includes(service_name)) {
      return new Response(
        JSON.stringify({ ok: false, error: "Service invalide" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate guests
    if (guests < 1 || guests > 20) {
      return new Response(
        JSON.stringify({ ok: false, error: "Nombre de couverts invalide (1-20)" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate date
    const startDate = new Date(start_at);
    if (isNaN(startDate.getTime())) {
      return new Response(
        JSON.stringify({ ok: false, error: "Date invalide" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if date is in the past
    const now = new Date();
    if (startDate < now) {
      return new Response(
        JSON.stringify({ ok: false, error: "Impossible de réserver dans le passé" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check advance booking limit (30 days)
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 30);
    if (startDate > maxDate) {
      return new Response(
        JSON.stringify({ ok: false, error: "Réservation limitée à 30 jours à l'avance" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate phone format (basic)
    const phoneClean = phone.replace(/[\s\-\.]/g, "");
    if (phoneClean.length < 10) {
      return new Response(
        JSON.stringify({ ok: false, error: "Numéro de téléphone invalide" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate email if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ ok: false, error: "Email invalide" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Initialize Supabase client with service role key for RPC
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Call the book_reservation function (handles locking and anti-double-booking)
    const { data, error } = await supabase.rpc("book_reservation", {
      p_service_name: service_name,
      p_start_at: start_at,
      p_guests: guests,
      p_name: name.trim(),
      p_phone: phoneClean,
      p_email: email?.trim() || null,
      p_notes: notes?.trim() || null,
    });

    if (error) {
      console.error("Database error:", error);
      return new Response(
        JSON.stringify({ ok: false, error: "Erreur lors de la réservation" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // The RPC function returns an array with one row
    const result = data?.[0];

    if (!result || !result.ok) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: result?.error || "Réservation impossible",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Send confirmation email if email provided (optional, using Resend)
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (email && resendApiKey) {
      try {
        await sendConfirmationEmail(resendApiKey, {
          to: email,
          name,
          code: result.code,
          date: startDate,
          service_name,
          guests,
        });
      } catch (emailError) {
        // Log but don't fail the reservation
        console.error("Email sending failed:", emailError);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        code: result.code,
        reservation_id: result.reservation_id,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ ok: false, error: "Erreur serveur" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

/**
 * Send confirmation email via Resend
 */
async function sendConfirmationEmail(
  apiKey: string,
  data: {
    to: string;
    name: string;
    code: string;
    date: Date;
    service_name: string;
    guests: number;
  }
) {
  const { to, name, code, date, service_name, guests } = data;

  const formattedDate = date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const formattedTime = date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const serviceName = service_name === "midi" ? "Déjeuner" : "Dîner";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #161616; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #7B7A2A; margin: 0;">La Jardinerie</h1>
    <p style="color: #666; margin: 5px 0;">Guinguette & Bouillon</p>
  </div>

  <div style="background: #F6F1E6; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
    <h2 style="color: #161616; margin: 0 0 16px 0;">Réservation confirmée !</h2>
    <p style="margin: 0 0 16px 0;">Bonjour ${name},</p>
    <p style="margin: 0 0 16px 0;">Votre réservation à La Jardinerie est confirmée. Nous avons hâte de vous accueillir.</p>
  </div>

  <div style="background: #fff; border: 1px solid #e5e5e5; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
    <h3 style="color: #7B7A2A; margin: 0 0 16px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Détails de votre réservation</h3>

    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; color: #666;">Code</td>
        <td style="padding: 8px 0; text-align: right; font-weight: bold; font-size: 18px; color: #7B7A2A; letter-spacing: 2px;">${code}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #666;">Date</td>
        <td style="padding: 8px 0; text-align: right; font-weight: 500;">${formattedDate}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #666;">Heure</td>
        <td style="padding: 8px 0; text-align: right; font-weight: 500;">${formattedTime}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #666;">Service</td>
        <td style="padding: 8px 0; text-align: right; font-weight: 500;">${serviceName}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #666;">Couverts</td>
        <td style="padding: 8px 0; text-align: right; font-weight: 500;">${guests} personne${guests > 1 ? "s" : ""}</td>
      </tr>
    </table>
  </div>

  <div style="background: #fff; border: 1px solid #e5e5e5; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
    <h3 style="color: #7B7A2A; margin: 0 0 12px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Adresse</h3>
    <p style="margin: 0; color: #161616;">
      9 bis Boulevard de Clairfont<br>
      66350 Toulouges
    </p>
    <p style="margin: 12px 0 0 0;">
      <a href="https://www.google.com/maps/search/?api=1&query=9+bis+Boulevard+de+Clairfont+66350+Toulouges" style="color: #7B7A2A;">Voir sur Google Maps</a>
    </p>
  </div>

  <div style="text-align: center; color: #666; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5;">
    <p style="margin: 0 0 8px 0;">Pour modifier ou annuler votre réservation, contactez-nous :</p>
    <p style="margin: 0 0 8px 0;">
      <a href="tel:+33400000000" style="color: #7B7A2A;">04 00 00 00 00</a> |
      <a href="mailto:contact@lajardinerie.fr" style="color: #7B7A2A;">contact@lajardinerie.fr</a>
    </p>
    <p style="margin: 16px 0 0 0; color: #999; font-size: 12px;">
      La Jardinerie — Guinguette & Bouillon<br>
      Toulouges
    </p>
  </div>
</body>
</html>
  `.trim();

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "La Jardinerie <reservations@lajardinerie.fr>",
      to: [to],
      subject: `Réservation confirmée - ${code}`,
      html,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Resend API error: ${error}`);
  }
}
