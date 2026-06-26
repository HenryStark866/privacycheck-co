'use client';

import { useState } from 'react';
import { Zap } from 'lucide-react';
import { computeScore, whatIfScore, SCORED_IDS } from '@/lib/scoring';
import { getQuestion } from '@/lib/questions';
import type { Gap } from '@/lib/scoring';

interface Props {
  answers: Record<number, boolean | null | undefined>;
  currentScore: number;
  gaps: Gap[];
}

export default function WhatIfSimulator({ answers, currentScore, gaps }: Props) {
  const [simAnswers, setSimAnswers] = useState<Record<number, boolean | null | undefined>>(answers);

  const simScore = computeScore(simAnswers).scoreRounded;
  const delta = simScore - Math.round(currentScore);

  function toggle(id: number) {
    setSimAnswers((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function reset() { setSimAnswers(answers); }

  return (
    <div className="border border-brand-200 rounded-xl bg-brand-50 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-brand-800 flex items-center gap-2">
          <Zap className="w-4 h-4" /> Simulador "¿Qué pasaría si…?"
        </h3>
        <button onClick={reset} className="text-xs text-brand-600 hover:underline">Reiniciar</button>
      </div>
      <p className="text-xs text-brand-700">
        Activa las brechas que podrías corregir y mira cómo sube el puntaje.
      </p>

      <div className="space-y-2">
        {gaps.map((gap) => {
          const q = getQuestion(gap.questionId);
          const simVal = simAnswers[gap.questionId];
          const gain = whatIfScore(answers, gap.questionId) - currentScore;
          return (
            <label key={gap.questionId}
              className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={simVal === true}
                onChange={() => toggle(gap.questionId)}
                className="mt-0.5 accent-brand-600"
              />
              <span className="text-xs text-gray-700 group-hover:text-gray-900 leading-snug">
                {q?.text ?? `Q${gap.questionId}`}
                <span className="ml-1 text-green-600 font-medium">(+{gap.weight}%)</span>
              </span>
            </label>
          );
        })}
      </div>

      <div className="border-t border-brand-200 pt-3 flex items-center justify-between">
        <span className="text-sm text-brand-700">Puntaje simulado:</span>
        <span className={`text-xl font-bold ${delta >= 0 ? 'text-green-700' : 'text-red-700'}`}>
          {simScore}%
          {delta !== 0 && (
            <span className="text-sm font-medium ml-1">
              ({delta > 0 ? '+' : ''}{delta}%)
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
