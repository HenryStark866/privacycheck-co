import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ClipboardCheck, Clock, ChevronRight, Building2, Plus, BarChart2 } from 'lucide-react';
import { verifySession } from '@/lib/firebase/session';
import { getSystemRole, getAllEvaluations, getCompaniesByUser } from '@/lib/firebase/firestore-helpers';
import MaturityBadge from '@/components/MaturityBadge';
import type { MaturityLevel } from '@/lib/scoring';
import { formatDate } from '@/lib/utils';

import StartEvaluationModalButton from '@/components/StartEvaluationModalButton';

function serializeTs(ts: any): string {
  if (!ts) return new Date().toISOString();
  if (typeof ts.toDate === 'function') return ts.toDate().toISOString();
  if (typeof ts.seconds === 'number') return new Date(ts.seconds * 1000).toISOString();
  return new Date(ts).toISOString();
}

export default async function EvaluationsPage() {
  const user = await verifySession();
  if (!user) redirect('/login');

  const systemRole = await getSystemRole(user.uid);
  const [evaluations, userCompanies] = await Promise.all([
    getAllEvaluations(user.uid, systemRole),
    getCompaniesByUser(user.uid, systemRole),
  ]);

  const plainCompanies = userCompanies.map((c) => ({
    id: c.id,
    name: c.name,
    nit: c.nit ?? '',
  }));

  const plainEvals = evaluations.map((ev) => ({
    id: ev.id,
    companyId: ev.companyId,
    companyName: ev.companyName || 'Empresa',
    status: ev.status,
    score: ev.score,
    blockA: ev.blockA,
    blockB: ev.blockB,
    blockC: ev.blockC,
    maturity: ev.maturity,
    createdAt: serializeTs(ev.createdAt),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-brand-600" />
            Diagnósticos y Evaluaciones
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {systemRole === 'admin'
              ? 'Todos los autodiagnósticos de Ley 1581 en el sistema'
              : 'Gestión y seguimiento de diagnósticos de tus organizaciones'}
          </p>
        </div>
        <StartEvaluationModalButton companies={plainCompanies} />
      </div>

      {!plainEvals.length ? (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-brand-50 mx-auto flex items-center justify-center text-brand-600">
            <BarChart2 className="w-6 h-6" />
          </div>
          <p className="text-slate-700 font-medium text-base">No hay autodiagnósticos registrados aún.</p>
          <p className="text-slate-400 text-xs max-w-sm mx-auto">
            Ingresa a una entidad desde la sección de Entidades para iniciar una nueva evaluación de la Ley 1581.
          </p>
          {userCompanies.length > 0 && (
            <Link
              href="/companies"
              className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors mt-2"
            >
              Ver Entidades
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {plainEvals.map((ev) => (
            <Link
              key={ev.id}
              href={ev.status === 'completada' ? `/evaluations/${ev.id}/results` : `/evaluations/${ev.id}/diagnose`}
              className="flex items-center justify-between bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:shadow-md hover:border-brand-300 transition-all duration-200 group"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-brand-50 group-hover:text-brand-600 transition-colors">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">{ev.companyName}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Evaluación realizada el {formatDate(ev.createdAt as any)}
                  </p>
                  {ev.status === 'completada' && ev.blockA != null && (
                    <p className="text-[11px] text-slate-400 mt-1 font-mono">
                      Org: {ev.blockA}% · Datos: {ev.blockB}% · Seg: {ev.blockC}%
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4">
                {ev.status === 'completada' && ev.score != null ? (
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-bold text-slate-900 tabular-nums">{Math.round(ev.score)}%</span>
                    <MaturityBadge level={ev.maturity as MaturityLevel} />
                  </div>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full font-semibold">
                    <Clock className="w-3.5 h-3.5" /> Borrador pendiente
                  </span>
                )}
                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-brand-500 transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
