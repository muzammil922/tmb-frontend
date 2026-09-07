import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useAuthStore } from '../store/auth';
import { Button } from '../components/ui/Button';
import { Input, Label } from '../components/ui/Input';
import { Alert } from '../components/ui/Alert';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    <div className="flex min-h-screen items-center justify-center bg-[#0b1120] px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-600 text-xl font-bold text-white shadow-lg shadow-red-900/40">
            T
          </span>
          <h1 className="text-2xl font-bold text-white">TMB Admin</h1>
          <p className="mt-1 text-sm text-slate-400">Sign in to manage your content</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-700/80 bg-slate-800/60 p-8 shadow-xl backdrop-blur-sm">
          {error && <Alert variant="error">{error}</Alert>}
          <div className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                required
              />
            </div>
            <div>
              <Label>Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full" size="lg">
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
