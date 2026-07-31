-- SQL manual a fusionar en la migración inicial de Prisma
-- (generarla con `prisma migrate dev --create-only`, pegar esto al final del
-- migration.sql generado, antes de aplicarla con `prisma migrate dev`).
--
-- Patrón RLS: se repite igual para cada tabla tenant-scoped. El 'true' en
-- current_setting evita error cuando la variable no está seteada (conexiones
-- de avre_migrator corriendo migraciones/seed no necesitan setearla).

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_user ON "User"
  USING ("tenantId" = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "RefreshToken" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_refresh_token ON "RefreshToken"
  USING ("tenantId" = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "TotpSecret" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_totp_secret ON "TotpSecret"
  USING ("tenantId" = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "PasswordResetToken" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_password_reset_token ON "PasswordResetToken"
  USING ("tenantId" = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "DiscretionaryAgreement" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_discretionary_agreement ON "DiscretionaryAgreement"
  USING ("tenantId" = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "AgreementAcceptance" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_agreement_acceptance ON "AgreementAcceptance"
  USING ("tenantId" = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_audit_log ON "AuditLog"
  USING ("tenantId" = current_setting('app.tenant_id', true)::uuid);

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
-- Inmutabilidad de una versión de acuerdo ya aceptada por al menos un
-- cliente: sin esto, un UPDATE accidental sobre una versión "activa" con
-- aceptaciones registradas corrompe el historial de auditoría sin que nada
-- lo detecte (el valor legal de AgreementAcceptance depende de poder
-- reconstruir exactamente el texto que se aceptó).
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_agreement_content_update() RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM "AgreementAcceptance"
        WHERE "agreementVersionId" = OLD.id) > 0
     AND (NEW.content IS DISTINCT FROM OLD.content
          OR NEW."contentHash" IS DISTINCT FROM OLD."contentHash") THEN
    RAISE EXCEPTION
      'No se puede modificar el contenido de una version ya aceptada; publique una version nueva.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_agreement_content_update
BEFORE UPDATE ON "DiscretionaryAgreement"
FOR EACH ROW EXECUTE FUNCTION prevent_agreement_content_update();

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
