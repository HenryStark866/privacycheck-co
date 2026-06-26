'use client';

import { AlertTriangle } from 'lucide-react';
import { getQuestion } from '@/lib/questions';
import type { Gap } from '@/lib/scoring';
import type { ActionItem } from '@/lib/ai/prompts';
import { cn } from '@/lib/utils';

interface Props {
  gaps: Gap[];
  actions?: ActionItem[];
}

const plazoColor: Record<string, string> = {
  corto: 'bg-green-100 text-green-700',
  medio: 'bg-yellow-100 text-yellow-700',
  largo: 'bg-red-100 text-red-700',
};

export default function GapList({ gaps, actions }: Props) {
  if (gaps.length === 0) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-green-800 text-sm">
        ¡Excelente! No se encontraron brechas en este diagnóstico.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-orange-500" />
        Brechas identificadas ({gaps.length})
      </h3>
      {gaps.map((gap) => {
        const q = getQuestion(gap.questionId);
        const action = actions?.find((a) => a.prioridad === gaps.indexOf(gap) + 1);
        return (
          <div key={gap.questionId}
            className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm space-y-2">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-gray-800">{q?.text ?? `Pregunta ${gap.questionId}`}</p>
              <span className="shrink-0 text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
                -{gap.weight}%
              </span>
            </div>
            {action && (
              <div className="text-xs text-gray-600 border-t pt-2 space-y-1">
                <p className="font-medium text-gray-700">Acción sugerida:</p>
                <p>{action.accion}</p>
                <div className="flex gap-2 mt-1">
                  <span className="text-xs font-medium text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full">
                    Impacto: {action.impacto_estimado}
                  </span>
                  <span className={cn(
                    'text-xs font-medium px-2 py-0.5 rounded-full capitalize',
                    plazoColor[action.plazo_sugerido] ?? 'bg-gray-100 text-gray-600',
                  )}>
                    Plazo {action.plazo_sugerido}
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
