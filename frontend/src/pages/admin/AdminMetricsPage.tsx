import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from '@/components/ui/table';
import { apiFetch, ApiError } from '@/lib/api-client';
import { MetricsBundle, MetricsResponse } from '@/lib/types';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-2xl font-bold tracking-tight text-slate-50">{value}</p>
    </div>
  );
}

function bundleStats(b: MetricsBundle) {
  return [
    { label: 'Capital captado', value: `$${Number(b.capitalRaisedUsd).toLocaleString('es-AR')}` },
    { label: 'Ticket promedio', value: `$${Number(b.avgTicketUsd).toLocaleString('es-AR')}` },
    { label: 'Frecuencia de fondeo', value: b.avgFundingFrequencyDays ? `${Number(b.avgFundingFrequencyDays).toFixed(1)} días` : '—' },
    { label: 'Clientes nuevos (mes)', value: String(b.newClientsThisMonth) },
    { label: 'Tasa de renovación', value: `${b.renewalRatePct}%` },
    { label: 'Tasa de salida anticipada', value: `${b.earlyExitRatePct}%` },
  ];
}

export default function AdminMetricsPage() {
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<MetricsResponse>('/admin/metrics')
      .then(setMetrics)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudieron cargar las métricas'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-50">Métricas</h1>
        <p className="text-sm text-slate-400">
          {metrics && `Ventana de ${metrics.depositWindowDays} días (depósitos) / ${metrics.agreementWindowDays} días (acuerdos).`}
        </p>
      </div>

      {error && <p className="mb-4 text-sm text-rose-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : (
        metrics && (
          <>
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Totales del tenant</CardTitle>
                <CardDescription>Agregado de todos los asesores.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-6 pt-0 sm:grid-cols-3 lg:grid-cols-6">
                {bundleStats(metrics.tenantTotals).map((s) => (
                  <Stat key={s.label} {...s} />
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Por asesor</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <Table>
                  <TableHead>
                    <tr>
                      <TableHeadCell>Asesor</TableHeadCell>
                      <TableHeadCell>Capital captado</TableHeadCell>
                      <TableHeadCell>Ticket prom.</TableHeadCell>
                      <TableHeadCell>Clientes nuevos</TableHeadCell>
                      <TableHeadCell>Renovación</TableHeadCell>
                      <TableHeadCell>Salida anticipada</TableHeadCell>
                    </tr>
                  </TableHead>
                  <TableBody>
                    {metrics.byAdvisor.map((a) => (
                      <TableRow key={a.advisorId}>
                        <TableCell className="text-slate-50">{a.advisorName}</TableCell>
                        <TableCell>${Number(a.capitalRaisedUsd).toLocaleString('es-AR')}</TableCell>
                        <TableCell>${Number(a.avgTicketUsd).toLocaleString('es-AR')}</TableCell>
                        <TableCell>{a.newClientsThisMonth}</TableCell>
                        <TableCell>{a.renewalRatePct}%</TableCell>
                        <TableCell>{a.earlyExitRatePct}%</TableCell>
                      </TableRow>
                    ))}
                    {metrics.byAdvisor.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-slate-500">
                          Todavía no hay asesores.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )
      )}
    </DashboardLayout>
  );
}
