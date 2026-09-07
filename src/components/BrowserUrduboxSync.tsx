import { useRef, useState } from 'react';
import api from '../lib/api';
import {
  discoverUrduboxMovies,
  discoverUrduboxSeries,
  mapUrduboxItems,
} from '../lib/urdubox-browser';

interface BrowserUrduboxSyncProps {
  maxPages: number;
  resultsPerPage: number;
  onComplete?: () => void;
}

export function BrowserUrduboxSync({ maxPages, resultsPerPage, onComplete }: BrowserUrduboxSyncProps) {
  const [running, setRunning] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [status, setStatus] = useState('');
  const [stats, setStats] = useState({ imported: 0, skipped: 0, failed: 0, page: 0 });
  const stopRef = useRef(false);
  const jobIdRef = useRef<string | null>(null);

  const finalizeJob = async (jobId: string) => {
    await api.post('/admin/sync/urdubox/browser/batch', {
      jobId,
      finalize: true,
    });
  };

  const runBrowserSync = async () => {
    stopRef.current = false;
    setRunning(true);
    setStopping(false);
    setStats({ imported: 0, skipped: 0, failed: 0, page: 0 });
    setStatus('Starting browser-assisted Urdubox sync...');

    let imported = 0;
    let skipped = 0;
    let failed = 0;

    try {
      const { data: start } = await api.post<{ jobId: string }>('/admin/sync/urdubox/browser/start');
      const jobId = start.jobId;
      jobIdRef.current = jobId;

      for (let page = 1; page <= maxPages; page++) {
        if (stopRef.current) break;

        setStatus(`Fetching page ${page}/${maxPages} from Urdubox (your browser)...`);
        setStats((prev) => ({ ...prev, page }));

        const [moviesRes, seriesRes] = await Promise.all([
          discoverUrduboxMovies(page, resultsPerPage),
          discoverUrduboxSeries(page, resultsPerPage),
        ]);

        const items = [
          ...mapUrduboxItems(moviesRes.data ?? [], 'movie'),
          ...mapUrduboxItems(seriesRes.data ?? [], 'series'),
        ];

        if (!items.length) {
          if (page === 1) {
            setStatus('No items returned from Urdubox. Check proxy or try again.');
          }
          break;
        }

        setStatus(`Importing page ${page} (${items.length} items) via backend...`);

        const { data: batch } = await api.post<{
          imported: number;
          skipped: number;
          failed: number;
        }>('/admin/sync/urdubox/browser/batch', {
          jobId,
          items,
          finalize: false,
        });

        imported = batch.imported;
        skipped = batch.skipped;
        failed = batch.failed;
        setStats({ imported, skipped, failed, page });

        const movieCount = moviesRes.data?.length ?? 0;
        const seriesCount = seriesRes.data?.length ?? 0;
        if (movieCount < resultsPerPage && seriesCount < resultsPerPage) break;

        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      if (stopRef.current) {
        await api.post(`/admin/sync/jobs/${jobId}/stop`);
        setStatus(`Stopped. Imported ${imported}, skipped ${skipped}, failed ${failed}.`);
      } else {
        await finalizeJob(jobId);
        setStatus(`Done! Imported ${imported}, skipped ${skipped}, failed ${failed}.`);
      }

      onComplete?.();
    } catch (error: any) {
      const jobId = jobIdRef.current;
      if (jobId) {
        await api.post(`/admin/sync/jobs/${jobId}/stop`).catch(() => undefined);
      }
      setStatus(error?.response?.data?.message || error?.message || 'Browser sync failed.');
    } finally {
      setRunning(false);
      setStopping(false);
      jobIdRef.current = null;
    }
  };

  const stop = () => {
    stopRef.current = true;
    setStopping(true);
    setStatus('Stopping after current page...');
  };

  return (
    <div className="rounded-xl border border-purple-700 bg-purple-950/20 p-6">
      <h2 className="mb-2 text-lg font-semibold text-purple-200">Browser Urdubox Sync</h2>
      <p className="mb-4 text-sm text-slate-400">
        Fetches Urdubox from your browser (bypasses server 403). Imports via backend using TMDB data.
        Uses admin proxy on Vercel if CORS blocks direct fetch.
      </p>

      {status && (
        <div className="mb-4 rounded-lg bg-slate-900/80 px-4 py-3 text-sm text-slate-200">{status}</div>
      )}

      {running && (
        <div className="mb-4 flex flex-wrap gap-4 text-sm">
          <span className="text-green-400">+{stats.imported} imported</span>
          <span className="text-yellow-400">skip {stats.skipped}</span>
          <span className="text-red-400">fail {stats.failed}</span>
          <span className="text-slate-400">page {stats.page}/{maxPages}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          onClick={runBrowserSync}
          disabled={running}
          className="rounded-lg bg-purple-600 px-6 py-3 font-semibold hover:bg-purple-700 disabled:opacity-50"
        >
          {running ? 'Running...' : 'Run Browser Urdubox Sync'}
        </button>
        {running && (
          <button
            onClick={stop}
            disabled={stopping}
            className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-6 py-3 font-semibold hover:bg-red-800 disabled:opacity-50"
          >
            <span className="inline-block h-3 w-3 bg-white" />
            {stopping ? 'Stopping...' : 'Stop'}
          </button>
        )}
      </div>
    </div>
  );
}
