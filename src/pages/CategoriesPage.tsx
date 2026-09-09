import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import {
  IconCategory,
  IconPlus,
  IconEdit,
  IconTrash,
  IconSync,
  IconClose,
  IconExternalLink,
} from '../components/ui/icons';

interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  movies?: { movie: unknown }[];
}

export function CategoriesPage() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
  const [form, setForm] = useState({ name: '', slug: '', description: '' });
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const { data: categories, isLoading } = useQuery<CategoryItem[]>({
    queryKey: ['admin-categories'],
    queryFn: async () => {
      const { data } = await api.get('/admin/categories');
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingCategory) {
        return api.patch(`/admin/categories/${editingCategory.id}`, form);
      }
      return api.post('/admin/categories', form);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      closeModal();
    },
  });

  const seedDefaultsMutation = useMutation({
    mutationFn: () => api.post('/admin/categories/seed', {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-categories'] }),
  });

  const [autoCategorizeMsg, setAutoCategorizeMsg] = useState<string | null>(null);

  const autoCategorizeMutation = useMutation({
    mutationFn: () => api.post('/admin/categories/auto-categorize', {}),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      setAutoCategorizeMsg(res.data?.message || 'Movies successfully categorized!');
      setTimeout(() => setAutoCategorizeMsg(null), 6000);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      setDeleteConfirmId(null);
    },
  });

  const openAdd = () => {
    setEditingCategory(null);
    setForm({ name: '', slug: '', description: '' });
    setShowAddModal(true);
  };

  const openEdit = (cat: CategoryItem) => {
    setEditingCategory(cat);
    setForm({
      name: cat.name,
      slug: cat.slug,
      description: cat.description || '',
    });
    setShowAddModal(true);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingCategory(null);
    setForm({ name: '', slug: '', description: '' });
  };

  const handleNameChange = (name: string) => {
    const slug = name.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
    setForm((prev) => ({ ...prev, name, slug: editingCategory ? prev.slug : slug }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">Movie Categories</h1>
            <span className="rounded-full bg-red-600/20 px-2.5 py-0.5 text-xs font-bold text-red-400 border border-red-500/30">
              {categories?.length ?? 0} Categories
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Organize movies into browsable genres, industry catalogs, and UrduBox collections for the website.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => autoCategorizeMutation.mutate()}
            disabled={autoCategorizeMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-xs font-bold text-amber-300 hover:bg-amber-500/20 transition disabled:opacity-50 shadow-sm"
            title="Automatically scan all movies and map them to matching categories based on genres, language, and UrduBox source"
          >
            <IconSync className={`h-3.5 w-3.5 text-amber-400 ${autoCategorizeMutation.isPending ? 'animate-spin' : ''}`} />
            <span>{autoCategorizeMutation.isPending ? 'Categorizing...' : '⚡ Auto-Categorize All Movies'}</span>
          </button>

          <button
            onClick={() => seedDefaultsMutation.mutate()}
            disabled={seedDefaultsMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition disabled:opacity-50"
            title="Import standard website categories (Action, Sci-Fi, UrduBox, Drama, etc.)"
          >
            <IconSync className={`h-3.5 w-3.5 text-slate-400 ${seedDefaultsMutation.isPending ? 'animate-spin' : ''}`} />
            <span>{seedDefaultsMutation.isPending ? 'Populating...' : 'Default Categories'}</span>
          </button>

          <button
            onClick={openAdd}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-red-600/25 hover:bg-red-700 transition"
          >
            <IconPlus className="h-4 w-4" />
            <span>Add Category</span>
          </button>
        </div>
      </div>

      {/* Auto-categorize Success Notification */}
      {autoCategorizeMsg && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-3.5 text-xs text-emerald-200 flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 font-bold">✓</span>
            <span className="font-semibold">{autoCategorizeMsg}</span>
          </div>
          <button onClick={() => setAutoCategorizeMsg(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Website Category Explainer */}
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-4 text-xs text-emerald-300 flex items-start gap-3">
        <div className="mt-0.5 rounded-md bg-emerald-600/30 p-1.5 text-emerald-400">
          <IconCategory className="h-4 w-4" />
        </div>
        <div>
          <span className="font-bold text-emerald-200">Live Website Integration:</span>
          <p className="mt-0.5 text-emerald-300/80">
            Categories defined here appear under the Browse Catalog filters on <a href="https://flowlab.fun/movies" target="_blank" rel="noopener noreferrer" className="underline font-semibold text-white inline-flex items-center gap-1">https://flowlab.fun/movies <IconExternalLink className="h-3 w-3" /></a>.
          </p>
        </div>
      </div>

      {/* Categories Grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-36 rounded-xl bg-slate-800 animate-pulse" />
          ))}
        </div>
      ) : categories && categories.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => (
            <div
              key={c.id}
              className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-lg hover:border-slate-700 transition"
            >
              <div>
                <div className="flex items-start justify-between">
                  <h3 className="text-base font-bold text-white">{c.name}</h3>
                  <span className="rounded-md bg-slate-800 px-2 py-0.5 font-mono text-[11px] text-slate-400">
                    /{c.slug}
                  </span>
                </div>
                {c.description && (
                  <p className="mt-2 text-xs text-slate-400 line-clamp-2">{c.description}</p>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-3">
                <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-semibold text-slate-300">
                  {c.movies?.length ?? 0} movies linked
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEdit(c)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
                    title="Edit Category"
                  >
                    <IconEdit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(c.id)}
                    className="rounded-lg p-1.5 text-red-400 hover:bg-red-950/40 transition"
                    title="Delete Category"
                  >
                    <IconTrash className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Empty State with one-click seed button */
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-12 text-center">
          <div className="rounded-full bg-slate-800 p-4 text-slate-400">
            <IconCategory className="h-8 w-8" />
          </div>
          <h3 className="mt-4 text-lg font-bold text-white">No Categories Available</h3>
          <p className="mt-1 max-w-md text-xs text-slate-400">
            Click &quot;Populate Default Categories&quot; to immediately import standard genres and categories (Trending, Action, Sci-Fi, Drama, UrduBox Exclusives, Hindi Dubbed).
          </p>
          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={() => seedDefaultsMutation.mutate()}
              disabled={seedDefaultsMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-red-700 transition shadow-lg shadow-red-600/30"
            >
              <IconSync className="h-4 w-4" />
              <span>Populate Default Categories</span>
            </button>
            <button
              onClick={openAdd}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white"
            >
              <IconPlus className="h-4 w-4" />
              <span>Custom Category</span>
            </button>
          </div>
        </div>
      )}

      {/* Add / Edit Category Modal */}
      {(showAddModal || editingCategory) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-lg font-bold text-white">
                {editingCategory ? 'Edit Category' : 'Create New Category'}
              </h3>
              <button onClick={closeModal} className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white">
                <IconClose className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300">Category Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. 🌟 UrduBox Exclusives or Hindi Dubbed"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-red-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300">URL Slug *</label>
                <input
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder="e.g. urdubox-exclusives"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-red-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Short description for visitors..."
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-red-500 focus:outline-none resize-none"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-800 pt-4">
              <button onClick={closeModal} className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800">
                Cancel
              </button>
              <button
                onClick={() => saveMutation.mutate()}
                disabled={!form.name || !form.slug || saveMutation.isPending}
                className="rounded-lg bg-red-600 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-red-600/30 hover:bg-red-700 disabled:opacity-50 transition"
              >
                {saveMutation.isPending ? 'Saving...' : editingCategory ? 'Save Changes' : 'Create Category'}
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
            <h3 className="mt-4 text-base font-bold text-white">Delete this Category?</h3>
            <p className="mt-1 text-xs text-slate-400">
              This category will be deleted. Movies associated with it will remain safe in the library.
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <button onClick={() => setDeleteConfirmId(null)} className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800">
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
