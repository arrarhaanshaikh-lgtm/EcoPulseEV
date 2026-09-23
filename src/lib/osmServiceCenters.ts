export interface ServiceCenter {
  id: string;
  name: string;
  brand: string;
  lat: number;
  lng: number;
  address: string;
  rating: number;
  phone: string;
  services: string[];
}

// In-memory cache to prevent disappearing markers on duplicate re-renders
let cachedCenters: ServiceCenter[] = [];
let lastFetchKey = "";

export async function fetchLiveServiceCenters(
  lat: number,
  lng: number,
  radiusMeters: number = 15000
): Promise<ServiceCenter[]> {
  // Prevent duplicate fetches for the same coordinates
  const currentKey = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  if (currentKey === lastFetchKey && cachedCenters.length > 0) {
    return cachedCenters;
  }

  const query = `[out:json][timeout:5];(node["shop"="car_repair"](around:${radiusMeters},${lat},${lng});way["shop"="car_repair"](around:${radiusMeters},${lat},${lng}););out center 30;`;

  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!res.ok) {
      console.warn("OSM API Throttled/Error. Using cached markers.");
      return cachedCenters;
    }

    const data = await res.json();

    if (!data.elements || data.elements.length === 0) {
      return cachedCenters;
    }

    const fetchedCenters: ServiceCenter[] = data.elements
      .map((el: any, index: number) => {
        const itemLat = el.lat || el.center?.lat;
        const itemLng = el.lon || el.center?.lon;

        if (!itemLat || !itemLng) return null;

        const name =
          el.tags?.name ||
          el.tags?.brand ||
          el.tags?.operator ||
          "Auto & EV Service Hub";

        const brand = (
          el.tags?.brand ||
          el.tags?.operator ||
          "SERVICE CENTER"
        ).toUpperCase();

        const street = el.tags?.["addr:street"] || el.tags?.["addr:suburb"] || "";
        const city = el.tags?.["addr:city"] || "Local Area";
        const address = street ? `${street}, ${city}` : "Nearby Service Location";

        return {
          id: `real-osm-${el.id || index}`,
          name,
          brand,
          lat: itemLat,
          lng: itemLng,
          address,
          rating: 4.5,
          phone: el.tags?.phone || el.tags?.["contact:phone"] || "+91 98765 43210",
          services: [
            "General Repair & Service",
            "Electrical Diagnostics",
            "Brake & Battery Support",
          ],
        };
      })
      .filter((item: ServiceCenter | null): item is ServiceCenter => item !== null);

    if (fetchedCenters.length > 0) {
      cachedCenters = fetchedCenters;
      lastFetchKey = currentKey;
    }

    return cachedCenters;
  } catch (error) {
    console.warn("Network error fetching live OSM hubs. Retaining existing markers.");
    return cachedCenters;
  }
}