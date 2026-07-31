# Despliegue del backend en Render (producción)

Runbook para llevar el backend (Fases 0-3) a Render usando el blueprint `render.yaml`
del root del repo. El frontend queda fuera de este documento — se despliega en una
etapa posterior.

## 0. Antes de arrancar

- [ ] Cuenta en Render creada y repo conectado (GitHub: `sasantiago/AVRE`).
- [ ] Confirmado: el acuerdo de gestión discrecional se lanza con el texto
      **placeholder** (marcado "pendiente de revisión legal" en el seed) — reemplazar
      apenas esté el texto legal definitivo, sin bloquear este despliegue.
- [ ] Confirmado: `DEPOSIT_WALLET_TRON_TRC20` / `DEPOSIT_WALLET_POLYGON` en tu `.env`
      local ya son las wallets de custodia reales — se van a cargar tal cual en Render.

## 1. Cuentas externas a crear (no puedo hacerlo por vos)

| Servicio | Para qué | Plan sugerido |
|---|---|---|
| [Resend](https://resend.com) | SMTP para emails de reset de contraseña | Free (3000 emails/mes) — usar sus credenciales SMTP directo con `EMAIL_PROVIDER=smtp` |
| [Finnhub](https://finnhub.io) | Cotizaciones del catálogo de mercado (`market`/`orders`) | Free tier alcanza para arrancar |
| [TronGrid](https://www.trongrid.io) | Fuente 1 de verificación de depósitos TRC20 | Free |
| [Tronscan](https://tronscan.org) | Fuente 2 (doble verificación §6.3 #6) | Free/pública |
| [Etherscan](https://etherscan.io) | API v2 unificada (`POLYGONSCAN_API_URL` ya apunta a `api.etherscan.io/v2/api`, chainid=137) | Free tier |

Por qué Resend y no SES/SendGrid/Postmark: ya tenés `EMAIL_PROVIDER=smtp` +
nodemailer en el código, Resend te da un relay SMTP estándar sin verificación de
dominio compleja para arrancar (se puede migrar a SES más adelante si el volumen
crece). Guardá las API keys/credenciales directo en el dashboard de Render (Secret
o env var `sync: false`), no las pegues en el chat.

Opcional pero recomendado (no bloqueante): un RPC dedicado de Polygon (Alchemy/Infura
free tier) en vez del público `https://polygon-rpc.com`, que tiene rate limits más
agresivos.

## 2. Roles de Postgres (manual, una sola vez)

En local, `infra/postgres/init/001-roles.sh` crea automáticamente los roles
`avre_migrator` (owner) y `avre_app` (runtime, `NOBYPASSRLS`) al levantar el
contenedor. **Render Postgres no soporta scripts de init** — hay que correr el
equivalente a mano, una vez, contra la instancia recién creada:

1. Crear la DB `avre-postgres` en Render (vía blueprint o dashboard).
2. Conectarse con el connection string admin que da Render (botón "Connect" → psql).
3. Correr, reemplazando las contraseñas:

```sql
CREATE ROLE avre_migrator WITH LOGIN PASSWORD '<password-fuerte-1>' CREATEDB;
CREATE ROLE avre_app WITH LOGIN PASSWORD '<password-fuerte-2>' NOBYPASSRLS;

ALTER DATABASE avre OWNER TO avre_migrator;

GRANT CONNECT ON DATABASE avre TO avre_app;
GRANT USAGE ON SCHEMA public TO avre_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO avre_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO avre_app;

ALTER DEFAULT PRIVILEGES FOR ROLE avre_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO avre_app;
ALTER DEFAULT PRIVILEGES FOR ROLE avre_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO avre_app;
```

4. Armar los dos connection strings con el host de Render pero cambiando
   usuario/password:
   - `DATABASE_URL` → `postgresql://avre_app:<password-2>@<host>/avre?schema=public`
   - `MIGRATE_DATABASE_URL` → `postgresql://avre_migrator:<password-1>@<host>/avre?schema=public`
5. Cargarlos como env vars (`sync: false` en el blueprint, completar en el dashboard).

## 3. Claves JWT de producción

No reutilizar `infra/keys/jwt-*.pem` de desarrollo. Generar un par nuevo:

```powershell
powershell -File scripts/generate-jwt-keys.ps1
```

Subir `jwt-private.pem` y `jwt-public.pem` como **Secret Files** en el dashboard del
servicio `avre-backend` (Render → service → Environment → Secret Files). Quedan
disponibles en runtime en `/etc/secrets/jwt-private.pem` y `/etc/secrets/jwt-public.pem`
— ya son los valores que carga `render.yaml` en `JWT_PRIVATE_KEY_PATH`/`JWT_PUBLIC_KEY_PATH`.
El Dockerfile ya fija el usuario del contenedor a uid/gid 1000 para poder leerlos
(requisito de Render para Secret Files en servicios Docker).

## 4. Cookies cross-site (temporal, mientras no haya dominio propio)

Con el backend en `avre-backend.onrender.com` y el frontend (cuando exista) en otro
subdominio `*.onrender.com`, son dos sitios distintos para el navegador → la cookie
de refresh token necesita `SameSite=None; Secure` (ya seteado así en `render.yaml`).
Cuando haya un dominio propio, lo ideal es unificar front y back bajo el mismo
dominio registrable (ej. `app.avrecapitalgroup.com` + `api.avrecapitalgroup.com`) y
volver a `SameSite=Strict`, que es más seguro contra CSRF.

## 5. Desplegar

1. Completar en Render (dashboard, no en este repo) todas las env vars marcadas
   `sync: false` en `render.yaml`: `DATABASE_URL`, `MIGRATE_DATABASE_URL`,
   `FRONTEND_ORIGIN`, `COOKIE_DOMAIN`, `TOTP_ENCRYPTION_KEY`, `SMTP_*`,
   `DEPOSIT_WALLET_*`, `*_API_KEY`, `SEED_ADMIN_*`.
2. Render → New → Blueprint → apuntar al repo → detecta `render.yaml`.
3. El `preDeployCommand` corre `prisma migrate deploy` antes de arrancar — revisar
   logs de esa etapa si el deploy falla ahí (típicamente permisos de roles del
   paso 2).
4. Verificar `GET https://avre-backend.onrender.com/health` devuelve 200.
5. (Opcional, solo si hace falta un admin inicial) correr el seed manualmente vía
   Render Shell: `npm run prisma:seed --workspace=backend` con `MIGRATE_DATABASE_URL`
   ya seteada como env var del servicio.

## 6. Pendiente para más adelante (no bloquea este despliegue)

- Reemplazar el texto placeholder del Acuerdo de Gestión Discrecional en cuanto esté
  la versión legal final (nueva fila en `ManagementAgreementVersion`, no editar la
  existente — es append-only).
- Dominio propio + unificar cookies (ver punto 4).
- CI (`.github/workflows`) que corra `test:cov` + `test:e2e` + `lint` antes de cada
  deploy — hoy Render despliega directo desde el branch sin ese gate.
