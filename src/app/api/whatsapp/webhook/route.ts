/**
 * POST /api/whatsapp/webhook
 *
 * Recibe eventos de OpenWA y responde mensajes de WhatsApp.
 *
 * Flujo:
 *  1. Recibe evento message.received
 *  2. Busca al remitente en la colección users por su número de WhatsApp
 *  3. Si es admin global → contexto con TODAS las empresas
 *     Si es usuario registrado → contexto con SUS empresas solamente
 *     Si no está registrado → mensaje de acceso denegado con instrucciones
 *  4. Comandos rápidos (ayuda, empresas, empresa X)
 *  5. Consulta libre → Gemini con contexto de Firestore
 */
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import {
  sendWhatsAppMessage,
  findUserByPhone,
  normalizePhone,
} from '@/lib/whatsapp';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const BOT_PERSONA = `Eres el asistente oficial de WhatsApp de *PrivacyCheck CO*, experto en la Ley 1581 de 2012 (protección de datos personales en Colombia) y Privacy by Design.
Responde en español colombiano claro, directo y profesional. Usa viñetas (*•*) y negritas (*texto*) para facilitar la lectura en celulares. Sé conciso. Si mencionas artículos de la ley, cítalos correctamente. No inventes datos.`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

  // Verificar si algún usuario con systemRole === 'admin' tiene este número en Firestore
  try {
    const snap = await adminDb.collection('users').where('systemRole', '==', 'admin').get();
    for (const d of snap.docs) {
      const wa = d.data().whatsapp;
      if (wa && normalizePhone(wa).slice(-10) === s) return true;
    }
  } catch (err) {
    console.error('[WA Webhook] Error verificando rol admin en DB:', err);
  }
  return false;
}

async function geminiReply(prompt: string, context: string): Promise<string> {
  if (!GEMINI_API_KEY) return '⚠️ La IA no está configurada en el servidor.';

  const body = {
    system_instruction: { parts: [{ text: BOT_PERSONA }] },
    contents: [{
      role: 'user',
      parts: [{ text: `Contexto de la base de datos:\n${context}\n\nConsulta del usuario:\n"${prompt}"` }],
    }],
    generationConfig: { maxOutputTokens: 1024, temperature: 0.4 },
  };

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    );
    if (!res.ok) return 'Tuve un problema temporal con la IA. Intenta de nuevo en un momento.';
    const d = await res.json();
    return d?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? 'Sin respuesta de la IA.';
  } catch {
    return 'Error de conexión con el motor de IA.';
  }
}

async function buildContext(companyIds?: string[]): Promise<string> {
  const compsSnap = await adminDb.collection('companies').get();
  const companies = companyIds
    ? compsSnap.docs.filter((d) => companyIds.includes(d.id))
    : compsSnap.docs;

  if (companies.length === 0) return 'No hay empresas registradas para este usuario.';

  const evalsSnap = await adminDb.collection('evaluations').get();
  const evals     = evalsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as any));

  return companies.map((doc) => {
    const c    = doc.data();
    const done = evals.filter((e) => e.companyId === doc.id && e.status === 'completada');
    const latestScore = done.length > 0
      ? `${done.sort((a: any, b: any) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))[0].score}%`
      : 'sin diagnóstico completado';
    return `• ${c.name} (NIT: ${c.nit ?? 'N/A'}, Sector: ${c.sector ?? 'N/A'}) → ${latestScore}`;
  }).join('\n');
}

// ─── Comandos ────────────────────────────────────────────────────────────────

async function cmdEmpresas(sessionId: string, chatId: string, companyIds?: string[]) {
  const compsSnap = await adminDb.collection('companies').get();
  const list = companyIds
    ? compsSnap.docs.filter((d) => companyIds.includes(d.id))
    : compsSnap.docs;

  if (list.length === 0) {
    await sendWhatsAppMessage(sessionId, chatId, '🏢 No tienes empresas registradas aún. Créalas en la app web.');
    return;
  }

  const evalsSnap = await adminDb.collection('evaluations').get();
  const evals     = evalsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as any));

  let msg = `🏢 *Empresas registradas (${list.length}):*\n\n`;
  list.forEach((doc, i) => {
    const c    = doc.data();
    const done = evals.filter((e) => e.companyId === doc.id && e.status === 'completada');
    const pct  = done.length > 0
      ? `*${Math.round(done.reduce((s: number, e: any) => s + (e.score ?? 0), 0) / done.length)}%*`
      : 'Sin diagnóstico';
    msg += `${i + 1}. *${c.name}* — ${pct}\n   NIT: ${c.nit ?? 'N/A'}\n\n`;
  });
  msg += `Escribe *empresa [nombre]* para ver el detalle.`;
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
      `❌ No encontré empresa con "${query}". Escribe *empresas* para ver la lista.`);
    return;
  }

  const c      = match.data();
  const evSnap = await adminDb.collection('evaluations').where('companyId', '==', match.id).get();

  let msg = `🏢 *${c.name}*\n• NIT: ${c.nit ?? 'N/A'}\n• Sector: ${c.sector ?? 'N/A'}\n• Tamaño: ${c.size ?? 'N/A'}\n\n`;

  if (evSnap.empty) {
    msg += 'Sin diagnósticos registrados.';
  } else {
    msg += `*Diagnósticos (${evSnap.size}):*\n`;
    evSnap.docs
      .sort((a, b) => (b.data().createdAt?.seconds ?? 0) - (a.data().createdAt?.seconds ?? 0))
      .forEach((d) => {
        const ev    = d.data();
        const fecha = ev.createdAt
          ? new Date((ev.createdAt.seconds ?? 0) * 1000).toLocaleDateString('es-CO')
          : 'N/A';
        msg += `• [${(ev.status as string).toUpperCase()}] ${fecha}`;
        if (ev.status === 'completada') msg += ` → *${ev.score}%* (${ev.maturity ?? 'N/A'})`;
        msg += '\n';
      });
  }
  await sendWhatsAppMessage(sessionId, chatId, msg);
}

