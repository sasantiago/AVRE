import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Logo } from '@/components/brand/Logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api-client';
import { loginSchema, LoginFormValues } from '@/lib/validators/auth.schemas';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [needsTotp, setNeedsTotp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: LoginFormValues) => {
    setError(null);
    try {
      const result = await login(values.email, values.password, values.totpCode);
      if (result.requiresTotp) {
        setNeedsTotp(true);
        return;
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo iniciar sesión');
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-900 px-6 py-16">
      <div className="pointer-events-none fixed -top-36 -left-28 h-[520px] w-[520px] rounded-full bg-indigo-500/25 blur-[120px]" />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 w-full max-w-sm"
      >
        <Link to="/" className="mb-6 flex justify-center">
          <Logo />
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>Iniciar sesión</CardTitle>
            <CardDescription>Accedé a tu espacio financiero AVRE.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="email" {...register('email')} />
                {errors.email && <p className="mt-1 text-xs text-rose-400">{errors.email.message}</p>}
              </div>
              <div>
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  {...register('password')}
                />
                {errors.password && (
                  <p className="mt-1 text-xs text-rose-400">{errors.password.message}</p>
                )}
              </div>

              {needsTotp && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                  <Label htmlFor="totpCode">Código de tu app de autenticación</Label>
                  <Input id="totpCode" inputMode="numeric" maxLength={6} {...register('totpCode')} />
                </motion.div>
              )}

              {error && <p className="text-sm text-rose-400">{error}</p>}

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Ingresando…' : needsTotp ? 'Verificar código' : 'Ingresar'}
              </Button>
            </form>

            <div className="mt-6 flex items-center justify-between text-xs text-slate-400">
              <Link to="/register" className="hover:text-slate-50">
                Crear cuenta
              </Link>
              <Link to="/password-reset" className="hover:text-slate-50">
                Olvidé mi contraseña
              </Link>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
