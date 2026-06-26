import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/firebase/session';
import { createCompany, createMembership } from '@/lib/firebase/firestore-helpers';

export async function POST(request: Request) {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await request.json();
  const { name, nit, sector, size } = body;

  if (!name?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });

  const companyId = await createCompany({ name, nit, sector, size, createdBy: user.uid });
  await createMembership(user.uid, companyId, 'administrador');

  return NextResponse.json({ id: companyId });
}
