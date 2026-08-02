import { FormEvent, useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { apiFetch, ApiError } from '@/lib/api-client';
import { ACCOUNT_STATUS_LABELS, CHAIN_NETWORK_LABELS, ChainNetwork, SafeUser } from '@/lib/types';

export default function ClientProfilePage() {
  const [profile, setProfile] = useState<SafeUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [form, setForm] = useState({
    country: '',
    phoneNumber: '',
    withdrawalWalletAddress: '',
    withdrawalWalletNetwork: 'TRON_TRC20' as ChainNetwork,
  });

  useEffect(() => {
    apiFetch<SafeUser>('/profile/me')
      .then((p) => {
        setProfile(p);
        setForm({
          country: p.country ?? '',
          phoneNumber: p.phoneNumber ?? '',
          withdrawalWalletAddress: p.withdrawalWalletAddress ?? '',
          withdrawalWalletNetwork: p.withdrawalWalletNetwork ?? 'TRON_TRC20',
        });
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar tu perfil'))
      .finally(() => setLoading(false));
  }, []);

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const body: Record<string, unknown> = {
        country: form.country || undefined,
        phoneNumber: form.phoneNumber || undefined,
      };
      // Wallet: se manda el par completo solo si el cliente cargó una dirección.
      if (form.withdrawalWalletAddress) {
        body.withdrawalWalletAddress = form.withdrawalWalletAddress;
        body.withdrawalWalletNetwork = form.withdrawalWalletNetwork;
      }
      const updated = await apiFetch<SafeUser>('/profile/me', { method: 'PATCH', body: JSON.stringify(body) });
      setProfile(updated);
      setSaveSuccess(true);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'No se pudo guardar el perfil');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-50">Tu perfil</h1>
        <p className="text-sm text-slate-400">Datos de contacto y wallet de retiro.</p>
      </div>

      {error && <p className="mb-4 text-sm text-rose-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : (
        profile && (
          <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
            <Card>
              <CardHeader>
                <CardTitle>{profile.fullName}</CardTitle>
                <CardDescription>{profile.email}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 pt-0">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Estado de cuenta</span>
                  <Badge tone={profile.accountStatus === 'ACTIVE' ? 'success' : 'muted'}>
                    {ACCOUNT_STATUS_LABELS[profile.accountStatus]}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Saldo disponible</span>
                  <span className="text-slate-100">
                    {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD' }).format(
                      Number(profile.cashBalanceUsd),
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Acuerdo aceptado</span>
                  <Badge tone={profile.agreementAcceptedVersionId ? 'success' : 'muted'}>
                    {profile.agreementAcceptedVersionId ? 'Sí' : 'Pendiente'}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Editar datos</CardTitle>
                <CardDescription>
                  La wallet de retiro se usa como destino de tus próximos retiros — cambiarla bloquea nuevas
                  solicitudes de retiro por 48hs por seguridad.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={onSave} className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="country">País</Label>
                    <Input
                      id="country"
                      value={form.country}
                      onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="phoneNumber">Teléfono (formato +5491122334455)</Label>
                    <Input
                      id="phoneNumber"
                      value={form.phoneNumber}
                      onChange={(e) => setForm((f) => ({ ...f, phoneNumber: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="walletAddress">Wallet de retiro</Label>
                    <Input
                      id="walletAddress"
                      value={form.withdrawalWalletAddress}
                      onChange={(e) => setForm((f) => ({ ...f, withdrawalWalletAddress: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="walletNetwork">Red de la wallet</Label>
                    <Select
                      id="walletNetwork"
                      value={form.withdrawalWalletNetwork}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, withdrawalWalletNetwork: e.target.value as ChainNetwork }))
                      }
                    >
                      <option value="TRON_TRC20">{CHAIN_NETWORK_LABELS.TRON_TRC20}</option>
                      <option value="POLYGON">{CHAIN_NETWORK_LABELS.POLYGON}</option>
                    </Select>
                  </div>
                  {saveError && <p className="sm:col-span-2 text-sm text-rose-400">{saveError}</p>}
                  {saveSuccess && <p className="sm:col-span-2 text-sm text-emerald-400">Perfil actualizado.</p>}
                  <Button type="submit" disabled={saving} className="sm:col-span-2">
                    {saving ? 'Guardando…' : 'Guardar cambios'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        )
      )}
    </DashboardLayout>
  );
}
