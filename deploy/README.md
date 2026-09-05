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

Supabase self-hosted  = su propio stack docker-compose (Postgres propio, Auth, Storage)
Media/PDF             = DigitalOcean Spaces (S3) o Supabase Storage
```

- **Arranque**: 1 Droplet (2 vCPU / 4 GB). App + Redis aquí; Supabase en su stack (mismo Droplet al inicio).
- **Escala**: mover Supabase/Postgres a Droplet dedicado o Managed Postgres → worker en su propio Droplet → réplicas de `web` detrás de Caddy.

## Puesta en marcha

```bash
# en el Droplet
cp ../.env.example .env         # completar credenciales
docker compose -f deploy/docker-compose.yml up -d --build
```

> Supabase self-hosted se despliega aparte (su propio `docker-compose`). Este compose asume que la URL/keys de Supabase ya existen en `.env`.

## CI/CD (resumen)
`.github/workflows/deploy.yml`: en push a `main` → `docker build` de `apps/web` → push a registry → SSH al Droplet → `docker compose pull web && docker compose up -d web`. (Se añade cuando confirmes registry: GHCR o DO Container Registry.)
