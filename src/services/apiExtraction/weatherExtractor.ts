export async function fetchPortWeather(lat: number | null, lon: number | null, portName?: string) {
  // If no lat/lon, we could try to geocode by portName, but for simplicity we return mock or fail
  if (!lat || !lon) {
    if (portName) {
      return { 
        source: 'System',
        description: `Estimated weather for ${portName}`, 
        windKnots: 15, 
        visibilityKm: 8,
        note: 'Using mock data because exact coordinates were not provided.'
      };
    }
    return { description: "Unknown coordinates", windKnots: 0, visibilityKm: 0 };
  }
  
  try {
    if (!process.env.OPENWEATHER_API_KEY || process.env.OPENWEATHER_API_KEY === 'your_openweathermap_key') {
      return { 
        source: 'Mock Weather',
        description: "Clear sky (mocked)", 
        windKnots: 10, 
        visibilityKm: 10 
      };
    }

    const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${process.env.OPENWEATHER_API_KEY}&units=metric`);
    if (res.ok) {
      const data = await res.json();
      return {
        source: 'OpenWeatherMap',
        description: data.weather?.[0]?.description || "Unknown",
        windKnots: (data.wind?.speed || 0) * 1.94384, // m/s to knots
        visibilityKm: (data.visibility || 0) / 1000
      };
    }
    
    return { description: "Weather data unavailable", windKnots: 0, visibilityKm: 0 };
  } catch (error) {
    console.error('Failed to fetch weather', error);
    return { description: "Fetch error", windKnots: 0, visibilityKm: 0 };
  }
}
