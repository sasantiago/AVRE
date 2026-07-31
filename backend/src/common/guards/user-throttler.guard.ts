import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

// Throttle keyed por userId autenticado (§6.4: "10 intentos por usuario por
// hora") — a diferencia de AuthThrottlerGuard (ip:email, rutas sin sesión), acá
// ya hay JWT validado por JwtAuthGuard antes de que este guard corra.
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    return req.user?.userId ?? req.ip;
  }
}
