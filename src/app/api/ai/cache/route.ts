import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/firebase/session';
import { upsertRecommendation, getEvaluation, getMembership } from '@/lib/firebase/firestore-helpers';

// POST /api/ai/cache  — Guarda interpretación y plan de acción en Firestore (Admin SDK)
export async function POST(request: Request) {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { evaluationId, interpretation, actions } = await request.json();
  if (!evaluationId) return NextResponse.json({ error: 'evaluationId requerido' }, { status: 400 });

  const evaluation = await getEvaluation(evaluationId);
  if (!evaluation) return NextResponse.json({ error: 'Evaluación no encontrada' }, { status: 404 });

  const membership = await getMembership(user.uid, evaluation.companyId);
  if (!membership) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  await Promise.all([
    interpretation !== undefined
      ? upsertRecommendation(evaluationId, 'interpret', interpretation)
      : Promise.resolve(),
    actions !== undefined
      ? upsertRecommendation(evaluationId, 'action_plan', { acciones: actions })
      : Promise.resolve(),
  ]);

  return NextResponse.json({ ok: true });
}
