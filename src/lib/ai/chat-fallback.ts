/**
 * Respuestas de fallback para el chat de IA cuando el API de Anthropic
 * no está disponible. Cubre las preguntas más comunes sobre Ley 1581.
 */

interface FallbackRule {
  keywords: string[];
  response: string;
}

const RULES: FallbackRule[] = [
  {
    keywords: ['qué es', 'que es', 'explica', 'explícame', 'cuéntame', '1581', 'ley'],
    response: `La **Ley 1581 de 2012** es la ley colombiana de protección de datos personales, también conocida como Ley de Habeas Data. Establece las condiciones bajo las cuales las organizaciones pueden recopilar, almacenar, usar y compartir información personal de ciudadanos colombianos.

Sus pilares fundamentales son: el consentimiento del titular, la finalidad determinada del tratamiento, la seguridad de los datos, y el derecho de los ciudadanos a conocer, actualizar y rectificar su información. Aplica a toda persona natural o jurídica que realice tratamiento de datos personales en Colombia, sin importar su tamaño o sector.

El incumplimiento puede derivar en sanciones de la Superintendencia de Industria y Comercio (SIC) de hasta 2.000 salarios mínimos mensuales vigentes.`,
  },
  {
    keywords: ['sanci', 'multa', 'penalidad', 'castigo', 'consecuencia'],
    response: `Las sanciones por incumplimiento de la Ley 1581 de 2012 son impuestas por la **Superintendencia de Industria y Comercio (SIC)** y pueden ser:

• **Multas** de hasta 2.000 salarios mínimos mensuales legales vigentes (SMMLV) para personas jurídicas, y hasta 100 SMMLV para personas naturales.
• **Suspensión** de las actividades de tratamiento de datos hasta por 6 meses.
• **Cierre temporal** de las operaciones relacionadas con el tratamiento de datos.
• **Cierre definitivo** en casos de reincidencia o gravedad extrema.

Las sanciones más graves recaen sobre organizaciones que traten datos sensibles sin autorización, o que sufran filtraciones por falta de medidas de seguridad adecuadas.`,
  },
  {
    keywords: ['privacy by design', 'privacidad desde el diseño', 'diseño', 'pbD'],
    response: `**Privacy by Design (Privacidad desde el Diseño)** es un principio que establece que la protección de datos debe incorporarse desde el inicio del diseño de cualquier sistema, proceso o producto, y no como un añadido posterior.

Sus 7 principios fundacionales son: (1) Proactivo, no reactivo; (2) Privacidad como configuración predeterminada; (3) Privacidad incorporada en el diseño; (4) Funcionalidad plena; (5) Seguridad de extremo a extremo; (6) Visibilidad y transparencia; y (7) Respeto por la privacidad del usuario.

En el contexto de la Ley 1581, aplicar Privacy by Design desde la fase de diseño reduce drásticamente el riesgo de incumplimiento y demuestra buena fe ante la SIC, lo cual puede mitigar sanciones en caso de incidentes.`,
  },
  {
    keywords: ['habeas data', 'hábeas data', 'derecho', 'titular'],
    response: `El **Habeas Data** es el derecho fundamental de toda persona a conocer, actualizar, rectificar y suprimir la información que sobre ella repose en bases de datos. En Colombia está consagrado en el artículo 15 de la Constitución y desarrollado por la Ley 1581 de 2012.

Los derechos del titular incluyen:
• **Conocer** qué datos suyos están siendo tratados y con qué finalidad.
• **Actualizar** información desactualizada o incompleta.
• **Rectificar** datos inexactos o erróneos.
• **Suprimir** datos cuando el tratamiento ya no sea necesario o el consentimiento fue revocado.
• **Revocar** la autorización de tratamiento en cualquier momento.
• **Presentar quejas** ante la SIC si sus derechos son vulnerados.

Las organizaciones deben tener canales habilitados para atender estas solicitudes en máximo 10 días hábiles.`,
  },
  {
    keywords: ['política', 'politica', 'aviso', 'privacidad', 'bloque a', 'bloque-a'],
    response: `La **Política de Tratamiento de Datos Personales** es un documento obligatorio para todas las organizaciones que recopilen datos personales. Según la Ley 1581 y el Decreto 1377 de 2013, debe contener como mínimo:

• Identidad y datos de contacto del Responsable del Tratamiento.
• Finalidades del tratamiento para las cuales se obtienen los datos.
• Derechos de los titulares y cómo ejercerlos.
• Procedimiento para atender peticiones, consultas y reclamos.
• Política de tratamiento de datos sensibles (si aplica).
• Vigencia de la política y de las bases de datos.

Debe estar disponible públicamente (sitio web, cartelera, documento impreso) antes de iniciar cualquier tratamiento de datos. Es el primer requisito que verifica la SIC en una inspección.`,
  },
  {
    keywords: ['oficial', 'delegado', 'responsable', 'encargado', 'dpo', 'gobernanza', 'bloque c', 'bloque-c'],
    response: `El **Oficial de Protección de Datos (OPD)** o Delegado, equivalente al DPO europeo, es la persona o área responsable de asegurar el cumplimiento de la Ley 1581 dentro de la organización.

Sus funciones principales son: mantener actualizado el Registro Nacional de Bases de Datos (RNBD), atender solicitudes de titulares, capacitar al personal, gestionar incidentes de seguridad, y actuar como punto de contacto con la SIC.

Aunque la Ley 1581 no exige formalmente un OPD para todas las empresas, su designación es una buena práctica que fortalece la gobernanza y puede reducir sanciones. Para la SIC, tener un responsable identificado demuestra compromiso con el cumplimiento.`,
  },
  {
    keywords: ['mejorar', 'subir', 'aumentar', 'puntaje', 'score', 'cumplimiento', 'brecha'],
    response: `Para mejorar tu puntaje de cumplimiento de la Ley 1581, las acciones de mayor impacto son:

**Bloque A — Política (máx. 40%):**
Documenta y publica tu política de tratamiento. Es el fundamento de todo lo demás. Sin política, no puedes responder "Sí" a ninguna sub-pregunta del bloque.

**Bloque B — Privacy by Design (máx. 36%):**
Implementa un proceso de evaluación de impacto de privacidad (PIA) antes de lanzar nuevos productos. Aplica minimización de datos: recoge solo lo estrictamente necesario. Configura la privacidad como opción por defecto en tus sistemas.

**Bloque C — Gobernanza (máx. 24%):**
Establece un sistema de gestión de riesgos de privacidad documentado. Designa formalmente un oficial de protección de datos con funciones claras.

Empieza por el Bloque A — es el de mayor peso y el prerrequisito para los demás.`,
  },
  {
    keywords: ['consentimiento', 'autorización', 'autorizar', 'permiso'],
    response: `La **autorización** es el consentimiento previo, expreso e informado del titular para el tratamiento de sus datos personales. Sin ella, el tratamiento es ilegal según la Ley 1581.

Debe cumplir tres requisitos: ser **previa** (antes de iniciar el tratamiento), **expresa** (no puede inferirse del silencio) e **informada** (el titular debe conocer qué datos se tratan, con qué finalidad y sus derechos).

Puede obtenerse por escrito, oralmente (con grabación) o por medios inequívocos de comportamiento. Debe conservarse para demostrarla ante la SIC. La autorización no es necesaria cuando la ley expresamente lo dispensa (datos de naturaleza pública, urgencias médicas, datos procesados por entidades públicas en ejercicio de sus funciones).`,
  },
  {
    keywords: ['registro', 'rnbd', 'base de datos', 'registrar'],
    response: `El **Registro Nacional de Bases de Datos (RNBD)** es un directorio público administrado por la SIC donde los Responsables del Tratamiento deben inscribir sus bases de datos de personas naturales.

¿Quién debe inscribirse? Toda organización que tenga bases de datos con información personal de ciudadanos colombianos, con algunas excepciones para personas naturales que actúen en capacidad personal.

El registro se realiza en el portal de la SIC (www.sic.gov.co) y debe mantenerse actualizado. No registrarse o mantener información desactualizada es una infracción sancionable. El RNBD permite a los ciudadanos saber qué organizaciones tienen sus datos.`,
  },
  {
    keywords: ['seguridad', 'proteger', 'cifrado', 'cifrar', 'breach', 'filtración', 'incidente'],
    response: `Las medidas de **seguridad técnica y administrativa** son obligatorias bajo la Ley 1581 para proteger los datos personales de accesos no autorizados, pérdidas o filtraciones.

Las medidas técnicas recomendadas incluyen: cifrado de datos sensibles en reposo y en tránsito, control de acceso basado en roles, registros de auditoría (logs), backups periódicos y cifrados, y pruebas de penetración regulares.

Las medidas administrativas incluyen: políticas internas de seguridad de la información, capacitación periódica al personal, acuerdos de confidencialidad con empleados y proveedores, y un plan de respuesta a incidentes.

En caso de una brecha de seguridad, la organización debe notificarlo a la SIC y a los titulares afectados a la mayor brevedad posible.`,
  },
];

const DEFAULT_RESPONSE = `Gracias por tu consulta. Como asesor especializado en la **Ley 1581 de 2012** (Protección de Datos Personales en Colombia), puedo ayudarte con:

• Interpretación de la ley y sus decretos reglamentarios
• Entendimiento de tu puntaje de autodiagnóstico
• Estrategias para cerrar brechas de cumplimiento
• Privacy by Design y gobernanza de datos
• Derechos de los titulares y obligaciones del responsable
• Sanciones y medidas preventivas

¿Sobre cuál de estos temas necesitas orientación?`;

export function getFallbackResponse(userMessage: string): string {
  const msg = userMessage.toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, ''); // quitar tildes para comparar

  for (const rule of RULES) {
    if (rule.keywords.some((kw) => msg.includes(kw.normalize('NFD').replace(/[̀-ͯ]/g, '')))) {
      return rule.response;
    }
  }

  return DEFAULT_RESPONSE;
}
