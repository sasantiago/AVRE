# syntax=docker/dockerfile:1
FROM node:22.11-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY backend/package.json backend/package.json
# frontend/package.json también se copia acá (sin su código fuente) porque
# package-lock.json fue generado para las dos workspaces del monorepo — sin
# este archivo, npm no reconstruye el árbol tal cual el lockfile y npm ci
# fallaría. Con las dos workspaces declaradas, todo hoistea a /app/node_modules
# (no queda backend/node_modules ni frontend/node_modules por separado).
COPY frontend/package.json frontend/package.json
RUN npm ci --workspace=backend --include-workspace-root

FROM node:22.11-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY backend backend
COPY tsconfig.base.json ./
RUN npx --prefix backend prisma generate --schema=backend/prisma/schema.prisma
RUN npm run build --workspace=backend

FROM node:22.11-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# La imagen base node:alpine ya trae un grupo "node" con gid 1000 — los Secret
# Files de Render (/etc/secrets/*) son legibles por ese grupo en runtime, así
# que sumamos avre ahí en vez de crear un grupo nuevo (gid 1000 ya está tomado).
RUN adduser -S avre -G node
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/prisma ./backend/prisma
USER avre
EXPOSE 3000
CMD ["node", "backend/dist/src/main.js"]
