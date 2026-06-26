/**
 * Helpers para manejar la sesión del usuario via cookies HTTP-only.
 * Firebase Auth en el cliente genera un ID Token → lo enviamos al servidor
 * → el servidor lo verifica con Admin SDK y crea una session cookie.
 */
import { adminAuth } from './admin';
import { cookies } from 'next/headers';

const SESSION_COOKIE = '__session';
const SESSION_DURATION = 60 * 60 * 24 * 5 * 1000; // 5 días en ms

/** Crea la session cookie a partir del ID Token del cliente */
export async function createSessionCookie(idToken: string): Promise<string> {
  return adminAuth.createSessionCookie(idToken, { expiresIn: SESSION_DURATION });
}

/** Verifica la session cookie y devuelve el DecodedIdToken o null */
export async function verifySession(): Promise<{ uid: string; email?: string } | null> {
  try {
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE)?.value;
    if (!sessionCookie) return null;
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    return { uid: decoded.uid, email: decoded.email };
  } catch {
    return null;
  }
}

export { SESSION_COOKIE, SESSION_DURATION };
