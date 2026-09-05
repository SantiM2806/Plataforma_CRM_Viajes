import { createSupabaseServerClient } from '@/lib/supabase/server';

export type Role = 'super_admin' | 'admin_agencia' | 'agente' | 'contable';

export interface Membership {
  agency_id: string | null; // null = alcance de plataforma (solo super_admin)
  role: Role;
}

export interface SessionContext {
  userId: string;
  email: string;
  memberships: Membership[];
  isPlatformAdmin: boolean; // super_admin (dueño del SaaS): ve todas las agencias
  agencyIds: string[]; // agencias concretas a las que pertenece
}

/**
 * Contexto de sesión + tenancy. Lee memberships bajo RLS (el usuario solo ve
 * las suyas). Devuelve null si no hay sesión.
 */
export async function getSessionContext(): Promise<SessionContext | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from('memberships').select('agency_id, role');
  const memberships = (data ?? []) as Membership[];

  return {
    userId: user.id,
    email: user.email ?? '',
    memberships,
    isPlatformAdmin: memberships.some((m) => m.agency_id === null && m.role === 'super_admin'),
    agencyIds: memberships.filter((m) => m.agency_id).map((m) => m.agency_id as string),
  };
}

/**
 * Resuelve la agencia "activa" para un usuario multi-agencia.
 * @param requested id pedido (ej. desde cookie/selector). Se valida contra las membresías.
 */
export function resolveActiveAgencyId(
  ctx: SessionContext,
  requested?: string | null,
): string | null {
  if (requested && ctx.agencyIds.includes(requested)) return requested;
  return ctx.agencyIds[0] ?? null;
}

/** Rol del usuario dentro de una agencia concreta (o null si no es miembro). */
export function roleInAgency(ctx: SessionContext, agencyId: string): Role | null {
  if (ctx.isPlatformAdmin) return 'super_admin';
  const m = ctx.memberships.find((x) => x.agency_id === agencyId);
  return m?.role ?? null;
}
