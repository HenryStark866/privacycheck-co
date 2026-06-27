'use client';

/**
 * AccessibilityWidget — Panel de accesibilidad (WCAG 2.1).
 * Permite a cualquier usuario ajustar tamaño de texto, contraste, subrayado de
 * enlaces y reducción de movimiento. Las preferencias se guardan en localStorage
 * y se aplican como clases en <html>, leídas por globals.css.
 */

import { useEffect, useState, useCallback } from 'react';
import { Accessibility, X, Type, Contrast, Underline, Sparkles, RotateCcw } from 'lucide-react';

type Prefs = {
  textScale: 0 | 1 | 2;   // normal / grande / muy grande
  contrast: boolean;
  underlineLinks: boolean;
  reduceMotion: boolean;
};

const DEFAULT_PREFS: Prefs = { textScale: 0, contrast: false, underlineLinks: false, reduceMotion: false };
const STORAGE_KEY = 'pc-a11y-prefs';

function applyPrefs(p: Prefs) {
  const root = document.documentElement;
  root.classList.toggle('a11y-text-lg', p.textScale === 1);
  root.classList.toggle('a11y-text-xl', p.textScale === 2);
  root.classList.toggle('a11y-contrast', p.contrast);
  root.classList.toggle('a11y-underline', p.underlineLinks);
  root.classList.toggle('a11y-reduce-motion', p.reduceMotion);
}

export default function AccessibilityWidget() {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [mounted, setMounted] = useState(false);

  // Cargar preferencias guardadas
  useEffect(() => {
    setMounted(true);
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = { ...DEFAULT_PREFS, ...JSON.parse(raw) } as Prefs;
        setPrefs(saved);
        applyPrefs(saved);
      }
    } catch { /* ignore */ }
  }, []);

  const update = useCallback((patch: Partial<Prefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      applyPrefs(next);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setPrefs(DEFAULT_PREFS);
    applyPrefs(DEFAULT_PREFS);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }, []);

  if (!mounted) return null;

  const active =
    prefs.textScale !== 0 || prefs.contrast || prefs.underlineLinks || prefs.reduceMotion;

  return (
    <div className="fixed bottom-5 left-5 z-[60] print:hidden">
      {/* Panel */}
      {open && (
        <div
          role="dialog"
          aria-label="Opciones de accesibilidad"
          className="mb-3 w-72 rounded-2xl bg-white border border-slate-200 shadow-2xl p-4 space-y-3 animate-in"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Accessibility className="w-4 h-4 text-brand-600" aria-hidden="true" />
              Accesibilidad
            </h2>
            <button
              onClick={() => setOpen(false)}
              aria-label="Cerrar panel de accesibilidad"
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tamaño de texto */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5 flex items-center gap-1.5">
              <Type className="w-3.5 h-3.5" aria-hidden="true" /> Tamaño de texto
            </p>
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl" role="group" aria-label="Tamaño de texto">
              {(['Normal', 'Grande', 'Muy grande'] as const).map((label, i) => (
                <button
                  key={label}
                  onClick={() => update({ textScale: i as Prefs['textScale'] })}
                  aria-pressed={prefs.textScale === i}
                  className={`py-1.5 rounded-lg text-xs font-medium transition-all ${
                    prefs.textScale === i ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <ToggleRow
            icon={<Contrast className="w-3.5 h-3.5" aria-hidden="true" />}
            label="Alto contraste"
            checked={prefs.contrast}
            onChange={(v) => update({ contrast: v })}
          />
          <ToggleRow
            icon={<Underline className="w-3.5 h-3.5" aria-hidden="true" />}
            label="Subrayar enlaces"
            checked={prefs.underlineLinks}
            onChange={(v) => update({ underlineLinks: v })}
          />
          <ToggleRow
            icon={<Sparkles className="w-3.5 h-3.5" aria-hidden="true" />}
            label="Reducir animaciones"
            checked={prefs.reduceMotion}
            onChange={(v) => update({ reduceMotion: v })}
          />

          {active && (
            <button
              onClick={reset}
              className="w-full flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 pt-1"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" /> Restablecer
            </button>
          )}
        </div>
      )}

      {/* Botón flotante */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Abrir opciones de accesibilidad"
        className="relative flex items-center justify-center w-12 h-12 rounded-full bg-brand-600 hover:bg-brand-700 text-white shadow-lg hover:shadow-xl transition-all active:scale-95"
      >
        <Accessibility className="w-6 h-6" aria-hidden="true" />
        {active && (
          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

function ToggleRow({
  icon, label, checked, onChange,
}: {
  icon: React.ReactNode; label: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      className="w-full flex items-center justify-between gap-2 py-1.5 group"
    >
      <span className="flex items-center gap-2 text-sm text-slate-700">
        <span className="text-slate-400 group-hover:text-brand-600 transition-colors">{icon}</span>
        {label}
      </span>
      <span
        className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${
          checked ? 'bg-brand-600' : 'bg-slate-300'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-4' : ''
          }`}
        />
      </span>
    </button>
  );
}
