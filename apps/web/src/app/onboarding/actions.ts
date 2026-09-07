'use server';

import { sql } from 'drizzle-orm';
import { withUser } from '@crm/db';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';

export type OnboardState = { error?: string };

export async function createAgencyAction(
  _prev: OnboardState,
  formData: FormData,
): Promise<OnboardState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect('/login');

  const name = String(formData.get('name') ?? '').trim();
  const initials = String(formData.get('initials') ?? '')
    .trim()
    .toUpperCase();
  const taxId = String(formData.get('tax_id') ?? '').trim() || null;

  if (name.length < 2) return { error: 'El nombre de la agencia es obligatorio.' };
  if (!/^[A-Z0-9]{2,6}$/.test(initials)) {
    return { error: 'Las iniciales deben ser 2 a 6 letras/números (ej: AVM).' };
  }

  try {
    await withUser(userId, (tx) =>
      tx.execute(sql`select onboard_agency(${name}, ${initials}, ${taxId})`),
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('agencies_initials') || msg.includes('duplicate') || msg.includes('unique')) {
      return { error: `Las iniciales "${initials}" ya están en uso. Prueba otras.` };
    }
    return { error: 'No se pudo crear la agencia. Revisa los datos e inténtalo de nuevo.' };
  }

  redirect('/');
}
