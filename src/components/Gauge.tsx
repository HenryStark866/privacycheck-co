'use client';

import { useEffect, useRef } from 'react';
import MaturityBadge from './MaturityBadge';
import type { MaturityLevel } from '@/lib/scoring';

interface Props {
  score: number;        // 0–100
  maturity: MaturityLevel;
  animated?: boolean;
}

export default function Gauge({ score, maturity, animated = true }: Props) {
  const needleRef = useRef<SVGGElement>(null);

  // Convertir score a ángulo: -90° (0%) → +90° (100%)
  const angle = -90 + (Math.max(0, Math.min(100, score)) / 100) * 180;

  useEffect(() => {
    if (!animated || !needleRef.current) return;
    needleRef.current.style.transition = 'transform 1.2s cubic-bezier(0.34,1.56,0.64,1)';
  }, [animated]);

  const cx = 150, cy = 140, r = 110;

  function arcPath(startDeg: number, endDeg: number) {
    const toRad = (d: number) => ((d - 90) * Math.PI) / 180;
    const x1 = cx + r * Math.cos(toRad(startDeg));
    const y1 = cy + r * Math.sin(toRad(startDeg));
    const x2 = cx + r * Math.cos(toRad(endDeg));
    const y2 = cy + r * Math.sin(toRad(endDeg));
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  }

  const segments = [
    { from: -90, to: -45.6, color: '#ef4444' },   // 0–25%   Inicial
    { from: -45.6, to: 0,   color: '#f97316' },   // 25–50%  Básico
    { from: 0, to: 45.6,    color: '#eab308' },   // 50–75%  Gestionado
    { from: 45.6, to: 72.6, color: '#3b82f6' },   // 75–95%  Optimizado
    { from: 72.6, to: 90,   color: '#22c55e' },   // 95–100% Líder
  ];

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      {/* El SVG solo contiene el arco + aguja + etiquetas de extremos.
          El número y la descripción van como HTML debajo, así nunca se
          solapan ni se recortan en ningún navegador. viewBox ajustado. */}
      <svg viewBox="0 0 300 164" className="w-full max-w-[340px] h-auto" role="img" aria-label={`Puntaje ${Math.round(score)}%`}>
        {/* Pista base */}
        <path d={arcPath(-90, 90)} fill="none" stroke="#e5e7eb" strokeWidth={18} strokeLinecap="round" />

        {/* Segmentos de color */}
        {segments.map((s, i) => (
          <path key={i} d={arcPath(s.from, s.to)} fill="none"
            stroke={s.color} strokeWidth={18} strokeLinecap="butt" />
        ))}

        {/* Aguja */}
        <g style={{ transformOrigin: `${cx}px ${cy}px`, transform: `rotate(${angle}deg)` }} ref={needleRef}>
          <line x1={cx} y1={cy} x2={cx} y2={cy - r + 22}
            stroke="#1e293b" strokeWidth={3.5} strokeLinecap="round" />
        </g>

        {/* Centro */}
        <circle cx={cx} cy={cy} r={9} fill="#1e293b" />
        <circle cx={cx} cy={cy} r={4} fill="#fff" />

        {/* Etiquetas de extremos */}
        <text x={cx - r} y={cy + 22} fontSize={12} fill="#94a3b8" textAnchor="middle">0%</text>
        <text x={cx + r} y={cy + 22} fontSize={12} fill="#94a3b8" textAnchor="middle">100%</text>
        <text x={cx} y={cy - r - 8} fontSize={12} fill="#94a3b8" textAnchor="middle">50%</text>
      </svg>

      {/* Número + descripción (HTML, sin riesgo de solape) */}
      <div className="flex flex-col items-center -mt-1">
        <span className="text-4xl sm:text-5xl font-bold text-slate-900 tabular-nums leading-none tracking-tight">
          {Math.round(score)}%
        </span>
        <span className="text-xs text-slate-500 mt-1.5">Cumplimiento Ley 1581</span>
      </div>

      <MaturityBadge level={maturity} showDesc size="lg" />
    </div>
  );
}
