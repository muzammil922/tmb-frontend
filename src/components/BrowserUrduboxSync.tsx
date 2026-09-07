import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { buildUrduboxBridgeScript } from '../lib/urdubox-bridge-script';
import { Card, CardHeader } from './ui/Card';
import { Button } from './ui/Button';
import { Alert } from './ui/Alert';
import { IconStop } from './ui/icons';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

interface BrowserUrduboxSyncProps {
  maxPages: number;
  resultsPerPage: number;
  onComplete?: () => void;
}

interface SyncJob {
  id: string;
  status: string;
  imported: number;
  skipped: number;
  failed: number;
}

export function BrowserUrduboxSync({ maxPages, resultsPerPage, onComplete }: BrowserUrduboxSyncProps) {
  const queryClient = useQueryClient();
  const [bridgeActive, setBridgeActive] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [bridgeScript, setBridgeScript] = useState('');
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState('');
  const [stopping, setStopping] = useState(false);
  const completedRef = useRef(false);

  const { data: jobsData } = useQuery({
    queryKey: ['sync-jobs'],
    queryFn: async () => {
      const { data } = await api.get<{ data: SyncJob[] }>('/admin/sync/jobs');
      return data;
    },
    enabled: bridgeActive,
  });

  const job = jobsData?.data?.find((j) => j.id === activeJobId);

  useEffect(() => {
    if (!job || !bridgeActive || completedRef.current) return;

    if (job.status !== 'RUNNING') {
      completedRef.current = true;
      setBridgeActive(false);
      setStatus(
        job.status === 'COMPLETED'
          ? `Done! Imported ${job.imported}, skipped ${job.skipped}, failed ${job.failed}.`
          : `Job ${job.status.toLowerCase()}. Imported ${job.imported}, skipped ${job.skipped}.`,
      );
      queryClient.invalidateQueries({ queryKey: ['sync-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
      onComplete?.();
    }
  }, [job, bridgeActive, onComplete, queryClient]);

  const stats = {
    imported: job?.imported ?? 0,
    skipped: job?.skipped ?? 0,
    failed: job?.failed ?? 0,
    page: 0,
  };

  const startBridgeSync = async () => {
    setCopied(false);
    completedRef.current = false;
    setStatus('Creating sync job...');

    try {
      const { data } = await api.post<{ jobId: string; bridgeToken: string }>('/admin/sync/urdubox/browser/start');
      setActiveJobId(data.jobId);

      const script = buildUrduboxBridgeScript({
        apiBase: API_URL.replace(/\/$/, ''),
        jobId: data.jobId,
        bridgeToken: data.bridgeToken,
        maxPages,
        limit: resultsPerPage,
      });
      setBridgeScript(script);
      setBridgeActive(true);
      setStatus('Job started. Follow the steps below to run the script on urdubox.pk.');
      queryClient.invalidateQueries({ queryKey: ['sync-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    } catch (error: any) {
      setStatus(error?.response?.data?.message || error?.message || 'Failed to start bridge sync.');
    }
  };

  const copyScript = async () => {
    await navigator.clipboard.writeText(bridgeScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const stopBridge = async () => {
    if (!activeJobId) return;
    setStopping(true);
    try {
      await api.post(`/admin/sync/jobs/${activeJobId}/stop`);
      setStatus('Sync stopped.');
      setBridgeActive(false);
      completedRef.current = true;
      queryClient.invalidateQueries({ queryKey: ['sync-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
      onComplete?.();
    } finally {
      setStopping(false);
    }
  };

  return (
    <Card className="border-violet-500/20 bg-violet-500/5">
      <CardHeader
        title="Browser Urdubox Sync"
        description="Urdubox blocks admin panel & server IPs (403/CORS). Run a short script on urdubox.pk — it uses your browser connection, then imports via backend."
      />

      <Alert variant="warning">
        Auto-fetch from admin fails because Urdubox blocks cross-origin requests and Vercel/server IPs.
        Use the <strong>bridge script</strong> below — takes ~30 seconds.
      </Alert>

      {status && (
        <Alert variant={status.includes('failed') || status.includes('Failed') ? 'error' : bridgeActive ? 'info' : 'success'}>
          {status}
        </Alert>
      )}

      {(bridgeActive || stats.imported > 0) && (
        <div className="mb-5 grid grid-cols-3 gap-3">
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
        </div>
      )}

      {!bridgeActive ? (
        <Button onClick={startBridgeSync} className="!bg-violet-600 hover:!bg-violet-500">
          Start Bridge Sync
        </Button>
      ) : (
        <div className="space-y-5">
          <ol className="space-y-3 text-sm text-slate-300">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-bold">1</span>
              <span>
                Open{' '}
                <a href="https://urdubox.pk" target="_blank" rel="noreferrer" className="text-violet-300 underline">
                  urdubox.pk
                </a>{' '}
                in a new tab (make sure the site loads normally).
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-bold">2</span>
              <span>Press <kbd className="rounded bg-slate-700 px-1.5 py-0.5 text-xs">F12</kbd> → Console tab</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-bold">3</span>
              <span>Click &quot;Copy Script&quot; below, paste in console, press Enter</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-bold">4</span>
              <span>Watch progress here — imports run automatically on backend</span>
            </li>
          </ol>

          <div className="flex flex-wrap gap-3">
            <Button onClick={copyScript} variant="secondary">
              {copied ? 'Copied!' : 'Copy Script'}
            </Button>
            <Button variant="danger" icon={<IconStop className="h-4 w-4" />} onClick={stopBridge} disabled={stopping}>
              {stopping ? 'Stopping...' : 'Stop Sync'}
            </Button>
          </div>

          <details className="rounded-xl border border-slate-700/60 bg-slate-900/40">
            <summary className="cursor-pointer px-4 py-3 text-sm text-slate-400">Preview script</summary>
            <pre className="max-h-48 overflow-auto p-4 text-xs text-slate-500">{bridgeScript}</pre>
          </details>
        </div>
      )}
    </Card>
  );
}
