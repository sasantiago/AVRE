export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
}

// Open/Closed (mismo patrón que IAuditRecorder): swapear el proveedor de email
// (SMTP -> transaccional) no toca AuthService/PasswordResetService.
export interface IEmailSender {
  send(input: SendEmailInput): Promise<void>;
}

export const EMAIL_SENDER = Symbol('EMAIL_SENDER');
