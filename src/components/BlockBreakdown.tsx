'use client';

import { cn } from '@/lib/utils';
import type { BlockResult } from '@/lib/scoring';

interface Props {
  blocks: Record<string, BlockResult>;
}

const blockColors: Record<string, string> = {
  A: 'bg-brand-600',
  B: 'bg-emerald-600',
  C: 'bg-amber-500',
};

const blockLight: Record<string, string> = {
  A: 'bg-brand-100',
  B: 'bg-emerald-100',
  C: 'bg-amber-100',
};

export default function BlockBreakdown({ blocks }: Props) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
        Desglose por bloque
      </h3>
      {Object.entries(blocks).map(([key, block]) => (
        <div key={key} className="space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">
              <span className="text-xs font-bold text-gray-400 mr-1.5">Bloque {key}</span>
              {block.name}
            </span>
            <span className="text-sm font-semibold text-gray-900">
              {block.earned}/{block.max}%
            </span>
          </div>
          <div className={cn('w-full h-2.5 rounded-full', blockLight[key] ?? 'bg-gray-100')}>
            <div
              className={cn('h-2.5 rounded-full transition-all duration-700', blockColors[key] ?? 'bg-brand-600')}
              style={{ width: `${(block.earned / block.max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
