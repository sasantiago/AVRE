import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Ingresá un email válido'),
  password: z.string().min(1, 'Ingresá tu contraseña'),
  totpCode: z.string().optional(),
});
export type LoginFormValues = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    fullName: z.string().min(2, 'Ingresá tu nombre completo'),
    email: z.string().email('Ingresá un email válido'),
    password: z.string().min(10, 'Mínimo 10 caracteres'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });
export type RegisterFormValues = z.infer<typeof registerSchema>;

export const passwordResetRequestSchema = z.object({
  email: z.string().email('Ingresá un email válido'),
});
export type PasswordResetRequestFormValues = z.infer<typeof passwordResetRequestSchema>;

export const passwordResetConfirmSchema = z
  .object({
    newPassword: z.string().min(10, 'Mínimo 10 caracteres'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });
export type PasswordResetConfirmFormValues = z.infer<typeof passwordResetConfirmSchema>;
