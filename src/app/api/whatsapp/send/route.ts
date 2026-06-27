/**
 * POST /api/whatsapp/send
 * Envía un mensaje de WhatsApp desde la app a un número registrado.
 * Solo accesible por usuarios autenticados (para notificaciones manuales del admin).
 */
import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/firebase/session';
import { SESSION_NAME, sendWhatsAppMessage, toChatId } from '@/lib/whatsapp';

export async function POST(request: Request) {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const { to, text } = await request.json();
    if (!to || !text) {
      return NextResponse.json({ error: 'to y text son requeridos' }, { status: 400 });
    }

    // SESSION_NAME es la sesión activa en el gateway local/VPS (por defecto 'walle')
    // configurable via OPENWA_SESSION_NAME en Vercel
    try {
      await sendWhatsAppMessage(SESSION_NAME, toChatId(to), text);
      return NextResponse.json({ ok: true, to, sessionId: SESSION_NAME });
    } catch {
      return NextResponse.json({
        error: 'OpenWA no está conectado. Inicia el gateway localmente (npm run dev en OpenWA-main) o verifica OPENWA_API_URL en Vercel.'
      }, { status: 503 });
    }
  } catch (err: any) {
    console.error('[WA Send] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
