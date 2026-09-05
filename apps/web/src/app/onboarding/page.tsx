import { redirect } from 'next/navigation';
import { getSessionContext } from '@/lib/auth/session';
import { OnboardingForm } from './form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default async function OnboardingPage() {
  const ctx = await getSessionContext();
  if (!ctx) redirect('/login');
  // Ya tiene agencia (o es super_admin) => al dashboard.
  if (ctx.isPlatformAdmin || ctx.agencyIds.length > 0) redirect('/');

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">Crea tu agencia</CardTitle>
          <CardDescription>
            Un último paso, {ctx.email}. Configura tu agencia para empezar a cotizar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OnboardingForm />
        </CardContent>
      </Card>
    </main>
  );
}
