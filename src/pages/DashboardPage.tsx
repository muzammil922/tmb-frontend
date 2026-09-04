import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import type { DashboardStats } from '@/lib/shared';

export function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const { data } = await api.get<DashboardStats & { recentUsers: unknown[]; popularMovies: unknown[] }>('/admin/dashboard/stats');
      return data;
    },
  });

  if (isLoading) return <div className="text-slate-400">Loading...</div>;

  const stats = [
    { label: 'Total Users', value: data?.totalUsers ?? 0 },
    { label: 'Total Movies', value: data?.totalMovies ?? 0 },
    { label: 'Active Users', value: data?.activeUsers ?? 0 },
    { label: 'Watch History', value: data?.totalWatchHistory ?? 0 },
  ];

  return (
    <div>
      <h1 className="mb-8 text-2xl font-bold">Dashboard</h1>
      <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl bg-slate-800 p-6">
            <p className="text-sm text-slate-400">{s.label}</p>
            <p className="mt-2 text-3xl font-bold">{s.value.toLocaleString()}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="rounded-xl bg-slate-800 p-6">
          <h2 className="mb-4 font-semibold">Recent Users</h2>
          <div className="space-y-2">
            {(data?.recentUsers as { name: string; email: string }[] | undefined)?.map((u, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span>{u.name}</span>
                <span className="text-slate-400">{u.email}</span>
              </div>
            )) ?? <p className="text-slate-500">No users yet</p>}
          </div>
        </div>
        <div className="rounded-xl bg-slate-800 p-6">
          <h2 className="mb-4 font-semibold">Popular Movies</h2>
          <div className="space-y-2">
            {(data?.popularMovies as { title: string; rating: number }[] | undefined)?.map((m, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span>{m.title}</span>
                <span className="text-yellow-400">⭐ {m.rating?.toFixed(1)}</span>
              </div>
            )) ?? <p className="text-slate-500">No movies yet</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
