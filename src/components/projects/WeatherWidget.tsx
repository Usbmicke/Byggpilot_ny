import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Cloud, CloudRain, Sun, CloudLightning, CloudSnow, AlertTriangle, CloudFog } from 'lucide-react';

interface WeatherWidgetProps {
    address: string;
    projectId: string; // Used for risk check
}

export function WeatherWidget({ address, projectId }: WeatherWidgetProps) {
    const [weather, setWeather] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!address) {
            setLoading(false);
            return;
        }

        import('@/app/actions').then((mod: any) => {
            if (mod.getWeatherAction) {
                mod.getWeatherAction(address).then((res: any) => {
                    if (res.success && res.weather) {
                        setWeather(res.weather);
                    }
                    setLoading(false);
                });
            }
        });
    }, [address]);

    if (!address) return null; // No address, no weather
    if (loading) return <div className="h-6 w-20 bg-muted/20 animate-pulse rounded-md" />;
    if (weather.length === 0) return null; // Failed to fetch

    // SMHI Symbol Map (Simplified)
    // 1-4: Sun/Clear, 5-10: Cloud, 11-20: Rain, 21-27: Thunder/Snow
    const getIcon = (sym: number) => {
        if (sym <= 4) return <Sun size={14} className="text-amber-500" />;
        if (sym <= 10) return <Cloud size={14} className="text-gray-400" />;
        if (sym <= 20) return <CloudRain size={14} className="text-blue-400" />;
        if (sym <= 24) return <CloudSnow size={14} className="text-cyan-300" />;
        return <CloudLightning size={14} className="text-purple-500" />;
    };

    // Check for "Bad Weather Risk" (Rain in next 3 days)
    const isRainingSoon = weather.slice(0, 3).some(d => d.symbol >= 11 && d.symbol <= 20);

    return (
        <div className="flex items-center gap-3 bg-secondary/30 px-2 py-1 rounded-md border border-border/50">
            {/* Current Weather */}
            <div className="flex items-center gap-1" title={`Just nu: ${weather[0].temp}°C`}>
                {getIcon(weather[0].symbol)}
                <span className="text-xs font-medium">{Math.round(weather[0].temp)}°</span>
            </div>

            {/* Tiny Forecast (Next 2 days) */}
            <div className="hidden sm:flex items-center gap-2 border-l border-border/50 pl-2">
                {weather.slice(1, 3).map((day: any, i: number) => (
                    <div key={i} className="flex flex-col items-center" title={`${day.time.split('T')[0]}: ${day.temp}°`}>
                        {getIcon(day.symbol)}
                    </div>
                ))}
            </div>

            {/* Risk Indicator Integration (Client Side Check) */}
            {isRainingSoon && (
                <div title="Regn väntas kommande dagar - Planera om utomhusjobb!" className="animate-pulse">
                    <CloudRain size={12} className="text-blue-500" />
                </div>
            )}
        </div>
    );
}
