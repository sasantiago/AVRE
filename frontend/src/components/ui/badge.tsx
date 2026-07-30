import { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type BadgeTone = 'default' | 'success' | 'warning' | 'danger' | 'muted';

const TONE_CLASSES: Record<BadgeTone, string> = {
  default: 'border-indigo-500/30 bg-indigo-500/15 text-indigo-300',
  success: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300',
  warning: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
  danger: 'border-rose-500/30 bg-rose-500/15 text-rose-300',
  muted: 'border-slate-50/10 bg-slate-800/60 text-slate-400',
};

export function Badge({
  className,
  tone = 'default',
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        TONE_CLASSES[tone],
        className,
      )}
      {...props}
    />
  );
}
