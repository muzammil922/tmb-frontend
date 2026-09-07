interface Tab {
  id: string;
  label: string;
  badge?: string | number;
}

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-slate-700/80 bg-slate-900/40 p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
            active === tab.id
              ? 'bg-red-600 text-white shadow-sm'
              : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
          }`}
        >
          {tab.label}
          {tab.badge !== undefined && (
            <span
              className={`rounded-full px-1.5 py-0.5 text-xs ${
                active === tab.id ? 'bg-white/20' : 'bg-slate-700 text-slate-300'
              }`}
            >
              {tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
