import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminLayout } from './components/AdminLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { MoviesPage } from './pages/MoviesPage';
import { MovieNewPage } from './pages/MovieNewPage';
import { MovieEditPage } from './pages/MovieEditPage';
import { HomepagePage } from './pages/HomepagePage';
import { BannersPage } from './pages/BannersPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { UsersPage } from './pages/UsersPage';
import { SyncPage } from './pages/SyncPage';
import { ContentImportPage } from './pages/ContentImportPage';
import { SeriesPage } from './pages/SeriesPage';
import { AutomationPage } from './pages/AutomationPage';
import { ContentLibraryPage } from './pages/ContentLibraryPage';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="movies" element={<MoviesPage />} />
            <Route path="movies/new" element={<MovieNewPage />} />
            <Route path="movies/:id/edit" element={<MovieEditPage />} />
            <Route path="series" element={<SeriesPage mode="series" />} />
            <Route path="anime" element={<SeriesPage mode="anime" />} />
            <Route path="homepage" element={<HomepagePage />} />
            <Route path="banners" element={<BannersPage />} />
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="automation" element={<AutomationPage />} />
            <Route path="content/library" element={<ContentLibraryPage />} />
            <Route path="sync" element={<SyncPage />} />
            <Route path="content/import" element={<ContentImportPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
