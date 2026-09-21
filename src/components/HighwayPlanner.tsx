// components/HighwayPlanner.tsx
import { useState, useEffect } from "react";
import { Navigation, MapPin, Zap, Search, Crosshair, BatteryCharging, AlertTriangle } from "lucide-react";
import { useApp } from "../lib/store";
import { type Station } from "../lib/stations";
import { fetchStationsAlongRoute } from "../lib/osmStations";

interface PlacePrediction {
  display_name: string;
  lat: string;
  lon: string;
}

interface EnRouteStation {
  station: Station;
  distanceFromStartKm: number;
  congestionScore: number;
  etaMins: number;
  recommendedSlot: string;
  isReachable: boolean;
  minDistanceToRoute: number;
}

interface HighwayPlannerProps {
  onBook: (station: Station) => void;
}

function getCongestionScore(distKm: number, queue: number, waitMins: number): number {
  return Math.round(distKm * 0.2 + queue * 4 + waitMins * 1.5);
}

function calculateRecommendedSlot(etaMins: number): string {
  const now = new Date();
  const arrivalTime = new Date(now.getTime() + etaMins * 60 * 1000);
  
  const roundedMins = Math.ceil(arrivalTime.getMinutes() / 5) * 5;
  arrivalTime.setMinutes(roundedMins);

  const endSlotTime = new Date(arrivalTime.getTime() + 30 * 60 * 1000);

  const formatTime = (d: Date) =>
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });

  return `${formatTime(arrivalTime)} - ${formatTime(endSlotTime)}`;
}

