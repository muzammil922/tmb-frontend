import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import {
  IconBanner,
  IconPlus,
  IconEdit,
  IconTrash,
  IconExternalLink,
  IconClose,
} from '../components/ui/icons';

interface BannerItem {
  id: string;
  title: string;
  subtitle?: string | null;
  imageUrl: string;
  buttonText?: string | null;
  buttonUrl?: string | null;
  isActive: boolean;
  createdAt?: string;
}

const DEFAULT_FORM = {
  title: '',
  subtitle: '',
  imageUrl: '',
  buttonText: 'Watch Now',
  buttonUrl: '/movies',
  isActive: true,
};

export function BannersPage() {
  const [showModal, setShowModal] = useState(false);
  const [editingBanner, setEditingBanner] = useState<BannerItem | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const { data: banners, isLoading } = useQuery<BannerItem[]>({
    queryKey: ['admin-banners'],
    queryFn: async () => {
      const { data } = await api.get('/admin/banners');
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingBanner) {
        return api.patch(`/admin/banners/${editingBanner.id}`, form);
      }
      return api.post('/admin/banners', form);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-banners'] });
      closeModal();
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/admin/banners/${id}`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-banners'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/banners/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-banners'] });
      setDeleteConfirmId(null);
    },
  });

  const openCreate = () => {
    setEditingBanner(null);
    setForm(DEFAULT_FORM);
    setShowModal(true);
  };

  const openEdit = (b: BannerItem) => {
    setEditingBanner(b);
    setForm({
      title: b.title || '',
      subtitle: b.subtitle || '',
      imageUrl: b.imageUrl || '',
      buttonText: b.buttonText || 'Watch Now',
      buttonUrl: b.buttonUrl || '/movies',
      isActive: b.isActive,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingBanner(null);
    setForm(DEFAULT_FORM);
  };

  const activeCount = banners?.filter((b) => b.isActive).length ?? 0;

  return (
    <div className="space-y-6">
      {/* Top Banner & Context Info */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">Homepage Banners</h1>
            <span className="rounded-full bg-red-600/20 px-2.5 py-0.5 text-xs font-bold text-red-400 border border-red-500/30">
              {activeCount} Live on Web
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Promotional banners created here appear in the interactive showcase carousel on the Website Homepage.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="https://flowlab.fun"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition"
          >
            <span>View Website</span>
            <IconExternalLink className="h-3.5 w-3.5 text-slate-400" />
          </a>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-red-600/25 hover:bg-red-700 transition"
          >
            <IconPlus className="h-4 w-4" />
            <span>Add Banner</span>
          </button>
        </div>
      </div>

      {/* Website Placement Explainer Card */}
      <div className="rounded-xl border border-blue-500/20 bg-blue-950/20 p-4 text-xs text-blue-300 flex items-start gap-3">
        <div className="mt-0.5 rounded-md bg-blue-600/30 p-1.5 text-blue-400">
          <IconBanner className="h-4 w-4" />
        </div>
        <div>
          <span className="font-bold text-blue-200">Where do these banners show up?</span>
          <p className="mt-0.5 text-blue-300/80">
            Active banners appear directly on <strong className="text-white">https://flowlab.fun</strong> below the hero section. Visitors can slide between them and click the Call-to-Action button to jump directly to any movie or category.
          </p>
        </div>
      </div>

      {/* Banners Grid */}
      {isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-64 rounded-2xl bg-slate-800 animate-pulse" />
          ))}
        </div>
      ) : banners && banners.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {banners.map((b) => (
            <div
              key={b.id}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-xl transition hover:border-slate-700"
            >
              {/* Banner Visual Preview (16:9 ratio) */}
              <div className="relative aspect-video w-full overflow-hidden bg-slate-950">
                {b.imageUrl ? (
                  <img
                    src={b.imageUrl}
                    alt={b.title}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-slate-800 text-slate-500">
                    <IconBanner className="h-10 w-10 opacity-30" />
                  </div>
                )}

                {/* Dark gradients */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

                {/* Status Badge */}
                <div className="absolute left-3 top-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur-md ${
                      b.isActive
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-slate-700/80 text-slate-400 border border-slate-600/30'
                    }`}
                  >
                    {b.isActive ? '● Live on Web' : '○ Draft / Hidden'}
                  </span>
                </div>

                {/* Overlay Text in preview */}
                <div className="absolute bottom-3 left-3 right-3">
                  <h3 className="text-base font-bold text-white line-clamp-1 drop-shadow-md">
                    {b.title}
                  </h3>
                  {b.subtitle && (
                    <p className="mt-0.5 text-xs text-slate-300 line-clamp-1 drop-shadow">
                      {b.subtitle}
                    </p>
                  )}
                </div>
              </div>

              {/* Card Meta & Controls */}
              <div className="flex flex-1 flex-col justify-between p-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Button CTA:</span>
                    <span className="font-semibold text-white">
                      {b.buttonText || 'Watch Now'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Target URL:</span>
                    <span className="font-mono text-slate-300 truncate max-w-[180px]">
                      {b.buttonUrl || '/movies'}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-3">
                  {/* 1-click Toggle */}
                  <button
                    onClick={() =>
                      toggleStatusMutation.mutate({ id: b.id, isActive: !b.isActive })
                    }
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                      b.isActive
                        ? 'bg-emerald-950 text-emerald-300 hover:bg-emerald-900'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    {b.isActive ? 'Active (Click to Hide)' : 'Hidden (Click to Publish)'}
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEdit(b)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
                      title="Edit Banner"
                    >
                      <IconEdit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(b.id)}
                      className="rounded-lg p-1.5 text-red-400 hover:bg-red-950/40 transition"
                      title="Delete Banner"
                    >
                      <IconTrash className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-12 text-center">
          <div className="rounded-full bg-slate-800 p-4 text-slate-400">
            <IconBanner className="h-8 w-8" />
          </div>
          <h3 className="mt-4 text-lg font-bold text-white">No Homepage Banners Yet</h3>
          <p className="mt-1 max-w-sm text-xs text-slate-400">
            Create promotional banners for special releases, UrduBox premieres, or 4K blockbusters to showcase them on your website homepage.
          </p>
          <button
            onClick={openCreate}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-red-700 transition"
          >
            <IconPlus className="h-4 w-4" />
            <span>Create First Banner</span>
          </button>
        </div>
      )}

      {/* Add / Edit Banner Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-lg font-bold text-white">
                {editingBanner ? 'Edit Homepage Banner' : 'Create New Homepage Banner'}
              </h3>
              <button
                onClick={closeModal}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <IconClose className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300">
                  Banner Title *
                </label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Dune: Part Two - Exclusive Urdu Dubbed"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-red-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300">
                  Subtitle / Promo Text
                </label>
                <input
                  value={form.subtitle}
                  onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                  placeholder="e.g. Experience the sci-fi epic now in 4K Ultra HD"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-red-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300">
                  Image URL (High-res backdrop or poster) *
                </label>
                <input
                  value={form.imageUrl}
                  onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                  placeholder="https://image.tmdb.org/t/p/original/... or https://..."
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-red-500 focus:outline-none"
                />
              </div>

              {/* Real-time Image Preview in Modal */}
              {form.imageUrl && (
                <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
                  <img
                    src={form.imageUrl}
                    alt="Preview"
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3">
                    <span className="rounded-full bg-red-600 px-2 py-0.5 text-[9px] font-bold text-white uppercase tracking-wider">
                      Website Preview
                    </span>
                    <h4 className="mt-1 text-sm font-bold text-white line-clamp-1">
                      {form.title || 'Your Banner Title'}
                    </h4>
                    <p className="text-xs text-zinc-300 line-clamp-1">
                      {form.subtitle || 'Your banner subtitle will appear here.'}
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300">
                    Button Text
                  </label>
                  <input
                    value={form.buttonText}
                    onChange={(e) => setForm({ ...form, buttonText: e.target.value })}
                    placeholder="Watch Now"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-red-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300">
                    Button Target Link
                  </label>
                  <input
                    value={form.buttonUrl}
                    onChange={(e) => setForm({ ...form, buttonUrl: e.target.value })}
                    placeholder="/movies or /movies/:id"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-red-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="bannerActive"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-red-600 focus:ring-0 cursor-pointer"
                />
                <label htmlFor="bannerActive" className="text-sm text-slate-300 cursor-pointer">
                  Publish immediately to Website Homepage (<span className="text-emerald-400 font-semibold">Active</span>)
                </label>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-800 pt-4">
              <button
                onClick={closeModal}
                className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => saveMutation.mutate()}
                disabled={!form.title || !form.imageUrl || saveMutation.isPending}
                className="rounded-lg bg-red-600 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-red-600/30 hover:bg-red-700 disabled:opacity-50 transition"
              >
                {saveMutation.isPending ? 'Saving...' : editingBanner ? 'Update Banner' : 'Create Banner'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center shadow-2xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20 text-red-400">
              <IconTrash className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-base font-bold text-white">Delete this Banner?</h3>
            <p className="mt-1 text-xs text-slate-400">
              This banner will be permanently removed from the website homepage.
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteConfirmId)}
                disabled={deleteMutation.isPending}
                className="rounded-lg bg-red-600 px-5 py-2 text-xs font-bold text-white hover:bg-red-700"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
