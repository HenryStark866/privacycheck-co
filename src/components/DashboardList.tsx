'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { CheckCircle2, Clock, ArrowRight, Search, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import MaturityBadge from '@/components/MaturityBadge';
import type { MaturityLevel } from '@/lib/scoring';
import { formatDate } from '@/lib/utils';

interface EvalItem {
  id: string;
  companyId: string;
  status: string;
  score?: number | null;
  maturity?: string | null;
  createdAt: string;
  completedAt?: string | null;
}

interface Company {
  id: string;
  name: string;
}

const PER_PAGE_OPTIONS = [5, 10, 25, 50] as const;

export default function DashboardList({
  evaluations,
  companies,
}: {
  evaluations: EvalItem[];
  companies: Company[];
}) {
  const [query, setQuery] = useState('');
  const [perPage, setPerPage] = useState<number>(10);
  const [page, setPage] = useState(1);

  const companyMap = useMemo(
    () => Object.fromEntries(companies.map((c) => [c.id, c])),
    [companies],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return evaluations;
    const q = query.toLowerCase();
    return evaluations.filter((ev) => {
      const name = companyMap[ev.companyId]?.name ?? '';
      const status = ev.status === 'completada' ? 'completado' : 'borrador en progreso';
      return name.toLowerCase().includes(q) || status.includes(q);
    });
  }, [evaluations, companyMap, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, totalPages);
  const slice = filtered.slice((safePage - 1) * perPage, safePage * perPage);

  function handleQuery(v: string) {
    setQuery(v);
    setPage(1);
  }

  function handlePerPage(v: number) {
    setPerPage(v);
    setPage(1);
  }

  if (!evaluations.length) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-400 pointer-events-none drop-shadow-[0_0_5px_rgba(45,212,191,0.5)]" />
          <input
            type="search"
            placeholder="Buscar por entidad o estado..."
            value={query}
            onChange={(e) => handleQuery(e.target.value)}
            className="w-full bg-slate-900/50 border border-white/10 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-slate-400
                       focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 focus:shadow-[0_0_15px_rgba(45,212,191,0.2)] transition-all glass-card"
          />
          {query && (
            <button
              onClick={() => handleQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors p-1"
            >
              ×
            </button>
          )}
        </div>

        {/* Per-page selector */}
        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-widest hidden sm:block">Límite</span>
          <select
            value={perPage}
            onChange={(e) => handlePerPage(Number(e.target.value))}
            className="bg-slate-900/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-300
                       focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500
                       transition-all appearance-none cursor-pointer glass-card min-w-[70px] text-center"
          >
            {PER_PAGE_OPTIONS.map((n) => (
              <option key={n} value={n} className="bg-slate-900">{n}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Results meta */}
      {query && (
        <p className="text-[11px] text-brand-400 px-1 font-medium tracking-wide">
          {filtered.length === 0
            ? 'CERO COINCIDENCIAS EN LA BASE DE DATOS'
            : `${filtered.length} REGISTRO${filtered.length !== 1 ? 'S' : ''} ENCONTRADO${filtered.length !== 1 ? 'S' : ''}`}
        </p>
      )}

      {/* List */}
      {slice.length === 0 ? (
        <div className="glass-card rounded-2xl border border-dashed border-white/10 py-12 text-center flex flex-col items-center">
          <AlertCircle className="w-8 h-8 text-slate-500 mb-3 opacity-50" />
          <p className="text-sm text-slate-400">Sin resultados para los parámetros indicados.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {slice.map((ev) => {
            const company = companyMap[ev.companyId];
            const date = ev.completedAt ?? ev.createdAt;
            const isComplete = ev.status === 'completada';
            return (
              <Link
                key={ev.id}
                href={isComplete ? `/evaluations/${ev.id}/results` : `/evaluations/${ev.id}/diagnose`}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-900/40 rounded-2xl border border-white/5 shadow-card
                           hover:bg-slate-800/60 hover:border-brand-500/30 hover:shadow-glow transition-all duration-300 group backdrop-blur-md"
              >
                <div className="flex items-center gap-4 min-w-0 mb-3 sm:mb-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                    isComplete ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-brand-500/10 border-brand-500/20'
                  }`}>
                    {isComplete
                      ? <CheckCircle2 className="w-5 h-5 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                      : <Clock className="w-5 h-5 text-brand-400 drop-shadow-[0_0_8px_rgba(45,212,191,0.8)]" />
                    }
                  </div>
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-white leading-tight truncate group-hover:text-brand-300 transition-colors">
                      {company?.name ?? 'Entidad No Identificada'}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1 uppercase tracking-wider font-medium flex items-center gap-1.5">
                      {isComplete ? (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Certificado el {formatDate(date as any)}
                        </>
                      ) : (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
                          Evaluación activa · Iniciada el {formatDate(ev.createdAt as any)}
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 sm:ml-4">
                  {isComplete && ev.score != null ? (
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-end">
                        <span className="text-sm text-slate-400 font-medium tracking-wide">Índice</span>
                        <span className="text-xl font-bold text-white tabular-nums text-glow">
                          {Math.round(ev.score)}%
                        </span>
                      </div>
                      <MaturityBadge level={ev.maturity as MaturityLevel} />
                    </div>
                  ) : (
                    <span className="text-[10px] text-brand-300 bg-brand-900/30 border border-brand-500/30 px-3 py-1.5 rounded-full font-bold uppercase tracking-widest backdrop-blur shadow-[0_0_10px_rgba(45,212,191,0.15)]">
                      Procesando
                    </span>
                  )}
                  <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-brand-400 group-hover:translate-x-1 transition-all duration-300" />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Pagination footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-3 border-t border-white/10 mt-4">
          <p className="text-[11px] font-medium text-slate-500 uppercase tracking-widest">
            {filtered.length} Total · Pág {safePage}/{totalPages}
          </p>
          <div className="flex items-center gap-1.5">
            <PagButton
              onClick={() => setPage(1)}
              disabled={safePage === 1}
              label="«"
              title="Primera página"
            />
            <PagButton
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              label={<ChevronLeft className="w-4 h-4" />}
              title="Página anterior"
            />
            {getPages(safePage, totalPages).map((p, i) =>
              p === '…' ? (
                <span key={`ellipsis-${i}`} className="px-1 text-xs text-slate-600 select-none">…</span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p as number)}
                  className={`w-8 h-8 rounded-lg text-[13px] font-medium transition-all ${
                    p === safePage
                      ? 'bg-brand-500/20 text-brand-300 border border-brand-500/50 shadow-[0_0_10px_rgba(45,212,191,0.2)]'
                      : 'text-slate-400 hover:bg-white/10 hover:text-white border border-transparent'
                  }`}
                >
                  {p}
                </button>
              ),
            )}
            <PagButton
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              label={<ChevronRight className="w-4 h-4" />}
              title="Página siguiente"
            />
            <PagButton
              onClick={() => setPage(totalPages)}
              disabled={safePage === totalPages}
              label="»"
              title="Última página"
            />
          </div>
        </div>
      )}

      {/* Footer when no pagination */}
      {totalPages === 1 && filtered.length > 0 && (
        <p className="text-[11px] font-medium text-slate-500 uppercase tracking-widest text-right pt-2">
          {filtered.length} REGISTRO{filtered.length !== 1 ? 'S' : ''} TOTAL
        </p>
      )}
    </div>
  );
}

function PagButton({
  onClick, disabled, label, title,
}: {
  onClick: () => void;
  disabled: boolean;
  label: React.ReactNode;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="w-8 h-8 rounded-lg text-sm font-medium text-slate-400 hover:bg-white/10 hover:text-white border border-transparent
                 disabled:opacity-20 disabled:cursor-not-allowed transition-all flex items-center justify-center bg-white/5"
    >
      {label}
    </button>
  );
}

function getPages(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '…')[] = [1];
  if (current > 3) pages.push('…');
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) {
    pages.push(p);
  }
  if (current < total - 2) pages.push('…');
  pages.push(total);
  return pages;
}

function EmptyState() {
  return (
    <div className="glass-card border border-dashed border-white/10 rounded-2xl p-12 text-center flex flex-col items-center">
      <AlertCircle className="w-12 h-12 text-slate-600 mb-4 opacity-50" />
      <p className="text-white text-base font-semibold tracking-wide">Módulo sin Inicializar</p>
      <p className="text-sm text-slate-400 mt-2 max-w-md font-light">
        Registre la primera entidad e inicie un ciclo de auditoría para recolectar telemetría en este espacio.
      </p>
    </div>
  );
}
