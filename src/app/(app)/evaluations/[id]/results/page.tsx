'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { computeScore } from '@/lib/scoring';
import { getQuestion } from '@/lib/questions';
import Gauge from '@/components/Gauge';
import BlockBreakdown from '@/components/BlockBreakdown';
import GapList from '@/components/GapList';
import WhatIfSimulator from '@/components/WhatIfSimulator';
import type { MaturityLevel } from '@/lib/scoring';
import type { ActionItem } from '@/lib/ai/prompts';
import { buildFallbackActionPlan } from '@/lib/ai/prompts';
import { Download, ArrowLeft, Sparkles, RefreshCw, AlertCircle } from 'lucide-react';

export default function ResultsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [answers, setAnswers] = useState<Record<number, boolean>>({});
  const [interpretation, setInterpretation] = useState('');
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [loadingAI, setLoadingAI] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [exportLoading, setExportLoading] = useState(false);

  // ── Carga vía API servidor (Admin SDK — sin problemas de auth) ──
  useEffect(() => {
    fetch(`/api/evaluations/${id}/results`)
      .then(async (res) => {
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || `Error ${res.status}`);
        }
        return res.json();
      })
      .then(({ answers: savedAnswers, recommendations, companyName: cn }) => {
        setAnswers(savedAnswers ?? {});
        setCompanyName(cn ?? '');
        (recommendations ?? []).forEach((r: any) => {
          if (r.kind === 'interpret') setInterpretation(r.content as string);
          if (r.kind === 'action_plan') setActions((r.content as any)?.acciones ?? []);
        });
        setLoaded(true);
      })
      .catch((err) => {
        setError(err.message);
        setLoaded(true);
      });
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

      // Cachear vía API servidor
      await fetch(`/api/evaluations/${id}/answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      });
      // Guardar recomendaciones via API dedicada
      await fetch('/api/ai/cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evaluationId: id, interpretation: interpretText, actions: parsedActions }),
      });
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
        <p className="text-sm text-slate-400">Cargando resultados…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto mt-16 bg-red-50 border border-red-200 rounded-2xl p-6 flex gap-4">
        <AlertCircle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-red-800">Error al cargar los resultados</p>
          <p className="text-sm text-red-600 mt-1">{error}</p>
          <button onClick={() => window.location.reload()} className="mt-3 text-sm text-red-700 underline">
            Reintentar
          </button>
        </div>
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
            className="p-2 rounded-xl hover:bg-white hover:shadow-sm text-slate-400 hover:text-slate-700 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Resultado del diagnóstico</h1>
            {companyName && <p className="text-sm text-slate-500">{companyName}</p>}
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
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <Gauge score={score} maturity={maturity} />
      </div>

      {/* Bloques */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <BlockBreakdown blocks={blocks} />
      </div>

      {/* IA */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
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
          <div className="text-sm text-slate-400 flex items-center gap-2.5 py-2">
            <div className="w-4 h-4 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin shrink-0" />
            Consultando asesor de protección de datos…
          </div>
        )}
        {interpretation && !loadingAI && (
          <p className="text-sm text-slate-700 leading-relaxed">{interpretation}</p>
        )}
        {!interpretation && !loadingAI && (
          <p className="text-sm text-slate-400 italic">
            Presiona &quot;Generar con IA&quot; para obtener una interpretación personalizada de tu resultado.
          </p>
        )}
      </div>

      {/* Notas */}
      {notes.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-1.5">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Notas de cumplimiento</p>
          {notes.map((n, i) => (
            <p key={i} className="text-sm text-amber-800">{n}</p>
          ))}
        </div>
      )}

      {/* Brechas */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <GapList gaps={gaps} />
      </div>

      {/* Simulador What-If */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <WhatIfSimulator answers={answers} currentScore={score} gaps={gaps} />
      </div>

      {/* Plan de acción IA */}
      {actions.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900">Plan de acción recomendado</h3>
          <ol className="space-y-3">
            {actions.map((item, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-medium text-slate-900">{item.accion}</p>
                  {item.articulo && (
                    <p className="text-xs text-slate-400 mt-0.5">Ref: {item.articulo}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}