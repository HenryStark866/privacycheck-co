import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/firebase/session';
import { adminDb, adminAuth } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

// PATCH: Actualizar rol o estado de aprobación
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const userSnap = await adminDb.collection('users').doc(user.uid).get();
  if (userSnap.data()?.systemRole !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { systemRole, isApproved, displayName, whatsapp } = await request.json();
  const updateData: any = { updatedAt: FieldValue.serverTimestamp() };
  if (systemRole !== undefined) updateData.systemRole = systemRole;
  if (isApproved !== undefined) updateData.isApproved = isApproved;
  if (displayName !== undefined) updateData.displayName = displayName;
  if (whatsapp !== undefined) updateData.whatsapp = whatsapp;

  try {
    if (displayName !== undefined) {
      await adminAuth.updateUser(params.id, { displayName });
    }
    await adminDb.collection('users').doc(params.id).update(updateData);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE: Eliminar usuario
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const userSnap = await adminDb.collection('users').doc(user.uid).get();
  if (userSnap.data()?.systemRole !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    // Eliminar de Firebase Auth
    await adminAuth.deleteUser(params.id);
    // Eliminar de Firestore
    await adminDb.collection('users').doc(params.id).delete();
    // Podríamos eliminar membresías, pero con borrar el usuario basta por ahora.
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
