/**
 * Prueba el envío real: login admin → cookie → POST /api/whatsapp/send.
 * Confirma el chain Vercel → túnel → OpenWA → WhatsApp.
 * Uso: node --env-file=.env.local scripts/test-whatsapp-send.mjs [numeroDestino]
 */
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const PROD = 'https://privacycheck-co.vercel.app';
const EMAIL = 'henry.taborda866@pascualbravo.edu.co';
const PASS = 'Cavaltec2026*';
const TO = process.argv[2] || '573245769748'; // por defecto: el propio número (mensaje a ti mismo)

async function getCookie() {
  const signin = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS, returnSecureToken: true }),
  });
  const { idToken } = await signin.json();
  const sess = await fetch(`${PROD}/api/auth/session`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  const c = sess.headers.getSetCookie().find((x) => x.startsWith('__session='));
  return c.split(';')[0];
}

const cookie = await getCookie();
const text = '✅ Prueba PrivacyCheck CO — gateway de WhatsApp conectado vía túnel. Escribe *ayuda* para ver los comandos.';
const res = await fetch(`${PROD}/api/whatsapp/send`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Cookie: cookie },
  body: JSON.stringify({ to: TO, text }),
});
const body = await res.text();
console.log(`POST /api/whatsapp/send → HTTP ${res.status}`);
console.log(body.slice(0, 300));
console.log(res.ok ? `\n✅ Mensaje enviado a ${TO}. Revisa WhatsApp.` : '\n❌ Falló el envío.');
