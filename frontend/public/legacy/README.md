# Legacy — referencia histórica, no se sirve en producción

Estos archivos son versiones previas de la landing, conservadas como referencia de
copy/diseño. La landing vigente es `frontend/src/pages/landing/AvreLanding.jsx`
(migrada desde el repo remoto `sasantiago/AVRE`), montada en la ruta `/` de la SPA.

- `index-legacy.html` — landing estática original de este repo (previa al monorepo).
- `_headers-legacy` — headers de seguridad de esa landing (Cloudflare Pages / hosting
  estático). Sirven de base para `infra/reverse-proxy/README.md`.
- `avre-landing-legacy.html` — versión HTML/JS puro de la landing, traída del repo
  remoto junto con `AvreLanding.jsx` (que es la que se adoptó como principal).

No enlazar estos archivos desde la app — quedan acá solo para comparar contra el
diseño/copy actual si hace falta.
