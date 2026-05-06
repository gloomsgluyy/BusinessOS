export async function fetchBMKGEarthquakeAndAlerts() {
  try {
    const res = await fetch('https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json');
    if (res.ok) {
      const data = await res.json();
      const gempa = data?.Infogempa?.gempa;
      if (gempa) {
        return {
          source: 'BMKG',
          latestEarthquake: {
            date: gempa.Tanggal,
            time: gempa.Jam,
            magnitude: gempa.Magnitude,
            depth: gempa.Kedalaman,
            coordinates: gempa.Coordinates,
            region: gempa.Wilayah,
            potensi: gempa.Potensi
          }
        };
      }
    }
    
    return { source: 'BMKG', note: 'No recent critical alerts found' };
  } catch (error) {
    console.error('Failed to fetch BMKG alerts', error);
    return { source: 'BMKG', note: 'Error fetching alerts' };
  }
}
