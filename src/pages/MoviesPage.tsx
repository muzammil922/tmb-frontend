import { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input, Label } from '../components/ui/Input';
import { EmptyState, LoadingState } from '../components/ui/EmptyState';
import {
  IconPlus,
  IconSearch,
  IconFilm,
  IconClose,
  IconExternalLink,
  IconChevron,
  IconChevronLeft,
  IconSync,
} from '../components/ui/icons';
import { Alert } from '../components/ui/Alert';
import { getTmdbImageUrl, formatUploadDate, type Movie } from '../lib/shared';

type FilterType =
  | 'all'
  | 'live'
  | 'draft'
  | 'featured'
  | 'moviesapi'
  | 'tmdb'
  | 'manual'
  | 'working'
  | 'broken'
  | 'pending'
  | 'playable'
  | 'no-stream';

type PlaybackInfo = {
  playable: boolean;
  label: string;
  variant: 'success' | 'danger' | 'warning' | 'info' | 'default';
  reason: string;
  fix: string;
};

function getEffectiveSource(movie: Movie) {
  if (movie.playbackMode === 'EMBED' || movie.contentSource === 'MOVIESAPI') {
    return { label: 'MOVIESAPI', variant: 'info' as const };
  }
  if (movie.source === 'MANUAL') {
    return { label: 'MANUAL', variant: 'warning' as const };
  }
  return { label: movie.source || 'TMDB', variant: 'default' as const };
}

function getPlaybackInfo(movie: Movie): PlaybackInfo {
  if (movie.playbackStatus === 'WORKING') {
    const via = movie.videoUrl
      ? 'Direct MP4/HLS'
      : movie.contentSource === 'IMDB3'
      ? 'IMDB3 / MovieBox'
      : movie.contentSource === 'MOVIESAPI'
      ? 'MoviesAPI Embed'
      : 'Multi-server embed';
    return {
      playable: true,
      label: 'Chal Rahi Hai',
      variant: 'success',
      reason: `Verified working — ${via}`,
      fix: '',
    };
  }

  if (movie.playbackStatus === 'BROKEN') {
    const { reason, fix } = getBrokenReasonAndFix(movie);
    return { playable: false, label: 'Broken', variant: 'danger', reason, fix };
  }

  if (movie.playbackStatus === 'PENDING') {
    return {
      playable: false,
      label: 'Pending',
      variant: 'warning',
      reason: 'Abhi playback verify nahi hui',
      fix: 'Automation sync chalao ya Content Library → Recheck',
    };
  }

  if (movie.videoUrl) {
    const isHls = movie.videoUrl.includes('.m3u8');
    return {
      playable: true,
      label: isHls ? 'HLS Direct' : 'Direct Video',
      variant: 'success',
      reason: 'Direct video link attached (not yet verified)',
      fix: '',
    };
  }

  if (!movie.tmdbId && movie.source === 'MANUAL') {
    return {
      playable: false,
      label: 'No Stream',
      variant: 'danger',
      reason: 'Sirf metadata hai — TMDB ID aur stream source missing',
      fix: 'Import Content se TMDB ID se import karo (MoviesAPI/IMDB3)',
    };
  }

  if (!movie.tmdbId) {
    return {
      playable: false,
      label: 'No Stream',
      variant: 'danger',
      reason: 'TMDB ID missing — player embed nahi mil sakta',
      fix: 'Content → Import se sahi TMDB ID se dubara import karo',
    };
  }

  if (movie.playbackMode === 'EMBED' || movie.contentSource === 'MOVIESAPI') {
    return {
      playable: false,
      label: 'Unverified',
      variant: 'warning',
      reason: 'MoviesAPI embed set hai lekin verify pending',
      fix: 'Content Library → Recheck broken, ya Automation sync chalao',
    };
  }

  return {
    playable: false,
    label: 'No Stream',
    variant: 'danger',
    reason: 'Koi working stream source connect nahi',
    fix: 'IMDB3 import karo (Bollywood) ya Automation → Sync Everything',
  };
}

