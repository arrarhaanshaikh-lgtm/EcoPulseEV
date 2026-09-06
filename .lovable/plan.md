# EcoPulse EV — Technical Specification for SIH Presentation

## 1. System Architecture & Logical Flow

```text
User Browser
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  Presentation Layer (React 19 + Tailwind CSS v4)            │
│  • Map View, Booking Modal, Operator Dashboard, Profile     │
│  • Persistent bottom nav (mobile) / top nav (desktop)     │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  Application State (React Context — src/lib/store.tsx)      │
│  • userPos, stations[], bookings[], rerouteCount          │
│  • refreshStations(), registerBooking(), setChargerStatus() │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  Routing / Data Fetching (TanStack Router + TanStack Query)│
│  • File-based routes: /, /booking, /operator, /profile      │
│  • Server functions called via useServerFn                  │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  Server Functions (createServerFn — edge runtime)            │
│  • fetchStations()  → OpenChargeMap API                     │
│  • createBookingCheckout() → Stripe Checkout API + DB insert │
│  • confirmBookingPayment() → Stripe verify + DB update       │
│  • getBookings() → DB lookup by booking code                │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  Backend / Database (Lovable Cloud / Supabase PostgreSQL)   │
│  • bookings table (codes, status, Stripe session IDs)         │
│  • Accessed via service-role admin client from server fns     │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  External APIs                                              │
│  • OpenChargeMap (station locations, charger specs)         │
│  • OpenStreetMap tiles (via Leaflet)                        │
│  • Stripe (payment sessions + webhooks)                   │
└─────────────────────────────────────────────────────────────┘
```

### Step-by-step flow

1. **App bootstrap.** TanStack Start hydrates the page. `AppProvider` requests browser geolocation; on success or timeout it falls back to Bengaluru (`12.9716, 77.5946`).
2. **Station discovery.** `refreshStations()` calls the `fetchStations` server function with `{lat, lng, radiusKm: 80, limit: 40}`.
3. **Live station data.** The server function fetches `https://api.openchargemap.io/v3/poi`, maps each POI to the internal `Station` shape, derives charger types from connector titles, computes a seeded queue/wait estimate, and returns the list.
4. **Map render.** `StationMap` (Leaflet + react-leaflet) plots pins color-coded by congestion: green (low), amber (moderate), red (congested). Marker popups and the nearby-station list both read the same `stations` state.
5. **Smart load-balancing.** When the user opens the booking modal, `BookingFlow` checks `isCongested()`. If `queue > 3` or `waitMins > 30`, it calls `bestAlternative()` (score = distanceKm + queue × 5) and shows a reroute banner offering a 15% discount.
6. **Slot selection.** The user picks a charger type and an hourly slot. Past hours and seeded reserved hours are disabled client-side.
7. **Payment.** `createBookingCheckout` inserts a `pending` row into `bookings`, creates a Stripe Checkout Session (amount = total × 100 paise, currency `inr`), stores the Stripe session ID, and returns the checkout URL.
8. **Confirmation.** After Stripe redirects to `/booking/success?code=...&session_id=...`, `confirmBookingPayment` verifies the session and marks the booking `paid`. A parallel Stripe webhook at `/api/public/webhooks/stripe` also updates the status asynchronously.
9. **QR pass.** The success page and the bookings list render a QR code containing `ECOPULSE:<code>:<stationId>:<day>@<hour>`.

