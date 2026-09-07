const URDBOX_BASE = 'https://urdubox.pk';

export interface UrduboxDiscoverItem {
  _id?: string;
  id?: string;
  tmdbId?: number | string;
  tmdbid?: number | string;
  title?: string;
  name?: string;
}

export interface UrduboxDiscoverResponse {
  data?: UrduboxDiscoverItem[];
  page?: number;
  totalPages?: number;
  total?: number;
}

function resolveTmdbId(item: UrduboxDiscoverItem): number | null {
  const id = item.tmdbId ?? item.tmdbid;
  if (typeof id === 'number' && Number.isFinite(id)) return id;
  if (typeof id === 'string' && /^\d+$/.test(id)) return Number(id);
  return null;
}

function resolveUpstreamId(item: UrduboxDiscoverItem): string | null {
  const id = item._id ?? item.id;
  return typeof id === 'string' ? id : null;
}

async function fetchUrduboxJson(targetUrl: string): Promise<UrduboxDiscoverResponse> {
  try {
    const direct = await fetch(targetUrl, {
      headers: { Accept: 'application/json' },
    });
    if (direct.ok) {
      return direct.json();
    }
  } catch {
    // CORS or network — fall through to admin proxy
  }

  const proxyUrl = `/api/urdubox?url=${encodeURIComponent(targetUrl)}`;
  const proxied = await fetch(proxyUrl, { headers: { Accept: 'application/json' } });
  if (!proxied.ok) {
    throw new Error(`Urdubox fetch failed (${proxied.status})`);
  }
  return proxied.json();
}

function buildUrl(path: string, params: Record<string, string | number>) {
  const query = new URLSearchParams(
    Object.fromEntries(Object.entries(params).map(([key, value]) => [key, String(value)])),
  );
  return `${URDBOX_BASE}${path}?${query.toString()}`;
}

export async function discoverUrduboxMovies(page: number, limit: number) {
  return fetchUrduboxJson(
    buildUrl('/api/movies/public', { page, limit, ordering: 'views', direction: 'desc' }),
  );
}

export async function discoverUrduboxSeries(page: number, limit: number) {
  return fetchUrduboxJson(
    buildUrl('/api/series/public', { page, limit, ordering: 'views', direction: 'desc' }),
  );
}

export function mapUrduboxItems(
  items: UrduboxDiscoverItem[],
  type: 'movie' | 'series',
) {
  return items
    .map((item) => {
      const tmdbId = resolveTmdbId(item);
      const upstreamId = resolveUpstreamId(item);
      if (!tmdbId || !upstreamId) return null;
      return { tmdbId, upstreamId, type };
    })
    .filter((item): item is { tmdbId: number; upstreamId: string; type: 'movie' | 'series' } => !!item);
}
