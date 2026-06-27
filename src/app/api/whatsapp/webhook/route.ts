/**
 * POST /api/whatsapp/webhook
 *
 * Recibe eventos de OpenWA y responde mensajes de WhatsApp.
 *
 * Flujo:
 *  1. Recibe evento message.received
 *  2. Identifica al remitente (admin / usuario registrado / desconocido)
 *  3. Procesa comandos rápidos estructurados
 *  4. Si no es un comando → responde con Gemini 2.0 Flash (API gratuita)
 *
 * Comandos disponibles:
 *  - ayuda / help / hola / menu / inicio
 *  - empresas                  → Lista mis empresas con puntaje
 *  - empresa [nombre]          → Detalle + historial de diagnósticos
 *  - diagnostico [empresa]     → Último diagnóstico con bloques
 *  - brechas [empresa]         → Brechas de cumplimiento detectadas
 *  - puntaje / score           → Resumen de puntajes de todas mis empresas
 *  - estado                    → Estado de cumplimiento general
 *  - ley / ley 1581            → Resumen de la Ley 1581 de 2012
 *  - articulo [N] / art [N]    → Artículo específico de la Ley 1581
 *  - nuevo [empresa]           → Link para iniciar nuevo diagnóstico
 *  - contacto / soporte        → Info de contacto del administrador
 *  - todos (solo admin)        → Todas las empresas del sistema
 *  - resumen (solo admin)      → Resumen global del sistema
 *  - Consulta libre → Gemini 2.0 Flash con contexto de la BD
 */
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import {
  sendWhatsAppMessage,
  findUserByPhone,
  normalizePhone,
  SESSION_NAME,
} from '@/lib/whatsapp';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://privacycheck-co.vercel.app';

// Grok / xAI (OpenAI-compatible). Si XAI_API_KEY está definida, el bot usa Grok
// como motor principal y cae a Gemini si falla. Modelo configurable vía XAI_MODEL.
const XAI_API_KEY = process.env.XAI_API_KEY || process.env.GROK_API_KEY;
const XAI_MODEL = process.env.XAI_MODEL || 'grok-2-latest';

// gemini-2.5-flash tiene cuota diaria propia (2.0-flash se agota antes;
// 1.5-flash ya no existe en la API). Respaldo: flash-latest.
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_MODEL_FALLBACK = 'gemini-flash-latest';

const BOT_PERSONA = `Eres el asistente oficial de WhatsApp de *PrivacyCheck CO*, una plataforma de autodiagnóstico de cumplimiento de la Ley 1581 de 2012 (Habeas Data / protección de datos personales en Colombia) y Privacy by Design.

*Reglas estrictas:*
- Responde SIEMPRE en español colombiano, claro y profesional
- Usa viñetas (*•*) y negritas (*texto*) para facilitar la lectura en celulares
- Sé conciso: máximo 400 palabras por respuesta
- Si mencionas artículos de la ley, cítalos correctamente y explica su propósito
- NO inventes datos de empresas ni puntajes que no estén en el contexto
- Si no tienes información suficiente, dilo claramente y sugiere abrir la app web
- Siempre cierra con "_PrivacyCheck CO · Sintaxis TI_"`;

// ─── Artículos clave de la Ley 1581 ─────────────────────────────────────────

const LEY_1581_ARTICULOS: Record<string, string> = {
  '1': '*Art. 1* – Objeto: Desarrollar el derecho constitucional de Habeas Data y regular el tratamiento de datos personales.',
  '2': '*Art. 2* – Ámbito: Aplica a datos registrados en cualquier base de datos que los haga susceptibles de tratamiento en territorio colombiano.',
  '3': '*Art. 3* – Definiciones clave: Autorización, Base de Datos, Dato Personal, Dato Sensible, Encargado, Responsable, Titular, Transferencia.',
  '4': '*Art. 4* – Principios: Legalidad, finalidad, libertad, veracidad, transparencia, acceso restringido, seguridad y confidencialidad.',
  '5': '*Art. 5* – Datos sensibles: Origen racial, salud, vida sexual, biométricos, políticos, religiosos. Su tratamiento requiere autorización expresa.',
  '6': '*Art. 6* – Tratamiento de datos de niños y adolescentes: Solo si refleja su interés superior y con participación del menor.',
  '7': '*Art. 7* – Derechos de los titulares: Conocer, actualizar, rectificar, suprimir datos, revocar autorización, presentar quejas.',
  '8': '*Art. 8* – Deberes de responsables: Informar al titular, solicitar autorización, garantizar derechos, mantener seguridad de la información.',
  '9': '*Art. 9* – Autorización del titular: Obligatoria, previa, expresa e informada para todo tratamiento de datos personales.',
  '10': '*Art. 10* – Casos sin autorización: Datos de naturaleza pública, emergencias médicas, tratamiento histórico/estadístico/científico, datos de libre circulación.',
  '11': '*Art. 11* – Aviso de privacidad: Mecanismo simplificado para informar al titular sobre el tratamiento cuando la política completa no es posible.',
  '12': '*Art. 12* – Deber de informar: El responsable debe comunicar la Política de Tratamiento a los titulares antes de iniciar el tratamiento.',
  '13': '*Art. 13* – Personas a quienes se suministran datos: Solo al titular, a sus causahabientes, representantes/apoderados, terceros autorizados, y entidades públicas habilitadas.',
  '14': '*Art. 14* – Consultas: El titular tiene derecho a conocer sus datos en cualquier momento. El responsable debe atender en máximo 10 días hábiles.',
  '15': '*Art. 15* – Reclamos: Si la información es incorrecta, el titular puede reclamar. El responsable tiene 15 días hábiles para resolver.',
  '17': '*Art. 17* – Deberes del responsable: Política de tratamiento, autorización, confidencialidad, seguridad, reclamos, vigencia de datos, reportar infracciones a la SIC.',
  '18': '*Art. 18* – Deberes del encargado: Guardar reserva, informar al responsable, facilitar derechos del titular, no compartir datos con terceros no autorizados.',
  '25': '*Art. 25* – Transferencia internacional: Solo puede hacerse a países con niveles adecuados de protección de datos o con garantías contractuales.',
  '26': '*Art. 26* – Prohibición de transferencia: No se puede transferir datos a países sin legislación adecuada salvo excepciones legales.',
};

