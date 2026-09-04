import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { QRCodeSVG } from "qrcode.react";
import { BadgePercent, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { z } from "zod";
import { confirmBookingPayment, type StoredBooking } from "../lib/payments.functions";
import { CHARGER_LABELS } from "../lib/stations";
import { useApp } from "../lib/store";

export const Route = createFileRoute("/booking/success")({
  validateSearch: z.object({
    code: z.string().optional(),
    session_id: z.string().optional(),
  }),
  head: () => ({
    meta: [
      { title: "Booking Confirmed — EcoPulse EV" },
      {
        name: "description",
        content:
          "Your EV charging slot is paid and confirmed. Show the QR code at the station to start your session.",
      },
      { property: "og:title", content: "Booking Confirmed — EcoPulse EV" },
      {
        property: "og:description",
        content: "Your EV charging slot is paid and confirmed with a scannable QR pass.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SuccessPage,
});

function fmtHour(h: number) {
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:00 ${ampm}`;
}

function SuccessPage() {
  const { code, session_id: sessionId } = Route.useSearch();
  const confirmPayment = useServerFn(confirmBookingPayment);
  const { reloadBookings } = useApp();
  const [booking, setBooking] = useState<StoredBooking | null>(null);
  const [state, setState] = useState<"loading" | "done" | "error">("loading");

  useEffect(() => {
    if (!code || !sessionId) {
      setState("error");
      return;
    }
    confirmPayment({ data: { code, sessionId } })
      .then((res) => {
        setBooking(res.booking);
        setState(res.booking ? "done" : "error");
        reloadBookings();
      })
      .catch(() => setState("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, sessionId]);

  return (
    <main className="mx-auto max-w-md px-4 pb-24 pt-20 sm:pb-10">
      {state === "loading" && (
        <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm">Confirming your payment…</p>
        </div>
      )}

      {state === "error" && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-center">
          <XCircle className="mx-auto h-9 w-9 text-destructive" />
          <h1 className="mt-2 font-display text-lg font-bold">
            We couldn&apos;t confirm this booking
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            If money left your account, the booking will appear under My bookings shortly.
          </p>
          <Link
            to="/booking"
            className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
          >
            Go to my bookings
          </Link>
        </div>
      )}

      {state === "done" && booking && (
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
          <h1 className="mt-2 font-display text-xl font-bold">
            {booking.status === "paid" ? "Payment Received" : "Payment Pending"}
          </h1>
          <p className="text-xs text-muted-foreground">
            {booking.status === "paid"
              ? "Show this QR at the station to start charging"
              : "Your bank is still processing this payment."}
          </p>
          <div className="mx-auto mt-4 w-fit rounded-xl bg-foreground p-3">
            <QRCodeSVG
              value={`ECOPULSE:${booking.code}:${booking.stationId}:${booking.day}@${booking.hour}`}
              size={150}
            />
          </div>
          <p className="mt-3 font-mono text-sm font-bold tracking-widest text-primary">
            {booking.code}
          </p>
          <div className="mt-4 space-y-1 rounded-xl border border-border bg-secondary/50 p-3 text-left text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Station</span>
              <span className="font-medium">{booking.stationName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Slot</span>
              <span className="font-medium capitalize">
                {booking.day} · {fmtHour(booking.hour)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Charger</span>
              <span className="font-medium">
                {CHARGER_LABELS[booking.chargerType]} {booking.powerKw} kW
              </span>
            </div>
            {booking.discountApplied && (
              <div className="flex justify-between text-primary">
                <span className="flex items-center gap-1">
                  <BadgePercent className="h-3.5 w-3.5" /> Reroute discount
                </span>
                <span>15% off</span>
              </div>
            )}
            <div className="flex justify-between border-t border-border pt-1 font-bold">
              <span>Paid</span>
              <span>₹{booking.total}</span>
            </div>
          </div>
          <Link
            to="/booking"
            className="mt-4 inline-block w-full rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-glow"
          >
            Done
          </Link>
        </div>
      )}
    </main>
  );
}
