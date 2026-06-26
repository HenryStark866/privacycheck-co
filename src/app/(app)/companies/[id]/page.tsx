import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Building2, Users, Clock } from 'lucide-react';
import { verifySession } from '@/lib/firebase/session';
import {
  getCompany, getMembership, getEvaluationsByCompany, getMembersByCompany,
} from '@/lib/firebase/firestore-helpers';
import MaturityBadge from '@/components/MaturityBadge';
import type { MaturityLevel } from '@/lib/scoring';
import { formatDate } from '@/lib/utils';
import NewEvaluationButton from '@/components/NewEvaluationButton';
import RNBDStatus from '@/components/RNBDStatus';

export default async function CompanyDetailPage({ params }: { params: { id: string } }) {
  const user = await verifySession();
  if (!user) redirect('/login');

  const [membership, company, evaluations, members] = await Promise.all([
    getMembership(user.uid, params.id),
    getCompany(params.id),
    getEvaluationsByCompany(params.id),
    getMembersByCompany(params.id),
  ]);

  if (!membership || !company) notFound();

  const canEdit = ['administrador', 'evaluador'].includes(membership.role);

  return (
    <div className="space-y-6">
      {/* Header empresa */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-brand-50 flex items-center justify-center shrink-0">
            <Building2 className="w-6 h-6 text-brand-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{company.name}</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {company.nit && `NIT ${company.nit} · `}
              {company.sector && `${company.sector} · `}
              <span className="capitalize">{company.size}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-brand-700 bg-brand-50 border border-brand-100 rounded-full px-3 py-1.5 capitalize font-medium">
            {membership.role}
          </span>
          {canEdit && <NewEvaluationButton companyId={params.id} />}
        </div>
      </div>

      {/* Historial */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-3 tracking-tight">Historial de diagnósticos</h2>
        {!evaluations.length ? (
          <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center">
            <p className="text-gray-500 text-sm">Aún no hay diagnósticos para esta empresa.</p>
            {canEdit && <NewEvaluationButton companyId={params.id} className="mt-4" />}
          </div>
        ) : (
          <div className="space-y-2">
            {evaluations.map((ev) => (
              <Link
                key={ev.id}
                href={ev.status === 'completada' ? `/evaluations/${ev.id}/results` : `/evaluations/${ev.id}/diagnose`}
                className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 shadow-card p-4 hover:shadow-card-hover hover:border-brand-200/60 transition-all duration-200 group"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Diagnóstico del {formatDate(ev.createdAt as any)}
                  </p>
                  {ev.status === 'completada' && ev.blockA != null && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      A: {ev.blockA}% · B: {ev.blockB}% · C: {ev.blockC}%
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {ev.status === 'completada' && ev.score != null ? (
                    <>
                      <span className="text-xl font-bold text-gray-900 tabular-nums">{Math.round(ev.score)}%</span>
                      <MaturityBadge level={ev.maturity as MaturityLevel} />
                    </>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full font-medium">
                      <Clock className="w-3 h-3" /> Borrador
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-brand-400 transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* RNBD */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-card p-6">
        <RNBDStatus
          companyId={params.id}
          nit={company.nit}
          razonSocial={company.name}
        />
      </section>

      {/* Miembros */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-3 tracking-tight flex items-center gap-2">
          <Users className="w-4 h-4 text-gray-400" /> Miembros
        </h2>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-card divide-y divide-gray-50">
          {members.map((m) => (
            <div key={m.id} className="flex items-center justify-between px-4 py-3">
              <p className="text-xs font-mono text-gray-500">{m.userId}</p>
              <span className="text-xs capitalize text-gray-400 bg-gray-50 border border-gray-100 px-2.5 py-1 rounded-full">
                {m.role}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
