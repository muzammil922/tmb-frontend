import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { getTmdbImageUrl } from '../lib/shared';
import { IconChevronLeft } from '../components/ui/icons';

export function MovieEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [videoUrl, setVideoUrl] = useState('');
  const [videoDuration, setVideoDuration] = useState('');
  const [form, setForm] = useState<{ title: string; overview: string; status: string; featured: boolean; posterPath: string; backdropPath: string } | null>(null);

  const { data: movie, isLoading } = useQuery({
    queryKey: ['admin-movie', id],
    queryFn: async () => {
      const { data: list } = await api.get('/admin/movies');
      return list.data.find((m: { id: string }) => m.id === id);
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (movie && !form) {
      setForm({
        title: movie.title,
        overview: movie.overview || '',
        status: movie.status,
        featured: movie.featured,
        posterPath: movie.posterPath || '',
        backdropPath: movie.backdropPath || '',
      });
      if (movie.videoUrl) setVideoUrl(movie.videoUrl);
      if (movie.videoDuration) setVideoDuration(String(movie.videoDuration));
    }
  }, [movie, form]);

  const updateMutation = useMutation({
    mutationFn: (data: unknown) => api.patch(`/admin/movies/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-movies'] }),
  });

  const videoMutation = useMutation({
    mutationFn: () => api.post(`/admin/movies/${id}/video`, {
      videoUrl,
      videoProvider: 'cloudinary',
      videoDuration: videoDuration ? Number(videoDuration) : undefined,
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-movie', id] }),
  });

  const { data: uploadSig } = useQuery({
    queryKey: ['upload-signature'],
    queryFn: async () => {
      const { data } = await api.get('/admin/media/upload-signature');
      return data;
    },
  });

  if (isLoading || !form) return <p className="text-slate-400">Loading...</p>;

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
        <h1 className="text-2xl font-bold text-white truncate max-w-xl">Edit: {form.title}</h1>
      </div>
      <div className="grid max-w-4xl grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="space-y-4">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full rounded-lg bg-slate-800 px-4 py-3" placeholder="Title" />
          <textarea value={form.overview} onChange={(e) => setForm({ ...form, overview: e.target.value })} rows={4} className="w-full rounded-lg bg-slate-800 px-4 py-3" placeholder="Overview" />
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full rounded-lg bg-slate-800 px-4 py-3">
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
          </select>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} />
            Featured
          </label>

          <div className="rounded-lg bg-slate-800/50 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-300">Poster & Backdrop</h3>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Poster path or URL</label>
              <input
                value={form.posterPath}
                onChange={(e) => setForm({ ...form, posterPath: e.target.value })}
                placeholder="/path.jpg or https://..."
                className="w-full rounded-lg bg-slate-700 px-4 py-2 text-sm"
              />
              {getTmdbImageUrl(form.posterPath, 'w185') && (
                <img
                  src={getTmdbImageUrl(form.posterPath, 'w185')!}
                  alt="Poster preview"
                  className="mt-2 h-28 w-20 rounded object-cover"
                />
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Backdrop path or URL</label>
              <input
                value={form.backdropPath}
                onChange={(e) => setForm({ ...form, backdropPath: e.target.value })}
                placeholder="/path.jpg or https://..."
                className="w-full rounded-lg bg-slate-700 px-4 py-2 text-sm"
              />
              {getTmdbImageUrl(form.backdropPath, 'w780') && (
                <img
                  src={getTmdbImageUrl(form.backdropPath, 'w780')!}
                  alt="Backdrop preview"
                  className="mt-2 h-24 w-full max-w-sm rounded object-cover"
                />
              )}
            </div>
          </div>

          <button onClick={() => updateMutation.mutate(form)} className="rounded-lg bg-red-600 px-6 py-2 hover:bg-red-700">
            Save Changes
          </button>
        </div>

        <div className="rounded-xl bg-slate-800 p-6">
          <h2 className="mb-4 font-semibold">Video Upload</h2>
          {uploadSig?.configured ? (
            <p className="mb-4 text-sm text-slate-400">
              Cloudinary configured. Upload video via Cloudinary widget or paste URL below.
            </p>
          ) : (
            <p className="mb-4 text-sm text-yellow-400">{uploadSig?.message || 'Cloudinary not configured'}</p>
          )}
          <input
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="Video URL (Cloudinary/S3)"
            className="mb-3 w-full rounded-lg bg-slate-700 px-4 py-2 text-sm"
          />
          <input
            value={videoDuration}
            onChange={(e) => setVideoDuration(e.target.value)}
            placeholder="Duration (seconds)"
            type="number"
            className="mb-4 w-full rounded-lg bg-slate-700 px-4 py-2 text-sm"
          />
          <button onClick={() => videoMutation.mutate()} disabled={!videoUrl} className="rounded-lg bg-green-600 px-4 py-2 text-sm hover:bg-green-700 disabled:opacity-50">
            Attach Video
          </button>
          {movie?.videoUrl && (
            <p className="mt-4 text-xs text-green-400">Current: {movie.videoUrl.slice(0, 50)}...</p>
          )}
        </div>
      </div>
      <button onClick={() => navigate('/movies')} className="mt-8 text-slate-400 hover:underline">← Back to movies</button>
    </div>
  );
}
