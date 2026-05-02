# syntax=docker/dockerfile:1.7

# ---------- 1. install dependencies (with build toolchain for native modules) ----------
FROM node:22-bookworm-slim AS deps
WORKDIR /app

# better-sqlite3 needs python3, make, g++ to compile its native binding
# (only at install-time; the runtime image stays slim).
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 \
      make \
      g++ \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

# ---------- 2. build the Next.js standalone output ----------
FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Skip generating runtime types from the network during the build
RUN npm run build

# ---------- 3. minimal runtime image ----------
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=4000
ENV DATABASE_PATH=/app/data/app.db
# Same timezone as your bot / n8n / Sheet so dates align (the date_envoi
# stored in feuille 1 is compared against today by the 10am workflow).
ENV TZ=Europe/Paris

# Install tzdata so TZ takes effect (debian-slim doesn't ship it).
RUN apt-get update \
    && apt-get install -y --no-install-recommends tzdata ca-certificates wget \
    && ln -sf /usr/share/zoneinfo/Europe/Paris /etc/localtime \
    && echo "Europe/Paris" > /etc/timezone \
    && rm -rf /var/lib/apt/lists/*

# Run as non-root for safety. The mounted /app/data must be writable by uid 1001
# (handled in docker-compose.yml).
RUN groupadd -r app && useradd -r -g app -u 1001 app

# Copy only what's needed for runtime.
COPY --from=builder --chown=app:app /app/public ./public
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static

# Make sure the better-sqlite3 .node binding is in place. The standalone tracer
# usually copies it into node_modules already (see next.config.ts), but we add
# a safety copy in case the path differs.
COPY --from=builder --chown=app:app /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3

# Persistent data directory for the SQLite DB.
RUN mkdir -p /app/data && chown -R app:app /app/data
VOLUME ["/app/data"]

USER app
EXPOSE 4000

CMD ["node", "server.js"]
