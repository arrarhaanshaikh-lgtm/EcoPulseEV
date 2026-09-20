import { Suspense, lazy, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { LocateFixed, MapPin, Users, Zap } from "lucide-react";
import { useApp } from "../lib/store";
import {
  availablePorts,
  haversineKm,
  queueLevel,
  type Station,
} from "../lib/stations";
import BookingFlow from "../components/BookingFlow";

const StationMap = lazy(() => import("../components/StationMap"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EcoPulse EV — Smart EV Charging Station Locator" },
      {
        name: "description",
        content:
          "Find nearby EV charging stations across India, check live queue status, and book charging slots with smart load-balanced rerouting.",
      },
      { property: "og:title", content: "EcoPulse EV — Smart EV Charging Station Locator" },
      {
        property: "og:description",
        content:
          "Find nearby EV charging stations across India, check live queue status, and book slots with smart rerouting.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MapPage,
});

const LEVEL_STYLES = {
  low: "bg-primary/15 text-primary border-primary/30",
  moderate: "bg-volt/15 text-volt border-volt/30",
  congested: "bg-destructive/15 text-destructive border-destructive/30",
} as const;

const LEVEL_LABEL = {
  low: "Low queue",
  moderate: "Moderate",
  congested: "Congested",
} as const;

function MapPage() {
  const { stations, loading, error, userPos } = useApp();
  const [mounted, setMounted] = useState(false);
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);
  const [bookingStation, setBookingStation] = useState<Station | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const sorted = [...stations].sort((a, b) => {
    if (!userPos) return 0;
    return haversineKm(userPos, a) - haversineKm(userPos, b);
  });

  // --- DYNAMIC LOAD-BALANCING LOGIC ---
  const nearestStation = sorted[0];
  const isNearestCongested = nearestStation && queueLevel(nearestStation) === "congested";
  
  // Find the closest non-congested station as an alternative
  const alternativeStation = isNearestCongested
    ? sorted.find((s) => s.id !== nearestStation.id && queueLevel(s) !== "congested")
    : null;

  // Calculate time saved dynamically
  const timeSaved = isNearestCongested && alternativeStation
    ? Math.max(5, nearestStation.waitMins - alternativeStation.waitMins)
    : 0;

  return (
    <main className="pb-20 pt-14 sm:pb-0">
      <section className="relative h-[52vh] min-h-80 sm:h-[62vh]">
        {mounted ? (
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center bg-secondary text-sm text-muted-foreground">
                Loading map…
              </div>
            }
          >
            <StationMap
              stations={stations}
              userPos={userPos}
              flyTarget={flyTarget}
              onBook={setBookingStation}
            />
          </Suspense>
        ) : (
          <div className="flex h-full items-center justify-center bg-secondary text-sm text-muted-foreground">
            Loading map…
          </div>
        )}
        {userPos && (
          <button
            onClick={() => setFlyTarget([userPos.lat, userPos.lng])}
            className="absolute bottom-4 right-4 z-[800] flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold shadow-lg"
          >
            <LocateFixed className="h-4 w-4 text-cyber" /> My location
          </button>
        )}
        <div className="absolute left-4 top-4 z-[800] flex gap-2 rounded-full border border-border bg-card/90 px-3 py-1.5 text-[10px] font-semibold backdrop-blur">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary" /> Low</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-volt" /> Moderate</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-destructive" /> Congested</span>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-6">
        
        {/* DYNAMIC SMART LOAD-BALANCING ALERT BANNER */}
        {nearestStation && isNearestCongested && alternativeStation ? (
          /* Case 1: Nearest station is CONGESTED -> Show Reroute Banner */
          <div className="mb-6 rounded-xl border border-amber-500/40 bg-amber-950/30 p-4 shadow-lg shadow-amber-500/10 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 text-xl font-bold">
                ⚡
              </div>
              <div className="text-sm">
                <span className="font-bold text-amber-400">Smart Grid Advice: </span>
                <span className="text-slate-200">
                  <strong className="text-white">{nearestStation.name}</strong> is congested ({nearestStation.waitMins} min wait). Reroute to <strong className="text-emerald-300">{alternativeStation.name}</strong> to save {timeSaved} mins & get a 10% green off-peak discount!
                </span>
              </div>
            </div>
          </div>
        ) : nearestStation ? (
          /* Case 2: Nearest station is CLEAR -> Show Optimal Status Banner */
          <div className="mb-6 rounded-xl border border-emerald-500/40 bg-emerald-950/30 p-4 shadow-lg shadow-emerald-500/10 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-xl font-bold">
                ✓
              </div>
              <div className="text-sm">
                <span className="font-bold text-emerald-400">Smart Grid Status: </span>
                <span className="text-slate-200">
                  Optimal traffic conditions! Your nearest station <strong className="text-white">{nearestStation.name}</strong> has a low wait time (~{nearestStation.waitMins} mins).
                </span>
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-between">
          <h1 className="font-display text-xl font-bold">
            Stations near you
          </h1>
          <span className="text-xs text-muted-foreground">
            {stations.length} live across India
          </span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((s) => {
            const level = queueLevel(s);
            const dist = userPos ? haversineKm(userPos, s) : null;
            return (
              <article
                key={s.id}
                className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-display text-sm font-bold">{s.name}</h2>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {s.city}
                      {dist !== null && ` · ${dist.toFixed(1)} km`}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${LEVEL_STYLES[level]}`}
                  >
                    {LEVEL_LABEL[level]}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" /> {s.queue} in queue · ~{s.waitMins} min
                  </span>
                  <span className="flex items-center gap-1">
                    <Zap className="h-3.5 w-3.5" /> {availablePorts(s)}/{s.chargers.length} free
                  </span>
                  <span>₹{s.pricePerKwh}/kWh</span>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => setFlyTarget([s.lat, s.lng])}
                    className="flex-1 rounded-md border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
                  >
                    View on map
                  </button>
                  <button
                    onClick={() => setBookingStation(s)}
                    className="flex-1 rounded-md bg-primary px-3 py-2 text-xs font-bold text-primary-foreground shadow-glow"
                  >
                    Book a Slot
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {bookingStation && (
        <BookingFlow
          station={bookingStation}
          onClose={() => setBookingStation(null)}
        />
      )}
    </main>
  );
}