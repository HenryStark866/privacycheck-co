'use client';

import { auth } from '@/lib/firebase/client';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  type User,
} from 'firebase/auth';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import Image from 'next/image';
import { Lock, CheckCircle, Shield, BarChart2, Lightbulb, Mail, User as UserIcon, ArrowRight, LogIn, UserPlus } from 'lucide-react';
import CartoonBackground from '@/components/CartoonBackground';

type Mode = 'login' | 'register';

/** Traduce los códigos de error de Firebase Auth a mensajes claros en español. */
function friendlyError(code: string, fallback: string): string {
  switch (code) {
    case 'auth/invalid-email':         return 'El correo electrónico no es válido.';
    case 'auth/user-disabled':         return 'Esta cuenta está deshabilitada.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':    return 'Correo o contraseña incorrectos.';
    case 'auth/email-already-in-use':  return 'Ya existe una cuenta con este correo. Inicia sesión.';
    case 'auth/weak-password':         return 'La contraseña debe tener al menos 6 caracteres.';
    case 'auth/too-many-requests':     return 'Demasiados intentos. Espera un momento e intenta de nuevo.';
    case 'auth/network-request-failed':return 'Error de red. Verifica tu conexión.';
    case 'auth/operation-not-allowed': return 'El método de acceso no está habilitado. Contacta al administrador.';
    default:                           return fallback || 'Ocurrió un error. Intenta de nuevo.';
  }
}

