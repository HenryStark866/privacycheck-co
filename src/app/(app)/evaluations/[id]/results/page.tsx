'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase/client';
import { collection, getDocs, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { computeScore } from '@/lib/scoring';
import { getQuestion } from '@/lib/questions';
import Gauge from '@/components/Gauge';
import BlockBreakdown from '@/components/BlockBreakdown';
import GapList from '@/components/GapList';
import WhatIfSimulator from '@/components/WhatIfSimulator';
import type { MaturityLevel } from '@/lib/scoring';
import type { ActionItem } from '@/lib/ai/prompts';
import { buildFallbackActionPlan } from '@/lib/ai/prompts';
import { Download, ArrowLeft, Sparkles, RefreshCw } from 'lucide-react';

export default function ResultsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [answers, setAnswers] = useState<Record<number, boolean>>({});
  const [interpretation, setInterpretation] = useState('');
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [loadingAI, setLoadingAI] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [exportLoading, setExportLoading] = useState(false);

  useEffect(() => {
    async function load() {
      // Respuestas
      const answersSnap = await getDocs(collection(db, 'evaluations', id, 'answers'));
      const map: Record<number, boolean> = {};
      answersSnap.docs.forEach((d) => {
        const { questionId, value } = d.data();
        if (value !== null) map[questionId] = value;
      });
      setAnswers(map);

      // Nombre de la empresa
      const evDoc = await getDoc(doc(db, 'evaluations', id));
      if (evDoc.exists()) {
        const companyDoc = await getDoc(doc(db, 'companies', evDoc.data().companyId));
        if (companyDoc.exists()) setCompanyName(companyDoc.data().name ?? '');
      }

      // Recomendaciones cacheadas
      const recsSnap = await getDocs(collection(db, 'evaluations', id, 'recommendations'));
      recsSnap.docs.forEach((d) => {
        const { kind, content } = d.data();
        if (kind === 'interpret') setInterpretation(content as string);
        if (kind === 'action_plan') setActions((content as any)?.acciones ?? []);
      });

      setLoaded(true);
    }
    load();
  }, [id]);

  const result = computeScore(answers);
  const { score, scoreRounded, blocks, maturity, gaps, notes } = result;

  async function generateAI() {
    setLoadingAI(true);
    try {
      const interpretRes = await fetch('/api/ai', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'interpret', score: scoreRounded, maturity, blocks: { a: blocks.A.earned, b: blocks.B.earned, c: blocks.C.earned } }),
      });
      const interpretData = await interpretRes.json();
      const interpretText = interpretData.content ?? '';
      setInterpretation(interpretText);

      const gapsWithText = gaps.map((g) => ({
        questionId: g.questionId, questionText: getQuestion(g.questionId)?.text ?? '', weight: g.weight,
      }));
      const actionRes = await fetch('/api/ai', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'action_plan', gaps: gapsWithText, blocks: { a: blocks.A.earned, b: blocks.B.earned, c: blocks.C.earned } }),
      });
      const actionData = await actionRes.json();
      const parsedActions: ActionItem[] = actionData.content?.acciones ?? buildFallbackActionPlan(gapsWithText);
      setActions(parsedActions);

      // Cachear en Firestore
      await Promise.all([
        setDoc(doc(db, 'evaluations', id, 'recommendations', 'interpret'), { kind: 'interpret', content: interpretText, updatedAt: serverTimestamp() }),
        setDoc(doc(db, 'evaluations', id, 'recommendations', 'action_plan'), { kind: 'action_plan', content: { acciones: parsedActions }, updatedAt: serverTimestamp() }),
      ]);
    } catch {
      const fallbackGaps = gaps.map((g) => ({ questionId: g.questionId, questionText: getQuestion(g.questionId)?.text ?? '', weight: g.weight }));
      setActions(buildFallbackActionPlan(fallbackGaps));
      const texts: Record<string, string> = {
        Inicial: 'La organización está en etapa inicial. Se requiere construir los fundamentos de privacidad urgentemente.',
        Básico: 'Hay elementos iniciales pero incompletos. Es importante consolidar la política de datos y los controles.',
        Gestionado: 'La organización tiene una base sólida. El foco debe estar en cerrar las brechas de gobernanza.',
        Optimizado: 'El cumplimiento es robusto. Solo quedan ajustes de formalización y mejora continua.',
        Líder: 'Excelente nivel de madurez en Privacy by Design. Mantén la documentación actualizada.',
      };
      setInterpretation(texts[maturity] ?? '');
    } finally {
      setLoadingAI(false);
    }
  }

  async function exportPDF() {
    setExportLoading(true);
    try {
      const res = await fetch(`/api/report/${id}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `diagnostico-ley1581-${id.slice(0, 8)}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch { alert('Error al generar el PDF.'); }
    finally { setExportLoading(false); }
  }

  if (!loaded) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-400">Cargando resultados…</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-xl hover:bg-white hover:shadow-sm text-gray-400 hover:text-gray-700 transition-all"
          >
            <ArrowLeft className="w-4.5 h-4.5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Resultado del diagnóstico</h1>
            {companyName && <p className="text-sm text-gray-500">{companyName}</p>}
          </div>
        </div>
        <button
          onClick={exportPDF}
          disabled={exportLoading}
          className="btn-secondary text-xs"
        >
          <Download className="w-3.5 h-3.5" />
          {exportLoading ? 'Generando…' : 'Exportar PDF'}
        </button>
      </div>

      {/* Gauge */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6">
        <Gauge score={score} maturity={maturity} />
      </div>

      {/* Bloques */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6">
        <BlockBreakdown blocks={blocks} />
      </div>

      {/* IA */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-brand-50">
              <Sparkles className="w-3.5 h-3.5 text-brand-600" />
            </span>
            Interpretación por IA
          </h3>
          <button
            onClick={generateAI}
            disabled={loadingAI}
            className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-700 font-medium disabled:opacity-40 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${loadingAI ? 'animate-spin' : ''}`} />
            {interpretation ? 'Regenerar' : 'Generar con IA'}
          </button>
        </div>
        {loadingAI && (
          <div className="text-sm text-gray-400 flex items-center gap-2.5 py-2">
            <div className="w-4 h-4 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin shrink-0" />
            Consultando asesor de protección de datos…
          </div>
        )}
        {interpretation && !loadingAI && (
          <p className="text-sm text-gray-700 leading-relaxed">{interpretation}</p>
        )}
        {!interpretation && !loadingAI && (
          <p className="text-sm text-gray-400 italic">
            Presiona "Generar con IA" para obtener una interpretación personalizada de tu resultado.
          </p>
        )}
      </div>

      {/* Notas */}
      {notes.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded