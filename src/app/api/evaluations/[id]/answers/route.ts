import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/firebase/session';
import { getAnswers, upsertAnswers, getEvaluation, getMembership } from '@/lib/firebase/firestore-helpers';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

// GET /api/evaluations/[id]/answers  → carga respuestas
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const evaluation = await getEvaluation(params.id);
  if (!evaluation) return NextResponse.json({ error: 'Evaluación no encontrada' }, { status: 404 });

  // Verificar acceso vía membership
  const membership = await getMembership(user.uid, evaluation.companyId);
  if (!membership) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const answers = await getAnswers(params.id);
  return NextResponse.json({ answers });
}

// POST /api/evaluations/[id]/answers  → guarda respuestas (borrador)
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const evaluation = await getEvaluation(params.id);
  if (!evaluation) return NextResponse.json({ error: 'Evaluación no encontrada' }, { status: 404 });

  const membership = await getMembership(user.uid, evaluation.companyId);
  if (!membership) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const { answers } = await request.json();
  await upsertAnswers(params.id, answers);

  return NextResponse.json({ ok: true });
}

// PUT /api/evaluations/[id]/answers  → finaliza diagnóstico
export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
) {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const evaluation = await getEvaluation(params.id);
  if (!evaluation) return NextResponse.json({ error: 'Evaluación no encontrada' }, { status: 404 });

  const membership = await getMembership(user.uid, evaluation.companyId);
  if (!membership || !['administrador', 'evaluador'].includes(membership.role)) {
    return NextResponse.json({ error: 'Sin permisos para finalizar' }, { status: 403 });
  }

  const { answers, score, blockA, blockB, blockC, maturity } = await request.json();

  // Guardar respuestas y marcar como completada en una operación atómica
  await upsertAnswers(params.id, answers);
  await adminDb.collection('evaluations').doc(params.id).update({
    status: 'completada',
    score,
    blockA,
    blockB,
    blockC,
    maturity,
    completedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ ok: true });
}
