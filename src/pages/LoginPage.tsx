import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useAuthStore } from '../store/auth';

export function LoginPage() {
  const [email, setEmail] = useState('admin@tmb.com');
  const [password, setPassword] = useState('Admin@123456');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/login', { email, password });
      if (data.user.role !== 'ADMIN') {
        setError('Admin access only');
        return;
      }
      setAuth(data.user, data.tokens.accessToken, data.tokens.refreshToken);
      navigate('/');
    } catch {
      setError('Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-xl bg-slate-800 p-8 shadow-xl">
        <h1 className="mb-2 text-2xl font-bold">TMB Admin</h1>
        <p className="mb-6 text-sm text-slate-400">Sign in to manage content</p>
        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded-lg bg-slate-700 px-4 py-3 outline-none focus:ring-2 focus:ring-red-500"
          placeholder="Email"
          required
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-6 w-full rounded-lg bg-slate-700 px-4 py-3 outline-none focus:ring-2 focus:ring-red-500"
          placeholder="Password"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-red-600 py-3 font-semibold hover:bg-red-700 disabled:opacity-50"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
