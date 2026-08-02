import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from '@/components/ui/table';
import { apiFetch, ApiError } from '@/lib/api-client';
import {
  WITHDRAWAL_STATUS_LABELS,
  WITHDRAWAL_STATUS_TONE,
  WITHDRAWAL_TYPE_LABELS,
  WithdrawalWithAlerts,
} from '@/lib/types';

// Cola de revisión de retiros, compartida por ADVISOR y ADMIN. markProcessing
// (cargar el hash de la transferencia de salida) es admin-only (§7.4).
export function WithdrawalsQueue({
  basePath,
  canMarkProcessing = false,
}: {
  basePath: '/advisor/withdrawals' | '/admin/withdrawals';
  canMarkProcessing?: boolean;
}) {
  const [withdrawals, setWithdrawals] = useState<WithdrawalWithAlerts[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rejectDrafts, setRejectDrafts] = useState<Record<string, string>>({});
  const [finalAmountDrafts, setFinalAmountDrafts] = useState<Record<string, string>>({});
  const [txHashDrafts, setTxHashDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setWithdrawals(await apiFetch<WithdrawalWithAlerts[]>(basePath));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar la cola de retiros');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basePath]);

  // penaltyUsd null en un retiro FINAL == penalidad "a definir" (§7.3) — hay que
  // mandar finalAmountUsd negociado con el cliente para poder aprobar.
  const needsNegotiatedAmount = (w: WithdrawalWithAlerts) => w.type === 'FINAL' && w.penaltyUsd === null;

  const onApprove = async (w: WithdrawalWithAlerts) => {
    setBusyId(w.id);
    try {
      const body: Record<string, unknown> = {};
      if (needsNegotiatedAmount(w)) {
        const amount = finalAmountDrafts[w.id];
        if (!amount) {
          setError('Ingresá el monto final acordado con el cliente antes de aprobar');
          setBusyId(null);
          return;
        }
        body.finalAmountUsd = Number(amount);
      }
      await apiFetch(`${basePath}/${w.id}/approve`, { method: 'POST', body: JSON.stringify(body) });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo aprobar el retiro');
    } finally {
      setBusyId(null);
    }
  };

  const onReject = async (id: string) => {
    const rejectionReason = rejectDrafts[id]?.trim();
    if (!rejectionReason || rejectionReason.length < 3) {
      setError('El motivo de rechazo debe tener al menos 3 caracteres');
      return;
    }
    setBusyId(id);
    try {
      await apiFetch(`${basePath}/${id}/reject`, { method: 'POST', body: JSON.stringify({ rejectionReason }) });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo rechazar el retiro');
    } finally {
      setBusyId(null);
    }
  };

  const onMarkProcessing = async (id: string) => {
    const outboundTxHash = txHashDrafts[id]?.trim();
    if (!outboundTxHash) return;
    setBusyId(id);
    try {
      await apiFetch(`/admin/withdrawals/${id}/mark-processing`, {
        method: 'POST',
        body: JSON.stringify({ outboundTxHash }),
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo marcar la transferencia');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <p className="text-sm text-slate-400">Cargando…</p>;

  return (
    <>
      {error && <p className="mb-4 text-sm text-rose-400">{error}</p>}
      <Table>
        <TableHead>
          <tr>
            <TableHeadCell>Tipo</TableHeadCell>
            <TableHeadCell>Solicitado</TableHeadCell>
            <TableHeadCell>Monto final</TableHeadCell>
            <TableHeadCell>Estado</TableHeadCell>
            <TableHeadCell>Alertas</TableHeadCell>
            <TableHeadCell>Acciones</TableHeadCell>
          </tr>
        </TableHead>
        <TableBody>
          {withdrawals.map((w) => (
            <TableRow key={w.id}>
              <TableCell className="text-slate-50">{WITHDRAWAL_TYPE_LABELS[w.type]}</TableCell>
              <TableCell>${Number(w.requestedAmountUsd).toFixed(2)}</TableCell>
              <TableCell>
                {w.finalAmountUsd ? `$${Number(w.finalAmountUsd).toFixed(2)}` : 'A definir'}
              </TableCell>
              <TableCell>
                <Badge tone={WITHDRAWAL_STATUS_TONE[w.status]}>{WITHDRAWAL_STATUS_LABELS[w.status]}</Badge>
              </TableCell>
              <TableCell>
                {w.walletChangedRecentlyWarning && <Badge tone="warning">Wallet cambiada hace poco</Badge>}
              </TableCell>
              <TableCell>
                {w.status === 'PENDING_REVIEW' && (
                  <div className="flex flex-col gap-2">
                    {needsNegotiatedAmount(w) && (
                      <Input
                        placeholder="Monto final acordado (USD)"
                        type="number"
                        className="h-9 w-48"
                        value={finalAmountDrafts[w.id] ?? ''}
                        onChange={(e) => setFinalAmountDrafts((v) => ({ ...v, [w.id]: e.target.value }))}
                      />
                    )}
                    <Button size="sm" disabled={busyId === w.id} onClick={() => onApprove(w)}>
                      Aprobar
                    </Button>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Motivo de rechazo"
                        className="h-9 w-48"
                        value={rejectDrafts[w.id] ?? ''}
                        onChange={(e) => setRejectDrafts((v) => ({ ...v, [w.id]: e.target.value }))}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === w.id}
                        onClick={() => onReject(w.id)}
                      >
                        Rechazar
                      </Button>
                    </div>
                  </div>
                )}
                {canMarkProcessing && w.status === 'APPROVED' && (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Hash de transferencia de salida"
                      className="h-9 w-48"
                      value={txHashDrafts[w.id] ?? ''}
                      onChange={(e) => setTxHashDrafts((v) => ({ ...v, [w.id]: e.target.value }))}
                    />
                    <Button size="sm" disabled={busyId === w.id} onClick={() => onMarkProcessing(w.id)}>
                      Marcar en curso
                    </Button>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
          {withdrawals.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-slate-500">
                No hay retiros pendientes de revisión.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </>
  );
}
