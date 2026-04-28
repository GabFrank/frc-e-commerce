# Multi-stage Dockerfile para backend Vendure en monorepo pnpm.
# Build context = raíz del monorepo (frc-e-commerce/).
# Build:
#   docker build -f apps/backend/Dockerfile -t frc-ecommerce-backend .

# ============== STAGE 1: deps ==============
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat python3 make g++
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY apps/backend/package.json apps/backend/
COPY packages/shared-config/package.json packages/shared-config/
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/shared-utils/package.json packages/shared-utils/

RUN pnpm install --frozen-lockfile

# ============== STAGE 2: build ==============
FROM node:20-alpine AS build
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo

COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/backend/node_modules ./apps/backend/node_modules
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY packages/ packages/
COPY apps/backend/ apps/backend/

RUN pnpm --filter @frc-e-commerce/backend run build

# ============== STAGE 3: runtime ==============
FROM node:20-alpine AS runtime
RUN apk add --no-cache tini
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build /repo/apps/backend/package.json ./
COPY --from=build /repo/apps/backend/dist ./dist
COPY --from=build /repo/apps/backend/static ./static
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages ./packages

EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "./dist/index.js"]
