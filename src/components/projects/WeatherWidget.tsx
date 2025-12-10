import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Cloud, CloudRain, Sun, CloudLightning, CloudSnow, AlertTriangle, CloudFog } from 'lucide-react';

interface WeatherWidgetProps {
    address: string;
    projectId: string; // Used for risk check
    projectName?: string;
    projectDescription?: string;
    onRiskDetected?: (risk: any | null) => void;
}

export function WeatherWidget({ address, projectId, projectDescription, onRiskDetected }: WeatherWidgetProps) {
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

    // SMHI Symbol Map (Simplified)
    // 1-4: Sun/Clear, 5-10: Cloud, 11-20: Rain, 21-27: Thunder/Snow
    const getIcon = (sym: number) => {
        if (sym <= 4) return <Sun size={14} className="text-amber-500" />;
        if (sym <= 10) return <Cloud size={14} className="text-gray-400" />;
        if (sym <= 20) return <CloudRain size={14} className="text-blue-400" />;
        if (sym <= 24) return <CloudSnow size={14} className="text-cyan-300" />;
        if (sym <= 30) return <CloudLightning size={14} className="text-purple-500" />; // 21-27
        return <CloudFog size={14} className="text-gray-400" />;
    };

    // Check outdoor context
    const isOutdoor = (projectDescription || '').toLowerCase().match(/tak|fasad|ute|gräva|mark|grund|dränering|fönster|måla/);

    const badWeatherDay = weather.length > 0 ? weather.slice(0, 5).find(d => {
        const rain = d.symbol >= 11 && d.symbol <= 20;
        const snow = d.symbol >= 22;
        const thunder = d.symbol === 21;
        const storm = d.wind >= 10;
        return rain || snow || thunder || storm;
    }) : undefined;

    const hasRisk = !!(isOutdoor && badWeatherDay);

    useEffect(() => {
        if (onRiskDetected) {
            if (hasRisk && badWeatherDay) {
                onRiskDetected({
                    id: 'weather-risk',
                    type: 'Väderrisk',
                    description: `Dåligt väder (${badWeatherDay.rain ? 'Regn' : ''} ${badWeatherDay.wind >= 10 ? 'Vind' : ''}) väntas ${badWeatherDay.time.split('T')[0]}.`,
                    status: 'active'
                });
            } else {
                onRiskDetected(null);
            }
        }
    }, [hasRisk, badWeatherDay, onRiskDetected]);

    if (!address) return null; // No address, no weather
    if (loading) return <div className="h-6 w-20 bg-muted/20 animate-pulse rounded-md" />;
    if (weather.length === 0) return null; // Failed to fetch

    return (
        <div className="flex flex-col gap-2 mt-2 w-full">
            <div className="flex items-center gap-3 bg-secondary/30 px-2 py-1 rounded-md border border-border/50 justify-between">
                {/* Current Weather */}
                <div className="flex items-center gap-1" title={`Just nu: ${weather[0].temp}°C`}>
                    {getIcon(weather[0].symbol)}
                    <span className="text-xs font-medium">{Math.round(weather[0].temp)}°</span>
                </div>

                {/* 7-Day Forecast (Scrollable) */}
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar max-w-[150px] sm:max-w-none">
                    {weather.slice(1, 8).map((day: any, i: number) => (
                        <div key={i} className="flex flex-col items-center min-w-[20px]" title={`${day.time.split('T')[0]}: ${day.temp}°`}>
                            {getIcon(day.symbol)}
                            <span className="text-[9px] text-muted-foreground">{Math.round(day.temp)}°</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
