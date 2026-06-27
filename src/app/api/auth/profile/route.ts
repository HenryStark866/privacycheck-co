import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/firebase/session';
import { adminDb } from '@/lib/firebase/admin';
import { sendWelcomeMessage } from '@/lib/whatsapp';

/** PATCH /api/auth/profile — guarda WhatsApp y marca onboarding completo */
export async function PATCH(request: Request) {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const body = await request.json();
    const raw  = (body.whatsapp ?? '').toString().replace(/\s+/g, '');

    // Normalizar a +57XXXXXXXXXX
    const cleaned = raw.startsWith('+') ? raw
                  : raw.startsWith('57') ? `+${raw}`
                  : `+57${raw}`;

    if (!/^\+\d{10,15}$/.test(cleaned)) {
      return NextResponse.json(
        { error: 'Número de WhatsApp inválido. Ej: 3001234567' },
        { status: 400 }
      );
    }

    // Guardar en Firestore
    const userRef = adminDb.collection('users').doc(session.uid);
    await userRef.update({
      whatsapp:           cleaned,
      onboardingComplete: true,
      updatedAt:          new Date(),
    });

    // Obtener displayName para el mensaje de bienvenida
    const userSnap    = await userRef.get();
    const displayName = userSnap.data()?.displayName ?? session.email?.split('@')[0] ?? 'Usuario';

    // Enviar bienvenida por WhatsApp (falla silenciosamente si OpenWA no está activo)
    const welcomed = await sendWelcomeMessage(cleaned, displayName);

    return NextResponse.json({ status: 'ok', whatsapp: cleaned, welcomed });
  } catch (err) {
    console.error('Profile error:', err);
    return NextResponse.json({ error: 'Error al guardar perfil' }, { status: 500 });
  }
}

/** GET /api/auth/profile — devuelve el perfil del usuario actual */
export async function GET() {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const doc = await adminDb.collection('users').doc(session.uid).get();
    if (!doc.exists) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    const data = doc.data()!;
    // No devolver campos sensibles innecesarios
    return NextResponse.json({
      uid:                data.uid,
      email:              data.email,
      displayName:        data.displayName,
      photoURL:           data.photoURL,
      whatsapp:           data.whatsapp,
      onboardingComplete: data.onboardingComplete,
      provider:           data.provider,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Error al obtener perfil' }, { status: 500 });
  }
}