// ─── Helpers internos ────────────────────────────────────────────────────────

async function getAdminNumberFromDB(): Promise<string | null> {
  try {
    const doc = await adminDb.collection('settings').doc('whatsapp').get();
    return doc.exists ? (doc.data()?.adminNumber ?? null) : null;
  } catch { return null; }
}

async function isAdminNumber(senderPhone: string): Promise<boolean> {
  const s = normalizePhone(senderPhone).slice(-10);
  if (!s) return false;

  const candidates: (string | null | undefined)[] = [
    process.env.ADMIN_WHATSAPP_NUMBER,
    await getAdminNumberFromDB(),
  ];
  if (candidates.some((n) => n && normalizePhone(n).slice(-10) === s)) return true;

  try {
    const snap = await adminDb.collection('users').where('systemRole', '==', 'admin').get();
    for (const d of snap.docs) {
      const wa = d.data().whatsapp;
      if (wa && normalizePhone(wa).slice(-10) === s) return true;
    }
  } catch (err) {
    console.error('[WA Webhook] Error verificando admin:', err);
  }
  return false;
}

/** Llama a Gemini 2.0 Flash (gratuito) con contexto de BD */
async function geminiReply(prompt: string, context: string, userName: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    return (
      '⚠️ El servicio de IA no está configurado.\n\n' +
      'Usa los comandos disponibles o contacta al administrador.\n\n' +
      '_PrivacyCheck CO · Sintaxis TI_'
    );
  }

  const contextSection = context
    ? `*Información actual de las empresas del usuario en la plataforma:*\n${context}\n\n`
    : '';

  const fullPrompt =
    `${contextSection}*Usuario:* ${userName}\n*Consulta:* "${prompt}"`;

  const body = {
    system_instruction: { parts: [{ text: BOT_PERSONA }] },
    contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
    generationConfig: {
      maxOutputTokens: 600,
      temperature: 0.35,
      topP: 0.9,
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
    ],
  };

  try {
    // Intentar con el modelo principal (gemini-2.5-flash)
    let res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    );

    // Respaldo a flash-latest si el modelo principal falla (p.ej. cuota)
    if (!res.ok) {
      console.warn(`[Gemini] ${GEMINI_MODEL} falló (${res.status}), intentando ${GEMINI_MODEL_FALLBACK}...`);
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL_FALLBACK}:generateContent?key=${GEMINI_API_KEY}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      );
    }

    if (!res.ok) {
      const errBody = await res.text();
      console.error('[Gemini] Error:', res.status, errBody);
      return '⚠️ Tuve un problema temporal con la IA. Intenta de nuevo en un momento.\n\n_PrivacyCheck CO · Sintaxis TI_';
    }

    const d = await res.json();
    const text = d?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) return '🤷 No obtuve una respuesta de la IA. Intenta reformular tu pregunta.\n\n_PrivacyCheck CO · Sintaxis TI_';
    // Asegurar que la firma siempre aparezca
    return text.includes('PrivacyCheck CO') ? text : `${text}\n\n_PrivacyCheck CO · Sintaxis TI_`;
  } catch (err) {
    console.error('[Gemini] Error de red:', err);
    return '❌ Error de conexión con el motor de IA.\n\n_PrivacyCheck CO · Sintaxis TI_';
  }
}

