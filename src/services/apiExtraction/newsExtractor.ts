export async function fetchShipmentNews(query: string) {
  try {
    const results = [];

    // Fallback/Mock if no API key
    if (!process.env.NEWS_API_KEY || process.env.NEWS_API_KEY === 'your_newsapi_key') {
      return [{ source: 'Mock News', title: `Simulated news about ${query}`, description: 'No real API key provided.' }];
    }

    // Try NewsAPI
    try {
      const res = await fetch(`https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&apiKey=${process.env.NEWS_API_KEY}`);
      if (res.ok) {
        const data = await res.json();
        results.push(...(data.articles || []).slice(0, 3).map((a: any) => ({ source: 'NewsAPI', title: a.title, description: a.description })));
      }
    } catch (e) {
      console.error('NewsAPI fetch error:', e);
    }

    // Try MediaStack
    if (process.env.MEDIASTACK_API_KEY && process.env.MEDIASTACK_API_KEY !== 'your_mediastack_key') {
      try {
        const res = await fetch(`http://api.mediastack.com/v1/news?access_key=${process.env.MEDIASTACK_API_KEY}&keywords=${encodeURIComponent(query)}&limit=3`);
        if (res.ok) {
          const data = await res.json();
          results.push(...(data.data || []).slice(0, 3).map((a: any) => ({ source: 'MediaStack', title: a.title, description: a.description })));
        }
      } catch (e) {
        console.error('MediaStack fetch error:', e);
      }
    }

    return results.length > 0 ? results : [{ source: 'System', title: 'No news found', description: 'No recent relevant news found for this query.' }];
  } catch (error) {
    console.error('Failed to fetch shipment news', error);
    return [{ source: 'Error', title: 'Fetch failed', description: 'Could not fetch news due to an error.' }];
  }
}
