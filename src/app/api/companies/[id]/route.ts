import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/firebase/session';
import { canManageCompany, updateCompany, deleteCompany } from '@/lib/firebase/firestore-helpers';

// PATCH: editar datos de la empresa (admin global o administrador de la empresa)
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!(await canManageCompany(user.uid, params.id))) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  const { name, nit, sector, size } = await request.json();
  if (name !== undefined && !String(name).trim()) {
    return NextResponse.json({ error: 'El nombre no puede estar vacío' }, { status: 400 });
  }

  await updateCompany(params.id, { name, nit, sector, size });
  return NextResponse.json({ ok: true });
}

// DELETE: eliminar la empresa (cascada: membresías + evaluaciones)
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!(await canManageCompany(user.uid, params.id))) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  await deleteCompany(params.id);
  return NextResponse.json({ ok: true });
}
