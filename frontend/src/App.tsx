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
import AdvisorClientsPage from './pages/advisor/AdvisorClientsPage';
import AdvisorClientDetailPage from './pages/advisor/AdvisorClientDetailPage';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { RequireRole } from './routes/RequireRole';

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
    </Routes>
  );
}
