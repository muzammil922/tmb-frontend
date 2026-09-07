import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/auth';

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/movies', label: 'Movies' },
  { to: '/sync', label: 'Content Sync' },
  { to: '/content/import', label: 'Import Content' },
  { to: '/homepage', label: 'Homepage' },
  { to: '/banners', label: 'Banners' },
  { to: '/categories', label: 'Categories' },
  { to: '/users', label: 'Users' },
];

export function AdminLayout() {
  const location = useLocation();
  const { user, logout } = useAuthStore();

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 flex-shrink-0 border-r border-slate-700 bg-slate-900 p-6">
        <h1 className="mb-8 text-xl font-bold text-red-500">TMB Admin</h1>
        <nav className="space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`block rounded px-3 py-2 text-sm transition ${
                location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to))
                  ? 'bg-red-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto pt-8">
          <p className="text-xs text-slate-500">{user?.email}</p>
          <button onClick={logout} className="mt-2 text-sm text-red-400 hover:underline">
            Logout
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}
