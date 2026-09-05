# Despliegue — Recomendación

## Veredicto

**DigitalOcean Droplet único + Docker Compose + Caddy (HTTPS automático) + GitHub Actions.**
Mantiene tu operación conocida (SSH + Droplet + Docker, **sin** Coolify) y añade dos cosas que este proyecto sí necesita:

1. **TLS automático (Caddy)** — WhatsApp Cloud API **exige** un endpoint público HTTPS válido para los webhooks. Caddy resuelve Let's Encrypt solo.
2. **CI/CD reproducible (GitHub Actions)** — build de imagen → registry → `docker compose pull && up -d` por SSH.

### Por qué no Vercel (para la app)
Multi-tenant + Supabase self-hosted + worker de larga duración + webhooks de WhatsApp → conviene todo co-localizado y bajo tu control. El modelo serverless complica el worker y el procesamiento de webhooks. (Opcional a futuro: servir solo las *propuestas públicas* `/p/*` desde el edge.)

## Topología

```
Internet ──▶ Caddy (443, TLS auto)
               ├──▶ web     (Next.js standalone, :3000)
               └──▶ (webhooks) ──▶ web ──▶ Redis ──▶ worker (BullMQ)

PostgreSQL   = contenedor propio (postgres:16) — auth (Auth.js) + datos + RLS
Media/PDF    = DigitalOcean Spaces (S3-compatible)
```

- **Arranque**: 1 Droplet (2 vCPU / 4 GB). Postgres + Redis + web + Caddy en el mismo compose.
- **Escala**: mover Postgres a Droplet dedicado o DO Managed Postgres → worker en su propio Droplet → réplicas de `web` detrás de Caddy.

## Puesta en marcha

```bash
# en el Droplet
cp ../.env.example .env          # completar credenciales
docker compose -f deploy/docker-compose.yml up -d --build
# aplicar migraciones (crea rol crm_app, esquema y RLS):
DATABASE_URL="postgresql://postgres:PASS@localhost:5432/travelkit_crm" pnpm db:migrate
```

> Sin Supabase: PostgreSQL es un contenedor más. Las migraciones se corren con el
> rol admin (`DATABASE_URL`); la app usa el rol `crm_app` (`DATABASE_APP_URL`) con RLS.

## CI/CD (resumen)
`.github/workflows/deploy.yml`: en push a `main` → `docker build` de `apps/web` → push a registry → SSH al Droplet → `docker compose pull web && docker compose up -d web`. (Se añade cuando confirmes registry: GHCR o DO Container Registry.)
