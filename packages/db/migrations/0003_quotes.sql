-- ============================================================
-- 0003_quotes.sql
-- Cotizaciones multi-opción + config de precios (fee bancario, validez)
-- ============================================================
begin;

-- ---------- Config de precios por agencia ----------
alter table agencies
  add column if not exists bank_fee_percent  numeric(6,3) not null default 3.0,
  add column if not exists quote_validity_days int      not null default 7;

-- ---------- Estados de cotización ----------
do $$ begin
  create type quote_status as enum ('draft','sent','approved','rejected','expired');
exception when duplicate_object then null; end $$;

-- ---------- quotes (cabecera) ----------
create table if not exists quotes (
  id            uuid primary key default gen_random_uuid(),
  agency_id     uuid not null references agencies(id) on delete cascade,
  agent_id      uuid not null references users(id),        -- agente dueño de la cotización
  consecutivo   text unique,                               -- NULL hasta 'sent' (se vuelve efectiva)
  status        quote_status not null default 'draft',
  title         text,

  -- cliente
  client_name   text,
  client_email  citext,
  client_phone  text,

  -- snapshots congelados al enviar
  trm_cop_per_usd numeric(16,6),                           -- TRM BanRep del día de envío
  trm_date        date,
  bank_fee_percent numeric(6,3),                           -- fee de la agencia al momento de enviar

  notes         text,
  valid_until   date,                                      -- sent_at + quote_validity_days
  public_token  text unique,                               -- para /p/<token> (propuesta pública)
  sent_at       timestamptz,
  decided_at    timestamptz,                               -- aprobada/rechazada

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_quotes_agency_status on quotes(agency_id, status);
create index if not exists idx_quotes_agent on quotes(agent_id);
drop trigger if exists trg_quotes_updated on quotes;
create trigger trg_quotes_updated before update on quotes
  for each row execute function set_updated_at();

-- ---------- quote_options (opciones que el cliente compara/elige) ----------
create table if not exists quote_options (
  id            uuid primary key default gen_random_uuid(),
  quote_id      uuid not null references quotes(id) on delete cascade,
  position      int not null default 1,
  label         text,

  -- proveedor / snapshot de contenido (LiteAPI en vivo -> guardamos lo mostrado)
  provider      text not null default 'liteapi',
  provider_ref  jsonb,                        -- hotelId, rateId, offerId, cancelación, etc.
  hotel_name    text,
  hotel_city    text,
  hotel_stars   int,
  hotel_image   text,

  -- estadía / ocupación
  check_in      date,
  check_out     date,
  nights        int generated always as (greatest(check_out - check_in, 0)) stored,
  occupancy     jsonb,                        -- { rooms, adults, children:[edades] }
  board         text,                         -- tipo de habitación / régimen

  -- precios (USD interno; COP congelado al enviar)
  net_cost_usd    numeric(12,2) not null,
  markup_percent  numeric(9,4) not null default 0,   -- Σ% markup aplicable (snapshot)
  markup_fixed_usd numeric(12,2) not null default 0, -- Σ fijos en USD (snapshot)
  bank_fee_percent numeric(6,3) not null default 0,  -- fee aplicado (snapshot)
  sale_usd        numeric(12,2) not null default 0,  -- venta calculada
  sale_cop        numeric(14,2),                     -- venta en COP (congelada al enviar)

  selected      boolean not null default false,      -- opción elegida por el cliente
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_options_quote on quote_options(quote_id);
drop trigger if exists trg_options_updated on quote_options;
create trigger trg_options_updated before update on quote_options
  for each row execute function set_updated_at();

-- ============================================================
-- RLS
-- ============================================================
alter table quotes        enable row level security;
alter table quote_options enable row level security;

-- quotes: agente ve las suyas; admin_agencia y contable ven las de su agencia; super_admin todas.
drop policy if exists quotes_select on quotes;
create policy quotes_select on quotes for select
  using (
    is_platform_admin()
    or has_agency_role(agency_id, array['admin_agencia','contable']::app_role[])
    or (agent_id = app_current_user() and is_member_of(agency_id))
  );

-- escritura: admin_agencia de la agencia, o el agente dueño (agente/admin de esa agencia).
drop policy if exists quotes_write on quotes;
create policy quotes_write on quotes for all
  using (
    has_agency_role(agency_id, array['admin_agencia']::app_role[])
    or (agent_id = app_current_user()
        and has_agency_role(agency_id, array['agente','admin_agencia']::app_role[]))
  )
  with check (
    has_agency_role(agency_id, array['admin_agencia']::app_role[])
    or (agent_id = app_current_user()
        and has_agency_role(agency_id, array['agente','admin_agencia']::app_role[]))
  );

-- quote_options: hereda el acceso de la cotización padre.
drop policy if exists options_select on quote_options;
create policy options_select on quote_options for select
  using (
    exists (
      select 1 from quotes q
      where q.id = quote_id and (
        is_platform_admin()
        or has_agency_role(q.agency_id, array['admin_agencia','contable']::app_role[])
        or q.agent_id = app_current_user()
      )
    )
  );

drop policy if exists options_write on quote_options;
create policy options_write on quote_options for all
  using (
    exists (
      select 1 from quotes q
      where q.id = quote_id and (
        has_agency_role(q.agency_id, array['admin_agencia']::app_role[])
        or (q.agent_id = app_current_user()
            and has_agency_role(q.agency_id, array['agente','admin_agencia']::app_role[]))
      )
    )
  )
  with check (
    exists (
      select 1 from quotes q
      where q.id = quote_id and (
        has_agency_role(q.agency_id, array['admin_agencia']::app_role[])
        or (q.agent_id = app_current_user()
            and has_agency_role(q.agency_id, array['agente','admin_agencia']::app_role[]))
      )
    )
  );

grant select, insert, update, delete on quotes        to crm_app;
grant select, insert, update, delete on quote_options to crm_app;

commit;
