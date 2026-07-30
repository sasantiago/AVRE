import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '@/components/brand/Logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFetch, ApiError } from '@/lib/api-client';

interface AgreementResponse {
  id: string;
  version: string;
  content: string;
}

export default function AgreementPage() {
  const navigate = useNavigate();
  const [agreement, setAgreement] = useState<AgreementResponse | null>(null);
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiFetch<AgreementResponse>('/onboarding/agreement')
      .then(setAgreement)
      .catch(() => setError('No se pudo cargar el acuerdo. Recargá la página.'));
  }, []);

  // Si el texto entra completo en el recuadro (no hay overflow), nunca se dispara
  // onScroll — sin este chequeo el checkbox quedaría bloqueado para siempre.
  useEffect(() => {
    if (!agreement) return;
    const el = scrollRef.current;
    if (el && el.scrollHeight - el.clientHeight < 24) {
      setScrolledToEnd(true);
    }
  }, [agreement]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atEnd = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    if (atEnd) setScrolledToEnd(true);
  };

  const onAccept = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch('/onboarding/agreement/accept', { method: 'POST' });
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo registrar la aceptación');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 px-6 py-16">
      <div className="mb-6">
        <Logo />
      </div>
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <span className="mb-2 inline-flex w-fit items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-[11px] font-medium text-amber-300">
            Contenido pendiente de revisión legal — versión de desarrollo
          </span>
          <CardTitle>Acuerdo de Gestión Discrecional{agreement ? ` — ${agreement.version}` : ''}</CardTitle>
          <CardDescription>
            Tenés que leer y aceptar este acuerdo antes de poder direccionar aportes de capital.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            ref={scrollRef}
            onScroll={onScroll}
            className="h-64 overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-50/10 bg-slate-900/60 p-4 text-sm text-slate-300"
          >
            {agreement ? agreement.content : 'Cargando acuerdo…'}
          </div>

          <label className="mt-4 flex items-start gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={checked}
              disabled={!scrolledToEnd}
              onChange={(e) => setChecked(e.target.checked)}
            />
            <span>
              Leí y acepto el Acuerdo de Gestión Discrecional y la Política de reembolso vigentes.
              {!scrolledToEnd && (
                <span className="block text-xs text-slate-500">
                  Desplazate hasta el final del texto para habilitar esta casilla.
                </span>
              )}
            </span>
          </label>

          {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}

          <Button
            className="mt-6 w-full"
            disabled={!checked || submitting || !agreement}
            onClick={onAccept}
          >
            {submitting ? 'Registrando aceptación…' : 'Aceptar y continuar'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
