import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useServerFn } from "@tanstack/react-start";
import type { ChargerStatus, Station } from "./stations";
import { fetchStations } from "./stations.functions";
import { getBookings, type StoredBooking } from "./payments.functions";

const CODES_KEY = "ecopulse.booking-codes";
/** Bengaluru — used until the browser reports a real position. */
const FALLBACK_POS = { lat: 12.9716, lng: 77.5946 };

interface AppState {
  stations: Station[];
  loading: boolean;
  error: string | null;
  userPos: { lat: number; lng: number } | null;
  bookings: StoredBooking[];
  rerouteCount: number;
  refreshStations: (pos?: { lat: number; lng: number }) => void;
  registerBooking: (code: string) => void;
  reloadBookings: () => void;
  setChargerStatus: (
    stationId: string,
    chargerId: string,
    status: ChargerStatus,
  ) => void;
  addEnRouteVehicle: (stationId: string) => void;
  getStation: (id: string) => Station | undefined;
}

const AppContext = createContext<AppState | null>(null);

function readCodes(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CODES_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((c): c is string => typeof c === "string") : [];
  } catch {
    return [];
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const loadStations = useServerFn(fetchStations);
  const loadBookings = useServerFn(getBookings);

  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [bookings, setBookings] = useState<StoredBooking[]>([]);

  const refreshStations = useCallback(
    (pos?: { lat: number; lng: number }) => {
      const at = pos ?? userPos ?? FALLBACK_POS;
      setLoading(true);
      loadStations({ data: { lat: at.lat, lng: at.lng, radiusKm: 80, limit: 40 } })
        .then((res) => {
          setStations(res.stations);
          setError(res.error ?? (res.stations.length === 0 ? "No charging stations found nearby." : null));
        })
        .catch((e: unknown) => {
          console.error(e);
          setError("Could not reach the live station network.");
        })
        .finally(() => setLoading(false));
    },
    [loadStations, userPos],
  );

  const reloadBookings = useCallback(() => {
    const codes = readCodes();
    if (codes.length === 0) {
      setBookings([]);
      return;
    }
    loadBookings({ data: { codes } })
      .then((res) => setBookings(res.bookings))
      .catch((e: unknown) => console.error(e));
  }, [loadBookings]);

  const registerBooking = useCallback(
    (code: string) => {
      const codes = readCodes();
      if (!codes.includes(code)) {
        window.localStorage.setItem(CODES_KEY, JSON.stringify([code, ...codes].slice(0, 50)));
      }
      reloadBookings();
    },
    [reloadBookings],
  );

  useEffect(() => {
    let done = false;
    const go = (pos: { lat: number; lng: number }) => {
      if (done) return;
      done = true;
      setUserPos(pos);
      refreshStations(pos);
    };
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) => go({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => go(FALLBACK_POS),
        { timeout: 5000 },
      );
      setTimeout(() => go(FALLBACK_POS), 6000);
    } else {
      go(FALLBACK_POS);
    }
    reloadBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setChargerStatus = useCallback(
    (stationId: string, chargerId: string, status: ChargerStatus) => {
      setStations((prev) =>
        prev.map((s) =>
          s.id !== stationId
            ? s
            : {
                ...s,
                chargers: s.chargers.map((ch) =>
                  ch.id === chargerId ? { ...ch, status } : ch,
                ),
              },
        ),
      );
    },
    [],
  );

  // Increment virtual en-route queue buffer immutably for virtual queue balancing
  const addEnRouteVehicle = useCallback((stationId: string) => {
    setStations((prev) =>
      prev.map((s) =>
        s.id !== stationId
          ? s
          : {
              ...s,
              enRouteQueue: (s.enRouteQueue || 0) + 1,
            },
      ),
    );
  }, []);

  const value = useMemo<AppState>(
    () => ({
      stations,
      loading,
      error,
      userPos,
      bookings,
      rerouteCount: bookings.filter((b) => b.discountApplied).length,
      refreshStations,
      registerBooking,
      reloadBookings,
      setChargerStatus,
      addEnRouteVehicle,
      getStation: (id) => stations.find((s) => s.id === id),
    }),
    [
      stations,
      loading,
      error,
      userPos,
      bookings,
      refreshStations,
      registerBooking,
      reloadBookings,
      setChargerStatus,
      addEnRouteVehicle,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}