import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/lib/auth-context';

// Placeholder — el dashboard real de mercado (sección 6.3 del doc de requerimientos)
// es una fase posterior. Esta pantalla solo prueba end-to-end que ProtectedRoute +
// RequireAgreement dejan pasar a un usuario autenticado que ya aceptó el acuerdo.
export default function DashboardPlaceholderPage() {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-6 py-16">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle>Bienvenido a AVRE</CardTitle>
          <CardDescription>
            Rol: {user?.role} · El dashboard de mercado se habilita en una fase posterior.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => logout()}>
            Cerrar sesión
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
