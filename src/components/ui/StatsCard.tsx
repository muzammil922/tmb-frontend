import type { ReactNode } from 'react';

export function StatsCard({
  label,
  value,
  icon,
  trend,
  accent = 'red',
}: {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: string;
  accent?: 'red' | 'emerald' | 'sky' | 'amber';
}) {
  const accentMap = {
    red: 'from-red-600/20 to-transparent text-red-400',
    emerald: 'from-emerald-600/20 to-transparent text-emerald-400',
    sky: 'from-sky-600/20 to-transparent text-sky-400',
    amber: 'from-amber-600/20 to-transparent text-amber-400',
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-800/60 p-5">
      <div className={`absolute inset-0 bg-gradient-to-br ${accentMap[accent]} opacity-60`} />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-white">{value}</p>
          {trend && <p className="mt-1 text-xs text-slate-500">{trend}</p>}
        </div>
        {icon && <div className={`rounded-xl bg-slate-900/50 p-2.5 ${accentMap[accent].split(' ').pop()}`}>{icon}</div>}
      </div>
    </div>
  );
}
