import { Route, Routes } from 'react-router-dom';
import AvreLanding from './pages/landing/AvreLanding';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import PasswordResetRequestPage from './pages/auth/PasswordResetRequestPage';
import PasswordResetConfirmPage from './pages/auth/PasswordResetConfirmPage';
import AgreementPage from './pages/onboarding/AgreementPage';
import DashboardEntryPage from './pages/dashboard/DashboardEntryPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminClientsPage from './pages/admin/AdminClientsPage';
import AdminAuditPage from './pages/admin/AdminAuditPage';
import AdminDepositsPage from './pages/admin/AdminDepositsPage';
import AdminWithdrawalsPage from './pages/admin/AdminWithdrawalsPage';
import AdminInstrumentsPage from './pages/admin/AdminInstrumentsPage';
import AdminMetricsPage from './pages/admin/AdminMetricsPage';
import AdvisorClientsPage from './pages/advisor/AdvisorClientsPage';
import AdvisorClientDetailPage from './pages/advisor/AdvisorClientDetailPage';
import AdvisorDepositsPage from './pages/advisor/AdvisorDepositsPage';
import AdvisorWithdrawalsPage from './pages/advisor/AdvisorWithdrawalsPage';
import ClientPortfolioPage from './pages/client/ClientPortfolioPage';
import ClientDepositsPage from './pages/client/ClientDepositsPage';
import ClientWithdrawalsPage from './pages/client/ClientWithdrawalsPage';
import ClientMarketPage from './pages/client/ClientMarketPage';
import ClientProfilePage from './pages/client/ClientProfilePage';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { RequireRole } from './routes/RequireRole';
import { RequireAgreement } from './routes/RequireAgreement';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AvreLanding />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/password-reset" element={<PasswordResetRequestPage />} />
      <Route path="/reset-password" element={<PasswordResetConfirmPage />} />
      <Route
        path="/onboarding/agreement"
        element={
          <ProtectedRoute>
            <AgreementPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardEntryPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/users"
        element={
          <ProtectedRoute>
            <RequireRole allow={['ADMIN']}>
              <AdminUsersPage />
            </RequireRole>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/clients"
        element={
          <ProtectedRoute>
            <RequireRole allow={['ADMIN']}>
              <AdminClientsPage />
            </RequireRole>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/audit"
        element={
          <ProtectedRoute>
            <RequireRole allow={['ADMIN']}>
              <AdminAuditPage />
            </RequireRole>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/deposits"
        element={
          <ProtectedRoute>
            <RequireRole allow={['ADMIN']}>
              <AdminDepositsPage />
            </RequireRole>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/withdrawals"
        element={
          <ProtectedRoute>
            <RequireRole allow={['ADMIN']}>
              <AdminWithdrawalsPage />
            </RequireRole>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/instruments"
        element={
          <ProtectedRoute>
            <RequireRole allow={['ADMIN']}>
              <AdminInstrumentsPage />
            </RequireRole>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/metrics"
        element={
          <ProtectedRoute>
            <RequireRole allow={['ADMIN']}>
              <AdminMetricsPage />
            </RequireRole>
          </ProtectedRoute>
        }
      />

      <Route
        path="/advisor/clients"
        element={
          <ProtectedRoute>
            <RequireRole allow={['ADVISOR']}>
              <AdvisorClientsPage />
            </RequireRole>
          </ProtectedRoute>
        }
      />
      <Route
        path="/advisor/clients/:id"
        element={
          <ProtectedRoute>
            <RequireRole allow={['ADVISOR']}>
              <AdvisorClientDetailPage />
            </RequireRole>
          </ProtectedRoute>
        }
      />
      <Route
        path="/advisor/deposits"
        element={
          <ProtectedRoute>
            <RequireRole allow={['ADVISOR']}>
              <AdvisorDepositsPage />
            </RequireRole>
          </ProtectedRoute>
        }
      />
      <Route
        path="/advisor/withdrawals"
        element={
          <ProtectedRoute>
            <RequireRole allow={['ADVISOR']}>
              <AdvisorWithdrawalsPage />
            </RequireRole>
          </ProtectedRoute>
        }
      />

      <Route
        path="/client/portfolio"
        element={
          <ProtectedRoute>
            <RequireRole allow={['CLIENT']}>
              <RequireAgreement>
                <ClientPortfolioPage />
              </RequireAgreement>
            </RequireRole>
          </ProtectedRoute>
        }
      />
      <Route
        path="/client/deposits"
        element={
          <ProtectedRoute>
            <RequireRole allow={['CLIENT']}>
              <RequireAgreement>
                <ClientDepositsPage />
              </RequireAgreement>
            </RequireRole>
          </ProtectedRoute>
        }
      />
      <Route
        path="/client/withdrawals"
        element={
          <ProtectedRoute>
            <RequireRole allow={['CLIENT']}>
              <RequireAgreement>
                <ClientWithdrawalsPage />
              </RequireAgreement>
            </RequireRole>
          </ProtectedRoute>
        }
      />
      <Route
        path="/client/market"
        element={
          <ProtectedRoute>
            <RequireRole allow={['CLIENT']}>
              <RequireAgreement>
                <ClientMarketPage />
              </RequireAgreement>
            </RequireRole>
          </ProtectedRoute>
        }
      />
      <Route
        path="/client/profile"
        element={
          <ProtectedRoute>
            <RequireRole allow={['CLIENT']}>
              <RequireAgreement>
                <ClientProfilePage />
              </RequireAgreement>
            </RequireRole>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
