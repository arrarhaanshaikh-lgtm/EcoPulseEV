import { useEffect } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Zap } from "lucide-react";
import {
  CHARGER_LABELS,
  availablePorts,
  haversineKm,
  queueLevel,
  type Station,
} from "../lib/stations";

const PIN_COLORS = {
  low: "#34d399",
  moderate: "#fbbf24",
  congested: "#f87171",
} as const;

function pinIcon(level: keyof typeof PIN_COLORS): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div class="station-pin" style="background:${PIN_COLORS[level]}"><span>⚡</span></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -28],
  });
}

function FlyTo({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target, 13, { duration: 1 });
  }, [target, map]);
  return null;
}

interface Props {
  stations: Station[];
  userPos: { lat: number; lng: number } | null;
  flyTarget: [number, number] | null;
  onBook: (station: Station) => void;
}

export default function StationMap({ stations, userPos, flyTarget, onBook }: Props) {
  return (
    <MapContainer
      center={[22.5, 79]}
      zoom={5}
      className="h-full w-full"
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      <FlyTo target={flyTarget} />
      {userPos && (
        <Marker
          position={[userPos.lat, userPos.lng]}
          icon={L.divIcon({
            className: "",
            html: `<div style="width:14px;height:14px;border-radius:9999px;background:#22d3ee;border:3px solid #0e7490;box-shadow:0 0 12px #22d3ee"></div>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          })}
        />
      )}
      {stations.map((s) => {
        const level = queueLevel(s);
        const dist = userPos ? haversineKm(userPos, s) : null;
        const types = [...new Set(s.chargers.map((ch) => ch.type))];
        return (
          <Marker
            key={s.id}
            position={[s.lat, s.lng]}
            icon={pinIcon(level)}
          >
            <Popup>
              <div className="min-w-52">
                <p className="font-display text-sm font-bold">{s.name}</p>
                <p className="text-xs text-muted-foreground">
                  {s.city}
                  {dist !== null && ` · ${dist.toFixed(1)} km away`}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {types.map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-border px-2 py-0.5 text-[10px]"
                    >
                      {CHARGER_LABELS[t]}
                    </span>
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-3 text-xs">
                  <span className="text-muted-foreground">Ports</span>
                  <span>
                    {availablePorts(s)}/{s.chargers.length} free
                  </span>
                  <span className="text-muted-foreground">Queue</span>
                  <span>{s.queue} vehicles</span>
                  <span className="text-muted-foreground">Wait</span>
                  <span>~{s.waitMins} min</span>
                  <span className="text-muted-foreground">Price</span>
                  <span>₹{s.pricePerKwh}/kWh</span>
                </div>
                <button
                  onClick={() => onBook(s)}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                >
                  <Zap className="h-3.5 w-3.5" /> Book a Slot
                </button>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
