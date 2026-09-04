import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

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

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Movies</h1>
        <Link to="/movies/new" className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-700">
          + Add Movie
        </Link>
      </div>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search movies..."
        className="mb-6 w-full max-w-md rounded-lg bg-slate-800 px-4 py-2 outline-none focus:ring-2 focus:ring-red-500"
      />
      {isLoading ? (
        <p className="text-slate-400">Loading...</p>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-700 text-slate-400">
              <tr>
                <th className="p-4">Title</th>
                <th className="p-4">Status</th>
                <th className="p-4">Featured</th>
                <th className="p-4">Source</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data?.data?.map((movie: { id: string; title: string; status: string; featured: boolean; source: string }) => (
                <tr key={movie.id} className="border-b border-slate-700/50">
                  <td className="p-4">{movie.title}</td>
                  <td className="p-4">
                    <span className={`rounded px-2 py-0.5 text-xs ${movie.status === 'ACTIVE' ? 'bg-green-900 text-green-300' : 'bg-yellow-900 text-yellow-300'}`}>
                      {movie.status}
                    </span>
                  </td>
                  <td className="p-4">{movie.featured ? 'Yes' : 'No'}</td>
                  <td className="p-4">{movie.source}</td>
                  <td className="p-4">
                    <Link to={`/movies/${movie.id}/edit`} className="mr-3 text-red-400 hover:underline">Edit</Link>
                    <button onClick={() => deleteMutation.mutate(movie.id)} className="text-red-400 hover:underline">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data?.data?.length && <p className="p-8 text-center text-slate-500">No movies found</p>}
        </div>
      )}
    </div>
  );
}
