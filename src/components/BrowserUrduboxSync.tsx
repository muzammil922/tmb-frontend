import { useRef, useState } from 'react';
import api from '../lib/api';
import {
  discoverUrduboxMovies,
  discoverUrduboxSeries,
  mapUrduboxItems,
} from '../lib/urdubox-browser';
import { Card, CardHeader } from './ui/Card';
import { Button } from './ui/Button';
import { Alert } from './ui/Alert';
import { IconStop } from './ui/icons';

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
    <Card className="border-violet-500/20 bg-violet-500/5">
      <CardHeader
        title="Browser Urdubox Sync"
        description="Fetches Urdubox from your browser (bypasses server IP block). Backend only imports via TMDB."
      />

      {status && (
        <Alert variant={status.includes('failed') || status.includes('No items') ? 'error' : running ? 'info' : 'success'}>
          {status}
        </Alert>
      )}

      {running && (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-slate-900/50 p-3 text-center">
            <p className="text-xs text-slate-500">Imported</p>
            <p className="mt-1 text-xl font-bold text-emerald-400">+{stats.imported}</p>
          </div>
          <div className="rounded-xl bg-slate-900/50 p-3 text-center">
            <p className="text-xs text-slate-500">Skipped</p>
            <p className="mt-1 text-xl font-bold text-amber-400">{stats.skipped}</p>
          </div>
          <div className="rounded-xl bg-slate-900/50 p-3 text-center">
            <p className="text-xs text-slate-500">Failed</p>
            <p className="mt-1 text-xl font-bold text-red-400">{stats.failed}</p>
          </div>
          <div className="rounded-xl bg-slate-900/50 p-3 text-center">
            <p className="text-xs text-slate-500">Page</p>
            <p className="mt-1 text-xl font-bold text-slate-200">{stats.page}/{maxPages}</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Button
          onClick={runBrowserSync}
          disabled={running}
          className="!bg-violet-600 hover:!bg-violet-500"
        >
          {running ? 'Running...' : 'Run Browser Urdubox Sync'}
        </Button>
        {running && (
          <Button variant="danger" icon={<IconStop className="h-4 w-4" />} onClick={stop} disabled={stopping}>
            {stopping ? 'Stopping...' : 'Stop'}
          </Button>
        )}
      </div>
    </Card>
  );
}
