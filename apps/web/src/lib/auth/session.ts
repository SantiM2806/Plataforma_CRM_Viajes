import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
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

export interface AgencyRef {
  id: string;
  name: string;
  initials: string;
}

/** Agencias visibles para el usuario (bajo RLS: las suyas; super_admin: todas). */
export async function getUserAgencies(userId: string): Promise<AgencyRef[]> {
  return withUser(userId, (tx) =>
    tx
      .select({
        id: schema.agencies.id,
        name: schema.agencies.name,
        initials: schema.agencies.initials,
      })
      .from(schema.agencies)
      .orderBy(schema.agencies.name),
  );
}

export interface AppContext {
  ctx: SessionContext;
  agencies: AgencyRef[];
  active: AgencyRef | null;
}

/**
 * Contexto para las páginas autenticadas del grupo (app): sesión + agencias +
 * agencia activa (por cookie). Redirige a /login o /onboarding según falte.
 */
export async function getAppContext(): Promise<AppContext> {
  const ctx = await getSessionContext();
  if (!ctx) redirect('/login');
  if (!ctx.isPlatformAdmin && ctx.agencyIds.length === 0) redirect('/onboarding');

  const agencies = await getUserAgencies(ctx.userId);
  const store = await cookies();
  const requested = store.get('active_agency')?.value;
  const active = agencies.find((a) => a.id === requested) ?? agencies[0] ?? null;
  return { ctx, agencies, active };
}

/** Usuario + agencia activa + si es admin de esa agencia. Para acciones/páginas. */
export async function getActiveContext(): Promise<{
  userId: string;
  agencyId: string;
  isAdmin: boolean;
}> {
  const { ctx, active } = await getAppContext();
  if (!active) redirect('/onboarding');
  const role = roleInAgency(ctx, active.id);
  return {
    userId: ctx.userId,
    agencyId: active.id,
    isAdmin: ctx.isPlatformAdmin || role === 'admin_agencia',
  };
}
