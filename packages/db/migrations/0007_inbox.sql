-- ============================================================
-- 0007_inbox.sql
-- Inbox omnicanal: integraciones de canal, conversaciones y mensajes.
-- ============================================================
begin;

do $$ begin
  create type channel_kind as enum ('telegram', 'whatsapp');
exception when duplicate_object then null; end $$;

do $$ begin
  create type message_direction as enum ('inbound', 'outbound');
exception when duplicate_object then null; end $$;

do $$ begin
  create type message_kind as enum ('text', 'quote', 'system');
exception when duplicate_object then null; end $$;

do $$ begin
  create type conversation_status as enum ('open', 'closed');
exception when duplicate_object then null; end $$;

-- ---------- Integraciones por agencia y canal ----------
create table if not exists channel_integrations (
  agency_id  uuid not null references agencies(id) on delete cascade,
  channel    channel_kind not null,
  config     jsonb not null default '{}'::jsonb,   -- telegram:{botToken} whatsapp:{phoneNumberId,accessToken,verifyToken}
  active     boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (agency_id, channel)
);

-- ---------- Conversaciones ----------
create table if not exists conversations (
  id                   uuid primary key default gen_random_uuid(),
  agency_id            uuid not null references agencies(id) on delete cascade,
  channel              channel_kind not null,
  external_id          text not null,                 -- chat_id (telegram) / wa_id (whatsapp)
  contact_name         text,
  contact_handle       text,
  assigned_agent_id    uuid references users(id) on delete set null,
  status               conversation_status not null default 'open',
  last_message_at      timestamptz,
  last_message_preview text,
  unread               boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (agency_id, channel, external_id)
);
create index if not exists idx_conversations_agency on conversations(agency_id, last_message_at desc);
create index if not exists idx_conversations_agent on conversations(assigned_agent_id);
drop trigger if exists trg_conversations_updated on conversations;
create trigger trg_conversations_updated before update on conversations
  for each row execute function set_updated_at();

-- ---------- Mensajes ----------
create table if not exists messages (
  id                  uuid primary key default gen_random_uuid(),
  conversation_id     uuid not null references conversations(id) on delete cascade,
  direction           message_direction not null,
  kind                message_kind not null default 'text',
  body                text,
  quote_id            uuid references quotes(id) on delete set null,
  external_message_id text,
  sender_user_id      uuid references users(id) on delete set null,
  delivered           boolean not null default false,
  created_at          timestamptz not null default now()
);
create index if not exists idx_messages_conversation on messages(conversation_id, created_at);

-- ============================================================
-- RLS
-- ============================================================
alter table channel_integrations enable row level security;
alter table conversations        enable row level security;
alter table messages             enable row level security;

-- channel_integrations: miembros leen (para enviar); admin gestiona.
drop policy if exists ci_select on channel_integrations;
create policy ci_select on channel_integrations for select using (is_member_of(agency_id));
drop policy if exists ci_write on channel_integrations;
create policy ci_write on channel_integrations for all
  using (has_agency_role(agency_id, array['admin_agencia']::app_role[]))
  with check (has_agency_role(agency_id, array['admin_agencia']::app_role[]));

-- conversations: admin/contable ven todas; agente ve las asignadas a él o sin asignar.
drop policy if exists conversations_select on conversations;
create policy conversations_select on conversations for select
  using (
    is_platform_admin()
    or has_agency_role(agency_id, array['admin_agencia','contable']::app_role[])
    or (is_member_of(agency_id) and (assigned_agent_id = app_current_user() or assigned_agent_id is null))
  );

drop policy if exists conversations_write on conversations;
create policy conversations_write on conversations for all
  using (
    has_agency_role(agency_id, array['admin_agencia']::app_role[])
    or (has_agency_role(agency_id, array['agente']::app_role[])
        and (assigned_agent_id = app_current_user() or assigned_agent_id is null))
  )
  with check (
    has_agency_role(agency_id, array['admin_agencia']::app_role[])
    or (has_agency_role(agency_id, array['agente']::app_role[])
        and (assigned_agent_id = app_current_user() or assigned_agent_id is null))
  );

-- messages: heredan el acceso de la conversación.
drop policy if exists messages_select on messages;
create policy messages_select on messages for select
  using (exists (select 1 from conversations c where c.id = conversation_id and (
    is_platform_admin()
    or has_agency_role(c.agency_id, array['admin_agencia','contable']::app_role[])
    or (is_member_of(c.agency_id) and (c.assigned_agent_id = app_current_user() or c.assigned_agent_id is null))
  )));

drop policy if exists messages_write on messages;
create policy messages_write on messages for all
  using (exists (select 1 from conversations c where c.id = conversation_id and (
    has_agency_role(c.agency_id, array['admin_agencia']::app_role[])
    or (has_agency_role(c.agency_id, array['agente']::app_role[])
        and (c.assigned_agent_id = app_current_user() or c.assigned_agent_id is null))
  )))
  with check (exists (select 1 from conversations c where c.id = conversation_id and (
    has_agency_role(c.agency_id, array['admin_agencia']::app_role[])
    or (has_agency_role(c.agency_id, array['agente']::app_role[])
        and (c.assigned_agent_id = app_current_user() or c.assigned_agent_id is null))
  )));

grant select, insert, update, delete on channel_integrations to crm_app;
grant select, insert, update, delete on conversations        to crm_app;
grant select, insert, update, delete on messages             to crm_app;

-- ---------- Ingesta de entrantes (webhooks, sin sesión) ----------
create or replace function ingest_inbound_message(
  p_agency uuid,
  p_channel channel_kind,
  p_external_id text,
  p_contact_name text,
  p_contact_handle text,
  p_body text,
  p_external_message_id text
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_conv uuid;
begin
  insert into conversations (agency_id, channel, external_id, contact_name, contact_handle,
                             last_message_at, last_message_preview, unread)
  values (p_agency, p_channel, p_external_id, p_contact_name, p_contact_handle,
          now(), left(p_body, 140), true)
  on conflict (agency_id, channel, external_id) do update
    set last_message_at = now(),
        last_message_preview = left(p_body, 140),
        unread = true,
        contact_name = coalesce(conversations.contact_name, excluded.contact_name)
  returning id into v_conv;

  insert into messages (conversation_id, direction, kind, body, external_message_id, delivered)
  values (v_conv, 'inbound', 'text', p_body, p_external_message_id, true);

  return v_conv;
end $$;

grant execute on function ingest_inbound_message(uuid, channel_kind, text, text, text, text, text) to crm_app;

commit;
