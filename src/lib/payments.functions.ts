import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

export interface StoredBooking {
  code: string;
  stationId: string;
  stationName: string;
  city: string;
  chargerType: "CCS" | "Type2" | "AC";
  powerKw: number;
  day: "today" | "tomorrow";
  hour: number;
  estKwh: number;
  total: number;
  discountApplied: boolean;
  status: "pending" | "paid" | "failed";
  createdAt: number;
}

const checkoutSchema = z.object({
  stationId: z.string().min(1).max(120),
  stationName: z.string().min(1).max(200),
  city: z.string().min(1).max(120),
  chargerType: z.enum(["CCS", "Type2", "AC"]),
  powerKw: z.number().int().min(1).max(600),
  day: z.enum(["today", "tomorrow"]),
  hour: z.number().int().min(0).max(23),
  estKwh: z.number().min(0.1).max(500),
  total: z.number().int().min(1).max(100000),
  discountApplied: z.boolean(),
});

const STRIPE_MISSING =
  "Payments aren't connected yet. Add a Stripe secret key in the project settings to take real payments.";

function makeCode() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  for (const b of bytes) s += alphabet[b % alphabet.length];
  return `EP-${s}`;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function rowToBooking(row: any): StoredBooking {
  return {
    code: row.code,
    stationId: row.station_id,
    stationName: row.station_name,
    city: row.city,
    chargerType: row.charger_type,
    powerKw: row.power_kw,
    day: row.day,
    hour: row.hour,
    estKwh: Number(row.est_kwh),
    total: row.amount_inr,
    discountApplied: row.discount_applied,
    status: row.status,
    createdAt: new Date(row.created_at).getTime(),
  };
}

async function stripeFetch(path: string, key: string, body?: URLSearchParams) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${key}`,
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    ...(body ? { body } : {}),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`Stripe ${path} failed [${res.status}]: ${text}`);
    throw new Error(`Payment provider error (${res.status}). Please try again.`);
  }
  return JSON.parse(text);
}

export const createBookingCheckout = createServerFn({ method: "POST" })
  .validator((data: unknown) => checkoutSchema.parse(data))
  .handler(async ({ data }): Promise<{ url: string; code: string }> => {
    const key = process.env["STRIPE_SECRET_KEY"];

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const code = makeCode();


    const { error } = await supabaseAdmin.from("bookings").insert({
      code,
      station_id: data.stationId,
      station_name: data.stationName,
      city: data.city,
      charger_type: data.chargerType,
      power_kw: data.powerKw,
      day: data.day,
      hour: data.hour,
      est_kwh: data.estKwh,
      amount_inr: data.total,
      discount_applied: data.discountApplied,
      status: key ? "pending" : "paid",
      ...(key ? {} : { stripe_session_id: "demo", paid_at: new Date().toISOString() }),
    });
    if (error) {
      console.error("Booking insert failed", error);
      throw new Error("Could not create the booking. Please try again.");
    }

    const origin = new URL(getRequest().url).origin;

    // No Stripe key configured — confirm the booking in demo mode instead of failing.
    if (!key) {
      console.warn(STRIPE_MISSING);
      return { url: `${origin}/booking/success?code=${code}&session_id=demo`, code };
    }

    const params = new URLSearchParams();

    params.set("mode", "payment");
    params.set("success_url", `${origin}/booking/success?code=${code}&session_id={CHECKOUT_SESSION_ID}`);
    params.set("cancel_url", `${origin}/booking?cancelled=${code}`);
    params.set("client_reference_id", code);
    params.set("metadata[booking_code]", code);
    params.set("line_items[0][quantity]", "1");
    params.set("line_items[0][price_data][currency]", "inr");
    params.set("line_items[0][price_data][unit_amount]", String(data.total * 100));
    params.set(
      "line_items[0][price_data][product_data][name]",
      `EV charging — ${data.stationName}`,
    );
    params.set(
      "line_items[0][price_data][product_data][description]",
      `${data.chargerType} ${data.powerKw} kW · ${data.day} ${data.hour}:00 · ~${data.estKwh} kWh`,
    );

    const session = await stripeFetch("checkout/sessions", key, params);

    await supabaseAdmin
      .from("bookings")
      .update({ stripe_session_id: session.id })
      .eq("code", code);

    return { url: session.url as string, code };
  });

/** Confirms payment after Stripe redirects back (webhook-independent fallback). */
export const confirmBookingPayment = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({ code: z.string().min(3).max(20), sessionId: z.string().min(3).max(200) }).parse(data),
  )
  .handler(async ({ data }): Promise<{ booking: StoredBooking | null }> => {
    const key = process.env["STRIPE_SECRET_KEY"];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (key && data.sessionId !== "demo") {
      const session = await stripeFetch(`checkout/sessions/${data.sessionId}`, key);
      if (session.client_reference_id === data.code && session.payment_status === "paid") {
        await supabaseAdmin
          .from("bookings")
          .update({ status: "paid", paid_at: new Date().toISOString() })
          .eq("code", data.code)
          .eq("status", "pending");
      }
    }

    const { data: row } = await supabaseAdmin
      .from("bookings")
      .select("*")
      .eq("code", data.code)
      .maybeSingle();
    return { booking: row ? rowToBooking(row) : null };
  });

export const getBookings = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({ codes: z.array(z.string().min(3).max(20)).max(50) }).parse(data),
  )
  .handler(async ({ data }): Promise<{ bookings: StoredBooking[] }> => {
    if (data.codes.length === 0) return { bookings: [] };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("bookings")
      .select("*")
      .in("code", data.codes)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Booking fetch failed", error);
      return { bookings: [] };
    }
    return { bookings: (rows ?? []).map(rowToBooking) };
  });

export const paymentsStatus = createServerFn({ method: "GET" }).handler(async () => ({
  configured: Boolean(process.env["STRIPE_SECRET_KEY"]),
}));
