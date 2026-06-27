/**
 * Firebase Admin SDK (solo servidor — API routes de Next.js)
 * La clave privada NUNCA llega al browser.
 *
 * Inicialización LAZY: ningún código de Firebase se ejecuta al importar
 * el módulo. Esto evita el error en build time de Vercel cuando las
 * variables FIREBASE_ADMIN_* aún no están disponibles.
 */
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth as _getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore as _getFirestore, Firestore } from 'firebase-admin/firestore';

// ─── App lazy ────────────────────────────────────────────────────────────────

function getAdminApp(): App {
  if (getApps().length > 0) return getApps()[0];

  const projectId   = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey  = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Firebase Admin: faltan variables de entorno. ' +
      'Define FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL y FIREBASE_ADMIN_PRIVATE_KEY en Vercel.',
    );
  }

  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

// ─── Proxies (delegación total al SDK real, sin init en module-level) ────────

/**
 * adminAuth: Proxy que crea el Auth de Firebase Admin solo cuando se llama
 * por primera vez (ej. adminAuth.verifyIdToken(...)).
 */
export const adminAuth: Auth = new Proxy({} as Auth, {
  get(_target, prop: string | symbol) {
    const auth = _getAuth(getAdminApp());
    const value = (auth as any)[prop as string];
    return typeof value === 'function' ? value.bind(auth) : value;
  },
});

/**
 * adminDb: Proxy que crea el Firestore de Firebase Admin solo cuando se
 * accede por primera vez (ej. adminDb.collection('companies')).
 */
export const adminDb: Firestore = new Proxy({} as Firestore, {
  get(_target, prop: string | symbol) {
    const db = _getFirestore(getAdminApp());
    const value = (db as any)[prop as string];
    return typeof value === 'function' ? value.bind(db) : value;
  },
});
