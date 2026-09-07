export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Accept');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const target = req.query.url;
  if (typeof target !== 'string' || !target.startsWith('https://urdubox.pk/')) {
    return res.status(400).json({ error: 'Invalid url' });
  }

  try {
    const response = await fetch(target, {
      headers: {
        Accept: 'application/json',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Referer: 'https://urdubox.pk/',
        Origin: 'https://urdubox.pk',
      },
    });

    const body = await response.text();
    res.status(response.status);
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json');
    return res.send(body);
  } catch (error) {
    return res.status(502).json({ error: error?.message || 'Proxy fetch failed' });
  }
}
