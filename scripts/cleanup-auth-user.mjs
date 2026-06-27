// Limpia el usuario creado sin proveedor para que Google login no tenga conflicto
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
if (!getApps().length) {
  initializeApp({ credential: cert({ projectId: process.env.FIREBASE_ADMIN_PROJECT_ID, clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL, privateKey }) });
}
const auth = getAuth();
const db   = getFirestore();

const UID_TO_CLEAN = 'nD9jmLOsqaa3E1LEOknaqAwoanA2'; // UID del usuario creado sin proveedor

async function cleanup() {
  // Borrar de Firebase Auth
  try {
    await auth.deleteUser(UID_TO_CLEAN);
    console.log('✓ Usuario eliminado de Firebase Auth');
  } catch (e) {
    console.log('  Auth: ya no existe —', e.code);
  }

  // Borrar user doc de Firestore
  try {
    await db.collection('users').doc(UID_TO_CLEAN).delete();
    console.log('✓ Documento users/' + UID_TO_CLEAN + ' eliminado de Firestore');
  } catch (e) {
    console.log('  Firestore user doc: error —', e.message);
  }

  // Borrar membresías huérfanas de ese UID
  const mems = await db.collection('memberships').where('userId', '==', UID_TO_CLEAN).get();
  for (const doc of mems.docs) {
    await doc.ref.delete();
    console.log('✓ Membresía huérfana eliminada:', doc.id);
  }

  console.log('\nListo. Ahora puedes iniciar sesión con Google sin conflictos.\n');
}

cleanup().catch(e => { console.error('Error:', e.message); process.exit(1); });
