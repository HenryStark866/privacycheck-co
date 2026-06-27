import { NextResponse } from 'next/server';
import {
  SYSTEM_PROMPT, explainPrompt, guidePrompt,
  actionPlanPrompt, interpretPrompt, buildFallbackActionPlan,
} from '@/lib/ai/prompts';
import { verifySession } from '@/lib/firebase/session';

const VALID_KINDS = ['explain', 'guide', 'action_plan', 'interpret'] as const;
type Kind = typeof VALID_KINDS[number];

// Modelos en orden de preferencia
const MODELS = [
  'gemini-2.5-flash',
  'gemini-flash-latest',
  'gemini-2.0-flash',
];

async function callAI(system: string, userPrompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'REEMPLAZA_CON_TU_API_KEY_REAL') {
    throw new Error('Gemini API key no configurada');
  }

  const body = {
    system_instruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: {
      maxOutputTokens: 1024,
      temperature: 0.2,
    },
  };

  let res: Response | null = null;
  let lastError: any = null;

  for (const model of MODELS) {
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      if (res.ok) break;
      lastError = new Error(`Error ${res.status}: ${await res.text()}`);
      console.warn(`Modelo ${model} falló con status ${res.status}, intentando siguiente...`);
    } catch (err) {
      lastError = err;
      console.warn(`Modelo ${model} causó error de conexión, intentando siguiente...`);
    }
  }

  if (!res || !res.ok) {
    throw lastError || new Error('No se pudo conectar con Gemini');
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) throw new Error('Respuesta vacía de Gemini');
  return text;
}

export async function POST(request: Request) {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await request.json();
  const { kind } = body;

  if (!VALID_KINDS.includes(kind as Kind)) {
    return NextResponse.json({ error: 'kind inválido' }, { status: 400 });
  }

  let userPrompt = '';
  switch (kind as Kind) {
    case 'explain':     userPrompt = explainPrompt(body.questionText); break;
    case 'guide':       userPrompt = guidePrompt(body.questionText); break;
    case 'action_plan': userPrompt = actionPlanPrompt(body.gaps, body.blocks); break;
    case 'interpret':   userPrompt = interpretPrompt(body.score, body.maturity, body.blocks); break;
  }

  try {
    const text = await callAI(SYSTEM_PROMPT, userPrompt);

    if (kind === 'action_plan') {
      try {
        const cleaned = text.replace(/```json?/g, '').replace(/```/g, '').trim();
        return NextResponse.json({ content: JSON.parse(cleaned) });
      } catch {
        return NextResponse.json({ content: { acciones: buildFallbackActionPlan(body.gaps ?? []) } });
      }
    }

    return NextResponse.json({ content: text });
  } catch (err: any) {
    console.error('AI route error:', err?.status, err?.message ?? err);
    if (kind === 'action_plan') {
      return NextResponse.json({ content: { acciones: buildFallbackActionPlan(body.gaps ?? []) } });
    }
    return NextResponse.json({ content: null, error: 'Error en el servicio de IA' });
  }
}
