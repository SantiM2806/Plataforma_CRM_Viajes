'use server';

import { hash } from '@node-rs/argon2';
import { eq } from 'drizzle-orm';
import { db, schema } from '@crm/db';
import { signIn } from '@/auth';

export type RegisterState = { error?: string };

export async function registerAction(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const password = String(formData.get('password') ?? '');

  if (!email.includes('@') || password.length < 8) {
    return { error: 'Ingresa un email válido y una contraseña de 8+ caracteres.' };
  }

  const [existing] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);
  if (existing) return { error: 'Ese email ya está registrado.' };

  const passwordHash = await hash(password);
  await db.insert(schema.users).values({ name: name || null, email, passwordHash });

  // Inicia sesión y manda al onboarding (crear su agencia).
  await signIn('credentials', { email, password, redirectTo: '/onboarding' });
  return {};
}
