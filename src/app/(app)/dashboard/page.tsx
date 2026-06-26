import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Building2, Plus, TrendingUp, CheckCircle2, ChevronRight } from 'lucide-react';
import { verifySession } from '@/lib/firebase/session';
import { getCompaniesByUser, getEvaluationsByCompany } from '@/lib/firebase/firestore-helpers';
import DashboardList from '@/components/DashboardList';

export default async function DashboardPage() {
  const user = await verifySession();
  if (!user) redirect('/login');

  const companies = await getCompaniesByUser(user.uid);

  const evalsByCompany = await Promise.all(
    companies.map((c) => getEvaluationsByCompany(c.id)),
  );

  // Serializar Timestamps de Firestore a strings ISO para pasarlos al cliente
  function serializeTs(ts: any): string {
    if (!ts) return new Date().toISOString();
    if (typeof ts.toDate === 'function') return ts.toDate().toISOString();
    if (typeof ts.seconds === 'number') return new Date(ts.seconds * 1000).toISOString();
    return new Date(ts).toISOString();
  }

  const allEvaluations = evalsByCompany
    .flat()
    .sort((a, b) => {
      const toMs = (ts: any) => ts?.toMillis?.() ?? ts?.seconds * 1000 ?? new Date(ts).getTime() ?? 0;
      return toMs(b.createdAt) - toMs(a.createdAt);
    })
    .map((ev) => ({
      id: ev.id,
      companyId: ev.companyId,
      status: ev.status,
      score: ev.score ?? null,
      maturity: ev.maturity ?? null,
      createdAt: serializeTs(ev.createdAt),
      completedAt: ev.completedAt ? serializeTs(ev.completedAt) : null,
    }));

  const completed = allEvaluations.filter((e) => e.status === 'completada');
  const avgScore = completed.length
    ? Math.round(completed.reduce((s, e) => s + (e.score ?? 0), 0) / completed.length)
    : null;

  const companiesPlain = companies.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">Resumen de cumplimiento Ley 1581 de 2012</p>
        </div>
        <Link href="/companies/new" className="btn-primary">
          <Plus className="w-4 h-4" /> Nueva empresa
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          icon={<Building2 className="w-5 h-5" />}
          label="Empresas registradas"
          value={companies.length}
          color="blue"
        />
        <StatCard
          icon={<CheckCircle2 className="w-5 h-5" />}
          label="Diagnósticos completados"
          value={completed.length}
          color="green"
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="Puntaje promedio"
          value={avgScore != null ? `${avgScore}%` : '—'}
          color="amber"
          accent={avgScore != null}
          score={avgScore}
        />
      </div>

      {/* Diagnósticos con buscador + paginación */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900 tracking-tight">Diagnósticos</h2>
          {companies.length > 0 && (
            <Link href="/companies" className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1">
              Ver empresas <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>

        <DashboardList
          evaluations={allEvaluations}
          companies={companiesPlain}
        />
      </section>
    </div>
  );
}

function StatCard({
  icon, label, value, color, accent, score,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: 'blue' | 'green' | 'amber';
  accent?: boolean;
  score?: number | null;
}) {
  const colors = {
    blue:  { bg: 'bg-blue-50',  icon: 'text-blue-600'  },
    green: { bg: 'bg-green-50', icon: 'text-green-600' },
    amber: { bg: 'bg-amber-50', icon: 'text-amber-600' },
  }[color];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${colors.bg}`}>
          <span className={colors.icon}>{icon}</span>
        </div>
        <p className="text-xs font-medium text-gray-500 leading-tight">{label}</p>
      </div>
      <p className="text-2xl font-bold text-gray-900 tabular-nums">{value}</p>
      {accent && score != null && (
        <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-700"
            style={{ width: `${score}%` }}
          />
        </div>
      )}
    </div>
  );
}
