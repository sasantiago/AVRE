import { randomBytes } from 'crypto';

// Refresh tokens y password-reset tokens necesitan poder resolverse ANTES de tener un
// JWT válido (el usuario está, precisamente, tratando de conseguir uno) — pero mirar la
// tabla requiere haber seteado app.tenant_id primero (RLS). Se resuelve prefijando el
// propio tenantId al valor del token: se puede parsear sin tocar la DB, y solo sirve
// como pista para abrir el contexto de tenant correcto — la validez real la sigue dando
// el hash-match dentro de ese tenant (un tenantId falso simplemente no encuentra fila).
const SEPARATOR = '.';

export function buildScopedToken(tenantId: string): string {
  const random = randomBytes(48).toString('base64url');
  return `${tenantId}${SEPARATOR}${random}`;
}

export function parseTenantIdFromScopedToken(value: string): string | null {
  const idx = value.indexOf(SEPARATOR);
  if (idx === -1) return null;
  return value.slice(0, idx);
}
