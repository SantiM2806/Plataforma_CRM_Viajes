import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { verify } from '@node-rs/argon2';
import { eq } from 'drizzle-orm';
import { db, schema } from '@travelkit/db';
import { authConfig } from './auth.config';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db, {
    usersTable: schema.users,
    accountsTable: schema.accounts,
    sessionsTable: schema.sessions,
    verificationTokensTable: schema.verificationTokens,
  }),
  session: { strategy: 'jwt' },
  providers: [
    // Vincula la cuenta Google con un usuario existente que tenga el mismo email.
    Google({ allowDangerousEmailAccountLinking: true }),
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(creds) {
        const email = typeof creds?.email === 'string' ? creds.email.trim() : '';
        const password = typeof creds?.password === 'string' ? creds.password : '';
        if (!email || !password) return null;

        const [u] = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.email, email))
          .limit(1);

        if (!u?.passwordHash) return null;
        const ok = await verify(u.passwordHash, password);
        return ok ? { id: u.id, email: u.email, name: u.name ?? undefined } : null;
      },
    }),
  ],
});
