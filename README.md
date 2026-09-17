# EcoPulse EV

Build a responsive, modern Web Application called "EcoPulse EV" — a Smart EV Charging Station Locator and Slot Booking platform featuring a dynamic Smart Load-Balancing Engine.

### 🎨 Theme & UI/UX Design System

- Modern, clean, eco-tech aesthetics (Deep Dark/Slate background, Emerald Green primary accents, Amber/Electric Cyan secondary highlights).

- Responsive layout designed primarily for mobile browsers, but clean on desktop.

- Dashboard style layout with a persistent navigation bar: Map View, Slot Booking, Operator Dashboard, and User Profile.

---

### 🗺️ Core Feature 1: Interactive EV Station Map (User Facing)

- Integrate an interactive map (using Leaflet.js / OpenStreetMap coordinates).

- Display interactive pin markers for nearby charging stations with status indicators (Green = Low Queue, Amber = Moderate Queue, Red = Congested).

- When a marker is clicked, pop up a Station Detail Card showing:

  - Station Name, Distance (km), Available Charger Types (Fast CCS, Type 2, Slow AC), Total Ports, and Current Queue/Wait Time.

  - A primary call-to-action button: "Book a Slot".

---

### ⚖️ Core Feature 2: Dynamic Smart Load-Balancing Engine (Key Differentiator)

- Implement a dynamic load-balancing scoring algorithm logic:

  Score = Distance + (Queue Count * 5).

- If a user selects a congested station (Queue Count > 3 or wait time > 30 mins):

  - Automatically display a dynamic "Smart Recommendation Banner / Modal".

  - Alert Text: "⚡ Station A is heavily congested (~45 min wait). Reroute to Station B (2.1 km away) for 0 wait time + 15% discount on your booking!"

  - Provide two options: "Accept Reroute & Get Discount" or "Proceed Anyway".

---

### 📅 Core Feature 3: Real-Time Slot Booking Engine

- A step-by-step modal/screen when selecting a station:

  1. Select Charger Type (e.g., Fast CCS 50kW vs Type 2 22kW).

  2. Select Time Window (Interactive hourly time-slot grid for today/tomorrow).

  3. Real-time availability check (disable unavailable or already reserved slots).

  4. Instant Mock Booking Confirmation screen with a generated QR Code, Booking ID, and total estimated price.

---

### 📊 Core Feature 4: Station Operator Dashboard (Admin Panel)

- A dedicated toggle view for EV Station Owners/Operators showing:

  - Real-time station utilization metrics (Total Revenue, Active Chargers, Peak Demand Hours, Load Shifted via Rerouting).

  - Quick Toggle controls: Manually mark individual chargers as "Active", "In Maintenance", or "Occupied".

---

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
