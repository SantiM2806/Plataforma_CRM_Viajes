import type { NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';

// Rutas públicas. '/p/' = propuestas web públicas para clientes.
const PUBLIC_PREFIXES = ['/login', '/register', '/api/auth', '/p/'];

/**
 * Config base compartida entre el middleware (edge) y el runtime Node.
 * NO incluye Credentials/argon2 aquí porque el middleware corre en el edge.
 */
export const authConfig = {
  pages: { signIn: '/login' },
  providers: [Google], // Credentials se añade en auth.ts (solo Node)
  callbacks: {
    authorized({ request, auth }) {
      const path = request.nextUrl.pathname;
      const isPublic = PUBLIC_PREFIXES.some((p) => path.startsWith(p));
      if (isPublic) return true;
      return !!auth?.user;
    },
    jwt({ token, user }) {
      if (user) token.uid = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.uid && session.user) session.user.id = token.uid as string;
      return session;
    },
  },
} satisfies NextAuthConfig;
