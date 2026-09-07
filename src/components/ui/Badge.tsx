type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';

const styles: Record<BadgeVariant, string> = {
  default: 'bg-slate-700/80 text-slate-200',
  success: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30',
  warning: 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30',
  danger: 'bg-red-500/15 text-red-300 ring-1 ring-red-500/30',
  info: 'bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30',
  purple: 'bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/30',
};

export function Badge({ children, variant = 'default' }: { children: React.ReactNode; variant?: BadgeVariant }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[variant]}`}>
      {children}
    </span>
  );
}
