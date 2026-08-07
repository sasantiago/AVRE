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
import { ContractType, TenantInstrumentWithQuote } from '@/lib/types';

export default function AdminInstrumentsPage() {
  const [instruments, setInstruments] = useState<TenantInstrumentWithQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    symbol: '',
    name: '',
    assetClass: 'STOCKS' as ContractType,
    sector: '',
    exchange: '',
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setInstruments(await apiFetch<TenantInstrumentWithQuote[]>('/admin/instruments'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar el catálogo');
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
      await apiFetch('/admin/instruments', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          sector: form.sector || undefined,
          exchange: form.exchange || undefined,
        }),
      });
      setForm({ symbol: '', name: '', assetClass: 'STOCKS', sector: '', exchange: '' });
      setShowForm(false);
      await load();
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : 'No se pudo crear el instrumento');
    } finally {
      setCreating(false);
    }
  };

  const onToggle = async (id: string, isActive: boolean) => {
    setBusyId(id);
    try {
      await apiFetch(`/admin/instruments/${id}`, { method: 'PATCH', body: JSON.stringify({ isActive }) });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo actualizar el instrumento');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-50">Catálogo de mercado</h1>
          <p className="text-sm text-slate-400">Instrumentos habilitados para operar en tu tenant.</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? 'Cancelar' : 'Habilitar instrumento'}</Button>
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Habilitar instrumento</CardTitle>
            <CardDescription>Si el símbolo no existe en el catálogo global, se crea.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onCreate} className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="symbol">Símbolo (ticker)</Label>
                <Input
                  id="symbol"
                  required
                  maxLength={20}
                  value={form.symbol}
                  onChange={(e) => setForm((f) => ({ ...f, symbol: e.target.value.toUpperCase() }))}
                />
              </div>
              <div>
                <Label htmlFor="name">Nombre</Label>
                <Input
                  id="name"
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="assetClass">Clase de activo</Label>
                <Select
                  id="assetClass"
                  value={form.assetClass}
                  onChange={(e) => setForm((f) => ({ ...f, assetClass: e.target.value as ContractType }))}
                >
                  <option value="STOCKS">Acciones</option>
                  <option value="FOREX">Divisas</option>
                  <option value="MIXED">Mixto</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="sector">Sector (para el mapa de mercado)</Label>
                <Input
                  id="sector"
                  placeholder="ej. Technology, Finance, Energy"
                  value={form.sector}
                  onChange={(e) => setForm((f) => ({ ...f, sector: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="exchange">Exchange (opcional)</Label>
                <Input
                  id="exchange"
                  value={form.exchange}
                  onChange={(e) => setForm((f) => ({ ...f, exchange: e.target.value }))}
                />
              </div>
              {createError && <p className="sm:col-span-2 text-sm text-rose-400">{createError}</p>}
              <Button type="submit" disabled={creating} className="sm:col-span-2">
                {creating ? 'Creando…' : 'Habilitar'}
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
              <TableHeadCell>Símbolo</TableHeadCell>
              <TableHeadCell>Nombre</TableHeadCell>
              <TableHeadCell>Clase</TableHeadCell>
              <TableHeadCell>Estado</TableHeadCell>
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
                  <Badge tone={ti.isActive ? 'success' : 'muted'}>{ti.isActive ? 'Activo' : 'Inactivo'}</Badge>
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId === ti.id}
                    onClick={() => onToggle(ti.id, !ti.isActive)}
                  >
                    {ti.isActive ? 'Desactivar' : 'Activar'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {instruments.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-slate-500">
                  Todavía no hay instrumentos en el catálogo.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </DashboardLayout>
  );
}
