/**
 * Prueba end-to-end de los poderes de admin global en PRODUCCIÓN.
 * Crea usuarios de prueba + una empresa que el admin NO posee y verifica:
 *  A) admin edita una empresa de la que no es miembro      → 200
 *  B) un no-miembro / no-admin recibe                       → 403
 *  C) admin asigna un asesor por correo                     → 200
 *  D) admin quita un asesor                                 → 200
 *  E) admin elimina la empresa (cascada)                    → 200
 * Limpia todos los datos de prueba al terminar.
 *
 * Uso: node --env-file=.env.local scripts/verify-admin-flow.mjs
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const PROD = 'https://privacycheck-co.vercel.app';
const ADMIN_EMAIL = 'henry.taborda866@pascualbravo.edu.co';
const ADMIN_PASS = 'Cavaltec2026*';
const ASESOR = 'rbac-asesor1@example.com';
const ASESOR2 = 'rbac-asesor2@example.com';
const PASS = 'Test123456!';

const pk = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_ADMIN_PROJECT_ID, clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL, privateKey: pk }) });
const auth = getAuth();
const db = getFirestore();

let pass = 0, fail = 0;
function check(cond, label) { if (cond) { console.log(`   ✓ ${label}`); pass++; } else { console.log(`   ✗ ${label}`); fail++; } }

async function login(email, password) {
  const s = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  if (!s.ok) throw new Error(`login ${email}: ${await s.text()}`);
  const { idToken } = await s.json();
  const sess = await fetch(`${PROD}/api/auth/session`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }),
  });
  return sess.headers.getSetCookie().find((c) => c.startsWith('__session=')).split(';')[0];
}

async function ensureUser(email) {
  try { const u = await auth.getUserByEmail(email); await auth.deleteUser(u.uid); await db.collection('users').doc(u.uid).delete(); } catch {}
  const u = await auth.createUser({ email, password: PASS, emailVerified: true, displayName: email.split('@')[0] });
  await db.collection('users').doc(u.uid).set({
    uid: u.uid, email, displayName: email.split('@')[0], provider: 'email',
    whatsapp: null, systemRole: 'user', isApproved: true, onboardingComplete: true,
    createdAt: new Date(), updatedAt: new Date(), lastLoginAt: new Date(),
  });
  return u.uid;
}

async function run() {
  console.log('\n🔧 Setup: usuarios + empresa de prueba');
  const asesorUid = await ensureUser(ASESOR);
  const asesor2Uid = await ensureUser(ASESOR2);
  const asesorCookie = await login(ASESOR, PASS);
  const asesor2Cookie = await login(ASESOR2, PASS);

  // asesor crea su empresa (queda como administrador; el admin NO es miembro)
  const createRes = await fetch(`${PROD}/api/companies`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: asesorCookie },
    body: JSON.stringify({ name: 'Empresa Test RBAC', nit: '900111222-3', sector: 'Tecnología', size: 'pequeña' }),
  });
  const { id: companyId } = await createRes.json();
  console.log(`   empresa creada: ${companyId} (dueño: asesor1, admin NO es miembro)`);
  const adminIsMember = (await db.collection('memberships').doc(`oxzs9fFV9hP7aMAHZQYdLzcrAK32_${companyId}`).get()).exists;
  check(!adminIsMember, 'el admin NO tiene membresía en la empresa de prueba');

  const adminCookie = await login(ADMIN_EMAIL, ADMIN_PASS);

  console.log('\nA) Admin edita una empresa de la que NO es miembro');
  const patch = await fetch(`${PROD}/api/companies/${companyId}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({ sector: 'Auditoría' }),
  });
  check(patch.status === 200, `PATCH → ${patch.status} (esperado 200)`);
  const afterEdit = (await db.collection('companies').doc(companyId).get()).data();
  check(afterEdit?.sector === 'Auditoría', `sector actualizado a "${afterEdit?.sector}"`);

  console.log('\nB) Un NO-miembro / NO-admin intenta editar → debe ser 403');
  const forbidden = await fetch(`${PROD}/api/companies/${companyId}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: asesor2Cookie },
    body: JSON.stringify({ sector: 'Hackeado' }),
  });
  check(forbidden.status === 403, `PATCH ajeno → ${forbidden.status} (esperado 403)`);

  console.log('\nC) Admin asigna un asesor por correo');
  const addMem = await fetch(`${PROD}/api/companies/${companyId}/members`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({ email: ASESOR2, role: 'evaluador' }),
  });
  check(addMem.status === 200, `POST member → ${addMem.status} (esperado 200)`);
  const memDoc = await db.collection('memberships').doc(`${asesor2Uid}_${companyId}`).get();
  check(memDoc.exists && memDoc.data()?.role === 'evaluador', 'membresía evaluador creada para asesor2');

  console.log('\nD) Admin quita el asesor');
  const delMem = await fetch(`${PROD}/api/companies/${companyId}/members/${asesor2Uid}`, {
    method: 'DELETE', headers: { Cookie: adminCookie },
  });
  check(delMem.status === 200, `DELETE member → ${delMem.status} (esperado 200)`);
  check(!(await db.collection('memberships').doc(`${asesor2Uid}_${companyId}`).get()).exists, 'membresía de asesor2 eliminada');

  console.log('\nE) Admin elimina la empresa (cascada)');
  const delCo = await fetch(`${PROD}/api/companies/${companyId}`, { method: 'DELETE', headers: { Cookie: adminCookie } });
  check(delCo.status === 200, `DELETE company → ${delCo.status} (esperado 200)`);
  check(!(await db.collection('companies').doc(companyId).get()).exists, 'empresa eliminada');
  const remainingMems = await db.collection('memberships').where('companyId', '==', companyId).get();
  check(remainingMems.empty, 'membresías en cascada eliminadas');

  console.log('\n🧹 Limpieza usuarios de prueba');
  for (const uid of [asesorUid, asesor2Uid]) {
    try { await auth.deleteUser(uid); } catch {}
    try { await db.collection('users').doc(uid).delete(); } catch {}
  }
  console.log('   ✓ usuarios de prueba eliminados');

  console.log(`\n${fail === 0 ? '✅' : '❌'} RESULTADO: ${pass} OK, ${fail} fallos\n`);
  process.exit(fail === 0 ? 0 : 1);
}

run().catch((e) => { console.error('❌ Error:', e.message); process.exit(1); });
