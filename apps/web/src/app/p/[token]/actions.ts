'use server';

import { sql } from 'drizzle-orm';
import { db } from '@travelkit/db';

const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

/**
 * El cliente (con el link/token) aprueba una opción o rechaza la cotización.
 * Usa la RPC SECURITY DEFINER decide_public_quote (valida token, estado y vigencia).
 */
export async function decideAction(
  token: string,
  optionId: string | null,
  decision: 'approve' | 'reject',
): Promise<{ error?: string }> {
  try {
    const opt = optionId ?? ZERO_UUID;
    await db.execute(sql`select decide_public_quote(${token}, ${opt}::uuid, ${decision})`);
    return {};
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al procesar la decisión.';
    return { error: msg.replace(/^.*:\s*/, '') };
  }
}
