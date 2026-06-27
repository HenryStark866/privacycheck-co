import { NextResponse } from 'next/server';
import { createSessionCookie, SESSION_COOKIE, SESSION_DURATION } from '@/lib/firebase/session';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

export async function POST(request: Request) {
  try {
    const { idToken } = await request.json();
    if (!idToken) return NextResponse.json({ error: 'idToken requerido' }, { status: 400 });

    // 1. Verificar token y extraer info del usuario
    const decoded      = await adminAuth.verifyIdToken(idToken);
    const uid          = decoded.uid;
    const email        = decoded.email ?? '';
    const displayName  = ((decoded as any).name ?? email.split('@')[0] ?? '').trim();
    const photoURL     = (decoded as any).picture ?? '';
    const signInProvider = (decoded as any).firebase?.sign_in_provider ?? '';
    const provider     = signInProvider.includes('microsoft') ? 'microsoft' : 'google';

    // 2. Crear session cookie
    const sessionCookie = await createSessionCookie(idToken);

    // 3. Crear o actualizar documento de usuario en Firestore
    const userRef  = adminDb.collection('users').doc(uid);
    const userSnap = await userRef.get();

    let needsOnboarding = false;

    if (!userSnap.exists) {
      // ── Usuario nuevo: crear documento ───────────────────────────────────
      needsOnboarding = true;
      await userRef.set({
        uid,
        email,
        displayName,
        photoURL,
        provider,
        whatsapp: null,
        onboardingComplete: false,
        createdAt:   new Date(),
        updatedAt:   new Date(),
        lastLoginAt: new Date(),
      });
    } else {
      // ── Usuario existente: actualizar último acceso ───────────────────────
      const data = userSnap.data()!;
      needsOnboarding = !data.onboardingComplete || !data.whatsapp;
      await userRef.update({ lastLoginAt: new Date(), updatedAt: new Date() });
    }

    // 4. Respuesta con cookie httpOnly
    const response = NextResponse.json({ status: 'ok', needsOnboarding });
    response.cookies.set(SESSION_COOKIE, sessionCookie, {
      maxAge:   SESSION_DURATION / 1000,
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path:     '/',
    });

    return response;
  } catch (err) {
    console.error('Session error:', err);
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
  }
}
