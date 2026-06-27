import type { Metadata } from 'next';
import './globals.css';
import SplashScreen from '@/components/SplashScreen';
import AccessibilityWidget from '@/components/AccessibilityWidget';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://privacycheck-co.vercel.app'),
  title: 'PrivacyCheck CO · Autodiagnóstico Ley 1581',
  description: 'Evalúa el cumplimiento de tu organización con la Ley 1581 de 2012. Herramienta gratuita con IA para PYMES colombianas. Desarrollado para CAVALTEC · Sintaxis TI.',
  icons: {
    icon: '/icon-cavaltec.png',
    shortcut: '/icon-cavaltec.png',
    apple: '/icon-cavaltec.png',
  },
  openGraph: {
    title: 'PrivacyCheck CO · Autodiagnóstico Ley 1581',
    description: 'Evalúa el cumplimiento de tu organización con la Ley 1581 de 2012. Herramienta gratuita con IA para PYMES colombianas.',
    images: [{ url: '/logo-cavaltec.jpeg', width: 400, height: 400, alt: 'PrivacyCheck CO' }],
    type: 'website',
  },
  twitter: {
    card: 'summary',
    images: ['/logo-cavaltec.jpeg'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CO">
      <body>
        <a href="#contenido-principal" className="skip-link">Saltar al contenido principal</a>
        <SplashScreen />
        {children}
        <AccessibilityWidget />
      </body>
    </html>
  );
}
