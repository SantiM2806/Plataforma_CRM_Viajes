# @travelkit/db — Esquema y migraciones

Migraciones SQL numeradas para el Postgres de **tu** Supabase self-hosted.

## Migraciones

| Archivo | Contenido |
|---|---|
| `0001_foundation.sql` | Enums, `profiles`, `agencies`, `memberships`, helpers de autorización, `onboard_agency`, consecutivos, `markup_rules`, `exchange_rates`, `audit_log` |
| `0002_rls.sql` | Políticas RLS + grants a roles `authenticated`/`anon` |

## Aplicar

```bash
# desde la raíz del monorepo
export DATABASE_URL="postgresql://crm:PASSWORD@HOST:5432/postgres"
pnpm db:migrate
```

Registra cada archivo aplicado en la tabla `_migrations` (idempotente: no reaplica).

> **Alternativa**: si usas el CLI de Supabase, puedes copiar estos `.sql` a `supabase/migrations/` y correr `supabase db push`. El runner propio evita depender del CLI.

## Notas de diseño

- **Aislamiento por tenant**: las políticas RLS se apoyan en `memberships`. Las funciones helper (`is_member_of`, `has_agency_role`, …) son `SECURITY DEFINER` para no entrar en recursión al leer `memberships` desde una policy.
- **Auto-registro**: el cliente NO inserta en `agencies` directamente; llama a la RPC `onboard_agency(name, initials, tax_id)` que crea la agencia y la membresía `admin_agencia` en una transacción.
- **Consecutivos**: `select next_consecutivo('<agency_uuid>', 'COT');` → `COT-AVM-00001`. Atómico vía `INSERT … ON CONFLICT … RETURNING`.
- **doc_sequences** tiene RLS activo **sin políticas**: es inaccesible al cliente y solo se toca vía `next_consecutivo` (definer).
- **exchange_rates / audit_log**: los escribe el worker con `service_role` (bypassa RLS).

## Verificación rápida (psql)

```sql
-- como super_admin de plataforma, sembrar el primer usuario:
insert into memberships (user_id, agency_id, role)
values ('<TU_AUTH_UID>', null, 'super_admin');

-- probar consecutivo:
select next_consecutivo(id, 'COT') from agencies limit 1;
```
