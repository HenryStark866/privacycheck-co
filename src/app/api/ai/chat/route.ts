/**
 * /api/ai/chat — Chat con asesor Ley 1581
 * Usa Gemini API via fetch nativo (sin paquetes externos).
 * Fallback inteligente con reglas si la API no está configurada.
 */
import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/firebase/session';
import { getFallbackResponse } from '@/lib/ai/chat-fallback';

const SYSTEM_INSTRUCTION = `Eres un asesor experto en protección de datos personales en Colombia, especializado en la Ley 1581 de 2012 y sus decretos reglamentarios (Decreto 1377 de 2013, Decreto 1074 de 2015). Tu rol es ayudar a organizaciones a entender sus obligaciones legales, interpretar su diagnóstico de cumplimiento y orientarlas para cerrar brechas. Habla siempre en español colombiano, claro y cercano. Sé conciso: 2-4 párrafos salvo que pidan más detalle. Nunca inventes artículos ni sanciones. Cita la ley correctamente. Formatea con listas o negritas cuando ayude a la claridad.`;

async function callGemini(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'PEGAR_CLAVE_GEMINI_AQUI') return null;

  // Convertir al formato de Gemini
  const contents = messages.map((m) => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }],
  }));

  const body = {
    system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents,
    generationConfig: {
      maxOutputTokens: 1024,
      temperature: 0.7,
    },
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    console.error('Gemini API error:', res.status, err);
    return null;
  }

  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;
}

export async function POST(request: Request) {
  const user = await verifySession();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await request.json();
  const { messages } = body as {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  };

  if (!messages?.length) {
    return NextResponse.json({ error: 'messages requerido' }, { status: 400 });
  }

  const lastUserMessage = messages.filter((m) => m.role === 'user').at(-1)?.content ?? '';

  // Intentar Gemini primero
  try {
    const geminiText = await callGemini(messages);
    if (geminiText) {
      return NextResponse.json({ content: geminiText, source: 'gemini' });
    }
  } catch (err) {
    console.error('Gemini call failed:', err);
  }

  // Fallback con reglas (siempre funciona, sin API key)
  const fallback = getFallbackResponse(lastUserMessage);
  return NextResponse.json({ content: fallback, source: 'fallback' });
}
