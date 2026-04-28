# Multi-stage Dockerfile para Next.js storefront en monorepo pnpm.
# Build context = raíz del monorepo (frc-e-commerce/).
# Build:
#   docker build -f apps/storefront/Dockerfile -t frc-ecommerce-storefront .

# ============== STAGE 1: deps ==============
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY apps/storefront/package.json apps/storefront/
COPY packages/shared-config/package.json packages/shared-config/
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/shared-utils/package.json packages/shared-utils/

RUN pnpm install --frozen-lockfile

# ============== STAGE 2: build ==============
FROM node:20-alpine AS build
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo

COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/storefront/node_modules ./apps/storefront/node_modules
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY packages/ packages/
COPY apps/storefront/ apps/storefront/

ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @frc-e-commerce/storefront run build

# ============== STAGE 3: runtime ==============
FROM node:20-alpine AS runtime
RUN apk add --no-cache tini

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=build /repo/apps/storefront/.next/standalone ./
COPY --from=build /repo/apps/storefront/.next/static ./apps/storefront/.next/static
COPY --from=build /repo/apps/storefront/public ./apps/storefront/public

EXPOSE 3001

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/storefront/server.js"]
