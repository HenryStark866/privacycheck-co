import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Building2, Plus, ChevronRight } from 'lucide-react';
import { verifySession } from '@/lib/firebase/session';
import { adminDb } from '@/lib/firebase/admin';
import { getCompaniesByUser } from '@/lib/firebase/firestore-helpers';
import { formatDate } from '@/lib/utils';

export default async function CompaniesPage() {
  const user = await verifySession();
  if (!user) redirect('/login');

  const userSnap = await adminDb.collection('users').doc(user.uid).get();
  const systemRole = userSnap.data()?.systemRole;

  const companies = await getCompaniesByUser(user.uid, systemRole);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Empresas</h1>
          <p className="text-gray-500 text-sm mt-0.5">Gestiona las organizaciones que diagnosticas</p>
        </div>
        <Link href="/companies/new" className="btn-primary">
          <Plus className="w-4 h-4" /> Nueva empresa
        </Link>
      </div>

      {companies.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gray-50 mb-3">
            <Building2 className="w-6 h-6 text-gray-300" />
          </div>
          <p className="text-gray-700 font-semibold text-sm">No hay empresas registradas</p>
          <p className="text-sm text-gray-400 mt-1">Registra tu primera empresa para iniciar el diagnóstico.</p>
          <Link href="/companies/new" className="btn-primary mt-5">
            <Plus className="w-4 h-4" /> Registrar primera empresa
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {companies.map((company) => (
            <Link
              key={company.id}
              href={`/companies/${company.id}`}
              className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 shadow-card p-4 hover:shadow-card-hover hover:border-brand-200/60 transition-all duration-200 group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5 text-brand-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{company.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {company.nit && `NIT: ${company.nit} · `}
                    {company.sector && `${company.sector} · `}
                    Creada {formatDate(company.createdAt as any)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400 bg-gray-50 border border-gray-100 px-2.5 py-1 rounded-full capitalize">
                  {company.size ?? 'empresa'}
                </span>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-brand-400 transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}