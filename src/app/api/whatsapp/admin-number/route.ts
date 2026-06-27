import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/firebase/session';
import { adminDb } from '@/lib/firebase/admin';

export async function GET() {
  try {
    const user = await verifySession();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const settingsDoc = await adminDb.collection('settings').doc('whatsapp').get();
    const adminNumber = settingsDoc.exists ? settingsDoc.data()?.adminNumber : '';

    return NextResponse.json({
      ok: true,
      adminNumber: adminNumber || process.env.ADMIN_WHATSAPP_NUMBER || '',
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await verifySession();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { adminNumber } = await request.json();
    if (adminNumber === undefined) {
      return NextResponse.json({ error: 'adminNumber es requerido' }, { status: 400 });
    }

    await adminDb.collection('settings').doc('whatsapp').set({
      adminNumber: adminNumber.trim(),
      updatedBy: user.uid,
      updatedAt: new Date(),
    }, { merge: true });

    return NextResponse.json({ ok: true, adminNumber });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
