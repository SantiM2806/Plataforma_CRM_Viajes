import { asc, eq } from 'drizzle-orm';
import { getActiveContext } from '@/lib/auth/session';
import { withUser, schema } from '@travelkit/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PricingForm } from './pricing-form';
import { RulesManager } from './rules-manager';

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
    </div>
  );
}
