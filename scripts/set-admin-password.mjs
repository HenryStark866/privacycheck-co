/**
 * scripts/set-admin-password.mjs
 * Asigna una contraseña al usuario admin existente (creado con Google) para
 * que pueda iniciar sesión con email/contraseña, y verifica el flujo completo
 * de login contra PRODUCCIÓN.
 *
 * Uso: node --env-file=.env.local scripts/set-admin-password.mjs
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const PROJECT_ID = process.env.FIREBASE_ADMIN_PROJECT_ID;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
const API_KEY    = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const PROD_URL   = 'https://privacycheck-co.vercel.app';

const ADMIN_EMAIL = 'henry.taborda866@pascualbravo.edu.co';
const TEMP_PASS   = 'Cavaltec2026*';

if (!getApps().length) {
  initializeApp({ credential: cert({ projectId: PROJECT_ID, clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL, privateKey }) });
}
const auth = getAuth();

async function run() {
  // 1. Asignar contraseña al usuario admin existente
  const user = await auth.getUserByEmail(ADMIN_EMAIL);
  await auth.updateUser(user.uid, { password: TEMP_PASS });
  console.log(`\n✓ Contraseña asignada a ${ADMIN_EMAIL}`);
  console.log(`  (la cuenta conserva Google + ahora también email/contraseña)`);

  // 2. Verificar login via REST → idToken
  const signin = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: TEMP_PASS, returnSecureToken: true }),
  });
  if (!signin.ok) { console.error('❌ Sign-in REST falló:', await signin.text()); process.exit(1); }
  const { idToken } = await signin.json();
  console.log('✓ Login REST exitoso (idToken obtenido)');

  // 3. POST a producción /api/auth/session
  const sess = await fetch(`${PROD_URL}/api/auth/session`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  const body = await sess.json().catch(() => ({}));
  console.log(`✓ POST ${PROD_URL}/api/auth/session → HTTP ${sess.status}:`, JSON.stringify(body));

  if (sess.ok) {
    console.log('\n✅ LOGIN ADMIN FUNCIONA END-TO-END EN PRODUCCIÓN');
    console.log('\n  ┌─────────────────────────────────────────────────┐');
    console.log('  │  CREDENCIALES DE PRUEBA (cámbialas después)       │');
    console.log(`  │  Correo:     ${ADMIN_EMAIL}`);
    console.log(`  │  Contraseña: ${TEMP_PASS}`);
    console.log(`  │  needsOnboarding: ${body.needsOnboarding}  (→ va directo al dashboard)`);
    console.log('  └─────────────────────────────────────────────────┘\n');
  } else {
    console.log('\n❌ El endpoint de sesión rechazó el token.');
  }
}

run().catch(e => { console.error('Error:', e.message || e); process.exit(1); });
