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
import {
  WITHDRAWAL_STATUS_LABELS,
  WITHDRAWAL_STATUS_TONE,
  WITHDRAWAL_TYPE_LABELS,
  Withdrawal,
  WithdrawalType,
} from '@/lib/types';

const CANCELLABLE: Withdrawal['status'][] = ['PENDING_REVIEW'];

export default function ClientWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [form, setForm] = useState({ type: 'PARTIAL' as WithdrawalType, requestedAmountUsd: '' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setWithdrawals(await apiFetch<Withdrawal[]>('/client/withdrawals'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron cargar tus retiros');
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
    setNotice(null);
    try {
      const body: Record<string, unknown> = { type: form.type };
      if (form.type === 'PARTIAL') body.requestedAmountUsd = Number(form.requestedAmountUsd);
      const created = await apiFetch<Withdrawal>('/client/withdrawals', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (created.notice) setNotice(created.notice);
      setForm({ type: 'PARTIAL', requestedAmountUsd: '' });
      setShowForm(false);
      await load();
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : 'No se pudo crear la solicitud de retiro');
    } finally {
      setCreating(false);
    }
  };

  const onCancel = async (id: string) => {
    setCancellingId(id);
    try {
      await apiFetch(`/client/withdrawals/${id}/cancel`, { method: 'POST' });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cancelar el retiro');
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-50">Retiros</h1>
          <p className="text-sm text-slate-400">
            Un retiro parcial no toca tu acuerdo. Un retiro definitivo lo cierra — revisá las condiciones antes de
            confirmar.
          </p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? 'Cancelar' : 'Solicitar retiro'}</Button>
      </div>

      {notice && (
        <Card className="mb-6 border-amber-400/30">
          <CardContent className="p-6 text-sm text-amber-200">{notice}</CardContent>
        </Card>
      )}

      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Solicitar retiro</CardTitle>
            <CardDescription>
              Solo podés tener una solicitud en curso a la vez. Un retiro definitivo liquida todas tus posiciones y
              cierra tu acuerdo de gestión.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onCreate} className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="type">Tipo</Label>
                <Select
                  id="type"
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as WithdrawalType }))}
                >
                  <option value="PARTIAL">{WITHDRAWAL_TYPE_LABELS.PARTIAL}</option>
                  <option value="FINAL">{WITHDRAWAL_TYPE_LABELS.FINAL}</option>
                </Select>
              </div>
              {form.type === 'PARTIAL' && (
                <div>
                  <Label htmlFor="amount">Monto (USD)</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={form.requestedAmountUsd}
                    onChange={(e) => setForm((f) => ({ ...f, requestedAmountUsd: e.target.value }))}
                  />
                </div>
              )}
              {createError && <p className="sm:col-span-2 text-sm text-rose-400">{createError}</p>}
              <Button type="submit" disabled={creating} className="sm:col-span-2">
                {creating ? 'Enviando…' : 'Confirmar solicitud'}
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
              <TableHeadCell>Tipo</TableHeadCell>
              <TableHeadCell>Solicitado</TableHeadCell>
              <TableHeadCell>Monto final</TableHeadCell>
              <TableHeadCell>Estado</TableHeadCell>
              <TableHeadCell>Creado</TableHeadCell>
              <TableHeadCell />
            </tr>
          </TableHead>
          <TableBody>
            {withdrawals.map((w) => (
              <TableRow key={w.id}>
                <TableCell className="text-slate-50">{WITHDRAWAL_TYPE_LABELS[w.type]}</TableCell>
                <TableCell>${Number(w.requestedAmountUsd).toFixed(2)}</TableCell>
                <TableCell>
                  {w.finalAmountUsd ? `$${Number(w.finalAmountUsd).toFixed(2)}` : 'A definir con tu asesor'}
                </TableCell>
                <TableCell>
                  <Badge tone={WITHDRAWAL_STATUS_TONE[w.status]}>{WITHDRAWAL_STATUS_LABELS[w.status]}</Badge>
                </TableCell>
                <TableCell>{new Date(w.createdAt).toLocaleString('es-AR')}</TableCell>
                <TableCell>
                  {CANCELLABLE.includes(w.status) && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={cancellingId === w.id}
                      onClick={() => onCancel(w.id)}
                    >
                      {cancellingId === w.id ? 'Cancelando…' : 'Cancelar'}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {withdrawals.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-slate-500">
                  Todavía no solicitaste ningún retiro.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </DashboardLayout>
  );
}
