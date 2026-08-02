import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from '@/components/ui/table';
import { apiFetch, ApiError } from '@/lib/api-client';
import { CHAIN_NETWORK_LABELS, DEPOSIT_STATUS_LABELS, DEPOSIT_STATUS_TONE, DepositWithAlerts } from '@/lib/types';

// Cola de revisión de depósitos, compartida por ADVISOR y ADMIN — mismas rutas
// relativas (deposits/:id/approve|reject) en ambos prefijos.
export function DepositsQueue({ basePath }: { basePath: '/advisor/deposits' | '/admin/deposits' }) {
  const [deposits, setDeposits] = useState<DepositWithAlerts[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rejectDrafts, setRejectDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setDeposits(await apiFetch<DepositWithAlerts[]>(basePath));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar la cola de depósitos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basePath]);

  const onApprove = async (id: string) => {
    setBusyId(id);
    try {
      await apiFetch(`${basePath}/${id}/approve`, { method: 'POST' });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo aprobar el depósito');
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
      setError(err instanceof ApiError ? err.message : 'No se pudo rechazar el depósito');
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
            <TableHeadCell>Red</TableHeadCell>
            <TableHeadCell>Declarado</TableHeadCell>
            <TableHeadCell>Verificado</TableHeadCell>
            <TableHeadCell>Estado</TableHeadCell>
            <TableHeadCell>Alertas</TableHeadCell>
            <TableHeadCell>Acciones</TableHeadCell>
          </tr>
        </TableHead>
        <TableBody>
          {deposits.map((d) => (
            <TableRow key={d.id}>
              <TableCell className="text-slate-50">{CHAIN_NETWORK_LABELS[d.chain]}</TableCell>
              <TableCell>{d.declaredAmountToken}</TableCell>
              <TableCell>{d.verifiedAmountUsd ?? '—'}</TableCell>
              <TableCell>
                <Badge tone={DEPOSIT_STATUS_TONE[d.status]}>{DEPOSIT_STATUS_LABELS[d.status]}</Badge>
              </TableCell>
              <TableCell>
                {d.sourceWalletChangedWarning && (
                  <Badge tone="warning" className="mr-1">
                    Wallet de origen cambió
                  </Badge>
                )}
                {d.amountMismatchWarning && <Badge tone="danger">Monto no coincide</Badge>}
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-2">
                  <Button size="sm" disabled={busyId === d.id} onClick={() => onApprove(d.id)}>
                    Aprobar
                  </Button>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Motivo de rechazo"
                      className="h-9 w-48"
                      value={rejectDrafts[d.id] ?? ''}
                      onChange={(e) => setRejectDrafts((v) => ({ ...v, [d.id]: e.target.value }))}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === d.id}
                      onClick={() => onReject(d.id)}
                    >
                      Rechazar
                    </Button>
                  </div>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {deposits.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-slate-500">
                No hay depósitos pendientes de revisión.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </>
  );
}