## 2. Exact Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Framework | **TanStack Start v1** (`@tanstack/react-start` 1.168.32) | Full-stack React framework (SSR + server functions) |
| Router | **TanStack Router** 1.170.18 | File-based routing, loaders, navigation |
| State / Cache | **TanStack Query** 5.101.1 | Server-state caching |
| UI Library | **React 19.2.0** + **TypeScript 5.8.3** | Component model and type safety |
| Styling | **Tailwind CSS v4** 4.2.1 + `@tailwindcss/vite` | Utility-first styling |
| UI Primitives | **Radix UI** (dialog, select, tabs, etc.) + `class-variance-authority` | Accessible headless components |
| Animation | `tw-animate-css` | Theme-driven animations |
| Icons | **Lucide React** 0.575.0 | Iconography |
| Map | **Leaflet** 1.9.4 + **react-leaflet** 5.0.0 + **OpenStreetMap** tiles | Interactive map |
| Map Data | **OpenChargeMap API** (`api.openchargemap.io/v3/poi`) | Real EV station locations and connector specs |
| QR Codes | **qrcode.react** 4.2.0 | Booking confirmation QR |
| Validation | **Zod** 3.24.2 | Runtime input validation |
| Payments | **Stripe Checkout API** | Real transactions |
| Backend / DB | **Lovable Cloud** (Supabase PostgreSQL) | Persistent bookings table |
| Build Tool | **Vite** 8.1.5 + `@lovable.dev/vite-tanstack-config` | Dev server and production bundling |
| Runtime | **Nitro** (Cloudflare Workers target) | Edge serverless runtime for server functions |
| Fonts | **Space Grotesk** (display) + **Manrope** (body) via Google Fonts | Typography |

## 3. Technical Feasibility & Risks

### Challenge 1 — OpenChargeMap has no live queue or slot availability
OpenChargeMap returns station metadata (location, connector type, power, operational status) but does **not** expose live queue length, wait time, or occupied/reserved slots.

**Mitigation in current code:**
- Queue and wait time are simulated deterministically using a seeded hash of the station ID.
- The simulation factors in the number of non-operational/occupied chargers and Indian peak hours (8–10 AM, 6–8 PM IST).
- Reserved slots are generated with a per-station seeded probability (`seeded("${id}:${day}:${h}") < 0.18`).
- This gives a realistic-looking demo, but a production deployment would need a live IoT integration from charging hardware or a partner CMS.

### Challenge 2 — Concurrent slot booking collisions
The current booking flow disables already-reserved slots client-side, but the server does **not** atomically verify that the chosen `(station_id, charger_type, day, hour)` is still free before inserting the row. Two users could simultaneously select and pay for the same slot.

**Mitigation in current code:**
- Each booking receives a unique `code` and Stripe session ID, so duplicate payments are at least traceable.
- The `bookings` table has a unique `code` constraint.
- A production fix would add a unique partial index or upsert on `(station_id, charger_type, day, hour)` and check availability inside `createBookingCheckout` before creating the Stripe session.

### Challenge 3 — Payment idempotency and webhook reliability
Stripe webhooks can be delayed, retried, or arrive out of order. The success page acts as a fallback, but neither path is fully idempotent.

**Mitigation in current code:**
- The webhook handler verifies the `stripe-signature` with HMAC-SHA256 and rejects replays older than 5 minutes.
- The success page independently calls `confirmBookingPayment`, which verifies `payment_status === "paid"` before updating the database.
- Both update paths use `.eq("code", code).eq("status", "pending")` so a paid booking is not overwritten.
- For production, Stripe recommends adding an idempotency key and treating webhook events as at-least-once delivery.

### Additional bottleneck — Algorithm latency at scale
The load-balancing engine runs an O(n) scan over all stations within the radius and computes haversine distance for each candidate. For a few dozen stations this is instant, but a nationwide search with thousands of stations would require spatial indexing (e.g., PostGIS `ST_DWithin`) and pre-computed queue scores.

## 4. Data Models

### 4.1 In-memory / API-mapped station model (`src/lib/stations.ts`)

```typescript
interface Charger {
  id: string;                 // e.g. "ocm-12345-0-0"
  type: "CCS" | "Type2" | "AC";
  powerKw: number;            // e.g. 50, 22, 7
  status: "active" | "occupied" | "maintenance";
}

interface Station {
  id: string;                 // "ocm-<OpenChargeMapID>" or legacy mock ID
  name: string;
  city: string;
  lat: number;
  lng: number;
  pricePerKwh: number;        // INR per kWh
  queue: number;              // estimated vehicles in queue
  waitMins: number;           // estimated wait in minutes
  chargers: Charger[];
  reserved: {
    today: number[];          // reserved hour integers (0–23)
    tomorrow: number[];
  };
}
```

