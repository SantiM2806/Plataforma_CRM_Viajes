'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { withUser, schema, type Db } from '@travelkit/db';
import { getActiveContext } from '@/lib/auth/session';

export type ActionState = { error?: string; ok?: boolean };

async function requireAdmin() {
  const c = await getActiveContext();
  if (!c.isAdmin) throw new Error('No autorizado: solo el admin de la agencia.');
  return c;
}

export async function updateAgencyPricingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const { userId, agencyId } = await requireAdmin();
    const bankFee = Number(formData.get('bankFeePercent'));
    const validity = parseInt(String(formData.get('quoteValidityDays')), 10);
    if (!Number.isFinite(bankFee) || bankFee < 0 || bankFee > 100) {
      return { error: 'Fee bancario inválido (0–100%).' };
    }
    if (!Number.isFinite(validity) || validity < 1 || validity > 365) {
      return { error: 'Validez inválida (1–365 días).' };
    }
    await withUser(userId, (tx: Db) =>
      tx
        .update(schema.agencies)
        .set({ bankFeePercent: bankFee.toFixed(3), quoteValidityDays: validity })
        .where(eq(schema.agencies.id, agencyId)),
    );
    revalidatePath('/settings');
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error al guardar.' };
  }
}

export async function addMarkupRuleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const { userId, agencyId } = await requireAdmin();
    const scope = String(formData.get('scope')) as
      | 'agency_default'
      | 'provider'
      | 'product_type'
      | 'product';
    const scopeRefRaw = String(formData.get('scopeRef') ?? '').trim();
    const calcType = String(formData.get('calcType')) as 'percent' | 'fixed';
    const value = Number(formData.get('value'));
    const currency = String(formData.get('currency') ?? 'USD').toUpperCase();

    if (!['agency_default', 'provider', 'product_type', 'product'].includes(scope)) {
      return { error: 'Alcance inválido.' };
    }
    if (scope !== 'agency_default' && !scopeRefRaw) {
      return { error: 'Indica el proveedor/producto para ese alcance.' };
    }
    if (!Number.isFinite(value) || value < 0) return { error: 'Valor inválido.' };

    await withUser(userId, (tx: Db) =>
      tx.insert(schema.markupRules).values({
        agencyId,
        scope,
        scopeRef: scope === 'agency_default' ? null : scopeRefRaw,
        calcType,
        value: value.toFixed(4),
        currency: currency.slice(0, 3),
        createdBy: userId,
      }),
    );
    revalidatePath('/settings');
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error al crear la regla.' };
  }
}

export async function deleteMarkupRuleAction(ruleId: string): Promise<void> {
  const { userId } = await requireAdmin();
  await withUser(userId, (tx: Db) =>
    tx.delete(schema.markupRules).where(eq(schema.markupRules.id, ruleId)),
  );
  revalidatePath('/settings');
}

export async function toggleMarkupRuleAction(ruleId: string, active: boolean): Promise<void> {
  const { userId, agencyId } = await requireAdmin();
  await withUser(userId, (tx: Db) =>
    tx
      .update(schema.markupRules)
      .set({ active })
      .where(and(eq(schema.markupRules.id, ruleId), eq(schema.markupRules.agencyId, agencyId))),
  );
  revalidatePath('/settings');
}
