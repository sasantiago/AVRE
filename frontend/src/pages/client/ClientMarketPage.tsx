import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { MarketTreemap } from '@/components/market/MarketTreemap';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

export default function ClientMarketPage() {
  const [instruments, setInstruments] = useState<TenantInstrumentWithQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [cart, setCart] = useState<CartItem[]>([]);
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
        <Suspense fallback={<div style={{ width: 120, height: 120 }} />}>
          <GeometricOrb size={120} tone={orbTone} />
        </Suspense>
      </div>

      {error && <p className="mb-4 text-sm text-rose-400">{error}</p>}

      {loading ? <p className="text-sm text-slate-400">Cargando…</p> : <MarketTreemap instruments={instruments} onSelect={addToCart} />}

      {cart.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Carrito</CardTitle>
            <CardDescription>
              Definí cuánto invertir en cada instrumento y confirmá todas las órdenes juntas.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 pt-0">
            {cart.map((item) => (
              <div
                key={item.ti.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-50/10 bg-slate-900/50 p-3"
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
                  onChange={(e) => updateAmount(item.ti.id, e.target.value)}
                />
                <Button size="sm" variant="outline" onClick={() => removeFromCart(item.ti.id)}>
                  Quitar
                </Button>
              </div>
            ))}

            <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-50/10 pt-4">
              <p className="text-sm text-slate-300">
                Total: <span className="font-semibold text-slate-50">{usd(cartTotal)}</span>
              </p>
              <Button disabled={!canCheckout || checkingOut} onClick={onCheckoutAll}>
                {checkingOut ? 'Confirmando…' : `Confirmar ${cart.length} orden${cart.length !== 1 ? 'es' : ''}`}
              </Button>
            </div>

            {results && (
              <div className="mt-2 flex flex-col gap-1.5">
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
          </CardContent>
        </Card>
      )}
    </DashboardLayout>
  );
}
