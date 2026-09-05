# CLAUDE.md — Travelkit CRM/CX

Contexto para sesiones de Claude Code en este repo.

## Qué es
SaaS **multi-tenant** CRM/CX para agencias de viajes. Ciclo: cotizar → gestionar cotizaciones (PDF + web pública) → CRM/reservas → Inbox omnicanal → reportería/conciliación (base DIAN). **Independiente** de `travelkit_cotizador`.

## Decisiones de arquitectura (confirmadas)
- **Stack**: Next.js (App Router) + Tailwind + shadcn/ui; Supabase self-hosted (Auth + Postgres + RLS); BullMQ + Redis; monolito modular (motor de cotización aislado, extraíble).
- **Multi-tenancy**: single-DB agrupada por `agency_id` + **RLS** como red de seguridad. El código SIEMPRE filtra por tenant; RLS es la segunda capa.
- **Roles** viven en `memberships(user_id, agency_id, role)`. `agency_id = NULL` ⇒ alcance de plataforma (super_admin, contable global). Un usuario puede tener varias agencias.
- **Auth**: Supabase Auth con Google OAuth + email/password. **Auto-registro**: el usuario se registra y crea su agencia vía RPC `onboard_agency` (SECURITY DEFINER) que lo hace `admin_agencia`.
- **Consecutivos**: `{DOC}-{INITIALS}-{n}` (ej. `COT-AVM-00001`). Secuencia **por agencia**, arranca en 1, atómica vía `next_consecutivo()`.
- **Markups**: configurados por el `admin_agencia`. `percent` o `fixed`. Scopes: `agency_default`, `provider`, `product_type`, `product`. Precio final = suma de reglas aplicables.
- **Moneda**: base USD, visualización COP. TRM oficial **BanRep**, congelada **al crear** la cotización (snapshot en la cotización).
- **DIAN**: Fase 5 solo exporta **datos base** de facturación (sin integración con Proveedor Tecnológico).
- **Proveedores**: Fase 1 = LiteAPI (solo hoteles). Fase 6 = Omnibees.

## Convenciones
- Migraciones SQL numeradas en `packages/db/migrations/NNNN_*.sql`, idempotentes donde sea posible, envueltas en `begin/commit`.
- Funciones helper de RLS son `SECURITY DEFINER` + `search_path = public` para evitar recursión al consultar `memberships`.
- Nunca exponer `service_role` al cliente; el worker lo usa server-side.
- Nombres de tablas/columnas en inglés; UI y textos de negocio en español.

## Estado actual
Fase 0 en curso. Falta: completar shell de Next.js (UI onboarding/login), worker, tests.
