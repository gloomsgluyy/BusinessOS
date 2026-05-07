type GeoPoint = { latitude: number; longitude: number; name?: string; country?: string };

const WEATHER_CODE: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Severe thunderstorm with hail",
};

async function geocodePort(portName?: string): Promise<GeoPoint | null> {
  if (!portName) return null;
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(portName)}&count=1&language=en&format=json`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const data = await res.json();
    const first = data?.results?.[0];
    if (!first) return null;
    return {
      latitude: first.latitude,
      longitude: first.longitude,
      name: first.name,
      country: first.country,
    };
  } catch (error) {
    console.error("Failed to geocode port", error);
    return null;
  }
}

export async function fetchPortWeather(lat: number | null, lon: number | null, portName?: string) {
  let latitude = lat;
  let longitude = lon;
  let geocoded: GeoPoint | null = null;

  if (!latitude || !longitude) {
    geocoded = await geocodePort(portName);
    latitude = geocoded?.latitude ?? null;
    longitude = geocoded?.longitude ?? null;
  }

  if (!latitude || !longitude) {
    return {
      source: "System",
      portName,
      description: `Estimated weather for ${portName || "unknown port"}`,
      windKnots: 15,
      visibilityKm: 8,
      riskHint: "medium",
      note: "Coordinates could not be resolved, using conservative estimate.",
    };
  }

  try {
    if (process.env.OPENWEATHER_API_KEY && process.env.OPENWEATHER_API_KEY !== 'your_openweathermap_key') {
      const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${process.env.OPENWEATHER_API_KEY}&units=metric`);
      if (res.ok) {
        const data = await res.json();
        return {
          source: 'OpenWeatherMap',
          portName,
          latitude,
          longitude,
          resolvedName: geocoded?.name,
          description: data.weather?.[0]?.description || "Unknown",
          temperatureC: data.main?.temp,
          windKnots: (data.wind?.speed || 0) * 1.94384,
          visibilityKm: (data.visibility || 0) / 1000,
          riskHint: (data.wind?.speed || 0) > 12 ? "high" : "low",
        };
      }
    }

    const current = [
      "temperature_2m",
      "relative_humidity_2m",
      "precipitation",
      "rain",
      "weather_code",
      "cloud_cover",
      "wind_speed_10m",
      "wind_direction_10m",
      "wind_gusts_10m",
    ].join(",");
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=${current}&timezone=auto`,
      { next: { revalidate: 900 } },
    );
    if (res.ok) {
      const data = await res.json();
      const cur = data.current || {};
      const windKmh = cur.wind_speed_10m || 0;
      const gustKmh = cur.wind_gusts_10m || 0;
      const windKnots = windKmh * 0.539957;
      const gustKnots = gustKmh * 0.539957;
      return {
        source: 'Open-Meteo',
        portName,
        latitude,
        longitude,
        resolvedName: geocoded?.name,
        country: geocoded?.country,
        description: WEATHER_CODE[cur.weather_code] || `Weather code ${cur.weather_code ?? "unknown"}`,
        temperatureC: cur.temperature_2m,
        humidityPct: cur.relative_humidity_2m,
        precipitationMm: cur.precipitation,
        rainMm: cur.rain,
        cloudCoverPct: cur.cloud_cover,
        windKnots,
        gustKnots,
        windDirectionDeg: cur.wind_direction_10m,
        riskHint: gustKnots >= 28 || windKnots >= 22 || (cur.precipitation || 0) >= 10 ? "high" : gustKnots >= 18 || windKnots >= 14 ? "medium" : "low",
      };
    }
    
    return { source: "System", description: "Weather data unavailable", windKnots: 0, visibilityKm: 0, riskHint: "unknown" };
  } catch (error) {
    console.error('Failed to fetch weather', error);
    return { source: "System", description: "Fetch error", windKnots: 0, visibilityKm: 0, riskHint: "unknown" };
  }
}
