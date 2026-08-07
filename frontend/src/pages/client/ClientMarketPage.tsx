import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { ShoppingCart, X } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { MarketTreemap } from '@/components/market/MarketTreemap';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiFetch, ApiError } from '@/lib/api-client';
import { TenantInstrumentWithQuote } from '@/lib/types';

const GeometricOrb = lazy(() =>
  import('@/components/three/GeometricOrb').then((m) => ({ default: m.GeometricOrb })),
);

const usd = (n: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD' }).format(n);

interface CartItem {
  ti: TenantInstrumentWithQuote;
  amountUsd: string;
}

interface CartResult {
  symbol: string;
  ok: boolean;
  message: string;
}

// Botón de carrito fijo arriba — abre el panel glassmorphism con la orden.
function CartButton({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="relative flex h-12 w-12 items-center justify-center rounded-full border border-slate-50/15 bg-slate-800/60 text-slate-100 shadow-lg shadow-slate-900/40 backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-500/40"
      aria-label={`Carrito, ${count} instrumento${count !== 1 ? 's' : ''}`}
    >
      <ShoppingCart size={20} />
      {count > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-500 px-1 text-[11px] font-bold text-white">
          {count}
        </span>
      )}
    </button>
  );
}

// Modal glassmorphism: fondo esmerilado (backdrop-blur), panel translúcido con
// borde de luz y sombra profunda para dar sensación de vidrio flotando en 3D.
function CartModal({
  cart,
  cartTotal,
  canCheckout,
  checkingOut,
  results,
  onClose,
  onRemove,
  onUpdateAmount,
  onCheckoutAll,
}: {
  cart: CartItem[];
  cartTotal: number;
  canCheckout: boolean;
  checkingOut: boolean;
  results: CartResult[] | null;
  onClose: () => void;
  onRemove: (id: string) => void;
  onUpdateAmount: (id: string, amountUsd: string) => void;
  onCheckoutAll: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-3xl border border-slate-50/15 bg-slate-800/40 shadow-[0_8px_60px_-12px_rgba(99,102,241,0.45)] backdrop-blur-2xl"
        style={{
          background:
            'linear-gradient(160deg, rgba(30,41,59,0.55) 0%, rgba(15,23,42,0.55) 100%)',
        }}
      >
        <div className="flex items-center justify-between border-b border-slate-50/10 px-6 py-5">
          <div className="flex items-center gap-2.5">
            <ShoppingCart size={20} className="text-indigo-300" />
            <h2 className="text-lg font-bold tracking-tight text-slate-50">Carrito</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-50/10 hover:text-slate-50"
            aria-label="Cerrar carrito"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-3 overflow-y-auto px-6 py-5">
          <p className="text-sm text-slate-400">
            Definí cuánto invertir en cada instrumento y confirmá todas las órdenes juntas.
          </p>

          {cart.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-500">
              Tocá un instrumento en el mapa para agregarlo acá.
            </p>
          )}

          {cart.map((item) => (
            <div
              key={item.ti.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-50/10 bg-slate-900/40 p-3"
            >
              <div className="min-w-[90px]">
                <p className="font-semibold text-slate-50">{item.ti.instrument.symbol}</p>
                <p className="text-xs text-slate-500">
                  {item.ti.quote ? usd(Number(item.ti.quote.price)) : 'Sin cotización'}
                </p>
              </div>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="Monto USD"
                className="h-9 w-32"
                value={item.amountUsd}
                onChange={(e) => onUpdateAmount(item.ti.id, e.target.value)}
              />
              <Button size="sm" variant="outline" onClick={() => onRemove(item.ti.id)}>
                Quitar
              </Button>
            </div>
          ))}

          {results && (
            <div className="mt-1 flex flex-col gap-1.5">
              {results.map((r) => (
                <p key={r.symbol} className="text-sm">
                  <Badge tone={r.ok ? 'success' : 'danger'} className="mr-2">
                    {r.symbol}
                  </Badge>
                  <span className={r.ok ? 'text-emerald-400' : 'text-rose-400'}>{r.message}</span>
                </p>
              ))}
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-50/10 px-6 py-5">
            <p className="text-sm text-slate-300">
              Total: <span className="font-semibold text-slate-50">{usd(cartTotal)}</span>
            </p>
            <Button disabled={!canCheckout || checkingOut} onClick={onCheckoutAll}>
              {checkingOut ? 'Confirmando…' : `Confirmar ${cart.length} orden${cart.length !== 1 ? 'es' : ''}`}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ClientMarketPage() {
  const [instruments, setInstruments] = useState<TenantInstrumentWithQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [results, setResults] = useState<CartResult[] | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setInstruments(await apiFetch<TenantInstrumentWithQuote[]>('/client/market'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar el catálogo de mercado');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const avgChangePct = useMemo(() => {
    const values = instruments.map((i) => i.quote?.changePct).filter((v): v is number => v !== null && v !== undefined);
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }, [instruments]);
  const orbTone = avgChangePct > 0.1 ? 'positive' : avgChangePct < -0.1 ? 'negative' : 'neutral';

  const addToCart = (ti: TenantInstrumentWithQuote) => {
    setResults(null);
    setCart((c) => {
      if (c.some((item) => item.ti.id === ti.id)) return c;
      return [...c, { ti, amountUsd: '' }];
    });
    setCartOpen(true);
  };

  const removeFromCart = (id: string) => setCart((c) => c.filter((item) => item.ti.id !== id));

  const updateAmount = (id: string, amountUsd: string) =>
    setCart((c) => c.map((item) => (item.ti.id === id ? { ...item, amountUsd } : item)));

  const cartTotal = cart.reduce((sum, item) => sum + (Number(item.amountUsd) || 0), 0);
  const canCheckout = cart.length > 0 && cart.every((item) => Number(item.amountUsd) > 0);

  const onCheckoutAll = async () => {
    setCheckingOut(true);
    setResults(null);
    const outcome: CartResult[] = [];
    for (const item of cart) {
      if (!item.ti.quote) {
        outcome.push({ symbol: item.ti.instrument.symbol, ok: false, message: 'Sin cotización disponible' });
        continue;
      }
      try {
        await apiFetch('/client/orders', {
          method: 'POST',
          body: JSON.stringify({
            tenantInstrumentId: item.ti.id,
            amountUsd: Number(item.amountUsd),
            quotedPrice: Number(item.ti.quote.price),
          }),
        });
        outcome.push({ symbol: item.ti.instrument.symbol, ok: true, message: 'Orden ejecutada' });
      } catch (err) {
        outcome.push({
          symbol: item.ti.instrument.symbol,
          ok: false,
          message: err instanceof ApiError ? err.message : 'Falló la orden',
        });
      }
    }
    setResults(outcome);
    setCart((c) => c.filter((item) => !outcome.find((r) => r.symbol === item.ti.instrument.symbol && r.ok)));
    setCheckingOut(false);
    await load();
  };

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-50">Mercado</h1>
          <p className="text-sm text-slate-400">
            Mapa del catálogo habilitado por sector — tamaño uniforme, color por variación del día. Tocá un
            instrumento para agregarlo al carrito.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Suspense fallback={<div style={{ width: 120, height: 120 }} />}>
            <GeometricOrb size={120} tone={orbTone} />
          </Suspense>
          <CartButton count={cart.length} onClick={() => setCartOpen(true)} />
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-rose-400">{error}</p>}

      {loading ? <p className="text-sm text-slate-400">Cargando…</p> : <MarketTreemap instruments={instruments} onSelect={addToCart} />}

      {cartOpen && (
        <CartModal
          cart={cart}
          cartTotal={cartTotal}
          canCheckout={canCheckout}
          checkingOut={checkingOut}
          results={results}
          onClose={() => setCartOpen(false)}
          onRemove={removeFromCart}
          onUpdateAmount={updateAmount}
          onCheckoutAll={onCheckoutAll}
        />
      )}
    </DashboardLayout>
  );
}
