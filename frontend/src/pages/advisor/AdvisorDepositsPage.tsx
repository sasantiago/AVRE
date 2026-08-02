import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DepositsQueue } from '@/components/review/DepositsQueue';

export default function AdvisorDepositsPage() {
  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-50">Depósitos por revisar</h1>
        <p className="text-sm text-slate-400">Depósitos verificados on-chain de tus clientes, pendientes de aprobación.</p>
      </div>
      <DepositsQueue basePath="/advisor/deposits" />
    </DashboardLayout>
  );
}
