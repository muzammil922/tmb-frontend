import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost' | 'outline';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

const variants: Record<Variant, string> = {
  primary: 'bg-red-600 text-white hover:bg-red-500 shadow-sm shadow-red-900/30',
  secondary: 'bg-slate-700 text-white hover:bg-slate-600',
  success: 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm shadow-emerald-900/30',
  danger: 'bg-red-700 text-white hover:bg-red-600',
  ghost: 'text-slate-300 hover:bg-slate-700/60 hover:text-white',
  outline: 'border border-slate-600 text-slate-200 hover:border-slate-500 hover:bg-slate-800',
};

const sizes: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2.5 text-sm gap-2',
  lg: 'px-5 py-3 text-sm gap-2',
};

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-xl font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
