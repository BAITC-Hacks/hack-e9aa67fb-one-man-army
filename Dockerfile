# Multi-stage build: small, non-root, no native compilation.
# Requires `output: "standalone"` in next.config.ts.

FROM node:24-slim AS deps
WORKDIR /app
# corepack installs the exact pnpm named in package.json's "packageManager".
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
# pnpm-workspace.yaml carries the install policy; without it `--frozen-lockfile`
# fails in a clean environment on pnpm 12's release-age check.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:24-slim AS build
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# The image builds without credentials; the app defaults to the offline model.
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM node:24-slim AS runtime
WORKDIR /app
# HOSTNAME=0.0.0.0 is load-bearing. Next's standalone server binds to $HOSTNAME,
# and Docker sets HOSTNAME to the container id, which resolves to the container's
# own IP. The server would then listen ONLY on that address, so nothing inside
# the container could reach it on localhost and the HEALTHCHECK could never pass.
# SESSION_SECRET here is a DEMO-ONLY placeholder, not a real secret - it lets
# the image run standalone (no compose file) since NODE_ENV=production
# refuses to sign session cookies without one (lib/auth/session.ts). Override
# with a real value (`docker run -e SESSION_SECRET=...`) for any non-demo use.
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    MODEL_REF=mock:demo \
    DATA_DIR=/app/data \
    HOSTNAME=0.0.0.0 \
    SESSION_SECRET=demo-session-secret-insecure-change-me

RUN useradd --create-home --shell /bin/bash app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
COPY --from=build --chown=app:app /app/scripts ./scripts

RUN mkdir -p /app/data && chown app:app /app/data
USER app
EXPOSE 3000

# 127.0.0.1, not localhost: Node resolves localhost to ::1 first, and the
# server listens on IPv4.
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
