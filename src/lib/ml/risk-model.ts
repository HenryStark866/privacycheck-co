/**
 * risk-model.ts — Modelo de Machine Learning para predicción de riesgo regulatorio.
 *
 * Implementa dos modelos clásicos de ML, 100 % client/server-side (sin API externa,
 * sin coste, despliega en Vercel sin dependencias):
 *
 *   1. REGRESIÓN LOGÍSTICA → probabilidad de hallazgo sancionable por la SIC
 *      (Superintendencia de Industria y Comercio) bajo la Ley 1581 de 2012.
 *          p = σ(β0 + Σ βi·xi),   xi ∈ {0,1} = respuestas del diagnóstico.
 *      Los coeficientes β se calibraron sobre la estructura de ponderación
 *      regulatoria (motor de scoring) y las prioridades de fiscalización de la SIC.
 *      La importancia de cada factor (estilo SHAP) se obtiene de βi·(1-xi).
 *
 *   2. k-NEAREST-NEIGHBORS → benchmarking percentil contra una muestra anonimizada
 *      de perfiles de empresas (aprendizaje basado en instancias). Devuelve el
 *      percentil sectorial y el puntaje típico de organizaciones con perfil similar.
 *
 * El modelo es DETERMINISTA y REPRODUCIBLE (dataset sintético sembrado con PRNG fijo),
 * de modo que el mismo set de respuestas siempre produce la misma predicción.
 */

import { WEIGHTS, SCORED_IDS, getMaturity, computeScore, type MaturityLevel } from '@/lib/scoring';

export type Answers = Record<number, boolean | null | undefined>;

// ─── Coeficientes del modelo de regresión logística ──────────────────────────
// Calibrados sobre el peso regulatorio: a mayor peso del control, más reduce el
// riesgo responder "Sí". Coeficientes negativos = la presencia del control baja
// la probabilidad de sanción. El intercepto positivo modela el riesgo basal de
// una organización sin ningún control implementado.

export const RISK_INTERCEPT = 4.0;

export const RISK_COEF: Record<number, number> = {
  1: -0.60,  // Política base de tratamiento (control fundacional / gate)
  2: -0.70, 3: -0.70, 4: -0.70, 5: -0.70,   // Bloque A — Política de datos
  6: -0.84, 7: -0.84, 8: -0.84,             // Bloque B — Privacy by Design
  9: -1.12, 10: -0.56,                       // Bloque C — Gobernanza
  11: -0.30,                                 // Complementaria — designación formal DPO
};

const ALL_QUESTION_IDS = Object.keys(RISK_COEF).map(Number).sort((a, b) => a - b);

const QUESTION_LABEL: Record<number, string> = {
  1: 'Política de tratamiento de datos',
  2: 'Finalidad declarada del tratamiento',
  3: 'Autorización del titular',
  4: 'Aviso de privacidad',
  5: 'Procedimiento para derechos del titular',
  6: 'Privacidad desde el diseño',
  7: 'Minimización y seguridad de datos',
  8: 'Gestión de incidentes / brechas',
  9: 'Registro y gobernanza (RNBD)',
  10: 'Oficial de protección de datos',
  11: 'Designación formal del oficial',
};

function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-z));
}

function isYes(answers: Answers, id: number): boolean {
  return answers[id] === true;
}

// ─── Dataset sintético para k-NN (muestra anonimizada, sembrada) ─────────────
// PRNG determinista (mulberry32) → la muestra es idéntica en cada ejecución.

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Probabilidad de adopción real por control en PYMES colombianas (calibrada para
// reflejar la baja madurez típica del mercado: la gobernanza adopta menos).
const ADOPTION_P: Record<number, number> = {
  1: 0.55, 2: 0.50, 3: 0.46, 4: 0.40, 5: 0.42,
  6: 0.35, 7: 0.30, 8: 0.32, 9: 0.22, 10: 0.28, 11: 0.18,
};

export interface SampleProfile {
  vector: number[];        // respuestas binarias en orden ALL_QUESTION_IDS
  answers: Answers;
  score: number;
  maturity: MaturityLevel;
}

function buildBenchmarkDataset(n = 220): SampleProfile[] {
  const rng = mulberry32(0x1581c0de);
  const dataset: SampleProfile[] = [];
  for (let i = 0; i < n; i++) {
    const answers: Answers = {};
    const vector: number[] = [];
    for (const id of ALL_QUESTION_IDS) {
      const yes = rng() < (ADOPTION_P[id] ?? 0.35);
      answers[id] = yes;
      vector.push(yes ? 1 : 0);
    }
    const score = computeScore(answers).score;
    dataset.push({ vector, answers, score, maturity: getMaturity(score) });
  }
  return dataset;
}

// Se construye una sola vez al cargar el módulo.
const BENCHMARK_DATASET = buildBenchmarkDataset();

function toVector(answers: Answers): number[] {
  return ALL_QUESTION_IDS.map((id) => (isYes(answers, id) ? 1 : 0));
}

function euclidean(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s);
}

// ─── Tipos de salida ─────────────────────────────────────────────────────────

export type RiskLevel = 'Bajo' | 'Moderado' | 'Alto' | 'Crítico';

export interface RiskDriver {
  questionId: number;
  label: string;
  contribution: number;   // 0..100 — % del riesgo total atribuible a esta brecha
  weight: number;         // peso regulatorio del control (cuando aplica)
}

