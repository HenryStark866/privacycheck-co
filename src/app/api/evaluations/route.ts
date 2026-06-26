import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/firebase/session';
import { createEvaluation, getMembership } from '@/lib/firebase/firestore-helpers';

export async function POST(request: Request) {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { companyId } = await request.json();
  if (!companyId) return NextResponse.json({ error: 'companyId requerido' }, { status: 400 });

  // Verificar que el usuario puede crear evaluaciones
  const membership = await getMembership(user.uid, companyId);
  if (!membership || !['administrador', 'evaluador'].includes(membership.role)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  const evalId = await createEvaluation({ companyId, createdBy: user.uid });
  return NextResponse.json({ id: evalId });
}
