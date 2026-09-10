import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { BrowserUrduboxSync } from '../components/BrowserUrduboxSync';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Alert } from '../components/ui/Alert';
import { Switch } from '../components/ui/Switch';
import { Tabs } from '../components/ui/Tabs';
import { Input, Label, Select } from '../components/ui/Input';
import { LoadingState } from '../components/ui/EmptyState';
import { IconStop } from '../components/ui/icons';

type SyncSource = 'ALL' | 'URDBOX' | 'MOVIESAPI' | 'IMDB3';
type SyncTab = 'settings' | 'run' | 'imdb3' | 'browser' | 'jobs';

interface SyncSettings {
  urduboxEnabled: boolean;
  moviesApiEnabled: boolean;
  imdb3Enabled: boolean;
  automationEnabled: boolean;
  syncIntervalHours: number;
  lastScheduledSyncAt: string | null;
  lastImdb3Id: number;
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
  runningJobs?: SyncJob[];
  automation?: {
    enabled: boolean;
    syncIntervalHours: number;
    lastScheduledSyncAt: string | null;
    nextSyncRemainingMinutes: number | null;
    urduboxEnabled: boolean;
    moviesApiEnabled: boolean;
    imdb3Enabled: boolean;
  };
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
    <div className="overflow-x-auto border-t border-slate-700/60">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700/60 text-left text-xs uppercase tracking-wider text-slate-500">
            <th className="px-4 py-2.5">Title</th>
            <th className="px-4 py-2.5">Action</th>
            <th className="px-4 py-2.5">Type</th>
            <th className="px-4 py-2.5">Reason</th>
            <th className="px-4 py-2.5">TMDB</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/40">
          {data.map((log) => (
            <tr key={log.id}>
              <td className="px-4 py-2 text-slate-200">{log.title || '—'}</td>
              <td className="px-4 py-2">
                <Badge
                  variant={
                    log.action === 'IMPORTED' ? 'success' : log.action === 'FAILED' ? 'danger' : 'warning'
                  }
                >
                  {log.action}
                </Badge>
              </td>
              <td className="px-4 py-2 text-slate-400">{log.contentType}</td>
              <td className="px-4 py-2 text-slate-500">{log.reason || '—'}</td>
              <td className="px-4 py-2 text-slate-400">{log.tmdbId ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function jobStatusVariant(status: string) {
  if (status === 'COMPLETED') return 'success';
  if (status === 'FAILED') return 'danger';
  if (status === 'RUNNING') return 'warning';
  return 'default';
}

const DEFAULT_SYNC_SETTINGS: SyncSettings = {
  urduboxEnabled: false,
  moviesApiEnabled: false,
  imdb3Enabled: true,
  automationEnabled: false,
  syncIntervalHours: 24,
  lastScheduledSyncAt: null,
  lastImdb3Id: 123290,
  scheduleStart: null,
  scheduleEnd: null,
  cronExpression: null,
  maxPagesPerRun: 10,
  resultsPerPage: 50,
};

export function SyncPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<SyncSettings>(DEFAULT_SYNC_SETTINGS);
  const [runSource, setRunSource] = useState<SyncSource>('ALL');
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<SyncTab>('settings');
  const [imdb3SingleId, setImdb3SingleId] = useState('123295');
  const [imdb3BatchStart, setImdb3BatchStart] = useState('123290');
  const [imdb3BatchCount, setImdb3BatchCount] = useState('5');
  const [imdb3Result, setImdb3Result] = useState<any>(null);

  const importImdb3SingleMutation = useMutation({
    mutationFn: (id: string) => api.post(`/admin/sync/imdb3/import/${id}`),
    onSuccess: (res) => {
      setImdb3Result(res.data);
      queryClient.invalidateQueries({ queryKey: ['admin-movies'] });
      queryClient.invalidateQueries({ queryKey: ['sync-jobs'] });
      setMessage({ type: 'success', text: res.data?.message || 'Movie imported successfully.' });
    },
    onError: (err: any) => {
      setMessage({ type: 'error', text: err?.response?.data?.message || 'IMDB3 import failed.' });
    },
  });

  const importImdb3BatchMutation = useMutation({
    mutationFn: ({ startId, count }: { startId: number; count: number }) =>
      api.post('/admin/sync/imdb3/batch', { startId, count }),
    onSuccess: (res) => {
      setImdb3Result(res.data);
      queryClient.invalidateQueries({ queryKey: ['admin-movies'] });
      queryClient.invalidateQueries({ queryKey: ['sync-jobs'] });
      setMessage({ type: 'success', text: `Batch processed (${res.data?.length} movies checked).` });
    },
    onError: (err: any) => {
      setMessage({ type: 'error', text: err?.response?.data?.message || 'Batch import failed.' });
    },
  });

  const { data: settings, isLoading } = useQuery({
    queryKey: ['sync-settings'],
    queryFn: async () => {
      const { data } = await api.get<SyncSettings>('/admin/sync/settings');
      return data;
    },
    retry: 1,
  });

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: (data: SyncSettings) => api.put('/admin/sync/settings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync-settings'] });
      setMessage({ type: 'success', text: 'Settings saved successfully.' });
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
      setActiveTab('jobs');
      queryClient.invalidateQueries({ queryKey: ['sync-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
    onError: () => setMessage({ type: 'error', text: 'Failed to start sync.' }),
  });

  const stopMutation = useMutation({
    mutationFn: (jobId?: string) =>
      jobId ? api.post(`/admin/sync/jobs/${jobId}/stop`) : api.post('/admin/sync/stop'),
    onSuccess: (res) => {
      setMessage({ type: 'success', text: res.data?.message || 'Stop requested.' });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
      queryClient.invalidateQueries({ queryKey: ['sync-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['sync-settings'] });
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
    refetchInterval: (query) => (query.state.data?.running ? 5000 : false),
  });

  const { data: jobsData, isLoading: jobsLoading } = useQuery({
    queryKey: ['sync-jobs'],
    queryFn: async () => {
      const { data } = await api.get<{ data: SyncJob[]; page: number; totalPages: number }>('/admin/sync/jobs');
      return data;
    },
    refetchInterval: (query) => {
      const hasRunning = (query.state.data?.data ?? []).some((job) => job.status === 'RUNNING');
      return hasRunning ? 5000 : false;
    },
  });

  if (isLoading && !settings && !form) return <LoadingState label="Loading sync settings..." />;

  const runningJobs = jobsData?.data?.filter((job) => job.status === 'RUNNING') ?? [];
  const isSyncRunning = Boolean(syncStatus?.running || runningJobs.length > 0);
  const stopping = Boolean(syncStatus?.cancelRequested || stopMutation.isPending || stopAutomationMutation.isPending);
  const jobCount = jobsData?.data?.length ?? 0;

  const tabs = [
    { id: 'settings', label: 'Settings & Automation' },
    { id: 'run', label: 'Run Sync', badge: isSyncRunning ? '●' : undefined },
    { id: 'imdb3', label: 'IMDB3 / MovieBox' },
    { id: 'browser', label: 'Browser Sync' },
    { id: 'jobs', label: 'Job History', badge: jobCount || undefined },
  ];

  return (
    <div>
      <PageHeader
        title="Content Sync"
        description="Configure sources, run bulk imports, and monitor sync jobs."
      />

      {isSyncRunning && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4">
          <div>
            <p className="font-semibold text-amber-200">
              Sync in progress{stopping ? ' — stopping...' : ''}
            </p>
            <p className="mt-1 text-sm text-amber-200/70">
              {runningJobs.length
                ? runningJobs.map((job) => `${job.source} (+${job.imported} imported)`).join(' · ')
                : 'Import running in background'}
            </p>
          </div>
          <Button variant="danger" icon={<IconStop className="h-4 w-4" />} onClick={() => stopMutation.mutate(undefined)} disabled={stopping}>
            {stopping ? 'Stopping...' : 'Stop Sync'}
          </Button>
        </div>
      )}

      {message && <Alert variant={message.type === 'success' ? 'success' : 'error'}>{message.text}</Alert>}

      <Tabs tabs={tabs} active={activeTab} onChange={(id) => setActiveTab(id as SyncTab)} />

      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <Card>
              <CardHeader title="Content Providers" description="Enable or disable upstream content sources" />
              <div className="space-y-4">
                <Switch
                  label="Urdubox"
                  description="Import Pakistani, Urdu dubbed movies & series (urdubox.pk)"
                  checked={form.urduboxEnabled}
                  onChange={(v) => setForm({ ...form, urduboxEnabled: v })}
                />
                <Switch
                  label="MoviesAPI"
                  description="Import Hollywood & global titles with embed player (moviesapi.to)"
                  checked={form.moviesApiEnabled}
                  onChange={(v) => setForm({ ...form, moviesApiEnabled: v })}
                />
                <Switch
                  label="IMDB3 / MovieBox"
                  description="Import Bollywood & Hollywood titles with direct MP4 streams (api2.imdb3.shop)"
                  checked={form.imdb3Enabled}
                  onChange={(v) => setForm({ ...form, imdb3Enabled: v })}
                />
              </div>
            </Card>

            <Card>
              <CardHeader
                title="Automated Recurring Sync Engine"
                description="Background cron automatically checks providers for new titles and imports them"
              />
              <div className="space-y-4">
                <Switch
                  label="Automatic Background Sync"
                  description="Automatically run scheduled sync across all enabled providers"
                  checked={form.automationEnabled}
                  onChange={(v) => setForm({ ...form, automationEnabled: v })}
                />

                <div>
                  <Label hint="How frequently the background automation checks for new content">
                    Sync Frequency (Interval)
                  </Label>
                  <Select
                    value={String(form.syncIntervalHours || 24)}
                    onChange={(e) => setForm({ ...form, syncIntervalHours: Number(e.target.value) })}
                  >
                    <option value="24">Every 1 Day (24 Hours) — Recommended</option>
                    <option value="48">Every 2 Days (48 Hours)</option>
                    <option value="12">Every 12 Hours</option>
                    <option value="6">Every 6 Hours</option>
                    <option value="1">Every 1 Hour (Fast Testing)</option>
                  </Select>
                </div>

                {/* Automation Telemetry & Countdown Widget */}
                <div className="rounded-xl border border-slate-700/80 bg-slate-900/70 p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Automation Status
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        form.automationEnabled
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-slate-700 text-slate-400'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${form.automationEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
                      {form.automationEnabled ? 'Active' : 'Disabled'}
                    </span>
                  </div>

                  <div className="text-xs text-slate-300 space-y-1 pt-1 border-t border-slate-800">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Last Automated Sync:</span>
                      <span className="font-medium text-slate-200">
                        {form.lastScheduledSyncAt
                          ? new Date(form.lastScheduledSyncAt).toLocaleString()
                          : 'Never run yet'}
                      </span>
                    </div>

                    {form.automationEnabled && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Next Scheduled Check:</span>
                        <span className="font-semibold text-amber-300">
                          {syncStatus?.automation?.nextSyncRemainingMinutes !== undefined &&
                          syncStatus.automation.nextSyncRemainingMinutes !== null
                            ? syncStatus.automation.nextSyncRemainingMinutes === 0
                              ? '⚡ Due now (executes on next tick)'
                              : `In ~${Math.floor(syncStatus.automation.nextSyncRemainingMinutes / 60)}h ${syncStatus.automation.nextSyncRemainingMinutes % 60}m`
                            : `Every ${form.syncIntervalHours || 24} hours`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader title="Schedule Window (Optional)" description="Restricts automation to specific hours, or leave empty for 24/7" />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Start time</Label>
                  <Input
                    type="time"
                    value={form.scheduleStart || ''}
                    onChange={(e) => setForm({ ...form, scheduleStart: e.target.value || null })}
                  />
                </div>
                <div>
                  <Label>End time</Label>
                  <Input
                    type="time"
                    value={form.scheduleEnd || ''}
                    onChange={(e) => setForm({ ...form, scheduleEnd: e.target.value || null })}
                  />
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader title="Sync Limits & Checkpoints" description="Control pagination depth and sequential scan pointer" />
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label hint="Max pages to fetch">Max pages</Label>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={form.maxPagesPerRun}
                      onChange={(e) => setForm({ ...form, maxPagesPerRun: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label hint="Items per page">Per page</Label>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={form.resultsPerPage}
                      onChange={(e) => setForm({ ...form, resultsPerPage: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div>
                  <Label hint="Tracks latest scanned sequential movie ID from IMDB3 / MovieBox">
                    IMDB3 Checkpoint Start ID
                  </Label>
                  <Input
                    type="number"
                    value={form.lastImdb3Id || 123290}
                    onChange={(e) => setForm({ ...form, lastImdb3Id: Number(e.target.value) })}
                  />
                </div>
              </div>
            </Card>

            <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending} className="w-full sm:w-auto">
              {saveMutation.isPending ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </div>
      )}

      {activeTab === 'run' && (
        <Card className="max-w-xl">
          <CardHeader title="Manual Sync" description="Run an immediate sync from enabled sources" />
          {isSyncRunning && (
            <Alert variant="warning">A sync is already running. You can stop it from the banner above.</Alert>
          )}
          <div className="space-y-4">
            <div>
              <Label>Source</Label>
              <Select
                value={runSource}
                onChange={(e) => setRunSource(e.target.value as SyncSource)}
                disabled={isSyncRunning}
              >
                <option value="ALL">All enabled sources</option>
                <option value="URDBOX">Urdubox only</option>
                <option value="MOVIESAPI">MoviesAPI only</option>
                <option value="IMDB3">IMDB3 / MovieBox only</option>
              </Select>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="success"
                onClick={() => runMutation.mutate(runSource)}
                disabled={runMutation.isPending || isSyncRunning}
              >
                {runMutation.isPending ? 'Starting...' : 'Run Sync Now'}
              </Button>
              <Button
                variant="danger"
                onClick={() => stopMutation.mutate(undefined)}
                disabled={!isSyncRunning || stopping}
              >
                {stopping ? 'Stopping...' : 'Stop Sync'}
              </Button>
            </div>
            <Button
              variant="outline"
              onClick={() => stopAutomationMutation.mutate()}
              disabled={stopAutomationMutation.isPending || (!form.automationEnabled && !isSyncRunning)}
              className="w-full"
            >
              {stopAutomationMutation.isPending ? 'Stopping...' : 'Stop Automation & All Syncs'}
            </Button>
          </div>
        </Card>
      )}

      {activeTab === 'imdb3' && (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="🍿 IMDB3 / MovieBox Direct Stream Provider"
              description="Direct integration with https://api2.imdb3.shop and MovieBox Play Stream engine"
            />
            <div className="rounded-xl border border-slate-700/80 bg-slate-900/60 p-4 text-xs text-slate-300 space-y-2">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
                <span className="font-bold text-white">Upstream API:</span>
                <span className="font-mono text-slate-300">https://api2.imdb3.shop/api/movie/:id</span>
              </div>
              <p className="text-slate-400">
                Imports Bollywood, Hollywood, Indian blockbusters, full cast members with character roles & avatars, trailer links, and extracts direct high-speed MP4 streaming URLs from MovieBox.
              </p>
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Single Movie Importer */}
            <Card>
              <CardHeader
                title="⚡ 1-Click Single Movie Importer"
                description="Import any specific movie by entering its IMDB3 ID (e.g. 123295 for Mirzapur, 123294 for Vibe)"
              />
              <div className="space-y-4">
                <div>
                  <Label hint="Enter numeric movie ID from api2.imdb3.shop">Movie ID</Label>
                  <Input
                    type="text"
                    value={imdb3SingleId}
                    onChange={(e) => setImdb3SingleId(e.target.value)}
                    placeholder="e.g. 123295"
                  />
                </div>
                <Button
                  variant="primary"
                  onClick={() => importImdb3SingleMutation.mutate(imdb3SingleId)}
                  disabled={importImdb3SingleMutation.isPending || !imdb3SingleId.trim()}
                  className="w-full"
                >
                  {importImdb3SingleMutation.isPending ? 'Importing from IMDB3...' : '⚡ Import Movie Now'}
                </Button>
              </div>
            </Card>

            {/* Sequential Batch Importer */}
            <Card>
              <CardHeader
                title="🚀 Sequential Batch Importer"
                description="Scan and import a series of new sequential movie releases"
              />
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label hint="Starting numeric ID">Start ID</Label>
                    <Input
                      type="number"
                      value={imdb3BatchStart}
                      onChange={(e) => setImdb3BatchStart(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label hint="Number of IDs to scan">Count</Label>
                    <Input
                      type="number"
                      min={1}
                      max={25}
                      value={imdb3BatchCount}
                      onChange={(e) => setImdb3BatchCount(e.target.value)}
                    />
                  </div>
                </div>
                <Button
                  variant="success"
                  onClick={() =>
                    importImdb3BatchMutation.mutate({
                      startId: Number(imdb3BatchStart),
                      count: Number(imdb3BatchCount),
                    })
                  }
                  disabled={importImdb3BatchMutation.isPending}
                  className="w-full"
                >
                  {importImdb3BatchMutation.isPending ? 'Scanning Batch...' : '🚀 Scan & Import Batch Range'}
                </Button>
              </div>
            </Card>
          </div>

          {/* Latest IMDB3 Result Inspector */}
          {imdb3Result && (
            <Card>
              <CardHeader title="Latest Import Result" description="Status and stream payload for recently processed movie" />
              <div className="rounded-xl border border-slate-700/80 bg-slate-900/90 p-4 font-mono text-xs text-slate-200 overflow-x-auto max-h-80">
                <pre>{JSON.stringify(imdb3Result, null, 2)}</pre>
              </div>
            </Card>
          )}
        </div>
      )}

      {activeTab === 'browser' && (
        <BrowserUrduboxSync
          maxPages={form.maxPagesPerRun}
          resultsPerPage={form.resultsPerPage}
          onComplete={() => {
            queryClient.invalidateQueries({ queryKey: ['sync-jobs'] });
            queryClient.invalidateQueries({ queryKey: ['sync-status'] });
            setActiveTab('jobs');
          }}
        />
      )}

      {activeTab === 'jobs' && (
        <Card padding="none">
          <div className="flex items-center justify-between gap-4 border-b border-slate-700/60 px-5 py-4">
            <div>
              <h2 className="font-semibold text-white">Sync Jobs</h2>
              <p className="text-sm text-slate-500">Click a job to view detailed logs</p>
            </div>
            {isSyncRunning && (
              <Button variant="danger" size="sm" icon={<IconStop className="h-3.5 w-3.5" />} onClick={() => stopMutation.mutate(undefined)} disabled={stopping}>
                Stop All
              </Button>
            )}
          </div>
          {jobsLoading ? (
            <LoadingState label="Loading jobs..." />
          ) : !jobsData?.data?.length ? (
            <p className="p-8 text-center text-slate-500">No sync jobs yet. Run a sync to get started.</p>
          ) : (
            <div className="divide-y divide-slate-700/50">
              {jobsData.data.map((job) => (
                <div key={job.id} className={job.status === 'RUNNING' ? 'bg-amber-500/5' : ''}>
                  <div className="flex items-center gap-2 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setExpandedJobId(expandedJobId === job.id ? null : job.id)}
                      className="flex min-w-0 flex-1 items-center justify-between text-left"
                    >
                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        <span className="font-medium text-slate-200">{job.source}</span>
                        <Badge variant={jobStatusVariant(job.status)}>{job.status}</Badge>
                        <span className="text-emerald-400">+{job.imported}</span>
                        <span className="text-amber-400/80">skip {job.skipped}</span>
                        <span className="text-red-400/80">fail {job.failed}</span>
                      </div>
                      <span className="ml-4 shrink-0 text-xs text-slate-500">
                        {job.startedAt ? new Date(job.startedAt).toLocaleString() : new Date(job.createdAt).toLocaleString()}
                      </span>
                    </button>
                    {job.status === 'RUNNING' && (
                      <Button
                        variant="danger"
                        size="sm"
                        icon={<IconStop className="h-3.5 w-3.5" />}
                        onClick={(e) => {
                          e.stopPropagation();
                          stopMutation.mutate(job.id);
                        }}
                        disabled={stopping}
                        aria-label="Stop job"
                      />
                    )}
                  </div>
                  {job.errorMessage && (
                    <p className="px-4 pb-2 text-xs text-orange-300">{job.errorMessage}</p>
                  )}
                  {expandedJobId === job.id && <JobLogs jobId={job.id} />}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
