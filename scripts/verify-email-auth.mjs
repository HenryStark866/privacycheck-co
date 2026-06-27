/**
 * scripts/verify-email-auth.mjs
 * 1. Habilita el proveedor Email/Password en Firebase Auth.
 * 2. Crea un usuario de prueba, inicia sesión via REST → idToken.
 * 3. POST ese idToken al /api/auth/session de PRODUCCIÓN.
 * 4. Reporta si el backend (Admin SDK) funciona end-to-end.
 * 5. Limpia el usuario de prueba.
 *
 * Uso: node --env-file=.env.local scripts/verify-email-auth.mjs
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID  = process.env.FIREBASE_ADMIN_PROJECT_ID;
const privateKey  = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
const API_KEY     = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const PROD_URL    = process.argv[2] || process.env.NEXT_PUBLIC_APP_URL || 'https://privacycheck-co.vercel.app';

const credential = cert({ projectId: PROJECT_ID, clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL, privateKey });
if (!getApps().length) initializeApp({ credential });
const auth = getAuth();
const db   = getFirestore();

const CONFIG_API = `https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT_ID}/config`;
const TEST_EMAIL = 'pc-diagnostic-test@example.com';
const TEST_PASS  = 'Test123456!';

async function run() {
  const { access_token } = await credential.getAccessToken();

  // 1. Habilitar Email/Password
  console.log('\n1) Habilitando proveedor Email/Password...');
  const patch = await fetch(`${CONFIG_API}?updateMask=signIn.email.enabled,signIn.email.passwordRequired`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ signIn: { email: { enabled: true, passwordRequired: true } } }),
  });
  if (!patch.ok) { console.error('   ❌', patch.status, await patch.text()); process.exit(1); }
  const cfg = await patch.json();
  console.log('   ✓ Email/Password enabled =', cfg.signIn?.email?.enabled);

  // 2. Crear usuario de prueba (limpiar si ya existía)
  console.log('2) Creando usuario de prueba...');
  try { const u = await auth.getUserByEmail(TEST_EMAIL); await auth.deleteUser(u.uid); } catch {}
  const testUser = await auth.createUser({ email: TEST_EMAIL, password: TEST_PASS, emailVerified: true, displayName: 'Diagnostic Test' });
  console.log('   ✓ uid =', testUser.uid);

  // 3. Iniciar sesión via REST → idToken
  console.log('3) Sign-in via REST para obtener idToken...');
  const signin = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASS, returnSecureToken: true }),
  });
  if (!signin.ok) { console.error('   ❌', signin.status, await signin.text()); await cleanup(testUser.uid); process.exit(1); }
  const { idToken } = await signin.json();
  console.log('   ✓ idToken obtenido');

  // 4. POST a PRODUCCIÓN /api/auth/session
  console.log(`4) Probando POST ${PROD_URL}/api/auth/session ...`);
  const sess = await fetch(`${PROD_URL}/api/auth/session`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  const body = await sess.text();
  console.log(`   → HTTP ${sess.status}: ${body}`);

  if (sess.ok) {
    console.log('\n✅ BACKEND OK — el endpoint de sesión funciona. Email/password funcionará end-to-end.\n');
  } else {
    console.log('\n❌ BACKEND FALLA — revisar variables FIREBASE_ADMIN_* en Vercel.\n');
  }

  await cleanup(testUser.uid);
}

async function cleanup(uid) {
  try { await auth.deleteUser(uid); } catch {}
  try { await db.collection('users').doc(uid).delete(); } catch {}
  console.log('   ✓ Usuario de prueba eliminado (Auth + Firestore).');
}

run().catch(e => { console.error('Error:', e.message || e); process.exit(1); });
