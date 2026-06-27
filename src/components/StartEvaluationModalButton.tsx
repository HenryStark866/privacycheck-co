'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Plus, Building2, X, Loader2, ClipboardCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CompanyOption {
  id: string;
  name: string;
  nit?: string;
}

interface Props {
  companies: CompanyOption[];
  className?: string;
}

export default function StartEvaluationModalButton({ companies, className }: Props) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState(companies[0]?.id || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    if (!selectedCompanyId) {
      setError('Por favor selecciona una empresa.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: selectedCompanyId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al iniciar diagnóstico');
      if (data.id) {
        setIsOpen(false);
        router.push(`/evaluations/${data.id}/diagnose`);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => {
          setSelectedCompanyId(companies[0]?.id || '');
          setError(null);
          setIsOpen(true);
        }}
        className={cn(
          'flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm',
          className
        )}
      >
        <Plus className="w-4 h-4" />
        Nuevo diagnóstico
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center text-brand-600 border border-brand-100">
                  <ClipboardCheck className="w-4.5 h-4.5" />
                </div>
                <h2 className="text-base font-bold text-slate-800 tracking-tight">Iniciar Autodiagnóstico</h2>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:bg-slate-200 p-1.5 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-500 leading-relaxed">
                Selecciona la organización o empresa sobre la cual realizarás la evaluación de cumplimiento de la Ley 1581 de 2012.
              </p>

              {error && (
                <div className="p-3 text-xs text-red-600 bg-red-50 rounded-xl border border-red-100 font-medium">
                  {error}
                </div>
              )}

              {companies.length === 0 ? (
                <div className="p-4 text-center bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-800">
                  No tienes empresas registradas. Por favor registra una empresa primero.
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                    Seleccionar Entidad
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <select
                      value={selectedCompanyId}
                      onChange={(e) => setSelectedCompanyId(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all appearance-none cursor-pointer shadow-sm"
                    >
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.nit ? `(NIT ${c.nit})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-4">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleStart}
                  disabled={loading || companies.length === 0}
                  className="flex items-center justify-center gap-2 min-w-[140px] px-4 py-2.5 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition-colors shadow-sm disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Comenzar Análisis'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
