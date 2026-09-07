# @crm/db — Esquema, migraciones y cliente

PostgreSQL puro (sin Supabase). Migraciones SQL hand-written (fuente de verdad del DDL) + esquema Drizzle para queries tipadas.

## Migraciones

| Archivo | Contenido |
|---|---|
| `0000_roles.sql` | Crea el rol de runtime `crm_app` (login, NO owner) |
| `0001_foundation.sql` | Enums, tablas Auth.js (`users`/`accounts`/`sessions`/`verification_tokens`), `agencies`, `memberships`, helpers de autorización, `onboard_agency`, consecutivos, `markup_rules`, `exchange_rates`, `audit_log` |
| `0002_rls.sql` | Políticas RLS (dominio) + grants a `crm_app` |

## Aplicar

```bash
# DATABASE_URL = rol ADMIN/owner (crea roles, funciones, RLS)
export DATABASE_URL="postgresql://postgres:PASSWORD@localhost:5432/travelkit_crm"
pnpm db:migrate
```

Registra cada archivo aplicado en `_migrations` (idempotente).

> Cambia la contraseña de `crm_app` tras la primera migración:
> `ALTER ROLE crm_app PASSWORD '...';` y ponla en `DATABASE_APP_URL`.

## Dos conexiones

| Var | Rol | Uso |
|---|---|---|
| `DATABASE_URL` | admin/owner (BYPASSRLS) | Migraciones. Las funciones `SECURITY DEFINER` corren como este owner → leen `memberships` sin recursión de RLS. |
| `DATABASE_APP_URL` | `crm_app` (NO owner) | Runtime de la app → **RLS aplica**. |

## Aislamiento por tenant (2 capas)

1. **Capa de aplicación**: toda consulta de dominio pasa por `withUser(userId, tx => …)`, que abre una transacción y hace `set_config('app.user_id', userId, true)`.
2. **RLS**: las policies usan `app_current_user()` (lee el GUC `app.user_id`). Si el código olvidara filtrar, la RLS igual bloquea filas de otras agencias.

```ts
import { withUser, schema } from '@crm/db';

const rows = await withUser(userId, (tx) =>
  tx.select().from(schema.memberships), // solo devuelve lo que la RLS permite
);
```

El cliente `db` (sin contexto) es solo para el adaptador de Auth.js y jobs del worker.

## Notas

- **Consecutivos**: `select next_consecutivo('<agency_uuid>', 'COT');` → `COT-AVM-0001` (base36, atómico).
- **Auto-registro**: el cliente NO inserta en `agencies`; llama a `onboard_agency(name, initials, tax_id)` (crea agencia + membresía `admin_agencia` para `app_current_user()`).
- **doc_sequences**: RLS activo sin policies → inaccesible salvo vía `next_consecutivo` (definer).
- `schema.ts` (Drizzle) refleja las migraciones; mantener en sync manualmente.

## Sembrar el primer super_admin

```sql
-- tras registrarte por la UI (crea tu fila en users), toma tu id y:
insert into memberships (user_id, agency_id, role)
values ('<TU_USER_UUID>', null, 'super_admin');
```
