'use client';

import { auth } from '@/lib/firebase/client';
import {
  GoogleAuthProvider,
  OAuthProvider,
  signInWithRedirect,
  getRedirectResult,
} from 'firebase/auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Lock, BarChart2, Lightbulb, CheckCircle, Shield } from 'lucide-react';

export default function LoginContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [loading, setLoading] = useState<string | null>('processing');
  const [error, setError] = useState('');

  useEffect(() => {
    getRedirectResult(auth)
      .then(async (result) => {
        if (!result) return;
        const idToken = await result.user.getIdToken();
        const res = await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        });
        if (!res.ok) throw new Error('Error al iniciar sesión');
        const next = params.get('next') ?? '/dashboard';
        router.push(next);
        router.refresh();
      })
      .catch((err: any) => {
        const msg: string = err?.message ?? '';
        if (!msg.includes('no-redirect-user') && !msg.includes('No redirect')) {
          setError(msg || 'Error al iniciar sesión. Intenta de nuevo.');
        }
      })
      .finally(() => setLoading(null));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signIn(provider: 'google' | 'microsoft') {
    setLoading(provider);
    setError('');
    try {
      const authProvider =
        provider === 'google'
          ? new GoogleAuthProvider()
          : (() => {
              const p = new OAuthProvider('microsoft.com');
              p.setCustomParameters({ prompt: 'select_account' });
              return p;
            })();
      await signInWithRedirect(auth, authProvider);
    } catch (err: any) {
      setError(err.message ?? 'Error al iniciar sesión. Intenta de nuevo.');
      setLoading(null);
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #f8faff 0%, #ffffff 50%, #eef4ff 100%)' }}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full opacity-30 blur-3xl" style={{ background: 'radial-gradient(circle, #dbeafe, transparent)' }} />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full opacity-20 blur-3xl" style={{ background: 'radial-gradient(circle, #ede9fe, transparent)' }} />
        <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: 'linear-gradient(#1e40af 1px,transparent 1px),linear-gradient(90deg,#1e40af 1px,transparent 1px)', backgroundSize: '40px 40px' }} />
      </div>

      <header className="relative z-10 flex items-center gap-3 px-8 py-6">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl overflow-hidden bg-white shadow-sm border border-gray-100">
          <Image src="/logocalvaltac.png" alt="Logo" width={36} height={36} className="w-7 h-7 object-contain" />
        </div>
        <span className="text-gray-800 font-semibold text-sm tracking-tight">PrivacyCheck CO</span>
        <span className="text-xs text-gray-400 border border-gray-200 rounded-full px-2 py-0.5 ml-1 bg-white/80">Beta</span>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-4 pb-8">
        <div className="w-full max-w-[440px]">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-full px-3 py-1.5 mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" style={{ animation: 'pulse 2s infinite' }} />
              <span className="text-xs text-blue-700 font-medium">Fase de Diseño · Ley 1581 de 2012</span>
            </div>
            <h1 className="text-4xl font-bold text-gray-900 leading-tight tracking-tight mb-3">
              Autodiagnóstico de<br />Protección de Datos
            </h1>
            <p className="text-gray-500 text-base leading-relaxed">
              Evalúe el cumplimiento de su organización con la Ley 1581
              e identifique brechas en minutos.
            </p>
          </div>

          <div className="bg-white rounded-3xl p-8" style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.10)', border: '1px solid #f1f5f9' }}>
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 mb-4 overflow-hidden">
                <Image src="/logocalvaltac.png" alt="Logo" width={48} height={48} className="w-10 h-10 object-contain" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 tracking-tight">Iniciar sesión</h2>
              <p className="text-sm text-gray-400 mt-1">Acceda con su cuenta corporativa</p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => signIn('google')}
                disabled={!!loading}
                className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-blue-200 hover:shadow-sm active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {loading === 'google' || loading === 'processing' ? <Spinner /> : <GoogleIcon />}
                {loading === 'processing' ? 'Verificando...' : 'Continuar con Google'}
              </button>

              <button
                onClick={() => signIn('microsoft')}
                disabled={!!loading}
                className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-blue-200 hover:shadow-sm active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {loading === 'microsoft' ? <Spinner /> : <MicrosoftIcon />}
                Continuar con Microsoft
              </button>
            </div>

            {error && (
              <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                {error}
              </p>
            )}

            <div className="flex items-center gap-3 my-5">
              <div className="h-px flex-1 bg-gray-100" />
              <span className="text-xs text-gray-300">seguro</span>
              <div className="h-px flex-1 bg-gray-100" />
            </div>

            <div className="flex items-center justify-center gap-4">
              <TrustBadge icon={<Lock className="w-3 h-3" />} label="Cifrado en tránsito" />
              <TrustBadge icon={<CheckCircle className="w-3 h-3" />} label="OWASP compliant" />
              <TrustBadge icon={<BarChart2 className="w-3 h-3" />} label="Sin tracking" />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {[
              { icon: <Shield className="w-3.5 h-3.5" />, label: 'Ley 1581 / 2012' },
              { icon: <BarChart2 className="w-3.5 h-3.5" />, label: 'Diagnóstico instantáneo' },
              { icon: <Lightbulb className="w-3.5 h-3.5" />, label: 'Recomendaciones con IA' },
              { icon: <CheckCircle className="w-3.5 h-3.5" />, label: 'Multi-empresa' },
            ].map((f) => (
              <div key={f.label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-gray-600 text-xs font-medium bg-white border border-gray-200 shadow-sm">
                <span className="text-blue-500">{f.icon}</span>
                {f.label}
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="relative z-10 pb-8">
        <div className="flex flex-col items-center gap-3">
          <p className="text-gray-400 text-xs">© 2026 PrivacyCheck CO · Cumplimiento Ley 1581 de 2012</p>
          <div className="flex items-center gap-2 opacity-50 hover:opacity-80 transition-opacity">
            <span className="text-gray-400 text-[10px] uppercase tracking-widest font-medium">Desarrollado para</span>
            <Image src="/logocalvaltac.png" alt="Sintaxis TI" width={72} height={72} className="h-7 w-auto" />
          </div>
        </div>
      </footer>
    </div>
  );
}

function TrustBadge({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1 text-gray-400 text-[11px]">
      <span className="text-green-500">{icon}</span>
      {label}
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 21 21">
      <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
      <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
    </svg>
  );
}
