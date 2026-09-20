import { useState, useEffect } from "react";
import { MapContainer, Marker, Popup, TileLayer, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Zap, Navigation, Clock } from "lucide-react";
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

function ChangeView({ bounds }: { bounds: L.LatLngBoundsExpression | null }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [bounds, map]);
  return null;
}

interface Props {
  stations: Station[];
  userPos: { lat: number; lng: number } | null;
  flyTarget: [number, number] | null;
  onBook: (station: Station) => void;
}

export default function StationMap({ stations, userPos, flyTarget, onBook }: Props) {
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const [routeInfo, setRouteInfo] = useState<{ distanceKm: number; durationMins: number } | null>(null);
  const [mapBounds, setMapBounds] = useState<L.LatLngBoundsExpression | null>(null);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);

  // Fetch free OSRM route when a station marker is clicked OR triggered by AI Assistant reroute
  const handleStationClick = async (station: Station) => {
    setSelectedStationId(station.id);
    if (!userPos) return;

    const start = `${userPos.lng},${userPos.lat}`;
    const end = `${station.lng},${station.lat}`;

    try {
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${start};${end}?overview=full&geometries=geojson`
      );
      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const points: [number, number][] = route.geometry.coordinates.map(
          (coord: [number, number]) => [coord[1], coord[0]]
        );

        const distanceKm = +(route.distance / 1000).toFixed(1);
        const durationMins = Math.round(route.duration / 60);

        setRouteCoords(points);
        setRouteInfo({ distanceKm, durationMins });
        setMapBounds(L.latLngBounds(points));
      }
    } catch (error) {
      console.error("Failed to fetch route:", error);
    }
  };

  // --- LISTEN FOR AI ASSISTANT REROUTE EVENT ---
  useEffect(() => {
    const handleReroute = (e: CustomEvent<Station>) => {
      if (e.detail) {
        handleStationClick(e.detail);
      }
    };

    window.addEventListener("reroute-station" as any, handleReroute);
    return () => {
      window.removeEventListener("reroute-station" as any, handleReroute);
    };
  }, [userPos]);

  return (
    <div className="relative z-0 h-full w-full">
      <MapContainer
        center={[18.5204, 73.8567]} // Sets view directly to Pune
        zoom={12}                   // Zooms in close enough to see city roads
        scrollWheelZoom={true}
        className="h-full w-full rounded-lg"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="map-tiles-dark"
        />
        <FlyTo target={flyTarget} />
        <ChangeView bounds={mapBounds} />

        {/* GLOWING ROUTE LINE */}
        {routeCoords.length > 0 && (
          <>
            {/* Outer Cyan Glow */}
            <Polyline
              positions={routeCoords}
              pathOptions={{
                color: "#00f2fe",
                weight: 10,
                opacity: 0.35,
                lineCap: "round",
              }}
            />
            {/* Inner Neon Core */}
            <Polyline
              positions={routeCoords}
              pathOptions={{
                color: "#10b981",
                weight: 5,
                opacity: 0.95,
                lineCap: "round",
              }}
            />
          </>
        )}

        {/* User Location Marker */}
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

        {/* Station Markers */}
        {stations.map((s) => {
          const level = queueLevel(s);
          const dist = userPos ? haversineKm(userPos, s) : null;
          const types = [...new Set(s.chargers.map((ch) => ch.type))];
          const isSelected = selectedStationId === s.id;

          return (
            <Marker
              key={s.id}
              position={[s.lat, s.lng]}
              icon={pinIcon(level)}
              eventHandlers={{
                click: () => handleStationClick(s),
              }}
            >
              <Popup
                autoPanPaddingTopLeft={[20, 80]} // 80px top clearance for fixed header
                autoPanPaddingBottomRight={[20, 20]}
              >
                <div className="min-w-52">
                  <p className="font-display text-sm font-bold">{s.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.city}
                    {dist !== null && ` · ${dist.toFixed(1)} km away`}
                  </p>

                  {/* OSRM Route & Traffic Travel Time Badge */}
                  {isSelected && routeInfo && (
                    <div className="mt-2 flex flex-col gap-0.5 rounded bg-primary/10 p-2 text-xs text-primary border border-primary/20">
                      <span className="flex items-center gap-1 font-semibold">
                        <Navigation className="h-3 w-3" /> Route Distance: {routeInfo.distanceKm} km
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Est. Travel: ~{routeInfo.durationMins} mins
                      </span>
                    </div>
                  )}

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
    </div>
  );
}