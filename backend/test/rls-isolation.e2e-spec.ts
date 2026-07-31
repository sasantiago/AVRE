// Requiere Postgres real corriendo (docker compose up -d postgres) con las policies RLS
// ya aplicadas (prisma migrate dev con el SQL manual fusionado). Corre con el rol
// avre_app real — NO con avre_migrator, que al ser owner bypassea RLS igual.
//
// npm run test:e2e --workspace=backend

import { randomUUID } from 'crypto';
import { Client } from 'pg';

const APP_URL = process.env.DATABASE_URL;
const MIGRATOR_URL = process.env.MIGRATE_DATABASE_URL;

const describeIfDb = APP_URL && MIGRATOR_URL ? describe : describe.skip;

describeIfDb('Aislamiento cross-tenant vía RLS (rol avre_app)', () => {
  let migrator: Client;
  let tenantAId: string;
  let tenantBId: string;
  let userAId: string;
  let userBId: string;
  let ledgerEntryAId: string;
  let ledgerEntryBId: string;
  let agreementAId: string;
  let agreementBId: string;

  beforeAll(async () => {
    migrator = new Client({ connectionString: MIGRATOR_URL });
    await migrator.connect();

    tenantAId = randomUUID();
    tenantBId = randomUUID();
    userAId = randomUUID();
    userBId = randomUUID();
    ledgerEntryAId = randomUUID();
    ledgerEntryBId = randomUUID();
    agreementAId = randomUUID();
    agreementBId = randomUUID();

    await migrator.query(
      `INSERT INTO "Tenant" (id, slug, name) VALUES ($1, $2, 'Tenant A e2e'), ($3, $4, 'Tenant B e2e')`,
      [tenantAId, `tenant-a-e2e-${tenantAId}`, tenantBId, `tenant-b-e2e-${tenantBId}`],
    );
    await migrator.query(
      `INSERT INTO "User" (id, "tenantId", email, "passwordHash", "fullName", role)
       VALUES ($1, $2, 'a@e2e.test', 'x', 'User A', 'CLIENT'),
              ($3, $4, 'b@e2e.test', 'x', 'User B', 'CLIENT')`,
      [userAId, tenantAId, userBId, tenantBId],
    );
    // Fase 3: LedgerEntry y ManagementAgreement también deben aislarse por tenant.
    await migrator.query(
      `INSERT INTO "LedgerEntry" (id, "tenantId", "userId", type, amount, "balanceAfter")
       VALUES ($1, $2, $3, 'DEPOSIT', 100, 100), ($4, $5, $6, 'DEPOSIT', 100, 100)`,
      [ledgerEntryAId, tenantAId, userAId, ledgerEntryBId, tenantBId, userBId],
    );
    await migrator.query(
      `INSERT INTO "ManagementAgreement"
         (id, "tenantId", "clientId", "packageType", "startDate", "termMonths", "endDate",
          "earlyWithdrawalMaxPct", "earlyExitPenaltyPct")
       VALUES ($1, $2, $3, 'BASIC', now(), 6, now() + interval '6 months', 10, 15),
              ($4, $5, $6, 'BASIC', now(), 6, now() + interval '6 months', 10, 15)`,
      [agreementAId, tenantAId, userAId, agreementBId, tenantBId, userBId],
    );
  });

  afterAll(async () => {
    // LedgerEntry es append-only (trigger de inmutabilidad) — hay que deshabilitar
    // el trigger para poder limpiar los datos de este test.
    await migrator.query(
      `ALTER TABLE "LedgerEntry" DISABLE TRIGGER trg_prevent_ledger_entry_delete`,
    );
    await migrator.query(`DELETE FROM "LedgerEntry" WHERE id IN ($1, $2)`, [
      ledgerEntryAId,
      ledgerEntryBId,
    ]);
    await migrator.query(
      `ALTER TABLE "LedgerEntry" ENABLE TRIGGER trg_prevent_ledger_entry_delete`,
    );
    await migrator.query(`DELETE FROM "ManagementAgreement" WHERE id IN ($1, $2)`, [
      agreementAId,
      agreementBId,
    ]);
    await migrator.query(`DELETE FROM "User" WHERE id IN ($1, $2)`, [userAId, userBId]);
    await migrator.query(`DELETE FROM "Tenant" WHERE id IN ($1, $2)`, [tenantAId, tenantBId]);
    await migrator.end();
  });

  it('avre_app con app.tenant_id = tenant A no ve usuarios del tenant B', async () => {
    const appClient = new Client({ connectionString: APP_URL });
    await appClient.connect();
    try {
      await appClient.query(`SELECT set_config('app.tenant_id', $1, false)`, [tenantAId]);

      const result = await appClient.query(`SELECT id, "tenantId" FROM "User" ORDER BY email`);

      const ids = result.rows.map((r) => r.id);
      expect(ids).toContain(userAId);
      expect(ids).not.toContain(userBId);
    } finally {
      await appClient.end();
    }
  });

  it('avre_app con app.tenant_id = tenant A no ve asientos de LedgerEntry del tenant B', async () => {
    const appClient = new Client({ connectionString: APP_URL });
    await appClient.connect();
    try {
      await appClient.query(`SELECT set_config('app.tenant_id', $1, false)`, [tenantAId]);
      const result = await appClient.query(`SELECT id FROM "LedgerEntry" WHERE id IN ($1, $2)`, [
        ledgerEntryAId,
        ledgerEntryBId,
      ]);
      const ids = result.rows.map((r) => r.id);
      expect(ids).toContain(ledgerEntryAId);
      expect(ids).not.toContain(ledgerEntryBId);
    } finally {
      await appClient.end();
    }
  });

  it('avre_app con app.tenant_id = tenant A no ve ManagementAgreement del tenant B', async () => {
    const appClient = new Client({ connectionString: APP_URL });
    await appClient.connect();
    try {
      await appClient.query(`SELECT set_config('app.tenant_id', $1, false)`, [tenantAId]);
      const result = await appClient.query(
        `SELECT id FROM "ManagementAgreement" WHERE id IN ($1, $2)`,
        [agreementAId, agreementBId],
      );
      const ids = result.rows.map((r) => r.id);
      expect(ids).toContain(agreementAId);
      expect(ids).not.toContain(agreementBId);
    } finally {
      await appClient.end();
    }
  });

  it('avre_app sin app.tenant_id seteado no ve ninguna fila (fail-closed)', async () => {
    const appClient = new Client({ connectionString: APP_URL });
    await appClient.connect();
    try {
      const result = await appClient.query(`SELECT id FROM "User" WHERE id IN ($1, $2)`, [
        userAId,
        userBId,
      ]);
      expect(result.rows).toHaveLength(0);
    } finally {
      await appClient.end();
    }
  });

  it('avre_app NOBYPASSRLS está confirmado a nivel de rol', async () => {
    const result = await migrator.query(
      `SELECT rolbypassrls FROM pg_roles WHERE rolname = 'avre_app'`,
    );
    expect(result.rows[0]?.rolbypassrls).toBe(false);
  });
});
