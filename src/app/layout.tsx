import type { Metadata } from 'next';
import './globals.css';
import SplashScreen from '@/components/SplashScreen';

export const metadata: Metadata = {
  title: 'PrivacyCheck CO · Autodiagnóstico Ley 1581',
  description: 'Evalúa el cumplimiento de tu organización con la Ley 1581 de 2012. Herramienta gratuita con IA para PYMES colombianas. Desarrollado para CAVALTEC · Sintaxis TI.',
  icons: {
    icon: '/logocalvaltac.png',
    shortcut: '/logocalvaltac.png',
    apple: '/logocalvaltac.png',
  },
  openGraph: {
    title: 'PrivacyCheck CO · Autodiagnóstico Ley 1581',
    description: 'Evalúa el cumplimiento de tu organización con la Ley 1581 de 2012. Herramienta gratuita con IA para PYMES colombianas.',
    images: [{ url: '/logocalvaltac.png', width: 400, height: 400, alt: 'PrivacyCheck CO' }],
    type: 'website',
  },
  twitter: {
    card: 'summary',
    images: ['/logocalvaltac.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CO">
      <body>
        <SplashScreen />
        {children}
      </body>
    </html>
  );
}
