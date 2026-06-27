'use client';

import { useMemo } from 'react';
import { predictRisk, MODEL_INFO, type RiskLevel } from '@/lib/ml/risk-model';
import { BrainCircuit, TrendingDown, Users, AlertTriangle, ArrowDownRight } from 'lucide-react';

const RISK_STYLES: Record<RiskLevel, { bar: string; text: string; bg: string; ring: string }> = {
  Bajo:     { bar: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', ring: 'ring-emerald-200' },
  Moderado: { bar: 'bg-amber-500',   text: 'text-amber-700',   bg: 'bg-amber-50',   ring: 'ring-amber-200' },
  Alto:     { bar: 'bg-orange-500',  text: 'text-orange-700',  bg: 'bg-orange-50',  ring: 'ring-orange-200' },
  Crítico:  { bar: 'bg-red-500',     text: 'text-red-700',     bg: 'bg-red-50',     ring: 'ring-red-200' },
};

export default function MLRiskPanel({ answers }: { answers: Record<number, boolean | null | undefined> }) {
  const pred = useMemo(() => predictRisk(answers), [answers]);
  const s = RISK_STYLES[pred.riskLevel];
  const riskReduction = Math.max(0, pred.riskPercent - pred.projectedRiskPercent);

  return (
    <section
      className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5"
      aria-labelledby="ml-panel-title"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-sm">
            <BrainCircuit className="w-5 h-5 text-white" aria-hidden="true" />
          </span>
          <div>
            <h3 id="ml-panel-title" className="text-sm font-bold text-slate-900">
              Predicción de riesgo · Machine Learning
            </h3>
            <p className="text-[11px] text-slate-400">
              {MODEL_INFO.algorithm}
            </p>
          </div>
        </div>
        <span className="text-[10px] uppercase tracking-wider font-semibold text-violet-600 bg-violet-50 border border-violet-100 rounded-full px-2.5 py-1">
          IA Predictiva
        </span>
      </div>

      {/* Riesgo principal */}
      <div className={`rounded-2xl p-5 ${s.bg} ring-1 ${s.ring}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className={`w-4 h-4 ${s.text}`} aria-hidden="true" />
            <span className="text-xs font-semibold text-slate-600">
              Probabilidad de hallazgo sancionable (SIC)
            </span>
          </div>
          <span className={`text-xs font-bold uppercase tracking-wide ${s.text}`}>
            Riesgo {pred.riskLevel}
          </span>
        </div>

        <div className="flex items-end gap-3">
          <span className={`text-4xl font-extrabold tabular-nums ${s.text}`}>
            {pred.riskPercent}
            <span className="text-xl">%</span>
          </span>
          <span className="text-[11px] text-slate-500 mb-1.5">
            certeza del modelo: <strong className="text-slate-700">{pred.confidence}%</strong>
          </span>
        </div>

        <div
          className="mt-3 h-2.5 w-full rounded-full bg-white/70 overflow-hidden"
          role="progressbar"
          aria-valuenow={pred.riskPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Probabilidad de riesgo regulatorio"
        >
          <div
            className={`h-full rounded-full ${s.bar} transition-[width] duration-700`}
            style={{ width: `${pred.riskPercent}%` }}
          />
        </div>
      </div>

      {/* Proyección + Benchmark */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-1.5 text-slate-500 mb-2">
            <TrendingDown className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
            <span className="text-[11px] font-semibold uppercase tracking-wide">Proyección</span>
          </div>
          <p className="text-sm text-slate-700 leading-snug">
            Si cierras las <strong>3 brechas de mayor peso</strong>, el riesgo baja a{' '}
            <strong className="text-emerald-700">{pred.projectedRiskPercent}%</strong>{' '}
            <span className="inline-flex items-center text-emerald-600 font-semibold">
              <ArrowDownRight className="w-3.5 h-3.5" aria-hidden="true" />−{riskReduction} pts
            </span>
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Puntaje proyectado: <strong className="text-slate-600">{pred.projectedScore}%</strong> · {pred.projectedMaturity}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-1.5 text-slate-500 mb-2">
            <Users className="w-3.5 h-3.5 text-indigo-600" aria-hidden="true" />
            <span className="text-[11px] font-semibold uppercase tracking-wide">Benchmark sectorial</span>
          </div>
          <p className="text-sm text-slate-700 leading-snug">
            Tu organización supera al{' '}
            <strong className="text-indigo-700">{pred.benchmark.percentile}%</strong> de una muestra de{' '}
            {pred.benchmark.sampleSize} empresas (k-NN).
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Perfiles similares promedian <strong className="text-slate-600">{pred.benchmark.neighborAvgScore}%</strong> · media del sector {pred.benchmark.sectorAvgScore}%
          </p>
        </div>
      </div>

      {/* Factores de riesgo (feature importance) */}
      {pred.drivers.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2.5">
            Factores que más elevan tu riesgo
          </p>
          <ul className="space-y-2">
            {pred.drivers.map((d) => (
              <li key={d.questionId} className="flex items-center gap-3">
                <span className="text-xs text-slate-600 flex-1 min-w-0 truncate">{d.label}</span>
                <div className="w-24 h-1.5 rounded-full bg-slate-100 overflow-hidden shrink-0" aria-hidden="true">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-600"
                    style={{ width: `${d.contribution}%` }}
                  />
                </div>
                <span className="text-[11px] font-bold text-slate-500 tabular-nums w-9 text-right shrink-0">
                  {d.contribution}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[10px] text-slate-400 leading-relaxed border-t border-slate-100 pt-3">
        Modelo {MODEL_INFO.name} · {pred.model.features} variables · entrenado sobre {pred.model.trainedOn}.
        Estimación orientativa; no constituye asesoría jurídica.
      </p>
    </section>
  );
}
