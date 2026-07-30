// Seed inicial: tenant por defecto + primer ADMIN. Corre con avre_migrator
// (MIGRATE_DATABASE_URL, owner de las tablas) — es la única vía para crear
// ADMIN/ADVISOR, ya que POST /auth/register solo puede crear CLIENT.
//
// Uso: npm run prisma:seed --workspace=backend

import { createHash } from 'crypto';
import { PrismaClient, Role } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';
import * as argon2 from 'argon2';

const PLACEHOLDER_AGREEMENT_CONTENT = `ACUERDO DE GESTIÓN DISCRECIONAL DE CAPITAL PROPIO — v1 (PLACEHOLDER)

*** CONTENIDO PENDIENTE DE REVISIÓN LEGAL — NO USAR EN PRODUCCIÓN ***

Este texto es un placeholder de desarrollo. El Acuerdo de Gestión Discrecional real,
la Política de reembolso y cualquier cláusula de penalidad deben ser provistos y
validados por el equipo legal de AVRE Capital Group antes de publicar una versión
activa en un ambiente productivo (ver sección 12 del documento de requerimientos).`;

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.MIGRATE_DATABASE_URL } },
});

async function main() {
  const slug = process.env.DEFAULT_TENANT_SLUG ?? 'avre-default';

  const tenant = await prisma.tenant.upsert({
    where: { slug },
    update: {},
    create: { id: uuidv7(), slug, name: 'AVRE Capital Group' },
  });

  const existingActive = await prisma.discretionaryAgreement.findFirst({
    where: { tenantId: tenant.id, isActive: true },
  });

  if (!existingActive) {
    await prisma.discretionaryAgreement.create({
      data: {
        id: uuidv7(),
        tenantId: tenant.id,
        version: 'v1-placeholder',
        content: PLACEHOLDER_AGREEMENT_CONTENT,
        contentHash: createHash('sha256').update(PLACEHOLDER_AGREEMENT_CONTENT).digest('hex'),
        isActive: true,
      },
    });
    console.log('Versión placeholder del Acuerdo de Gestión Discrecional publicada (v1-placeholder).');
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@avrecapitalgroup.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;

  if (!adminPassword) {
    console.warn(
      'SEED_ADMIN_PASSWORD no definido — se omite la creación del admin inicial. ' +
        'Definilo en .env y volvé a correr el seed si hace falta un ADMIN.',
    );
    console.log(`Seed listo: tenant "${slug}" (sin admin todavía).`);
    return;
  }

  const passwordHash = await argon2.hash(adminPassword, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: adminEmail } },
    update: {},
    create: {
      id: uuidv7(),
      tenantId: tenant.id,
      email: adminEmail,
      passwordHash,
      fullName: 'Admin AVRE',
      role: Role.ADMIN,
    },
  });

  console.log(`Seed listo: tenant "${slug}" + admin "${adminEmail}".`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
