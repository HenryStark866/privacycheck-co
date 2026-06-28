import Link from 'next/link';
import Image from 'next/image';
import {
  ShieldCheck, BarChart2, Search, Sparkles, ArrowRight, Lock, LogIn,
  FileWarning, BookX, ClipboardX, Check, FileText, Gauge as GaugeIcon,
  MessageSquareText, TrendingUp,
} from 'lucide-react';

/**
 * Landing pública de PrivacyCheck CO.
 * Integra el diseño del equipo (estética iOS/Apple, acento azul #007AFF,
 * hero + stepper + gauge) con el contenido obligatorio del reto
 * (El Problema · Motor de Puntuación / 5 Niveles · La Solución).
 */

const BLUE = '#007AFF';

const MATURITY = [
  { name: 'Inicial',     color: '#FF3B30', pct: 18 },
  { name: 'Básico',      color: '#FF9500', pct: 38 },
  { name: 'Gestionado',  color: '#FFCC00', pct: 60 },
  { name: 'Optimizado',  color: '#34C759', pct: 82 },
  { name: 'Líder',       color: '#007AFF', pct: 97 },
];

export default function Landing() {
  return (
    <div className="bg-[#F2F2F7] text-[#1C1C1E] min-h-screen antialiased">
      {/* ── Nav ───────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-[#E5E5EA]">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center w-8 h-8 rounded-xl overflow-hidden bg-white border border-[#E5E5EA]">
              <Image src="/icon-cavaltec.png" alt="PrivacyCheck CO" width={28} height={28} className="w-5 h-5 object-contain" />
            </span>
            <span className="font-semibold tracking-tight">PrivacyCheck CO</span>
            <span className="hidden sm:inline text-[#8E8E93] text-sm">· Ley 1581/2012</span>
          </div>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 h-9 px-4 rounded-full bg-[#007AFF] text-white text-sm font-medium hover:opacity-90 transition"
          >
            <LogIn className="w-4 h-4" /> Iniciar sesión
          </Link>
        </div>
      </header>

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 pt-16 pb-20 lg:pt-24 lg:pb-28">
        <div className="grid lg:grid-cols-2 gap-14 items-center">
          <div>
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-[#E5E5EA] text-[#3A3A3C] text-[13px] font-medium mb-7 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-[#007AFF]" /> Fase de Diseño · Ley 1581 de 2012
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-tight mb-6">
              Autodiagnóstico de<br />
              <span className="text-[#007AFF]">Protección de Datos</span>
            </h1>
            <p className="text-lg text-[#3A3A3C] leading-relaxed max-w-xl mb-9">
              Evalúe el cumplimiento de su organización con la Ley 1581 de 2012 desde la
              fase de diseño. Identifique brechas y obtenga un plan de acción con IA en menos
              de 5 minutos.
            </p>

            <div className="grid sm:grid-cols-2 gap-4 max-w-lg mb-10">
              {[
                { icon: <BarChart2 className="w-4 h-4" />, label: 'Nivel de cumplimiento (%)' },
                { icon: <Search className="w-4 h-4" />, label: 'Identificación de brechas' },
                { icon: <Sparkles className="w-4 h-4" />, label: 'Recomendaciones con IA' },
                { icon: <ShieldCheck className="w-4 h-4" />, label: 'Basado en Ley 1581/2012' },
              ].map((f) => (
                <div key={f.label} className="flex items-center gap-3 text-[#3A3A3C]">
                  <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-white border border-[#E5E5EA] text-[#007AFF] shrink-0">
                    {f.icon}
                  </span>
                  <span className="text-[15px] font-medium">{f.label}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl bg-[#007AFF] text-white font-semibold hover:opacity-90 transition shadow-lg shadow-[#007AFF]/25"
              >
                Comenzar diagnóstico <ArrowRight className="w-4 h-4" />
              </Link>
              <div className="flex items-center gap-4 text-[13px] text-[#8E8E93] pl-2">
                <span className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Cifrado en tránsito</span>
                <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5" /> OWASP</span>
              </div>
            </div>
          </div>

          {/* Visual: gauge + stepper (estética del equipo) */}
          <div className="relative">
            <div className="bg-white rounded-3xl border border-[#E5E5EA] shadow-xl p-8">
              <Stepper />
              <div className="flex items-center gap-6 mt-8">
                <SampleGauge value={78} />
                <div>
                  <span className="bg-[#34C759]/10 text-[#34C759] text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wide">
                    Optimizado
                  </span>
                  <h3 className="text-lg font-bold mt-1.5">Cumplimiento sólido</h3>
                  <p className="text-sm text-[#8E8E93] leading-relaxed mt-1">
                    11 preguntas evaluadas · 3 bloques · plan de acción priorizado por IA.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2.5 mt-7">
                {[
                  { n: 'Política', pct: 90, c: '#34C759' },
                  { n: 'Diseño', pct: 72, c: '#FF9500' },
                  { n: 'Gobernanza', pct: 64, c: '#FF9500' },
                ].map((b) => (
                  <div key={b.n} className="bg-[#F2F2F7] rounded-2xl p-3.5">
                    <p className="text-[11px] text-[#8E8E93] font-medium">{b.n}</p>
                    <p className="text-xl font-extrabold tracking-tight mt-0.5" style={{ color: b.c }}>{b.pct}%</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="absolute -z-10 -inset-4 bg-[#007AFF]/10 blur-3xl rounded-full" />
          </div>
        </div>
      </section>

      {/* ── El Problema ───────────────────────────────────────────────── */}
      <section className="bg-white border-y border-[#E5E5EA]">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-20">
          <div className="max-w-2xl mb-12">
            <p className="text-[#007AFF] font-semibold text-sm uppercase tracking-widest mb-3">El Problema</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
              El <span className="text-[#FF3B30]">73%</span> de las empresas colombianas no sabe si cumple la ley
            </h2>
            <p className="text-[#3A3A3C] text-lg leading-relaxed mt-5">
              Las organizaciones tienen la obligación legal de proteger datos personales, pero no
              tienen cómo medirse. El resultado: incertidumbre, riesgo regulatorio y sanciones evitables.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { icon: <ClipboardX className="w-5 h-5" />, title: 'Sin herramienta accesible', desc: 'No existe un autodiagnóstico práctico para pymes colombianas.' },
              { icon: <BookX className="w-5 h-5" />, title: 'Lenguaje incomprensible', desc: 'Documentos legales de 50 páginas que no dicen qué hacer.' },
              { icon: <FileWarning className="w-5 h-5" />, title: 'Sin plan de acción', desc: 'Los resultados no se traducen en pasos concretos de mejora.' },
            ].map((c) => (
              <div key={c.title} className="bg-[#F2F2F7] rounded-3xl p-7 border border-[#E5E5EA]">
                <span className="flex items-center justify-center w-11 h-11 rounded-2xl bg-[#FF3B30]/10 text-[#FF3B30] mb-4">{c.icon}</span>
                <h3 className="font-bold text-lg">{c.title}</h3>
                <p className="text-[#8E8E93] text-sm leading-relaxed mt-2">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Motor de Puntuación / 5 Niveles ───────────────────────────── */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 py-20">
        <div className="max-w-2xl mb-12">
          <p className="text-[#007AFF] font-semibold text-sm uppercase tracking-widest mb-3">Motor de Puntuación</p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
            Una métrica estructurada en 3 bloques y 5 niveles de madurez
          </h2>
          <p className="text-[#3A3A3C] text-lg leading-relaxed mt-5">
            Cada nivel refleja un estado real de cumplimiento, con acciones concretas para avanzar al siguiente.
          </p>
        </div>

        {/* Escalera de madurez */}
        <div className="bg-white rounded-3xl border border-[#E5E5EA] shadow-sm p-7 sm:p-10">
          <div className="flex items-end justify-between gap-3 sm:gap-6 h-56">
            {MATURITY.map((m) => (
              <div key={m.name} className="flex-1 flex flex-col items-center justify-end h-full">
                <span className="text-sm font-extrabold mb-2" style={{ color: m.color }}>{m.pct}%</span>
                <div
                  className="w-full rounded-t-2xl transition-all"
                  style={{ height: `${m.pct}%`, backgroundColor: m.color, opacity: 0.92 }}
                />
                <span className="text-[13px] sm:text-sm font-semibold mt-3 text-center">{m.name}</span>
              </div>
            ))}
          </div>
          <div className="grid sm:grid-cols-3 gap-4 mt-10 pt-8 border-t border-[#E5E5EA]">
            {[
              { n: 'Bloque A', t: 'Política de datos personales', w: '40 pts' },
              { n: 'Bloque B', t: 'Privacidad desde el diseño', w: '36 pts' },
              { n: 'Bloque C', t: 'Gobernanza', w: '24 pts' },
            ].map((b) => (
              <div key={b.n} className="flex items-center gap-3">
                <span className="flex items-center justify-center w-10 h-10 rounded-2xl bg-[#007AFF]/10 text-[#007AFF] shrink-0">
                  <GaugeIcon className="w-5 h-5" />
                </span>
                <div>
                  <p className="text-[13px] text-[#8E8E93] font-medium">{b.n} · {b.w}</p>
                  <p className="font-semibold text-[15px] leading-tight">{b.t}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── La Solución ───────────────────────────────────────────────── */}
      <section className="bg-white border-y border-[#E5E5EA]">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-20">
          <div className="max-w-2xl mb-12">
            <p className="text-[#007AFF] font-semibold text-sm uppercase tracking-widest mb-3">La Solución</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
              Diagnóstico completo en menos de 5 minutos
            </h2>
            <p className="text-[#3A3A3C] text-lg leading-relaxed mt-5">
              Una plataforma web que permite a cualquier empresa diagnosticar su nivel de cumplimiento
              de la Ley 1581 de forma rápida, clara y accionable.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: <LogIn className="w-5 h-5" />, title: 'Login OAuth', desc: 'Google o Microsoft — sin crear cuentas nuevas.' },
              { icon: <MessageSquareText className="w-5 h-5" />, title: '11 preguntas con IA', desc: 'Lenguaje claro y explicaciones en tiempo real.' },
              { icon: <TrendingUp className="w-5 h-5" />, title: 'Resultados inmediatos', desc: 'Gauge 0–100%, desglose por bloques y brechas.' },
              { icon: <FileText className="w-5 h-5" />, title: 'Plan de acción + PDF', desc: 'Acciones priorizadas con plazos, exportable a directivos.' },
            ].map((c) => (
              <div key={c.title} className="bg-[#F2F2F7] rounded-3xl p-7 border border-[#E5E5EA]">
                <span className="flex items-center justify-center w-11 h-11 rounded-2xl bg-[#007AFF]/10 text-[#007AFF] mb-4">{c.icon}</span>
                <h3 className="font-bold text-lg">{c.title}</h3>
                <p className="text-[#8E8E93] text-sm leading-relaxed mt-2">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ─────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 py-24 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-5">
          Conozca su nivel de cumplimiento hoy
        </h2>
        <p className="text-[#3A3A3C] text-lg max-w-xl mx-auto mb-9">
          Gratuito para PYMES colombianas. Sin instalaciones. Resultados al instante.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 h-14 px-9 py-4 rounded-2xl bg-[#007AFF] text-white font-semibold text-lg hover:opacity-90 transition shadow-xl shadow-[#007AFF]/30"
        >
          Comenzar diagnóstico <ArrowRight className="w-5 h-5" />
        </Link>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="border-t border-[#E5E5EA] bg-white">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 text-[#8E8E93]">
            <Image src="/icon-cavaltec.png" alt="" width={20} height={20} className="w-5 h-5 object-contain" />
            <span className="text-sm">© 2026 PrivacyCheck CO · Sintaxis TI</span>
          </div>
          <p className="text-[13px] text-[#8E8E93]">Ley 1581 de 2012 · Habeas Data · Colombia</p>
        </div>
      </footer>
    </div>
  );
}

/* ── Sub-componentes ───────────────────────────────────────────────── */

function Stepper() {
  const steps = ['Perfil', 'Cuestionario', 'Resultados'];
  return (
    <div className="flex items-center justify-between">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center">
            <span
              className="flex items-center justify-center w-8 h-8 rounded-full text-white text-sm font-bold shadow-sm"
              style={{ backgroundColor: BLUE }}
            >
              {i < 2 ? <Check className="w-4 h-4 stroke-[3]" /> : '3'}
            </span>
            <span className="text-[12px] font-semibold mt-1.5" style={{ color: BLUE }}>{s}</span>
          </div>
          {i < steps.length - 1 && <span className="flex-1 h-0.5 mx-2 rounded-full" style={{ backgroundColor: BLUE }} />}
        </div>
      ))}
    </div>
  );
}

function SampleGauge({ value }: { value: number }) {
  const dash = `${value}, 100`;
  return (
    <div className="relative w-28 h-28 shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
        <path className="text-[#E5E5EA]" strokeWidth="3.5" stroke="currentColor" fill="none"
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
        <path strokeDasharray={dash} strokeWidth="3.5" strokeLinecap="round" stroke="#34C759" fill="none"
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-extrabold tracking-tight">{value}%</span>
        <span className="text-[9px] text-[#8E8E93] uppercase font-bold tracking-wider">Estado</span>
      </div>
    </div>
  );
}
