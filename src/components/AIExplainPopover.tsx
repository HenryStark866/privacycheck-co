'use client';

import { useState } from 'react';
import { HelpCircle, Loader2 } from 'lucide-react';
import type { Question } from '@/lib/questions';

interface Props {
  question: Question;
  kind: 'explain' | 'guide';
}

export default function AIExplainPopover({ question, kind }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  async function fetch_ai() {
    if (text) { setOpen(true); return; }
    setOpen(true);
    setLoading(true);
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, questionId: question.id, questionText: question.text }),
      });
      const data = await res.json();
      setText(data.content ?? question.fallbackExplain);
    } catch {
      setText(question.fallbackExplain);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={fetch_ai}
        title={kind === 'explain' ? 'Explicar esta pregunta' : 'Cómo responder'}
        className="text-brand-500 hover:text-brand-700 transition-colors"
      >
        <HelpCircle className="w-4 h-4" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 left-6 top-0 w-72 bg-white rounded-xl shadow-xl border border-gray-200 p-4 text-sm text-gray-700 space-y-2">
            <p className="font-semibold text-brand-700 text-xs uppercase tracking-wide">
              {kind === 'explain' ? '¿Qué significa esta pregunta?' : '¿Cómo responder con honestidad?'}
            </p>
            {loading
              ? <div className="flex items-center gap-2 text-gray-400"><Loader2 className="w-4 h-4 animate-spin" /> Consultando asesor IA…</div>
              : <p className="leading-relaxed">{text}</p>
            }
          </div>
        </>
      )}
    </div>
  );
}
