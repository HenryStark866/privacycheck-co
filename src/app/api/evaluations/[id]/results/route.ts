import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/firebase/session';
import { getEvaluation, getMembership, getAnswers, getRecommendations } from '@/lib/firebase/firestore-helpers';
import { getCompany } from '@/lib/firebase/firestore-helpers';

// GET /api/evaluations/[id]/results → datos completos de resultados
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const evaluation = await getEvaluation(params.id);
  if (!evaluation) return NextResponse.json({ error: 'Evaluación no encontrada' }, { status: 404 });

  const membership = await getMembership(user.uid, evaluation.companyId);
  if (!membership) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const [answers, recs, company] = await Promise.all([
    getAnswers(params.id),
    getRecommendations(params.id),
    getCompany(evaluation.companyId),
  ]);

  return NextResponse.json({
    evaluation,
    answers,
    recommendations: recs,
    companyName: company?.name ?? '',
  });
}
