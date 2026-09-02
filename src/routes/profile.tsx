import { createFileRoute } from "@tanstack/react-router";
import { BadgePercent, Car, Leaf, Star, Zap } from "lucide-react";
import { useApp } from "../lib/store";
import { CHARGER_LABELS } from "../lib/stations";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Your Profile — EcoPulse EV" },
      {
        name: "description",
        content:
          "Your EcoPulse EV profile: vehicle details, booking history, energy charged, and CO2 savings.",
      },
      { property: "og:title", content: "Your Profile — EcoPulse EV" },
      {
        property: "og:description",
        content:
          "Your EcoPulse EV profile: vehicle details, booking history, energy charged, and CO2 savings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { bookings } = useApp();
  const totalKwh = bookings.reduce((s, b) => s + b.estKwh, 0) + 186;
  const co2Saved = Math.round(totalKwh * 0.82);
  const discounts = bookings.filter((b) => b.discountApplied).length;

  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-20 sm:pb-10">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 font-display text-2xl font-bold text-primary">
          A
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">Arhaan Shaikh</h1>
          <p className="text-sm text-muted-foreground">
            EcoPulse member since 2025 · Green tier
          </p>
        </div>
      </div>

      <section className="mt-6 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <Car className="h-5 w-5 text-cyber" />
          <div>
            <p className="text-sm font-semibold">Tata Nexon EV Max</p>
            <p className="text-xs text-muted-foreground">
              MH 12 EV 4242 · 40.5 kWh battery · CCS2
            </p>
          </div>
        </div>
      </section>

      <section className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <Zap className="mx-auto h-5 w-5 text-primary" />
          <p className="mt-1 font-display text-lg font-bold">{totalKwh} kWh</p>
          <p className="text-[11px] text-muted-foreground">Energy charged</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <Leaf className="mx-auto h-5 w-5 text-primary" />
          <p className="mt-1 font-display text-lg font-bold">{co2Saved} kg</p>
          <p className="text-[11px] text-muted-foreground">CO₂ saved</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <BadgePercent className="mx-auto h-5 w-5 text-volt" />
          <p className="mt-1 font-display text-lg font-bold">{discounts}</p>
          <p className="text-[11px] text-muted-foreground">Reroute discounts</p>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Star className="h-4 w-4" /> Favorite stations
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {["MG Road EV Hub", "Baner Green Grid", "Electronic City Power Dock"].map(
            (name) => (
              <span
                key={name}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium"
              >
                {name}
              </span>
            ),
          )}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Booking history
        </h2>
        {bookings.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Bookings you make will appear here.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {bookings.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold">{b.stationName}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {b.day} · {CHARGER_LABELS[b.chargerType]} · {b.estKwh} kWh
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">₹{b.total}</p>
                  <p className="font-mono text-[10px] text-primary">{b.id}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
