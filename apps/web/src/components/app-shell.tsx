import type { ReactNode } from 'react';
import {
  LayoutDashboard,
  FileText,
  CalendarCheck,
  MessagesSquare,
  BarChart3,
  Settings,
  Plane,
} from 'lucide-react';
import { AgencySwitcher } from './agency-switcher';
import { SignOutButton } from './signout-button';
import type { AgencyRef, SessionContext } from '@/lib/auth/session';
import { cn } from '@/lib/utils';

const NAV = [
  { label: 'Dashboard', icon: LayoutDashboard, active: true },
  { label: 'Cotizaciones', icon: FileText, soon: true },
  { label: 'Reservas', icon: CalendarCheck, soon: true },
  { label: 'Inbox', icon: MessagesSquare, soon: true },
  { label: 'Reportes', icon: BarChart3, soon: true },
  { label: 'Configuración', icon: Settings, soon: true },
];

export function AppShell({
  ctx,
  agencies,
  activeAgencyId,
  children,
}: {
  ctx: SessionContext;
  agencies: AgencyRef[];
  activeAgencyId: string | null;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[240px_1fr]">
      <aside className="hidden border-r bg-card md:flex md:flex-col">
        <div className="flex h-14 items-center gap-2 border-b px-5">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Plane className="h-4 w-4" />
          </span>
          <span className="font-semibold tracking-tight">Travelkit CRM</span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map((item) => (
            <div
              key={item.label}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium',
                item.active
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground',
                item.soon && 'cursor-not-allowed',
              )}
            >
              <item.icon className="h-4 w-4" />
              <span className="flex-1">{item.label}</span>
              {item.soon && (
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  Pronto
                </span>
              )}
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex flex-col">
        <header className="flex h-14 items-center justify-between border-b bg-card px-4 md:px-6">
          <div className="flex items-center gap-3">
            <AgencySwitcher agencies={agencies} activeId={activeAgencyId} />
            {ctx.isPlatformAdmin && (
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                Super Admin
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">{ctx.email}</span>
            <SignOutButton />
          </div>
        </header>
        <main className="flex-1 bg-muted/30 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
