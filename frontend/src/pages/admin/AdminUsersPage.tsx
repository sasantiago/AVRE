import { FormEvent, useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from '@/components/ui/table';
import { apiFetch, ApiError } from '@/lib/api-client';
import { Role } from '@/lib/auth-context';
import { ROLE_LABELS, SafeUser } from '@/lib/types';

const ROLE_FILTERS: Array<{ label: string; value: Role | 'ALL' }> = [
  { label: 'Todos', value: 'ALL' },
  { label: 'Admins', value: 'ADMIN' },
  { label: 'Asesores', value: 'ADVISOR' },
  { label: 'Clientes', value: 'CLIENT' },
];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [filter, setFilter] = useState<Role | 'ALL'>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [form, setForm] = useState({ fullName: '', email: '', password: '', role: 'ADVISOR' as Role });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const loadUsers = async (role: Role | 'ALL') => {
    setLoading(true);
    setError(null);
    try {
      const query = role === 'ALL' ? '' : `?role=${role}`;
      const result = await apiFetch<SafeUser[]>(`/admin/users${query}`);
      setUsers(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los usuarios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers(filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      await apiFetch('/admin/users', { method: 'POST', body: JSON.stringify(form) });
      setForm({ fullName: '', email: '', password: '', role: 'ADVISOR' });
      setShowCreateForm(false);
      await loadUsers(filter);
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : 'No se pudo crear el usuario');
    } finally {
      setCreating(false);
    }
  };

  const onRoleChange = async (userId: string, role: Role) => {
    try {
      await apiFetch(`/admin/users/${userId}/role`, { method: 'PATCH', body: JSON.stringify({ role }) });
      await loadUsers(filter);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo actualizar el rol');
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-50">Usuarios</h1>
          <p className="text-sm text-slate-400">Gestión de usuarios y roles (Admin, Asesor, Cliente).</p>
        </div>
        <Button onClick={() => setShowCreateForm((v) => !v)}>
          {showCreateForm ? 'Cancelar' : 'Nuevo usuario'}
        </Button>
      </div>

      {showCreateForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Crear usuario</CardTitle>
            <CardDescription>
              Única vía para crear ADMIN o ASESOR — el registro público solo crea clientes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onCreate} className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="fullName">Nombre completo</Label>
                <Input
                  id="fullName"
                  required
                  value={form.fullName}
                  onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={10}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="role">Rol</Label>
                <Select
                  id="role"
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
                >
                  <option value="ADMIN">Admin</option>
                  <option value="ADVISOR">Asesor</option>
                  <option value="CLIENT">Cliente</option>
                </Select>
              </div>
              {createError && <p className="sm:col-span-2 text-sm text-rose-400">{createError}</p>}
              <Button type="submit" disabled={creating} className="sm:col-span-2">
                {creating ? 'Creando…' : 'Crear usuario'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="mb-4 flex gap-2">
        {ROLE_FILTERS.map((f) => (
          <Button
            key={f.value}
            size="sm"
            variant={filter === f.value ? 'default' : 'outline'}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {error && <p className="mb-4 text-sm text-rose-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : (
        <Table>
          <TableHead>
            <tr>
              <TableHeadCell>Nombre</TableHeadCell>
              <TableHeadCell>Email</TableHeadCell>
              <TableHeadCell>Rol</TableHeadCell>
              <TableHeadCell>Creado</TableHeadCell>
            </tr>
          </TableHead>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="text-slate-50">{u.fullName}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>
                  <Select value={u.role} onChange={(e) => onRoleChange(u.id, e.target.value as Role)}>
                    <option value="ADMIN">Admin</option>
                    <option value="ADVISOR">Asesor</option>
                    <option value="CLIENT">Cliente</option>
                  </Select>
                </TableCell>
                <TableCell>{new Date(u.createdAt).toLocaleDateString('es-AR')}</TableCell>
              </TableRow>
            ))}
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-slate-500">
                  No hay usuarios para este filtro.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
      <p className="mt-3 text-xs text-slate-600">
        {users.length} usuario{users.length !== 1 && 's'} · Roles: {Object.values(ROLE_LABELS).join(' · ')}
      </p>
    </DashboardLayout>
  );
}
