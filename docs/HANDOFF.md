# HANDOFF — CRM de Viajes

Documento para retomar el proyecto en una nueva conversación con Claude. Pégalo (o adjúntalo) al iniciar el chat.

---

## 1. Qué es

**CRM de Viajes**: SaaS **multi-tenant** para agencias de viajes. Cubre el ciclo completo: cotizar (con búsqueda de hoteles en vivo) → enviar propuesta web → el cliente aprueba con un clic → reserva → inbox omnicanal (WhatsApp/Telegram) → reportería y conciliación (base DIAN). En español, para Colombia (USD → COP).

- **Repositorio:** https://github.com/SantiM2806/Plataforma_CRM_Viajes (rama `master`)
- **Carpeta local (esta máquina):** `C:\Users\santi\travelkit_crm`
- **Marca visible:** "CRM de Viajes" · **color:** violeta `#6d28d9` (hubo un experimento en verde lima que se revirtió).
- **Scope de paquetes:** `@crm/*` (la carpeta sigue llamándose `travelkit_crm`; no renombrarla).

## 2. Cómo correr en localhost

Guía completa en **`docs/DESPLIEGUE-LOCAL.md`**. Resumen:

```bash
# En esta máquina la BD ya existe (Postgres persistente en .devdb, puerto 55432).
# Arrancar Postgres (binarios PG18 en "C:\Program Files\PostgreSQL\18\bin"):
"C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe" -D "C:\Users\santi\travelkit_crm\.devdb\data" -l "C:\Users\santi\travelkit_crm\.devdb\log.txt" start
pnpm db:migrate                       # lee apps/web/.env.local
pnpm --filter @crm/web dev            # http://localhost:3000
```

- **Cuenta demo:** `santi@travelkit.test` / `supersecret123` (agencia "Agencia AVM", con datos de ejemplo).
- El `pnpm dev` recarga en vivo al editar archivos.

## 3. Stack y arquitectura (decisiones clave)

- **Monorepo pnpm + turbo.** `apps/web` (Next.js 15 App Router + Tailwind + shadcn-style), `apps/worker` (BullMQ + ioredis, TRM diaria), `packages/db` (Drizzle + migraciones SQL), `packages/core` (motor de precios puro).
- **PostgreSQL puro** (NO Supabase) + **Drizzle ORM**. Auth con **Auth.js (NextAuth v5)**: Google OAuth + credenciales (argon2), estrategia JWT.
- **Multi-tenant en 2 capas:** el código filtra por `agency_id` vía `withUser(userId, tx => …)` que abre transacción y hace `set_config('app.user_id', uuid, true)`; **RLS** en Postgres como red de seguridad usando `app_current_user()`. Los helpers RLS (`is_member_of`, `has_agency_role`, etc.) son `SECURITY DEFINER`. La app corre como rol **`crm_app`** (NO owner → RLS aplica); las migraciones corren como `postgres` (owner).
- **Roles** en `memberships(user_id, agency_id, role)`: `super_admin` (agency_id NULL, dueño del SaaS), `admin_agencia`, `agente` (ve solo lo suyo), `contable`.
- **Precios** (`@crm/core` `computePrice`): `venta_usd = costo_neto * (1 + Σmarkup% + fee_bancario%) + Σfijos`; COP con **TRM oficial BanRep** (redondeo a la centena). Fee bancario por agencia (default 3%). Cliente ve solo precio final.
- **Consecutivos:** `{DOC}-{INICIALES}-{base36}` (ej. `COT-AVM-0001`, `RES-AVM-0001`), por agencia, atómicos vía `next_consecutivo()`. Se asignan al **enviar**.

## 4. Integración LiteAPI (importante)

- Base `https://api.liteapi.travel/v3.0`, header `X-API-Key`. Env `LITEAPI_ENV=sandbox`, `LITEAPI_KEY_SANDBOX=sand_...` (privada; ya está en `.env.local`).
- **Buscador:** `aiSearch` NO es válido en este plan (da 400 con marcas tipo "Hilton"). El flujo correcto es **autocomplete** `/data/places?textQuery=` → `placeId` → `/data/hotels?placeId=`. (`apps/web/src/lib/liteapi/client.ts`).
- **Precio por hotel:** `POST /hotels/min-rates` (precio mínimo, para tarjetas). **Tarifas completas:** `POST /hotels/rates`.
- **Costo neto = `retailRate.total`** (lo que se paga a LiteAPI). `suggestedSellingPrice` = referencia de mercado. La cancelación sale de `cancellationPolicies` (refundableTag RFN + cancelPolicyInfos).

## 5. Estado (~80% del MVP)

**HECHO y probado e2e:** auth + multi-agencia + RLS · cotizador con buscador en vivo + markups + fee + TRM + PDF + edición + estados/seguimiento + compartir enlace + cancelación · propuesta pública + aprobación · reservas automáticas + gestión · inbox Telegram/WhatsApp (envío de cotizaciones) · reportería + CSV DIAN · usuarios/equipo · dashboard con métricas · worker de TRM.

**PENDIENTE (prioridad sugerida):**
1. **Inbox rediseñado** (bandeja de 2 paneles estilo WhatsApp Web).
2. **Dashboard look-to-book** (cotizaciones→reservas %) y gráficos.
3. **Recordatorios** de cancelación/pagos (worker, ya se guarda `free_cancellation_until`).
4. **CI/CD + despliegue a producción** (dominio, Caddy TLS, GitHub Actions; `deploy/` ya tiene Dockerfiles + compose).
5. WhatsApp productivo (credenciales Meta), pago en línea desde la propuesta, Omnibees (2º proveedor), tests automatizados, pulido estético.

## 6. Convenciones y "gotchas"

- **Migraciones** en `packages/db/migrations/NNNN_*.sql` (0000–0010), fuente de verdad del DDL; `packages/db/src/schema.ts` (Drizzle) es solo para tipado y hay que mantenerlo en sync.
- Toda consulta de dominio pasa por `withUser`; el cliente `db` (sin contexto) es solo para Auth.js y webhooks/jobs.
- **Validación local sin ensuciar:** se usan clusters Postgres desechables con `initdb` en temp (patrón repetido en el historial). Para **capturas** se usó Playwright con el Chrome del sistema (`_shots.mjs` + `_buildpres.mjs`, gitignored).
- **Windows:** el puerto 5433 está excluido ("permission denied"); por eso el dev usa **55432**.
- **Secretos:** viven solo en `apps/web/.env.local` (gitignored). NO están en el repo. El rol `crm_app` se crea con password `change_me_dev` (placeholder; cambiar en prod).
- **Presentaciones** (`docs/presentacion.html`, `docs/presentacion-avance.html`): siguen en **verde** (se hicieron durante el experimento de color). Si se van a usar, regenerar en violeta (la de avance embebe capturas; hay que re-tomarlas con `_shots.mjs` + `_buildpres.mjs`).

## 7. Contexto de esta máquina

- Node 24, pnpm 9, PostgreSQL 18 instalado (binarios en `C:\Program Files\PostgreSQL\18\bin`). Chrome instalado (para Playwright). `gh` NO instalado; git usa Git Credential Manager (`manager`) para push por HTTPS.
- Terminal: Git Bash / PowerShell. Docker Desktop puede no estar corriendo.

---

**Para empezar el nuevo chat, di algo como:**
> "Retomo el proyecto CRM de Viajes en `C:\Users\santi\travelkit_crm` (repo Plataforma_CRM_Viajes). Aquí está el handoff: [pega este archivo]. Quiero continuar con [Inbox rediseñado / dashboard look-to-book / despliegue]."
