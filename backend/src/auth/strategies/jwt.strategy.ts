import { readFileSync } from 'fs';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtAccessPayload {
  sub: string;
  tenantId: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    const publicKeyPath = config.get<string>('JWT_PUBLIC_KEY_PATH')!;
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: readFileSync(publicKeyPath, 'utf8'),
      algorithms: ['RS256'],
      issuer: config.get<string>('JWT_ISSUER'),
    });
  }

  validate(payload: JwtAccessPayload) {
    return { userId: payload.sub, tenantId: payload.tenantId, role: payload.role };
  }
}