### 4.2 Legacy mock dataset (`INITIAL_STATIONS`)

Ten pre-defined stations across India used as an offline fallback and for the original demo:

| City | Station | Lat | Lng | Chargers |
|------|---------|-----|-----|----------|
| Mumbai | Bandra Volt Hub | 19.0596 | 72.8295 | 2× CCS 50 kW, 1× Type2 22 kW, 1× AC 7 kW |
| Mumbai | Andheri Charge Point | 19.1136 | 72.8697 | 1× CCS 60 kW, 2× Type2 22 kW |
| Delhi | Connaught Place Fast Charge | 28.6315 | 77.2167 | 1× CCS 120 kW, 1× CCS 50 kW, 1× Type2 22 kW, 1× AC 7 kW |
| Delhi | Saket Green Grid | 28.5245 | 77.2066 | 1× CCS 50 kW, 1× Type2 22 kW, 1× AC 7 kW |
| Bengaluru | MG Road EV Hub | 12.9756 | 77.6066 | 1× CCS 50 kW, 2× Type2 22 kW, 1× AC 7 kW |
| Bengaluru | Electronic City Power Dock | 12.8452 | 77.6602 | 2× CCS 60 kW, 1× Type2 22 kW, 1× AC 7 kW |
| Pune | Pune Junction EV Hub | 18.5286 | 73.8742 | 1× CCS 50 kW, 1× Type2 22 kW, 1× AC 7 kW |
| Pune | Baner Green Grid | 18.5590 | 73.7868 | 1× CCS 50 kW, 1× Type2 22 kW, 1× AC 7 kW |
| Hyderabad | HITEC City Volt Park | 17.4435 | 78.3772 | 2× CCS 60 kW, 1× Type2 22 kW |
| Chennai | Marina Charge Bay | 13.0500 | 80.2824 | 1× CCS 50 kW, 1× Type2 22 kW, 1× AC 7 kW |

### 4.3 Database bookings table (`supabase/migrations/...sql`)

```sql
CREATE TABLE public.bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,                 -- human-readable booking code, e.g. "EP-AB12CD"
  station_id TEXT NOT NULL,
  station_name TEXT NOT NULL,
  city TEXT NOT NULL,
  charger_type TEXT NOT NULL,                -- "CCS" | "Type2" | "AC"
  power_kw INTEGER NOT NULL,
  day TEXT NOT NULL,                         -- "today" | "tomorrow"
  hour INTEGER NOT NULL,                       -- 0–23
  est_kwh NUMERIC NOT NULL,                    -- estimated energy for the session
  amount_inr INTEGER NOT NULL,                 -- total INR (after discount)
  discount_applied BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending',      -- "pending" | "paid" | "failed"
  stripe_session_id TEXT,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX bookings_stripe_session_id_idx ON public.bookings (stripe_session_id);

GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
```

### 4.4 Server-side booking DTO (`src/lib/payments.functions.ts`)

```typescript
interface StoredBooking {
  code: string;
  stationId: string;
  stationName: string;
  city: string;
  chargerType: "CCS" | "Type2" | "AC";
  powerKw: number;
  day: "today" | "tomorrow";
  hour: number;
  estKwh: number;
  total: number;              // amount_inr
  discountApplied: boolean;
  status: "pending" | "paid" | "failed";
  createdAt: number;            // epoch ms
}
```

### 4.5 Load-balancing formula

```text
loadScore(distanceKm, queue) = distanceKm + (queue × 5)

congested = queue > 3 OR waitMins > 30
queueLevel =
  "congested" if queue > 3 or waitMins > 30
  "moderate"  if queue >= 2 or waitMins >= 10
  "low"       otherwise
```

The engine picks the non-congested station with the lowest `loadScore` as the reroute recommendation.
