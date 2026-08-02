import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DepositsQueue } from '@/components/review/DepositsQueue';

export default function AdminDepositsPage() {
  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-50">Depósitos por revisar</h1>
        <p className="text-sm text-slate-400">Todos los depósitos pendientes de revisión del tenant.</p>
      </div>
      <DepositsQueue basePath="/admin/deposits" />
    </DashboardLayout>
  );
}
