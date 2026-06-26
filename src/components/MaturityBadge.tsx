'use client';

import { cn } from '@/lib/utils';
import type { MaturityLevel } from '@/lib/scoring';

const config: Record<MaturityLevel, { color: string; bg: string; desc: string }> = {
  Inicial:    { color: 'text-red-700',    bg: 'bg-red-100',    desc: 'Sin base de privacidad por diseño; riesgo alto.' },
  Básico:     { color: 'text-orange-700', bg: 'bg-orange-100', desc: 'Elementos sueltos; faltan controles clave.' },
  Gestionado: { color: 'text-yellow-700', bg: 'bg-yellow-100', desc: 'Política y minimización presentes; cerrar gobernanza.' },
  Optimizado: { color: 'text-blue-700',   bg: 'bg-blue-100',   desc: 'Buen diseño; ajustes finos y formalización.' },
  Líder:      { color: 'text-green-700',  bg: 'bg-green-100',  desc: 'Privacy by Design consolidado.' },
};

interface Props { level: MaturityLevel; showDesc?: boolean; size?: 'sm' | 'md' | 'lg' }

export default function MaturityBadge({ level, showDesc = false, size = 'md' }: Props) {
  const { color, bg, desc } = config[level];
  return (
    <div className="inline-flex flex-col gap-1">
      <span className={cn(
        'inline-flex items-center font-semibold rounded-full',
        bg, color,
        size === 'sm' && 'px-2 py-0.5 text-xs',
        size === 'md' && 'px-3 py-1 text-sm',
        size === 'lg' && 'px-4 py-1.5 text-base',
      )}>
        {level}
      </span>
      {showDesc && <p className="text-xs text-gray-500 max-w-xs">{desc}</p>}
    </div>
  );
}
