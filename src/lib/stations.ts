export type ChargerType = "CCS" | "Type2" | "AC";

export type ChargerStatus = "active" | "occupied" | "maintenance";

export interface Charger {
  id: string;
  type: ChargerType;
  powerKw: number;
  status: ChargerStatus;
}

export interface Station {
  id: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
  pricePerKwh: number;
  queue: number;
  waitMins: number;
  chargers: Charger[];
  /** Hours (0-23) already reserved, per day */
  reserved: { today: number[]; tomorrow: number[] };
}

export interface Booking {
  id: string;
  stationId: string;
  stationName: string;
  city: string;
  chargerType: ChargerType;
  powerKw: number;
  day: "today" | "tomorrow";
  hour: number;
  estKwh: number;
  total: number;
  discountApplied: boolean;
  createdAt: number;
}

export const CHARGER_LABELS: Record<ChargerType, string> = {
  CCS: "Fast CCS",
  Type2: "Type 2",
  AC: "Slow AC",
};

const c = (
  id: string,
  type: ChargerType,
  powerKw: number,
  status: ChargerStatus = "active",
): Charger => ({ id, type, powerKw, status });

export const INITIAL_STATIONS: Station[] = [
  {
    id: "mum-bandra",
    name: "Bandra Volt Hub",
    city: "Mumbai",
    lat: 19.0596,
    lng: 72.8295,
    pricePerKwh: 18,
    queue: 5,
    waitMins: 45,
    chargers: [c("mum-bandra-1", "CCS", 50, "occupied"), c("mum-bandra-2", "CCS", 50), c("mum-bandra-3", "Type2", 22), c("mum-bandra-4", "AC", 7)],
    reserved: { today: [9, 10, 13, 18, 19], tomorrow: [8, 12] },
  },
  {
    id: "mum-andheri",
    name: "Andheri Charge Point",
    city: "Mumbai",
    lat: 19.1136,
    lng: 72.8697,
    pricePerKwh: 16,
    queue: 2,
    waitMins: 15,
    chargers: [c("mum-andheri-1", "CCS", 60), c("mum-andheri-2", "Type2", 22, "occupied"), c("mum-andheri-3", "Type2", 22)],
    reserved: { today: [11, 17], tomorrow: [10, 18] },
  },
  {
    id: "del-cp",
    name: "Connaught Place Fast Charge",
    city: "Delhi",
    lat: 28.6315,
    lng: 77.2167,
    pricePerKwh: 20,
    queue: 6,
    waitMins: 50,
    chargers: [c("del-cp-1", "CCS", 120, "occupied"), c("del-cp-2", "CCS", 50, "occupied"), c("del-cp-3", "Type2", 22), c("del-cp-4", "AC", 7, "maintenance")],
    reserved: { today: [8, 9, 10, 18, 19, 20], tomorrow: [9, 17] },
  },
  {
    id: "del-saket",
    name: "Saket Green Grid",
    city: "Delhi",
    lat: 28.5245,
    lng: 77.2066,
    pricePerKwh: 15,
    queue: 1,
    waitMins: 5,
    chargers: [c("del-saket-1", "CCS", 50), c("del-saket-2", "Type2", 22), c("del-saket-3", "AC", 7)],
    reserved: { today: [14], tomorrow: [11] },
  },
  {
    id: "blr-mg",
    name: "MG Road EV Hub",
    city: "Bengaluru",
    lat: 12.9756,
    lng: 77.6066,
    pricePerKwh: 17,
    queue: 4,
    waitMins: 35,
    chargers: [c("blr-mg-1", "CCS", 50, "occupied"), c("blr-mg-2", "Type2", 22), c("blr-mg-3", "Type2", 22, "occupied"), c("blr-mg-4", "AC", 7)],
    reserved: { today: [9, 12, 18], tomorrow: [8, 9, 19] },
  },
  {
    id: "blr-ecity",
    name: "Electronic City Power Dock",
    city: "Bengaluru",
    lat: 12.8452,
    lng: 77.6602,
    pricePerKwh: 14,
    queue: 0,
    waitMins: 0,
    chargers: [c("blr-ecity-1", "CCS", 60), c("blr-ecity-2", "CCS", 60), c("blr-ecity-3", "Type2", 22), c("blr-ecity-4", "AC", 7)],
    reserved: { today: [13], tomorrow: [] },
  },
  {
    id: "pune-junction",
    name: "Pune Junction EV Hub",
    city: "Pune",
    lat: 18.5286,
    lng: 73.8742,
    pricePerKwh: 16,
    queue: 4,
    waitMins: 40,
    chargers: [c("pune-junction-1", "CCS", 50, "occupied"), c("pune-junction-2", "Type2", 22), c("pune-junction-3", "AC", 7)],
    reserved: { today: [10, 11, 18], tomorrow: [9] },
  },
  {
    id: "pune-baner",
    name: "Baner Green Grid",
    city: "Pune",
    lat: 18.559,
    lng: 73.7868,
    pricePerKwh: 15,
    queue: 1,
    waitMins: 5,
    chargers: [c("pune-baner-1", "CCS", 50), c("pune-baner-2", "Type2", 22), c("pune-baner-3", "AC", 7, "maintenance")],
    reserved: { today: [16], tomorrow: [10] },
  },
  {
    id: "hyd-hitech",
    name: "HITEC City Volt Park",
    city: "Hyderabad",
    lat: 17.4435,
    lng: 78.3772,
    pricePerKwh: 16,
    queue: 3,
    waitMins: 25,
    chargers: [c("hyd-hitech-1", "CCS", 60), c("hyd-hitech-2", "CCS", 60, "occupied"), c("hyd-hitech-3", "Type2", 22)],
    reserved: { today: [9, 13, 19], tomorrow: [12] },
  },
  {
    id: "chn-marina",
    name: "Marina Charge Bay",
    city: "Chennai",
    lat: 13.05,
    lng: 80.2824,
    pricePerKwh: 15,
    queue: 2,
    waitMins: 15,
    chargers: [c("chn-marina-1", "CCS", 50), c("chn-marina-2", "Type2", 22), c("chn-marina-3", "AC", 7)],
    reserved: { today: [8, 17], tomorrow: [9, 10] },
  },
];

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Smart Load-Balancing score: lower is better. */
export function loadScore(distanceKm: number, queue: number): number {
  return distanceKm + queue * 5;
}

export function isCongested(s: Station): boolean {
  return s.queue > 3 || s.waitMins > 30;
}

export type QueueLevel = "low" | "moderate" | "congested";

export function queueLevel(s: Station): QueueLevel {
  if (s.queue > 3 || s.waitMins > 30) return "congested";
  if (s.queue >= 2 || s.waitMins >= 10) return "moderate";
  return "low";
}

export function availablePorts(s: Station): number {
  return s.chargers.filter((ch) => ch.status === "active").length;
}

/** Best alternative station near `from`, excluding congested ones. */
export function bestAlternative(
  stations: Station[],
  from: Station,
): { station: Station; distanceKm: number; score: number } | null {
  let best: { station: Station; distanceKm: number; score: number } | null = null;
  for (const s of stations) {
    if (s.id === from.id) continue;
    if (isCongested(s) || availablePorts(s) === 0) continue;
    const d = haversineKm(from, s);
    const score = loadScore(d, s.queue);
    if (!best || score < best.score) best = { station: s, distanceKm: d, score };
  }
  return best;
}
