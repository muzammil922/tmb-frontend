type AlertVariant = 'success' | 'error' | 'warning' | 'info';

const styles: Record<AlertVariant, string> = {
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  error: 'border-red-500/30 bg-red-500/10 text-red-200',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  info: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
};

export function Alert({ variant, children }: { variant: AlertVariant; children: React.ReactNode }) {
  return (
    <div className={`mb-6 rounded-xl border px-4 py-3 text-sm leading-relaxed ${styles[variant]}`}>
      {children}
    </div>
  );
}
