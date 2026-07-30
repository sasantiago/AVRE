# Reverse proxy (pendiente)

En producción, delante de `backend` y `frontend` va un reverse proxy (Traefik o Nginx) que:

- Termina TLS 1.3 (certificados vía Let's Encrypt / ACME).
- Redirige HTTP → HTTPS.
- Replica los headers de seguridad que tenía la landing estática original (`_headers`,
  archivado en `frontend/public/legacy/`):
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `X-Frame-Options: SAMEORIGIN`
  - (a sumar cuando el dominio final esté definido) `Content-Security-Policy`,
    `Strict-Transport-Security`.
- Setea `X-Forwarded-For` / `X-Forwarded-Proto` correctamente para que el backend pueda
  confiar en la IP real del cliente (ver `TRUST_PROXY` en `.env.example` y
  `backend/src/main.ts`, que hoy arranca con `TRUST_PROXY=false` hasta que este proxy exista).

No se implementa en las Fases 0-2 (self-hosted local vía Docker Compose alcanza sin él). Este
README es el placeholder documentado que pide el plan — la configuración real de Traefik/Nginx
se agrega en una fase de infraestructura posterior.
