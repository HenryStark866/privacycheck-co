/**
 * Cliente de integración con OpenWA (WhatsApp API Gateway)
 */

const OPENWA_API_URL = process.env.OPENWA_API_URL || 'http://localhost:2785';
const OPENWA_API_KEY = process.env.OPENWA_API_KEY || 'dev-admin-key';
const SESSION_NAME = 'cavaltec-bot';

export interface WhatsAppSession {
  id: string;
  name: string;
  status: 'INITIALIZING' | 'SCAN_QR' | 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'FAILED';
  phoneNumber?: string;
  qr?: string; // QR en base64
}

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-API-Key': OPENWA_API_KEY,
  };
}

/**
 * Obtiene el estado actual de la sesión de WhatsApp o la inicializa si no existe.
 */
export async function getWhatsAppStatus(): Promise<WhatsAppSession> {
  try {
    const res = await fetch(`${OPENWA_API_URL}/api/sessions`, {
      method: 'GET',
      headers: getHeaders(),
      cache: 'no-store',
    });

    if (!res.ok) {
      throw new Error(`Error de OpenWA: ${res.statusText}`);
    }

    const sessions = await res.json() as any[];
    let session = sessions.find((s) => s.name === SESSION_NAME);

    // Si no existe la sesión, la creamos
    if (!session) {
      const createRes = await fetch(`${OPENWA_API_URL}/api/sessions`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ name: SESSION_NAME }),
        cache: 'no-store',
      });

      if (!createRes.ok) {
        throw new Error(`No se pudo crear la sesión de WhatsApp: ${createRes.statusText}`);
      }

      session = await createRes.json();
    }

    const result: WhatsAppSession = {
      id: session.id,
      name: session.name,
      status: session.status,
      phoneNumber: session.phoneNumber,
    };

    // Si está esperando QR, obtenemos el código QR
    if (session.status === 'SCAN_QR') {
      try {
        const qrRes = await fetch(`${OPENWA_API_URL}/api/sessions/${session.id}/qr`, {
          method: 'GET',
          headers: getHeaders(),
          cache: 'no-store',
        });
        if (qrRes.ok) {
          const qrData = await qrRes.json();
          result.qr = qrData.image; // Viene en formato base64 "data:image/png;base64,..."
        }
      } catch (err) {
        console.error('Error obteniendo el QR de OpenWA:', err);
      }
    }

    return result;
  } catch (error) {
    console.error('Error de conexión con OpenWA:', error);
    throw error;
  }
}

/**
 * Registra el webhook de la app en la sesión de OpenWA si no está registrado ya.
 */
export async function setupWhatsAppWebhook(sessionId: string, appUrl: string) {
  try {
    const webhookUrl = `${appUrl}/api/whatsapp/webhook`;
    
    // Obtener webhooks existentes
    const res = await fetch(`${OPENWA_API_URL}/api/sessions/${sessionId}/webhooks`, {
      method: 'GET',
      headers: getHeaders(),
      cache: 'no-store',
    });

    if (!res.ok) return;

    const webhooks = await res.json() as any[];
    const exists = webhooks.some((w) => w.url === webhookUrl);

    if (!exists) {
      // Registrar nuevo webhook
      await fetch(`${OPENWA_API_URL}/api/sessions/${sessionId}/webhooks`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          name: 'Cavaltec Webhook',
          url: webhookUrl,
          events: ['message.received'],
        }),
      });
      console.log(`Webhook registrado exitosamente para la sesión ${sessionId} apuntando a ${webhookUrl}`);
    }
  } catch (error) {
    console.error('Error registrando webhook en OpenWA:', error);
  }
}

/**
 * Envía un mensaje de WhatsApp a un número determinado.
 */
export async function sendWhatsAppMessage(sessionId: string, chatId: string, text: string) {
  try {
    const res = await fetch(`${OPENWA_API_URL}/api/sessions/${sessionId}/messages/send-text`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        chatId,
        text,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Error enviando mensaje: ${res.status} - ${err}`);
    }

    return await res.json();
  } catch (error) {
    console.error('Error enviando mensaje por WhatsApp:', error);
    throw error;
  }
}
