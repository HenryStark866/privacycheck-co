import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/firebase/session';
import { canManageCompany, getUserByEmail, createMembership } from '@/lib/firebase/firestore-helpers';

const ROLES = ['administrador', 'evaluador', 'auditor'] as const;

// POST: asignar un asesor (por email) a la empresa con un rol
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!(await canManageCompany(user.uid, params.id))) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  const { email, role } = await request.json();
  if (!email?.trim()) return NextResponse.json({ error: 'Correo requerido' }, { status: 400 });

  const finalRole = (ROLES as readonly string[]).includes(role) ? role : 'evaluador';
  const target = await getUserByEmail(email);
  if (!target) {
    return NextResponse.json(
      { error: 'No existe un usuario con ese correo. El asesor debe registrarse primero.' },
      { status: 404 },
    );
  }

  await createMembership(target.uid, params.id, finalRole);
  return NextResponse.json({ ok: true, uid: target.uid });
}
