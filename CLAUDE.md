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

## Fase 1 — reglas de negocio (confirmadas)
- **Cotización multi-opción**: `quotes` (cabecera + cliente) → N `quote_options` (el cliente compara/elige). Estados: draft→sent→approved/rejected/expired, validez 7 días config (`agencies.quote_validity_days`).
- **Consecutivo + TRM + public_token**: se asignan/congelan al **enviar** (status→sent). Borrador sin número.
- **Precios** (`@travelkit/core` `computePrice`): `venta_usd = costo_neto * (1 + Σmarkup% + fee_bancario%) + Σfijos`. Todos los % aplicables suman sobre el costo neto. Fee bancario = `agencies.bank_fee_percent` (default 3%, editable). Cliente ve **solo el precio final** en **COP** (TRM del envío), **redondeado a la centena**. `quote_options` guarda snapshot de net_cost/markup/fee/sale_usd/sale_cop para reportería (Fase 5).
- **LiteAPI**: búsqueda por **hotel específico**, ocupación con edades de niños, contenido **en vivo** (snapshot de lo mostrado en `quote_options.provider_ref`/hotel_*).

## Estado actual
Fase 0 COMPLETA. Fase 1 slice 1 (modelo + motor de precios) y slice 2 (LiteAPI + TRM + UI cotizador) HECHOS y validados e2e en Postgres real + navegador (registro→onboarding→borrador→ENVIAR con TRM real BanRep 3126.08 → COT-AVM-0001, precios congelados COP/USD redondeados).
- LiteAPI: `apps/web/src/lib/liteapi/client.ts` (searchHotels por ciudad+nombre, getRates con edades de niños). Base https://api.liteapi.travel/v3.0, header X-API-Key, env LITEAPI_ENV+KEY. **PENDIENTE VERIFICAR con el usuario**: uso `retailRate.total` como costo neto (ver `extractNetCost`); confirmar contra su cuenta real.
- TRM: `apps/web/src/lib/trm.ts` (datos.gov.co 32sa-8pi3, fallback a última guardada). migración 0004: exchange_rates lectura pública + escritura crm_app (necesario para upsert sin contexto de usuario, y para ON CONFLICT DO UPDATE que requiere SELECT).
- Cotizador UI: grupo `(app)` con layout+shell compartido; `/quotes` (lista), `/quotes/new` (builder: busca hotel, ver tarifas con precio en vivo, agrega opciones, guardar/enviar), `/quotes/[id]` (detalle + Enviar). Acciones en `(app)/quotes/actions.ts`.
Slices A+C HECHOS y validados e2e: (A) propuesta pública `/p/<token>` — migración 0005 con `get_public_quote`/`decide_public_quote` (SECURITY DEFINER, sin login, solo expone precio de venta); página `app/p/[token]` cliente elige opción y aprueba/rechaza → quote pasa a approved/rejected + option.selected. (C) config de precios en `/settings` (solo admin): fee bancario + validez + CRUD de reglas de markup; acciones en `(app)/settings/actions.ts`.
Fase 3 (Reservas) HECHA y validada e2e: migración 0006 (tabla reservations + RLS agente/admin/contable + enum reservation_status). Al aprobar una cotización, `decide_public_quote` crea automáticamente la reserva (RES-AVM-XXXX, pending) con snapshots de cliente/hotel/precio y el agente de la cotización. UI: `/reservations` (lista) y `/reservations/[id]` (gestión: confirmar con localizador, completar, cancelar, notas). Probado: aprobar propuesta → reserva auto-creada → confirmar con localizador.

## Entorno local de desarrollo
Postgres persistente propio del proyecto en `.devdb/` (gitignored), puerto **55432** (el 5433 está en rango excluido por Windows). Arrancar/parar con pg_ctl (binarios en `C:\Program Files\PostgreSQL\18\bin`). App en http://localhost:3000 (`pnpm --filter @travelkit/web dev`). Credenciales en `apps/web/.env.local` (gitignored): DATABASE_APP_URL=crm_app@localhost:55432, AUTH_SECRET generado. Cuenta demo sembrada: santi@travelkit.test / supersecret123 (agencia AVM, con cotización aprobada COT-AVM-0001 y reserva RES-AVM-0001).

PDF (Fase D) HECHO: `@react-pdf/renderer` (sin navegador headless, Docker-friendly). Documento en `apps/web/src/lib/pdf/quote-pdf.tsx`, ruta `GET /quotes/[id]/pdf` (route.ts, runtime nodejs) devuelve application/pdf bajo RLS; botón "PDF" en el detalle. Validado en vivo (%PDF-1.3, 200). Nota: `renderToBuffer(createElement(QuotePdf,{data}) as any)` por fricción de tipos; evitar glifos fuera de Latin-1 (Helvetica) — se usa `(4*)` en vez de estrellas.
Fase 4 (Inbox omnicanal) HECHA y validada e2e (canal simulado): migración 0007 (channel_integrations, conversations, messages + RLS + enums + RPC `ingest_inbound_message` SECURITY DEFINER para webhooks sin sesión). Adaptadores en `lib/channels` (Telegram sendMessage, WhatsApp Cloud API). Webhooks públicos `/api/webhooks/{telegram,whatsapp}/[agencyId]` (WA con verify GET). UI `/inbox` (lista) y `/inbox/[id]` (hilo + composer + adjuntar cotización que envía el link público). Config de canales en `/settings` (Telegram botToken; WhatsApp phoneNumberId/accessToken/verifyToken). RLS: agente ve conversaciones asignadas a él o sin asignar (auto-asigna al responder); admin/contable ven todas. Validado: webhook entrante Telegram -> conversación+mensaje; responder (auto-asigna, delivered=false sin token); adjuntar cotización -> mensaje con link. `LITEAPI_KEY_SANDBOX` en .env.local es la PUBLIC key (da 401 en Standard Auth); falta la privada sand_.
Fase 5 (Reportería/conciliación) HECHA y validada e2e: migración 0008 (client_tax_id en quotes+reservations, base DIAN; decide_public_quote copia el NIT a la reserva). `/reports` (admin/contable): filtro por fechas, tarjetas resumen (Ventas, Venta, Costo proveedor, Markup=utilidad, Fee bancario) y tabla de ventas efectivas (reservas confirmed/completed), con desglose en COP vía join reservations↔quote_options (markup%/fee%/fijo). Export CSV `/reports/export` (con BOM para Excel, fila TOTALES) = datos base DIAN/conciliación. Campo NIT/CC agregado al constructor de cotizaciones. Validado: reserva confirmada aparece con costo/markup/fee/venta y CSV correcto.
Worker (E) HECHO: `apps/worker` (BullMQ + ioredis). Job repetible `trm-refresh` (cron `0 7 * * *` + al arrancar) → `refreshTrm()` (Socrata + upsert exchange_rates vía crm_app). `deploy/worker.Dockerfile` + servicio worker activado en compose. Correr: `pnpm --filter @travelkit/worker start` (necesita Redis en REDIS_URL). Validado: typecheck OK + `trm:once` trajo TRM real y persistió. tsx corre el TS directo (sin build).
Falta: CI/CD (GitHub Actions) + despliegue a Droplet. Pendiente global: OAuth Google real (guía dada), LiteAPI key privada (sand_), Redis local para el scheduler, tests automatizados.
