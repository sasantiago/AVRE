// No requiere DB — prueba el mismo mecanismo de trust proxy que backend/src/main.ts
// (app.set('trust proxy', TRUST_PROXY === 'true')), para que activar el reverse-proxy
// real el día de mañana sea un cambio de una línea ya probado (ver
// infra/reverse-proxy/README.md).

import express from 'express';
import request from 'supertest';

function buildApp(trustProxy: boolean) {
  const app = express();
  app.set('trust proxy', trustProxy);
  app.get('/whoami', (req, res) => res.json({ ip: req.ip }));
  return app;
}

describe('Captura de IP con/sin X-Forwarded-For (TRUST_PROXY)', () => {
  it('TRUST_PROXY=false ignora X-Forwarded-For y usa la IP de la conexión directa', async () => {
    const app = buildApp(false);
    const res = await request(app).get('/whoami').set('X-Forwarded-For', '203.0.113.9');

    expect(res.body.ip).not.toBe('203.0.113.9');
  });

  it('TRUST_PROXY=true confía en X-Forwarded-For', async () => {
    const app = buildApp(true);
    const res = await request(app).get('/whoami').set('X-Forwarded-For', '203.0.113.9');

    expect(res.body.ip).toBe('203.0.113.9');
  });
});
