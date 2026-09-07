import { asc, eq } from 'drizzle-orm';
import { getActiveContext } from '@/lib/auth/session';
import { withUser, schema } from '@crm/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PricingForm } from './pricing-form';
import { RulesManager } from './rules-manager';
import { ChannelsManager } from './channels';

export default async function SettingsPage() {
  const { userId, agencyId, isAdmin } = await getActiveContext();

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Configuración</CardTitle>
            <CardDescription>Solo el administrador de la agencia puede editar la configuración de precios.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

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
    tx
      .select()
      .from(schema.channelIntegrations)
      .where(eq(schema.channelIntegrations.agencyId, agencyId)),
  );
  const tg = integrations.find((i) => i.channel === 'telegram');
  const wa = integrations.find((i) => i.channel === 'whatsapp');
  const baseUrl = process.env.APP_BASE_URL ?? process.env.AUTH_URL ?? 'http://localhost:3000';

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configuración de precios</h1>
        <p className="text-muted-foreground">Fee bancario, validez y reglas de markup de tu agencia.</p>
      </div>

      <PricingForm
        bankFeePercent={Number(agency?.bankFeePercent ?? 3)}
        quoteValidityDays={agency?.quoteValidityDays ?? 7}
      />

      <RulesManager
        rules={rules.map((r) => ({
          id: r.id,
          scope: r.scope,
          scopeRef: r.scopeRef,
          calcType: r.calcType,
          value: Number(r.value),
          currency: r.currency,
          active: r.active,
        }))}
      />

      <div>
        <h2 className="mb-1 text-lg font-semibold tracking-tight">Canales de mensajería</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Conecta Telegram (MVP) o WhatsApp Cloud API para el Inbox.
        </p>
        <ChannelsManager
          agencyId={agencyId}
          baseUrl={baseUrl}
          telegram={tg ? { active: tg.active, config: tg.config as Record<string, string> } : null}
          whatsapp={wa ? { active: wa.active, config: wa.config as Record<string, string> } : null}
        />
      </div>
    </div>
  );
}
