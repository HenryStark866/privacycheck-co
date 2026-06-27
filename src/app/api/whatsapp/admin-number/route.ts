import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/firebase/session';
import { adminDb } from '@/lib/firebase/admin';
import { logActivity } from '@/lib/firebase/firestore-helpers';

const DEFAULT_ADMIN_NUMBER = process.env.ADMIN_WHATSAPP_NUMBER || '573245769748';

// GET: número admin global + fecha/hora de la última actualización
export async function GET() {
  try {
    const user = await verifySession();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const doc = await adminDb.collection('settings').doc('whatsapp').get();
    const data = doc.exists ? doc.data() : null;
    const updatedAt = data?.updatedAt?.toDate?.()?.toISOString() ?? null;

    return NextResponse.json({
      ok: true,
      adminNumber: data?.adminNumber || DEFAULT_ADMIN_NUMBER,
      updatedAt,
      updatedBy: data?.updatedBy ?? null,
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

// POST: guardar/actualizar el número admin global (con trazabilidad)
export async function POST(request: Request) {
  try {
    const user = await verifySession();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { adminNumber } = await request.json();
    if (adminNumber === undefined) {
      return NextResponse.json({ error: 'adminNumber es requerido' }, { status: 400 });
    }

    const value = String(adminNumber).replace(/\D/g, '');
    const now = new Date();

    await adminDb.collection('settings').doc('whatsapp').set({
      adminNumber: value,
      updatedBy: user.uid,
      updatedByEmail: user.email ?? null,
      updatedAt: now,
    }, { merge: true });

    // Trazabilidad de uso
    await logActivity(user.uid, 'whatsapp_admin_number_updated', { adminNumber: value });

    return NextResponse.json({ ok: true, adminNumber: value, updatedAt: now.toISOString() });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
