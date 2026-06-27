'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users, UserPlus, Trash2, Pencil, X, Loader2, ShieldCheck, AlertTriangle,
} from 'lucide-react';

interface MemberInfo {
  uid: string;
  role: string;
  email?: string;
  displayName?: string;
}

interface Company {
  id: string;
  name: string;
  nit?: string;
  sector?: string;
  size?: string;
}

const ROLES = ['administrador', 'evaluador', 'auditor'] as const;

export default function CompanyManager({
  company, members, canManage,
}: {
  company: Company;
  members: MemberInfo[];
  canManage: boolean;
}) {
  const router = useRouter();

  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({
    name: company.name ?? '',
    nit: company.nit ?? '',
    sector: company.sector ?? '',
    size: company.size ?? 'pequeña',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<typeof ROLES[number]>('evaluador');
  const [adding, setAdding] = useState(false);
  const [memberError, setMemberError] = useState('');

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const res = await fetch(`/api/companies/${company.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'No se pudo guardar');
      setEditOpen(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeCompany() {
    if (!confirm(`¿Eliminar "${company.name}" y todos sus diagnósticos? Esta acción no se puede deshacer.`)) return;
    const res = await fetch(`/api/companies/${company.id}`, { method: 'DELETE' });
    if (res.ok) { router.push('/companies'); router.refresh(); }
    else alert('No se pudo eliminar la empresa.');
  }

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true); setMemberError('');
    try {
      const res = await fetch(`/api/companies/${company.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail, role: newRole }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'No se pudo asignar el asesor');
      setNewEmail('');
      router.refresh();
    } catch (err: any) {
      setMemberError(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function removeMember(uid: string) {
    if (!confirm('¿Quitar este asesor de la empresa?')) return;
    const res = await fetch(`/api/companies/${company.id}/members/${uid}`, { method: 'DELETE' });
    if (res.ok) router.refresh();
    else alert('No se pudo quitar el asesor.');
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900 tracking-tight flex items-center gap-2">
          <Users className="w-4 h-4 text-gray-400" /> Asesores y gestión
        </h2>
        {canManage && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setForm({ name: company.name ?? '', nit: company.nit ?? '', sector: company.sector ?? '', size: company.size ?? 'pequeña' }); setError(''); setEditOpen(true); }}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" /> Editar
            </button>
            <button
              onClick={removeCompany}
              className="flex items-center gap-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Eliminar
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-card divide-y divide-gray-50">
        {members.length === 0 && (
          <p className="px-4 py-6 text-sm text-gray-400 text-center">Sin asesores asignados.</p>
        )}
        {members.map((m) => (
          <div key={m.uid} className="flex items-center justify-between px-4 py-3 gap-3">
            <div className="min-w-0 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-brand-50 border border-brand-100 flex items-center justify-center shrink-0">
                <span className="text-[11px] font-bold text-brand-600">
                  {(m.displayName || m.email || m.uid).slice(0, 2).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{m.displayName || m.email || 'Usuario'}</p>
                {m.email && <p className="text-xs text-gray-400 truncate">{m.email}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] capitalize text-gray-500 bg-gray-50 border border-gray-100 px-2.5 py-1 rounded-full font-medium">
                {m.role}
              </span>
              {canManage && (
                <button
                  onClick={() => removeMember(m.uid)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Quitar asesor"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {canManage && (
        <form onSubmit={addMember} className="bg-white rounded-2xl border border-gray-100 shadow-card p-4 space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
            <UserPlus className="w-3.5 h-3.5 text-brand-600" /> Asignar asesor
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="correo@asesor.com"
              required
              className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
            />
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as typeof ROLES[number])}
              className="text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:border-brand-500 outline-none bg-white capitalize"
            >
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <button
              type="submit"
              disabled={adding}
              className="flex items-center justify-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl px-4 py-2.5 transition-colors disabled:opacity-50"
            >
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              Asignar
            </button>
          </div>
          {memberError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {memberError}
            </p>
          )}
          <p className="text-[11px] text-slate-400">
            El asesor debe tener una cuenta registrada. <span className="font-medium">administrador</span> gestiona; <span className="font-medium">evaluador</span> diagnostica; <span className="font-medium">auditor</span> solo consulta.
          </p>
        </form>
      )}

      {/* Modal editar empresa */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-brand-600" /> Editar empresa
              </h2>
              <button onClick={() => setEditOpen(false)} className="text-slate-400 hover:bg-slate-200 p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={saveEdit} className="p-5 space-y-4">
              {error && <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-100">{error}</div>}
              <Field label="Nombre">
                <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none" />
              </Field>
              <Field label="NIT">
                <input type="text" value={form.nit} onChange={(e) => setForm({ ...form, nit: e.target.value })} className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none" />
              </Field>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Sector">
                  <input type="text" value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })} className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none" />
                </Field>
                <Field label="Tamaño">
                  <select value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none bg-white capitalize">
                    {['micro', 'pequeña', 'mediana', 'grande'].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setEditOpen(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">Cancelar</button>
                <button type="submit" disabled={saving} className="flex items-center justify-center min-w-[100px] px-4 py-2 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition-colors disabled:opacity-50">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5">{label}</label>
      {children}
    </div>
  );
}
