import { describe, expect, it } from 'vitest';
import {
  loginSchema,
  registerSchema,
  passwordResetConfirmSchema,
} from './auth.schemas';

describe('loginSchema', () => {
  it('acepta email y password válidos', () => {
    const result = loginSchema.safeParse({ email: 'cliente@avre.test', password: 'x' });
    expect(result.success).toBe(true);
  });

  it('rechaza un email inválido', () => {
    const result = loginSchema.safeParse({ email: 'no-es-un-email', password: 'x' });
    expect(result.success).toBe(false);
  });
});

describe('registerSchema', () => {
  const base = {
    fullName: 'Cliente Test',
    email: 'cliente@avre.test',
    password: '1234567890',
    confirmPassword: '1234567890',
  };

  it('acepta datos válidos con contraseñas coincidentes', () => {
    expect(registerSchema.safeParse(base).success).toBe(true);
  });

  it('rechaza si las contraseñas no coinciden', () => {
    const result = registerSchema.safeParse({ ...base, confirmPassword: 'otraCosa123' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain('confirmPassword');
    }
  });

  it('rechaza contraseñas menores a 10 caracteres', () => {
    const result = registerSchema.safeParse({ ...base, password: 'corta', confirmPassword: 'corta' });
    expect(result.success).toBe(false);
  });
});

describe('passwordResetConfirmSchema', () => {
  it('rechaza si las contraseñas nuevas no coinciden', () => {
    const result = passwordResetConfirmSchema.safeParse({
      newPassword: '1234567890',
      confirmPassword: 'distinta1234',
    });
    expect(result.success).toBe(false);
  });
});
