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
    <div className="min-h-screen flex flex-col bg-navy-900 bg-grid-pattern relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] rounded-full opacity-20 blur-[100px] bg-brand-500 animate-pulse-slow" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full opacity-10 blur-[120px] bg-indigo-500 animate-float" />
        <div className="absolute top-[40%] left-[20%] w-[300px] h-[300px] rounded-full opacity-10 blur-[80px] bg-teal-400" />
      </div>

      <header className="relative z-10 flex items-center gap-3 px-8 py-6">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl overflow-hidden glass-card shadow-sm border border-white/10">
          <Image src="/logocalvaltac.png" alt="Logo" width={36} height={36} className="w-7 h-7 object-contain" />
        </div>
        <span className="text-white font-semibold text-sm tracking-widest uppercase">PrivacyCheck CO</span>
        <span className="text-[10px] text-brand-300 border border-brand-500/30 rounded-full px-2.5 py-0.5 ml-1 bg-brand-900/40 backdrop-blur tracking-widest uppercase">Beta</span>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-4 pb-8">
        <div className="w-full max-w-[440px]">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-brand-900/30 border border-brand-500/20 backdrop-blur rounded-full px-4 py-1.5 mb-6 shadow-[0_0_15px_rgba(20,184,166,0.15)]">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-400" style={{ animation: 'pulse 2s infinite' }} />
              <span className="text-[11px] text-brand-300 font-medium tracking-widest uppercase">Fase de Diseño · Ley 1581 de 2012</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight tracking-tight mb-4 text-glow">
              Autodiagnóstico de<br />Protección de Datos
            </h1>
            <p className="text-slate-400 text-sm md:text-base leading-relaxed font-light">
              Evalúe el cumplimiento de su organización con la Ley 1581
              e identifique brechas en minutos con IA.
            </p>
          </div>

          <div className="glass-card rounded-[2rem] p-8 shadow-floating">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-800/50 border border-white/10 mb-5 overflow-hidden shadow-inner">
                <Image src="/logocalvaltac.png" alt="Logo" width={48} height={48} className="w-10 h-10 object-contain drop-shadow-md" />
              </div>
              <h2 className="text-2xl font-semibold text-white tracking-tight">Iniciar sesión</h2>
              <p className="text-sm text-slate-400 mt-2 font-light">Acceso seguro a la plataforma</p>
            </div>

            <div className="space-y-4">
              <button
                onClick={() => signIn('google')}
                disabled={!!loading}
                className="w-full flex items-center justify-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm font-medium text-slate-200 hover:bg-white/10 hover:border-brand-500/50 hover:text-white hover:shadow-glow active:scale-[0.98] transition-all duration-300 disabled:opacity-50 group"
              >
                {loading === 'google' || loading === 'processing' ? <Spinner /> : <GoogleIcon className="group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)] transition-all" />}
                {loading === 'processing' ? 'Verificando red segura...' : 'Autenticar con Google'}
              </button>

              <button
                onClick={() => signIn('microsoft')}
                disabled={!!loading}
                className="w-full flex items-center justify-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm font-medium text-slate-200 hover:bg-white/10 hover:border-brand-500/50 hover:text-white hover:shadow-glow active:scale-[0.98] transition-all duration-300 disabled:opacity-50 group"
              >
                {loading === 'microsoft' ? <Spinner /> : <MicrosoftIcon className="group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)] transition-all" />}
                Autenticar con Microsoft
              </button>
            </div>

            {error && (
              <p className="mt-5 text-sm text-red-400 bg-red-950/40 border border-red-500/20 backdrop-blur rounded-xl px-4 py-3 text-center">
                {error}
              </p>
            )}

            <div className="flex items-center gap-4 my-8">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
              <span className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">Protocolos</span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
            </div>

            <div className="flex items-center justify-center gap-5">
              <TrustBadge icon={<Lock className="w-3.5 h-3.5" />} label="Cifrado E2E" />
              <TrustBadge icon={<CheckCircle className="w-3.5 h-3.5" />} label="OWASP v4" />
              <TrustBadge icon={<Shield className="w-3.5 h-3.5" />} label="Zero Trust" />
            </div>
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {[
              { icon: <Shield className="w-3.5 h-3.5" />, label: 'Ley 1581 / 2012' },
              { icon: <BarChart2 className="w-3.5 h-3.5" />, label: 'Data Diagnostics' },
              { icon: <Lightbulb className="w-3.5 h-3.5" />, label: 'IA Neural Engine' },
            ].map((f) => (
              <div key={f.label} className="flex items-center gap-2 px-3.5 py-2 rounded-full text-slate-300 text-[11px] uppercase tracking-wider font-medium glass-card border border-white/5 hover:border-brand-500/30 transition-colors">
                <span className="text-brand-400 drop-shadow-[0_0_5px_rgba(45,212,191,0.5)]">{f.icon}</span>
                {f.label}
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="relative z-10 pb-8 pt-4">
        <div className="flex flex-col items-center gap-4">
          <p className="text-slate-500 text-[11px] tracking-widest uppercase font-medium">© 2026 PrivacyCheck CO · Core System</p>
          <div className="flex items-center gap-3 opacity-40 hover:opacity-100 transition-opacity duration-300">
            <span className="text-slate-400 text-[9px] uppercase tracking-[0.2em] font-bold">Powered by</span>
            <Image src="/logocalvaltac.png" alt="Sintaxis TI" width={72} height={72} className="h-6 w-auto brightness-200 contrast-150" />
          </div>
        </div>
      </footer>
    </div>
  );
}

function TrustBadge({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 text-slate-400 text-[10px] uppercase tracking-wider font-medium">
      <span className="text-brand-400">{icon}</span>
      {label}
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4 text-brand-400" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={`w-4 h-4 ${className}`} viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg className={`w-4 h-4 ${className}`} viewBox="0 0 21 21">
      <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
      <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
    </svg>
  );
}
