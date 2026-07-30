import { SelectHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'h-9 rounded-lg border border-slate-50/10 bg-slate-800/60 px-3 text-sm text-slate-50 backdrop-blur-md transition-colors focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/30',
        className,
      )}
      {...props}
    />
  ),
);
Select.displayName = 'Select';
