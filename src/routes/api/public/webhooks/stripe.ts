import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

export const Route = createFileRoute("/api/public/webhooks/stripe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["STRIPE_WEBHOOK_SECRET"];
        if (!secret) return new Response("Webhook not configured", { status: 503 });

        const header = request.headers.get("stripe-signature") ?? "";
        const body = await request.text();

        const parts = Object.fromEntries(
          header.split(",").map((p) => {
            const [k, ...v] = p.split("=");
            return [k?.trim(), v.join("=")];
          }),
        ) as { t?: string; v1?: string };

        if (!parts.t || !parts.v1) return new Response("Invalid signature", { status: 401 });

        const expected = createHmac("sha256", secret)
          .update(`${parts.t}.${body}`)
          .digest("hex");
        const sig = Buffer.from(parts.v1);
        const exp = Buffer.from(expected);
        if (sig.length !== exp.length || !timingSafeEqual(sig, exp)) {
          return new Response("Invalid signature", { status: 401 });
        }

        // Reject replays older than 5 minutes.
        if (Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) {
          return new Response("Stale signature", { status: 401 });
        }

        const event = JSON.parse(body) as {
          type: string;
          data: { object: { client_reference_id?: string; metadata?: { booking_code?: string } } };
        };
        const code =
          event.data.object.client_reference_id ?? event.data.object.metadata?.booking_code;

        if (code) {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          if (event.type === "checkout.session.completed") {
            await supabaseAdmin
              .from("bookings")
              .update({ status: "paid", paid_at: new Date().toISOString() })
              .eq("code", code);
          } else if (
            event.type === "checkout.session.expired" ||
            event.type === "checkout.session.async_payment_failed"
          ) {
            await supabaseAdmin
              .from("bookings")
              .update({ status: "failed" })
              .eq("code", code)
              .eq("status", "pending");
          }
        }

        return new Response("ok");
      },
    },
  },
});
