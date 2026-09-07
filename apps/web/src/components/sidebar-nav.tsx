'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  CalendarCheck,
  MessagesSquare,
  BarChart3,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  icon: LucideIcon;
  href?: string;
  soon?: boolean;
}

const NAV: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/' },
  { label: 'Cotizaciones', icon: FileText, href: '/quotes' },
  { label: 'Reservas', icon: CalendarCheck, href: '/reservations' },
  { label: 'Inbox', icon: MessagesSquare, soon: true },
  { label: 'Reportes', icon: BarChart3, soon: true },
  { label: 'Configuración', icon: Settings, href: '/settings' },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex-1 space-y-1 p-3">
      {NAV.map((item) => {
        const active =
          item.href && (item.href === '/' ? pathname === '/' : pathname.startsWith(item.href));
        const base = 'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors';

        if (item.soon || !item.href) {
          return (
            <div key={item.label} className={cn(base, 'cursor-not-allowed text-muted-foreground')}>
              <item.icon className="h-4 w-4" />
              <span className="flex-1">{item.label}</span>
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                Pronto
              </span>
            </div>
          );
        }

        return (
          <Link
            key={item.label}
            href={item.href}
            className={cn(
              base,
              active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted',
            )}
          >
            <item.icon className="h-4 w-4" />
            <span className="flex-1">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
