import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PrivacyCheck CO · Autodiagnóstico Ley 1581',
  description: 'Evalúa el cumplimiento de tu organización con la Ley 1581 de 2012 (Protección de datos personales – Privacy by Design). Desarrollado para CAVALTEC · Sintaxis TI.',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CO">
      <body>{children}</body>
    </html>
  );
}
