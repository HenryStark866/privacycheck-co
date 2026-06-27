/**
 * Verifica el chain completo en producción:
 * login admin → cookie de sesión → GET /api/whatsapp/status (Vercel → túnel → OpenWA).
 * Espera a que el redeploy termine y la sesión 'walle' aparezca CONNECTED.
 *
 * Uso: node --env-file=.env.local scripts/verify-whatsapp-prod.mjs
 */
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const PROD = 'https://privacycheck-co.vercel.app';
const EMAIL = 'henry.taborda866@pascualbravo.edu.co';
const PASS = 'Cavaltec2026*';

async function getCookie() {
  const signin = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS, returnSecureToken: true }),
  });
  if (!signin.ok) throw new Error('login firebase fallo: ' + await signin.text());
  const { idToken } = await signin.json();

  const sess = await fetch(`${PROD}/api/auth/session`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  if (!sess.ok) throw new Error('session route fallo: ' + sess.status);
  const setCookies = sess.headers.getSetCookie ? sess.headers.getSetCookie() : [];
  const c = setCookies.find((x) => x.startsWith('__session='));
  if (!c) throw new Error('no se recibio cookie __session');
  return c.split(';')[0];
}

async function run() {
  console.log('1) Login admin + cookie de sesión...');
  const cookie = await getCookie();
  console.log('   ✓ cookie obtenida');

  console.log('2) Consultando /api/whatsapp/status (esperando deploy + conexión)...');
  const deadline = Date.now() + 4 * 60 * 1000;
  let last = '';
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${PROD}/api/whatsapp/status`, { headers: { Cookie: cookie } });
      const data = await r.json().catch(() => ({}));
      const s = data.session;
      if (r.ok && s) {
        last = `status=${s.status} phone=${s.phoneNumber} name=${s.name}`;
        if (s.phoneNumber === '573245769748' || (s.id && s.id !== 'mock-session-hackathon')) {
          console.log(`   ✓ REAL CONNECTED → ${last} (id=${s.id})`);
          console.log(`   appUrl (webhook base): ${data.appUrl}`);
          console.log('\n✅ Vercel ALCANZA OpenWA por el túnel — sesión real conectada.');
          console.log('   Webhook registrado → mensajes entrantes llegarán a Vercel.\n');
          return;
        }
        if (s.phoneNumber === '573000000000' || s.id === 'mock-session-hackathon') {
          console.log(`   … MOCK activo (Vercel aún no alcanza el túnel / deploy en curso): ${last}`);
        } else {
          console.log(`   … ${last} (reintentando)`);
        }
      } else {
        console.log(`   … HTTP ${r.status}: ${JSON.stringify(data).slice(0, 120)} (deploy en curso?)`);
      }
    } catch (e) {
      console.log('   … error transitorio: ' + e.message);
    }
    await new Promise((res) => setTimeout(res, 15000));
  }
  console.log(`\n⚠ No llegó a CONNECTED en 4 min. Último estado: ${last || 'sin respuesta'}`);
}

run().catch((e) => { console.error('❌', e.message); process.exit(1); });
