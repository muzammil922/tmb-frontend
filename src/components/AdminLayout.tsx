import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import {
  IconBanner,
  IconCategory,
  IconClose,
  IconDashboard,
  IconFilm,
  IconHome,
  IconImport,
  IconLogout,
  IconMenu,
  IconSync,
  IconUsers,
} from './ui/icons';

type NavItem = { to: string; label: string; icon: React.ReactNode };

const navGroups: { title: string; items: NavItem[] }[] = [
  {
    title: 'Overview',
    items: [{ to: '/', label: 'Dashboard', icon: <IconDashboard /> }],
  },
  {
    title: 'Content',
    items: [
      { to: '/movies', label: 'Movies', icon: <IconFilm /> },
      { to: '/sync', label: 'Content Sync', icon: <IconSync /> },
      { to: '/content/import', label: 'Import Content', icon: <IconImport /> },
    ],
  },
  {
    title: 'Site',
    items: [
      { to: '/homepage', label: 'Homepage', icon: <IconHome /> },
      { to: '/banners', label: 'Banners', icon: <IconBanner /> },
      { to: '/categories', label: 'Categories', icon: <IconCategory /> },
    ],
  },
  {
    title: 'Admin',
    items: [{ to: '/users', label: 'Users', icon: <IconUsers /> }],
  },
];

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/movies': 'Movies',
  '/movies/new': 'Add Movie',
  '/sync': 'Content Sync',
  '/content/import': 'Import Content',
  '/homepage': 'Homepage',
  '/banners': 'Banners',
  '/categories': 'Categories',
  '/users': 'Users',
};

function getPageTitle(pathname: string) {
  if (pathname.match(/^\/movies\/[^/]+\/edit$/)) return 'Edit Movie';
  return pageTitles[pathname] ?? 'Admin';
}

function isActive(pathname: string, to: string) {
  if (to === '/') return pathname === '/';
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function AdminLayout() {
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const pageTitle = getPageTitle(location.pathname);

  const sidebar = (
    <aside className="flex h-full w-64 flex-col border-r border-slate-700/80 bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-700/60 px-5 py-5">
        <Link to="/" className="flex items-center gap-2.5" onClick={() => setSidebarOpen(false)}>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-600 text-sm font-bold text-white shadow-lg shadow-red-900/40">
            T
          </span>
          <div>
            <p className="text-sm font-bold text-white">TMB Admin</p>
            <p className="text-[11px] text-slate-500">Content Manager</p>
          </div>
        </Link>
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 lg:hidden"
          aria-label="Close menu"
        >
          <IconClose />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {navGroups.map((group) => (
          <div key={group.title} className="mb-5">
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {group.title}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(location.pathname, item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                      active
                        ? 'bg-red-600 text-white shadow-sm shadow-red-900/30'
                        : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                    }`}
                  >
                    <span className={active ? 'text-white' : 'text-slate-500'}>{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-700/60 p-4">
        <div className="rounded-xl bg-slate-800/60 p-3">
          <p className="truncate text-xs font-medium text-slate-300">{user?.name || 'Admin'}</p>
          <p className="truncate text-[11px] text-slate-500">{user?.email}</p>
          <button
            onClick={logout}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-600/80 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300"
          >
            <IconLogout className="h-4 w-4" />
            Logout
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen bg-[#0b1120]">
      {/* Desktop sidebar */}
      <div className="hidden lg:block lg:fixed lg:inset-y-0 lg:left-0 lg:z-30">{sidebar}</div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="absolute inset-y-0 left-0 z-50 shadow-2xl">{sidebar}</div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        {/* Top header */}
        <header className="sticky top-0 z-20 border-b border-slate-700/60 bg-[#0b1120]/90 backdrop-blur-md">
          <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="rounded-xl border border-slate-700/80 p-2 text-slate-400 hover:bg-slate-800 lg:hidden"
                aria-label="Open menu"
              >
                <IconMenu />
              </button>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Admin Panel</p>
                <h2 className="text-lg font-semibold text-white">{pageTitle}</h2>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
