'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

/** Cambia la agencia activa (usuarios multi-agencia). Guarda cookie y recarga. */
export async function setActiveAgency(formData: FormData) {
  const id = String(formData.get('agencyId') ?? '');
  const store = await cookies();
  store.set('active_agency', id, { path: '/', sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 });
  redirect('/');
}
