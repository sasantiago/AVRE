import { Role } from './auth-context';

export type AccountStatus = 'ACTIVE' | 'DELINQUENT' | 'WITHDRAWAL_PENDING' | 'CLOSED';

export const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  ACTIVE: 'Activo',
  DELINQUENT: 'En mora',
  WITHDRAWAL_PENDING: 'En proceso de retiro',
  CLOSED: 'Finalizado',
};

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Admin',
  ADVISOR: 'Asesor',
  CLIENT: 'Cliente',
};

export interface SafeUser {
  id: string;
  tenantId: string;
  email: string;
  fullName: string;
  role: Role;
  totpEnabled: boolean;
  agreementAcceptedVersionId: string | null;
  advisorId: string | null;
  accountStatus: AccountStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogEntry {
  id: string;
  tenantId: string;
  actorUserId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface PaginatedAuditLog {
  items: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
}
