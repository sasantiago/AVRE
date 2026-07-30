import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from '@/components/ui/table';
import { apiFetch, ApiError } from '@/lib/api-client';
import { PaginatedAuditLog } from '@/lib/types';

const PAGE_SIZE = 25;

export default function AdminAuditPage() {
  const [data, setData] = useState<PaginatedAuditLog | null>(null);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (actionFilter.trim()) params.set('action', actionFilter.trim());
      const result = await apiFetch<PaginatedAuditLog>(`/admin/audit-log?${params.toString()}`);
      setData(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar la auditoría');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const onFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    load();
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-50">Auditoría</h1>
        <p className="text-sm text-slate-400">
          Registro de acciones sensibles: logins, cambios de rol, aceptación de acuerdos, aportes/retiros.
        </p>
      </div>

      <form onSubmit={onFilterSubmit} className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="action">Filtrar por acción</Label>
          <Input
            id="action"
            placeholder="ej. LOGIN_SUCCESS, AGREEMENT_ACCEPTED…"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="w-72"
          />
        </div>
        <Button type="submit" variant="outline">
          Filtrar
        </Button>
      </form>

      {error && <p className="mb-4 text-sm text-rose-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : (
        <>
          <Table>
            <TableHead>
              <tr>
                <TableHeadCell>Fecha</TableHeadCell>
                <TableHeadCell>Acción</TableHeadCell>
                <TableHeadCell>Actor</TableHeadCell>
                <TableHeadCell>Destino</TableHeadCell>
                <TableHeadCell>Metadata</TableHeadCell>
              </tr>
            </TableHead>
            <TableBody>
              {data?.items.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{new Date(entry.createdAt).toLocaleString('es-AR')}</TableCell>
                  <TableCell className="font-mono text-xs text-indigo-300">{entry.action}</TableCell>
                  <TableCell className="font-mono text-xs">{entry.actorUserId ?? '—'}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {entry.targetType ? `${entry.targetType}:${entry.targetId}` : '—'}
                  </TableCell>
                  <TableCell className="max-w-xs truncate font-mono text-xs text-slate-500">
                    {entry.metadata ? JSON.stringify(entry.metadata) : '—'}
                  </TableCell>
                </TableRow>
              ))}
              {data?.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-slate-500">
                    No hay registros para este filtro.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
            <span>
              Página {data?.page ?? 1} de {totalPages} · {data?.total ?? 0} registros
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
