-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('STOCKS', 'FOREX', 'MIXED');

-- CreateEnum
CREATE TYPE "ClientPackage" AS ENUM ('BASIC', 'GROWTH', 'PREMIUM');

-- CreateEnum
CREATE TYPE "ChainNetwork" AS ENUM ('TRON_TRC20', 'POLYGON');

-- CreateEnum
CREATE TYPE "DepositStatus" AS ENUM ('PENDING_TX', 'PENDING_CONFIRMATIONS', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('DEPOSIT', 'BUY', 'SELL', 'WITHDRAWAL', 'PENALTY', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "AgreementStatus" AS ENUM ('ACTIVE', 'FULFILLED', 'BREACHED', 'RENEWED', 'CLOSED');

-- CreateEnum
CREATE TYPE "WithdrawalType" AS ENUM ('PARTIAL', 'FINAL');

-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'PROCESSING', 'COMPLETED', 'REJECTED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "OrderSide" AS ENUM ('BUY', 'SELL');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "cashBalanceUsd" DECIMAL(18,8) NOT NULL DEFAULT 0,
ADD COLUMN     "clientPackage" "ClientPackage",
ADD COLUMN     "contractType" "ContractType",
ADD COLUMN     "country" TEXT,
ADD COLUMN     "phoneNumber" TEXT,
ADD COLUMN     "withdrawalWalletAddress" TEXT,
ADD COLUMN     "withdrawalWalletNetwork" "ChainNetwork",
ADD COLUMN     "withdrawalWalletUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "LedgerEntryType" NOT NULL,
    "amount" DECIMAL(18,8) NOT NULL,
    "refType" TEXT,
    "refId" UUID,
    "balanceAfter" DECIMAL(18,8) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagementAgreement" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "packageType" "ClientPackage" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "termMonths" INTEGER NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "earlyWithdrawalMaxPct" DECIMAL(5,2) NOT NULL,
    "earlyExitPenaltyPct" DECIMAL(5,2) NOT NULL,
    "status" "AgreementStatus" NOT NULL DEFAULT 'ACTIVE',
    "renewedFromId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManagementAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Instrument" (
    "id" UUID NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "assetClass" "ContractType" NOT NULL,
    "exchange" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Instrument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantInstrument" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "instrumentId" UUID NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantInstrument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holding" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "instrumentId" UUID NOT NULL,
    "quantity" DECIMAL(24,8) NOT NULL,
    "avgCostUsd" DECIMAL(18,8) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Holding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "instrumentId" UUID NOT NULL,
    "side" "OrderSide" NOT NULL DEFAULT 'BUY',
    "quantity" DECIMAL(24,8) NOT NULL,
    "executionPrice" DECIMAL(18,8) NOT NULL,
    "totalUsd" DECIMAL(18,8) NOT NULL,
    "feeAmount" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deposit" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "chain" "ChainNetwork" NOT NULL,
    "toAddress" TEXT NOT NULL,
    "declaredAmountToken" DECIMAL(24,8) NOT NULL,
    "txHash" TEXT,
    "status" "DepositStatus" NOT NULL DEFAULT 'PENDING_TX',
    "verifiedAmountUsd" DECIMAL(18,8),
    "sourceWalletAddress" TEXT,
    "verifierSnapshot" JSONB,
    "confirmations" INTEGER,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "reviewedByUserId" UUID,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Deposit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Withdrawal" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "WithdrawalType" NOT NULL,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "requestedAmountUsd" DECIMAL(18,8) NOT NULL,
    "agreementId" UUID,
    "agreementStatusAtRequest" "AgreementStatus",
    "capitalUsd" DECIMAL(18,8),
    "gainsUsd" DECIMAL(18,8),
    "penaltyUsd" DECIMAL(18,8),
    "finalAmountUsd" DECIMAL(18,8),
    "destinationWalletAddress" TEXT NOT NULL,
    "destinationWalletNetwork" "ChainNetwork" NOT NULL,
    "outboundTxHash" TEXT,
    "reviewedByUserId" UUID,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Withdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LedgerEntry_tenantId_idx" ON "LedgerEntry"("tenantId");

-- CreateIndex
CREATE INDEX "LedgerEntry_userId_idx" ON "LedgerEntry"("userId");

-- CreateIndex
CREATE INDEX "LedgerEntry_tenantId_userId_createdAt_idx" ON "LedgerEntry"("tenantId", "userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ManagementAgreement_renewedFromId_key" ON "ManagementAgreement"("renewedFromId");

-- CreateIndex
CREATE INDEX "ManagementAgreement_tenantId_idx" ON "ManagementAgreement"("tenantId");

-- CreateIndex
CREATE INDEX "ManagementAgreement_clientId_idx" ON "ManagementAgreement"("clientId");

-- CreateIndex
CREATE INDEX "ManagementAgreement_tenantId_status_idx" ON "ManagementAgreement"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Instrument_symbol_key" ON "Instrument"("symbol");

-- CreateIndex
CREATE INDEX "TenantInstrument_tenantId_idx" ON "TenantInstrument"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantInstrument_tenantId_instrumentId_key" ON "TenantInstrument"("tenantId", "instrumentId");

-- CreateIndex
CREATE INDEX "Holding_tenantId_idx" ON "Holding"("tenantId");

-- CreateIndex
CREATE INDEX "Holding_userId_idx" ON "Holding"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Holding_tenantId_userId_instrumentId_key" ON "Holding"("tenantId", "userId", "instrumentId");

-- CreateIndex
CREATE INDEX "Order_tenantId_idx" ON "Order"("tenantId");

-- CreateIndex
CREATE INDEX "Order_userId_idx" ON "Order"("userId");

-- CreateIndex
CREATE INDEX "Deposit_tenantId_idx" ON "Deposit"("tenantId");

-- CreateIndex
CREATE INDEX "Deposit_userId_idx" ON "Deposit"("userId");

-- CreateIndex
CREATE INDEX "Deposit_tenantId_status_idx" ON "Deposit"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Deposit_chain_txHash_key" ON "Deposit"("chain", "txHash");

-- CreateIndex
CREATE INDEX "Withdrawal_tenantId_idx" ON "Withdrawal"("tenantId");

-- CreateIndex
CREATE INDEX "Withdrawal_userId_idx" ON "Withdrawal"("userId");

-- CreateIndex
CREATE INDEX "Withdrawal_tenantId_status_idx" ON "Withdrawal"("tenantId", "status");

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagementAgreement" ADD CONSTRAINT "ManagementAgreement_renewedFromId_fkey" FOREIGN KEY ("renewedFromId") REFERENCES "ManagementAgreement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagementAgreement" ADD CONSTRAINT "ManagementAgreement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagementAgreement" ADD CONSTRAINT "ManagementAgreement_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantInstrument" ADD CONSTRAINT "TenantInstrument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantInstrument" ADD CONSTRAINT "TenantInstrument_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holding" ADD CONSTRAINT "Holding_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holding" ADD CONSTRAINT "Holding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holding" ADD CONSTRAINT "Holding_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deposit" ADD CONSTRAINT "Deposit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deposit" ADD CONSTRAINT "Deposit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deposit" ADD CONSTRAINT "Deposit_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "ManagementAgreement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Fase 3: servicios de admin/asesor/cliente (catálogo de mercado, cartera, depósitos,
-- retiros, ledger, acuerdo de gestión). Instrument es catálogo GLOBAL (§9.1 del doc
-- Fase 3) — no lleva tenantId, por lo tanto no lleva policy RLS. Lo que sí es
-- tenant-scoped es TenantInstrument (qué instrumentos habilitó cada tenant).
ALTER TABLE "TenantInstrument" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_tenant_instrument ON "TenantInstrument"
  USING ("tenantId" = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "Holding" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_holding ON "Holding"
  USING ("tenantId" = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "Order" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_order ON "Order"
  USING ("tenantId" = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "Deposit" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_deposit ON "Deposit"
  USING ("tenantId" = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "Withdrawal" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_withdrawal ON "Withdrawal"
  USING ("tenantId" = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "LedgerEntry" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_ledger_entry ON "LedgerEntry"
  USING ("tenantId" = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "ManagementAgreement" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_management_agreement ON "ManagementAgreement"
  USING ("tenantId" = current_setting('app.tenant_id', true)::uuid);

-- -----------------------------------------------------------------------
-- Ledger append-only real (§5.1 del doc Fase 3): ningún rol de aplicación
-- (avre_app) puede UPDATE ni DELETE una fila de LedgerEntry, ni por bug ni
-- por acceso directo a la base. Una corrección se hace siempre con un asiento
-- ADJUSTMENT nuevo de signo contrario — nunca editando el asiento original.
-- avre_migrator (dueño de la tabla) no dispara el trigger porque no hace
-- UPDATE/DELETE sobre esta tabla en ningún flujo (ni migración ni seed).
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_ledger_entry_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'LedgerEntry es append-only: no se puede modificar ni borrar un asiento existente. Use un asiento ADJUSTMENT de signo contrario.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_ledger_entry_update
BEFORE UPDATE ON "LedgerEntry"
FOR EACH ROW EXECUTE FUNCTION prevent_ledger_entry_mutation();

CREATE TRIGGER trg_prevent_ledger_entry_delete
BEFORE DELETE ON "LedgerEntry"
FOR EACH ROW EXECUTE FUNCTION prevent_ledger_entry_mutation();

-- -----------------------------------------------------------------------
-- Invariantes de negocio no expresables como constraint de Prisma (§3, §7.5):
-- a lo sumo un ManagementAgreement ACTIVE por cliente, y a lo sumo un
-- Withdrawal "en curso" por cliente a la vez.
-- -----------------------------------------------------------------------
CREATE UNIQUE INDEX one_active_agreement_per_client
  ON "ManagementAgreement" ("clientId")
  WHERE status = 'ACTIVE';

CREATE UNIQUE INDEX one_active_withdrawal_per_client
  ON "Withdrawal" ("userId")
  WHERE status IN ('PENDING_REVIEW', 'APPROVED', 'PROCESSING');
