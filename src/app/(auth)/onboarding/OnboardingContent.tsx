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
    <div className="min-h-screen flex flex-col bg-slate-50 bg-grid-pattern relative overflow-hidden">
      {/* Orbs de fondo */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full opacity-10 blur-[100px] bg-brand-500 animate-pulse-slow" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] rounded-full opacity-[0.05] blur-[120px] bg-indigo-500 animate-float" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center gap-3 px-8 py-6">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <Image src="/icon-cavaltec.png" alt="Logo" width={36} height={36} className="w-7 h-7 object-contain" />
        </div>
        <span className="text-slate-800 font-semibold text-sm tracking-widest uppercase">PrivacyCheck CO</span>
        <span className="text-[10px] text-brand-600 border border-brand-200 rounded-full px-2.5 py-0.5 ml-1 bg-brand-50 backdrop-blur tracking-widest uppercase font-medium">Beta</span>
      </header>

      {/* Contenido */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 pb-12">
        <div className="w-full max-w-[440px]">

          {/* Bienvenida */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-white border border-slate-200 shadow-sm rounded-full px-4 py-1.5 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
              <span className="text-[11px] text-slate-600 font-medium tracking-widest uppercase">Un paso más</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 leading-tight tracking-tight mb-3">
              ¡Bienvenido a<br />PrivacyCheck CO!
            </h1>
            <p className="text-slate-500 text-sm leading-relaxed font-light">
              Hola <span className="text-brand-600 font-medium">{email}</span>.<br />
              Tu cuenta fue creada. Necesitamos tu número de WhatsApp para activar las consultas desde tu chat.
            </p>
          </div>

          {/* Card */}
          <div className="bg-white/90 backdrop-blur-sm rounded-[2rem] p-8 shadow-[0_8px_40px_rgba(0,0,0,0.08)] border border-slate-200/80">

            {done ? (
              /* ── Estado: guardado ─────────────────────────── */
              <div className="flex flex-col items-center gap-4 py-6">
                <div className="w-16 h-16 rounded-full bg-brand-50 border border-brand-200 flex items-center justify-center shadow-sm">
                  <CheckCircle className="w-8 h-8 text-brand-500" />
                </div>
                <p className="text-slate-900 font-semibold text-lg">¡Listo!</p>
                <p className="text-slate-500 text-sm text-center">Redirigiendo al panel principal…</p>
                <div className="w-32 h-1 bg-slate-200 rounded-full overflow-hidden mt-2">
                  <div className="h-full bg-brand-500 rounded-full animate-[pcBar_.9s_ease-in-out_both]" style={{ width: '100%', transition: 'width .9s' }} />
                </div>
              </div>
            ) : (
              /* ── Formulario WhatsApp ───────────────────────── */
              <>
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center shrink-0">
                    <MessageCircle className="w-6 h-6 text-brand-500" />
                  </div>
                  <div>
                    <p className="text-slate-900 font-semibold text-sm">Número de WhatsApp</p>
                    <p className="text-slate-500 text-xs mt-0.5">Recibirás diagnósticos e IA en tu chat personal</p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label htmlFor="whatsapp" className="block text-[11px] font-semibold text-brand-600 uppercase tracking-widest mb-2">
                      Celular Colombiano
                    </label>
                    <div className="relative group/input">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                        <span className="text-[17px]">🇨🇴</span>
                        <span className="text-slate-500 font-medium text-sm">+57</span>
                        <div className="w-px h-5 bg-slate-200 ml-1" />
                      </div>
                      <input
                        id="whatsapp"
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        placeholder="3001234567"
                        className="w-full bg-white border border-slate-200 text-slate-900 text-lg rounded-xl pl-24 pr-4 py-3.5 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all font-medium placeholder:text-slate-400 shadow-sm"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-2">Ej: 3001234567 (sin indicativo)</p>
                  </div>

                  {error && (
                    <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-center">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={loading || phone.length < 10}
                    className="w-full relative group overflow-hidden bg-brand-600 hover:bg-brand-500 text-white rounded-xl py-3.5 px-4 font-semibold text-[15px] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg disabled:hover:shadow-md"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                    <span className="relative flex items-center justify-center gap-2">
                      {loading ? (
                        <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      )}
                      {loading ? 'Guardando…' : 'Activar y entrar al panel'}
                    </span>
                  </button>
                </form>

                <p className="text-center text-xs text-slate-500 font-light mt-6">
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
              <div key={f.label} className="bg-white border border-slate-200 rounded-2xl p-3.5 text-center shadow-sm">
                <div className="text-xl mb-1.5">{f.icon}</div>
                <p className="text-[10px] text-slate-500 leading-tight">{f.label}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
