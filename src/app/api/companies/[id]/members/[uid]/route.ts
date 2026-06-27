import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/firebase/session';
import { canManageCompany, deleteMembership } from '@/lib/firebase/firestore-helpers';

// DELETE: quitar un asesor de la empresa
export async function DELETE(_request: Request, { params }: { params: { id: string; uid: string } }) {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!(await canManageCompany(user.uid, params.id))) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  await deleteMembership(params.uid, params.id);
  return NextResponse.json({ ok: true });
}
