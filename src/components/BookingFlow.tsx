import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  BadgePercent,
  BatteryCharging,
  Clock,
  X,
  Zap,
} from "lucide-react";
import {
  CHARGER_LABELS,
  availablePorts,
  bestAlternative,
  isCongested,
  type ChargerType,
  type Station,
} from "../lib/stations";
import { useApp } from "../lib/store";
import { createBookingCheckout } from "../lib/payments.functions";

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function fmtHour(h: number) {
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:00 ${ampm}`;
}

interface Props {
  station: Station;
  onClose: () => void;
}

type Step = "charger" | "slot";

export default function BookingFlow({ station: initial, onClose }: Props) {
  const { stations, registerBooking, getStation } = useApp();
  const startCheckout = useServerFn(createBookingCheckout);
  const [stationId, setStationId] = useState(initial.id);
  const [step, setStep] = useState<Step>("charger");
  const [chargerType, setChargerType] = useState<ChargerType | null>(null);
  const [day, setDay] = useState<"today" | "tomorrow">("today");
  const [hour, setHour] = useState<number | null>(null);
  const [discount, setDiscount] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [rerouteDeclined, setRerouteDeclined] = useState(false);

  const station = getStation(stationId) ?? initial;
  const congested = isCongested(station);
  const alt = useMemo(
    () => (congested ? bestAlternative(stations, station) : null),
    [congested, stations, station],
  );
  const showReroute = congested && alt !== null && !rerouteDeclined;

  const chargerOptions = useMemo(() => {
    const map = new Map<ChargerType, { powerKw: number; free: number; total: number }>();
    for (const ch of station.chargers) {
      const cur = map.get(ch.type) ?? { powerKw: ch.powerKw, free: 0, total: 0 };
      cur.total += 1;
      if (ch.status === "active") cur.free += 1;
      cur.powerKw = Math.max(cur.powerKw, ch.powerKw);
      map.set(ch.type, cur);
    }
    return [...map.entries()];
  }, [station]);

  const now = new Date();
  const reservedHours = new Set(station.reserved[day]);
  const slotDisabled = (h: number) =>
    reservedHours.has(h) || (day === "today" && h <= now.getHours());

  const powerKw =
    chargerOptions.find(([t]) => t === chargerType)?.[1].powerKw ?? 0;
  const estKwh = Math.round(powerKw * 0.8 * 10) / 10; // 1h session, ~80% avg delivery
  const subtotal = Math.round(estKwh * station.pricePerKwh);
  const total = discount ? Math.round(subtotal * 0.85) : subtotal;

  const confirm = async () => {
    if (!chargerType || hour === null || paying) return;
    setPaying(true);
    setPayError(null);
    try {
      const res = await startCheckout({
        data: {
          stationId: station.id,
          stationName: station.name,
          city: station.city,
          chargerType,
          powerKw,
          day,
          hour,
          estKwh,
          total,
          discountApplied: discount,
        },
      });
      registerBooking(res.code);
      window.location.href = res.url;
    } catch (e) {
      setPayError(e instanceof Error ? e.message : "Could not start the payment.");
      setPaying(false);
    }
  };


  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-background/70 backdrop-blur-sm sm:items-center">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-border bg-card p-5 shadow-glow sm:rounded-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-lg font-bold">{station.name}</h2>
            <p className="text-xs text-muted-foreground">
              {station.city} · ₹{station.pricePerKwh}/kWh · {availablePorts(station)}/
              {station.chargers.length} ports free
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-border p-1.5 text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {showReroute && (
          <div className="mt-4 rounded-xl border border-volt/40 bg-volt/10 p-4 shadow-glow-volt">
            <p className="flex items-center gap-2 text-sm font-semibold text-volt">
              <Zap className="h-4 w-4" /> Smart Recommendation
            </p>
            <p className="mt-1.5 text-sm leading-relaxed">
              ⚡ {station.name} is heavily congested (~{station.waitMins} min wait).
              Reroute to <strong>{alt.station.name}</strong> (
              {alt.distanceKm.toFixed(1)} km away) for ~
              {alt.station.waitMins} min wait +{" "}
              <strong className="text-volt">15% discount</strong> on your booking!
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => {
                  setStationId(alt.station.id);
                  setDiscount(true);
                  setChargerType(null);
                  setHour(null);
                }}
                className="flex-1 rounded-md bg-volt px-3 py-2 text-xs font-bold text-volt-foreground"
              >
                Accept Reroute &amp; Get Discount
              </button>
              <button
                onClick={() => setRerouteDeclined(true)}
                className="flex-1 rounded-md border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Proceed Anyway
              </button>
            </div>
          </div>
        )}

        {discount && !booking && (
          <p className="mt-3 flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">
            <BadgePercent className="h-3.5 w-3.5" /> 15% reroute discount will be applied
          </p>
        )}

        {step === "charger" && (
          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Step 1 · Select charger type
            </p>
            <div className="mt-3 space-y-2">
              {chargerOptions.map(([type, info]) => (
                <button
                  key={type}
                  disabled={info.free === 0}
                  onClick={() => {
                    setChargerType(type);
                    setStep("slot");
                  }}
                  className={`flex w-full items-center justify-between rounded-xl border p-3 text-left transition-colors ${
                    info.free === 0
                      ? "cursor-not-allowed border-border opacity-40"
                      : "border-border hover:border-primary hover:bg-primary/5"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <BatteryCharging className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm font-semibold">
                        {CHARGER_LABELS[type]} · {info.powerKw} kW
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {info.free === 0
                          ? "No ports available"
                          : `${info.free} of ${info.total} ports free`}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        )}

        {step === "slot" && (
          <div className="mt-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Step 2 · {CHARGER_LABELS[chargerType!]} {powerKw} kW · pick a time
              </p>
              <button
                onClick={() => setStep("charger")}
                className="text-xs text-primary hover:underline"
              >
                Change
              </button>
            </div>
            <div className="mt-3 flex rounded-lg border border-border p-1">
              {(["today", "tomorrow"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => {
                    setDay(d);
                    setHour(null);
                  }}
                  className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold capitalize ${
                    day === d
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-4 gap-1.5">
              {HOURS.map((h) => {
                const disabled = slotDisabled(h);
                return (
                  <button
                    key={h}
                    disabled={disabled}
                    onClick={() => setHour(h)}
                    className={`rounded-md border px-1 py-2 text-[11px] font-medium ${
                      disabled
                        ? "cursor-not-allowed border-border text-muted-foreground/40 line-through"
                        : hour === h
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:border-primary/60"
                    }`}
                  >
                    {fmtHour(h)}
                  </button>
                );
              })}
            </div>
            {hour !== null && (
              <div className="mt-4 rounded-xl border border-border bg-secondary/50 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Est. energy (1 hr)</span>
                  <span>{estKwh} kWh</span>
                </div>
                {discount && (
                  <div className="mt-1 flex justify-between text-primary">
                    <span>Reroute discount</span>
                    <span>-15%</span>
                  </div>
                )}
                <div className="mt-1 flex justify-between font-bold">
                  <span>Estimated total</span>
                  <span>₹{total}</span>
                </div>
              </div>
            )}
            <button
              disabled={hour === null || paying}
              onClick={confirm}
              className="mt-4 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-glow disabled:cursor-not-allowed disabled:opacity-40"
            >
              {paying ? "Opening secure checkout…" : `Pay ₹${total} & Confirm`}
            </button>

          </div>
        )}

        {payError && (
          <p className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
            {payError}
          </p>
        )}


        <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3" /> Live station data from OpenChargeMap ·
          payment secured by Stripe
        </p>

      </div>
    </div>
  );
}
