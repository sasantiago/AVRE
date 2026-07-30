import * as argon2 from 'argon2';

// Parámetros explícitos, no defaults de la librería (piso recomendado por OWASP
// para argon2id: memoryCost ~19 MiB, timeCost 2, parallelism 1). Ajustar con
// benchmark de latencia real contra el hardware del contenedor antes de producción.
const ARGON2ID_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, ARGON2ID_OPTIONS);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  return argon2.verify(hash, plain);
}
