import { v7 as uuidv7 } from 'uuid';

// UUIDv7 (no incremental) en todas las entidades para evitar enumeración —
// sección 7 del doc de requerimientos. Postgres/Prisma no generan v7 nativo,
// por eso todo id se genera acá y se pasa explícito al crear cada registro.
export function generateId(): string {
  return uuidv7();
}