export default function HighwayPlanner({ onBook }: HighwayPlannerProps) {
  const { stations } = useApp();

  const [originText, setOriginText] = useState("Pune, Maharashtra");
  const [destText, setDestText] = useState("Mumbai, Maharashtra");
  const [originCoords, setOriginCoords] = useState<[number, number] | null>([18.5204, 73.8567]);
  const [destCoords, setDestCoords] = useState<[number, number] | null>([19.0760, 72.8777]);

  const [batteryPct, setBatteryPct] = useState<number>(35);
  const [fullRangeKm, setFullRangeKm] = useState<number>(300);

  const usableRangeKm = Math.round((batteryPct / 100) * fullRangeKm);

  const [originPredictions, setOriginPredictions] = useState<PlacePrediction[]>([]);
  const [destPredictions, setDestPredictions] = useState<PlacePrediction[]>([]);
  const [showOriginDropdown, setShowOriginDropdown] = useState(false);
  const [showDestDropdown, setShowDestDropdown] = useState(false);

  const [isPlanning, setIsPlanning] = useState(false);
  const [enRouteStations, setEnRouteStations] = useState<EnRouteStation[]>([]);
  const [recommendedStation, setRecommendedStation] = useState<EnRouteStation | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ totalDistKm: number; totalMins: number } | null>(null);

  const [isPickingMapMode, setIsPickingMapMode] = useState<"origin" | "dest" | null>(null);

  // Automatically fetch user's current location on load and broadcast it
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          
          setOriginCoords([lat, lng]);
          setOriginText("Current Location");

          window.dispatchEvent(
            new CustomEvent("highway-route-updated", {
              detail: {
                originCoords: [lat, lng],
                destCoords,
                routeCoords: [],
                enRouteStations: [],
              },
            })
          );
        },
        (error) => {
          console.log("Geolocation permission denied or unavailable, using default.", error);
        }
      );
    }
  }, []);

  const handleStartMapPick = (mode: "origin" | "dest") => {
    setIsPickingMapMode(mode);
    document.getElementById("map-section")?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchPredictions = async (query: string, setPredictions: (p: PlacePrediction[]) => void) => {
    if (!query || query.length < 3) {
      setPredictions([]);
      return;
    }
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=4&countrycodes=in`
      );
      const data = await res.json();
      setPredictions(data || []);
    } catch (err) {
      console.error("Failed to fetch predictions:", err);
    }
  };

  useEffect(() => {
    const handleMapClick = async (e: Event) => {
      const customEvent = e as CustomEvent<{ lat: number; lng: number }>;
      if (!isPickingMapMode || !customEvent.detail) return;
      const { lat, lng } = customEvent.detail;

      let newOrigin = originCoords;
      let newDest = destCoords;

      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
        );
        const data = await res.json();
        const placeName = data.display_name
          ? data.display_name.split(",").slice(0, 3).join(",")
          : `${lat.toFixed(3)}, ${lng.toFixed(3)}`;

        if (isPickingMapMode === "origin") {
          setOriginText(placeName);
          setOriginCoords([lat, lng]);
          newOrigin = [lat, lng];
        } else {
          setDestText(placeName);
          setDestCoords([lat, lng]);
          newDest = [lat, lng];
        }
      } catch (err) {
        if (isPickingMapMode === "origin") {
          setOriginCoords([lat, lng]);
          newOrigin = [lat, lng];
        } else {
          setDestCoords([lat, lng]);
          newDest = [lat, lng];
        }
      }

      window.dispatchEvent(
        new CustomEvent("highway-route-updated", {
          detail: {
            originCoords: newOrigin,
            destCoords: newDest,
            routeCoords: [],
            enRouteStations: [],
          },
        })
      );

      setIsPickingMapMode(null);
    };

    window.addEventListener("map-point-selected", handleMapClick);
    return () => window.removeEventListener("map-point-selected", handleMapClick);
  }, [isPickingMapMode, originCoords, destCoords]);

  const handlePlanRoute = async () => {
    if (!originCoords || !destCoords) return;
    setIsPlanning(true);

    try {
      const startStr = `${originCoords[1]},${originCoords[0]}`;
      const endStr = `${destCoords[1]},${destCoords[0]}`;

      const res = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${startStr};${endStr}?overview=full&geometries=geojson`
      );
      const data = await res.json();

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const distKm = +(route.distance / 1000).toFixed(1);
        const mins = Math.round(route.duration / 60);
        setRouteInfo({ totalDistKm: distKm, totalMins: mins });

        const directRouteCoords: [number, number][] = route.geometry.coordinates.map(
          (c: [number, number]) => [c[1], c[0]]
        );

        const lats = directRouteCoords.map((c) => c[0]);
        const lngs = directRouteCoords.map((c) => c[1]);
        const bounds = {
          south: Math.min(...lats) - 0.2,
          west: Math.min(...lngs) - 0.2,
          north: Math.max(...lats) + 0.2,
          east: Math.max(...lngs) + 0.2,
        };

        const osmStations = await fetchStationsAlongRoute(bounds);
        const combinedStations = [...(stations || []), ...osmStations];

        const matched: EnRouteStation[] = combinedStations
          .map((st) => {
            let minDistanceToRoute = Infinity;
            let closestRouteIndex = 0;
            
            directRouteCoords.forEach(([lat, lng], idx) => {
              const d = Math.sqrt(Math.pow(st.lat - lat, 2) + Math.pow(st.lng - lng, 2)) * 111;
              if (d < minDistanceToRoute) {
                minDistanceToRoute = d;
                closestRouteIndex = idx;
              }
            });

            const routeProgressRatio = closestRouteIndex / directRouteCoords.length;
            const distFromStartKm = +(routeProgressRatio * distKm).toFixed(1);

            const etaMins = Math.round((distFromStartKm / 65) * 60);
            const recommendedSlot = calculateRecommendedSlot(etaMins);
            const score = getCongestionScore(distFromStartKm, st.queue || 0, st.waitMins || 0);
            const isReachable = distFromStartKm <= (usableRangeKm - 10);

            return {
              station: st, // Preserving authentic station object with pristine lat/lng
              distanceFromStartKm: distFromStartKm,
              congestionScore: score,
              etaMins,
              recommendedSlot,
              isReachable,
              minDistanceToRoute,
            };
          })
          .filter((item) => item.minDistanceToRoute <= 35)
          .sort((a, b) => a.distanceFromStartKm - b.distanceFromStartKm);

        setEnRouteStations(matched);

        const reachableList = matched.filter((m) => m.isReachable);
        let bestStop: EnRouteStation | null = null;

        if (reachableList.length > 0) {
          bestStop = reachableList.reduce((prev, curr) => {
            const prevUtility =
              prev.distanceFromStartKm * 0.5 -
              prev.minDistanceToRoute * 3.0 -
              prev.congestionScore * 0.3;
            const currUtility =
              curr.distanceFromStartKm * 0.5 -
              curr.minDistanceToRoute * 3.0 -
              curr.congestionScore * 0.3;

            return currUtility > prevUtility ? curr : prev;
          });
        } else if (matched.length > 0) {
          bestStop = matched[0] ?? null;
        }

        setRecommendedStation(bestStop);

        let finalRouteCoords = directRouteCoords;
        if (bestStop?.station) {
          const waypointStr = `${bestStop.station.lng},${bestStop.station.lat}`;
          const multiRes = await fetch(
            `https://router.project-osrm.org/route/v1/driving/${startStr};${waypointStr};${endStr}?overview=full&geometries=geojson`
          );
          const multiData = await multiRes.json();
          if (multiData.routes && multiData.routes.length > 0) {
            finalRouteCoords = multiData.routes[0].geometry.coordinates.map(
              (c: [number, number]) => [c[1], c[0]]
            );
          }
        }

        // Dispatching original station objects with uncorrupted GPS coordinates
        window.dispatchEvent(
          new CustomEvent("highway-route-updated", {
            detail: {
              originCoords,
              destCoords,
              routeCoords: finalRouteCoords,
              recommendedStation: bestStop?.station ?? null,
              enRouteStations: matched.map((m) => m.station),
            },
          })
        );
      }
    } catch (err) {
      console.error("Route planning error:", err);
    } finally {
      setIsPlanning(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-lg relative">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Navigation className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-bold">Highway Corridor Smart Planner</h2>
        </div>
        {isPickingMapMode && (
          <span className="animate-pulse rounded-full bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-400">
            Click map to set {isPickingMapMode}
          </span>
        )}
      </div>

      <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-3.5">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs font-bold text-primary">
            <BatteryCharging className="h-4 w-4" /> Current Battery & Vehicle Range
          </label>
          <span className="text-xs font-extrabold text-primary">
            {batteryPct}% ({usableRangeKm} km left)
          </span>
        </div>

        <div className="mt-2.5 grid grid-cols-1 gap-3 sm:grid-cols-3 items-center">
          <div className="sm:col-span-2">
            <input
              type="range"
              min="5"
              max="100"
              value={batteryPct}
              onChange={(e) => setBatteryPct(Number(e.target.value))}
              className="w-full accent-primary cursor-pointer h-2 bg-secondary rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>5% (Critical)</span>
              <span>50%</span>
              <span>100% (Full)</span>
            </div>
          </div>

          <div>
            <label className="text-[10px] text-muted-foreground block">EV Full Capacity</label>
            <select
              value={fullRangeKm}
              onChange={(e) => setFullRangeKm(Number(e.target.value))}
              className="w-full rounded border border-border bg-background px-2 py-1 text-xs font-semibold"
            >
              <option value={200}>200 km (Compact EV)</option>
              <option value={300}>300 km (Standard EV)</option>
              <option value={450}>450 km (Long Range EV)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="relative">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <label>Start Location</label>
            <button
              onClick={() => handleStartMapPick("origin")}
              className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
            >
              <Crosshair className="h-3 w-3" /> Select on Map
            </button>
          </div>
          <div className="relative mt-1">
            <input
              type="text"
              value={originText}
              onChange={(e) => {
                setOriginText(e.target.value);
                setShowOriginDropdown(true);
                fetchPredictions(e.target.value, setOriginPredictions);
              }}
              placeholder="Type start city or address..."
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm pr-8"
            />
            <Search className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          </div>

          {showOriginDropdown && originPredictions.length > 0 && (
            <ul className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border border-border bg-card p-1 shadow-xl">
              {originPredictions.map((place, idx) => (
                <li
                  key={idx}
                  onClick={() => {
                    const name = (place.display_name || "").split(",")[0] || "";
                    const coords: [number, number] = [parseFloat(place.lat), parseFloat(place.lon)];
                    setOriginText(name);
                    setOriginCoords(coords);
                    setShowOriginDropdown(false);

                    window.dispatchEvent(
                      new CustomEvent("highway-route-updated", {
                        detail: { originCoords: coords, destCoords, routeCoords: [], enRouteStations: [] },
                      })
                    );
                  }}
                  className="flex items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-primary/20 cursor-pointer"
                >
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="truncate">{place.display_name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="relative">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <label>Destination Location</label>
            <button
              onClick={() => handleStartMapPick("dest")}
              className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
            >
              <Crosshair className="h-3 w-3" /> Select on Map
            </button>
          </div>
          <div className="relative mt-1">
            <input
              type="text"
              value={destText}
              onChange={(e) => {
                setDestText(e.target.value);
                setShowDestDropdown(true);
                fetchPredictions(e.target.value, setDestPredictions);
              }}
              placeholder="Type destination city..."
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm pr-8"
            />
            <Search className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          </div>

          {showDestDropdown && destPredictions.length > 0 && (
            <ul className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border border-border bg-card p-1 shadow-xl">
              {destPredictions.map((place, idx) => (
                <li
                  key={idx}
                  onClick={() => {
                    const name = (place.display_name || "").split(",")[0] || "";
                    const coords: [number, number] = [parseFloat(place.lat), parseFloat(place.lon)];
                    setDestText(name);
                    setDestCoords(coords);
                    setShowDestDropdown(false);

                    window.dispatchEvent(
                      new CustomEvent("highway-route-updated", {
                        detail: { originCoords, destCoords: coords, routeCoords: [], enRouteStations: [] },
                      })
                    );
                  }}
                  className="flex items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-primary/20 cursor-pointer"
                >
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="truncate">{place.display_name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <button
        onClick={handlePlanRoute}
        disabled={isPlanning}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 text-sm font-bold text-primary-foreground shadow-glow"
      >
        {isPlanning ? "Calculating Range & Optimal Charging Stops..." : "Calculate Route & Recommended Charging Slots"}
      </button>

      {routeInfo && (
        <div className="mt-5 space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-2 text-xs text-muted-foreground">
            <span>Trip: {routeInfo.totalDistKm} km (~{routeInfo.totalMins} mins)</span>
            <span className="font-bold text-emerald-400">{enRouteStations.length} Hubs Found</span>
          </div>

          {recommendedStation && (
            <div className="rounded-lg border-2 border-emerald-500/80 bg-emerald-950/30 p-3.5 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[11px] font-extrabold text-emerald-400 border border-emerald-500/30">
                  🎯 RECOMMENDED CHARGING STOP
                </span>
                <span className="text-xs font-bold text-emerald-300">
                  ETA: ~{recommendedStation.etaMins} mins
                </span>
              </div>

              <div className="mt-2">
                <h3 className="font-bold text-base text-foreground">{recommendedStation.station.name}</h3>
                <p className="text-xs text-muted-foreground">
                  Located {recommendedStation.distanceFromStartKm} km into journey ({recommendedStation.station.city})
                </p>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between rounded bg-background/60 p-2 text-xs border border-border">
                <div>
                  <span className="text-muted-foreground block text-[10px]">SUGGESTED BOOKING SLOT</span>
                  <span className="font-extrabold text-primary">{recommendedStation.recommendedSlot}</span>
                </div>

                <button
                  onClick={() => onBook(recommendedStation.station)}
                  className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-glow"
                >
                  <Zap className="h-3.5 w-3.5" /> Reserve Slot Now
                </button>
              </div>
            </div>
          )}

          <div className="max-h-72 space-y-2.5 overflow-y-auto pr-1">
            {enRouteStations.length > 0 ? (
              enRouteStations.map(({ station, distanceFromStartKm, congestionScore, etaMins, recommendedSlot, isReachable }) => {
                const isOptimal = recommendedStation?.station.id === station.id;

                return (
                  <div
                    key={station.id}
                    className={`rounded-lg border p-3 transition-colors ${
                      isOptimal
                        ? "border-emerald-500/60 bg-emerald-950/20"
                        : !isReachable
                        ? "border-red-500/30 bg-red-950/10 opacity-75"
                        : "border-border bg-background"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm">{station.name}</span>
                          {!isReachable ? (
                            <span className="flex items-center gap-1 rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-bold text-red-400">
                              <AlertTriangle className="h-3 w-3" /> Out of Range ({distanceFromStartKm}km)
                            </span>
                          ) : isOptimal ? (
                            <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400">
                              Best Match
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {station.city} · {distanceFromStartKm} km away · ETA ~{etaMins} mins
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                          Congestion
                        </span>
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-extrabold ${
                            congestionScore < 20
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-amber-500/20 text-amber-400"
                          }`}
                        >
                          {congestionScore}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-2 text-xs">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span className="font-semibold text-primary">Slot: {recommendedSlot}</span>
                      </div>

                      <button
                        onClick={() => onBook(station)}
                        className={`flex items-center gap-1 rounded px-2.5 py-1 text-[11px] font-bold shadow-glow ${
                          isReachable
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground cursor-not-allowed"
                        }`}
                      >
                        <Zap className="h-3 w-3" /> Book Slot
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-center py-4 text-xs text-muted-foreground">
                No charging stations found along this corridor.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}