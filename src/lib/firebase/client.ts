/**
 * Firebase cliente (browser)
 * Credenciales del proyecto: cavaltec-proyect
 * Inicialización LAZY: no se ejecuta en build time / SSR.
 */
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

function getClientApp(): FirebaseApp {
  if (getApps().length) return getApp();
  return initializeApp({
    apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
    authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
    projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
    storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
    appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  });
}

export const auth: Auth = new Proxy({} as Auth, {
  get(_t, prop: string | symbol) {
    const a = getAuth(getClientApp());
    const v = (a as any)[prop as string];
    return typeof v === 'function' ? v.bind(a) : v;
  },
});

export const db: Firestore = new Proxy({} as Firestore, {
  get(_t, prop: string | symbol) {
    const d = getFirestore(getClientApp());
    const v = (d as any)[prop as string];
    return typeof v === 'function' ? v.bind(d) : v;
  },
});

const clientFirebase = { get app() { return getClientApp(); } };
export default clientFirebase as unknown as FirebaseApp;
