import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

// Throttle keyed por IP + email del body — no solo IP. Sin el email, un atacante
// podría rotar de cuenta en cuenta desde la misma IP sin activar el límite; sin la IP,
// alguien podría spamear intentos hacia el email de otra persona rotando de origen.
@Injectable()
export class AuthThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : 'unknown';
    return `${req.ip}:${email}`;
  }
}
