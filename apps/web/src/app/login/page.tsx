// Placeholder de login. En el bloque 2: formulario email/password + botón
// "Continuar con Google" (OAuth) usando createSupabaseBrowserClient(), y el
// flujo de onboarding que llama a la RPC onboard_agency().
export default function LoginPage() {
  return (
    <main style={{ padding: 32, maxWidth: 420 }}>
      <h1>Iniciar sesión</h1>
      <p>Google Workspace y email/password se conectan en el siguiente bloque.</p>
    </main>
  );
}
