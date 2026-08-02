import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { GeometricOrb } from '@/components/three/GeometricOrb';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from '@/components/ui/table';
import { apiFetch, ApiError } from '@/lib/api-client';
import { Portfolio } from '@/lib/types';

function fmtUsd(value: string | null) {
  if (value === null) return '—';
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD' }).format(Number(value));
}

export default function ClientPortfolioPage() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Portfolio>('/client/portfolio')
      .then(setPortfolio)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar tu portfolio'))
      .finally(() => setLoading(false));
  }, []);

  const totalGainUsd = portfolio
    ? portfolio.positions.reduce((sum, p) => {
        if (!p.marketValueUsd) return sum;
        const cost = Number(p.quantity) * Number(p.avgCostUsd);
        return sum + (Number(p.marketValueUsd) - cost);
      }, 0)
    : 0;
  const tone = totalGainUsd > 0 ? 'positive' : totalGainUsd < 0 ? 'negative' : 'neutral';

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-50">Tu portfolio</h1>
        <p className="text-sm text-slate-400">Saldo disponible, posiciones abiertas y valor total en tiempo real.</p>
      </div>

      {error && <p className="mb-4 text-sm text-rose-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : (
        portfolio && (
          <>
            <Card className="mb-6 overflow-hidden">
              <CardContent className="flex flex-col items-center gap-6 p-8 sm:flex-row sm:justify-between">
                <div className="flex flex-1 flex-col gap-4 text-center sm:text-left">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Valor total</p>
                    <p className="text-4xl font-bold tracking-tight text-slate-50">
                      {fmtUsd(portfolio.totalValueUsd)}
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-6 sm:justify-start">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Saldo disponible</p>
                      <p className="text-lg font-semibold text-slate-100">{fmtUsd(portfolio.cashBalanceUsd)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Posiciones</p>
                      <p className="text-lg font-semibold text-slate-100">{portfolio.positions.length}</p>
                    </div>
                  </div>
                </div>
                <GeometricOrb size={180} tone={tone} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Posiciones abiertas</CardTitle>
                <CardDescription>Instrumentos comprados, con valor de mercado y rendimiento actual.</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Table>
                  <TableHead>
                    <tr>
                      <TableHeadCell>Instrumento</TableHeadCell>
                      <TableHeadCell>Cantidad</TableHeadCell>
                      <TableHeadCell>Costo prom.</TableHeadCell>
                      <TableHeadCell>Precio actual</TableHeadCell>
                      <TableHeadCell>Valor de mercado</TableHeadCell>
                      <TableHeadCell>Rendimiento</TableHeadCell>
                    </tr>
                  </TableHead>
                  <TableBody>
                    {portfolio.positions.map((p) => (
                      <TableRow key={p.instrumentSymbol}>
                        <TableCell className="text-slate-50">
                          {p.instrumentSymbol}
                          <span className="ml-2 text-xs text-slate-500">{p.instrumentName}</span>
                        </TableCell>
                        <TableCell>{p.quantity}</TableCell>
                        <TableCell>{fmtUsd(p.avgCostUsd)}</TableCell>
                        <TableCell>{p.currentPrice ? fmtUsd(p.currentPrice) : 'Sin cotización'}</TableCell>
                        <TableCell>{fmtUsd(p.marketValueUsd)}</TableCell>
                        <TableCell
                          className={
                            p.returnPct === null
                              ? ''
                              : Number(p.returnPct) >= 0
                                ? 'text-emerald-400'
                                : 'text-rose-400'
                          }
                        >
                          {p.returnPct === null ? '—' : `${Number(p.returnPct).toFixed(2)}%`}
                        </TableCell>
                      </TableRow>
                    ))}
                    {portfolio.positions.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-slate-500">
                          Todavía no tenés posiciones — comprá algo desde Mercado.
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
