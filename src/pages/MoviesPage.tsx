import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
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
} from '../components/ui/icons';
import { getTmdbImageUrl, formatUploadDate, type Movie } from '../lib/shared';

function sourceBadge(source: string) {
  if (source === 'URDBOX') return 'purple' as const;
  if (source === 'MOVIESAPI') return 'info' as const;
  return 'default' as const;
}

type FilterType = 'all' | 'live' | 'draft' | 'playable' | 'no-stream';

function getStreamStatus(movie: Movie) {
  if (movie.videoUrl) {
    const isHls = movie.videoUrl.includes('.m3u8');
    return {
      playable: true,
      label: isHls ? 'HLS Direct' : 'Direct Video',
      variant: 'success' as const,
      detail: 'Direct video/HLS attached',
    };
  }
  if (movie.playbackMode === 'URDBOX' || movie.contentSource === 'URDBOX') {
    return {
      playable: true,
      label: 'UrduBox HLS',
      variant: 'purple' as const,
      detail: 'UrduBox fast stream connected',
    };
  }
  if (movie.playbackMode === 'EMBED' || movie.contentSource === 'MOVIESAPI') {
    return {
      playable: true,
      label: 'MoviesAPI',
      variant: 'info' as const,
      detail: 'MoviesAPI cloud embed player',
    };
  }
  if (movie.tmdbId) {
    return {
      playable: true,
      label: 'Cloud Embed',
      variant: 'success' as const,
      detail: 'Multi-Server Cloud Stream (AutoEmbed / Smashy)',
    };
  }
  return {
    playable: false,
    label: 'No Stream',
    variant: 'danger' as const,
    detail: 'Website par chal nahi rahi (No stream link or TMDB ID)',
  };
}

export function MoviesPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedPoster, setSelectedPoster] = useState<{
    title: string;
    posterUrl: string;
    backdropUrl?: string | null;
    uploadDate?: string;
  } | null>(null);

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-movies', search, page],
    queryFn: async () => {
      const { data } = await api.get('/admin/movies', { params: { search, page } });
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/movies/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-movies'] }),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ACTIVE' | 'DRAFT' }) =>
      api.patch(`/admin/movies/${id}`, { status }),
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
      const stream = getStreamStatus(movie);
      if (filter === 'playable') return stream.playable;
      if (filter === 'no-stream') return !stream.playable;
      return true;
    });
  }, [rawMovies, filter]);

  // Counts for filters
  const counts = useMemo(() => {
    let live = 0;
    let draft = 0;
    let playable = 0;
    let noStream = 0;
    for (const m of rawMovies) {
      if (m.status === 'ACTIVE') live++;
      if (m.status === 'DRAFT') draft++;
      const s = getStreamStatus(m);
      if (s.playable) playable++;
      else noStream++;
    }
    return { live, draft, playable, noStream };
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
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500 mr-1">
              Filter:
            </span>
            <button
              onClick={() => setFilter('all')}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                filter === 'all'
                  ? 'bg-red-500/20 text-red-300 ring-1 ring-red-500/40'
                  : 'bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              All ({rawMovies.length})
            </button>
            <button
              onClick={() => setFilter('live')}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
                filter === 'live'
                  ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40'
                  : 'bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
              Live on Web ({counts.live})
            </button>
            <button
              onClick={() => setFilter('draft')}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
                filter === 'draft'
                  ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40'
                  : 'bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400"></span>
              Draft / Hidden ({counts.draft})
            </button>
            <button
              onClick={() => setFilter('playable')}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
                filter === 'playable'
                  ? 'bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/40'
                  : 'bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400"></span>
              Stream Ready ({counts.playable})
            </button>
            <button
              onClick={() => setFilter('no-stream')}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
                filter === 'no-stream'
                  ? 'bg-red-500/20 text-red-300 ring-1 ring-red-500/40'
                  : 'bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-red-400"></span>
              Chal Nahi Rahi ({counts.noStream})
            </button>
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
                  <th className="px-5 py-3.5 font-semibold">Website Live Status</th>
                  <th className="px-5 py-3.5 font-semibold">Stream Status</th>
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
                  const stream = getStreamStatus(movie);
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
                            {movie.featured && (
                              <Badge variant="warning">Featured</Badge>
                            )}
                          </div>
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
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex flex-col gap-0.5" title={stream.detail}>
                          <div className="flex items-center gap-1.5">
                            <Badge variant={stream.variant}>
                              {stream.playable ? '● ' + stream.label : '✕ ' + stream.label}
                            </Badge>
                          </div>
                          <span
                            className={`text-[11px] ${
                              stream.playable ? 'text-slate-400' : 'text-red-400 font-medium'
                            }`}
                          >
                            {stream.playable ? 'Playable on website' : 'Chal nahi sakti'}
                          </span>
                        </div>
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
                        <Badge variant={sourceBadge(movie.source)}>{movie.source}</Badge>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Open in Website */}
                          <a
                            href={`http://localhost:3000/movies/${movie.id}`}
                            target="_blank"
                            rel="noreferrer"
                            title="Open on website"
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
