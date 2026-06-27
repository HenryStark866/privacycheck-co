'use client';

/**
 * Campo de número de WhatsApp con prefijo +57 fijo y solo dígitos (10).
 * Almacena el número completo ("57" + 10 dígitos) vía onChange, con el mismo
 * estilo/tema del resto de la app.
 */
export default function WhatsAppField({
  value,
  onChange,
  label = 'Teléfono (WhatsApp)',
  required = false,
}: {
  value: string;
  onChange: (full: string) => void;
  label?: string;
  required?: boolean;
}) {
  // value = número completo (p.ej. "573245769748"); mostramos solo los 10 dígitos locales.
  const local = (value || '').replace(/\D/g, '').replace(/^57/, '').slice(0, 10);

  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5">{label}</label>
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium select-none">+57</span>
        <input
          type="tel"
          required={required}
          value={local}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
            onChange(digits ? '57' + digits : '');
          }}
          placeholder="324 576 9748"
          className="w-full text-sm border border-slate-200 rounded-xl pl-12 pr-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 transition-all"
        />
      </div>
    </div>
  );
}
