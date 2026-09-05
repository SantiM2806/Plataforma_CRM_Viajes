import type { ReactNode } from 'react';

export const metadata = {
  title: 'Travelkit CRM',
  description: 'CRM/CX para agencias de viajes',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>{children}</body>
    </html>
  );
}
