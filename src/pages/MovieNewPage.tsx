import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { IconChevronLeft } from '../components/ui/icons';

export function MovieNewPage() {
  const [tab, setTab] = useState<'tmdb' | 'manual'>('tmdb');
  const [tmdbQuery, setTmdbQuery] = useState('');
  const [form, setForm] = useState({ title: '', overview: '', posterPath: '', status: 'DRAFT', featured: false });
  const navigate = useNavigate();

  const { data: tmdbResults } = useQuery({
    queryKey: ['tmdb-search', tmdbQuery],
    queryFn: async () => {
      if (!tmdbQuery.trim()) return [];
      const { data } = await api.get('/admin/tmdb/search', { params: { q: tmdbQuery } });
      return data;
    },
    enabled: tmdbQuery.length > 2,
  });

  const importMutation = useMutation({
    mutationFn: (tmdbId: number) => api.post('/admin/movies/import-tmdb', { tmdbId }),
    onSuccess: (res) => navigate(`/movies/${res.data.id}/edit`),
  });

  const createMutation = useMutation({
    mutationFn: () => api.post('/admin/movies', form),
    onSuccess: (res) => navigate(`/movies/${res.data.id}/edit`),
  });

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/movies')}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/90 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition"
        >
          <IconChevronLeft className="h-4 w-4" />
          <span>Back to Movies</span>
        </button>
        <h1 className="text-2xl font-bold text-white">Add Movie</h1>
      </div>
      <div className="mb-6 flex gap-2">
        <button onClick={() => setTab('tmdb')} className={`rounded-lg px-4 py-2 ${tab === 'tmdb' ? 'bg-red-600' : 'bg-slate-800'}`}>
          Import from TMDB
        </button>
        <button onClick={() => setTab('manual')} className={`rounded-lg px-4 py-2 ${tab === 'manual' ? 'bg-red-600' : 'bg-slate-800'}`}>
          Add Manually
        </button>
      </div>

      {tab === 'tmdb' ? (
        <div>
          <input
            value={tmdbQuery}
            onChange={(e) => setTmdbQuery(e.target.value)}
            placeholder="Search TMDB movies..."
            className="mb-4 w-full max-w-lg rounded-lg bg-slate-800 px-4 py-3 outline-none focus:ring-2 focus:ring-red-500"
          />
          <div className="space-y-2">
            {tmdbResults?.map((m: { id: number; title: string; release_date: string; poster_path: string }) => (
              <div key={m.id} className="flex items-center justify-between rounded-lg bg-slate-800 p-4">
                <div className="flex items-center gap-4">
                  {m.poster_path && (
                    <img src={`https://image.tmdb.org/t/p/w92${m.poster_path}`} alt="" className="h-16 w-12 rounded object-cover" />
                  )}
                  <div>
                    <p className="font-medium">{m.title}</p>
                    <p className="text-sm text-slate-400">{m.release_date}</p>
                  </div>
                </div>
                <button
                  onClick={() => importMutation.mutate(m.id)}
                  disabled={importMutation.isPending}
                  className="rounded bg-red-600 px-4 py-2 text-sm hover:bg-red-700 disabled:opacity-50"
                >
                  Import
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="max-w-lg space-y-4">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" className="w-full rounded-lg bg-slate-800 px-4 py-3" />
          <textarea value={form.overview} onChange={(e) => setForm({ ...form, overview: e.target.value })} placeholder="Description" rows={4} className="w-full rounded-lg bg-slate-800 px-4 py-3" />
          <input value={form.posterPath} onChange={(e) => setForm({ ...form, posterPath: e.target.value })} placeholder="Poster URL" className="w-full rounded-lg bg-slate-800 px-4 py-3" />
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full rounded-lg bg-slate-800 px-4 py-3">
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
          </select>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} />
            Featured on homepage
          </label>
          <button onClick={() => createMutation.mutate()} disabled={!form.title || createMutation.isPending} className="rounded-lg bg-red-600 px-6 py-3 font-semibold hover:bg-red-700 disabled:opacity-50">
            Create Movie
          </button>
        </div>
      )}
    </div>
  );
}
