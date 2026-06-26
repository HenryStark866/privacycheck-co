'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase/client';
import {
  collection, doc, getDocs, setDoc, updateDoc, serverTimestamp,
} from 'firebase/firestore';
import { auth } from '@/lib/firebase/client';
import { questions, isVisible } from '@/lib/questions';
import { computeScore } from '@/lib/scoring';
import QuestionCard from '@/components/QuestionCard';
import { Shield, ChevronRight, Save } from 'lucide-react';

export default function DiagnosePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [answers, setAnswers] = useState<Record<number, boolean | null | undefined>>({});
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Cargar respuestas guardadas desde Firestore
  useEffect(() => {
    getDocs(collection(db, 'evaluations', id, 'answers')).then((snap) => {
      const map: Record<number, boolean> = {};
      snap.docs.forEach((d) => {
        const { questionId, value } = d.data();
        if (value !== null) map[questionId] = value;
      });
      setAnswers(map);
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

  async function saveAnswers() {
    const batch = Object.entries(answers).map(([qId, value]) =>
      setDoc(
        doc(db, 'evaluations', id, 'answers', qId),
        { questionId: Number(qId), value },
        { merge: true },
      ),
    );
    await Promise.all(batch);
  }

  async function saveProgress() {
    setSaving(true);
    await saveAnswers();
    setSaving(false);
  }

  async function handleSubmit() {
    setSubmitting(true);
    await saveAnswers();
    const result = computeScore(answers);
    await updateDoc(doc(db, 'evaluations', id), {
      status: 'completada',
      score: result.score,
      blockA: result.blocks.A.earned,
      blockB: result.blocks.B.earned,
      blockC: result.blocks.C.earned,
      maturity: result.maturity,
      completedAt: serverTimestamp(),
    });
    router.push(`/evaluations/${id}/results`);
  }

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-brand-600" /> Diagnóstico Ley 1581
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Fase de diseño · Privacy by Design</p>
        </div>
        <button onClick={saveProgress} disabled={saving}
          className="flex items-center gap-1.5 text-sm text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors disabled:opacity-50">
          <Save className="w-4 h-4" /> {saving ? 'Guardando…' : 'Guardar borrador'}
        </button>
      </div>

      {/* Progreso */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="font-medium text-gray-700">Progreso del diagnóstico</span>
          <span className="font-semibold text-brand-700">{progress}%</span>
        </div>
        <div className="w-full bg-gray-100 h-2 rounded-full">
          <div className="bg-brand-600 h-2 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs text-center">
          {Object.entries(blocks).map(([key, b]) => (
            <div key={key}>
              <p className="text-gray-400">Bloque {key}</p>
              <p className="font-semibold text-gray-700">{b.earned}/{b.max}%</p>
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
              <h2 className="text-sm font-semibold text-gray-700">{blockInfo[blockId]}</h2>
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
      <div className="sticky bottom-4 bg-white rounded-2xl border border-gray-200 shadow-lg p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-700">Puntaje parcial</p>
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
