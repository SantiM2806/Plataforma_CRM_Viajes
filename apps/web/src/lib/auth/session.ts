import { auth } from '@/auth';
import { withUser, schema } from '@travelkit/db';

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
  agencyIds: string[];
}

/**
 * Contexto de sesión + tenancy. Lee memberships bajo RLS vía withUser()
 * (el usuario solo ve las suyas). Devuelve null si no hay sesión.
 */
export async function getSessionContext(): Promise<SessionContext | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const rows = await withUser(userId, (tx) =>
    tx
      .select({ agency_id: schema.memberships.agencyId, role: schema.memberships.role })
      .from(schema.memberships),
  );
  const memberships = rows as Membership[];

  return {
    userId,
    email: session.user?.email ?? '',
    memberships,
    isPlatformAdmin: memberships.some((m) => m.agency_id === null && m.role === 'super_admin'),
    agencyIds: memberships.filter((m) => m.agency_id).map((m) => m.agency_id as string),
  };
}

/** Resuelve la agencia "activa" para un usuario multi-agencia. */
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
