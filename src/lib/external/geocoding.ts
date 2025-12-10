import 'server-only';

// Cache to avoid hitting OSM too hard
const cache = new Map<string, { lat: number; lon: number }>();

export const GeocodingService = {
    async getCoordinates(address: string): Promise<{ lat: number; lon: number } | null> {
        if (!address) return null;

        // Check cache
        const key = address.toLowerCase().trim();
        if (cache.has(key)) return cache.get(key)!;

        try {
            // Use Nominatim (OpenStreetMap)
            // Provide a User-Agent as required by their Usage Policy
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
            const res = await fetch(url, {
                headers: {
                    'User-Agent': 'ByggPilot/2.0 (utveckling@byggpilot.se)'
                }
            });

            if (!res.ok) return null;

            const data = await res.json();
            if (data && data.length > 0) {
                const coords = {
                    lat: parseFloat(data[0].lat),
                    lon: parseFloat(data[0].lon)
                };
                cache.set(key, coords);
                return coords;
            }
        } catch (e) {
            console.error("Geocoding failed:", e);
        }
        return null;
    }
};
