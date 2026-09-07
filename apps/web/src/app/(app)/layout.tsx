import type { ReactNode } from 'react';
import { getAppContext } from '@/lib/auth/session';
import { AppShell } from '@/components/app-shell';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { ctx, agencies, active } = await getAppContext();
  return (
    <AppShell ctx={ctx} agencies={agencies} activeAgencyId={active?.id ?? null}>
      {children}
    </AppShell>
  );
}
