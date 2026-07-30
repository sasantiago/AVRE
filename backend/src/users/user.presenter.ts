import { User } from '@prisma/client';

// Nunca se serializa passwordHash hacia el cliente.
export type SafeUser = Omit<User, 'passwordHash'>;

export function toSafeUser(user: User): SafeUser {
  const { passwordHash: _passwordHash, ...safe } = user;
  return safe;
}

export function toSafeUsers(users: User[]): SafeUser[] {
  return users.map(toSafeUser);
}
