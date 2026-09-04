import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/lib/shared';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      setAuth: (user, accessToken, refreshToken) => {
        localStorage.setItem('adminAccessToken', accessToken);
        localStorage.setItem('adminRefreshToken', refreshToken);
        set({ user, accessToken });
      },
      logout: () => {
        localStorage.removeItem('adminAccessToken');
        localStorage.removeItem('adminRefreshToken');
        set({ user: null, accessToken: null });
      },
    }),
    { name: 'tmb-admin-auth' },
  ),
);
