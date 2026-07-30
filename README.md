# AVRE Capital Group — Core técnico (Fases 0-2)

Monorepo (npm workspaces) con el backend (NestJS + Prisma + Postgres/RLS) y el frontend
(React + Vite + Tailwind/shadcn) del core de AVRE: auth (Argon2id, JWT RS256, refresh
httpOnly, 2FA TOTP, password reset) y onboarding (aceptación del Acuerdo de Gestión
Discrecional). **No incluye** todavía dashboard de mercado, pagos on-chain ni custodia
de wallets — son fases posteriores.

Ver el plan completo en `docs/adr/` y en el historial de esta sesión. Requisitos de
negocio originales: `AVRE_REQUERIMIENTOSTECNICOS~2.odt` (fuera de este repo).

## Arranque local

### 1. Requisitos

- Node 22.11+ (`.nvmrc`)
- Docker + Docker Compose
- OpenSSL (Git for Windows ya lo trae)

### 2. Variables de entorno

```bash
cp .env.example .env
```

Completá al menos: `POSTGRES_MIGRATOR_PASSWORD`, `POSTGRES_APP_PASSWORD`,
`TOTP_ENCRYPTION_KEY` (`openssl rand -base64 32`), y opcionalmente
`SEED_ADMIN_PASSWORD` si querés un usuario ADMIN inicial.

### 3. Claves JWT (RS256, desarrollo)

```powershell
powershell -File scripts/generate-jwt-keys.ps1
```

Genera `infra/keys/jwt-private.pem` y `jwt-public.pem` (gitignored — nunca commitear).

### 4. Instalar dependencias

```bash
npm install
```

### 5. Levantar Postgres + Redis

```bash
docker compose up -d postgres redis
docker compose ps   # ambos deben quedar "healthy"
```

Esto también corre `infra/postgres/init/001-roles.sh`, que crea los roles `avre_migrator`
(owner, migraciones/seed) y `avre_app` (runtime, `NOBYPASSRLS` — sin esto el RLS de la
Fase 1 quedaría decorativo). Ver `docs/adr/0001-rls-tenant-context.md`.

### 6. Migraciones + RLS + seed

```bash
cd backend
npx prisma migrate dev --create-only   # generá la migración inicial
```

Antes de aplicarla, pegá el contenido de `backend/prisma/manual-sql/001-rls-and-triggers.sql`
al final del `migration.sql` recién generado (habilita RLS por tabla + el trigger de
inmutabilidad del acuerdo). Después:

```bash
npx prisma migrate dev
npm run prisma:seed
```

El seed publica una versión placeholder del Acuerdo de Gestión Discrecional (marcada
"pendiente de revisión legal") y, si definiste `SEED_ADMIN_PASSWORD`, crea el primer
usuario ADMIN — `POST /auth/register` solo puede crear rol `CLIENT`.

### 7. Levantar todo

```bash
docker compose up -d
# o, para desarrollo con hot-reload fuera de Docker:
npm run dev --workspace=backend
npm run dev --workspace=frontend
```

- Backend: http://localhost:3000 (`GET /health`)
- Frontend: http://localhost:5173

## Tests y calidad

```bash
# Backend — unit tests + coverage (threshold configurado en backend/package.json)
npm run test:cov --workspace=backend

# Backend — tests e2e que requieren Postgres real (aislamiento RLS, trigger de
# inmutabilidad, rate limiting, X-Forwarded-For)
npm run test:e2e --workspace=backend

# Frontend
npm run test --workspace=frontend

# Lint (ambos workspaces)
npm run lint --workspaces
```

## Flujo manual end-to-end

1. `http://localhost:5173/` → landing (AvreLanding, migrada desde el repo remoto).
2. "Quiero ser AVREan" / "Iniciar sesión" → `/register` → crear cuenta.
3. `/login` → iniciar sesión (probar también enrolando TOTP vía `POST /auth/totp/enroll`
   con un authenticator real, y el flujo de `/password-reset`).
4. Como cliente nuevo, cualquier intento de ir a `/dashboard` redirige a
   `/onboarding/agreement` — aceptar el acuerdo placeholder.
5. `/dashboard` (placeholder) — confirma que `ProtectedRoute` + `RequireAgreement`
   dejan pasar recién después de aceptar.
6. Refrescar la página mantiene la sesión (refresh token en cookie httpOnly). Logout
   la limpia.

## Estructura

Ver el árbol completo y las decisiones de diseño (RLS, roles de Postgres, reuse-detection
de refresh tokens, etc.) en `docs/adr/0001-rls-tenant-context.md` y en los comentarios
`// Why:` a lo largo del código de `backend/src/`.
