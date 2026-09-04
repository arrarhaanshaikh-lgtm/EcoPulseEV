import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { QRCodeSVG } from "qrcode.react";
import { BadgePercent, CalendarClock, ChevronDown, Zap } from "lucide-react";
import { useApp } from "../lib/store";
import { CHARGER_LABELS, availablePorts, queueLevel } from "../lib/stations";
import BookingFlow from "../components/BookingFlow";

export const Route = createFileRoute("/booking")({
  head: () => ({
    meta: [
      { title: "Book a Slot — EcoPulse EV" },
      {
        name: "description",
        content:
          "Reserve an EV charging slot: pick a charger type, choose a time window, and get instant confirmation with a QR code.",
      },
      { property: "og:title", content: "Book a Slot — EcoPulse EV" },
      {
        property: "og:description",
        content:
          "Reserve an EV charging slot: pick a charger type, choose a time window, and get instant confirmation with a QR code.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BookingPage,
});

function fmtHour(h: number) {
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:00 ${ampm}`;
}

function BookingPage() {
  const { stations, bookings } = useApp();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = stations.find((s) => s.id === selectedId) ?? null;

  return (
    <main className="mx-auto max-w-4xl px-4 pb-24 pt-20 sm:pb-10">
      <h1 className="font-display text-2xl font-bold">Slot Booking</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Pick a station, charger, and time window — confirmation is instant.
      </p>

      <section className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Choose a station
        </h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {stations.map((s) => {
            const level = queueLevel(s);
            return (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className="flex items-center justify-between rounded-xl border border-border bg-card p-3.5 text-left transition-colors hover:border-primary/50"
              >
                <div>
                  <p className="text-sm font-semibold">{s.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.city} · {availablePorts(s)}/{s.chargers.length} ports free · ₹
                    {s.pricePerKwh}/kWh
                  </p>
                </div>
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                    level === "low"
                      ? "bg-primary"
                      : level === "moderate"
                        ? "bg-volt"
                        : "bg-destructive"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <CalendarClock className="h-4 w-4" /> My bookings
        </h2>
        {bookings.length === 0 ? (
          <div className="mt-3 rounded-xl border border-dashed border-border p-8 text-center">
            <Zap className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">
              No bookings yet.{" "}
              <Link to="/" className="text-primary hover:underline">
                Find a station on the map
              </Link>{" "}
              to get started.
            </p>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {bookings.map((b) => (
              <BookingCard key={b.code} bookingId={b.code} />
            ))}
          </div>
        )}
      </section>

      {selected && (
        <BookingFlow station={selected} onClose={() => setSelectedId(null)} />
      )}
    </main>
  );
}

function BookingCard({ bookingId }: { bookingId: string }) {
  const { bookings } = useApp();
  const [open, setOpen] = useState(false);
  const b = bookings.find((x) => x.code === bookingId);
  if (!b) return null;

  return (
    <article className="rounded-xl border border-border bg-card p-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-left"
      >
        <div>
          <p className="text-sm font-semibold">{b.stationName}</p>
          <p className="text-xs text-muted-foreground capitalize">
            {b.city} · {b.day} at {fmtHour(b.hour)} ·{" "}
            {CHARGER_LABELS[b.chargerType]} {b.powerKw} kW
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs font-bold text-primary">{b.code}</span>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          />
        </div>
      </button>
      {open && (
        <div className="mt-4 flex items-center gap-4 border-t border-border pt-4">
          <div className="rounded-lg bg-foreground p-2">
            <QRCodeSVG
              value={`ECOPULSE:${b.code}:${b.stationId}:${b.day}@${b.hour}`}
              size={88}
            />
          </div>
          <div className="text-sm">
            <p className="font-semibold">₹{b.total} estimated</p>
            <p className="text-xs text-muted-foreground">{b.estKwh} kWh session</p>
            {b.discountApplied && (
              <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-primary">
                <BadgePercent className="h-3.5 w-3.5" /> 15% reroute discount applied
              </p>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
