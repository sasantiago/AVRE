import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFetch, ApiError } from '@/lib/api-client';
import { ACCOUNT_STATUS_LABELS, SafeUser } from '@/lib/types';

export default function AdvisorClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<SafeUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    apiFetch<SafeUser>(`/advisor/clients/${id}`)
      .then(setClient)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar la ficha del cliente'),
      )
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <DashboardLayout>
      <Link to="/advisor/clients" className="mb-4 inline-block text-sm text-slate-400 hover:text-slate-50">
        ← Volver a mi cartera
      </Link>

      {loading && <p className="text-sm text-slate-400">Cargando…</p>}
      {error && <p className="text-sm text-rose-400">{error}</p>}

      {client && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>{client.fullName}</CardTitle>
            <CardDescription>{client.email}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Estado de cuenta</p>
                <p className="mt-1 text-slate-200">{ACCOUNT_STATUS_LABELS[client.accountStatus]}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Acuerdo de Gestión Discrecional</p>
                <Badge tone={client.agreementAcceptedVersionId ? 'success' : 'muted'} className="mt-1">
                  {client.agreementAcceptedVersionId ? 'Aceptado' : 'Pendiente de aceptación'}
                </Badge>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">2FA</p>
                <p className="mt-1 text-slate-200">{client.totpEnabled ? 'Habilitado' : 'No habilitado'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Cliente desde</p>
                <p className="mt-1 text-slate-200">{new Date(client.createdAt).toLocaleDateString('es-AR')}</p>
              </div>
            </div>
            <p className="text-xs text-slate-600">
              Historial de aportes, retiros y acuerdos: disponible cuando se habiliten los módulos de
              productos de inversión (fase posterior).
            </p>
          </CardContent>
        </Card>
      )}
    </DashboardLayout>
  );
}
