/**
 * POST /api/whatsapp/send
 * Envía un mensaje de WhatsApp desde la app a un número registrado.
 * Solo accesible por usuarios autenticados (para notificaciones manuales del admin).
 */
import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/firebase/session';
import { getActiveSessionId, sendWhatsAppMessage, toChatId } from '@/lib/whatsapp';

export async function POST(request: Request) {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const { to, text } = await request.json();
    if (!to || !text) {
      return NextResponse.json({ error: 'to y text son requeridos' }, { status: 400 });
    }

    const sessionId = await getActiveSessionId();
    if (!sessionId) {
      return NextResponse.json({ error: 'OpenWA no está conectado. Inicia el gateway localmente.' }, { status: 503 });
    }

    await sendWhatsAppMessage(sessionId, toChatId(to), text);
    return NextResponse.json({ ok: true, to, sessionId });
  } catch (err: any) {
    console.error('[WA Send] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
