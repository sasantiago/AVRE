# syntax=docker/dockerfile:1
FROM node:22.11-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY backend/package.json backend/package.json
RUN npm install --workspace=backend

FROM node:22.11-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY backend backend
COPY tsconfig.base.json ./
RUN npm run build --workspace=backend
RUN npx --prefix backend prisma generate --schema=backend/prisma/schema.prisma

FROM node:22.11-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S avre && adduser -S avre -G avre
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend/node_modules ./backend/node_modules
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/prisma ./backend/prisma
USER avre
EXPOSE 3000
CMD ["node", "backend/dist/main.js"]
