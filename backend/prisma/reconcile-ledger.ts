// Reconciliación ledger <-> saldo cacheado (§5.1 del doc Fase 3): confirma que
// la suma de LedgerEntry.amount de cada cliente coincide con su
// User.cashBalanceUsd cacheado. Corre con avre_migrator (MIGRATE_DATABASE_URL,
// bypassea RLS) porque necesita leer todos los tenants en una sola pasada.
//
// Uso: npm run ledger:reconcile --workspace=backend

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.MIGRATE_DATABASE_URL } },
});

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, tenantId: true, email: true, cashBalanceUsd: true },
  });

  const sums = await prisma.ledgerEntry.groupBy({
    by: ['userId'],
    _sum: { amount: true },
  });
  const sumByUserId = new Map(sums.map((s) => [s.userId, s._sum.amount ?? 0]));

  const mismatches: Array<{ userId: string; email: string; cached: string; ledger: string }> = [];

  for (const user of users) {
    const ledgerSum = sumByUserId.get(user.id) ?? 0;
    const cached = user.cashBalanceUsd.toString();
    const ledger = ledgerSum.toString();
    if (cached !== ledger) {
      mismatches.push({ userId: user.id, email: user.email, cached, ledger });
    }
  }

  if (mismatches.length === 0) {
    console.log(`Reconciliación OK: ${users.length} usuario(s), 0 mismatches.`);
    return;
  }

  console.error(`Reconciliación FALLÓ: ${mismatches.length} mismatch(es) de ${users.length} usuario(s).`);
  for (const m of mismatches) {
    console.error(
      `  user ${m.userId} (${m.email}): cashBalanceUsd=${m.cached} vs suma de LedgerEntry=${m.ledger}`,
    );
  }
  process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
