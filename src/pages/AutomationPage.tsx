import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatsCard } from '../components/ui/StatsCard';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Tabs } from '../components/ui/Tabs';
import { LoadingState } from '../components/ui/EmptyState';
import { IconFilm, IconSync, IconTv } from '../components/ui/icons';

type SyncTab = 'movies' | 'series' | 'anime' | 'all';
type ContentType = 'MOVIES' | 'SERIES' | 'ALL';

const PLATFORM_PRESETS = [
  { id: 'trending', label: 'Trending' },
  { id: 'netflix', label: 'Netflix' },
  { id: 'prime', label: 'Prime' },
  { id: 'hulu', label: 'Hulu' },
  { id: 'disney', label: 'Disney+' },
  { id: 'bollywood', label: 'Bollywood' },
  { id: 'hollywood', label: 'Hollywood' },
  { id: 'anime', label: 'Anime' },
];

const TAB_CONFIG: Record<
  SyncTab,
  {
    label: string;
    contentType: ContentType;
    defaultPresets: string[];
    allowedPresets: string[];
    description: string;
    statKey: 'totalMovies' | 'totalSeries' | 'totalAnime' | null;
  }
> = {
  movies: {
    label: 'Movies',
    contentType: 'MOVIES',
    defaultPresets: ['trending', 'hollywood', 'bollywood', 'netflix'],
    allowedPresets: ['trending', 'netflix', 'prime', 'hulu', 'disney', 'bollywood', 'hollywood'],
    description: 'Movies only — Bollywood, Hollywood, Netflix, Prime, etc.',
    statKey: 'totalMovies',
  },
  series: {
    label: 'Web Series',
    contentType: 'SERIES',
    defaultPresets: ['trending', 'netflix', 'prime', 'hulu'],
    allowedPresets: ['trending', 'netflix', 'prime', 'hulu', 'disney', 'hollywood'],
    description: 'Web series & TV shows for website (non-anime).',
    statKey: 'totalSeries',
  },
  anime: {
    label: 'Anime',
    contentType: 'SERIES',
    defaultPresets: ['anime'],
    allowedPresets: ['anime'],
    description: 'Anime only — auto-detect + AllManga playback.',
    statKey: 'totalAnime',
  },
  all: {
    label: 'Sync All',
    contentType: 'ALL',
    defaultPresets: ['trending', 'anime', 'hollywood', 'bollywood'],
    allowedPresets: PLATFORM_PRESETS.map((p) => p.id),
    description: 'Movies + Web Series + Anime ek sath.',
    statKey: null,
  },
};

interface AutomationStats {
  totalMovies: number;
  totalSeries: number;
  totalAnime: number;
  workingCount: number;
  brokenCount: number;
  pendingCount: number;
  lastSyncAt: string | null;
  byPreset: Record<string, number>;
}

interface SyncJob {
  id: string;
  status: string;
  imported: number;
  skipped: number;
  failed: number;
  startedAt: string | null;
  completedAt: string | null;
}

