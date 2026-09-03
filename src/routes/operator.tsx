import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  BadgePercent,
  IndianRupee,
  TrendingUp,
  Wrench,
  Zap,
} from "lucide-react";
import { useApp } from "../lib/store";
import {
  CHARGER_LABELS,
  type ChargerStatus,
  type Station,
} from "../lib/stations";

export const Route = createFileRoute("/operator")({
  head: () => ({
    meta: [
      { title: "Operator Dashboard — EcoPulse EV" },
      {
        name: "description",
        content:
          "Station operator control panel: live utilization metrics, peak demand hours, rerouting impact, and charger status controls.",
      },
      { property: "og:title", content: "Operator Dashboard — EcoPulse EV" },
      {
        property: "og:description",
        content:
          "Station operator control panel: live utilization metrics, peak demand hours, rerouting impact, and charger status controls.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OperatorPage,
});

const DEMAND = [3, 2, 1, 1, 2, 4, 6, 9, 12, 14, 11, 9, 10, 8, 7, 8, 10, 13, 16, 15, 12, 8, 6, 4];

const STATUS_STYLE: Record<ChargerStatus, string> = {
  active: "bg-primary/15 text-primary border-primary/40",
  occupied: "bg-volt/15 text-volt border-volt/40",
  maintenance: "bg-destructive/15 text-destructive border-destructive/40",
};

const STATUSES: ChargerStatus[] = ["active", "occupied", "maintenance"];

function OperatorPage() {
  const { stations, bookings, rerouteCount, setChargerStatus } = useApp();

  const allChargers = stations.flatMap((s) => s.chargers);
  const active = allChargers.filter((c) => c.status === "active").length;
  const revenue =
    48250 + bookings.reduce((sum, b) => sum + b.total, 0);
  const peakHour = DEMAND.indexOf(Math.max(...DEMAND));
  const peakFmt = `${peakHour % 12 === 0 ? 12 : peakHour % 12}:00 ${peakHour >= 12 ? "PM" : "AM"}`;
  const rerouted = rerouteCount + 14; // seeded historical reroutes
  const reroutePct = Math.round((rerouted / (rerouted + 86)) * 100);

  const metrics = [
    { icon: IndianRupee, label: "Total revenue", value: `₹${revenue.toLocaleString("en-IN")}`, tone: "text-primary" },
    { icon: Zap, label: "Active chargers", value: `${active}/${allChargers.length}`, tone: "text-cyber" },
    { icon: TrendingUp, label: "Peak demand", value: peakFmt, tone: "text-volt" },
    { icon: BadgePercent, label: "Load shifted", value: `${rerouted} (${reroutePct}%)`, tone: "text-primary" },
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 pt-20 sm:pb-10">
      <div className="flex items-center gap-2">
        <Activity className="h-5 w-5 text-primary" />
        <h1 className="font-display text-2xl font-bold">Operator Dashboard</h1>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Live network utilization and charger controls across all stations.
      </p>

      <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map(({ icon: Icon, label, value, tone }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4">
            <Icon className={`h-5 w-5 ${tone}`} />
            <p className="mt-2 font-display text-xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </section>

      <section className="mt-6 rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Hourly demand (sessions)</h2>
        <div className="mt-4 flex h-32 gap-1">
          {DEMAND.map((v, h) => (
            <div key={h} className="group relative flex flex-1 items-end">
              <div
                className={`w-full rounded-t ${h === peakHour ? "bg-volt" : "bg-primary/70"}`}
                style={{ height: `${(v / 16) * 100}%`, minHeight: 4 }}
              />
              <span className="pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 rounded bg-popover px-1.5 py-0.5 text-[10px] opacity-0 shadow group-hover:opacity-100">
                {h}:00 · {v}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
          <span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>11 PM</span>
        </div>
      </section>

      <section className="mt-6 space-y-4">
        {stations.map((s) => (
          <StationPanel
            key={s.id}
            station={s}
            onSetStatus={(chargerId, status) =>
              setChargerStatus(s.id, chargerId, status)
            }
          />
        ))}
      </section>
    </main>
  );
}

function StationPanel({
  station,
  onSetStatus,
}: {
  station: Station;
  onSetStatus: (chargerId: string, status: ChargerStatus) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-sm font-bold">{station.name}</h2>
          <p className="text-xs text-muted-foreground">
            {station.city} · queue {station.queue} · ~{station.waitMins} min wait
          </p>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {station.chargers.map((ch) => (
          <div
            key={ch.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2"
          >
            <div className="flex items-center gap-2 text-sm">
              {ch.status === "maintenance" ? (
                <Wrench className="h-4 w-4 text-destructive" />
              ) : (
                <Zap className="h-4 w-4 text-primary" />
              )}
              <span className="font-medium">
                {CHARGER_LABELS[ch.type]} · {ch.powerKw} kW
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {ch.id}
              </span>
            </div>
            <div className="flex gap-1">
              {STATUSES.map((st) => (
                <button
                  key={st}
                  onClick={() => onSetStatus(ch.id, st)}
                  className={`rounded-full border px-2.5 py-1 text-[10px] font-bold capitalize transition-colors ${
                    ch.status === st
                      ? STATUS_STYLE[st]
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
