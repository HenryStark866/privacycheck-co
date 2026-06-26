/**
 * scoring.ts — Motor de puntuación CAVALTEC Ley 1581
 * FUENTE DE VERDAD para el porcentaje de cumplimiento.
 *
 * Reglas:
 *   1. Q1 es PADRE sin peso propio: hereda la suma de Q2–Q5.
 *   2. Q11 es COMPLEMENTARIA: nunca suma al total.
 *   3. Total = suma de pesos ganados en Q2..Q10, máx 100.
 */

export const WEIGHTS: Record<number, number> = {
  2: 10, 3: 10, 4: 10, 5: 10,   // Bloque A (max 40)
  6: 12, 7: 12, 8: 12,           // Bloque B (max 36)
  9: 16, 10: 8,                  // Bloque C (max 24)
};

export const SCORED_IDS = Object.keys(WEIGHTS).map(Number);

export const BLOCKS = {
  A: { ids: [2, 3, 4, 5], max: 40, name: 'Política de datos personales' },
  B: { ids: [6, 7, 8],    max: 36, name: 'Privacidad desde el diseño' },
  C: { ids: [9, 10],      max: 24, name: 'Gobernanza' },
} as const;

export type MaturityLevel = 'Inicial' | 'Básico' | 'Gestionado' | 'Optimizado' | 'Líder';

export function getMaturity(score: number): MaturityLevel {
  if (score >= 95) return 'Líder';
  if (score >= 75) return 'Optimizado';
  if (score >= 50) return 'Gestionado';
  if (score >= 25) return 'Básico';
  return 'Inicial';
}

export interface BlockResult {
  name: string;
  earned: number;
  max: number;
  pct: number;
}

export interface Gap {
  questionId: number;
  weight: number;
}

export interface ScoreResult {
  score: number;
  scoreRounded: number;
  blocks: Record<string, BlockResult>;
  maturity: MaturityLevel;
  gaps: Gap[];
  notes: string[];
}

/**
 * @param answers - mapa questionId -> boolean (true = "Sí"). Ausente/null = "No".
 */
export function computeScore(answers: Record<number, boolean | null | undefined> = {}): ScoreResult {
  const isYes = (id: number) => answers[id] === true;

  const blocks: Record<string, BlockResult> = {};
  for (const [key, b] of Object.entries(BLOCKS)) {
    const earned = b.ids.reduce((sum, id) => sum + (isYes(id) ? WEIGHTS[id] : 0), 0);
    blocks[key] = { name: b.name, earned, max: b.max, pct: Math.round((earned / b.max) * 100) };
  }

  let score = SCORED_IDS.reduce((sum, id) => sum + (isYes(id) ? WEIGHTS[id] : 0), 0);
  score = Math.min(100, Math.max(0, score));

  const gaps: Gap[] = SCORED_IDS
    .filter((id) => !isYes(id))
    .map((id) => ({ questionId: id, weight: WEIGHTS[id] }))
    .sort((a, b) => b.weight - a.weight);

  const notes: string[] = [];
  if (isYes(10) && answers[11] !== true) {
    notes.push('Tiene oficial de protección de datos, pero no está designado formalmente (Q11).');
  }
  if (!isYes(10) && answers[11] === true) {
    notes.push('Estado inconsistente: Q11 marcada sin Q10. Se ignora la designación formal.');
  }
  if (answers[1] === false && [2, 3, 4, 5].some(isYes)) {
    notes.push('Estado inconsistente: hay elementos de política (Q2–Q5) sin política base (Q1).');
  }

  return { score, scoreRounded: Math.round(score), blocks, maturity: getMaturity(score), gaps, notes };
}

/** Simulador "what-if": ¿cuánto subiría el puntaje si se corrige la respuesta de questionId? */
export function whatIfScore(
  answers: Record<number, boolean | null | undefined>,
  questionId: number,
): number {
  const simulated = { ...answers, [questionId]: true };
  return computeScore(simulated).score;
}
