import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/lib/api-client';
import {
  passwordResetRequestSchema,
  PasswordResetRequestFormValues,
} from '@/lib/validators/auth.schemas';

export default function PasswordResetRequestPage() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PasswordResetRequestFormValues>({ resolver: zodResolver(passwordResetRequestSchema) });

  const onSubmit = async (values: PasswordResetRequestFormValues) => {
    // El backend responde el mismo mensaje genérico exista o no el email —
    // no hay nada que distinguir acá tampoco.
    await apiFetch('/auth/password-reset/request', {
      method: 'POST',
      body: JSON.stringify(values),
    }).catch(() => undefined);
    setSent(true);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-6 py-16">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Restablecer contraseña</CardTitle>
          <CardDescription>Te enviamos un link si el email existe en AVRE.</CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <p className="text-sm text-slate-300">
              Si el email existe, vas a recibir instrucciones para restablecer tu contraseña.
            </p>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="email" {...register('email')} />
                {errors.email && <p className="mt-1 text-xs text-rose-400">{errors.email.message}</p>}
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Enviando…' : 'Enviar instrucciones'}
              </Button>
            </form>
          )}
          <p className="mt-6 text-center text-xs text-slate-400">
            <Link to="/login" className="hover:text-slate-50">
              Volver a iniciar sesión
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
