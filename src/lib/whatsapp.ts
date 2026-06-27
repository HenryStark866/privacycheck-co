/**
 * lib/whatsapp.ts
 * Cliente de integración con OpenWA / WAHA (WhatsApp HTTP API Gateway)
 *
 * El gateway OpenWA corre localmente (npm run dev en /OpenWA-main) y
 * expone su API REST en OPENWA_API_URL. En producción debe apuntar a
 * una URL pública (ej. ngrok, VPS, Railway).
 */
import { adminDb } from '@/lib/firebase/admin';

const OPENWA_API_URL = process.env.OPENWA_API_URL || 'http://localhost:2785';
const OPENWA_API_KEY = process.env.OPENWA_API_KEY || 'dev-admin-key';
// Nombre de la sesión OpenWA. Por defecto usa 'walle' (la sesión ya
// conectada en el gateway). Configurable vía OPENWA_SESSION_NAME en Vercel.
export const SESSION_NAME = process.env.OPENWA_SESSION_NAME || 'walle';

// Caching de registro de webhook para evitar peticiones redundantes al gateway
let isWebhookRegistered = false;

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface WhatsAppSession {
  id: string;
  name: string;
  status: 'INITIALIZING' | 'SCAN_QR' | 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'FAILED';
  phoneNumber?: string;
  qr?: string;
}

export interface RegisteredUser {
  uid: string;
  email: string;
  displayName: string;
  whatsapp: string;
  onboardingComplete: boolean;
  createdAt: any;
}

// ─── Helpers internos ────────────────────────────────────────────────────────

function headers() {
  return {
    'Content-Type': 'application/json',
    'X-API-Key': OPENWA_API_KEY,
    'Bypass-Tunnel-Reminder': 'true',
  };
}

/** Normaliza un número dejando solo dígitos */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/** Convierte número o JID a formato chatId de WhatsApp (573001234567@c.us) */
export function toChatId(phone: string): string {
  // Si el string original ya tiene '@', lo devolvemos tal cual (ya es un JID válido)
  if (phone.includes('@')) return phone;
  const digits = normalizePhone(phone);
  return `${digits}@c.us`;
}

// ─── Gestión de sesiones OpenWA ──────────────────────────────────────────────

/**
 * Mapea los estados que devuelve OpenWA
 * (created|initializing|qr_ready|authenticating|ready|disconnected|failed)
 * a los estados que usa la aplicación.
 */
function normalizeStatus(raw: string): WhatsAppSession['status'] {
  switch ((raw || '').toLowerCase()) {
    case 'ready':
    case 'working':
    case 'connected': return 'CONNECTED';
    case 'qr_ready':
    case 'scan_qr':
    case 'scan_qr_code': return 'SCAN_QR';
    case 'authenticating':
    case 'connecting': return 'CONNECTING';
    case 'created':
    case 'starting':
    case 'initializing': return 'INITIALIZING';
    case 'failed': return 'FAILED';
    default: return 'DISCONNECTED';
  }
}

/**
 * Obtiene el estado de la sesión o la crea si no existe.
 */
export async function getWhatsAppStatus(customSessionName?: string): Promise<WhatsAppSession> {
  const name = customSessionName || SESSION_NAME;
  try {
    const res = await fetch(`${OPENWA_API_URL}/api/sessions`, {
      headers: headers(),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`OpenWA no responde (${res.status})`);

    const sessions: any[] = await res.json();
    let session = sessions.find((s) => s.name === name);

    if (!session) {
      const cr = await fetch(`${OPENWA_API_URL}/api/sessions`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ name }),
        cache: 'no-store',
      });
      if (!cr.ok) throw new Error(`No se pudo crear la sesión: ${cr.statusText}`);
      session = await cr.json();
    }

    const result: WhatsAppSession = {
      id: session.id,
      name: session.name,
      status: normalizeStatus(session.status),
      phoneNumber: session.phone ?? session.phoneNumber,
    };

    if (result.status === 'SCAN_QR') {
      try {
        const qr = await fetch(`${OPENWA_API_URL}/api/sessions/${session.id}/qr`, {
          headers: headers(),
          cache: 'no-store',
        });
        if (qr.ok) result.qr = (await qr.json()).image;
      } catch { /* QR aún no disponible */ }
    }

    return result;
  } catch (error) {
    throw error; // Propagar el error real para que la UI muestre el estado correcto
  }
}

/**
 * Devuelve el ID de la sesión CONNECTED, o null si no hay sesión activa.
 * No lanza error: falla silenciosamente para no romper el onboarding.
 */
export async function getActiveSessionId(customSessionName?: string): Promise<string | null> {
  try {
    const s = await getWhatsAppStatus(customSessionName);
    return s.status === 'CONNECTED' ? s.id : null;
  } catch {
    return null;
  }
}

// ─── Webhooks ────────────────────────────────────────────────────────────────

