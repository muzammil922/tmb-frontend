import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input, Label } from '../components/ui/Input';
import { EmptyState, LoadingState } from '../components/ui/EmptyState';
import { IconPlus, IconSearch } from '../components/ui/icons';

function sourceBadge(source: string) {
  if (source === 'URDBOX') return 'purple' as const;
  if (source === 'MOVIESAPI') return 'info' as const;
  return 'default' as const;
}

function statusBadge(status: string) {
  if (status === 'ACTIVE') return 'success' as const;
  if (status === 'DRAFT') return 'warning' as const;
  return 'default' as const;
}

export function MoviesPage() {
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-movies', search],
    queryFn: async () => {
      const { data } = await api.get('/admin/movies', { params: { search } });
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/movies/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-movies'] }),
  });

  const movies = data?.data ?? [];
  const total = movies.length;

  return (
    <div>
      <PageHeader
        title="Movies"
        description="Search, edit, and manage all movies on your platform."
        actions={
          <Link to="/movies/new">
            <Button icon={<IconPlus className="h-4 w-4" />}>Add Movie</Button>
          </Link>
        }
      />

      <Card className="mb-6" padding="md">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="relative max-w-md flex-1">
            <Label hint="Filter by title">Search movies</Label>
            <div className="relative">
              <IconSearch className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Type movie title..."
                className="pl-10"
              />
            </div>
          </div>
          <p className="text-sm text-slate-500">
            Showing <span className="font-medium text-slate-300">{total}</span> movies
          </p>
        </div>
      </Card>

      {isLoading ? (
        <LoadingState label="Loading movies..." />
      ) : !movies.length ? (
        <Card>
          <EmptyState
            title="No movies found"
            description={search ? 'Try a different search term.' : 'Add your first movie to get started.'}
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
                <tr className="border-b border-slate-700/80 bg-slate-900/40 text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3.5 font-semibold">Title</th>
                  <th className="px-5 py-3.5 font-semibold">Status</th>
                  <th className="px-5 py-3.5 font-semibold">Featured</th>
                  <th className="px-5 py-3.5 font-semibold">Source</th>
                  <th className="px-5 py-3.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {movies.map((movie: { id: string; title: string; status: string; featured: boolean; source: string }) => (
                  <tr key={movie.id} className="transition hover:bg-slate-900/30">
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-100">{movie.title}</p>
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant={statusBadge(movie.status)}>{movie.status}</Badge>
                    </td>
                    <td className="px-5 py-4">
                      {movie.featured ? (
                        <Badge variant="warning">Featured</Badge>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant={sourceBadge(movie.source)}>{movie.source}</Badge>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link to={`/movies/${movie.id}/edit`}>
                          <Button variant="ghost" size="sm">Edit</Button>
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
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
