import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import api from '../lib/api';

type ContentType = 'movie' | 'series';

interface CheckResult {
  tmdbId: number;
  contentType: string;
  action: 'IMPORT' | 'SKIP';
  reason: string;
  message: string;
  exists: boolean;
  urduboxAvailable: boolean;
  availableSources: string[];
  existingId?: string;
  existingTitle?: string;
}

export function ContentImportPage() {
  const navigate = useNavigate();
  const [tmdbId, setTmdbId] = useState('');
  const [contentType, setContentType] = useState<ContentType>('movie');
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const checkMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.get<CheckResult>(`/admin/content/check/${tmdbId}`, {
        params: { type: contentType },
      });
      return data;
    },
    onSuccess: (data) => {
      setCheckResult(data);
      setMessage(null);
    },
    onError: () => setMessage({ type: 'error', text: 'Failed to check content.' }),
  });

  const importUrduboxMutation = useMutation({
    mutationFn: () => api.post('/admin/content/import/urdubox', { tmdbId: Number(tmdbId), type: contentType }),
    onSuccess: (res) => {
      const data = res.data;
      if (data.imported && data.movie?.id) {
        setMessage({ type: 'success', text: data.message || 'Imported successfully.' });
        navigate(`/movies/${data.movie.id}/edit`);
        return;
      }
      if (data.imported && data.series) {
        setMessage({ type: 'success', text: data.message || 'Series imported successfully.' });
        return;
      }
      setMessage({ type: 'error', text: data.message || 'Import skipped.' });
      setCheckResult(data);
    },
    onError: () => setMessage({ type: 'error', text: 'Urdubox import failed.' }),
  });

  const importMoviesApiMutation = useMutation({
    mutationFn: () => api.post('/admin/content/import/moviesapi', { tmdbId: Number(tmdbId), type: contentType }),
    onSuccess: (res) => {
      const data = res.data;
      if (data.imported && data.movie?.id) {
        setMessage({ type: 'success', text: data.message || 'Imported successfully.' });
        navigate(`/movies/${data.movie.id}/edit`);
        return;
      }
      if (data.imported && data.series) {
        setMessage({ type: 'success', text: data.message || 'Series imported successfully.' });
        return;
      }
      setMessage({ type: 'error', text: data.message || 'Import skipped.' });
      setCheckResult(data);
    },
    onError: () => setMessage({ type: 'error', text: 'MoviesAPI import failed.' }),
  });

  const canImport = checkResult?.action === 'IMPORT';
  const isPending = checkMutation.isPending || importUrduboxMutation.isPending || importMoviesApiMutation.isPending;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Import Content</h1>
      <p className="mb-6 text-slate-400">
        Check a TMDB ID before importing from Urdubox or MoviesAPI.
      </p>

      {message && (
        <div
          className={`mb-6 rounded-lg px-4 py-3 text-sm ${
            message.type === 'success' ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="mb-8 max-w-lg space-y-4 rounded-xl bg-slate-800 p-6">
        <div>
          <label className="mb-1 block text-sm text-slate-400">TMDB ID</label>
          <input
            type="number"
            value={tmdbId}
            onChange={(e) => {
              setTmdbId(e.target.value);
              setCheckResult(null);
            }}
            placeholder="e.g. 550"
            className="w-full rounded-lg bg-slate-700 px-4 py-3"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-400">Content Type</label>
          <select
            value={contentType}
            onChange={(e) => {
              setContentType(e.target.value as ContentType);
              setCheckResult(null);
            }}
            className="w-full rounded-lg bg-slate-700 px-4 py-3"
          >
            <option value="movie">Movie</option>
            <option value="series">Series</option>
          </select>
        </div>
        <button
          onClick={() => checkMutation.mutate()}
          disabled={!tmdbId || isPending}
          className="w-full rounded-lg bg-red-600 py-3 font-semibold hover:bg-red-700 disabled:opacity-50"
        >
          {checkMutation.isPending ? 'Checking...' : 'Check Content'}
        </button>
      </div>

      {checkResult && (
        <div className="max-w-2xl rounded-xl bg-slate-800 p-6">
          <h2 className="mb-4 text-lg font-semibold">Check Result</h2>
          <div className="space-y-2 text-sm">
            <p>
              <span className="text-slate-400">Action:</span>{' '}
              <span className={checkResult.action === 'IMPORT' ? 'text-green-400' : 'text-yellow-400'}>
                {checkResult.action}
              </span>
            </p>
            <p><span className="text-slate-400">Message:</span> {checkResult.message}</p>
            <p><span className="text-slate-400">Reason:</span> {checkResult.reason}</p>
            <p>
              <span className="text-slate-400">Urdubox available:</span>{' '}
              {checkResult.urduboxAvailable ? 'Yes' : 'No'}
            </p>
            <p>
              <span className="text-slate-400">Available sources:</span>{' '}
              {checkResult.availableSources.join(', ')}
            </p>
            {checkResult.existingId && (
              <p>
                <span className="text-slate-400">Existing:</span> {checkResult.existingTitle}
                {contentType === 'movie' && (
                  <button
                    onClick={() => navigate(`/movies/${checkResult.existingId}/edit`)}
                    className="ml-2 text-red-400 hover:underline"
                  >
                    Edit movie
                  </button>
                )}
              </p>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => importUrduboxMutation.mutate()}
              disabled={!canImport || !checkResult.urduboxAvailable || isPending}
              className="rounded-lg bg-green-600 px-6 py-2 hover:bg-green-700 disabled:opacity-50"
            >
              {importUrduboxMutation.isPending ? 'Importing...' : 'Import from Urdubox'}
            </button>
            <button
              onClick={() => importMoviesApiMutation.mutate()}
              disabled={!canImport || isPending}
              className="rounded-lg bg-blue-600 px-6 py-2 hover:bg-blue-700 disabled:opacity-50"
            >
              {importMoviesApiMutation.isPending ? 'Importing...' : 'Import from MoviesAPI'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