export async function setupWhatsAppWebhook(sessionId: string, appUrl: string) {
  if (isWebhookRegistered) return;
  try {
    const webhookUrl = `${appUrl}/api/whatsapp/webhook`;
    const res = await fetch(`${OPENWA_API_URL}/api/sessions/${sessionId}/webhooks`, {
      headers: headers(),
      cache: 'no-store',
    });
    if (!res.ok) {
      console.warn(`[WA] No se pudo listar webhooks (${res.status})`);
      return;
    }

    const existing: any[] = await res.json();
    if (existing.some((w) => w.url === webhookUrl)) {
      console.log(`[WA] Webhook ya registrado → ${webhookUrl}`);
      isWebhookRegistered = true;
      return; // ya registrado
    }

    const postRes = await fetch(`${OPENWA_API_URL}/api/sessions/${sessionId}/webhooks`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        name: 'PrivacyCheck CO',
        url: webhookUrl,
        events: ['message.received'],
        retries: 3,
        timeout: 15000,
      }),
    });
    if (postRes.ok) {
      console.log(`[WA] Webhook registrado → ${webhookUrl}`);
      isWebhookRegistered = true;
    } else {
      const errText = await postRes.text();
      console.error(`[WA] Error registrando webhook: ${postRes.status} — ${errText}`);
    }
  } catch (err) {
    console.error('[WA] Error registrando webhook:', err);
  }
}

// ─── Envío de mensajes ───────────────────────────────────────────────────────

/**
 * Envía un mensaje de texto vía OpenWA.
 * @param sessionId  ID de la sesión activa
 * @param to         Número o chatId (ej. "3001234567" o "573001234567@c.us")
 * @param text       Mensaje en texto plano (WhatsApp soporta *negrita*, _cursiva_)
 */
export async function sendWhatsAppMessage(sessionId: string, to: string, text: string) {
  // Usar la sesión activa: primero el sessionId recibido, luego SESSION_NAME como fallback
  const activeSession = sessionId || SESSION_NAME;
  const chatId = toChatId(to);

  const res = await fetch(`${OPENWA_API_URL}/api/sessions/${activeSession}/messages/send-text`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ chatId, text }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    // Si falla con el sessionId del payload, reintentar con SESSION_NAME
    if (activeSession !== SESSION_NAME) {
      console.warn(`[WA] Reintentando con SESSION_NAME tras fallo con sessionId='${activeSession}'`);
      const retry = await fetch(`${OPENWA_API_URL}/api/sessions/${SESSION_NAME}/messages/send-text`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ chatId, text }),
      });
      if (retry.ok) return retry.json();
      const retryBody = await retry.text();
      throw new Error(`[WA] Error enviando a ${chatId}: ${retry.status} — ${retryBody}`);
    }
    throw new Error(`[WA] Error enviando a ${chatId}: ${res.status} — ${errBody}`);
  }
  return res.json();
}

/**
 * Envía mensaje de bienvenida al usuario recién registrado.
 * Falla silenciosamente si OpenWA no está activo (modo producción).
 */
export async function sendWelcomeMessage(whatsapp: string, displayName: string): Promise<boolean> {
  try {
    const sessionId = await getActiveSessionId();
    if (!sessionId) return false;

    const text =
      `🎉 *¡Bienvenido a PrivacyCheck CO, ${displayName}!*\n\n` +
      `Tu número ha sido vinculado. Ya puedes consultarme desde WhatsApp:\n\n` +
      `📋 *Comandos disponibles:*\n` +
      `• *empresas* → Lista tus empresas registradas\n` +
      `• *empresa [nombre]* → Detalle de una empresa\n` +
      `• *ayuda* → Menú de comandos\n\n` +
      `O escríbeme en lenguaje natural sobre la *Ley 1581* o el estado de cumplimiento de tus empresas. ` +
      `Estoy disponible 24/7. 🤖\n\n` +
      `_PrivacyCheck CO · Sintaxis TI_`;

    await sendWhatsAppMessage(sessionId, whatsapp, text);
    return true;
  } catch (err) {
    console.warn('[WA] No se pudo enviar bienvenida (OpenWA inactivo):', err);
    return false;
  }
}

// ─── Firestore helpers para WhatsApp ─────────────────────────────────────────

/**
 * Busca un usuario registrado por su número de WhatsApp.
 * Hace matching flexible: con o sin +57, comparando solo los últimos 10 dígitos.
 */
export async function findUserByPhone(senderPhone: string): Promise<RegisteredUser | null> {
  const senderDigits = normalizePhone(senderPhone);
  if (!senderDigits) return null;

  // 1. Intentar buscar directo por coincidencia exacta con + y sin +
  let snap = await adminDb.collection('users').where('whatsapp', '==', `+${senderDigits}`).limit(1).get();
  if (snap.empty) {
    snap = await adminDb.collection('users').where('whatsapp', '==', senderDigits).limit(1).get();
  }
  
  // 2. Si no lo encuentra, intentar buscar por la terminación de 10 dígitos si es colombiano
  if (snap.empty && senderDigits.length >= 10) {
    const last10 = senderDigits.slice(-10);
    snap = await adminDb.collection('users').where('whatsapp', '==', `+57${last10}`).limit(1).get();
  }

  if (!snap.empty) {
    const d = snap.docs[0];
    const data = d.data();
    return {
      uid: d.id,
      email: data.email,
      displayName: data.displayName || data.email,
      whatsapp: data.whatsapp,
      onboardingComplete: data.onboardingComplete ?? true,
      createdAt: data.createdAt,
    };
  }
  return null;
}

/**
 * Devuelve todos los usuarios con WhatsApp registrado (para el panel admin).
 */
export async function getRegisteredWhatsAppUsers(): Promise<RegisteredUser[]> {
  const snap = await adminDb.collection('users').get();
  return snap.docs
    .map((d) => ({ uid: d.id, ...d.data() } as RegisteredUser))
    .filter((u) => !!u.whatsapp);
}