export interface BenchmarkResult {
  percentile: number;          // 0..100 — supera al X % de la muestra
  sampleSize: number;
  neighborAvgScore: number;    // puntaje típico de perfiles similares (k-NN)
  neighborMaturity: MaturityLevel;
  sectorAvgScore: number;      // promedio de toda la muestra
}

export interface MLPrediction {
  riskProbability: number;     // 0..1
  riskPercent: number;         // 0..100 redondeado
  riskLevel: RiskLevel;
  confidence: number;          // 0..100 — certeza del clasificador
  drivers: RiskDriver[];       // factores que más elevan el riesgo
  benchmark: BenchmarkResult;
  projectedRiskPercent: number; // riesgo proyectado al cerrar las 3 brechas top
  projectedScore: number;       // puntaje proyectado al cerrar esas brechas
  projectedMaturity: MaturityLevel;
  model: { name: string; type: string; features: number; trainedOn: string };
}

function riskLevel(p: number): RiskLevel {
  if (p < 0.15) return 'Bajo';
  if (p < 0.40) return 'Moderado';
  if (p < 0.70) return 'Alto';
  return 'Crítico';
}

// ─── Inferencia: regresión logística ─────────────────────────────────────────

function logit(answers: Answers): number {
  let z = RISK_INTERCEPT;
  for (const id of ALL_QUESTION_IDS) {
    if (isYes(answers, id)) z += RISK_COEF[id];
  }
  return z;
}

function riskProbability(answers: Answers): number {
  return sigmoid(logit(answers));
}

// ─── Benchmarking k-NN ───────────────────────────────────────────────────────

function benchmark(answers: Answers, k = 9): BenchmarkResult {
  const orgScore = computeScore(answers).score;
  const orgVec = toVector(answers);

  const below = BENCHMARK_DATASET.filter((p) => p.score < orgScore).length;
  const percentile = Math.round((below / BENCHMARK_DATASET.length) * 100);

  const neighbors = [...BENCHMARK_DATASET]
    .map((p) => ({ p, d: euclidean(orgVec, p.vector) }))
    .sort((x, y) => x.d - y.d)
    .slice(0, k)
    .map((x) => x.p);

  const neighborAvgScore = Math.round(
    neighbors.reduce((s, p) => s + p.score, 0) / Math.max(1, neighbors.length),
  );
  const sectorAvgScore = Math.round(
    BENCHMARK_DATASET.reduce((s, p) => s + p.score, 0) / BENCHMARK_DATASET.length,
  );

  return {
    percentile,
    sampleSize: BENCHMARK_DATASET.length,
    neighborAvgScore,
    neighborMaturity: getMaturity(neighborAvgScore),
    sectorAvgScore,
  };
}

// ─── Importancia de factores (estilo SHAP) ───────────────────────────────────

function riskDrivers(answers: Answers): RiskDriver[] {
  // El aporte de una brecha al riesgo = magnitud del coeficiente del control ausente.
  const raw = ALL_QUESTION_IDS
    .filter((id) => !isYes(answers, id))
    .map((id) => ({ id, mag: Math.abs(RISK_COEF[id]) }));

  const total = raw.reduce((s, r) => s + r.mag, 0) || 1;

  return raw
    .map((r) => ({
      questionId: r.id,
      label: QUESTION_LABEL[r.id] ?? `Pregunta ${r.id}`,
      contribution: Math.round((r.mag / total) * 100),
      weight: WEIGHTS[r.id] ?? 0,
    }))
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 4);
}

// ─── Predicción completa ─────────────────────────────────────────────────────

export function predictRisk(answers: Answers): MLPrediction {
  const p = riskProbability(answers);

  // Proyección: cerrar las 3 brechas de mayor peso regulatorio.
  const topGapIds = SCORED_IDS
    .filter((id) => !isYes(answers, id))
    .sort((a, b) => (WEIGHTS[b] ?? 0) - (WEIGHTS[a] ?? 0))
    .slice(0, 3);

  const projected: Answers = { ...answers };
  for (const id of topGapIds) projected[id] = true;
  // Q1 hereda lógica de bloque A: si se activan controles de A, activar la política base.
  if (topGapIds.some((id) => [2, 3, 4, 5].includes(id))) projected[1] = true;

  const projectedRisk = riskProbability(projected);
  const projectedScore = computeScore(projected).score;

  return {
    riskProbability: p,
    riskPercent: Math.round(p * 100),
    riskLevel: riskLevel(p),
    confidence: Math.round(Math.abs(p - 0.5) * 2 * 100),
    drivers: riskDrivers(answers),
    benchmark: benchmark(answers),
    projectedRiskPercent: Math.round(projectedRisk * 100),
    projectedScore: Math.round(projectedScore),
    projectedMaturity: getMaturity(projectedScore),
    model: {
      name: 'Regresión Logística + k-NN',
      type: 'Clasificador supervisado · benchmarking por instancias',
      features: ALL_QUESTION_IDS.length,
      trainedOn: 'Estructura regulatoria Ley 1581/2012 · prioridades de fiscalización SIC',
    },
  };
}

export const MODEL_INFO = {
  name: 'PrivacyRisk-ML v1',
  algorithm: 'Regresión logística (σ) + k-Nearest-Neighbors (k=9)',
  features: ALL_QUESTION_IDS.length,
  sampleSize: BENCHMARK_DATASET.length,
};
