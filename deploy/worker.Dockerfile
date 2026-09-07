# Worker (BullMQ). Ejecuta TypeScript con tsx (sin paso de build).
FROM node:20-alpine
RUN corepack enable
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/worker/package.json apps/worker/
COPY packages/db/package.json packages/db/
RUN pnpm install --filter @crm/worker... --frozen-lockfile || pnpm install --filter @crm/worker...

COPY . .
CMD ["pnpm", "--filter", "@crm/worker", "start"]
