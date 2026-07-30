import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from '@/components/ui/table';
import { apiFetch, ApiError } from '@/lib/api-client';
import { AccountStatus, ACCOUNT_STATUS_LABELS, SafeUser } from '@/lib/types';

export default function AdminClientsPage() {
  const [clients, setClients] = useState<SafeUser[]>([]);
  const [advisors, setAdvisors] = useState<SafeUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [clientsResult, advisorsResult] = await Promise.all([
        apiFetch<SafeUser[]>('/admin/users?role=CLIENT'),
        apiFetch<SafeUser[]>('/admin/users?role=ADVISOR'),
      ]);
      setClients(clientsResult);
      setAdvisors(advisorsResult);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los clientes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onAssignAdvisor = async (clientId: string, advisorId: string) => {
    try {
      await apiFetch(`/admin/users/${clientId}/advisor`, {
        method: 'PATCH',
        body: JSON.stringify({ advisorId: advisorId || null }),
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo asignar el asesor');
    }
  };

  const onStatusChange = async (clientId: string, accountStatus: AccountStatus) => {
    try {
      await apiFetch(`/admin/users/${clientId}/account-status`, {
        method: 'PATCH',
        body: JSON.stringify({ accountStatus }),
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo actualizar el estado');
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-50">Clientes</h1>
        <p className="text-sm text-slate-400">Asignación a asesor y estado de cuenta por cliente.</p>
      </div>

      {advisors.length === 0 && !loading && (
        <Card className="mb-6 border-amber-400/30">
          <CardHeader>
            <CardTitle className="text-base">Todavía no hay asesores creados</CardTitle>
            <CardDescription>
              Creá al menos un usuario con rol Asesor desde la pantalla de Usuarios para poder asignar
              clientes.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {error && <p className="mb-4 text-sm text-rose-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : (
        <Table>
          <TableHead>
            <tr>
              <TableHeadCell>Cliente</TableHeadCell>
              <TableHeadCell>Email</TableHeadCell>
              <TableHeadCell>Asesor asignado</TableHeadCell>
              <TableHeadCell>Estado de cuenta</TableHeadCell>
              <TableHeadCell>Acuerdo aceptado</TableHeadCell>
            </tr>
          </TableHead>
          <TableBody>
            {clients.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="text-slate-50">{c.fullName}</TableCell>
                <TableCell>{c.email}</TableCell>
                <TableCell>
                  <Select
                    value={c.advisorId ?? ''}
                    onChange={(e) => onAssignAdvisor(c.id, e.target.value)}
                  >
                    <option value="">Sin asignar</option>
                    {advisors.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.fullName}
                      </option>
                    ))}
                  </Select>
                </TableCell>
                <TableCell>
                  <Select
                    value={c.accountStatus}
                    onChange={(e) => onStatusChange(c.id, e.target.value as AccountStatus)}
                  >
                    {Object.entries(ACCOUNT_STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </TableCell>
                <TableCell>
                  <Badge tone={c.agreementAcceptedVersionId ? 'success' : 'muted'}>
                    {c.agreementAcceptedVersionId ? 'Sí' : 'Pendiente'}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {clients.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-slate-500">
                  Todavía no hay clientes registrados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </DashboardLayout>
  );
}
