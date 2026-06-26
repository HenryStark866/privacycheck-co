'use client';

import { cn } from '@/lib/utils';
import type { Question } from '@/lib/questions';
import AIExplainPopover from './AIExplainPopover';
import { CheckCircle2, XCircle } from 'lucide-react';

interface Props {
  question: Question;
  value: boolean | null | undefined;
  onChange: (val: boolean) => void;
  disabled?: boolean;
  index: number;
}

export default function QuestionCard({ question, value, onChange, disabled = false, index }: Props) {
  const isParent = question.role === 'parent';
  const isComplementary = question.role === 'complementary';

  return (
    <div className={cn(
      'rounded-xl border p-4 transition-all duration-200 bg-white shadow-sm',
      disabled && 'opacity-40 pointer-events-none',
      value === true && 'border-green-300 bg-green-50/40',
      value === false && 'border-red-200 bg-red-50/30',
      value == null && 'border-gray-200',
      isParent && 'border-brand-200 bg-brand-50/30',
      isComplementary && 'border-dashed border-gray-300 bg-gray-50/40',
    )}>
      <div className="flex items-start gap-3">
        <span className="shrink-0 w-7 h-7 rounded-full bg-gray-100 text-gray-500 text-xs font-bold flex items-center justify-center mt-0.5">
          {index}
        </span>
        <div className="flex-1 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <p className={cn(
              'text-sm text-gray-800 leading-snug',
              isParent && 'font-semibold',
              isComplementary && 'italic text-gray-600',
            )}>
              {question.text}
              {isComplementary && (
                <span className="ml-2 text-xs text-gray-400 not-italic">(complementaria)</span>
              )}
            </p>
            <div className="flex gap-1.5 shrink-0">
              <AIExplainPopover question={question} kind="explain" />
              <AIExplainPopover question={question} kind="guide" />
            </div>
          </div>

          {question.weight > 0 && (
            <p className="text-xs text-gray-400">
              Peso: <span className="font-semibold text-gray-600">{question.weight}%</span>
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => onChange(true)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium border transition-all',
                value === true
                  ? 'bg-green-600 text-white border-green-600 shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-green-400 hover:text-green-700',
              )}
            >
              <CheckCircle2 className="w-4 h-4" /> Sí
            </button>
            <button
              onClick={() => onChange(false)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium border transition-all',
                value === false
                  ? 'bg-red-500 text-white border-red-500 shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-red-300 hover:text-red-600',
              )}
            >
              <XCircle className="w-4 h-4" /> No
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
