import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import { IEmailSender, SendEmailInput } from './email-sender.interface';

@Injectable()
export class NodemailerEmailSender implements IEmailSender {
  private readonly logger = new Logger(NodemailerEmailSender.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    this.from = this.config.get<string>('EMAIL_FROM') ?? 'no-reply@avrecapitalgroup.com';
    const host = this.config.get<string>('SMTP_HOST');

    // Sin SMTP configurado (dev sin credenciales todavía): loguea en vez de fallar,
    // para no bloquear el flujo de password-reset en desarrollo local.
    this.transporter = host
      ? createTransport({
          host,
          port: Number(this.config.get<string>('SMTP_PORT') ?? 587),
          auth: {
            user: this.config.get<string>('SMTP_USER'),
            pass: this.config.get<string>('SMTP_PASSWORD'),
          },
        })
      : null;
  }

  async send(input: SendEmailInput): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(
        `SMTP no configurado — email no enviado (dev). To: ${input.to} | Subject: ${input.subject}`,
      );
      return;
    }
    await this.transporter.sendMail({ from: this.from, ...input });
  }
}
