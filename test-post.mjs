async function test() {
  const fetch = (await import('node-fetch')).default;
  const res = await fetch('http://localhost:3000/api/memory/market-prices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      date: '2026-03-24',
      ici_1: 100, ici_2: 90, ici_3: 80, ici_4: 70, ici_5: 60,
      newcastle: 120, hba: 110
    })
  });
  console.log(res.status);
  console.log(await res.text());
}
test();