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
