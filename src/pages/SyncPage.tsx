import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

type SyncSource = 'ALL' | 'URDBOX' | 'MOVIESAPI';

interface SyncSettings {
  urduboxEnabled: boolean;
  moviesApiEnabled: boolean;
  automationEnabled: boolean;
  scheduleStart: string | null;
  scheduleEnd: string | null;
  cronExpression: string | null;
  maxPagesPerRun: number;
  resultsPerPage: number;
}

interface SyncStatus {
  running: boolean;
  cancelRequested: boolean;
  activeJobId: string | null;
}

interface SyncJob {
  id: string;
  source: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  imported: number;
  skipped: number;
  failed: number;
  errorMessage: string | null;
  createdAt: string;
}

interface SyncLog {
  id: string;
  tmdbId: number | null;
  upstreamId: string | null;
  title: string | null;
  action: string;
  reason: string | null;
  contentType: string;
  createdAt: string;
}

function Toggle({
  label,
  checked,
  onChange,
  description,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  description?: string;
}) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-lg bg-slate-800 p-4">
      <div>
        <p className="font-medium">{label}</p>
        {description && <p className="mt-1 text-sm text-slate-400">{description}</p>}
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-5 w-5 accent-red-600"
      />
    </label>
  );
}

function JobLogs({ jobId }: { jobId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['sync-job-logs', jobId],
    queryFn: async () => {
      const { data } = await api.get<{ data: SyncLog[] }>(`/admin/sync/jobs/${jobId}/logs`);
      return data.data;
    },
  });

  if (isLoading) return <p className="p-4 text-sm text-slate-400">Loading logs...</p>;
  if (!data?.length) return <p className="p-4 text-sm text-slate-500">No logs for this job.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700 text-left text-slate-400">
            <th className="px-4 py-2">Title</th>
            <th className="px-4 py-2">Action</th>
            <th className="px-4 py-2">Type</th>
            <th className="px-4 py-2">Reason</th>
            <th className="px-4 py-2">TMDB ID</th>
          </tr>
        </thead>
        <tbody>
          {data.map((log) => (
            <tr key={log.id} className="border-b border-slate-700/50">
              <td className="px-4 py-2">{log.title || '—'}</td>
              <td className="px-4 py-2">
                <span
                  className={
                    log.action === 'IMPORTED'
                      ? 'text-green-400'
                      : log.action === 'FAILED'
                        ? 'text-red-400'
                        : 'text-yellow-400'
                  }
                >
                  {log.action}
                </span>
              </td>
              <td className="px-4 py-2">{log.contentType}</td>
              <td className="px-4 py-2 text-slate-400">{log.reason || '—'}</td>
              <td className="px-4 py-2">{log.tmdbId ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SyncPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<SyncSettings | null>(null);
  const [runSource, setRunSource] = useState<SyncSource>('ALL');
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['sync-settings'],
    queryFn: async () => {
      const { data } = await api.get<SyncSettings>('/admin/sync/settings');
      return data;
    },
  });

  useEffect(() => {
    if (settings && !form) setForm(settings);
  }, [settings, form]);

  const saveMutation = useMutation({
    mutationFn: (data: SyncSettings) => api.put('/admin/sync/settings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync-settings'] });
      setMessage({ type: 'success', text: 'Settings saved.' });
    },
    onError: () => setMessage({ type: 'error', text: 'Failed to save settings.' }),
  });

  const runMutation = useMutation({
    mutationFn: (source: SyncSource) => api.post('/admin/sync/run', { source }),
    onSuccess: (res) => {
      const started = res.data?.started;
      setMessage({
        type: started ? 'success' : 'error',
        text: started ? 'Sync started successfully.' : res.data?.message || 'Sync could not start.',
      });
      queryClient.invalidateQueries({ queryKey: ['sync-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
    onError: () => setMessage({ type: 'error', text: 'Failed to start sync.' }),
  });

  const stopMutation = useMutation({
    mutationFn: () => api.post('/admin/sync/stop'),
    onSuccess: (res) => {
      setMessage({ type: 'success', text: res.data?.message || 'Stop requested.' });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
      queryClient.invalidateQueries({ queryKey: ['sync-jobs'] });
    },
    onError: () => setMessage({ type: 'error', text: 'Failed to stop sync.' }),
  });

  const stopAutomationMutation = useMutation({
    mutationFn: () => api.post('/admin/sync/stop-automation'),
    onSuccess: (res) => {
      setForm((current) => (current ? { ...current, automationEnabled: false } : current));
      setMessage({ type: 'success', text: res.data?.message || 'Automation stopped.' });
      queryClient.invalidateQueries({ queryKey: ['sync-settings'] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
      queryClient.invalidateQueries({ queryKey: ['sync-jobs'] });
    },
    onError: () => setMessage({ type: 'error', text: 'Failed to stop automation.' }),
  });

  const { data: syncStatus } = useQuery({
    queryKey: ['sync-status'],
    queryFn: async () => {
      const { data } = await api.get<SyncStatus>('/admin/sync/status');
      return data;
    },
    refetchInterval: 3000,
  });

  const { data: jobsData, isLoading: jobsLoading } = useQuery({
    queryKey: ['sync-jobs'],
    queryFn: async () => {
      const { data } = await api.get<{ data: SyncJob[]; page: number; totalPages: number }>('/admin/sync/jobs');
      return data;
    },
    refetchInterval: 10000,
  });

  if (isLoading || !form) return <p className="text-slate-400">Loading...</p>;

  const statusColor = (status: string) => {
    if (status === 'COMPLETED') return 'text-green-400';
    if (status === 'FAILED') return 'text-red-400';
    if (status === 'RUNNING') return 'text-yellow-400';
    return 'text-slate-400';
  };

  const isSyncRunning = syncStatus?.running ?? false;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Content Sync</h1>

      {message && (
        <div
          className={`mb-6 rounded-lg px-4 py-3 text-sm ${
            message.type === 'success' ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="mb-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Sources & Automation</h2>
          <Toggle
            label="Urdubox"
            description="Import movies and series from Urdubox"
            checked={form.urduboxEnabled}
            onChange={(v) => setForm({ ...form, urduboxEnabled: v })}
          />
          <Toggle
            label="MoviesAPI"
            description="Import movies and series from MoviesAPI"
            checked={form.moviesApiEnabled}
            onChange={(v) => setForm({ ...form, moviesApiEnabled: v })}
          />
          <Toggle
            label="Automation"
            description="Run scheduled sync automatically (hourly, within schedule window)"
            checked={form.automationEnabled}
            onChange={(v) => setForm({ ...form, automationEnabled: v })}
          />

          <div className="rounded-lg bg-slate-800 p-4 space-y-3">
            <p className="font-medium">Schedule Window</p>
            <p className="text-sm text-slate-400">Automation only runs between these times (leave empty for 24/7)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-slate-400">Start</label>
                <input
                  type="time"
                  value={form.scheduleStart || ''}
                  onChange={(e) => setForm({ ...form, scheduleStart: e.target.value || null })}
                  className="w-full rounded-lg bg-slate-700 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">End</label>
                <input
                  type="time"
                  value={form.scheduleEnd || ''}
                  onChange={(e) => setForm({ ...form, scheduleEnd: e.target.value || null })}
                  className="w-full rounded-lg bg-slate-700 px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-slate-800 p-4 space-y-3">
            <p className="font-medium">Sync Limits</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-slate-400">Max pages per run</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={form.maxPagesPerRun}
                  onChange={(e) => setForm({ ...form, maxPagesPerRun: Number(e.target.value) })}
                  className="w-full rounded-lg bg-slate-700 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Results per page</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={form.resultsPerPage}
                  onChange={(e) => setForm({ ...form, resultsPerPage: Number(e.target.value) })}
                  className="w-full rounded-lg bg-slate-700 px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          <button
            onClick={() => saveMutation.mutate(form)}
            disabled={saveMutation.isPending}
            className="rounded-lg bg-red-600 px-6 py-2 hover:bg-red-700 disabled:opacity-50"
          >
            {saveMutation.isPending ? 'Saving...' : 'Save Settings'}
          </button>
        </div>

        <div className="rounded-xl bg-slate-800 p-6">
          <h2 className="mb-4 text-lg font-semibold">Manual Sync</h2>
          <p className="mb-4 text-sm text-slate-400">
            Run a sync immediately. Only enabled sources will be processed.
          </p>
          {isSyncRunning && (
            <div className="mb-4 rounded-lg border border-yellow-700 bg-yellow-900/20 px-4 py-3 text-sm text-yellow-200">
              Sync is running{syncStatus?.cancelRequested ? ' — stopping...' : '...'}
            </div>
          )}
          <select
            value={runSource}
            onChange={(e) => setRunSource(e.target.value as SyncSource)}
            className="mb-4 w-full rounded-lg bg-slate-700 px-4 py-3"
            disabled={isSyncRunning}
          >
            <option value="ALL">All enabled sources</option>
            <option value="URDBOX">Urdubox only</option>
            <option value="MOVIESAPI">MoviesAPI only</option>
          </select>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              onClick={() => runMutation.mutate(runSource)}
              disabled={runMutation.isPending || isSyncRunning}
              className="rounded-lg bg-green-600 py-3 font-semibold hover:bg-green-700 disabled:opacity-50"
            >
              {runMutation.isPending ? 'Starting...' : 'Run Sync Now'}
            </button>
            <button
              onClick={() => stopMutation.mutate()}
              disabled={!isSyncRunning || stopMutation.isPending}
              className="rounded-lg bg-red-700 py-3 font-semibold hover:bg-red-800 disabled:opacity-50"
            >
              {stopMutation.isPending ? 'Stopping...' : 'Stop Sync'}
            </button>
          </div>
          <button
            onClick={() => stopAutomationMutation.mutate()}
            disabled={stopAutomationMutation.isPending || (!form.automationEnabled && !isSyncRunning)}
            className="mt-3 w-full rounded-lg border border-red-700 py-3 font-semibold text-red-300 hover:bg-red-900/20 disabled:opacity-50"
          >
            {stopAutomationMutation.isPending ? 'Stopping...' : 'Stop Automation & Sync'}
          </button>
        </div>
      </div>

      <div className="rounded-xl bg-slate-800 p-6">
        <h2 className="mb-4 text-lg font-semibold">Sync Jobs</h2>
        {jobsLoading ? (
          <p className="text-slate-400">Loading jobs...</p>
        ) : !jobsData?.data?.length ? (
          <p className="text-slate-500">No sync jobs yet.</p>
        ) : (
          <div className="space-y-2">
            {jobsData.data.map((job) => (
              <div key={job.id} className="rounded-lg border border-slate-700">
                <button
                  type="button"
                  onClick={() => setExpandedJobId(expandedJobId === job.id ? null : job.id)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-700/50"
                >
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <span className="font-medium">{job.source}</span>
                    <span className={statusColor(job.status)}>{job.status}</span>
                    <span className="text-green-400">+{job.imported}</span>
                    <span className="text-yellow-400">skip {job.skipped}</span>
                    <span className="text-red-400">fail {job.failed}</span>
                  </div>
                  <span className="text-xs text-slate-500">
                    {job.startedAt ? new Date(job.startedAt).toLocaleString() : new Date(job.createdAt).toLocaleString()}
                  </span>
                </button>
                {job.errorMessage && (
                  <p className="px-4 pb-3 text-xs text-orange-300">{job.errorMessage}</p>
                )}
                {expandedJobId === job.id && <JobLogs jobId={job.id} />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
