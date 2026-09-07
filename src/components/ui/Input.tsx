import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

export function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-1.5">
      <label className="block text-sm font-medium text-slate-300">{children}</label>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

const fieldClass =
  'w-full rounded-xl border border-slate-600/80 bg-slate-900/50 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20 disabled:opacity-50';

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${fieldClass} ${className}`} {...props} />;
}

export function Select({ className = '', children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${fieldClass} ${className}`} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${fieldClass} min-h-[100px] resize-y ${className}`} {...props} />;
}
