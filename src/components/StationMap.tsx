import { useState, useEffect } from "react";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  Polyline,
  useMap,
  useMapEvents,
  ZoomControl,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Zap, Navigation, Clock, Wrench, Phone } from "lucide-react";
import {
  CHARGER_LABELS,
  availablePorts,
  haversineKm,
  queueLevel,
  calculateCongestionScore,
  type Station,
} from "../lib/stations";
import {
  fetchLiveServiceCenters,
  type ServiceCenter,
} from "../lib/osmServiceCenters";

const PIN_COLORS = {
  low: "#34d399",
  moderate: "#fbbf24",
  congested: "#f87171",
} as const;

// Custom DivIcon for station markers
function pinIcon(level: keyof typeof PIN_COLORS, isEnRoute: boolean = true): L.DivIcon {
  return L.divIcon({
    className: "custom-station-pin",
    html: `<div class="station-pin" style="background:${PIN_COLORS[level]}; opacity: ${isEnRoute ? 1 : 0.25}; transform: ${isEnRoute ? 'scale(1)' : 'scale(0.85)'}; transition: all 0.3s ease;"><span>⚡</span></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
}

// Custom DivIcon for EV Service Centers
const serviceCenterIcon = L.divIcon({
  className: "custom-service-pin",
  html: `<div style="background:#8b5cf6; width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; border:2px solid #ffffff; box-shadow:0 0 12px rgba(139,92,246,0.8); font-size:14px; color:white;">🔧</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

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
      map.fitBounds(bounds, { padding: [60, 60] });
    }
  }, [bounds, map]);
  return null;
}

