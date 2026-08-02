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

export type ChainNetwork = 'TRON_TRC20' | 'POLYGON';

export const CHAIN_NETWORK_LABELS: Record<ChainNetwork, string> = {
  TRON_TRC20: 'USDT · TRON (TRC20)',
  POLYGON: 'USDC · Polygon',
};

export type ContractType = 'STOCKS' | 'FOREX' | 'MIXED';
export type ClientPackage = 'BASIC' | 'GROWTH' | 'PREMIUM';

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
  country: string | null;
  phoneNumber: string | null;
  withdrawalWalletAddress: string | null;
  withdrawalWalletNetwork: ChainNetwork | null;
  withdrawalWalletUpdatedAt: string | null;
  contractType: ContractType | null;
  clientPackage: ClientPackage | null;
  avatarUrl: string | null;
  cashBalanceUsd: string;
  createdAt: string;
  updatedAt: string;
}

// ---------- Depósitos (§6 doc Fase 3) ----------
export type DepositStatus =
  | 'PENDING_TX'
  | 'PENDING_CONFIRMATIONS'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'FAILED'
  | 'EXPIRED';

export const DEPOSIT_STATUS_LABELS: Record<DepositStatus, string> = {
  PENDING_TX: 'Esperando hash',
  PENDING_CONFIRMATIONS: 'Confirmando en la red',
  PENDING_REVIEW: 'En revisión',
  APPROVED: 'Aprobado',
  REJECTED: 'Rechazado',
  FAILED: 'Falló la verificación',
  EXPIRED: 'Vencido',
};

export const DEPOSIT_STATUS_TONE: Record<DepositStatus, 'default' | 'success' | 'warning' | 'danger' | 'muted'> = {
  PENDING_TX: 'muted',
  PENDING_CONFIRMATIONS: 'warning',
  PENDING_REVIEW: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  FAILED: 'danger',
  EXPIRED: 'muted',
};

export interface Deposit {
  id: string;
  tenantId: string;
  userId: string;
  chain: ChainNetwork;
  toAddress: string;
  declaredAmountToken: string;
  txHash: string | null;
  status: DepositStatus;
  verifiedAmountUsd: string | null;
  sourceWalletAddress: string | null;
  confirmations: number | null;
  expiresAt: string;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
}

// ---------- Retiros (§7 doc Fase 3) ----------
export type WithdrawalType = 'PARTIAL' | 'FINAL';

export const WITHDRAWAL_TYPE_LABELS: Record<WithdrawalType, string> = {
  PARTIAL: 'Parcial',
  FINAL: 'Definitivo (cierra el acuerdo)',
};

export type WithdrawalStatus =
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'FAILED';

export const WITHDRAWAL_STATUS_LABELS: Record<WithdrawalStatus, string> = {
  PENDING_REVIEW: 'En revisión',
  APPROVED: 'Aprobado',
  PROCESSING: 'Transferencia en curso',
  COMPLETED: 'Completado',
  REJECTED: 'Rechazado',
  CANCELLED: 'Cancelado',
  FAILED: 'Falló',
};

export const WITHDRAWAL_STATUS_TONE: Record<WithdrawalStatus, 'default' | 'success' | 'warning' | 'danger' | 'muted'> = {
  PENDING_REVIEW: 'warning',
  APPROVED: 'default',
  PROCESSING: 'warning',
  COMPLETED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'muted',
  FAILED: 'danger',
};

export interface AdvisorContact {
  fullName: string;
  whatsappLink: string;
}

export interface Withdrawal {
  id: string;
  tenantId: string;
  userId: string;
  type: WithdrawalType;
  status: WithdrawalStatus;
  requestedAmountUsd: string;
  agreementId: string | null;
  capitalUsd: string | null;
  gainsUsd: string | null;
  penaltyUsd: string | null;
  finalAmountUsd: string | null;
  destinationWalletAddress: string;
  destinationWalletNetwork: ChainNetwork;
  outboundTxHash: string | null;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  advisorContact?: AdvisorContact | null;
  notice?: string;
}

// ---------- Mercado y órdenes (§8, §9 doc Fase 3) ----------
export interface Instrument {
  id: string;
  symbol: string;
  name: string;
  assetClass: ContractType;
  exchange: string | null;
}

export interface TenantInstrumentWithQuote {
  id: string;
  tenantId: string;
  instrumentId: string;
  isActive: boolean;
  instrument: Instrument;
  quote: { price: string; asOf: string } | null;
  quoteError: string | null;
}

export interface Order {
  id: string;
  tenantId: string;
  userId: string;
  instrumentId: string;
  side: 'BUY' | 'SELL';
  quantity: string;
  executionPrice: string;
  totalUsd: string;
  feeAmount: string;
  createdAt: string;
}

export interface PortfolioPosition {
  instrumentSymbol: string;
  instrumentName: string;
  quantity: string;
  avgCostUsd: string;
  currentPrice: string | null;
  marketValueUsd: string | null;
  returnPct: string | null;
}

export interface Portfolio {
  cashBalanceUsd: string;
  positions: PortfolioPosition[];
  totalValueUsd: string;
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

// ---------- Colas de revisión (asesor/admin) ----------
export interface DepositWithAlerts extends Deposit {
  sourceWalletChangedWarning: boolean;
  amountMismatchWarning: boolean;
}

export interface WithdrawalWithAlerts extends Withdrawal {
  walletChangedRecentlyWarning: boolean;
}

// ---------- Métricas (§10 doc Fase 3) ----------
export interface MetricsBundle {
  capitalRaisedUsd: string;
  avgTicketUsd: string;
  avgFundingFrequencyDays: string | null;
  newClientsThisMonth: number;
  renewalRatePct: string;
  earlyExitRatePct: string;
}

export interface AdvisorMetrics extends MetricsBundle {
  advisorId: string;
  advisorName: string;
}

export interface MetricsResponse {
  depositWindowDays: number;
  agreementWindowDays: number;
  tenantTotals: MetricsBundle;
  byAdvisor: AdvisorMetrics[];
}