function getBrokenReasonAndFix(movie: Movie): { reason: string; fix: string } {
  if (!movie.tmdbId && !movie.videoUrl) {
    return {
      reason: 'TMDB ID + video link dono missing',
      fix: 'Import Content page se TMDB ID se import karo',
    };
  }
  if (movie.contentSource === 'IMDB3' || movie.playbackMode === 'HOSTED') {
    return {
      reason: 'IMDB3 / direct MP4 link dead ya upstream par nahi',
      fix: 'IMDB3 tab se dubara import karo ya daily auto-sync ON karo',
    };
  }
  if (movie.contentSource === 'MOVIESAPI' || movie.playbackMode === 'EMBED') {
    return {
      reason: 'MoviesAPI embed upstream par ye title available nahi',
      fix: 'Content Library → Delete broken, phir Automation sync',
    };
  }
  return {
    reason: 'Playback probe fail — embed resolve nahi hua',
    fix: 'Recheck karo; phir bhi fail → delete karo',
  };
}

function toServerPlaybackFilter(filter: FilterType): string | undefined {
  if (filter === 'working' || filter === 'playable') return 'WORKING';
  if (filter === 'broken' || filter === 'no-stream') return 'not-working';
  if (filter === 'pending') return 'PENDING';
  return undefined;
}

