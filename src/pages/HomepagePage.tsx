import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { getTmdbImageUrl } from '../lib/shared';
import {
  IconHome,
  IconPlus,
  IconEdit,
  IconTrash,
  IconArrowUp,
  IconArrowDown,
  IconExternalLink,
  IconClose,
  IconFilm,
  IconSearch,
} from '../components/ui/icons';

interface MovieItem {
  id: string;
  title: string;
  posterPath?: string | null;
  releaseDate?: string | null;
  rating?: number | null;
  status?: string;
}

interface HomepageSectionItem {
  id: string;
  title: string;
  type: string;
  order: number;
  isActive: boolean;
  mode: 'AUTO' | 'MANUAL';
  config?: Record<string, unknown> | null;
  movies?: { movie: MovieItem; order: number }[];
}

export function HomepagePage() {
  const queryClient = useQueryClient();

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSection, setEditingSection] = useState<HomepageSectionItem | null>(null);
  const [managingMoviesSection, setManagingMoviesSection] = useState<HomepageSectionItem | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form states
  const [form, setForm] = useState({
    title: '',
    type: 'trending',
    mode: 'AUTO' as 'AUTO' | 'MANUAL',
    order: 0,
    isActive: true,
  });

  // Movie management state
  const [selectedMovieIds, setSelectedMovieIds] = useState<string[]>([]);
  const [movieSearchQuery, setMovieSearchQuery] = useState('');

  // 1. Fetch homepage sections
  const { data: sections, isLoading } = useQuery<HomepageSectionItem[]>({
    queryKey: ['admin-homepage'],
    queryFn: async () => {
      const { data } = await api.get('/admin/homepage');
      return data;
    },
  });

  // 2. Fetch full movies list for the movie picker
  const { data: moviesData } = useQuery<{ data: MovieItem[] }>({
    queryKey: ['admin-movies-all'],
    queryFn: async () => {
      const { data } = await api.get('/admin/movies?limit=200');
      return data;
    },
    enabled: !!managingMoviesSection,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: typeof form) => api.post('/admin/homepage', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-homepage'] });
      setShowAddModal(false);
      setForm({ title: '', type: 'trending', mode: 'AUTO', order: 0, isActive: true });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<HomepageSectionItem> }) =>
      api.patch(`/admin/homepage/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-homepage'] });
      setEditingSection(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/homepage/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-homepage'] });
      setDeleteConfirmId(null);
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (reordered: { id: string; order: number }[]) =>
      api.post('/admin/homepage/reorder', { sections: reordered }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-homepage'] }),
  });

  const setMoviesMutation = useMutation({
    mutationFn: ({ sectionId, movieIds }: { sectionId: string; movieIds: string[] }) =>
      api.post(`/admin/homepage/${sectionId}/movies`, { movieIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-homepage'] });
      setManagingMoviesSection(null);
    },
  });

  // Helper functions
  const openAddModal = () => {
    const nextOrder = (sections?.length ?? 0) + 1;
    setForm({ title: '', type: 'custom', mode: 'MANUAL', order: nextOrder, isActive: true });
    setShowAddModal(true);
  };

  const openEditModal = (sec: HomepageSectionItem) => {
    setEditingSection(sec);
    setForm({
      title: sec.title,
      type: sec.type,
      mode: sec.mode,
      order: sec.order,
      isActive: sec.isActive,
    });
  };

  const openManageMovies = (sec: HomepageSectionItem) => {
    setManagingMoviesSection(sec);
    const existingIds = sec.movies?.map((m) => m.movie.id) || [];
    setSelectedMovieIds(existingIds);
    setMovieSearchQuery('');
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    if (!sections) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sections.length) return;

    const list = [...sections];
    const [moved] = list.splice(index, 1);
    list.splice(targetIndex, 0, moved);

    const reordered = list.map((item, idx) => ({ id: item.id, order: idx + 1 }));
    reorderMutation.mutate(reordered);
  };

  const toggleMovieSelection = (movieId: string) => {
    setSelectedMovieIds((prev) =>
      prev.includes(movieId) ? prev.filter((id) => id !== movieId) : [...prev, movieId]
    );
  };

  const allMoviesList = moviesData?.data || [];
  const filteredMoviesForPicker = allMoviesList.filter((m) =>
    m.title.toLowerCase().includes(movieSearchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">Homepage CMS</h1>
            <span className="rounded-full bg-red-600/20 px-2.5 py-0.5 text-xs font-bold text-red-400 border border-red-500/30">
              {sections?.length ?? 0} Sections
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Control the layout, movie rows, and content modes shown on the Website Homepage.
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
            onClick={openAddModal}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-red-600/25 hover:bg-red-700 transition"
          >
            <IconPlus className="h-4 w-4" />
            <span>Add Section</span>
          </button>
        </div>
      </div>

      {/* Guidance Banner */}
      <div className="rounded-xl border border-purple-500/20 bg-purple-950/20 p-4 text-xs text-purple-300 flex items-start gap-3">
        <div className="mt-0.5 rounded-md bg-purple-600/30 p-1.5 text-purple-400">
          <IconHome className="h-4 w-4" />
        </div>
        <div>
          <span className="font-bold text-purple-200">How Homepage Rows Work:</span>
          <p className="mt-0.5 text-purple-300/80">
            Sections appear on <strong className="text-white">https://flowlab.fun</strong> in the exact order shown below. Use the <span className="font-semibold text-white">↑</span> and <span className="font-semibold text-white">↓</span> buttons to reorder rows. In <strong className="text-white">Manual</strong> mode, click <em>&quot;Manage Movies&quot;</em> to choose specific movies for that section.
          </p>
        </div>
      </div>

      {/* Sections List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-slate-800 animate-pulse" />
          ))}
        </div>
      ) : sections && sections.length > 0 ? (
        <div className="space-y-3">
          {sections.map((sec, index) => {
            const movieCount = sec.movies?.length || 0;
            return (
              <div
                key={sec.id}
                className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900 p-4 sm:flex-row sm:items-center sm:justify-between hover:border-slate-700 transition"
              >
                {/* Left: Reorder & Title Info */}
                <div className="flex items-center gap-4">
                  {/* Reorder Up/Down */}
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => handleMove(index, 'up')}
                      disabled={index === 0 || reorderMutation.isPending}
                      className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-30"
                      title="Move Section Up"
                    >
                      <IconArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleMove(index, 'down')}
                      disabled={index === sections.length - 1 || reorderMutation.isPending}
                      className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-30"
                      title="Move Section Down"
                    >
                      <IconArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Section Details */}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-800 font-mono text-xs font-bold text-slate-300">
                        {index + 1}
                      </span>
                      <h3 className="text-base font-bold text-white">{sec.title}</h3>
                      <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-400 uppercase">
                        {sec.type}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
                      <span>
                        Mode:{' '}
                        <strong className={sec.mode === 'MANUAL' ? 'text-amber-400' : 'text-cyan-400'}>
                          {sec.mode === 'MANUAL' ? 'Manual Curated' : 'Auto (Dynamic)'}
                        </strong>
                      </span>
                      <span>·</span>
                      <span>
                        {sec.mode === 'MANUAL' ? `${movieCount} movies chosen` : 'Auto-populated'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  {/* Mode Toggle Selector */}
                  <select
                    value={sec.mode}
                    onChange={(e) =>
                      updateMutation.mutate({
                        id: sec.id,
                        data: { mode: e.target.value as 'AUTO' | 'MANUAL' },
                      })
                    }
                    className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-200 focus:border-red-500 focus:outline-none"
                  >
                    <option value="AUTO">Auto (Genre/Trending)</option>
                    <option value="MANUAL">Manual Curated</option>
                  </select>

                  {/* Manage Movies Button (Always accessible or prominent in Manual) */}
                  <button
                    onClick={() => openManageMovies(sec)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      sec.mode === 'MANUAL'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30'
                        : 'border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <IconFilm className="h-3.5 w-3.5" />
                    <span>Select Movies ({movieCount})</span>
                  </button>

                  {/* Visibility Toggle Button */}
                  <button
                    onClick={() =>
                      updateMutation.mutate({ id: sec.id, data: { isActive: !sec.isActive } })
                    }
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      sec.isActive
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-900'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    {sec.isActive ? '● Visible' : '○ Hidden'}
                  </button>

                  {/* Edit Button */}
                  <button
                    onClick={() => openEditModal(sec)}
                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
                    title="Edit Section Title & Type"
                  >
                    <IconEdit className="h-4 w-4" />
                  </button>

                  {/* Delete Button */}
                  <button
                    onClick={() => setDeleteConfirmId(sec.id)}
                    className="rounded-lg p-2 text-red-400 hover:bg-red-950/40 transition"
                    title="Delete Section"
                  >
                    <IconTrash className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-12 text-center">
          <div className="rounded-full bg-slate-800 p-4 text-slate-400">
            <IconHome className="h-8 w-8" />
          </div>
          <h3 className="mt-4 text-lg font-bold text-white">No Homepage Sections</h3>
          <p className="mt-1 max-w-sm text-xs text-slate-400">
            Add your first section to organize movies into categories, trending rows, or custom collections on the website homepage.
          </p>
          <button
            onClick={openAddModal}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-red-700 transition"
          >
            <IconPlus className="h-4 w-4" />
            <span>Add First Section</span>
          </button>
        </div>
      )}

      {/* Add / Edit Section Modal */}
      {(showAddModal || editingSection) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-lg font-bold text-white">
                {editingSection ? 'Edit Homepage Section' : 'Add New Homepage Section'}
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingSection(null);
                }}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <IconClose className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300">
                  Section Display Title *
                </label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. 🌟 UrduBox Exclusives or 🔥 Top Hits"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-red-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300">
                  Section Type / Slug *
                </label>
                <input
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                  placeholder="e.g. urdubox, action, trending, scifi"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-red-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300">Content Mode</label>
                <select
                  value={form.mode}
                  onChange={(e) => setForm({ ...form, mode: e.target.value as 'AUTO' | 'MANUAL' })}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm text-white focus:border-red-500 focus:outline-none"
                >
                  <option value="AUTO">Auto (Dynamic by Genre / Trending)</option>
                  <option value="MANUAL">Manual (Select specific movies)</option>
                </select>
                <p className="mt-1 text-[11px] text-slate-400">
                  {form.mode === 'MANUAL'
                    ? 'In Manual mode, you can hand-pick which exact movies appear in this row.'
                    : 'Auto mode automatically shows movies matching the section type or genre.'}
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="sectionActive"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-red-600 focus:ring-0 cursor-pointer"
                />
                <label htmlFor="sectionActive" className="text-sm text-slate-300 cursor-pointer">
                  Visible on Website Homepage
                </label>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-800 pt-4">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingSection(null);
                }}
                className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (editingSection) {
                    updateMutation.mutate({ id: editingSection.id, data: form });
                  } else {
                    createMutation.mutate(form);
                  }
                }}
                disabled={!form.title || !form.type}
                className="rounded-lg bg-red-600 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-red-600/30 hover:bg-red-700 disabled:opacity-50 transition"
              >
                {editingSection ? 'Save Changes' : 'Create Section'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Movies Modal (Curate Movies for Section) */}
      {managingMoviesSection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-fadeIn">
          <div className="flex h-[85vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-white">
                  Manage Movies in &quot;{managingMoviesSection.title}&quot;
                </h3>
                <p className="text-xs text-slate-400">
                  Select which movies appear in this homepage row ({selectedMovieIds.length} currently selected).
                </p>
              </div>
              <button
                onClick={() => setManagingMoviesSection(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <IconClose className="h-5 w-5" />
              </button>
            </div>

            {/* Search Bar */}
            <div className="border-b border-slate-800 px-6 py-3">
              <div className="relative">
                <IconSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  value={movieSearchQuery}
                  onChange={(e) => setMovieSearchQuery(e.target.value)}
                  placeholder="Search movies by title..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/90 pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:border-red-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Movies Selection Grid */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {filteredMoviesForPicker.map((m) => {
                  const isSelected = selectedMovieIds.includes(m.id);
                  const poster = getTmdbImageUrl(m.posterPath, 'w185');
                  return (
                    <div
                      key={m.id}
                      onClick={() => toggleMovieSelection(m.id)}
                      className={`group relative flex flex-col overflow-hidden rounded-xl border cursor-pointer transition-all duration-150 ${
                        isSelected
                          ? 'border-red-500 bg-red-950/20 ring-2 ring-red-500/40 scale-102'
                          : 'border-slate-800 bg-slate-800/60 hover:border-slate-700'
                      }`}
                    >
                      {/* Poster */}
                      <div className="relative aspect-[2/3] w-full overflow-hidden bg-slate-950">
                        {poster ? (
                          <img
                            src={poster}
                            alt={m.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-slate-600">
                            <IconFilm className="h-8 w-8 opacity-40" />
                          </div>
                        )}

                        {/* Checkbox badge */}
                        <div className="absolute right-2 top-2">
                          <span
                            className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                              isSelected
                                ? 'bg-red-600 text-white shadow'
                                : 'bg-black/60 text-transparent border border-white/30'
                            }`}
                          >
                            ✓
                          </span>
                        </div>
                      </div>

                      {/* Title */}
                      <div className="p-2">
                        <p className="text-xs font-semibold text-white line-clamp-1">{m.title}</p>
                        {m.releaseDate && (
                          <p className="text-[10px] text-slate-400">{m.releaseDate.split('-')[0]}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-slate-800 px-6 py-4">
              <span className="text-xs text-slate-400">
                <strong className="text-white">{selectedMovieIds.length}</strong> movies will be displayed in this section.
              </span>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setManagingMoviesSection(null)}
                  className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setMoviesMutation.mutate({
                      sectionId: managingMoviesSection.id,
                      movieIds: selectedMovieIds,
                    });
                  }}
                  disabled={setMoviesMutation.isPending}
                  className="rounded-lg bg-red-600 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-red-600/30 hover:bg-red-700 transition"
                >
                  {setMoviesMutation.isPending ? 'Saving...' : 'Save Selected Movies'}
                </button>
              </div>
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
            <h3 className="mt-4 text-base font-bold text-white">Delete this Section?</h3>
            <p className="mt-1 text-xs text-slate-400">
              This row will be removed from the homepage.
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
