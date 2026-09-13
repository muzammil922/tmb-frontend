import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { getTmdbImageUrl } from '../lib/shared';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Alert } from '../components/ui/Alert';
import { Input, Label, Select } from '../components/ui/Input';
import { LoadingState } from '../components/ui/EmptyState';
import { Tabs } from '../components/ui/Tabs';

interface LibraryItem {
  id: string;
  title: string;
  type: string;
  contentType: string;
  syncPreset?: string | null;
  playbackStatus: string;
  contentSource?: string | null;
  posterPath?: string | null;
  categories: { name: string }[];
  genres: { name: string }[];
}

function statusVariant(status: string) {
  if (status === 'WORKING') return 'success';
  if (status === 'BROKEN') return 'danger';
  return 'warning';
}

type LibraryTab = 'all' | 'movies' | 'series' | 'anime';

const LIBRARY_TAB_TYPE: Record<LibraryTab, string> = {
  all: 'all',
  movies: 'MOVIE',
  series: 'SERIES',
  anime: 'ANIME',
};

export function ContentLibraryPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<LibraryTab>('all');
  const [search, setSearch] = useState('');
  const [playbackStatus, setPlaybackStatus] = useState('all');
  const contentType = LIBRARY_TAB_TYPE[activeTab];
  const [syncPreset, setSyncPreset] = useState('all');
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['content-library', page, search, playbackStatus, contentType, syncPreset],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: '24',
      });
      if (search.trim()) params.set('search', search.trim());
      if (playbackStatus !== 'all') params.set('playbackStatus', playbackStatus);
      if (contentType !== 'all') params.set('contentType', contentType);
      if (syncPreset !== 'all') params.set('syncPreset', syncPreset);
      const { data } = await api.get<{ data: LibraryItem[]; totalPages: number; totalResults: number }>(
        `/admin/content/library?${params}`,
      );
      return data;
    },
  });

  const deleteBrokenMutation = useMutation({
    mutationFn: () => api.post('/admin/content/bulk-delete', { playbackStatus: 'BROKEN' }),
    onSuccess: (res) => {
      setMessage({
        type: 'success',
        text: `Deleted ${res.data.moviesDeleted} movies and ${res.data.seriesDeleted} series.`,
      });
      queryClient.invalidateQueries({ queryKey: ['content-library'] });
      queryClient.invalidateQueries({ queryKey: ['automation-stats'] });
    },
    onError: () => setMessage({ type: 'error', text: 'Failed to delete broken content.' }),
  });

  const recheckMutation = useMutation({
    mutationFn: () => api.post('/admin/content/recheck-playback', { allBroken: true }),
    onSuccess: (res) => {
      setMessage({
        type: 'success',
        text: `Rechecked ${res.data.checked} items — ${res.data.working} working, ${res.data.broken} broken.`,
      });
      queryClient.invalidateQueries({ queryKey: ['content-library'] });
      queryClient.invalidateQueries({ queryKey: ['automation-stats'] });
    },
    onError: () => setMessage({ type: 'error', text: 'Failed to recheck playback.' }),
  });

  return (
    <div>
      <PageHeader
        title="Content Library"
        description="Browse imported content, filter by playback status, and clean up broken items."
      />

      {message && <Alert variant={message.type === 'success' ? 'success' : 'error'}>{message.text}</Alert>}

      <Tabs
        tabs={[
          { id: 'all', label: 'All' },
          { id: 'movies', label: '🎬 Movies' },
          { id: 'series', label: '📺 Web Series' },
          { id: 'anime', label: '⛩️ Anime' },
        ]}
        active={activeTab}
        onChange={(id) => {
          setActiveTab(id as LibraryTab);
          setPage(1);
        }}
      />

      <Card className="mb-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <Label>Search</Label>
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Title..." />
          </div>
          <div>
            <Label>Playback</Label>
            <Select value={playbackStatus} onChange={(e) => { setPlaybackStatus(e.target.value); setPage(1); }}>
              <option value="all">All</option>
              <option value="WORKING">Working</option>
              <option value="BROKEN">Broken</option>
              <option value="PENDING">Pending</option>
            </Select>
          </div>
          <div>
            <Label>Platform</Label>
            <Select value={syncPreset} onChange={(e) => { setSyncPreset(e.target.value); setPage(1); }}>
              <option value="all">All</option>
              <option value="trending">Trending</option>
              <option value="netflix">Netflix</option>
              <option value="prime">Prime</option>
              <option value="hulu">Hulu</option>
              <option value="disney">Disney+</option>
              <option value="bollywood">Bollywood</option>
              <option value="hollywood">Hollywood</option>
              <option value="anime">Anime</option>
            </Select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            variant="danger"
            onClick={() => deleteBrokenMutation.mutate()}
            disabled={deleteBrokenMutation.isPending}
          >
            {deleteBrokenMutation.isPending ? 'Deleting...' : 'Delete All Broken'}
          </Button>
          <Button
            variant="outline"
            onClick={() => recheckMutation.mutate()}
            disabled={recheckMutation.isPending}
          >
            {recheckMutation.isPending ? 'Rechecking...' : 'Recheck Broken'}
          </Button>
        </div>
      </Card>

      <Card padding="none">
        {isLoading ? (
          <LoadingState label="Loading library..." />
        ) : !data?.data?.length ? (
          <p className="p-8 text-center text-slate-500">No content found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/60 text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Platform</th>
                  <th className="px-4 py-3">Playback</th>
                  <th className="px-4 py-3">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/40">
                {data.data.map((item) => (
                  <tr key={`${item.type}-${item.id}`} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {item.posterPath && (
                          <img
                            src={getTmdbImageUrl(item.posterPath, 'w92') || ''}
                            alt=""
                            className="h-10 w-7 rounded object-cover"
                          />
                        )}
                        <span className="font-medium text-slate-200">{item.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{item.type}</td>
                    <td className="px-4 py-3 capitalize text-slate-400">{item.syncPreset || '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant(item.playbackStatus)}>{item.playbackStatus}</Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{item.contentSource || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-700/60 px-4 py-3">
            <span className="text-xs text-slate-500">{data.totalResults} items</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span className="px-2 py-1 text-xs text-slate-400">Page {page} / {data.totalPages}</span>
              <Button size="sm" variant="outline" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
