import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { sendWhatsAppMessage } from '@/lib/whatsapp';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Instrucción del sistema para el bot de WhatsApp
const WHATSAPP_SYSTEM_INSTRUCTION = `Eres el asistente oficial de WhatsApp para PrivacyCheck CO, un sistema experto en la Ley 1581 de 2012 (protección de datos personales en Colombia) y diagnóstico de Privacy by Design.
Tu rol es responder a las consultas del administrador sobre el estado de sus empresas registradas y dar asesoramiento legal/técnico rápido.

Habla en español colombiano claro, directo y profesional. Usa viñetas y negritas para facilitar la lectura en celulares. Sé conciso y estructurado.`;

/**
 * Limpia y normaliza un número de teléfono para comparación (deja solo dígitos)
 */
function sanitizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Consulta la API de Gemini para obtener respuestas del bot
 */
async function getGeminiReply(userMessage: string, context: string): Promise<string> {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'PEGAR_CLAVE_GEMINI_AQUI') {
    return '⚠️ El servicio de Inteligencia Artificial (Gemini) no está configurado en el servidor principal.';
  }

  const prompt = `Contexto del sistema (Estado de empresas y evaluaciones en la app):\n${context}\n\nPregunta del Administrador:\n"${userMessage}"`;

  const body = {
    system_instruction: { parts: [{ text: WHATSAPP_SYSTEM_INSTRUCTION }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      maxOutputTokens: 1024,
      temperature: 0.5,
    },
  };

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      console.error('Gemini webhook error status:', res.status);
      return 'Disculpa, ocurrió un error temporal al conectar con mi cerebro de IA. Por favor intenta en un momento.';
    }

    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? 'No pude generar una respuesta.';
  } catch (err) {
    console.error('Failed to contact Gemini in webhook:', err);
    return 'Error de conexión con la IA de diagnóstico.';
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    console.log('Recibida petición de webhook de WhatsApp:', payload.event);

    const { event, sessionId, data } = payload;

    // Solo procesamos mensajes de chat entrantes
    if (event !== 'message.received' || !data || data.type !== 'chat' || data.isGroup) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const fromJid = data.from; // Ej. "573001234567@c.us"
    const senderNumber = fromJid.split('@')[0];
    const messageBody = (data.body || '').trim();

    // 1. Validar autorización del administrador
    // Traer número autorizado desde Firestore
    const settingsDoc = await adminDb.collection('settings').doc('whatsapp').get();
    const dbAdminNumber = settingsDoc.exists ? settingsDoc.data()?.adminNumber : null;
    const envAdminNumber = process.env.ADMIN_WHATSAPP_NUMBER;

    const authorizedRaw = dbAdminNumber || envAdminNumber;

    if (!authorizedRaw) {
      // Si no hay ningún número configurado, permitimos el paso temporalmente para facilitar el demo
      console.warn('Alerta: No hay número de administrador configurado en Firestore ni en .env.local');
    } else {
      const senderSanitized = sanitizePhone(senderNumber);
      const authorizedSanitized = sanitizePhone(String(authorizedRaw));

      // Comparación flexible por si falta o sobra el código de país
      const isMatch = senderSanitized.endsWith(authorizedSanitized) || authorizedSanitized.endsWith(senderSanitized);

      if (!isMatch) {
        console.warn(`Acceso denegado a número no autorizado: ${senderNumber}`);
        await sendWhatsAppMessage(
          sessionId,
          fromJid,
          `🔒 *Acceso Denegado*\n\nTu número (*${senderNumber}*) no está registrado como administrador en PrivacyCheck CO. Por favor, configúralo en el panel de la aplicación.`
        );
        return NextResponse.json({ ok: true, status: 'unauthorized_ignored' });
      }
    }

    // 2. Procesar comandos rápidos
    const command = messageBody.toLowerCase();

    if (command === 'ayuda' || command === 'help') {
      const helpText = `💡 *PrivacyCheck CO — Comandos de WhatsApp*\n\nPuedes chatear conmigo en lenguaje natural sobre Ley 1581 o sobre tus empresas y evaluaciones. O usa estos comandos rápidos:\n\n• *empresas*: Lista las organizaciones registradas y su cumplimiento.\n• *empresa [nombre]*: Detalle de los diagnósticos de una empresa específica.\n• *ayuda*: Muestra este menú de ayuda.`;
      await sendWhatsAppMessage(sessionId, fromJid, helpText);
      return NextResponse.json({ ok: true, status: 'command_help' });
    }

    if (command === 'empresas') {
      const compsSnap = await adminDb.collection('companies').get();
      if (compsSnap.empty) {
        await sendWhatsAppMessage(sessionId, fromJid, '🏢 No hay empresas registradas en el sistema todavía.');
        return NextResponse.json({ ok: true });
      }

      const evalsSnap = await adminDb.collection('evaluations').get();
      const evaluations = evalsSnap.docs.map((d) => d.data());

      let responseText = `🏢 *Empresas Registradas (${compsSnap.size}):*\n\n`;
      compsSnap.docs.forEach((doc, idx) => {
        const comp = doc.data();
        const compEvals = evaluations.filter((e) => e.companyId === doc.id);
        const completed = compEvals.filter((e) => e.status === 'completada');
        
        let scoreText = 'Sin diagnósticos completados';
        if (completed.length > 0) {
          const avg = Math.round(completed.reduce((acc, ev) => acc + (ev.score || 0), 0) / completed.length);
          scoreText = `Promedio: *${avg}%* (${completed.length} completado/s)`;
        }

        responseText += `*${idx + 1}. ${comp.name}*\n• NIT: ${comp.nit || 'Sin registrar'}\n• Estado: ${scoreText}\n\n`;
      });

      await sendWhatsAppMessage(sessionId, fromJid, responseText);
      return NextResponse.json({ ok: true, status: 'command_companies' });
    }

    if (command.startsWith('empresa ')) {
      const queryName = command.replace('empresa ', '').trim();
      const compsSnap = await adminDb.collection('companies').get();
      
      const matchedDocs = compsSnap.docs.filter((d) => 
        (d.data().name || '').toLowerCase().includes(queryName)
      );

      if (matchedDocs.length === 0) {
        await sendWhatsAppMessage(sessionId, fromJid, `❌ No encontré ninguna empresa que coincida con "${queryName}". Escribe *empresas* para ver la lista.`);
        return NextResponse.json({ ok: true });
      }

      const company = matchedDocs[0].data();
      const companyId = matchedDocs[0].id;

      const evalsSnap = await adminDb.collection('evaluations')
        .where('companyId', '==', companyId)
        .get();

      let reply = `🏢 *Detalle de Empresa: ${company.name}*\n`;
      reply += `• NIT: ${company.nit || 'N/A'}\n`;
      reply += `• Sector: ${company.sector || 'N/A'}\n`;
      reply += `• Tamaño: ${company.size || 'N/A'}\n\n`;

      if (evalsSnap.empty) {
        reply += `Esta empresa no tiene diagnósticos creados.`;
      } else {
        reply += `*Diagnósticos registrados (${evalsSnap.size}):*\n`;
        evalsSnap.docs.forEach((doc) => {
          const ev = doc.data();
          const dateStr = ev.createdAt ? new Date((ev.createdAt.seconds || ev.createdAt._seconds || 0) * 1000).toLocaleDateString() : 'N/A';
          reply += `- [${ev.status.toUpperCase()}] Fecha: ${dateStr}`;
          if (ev.status === 'completada') {
            reply += ` | Puntaje: *${ev.score}%* (${ev.maturity || 'N/A'})`;
          }
          reply += '\n';
        });
      }

      await sendWhatsAppMessage(sessionId, fromJid, reply);
      return NextResponse.json({ ok: true, status: 'command_company_detail' });
    }

    // 3. Consulta de IA Inteligente (Gemini) con contexto de base de datos
    const compsSnap = await adminDb.collection('companies').get();
    const evalsSnap = await adminDb.collection('evaluations').get();

    const evaluations = evalsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as any));

    // Crear un resumen de la base de datos para pasar como contexto
    let dbSummaryContext = 'Base de datos actual de empresas y su estado de cumplimiento:\n';
    if (compsSnap.empty) {
      dbSummaryContext += '- No hay empresas registradas en el sistema.';
    } else {
      compsSnap.docs.forEach((doc) => {
        const comp = doc.data();
        const compEvals = evaluations.filter((e: any) => e.companyId === doc.id);
        const compCompleted = compEvals.filter((e: any) => e.status === 'completada');

        dbSummaryContext += `- Empresa: ${comp.name} (NIT: ${comp.nit || 'N/A'}, Sector: ${comp.sector || 'N/A'}). `;
        if (compCompleted.length > 0) {
          const latest = compCompleted.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))[0];
          dbSummaryContext += `Último diagnóstico: ${latest.score}% (${latest.maturity || 'N/A'}), completado el ${latest.completedAt ? new Date(latest.completedAt.seconds * 1000).toLocaleDateString() : 'N/A'}.\n`;
        } else {
          dbSummaryContext += `Tiene ${compEvals.length} diagnósticos en borrador (ninguno completado).\n`;
        }
      });
    }

    // Obtener respuesta de la IA
    const replyText = await getGeminiReply(messageBody, dbSummaryContext);

    // Enviar respuesta por WhatsApp
    await sendWhatsAppMessage(sessionId, fromJid, replyText);

    return NextResponse.json({ ok: true, status: 'ai_reply_sent' });
  } catch (error: any) {
    console.error('Error en webhook de WhatsApp:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
