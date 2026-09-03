import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Charger, ChargerStatus, ChargerType, Station } from "./stations";

const inputSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusKm: z.number().min(1).max(250).default(80),
  limit: z.number().min(1).max(100).default(40),
});

/** Stable, seeded pseudo-random in [0,1) derived from a string. */
function seeded(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

function chargerTypeFor(title: string, powerKw: number): ChargerType {
  const t = title.toLowerCase();
  if (t.includes("ccs") || t.includes("combo") || t.includes("chademo")) return "CCS";
  if (t.includes("type 2") || t.includes("mennekes")) return powerKw >= 11 ? "Type2" : "AC";
  if (t.includes("type 1") || t.includes("bharat") || t.includes("domestic") || t.includes("three phase"))
    return "AC";
  return powerKw >= 22 ? "Type2" : "AC";
}

function parsePrice(usageCost: string | null | undefined, seed: number): number {
  if (usageCost) {
    const m = usageCost.match(/(\d+(?:\.\d+)?)/);
    if (m) {
      const v = Number(m[1]);
      if (v >= 5 && v <= 60) return Math.round(v);
    }
  }
  return 14 + Math.floor(seed * 8); // ₹14–21/kWh
}

interface OcmConnection {
  PowerKW?: number | null;
  Quantity?: number | null;
  ConnectionType?: { Title?: string | null } | null;
  StatusType?: { IsOperational?: boolean | null } | null;
  LevelID?: number | null;
}

interface OcmPoi {
  ID: number;
  UsageCost?: string | null;
  AddressInfo?: {
    Title?: string | null;
    Town?: string | null;
    StateOrProvince?: string | null;
    Latitude?: number | null;
    Longitude?: number | null;
  } | null;
  OperatorInfo?: { Title?: string | null } | null;
  Connections?: OcmConnection[] | null;
}

function mapPoi(poi: OcmPoi): Station | null {
  const info = poi.AddressInfo;
  if (!info?.Latitude || !info?.Longitude) return null;

  const id = `ocm-${poi.ID}`;
  const seed = seeded(id);
  const seed2 = seeded(`${id}:q`);

  const chargers: Charger[] = [];
  for (const [ci, conn] of (poi.Connections ?? []).entries()) {
    const powerKw = Math.max(3, Math.round(conn.PowerKW ?? (conn.LevelID === 3 ? 50 : 7)));
    const type = chargerTypeFor(conn.ConnectionType?.Title ?? "", powerKw);
    const qty = Math.min(Math.max(conn.Quantity ?? 1, 1), 4);
    for (let n = 0; n < qty; n++) {
      const chargerId = `${id}-${ci}-${n}`;
      const operational = conn.StatusType?.IsOperational !== false;
      const s = seeded(chargerId);
      const status: ChargerStatus = !operational
        ? "maintenance"
        : s < 0.28
          ? "occupied"
          : "active";
      chargers.push({ id: chargerId, type, powerKw, status });
    }
  }
  if (chargers.length === 0) return null;

  // OpenChargeMap has no live queue feed — queue/wait are simulated,
  // weighted by how many ports are currently unavailable and by time of day.
  const busyPorts = chargers.filter((c) => c.status !== "active").length;
  const peak = [8, 9, 10, 18, 19, 20].includes(new Date().getUTCHours() + 5) ? 2 : 0;
  const queue = Math.min(8, Math.round(seed2 * 5) + busyPorts + peak);
  const waitMins = queue === 0 ? 0 : queue * 8 + Math.round(seed * 10);

  const reservedFor = (salt: string) => {
    const hours: number[] = [];
    for (let h = 6; h < 23; h++) {
      if (seeded(`${id}:${salt}:${h}`) < 0.18) hours.push(h);
    }
    return hours;
  };

  return {
    id,
    name: info.Title?.trim() || poi.OperatorInfo?.Title?.trim() || "Charging Station",
    city: info.Town?.trim() || info.StateOrProvince?.trim() || "Unknown",
    lat: info.Latitude,
    lng: info.Longitude,
    pricePerKwh: parsePrice(poi.UsageCost, seed),
    queue,
    waitMins,
    chargers,
    reserved: { today: reservedFor("today"), tomorrow: reservedFor("tomorrow") },
  };
}

export const fetchStations = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<{ stations: Station[]; error: string | null }> => {
    const url = new URL("https://api.openchargemap.io/v3/poi");
    url.searchParams.set("output", "json");
    url.searchParams.set("latitude", String(data.lat));
    url.searchParams.set("longitude", String(data.lng));
    url.searchParams.set("distance", String(data.radiusKm));
    url.searchParams.set("distanceunit", "KM");
    url.searchParams.set("maxresults", String(data.limit));
    url.searchParams.set("compact", "true");
    url.searchParams.set("verbose", "false");

    const headers: Record<string, string> = { Accept: "application/json" };
    const apiKey = process.env["OPENCHARGEMAP_API_KEY"];
    if (apiKey) headers["X-API-Key"] = apiKey;

    try {
      const res = await fetch(url, { headers });
      if (!res.ok) {
        const body = await res.text();
        console.error(`OpenChargeMap request failed [${res.status}]: ${body}`);
        return {
          stations: [],
          error:
            res.status === 403 || res.status === 401
              ? "OpenChargeMap rejected the request — add an API key to raise limits."
              : `Could not load live stations (${res.status}).`,
        };
      }
      const pois = (await res.json()) as OcmPoi[];
      const stations = pois
        .map(mapPoi)
        .filter((s): s is Station => s !== null)
        .slice(0, data.limit);
      return { stations, error: null };
    } catch (err) {
      console.error("OpenChargeMap fetch error", err);
      return { stations: [], error: "Live station data is temporarily unavailable." };
    }
  });