export default function LoginContent() {
  const params = useSearchParams();
  const [mode, setMode]         = useState<Mode>('login');
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [notice, setNotice]     = useState('');

  /** Intercambia el idToken por la session cookie del servidor y navega. */
  async function completeSignIn(user: User) {
    const idToken = await user.getIdToken(true);
    const res = await fetch('/api/auth/session', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ idToken }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || `Error HTTP ${res.status}`);
    }
    const data = await res.json();
    // Hard navigation → el servidor lee la cookie nueva en la primera petición
    window.location.href = data.needsOnboarding
      ? '/onboarding'
      : (params.get('next') ?? '/dashboard');
  }

  function switchMode(m: Mode) {
    setMode(m);
    setError('');
    setNotice('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setNotice('');

    const mail = email.trim();
    if (!mail || !password) { setError('Completa el correo y la contraseña.'); return; }
    if (mode === 'register' && !name.trim()) { setError('Ingresa tu nombre completo.'); return; }
    if (mode === 'register' && password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return; }

    setLoading(true);
    try {
      if (mode === 'login') {
        const cred = await signInWithEmailAndPassword(auth, mail, password);
        await completeSignIn(cred.user);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, mail, password);
        await updateProfile(cred.user, { displayName: name.trim() });
        await completeSignIn(cred.user);
      }
    } catch (err: any) {
      setError(friendlyError(err?.code ?? '', err?.message ?? ''));
      setLoading(false);
    }
  }

  /** Inicia sesión con Google (OAuth). El backend (api/auth/session) crea el
   *  usuario en Firestore con provider='google' y dispara el onboarding. */
  async function handleGoogle() {
    setError('');
    setNotice('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const cred = await signInWithPopup(auth, provider);
      await completeSignIn(cred.user);
    } catch (err: any) {
      const code = err?.code ?? '';
      // El usuario cerró el popup: no es un error que mostrar.
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setLoading(false);
        return;
      }
      if (code === 'auth/operation-not-allowed') {
        setError('El acceso con Google no está habilitado en Firebase. Actívalo en Authentication → Sign-in method.');
      } else if (code === 'auth/unauthorized-domain') {
        setError('Este dominio no está autorizado en Firebase. Agrégalo en Authentication → Settings → Dominios autorizados.');
      } else {
        setError(friendlyError(code, err?.message ?? ''));
      }
      setLoading(false);
    }
  }

  async function handleReset() {
    const mail = email.trim();
    if (!mail) { setError('Escribe tu correo arriba y vuelve a tocar "¿Olvidaste tu contraseña?".'); return; }
    setError('');
    setNotice('');
    try {
      await sendPasswordResetEmail(auth, mail);
      setNotice(`Te enviamos un enlace de recuperación a ${mail}.`);
    } catch (err: any) {
      setError(friendlyError(err?.code ?? '', err?.message ?? ''));
    }
  }

  const isLogin = mode === 'login';

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 bg-grid-pattern relative overflow-hidden">
      {/* Cartoon Background Elements */}
      <CartoonBackground />

      <header className="relative z-10 flex items-center gap-3 px-8 py-6">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl overflow-hidden bg-white shadow-sm border border-slate-200">
          <Image src="/icon-cavaltec.png" alt="Logo" width={36} height={36} className="w-7 h-7 object-contain" />
        </div>
        <span className="text-slate-800 font-semibold text-sm tracking-widest uppercase">PrivacyCheck CO</span>
        <span className="text-[10px] text-brand-600 border border-brand-200 rounded-full px-2.5 py-0.5 ml-1 bg-brand-50 backdrop-blur tracking-widest uppercase font-medium">Beta</span>
      </header>

      <main id="contenido-principal" className="relative z-10 flex-1 flex items-center justify-center px-4 pb-8">
        <div className="w-full max-w-[440px]">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-white border border-slate-200 shadow-sm rounded-full px-4 py-1.5 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500" style={{ animation: 'pulse 2s infinite' }} />
              <span className="text-[11px] text-slate-600 font-medium tracking-widest uppercase">Fase de Diseño · Ley 1581 de 2012</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 leading-tight tracking-tight mb-4 text-glow">
              Autodiagnóstico de<br />Protección de Datos
            </h1>
            <p className="text-slate-500 text-sm md:text-base leading-relaxed font-light">
              Evalúe el cumplimiento de su organización con la Ley 1581
              e identifique brechas en minutos con IA.
            </p>
          </div>

          <div className="bg-white/90 backdrop-blur-sm rounded-[2rem] p-8 shadow-[0_8px_40px_rgba(0,0,0,0.08)] border border-slate-200/80">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 mb-5 overflow-hidden shadow-sm">
                <Image src="/icon-cavaltec.png" alt="Logo" width={48} height={48} className="w-10 h-10 object-contain" />
              </div>
              <h2 className="text-2xl font-semibold text-slate-900 tracking-tight">
                {isLogin ? 'Iniciar sesión' : 'Crear cuenta'}
              </h2>
              <p className="text-sm text-slate-500 mt-2 font-light">
                {isLogin ? 'Accede a tu panel de cumplimiento' : 'Registra tu organización en minutos'}
              </p>
            </div>

            {/* Toggle Iniciar sesión / Crear cuenta */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl mb-6">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isLogin ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <LogIn className="w-4 h-4" /> Iniciar sesión
              </button>
              <button
                type="button"
                onClick={() => switchMode('register')}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  !isLogin ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <UserPlus className="w-4 h-4" /> Crear cuenta
              </button>
            </div>

            {/* OAuth — Continuar con Google */}
            <button
              type="button"
              onClick={handleGoogle}
              disabled={loading}
              aria-label="Continuar con Google"
              className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 font-medium rounded-xl px-4 py-3 text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] shadow-sm"
            >
              <GoogleIcon />
              {isLogin ? 'Continuar con Google' : 'Registrarse con Google'}
            </button>

            <div className="flex items-center gap-4 my-6">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-[10px] text-slate-400 uppercase tracking-widest font-medium">o con tu correo</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <Field label="Nombre completo" icon={<UserIcon className="w-4 h-4" />}>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Tu nombre"
                    autoComplete="name"
                    className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all"
                  />
                </Field>
              )}

              <Field label="Correo electrónico" icon={<Mail className="w-4 h-4" />}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="correo@empresa.com"
                  autoComplete="email"
                  required
                  className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all"
                />
              </Field>

              <Field label="Contraseña" icon={<Lock className="w-4 h-4" />}>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  required
                  minLength={6}
                  className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all"
                />
              </Field>

              {!isLogin && (
                <p className="text-[11px] text-slate-400 pl-1 -mt-1">Mínimo 6 caracteres.</p>
              )}

              {isLogin && (
                <div className="text-right -mt-1">
                  <button type="button" onClick={handleReset} className="text-xs text-brand-600 hover:text-brand-500 font-medium">
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
              )}

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-center">
                  {error}
                </p>
              )}
              {notice && (
                <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-center">
                  {notice}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2.5 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl px-4 py-3.5 text-sm transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] shadow-[0_4px_20px_rgba(20,184,166,0.25)] hover:shadow-[0_6px_28px_rgba(20,184,166,0.4)]"
              >
                {loading ? <Spinner /> : <ArrowRight className="w-4 h-4" />}
                {loading
                  ? (isLogin ? 'Iniciando…' : 'Creando cuenta…')
                  : (isLogin ? 'Iniciar sesión' : 'Crear cuenta')}
              </button>
            </form>

            <div className="flex items-center gap-4 my-7">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
              <span className="text-[10px] text-slate-400 uppercase tracking-widest font-medium">Protocolos</span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
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
              <div key={f.label} className="flex items-center gap-2 px-3.5 py-2 rounded-full text-slate-600 bg-white shadow-sm border border-slate-200 text-[11px] uppercase tracking-wider font-medium">
                <span className="text-brand-500">{f.icon}</span>
                {f.label}
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="relative z-10 pb-8 pt-4">
        <div className="flex flex-col items-center gap-4">
          <p className="text-slate-400 text-[11px] tracking-widest uppercase font-medium">© 2026 PrivacyCheck CO · Core System</p>
          <div className="flex items-center gap-3 opacity-60 hover:opacity-100 transition-opacity duration-300">
            <span className="text-slate-400 text-[9px] uppercase tracking-[0.2em] font-bold">Powered by</span>
            <Image src="/logo-cavaltec.jpeg" alt="Sintaxis TI" width={72} height={72} className="h-6 w-auto grayscale mix-blend-multiply opacity-80" />
          </div>
        </div>
      </footer>
    </div>
  );
}

function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-widest mb-2">{label}</label>
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">{icon}</span>
        {children}
      </div>
    </div>
  );
}

function TrustBadge({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 text-slate-500 text-[10px] uppercase tracking-wider font-medium">
      <span className="text-brand-500">{icon}</span>
      {label}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}
