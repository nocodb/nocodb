FROM node:22 AS builder

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

COPY . .

# Install deps WITH native module compilation (no --ignore-scripts)
RUN pnpm install --no-frozen-lockfile

# Build SDK
RUN cd packages/nocodb-sdk && pnpm run build

# Build integrations
RUN cd packages/noco-integrations && pnpm install --no-frozen-lockfile && pnpm run build || true
RUN cd packages/nocodb && pnpm run registerIntegrations || true

# Build frontend (nc-gui)
RUN cd packages/nc-gui && NODE_OPTIONS="--max-old-space-size=4096" npx nuxi generate

# Bundle backend with rspack
RUN npx rspack build --config rspack.prod.config.js

# Copy frontend into backend dist
RUN cp -r packages/nc-gui/.output/public dist/nc-gui

# --- Runtime ---
FROM node:22-slim

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/nocodb/node_modules ./packages/nocodb/node_modules

ENV PORT=8080
ENV NC_DB="sqlite3:///?database=/tmp/noco.db"
ENV NC_DISABLE_TELE=true
ENV NC_GUI_DIST_PATH=/app/dist/nc-gui

EXPOSE 8080

CMD ["node", "dist/main.js"]
