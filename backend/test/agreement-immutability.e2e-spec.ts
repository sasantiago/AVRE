// Requiere Postgres real con la migración (incluyendo el trigger de inmutabilidad)
// ya aplicada. npm run test:e2e --workspace=backend

import { randomUUID } from 'crypto';
import { createHash } from 'crypto';
import { Client } from 'pg';

const MIGRATOR_URL = process.env.MIGRATE_DATABASE_URL;
const describeIfDb = MIGRATOR_URL ? describe : describe.skip;

describeIfDb('Trigger de inmutabilidad de DiscretionaryAgreement', () => {
  let client: Client;
  let tenantId: string;
  let agreementId: string;
  let userId: string;

  beforeAll(async () => {
    client = new Client({ connectionString: MIGRATOR_URL });
    await client.connect();

    tenantId = randomUUID();
    agreementId = randomUUID();
    userId = randomUUID();
    const content = 'contenido original v1';

    await client.query(`INSERT INTO "Tenant" (id, slug, name) VALUES ($1, $2, 'Tenant e2e')`, [
      tenantId,
      `tenant-immut-e2e-${tenantId}`,
    ]);
    await client.query(
      `INSERT INTO "DiscretionaryAgreement" (id, "tenantId", version, content, "contentHash", "isActive")
       VALUES ($1, $2, 'v1', $3, $4, true)`,
      [agreementId, tenantId, content, createHash('sha256').update(content).digest('hex')],
    );
    await client.query(
      `INSERT INTO "User" (id, "tenantId", email, "passwordHash", "fullName", role)
       VALUES ($1, $2, 'immut@e2e.test', 'x', 'User', 'CLIENT')`,
      [userId, tenantId],
    );
  });

  afterAll(async () => {
    await client.query(`DELETE FROM "AgreementAcceptance" WHERE "agreementVersionId" = $1`, [
      agreementId,
    ]);
    await client.query(`DELETE FROM "User" WHERE id = $1`, [userId]);
    await client.query(`DELETE FROM "DiscretionaryAgreement" WHERE id = $1`, [agreementId]);
    await client.query(`DELETE FROM "Tenant" WHERE id = $1`, [tenantId]);
    await client.end();
  });

  it('permite UPDATE de content mientras no haya aceptaciones', async () => {
    await expect(
      client.query(`UPDATE "DiscretionaryAgreement" SET content = 'editado sin aceptaciones' WHERE id = $1`, [
        agreementId,
      ]),
    ).resolves.toBeDefined();
  });

  it('rechaza UPDATE de content/contentHash una vez que existe al menos una aceptación', async () => {
    await client.query(
      `INSERT INTO "AgreementAcceptance" (id, "tenantId", "userId", "agreementVersionId", "ipAddress", "userAgent")
       VALUES ($1, $2, $3, $4, '203.0.113.1', 'jest')`,
      [randomUUID(), tenantId, userId, agreementId],
    );

    await expect(
      client.query(`UPDATE "DiscretionaryAgreement" SET content = 'intento de edición posterior' WHERE id = $1`, [
        agreementId,
      ]),
    ).rejects.toThrow();
  });

  it('sigue permitiendo UPDATE de campos no sensibles (ej. isActive) aunque haya aceptaciones', async () => {
    await expect(
      client.query(`UPDATE "DiscretionaryAgreement" SET "isActive" = false WHERE id = $1`, [agreementId]),
    ).resolves.toBeDefined();
  });
});
