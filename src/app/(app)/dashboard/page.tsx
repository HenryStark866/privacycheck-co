import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Building2, Plus, TrendingUp, CheckCircle2, ChevronRight, Activity } from 'lucide-react';
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
      const toMs = (ts: any) => ts?.toMillis?.() ?? (ts?.seconds != null ? ts.seconds * 1000 : null) ?? (ts ? new Date(ts).getTime() : 0);
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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-brand-500" />
            <span className="text-[10px] text-brand-600 uppercase tracking-[0.2em] font-bold">Módulo de Telemetría</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Panel de Control</h1>
          <p className="text-slate-500 text-sm mt-1 font-light tracking-wide">Visión general del estado de cumplimiento Ley 1581</p>
        </div>
        <Link href="/companies/new" className="btn-primary group">
          <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" /> Nueva Entidad
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <StatCard
          icon={<Building2 className="w-5 h-5" />}
          label="Entidades Analizadas"
          value={companies.length}
          color="blue"
        />
        <StatCard
          icon={<CheckCircle2 className="w-5 h-5" />}
          label="Diagnósticos Completados"
          value={completed.length}
          color="green"
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="Índice Promedio"
          value={avgScore != null ? `${avgScore}%` : '—'}
          color="cyan"
          accent={avgScore != null}
          score={avgScore}
        />
      </div>

      {/* Diagnósticos con buscador + paginación */}
      <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 mt-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-brand-50 rounded-full blur-[80px] pointer-events-none" />
        
        <div className="flex items-center justify-between mb-6 relative z-10">
          <h2 className="text-lg font-semibold text-slate-800 tracking-wide flex items-center gap-2">
            <span className="w-1.5 h-6 bg-brand-500 rounded-full shadow-sm" />
            Registro de Diagnósticos
          </h2>
          {companies.length > 0 && (
            <Link href="/companies" className="text-xs text-brand-600 hover:text-brand-500 font-medium flex items-center gap-1 uppercase tracking-wider group">
              Explorar Entidades <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          )}
        </div>

        <div className="relative z-10">
          <DashboardList
            evaluations={allEvaluations}
            companies={companiesPlain}
          />
        </div>
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
  color: 'blue' | 'green' | 'cyan';
  accent?: boolean;
  score?: number | null;
}) {
  const colors = {
    blue:  { bg: 'bg-blue-50 border-blue-100',  icon: 'text-blue-500', bar: 'from-blue-400 to-blue-500'  },
    green: { bg: 'bg-emerald-50 border-emerald-100', icon: 'text-emerald-500', bar: 'from-emerald-400 to-emerald-500' },
    cyan:  { bg: 'bg-brand-50 border-brand-100', icon: 'text-brand-500', bar: 'from-brand-400 to-brand-500' },
  }[color];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 relative overflow-hidden group hover:-translate-y-1 hover:shadow-md transition-all duration-300 shadow-sm">
      <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-[40px] opacity-40 group-hover:opacity-60 transition-opacity duration-500 ${colors.bg.split(' ')[0]}`} />
      
      <div className="flex items-center gap-4 mb-4 relative z-10">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${colors.bg}`}>
          <span className={colors.icon}>{icon}</span>
        </div>
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest leading-tight">{label}</p>
      </div>
      
      <p className="text-4xl font-bold text-slate-900 tabular-nums tracking-tight relative z-10">{value}</p>
      
      {accent && score != null && (
        <div className="mt-5 h-1.5 bg-slate-100 rounded-full overflow-hidden relative z-10 border border-slate-200">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${colors.bar} transition-all duration-1000 ease-out relative`}
            style={{ width: `${score}%` }}
          >
            <div className="absolute top-0 right-0 bottom-0 w-4 bg-white/30 blur-[2px]" />
          </div>
        </div>
      )}
    </div>
  );
}