export function AutomationPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<SyncTab>('movies');
  const [presetSelections, setPresetSelections] = useState<Record<SyncTab, string[]>>({
    movies: TAB_CONFIG.movies.defaultPresets,
    series: TAB_CONFIG.series.defaultPresets,
    anime: TAB_CONFIG.anime.defaultPresets,
    all: TAB_CONFIG.all.defaultPresets,
  });
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const tab = TAB_CONFIG[activeTab];
  const selectedPresets = presetSelections[activeTab];
  const visiblePresets = PLATFORM_PRESETS.filter((p) => tab.allowedPresets.includes(p.id));

  const { data: stats, isLoading } = useQuery({
    queryKey: ['automation-stats'],
    queryFn: async () => {
      const { data } = await api.get<AutomationStats>('/admin/automation/stats');
      return data;
    },
    refetchInterval: activeJobId ? 5000 : 30000,
  });

  const { data: job } = useQuery({
    queryKey: ['sync-job', activeJobId],
    queryFn: async () => {
      const { data } = await api.get<SyncJob>(`/admin/sync/jobs/${activeJobId}`);
      return data;
    },
    enabled: Boolean(activeJobId),
    refetchInterval: (q) => (q.state.data?.status === 'RUNNING' ? 3000 : false),
  });

  useEffect(() => {
    if (job && job.status !== 'RUNNING') {
      queryClient.invalidateQueries({ queryKey: ['automation-stats'] });
      queryClient.invalidateQueries({ queryKey: ['content-library'] });
      queryClient.invalidateQueries({ queryKey: ['admin-movies'] });
      queryClient.invalidateQueries({ queryKey: ['series'] });
    }
  }, [job?.status, queryClient]);

  const runMutation = useMutation({
    mutationFn: (payload: { presets: string[]; contentType: ContentType }) =>
      api.post('/admin/automation/run-full', {
        presets: payload.presets,
        skipBroken: true,
        contentType: payload.contentType,
      }),
    onSuccess: (res) => {
      const jobId = res.data?.jobId;
      if (jobId) setActiveJobId(jobId);
      setMessage({
        type: res.data?.started ? 'success' : 'error',
        text: res.data?.started
          ? `${tab.label} sync started.`
          : res.data?.message || 'Could not start sync.',
      });
      queryClient.invalidateQueries({ queryKey: ['sync-jobs'] });
    },
    onError: () => setMessage({ type: 'error', text: 'Failed to start sync.' }),
  });

  const togglePreset = (id: string) => {
    setPresetSelections((prev) => {
      const current = prev[activeTab];
      const next = current.includes(id) ? current.filter((p) => p !== id) : [...current, id];
      return { ...prev, [activeTab]: next };
    });
  };

  const tabBadges = useMemo(
    () => ({
      movies: stats?.totalMovies ?? 0,
      series: stats?.totalSeries ?? 0,
      anime: stats?.totalAnime ?? 0,
      all: (stats?.totalMovies ?? 0) + (stats?.totalSeries ?? 0) + (stats?.totalAnime ?? 0),
    }),
    [stats],
  );

  if (isLoading && !stats) return <LoadingState label="Loading automation stats..." />;

  const isRunning = job?.status === 'RUNNING';

  const tabs = [
    { id: 'movies', label: '🎬 Movies', badge: tabBadges.movies },
    { id: 'series', label: '📺 Web Series', badge: tabBadges.series },
    { id: 'anime', label: '⛩️ Anime', badge: tabBadges.anime },
    { id: 'all', label: '🌟 Sync All', badge: tabBadges.all },
  ];

  const tabStatValue = tab.statKey ? stats?.[tab.statKey] ?? 0 : null;

  return (
    <div>
      <PageHeader
        title="Content Sync"
        description="Alag tabs se Movies, Web Series, aur Anime sync karo — website par alag alag dikhega."
      />

      {message && <Alert variant={message.type === 'success' ? 'success' : 'error'}>{message.text}</Alert>}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatsCard label="Movies" value={stats?.totalMovies ?? 0} icon={<IconFilm className="h-5 w-5" />} accent="red" />
        <StatsCard label="Web Series" value={stats?.totalSeries ?? 0} icon={<IconTv className="h-5 w-5" />} accent="sky" />
        <StatsCard label="Anime" value={stats?.totalAnime ?? 0} icon={<IconTv className="h-5 w-5" />} accent="amber" />
        <StatsCard label="Working" value={stats?.workingCount ?? 0} accent="emerald" />
      </div>

      <Tabs
        tabs={tabs}
        active={activeTab}
        onChange={(id) => {
          setActiveTab(id as SyncTab);
          setMessage(null);
        }}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={`Sync ${tab.label}`}
            description={tab.description}
          />
          {tabStatValue !== null && (
            <p className="mb-4 text-sm text-slate-400">
              Database mein abhi: <span className="font-semibold text-white">{tabStatValue}</span> {tab.label.toLowerCase()}
            </p>
          )}

          {activeTab !== 'anime' && (
            <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {visiblePresets.map((preset) => {
                const checked = selectedPresets.includes(preset.id);
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => togglePreset(preset.id)}
                    className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                      checked
                        ? 'border-red-500/60 bg-red-500/15 text-red-200'
                        : 'border-slate-700 bg-slate-900/60 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          )}

          {activeTab === 'anime' && (
            <div className="mb-5 rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-3 text-sm text-purple-200">
              Anime sync TMDB Japanese animation + AllManga resolver use karta hai. Platform preset ki zaroorat nahi.
            </div>
          )}

          <Button
            variant="success"
            icon={<IconSync className="h-4 w-4" />}
            onClick={() =>
              runMutation.mutate({
                presets: selectedPresets,
                contentType: tab.contentType,
              })
            }
            disabled={runMutation.isPending || isRunning || selectedPresets.length === 0}
            className="w-full text-base py-3"
          >
            {runMutation.isPending || isRunning ? 'Syncing...' : `Sync ${tab.label}`}
          </Button>

          {isRunning && job && (
            <div className="mt-5 space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-amber-200">{tab.label} sync in progress</span>
                <Badge variant="warning">RUNNING</Badge>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full w-1/3 animate-pulse rounded-full bg-amber-400" />
              </div>
              <p className="text-xs text-amber-200/80">
                Imported {job.imported} · Skipped {job.skipped} · Failed {job.failed}
              </p>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Playback Health" description="Working vs broken across all content" />
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-emerald-500/10 px-3 py-2.5">
              <span className="text-sm text-emerald-300">Working (chal rahi)</span>
              <span className="font-bold text-emerald-400">{stats?.workingCount ?? 0}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-red-500/10 px-3 py-2.5">
              <span className="text-sm text-red-300">Broken (chal nahi)</span>
              <span className="font-bold text-red-400">{stats?.brokenCount ?? 0}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-amber-500/10 px-3 py-2.5">
              <span className="text-sm text-amber-300">Pending verify</span>
              <span className="font-bold text-amber-400">{stats?.pendingCount ?? 0}</span>
            </div>
            <p className="text-xs text-slate-500 pt-1">
              Last sync: {stats?.lastSyncAt ? new Date(stats.lastSyncAt).toLocaleString() : 'Never'}
            </p>
          </div>

          {Object.keys(stats?.byPreset ?? {}).length > 0 && (
            <div className="mt-6 border-t border-slate-700/60 pt-4">
              <p className="mb-2 text-xs font-semibold uppercase text-slate-500">By platform preset</p>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {Object.entries(stats?.byPreset ?? {}).map(([preset, count]) => (
                  <div key={preset} className="flex items-center justify-between text-sm">
                    <span className="capitalize text-slate-400">{preset}</span>
                    <span className="text-slate-200">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
