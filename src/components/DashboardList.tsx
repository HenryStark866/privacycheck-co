'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { CheckCircle2, Clock, ArrowRight, Search, ChevronLeft, ChevronRight } from 'lucide-react';
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
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <input
            type="search"
            placeholder="Buscar por empresa o estado…"
            value={query}
            onChange={(e) => handleQuery(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm text-gray-900 placeholder-gray-400
                       focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all"
          />
          {query && (
            <button
              onClick={() => handleQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors text-lg leading-none"
            >
              ×
            </button>
          )}
        </div>

        {/* Per-page selector */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-gray-400 whitespace-nowrap hidden sm:block">Registros por página</span>
          <select
            value={perPage}
            onChange={(e) => handlePerPage(Number(e.target.value))}
            className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700
                       focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400
                       transition-all appearance-none pr-7 cursor-pointer"
          >
            {PER_PAGE_OPTIONS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Results meta */}
      {query && (
        <p className="text-xs text-gray-400 px-1">
          {filtered.length === 0
            ? 'Sin resultados para esa búsqueda.'
            : `${filtered.length} resultado${filtered.length !== 1 ? 's' : ''} para "${query}"`}
        </p>
      )}

      {/* List */}
      {slice.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-10 text-center">
          <p className="text-sm text-gray-400">Sin resultados para esa búsqueda.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {slice.map((ev) => {
            const company = companyMap[ev.companyId];
            const date = ev.completedAt ?? ev.createdAt;
            const isComplete = ev.status === 'completada';
            return (
              <Link
                key={ev.id}
                href={isComplete ? `/evaluations/${ev.id}/results` : `/evaluations/${ev.id}/diagnose`}
                className="flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-100 shadow-card
                           hover:shadow-card-hover hover:border-brand-200/60 transition-all duration-200 group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    isComplete ? 'bg-brand-50' : 'bg-amber-50'
                  }`}>
                    {isComplete
                      ? <CheckCircle2 className="w-4 h-4 text-brand-600" />
                      : <Clock className="w-4 h-4 text-amber-500" />
                    }
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 leading-tight truncate">
                      {company?.name ?? 'Empresa'}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {isComplete
                        ? `Completado ${formatDate(date as any)}`
                        : `Borrador · ${formatDate(ev.createdAt as any)}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  {isComplete && ev.score != null ? (
                    <>
                      <span className="text-2xl font-bold text-gray-900 tabular-nums">
                        {Math.round(ev.score)}%
                      </span>
                      <MaturityBadge level={ev.maturity as MaturityLevel} />
                    </>
                  ) : (
                    <span className="text-xs text-amber-600 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full font-medium">
                      En progreso
                    </span>
                  )}
                  <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-brand-400 transition-colors" />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Pagination footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-gray-400">
            {filtered.length} registro{filtered.length !== 1 ? 's' : ''} ·{' '}
            página {safePage} de {totalPages}
          </p>
          <div className="flex items-center gap-1">
            <PagButton
              onClick={() => setPage(1)}
              disabled={safePage === 1}
              label="«"
              title="Primera página"
            />
            <PagButton
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              label={<ChevronLeft className="w-3.5 h-3.5" />}
              title="Página anterior"
            />
            {getPages(safePage, totalPages).map((p, i) =>
              p === '…' ? (
                <span key={`ellipsis-${i}`} className="px-1 text-xs text-gray-300 select-none">…</span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p as number)}
                  className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${
                    p === safePage
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {p}
                </button>
              ),
            )}
            <PagButton
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              label={<ChevronRight className="w-3.5 h-3.5" />}
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
        <p className="text-xs text-gray-400 px-1 pt-1 text-right">
          {filtered.length} registro{filtered.length !== 1 ? 's' : ''}
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
      className="w-8 h-8 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-100
                 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center"
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
    <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center">
      <p className="text-gray-500 text-sm font-medium">Sin diagnósticos aún</p>
      <p className="text-sm text-gray-400 mt-1">
        Registra una empresa y realiza tu primer diagnóstico para ver resultados aquí.
      </p>
    </div>
  );
}
