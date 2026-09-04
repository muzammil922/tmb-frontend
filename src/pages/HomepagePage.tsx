import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

export function HomepagePage() {
  const queryClient = useQueryClient();

  const { data: sections, isLoading } = useQuery({
    queryKey: ['admin-homepage'],
    queryFn: async () => {
      const { data } = await api.get('/admin/homepage');
      return data;
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/admin/homepage/${id}`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-homepage'] }),
  });

  const modeMutation = useMutation({
    mutationFn: ({ id, mode }: { id: string; mode: string }) =>
      api.patch(`/admin/homepage/${id}`, { mode }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-homepage'] }),
  });

  if (isLoading) return <p className="text-slate-400">Loading...</p>;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Homepage CMS</h1>
      <p className="mb-6 text-slate-400">Manage homepage sections, visibility and content mode.</p>
      <div className="space-y-4">
        {sections?.map((section: { id: string; title: string; type: string; order: number; isActive: boolean; mode: string }) => (
          <div key={section.id} className="flex items-center justify-between rounded-xl bg-slate-800 p-4">
            <div>
              <p className="font-medium">{section.title}</p>
              <p className="text-sm text-slate-400">Type: {section.type} · Order: {section.order}</p>
            </div>
            <div className="flex items-center gap-4">
              <select
                value={section.mode}
                onChange={(e) => modeMutation.mutate({ id: section.id, mode: e.target.value })}
                className="rounded bg-slate-700 px-3 py-1 text-sm"
              >
                <option value="AUTO">Auto (TMDB)</option>
                <option value="MANUAL">Manual</option>
              </select>
              <button
                onClick={() => toggleMutation.mutate({ id: section.id, isActive: !section.isActive })}
                className={`rounded px-3 py-1 text-sm ${section.isActive ? 'bg-green-900 text-green-300' : 'bg-slate-700 text-slate-400'}`}
              >
                {section.isActive ? 'Visible' : 'Hidden'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
