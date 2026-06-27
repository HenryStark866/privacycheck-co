/**
 * prompts.ts — Plantillas de prompts para el módulo de IA
 * Los 4 tipos de función: explain, guide, action_plan, interpret
 */

export const SYSTEM_PROMPT = `Eres un asesor experto en protección de datos personales en Colombia, especializado en la Ley 1581 de 2012 y el principio de privacidad desde el diseño. Hablas en español colombiano, claro y cercano, sin tecnicismos innecesarios. Cuando cites obligaciones, refiérete a la ley correctamente. Nunca inventes artículos ni sanciones. Si algo está fuera del alcance de la fase de diseño, dilo.`;

export function explainPrompt(questionText: string): string {
  return `Explica en lenguaje sencillo qué significa esta pregunta de un diagnóstico de cumplimiento de la Ley 1581, y por qué importa en la fase de diseño. Pregunta: "${questionText}". Responde en máximo 3 frases, en español colombiano. Solo el texto, sin preámbulo.`;
}

export function guidePrompt(questionText: string): string {
  return `Para esta pregunta de cumplimiento de la Ley 1581, indica brevemente qué debe existir realmente para responder "Sí" con honestidad, y un ejemplo de evidencia típica. Pregunta: "${questionText}". Máximo 3 frases, español colombiano. Solo el texto.`;
}

export function actionPlanPrompt(
  gaps: Array<{ questionId: number; questionText: string; weight: number }>,
  blocks: { a: number; b: number; c: number },
): string {
  const gapsJson = JSON.stringify(gaps);
  return `Eres asesor de protección de datos (Ley 1581, fase de diseño). Dada esta lista de brechas (preguntas respondidas "No", con su peso) y el puntaje por bloque, genera un plan de acción priorizado para cerrar las brechas, de mayor a menor impacto. Brechas: ${gapsJson}. Puntajes: BloqueA ${blocks.a}/40, BloqueB ${blocks.b}/36, BloqueC ${blocks.c}/24.
Responde ÚNICAMENTE con JSON válido, sin texto adicional ni \`\`\`:
{"acciones":[{"prioridad":1,"brecha":"texto de la pregunta","accion":"qué hacer, concreto","impacto_estimado":"+X%","plazo_sugerido":"corto/medio/largo","articulo":"Art. X de la Ley 1581"}]}`;
}

export function interpretPrompt(
  score: number,
  maturity: string,
  blocks: { a: number; b: number; c: number },
): string {
  return `Interpreta este resultado de autodiagnóstico de la Ley 1581 (fase de diseño) para un público no jurídico. Puntaje total: ${score}% (nivel de madurez: ${maturity}). Por bloque: Política ${blocks.a}/40, Privacidad por diseño ${blocks.b}/36, Gobernanza ${blocks.c}/24. En 3–4 frases di qué significa y las 2 prioridades principales. Español colombiano, sin alarmismo. Solo el texto.`;
}

/** Plan de acción determinístico como fallback si la IA falla */
export function buildFallbackActionPlan(
  gaps: Array<{ questionId: number; questionText: string; weight: number }>,
): ActionItem[] {
  const templates: Record<number, { accion: string; plazo: string; articulo: string }> = {
    1:  { accion: 'Elaborar y aprobar una política de tratamiento de datos personales de acuerdo con la Ley 1581.', plazo: 'corto', articulo: 'Art. 9 y 17' },
    2:  { accion: 'Documentar la política de tratamiento de datos y publicarla en el sitio web o canal de fácil acceso.', plazo: 'corto', articulo: 'Art. 17 y 18' },
    3:  { accion: 'Incluir en la política las finalidades específicas por las que se recopila cada tipo de dato.', plazo: 'corto', articulo: 'Art. 3 y 4' },
    4:  { accion: 'Agregar a la política una sección que liste los derechos de los titulares (acceso, rectificación, supresión, revocatoria, queja).', plazo: 'corto', articulo: 'Art. 8' },
    5:  { accion: 'Definir el canal y procedimiento para ejercer derechos (correo, formulario, tiempo de respuesta).', plazo: 'corto', articulo: 'Art. 14 y 15' },
    6:  { accion: 'Implementar un proceso de evaluación de impacto de privacidad (PIA) antes de lanzar nuevos productos o procesos.', plazo: 'medio', articulo: 'Privacidad desde el Diseño' },
    7:  { accion: 'Revisar los datos recopilados y eliminar los que no sean estrictamente necesarios para la finalidad.', plazo: 'medio', articulo: 'Art. 4 (Minimización)' },
    8:  { accion: 'Configurar los sistemas para que la opción por defecto sea recopilar el mínimo de datos posible.', plazo: 'medio', articulo: 'Privacidad por Defecto' },
    9:  { accion: 'Establecer un sistema de gestión de riesgos de privacidad: identificar, evaluar y mitigar riesgos de forma periódica.', plazo: 'medio', articulo: 'Art. 17 (Seguridad)' },
    10: { accion: 'Designar formalmente un oficial de protección de datos personales con responsabilidades claras.', plazo: 'largo', articulo: 'Art. 17' },
  };

  return gaps.map((gap, i) => ({
    prioridad: i + 1,
    brecha: gap.questionText,
    accion: templates[gap.questionId]?.accion ?? 'Revisar y documentar este aspecto de cumplimiento.',
    impacto_estimado: `+${gap.weight}%`,
    plazo_sugerido: templates[gap.questionId]?.plazo ?? 'medio',
    articulo: templates[gap.questionId]?.articulo ?? 'Ley 1581 de 2012',
  }));
}

export interface ActionItem {
  prioridad: number;
  brecha: string;
  accion: string;
  impacto_estimado: string;
  plazo_sugerido: string;
  articulo?: string;
}
