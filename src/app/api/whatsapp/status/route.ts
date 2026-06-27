import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/firebase/session';
import { getWhatsAppStatus, setupWhatsAppWebhook } from '@/lib/whatsapp';

export async function GET(request: Request) {
  try {
    const user = await verifySession();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const session = await getWhatsAppStatus();

    // Determinar la URL pública de la aplicación de forma dinámica
    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const appUrl = `${protocol}://${host}`;

    // Si está conectado, configurar/registrar automáticamente el webhook
    if (session.status === 'CONNECTED') {
      await setupWhatsAppWebhook(session.id, appUrl);
    }

    return NextResponse.json({
      ok: true,
      session,
      appUrl,
    });
  } catch (error: any) {
    console.error('Error in WhatsApp status route:', error);
    return NextResponse.json({
      ok: false,
      error: error.message || 'Error conectando con el servicio de WhatsApp',
    }, { status: 500 });
  }
}
