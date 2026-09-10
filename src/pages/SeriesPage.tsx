import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { EmptyState, LoadingState } from '../components/ui/EmptyState';
import {
  IconSearch,
  IconFilm,
  IconClose,
  IconTrash,
  IconTv,
  IconSync,
} from '../components/ui/icons';
import { getTmdbImageUrl, type Series, type Category } from '../lib/shared';

type FilterType = 'ALL' | 'SERIES' | 'ANIME';

export function SeriesPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<FilterType>('ALL');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [inspectSeriesId, setInspectSeriesId] = useState<string | null>(null);
  const [selectedSeasonNumber, setSelectedSeasonNumber] = useState<number>(1);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const queryClient = useQueryClient();

  // Load series list
  const { data: seriesData, isLoading } = useQuery({
    queryKey: ['series', page, search, typeFilter, sourceFilter, selectedCategory, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('limit', '24');
      if (search.trim()) params.append('search', search.trim());
      if (typeFilter !== 'ALL') params.append('type', typeFilter);
      if (sourceFilter !== 'all') params.append('source', sourceFilter);
      if (selectedCategory !== 'all') params.append('category', selectedCategory);
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const res = await api.get(`/series?${params.toString()}`);
      return res.data;
    },
    staleTime: 30_000,
  });

  // Load categories for filter dropdown
  const { data: categories } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await api.get('/admin/categories');
      return res.data;
    },
    staleTime: 60_000,
  });

  // Load specific series details when inspecting episodes
  const { data: detailedSeries, isLoading: isInspecting } = useQuery<Series>({
    queryKey: ['series-detail', inspectSeriesId],
    queryFn: async () => {
      const res = await api.get(`/series/${inspectSeriesId}`);
      return res.data;
    },
    enabled: !!inspectSeriesId,
  });

  // Mutation to toggle status or delete
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/series/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['series'] });
      setDeleteConfirmId(null);
      if (inspectSeriesId === deleteConfirmId) {
        setInspectSeriesId(null);
      }
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'ACTIVE' | 'DRAFT' }) => {
      await api.patch(`/series/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['series'] });
      if (inspectSeriesId) {
        queryClient.invalidateQueries({ queryKey: ['series-detail', inspectSeriesId] });
      }
    },
  });

  // Bulk state & mutations
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkNotice, setBulkNotice] = useState<string | null>(null);

  const bulkStatusMutation = useMutation({
    mutationFn: async ({ ids, status, all }: { ids?: string[]; status: 'ACTIVE' | 'DRAFT'; all?: boolean }) => {
      await api.patch('/series/bulk/status', { ids, status, all });
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['series'] });
      setSelectedIds([]);
      setBulkNotice(
        vars.all
          ? `All series successfully set to ${vars.status}!`
          : `${vars.ids?.length} series set to ${vars.status}!`
      );
      setTimeout(() => setBulkNotice(null), 4000);
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async ({ ids, all }: { ids?: string[]; all?: boolean }) => {
      await api.delete('/series/bulk/delete', { data: { ids, all } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['series'] });
      setSelectedIds([]);
      setBulkNotice('Selected series removed.');
      setTimeout(() => setBulkNotice(null), 4000);
    },
  });

  const seriesList: Series[] = seriesData?.data || [];
  const total = seriesData?.totalResults ?? seriesData?.total ?? 0;
  const totalPages = seriesData?.totalPages || 1;
  const webSeriesCount = seriesData?.webSeriesCount ?? 0;
  const animeCount = seriesData?.animeCount ?? 0;
  const activeCount = seriesData?.activeCount ?? 0;
  const draftCount = seriesData?.draftCount ?? 0;

  // Compute selected season episodes
  const activeSeason = useMemo(() => {
    if (!detailedSeries?.seasons?.length) return null;
    return (
      detailedSeries.seasons.find((s) => s.seasonNumber === selectedSeasonNumber) ||
      detailedSeries.seasons[0]
    );
  }, [detailedSeries, selectedSeasonNumber]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <PageHeader
        title="Web Series & Anime"
        description="Comprehensive catalog of TV shows, Pakistani/Urdu dramas, and Anime series with season and episode streaming management."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="success"
              onClick={() => {
                if (window.confirm(`Kya aap waqai saari (${total}) series ko ek sath Live (Active) karna chahte hain?`)) {
                  bulkStatusMutation.mutate({ all: true, status: 'ACTIVE' });
                }
              }}
              disabled={bulkStatusMutation.isPending || total === 0}
              className="flex items-center gap-1.5 shadow-sm shadow-emerald-950"
            >
              <span>⚡</span>
              <span>{bulkStatusMutation.isPending ? 'Activating All...' : `Activate All (${total})`}</span>
            </Button>
            <Link to="/sync">
              <Button variant="secondary" className="flex items-center gap-2">
                <IconSync className="h-4 w-4" />
                Sync More Series
              </Button>
            </Link>
          </div>
        }
      />

      {bulkNotice && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/40 p-3 text-sm text-emerald-300">
          ✅ {bulkNotice}
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="p-4 bg-slate-900/60 border-slate-800">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Total Series</p>
          <p className="mt-1 text-2xl font-bold text-white">{total}</p>
          <p className="mt-1 text-[11px] text-slate-400">
            <span className="text-emerald-400 font-semibold">{activeCount} Live</span> •{' '}
            <span className="text-amber-400 font-semibold">{draftCount} Draft</span>
          </p>
        </Card>
        <Card className="p-4 bg-slate-900/60 border-slate-800">
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-400">Web Series</p>
          <p className="mt-1 text-2xl font-bold text-emerald-400">
            {webSeriesCount}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">TV Shows & Dramas</p>
        </Card>
        <Card className="p-4 bg-slate-900/60 border-slate-800">
          <p className="text-xs font-medium uppercase tracking-wider text-purple-400">Anime Shows</p>
          <p className="mt-1 text-2xl font-bold text-purple-400">
            {animeCount}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">Japanese Animation</p>
        </Card>
        <Card className="p-4 bg-slate-900/60 border-slate-800">
          <p className="text-xs font-medium uppercase tracking-wider text-sky-400">Episode Playback</p>
          <p className="mt-1 text-2xl font-bold text-sky-400">Multi-Server</p>
          <p className="mt-1 text-[11px] text-slate-400">UrduBox • MoviesAPI • MP4</p>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4 bg-slate-900/70 border-slate-800">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Search box */}
          <div className="relative flex-1 max-w-md">
            <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search series or anime by title..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-slate-700 bg-slate-800/80 py-2 pl-9 pr-4 text-sm text-white placeholder-slate-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <IconClose className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Type selector */}
            <div className="flex rounded-lg bg-slate-800 p-1 border border-slate-700">
              <button
                onClick={() => {
                  setTypeFilter('ALL');
                  setPage(1);
                }}
                className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                  typeFilter === 'ALL'
                    ? 'bg-red-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All
              </button>
              <button
                onClick={() => {
                  setTypeFilter('SERIES');
                  setPage(1);
                }}
                className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                  typeFilter === 'SERIES'
                    ? 'bg-red-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                📺 Web Series
              </button>
              <button
                onClick={() => {
                  setTypeFilter('ANIME');
                  setPage(1);
                }}
                className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                  typeFilter === 'ANIME'
                    ? 'bg-red-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                ⛩️ Anime
              </button>
            </div>

            {/* Source dropdown */}
            <select
              value={sourceFilter}
              onChange={(e) => {
                setSourceFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 focus:border-red-500 focus:outline-none"
            >
              <option value="all">All Sources</option>
              <option value="urdubox">UrduBox</option>
              <option value="moviesapi">MoviesAPI</option>
              <option value="imdb3">IMDB3 / MovieBox</option>
              <option value="tmdb">TMDB</option>
            </select>

            {/* Category dropdown */}
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 focus:border-red-500 focus:outline-none"
            >
              <option value="all">All Categories</option>
              {categories?.map((cat) => (
                <option key={cat.id} value={cat.slug}>
                  {cat.name}
                </option>
              ))}
            </select>

            {/* Status dropdown */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 focus:border-red-500 focus:outline-none"
            >
              <option value="all">All Status</option>
              <option value="live">Live (Active)</option>
              <option value="draft">Draft (Inactive)</option>
            </select>

            {/* Select page toggle */}
            {seriesList.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (selectedIds.length === seriesList.length) {
                    setSelectedIds([]);
                  } else {
                    setSelectedIds(seriesList.map((s) => s.id));
                  }
                }}
                className="rounded-lg border border-slate-700 bg-slate-800/90 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white transition flex items-center gap-2"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.length === seriesList.length && seriesList.length > 0}
                  onChange={() => {}}
                  className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-700 text-red-600 pointer-events-none"
                />
                <span>Select Page ({seriesList.length})</span>
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Bulk Action Toolbar */}
      {selectedIds.length > 0 && (
        <Card className="p-3 bg-red-950/40 border-red-500/40 flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2 text-sm text-white">
            <span className="rounded bg-red-600 px-2.5 py-0.5 text-xs font-bold">{selectedIds.length}</span>
            <span className="font-semibold">Series Selected</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="success"
              onClick={() => bulkStatusMutation.mutate({ ids: selectedIds, status: 'ACTIVE' })}
              disabled={bulkStatusMutation.isPending}
            >
              🟢 Set Active ({selectedIds.length})
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => bulkStatusMutation.mutate({ ids: selectedIds, status: 'DRAFT' })}
              disabled={bulkStatusMutation.isPending}
            >
              🟡 Set Draft ({selectedIds.length})
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                if (window.confirm(`Kya aap waqai ${selectedIds.length} selected series ko delete karna chahte hain?`)) {
                  bulkDeleteMutation.mutate({ ids: selectedIds });
                }
              }}
              disabled={bulkDeleteMutation.isPending}
            >
              🗑️ Delete Selected
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelectedIds([])}
            >
              Deselect All
            </Button>
          </div>
        </Card>
      )}

      {/* Series Grid */}
      {isLoading ? (
        <LoadingState label="Loading web series and anime catalog..." />
      ) : seriesList.length === 0 ? (
        <EmptyState
          title="No series found"
          description="Try changing your search terms or filters, or run a content sync from UrduBox / MoviesAPI."
          action={
            <Link to="/sync">
              <Button variant="primary">Sync Content Now</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {seriesList.map((item) => {
            const posterUrl = getTmdbImageUrl(item.posterPath, 'w342');
            const isAnime = item.contentType === 'ANIME';
            const year = item.firstAirDate ? new Date(item.firstAirDate).getFullYear() : null;

            return (
              <Card
                key={item.id}
                className={`group relative flex flex-col overflow-hidden border bg-slate-900/80 transition hover:shadow-xl hover:shadow-red-950/20 ${
                  selectedIds.includes(item.id) ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Poster & Badges Header */}
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-950">
                  {posterUrl ? (
                    <img
                      src={posterUrl}
                      alt={item.title}
                      className="h-full w-full object-cover object-center transition duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-slate-950 text-slate-700">
                      <IconTv className="h-12 w-12" />
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" />

                  {/* Selection Checkbox */}
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute left-2.5 top-2.5 z-20 rounded bg-slate-950/80 p-1 backdrop-blur-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(item.id)}
                      onChange={() => {
                        setSelectedIds((prev) =>
                          prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id]
                        );
                      }}
                      className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-red-600 focus:ring-red-500 cursor-pointer"
                    />
                  </div>

                  {/* Top Badges */}
                  <div className="absolute left-10 top-3 flex flex-wrap gap-1.5">
                    <Badge variant={isAnime ? 'purple' : 'info'}>
                      {isAnime ? '⛩️ Anime' : '📺 Series'}
                    </Badge>
                    {item.contentSource && (
                      <Badge variant="default">
                        {item.contentSource}
                      </Badge>
                    )}
                  </div>

                  {/* Rating */}
                  {item.rating ? (
                    <div className="absolute right-3 top-3 rounded-md bg-black/70 px-2 py-0.5 text-xs font-bold text-amber-400 backdrop-blur-sm">
                      ★ {item.rating.toFixed(1)}
                    </div>
                  ) : null}

                  {/* Seasons count on bottom of image */}
                  <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-xs text-slate-300 font-medium">
                    <span>{year ? year : 'Series'}</span>
                    <span className="rounded bg-slate-800/80 px-2 py-0.5 text-[11px] text-slate-300 border border-slate-700/60">
                      {item.numberOfSeasons || item.seasons?.length || 1} Seasons •{' '}
                      {item.numberOfEpisodes || item.episodes?.length || '—'} Eps
                    </span>
                  </div>
                </div>

                {/* Series Details */}
                <div className="flex flex-1 flex-col justify-between p-4">
                  <div>
                    <h3 className="font-semibold text-white line-clamp-1 group-hover:text-red-400 transition">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-xs text-slate-400 line-clamp-2">
                      {item.overview || 'No overview available for this series.'}
                    </p>

                    {/* Category pills */}
                    {item.categorySeries && item.categorySeries.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1">
                        {item.categorySeries.slice(0, 3).map((cs) => (
                          <span
                            key={cs.category.id}
                            className="rounded-md bg-slate-800/90 px-1.5 py-0.5 text-[10px] font-medium text-slate-300 border border-slate-700/50"
                          >
                            {cs.category.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-800/80 pt-3">
                    <button
                      type="button"
                      onClick={() => {
                        setInspectSeriesId(item.id);
                        setSelectedSeasonNumber(1);
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-red-600/10 border border-red-500/30 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-600 hover:text-white transition"
                    >
                      <IconFilm className="h-3.5 w-3.5" />
                      <span>View Episodes</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        toggleStatusMutation.mutate({
                          id: item.id,
                          status: item.status === 'ACTIVE' ? 'DRAFT' : 'ACTIVE',
                        })
                      }
                      title={item.status === 'ACTIVE' ? 'Click to Set as Draft' : 'Click to Make Live'}
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold border transition ${
                        item.status === 'ACTIVE'
                          ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 shadow-sm shadow-emerald-950/50'
                          : 'border-amber-500/40 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25'
                      }`}
                    >
                      {item.status === 'ACTIVE' ? '🟢 Live' : '🟡 Draft'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(item.id)}
                      title="Delete Series"
                      className="rounded-lg border border-slate-800 p-1.5 text-slate-500 hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400 transition"
                    >
                      <IconTrash className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-800 px-2 py-4">
          <p className="text-xs text-slate-400">
            Showing page <span className="font-semibold text-white">{page}</span> of{' '}
            <span className="font-semibold text-white">{totalPages}</span> ({total} items)
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Episode Inspector Drawer / Modal */}
      {inspectSeriesId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setInspectSeriesId(null)}
          />

          <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden z-10">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-600/20 text-red-400 border border-red-500/30">
                  <IconTv className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-bold text-white text-base">
                    {detailedSeries?.title || 'Series Episodes'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {detailedSeries?.contentType === 'ANIME' ? 'Anime Series' : 'TV / Web Series'} •{' '}
                    {detailedSeries?.seasons?.length || 1} Seasons •{' '}
                    {detailedSeries?.episodes?.length || 0} Synced Episodes
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectSeriesId(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <IconClose className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {isInspecting ? (
                <LoadingState label="Loading season & episode data..." />
              ) : detailedSeries ? (
                <>
                  {/* Season Tabs */}
                  <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-800 pb-3">
                    {detailedSeries.seasons && detailedSeries.seasons.length > 0 ? (
                      detailedSeries.seasons.map((season) => (
                        <button
                          key={season.id}
                          type="button"
                          onClick={() => setSelectedSeasonNumber(season.seasonNumber)}
                          className={`rounded-lg px-4 py-2 text-xs font-semibold transition shrink-0 ${
                            selectedSeasonNumber === season.seasonNumber
                              ? 'bg-red-600 text-white shadow-md'
                              : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                          }`}
                        >
                          {season.name || `Season ${season.seasonNumber}`} ({season.episodes?.length || 0} eps)
                        </button>
                      ))
                    ) : (
                      <div className="text-xs text-slate-400">Default Season 1</div>
                    )}
                  </div>

                  {/* Episodes Grid/List */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-slate-200">
                      Season {selectedSeasonNumber} Episodes
                    </h4>

                    {activeSeason?.episodes && activeSeason.episodes.length > 0 ? (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {activeSeason.episodes.map((ep) => (
                          <div
                            key={ep.id}
                            className="flex items-start gap-3 rounded-xl border border-slate-800/80 bg-slate-950/60 p-3 hover:border-slate-700 transition"
                          >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-xs font-bold text-white border border-slate-700">
                              E{ep.episodeNumber}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-white line-clamp-1">
                                {ep.title || `Episode ${ep.episodeNumber}`}
                              </p>
                              <p className="text-xs text-slate-400 line-clamp-2 mt-0.5">
                                {ep.overview || 'Episode ready for multi-server playback.'}
                              </p>
                              <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-500">
                                {ep.videoUrl ? (
                                  <span className="text-emerald-400 font-medium">● Direct Stream Ready</span>
                                ) : (
                                  <span className="text-sky-400 font-medium">● Cloud Multi-Server Embed</span>
                                )}
                                {ep.runtime && <span>• {ep.runtime} min</span>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-xs text-slate-400">
                        No episodes synced for Season {selectedSeasonNumber} yet.
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-slate-800 bg-slate-900/60 px-6 py-3">
              <span className="text-xs text-slate-500">
                Series ID: {detailedSeries?.id}
              </span>
              <Button variant="secondary" size="sm" onClick={() => setInspectSeriesId(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setDeleteConfirmId(null)}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl z-10">
            <h3 className="text-base font-bold text-white">Delete Series?</h3>
            <p className="mt-2 text-xs text-slate-400">
              Are you sure you want to delete this series along with all its seasons, episodes, and category associations? This action cannot be undone.
            </p>
            <div className="mt-5 flex items-center justify-end gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setDeleteConfirmId(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deleteConfirmId)}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete Series'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
