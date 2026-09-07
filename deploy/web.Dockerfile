# Imagen de la app web (Next.js standalone). Multi-stage con pnpm.
FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

# --- deps ---
FROM base AS deps
COPY pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
RUN pnpm install --filter @crm/web... --frozen-lockfile || pnpm install --filter @crm/web...

# --- build ---
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter @crm/web build

# --- runner ---
FROM base AS runner
ENV NODE_ENV=production
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