export function MoviesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedPoster, setSelectedPoster] = useState<{
    title: string;
    posterUrl: string;
    backdropUrl?: string | null;
    uploadDate?: string;
  } | null>(null);

  const queryClient = useQueryClient();
  const [repairMessage, setRepairMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [repairJobId, setRepairJobId] = useState<string | null>(null);

  const serverPlayback = toServerPlaybackFilter(filter);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-movies', search, page, serverPlayback],
    queryFn: async () => {
      const params: Record<string, string | number> = { search, page, limit: 50 };
      if (serverPlayback) params.playbackStatus = serverPlayback;
      const { data } = await api.get('/admin/movies', { params });
      return data;
    },
  });

  const { data: repairCount } = useQuery({
    queryKey: ['repair-count', 'MOVIES'],
    queryFn: async () => {
      const { data } = await api.get<{ total: number }>('/admin/automation/repair-count?contentType=MOVIES');
      return data;
    },
    refetchInterval: repairJobId ? 5000 : 30000,
  });

  const { data: repairJob } = useQuery({
    queryKey: ['sync-job', repairJobId],
    queryFn: async () => {
      const { data } = await api.get(`/admin/sync/jobs/${repairJobId}`);
      return data;
    },
    enabled: Boolean(repairJobId),
    refetchInterval: (q) => (q.state.data?.status === 'RUNNING' ? 3000 : false),
  });

  const repairMutation = useMutation({
    mutationFn: () => api.post('/admin/automation/repair-broken', { contentType: 'MOVIES' }),
    onSuccess: (res) => {
      if (res.data?.jobId) setRepairJobId(res.data.jobId);
      setRepairMessage({
        type: res.data?.started ? 'success' : 'error',
        text: res.data?.started
          ? `Fix Broken started — ${res.data.total} movies (sirf broken/pending).`
          : res.data?.message || 'Repair start nahi ho saki.',
      });
      queryClient.invalidateQueries({ queryKey: ['admin-movies'] });
      queryClient.invalidateQueries({ queryKey: ['repair-count'] });
    },
    onError: () => setRepairMessage({ type: 'error', text: 'Repair start nahi ho saki.' }),
  });

  useEffect(() => {
    if (repairJob && repairJob.status !== 'RUNNING') {
      queryClient.invalidateQueries({ queryKey: ['admin-movies'] });
      queryClient.invalidateQueries({ queryKey: ['repair-count'] });
      queryClient.invalidateQueries({ queryKey: ['automation-stats'] });
    }
  }, [repairJob?.status, queryClient]);

  const playbackStats = data?.stats ?? {
    workingCount: 0,
    brokenCount: 0,
    pendingCount: 0,
    notWorkingCount: 0,
  };

  const { data: categoriesData } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: async () => {
      const { data } = await api.get('/admin/categories');
      return data;
    },
  });

  const categoriesList: { id: string; name: string; slug: string }[] = Array.isArray(categoriesData)
    ? categoriesData
    : (categoriesData as any)?.data || [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/movies/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-movies'] }),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ACTIVE' | 'DRAFT' }) =>
      api.patch(`/admin/movies/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-movies'] }),
  });

  const toggleFeaturedMutation = useMutation({
    mutationFn: ({ id, featured }: { id: string; featured: boolean }) =>
      api.patch(`/admin/movies/${id}`, { featured }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-movies'] }),
  });

  const rawMovies: Movie[] = data?.data ?? [];
  const total = data?.totalResults ?? rawMovies.length;
  const totalPages = data?.totalPages ?? 1;

  // Filter movies based on the selected filter chip
  const filteredMovies = useMemo(() => {
    return rawMovies.filter((movie) => {
      if (filter === 'live') return movie.status === 'ACTIVE';
      if (filter === 'draft') return movie.status === 'DRAFT';
      if (filter === 'featured') return Boolean(movie.featured);
      if (filter === 'moviesapi') {
        return (
          movie.contentSource === 'MOVIESAPI' ||
          movie.playbackMode === 'EMBED'
        );
      }
      if (filter === 'tmdb') {
        return (
          movie.source === 'TMDB' &&
          movie.contentSource !== 'MOVIESAPI' &&
          movie.playbackMode !== 'EMBED'
        );
      }
      if (filter === 'manual') return movie.source === 'MANUAL';
      if (filter === 'working' || filter === 'playable') return getPlaybackInfo(movie).playable;
      if (filter === 'broken' || filter === 'no-stream') {
        return movie.playbackStatus === 'BROKEN' || !getPlaybackInfo(movie).playable;
      }
      if (filter === 'pending') return movie.playbackStatus === 'PENDING';

      if (selectedCategory !== 'all') {
        const matchesCat =
          movie.categoryMovies?.some(
            (cm) => cm.category.slug === selectedCategory || cm.category.id === selectedCategory,
          ) ||
          movie.genres?.some((g) =>
            g.name.toLowerCase().includes(selectedCategory.toLowerCase()),
          );
        if (!matchesCat) return false;
      }

      return true;
    });
  }, [rawMovies, filter, selectedCategory]);

  // Counts for filters
  const counts = useMemo(() => {
    let live = 0;
    let draft = 0;
    let featured = 0;
    let moviesApi = 0;
    let tmdb = 0;
    let manual = 0;
    let working = 0;
    let broken = 0;
    let pending = 0;
    for (const m of rawMovies) {
      if (m.status === 'ACTIVE') live++;
      if (m.status === 'DRAFT') draft++;
      if (m.featured) featured++;
      if (m.contentSource === 'MOVIESAPI' || m.playbackMode === 'EMBED') {
        moviesApi++;
      } else if (m.source === 'MANUAL') {
        manual++;
      } else {
        tmdb++;
      }
      const s = getPlaybackInfo(m);
      if (m.playbackStatus === 'WORKING' || s.playable) working++;
      else if (m.playbackStatus === 'BROKEN') broken++;
      else if (m.playbackStatus === 'PENDING') pending++;
      else if (!s.playable) broken++;
      else pending++;
    }
    return {
      live,
      draft,
      featured,
      moviesApi,
      tmdb,
      manual,
      working,
      broken,
      pending,
      playable: working,
      noStream: broken,
    };
  }, [rawMovies]);

  return (
    <div>
      <PageHeader
        title="Movies"
        description="Search, view posters, upload dates, verify stream playback, and manage all movies on your platform."
        actions={
          <Link to="/movies/new">
            <Button icon={<IconPlus className="h-4 w-4" />}>Add Movie</Button>
          </Link>
        }
      />

      {/* Playback stats — full database counts */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => { setFilter('working'); setPage(1); }}
          className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-left transition hover:bg-emerald-500/15"
        >
          <p className="text-xs font-semibold uppercase text-emerald-400">Chal Rahi Hai</p>
          <p className="mt-1 text-2xl font-bold text-white">{playbackStats.workingCount}</p>
        </button>
        <button
          type="button"
          onClick={() => { setFilter('broken'); setPage(1); }}
          className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-left transition hover:bg-red-500/15"
        >
          <p className="text-xs font-semibold uppercase text-red-400">Chal Nahi Rahi</p>
          <p className="mt-1 text-2xl font-bold text-white">{playbackStats.notWorkingCount}</p>
        </button>
        <button
          type="button"
          onClick={() => { setFilter('pending'); setPage(1); }}
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-left transition hover:bg-amber-500/15"
        >
          <p className="text-xs font-semibold uppercase text-amber-400">Verify Pending</p>
          <p className="mt-1 text-2xl font-bold text-white">{playbackStats.pendingCount}</p>
        </button>
      </div>

      {repairMessage && (
        <Alert variant={repairMessage.type === 'success' ? 'success' : 'error'}>{repairMessage.text}</Alert>
      )}

      {(filter === 'broken' || filter === 'no-stream') && (
        <Card className="mb-6 border-red-500/20 bg-red-950/20">
          <div className="space-y-2 text-sm text-slate-300">
            <p className="font-semibold text-red-300">Broken movies ka kya karein?</p>
            <p className="text-xs text-slate-400">
              <strong className="text-amber-300">Fix Broken Only</strong> sirf broken/pending movies par kaam karta hai —
              working skip. TMDB search + MoviesAPI embed try karta hai.
            </p>
            {repairJob?.status === 'RUNNING' && (
              <p className="text-xs text-amber-300">
                Repairing... Fixed {repairJob.imported} · Still broken {repairJob.skipped} · Failed {repairJob.failed}
              </p>
            )}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                size="sm"
                variant="success"
                icon={<IconSync className="h-4 w-4" />}
                onClick={() => repairMutation.mutate()}
                disabled={repairMutation.isPending || repairJob?.status === 'RUNNING' || !repairCount?.total}
              >
                {repairMutation.isPending || repairJob?.status === 'RUNNING'
                  ? 'Fixing...'
                  : `Fix Broken Only (${repairCount?.total ?? playbackStats.notWorkingCount + playbackStats.pendingCount})`}
              </Button>
              <Button size="sm" variant="outline" onClick={() => navigate('/content/library')}>
                Content Library → Delete broken
              </Button>
              <Button size="sm" variant="outline" onClick={() => navigate('/automation')}>
                New content sync
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Filter and Search Bar */}
      <Card className="mb-6" padding="md">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="relative max-w-md flex-1">
              <Label hint="Filter by title">Search movies</Label>
              <div className="relative">
                <IconSearch className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Type movie title..."
                  className="pl-10"
                />
              </div>
            </div>

            <p className="text-sm text-slate-400">
              Showing <span className="font-semibold text-slate-200">{filteredMovies.length}</span> of{' '}
              <span className="font-semibold text-slate-200">{total}</span> total movies
            </p>
          </div>

          {/* Quick Filter Chips */}
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-800/80 pt-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 mr-1">
              Filter:
            </span>

            {/* All */}
            <button
              onClick={() => setFilter('all')}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                filter === 'all'
                  ? 'bg-red-500/25 text-red-300 ring-1 ring-red-500/50 shadow-sm'
                  : 'bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              All ({rawMovies.length})
            </button>

            {/* Live on Web */}
            <button
              onClick={() => setFilter('live')}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
                filter === 'live'
                  ? 'bg-emerald-500/25 text-emerald-300 ring-1 ring-emerald-500/50 shadow-sm'
                  : 'bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
              Live on Web ({counts.live})
            </button>

            {/* Draft */}
            <button
              onClick={() => setFilter('draft')}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
                filter === 'draft'
                  ? 'bg-amber-500/25 text-amber-300 ring-1 ring-amber-500/50 shadow-sm'
                  : 'bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400"></span>
              Draft ({counts.draft})
            </button>

            {/* Featured */}
            <button
              onClick={() => setFilter('featured')}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
                filter === 'featured'
                  ? 'bg-yellow-500/25 text-yellow-300 ring-1 ring-yellow-500/50 shadow-sm'
                  : 'bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <span>⭐</span>
              Featured ({counts.featured})
            </button>

            <span className="h-4 w-px bg-slate-800 mx-1 hidden sm:inline-block"></span>

            {/* MoviesAPI */}
            <button
              onClick={() => setFilter('moviesapi')}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
                filter === 'moviesapi'
                  ? 'bg-sky-500/25 text-sky-300 ring-1 ring-sky-500/50 shadow-sm'
                  : 'bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400"></span>
              MoviesAPI ({counts.moviesApi})
            </button>

            {/* TMDB */}
            <button
              onClick={() => setFilter('tmdb')}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
                filter === 'tmdb'
                  ? 'bg-slate-700 text-slate-100 ring-1 ring-slate-500 shadow-sm'
                  : 'bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              TMDB ({counts.tmdb})
            </button>

            {/* Manual */}
            <button
              onClick={() => setFilter('manual')}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
                filter === 'manual'
                  ? 'bg-orange-500/25 text-orange-300 ring-1 ring-orange-500/50 shadow-sm'
                  : 'bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              Manual ({counts.manual})
            </button>

            <span className="h-4 w-px bg-slate-800 mx-1 hidden sm:inline-block"></span>

            <button
              onClick={() => { setFilter('working'); setPage(1); }}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
                filter === 'working' || filter === 'playable'
                  ? 'bg-emerald-500/25 text-emerald-300 ring-1 ring-emerald-500/50 shadow-sm'
                  : 'bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
              Chal Rahi ({playbackStats.workingCount})
            </button>

            <button
              onClick={() => { setFilter('broken'); setPage(1); }}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
                filter === 'broken' || filter === 'no-stream'
                  ? 'bg-red-500/25 text-red-300 ring-1 ring-red-500/50 shadow-sm'
                  : 'bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-red-400"></span>
              Chal Nahi Rahi ({playbackStats.notWorkingCount})
            </button>

            <button
              onClick={() => { setFilter('pending'); setPage(1); }}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
                filter === 'pending'
                  ? 'bg-amber-500/25 text-amber-300 ring-1 ring-amber-500/50 shadow-sm'
                  : 'bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400"></span>
              Pending ({playbackStats.pendingCount})
            </button>

            {/* Category Filter Selector */}
            {categoriesList.length > 0 && (
              <div className="flex items-center gap-2 sm:ml-auto">
                <span className="text-xs font-semibold text-slate-400 whitespace-nowrap">Category:</span>
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    setPage(1);
                  }}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-medium text-slate-200 focus:border-red-500 focus:outline-none"
                >
                  <option value="all">All Categories ({rawMovies.length})</option>
                  {categoriesList.map((cat) => (
                    <option key={cat.id} value={cat.slug}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </Card>

      {isLoading ? (
        <LoadingState label="Loading movies..." />
      ) : !filteredMovies.length ? (
        <Card>
          <EmptyState
            title="No movies found"
            description={
              search || filter !== 'all'
                ? 'Try changing your search term or filter.'
                : 'Add your first movie to get started.'
            }
            action={
              <Link to="/movies/new">
                <Button icon={<IconPlus className="h-4 w-4" />}>Add Movie</Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-700/80 bg-slate-900/60 text-xs uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3.5 font-semibold text-center w-16">Poster</th>
                  <th className="px-5 py-3.5 font-semibold">Title & Details</th>
                  <th className="px-4 py-3.5 font-semibold">Category</th>
                  <th className="px-5 py-3.5 font-semibold">Website Live Status</th>
                  <th className="px-5 py-3.5 font-semibold">Stream Status</th>
                  <th className="px-4 py-3.5 font-semibold text-center">Featured</th>
                  <th className="px-5 py-3.5 font-semibold">Upload Date</th>
                  <th className="px-4 py-3.5 font-semibold">Source</th>
                  <th className="px-5 py-3.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {filteredMovies.map((movie) => {
                  const posterUrl = getTmdbImageUrl(movie.posterPath, 'w185');
                  const fullPosterUrl = getTmdbImageUrl(movie.posterPath, 'original');
                  const backdropUrl = getTmdbImageUrl(movie.backdropPath, 'w780');
                  const uploadDateFormatted = formatUploadDate(movie.createdAt || movie.releaseDate);
                  const stream = getPlaybackInfo(movie);
                  const effectiveSource = getEffectiveSource(movie);
                  const isLive = movie.status === 'ACTIVE';

                  return (
                    <tr key={movie.id} className="transition hover:bg-slate-900/40">
                      {/* Movie Poster Preview */}
                      <td className="px-4 py-3.5 text-center">
                        <div
                          className="group relative mx-auto h-16 w-11 flex-shrink-0 cursor-pointer overflow-hidden rounded-md border border-slate-700/80 bg-slate-800 shadow-md transition-all duration-200 hover:ring-2 hover:ring-red-500/60 hover:scale-105"
                          title="Click to view full poster"
                          onClick={() => {
                            if (fullPosterUrl || posterUrl) {
                              setSelectedPoster({
                                title: movie.title,
                                posterUrl: fullPosterUrl || posterUrl || '',
                                backdropUrl,
                                uploadDate: uploadDateFormatted,
                              });
                            }
                          }}
                        >
                          {posterUrl ? (
                            <img
                              src={posterUrl}
                              alt={movie.title}
                              className="h-full w-full object-cover"
                              loading="lazy"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="flex h-full w-full flex-col items-center justify-center bg-slate-800/90 p-1 text-center text-slate-500">
                              <IconFilm className="h-4 w-4" />
                              <span className="mt-1 text-[8px] leading-tight text-slate-400">No Pic</span>
                            </div>
                          )}
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                            <span className="text-[10px] font-semibold text-white">View</span>
                          </div>
                        </div>
                      </td>

                      {/* Title & Metadata */}
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col">
                          <Link
                            to={`/movies/${movie.id}/edit`}
                            className="font-medium text-slate-100 hover:text-red-400 transition hover:underline"
                          >
                            {movie.title}
                          </Link>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                            {movie.releaseDate && (
                              <span>{new Date(movie.releaseDate).getFullYear()}</span>
                            )}
                            {movie.language && (
                              <span className="uppercase text-slate-500 font-mono text-[10px] bg-slate-800 px-1 rounded">
                                {movie.language}
                              </span>
                            )}
                            {movie.tmdbId && (
                              <span className="text-[10px] text-slate-500">
                                TMDB #{movie.tmdbId}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Movie Categories */}
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {movie.categoryMovies && movie.categoryMovies.length > 0 ? (
                            movie.categoryMovies.map((cm) => (
                              <span
                                key={cm.category.id}
                                className="inline-flex items-center rounded-md bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300 shadow-sm"
                                title={cm.category.name}
                              >
                                {cm.category.name.replace(/^[^\w\s]+/, '').trim()}
                              </span>
                            ))
                          ) : movie.genres && movie.genres.length > 0 ? (
                            movie.genres.slice(0, 2).map((g) => (
                              <span
                                key={g.id}
                                className="inline-flex items-center rounded-md bg-slate-800 border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-300"
                              >
                                {g.name}
                              </span>
                            ))
                          ) : (
                            <span className="text-[11px] text-slate-500 italic">No category</span>
                          )}
                        </div>
                      </td>

                      {/* Website Live Status (Interactive 1-Click Toggle) */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() =>
                            toggleStatusMutation.mutate({
                              id: movie.id,
                              status: isLive ? 'DRAFT' : 'ACTIVE',
                            })
                          }
                          disabled={toggleStatusMutation.isPending}
                          title={
                            isLive
                              ? 'Click to unpublish (Make Draft)'
                              : 'Click to publish (Make Live on website)'
                          }
                          className="group inline-flex items-center gap-2 rounded-full border border-transparent p-0.5 transition focus:outline-none"
                        >
                          {isLive ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/30 transition group-hover:bg-emerald-500/25 group-hover:ring-emerald-400">
                              <span className="relative flex h-2 w-2">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                              </span>
                              Live on Web
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-amber-300 ring-1 ring-amber-500/30 transition group-hover:bg-amber-500/15 group-hover:ring-amber-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-400"></span>
                              Draft (Hidden)
                            </span>
                          )}
                        </button>
                      </td>

                      {/* Stream / Playback Status ("Chal Rahi Hai Ya Nahi") */}
                      <td className="px-5 py-3.5 max-w-[220px]">
                        <div className="flex flex-col gap-1">
                          <Badge variant={stream.variant}>
                            {stream.playable ? '● ' : '✕ '}{stream.label}
                          </Badge>
                          <span className={`text-[11px] leading-snug ${stream.playable ? 'text-slate-400' : 'text-red-300'}`}>
                            {stream.reason}
                          </span>
                          {stream.fix && (
                            <span className="text-[10px] leading-snug text-amber-400/90">
                              Fix: {stream.fix}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Featured (1-Click Star Toggle) */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-center">
                        <button
                          type="button"
                          onClick={() =>
                            toggleFeaturedMutation.mutate({
                              id: movie.id,
                              featured: !movie.featured,
                            })
                          }
                          disabled={toggleFeaturedMutation.isPending}
                          title={
                            movie.featured
                              ? 'Click to remove from Featured'
                              : 'Click to add to Featured'
                          }
                          className={`inline-flex items-center justify-center rounded-lg p-1.5 transition ${
                            movie.featured
                              ? 'bg-yellow-500/15 text-yellow-400 ring-1 ring-yellow-500/40 hover:bg-yellow-500/25'
                              : 'text-slate-600 hover:bg-slate-800 hover:text-slate-300'
                          }`}
                        >
                          <span className="text-base leading-none">
                            {movie.featured ? '★' : '☆'}
                          </span>
                        </button>
                      </td>

                      {/* Upload Date (DD-MMM-YYYY format e.g. 10-Sep-2026) */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-mono text-sm font-medium text-slate-200">
                            {uploadDateFormatted}
                          </span>
                          {movie.createdAt && (
                            <span className="text-[11px] text-slate-500">
                              {new Date(movie.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Source */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <Badge variant={effectiveSource.variant}>{effectiveSource.label}</Badge>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Open in Website */}
                          <a
                            href={`https://flowlab.fun/movies/${movie.id}`}
                            target="_blank"
                            rel="noreferrer"
                            title="Open on website (flowlab.fun)"
                            className="inline-flex items-center justify-center rounded-lg border border-slate-700/80 bg-slate-800/80 p-2 text-slate-300 transition hover:border-slate-600 hover:bg-slate-700 hover:text-white"
                          >
                            <IconExternalLink className="h-3.5 w-3.5" />
                          </a>

                          <Link to={`/movies/${movie.id}/edit`}>
                            <Button variant="ghost" size="sm">
                              Edit
                            </Button>
                          </Link>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (confirm(`Delete "${movie.title}"?`)) deleteMutation.mutate(movie.id);
                            }}
                            className="!border-red-500/30 !text-red-400 hover:!bg-red-500/10"
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-800 bg-slate-900/60 px-5 py-3">
              <p className="text-xs text-slate-400">
                Page <span className="font-medium text-slate-200">{page}</span> of{' '}
                <span className="font-medium text-slate-200">{totalPages}</span>
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  icon={<IconChevronLeft className="h-3.5 w-3.5" />}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                  <IconChevron className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Poster Zoom Modal */}
      {selectedPoster && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm transition-all"
          onClick={() => setSelectedPoster(null)}
        >
          <div
            className="relative max-w-sm w-full overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="min-w-0 pr-3">
                <h3 className="truncate font-semibold text-slate-100">{selectedPoster.title}</h3>
                {selectedPoster.uploadDate && (
                  <p className="text-xs text-slate-400">Uploaded: {selectedPoster.uploadDate}</p>
                )}
              </div>
              <button
                onClick={() => setSelectedPoster(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
              >
                <IconClose className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-800 bg-black shadow-inner">
              <img
                src={selectedPoster.posterUrl}
                alt={selectedPoster.title}
                className="max-h-[65vh] w-full object-contain"
              />
            </div>

            <div className="mt-4 flex items-center justify-between text-xs">
              <span className="text-slate-400">High Resolution Poster</span>
              <a
                href={selectedPoster.posterUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-red-400 hover:text-red-300 hover:underline font-medium"
              >
                Open Original
                <IconExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
