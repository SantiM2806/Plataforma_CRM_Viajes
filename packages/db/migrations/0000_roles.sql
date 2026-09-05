-- ============================================================
-- 0000_roles.sql
-- Rol de RUNTIME de la app: NO propietario, NO superusuario => RLS SÍ aplica.
-- Las migraciones se corren con un rol admin/owner (BYPASSRLS) para que las
-- funciones SECURITY DEFINER puedan leer memberships sin recursión de RLS.
-- ============================================================
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'crm_app') then
    create role crm_app login password 'change_me_dev';   -- CAMBIAR en producción
  end if;
end $$;
