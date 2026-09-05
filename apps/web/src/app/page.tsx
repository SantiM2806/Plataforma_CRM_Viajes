import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { FileText, CalendarCheck, MessagesSquare, BarChart3 } from 'lucide-react';
import { getSessionContext, getUserAgencies } from '@/lib/auth/session';
import { AppShell } from '@/components/app-shell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const MODULES = [
  {
    title: 'Cotizaciones',
    desc: 'Motor de precios con markups, PDF y propuesta web pública para el cliente.',
    icon: FileText,
    phase: 'Fase 1–2',
  },
  {
    title: 'Reservas / CRM',
    desc: 'Seguimiento de reservas asignadas a cada agente de viajes.',
    icon: CalendarCheck,
    phase: 'Fase 3',
  },
  {
    title: 'Inbox omnicanal',
    desc: 'Telegram y WhatsApp Cloud API, con envío de cotizaciones en el chat.',
    icon: MessagesSquare,
    phase: 'Fase 4',
  },
  {
    title: 'Reportes y conciliación',
    desc: 'Costo vs. venta vs. markup vs. comisión + datos base para DIAN.',
    icon: BarChart3,
    phase: 'Fase 5',
  },
];

export default async function HomePage() {
  const ctx = await getSessionContext();
  if (!ctx) redirect('/login');
  if (!ctx.isPlatformAdmin && ctx.agencyIds.length === 0) redirect('/onboarding');

  const agencies = await getUserAgencies(ctx.userId);
  const store = await cookies();
  const requested = store.get('active_agency')?.value;
  const active = agencies.find((a) => a.id === requested) ?? agencies[0] ?? null;

  return (
    <AppShell ctx={ctx} agencies={agencies} activeAgencyId={active?.id ?? null}>
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {active ? `Hola, ${active.name}` : 'Bienvenido'}
          </h1>
          <p className="text-muted-foreground">
            {ctx.isPlatformAdmin ? 'Vista de plataforma (Super Admin).' : 'Tu panel de trabajo.'}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Fundaciones listas ✅</CardTitle>
            <CardDescription>
              Autenticación, multi-tenant con RLS, roles y consecutivos ya operativos. Los módulos
              del negocio se habilitan por fases.
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          {MODULES.map((m) => (
            <Card key={m.title}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-accent-foreground">
                    <m.icon className="h-4 w-4" />
                  </span>
                  <div>
                    <CardTitle className="text-base">{m.title}</CardTitle>
                    <span className="text-xs font-medium text-primary">{m.phase}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{m.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
