'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Building2, ChevronRight, ChevronLeft, Search, AlertCircle } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface CompanyItem {
  id: string;
  name: string;
  nit?: string;
  sector?: string;
  size?: string;
  role?: string;
  createdAt: string;
}

const PER_PAGE_OPTIONS = [5, 10, 25, 50] as const;

export default function CompaniesList({ companies }: { companies: CompanyItem[] }) {
  const [query, setQuery] = useState('');
  const [perPage, setPerPage] = useState<number>(10);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter((c) =>
      [c.name, c.nit, c.sector, c.size].some((v) => (v ?? '').toLowerCase().includes(q)),
    );
  }, [companies, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, totalPages);
  const slice = filtered.slice((safePage - 1) * perPage, safePage * perPage);

  if (!companies.length) {
    return (
      <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gray-50 mb-3">
          <Building2 className="w-6 h-6 text-gray-300" />
        </div>
        <p className="text-gray-700 font-semibold text-sm">No hay empresas registradas</p>
        <p className="text-sm text-gray-400 mt-1">Registra tu primera empresa para iniciar el diagnóstico.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar: buscador + límite */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="search"
            placeholder="Buscar por nombre, NIT o sector…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all shadow-sm"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-widest hidden sm:block">Límite</span>
          <select
            value={perPage}
            onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
            className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all appearance-none cursor-pointer shadow-sm min-w-[70px] text-center"
          >
            {PER_PAGE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      {query && (
        <p className="text-[11px] text-brand-600 px-1 font-medium tracking-wide">
          {filtered.length} RESULTADO{filtered.length !== 1 ? 'S' : ''}
        </p>
      )}

      {/* Lista */}
      {slice.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 py-12 text-center flex flex-col items-center shadow-sm">
          <AlertCircle className="w-8 h-8 text-slate-400 mb-3 opacity-60" />
          <p className="text-sm text-slate-500">Sin resultados para la búsqueda.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {slice.map((company) => (
            <Link
              key={company.id}
              href={`/companies/${company.id}`}
              className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 shadow-card p-4 hover:shadow-card-hover hover:border-brand-200/60 transition-all duration-200 group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5 text-brand-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{company.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                    {company.nit && `NIT: ${company.nit} · `}
                    {company.sector && `${company.sector} · `}
                    Creada {formatDate(company.createdAt as any)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {company.role && (
                  <span className="text-[11px] text-brand-700 bg-brand-50 border border-brand-100 px-2.5 py-1 rounded-full capitalize font-medium hidden sm:inline">
                    {company.role}
                  </span>
                )}
                <span className="text-xs text-gray-400 bg-gray-50 border border-gray-100 px-2.5 py-1 rounded-full capitalize">
                  {company.size ?? 'empresa'}
                </span>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-brand-400 transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-3 border-t border-slate-200">
          <p className="text-[11px] font-medium text-slate-500 uppercase tracking-widest">
            {filtered.length} Total · Pág {safePage}/{totalPages}
          </p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 border border-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center bg-white shadow-sm"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-[13px] font-medium text-slate-600 px-2 tabular-nums">{safePage} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 border border-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center bg-white shadow-sm"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
