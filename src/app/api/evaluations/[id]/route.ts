/**
 * GET /api/evaluations/[id]
 * Devuelve la evaluación, sus respuestas, el nombre/NIT de la empresa y las
 * recomendaciones cacheadas. Autenticación por session cookie + Admin SDK,
 * de modo que NO depende del SDK cliente (que no está autenticado de forma
 * confiable tras la navegación dura del login).
 */
import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/firebase/session';
import {
  getEvaluation, getAnswers, getCompany, getMembership, getRecommendations,
} from '@/lib/firebase/firestore-helpers';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const evaluation = await getEvaluation(params.id);
  if (!evaluation) return NextResponse.json({ error: 'Evaluación no encontrada' }, { status: 404 });

  const membership = await getMembership(user.uid, evaluation.companyId);
  if (!membership) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const [answers, company, recs] = await Promise.all([
    getAnswers(params.id),
    getCompany(evaluation.companyId),
    getRecommendations(params.id),
  ]);

  const recommendations: Record<string, unknown> = {};
  for (const r of (recs as unknown as Array<{ kind: string; content: unknown }>) ) {
    recommendations[r.kind] = r.content;
  }

  return NextResponse.json({
    evaluation: {
      id: evaluation.id,
      companyId: evaluation.companyId,
      status: evaluation.status,
      score: evaluation.score ?? null,
      maturity: evaluation.maturity ?? null,
    },
    answers,
    companyName: company?.name ?? '',
    companyNit: company?.nit ?? '',
    recommendations,
  });
}
