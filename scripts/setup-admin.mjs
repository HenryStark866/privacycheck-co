/**
 * scripts/setup-admin.mjs
 *
 * Busca el usuario por email en Firebase Auth (debe haber iniciado sesión
 * con Google al menos una vez para que exista su UID real) y lo configura
 * como ADMINISTRADOR: crea/actualiza el documento Firestore, una empresa
 * demo y la membresía con rol administrador.
 *
 * Uso (correr DESPUÉS de que el usuario haya iniciado sesión con Google):
 *   node --env-file=.env.local scripts/setup-admin.mjs
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// ── Init Admin SDK ────────────────────────────────────────────────────────────
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
if (!process.env.FIREBASE_ADMIN_PROJECT_ID || !process.env.FIREBASE_ADMIN_CLIENT_EMAIL || !privateKey) {
  console.error('❌ Faltan variables FIREBASE_ADMIN_*. Ejecuta: node --env-file=.env.local scripts/setup-admin.mjs');
  process.exit(1);
}
if (!getApps().length) {
  initializeApp({ credential: cert({ projectId: process.env.FIREBASE_ADMIN_PROJECT_ID, clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL, privateKey }) });
}
const auth = getAuth();
const db   = getFirestore();

const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    || 'henrytaborda57@gmail.com';
const ADMIN_WHATSAPP = process.env.ADMIN_WHATSAPP_NUMBER || '+573245769748';
const DEMO_COMPANY   = { name: 'Sintaxis TI S.A.S.', nit: '901000001-1', sector: 'Tecnología', size: 'pequeña' };

async function run() {
  console.log('\n🔧  PrivacyCheck CO — Setup de administrador\n');

  // 1. Buscar usuario REAL en Firebase Auth (debe existir por haber iniciado sesión)
  let uid, displayName;
  try {
    const fbUser = await auth.getUserByEmail(ADMIN_EMAIL);
    uid         = fbUser.uid;
    displayName = fbUser.displayName || ADMIN_EMAIL.split('@')[0];
    console.log(`✓ Usuario encontrado en Firebase Auth`);
    console.log(`  UID      : ${uid}`);
    console.log(`  Email    : ${fbUser.email}`);
    console.log(`  Providers: ${fbUser.providerData.map(p => p.providerId).join(', ') || '(ninguno)'}`);
  } catch {
    console.error(`❌ Usuario "${ADMIN_EMAIL}" no encontrado en Firebase Auth.`);
    console.error('   Inicia sesión con Google en http://localhost:3001 primero y luego vuelve a correr este script.\n');
    process.exit(1);
  }

  // 2. Crear / actualizar documento en Firestore users/{uid}
  const userRef  = db.collection('users').doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    await userRef.set({
      uid, email: ADMIN_EMAIL, displayName,
      provider: 'google', whatsapp: ADMIN_WHATSAPP,
      onboardingComplete: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      lastLoginAt: FieldValue.serverTimestamp(),
    });
    console.log('✓ Documento de usuario creado en Firestore');
  } else {
    await userRef.update({ onboardingComplete: true, whatsapp: ADMIN_WHATSAPP, updatedAt: FieldValue.serverTimestamp() });
    console.log('✓ Documento de usuario actualizado (onboardingComplete: true)');
  }

  // 3. Crear empresa demo si no existe
  const existing = await db.collection('companies').where('nit', '==', DEMO_COMPANY.nit).limit(1).get();
  let companyId;
  if (!existing.empty) {
    companyId = existing.docs[0].id;
    console.log(`✓ Empresa "${DEMO_COMPANY.name}" ya existía (${companyId})`);
  } else {
    const ref = db.collection('companies').doc();
    await ref.set({ ...DEMO_COMPANY, createdBy: uid, createdAt: FieldValue.serverTimestamp() });
    companyId = ref.id;
    console.log(`✓ Empresa "${DEMO_COMPANY.name}" creada (${companyId})`);
  }

  // 4. Crear / garantizar membresía ADMINISTRADOR
  const memRef  = db.collection('memberships').doc(`${uid}_${companyId}`);
  const memSnap = await memRef.get();
  if (!memSnap.exists) {
    await memRef.set({ userId: uid, companyId, role: 'administrador', joinedAt: FieldValue.serverTimestamp() });
    console.log('✓ Membresía ADMINISTRADOR creada');
  } else {
    if (memSnap.data()?.role !== 'administrador') {
      await memRef.update({ role: 'administrador' });
      console.log('✓ Rol actualizado a ADMINISTRADOR');
    } else {
      console.log('✓ Membresía ADMINISTRADOR ya existía');
    }
  }

  console.log('\n✅  Admin configurado exitosamente\n');
  console.log(`  UID      : ${uid}`);
  console.log(`  Email    : ${ADMIN_EMAIL}`);
  console.log(`  WhatsApp : ${ADMIN_WHATSAPP}`);
  console.log(`  Empresa  : ${DEMO_COMPANY.name}`);
  console.log(`  Rol      : administrador`);
  console.log('\n→ Inicia sesión en http://localhost:3001 — verás la empresa en el dashboard.');
  console.log('  Para agregar 20 empresas colombianas de demo: http://localhost:3001/api/seed\n');
}

run().catch(err => { console.error('\n❌ Error:', err.message || err); process.exit(1); });
