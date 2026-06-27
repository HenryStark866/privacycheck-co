'use client';

import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

/**
 * Reloj en vivo (fecha + hora real, zona del navegador) que se actualiza
 * cada segundo. Renderiza null hasta montar para evitar hydration mismatch.
 */
export default function LiveClock({ className = '' }: { className?: string }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) return null;

  const fecha = now.toLocaleDateString('es-CO', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });
  const hora = now.toLocaleTimeString('es-CO', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
  });

  return (
    <span className={`inline-flex items-center gap-1.5 tabular-nums ${className}`}>
      <Clock className="w-3.5 h-3.5 shrink-0" />
      <span className="capitalize">{fecha}</span>
      <span className="opacity-50">·</span>
      <span className="font-semibold">{hora}</span>
    </span>
  );
}
