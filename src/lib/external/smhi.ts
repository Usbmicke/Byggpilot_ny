import 'server-only';

interface SMHIForecast {
    validTime: string; // ISO date
    parameters: {
        name: string;
        values: number[];
    }[];
}

export interface WeatherData {
    temp: number;
    symbol: number; // SMHI code (1-27)
    wind: number;
    rain: number; // mm/h
    time: string;
}

// Simple in-memory cache: "lat,lon" -> { timestamp, data }
const cache = new Map<string, { timestamp: number; data: WeatherData[] }>();
const CACHE_TTL = 3600 * 1000; // 1 hour

export const SMHIService = {
    async getForecast(lat: number, lon: number): Promise<WeatherData[]> {
        const cacheKey = `${lat.toFixed(3)},${lon.toFixed(3)}`;
        const now = Date.now();

        if (cache.has(cacheKey)) {
            const entry = cache.get(cacheKey)!;
            if (now - entry.timestamp < CACHE_TTL) {
                return entry.data;
            }
        }

        try {
            // SMHI API: https://opendata.smhi.se/apidocs/metfcst/index.html
            const url = `https://opendata-download-metfcst.smhi.se/api/category/pmp3g/version/2/geotype/point/lon/${lon.toFixed(4)}/lat/${lat.toFixed(4)}/data.json`;

            const res = await fetch(url);
            if (!res.ok) throw new Error(`SMHI API error: ${res.status}`);

            const json = await res.json();
            const timeSeries = json.timeSeries as SMHIForecast[];

            // Filter: Get one data point per day (approx noon) for next 3 days
            // + Current weather (first item)

            const result: WeatherData[] = [];

            // 1. Current
            if (timeSeries.length > 0) {
                result.push(mapSMHIToSimple(timeSeries[0]));
            }

            // 2. Next 5 days at ~12:00
            const seenDays = new Set<string>();
            const today = new Date().toISOString().split('T')[0];
            seenDays.add(today);

            for (const item of timeSeries) {
                const [date, time] = item.validTime.split('T');
                // Look for noon forecast
                if (!seenDays.has(date) && time.startsWith('12')) {
                    result.push(mapSMHIToSimple(item));
                    seenDays.add(date);
                    if (result.length >= 6) break; // Current + 5 days
                }
            }

            cache.set(cacheKey, { timestamp: now, data: result });
            return result;

        } catch (e) {
            console.error("SMHI Fetch failed:", e);
            return [];
        }
    }
};

function mapSMHIToSimple(item: SMHIForecast): WeatherData {
    const getParam = (name: string) => item.parameters.find(p => p.name === name)?.values[0] || 0;

    return {
        time: item.validTime,
        temp: getParam('t'),
        symbol: getParam('Wsymb2'), // 1-27
        wind: getParam('ws'),
        rain: getParam('pmean') // Mean precepitation mm/h
    };
}
