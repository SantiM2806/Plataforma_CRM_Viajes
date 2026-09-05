'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await signIn('credentials', { email, password, redirect: false });
    if (res?.error) setError('Credenciales inválidas');
    else window.location.href = '/';
  }

  return (
    <main style={{ padding: 32, maxWidth: 380, margin: '0 auto' }}>
      <h1>Iniciar sesión</h1>

      <button
        onClick={() => signIn('google', { callbackUrl: '/' })}
        style={{ width: '100%', padding: 10, marginBottom: 16 }}
      >
        Continuar con Google
      </button>

      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 8 }}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ padding: 8 }}
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ padding: 8 }}
        />
        <button type="submit" style={{ padding: 10 }}>
          Entrar
        </button>
      </form>

      {error && <p style={{ color: 'crimson' }}>{error}</p>}
    </main>
  );
}
