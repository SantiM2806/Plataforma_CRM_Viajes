import NextAuth from 'next-auth';
import { authConfig } from './auth.config';

// El middleware corre en el edge => usa authConfig (sin argon2). El callback
// `authorized` de authConfig protege las rutas privadas.
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