// ─── Handler principal ───────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    console.log('[WA Webhook] Evento recibido:', payload?.event);

    const { event, sessionId, data } = payload || {};

    // Ignorar si no hay datos o es un mensaje de grupo
    if (!data || data.isGroup) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const fromJid = (data.from || data.chatId || data.author || '').toString();
    if (!fromJid) return NextResponse.json({ ok: true, ignored: true });

    const senderPhone = fromJid.split('@')[0];
    const body = (data.body || data.text || data.content || '').toString().trim();
    if (!body) return NextResponse.json({ ok: true, ignored: true });

    // Evitar bucles con mensajes del propio bot
    if (data.fromMe && (body.includes('PrivacyCheck CO') || body.includes('🤖'))) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const cmd = body.toLowerCase();

    // ── 1. Identificar al remitente ──────────────────────────────────────────
    const isAdmin  = await isAdminNumber(senderPhone);
    const regUser  = isAdmin ? null : await findUserByPhone(senderPhone);

    if (!isAdmin && !regUser) {
      await sendWhatsAppMessage(
        sessionId, fromJid,
        `🔒 *Acceso no autorizado*\n\nTu número (+${senderPhone}) no está vinculado a ninguna cuenta de PrivacyCheck CO.\n\n` +
        `Ingresa a *privacycheck-co.vercel.app*, crea tu cuenta o vincula este número en la plataforma.`
      );
      return NextResponse.json({ ok: true, status: 'unauthorized' });
    }

    // IDs de empresas (undefined = todas → solo admin)
    let companyIds: string[] | undefined;
    if (!isAdmin && regUser) {
      const memSnap = await adminDb.collection('memberships')
        .where('userId', '==', regUser.uid)
        .get();
      companyIds = memSnap.docs.map((d) => d.data().companyId as string);
    }

    const greeting = isAdmin ? 'Administrador' : (regUser?.displayName?.split(' ')[0] ?? 'Usuario');

    // ── 2. Comandos rápidos ──────────────────────────────────────────────────

    if (['ayuda', 'help', 'menu', 'inicio', 'hola'].includes(cmd)) {
      await sendWhatsAppMessage(sessionId, fromJid,
        `👋 *Hola, ${greeting}!*\n\n` +
        `*Comandos disponibles:*\n` +
        `• *empresas* → Tus empresas y su nivel de cumplimiento\n` +
        `• *empresa [nombre]* → Detalle y diagnósticos de una empresa\n` +
        (isAdmin ? `• *todos* → Todas las empresas del sistema\n` : '') +
        `• *ayuda* → Este menú\n\n` +
        `También puedes escribir en lenguaje natural sobre la *Ley 1581* o el estado de tus diagnósticos. 🤖\n\n` +
        `_PrivacyCheck CO · Sintaxis TI_`
      );
      return NextResponse.json({ ok: true, status: 'cmd_ayuda' });
    }

    if (cmd === 'empresas') {
      await cmdEmpresas(sessionId, fromJid, companyIds);
      return NextResponse.json({ ok: true, status: 'cmd_empresas' });
    }

    if (cmd === 'todos' && isAdmin) {
      await cmdEmpresas(sessionId, fromJid, undefined);
      return NextResponse.json({ ok: true, status: 'cmd_todos_admin' });
    }

    if (cmd.startsWith('empresa ')) {
      await cmdEmpresaDetalle(sessionId, fromJid, body.slice(8).trim(), companyIds);
      return NextResponse.json({ ok: true, status: 'cmd_empresa_detalle' });
    }

    // ── 3. Consulta libre con Gemini ─────────────────────────────────────────
    const context = await buildContext(companyIds);
    const reply   = await geminiReply(body, context);
    await sendWhatsAppMessage(sessionId, fromJid, reply);

    return NextResponse.json({ ok: true, status: 'ai_reply' });
  } catch (err: any) {
    console.error('[WA Webhook] Error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
