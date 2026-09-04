import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

export function CategoriesPage() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '', description: '' });
  const queryClient = useQueryClient();

  const { data: categories, isLoading } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: async () => {
      const { data } = await api.get('/admin/categories');
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: () => api.post('/admin/categories', form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      setShowForm(false);
      setForm({ name: '', slug: '', description: '' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/categories/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-categories'] }),
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Categories</h1>
        <button onClick={() => setShowForm(!showForm)} className="rounded-lg bg-red-600 px-4 py-2 text-sm hover:bg-red-700">
          + Add Category
        </button>
      </div>
      {showForm && (
        <div className="mb-6 space-y-3 rounded-xl bg-slate-800 p-6">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })} placeholder="Name" className="w-full rounded bg-slate-700 px-4 py-2" />
          <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="Slug" className="w-full rounded bg-slate-700 px-4 py-2" />
          <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" className="w-full rounded bg-slate-700 px-4 py-2" />
          <button onClick={() => createMutation.mutate()} className="rounded bg-red-600 px-4 py-2 hover:bg-red-700">Create</button>
        </div>
      )}
      {isLoading ? <p>Loading...</p> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories?.map((c: { id: string; name: string; slug: string; description: string; movies: unknown[] }) => (
            <div key={c.id} className="rounded-xl bg-slate-800 p-4">
              <p className="font-medium">{c.name}</p>
              <p className="text-sm text-slate-400">{c.slug}</p>
              <p className="mt-2 text-xs text-slate-500">{c.movies?.length ?? 0} movies</p>
              <button onClick={() => deleteMutation.mutate(c.id)} className="mt-3 text-sm text-red-400 hover:underline">Delete</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
