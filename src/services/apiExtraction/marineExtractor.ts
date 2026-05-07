type GeoPoint = { latitude: number; longitude: number; name?: string; country?: string };

async function geocodeRoute(routeName?: string): Promise<GeoPoint | null> {
  if (!routeName) return null;
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(routeName)}&count=1&language=en&format=json`;
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
    console.error("Failed to geocode marine route", error);
    return null;
  }
}

export async function fetchMarineData(lat: number | null, lon: number | null, routeName?: string) {
  let latitude = lat;
  let longitude = lon;
  let geocoded: GeoPoint | null = null;

  if (!latitude || !longitude) {
    geocoded = await geocodeRoute(routeName);
    latitude = geocoded?.latitude ?? null;
    longitude = geocoded?.longitude ?? null;
  }

  if (!latitude || !longitude) {
    return {
      source: 'System',
      waveHeight: 2.0,
      swellHeight: 1.5,
      currentSpeed: 1.2,
      riskHint: "medium",
      note: `Estimated marine data for route near ${routeName || "unknown route"} due to missing exact coordinates.`
    };
  }

  try {
    if (process.env.STORMGLASS_API_KEY && process.env.STORMGLASS_API_KEY !== 'your_stormglass_key') {
      const params = 'waveHeight,swellHeight,currentSpeed';
      const res = await fetch(`https://api.stormglass.io/v2/weather/point?lat=${latitude}&lng=${longitude}&params=${params}`, {
        headers: {
          'Authorization': process.env.STORMGLASS_API_KEY
        }
      });
      if (res.ok) {
        const data = await res.json();
        const current = data.hours?.[0] || {};
        const waveHeight = current.waveHeight?.sg || 0;
        return {
          source: 'Stormglass',
          latitude,
          longitude,
          resolvedName: geocoded?.name,
          waveHeight,
          swellHeight: current.swellHeight?.sg || 0,
          currentSpeed: current.currentSpeed?.sg || 0,
          riskHint: waveHeight >= 3 ? "high" : waveHeight >= 2 ? "medium" : "low",
        };
      }
    }

    const current = [
      "wave_height",
      "wave_direction",
      "wave_period",
      "wind_wave_height",
      "swell_wave_height",
      "ocean_current_velocity",
    ].join(",");
    const res = await fetch(
      `https://marine-api.open-meteo.com/v1/marine?latitude=${latitude}&longitude=${longitude}&current=${current}&timezone=auto`,
      { next: { revalidate: 900 } },
    );

    if (res.ok) {
      const data = await res.json();
      const cur = data.current || {};
      const waveHeight = cur.wave_height || 0;
      return {
        source: 'Open-Meteo Marine',
        latitude,
        longitude,
        resolvedName: geocoded?.name,
        country: geocoded?.country,
        waveHeight,
        waveDirection: cur.wave_direction,
        wavePeriod: cur.wave_period,
        windWaveHeight: cur.wind_wave_height,
        swellHeight: cur.swell_wave_height,
        currentSpeed: cur.ocean_current_velocity,
        riskHint: waveHeight >= 3 ? "high" : waveHeight >= 2 ? "medium" : "low",
      };
    }
    
    return { waveHeight: 0, swellHeight: 0, currentSpeed: 0, note: 'Failed to fetch from API' };
  } catch (error) {
    console.error('Failed to fetch marine data', error);
    return { waveHeight: 0, swellHeight: 0, currentSpeed: 0, note: 'Error fetching data' };
  }
}
