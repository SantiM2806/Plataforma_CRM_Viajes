-- ============================================================
-- 0009_users_mgmt.sql
-- Gestión de usuarios: contraseña temporal que el usuario debe cambiar.
-- ============================================================
begin;

alter table users add column if not exists must_change_password boolean not null default false;

commit;
