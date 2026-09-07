export interface BridgeScriptConfig {
  apiBase: string;
  jobId: string;
  bridgeToken: string;
  maxPages: number;
  limit: number;
}

export function buildUrduboxBridgeScript(config: BridgeScriptConfig): string {
  const cfg = JSON.stringify(config);
  return `(async function TmbUrduboxBridge() {
  const CFG = ${cfg};
  const mapItems = (items, type) => (items || []).map((item) => {
    const tmdbRaw = item.tmdbId ?? item.tmdbid;
    const tmdbId = typeof tmdbRaw === 'number' ? tmdbRaw : (typeof tmdbRaw === 'string' && /^\\d+$/.test(tmdbRaw) ? Number(tmdbRaw) : null);
    const upstreamId = item._id || item.id;
    if (!tmdbId || !upstreamId) return null;
    return { tmdbId, upstreamId, type };
  }).filter(Boolean);

  const postBatch = async (items, finalize) => {
    const res = await fetch(CFG.apiBase + '/sync/urdubox/bridge/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Bridge-Token': CFG.bridgeToken },
      body: JSON.stringify({ jobId: CFG.jobId, items: finalize ? [] : items, finalize }),
    });
    if (!res.ok) throw new Error('Backend batch failed: ' + res.status);
    return res.json();
  };

  console.log('[TMB] Starting Urdubox bridge sync...');
  for (let page = 1; page <= CFG.maxPages; page++) {
    const [moviesRes, seriesRes] = await Promise.all([
      fetch('/api/movies/public?page=' + page + '&limit=' + CFG.limit + '&ordering=views&direction=desc').then((r) => r.json()),
      fetch('/api/series/public?page=' + page + '&limit=' + CFG.limit + '&ordering=views&direction=desc').then((r) => r.json()),
    ]);
    const items = [...mapItems(moviesRes.data, 'movie'), ...mapItems(seriesRes.data, 'series')];
    if (!items.length) {
      console.log('[TMB] No more items on page', page);
      break;
    }
    const result = await postBatch(items, false);
    console.log('[TMB] Page', page, '— imported:', result.imported, 'skipped:', result.skipped, 'failed:', result.failed);
    const movieCount = moviesRes.data?.length || 0;
    const seriesCount = seriesRes.data?.length || 0;
    if (movieCount < CFG.limit && seriesCount < CFG.limit) break;
    await new Promise((r) => setTimeout(r, 400));
  }
  const done = await postBatch([], true);
  console.log('[TMB] Done! imported:', done.imported, 'skipped:', done.skipped, 'failed:', done.failed);
  alert('TMB import complete! Imported: ' + done.imported + ', Skipped: ' + done.skipped);
})();`;
}
