import 'server-only';
import { and, eq } from 'drizzle-orm';
import { withUser, schema, type Db } from '@travelkit/db';
import { computePrice, type MarkupRule, type PriceContext } from '@travelkit/core';

export interface AgencyPricing {
  bankFeePercent: number;
  rules: MarkupRule[];
}

/** Carga fee bancario + reglas de markup activas de una agencia (bajo RLS). */
export async function loadAgencyPricing(userId: string, agencyId: string): Promise<AgencyPricing> {
  return withUser(userId, async (tx: Db) => {
    const [agency] = await tx
      .select({ bankFeePercent: schema.agencies.bankFeePercent })
      .from(schema.agencies)
      .where(eq(schema.agencies.id, agencyId))
      .limit(1);

    const rules = await tx
      .select()
      .from(schema.markupRules)
      .where(and(eq(schema.markupRules.agencyId, agencyId), eq(schema.markupRules.active, true)));

    return {
      bankFeePercent: Number(agency?.bankFeePercent ?? 0),
      rules: rules.map((r) => ({
        scope: r.scope,
        scopeRef: r.scopeRef,
        calcType: r.calcType,
        value: Number(r.value),
        currency: r.currency,
        active: r.active,
      })),
    };
  });
}

/** Aplica el motor de precios a un costo neto usando la config de la agencia. */
export function priceOption(
  pricing: AgencyPricing,
  netCostUsd: number,
  context: PriceContext,
  trmCopPerUsd?: number | null,
) {
  return computePrice({
    netCostUsd,
    bankFeePercent: pricing.bankFeePercent,
    rules: pricing.rules,
    context,
    trmCopPerUsd: trmCopPerUsd ?? null,
  });
}
