'use client';

import { useState } from 'react';
import Image from 'next/image';
import { MessageCircle, ArrowRight, CheckCircle } from 'lucide-react';

interface Props { email: string }

export default function OnboardingContent({ email }: Props) {
  const [phone, setPhone]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [done, setDone]       = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/auth/profile', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ whatsapp: phone }),
    });

    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? 'Error al guardar. Intenta de nuevo.');
      setLoading(false);
      return;
    }

    setDone(true);
    // Hard navigation para que el servidor vea la sesión correctamente
    setTimeout(() => { window.location.href = '/dashboard'; }, 900);
  }

  return (
    <div className="min-h-screen flex flex-col bg-navy-900 bg-grid-pattern relative overflow-hidden">
      {/* Orbs de fondo */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full opacity-20 blur-[100px] bg-brand-500 animate-pulse-slow" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] rounded-full opacity-10 blur-[120px] bg-indigo-500 animate-float" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center gap-3 px-8 py-6">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl overflow-hidden glass-card border border-white/10">
          <Image src="/icon-cavaltec.png" alt="Logo" width={36} height={36} className="w-7 h-7 object-contain" />
        </div>
        <span className="text-white font-semibold text-sm tracking-widest uppercase">PrivacyCheck CO</span>
        <span className="text-[10px] text-brand-300 border border-brand-500/30 rounded-full px-2.5 py-0.5 ml-1 bg-brand-900/40 backdrop-blur tracking-widest uppercase">Beta</span>
      </header>

      {/* Contenido */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 pb-12">
        <div className="w-full max-w-[440px]">

          {/* Bienvenida */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-brand-900/30 border border-brand-500/20 backdrop-blur rounded-full px-4 py-1.5 mb-6 shadow-[0_0_15px_rgba(20,184,166,0.15)]">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
              <span className="text-[11px] text-brand-300 font-medium tracking-widest uppercase">Un paso más</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight tracking-tight mb-3 text-glow">
              ¡Bienvenido a<br />PrivacyCheck CO!
            </h1>
            <p className="text-slate-400 text-sm leading-relaxed font-light">
              Hola <span className="text-brand-300 font-medium">{email}</span>.<br />
              Tu cuenta fue creada. Necesitamos tu número de WhatsApp para activar las consultas desde tu chat.
            </p>
          </div>

          {/* Card */}
          <div className="glass-card rounded-[2rem] p-8 shadow-floating">

            {done ? (
              /* ── Estado: guardado ─────────────────────────── */
              <div className="flex flex-col items-center gap-4 py-6">
                <div className="w-16 h-16 rounded-full bg-brand-500/20 border border-brand-400/30 flex items-center justify-center shadow-[0_0_20px_rgba(20,184,166,0.3)]">
                  <CheckCircle className="w-8 h-8 text-brand-400" />
                </div>
                <p className="text-white font-semibold text-lg">¡Listo!</p>
                <p className="text-slate-400 text-sm text-center">Redirigiendo al panel principal…</p>
                <div className="w-32 h-1 bg-slate-800 rounded-full overflow-hidden mt-2">
                  <div className="h-full bg-brand-400 rounded-full animate-[pcBar_.9s_ease-in-out_both]" style={{ width: '100%', transition: 'width .9s' }} />
                </div>
              </div>
            ) : (
              /* ── Formulario WhatsApp ───────────────────────── */
              <>
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 rounded-2xl bg-green-900/30 border border-green-500/20 flex items-center justify-center shrink-0">
                    <MessageCircle className="w-6 h-6 text-green-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">Número de WhatsApp</p>
                    <p className="text-slate-400 text-xs mt-0.5">Recibirás diagnósticos e IA en tu chat personal</p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 uppercase tracking-widest mb-2">
                      Celular colombiano
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium select-none">
                        +57
                      </span>
                      <input
                        type="tel"
                        value={phone}
                        onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        placeholder="300 123 4567"
                        required
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-14 pr-4 py-3.5 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-brand-500/60 focus:ring-1 focus:ring-brand-500/30 transition-all"
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1.5 pl-1">Ej: 3001234567 (sin indicativo)</p>
                  </div>

                  {error && (
                    <p className="text-sm text-red-400 bg-red-950/40 border border-red-500/20 rounded-xl px-4 py-3 text-center">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={loading || phone.length < 10}
                    className="w-full flex items-center justify-center gap-2.5 bg-brand-500 hover:bg-brand-400 text-white font-semibold rounded-xl px-4 py-3.5 text-sm transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] shadow-[0_0_20px_rgba(20,184,166,0.3)] hover:shadow-[0_0_30px_rgba(20,184,166,0.5)]"
                  >
                    {loading ? (
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                    ) : (
                      <ArrowRight className="w-4 h-4" />
                    )}
                    {loading ? 'Guardando…' : 'Activar y entrar al panel'}
                  </button>
                </form>

                <p className="text-center text-[10px] text-slate-600 mt-6">
                  Puedes cambiar este número después desde tu perfil.
                </p>
              </>
            )}
          </div>

          {/* Beneficios */}
          <div className="mt-8 grid grid-cols-3 gap-3">
            {[
              { icon: '🔐', label: 'Diagnósticos Ley 1581' },
              { icon: '🤖', label: 'IA en tiempo real' },
              { icon: '📊', label: 'Reportes por WhatsApp' },
            ].map(f => (
              <div key={f.label} className="glass-card rounded-2xl p-3.5 text-center">
                <div className="text-xl mb-1.5">{f.icon}</div>
                <p className="text-[10px] text-slate-400 leading-tight">{f.label}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
