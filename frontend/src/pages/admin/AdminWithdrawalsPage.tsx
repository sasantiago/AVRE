import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { WithdrawalsQueue } from '@/components/review/WithdrawalsQueue';

export default function AdminWithdrawalsPage() {
  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-50">Retiros por revisar</h1>
        <p className="text-sm text-slate-400">
          Todas las solicitudes de retiro del tenant. Una vez aprobado, cargá el ID de la transferencia de
          salida para marcarlo en curso.
        </p>
      </div>
      <WithdrawalsQueue basePath="/admin/withdrawals" canMarkProcessing />
    </DashboardLayout>
  );
}
