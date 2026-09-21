// lib/osmStations.ts
import { type Station, type ChargerType } from "./stations";

export async function fetchStationsAlongRoute(bounds: {
  south: number;
  west: number;
  north: number;
  east: number;
}): Promise<Station[]> {
  // Query nodes, ways, and relations for global highway coverage
  const query = `
    [out:json][timeout:25];
    (
      node["amenity"="charging_station"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
      way["amenity"="charging_station"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
      relation["amenity"="charging_station"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
    );
    out center;
  `;

  try {
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      // Overpass API strictly requires the query prefixed with 'data='
      body: "data=" + encodeURIComponent(query),
    });
    
    const data = await response.json();

    if (!data.elements) return [];

    // Map OpenStreetMap elements to your app's Station interface
    const dynamicStations: Station[] = data.elements
      .map((el: any, index: number) => {
        const tags = el.tags || {};
        
        // Handle coordinate retrieval for nodes vs ways/relations (which use center)
        const lat = el.lat || (el.center && el.center.lat);
        const lng = el.lon || (el.center && el.center.lon);

        return {
          id: `osm-${el.id || index}`,
          name: tags.name || tags.operator || "Public EV Charging Station",
          city: tags["addr:city"] || tags["addr:state"] || "Highway Corridor",
          lat: lat,
          lng: lng,
          pricePerKwh: 16, // Default fallback price
          queue: Math.floor(Math.random() * 3), // Simulated active queue
          waitMins: Math.floor(Math.random() * 15),
          chargers: [
            {
              id: `ch-${el.id}-1`,
              type: "CCS" as ChargerType,
              powerKw: tags.capacity ? 60 : 50,
              status: "active",
            },
          ],
          reserved: { today: [], tomorrow: [] },
        };
      })
      .filter((st: Station) => st.lat && st.lng); // Filter out any elements missing coordinates

    return dynamicStations;
  } catch (error) {
    console.error("Failed to fetch live OSM stations:", error);
    return [];
  }
}