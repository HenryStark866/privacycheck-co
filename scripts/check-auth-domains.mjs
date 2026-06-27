/**
 * scripts/check-auth-domains.mjs
 * Verifica (y agrega si falta) el dominio de Vercel en los dominios
 * autorizados de Firebase Auth — requisito para que el login OAuth
 * funcione en producción (sin esto: error auth/unauthorized-domain).
 *
 * Uso: node --env-file=.env.local scripts/check-auth-domains.mjs
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';

const PROJECT_ID = process.env.FIREBASE_ADMIN_PROJECT_ID;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
const REQUIRED_DOMAINS = ['privacycheck-co.vercel.app'];

if (!getApps().length) {
  initializeApp({ credential: cert({ projectId: PROJECT_ID, clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL, privateKey }) });
}
const credential = cert({ projectId: PROJECT_ID, clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL, privateKey });

const API = `https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT_ID}/config`;

async function run() {
  const { access_token } = await credential.getAccessToken();

  // 1. Leer config actual
  const getRes = await fetch(API, { headers: { Authorization: `Bearer ${access_token}` } });
  if (!getRes.ok) {
    console.error(`❌ No se pudo leer la config (${getRes.status}):`, await getRes.text());
    process.exit(1);
  }
  const config = await getRes.json();
  const current = config.authorizedDomains || [];

  console.log('\n🔐  Dominios autorizados actuales en Firebase Auth:');
  current.forEach(d => console.log(`    • ${d}`));

  // 2. Calcular faltantes
  const missing = REQUIRED_DOMAINS.filter(d => !current.includes(d));
  if (missing.length === 0) {
    console.log('\n✅  Todos los dominios requeridos ya están autorizados. El login OAuth funcionará en la web.\n');
    return;
  }

  console.log(`\n⚠  Faltan: ${missing.join(', ')}  → agregando...`);

  // 3. PATCH con la lista combinada
  const updated = [...current, ...missing];
  const patchRes = await fetch(`${API}?updateMask=authorizedDomains`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ authorizedDomains: updated }),
  });

  if (!patchRes.ok) {
    console.error(`❌ No se pudo actualizar (${patchRes.status}):`, await patchRes.text());
    console.error('   Agrégalo manualmente: Firebase Console → Authentication → Settings → Authorized domains\n');
    process.exit(1);
  }

  console.log('\n✅  Dominio(s) agregado(s). El login OAuth ahora funcionará en https://privacycheck-co.vercel.app\n');
  const after = (await patchRes.json()).authorizedDomains || updated;
  after.forEach(d => console.log(`    • ${d}`));
  console.log('');
}

run().catch(e => { console.error('❌ Error:', e.message || e); process.exit(1); });
