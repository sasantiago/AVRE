import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { WithdrawalsQueue } from '@/components/review/WithdrawalsQueue';

export default function AdvisorWithdrawalsPage() {
  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-50">Retiros por revisar</h1>
        <p className="text-sm text-slate-400">
          Solicitudes de retiro de tus clientes. Los retiros definitivos anticipados necesitan que acuerdes el
          monto final por WhatsApp antes de aprobar.
        </p>
      </div>
      <WithdrawalsQueue basePath="/advisor/withdrawals" />
    </DashboardLayout>
  );
}
