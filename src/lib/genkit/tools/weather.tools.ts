import 'server-only';
import { z } from 'genkit';
import { ai } from '@/lib/genkit-instance';

export const weatherTool = ai.defineTool(
    {
        name: 'weatherTool',
        description: 'Fetches current weather and forecast for a specific location. Use this for planning outdoor work (roofing, painting, etc).',
        inputSchema: z.object({
            location: z.string().describe('City or coordinates (e.g. "Stockholm" or "59.32,18.06")'),
        }),
        outputSchema: z.object({
            temperature: z.number(),
            windSpeed: z.number(),
            precipitation: z.number(),
            condition: z.string(),
            warning: z.string().optional()
        }),
    },
    async (input) => {
        console.log(`🌦️ Fetching weather for: ${input.location}`);

        // Simple Geocoding (Mock for City -> Coords fallback or use a simple map)
        // For robustness, defaults to Stockholm if parsing fails, but in a real app would use a Geocoding API.
        let lat = 59.32;
        let lon = 18.06;

        if (input.location.toLowerCase().includes('göteborg')) { lat = 57.70; lon = 11.97; }
        if (input.location.toLowerCase().includes('malmö')) { lat = 55.60; lon = 13.00; }
        // Add more if needed, or use an external geocoder.

        try {
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m,precipitation&timezone=Europe%2FBerlin`;
            const res = await fetch(url);
            const data = await res.json();

            const current = data.current;
            const windSpeed = current.wind_speed_10m;
            let warning = undefined;

            if (windSpeed > 10) warning = "⚠️ Varning: Höga vindar (>10 m/s). Olämpligt för takarbete/ställning.";
            if (current.precipitation > 0) warning = warning ? warning + " Även regn." : "⚠️ Varning: Nederbörd. Tänk på fuktkänsliga moment.";

            return {
                temperature: current.temperature_2m,
                windSpeed: windSpeed,
                precipitation: current.precipitation,
                condition: current.precipitation > 0 ? 'Rain/Snow' : 'Clear/Cloudy',
                warning
            };
        } catch (e: any) {
            console.error("Weather API Failed", e);
            return {
                temperature: 0,
                windSpeed: 0,
                precipitation: 0,
                condition: 'Unknown',
                warning: 'Could not fetch weather data.'
            };
        }
    }
);
