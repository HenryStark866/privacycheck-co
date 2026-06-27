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
const OPENWA_API_KEY  = process.env.OPENWA_API_KEY  || 'dev-admin-key';
export const SESSION_NAME = 'cavaltec-bot';

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
  };
}

/** Normaliza un número dejando solo dígitos */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/** Convierte número o JID a formato chatId de WhatsApp (573001234567@c.us) */
export function toChatId(phone: string): string {
  const digits = normalizePhone(phone);
  return digits.includes('@') ? phone : `${digits}@c.us`;
}

// ─── Gestión de sesiones OpenWA ──────────────────────────────────────────────

/**
 * Obtiene el estado de la sesión o la crea si no existe.
 */
export async function getWhatsAppStatus(): Promise<WhatsAppSession> {
  const res = await fetch(`${OPENWA_API_URL}/api/sessions`, {
    headers: headers(),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`OpenWA no responde (${res.status})`);

  const sessions: any[] = await res.json();
  let session = sessions.find((s) => s.name === SESSION_NAME);

  if (!session) {
    const cr = await fetch(`${OPENWA_API_URL}/api/sessions`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ name: SESSION_NAME }),
      cache: 'no-store',
    });
    if (!cr.ok) throw new Error(`No se pudo crear la sesión: ${cr.statusText}`);
    session = await cr.json();
  }

  const result: WhatsAppSession = {
    id:          session.id,
    name:        session.name,
    status:      session.status,
    phoneNumber: session.phoneNumber,
  };

  if (session.status === 'SCAN_QR') {
    try {
      const qr = await fetch(`${OPENWA_API_URL}/api/sessions/${session.id}/qr`, {
        headers: headers(),
        cache: 'no-store',
      });
      if (qr.ok) result.qr = (await qr.json()).image;
    } catch { /* QR aún no disponible */ }
  }

  return result;
}

/**
 * Devuelve el ID de la sesión CONNECTED, o null si no hay sesión activa.
 * No lanza error: falla silenciosamente para no romper el onboarding.
 */
export async function getActiveSessionId(): Promise<string | null> {
  try {
    const s = await getWhatsAppStatus();
    return s.status === 'CONNECTED' ? s.id : null;
  } catch {
    return null;
  }
}

// ─── Webhooks ────────────────────────────────────────────────────────────────

export async function setupWhatsAppWebhook(sessionId: string, appUrl: string) {
  try {
    const webhookUrl = `${appUrl}/api/whatsapp/webhook`;
    const res = await fetch(`${OPENWA_API_URL}/api/sessions/${sessionId}/webhooks`, {
      headers: headers(),
      cache: 'no-store',
    });
    if (!res.ok) return;

    const existing: any[] = await res.json();
    if (existing.some((w) => w.url === webhookUrl)) return; // ya registrado

    await fetch(`${OPENWA_API_URL}/api/sessions/${sessionId}/webhooks`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        name:   'PrivacyCheck CO',
        url:    webhookUrl,
        events: ['message.received'],
      }),
    });
    console.log(`[WA] Webhook registrado → ${webhookUrl}`);
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
  const chatId = toChatId(to);
  const res = await fetch(`${OPENWA_API_URL}/api/sessions/${sessionId}/messages/send-text`, {
    method: 'POST',
    headers: headers(),
    body:    JSON.stringify({ chatId, text }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[WA] Error enviando a ${chatId}: ${res.status} — ${body}`);
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

  // Buscar en Firestore usuarios con onboardingComplete
  const snap = await adminDb.collection('users')
    .where('onboardingComplete', '==', true)
    .get();

  for (const doc of snap.docs) {
    const data = doc.data();
    if (!data.whatsapp) continue;
    const storedDigits = normalizePhone(data.whatsapp);

    // Match flexible: los 10 últimos dígitos coinciden
    const sender10 = senderDigits.slice(-10);
    const stored10 = storedDigits.slice(-10);
    if (sender10 === stored10) {
      return {
        uid:                doc.id,
        email:              data.email,
        displayName:        data.displayName,
        whatsapp:           data.whatsapp,
        onboardingComplete: data.onboardingComplete,
        createdAt:          data.createdAt,
      };
    }
  }
  return null;
}

/**
 * Devuelve todos los usuarios con WhatsApp registrado (para el panel admin).
 */
export async function getRegisteredWhatsAppUsers(): Promise<RegisteredUser[]> {
  const snap = await adminDb.collection('users')
    .where('onboardingComplete', '==', true)
    .get();
  return snap.docs
    .map((d) => ({ uid: d.id, ...d.data() } as RegisteredUser))
    .filter((u) => !!u.whatsapp);
}
