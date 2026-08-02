import { FormEvent, useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from '@/components/ui/table';
import { apiFetch, ApiError } from '@/lib/api-client';
import { TenantInstrumentWithQuote } from '@/lib/types';

export default function ClientMarketPage() {
  const [instruments, setInstruments] = useState<TenantInstrumentWithQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [buying, setBuying] = useState<TenantInstrumentWithQuote | null>(null);
  const [amountUsd, setAmountUsd] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [buySuccess, setBuySuccess] = useState<string | null>(null);

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

  const openBuy = (ti: TenantInstrumentWithQuote) => {
    setBuying(ti);
    setAmountUsd('');
    setBuyError(null);
    setBuySuccess(null);
  };

  const onBuy = async (e: FormEvent) => {
    e.preventDefault();
    if (!buying?.quote) return;
    setSubmitting(true);
    setBuyError(null);
    try {
      await apiFetch('/client/orders', {
        method: 'POST',
        body: JSON.stringify({
          tenantInstrumentId: buying.id,
          amountUsd: Number(amountUsd),
          quotedPrice: Number(buying.quote.price),
        }),
      });
      setBuySuccess(`Orden ejecutada para ${buying.instrument.symbol}.`);
      setBuying(null);
      await load();
    } catch (err) {
      setBuyError(err instanceof ApiError ? err.message : 'No se pudo ejecutar la orden');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-50">Mercado</h1>
        <p className="text-sm text-slate-400">Catálogo habilitado para tu cuenta, con cotización en vivo.</p>
      </div>

      {buySuccess && <p className="mb-4 text-sm text-emerald-400">{buySuccess}</p>}
      {error && <p className="mb-4 text-sm text-rose-400">{error}</p>}

      {buying && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Comprar {buying.instrument.symbol}</CardTitle>
            <CardDescription>
              Precio de referencia: {buying.quote ? `$${buying.quote.price}` : 'sin cotización'} — si cambia más de
              0.5% antes de confirmar, te vamos a pedir que reintentes con el precio nuevo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onBuy} className="grid gap-4 sm:grid-cols-[1fr_auto_auto]">
              <div>
                <Label htmlFor="amountUsd">Monto a invertir (USD)</Label>
                <Input
                  id="amountUsd"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={amountUsd}
                  onChange={(e) => setAmountUsd(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={submitting || !buying.quote} className="self-end">
                {submitting ? 'Comprando…' : 'Confirmar compra'}
              </Button>
              <Button type="button" variant="outline" className="self-end" onClick={() => setBuying(null)}>
                Cancelar
              </Button>
              {buyError && <p className="sm:col-span-3 text-sm text-rose-400">{buyError}</p>}
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : (
        <Table>
          <TableHead>
            <tr>
              <TableHeadCell>Símbolo</TableHeadCell>
              <TableHeadCell>Nombre</TableHeadCell>
              <TableHeadCell>Clase</TableHeadCell>
              <TableHeadCell>Cotización</TableHeadCell>
              <TableHeadCell />
            </tr>
          </TableHead>
          <TableBody>
            {instruments.map((ti) => (
              <TableRow key={ti.id}>
                <TableCell className="text-slate-50">{ti.instrument.symbol}</TableCell>
                <TableCell>{ti.instrument.name}</TableCell>
                <TableCell>
                  <Badge tone="muted">{ti.instrument.assetClass}</Badge>
                </TableCell>
                <TableCell>
                  {ti.quote ? `$${ti.quote.price}` : <span className="text-slate-600">{ti.quoteError ?? 'Sin cotización'}</span>}
                </TableCell>
                <TableCell>
                  <Button size="sm" variant="outline" disabled={!ti.quote} onClick={() => openBuy(ti)}>
                    Comprar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {instruments.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-slate-500">
                  Todavía no hay instrumentos habilitados para tu cuenta.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </DashboardLayout>
  );
}
