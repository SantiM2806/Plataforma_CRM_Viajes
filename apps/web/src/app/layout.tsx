import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'Travelkit CRM',
  description: 'CRM/CX para agencias de viajes',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
