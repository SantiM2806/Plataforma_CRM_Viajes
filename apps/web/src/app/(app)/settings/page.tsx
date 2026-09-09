import { asc, eq } from 'drizzle-orm';
import { getActiveContext, getSessionContext } from '@/lib/auth/session';
import { withUser, schema } from '@crm/db';
import { PricingForm } from './pricing-form';
import { RulesManager } from './rules-manager';
import { ChannelsManager } from './channels';
import { UsersManager } from './users';
import { AccountCard } from './account';

export default async function SettingsPage() {
  const { userId, agencyId, isAdmin } = await getActiveContext();
  const session = await getSessionContext();

  // Datos de admin (precios, canales, equipo)
  let adminData: {
    bankFeePercent: number;
    quoteValidityDays: number;
    rules: Array<{ id: string; scope: any; scopeRef: string | null; calcType: any; value: number; currency: string; active: boolean }>;
    tg: { active: boolean; config: Record<string, string> } | null;
    wa: { active: boolean; config: Record<string, string> } | null;
    members: Array<{ id: string; role: any; email: string; name: string | null; isSelf: boolean }>;
    baseUrl: string;
  } | null = null;

  if (isAdmin) {
    const [agency] = await withUser(userId, (tx) =>
      tx
        .select({
          bankFeePercent: schema.agencies.bankFeePercent,
          quoteValidityDays: schema.agencies.quoteValidityDays,
        })
        .from(schema.agencies)
        .where(eq(schema.agencies.id, agencyId))
        .limit(1),
    );
    const rules = await withUser(userId, (tx) =>
      tx
        .select()
        .from(schema.markupRules)
        .where(eq(schema.markupRules.agencyId, agencyId))
        .orderBy(asc(schema.markupRules.scope), asc(schema.markupRules.priority)),
    );
    const integrations = await withUser(userId, (tx) =>
      tx.select().from(schema.channelIntegrations).where(eq(schema.channelIntegrations.agencyId, agencyId)),
    );
    const memberRows = await withUser(userId, (tx) =>
      tx
        .select({
          id: schema.memberships.id,
          role: schema.memberships.role,
          uid: schema.memberships.userId,
          email: schema.users.email,
          name: schema.users.name,
        })
        .from(schema.memberships)
        .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
        .where(eq(schema.memberships.agencyId, agencyId))
        .orderBy(asc(schema.memberships.role)),
    );
    const tg = integrations.find((i) => i.channel === 'telegram');
    const wa = integrations.find((i) => i.channel === 'whatsapp');

    adminData = {
      bankFeePercent: Number(agency?.bankFeePercent ?? 3),
      quoteValidityDays: agency?.quoteValidityDays ?? 7,
      rules: rules.map((r) => ({
        id: r.id,
        scope: r.scope,
        scopeRef: r.scopeRef,
        calcType: r.calcType,
        value: Number(r.value),
        currency: r.currency,
        active: r.active,
      })),
      tg: tg ? { active: tg.active, config: tg.config as Record<string, string> } : null,
      wa: wa ? { active: wa.active, config: wa.config as Record<string, string> } : null,
      members: memberRows.map((m) => ({
        id: m.id,
        role: m.role,
        email: m.email,
        name: m.name,
        isSelf: m.uid === userId,
      })),
      baseUrl: process.env.APP_BASE_URL ?? process.env.AUTH_URL ?? 'http://localhost:3000',
    };
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground">Tu cuenta{isAdmin ? ', precios, equipo y canales' : ''}.</p>
      </div>

      <AccountCard email={session?.email ?? ''} mustChange={session?.mustChangePassword ?? false} />

      {adminData && (
        <>
          <PricingForm bankFeePercent={adminData.bankFeePercent} quoteValidityDays={adminData.quoteValidityDays} />
          <RulesManager rules={adminData.rules} />
          <UsersManager members={adminData.members} />
          <div>
            <h2 className="mb-1 text-lg font-semibold tracking-tight">Canales de mensajería</h2>
            <p className="mb-3 text-sm text-muted-foreground">Conecta Telegram (MVP) o WhatsApp Cloud API para el Inbox.</p>
            <ChannelsManager
              agencyId={agencyId}
              baseUrl={adminData.baseUrl}
              telegram={adminData.tg}
              whatsapp={adminData.wa}
            />
          </div>
        </>
      )}
    </div>
  );
}
