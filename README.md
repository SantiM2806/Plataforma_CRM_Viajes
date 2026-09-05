# Travelkit CRM/CX — Plataforma SaaS para Agencias de Viajes

Plataforma **multi-tenant B2B** que cubre el ciclo end-to-end: búsqueda/cotización de servicios → gestión de cotizaciones (PDF + propuesta web pública) → CRM/reservas → Inbox omnicanal (Telegram → WhatsApp Cloud API) → reportería y conciliación contable (base para facturación DIAN, Colombia).

> Proyecto **independiente** de `travelkit_cotizador`. Base de datos, credenciales y despliegue propios.

## Stack

| Capa | Tecnología | Nota |
|---|---|---|
| Frontend / BFF | **Next.js (App Router)** + Tailwind + shadcn/ui | SSR para propuestas públicas |
| Auth + DB | **Supabase self-hosted** (Postgres + Auth + RLS) | Google Workspace OAuth + email/password |
| Multi-tenancy | Single-DB agrupada por `agency_id` + **RLS** | Aislamiento en 2 capas (código + Postgres) |
| Async / colas | **BullMQ + Redis** | Fan-out a APIs de proveedores, TRM, webhooks |
| Motor cotización | Módulo aislado (monolito modular) + worker | Extraíble a microservicio si el volumen lo exige |
| Proveedores | **LiteAPI** (hoteles, Fase 1) → Omnibees (Fase 6) | |

## Estructura del monorepo

```
travelkit_crm/
├── apps/
│   ├── web/            # Next.js: dashboard + propuestas públicas + API routes (BFF)
│   └── worker/         # Node/TS: BullMQ (cotización paralela, TRM BanRep, webhooks) — Fase 1+
├── packages/
│   ├── db/             # Migraciones SQL + runner + tipos generados
│   └── core/           # Dominio compartido: markups, consecutivos, moneda — Fase 1+
├── deploy/             # docker-compose, Caddy, CI/CD
├── pnpm-workspace.yaml
└── turbo.json
```

## Roadmap

- **Fase 0 — Fundaciones** ← *en curso*: monorepo, esquema DB, tenancy + RLS, roles, auth.
- **Fase 1** — Motor de cotización + markups + TRM + consecutivos (LiteAPI).
- **Fase 2** — Gestión de cotizaciones: PDF + propuesta web pública interactiva.
- **Fase 3** — CRM / reservas asignadas a agentes.
- **Fase 4** — Inbox omnicanal (Telegram → WhatsApp Cloud API).
- **Fase 5** — Reportería y conciliación (Costo/Venta/Markup/Comisión + datos DIAN).
- **Fase 6** — Omnibees, extracción del cotizador a servicio, escala.

## Modelo de roles (multi-agencia)

Un usuario puede pertenecer a **varias agencias** → el rol vive en `memberships`, no en el usuario.

| Rol | Alcance | Descripción |
|---|---|---|
| `super_admin` | Plataforma (`agency_id = NULL`) | Dueño del SaaS |
| `admin_agencia` | Una agencia | Configura markups, usuarios, agencia |
| `agente` | Una agencia | Ve solo sus propios chats/cotizaciones |
| `contable` | Agencia **o** plataforma | Por agencia, o global (varias/todas) |

## Puesta en marcha (Fase 0)

```bash
pnpm install
cp .env.example .env            # completa credenciales de tu Supabase self-hosted
pnpm db:migrate                 # aplica migraciones en orden
pnpm --filter web dev           # levanta el shell de Next.js
```

Ver [`packages/db/README.md`](packages/db/README.md) para migraciones y [`deploy/README.md`](deploy/README.md) para despliegue.
