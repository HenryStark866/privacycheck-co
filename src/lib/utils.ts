import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Convierte Timestamp de Firestore, Date, string o número a Date.
 * Firestore devuelve objetos con .toDate() — hay que manejarlo explícitamente.
 */
function toDate(value: unknown): Date {
  if (!value) return new Date();
  // Firestore Admin Timestamp y Firestore Client Timestamp ambos tienen .toDate()
  if (typeof (value as any).toDate === 'function') return (value as any).toDate();
  // Firestore Timestamp con .seconds (serializado desde el servidor)
  if (typeof (value as any).seconds === 'number') {
    return new Date((value as any).seconds * 1000);
  }
  return new Date(value as string | number | Date);
}

export function formatDate(date: unknown): string {
  const d = toDate(date);
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
  }).format(d);
}
