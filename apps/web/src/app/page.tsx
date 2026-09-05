import { getSessionContext } from '@/lib/auth/session';

// Ruta protegida por el middleware. Aquí solo verificamos que el contexto de
// tenancy carga bien. La UI real (dashboard, shadcn/ui) llega en el bloque 2.
export default async function HomePage() {
  const ctx = await getSessionContext();

  return (
    <main style={{ padding: 32, maxWidth: 720 }}>
      <h1>Travelkit CRM</h1>
      {ctx ? (
        <>
          <p>
            Sesión activa: <strong>{ctx.email}</strong>
          </p>
          <p>
            Alcance: {ctx.isPlatformAdmin ? 'Super Admin (plataforma) · ' : ''}
            {ctx.agencyIds.length} agencia(s) · {ctx.memberships.length} membresía(s)
          </p>
          <pre style={{ background: '#f4f4f5', padding: 12, borderRadius: 8 }}>
            {JSON.stringify(ctx.memberships, null, 2)}
          </pre>
        </>
      ) : (
        <p>Sin sesión.</p>
      )}
    </main>
  );
}
