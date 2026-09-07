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

type SyncSource = 'ALL' | 'URDBOX' | 'MOVIESAPI';
type SyncTab = 'settings' | 'run' | 'browser' | 'jobs';

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
  runningJobs?: SyncJob[];
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

export function SyncPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<SyncSettings | null>(null);
  const [runSource, setRunSource] = useState<SyncSource>('ALL');
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<SyncTab>('settings');

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
    refetchInterval: 3000,
  });

  const { data: jobsData, isLoading: jobsLoading } = useQuery({
    queryKey: ['sync-jobs'],
    queryFn: async () => {
      const { data } = await api.get<{ data: SyncJob[]; page: number; totalPages: number }>('/admin/sync/jobs');
      return data;
    },
    refetchInterval: (query) => {
      const hasRunning = (query.state.data?.data ?? []).some((job) => job.status === 'RUNNING');
      return hasRunning ? 2000 : 10000;
    },
  });

  if (isLoading || !form) return <LoadingState label="Loading sync settings..." />;

  const runningJobs = jobsData?.data?.filter((job) => job.status === 'RUNNING') ?? [];
  const isSyncRunning = Boolean(syncStatus?.running || runningJobs.length > 0);
  const stopping = Boolean(syncStatus?.cancelRequested || stopMutation.isPending || stopAutomationMutation.isPending);
  const jobCount = jobsData?.data?.length ?? 0;

  const tabs = [
    { id: 'settings', label: 'Settings' },
    { id: 'run', label: 'Run Sync', badge: isSyncRunning ? '●' : undefined },
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
          <Card>
            <CardHeader title="Sources" description="Enable or disable content providers" />
            <div className="space-y-3">
              <Switch
                label="Urdubox"
                description="Import movies and series from Urdubox"
                checked={form.urduboxEnabled}
                onChange={(v) => setForm({ ...form, urduboxEnabled: v })}
              />
              <Switch
                label="MoviesAPI"
                description="Import movies and series from MoviesAPI"
                checked={form.moviesApiEnabled}
                onChange={(v) => setForm({ ...form, moviesApiEnabled: v })}
              />
              <Switch
                label="Automation"
                description="Run scheduled sync hourly within schedule window"
                checked={form.automationEnabled}
                onChange={(v) => setForm({ ...form, automationEnabled: v })}
              />
            </div>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader title="Schedule Window" description="Leave empty for 24/7 automation" />
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
              <CardHeader title="Sync Limits" description="Pages and items per sync run" />
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