function MapClickHandler() {
  useMapEvents({
    click(e) {
      window.dispatchEvent(
        new CustomEvent("map-point-selected", {
          detail: { lat: e.latlng.lat, lng: e.latlng.lng },
        })
      );
    },
  });
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
  const [routeInfo, setRouteInfo] = useState<{
    distanceKm: number;
    durationMins: number;
    congestionScore: number;
  } | null>(null);
  const [mapBounds, setMapBounds] = useState<L.LatLngBoundsExpression | null>(null);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);

  // Live Service Centers and Filter States
  const [serviceCenters, setServiceCenters] = useState<ServiceCenter[]>([]);
  const [activeFilter, setActiveFilter] = useState<"all" | "charging" | "service">("all");

  // Highway corridor states
  const [highwayOrigin, setHighwayOrigin] = useState<[number, number] | null>(
    userPos ? [userPos.lat, userPos.lng] : [18.5204, 73.8567]
  );
  const [highwayDest, setHighwayDest] = useState<[number, number] | null>([19.0760, 72.8777]);
  const [recommendedStationPos, setRecommendedStationPos] = useState<[number, number] | null>(null);
  const [enRouteStationIds, setEnRouteStationIds] = useState<Set<string>>(new Set());

  // Primitive user coordinate values to stabilize hook triggers
  const userLat = userPos?.lat;
  const userLng = userPos?.lng;

  // Sync highwayOrigin with live userPos
  useEffect(() => {
    if (userPos) {
      setHighwayOrigin([userPos.lat, userPos.lng]);
    }
  }, [userPos]);

  // Fetch live service centers from OpenStreetMap safely
  useEffect(() => {
    const lat = userLat ?? 18.5204;
    const lng = userLng ?? 73.8567;

    fetchLiveServiceCenters(lat, lng).then((data) => {
      if (data && data.length > 0) {
        setServiceCenters(data);
      }
    });
  }, [userLat, userLng]);

  // Fetch OSRM driving route for Charging Stations
  const handleStationClick = async (station: Station) => {
    setSelectedStationId(String(station.id));
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

        const congestionScore = calculateCongestionScore({
          distanceKm,
          queueLength: station.queue || 0,
          routeDurationMins: durationMins,
        });

        setRouteCoords([]);
        setTimeout(() => {
          setRouteCoords(points);
          setRouteInfo({ distanceKm, durationMins, congestionScore });
          setMapBounds(L.latLngBounds(points));
        }, 10);
      }
    } catch (error) {
      console.error("Failed to fetch route to station:", error);
    }
  };

  // Fetch OSRM driving route for Service Centers
  const handleServiceCenterClick = async (sc: ServiceCenter) => {
    setSelectedStationId(sc.id);
    const startLat = userPos ? userPos.lat : 18.5204;
    const startLng = userPos ? userPos.lng : 73.8567;

    const start = `${startLng},${startLat}`;
    const end = `${sc.lng},${sc.lat}`;

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

        setRouteCoords([]);
        setTimeout(() => {
          setRouteCoords(points);
          setRouteInfo({ distanceKm, durationMins, congestionScore: 0 });
          setMapBounds(L.latLngBounds(points));
        }, 10);
      }
    } catch (error) {
      console.error("Failed to fetch route to service center:", error);
    }
  };

  // Listen for AI assistant reroute event
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

  // Listen for Highway Planner route updates
  useEffect(() => {
    const handleHighwayUpdate = (e: CustomEvent<any>) => {
      if (e.detail) {
        const { originCoords, destCoords, routeCoords: newRouteCoords, recommendedStation, enRouteStations } = e.detail;

        if (originCoords) setHighwayOrigin(originCoords);
        if (destCoords) setHighwayDest(destCoords);

        if (recommendedStation) {
          setRecommendedStationPos([recommendedStation.lat, recommendedStation.lng]);
        } else {
          setRecommendedStationPos(null);
        }

        if (enRouteStations && Array.isArray(enRouteStations)) {
          setEnRouteStationIds(new Set(enRouteStations.map((s: any) => String(s.id))));
        }

        if (newRouteCoords && newRouteCoords.length > 0) {
          setRouteCoords([]);
          setTimeout(() => {
            setRouteCoords(newRouteCoords);
            setMapBounds(L.latLngBounds(newRouteCoords));
          }, 10);
        }
      }
    };

    window.addEventListener("highway-route-updated" as any, handleHighwayUpdate);
    return () => {
      window.removeEventListener("highway-route-updated" as any, handleHighwayUpdate);
    };
  }, []);

  const isServiceHubSelected =
    selectedStationId?.includes("osm") || selectedStationId?.includes("sc-");

  return (
    <div className="relative z-0 h-full w-full">
      {/* MAP CONTROLS OVERLAY */}
      <div className="absolute top-3 left-3 z-[1000] flex flex-wrap items-center gap-2 pointer-events-auto max-w-[calc(100%-2rem)]">
        <div className="flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-xl border border-border/60 bg-background/90 px-3 py-1.5 text-xs font-semibold backdrop-blur-md shadow-lg">
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" /> Low
          </span>
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24]" /> Moderate
          </span>
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="h-2 w-2 rounded-full bg-red-400 shadow-[0_0_8px_#f87171]" /> Congested
          </span>
        </div>

        <div className="flex shrink-0 gap-1 whitespace-nowrap rounded-xl border border-border/60 bg-background/90 p-1 backdrop-blur-md shadow-lg overflow-x-auto">
          <button
            onClick={() => setActiveFilter("all")}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
              activeFilter === "all"
                ? "bg-emerald-500 text-slate-950 shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            All Locations
          </button>
          <button
            onClick={() => setActiveFilter("charging")}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
              activeFilter === "charging"
                ? "bg-emerald-500 text-slate-950 shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            <Zap className="h-3 w-3" /> Chargers ({stations.length})
          </button>
          <button
            onClick={() => setActiveFilter("service")}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
              activeFilter === "service"
                ? "bg-purple-600 text-white shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            <Wrench className="h-3 w-3" /> Service Hubs ({serviceCenters.length})
          </button>
        </div>
      </div>

      <MapContainer
        center={userPos ? [userPos.lat, userPos.lng] : [18.5204, 73.8567]}
        zoom={10}
        scrollWheelZoom={true}
        zoomControl={false}
        className="h-full w-full rounded-lg"
      >
        <ZoomControl position="bottomright" />

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="map-tiles-dark"
        />
        <FlyTo target={flyTarget} />
        <ChangeView bounds={mapBounds} />
        <MapClickHandler />

        {/* GLOWING ROUTE POLYLINE */}
        {routeCoords.length > 0 && (
          <>
            {/* Outer Glow Line */}
            <Polyline
              positions={routeCoords}
              pathOptions={{
                color: isServiceHubSelected ? "#c084fc" : "#00f2fe",
                weight: 12,
                opacity: 0.45,
                lineCap: "round",
              }}
            />
            {/* Inner Bright Core Line */}
            <Polyline
              positions={routeCoords}
              pathOptions={{
                color: isServiceHubSelected ? "#a855f7" : "#10b981",
                weight: 5,
                opacity: 0.95,
                lineCap: "round",
              }}
            />
          </>
        )}

        {/* USER LOCATION MARKER */}
        {userPos && (
          <Marker
            position={[userPos.lat, userPos.lng]}
            icon={L.divIcon({
              className: "custom-user-pin",
              html: `<div style="width:14px;height:14px;border-radius:9999px;background:#22d3ee;border:3px solid #0e7490;box-shadow:0 0 12px #22d3ee"></div>`,
              iconSize: [14, 14],
              iconAnchor: [7, 7],
            })}
          />
        )}

        {/* HIGHWAY START LOCATION MARKER */}
        {highwayOrigin && (
          <Marker
            position={highwayOrigin}
            icon={L.divIcon({
              className: "custom-start-pin",
              html: `<div style="background:#10b981;color:white;padding:3px 8px;border-radius:12px;font-weight:bold;font-size:11px;border:2px solid white;box-shadow:0 0 10px #10b981;white-space:nowrap;">🚩 Start</div>`,
              iconSize: [60, 25],
              iconAnchor: [30, 32],
            })}
          />
        )}

        {/* RECOMMENDED CHARGING WAYPOINT MARKER */}
        {recommendedStationPos && (
          <Marker
            position={recommendedStationPos}
            icon={L.divIcon({
              className: "custom-stop-pin",
              html: `<div style="background:#3b82f6;color:white;padding:3px 8px;border-radius:12px;font-weight:bold;font-size:11px;border:2px solid white;box-shadow:0 0 12px #3b82f6;white-space:nowrap;">⚡ Charge Stop</div>`,
              iconSize: [95, 25],
              iconAnchor: [47, 32],
            })}
          />
        )}

        {/* HIGHWAY DESTINATION LOCATION MARKER */}
        {highwayDest && (
          <Marker
            position={highwayDest}
            icon={L.divIcon({
              className: "custom-dest-pin",
              html: `<div style="background:#ef4444;color:white;padding:3px 8px;border-radius:12px;font-weight:bold;font-size:11px;border:2px solid white;box-shadow:0 0 10px #ef4444;white-space:nowrap;">🏁 Finish</div>`,
              iconSize: [65, 25],
              iconAnchor: [32, 32],
            })}
          />
        )}

        {/* CHARGING STATIONS MARKERS */}
        {(activeFilter === "all" || activeFilter === "charging") &&
          stations.map((s) => {
            const level = queueLevel(s);
            const dist = userPos ? haversineKm(userPos, s) : null;
            const types = [...new Set(s.chargers.map((ch) => ch.type))];
            const isSelected = selectedStationId === String(s.id);
            const isEnRoute = enRouteStationIds.size === 0 || enRouteStationIds.has(String(s.id));

            return (
              <Marker
                key={s.id}
                position={[s.lat, s.lng]}
                icon={pinIcon(level, isEnRoute)}
                eventHandlers={{
                  click: () => handleStationClick(s),
                }}
              >
                <Popup autoPanPaddingTopLeft={[20, 80]} autoPanPaddingBottomRight={[20, 20]}>
                  <div className="min-w-52">
                    <p className="font-display text-sm font-bold text-foreground">{s.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.city}
                      {dist !== null && ` · ${dist.toFixed(1)} km away`}
                    </p>

                    {isSelected && routeInfo && (
                      <div className="mt-2 flex flex-col gap-0.5 rounded-lg bg-primary/10 p-2 text-xs text-primary border border-primary/20">
                        <span className="flex items-center gap-1 font-semibold">
                          <Navigation className="h-3 w-3" /> Route Distance: {routeInfo.distanceKm} km
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Est. Travel: ~{routeInfo.durationMins} mins
                        </span>
                        <span className="mt-1 border-t border-primary/20 pt-1 text-[11px] font-bold flex items-center justify-between">
                          <span>Congestion Score: {routeInfo.congestionScore.toFixed(1)}</span>
                          {routeInfo.congestionScore > 15 && (
                            <span className="text-red-400 font-normal text-[10px] bg-red-500/10 px-1 py-0.5 rounded border border-red-500/20">
                              (Detour Rec.)
                            </span>
                          )}
                        </span>
                      </div>
                    )}

                    <div className="mt-2 flex flex-wrap gap-1">
                      {types.map((t) => (
                        <span
                          key={t}
                          className="rounded-full border border-border bg-secondary/50 px-2 py-0.5 text-[10px] text-foreground"
                        >
                          {CHARGER_LABELS[t]}
                        </span>
                      ))}
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-x-3 text-xs">
                      <span className="text-muted-foreground">Ports</span>
                      <span className="text-foreground font-medium">
                        {availablePorts(s)}/{s.chargers.length} free
                      </span>
                      <span className="text-muted-foreground">Queue</span>
                      <span className="text-foreground font-medium">{s.queue} vehicles</span>
                      <span className="text-muted-foreground">Wait</span>
                      <span className="text-foreground font-medium">~{s.waitMins} min</span>
                      <span className="text-muted-foreground">Price</span>
                      <span className="text-foreground font-medium">₹{s.pricePerKwh}/kWh</span>
                    </div>

                    <button
                      onClick={() => onBook(s)}
                      className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
                    >
                      <Zap className="h-3.5 w-3.5" /> Book a Slot
                    </button>
                  </div>
                </Popup>
              </Marker>
            );
          })}

        {/* EV SERVICE CENTERS MARKERS */}
        {(activeFilter === "all" || activeFilter === "service") &&
          serviceCenters.map((sc) => {
            const isSelected = selectedStationId === sc.id;

            return (
              <Marker
                key={sc.id}
                position={[sc.lat, sc.lng]}
                icon={serviceCenterIcon}
                eventHandlers={{
                  click: () => handleServiceCenterClick(sc),
                }}
              >
                <Popup autoPanPaddingTopLeft={[20, 80]} autoPanPaddingBottomRight={[20, 20]}>
                  <div className="min-w-56 p-0.5">
                    <div className="flex items-start justify-between gap-1.5">
                      <div>
                        <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wide">
                          {sc.brand}
                        </span>
                        <h4 className="font-bold text-sm text-foreground leading-tight">{sc.name}</h4>
                      </div>
                      <span className="shrink-0 rounded-md bg-purple-900/60 px-1.5 py-0.5 text-[10px] font-bold text-purple-300 border border-purple-500/30">
                        ⭐ {sc.rating}
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-muted-foreground">{sc.address}</p>

                    {/* LIVE ROUTE INFORMATION DISPLAY */}
                    {isSelected && routeInfo && (
                      <div className="mt-2 flex flex-col gap-0.5 rounded-lg bg-purple-500/10 p-2 text-xs text-purple-300 border border-purple-500/30">
                        <span className="flex items-center gap-1 font-semibold">
                          <Navigation className="h-3 w-3 text-purple-400" /> Route Distance: {routeInfo.distanceKm} km
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-purple-400" /> Est. Travel: ~{routeInfo.durationMins} mins
                        </span>
                      </div>
                    )}

                    <div className="mt-2 text-xs">
                      <span className="font-semibold text-foreground text-[11px]">Available Services:</span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {sc.services.map((service, idx) => (
                          <span
                            key={idx}
                            className="rounded-md bg-secondary/80 px-2 py-0.5 text-[10px] text-secondary-foreground border border-border"
                          >
                            {service}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => handleServiceCenterClick(sc)}
                        className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-purple-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-purple-500 transition-colors shadow-md shadow-purple-600/30"
                      >
                        <Navigation className="h-3 w-3" /> Navigate
                      </button>
                      <a
                        href={`tel:${sc.phone}`}
                        className="flex items-center justify-center rounded-lg border border-purple-500/50 bg-purple-500/10 px-2.5 py-1.5 text-xs font-semibold text-purple-300 hover:bg-purple-500/20 transition-colors"
                      >
                        <Phone className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
      </MapContainer>
    </div>
  );
}