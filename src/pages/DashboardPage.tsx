import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import type { DashboardStats } from '@/lib/shared';
import { PageHeader } from '../components/ui/PageHeader';
import { StatsCard } from '../components/ui/StatsCard';
import { Card, CardHeader } from '../components/ui/Card';
import { LoadingState } from '../components/ui/EmptyState';
import { IconFilm, IconImport, IconSync, IconUsers } from '../components/ui/icons';
import { Button } from '../components/ui/Button';

export function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const { data } = await api.get<DashboardStats & { recentUsers: unknown[]; popularMovies: unknown[] }>(
        '/admin/dashboard/stats',
      );
      return data;
    },
  });

  if (isLoading) return <LoadingState label="Loading dashboard..." />;

  const stats = [
    { label: 'Total Users', value: data?.totalUsers ?? 0, icon: <IconUsers className="h-5 w-5" />, accent: 'sky' as const },
    { label: 'Total Movies', value: data?.totalMovies ?? 0, icon: <IconFilm className="h-5 w-5" />, accent: 'red' as const },
    { label: 'Active Users', value: data?.activeUsers ?? 0, icon: <IconUsers className="h-5 w-5" />, accent: 'emerald' as const },
    { label: 'Watch History', value: data?.totalWatchHistory ?? 0, icon: <IconFilm className="h-5 w-5" />, accent: 'amber' as const },
  ];

  const quickActions = [
    { to: '/movies/new', label: 'Add Movie', desc: 'Import from TMDB or add manually', icon: <IconFilm className="h-5 w-5" />, color: 'text-red-400 bg-red-500/10' },
    { to: '/content/import', label: 'Import Content', desc: 'Import by TMDB ID', icon: <IconImport className="h-5 w-5" />, color: 'text-sky-400 bg-sky-500/10' },
    { to: '/sync', label: 'Content Sync', desc: 'Bulk sync from sources', icon: <IconSync className="h-5 w-5" />, color: 'text-emerald-400 bg-emerald-500/10' },
    { to: '/movies', label: 'Manage Movies', desc: 'Edit, search & publish', icon: <IconFilm className="h-5 w-5" />, color: 'text-amber-400 bg-amber-500/10' },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Overview of your platform — users, content, and quick actions."
      />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <StatsCard key={s.label} label={s.label} value={s.value.toLocaleString()} icon={s.icon} accent={s.accent} />
        ))}
      </div>

      <div className="mb-8">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => (
            <Link
              key={action.to}
              to={action.to}
              className="group flex items-start gap-4 rounded-2xl border border-slate-700/80 bg-slate-800/40 p-4 transition hover:border-slate-600 hover:bg-slate-800/70"
            >
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${action.color}`}>
                {action.icon}
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-white group-hover:text-red-300 transition">{action.label}</p>
                <p className="mt-0.5 text-xs text-slate-500">{action.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Recent Users" description="Latest registered accounts" />
          <div className="space-y-1">
            {(data?.recentUsers as { name: string; email: string }[] | undefined)?.length ? (
              (data?.recentUsers as { name: string; email: string }[]).map((u, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-xl px-3 py-2.5 transition hover:bg-slate-900/40"
                >
                  <span className="text-sm font-medium text-slate-200">{u.name}</span>
                  <span className="truncate text-xs text-slate-500">{u.email}</span>
                </div>
              ))
            ) : (
              <p className="py-6 text-center text-sm text-slate-500">No users yet</p>
            )}
          </div>
          <div className="mt-4 border-t border-slate-700/60 pt-4">
            <Link to="/users">
              <Button variant="ghost" size="sm">View all users</Button>
            </Link>
          </div>
        </Card>

        <Card>
          <CardHeader title="Popular Movies" description="Top rated content on platform" />
          <div className="space-y-1">
            {(data?.popularMovies as { title: string; rating: number }[] | undefined)?.length ? (
              (data?.popularMovies as { title: string; rating: number }[]).map((m, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-xl px-3 py-2.5 transition hover:bg-slate-900/40"
                >
                  <span className="text-sm font-medium text-slate-200">{m.title}</span>
                  <span className="text-sm font-semibold text-amber-400">★ {m.rating?.toFixed(1)}</span>
                </div>
              ))
            ) : (
              <p className="py-6 text-center text-sm text-slate-500">No movies yet</p>
            )}
          </div>
          <div className="mt-4 border-t border-slate-700/60 pt-4">
            <Link to="/movies">
              <Button variant="ghost" size="sm">View all movies</Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
