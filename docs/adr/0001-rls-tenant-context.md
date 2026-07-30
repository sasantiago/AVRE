# ADR 0001 — Aislamiento multi-tenant: roles de Postgres + RLS + contexto por request

## Contexto

El doc de requerimientos exige `tenant_id` + Row-Level Security desde el día uno, aunque
exista un solo tenant al principio (sección 4). RLS solo protege de verdad si el rol de
conexión no tiene `BYPASSRLS` ni es owner de las tablas — de lo contrario Postgres ignora
las policies para ese rol.

## Decisión

1. **Dos roles de Postgres** (`infra/postgres/init/001-roles.sh`):
   - `avre_migrator`: owner de las tablas, `CREATEDB`, corre `prisma migrate` y el seed.
   - `avre_app`: `NOBYPASSRLS` explícito, único rol que usa el backend en runtime
     (`DATABASE_URL`). Recibe grants vía `ALTER DEFAULT PRIVILEGES` para heredar acceso a
     tablas futuras creadas por `avre_migrator` sin tener que regrantear a mano.

2. **RLS por tabla** (`backend/prisma/manual-sql/001-rls-and-triggers.sql`, fusionado a mano
   en la primera migración): `ENABLE ROW LEVEL SECURITY` + `CREATE POLICY ... USING
   ("tenantId" = current_setting('app.tenant_id', true)::uuid)` en cada tabla tenant-scoped
   (columna camelCase entre comillas — así nombra Prisma la columna por defecto, sin `@map`).
   El `true` evita error cuando la variable no está seteada (conexiones de `avre_migrator`).

3. **Contexto de tenant por request**: `nestjs-cls` (AsyncLocalStorage) +
   `TenantContextInterceptor` global (`backend/src/common/interceptors/`). Por cada
   request autenticado:
   - Toma `tenantId` del JWT ya validado (nunca de query/body — evita bypass).
   - Envuelve el resto del handler en `prisma.$transaction(async (tx) => { await
     tx.$executeRawUnsafe("SELECT set_config('app.tenant_id', $1, true)", tenantId); ... })`
     — `set_config` (no `SET LOCAL ... = $1`, que Postgres no permite parametrizar) y solo
     tiene efecto dentro de la transacción activa (tercer argumento `true` = `is_local`).
   - Guarda `tx` en el store CLS; los repositorios lo leen vía `getTenantPrisma()` en vez
     de usar el `PrismaClient` global directamente.
   - En `register`/`login` (sin JWT todavía) se usa el tenant resuelto por
     `DEFAULT_TENANT_SLUG` (single-tenant en Fase 1).

## Alternativas consideradas

- **Prisma Client Extension (`$extends`)** en vez de interceptor + `$transaction` explícito:
  más "moderno" (Prisma 5.x recomienda extensions sobre el middleware `$use` legacy), pero
  requeriría replicar la misma lógica de "una query = una transacción con SET LOCAL" y con
  el interceptor + CLS queda más explícito dónde empieza/termina cada transacción por
  request. Se puede migrar a una extension después sin cambiar el modelo de datos ni las
  policies SQL.

## Consecuencias

- Todo acceso a datos de un módulo de dominio (auth, onboarding, audit) tiene que pasar por
  `getTenantPrisma()`, no por `PrismaService` directo, o el RLS no aplica.
- Los tests de aislamiento cross-tenant deben correr contra el rol `avre_app` real (no una
  conexión admin), porque `avre_migrator` bypassea el RLS al ser owner.
