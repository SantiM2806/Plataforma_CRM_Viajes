import Link from 'next/link';
import { FileText, CalendarCheck, MessagesSquare, BarChart3 } from 'lucide-react';
import { getAppContext } from '@/lib/auth/session';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const MODULES = [
  { title: 'Cotizaciones', desc: 'Motor de precios con markups, PDF y propuesta web pública.', icon: FileText, phase: 'Fase 1–2', href: '/quotes' },
  { title: 'Reservas / CRM', desc: 'Seguimiento de reservas asignadas a cada agente.', icon: CalendarCheck, phase: 'Fase 3' },
  { title: 'Inbox omnicanal', desc: 'Telegram y WhatsApp Cloud API, con envío de cotizaciones.', icon: MessagesSquare, phase: 'Fase 4' },
  { title: 'Reportes y conciliación', desc: 'Costo vs. venta vs. markup vs. comisión + datos DIAN.', icon: BarChart3, phase: 'Fase 5' },
];

export default async function DashboardPage() {
  const { ctx, active } = await getAppContext();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {active ? `Hola, ${active.name}` : 'Bienvenido'}
          </h1>
          <p className="text-muted-foreground">
            {ctx.isPlatformAdmin ? 'Vista de plataforma (Super Admin).' : 'Tu panel de trabajo.'}
          </p>
        </div>
        <Button asChild>
          <Link href="/quotes/new">Nueva cotización</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {MODULES.map((m) => {
          const inner = (
            <Card className={m.href ? 'transition-colors hover:border-primary/50' : undefined}>
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
          );
          return m.href ? (
            <Link key={m.title} href={m.href} className="block">
              {inner}
            </Link>
          ) : (
            <div key={m.title}>{inner}</div>
          );
        })}
      </div>
    </div>
  );
}
