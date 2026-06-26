'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, ArrowLeft, Info } from 'lucide-react';

const SECTORS = [
  'Tecnología', 'Salud', 'Educación', 'Finanzas', 'Retail',
  'Manufactura', 'Gobierno', 'Telecomunicaciones', 'Medios', 'Otro',
];
const SIZES = [
  { value: 'micro',   label: 'Microempresa (< 10 empleados)' },
  { value: 'pequeña', label: 'Pequeña (10–50 empleados)' },
  { value: 'mediana', label: 'Mediana (50–200 empleados)' },
  { value: 'grande',  label: 'Grande (> 200 empleados)' },
];
const ROLES = [
  { value: 'administrador', label: 'Administrador' },
  { value: 'evaluador',     label: 'Evaluador' },
  { value: 'auditor',       label: 'Auditor' },
];

export default function NewCompanyPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '', nit: '', sector: '', size: 'pequeña', role: 'administrador', email: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError('El nombre es obligatorio'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al crear empresa');
      router.push(`/companies/${data.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-xl hover:bg-white hover:shadow-sm text-gray-400 hover:text-gray-700 transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-brand-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Nueva empresa</h1>
            <p className="text-sm text-gray-500">Registra la organización a diagnosticar</p>
          </div>
        </div>
      </div>

      {/* Form card */}
      <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-gray-100 shadow-card p-8 space-y-6">
        {/* Grid 2 columnas */}
        <div className="grid grid-cols-2 gap-5">
          <Field label="Nombre o razón social *">
            <FilledInput
              type="text"
              placeholder="Ej. Acme S.A.S."
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v })}
            />
          </Field>

          <Field label="NIT / Cédula de identidad *">
            <FilledInput
              type="text"
              placeholder="900.123.456-7"
              value={form.nit}
              onChange={(v) => setForm({ ...form, nit: v })}
            />
          </Field>

          <Field label="Sector económico *">
            <FilledSelect
              value={form.sector}
              onChange={(v) => setForm({ ...form, sector: v })}
              placeholder="Seleccionar..."
            >
              {SECTORS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </FilledSelect>
          </Field>

          <Field label="Tamaño de la empresa *">
            <FilledSelect
              value={form.size}
              onChange={(v) => setForm({ ...form, size: v })}
            >
              {SIZES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </FilledSelect>
          </Field>

          <Field label="Su rol en la organización *">
            <FilledSelect
              value={form.role}
              onChange={(v) => setForm({ ...form, role: v })}
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </FilledSelect>
          </Field>

          <Field label="Correo electrónico de contacto *">
            <FilledInput
              type="email"
              placeholder="contacto@empresa.com"
              value={form.email}
              onChange={(v) => setForm({ ...form, email: v })}
            />
          </Field>
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
            {error}
          </p>
        )}

        {/* Info banner — estilo Figma */}
        <div className="flex items-start gap-3 bg-brand-50 border border-brand-100 rounded-2xl px-4 py-3.5">
          <Info className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
          <p className="text-sm text-brand-700 leading-relaxed">
            Los campos marcados con * son obligatorios. Su información se procesa exclusivamente para
            generar su diagnóstico y no será compartida con terceros, conforme a la Ley 1581/2012.
          </p>
        </div>

        {/* Acciones */}
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl py-3 text-sm font-medium transition-all"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl py-3 text-sm font-semibold transition-all disabled:opacity-50 shadow-sm"
          >
            {saving ? 'Guardando…' : 'Crear empresa'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-800">{label}</label>
      {children}
    </div>
  );
}

function FilledInput({
  type, placeholder, value, onChange,
}: {
  type: string; placeholder?: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-gray-100 rounded-2xl px-4 py-3.5 text-sm text-gray-900 placeholder-gray-400
                 border border-transparent focus:outline-none focus:border-brand-400 focus:bg-white
                 focus:ring-2 focus:ring-brand-400/20 transition-all"
    />
  );
}

function FilledSelect({
  value, onChange, placeholder, children,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-gray-100 rounded-2xl px-4 py-3.5 text-sm text-gray-900
                 border border-transparent focus:outline-none focus:border-brand-400 focus:bg-white
                 focus:ring-2 focus:ring-brand-400/20 transition-all appearance-none"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {children}
    </select>
  );
}
