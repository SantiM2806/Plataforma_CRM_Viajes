-- ============================================================
-- 0001_foundation.sql
-- Travelkit CRM — Fundaciones: tenancy, roles, primitivas de negocio
-- ============================================================
begin;

create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "citext";      -- emails case-insensitive

-- ---------- Enums ----------
do $$ begin
  create type app_role as enum ('super_admin','admin_agencia','agente','contable');
exception when duplicate_object then null; end $$;

do $$ begin
  create type markup_scope as enum ('agency_default','provider','product_type','product');
exception when duplicate_object then null; end $$;

do $$ begin
  create type markup_calc as enum ('percent','fixed');
exception when duplicate_object then null; end $$;

-- ---------- Helper: updated_at ----------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- profiles (espejo de auth.users) ----------
create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      citext not null,
  full_name  text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_profiles_updated on profiles;
create trigger trg_profiles_updated before update on profiles
  for each row execute function set_updated_at();

-- Crea el profile automáticamente al registrarse un usuario en auth.users
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (new.id, new.email,
          new.raw_user_meta_data->>'full_name',
          new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- agencies (tenants) ----------
create table if not exists agencies (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  slug             text not null unique,
  initials         text not null unique,             -- prefijo de consecutivos (ej: AVM)
  country          char(2) not null default 'CO',
  tax_id           text,                              -- NIT (Colombia)
  base_currency    char(3) not null default 'USD',
  display_currency char(3) not null default 'COP',
  settings         jsonb not null default '{}'::jsonb,
  active           boolean not null default true,
  created_by       uuid references profiles(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint agencies_initials_format check (initials ~ '^[A-Z0-9]{2,6}$')
);
drop trigger if exists trg_agencies_updated on agencies;
create trigger trg_agencies_updated before update on agencies
  for each row execute function set_updated_at();

-- ---------- memberships (user <-> agency, rol por membresía) ----------
-- agency_id NULL = alcance de PLATAFORMA (solo super_admin = dueño del SaaS).
-- admin_agencia / agente / contable van SIEMPRE atados a una agencia.
-- Un contable que lleve varias agencias tiene una membresía por cada una.
create table if not exists memberships (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  agency_id  uuid references agencies(id) on delete cascade,
  role       app_role not null,
  created_at timestamptz not null default now(),
  constraint memberships_scope_check check (
    (role = 'super_admin' and agency_id is null) or
    (role in ('admin_agencia','agente','contable') and agency_id is not null)
  ),
  constraint memberships_unique unique nulls not distinct (user_id, agency_id, role)
);
create index if not exists idx_memberships_user   on memberships(user_id);
create index if not exists idx_memberships_agency on memberships(agency_id);

-- ---------- Helpers de autorización (SECURITY DEFINER => evitan recursión RLS) ----------
create or replace function is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m
    where m.user_id = auth.uid() and m.agency_id is null and m.role = 'super_admin'
  );
$$;

create or replace function is_member_of(p_agency uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select is_platform_admin() or exists (
    select 1 from memberships m
    where m.user_id = auth.uid() and m.agency_id = p_agency
  );
$$;

create or replace function has_agency_role(p_agency uuid, p_roles app_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select is_platform_admin() or exists (
    select 1 from memberships m
    where m.user_id = auth.uid() and m.agency_id = p_agency and m.role = any(p_roles)
  );
$$;

create or replace function current_agency_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select agency_id from memberships
  where user_id = auth.uid() and agency_id is not null;
$$;

-- ---------- onboarding: crear agencia + admin (auto-registro) ----------
create or replace function onboard_agency(p_name text, p_initials text, p_tax_id text default null)
returns agencies language plpgsql security definer set search_path = public as $$
declare
  v_agency agencies;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  insert into agencies (name, slug, initials, tax_id, created_by)
  values (
    p_name,
    lower(regexp_replace(p_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(gen_random_uuid()::text, 1, 6),
    upper(p_initials),
    p_tax_id,
    auth.uid()
  )
  returning * into v_agency;

  insert into memberships (user_id, agency_id, role)
  values (auth.uid(), v_agency.id, 'admin_agencia');

  return v_agency;
end $$;

-- ---------- doc_sequences + consecutivos ----------
create table if not exists doc_sequences (
  agency_id  uuid not null references agencies(id) on delete cascade,
  doc_type   text not null default 'COT',
  last_value bigint not null default 0,
  primary key (agency_id, doc_type)
);

-- Codifica un entero en base36 (0-9 A-Z), mayúsculas.
create or replace function to_base36(n bigint)
returns text language plpgsql immutable as $$
declare
  digits constant text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  out text := '';
  v bigint := n;
begin
  if v < 0 then raise exception 'to_base36: valor negativo no soportado'; end if;
  if v = 0 then return '0'; end if;
  while v > 0 loop
    out := substr(digits, (v % 36)::int + 1, 1) || out;
    v := v / 36;   -- división entera
  end loop;
  return out;
end $$;

-- Devuelve el siguiente consecutivo formateado, de forma atómica.
-- Formato: {DOC}-{INITIALS}-{valor en base36 con padding}   ej: COT-AVM-0001, COT-AVM-002X
create or replace function next_consecutivo(p_agency uuid, p_doc_type text default 'COT', p_pad int default 4)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_val bigint;
  v_initials text;
begin
  select initials into v_initials from agencies where id = p_agency;
  if v_initials is null then
    raise exception 'Agencia % no existe', p_agency;
  end if;

  insert into doc_sequences (agency_id, doc_type, last_value)
  values (p_agency, upper(p_doc_type), 1)
  on conflict (agency_id, doc_type)
    do update set last_value = doc_sequences.last_value + 1
  returning last_value into v_val;

  return upper(p_doc_type) || '-' || v_initials || '-' || lpad(to_base36(v_val), p_pad, '0');
end $$;

-- ---------- markup_rules (config por agencia; % o fijo; por proveedor/producto) ----------
create table if not exists markup_rules (
  id         uuid primary key default gen_random_uuid(),
  agency_id  uuid not null references agencies(id) on delete cascade,
  scope      markup_scope not null,
  scope_ref  text,                 -- code proveedor / product_type / product_id (null si agency_default)
  calc_type  markup_calc not null,
  value      numeric(12,4) not null check (value >= 0),
  currency   char(3) not null default 'USD',
  priority   int not null default 100,
  active     boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint markup_scope_ref_check check (
    (scope = 'agency_default' and scope_ref is null) or
    (scope <> 'agency_default' and scope_ref is not null)
  )
);
create index if not exists idx_markup_agency on markup_rules(agency_id) where active;
drop trigger if exists trg_markup_updated on markup_rules;
create trigger trg_markup_updated before update on markup_rules
  for each row execute function set_updated_at();

-- ---------- exchange_rates (TRM oficial BanRep; snapshot al crear cotización) ----------
create table if not exists exchange_rates (
  rate_date      date not null,
  base_currency  char(3) not null default 'USD',
  quote_currency char(3) not null default 'COP',
  rate           numeric(16,6) not null,     -- COP por 1 USD
  source         text not null default 'BANREP',
  fetched_at     timestamptz not null default now(),
  primary key (rate_date, base_currency, quote_currency)
);

-- ---------- audit_log ----------
create table if not exists audit_log (
  id            bigint generated always as identity primary key,
  agency_id     uuid references agencies(id) on delete set null,
  actor_user_id uuid references profiles(id) on delete set null,
  action        text not null,
  entity_type   text not null,
  entity_id     text,
  changes       jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists idx_audit_agency on audit_log(agency_id, created_at desc);

commit;
