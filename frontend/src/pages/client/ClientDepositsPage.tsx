import { FormEvent, useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from '@/components/ui/table';
import { apiFetch, ApiError } from '@/lib/api-client';
import { CHAIN_NETWORK_LABELS, ChainNetwork, DEPOSIT_STATUS_LABELS, DEPOSIT_STATUS_TONE, Deposit } from '@/lib/types';

export default function ClientDepositsPage() {
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({ chain: 'TRON_TRC20' as ChainNetwork, declaredAmountToken: '' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [txHashDrafts, setTxHashDrafts] = useState<Record<string, string>>({});
  const [submittingHash, setSubmittingHash] = useState<string | null>(null);

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

  const onSubmitTxHash = async (depositId: string) => {
    const txHash = txHashDrafts[depositId]?.trim();
    if (!txHash) return;
    setSubmittingHash(depositId);
    try {
      await apiFetch(`/client/deposits/${depositId}/tx-hash`, {
        method: 'PATCH',
        body: JSON.stringify({ txHash }),
      });
      setTxHashDrafts((d) => ({ ...d, [depositId]: '' }));
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar el hash');
    } finally {
      setSubmittingHash(null);
    }
  };

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
              Elegí la red y el monto que vas a transferir. Te vamos a mostrar la wallet de destino para que envíes
              los fondos y cargues el hash de la transacción.
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

      {loading ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : (
        <Table>
          <TableHead>
            <tr>
              <TableHeadCell>Red</TableHeadCell>
              <TableHeadCell>Monto declarado</TableHeadCell>
              <TableHeadCell>Enviar a</TableHeadCell>
              <TableHeadCell>Estado</TableHeadCell>
              <TableHeadCell>Hash</TableHeadCell>
              <TableHeadCell>Creado</TableHeadCell>
            </tr>
          </TableHead>
          <TableBody>
            {deposits.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="text-slate-50">{CHAIN_NETWORK_LABELS[d.chain]}</TableCell>
                <TableCell>{d.declaredAmountToken}</TableCell>
                <TableCell className="font-mono text-xs">{d.toAddress}</TableCell>
                <TableCell>
                  <Badge tone={DEPOSIT_STATUS_TONE[d.status]}>{DEPOSIT_STATUS_LABELS[d.status]}</Badge>
                </TableCell>
                <TableCell>
                  {d.txHash ? (
                    <span className="font-mono text-xs">{d.txHash.slice(0, 10)}…</span>
                  ) : d.status === 'PENDING_TX' ? (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Pegá el hash de tu transacción"
                        className="h-9 w-56"
                        value={txHashDrafts[d.id] ?? ''}
                        onChange={(e) => setTxHashDrafts((v) => ({ ...v, [d.id]: e.target.value }))}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={submittingHash === d.id}
                        onClick={() => onSubmitTxHash(d.id)}
                      >
                        {submittingHash === d.id ? 'Enviando…' : 'Enviar'}
                      </Button>
                    </div>
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell>{new Date(d.createdAt).toLocaleString('es-AR')}</TableCell>
              </TableRow>
            ))}
            {deposits.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-slate-500">
                  Todavía no hiciste ningún depósito.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </DashboardLayout>
  );
}
