// Requiere Postgres real con la migración (incluyendo los triggers
// prevent_ledger_entry_mutation) ya aplicada. npm run test:e2e --workspace=backend

import { randomUUID } from 'crypto';
import { Client } from 'pg';

const MIGRATOR_URL = process.env.MIGRATE_DATABASE_URL;
const describeIfDb = MIGRATOR_URL ? describe : describe.skip;

describeIfDb('Trigger de inmutabilidad de LedgerEntry (§5.1)', () => {
  let client: Client;
  let tenantId: string;
  let userId: string;
  let entryId: string;

  beforeAll(async () => {
    client = new Client({ connectionString: MIGRATOR_URL });
    await client.connect();

    tenantId = randomUUID();
    userId = randomUUID();
    entryId = randomUUID();

    await client.query(
      `INSERT INTO "Tenant" (id, slug, name) VALUES ($1, $2, 'Tenant ledger e2e')`,
      [tenantId, `tenant-ledger-e2e-${tenantId}`],
    );
    await client.query(
      `INSERT INTO "User" (id, "tenantId", email, "passwordHash", "fullName", role, "cashBalanceUsd")
       VALUES ($1, $2, 'ledger@e2e.test', 'x', 'User', 'CLIENT', 100)`,
      [userId, tenantId],
    );
    await client.query(
      `INSERT INTO "LedgerEntry" (id, "tenantId", "userId", type, amount, "balanceAfter")
       VALUES ($1, $2, $3, 'DEPOSIT', 100, 100)`,
      [entryId, tenantId, userId],
    );
  });

  afterAll(async () => {
    // Deshabilitar temporalmente el trigger es la única forma de borrar datos de
    // un test contra una tabla append-only por diseño.
    await client.query(`ALTER TABLE "LedgerEntry" DISABLE TRIGGER trg_prevent_ledger_entry_delete`);
    await client.query(`DELETE FROM "LedgerEntry" WHERE id = $1`, [entryId]);
    await client.query(`ALTER TABLE "LedgerEntry" ENABLE TRIGGER trg_prevent_ledger_entry_delete`);
    await client.query(`DELETE FROM "User" WHERE id = $1`, [userId]);
    await client.query(`DELETE FROM "Tenant" WHERE id = $1`, [tenantId]);
    await client.end();
  });

  it('rechaza UPDATE sobre un asiento existente', async () => {
    await expect(
      client.query(`UPDATE "LedgerEntry" SET amount = 999 WHERE id = $1`, [entryId]),
    ).rejects.toThrow(/append-only/);
  });

  it('rechaza DELETE sobre un asiento existente', async () => {
    await expect(
      client.query(`DELETE FROM "LedgerEntry" WHERE id = $1`, [entryId]),
    ).rejects.toThrow(/append-only/);
  });

  it('permite INSERT de un nuevo asiento (append-only, no write-once)', async () => {
    const newEntryId = randomUUID();
    await expect(
      client.query(
        `INSERT INTO "LedgerEntry" (id, "tenantId", "userId", type, amount, "balanceAfter")
         VALUES ($1, $2, $3, 'ADJUSTMENT', 5, 105)`,
        [newEntryId, tenantId, userId],
      ),
    ).resolves.toBeDefined();

    // Limpieza del asiento extra creado en este test (mismo mecanismo que afterAll).
    await client.query(`ALTER TABLE "LedgerEntry" DISABLE TRIGGER trg_prevent_ledger_entry_delete`);
    await client.query(`DELETE FROM "LedgerEntry" WHERE id = $1`, [newEntryId]);
    await client.query(`ALTER TABLE "LedgerEntry" ENABLE TRIGGER trg_prevent_ledger_entry_delete`);
  });
});
