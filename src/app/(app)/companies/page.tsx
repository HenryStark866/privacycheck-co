import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { verifySession } from '@/lib/firebase/session';
import { getSystemRole, getCompaniesByUser } from '@/lib/firebase/firestore-helpers';
import CompaniesList from '@/components/CompaniesList';

function serializeTs(ts: any): string {
  if (!ts) return new Date().toISOString();
  if (typeof ts.toDate === 'function') return ts.toDate().toISOString();
  if (typeof ts.seconds === 'number') return new Date(ts.seconds * 1000).toISOString();
  return new Date(ts).toISOString();
}

export default async function CompaniesPage() {
  const user = await verifySession();
  if (!user) redirect('/login');

  const systemRole = await getSystemRole(user.uid);
  const companies = await getCompaniesByUser(user.uid, systemRole);

  const plain = companies.map((c) => ({
    id: c.id,
    name: c.name,
    nit: c.nit ?? '',
    sector: c.sector ?? '',
    size: c.size ?? '',
    role: (c as any).role ?? '',
    createdAt: serializeTs(c.createdAt),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Empresas</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {systemRole === 'admin'
              ? 'Todas las organizaciones del sistema'
              : 'Gestiona las organizaciones que diagnosticas'}
          </p>
        </div>
        <Link href="/companies/new" className="btn-primary">
          <Plus className="w-4 h-4" /> Nueva empresa
        </Link>
      </div>

      <CompaniesList companies={plain} />
    </div>
  );
}
