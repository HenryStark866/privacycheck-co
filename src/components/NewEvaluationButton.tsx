'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props { companyId: string; className?: string }

export default function NewEvaluationButton({ companyId, className }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function create() {
    setLoading(true);
    const res = await fetch('/api/evaluations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId }),
    });
    const data = await res.json();
    if (res.ok && data.id) router.push(`/evaluations/${data.id}/diagnose`);
    setLoading(false);
  }

  return (
    <button onClick={create} disabled={loading}
      className={cn(
        'flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors shadow-sm disabled:opacity-50',
        className,
      )}>
      <Plus className="w-4 h-4" />
      {loading ? 'Creando…' : 'Nuevo diagnóstico'}
    </button>
  );
}
