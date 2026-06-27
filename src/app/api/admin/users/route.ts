import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/firebase/session';
import { adminDb, adminAuth } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

// GET: Listar todos los usuarios
export async function GET() {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const userSnap = await adminDb.collection('users').doc(user.uid).get();
  if (userSnap.data()?.systemRole !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const snapshot = await adminDb.collection('users').orderBy('createdAt', 'desc').get();
  const users = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      // Convertir Timestamps a strings
      createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      lastLoginAt: data.lastLoginAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    };
  });

  return NextResponse.json({ users });
}

// POST: Crear usuario manualmente
export async function POST(request: Request) {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const userSnap = await adminDb.collection('users').doc(user.uid).get();
  if (userSnap.data()?.systemRole !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { email, password, displayName, systemRole, isApproved } = await request.json();

  if (!email || !password) {
    return NextResponse.json({ error: 'Email y contraseña requeridos' }, { status: 400 });
  }

  try {
    // 1. Crear usuario en Firebase Auth
    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName,
    });

    // 2. Crear documento en Firestore
    await adminDb.collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email,
      displayName,
      photoURL: '',
      provider: 'email',
      whatsapp: null,
      systemRole: systemRole || 'user',
      isApproved: isApproved ?? true,
      onboardingComplete: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      lastLoginAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true, uid: userRecord.uid });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
