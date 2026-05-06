export async function fetchMarineData(lat: number | null, lon: number | null, routeName?: string) {
  if (!lat || !lon) {
    if (routeName) {
      return { 
        source: 'System',
        waveHeight: 2.0, 
        swellHeight: 1.5, 
        currentSpeed: 1.2,
        note: `Estimated marine data for route near ${routeName} due to missing exact coordinates.`
      };
    }
    return { waveHeight: 0, swellHeight: 0, currentSpeed: 0 };
  }
  
  try {
    if (!process.env.STORMGLASS_API_KEY || process.env.STORMGLASS_API_KEY === 'your_stormglass_key') {
      return { 
        source: 'Mock Marine',
        waveHeight: 1.5, 
        swellHeight: 1.0, 
        currentSpeed: 0.5,
        note: 'Mocked marine data due to missing API key'
      };
    }

    const params = 'waveHeight,swellHeight,currentSpeed';
    const res = await fetch(`https://api.stormglass.io/v2/weather/point?lat=${lat}&lng=${lon}&params=${params}`, {
      headers: {
        'Authorization': process.env.STORMGLASS_API_KEY
      }
    });
    
    if (res.ok) {
      const data = await res.json();
      const current = data.hours?.[0] || {};
      return {
        source: 'Stormglass',
        waveHeight: current.waveHeight?.sg || 0,
        swellHeight: current.swellHeight?.sg || 0,
        currentSpeed: current.currentSpeed?.sg || 0
      };
    }
    
    return { waveHeight: 0, swellHeight: 0, currentSpeed: 0, note: 'Failed to fetch from API' };
  } catch (error) {
    console.error('Failed to fetch marine data', error);
    return { waveHeight: 0, swellHeight: 0, currentSpeed: 0, note: 'Error fetching data' };
  }
}