/** Llama a Grok (xAI) — API compatible con OpenAI. Lanza si falla (para fallback). */
async function grokReply(prompt: string, context: string, userName: string): Promise<string> {
  if (!XAI_API_KEY) throw new Error('XAI_API_KEY no configurada');

  const contextSection = context
    ? `Información actual de las empresas del usuario en la plataforma:\n${context}\n\n`
    : '';
  const userContent = `${contextSection}Usuario: ${userName}\nConsulta: "${prompt}"`;

  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${XAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: XAI_MODEL,
      messages: [
        { role: 'system', content: BOT_PERSONA },
        { role: 'user', content: userContent },
      ],
      temperature: 0.35,
      max_tokens: 600,
      stream: false,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Grok ${res.status}: ${errBody.slice(0, 200)}`);
  }

  const d = await res.json();
  const text = d?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('Grok devolvió respuesta vacía');
  return text.includes('PrivacyCheck CO') ? text : `${text}\n\n_PrivacyCheck CO · Sintaxis TI_`;
}

/**
 * Motor de IA del bot: usa Grok (xAI) si hay XAI_API_KEY, con respaldo automático
 * a Gemini. Garantiza una respuesta siempre (Gemini ya degrada con texto estático).
 */
async function aiReply(prompt: string, context: string, userName: string): Promise<string> {
  if (XAI_API_KEY) {
    try {
      return await grokReply(prompt, context, userName);
    } catch (err) {
      console.warn('[AI] Grok falló, usando Gemini:', (err as Error).message);
    }
  }
  return geminiReply(prompt, context, userName);
}

/** Construye contexto enriquecido de Firestore para la IA */
async function buildContext(companyIds?: string[]): Promise<string> {
  const compsSnap = await adminDb.collection('companies').get();
  const companies = companyIds
    ? compsSnap.docs.filter((d) => companyIds.includes(d.id))
    : compsSnap.docs;

  if (companies.length === 0) return 'El usuario no tiene empresas registradas en la plataforma.';

  const evalsSnap = await adminDb.collection('evaluations').get();
  const evals = evalsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as any));

  return companies.map((doc) => {
    const c = doc.data();
    const compEvals = evals.filter((e) => e.companyId === doc.id && e.status === 'completada');
    compEvals.sort((a: any, b: any) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
    const latest = compEvals[0];
    const scoreInfo = latest
      ? `Puntaje: ${latest.score}%, Madurez: ${latest.maturity ?? 'N/A'}, Bloque A: ${latest.blockA ?? 'N/A'}%, Bloque B: ${latest.blockB ?? 'N/A'}%, Bloque C: ${latest.blockC ?? 'N/A'}%`
      : 'Sin diagnóstico completado';
    return `Empresa: ${c.name} | NIT: ${c.nit ?? 'N/A'} | Sector: ${c.sector ?? 'N/A'} | Tamaño: ${c.size ?? 'N/A'} | ${scoreInfo}`;
  }).join('\n');
}

// ─── Comandos individuales ────────────────────────────────────────────────────

async function cmdEmpresas(sessionId: string, chatId: string, companyIds?: string[]) {
  const compsSnap = await adminDb.collection('companies').get();
  const list = companyIds
    ? compsSnap.docs.filter((d) => companyIds.includes(d.id))
    : compsSnap.docs;

  if (list.length === 0) {
    await sendWhatsAppMessage(sessionId, chatId,
      '🏢 No tienes empresas registradas aún.\n\nCréalas en:\n' + APP_URL + '/companies/new\n\n_PrivacyCheck CO · Sintaxis TI_');
    return;
  }

  const evalsSnap = await adminDb.collection('evaluations').get();
  const evals = evalsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as any));

  let msg = `🏢 *Mis empresas (${list.length}):*\n\n`;
  list.forEach((doc, i) => {
    const c = doc.data();
    const done = evals.filter((e) => e.companyId === doc.id && e.status === 'completada');
    done.sort((a: any, b: any) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
    const latest = done[0];
    const pct = latest ? `*${Math.round(latest.score)}%* (${latest.maturity})` : 'Sin diagnóstico';
    msg += `${i + 1}. *${c.name}*\n   📊 ${pct} · NIT: ${c.nit ?? 'N/A'}\n\n`;
  });
  msg += `Escribe *empresa [nombre]* para ver el detalle completo.\n\n_PrivacyCheck CO · Sintaxis TI_`;
  await sendWhatsAppMessage(sessionId, chatId, msg);
}

async function cmdEmpresaDetalle(sessionId: string, chatId: string, query: string, companyIds?: string[]) {
  const compsSnap = await adminDb.collection('companies').get();
  const pool = companyIds
    ? compsSnap.docs.filter((d) => companyIds.includes(d.id))
    : compsSnap.docs;

  const match = pool.find((d) =>
    (d.data().name ?? '').toLowerCase().includes(query.toLowerCase())
  );

  if (!match) {
    await sendWhatsAppMessage(sessionId, chatId,
      `❌ No encontré empresa con "${query}".\n\nEscribe *empresas* para ver la lista completa.\n\n_PrivacyCheck CO · Sintaxis TI_`);
    return;
  }

  const c = match.data();
  const evSnap = await adminDb.collection('evaluations').where('companyId', '==', match.id).get();

  let msg = `🏢 *${c.name}*\n• NIT: ${c.nit ?? 'N/A'}\n• Sector: ${c.sector ?? 'N/A'}\n• Tamaño: ${c.size ?? 'N/A'}\n• Responsable: ${c.responsable ?? 'N/A'}\n• Email: ${c.email ?? 'N/A'}\n\n`;

  if (evSnap.empty) {
    msg += '📋 Sin diagnósticos registrados.\n\nInicia uno en: ' + APP_URL + '/evaluations';
  } else {
    const sorted = evSnap.docs.sort((a, b) =>
      (b.data().createdAt?.seconds ?? 0) - (a.data().createdAt?.seconds ?? 0));
    msg += `*📊 Historial de diagnósticos (${evSnap.size}):*\n`;
    sorted.slice(0, 5).forEach((d) => {
      const ev = d.data();
      const fecha = ev.createdAt
        ? new Date((ev.createdAt.seconds ?? 0) * 1000).toLocaleDateString('es-CO')
        : 'N/A';
      msg += `• [${fecha}] `;
      if (ev.status === 'completada') {
        msg += `*${ev.score}%* — ${ev.maturity ?? 'N/A'}`;
        if (ev.blockA != null) msg += `\n   A:${ev.blockA}% B:${ev.blockB}% C:${ev.blockC}%`;
      } else {
        msg += `⏳ Borrador pendiente`;
      }
      msg += '\n';
    });
  }
  msg += `\n_PrivacyCheck CO · Sintaxis TI_`;
  await sendWhatsAppMessage(sessionId, chatId, msg);
}

async function cmdDiagnostico(sessionId: string, chatId: string, query: string, companyIds?: string[]) {
  const compsSnap = await adminDb.collection('companies').get();
  const pool = companyIds
    ? compsSnap.docs.filter((d) => companyIds.includes(d.id))
    : compsSnap.docs;

  // Si no se especifica empresa y solo hay una, usar esa
  let match = query
    ? pool.find((d) => (d.data().name ?? '').toLowerCase().includes(query.toLowerCase()))
    : pool.length === 1 ? pool[0] : null;

  if (!match) {
    if (!query && pool.length > 1) {
      await sendWhatsAppMessage(sessionId, chatId,
        '❓ Tienes varias empresas. Especifica cuál:\n*diagnostico [nombre empresa]*\n\n_PrivacyCheck CO · Sintaxis TI_');
    } else {
      await sendWhatsAppMessage(sessionId, chatId,
        `❌ No encontré empresa con "${query}".\n\nEscribe *empresas* para ver tu lista.\n\n_PrivacyCheck CO · Sintaxis TI_`);
    }
    return;
  }

  const c = match.data();
  const evSnap = await adminDb.collection('evaluations')
    .where('companyId', '==', match.id)
    .where('status', '==', 'completada')
    .get();

  if (evSnap.empty) {
    await sendWhatsAppMessage(sessionId, chatId,
      `📋 *${c.name}* no tiene diagnósticos completados.\n\nInicia uno en:\n${APP_URL}/evaluations\n\n_PrivacyCheck CO · Sintaxis TI_`);
    return;
  }

  const latest = evSnap.docs
    .sort((a, b) => (b.data().createdAt?.seconds ?? 0) - (a.data().createdAt?.seconds ?? 0))[0]
    .data();

  const fecha = latest.createdAt
    ? new Date((latest.createdAt.seconds ?? 0) * 1000).toLocaleDateString('es-CO')
    : 'N/A';

  let msg = `📊 *Último diagnóstico — ${c.name}*\n📅 ${fecha}\n\n`;
  msg += `*🎯 Puntaje global: ${Math.round(latest.score)}%*\n`;
  msg += `*🏆 Nivel: ${latest.maturity ?? 'N/A'}*\n\n`;
  msg += `*Desglose por bloques:*\n`;
  msg += `• 🏛️ Organización y gobernanza: *${latest.blockA ?? 'N/A'}%*\n`;
  msg += `• 📄 Gestión de datos: *${latest.blockB ?? 'N/A'}%*\n`;
  msg += `• 🔒 Seguridad e incidentes: *${latest.blockC ?? 'N/A'}%*\n\n`;
  msg += `Ver informe completo:\n${APP_URL}/evaluations\n\n_PrivacyCheck CO · Sintaxis TI_`;

  await sendWhatsAppMessage(sessionId, chatId, msg);
}

async function cmdBrechas(sessionId: string, chatId: string, query: string, companyIds?: string[]) {
  const compsSnap = await adminDb.collection('companies').get();
  const pool = companyIds
    ? compsSnap.docs.filter((d) => companyIds.includes(d.id))
    : compsSnap.docs;

  const match = query
    ? pool.find((d) => (d.data().name ?? '').toLowerCase().includes(query.toLowerCase()))
    : pool.length === 1 ? pool[0] : null;

  if (!match) {
    if (!query && pool.length > 1) {
      await sendWhatsAppMessage(sessionId, chatId,
        '❓ Especifica la empresa:\n*brechas [nombre empresa]*\n\n_PrivacyCheck CO · Sintaxis TI_');
    } else {
      await sendWhatsAppMessage(sessionId, chatId,
        `❌ No encontré empresa con "${query}".\n\n_PrivacyCheck CO · Sintaxis TI_`);
    }
    return;
  }

  const c = match.data();
  const evSnap = await adminDb.collection('evaluations')
    .where('companyId', '==', match.id)
    .where('status', '==', 'completada')
    .get();

  if (evSnap.empty) {
    await sendWhatsAppMessage(sessionId, chatId,
      `📋 *${c.name}* no tiene diagnósticos completados para analizar brechas.\n\n_PrivacyCheck CO · Sintaxis TI_`);
    return;
  }

  const latest = evSnap.docs
    .sort((a, b) => (b.data().createdAt?.seconds ?? 0) - (a.data().createdAt?.seconds ?? 0))[0]
    .data();

  // Identificar bloques con brechas
  const gaps: string[] = [];
  if ((latest.blockA ?? 100) < 70) gaps.push(`🏛️ *Gobernanza (${latest.blockA}%)*: Política de privacidad y registro de datos personales incompletos`);
  if ((latest.blockB ?? 100) < 70) gaps.push(`📄 *Gestión de datos (${latest.blockB}%)*: Autorizaciones, derechos del titular o aviso de privacidad deficientes`);
  if ((latest.blockC ?? 100) < 70) gaps.push(`🔒 *Seguridad (${latest.blockC}%)*: Controles de acceso, cifrado o protocolos de incidentes insuficientes`);

  let msg = `⚠️ *Brechas detectadas — ${c.name}*\n*(Puntaje global: ${Math.round(latest.score)}%)*\n\n`;

  if (gaps.length === 0) {
    msg += '✅ ¡Excelente! No se detectaron brechas críticas (todos los bloques ≥ 70%).\n\nSigue reforzando la documentación y revisión periódica.';
  } else {
    msg += `Se identificaron *${gaps.length} área(s) crítica(s)*:\n\n`;
    gaps.forEach((g, i) => { msg += `${i + 1}. ${g}\n\n`; });
    msg += `Consulta el plan de acción detallado en:\n${APP_URL}/evaluations`;
  }
  msg += `\n\n_PrivacyCheck CO · Sintaxis TI_`;
  await sendWhatsAppMessage(sessionId, chatId, msg);
}

async function cmdPuntaje(sessionId: string, chatId: string, companyIds?: string[]) {
  const compsSnap = await adminDb.collection('companies').get();
  const list = companyIds
    ? compsSnap.docs.filter((d) => companyIds.includes(d.id))
    : compsSnap.docs;

  if (list.length === 0) {
    await sendWhatsAppMessage(sessionId, chatId,
      '📊 No tienes empresas registradas aún.\n\n_PrivacyCheck CO · Sintaxis TI_');
    return;
  }

  const evalsSnap = await adminDb.collection('evaluations').get();
  const evals = evalsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as any));

  let msg = `📊 *Resumen de puntajes:*\n\n`;
  let totalScore = 0, count = 0;

  list.forEach((doc) => {
    const c = doc.data();
    const done = evals.filter((e) => e.companyId === doc.id && e.status === 'completada');
    done.sort((a: any, b: any) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
    const latest = done[0];
    if (latest) {
      const s = Math.round(latest.score);
      const icon = s >= 75 ? '🟢' : s >= 50 ? '🟡' : '🔴';
      msg += `${icon} *${c.name}*: ${s}% — ${latest.maturity}\n`;
      totalScore += s; count++;
    } else {
      msg += `⚪ *${c.name}*: Sin diagnóstico\n`;
    }
  });

  if (count > 0) {
    const avg = Math.round(totalScore / count);
    msg += `\n📈 *Promedio general: ${avg}%*`;
  }
  msg += `\n\n_PrivacyCheck CO · Sintaxis TI_`;
  await sendWhatsAppMessage(sessionId, chatId, msg);
}

async function cmdEstado(sessionId: string, chatId: string, greeting: string, companyIds?: string[]) {
  const compsSnap = await adminDb.collection('companies').get();
  const list = companyIds
    ? compsSnap.docs.filter((d) => companyIds.includes(d.id))
    : compsSnap.docs;

  if (list.length === 0) {
    await sendWhatsAppMessage(sessionId, chatId,
      `👋 *${greeting}*, aún no tienes empresas registradas.\n\nRegistra tu primera empresa en:\n${APP_URL}/companies/new\n\n_PrivacyCheck CO · Sintaxis TI_`);
    return;
  }

  const evalsSnap = await adminDb.collection('evaluations').get();
  const evals = evalsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as any));

  let sinDiag = 0, critico = 0, basico = 0, bueno = 0;
  list.forEach((doc) => {
    const done = evals.filter((e) => e.companyId === doc.id && e.status === 'completada');
    if (done.length === 0) { sinDiag++; return; }
    done.sort((a: any, b: any) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
    const s = done[0].score ?? 0;
    if (s < 40) critico++; else if (s < 70) basico++; else bueno++;
  });

  let msg = `👋 *Hola, ${greeting}!*\n\n*📊 Estado de cumplimiento Ley 1581:*\n`;
  msg += `• Total empresas: *${list.length}*\n`;
  if (bueno > 0) msg += `• 🟢 Buen nivel (≥70%): *${bueno}*\n`;
  if (basico > 0) msg += `• 🟡 Nivel básico (40–69%): *${basico}*\n`;
  if (critico > 0) msg += `• 🔴 Crítico (<40%): *${critico}*\n`;
  if (sinDiag > 0) msg += `• ⚪ Sin diagnóstico: *${sinDiag}*\n`;
  msg += `\nEscribe *puntaje* para ver detalles por empresa.\n\n_PrivacyCheck CO · Sintaxis TI_`;

  await sendWhatsAppMessage(sessionId, chatId, msg);
}

async function cmdResumenAdmin(sessionId: string, chatId: string) {
  const [compsSnap, evalsSnap, usersSnap] = await Promise.all([
    adminDb.collection('companies').get(),
    adminDb.collection('evaluations').get(),
    adminDb.collection('users').get(),
  ]);

  const evals = evalsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as any));
  const completadas = evals.filter((e) => e.status === 'completada');
  const avgScore = completadas.length
    ? Math.round(completadas.reduce((s: number, e: any) => s + (e.score ?? 0), 0) / completadas.length)
    : null;

  const aprobados = usersSnap.docs.filter((d) => d.data().isApproved).length;

  let msg = `🛡️ *Resumen global del sistema*\n\n`;
  msg += `🏢 Empresas: *${compsSnap.size}*\n`;
  msg += `📋 Diagnósticos totales: *${evalsSnap.size}* (${completadas.length} completados)\n`;
  msg += `👥 Usuarios: *${usersSnap.size}* (${aprobados} aprobados)\n`;
  if (avgScore !== null) msg += `📈 Puntaje promedio del sistema: *${avgScore}%*\n`;
  msg += `\n🔗 Panel admin: ${APP_URL}/admin/users\n\n_PrivacyCheck CO · Sintaxis TI_`;

  await sendWhatsAppMessage(sessionId, chatId, msg);
}

// ─── Handler principal ───────────────────────────────────────────────────────

/**
 * GET /api/whatsapp/webhook
 * OpenWA hace una petición GET para verificar que el endpoint existe antes
 * de registrar el webhook. Sin este handler el registro falla con 405.
 */
export async function GET() {
  return NextResponse.json({ ok: true, service: 'PrivacyCheck CO WhatsApp Webhook' });
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    console.log('[WA Webhook] Evento recibido:', payload?.event ?? payload?.type);

    // OpenWA puede enviar el evento en distintos formatos según su versión.
    // Formato A (WAHA moderno): { event, sessionId, payload: { ... } }
    // Formato B (WAHA legado / WWebJS): { event, sessionId, data: { ... } }
    // Formato C (OpenWA directo): { type, session, message: { ... } }
    const event = payload?.event ?? payload?.type;
    const sessionId: string =
      payload?.sessionId ?? payload?.session ?? SESSION_NAME;
    // data puede venir como payload.payload (WAHA) o payload.data (legado)
    const data = payload?.payload ?? payload?.data ?? payload?.message ?? null;

    // Solo procesar eventos de mensaje recibido
    if (event && event !== 'message.received' && event !== 'message' && event !== 'message_received') {
      return NextResponse.json({ ok: true, ignored: true, reason: 'event_ignored', event });
    }

    // Ignorar si no hay datos o es un mensaje de grupo
    if (!data || data.isGroup || data.fromGroup) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    // Evitar loops: ignorar mensajes propios SI contienen la firma del bot
    // Esto permite que el admin se envíe comandos a sí mismo para probar
    const body = (data.body || data.text || data.content || data.message || '').toString().trim();
    if (data.fromMe && body.includes('_PrivacyCheck CO')) {
      return NextResponse.json({ ok: true, ignored: true, reason: 'bot_reply_loop' });
    }

    // fromJid: el JID del remitente
    const fromJid = (data.from || data.chatId || data.author || data.remoteJid || '').toString();
    if (!fromJid) return NextResponse.json({ ok: true, ignored: true });

    const senderPhone = fromJid.split('@')[0];
    if (!body) return NextResponse.json({ ok: true, ignored: true });

    const cmd = body.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // normalizar acentos

    // ── 1. Identificar al remitente ──────────────────────────────────────────
    const isAdmin = await isAdminNumber(senderPhone);
    const regUser = isAdmin ? null : await findUserByPhone(senderPhone);

    if (!isAdmin && !regUser) {
      await sendWhatsAppMessage(
        sessionId, fromJid,
        `🔒 *Acceso no autorizado*\n\nTu número (+${senderPhone}) no está vinculado a ninguna cuenta de PrivacyCheck CO.\n\n` +
        `👉 Ingresa a *${APP_URL}*, crea tu cuenta y vincula este número en tu perfil.\n\n_PrivacyCheck CO · Sintaxis TI_`
      );
      return NextResponse.json({ ok: true, status: 'unauthorized' });
    }

    // IDs de empresas del usuario (undefined = todas → solo admin)
    let companyIds: string[] | undefined;
    if (!isAdmin && regUser) {
      const memSnap = await adminDb.collection('memberships')
        .where('userId', '==', regUser.uid)
        .get();
      companyIds = memSnap.docs.map((d) => d.data().companyId as string);

      // Si no tiene memberships, buscar empresas donde sea propietario directo
      if (companyIds.length === 0) {
        const ownerSnap = await adminDb.collection('companies')
          .where('ownerId', '==', regUser.uid)
          .get();
        companyIds = ownerSnap.docs.map((d) => d.id);
      }
    }

    const greeting = isAdmin ? 'Administrador' : (regUser?.displayName?.split(' ')[0] ?? 'Usuario');

    // ── 2. Comandos rápidos (tabla completa) ─────────────────────────────────

    // AYUDA / MENÚ
    if (['ayuda', 'help', 'menu', 'inicio', 'hola', 'buenas', 'buenos dias', 'buenas tardes', 'buenas noches'].includes(cmd)) {
      let msg = `👋 *¡Hola, ${greeting}!*\n\n*📋 Comandos disponibles:*\n\n`;
      msg += `*Consultas de empresas:*\n`;
      msg += `• *empresas* → Lista tus empresas con puntaje\n`;
      msg += `• *empresa [nombre]* → Detalle e historial de diagnósticos\n`;
      msg += `• *diagnostico [empresa]* → Último diagnóstico con bloques\n`;
      msg += `• *brechas [empresa]* → Áreas críticas a mejorar\n`;
      msg += `• *puntaje* → Resumen de puntajes de todas tus empresas\n`;
      msg += `• *estado* → Semáforo general de cumplimiento\n\n`;
      msg += `*Información legal:*\n`;
      msg += `• *ley 1581* → Resumen de la ley\n`;
      msg += `• *articulo [N]* → Artículo específico (ej: *articulo 9*)\n\n`;
      msg += `*Otros:*\n`;
      msg += `• *nuevo [empresa]* → Link para nuevo diagnóstico\n`;
      msg += `• *contacto* → Datos del administrador\n`;
      if (isAdmin) {
        msg += `\n*🔐 Solo admin:*\n`;
        msg += `• *todos* → Todas las empresas del sistema\n`;
        msg += `• *resumen* → Estadísticas globales del sistema\n`;
      }
      msg += `\n💬 También puedes escribir en lenguaje natural. ¡Pregúntame lo que necesites sobre la Ley 1581!\n\n_PrivacyCheck CO · Sintaxis TI_`;
      await sendWhatsAppMessage(sessionId, fromJid, msg);
      return NextResponse.json({ ok: true, status: 'cmd_ayuda' });
    }

    // EMPRESAS
    if (cmd === 'empresas' || cmd === 'mis empresas') {
      await cmdEmpresas(sessionId, fromJid, companyIds);
      return NextResponse.json({ ok: true, status: 'cmd_empresas' });
    }

    // TODOS (admin)
    if (cmd === 'todos' && isAdmin) {
      await cmdEmpresas(sessionId, fromJid, undefined);
      return NextResponse.json({ ok: true, status: 'cmd_todos_admin' });
    }

    // RESUMEN (admin)
    if ((cmd === 'resumen' || cmd === 'resumen global') && isAdmin) {
      await cmdResumenAdmin(sessionId, fromJid);
      return NextResponse.json({ ok: true, status: 'cmd_resumen_admin' });
    }

    // EMPRESA [nombre]
    if (cmd.startsWith('empresa ')) {
      await cmdEmpresaDetalle(sessionId, fromJid, body.slice(8).trim(), companyIds);
      return NextResponse.json({ ok: true, status: 'cmd_empresa_detalle' });
    }

    // DIAGNOSTICO [nombre]
    if (cmd.startsWith('diagnostico ') || cmd.startsWith('diagnóstico ')) {
      const query = body.replace(/^diagn[oó]stico\s*/i, '').trim();
      await cmdDiagnostico(sessionId, fromJid, query, companyIds);
      return NextResponse.json({ ok: true, status: 'cmd_diagnostico' });
    }
    if (cmd === 'diagnostico' || cmd === 'diagnóstico' || cmd === 'mi diagnostico') {
      await cmdDiagnostico(sessionId, fromJid, '', companyIds);
      return NextResponse.json({ ok: true, status: 'cmd_diagnostico' });
    }

    // BRECHAS [nombre]
    if (cmd.startsWith('brechas ')) {
      await cmdBrechas(sessionId, fromJid, body.slice(8).trim(), companyIds);
      return NextResponse.json({ ok: true, status: 'cmd_brechas' });
    }
    if (cmd === 'brechas' || cmd === 'mis brechas') {
      await cmdBrechas(sessionId, fromJid, '', companyIds);
      return NextResponse.json({ ok: true, status: 'cmd_brechas' });
    }

    // PUNTAJE / SCORE
    if (['puntaje', 'puntajes', 'score', 'mi puntaje', 'mis puntajes', 'calificacion', 'calificaciones'].includes(cmd)) {
      await cmdPuntaje(sessionId, fromJid, companyIds);
      return NextResponse.json({ ok: true, status: 'cmd_puntaje' });
    }

    // ESTADO
    if (['estado', 'mi estado', 'estado general', 'cumplimiento', 'resumen'].includes(cmd)) {
      await cmdEstado(sessionId, fromJid, greeting, companyIds);
      return NextResponse.json({ ok: true, status: 'cmd_estado' });
    }

    // LEY 1581
    if (['ley', 'ley 1581', 'ley1581', 'ley de datos', 'habeas data', 'proteccion datos'].includes(cmd)) {
      const msg =
        `📜 *Ley 1581 de 2012 — Resumen*\n\n` +
        `La Ley 1581 de 2012 (Colombia) regula el *tratamiento de datos personales* y desarrolla el derecho constitucional de *Habeas Data*.\n\n` +
        `*🎯 Principios clave:*\n` +
        `• Legalidad, finalidad y libertad\n` +
        `• Veracidad y transparencia\n` +
        `• Acceso restringido y seguridad\n` +
        `• Confidencialidad\n\n` +
        `*👤 Derechos del titular:*\n` +
        `• Conocer, actualizar y rectificar sus datos\n` +
        `• Solicitar prueba de la autorización\n` +
        `• Revocar la autorización\n` +
        `• Presentar quejas ante la SIC\n\n` +
        `*🏢 Obligaciones de las empresas:*\n` +
        `• Obtener autorización previa del titular\n` +
        `• Publicar Política de Tratamiento de Datos\n` +
        `• Registrar la base de datos ante la SIC\n` +
        `• Garantizar los derechos del titular\n\n` +
        `Escribe *articulo [N]* para consultar un artículo específico.\n\n_PrivacyCheck CO · Sintaxis TI_`;
      await sendWhatsAppMessage(sessionId, fromJid, msg);
      return NextResponse.json({ ok: true, status: 'cmd_ley_1581' });
    }

    // ARTICULO [N]
    const artMatch = cmd.match(/^(art(?:iculo)?\.?|articulo)\s*(\d+)$/i);
    if (artMatch) {
      const num = artMatch[2];
      const info = LEY_1581_ARTICULOS[num];
      if (info) {
        await sendWhatsAppMessage(sessionId, fromJid,
          `📜 ${info}\n\nEscribe *ley 1581* para ver el resumen completo.\n\n_PrivacyCheck CO · Sintaxis TI_`);
      } else {
        await sendWhatsAppMessage(sessionId, fromJid,
          `❓ El artículo ${num} no está en mi base de conocimiento directa.\n\nPuedes preguntarme en lenguaje natural y usaré la IA para responderte.\n\n_PrivacyCheck CO · Sintaxis TI_`);
      }
      return NextResponse.json({ ok: true, status: 'cmd_articulo' });
    }

    // NUEVO DIAGNOSTICO
    if (cmd.startsWith('nuevo ') || cmd === 'nuevo diagnostico' || cmd === 'nueva evaluacion') {
      await sendWhatsAppMessage(sessionId, fromJid,
        `📋 *Iniciar nuevo diagnóstico*\n\nAccede al siguiente enlace para comenzar:\n${APP_URL}/evaluations\n\nEl proceso toma aproximadamente 15–20 minutos y cubre los 3 bloques de la Ley 1581.\n\n_PrivacyCheck CO · Sintaxis TI_`);
      return NextResponse.json({ ok: true, status: 'cmd_nuevo_diagnostico' });
    }

    // CONTACTO / SOPORTE
    if (['contacto', 'soporte', 'ayuda tecnica', 'contactar', 'administrador', 'admin'].includes(cmd)) {
      await sendWhatsAppMessage(sessionId, fromJid,
        `📞 *Contacto y Soporte*\n\n*PrivacyCheck CO* es desarrollado por *Sintaxis TI*.\n\n` +
        `🌐 Plataforma: ${APP_URL}\n` +
        `📧 Soporte: soporte@sintaxisti.com\n\n` +
        `Para soporte técnico o problemas de acceso, contacta directamente al administrador de tu cuenta.\n\n_PrivacyCheck CO · Sintaxis TI_`);
      return NextResponse.json({ ok: true, status: 'cmd_contacto' });
    }

    // ── 3. Consulta libre → IA (Grok si XAI_API_KEY, si no Gemini) ──────────
    const context = await buildContext(companyIds);
    const reply = await aiReply(body, context, greeting);
    await sendWhatsAppMessage(sessionId, fromJid, reply);

    return NextResponse.json({ ok: true, status: 'ai_reply' });
  } catch (err: any) {
    console.error('[WA Webhook] Error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
