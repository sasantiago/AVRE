import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from '@/components/ui/table';
import { apiFetch, ApiError } from '@/lib/api-client';
import { ACCOUNT_STATUS_LABELS, SafeUser } from '@/lib/types';

export default function AdvisorClientsPage() {
  const [clients, setClients] = useState<SafeUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<SafeUser[]>('/advisor/clients')
      .then(setClients)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar tu cartera'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-50">Mi cartera</h1>
        <p className="text-sm text-slate-400">Clientes que tenés asignados. No ves clientes de otros asesores.</p>
      </div>

      {error && <p className="mb-4 text-sm text-rose-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : (
        <Table>
          <TableHead>
            <tr>
              <TableHeadCell>Cliente</TableHeadCell>
              <TableHeadCell>Email</TableHeadCell>
              <TableHeadCell>Estado de cuenta</TableHeadCell>
              <TableHeadCell>Acuerdo aceptado</TableHeadCell>
              <TableHeadCell />
            </tr>
          </TableHead>
          <TableBody>
            {clients.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="text-slate-50">{c.fullName}</TableCell>
                <TableCell>{c.email}</TableCell>
                <TableCell>{ACCOUNT_STATUS_LABELS[c.accountStatus]}</TableCell>
                <TableCell>
                  <Badge tone={c.agreementAcceptedVersionId ? 'success' : 'muted'}>
                    {c.agreementAcceptedVersionId ? 'Sí' : 'Pendiente'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Link to={`/advisor/clients/${c.id}`} className="text-sm text-indigo-300 hover:text-indigo-200">
                    Ver ficha →
                  </Link>
                </TableCell>
              </TableRow>
            ))}
            {clients.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-slate-500">
                  Todavía no tenés clientes asignados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </DashboardLayout>
  );
}
