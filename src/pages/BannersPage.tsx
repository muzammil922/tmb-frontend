import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

export function BannersPage() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', subtitle: '', imageUrl: '', buttonText: '', buttonUrl: '', isActive: true });
  const queryClient = useQueryClient();

  const { data: banners, isLoading } = useQuery({
    queryKey: ['admin-banners'],
    queryFn: async () => {
      const { data } = await api.get('/admin/banners');
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: () => api.post('/admin/banners', form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-banners'] });
      setShowForm(false);
      setForm({ title: '', subtitle: '', imageUrl: '', buttonText: '', buttonUrl: '', isActive: true });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/banners/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-banners'] }),
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Banners</h1>
        <button onClick={() => setShowForm(!showForm)} className="rounded-lg bg-red-600 px-4 py-2 text-sm hover:bg-red-700">
          + Add Banner
        </button>
      </div>
      {showForm && (
        <div className="mb-6 space-y-3 rounded-xl bg-slate-800 p-6">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" className="w-full rounded bg-slate-700 px-4 py-2" />
          <input value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} placeholder="Subtitle" className="w-full rounded bg-slate-700 px-4 py-2" />
          <input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="Image URL" className="w-full rounded bg-slate-700 px-4 py-2" />
          <input value={form.buttonText} onChange={(e) => setForm({ ...form, buttonText: e.target.value })} placeholder="Button Text" className="w-full rounded bg-slate-700 px-4 py-2" />
          <input value={form.buttonUrl} onChange={(e) => setForm({ ...form, buttonUrl: e.target.value })} placeholder="Button URL" className="w-full rounded bg-slate-700 px-4 py-2" />
          <button onClick={() => createMutation.mutate()} className="rounded bg-red-600 px-4 py-2 hover:bg-red-700">Create</button>
        </div>
      )}
      {isLoading ? <p>Loading...</p> : (
        <div className="space-y-3">
          {banners?.map((b: { id: string; title: string; subtitle: string; isActive: boolean }) => (
            <div key={b.id} className="flex items-center justify-between rounded-xl bg-slate-800 p-4">
              <div>
                <p className="font-medium">{b.title}</p>
                <p className="text-sm text-slate-400">{b.subtitle}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs ${b.isActive ? 'text-green-400' : 'text-slate-500'}`}>{b.isActive ? 'Active' : 'Inactive'}</span>
                <button onClick={() => deleteMutation.mutate(b.id)} className="text-red-400 hover:underline text-sm">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
