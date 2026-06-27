// Recrea el documento Firestore del usuario real (cuyo UID ya tiene membresías)
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
if (!getApps().length) {
  initializeApp({ credential: cert({ projectId: process.env.FIREBASE_ADMIN_PROJECT_ID, clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL, privateKey }) });
}
const auth = getAuth();
const db   = getFirestore();

const REAL_UID       = 'oxzs9fFV9hP7aMAHZQYdLzcrAK32';
const ADMIN_WHATSAPP = process.env.ADMIN_WHATSAPP_NUMBER || '+573245769748';

async function run() {
  // Obtener info real del usuario desde Firebase Auth
  const fbUser    = await auth.getUser(REAL_UID);
  const email     = fbUser.email       || '';
  const name      = fbUser.displayName || email.split('@')[0];
  const providers = fbUser.providerData.map(p => p.providerId);

  console.log('\n👤  Usuario en Firebase Auth:');
  console.log(`  UID       : ${REAL_UID}`);
  console.log(`  Email     : ${email}`);
  console.log(`  Nombre    : ${name}`);
  console.log(`  Providers : ${providers.join(', ')}`);

  // Contar membresías actuales
  const mems = await db.collection('memberships').where('userId', '==', REAL_UID).get();
  console.log(`  Membresías: ${mems.size} empresas como administrador`);

  // Crear/restaurar documento de usuario
  const userRef = db.collection('users').doc(REAL_UID);
  await userRef.set({
    uid:                REAL_UID,
    email,
    displayName:        name,
    provider:           providers.includes('google.com') ? 'google' : providers[0] || 'unknown',
    whatsapp:           ADMIN_WHATSAPP,
    onboardingComplete: true,
    createdAt:          FieldValue.serverTimestamp(),
    updatedAt:          FieldValue.serverTimestamp(),
    lastLoginAt:        FieldValue.serverTimestamp(),
  }, { merge: true });

  console.log('\n✅  Documento Firestore users/' + REAL_UID + ' restaurado');
  console.log('   onboardingComplete: true → no redirigirá a onboarding al iniciar sesión\n');

  // Agregar también membresía a Sintaxis TI si no existe
  const sinTI = await db.collection('companies').where('nit', '==', '901000001-1').limit(1).get();
  if (!sinTI.empty) {
    const cid    = sinTI.docs[0].id;
    const memRef = db.collection('memberships').doc(`${REAL_UID}_${cid}`);
    if (!(await memRef.get()).exists) {
      await memRef.set({ userId: REAL_UID, companyId: cid, role: 'administrador', joinedAt: FieldValue.serverTimestamp() });
      console.log('✓ Membresía ADMINISTRADOR en "Sintaxis TI S.A.S." agregada');
    } else {
      console.log('✓ Membresía en "Sintaxis TI S.A.S." ya existía');
    }
  }
}

run().catch(e => { console.error('Error:', e.message); process.exit(1); });
