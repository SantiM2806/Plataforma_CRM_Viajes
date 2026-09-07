'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { withUser, schema, type Db } from '@crm/db';
import { getSessionContext } from '@/lib/auth/session';

export type ReservationStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

async function requireUser(): Promise<string> {
  const c = await getSessionContext();
  if (!c) throw new Error('No autenticado');
  return c.userId;
}

export async function setReservationStatusAction(
  id: string,
  status: ReservationStatus,
  providerConfirmation?: string,
): Promise<void> {
  const userId = await requireUser();
  await withUser(userId, (tx: Db) =>
    tx
      .update(schema.reservations)
      .set({
        status,
        ...(providerConfirmation !== undefined
          ? { providerConfirmation: providerConfirmation.trim() || null }
          : {}),
      })
      .where(eq(schema.reservations.id, id)),
  );
  revalidatePath('/reservations');
  revalidatePath(`/reservations/${id}`);
}

export async function updateReservationNotesAction(id: string, notes: string): Promise<void> {
  const userId = await requireUser();
  await withUser(userId, (tx: Db) =>
    tx
      .update(schema.reservations)
      .set({ notes: notes.trim() || null })
      .where(eq(schema.reservations.id, id)),
  );
  revalidatePath(`/reservations/${id}`);
}
