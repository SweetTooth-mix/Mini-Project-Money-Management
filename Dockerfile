# syntax=docker/dockerfile:1
#
# Kira Rapi production image.
#
# Beyond Node the runtime needs a Python virtualenv for the Excel generator,
# LibreOffice for PDF rendering and the generated Prisma client. They are
# assembled here so a deployment never depends on packages installed by hand.
#
#   docker build -t kira-rapi .
#   docker build --target migrate -t kira-rapi:migrate .
#
# The final image runs as an unprivileged user and only writes to UPLOAD_DIR.

ARG NODE_VERSION=22

# ---------------------------------------------------------------------------
# Development dependencies: everything `next build` and `prisma generate` need.
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---------------------------------------------------------------------------
# Build: generated Prisma client plus the production bundle.
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# `next build` imports the Prisma client but never connects, so a placeholder
# keeps the build hermetic. The real DATABASE_URL is supplied at run time.
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build
RUN npm run build

# ---------------------------------------------------------------------------
# Runtime dependencies only (no ESLint, TypeScript, Prisma CLI or Playwright).
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS prod-deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund --ignore-scripts

# ---------------------------------------------------------------------------
# Python packages for the report generator, isolated so source changes do not
# invalidate the pip install layer.
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS python-deps
RUN apt-get update \
 && apt-get install --no-install-recommends -y python3 python3-venv \
 && rm -rf /var/lib/apt/lists/*
COPY scripts/excel/requirements.txt /tmp/requirements.txt
RUN python3 -m venv /opt/reports/venv \
 && /opt/reports/venv/bin/pip install --no-cache-dir --disable-pip-version-check \
      -r /tmp/requirements.txt

# ---------------------------------------------------------------------------
# Migration target: keeps the Prisma CLI for `migrate deploy` and the seed,
# without shipping a build toolchain in the runtime image.
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS migrate
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update \
 && apt-get install --no-install-recommends -y openssl \
 && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json prisma.config.ts tsconfig.json ./
# lib/ is needed because the seed runs through the same services the
# application uses (createAccount, createDocument, transitionDocument).
COPY lib ./lib
COPY prisma ./prisma
RUN npx prisma generate
CMD ["npx", "prisma", "migrate", "deploy"]

# ---------------------------------------------------------------------------
# Runtime.
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    UPLOAD_DIR=/data/uploads \
    EXCEL_PYTHON=/opt/reports/venv/bin/python \
    LOG_LEVEL=info \
    SERVICE_NAME=kira-rapi

# LibreOffice Calc renders the PDF output; Liberation fonts keep the templates
# metrically identical to the originals. The -nogui variant drops the desktop.
# openssl is required, not optional: Prisma runs `openssl version` to choose its
# query engine, and without it falls back to the 1.1.x build, which cannot load
# against libssl3 and leaves every database call failing.
RUN apt-get update \
 && apt-get install --no-install-recommends -y \
      libreoffice-calc-nogui \
      fonts-liberation \
      python3 \
      openssl \
      ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY --from=python-deps /opt/reports/venv /opt/reports/venv
COPY --from=prod-deps /app/node_modules ./node_modules
# The client generated in the build stage; the prod-deps install skips scripts,
# so it has the @prisma/client runtime but not the generated engine.
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/templates ./templates
COPY --from=builder /app/scripts/excel ./scripts/excel
COPY --from=builder /app/prisma ./prisma

RUN groupadd --system --gid 1001 nextjs \
 && useradd --system --uid 1001 --gid nextjs --home-dir /app nextjs \
 && mkdir -p /data/uploads \
 && chown -R nextjs:nextjs /data \
 && mkdir -p .next/cache \
 && chown -R nextjs:nextjs /app/.next

USER nextjs

# Uploads must survive a container replacement; mount a volume here.
VOLUME ["/data"]

EXPOSE 3000

# Returns 200 while the app can serve pages; a missing reporting toolchain is
# reported as degraded instead of failing the probe.
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Mirrors ecosystem.config.cjs and npm run start, without an npm wrapper so
# signals reach Next.js directly.
CMD ["node", "node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0", "--port", "3000"]
