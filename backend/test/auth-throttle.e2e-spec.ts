// No requiere DB. Levanta un mini módulo Nest con el mismo AuthThrottlerGuard que usan
// las rutas de auth, para probar bloqueo tras N intentos y reseteo tras la ventana sin
// depender del resto de la app (Prisma, JWT keys, etc.).

import { Controller, Module, Post, UseGuards } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AuthThrottlerGuard } from '../src/common/guards/auth-throttler.guard';

const LIMIT = 3;
const TTL_MS = 500;

@Controller('probe')
class ProbeController {
  @Post('login')
  @UseGuards(AuthThrottlerGuard)
  login() {
    return { ok: true };
  }
}

@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: TTL_MS, limit: LIMIT }])],
  controllers: [ProbeController],
})
class ProbeModule {}

describe('AuthThrottlerGuard (bloqueo por IP+email, reset tras la ventana)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [ProbeModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it(`bloquea con 429 después de ${LIMIT} intentos para el mismo email`, async () => {
    const server = app.getHttpServer();
    for (let i = 0; i < LIMIT; i++) {
      const res = await request(server).post('/probe/login').send({ email: 'a@e2e.test' });
      expect(res.status).toBe(201);
    }
    const blocked = await request(server).post('/probe/login').send({ email: 'a@e2e.test' });
    expect(blocked.status).toBe(429);
  });

  it('no bloquea a un email distinto aunque comparta IP', async () => {
    const server = app.getHttpServer();
    for (let i = 0; i < LIMIT; i++) {
      await request(server).post('/probe/login').send({ email: 'b@e2e.test' });
    }
    const otherEmail = await request(server).post('/probe/login').send({ email: 'c@e2e.test' });
    expect(otherEmail.status).toBe(201);
  });

  it('resetea el límite después de que expira la ventana (ttl)', async () => {
    const server = app.getHttpServer();
    for (let i = 0; i < LIMIT; i++) {
      await request(server).post('/probe/login').send({ email: 'd@e2e.test' });
    }
    await new Promise((resolve) => setTimeout(resolve, TTL_MS + 100));

    const afterWindow = await request(server).post('/probe/login').send({ email: 'd@e2e.test' });
    expect(afterWindow.status).toBe(201);
  });
});
