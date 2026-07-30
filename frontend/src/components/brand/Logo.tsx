import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  markClassName?: string;
  showWordmark?: boolean;
}

// Marca AVRE — assets generados a partir del logo provisto por el cliente
// (frontend/public/brand/avre-mark.png, recortado y con fondo transparente).
export function Logo({ className, markClassName, showWordmark = true }: LogoProps) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <img
        src="/brand/avre-mark.png"
        alt="AVRE"
        className={cn('h-9 w-auto flex-none drop-shadow-[0_2px_10px_rgba(99,102,241,0.45)]', markClassName)}
      />
      {showWordmark && (
        <span className="flex flex-col leading-none">
          <strong className="text-[15px] font-bold tracking-tight">AVRE</strong>
          <span className="mt-0.5 text-[10.5px] uppercase tracking-[0.1em] text-slate-500">
            Capital Group
          </span>
        </span>
      )}
    </div>
  );
}
