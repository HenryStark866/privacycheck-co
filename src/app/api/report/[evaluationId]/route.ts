import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/firebase/session';
import {
  getEvaluation, getAnswers, getRecommendations,
  getCompany, getMembership,
} from '@/lib/firebase/firestore-helpers';
import { computeScore } from '@/lib/scoring';
import { getQuestion } from '@/lib/questions';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export async function GET(_req: Request, { params }: { params: { evaluationId: string } }) {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { evaluationId } = params;

  const ev = await getEvaluation(evaluationId);
  if (!ev) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  // Verificar acceso al tenant
  const membership = await getMembership(user.uid, ev.companyId);
  if (!membership) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const [answerMap, recommendations, company] = await Promise.all([
    getAnswers(evaluationId),
    getRecommendations(evaluationId),
    getCompany(ev.companyId),
  ]);

  const result = computeScore(answerMap);
  const interpretRec = recommendations.find((r: any) => r.kind === 'interpret');
  const actionRec    = recommendations.find((r: any) => r.kind === 'action_plan');

  // ─── PDF ──────────────────────────────────────────────────────────────
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 20;

  // Header
  doc.setFillColor(79, 70, 229);
  doc.rect(0, 0, pageW, 40, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18); doc.setFont('helvetica', 'bold');
  doc.text('Autodiagnóstico Ley 1581 de 2012', margin, 18);
  doc.setFontSize(11); doc.setFont('helvetica', 'normal');
  doc.text('Privacy by Design · Fase de Diseño', margin, 27);
  doc.text(`Empresa: ${company?.name ?? '—'}`, margin, 35);

  let y = 52;
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(10);
  if (company?.nit)    { doc.text(`NIT: ${company.nit}`, margin, y); y += 6; }
  if (company?.sector) { doc.text(`Sector: ${company.sector}`, margin, y); y += 6; }
  const dateStr = new Date(ev.completedAt as any ?? ev.createdAt as any).toLocaleDateString('es-CO');
  doc.text(`Fecha: ${dateStr}`, margin, y); y += 12;

  // Puntaje
  doc.setFontSize(42); doc.setFont('helvetica', 'bold'); doc.setTextColor(79, 70, 229);
  doc.text(`${result.scoreRounded}%`, pageW / 2, y + 14, { align: 'center' });
  doc.setFontSize(13); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 100, 100);
  doc.text(`Nivel de madurez: ${result.maturity}`, pageW / 2, y + 24, { align: 'center' });
  y += 38;

  // Bloques
  doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 30);
  doc.text('Desglose por Bloque', margin, y); y += 6;
  autoTable(doc, {
    startY: y, margin: { left: margin, right: margin },
    head: [['Bloque', 'Nombre', 'Obtenido', 'Máximo', '%']],
    body: Object.entries(result.blocks).map(([k, b]) => [
      `Bloque ${k}`, b.name, `${b.earned}%`, `${b.max}%`,
      `${Math.round((b.earned / b.max) * 100)}%`,
    ]),
    styles: { fontSize: 9 }, headStyles: { fillColor: [79, 70, 229] },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // Respuestas
  doc.setFontSize(11); doc.setFont('helvetica', 'bold');
  doc.text('Respuestas del Diagnóstico', margin, y); y += 6;
  autoTable(doc, {
    startY: y, margin: { left: margin, right: margin },
    head: [['#', 'Pregunta', 'Respuesta', 'Peso']],
    body: Array.from({ length: 11 }, (_, i) => i + 1)
      .filter((id) => id !== 11 || answerMap[10] === true)
      .map((id) => {
        const q = getQuestion(id);
        const val = answerMap[id];
        return [String(id), q?.text ?? `Q${id}`, val === true ? 'Sí' : val === false ? 'No' : '—', q?.weight ? `${q.weight}%` : '—'];
      }),
    styles: { fontSize: 8 }, headStyles: { fillColor: [79, 70, 229] },
    columnStyles: { 2: { halign: 'center' }, 3: { halign: 'center' } },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // Brechas
  if (result.gaps.length > 0) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 30);
    doc.text('Brechas Identificadas', margin, y); y += 6;
    autoTable(doc, {
      startY: y, margin: { left: margin, right: margin },
      head: [['Pregunta', 'Impacto']],
      body: result.gaps.map((g) => [getQuestion(g.questionId)?.text ?? `Q${g.questionId}`, `${g.weight}%`]),
      styles: { fontSize: 8 }, headStyles: { fillColor: [220, 38, 38] },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Plan de acción
  const acciones = (actionRec as any)?.content?.acciones;
  if (acciones?.length) {
    if (y > 220) { doc.addPage(); y = 20; }
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 30);
    doc.text('Plan de Acción (IA)', margin, y); y += 6;
    autoTable(doc, {
      startY: y, margin: { left: margin, right: margin },
      head: [['P.', 'Acción', 'Impacto', 'Plazo']],
      body: acciones.map((a: any) => [String(a.prioridad), a.accion, a.impacto_estimado, a.plazo_sugerido]),
      styles: { fontSize: 8 }, headStyles: { fillColor: [16, 185, 129] },
      columnStyles: { 0: { cellWidth: 8 }, 2: { cellWidth: 18 }, 3: { cellWidth: 18 } },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Interpretación
  if (interpretRec) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 30);
    doc.text('Interpretación del Resultado', margin, y); y += 6;
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 60, 60);
    const lines = doc.splitTextToSize((interpretRec as any).content as string, pageW - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * 4 + 10;
  }

  // Guía Paso a Paso: Privacy by Design
  if (y > 200) { doc.addPage(); y = 20; }
  doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(79, 70, 229);
  doc.text('Guía Práctica: Implementación de Habeas Data (Privacy by Design)', margin, y); y += 8;
  doc.setFontSize(9); doc.setTextColor(30, 30, 30);
  
  const pasos = [
    { num: "1", title: "Evaluar antes de recopilar (Proactividad)", desc: "Define exactamente qué datos necesitas y para qué. No recopiles información 'por si acaso'." },
    { num: "2", title: "Privacidad por defecto", desc: "Configura sistemas para que los datos tengan la máxima privacidad sin que el usuario deba ajustarlos manualmente." },
    { num: "3", title: "Autorización expresa (Opt-in)", desc: "Diseña formularios donde el usuario deba dar clic activamente para aceptar la política de tratamiento de datos." },
    { num: "4", title: "Seguridad de extremo a extremo", desc: "Cifra datos sensibles y restringe el acceso interno solo al personal estrictamente necesario." },
    { num: "5", title: "Transparencia (Canal PQRS)", desc: "Habilita un correo o formulario para que los titulares puedan actualizar o eliminar sus datos rápidamente." }
  ];

  pasos.forEach(p => {
    doc.setFont('helvetica', 'bold');
    doc.text(`${p.num}. ${p.title}:`, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    const descLines = doc.splitTextToSize(p.desc, pageW - margin * 2 - 5);
    doc.text(descLines, margin + 5, y + 4.5);
    y += descLines.length * 4 + 6;
  });
  y += 5;

  // Enlaces Oficiales
  if (y > 260) { doc.addPage(); y = 20; }
  doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(79, 70, 229);
  doc.text('Enlaces Oficiales y de Consulta', margin, y); y += 6;
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(37, 99, 235);
  
  doc.textWithLink('1. Superintendencia de Industria y Comercio (SIC)', margin, y, { url: 'https://www.sic.gov.co/proteccion-de-datos-personales' }); y += 5;
  doc.textWithLink('2. Ley Estatutaria 1581 de 2012', margin, y, { url: 'http://www.secretariasenado.gov.co/senado/basedoc/ley_1581_2012.html' }); y += 5;
  doc.textWithLink('3. Decreto Reglamentario 1377 de 2013', margin, y, { url: 'http://www.suin-juriscol.gov.co/viewDocument.asp?id=1416397' }); y += 10;

  // Pie de página
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8); doc.setTextColor(150, 150, 150);
    doc.text(
      `CAVALTEC · Autodiagnóstico Ley 1581 de 2012 · Página ${i} de ${pageCount}`,
      pageW / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' },
    );
  }

  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  return new NextResponse(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="diagnostico-ley1581-${evaluationId.slice(0, 8)}.pdf"`,
    },
  });
}
