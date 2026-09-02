# EcoPulse EV — Smart EV Charging Locator & Slot Booking

A mobile-first, dark eco-tech web app with an interactive map, smart load-balancing reroute engine, slot booking flow, and an operator dashboard. All data is in-app mock data (no backend), so everything works instantly and resets on reload.

## Design system

- Deep slate/near-black backgrounds, emerald green primary, amber + electric cyan accents, subtle glow and glass-card surfaces.
- All colors as semantic tokens in `src/styles.css` (oklch), no hardcoded color classes.
- Persistent bottom nav on mobile / top nav on desktop: Map, Booking, Operator, Profile.

## Pages

- `/` — Map View (home): full-height Leaflet/OpenStreetMap with colored station pins (green low queue, amber moderate, red congested), plus a swipeable list of nearby stations underneath.
- `/booking` — booking flow + "My Bookings" list with QR + booking IDs.
- `/operator` — operator dashboard.
- `/profile` — user profile, vehicle, saved stations, booking history, stats (kWh charged, CO2 saved).

## Feature 1: Station map

- Leaflet loaded client-side only (dynamic import behind a client-only wrapper so SSR doesn't break).
- Marker click opens a Station Detail Card: name, distance (km), charger types (Fast CCS 50kW, Type 2 22kW, Slow AC), total/available ports, queue count, estimated wait, price per kWh, and a "Book a Slot" CTA.

## Feature 2: Smart load-balancing engine

- Score = distance_km + (queue_count * 5); lowest score wins.
- On selecting a station with queue > 3 or wait > 30 min, show a Smart Recommendation modal naming the congested station, its wait, the best alternative, its distance, zero/low wait, and a 15% discount.
- Two actions: "Accept Reroute & Get Discount" (switches target station, applies discount to the booking) or "Proceed Anyway".

## Feature 3: Slot booking

Step-by-step modal:
1. Charger type selection (power, price/kWh).
2. Day toggle (Today / Tomorrow) + hourly time-slot grid.
3. Availability: past hours and reserved slots disabled from mock reservation data; live re-check on charger change.
4. Confirmation screen: generated booking ID, QR code, station, slot, duration, estimated kWh and total price with discount line if rerouted. Booking is saved in app state and appears under My Bookings and Profile.

## Feature 4: Operator dashboard

- Metric cards: total revenue, active chargers, sessions today, peak demand hours, load shifted via rerouting (count + %).
- Simple bar chart of hourly demand.
- Per-charger rows with quick toggles: Active / In Maintenance / Occupied, updating station status and availability across the app.

## Mock data

Six Pune stations (Pune Junction EV Hub, MG Road Fast Charge, Baner Green Grid, Kothrud Power Dock, Hinjewadi Volt Park, Viman Nagar Charge Point) with real lat/lng, charger types and counts, price per kWh, queue length, wait time, and reserved slots.

## Technical notes

- TanStack Start routes: `index.tsx`, `booking.tsx`, `operator.tsx`, `profile.tsx`, each with its own `head()` metadata.
- Shared app state via a React context store (stations, bookings, operator overrides) so bookings and charger toggles propagate across views.
- QR generated client-side with a small QR library.
- Leaflet CSS via a `<link>` in `__root.tsx`; map component rendered only after hydration.
