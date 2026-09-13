import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import api from '../lib/api';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Alert } from '../components/ui/Alert';
import { Input, Label, Select } from '../components/ui/Input';

type ContentType = 'movie' | 'series';

interface CheckResult {
  tmdbId: number;
  contentType: string;
  action: 'IMPORT' | 'SKIP';
  reason: string;
  message: string;
  exists: boolean;
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
  const isPending = checkMutation.isPending || importMoviesApiMutation.isPending;
  const step = checkResult ? 2 : 1;

  return (
    <div>
      <PageHeader
        title="Import Content"
        description="Import a single movie or series by TMDB ID. Check availability first, then choose your source."
      />

      {/* Step indicator */}
      <div className="mb-8 flex items-center gap-3">
        <div className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${step >= 1 ? 'bg-red-600/20 text-red-300 ring-1 ring-red-500/30' : 'bg-slate-800 text-slate-500'}`}>
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs text-white">1</span>
          Enter TMDB ID
        </div>
        <div className="h-px flex-1 bg-slate-700" />
        <div className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${step >= 2 ? 'bg-red-600/20 text-red-300 ring-1 ring-red-500/30' : 'bg-slate-800 text-slate-500'}`}>
          <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${step >= 2 ? 'bg-red-600 text-white' : 'bg-slate-700 text-slate-400'}`}>2</span>
          Review & Import
        </div>
      </div>

      {message && <Alert variant={message.type === 'success' ? 'success' : 'error'}>{message.text}</Alert>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader title="Step 1 — Lookup" description="Enter the TMDB ID from themoviedb.org" />
            <div className="space-y-4">
              <div>
                <Label hint="Find this on TMDB movie/series page URL">TMDB ID</Label>
                <Input
                  type="number"
                  value={tmdbId}
                  onChange={(e) => {
                    setTmdbId(e.target.value);
                    setCheckResult(null);
                  }}
                  placeholder="e.g. 550"
                />
              </div>
              <div>
                <Label>Content Type</Label>
                <Select
                  value={contentType}
                  onChange={(e) => {
                    setContentType(e.target.value as ContentType);
                    setCheckResult(null);
                  }}
                >
                  <option value="movie">Movie</option>
                  <option value="series">Series</option>
                </Select>
              </div>
              <Button
                onClick={() => checkMutation.mutate()}
                disabled={!tmdbId || isPending}
                className="w-full"
              >
                {checkMutation.isPending ? 'Checking...' : 'Check Availability'}
              </Button>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-3">
          {checkResult ? (
            <Card>
              <CardHeader
                title="Step 2 — Import"
                description="Review the check result and choose a source"
              />
              <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl bg-slate-900/50 p-3 text-center">
                  <p className="text-xs text-slate-500">Action</p>
                  <div className="mt-1">
                    <Badge variant={checkResult.action === 'IMPORT' ? 'success' : 'warning'}>
                      {checkResult.action}
                    </Badge>
                  </div>
                </div>
                <div className="rounded-xl bg-slate-900/50 p-3 text-center sm:col-span-3">
                  <p className="text-xs text-slate-500">Sources</p>
                  <p className="mt-1 text-sm font-medium text-slate-200">
                    {checkResult.availableSources.join(' · ')}
                  </p>
                </div>
              </div>

              <div className="mb-6 space-y-2 rounded-xl border border-slate-700/60 bg-slate-900/30 p-4 text-sm">
                <p><span className="text-slate-500">Message:</span> <span className="text-slate-200">{checkResult.message}</span></p>
                <p><span className="text-slate-500">Reason:</span> <span className="text-slate-300">{checkResult.reason}</span></p>
                {checkResult.existingId && (
                  <p>
                    <span className="text-slate-500">Already exists:</span>{' '}
                    <span className="text-slate-200">{checkResult.existingTitle}</span>
                    {contentType === 'movie' && (
                      <button
                        onClick={() => navigate(`/movies/${checkResult.existingId}/edit`)}
                        className="ml-2 text-red-400 hover:underline"
                      >
                        Edit →
                      </button>
                    )}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  variant="success"
                  onClick={() => importMoviesApiMutation.mutate()}
                  disabled={!canImport || isPending}
                >
                  {importMoviesApiMutation.isPending ? 'Importing...' : 'Import from MoviesAPI'}
                </Button>
              </div>
            </Card>
          ) : (
            <Card className="flex min-h-[280px] items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-700/50 text-slate-500">
                  <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <p className="font-medium text-slate-300">No check result yet</p>
                <p className="mt-1 text-sm text-slate-500">Enter a TMDB ID and click Check Availability</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
