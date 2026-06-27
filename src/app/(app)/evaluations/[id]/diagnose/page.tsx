'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { questions, isVisible } from '@/lib/questions';
import { computeScore } from '@/lib/scoring';
import QuestionCard from '@/components/QuestionCard';
import { Shield, ChevronRight, Save, AlertCircle } from 'lucide-react';

export default function DiagnosePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [answers, setAnswers] = useState<Record<number, boolean | null | undefined>>({});
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Cargar respuestas vía API servidor (Admin SDK — sin problemas de auth) ──
  useEffect(() => {
    fetch(`/api/evaluations/${id}/answers`)
      .then(async (res) => {
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || `Error ${res.status}`);
        }
        return res.json();
      })
      .then(({ answers: savedAnswers }) => {
        setAnswers(savedAnswers ?? {});
        setLoaded(true);
      })
      .catch((err) => {
        setError(err.message);
        setLoaded(true);
      });
  }, [id]);

  const { scoreRounded, blocks } = computeScore(answers);

  const visibleQuestions = questions.filter((q) => isVisible(q, answers));
  const totalVisible = visibleQuestions.filter((q) => q.scored || q.role === 'parent').length;
  const answered = visibleQuestions.filter((q) => answers[q.id] !== undefined && answers[q.id] !== null).length;
  const progress = totalVisible > 0 ? Math.round((answered / totalVisible) * 100) : 0;

  const setAnswer = useCallback((qId: number, val: boolean) => {
    setAnswers((prev) => {
      const next = { ...prev, [qId]: val };
      if (qId === 1 && !val) [2, 3, 4, 5].forEach((c) => delete next[c]);
      if (qId === 10 && !val) delete next[11];
      return next;
    });
  }, []);

  async function saveProgress() {
    setSaving(true);
    try {
      const res = await fetch(`/api/evaluations/${id}/answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      });
      if (!res.ok) throw new Error('Error al guardar');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const result = computeScore(answers);
      const res = await fetch(`/api/evaluations/${id}/answers`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers,
          score: result.score,
          blockA: result.blocks.A.earned,
          blockB: result.blocks.B.earned,
          blockC: result.blocks.C.earned,
          maturity: result.maturity,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Error al finalizar');
      }
      router.push(`/evaluations/${id}/results`);
    } catch (err: any) {
      alert(err.message);
      setSubmitting(false);
    }
  }

  if (!loaded) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-400">Cargando diagnóstico…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto mt-16 bg-red-50 border border-red-200 rounded-2xl p-6 flex gap-4">
        <AlertCircle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-red-800">Error al cargar el diagnóstico</p>
          <p className="text-sm text-red-600 mt-1">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 text-sm text-red-700 underline"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-brand-600" /> Diagnóstico Ley 1581
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Fase de diseño · Privacy by Design</p>
        </div>
        <button onClick={saveProgress} disabled={saving}
          className="flex items-center gap-1.5 text-sm text-slate-500 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition-colors disabled:opacity-50 bg-white shadow-sm">
          <Save className="w-4 h-4" /> {saving ? 'Guardando…' : 'Guardar borrador'}
        </button>
      </div>

      {/* Progreso */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-sm">
        <div className="flex justify-between text-sm">
          <span className="font-medium text-slate-700">Progreso del diagnóstico</span>
          <span className="font-semibold text-brand-700">{progress}%</span>
        </div>
        <div className="w-full bg-slate-100 h-2 rounded-full">
          <div className="bg-brand-600 h-2 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs text-center">
          {Object.entries(blocks).map(([key, b]) => (
            <div key={key}>
              <p className="text-slate-400">Bloque {key}</p>
              <p className="font-semibold text-slate-700">{b.earned}/{b.max}%</p>
            </div>
          ))}
        </div>
      </div>

      {/* Preguntas por bloque */}
      {['A', 'B', 'C'].map((blockId) => {
        const blockQs = questions.filter((q) => q.block === blockId);
        const blockInfo: Record<string, string> = {
          A: 'Política de datos personales (máx. 40%)',
          B: 'Privacidad desde el diseño (máx. 36%)',
          C: 'Gobernanza (máx. 24%)',
        };
        return (
          <section key={blockId} className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center">{blockId}</span>
              <h2 className="text-sm font-semibold text-slate-700">{blockInfo[blockId]}</h2>
            </div>
            {blockQs.map((q, idx) => {
              const visible = isVisible(q, answers);
              return (
                <div key={q.id} className={`transition-all duration-300 ${!visible ? 'opacity-0 h-0 overflow-hidden pointer-events-none' : 'opacity-100'}`}>
                  <QuestionCard
                    question={q} value={answers[q.id]}
                    onChange={(val) => setAnswer(q.id, val)}
                    disabled={!visible} index={idx + 1}
                  />
                </div>
              );
            })}
          </section>
        );
      })}

      {/* Submit sticky */}
      <div className="sticky bottom-4 bg-white rounded-2xl border border-slate-200 shadow-lg p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-700">Puntaje parcial</p>
          <p className="text-2xl font-bold text-brand-700">{scoreRounded}%</p>
        </div>
        <button onClick={handleSubmit} disabled={submitting || progress < 50}
          className="flex items-center gap-2 bg-brand-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-brand-700 transition-colors disabled:opacity-40 shadow-sm">
          {submitting ? 'Procesando…' : 'Finalizar diagnóstico'} <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
