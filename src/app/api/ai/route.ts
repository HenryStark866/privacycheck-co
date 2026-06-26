import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import {
  SYSTEM_PROMPT, explainPrompt, guidePrompt,
  actionPlanPrompt, interpretPrompt, buildFallbackActionPlan,
} from '@/lib/ai/prompts';
import { verifySession } from '@/lib/firebase/session';

const VALID_KINDS = ['explain', 'guide', 'action_plan', 'interpret'] as const;
type Kind = typeof VALID_KINDS[number];

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Modelos en orden de preferencia
const MODELS = [
  'claude-haiku-4-5-20251001',
  'claude-3-5-haiku-20241022',
  'claude-3-haiku-20240307',
];

async function callAI(system: string, userPrompt: string): Promise<string> {
  let lastError: unknown;
  for (const model of MODELS) {
    try {
      const response = await anthropic.messages.create({
        model,
        max_tokens: 1024,
        system,
        messages: [{ role: 'user', content: userPrompt }],
      });
      return response.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as { type: 'text'; text: string }).text)
        .join('\n').trim();
    } catch (err: any) {
      lastError = err;
      const isModelError =
        err?.status === 404 ||
        err?.error?.type === 'not_found_error' ||
        String(err?.message ?? '').includes('model');
      if (!isModelError) throw err;
      console.warn(`Modelo ${model} no disponible, intentando siguiente...`);
    }
  }
  throw lastError;
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
