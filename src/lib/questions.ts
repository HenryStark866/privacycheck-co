import data from '@/assets/diagnostic-questions.json';

export interface Question {
  id: number;
  block: string;
  text: string;
  weight: number;
  role: 'parent' | 'child' | 'standalone' | 'complementary';
  children?: number[];
  parent?: number;
  inheritsChildrenWeight?: boolean;
  scored: boolean;
  complementary?: boolean;
  fallbackExplain: string;
}

export interface Block {
  id: string;
  name: string;
  max: number;
}

export const questions: Question[] = data.questions as Question[];
export const blocks: Block[] = data.blocks as Block[];

export function getQuestion(id: number): Question | undefined {
  return questions.find((q) => q.id === id);
}

/** Devuelve true si la pregunta debe mostrarse dado el estado actual de respuestas */
export function isVisible(q: Question, answers: Record<number, boolean | null | undefined>): boolean {
  // Q2–Q5 solo visibles si Q1 = Sí
  if (q.parent === 1) return answers[1] === true;
  // Q11 solo visible si Q10 = Sí
  if (q.parent === 10) return answers[10] === true;
  return true;
}
