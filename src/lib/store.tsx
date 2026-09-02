import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  INITIAL_STATIONS,
  type Booking,
  type ChargerStatus,
  type Station,
} from "./stations";

interface AppState {
  stations: Station[];
  bookings: Booking[];
  rerouteCount: number;
  addBooking: (b: Omit<Booking, "id" | "createdAt">) => Booking;
  setChargerStatus: (
    stationId: string,
    chargerId: string,
    status: ChargerStatus,
  ) => void;
  getStation: (id: string) => Station | undefined;
}

const AppContext = createContext<AppState | null>(null);

let bookingSeq = 1000;

export function AppProvider({ children }: { children: ReactNode }) {
  const [stations, setStations] = useState<Station[]>(INITIAL_STATIONS);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rerouteCount, setRerouteCount] = useState(0);

  const addBooking = useCallback(
    (b: Omit<Booking, "id" | "createdAt">): Booking => {
      const booking: Booking = {
        ...b,
        id: `EP-${++bookingSeq}`,
        createdAt: Date.now(),
      };
      setBookings((prev) => [booking, ...prev]);
      if (b.discountApplied) setRerouteCount((n) => n + 1);
      return booking;
    },
    [],
  );

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

  const value = useMemo<AppState>(
    () => ({
      stations,
      bookings,
      rerouteCount,
      addBooking,
      setChargerStatus,
      getStation: (id) => stations.find((s) => s.id === id),
    }),
    [stations, bookings, rerouteCount, addBooking, setChargerStatus],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
