# CLAUDE.md — Travelkit CRM/CX

Contexto para sesiones de Claude Code en este repo.

## Qué es
SaaS **multi-tenant** CRM/CX para agencias de viajes. Ciclo: cotizar → gestionar cotizaciones (PDF + web pública) → CRM/reservas → Inbox omnicanal → reportería/conciliación (base DIAN). **Independiente** de `travelkit_cotizador`.

## Decisiones de arquitectura (confirmadas)
- **Stack**: Next.js (App Router) + Tailwind + shadcn/ui; **PostgreSQL puro (SIN Supabase)** + **Drizzle ORM**; **Auth.js (NextAuth v5)**; BullMQ + Redis; monolito modular (motor de cotización aislado, extraíble).
- **Multi-tenancy (2 capas)**: (1) el código SIEMPRE filtra por tenant vía la capa de datos; (2) **RLS** en Postgres como red de seguridad. Como no hay `auth.uid()`, la app inyecta el usuario por transacción con `set_config('app.user_id', <uuid>, true)` (helper `withUser()` en `@travelkit/db`). Las policies usan `app_current_user()`.
- **Roles de Postgres**: la app corre como `crm_app` (NO owner → RLS aplica); las migraciones corren como admin/owner (BYPASSRLS) para que las funciones `SECURITY DEFINER` lean `memberships` sin recursión.
- **Roles de negocio** viven en `memberships(user_id, agency_id, role)`. `agency_id = NULL` ⇒ plataforma, **solo `super_admin`** (dueño, ve todas las agencias). `admin_agencia`/`agente`/`contable` siempre atados a una agencia; un contable multi-agencia tiene una membresía por cada una. Un usuario puede tener varias agencias.
- **Auth**: Auth.js con Google (OAuth, `allowDangerousEmailAccountLinking`) + Credentials (email/password, hash `@node-rs/argon2`), estrategia **JWT**. Tablas `users/accounts/sessions/verification_tokens` **sin RLS** (el login ocurre antes de tener user_id). **Auto-registro**: tras entrar, el usuario crea su agencia vía RPC `onboard_agency` (SECURITY DEFINER) que lo hace `admin_agencia`.
- **Consecutivos**: `{DOC}-{INITIALS}-{base36}` (ej. `COT-AVM-0001`). Valor en **base36** (mayúsculas), secuencia **por agencia**, arranca en 1, atómica vía `next_consecutivo()`.
- **Markups**: configurados por el `admin_agencia`. `percent` o `fixed`. Scopes: `agency_default`, `provider`, `product_type`, `product`. Precio final = suma de reglas aplicables.
- **Moneda**: base USD, visualización COP. TRM oficial **BanRep**, congelada **al crear** la cotización (snapshot en la cotización).
- **DIAN**: Fase 5 solo exporta **datos base** de facturación (sin integración con Proveedor Tecnológico).
- **Proveedores**: Fase 1 = LiteAPI (solo hoteles). Fase 6 = Omnibees.

## Convenciones
- Migraciones SQL numeradas en `packages/db/migrations/NNNN_*.sql` (fuente de verdad del DDL), idempotentes donde sea posible, envueltas en `begin/commit`. `packages/db/src/schema.ts` (Drizzle) es solo para tipado de queries y debe mantenerse en sync con las migraciones.
- Funciones helper de RLS son `SECURITY DEFINER` + `search_path = public` para evitar recursión al consultar `memberships`.
- Toda consulta de dominio desde la app pasa por `withUser(userId, tx => …)`; el cliente `db` sin contexto es solo para el adaptador de Auth.js y jobs.
- Dos URLs de Postgres: `DATABASE_URL` (admin, migraciones) y `DATABASE_APP_URL` (rol `crm_app`, runtime con RLS).
- Nombres de tablas/columnas en inglés; UI y textos de negocio en español.

## Estado actual
Fase 0 en curso. Falta: completar shell de Next.js (UI onboarding/login), worker, tests.
