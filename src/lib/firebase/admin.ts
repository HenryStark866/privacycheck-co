/**
 * Firebase Admin SDK (solo servidor — API routes de Next.js)
 * La clave privada NUNCA llega al browser.
 */
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';

function initAdmin(): App {
  if (getApps().length > 0) return getApps()[0];

  return initializeApp({
    credential: cert({
      projectId:   process.env.FIREBASE_ADMIN_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
      // Los \n literales del .env se convierten a saltos de línea reales
      privateKey:  process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const adminApp = initAdmin();

export const adminAuth = getAdminAuth(adminApp);
export const adminDb   = getAdminFirestore(adminApp);
