# syntax=docker/dockerfile:1

FROM node:24.21.0-alpine3.24 AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

FROM deps AS build
COPY . .
RUN npm run build && npm run build:worker

# Production dependencies only, for the worker and migrations.
FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

# The web app: Next.js standalone server.
FROM base AS web
ENV NODE_ENV=production PORT=3400 HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
USER app
EXPOSE 3400
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD wget -qO- http://127.0.0.1:3400/api/health || exit 1
CMD ["node", "server.js"]

# The worker (checks, alerts, cleanup) plus migration and seed scripts.
FROM base AS worker
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
COPY --from=prod-deps --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/dist ./dist
COPY --from=build --chown=app:app /app/drizzle ./drizzle
COPY --chown=app:app package.json ./
USER app
CMD ["node", "dist/index.js"]
