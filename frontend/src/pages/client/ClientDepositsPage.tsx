import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { WalletQR } from '@/components/deposits/WalletQR';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from '@/components/ui/table';
import { apiFetch, ApiError } from '@/lib/api-client';
import { compressImageToDataUrl } from '@/lib/image-compress';
import { CHAIN_NETWORK_LABELS, ChainNetwork, DEPOSIT_STATUS_LABELS, DEPOSIT_STATUS_TONE, Deposit } from '@/lib/types';

const TOKEN_LABEL: Record<ChainNetwork, string> = { TRON_TRC20: 'USDT', POLYGON: 'USDC' };
const NETWORK_LABEL: Record<ChainNetwork, string> = { TRON_TRC20: 'Tron (TRC20)', POLYGON: 'Polygon POS (MATIC)' };

function usdApprox(amount: string) {
  // USDT/USDC están atados 1:1 al dólar — la conversión es directa.
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD' }).format(Number(amount));
}

// Pantalla de "Depositar" para una solicitud recién creada, en el estilo de
// referencia que pasó el cliente: QR grande, red, monto ≈ USD, y ahí mismo la
// carga del hash + comprobante opcional.
function DepositReceiveCard({
  deposit,
  onSubmitted,
}: {
  deposit: Deposit;
  onSubmitted: () => void;
}) {
  const [txHash, setTxHash] = useState('');
  const [receiptImageUrl, setReceiptImageUrl] = useState<string | undefined>(undefined);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setCompressing(true);
    try {
      const dataUrl = await compressImageToDataUrl(file);
      setReceiptImageUrl(dataUrl);
      setReceiptPreview(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo procesar la imagen');
    } finally {
      setCompressing(false);
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!txHash.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/client/deposits/${deposit.id}/tx-hash`, {
        method: 'PATCH',
        body: JSON.stringify({ txHash: txHash.trim(), receiptImageUrl }),
      });
      onSubmitted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar el hash');
    } finally {
      setSubmitting(false);
    }
  };

  const token = TOKEN_LABEL[deposit.chain];

  return (
    <Card className="mb-6 overflow-hidden">
      <CardContent className="grid gap-8 p-8 lg:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm font-semibold text-slate-200">Depositar {token}</p>
          <WalletQR address={deposit.toAddress} />
          <p className="max-w-[220px] text-center text-xs text-slate-500">
            Solo para depósitos en {token} vía {NETWORK_LABEL[deposit.chain]}
          </p>
          <div className="w-full rounded-xl border border-slate-50/10 bg-slate-900/60 px-4 py-2.5">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Red</p>
            <p className="text-sm font-medium text-slate-100">{NETWORK_LABEL[deposit.chain]}</p>
          </div>
          <div className="w-full rounded-xl border border-slate-50/10 bg-slate-900/60 px-4 py-2.5">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Dirección</p>
            <p className="break-all font-mono text-xs text-slate-300">{deposit.toAddress}</p>
          </div>
        </div>

        <div className="flex flex-col justify-center gap-4">
          <div>
            <p className="text-sm text-slate-400">
              Monto declarado: <span className="text-slate-100">{deposit.declaredAmountToken} {token}</span>{' '}
              <span className="text-slate-500">(≈ {usdApprox(deposit.declaredAmountToken)})</span>
            </p>
            <p className="mt-1 text-xs text-slate-500">
              El monto que se acredita siempre es el verificado on-chain, no el declarado acá.
            </p>
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <div>
              <Label htmlFor={`hash-${deposit.id}`}>ID de transacción</Label>
              <Input
                id={`hash-${deposit.id}`}
                placeholder="Pegá el ID de tu transacción"
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor={`receipt-${deposit.id}`}>Comprobante (opcional)</Label>
              <input
                id={`receipt-${deposit.id}`}
                type="file"
                accept="image/*"
                onChange={onFile}
                className="block w-full text-xs text-slate-400 file:mr-3 file:rounded-full file:border-0 file:bg-slate-800/60 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-200 hover:file:bg-slate-700/60"
              />
              <p className="mt-1 text-xs text-slate-500">
                Respaldo visual para quien lo revisa — la verificación real es siempre el ID de transacción.
              </p>
              {compressing && <p className="mt-1 text-xs text-slate-500">Procesando imagen…</p>}
              {receiptPreview && (
                <img
                  src={receiptPreview}
                  alt="Comprobante cargado"
                  className="mt-2 h-24 w-24 rounded-lg border border-slate-50/10 object-cover"
                />
              )}
            </div>

            {error && <p className="text-sm text-rose-400">{error}</p>}

            <Button type="submit" disabled={submitting || compressing || !txHash.trim()}>
              {submitting ? 'Enviando…' : 'Confirmar transferencia'}
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ClientDepositsPage() {
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({ chain: 'TRON_TRC20' as ChainNetwork, declaredAmountToken: '' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setDeposits(await apiFetch<Deposit[]>('/client/deposits'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron cargar tus depósitos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      await apiFetch('/client/deposits', {
        method: 'POST',
        body: JSON.stringify({ chain: form.chain, declaredAmountToken: Number(form.declaredAmountToken) }),
      });
      setForm({ chain: 'TRON_TRC20', declaredAmountToken: '' });
      setShowForm(false);
      await load();
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : 'No se pudo crear el depósito');
    } finally {
      setCreating(false);
    }
  };

  const pendingReceive = deposits.filter((d) => d.status === 'PENDING_TX');
  const history = deposits.filter((d) => d.status !== 'PENDING_TX');

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-50">Depósitos</h1>
          <p className="text-sm text-slate-400">Fondeá tu cuenta transfiriendo USDT (TRON) o USDC (Polygon).</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? 'Cancelar' : 'Nuevo depósito'}</Button>
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Solicitar depósito</CardTitle>
            <CardDescription>
              Elegí la red y el monto que vas a transferir. Te vamos a mostrar el QR y la wallet de destino.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onCreate} className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="chain">Red</Label>
                <Select
                  id="chain"
                  value={form.chain}
                  onChange={(e) => setForm((f) => ({ ...f, chain: e.target.value as ChainNetwork }))}
                >
                  <option value="TRON_TRC20">{CHAIN_NETWORK_LABELS.TRON_TRC20}</option>
                  <option value="POLYGON">{CHAIN_NETWORK_LABELS.POLYGON}</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="amount">Monto declarado</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.00000001"
                  min="0"
                  required
                  value={form.declaredAmountToken}
                  onChange={(e) => setForm((f) => ({ ...f, declaredAmountToken: e.target.value }))}
                />
                {form.declaredAmountToken && (
                  <p className="mt-1 text-xs text-slate-500">≈ {usdApprox(form.declaredAmountToken || '0')}</p>
                )}
              </div>
              {createError && <p className="sm:col-span-2 text-sm text-rose-400">{createError}</p>}
              <Button type="submit" disabled={creating} className="sm:col-span-2">
                {creating ? 'Creando…' : 'Crear solicitud'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {error && <p className="mb-4 text-sm text-rose-400">{error}</p>}

      {!loading &&
        pendingReceive.map((d) => <DepositReceiveCard key={d.id} deposit={d} onSubmitted={load} />)}

      {loading ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : (
        <Table>
          <TableHead>
            <tr>
              <TableHeadCell>Red</TableHeadCell>
              <TableHeadCell>Monto</TableHeadCell>
              <TableHeadCell>Estado</TableHeadCell>
              <TableHeadCell>Comprobante</TableHeadCell>
              <TableHeadCell>Creado</TableHeadCell>
            </tr>
          </TableHead>
          <TableBody>
            {history.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="text-slate-50">{CHAIN_NETWORK_LABELS[d.chain]}</TableCell>
                <TableCell>
                  {d.declaredAmountToken} {TOKEN_LABEL[d.chain]}
                  <span className="ml-1 text-xs text-slate-500">(≈ {usdApprox(d.declaredAmountToken)})</span>
                </TableCell>
                <TableCell>
                  <Badge tone={DEPOSIT_STATUS_TONE[d.status]}>{DEPOSIT_STATUS_LABELS[d.status]}</Badge>
                </TableCell>
                <TableCell>
                  {d.receiptImageUrl ? (
                    <img
                      src={d.receiptImageUrl}
                      alt="Comprobante"
                      className="h-10 w-10 rounded-md border border-slate-50/10 object-cover"
                    />
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell>{new Date(d.createdAt).toLocaleString('es-AR')}</TableCell>
              </TableRow>
            ))}
            {history.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-slate-500">
                  Todavía no tenés depósitos en el historial.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </DashboardLayout>
  );
}
