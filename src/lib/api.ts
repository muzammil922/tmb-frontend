import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminAccessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh token on 401, only logout if refresh also fails
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (
      error.response?.status === 401 &&
      !original._retry &&
      original.url !== '/auth/refresh'
    ) {
      original._retry = true;
      const refreshToken = localStorage.getItem('adminRefreshToken');
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${API_URL}/auth/refresh`, {
            refreshToken,
          });
          const newAccess = data.tokens?.accessToken ?? data.accessToken;
          const newRefresh = data.tokens?.refreshToken ?? data.refreshToken;
          localStorage.setItem('adminAccessToken', newAccess);
          if (newRefresh) localStorage.setItem('adminRefreshToken', newRefresh);
          original.headers.Authorization = `Bearer ${newAccess}`;
          return api(original);
        } catch {
          // Refresh failed — clear tokens and redirect to login
          localStorage.removeItem('adminAccessToken');
          localStorage.removeItem('adminRefreshToken');
          // Clear zustand persisted auth state
          localStorage.removeItem('tmb-admin-auth');
          window.location.href = '/login';
        }
      } else {
        // No refresh token at all — go to login
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export default api;
