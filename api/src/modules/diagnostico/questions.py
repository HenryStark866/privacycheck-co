"""Diagnostic questions for Law 1581 compliance evaluation.

Each question includes:
- id: Question number (1-11)
- block: Block classification (A, B, C, or None for control questions)
- text: Question text in Spanish
- weight: Scoring weight (0 for non-scoring questions)
- role: Role of the question (gate, scored, complementary)
- explain: Explanation of what this question evaluates
- guide: Guidance on how to achieve compliance
"""

from typing import TypedDict


class Question(TypedDict):
    id: int
    block: str | None
    text: str
    weight: int
    role: str
    explain: str
    guide: str


QUESTIONS: list[Question] = [
    {
        "id": 1,
        "block": None,
        "text": "¿Su organización ha adoptado una Política de Tratamiento de Datos Personales conforme a la Ley 1581 de 2012?",
        "weight": 0,
        "role": "gate",
        "explain": "Esta pregunta evalúa si la organización cuenta con el documento base que establece los lineamientos para el tratamiento de datos personales, requisito fundamental del artículo 12 de la Ley 1581.",
        "guide": "Desarrolle y formalice una Política de Tratamiento de Datos Personales que incluya: finalidades del tratamiento, derechos de los titulares, procedimientos para ejercerlos, y responsable del tratamiento. Publíquela en su sitio web y notifique a los titulares.",
    },
    {
        "id": 2,
        "block": "A",
        "text": "¿La política incluye los procedimientos para que los titulares ejerzan sus derechos de acceso, actualización, rectificación y supresión?",
        "weight": 10,
        "role": "scored",
        "explain": "Evalúa si la política contempla mecanismos concretos para que los titulares puedan ejercer sus derechos ARCO (Acceso, Rectificación, Cancelación y Oposición) según el artículo 8 de la Ley 1581.",
        "guide": "Incluya en su política un capítulo dedicado a los derechos de los titulares con procedimientos claros, plazos de respuesta (máximo 10 días hábiles, prorrogables 5 más), canales de atención y formatos de solicitud.",
    },
    {
        "id": 3,
        "block": "A",
        "text": "¿Se ha registrado la base de datos ante el Registro Nacional de Bases de Datos (RNBD) de la SIC?",
        "weight": 10,
        "role": "scored",
        "explain": "Verifica el cumplimiento de la obligación de registro ante la Superintendencia de Industria y Comercio según el Decreto 886 de 2014 y la Circular Externa 002 de 2015.",
        "guide": "Ingrese al sistema RNBD de la SIC (www.sic.gov.co), registre todas sus bases de datos con información personal, indicando: finalidad, categorías de datos, medidas de seguridad y canales de atención al titular.",
    },
    {
        "id": 4,
        "block": "A",
        "text": "¿Cuenta con un Aviso de Privacidad publicado y accesible para los titulares?",
        "weight": 10,
        "role": "scored",
        "explain": "Evalúa la existencia y accesibilidad del Aviso de Privacidad, documento exigido por el artículo 14 del Decreto 1377 de 2013 que informa al titular sobre la existencia de la política.",
        "guide": "Elabore un Aviso de Privacidad conciso que indique: nombre del responsable, finalidad del tratamiento, derechos del titular y mecanismos para ejercerlos. Publíquelo en todos los puntos de recolección de datos.",
    },
    {
        "id": 5,
        "block": "A",
        "text": "¿Se obtiene autorización previa, expresa e informada del titular antes de recolectar sus datos personales?",
        "weight": 10,
        "role": "scored",
        "explain": "Verifica el cumplimiento del principio de consentimiento del artículo 9 de la Ley 1581, que exige autorización previa e informada del titular para cualquier tratamiento.",
        "guide": "Implemente mecanismos de autorización (escrita, oral o por conducta inequívoca) que sean previos a la recolección, informando al titular: qué datos se recolectan, para qué fines y los derechos que le asisten. Conserve evidencia de las autorizaciones.",
    },
    {
        "id": 6,
        "block": "B",
        "text": "¿Ha implementado medidas técnicas de seguridad para proteger los datos personales contra acceso no autorizado?",
        "weight": 12,
        "role": "scored",
        "explain": "Evalúa las medidas técnicas del principio de seguridad (artículo 4, literal g) que exige medidas apropiadas para evitar adulteración, pérdida, consulta o uso no autorizado.",
        "guide": "Implemente controles como: cifrado de datos sensibles, control de acceso basado en roles, auditoría de accesos, copias de respaldo, firewalls y antimalware. Documente estas medidas en un plan de seguridad de la información.",
    },
    {
        "id": 7,
        "block": "B",
        "text": "¿Realiza evaluaciones de impacto de privacidad (PIA) antes de implementar nuevos tratamientos de datos?",
        "weight": 12,
        "role": "scored",
        "explain": "Verifica si la organización aplica el enfoque de privacidad desde el diseño mediante evaluaciones de impacto antes de iniciar nuevos tratamientos, según las recomendaciones de la SIC.",
        "guide": "Establezca un proceso formal de PIA que se active antes de: lanzar nuevos productos/servicios que traten datos, implementar nuevas tecnologías, o realizar transferencias internacionales. El PIA debe identificar riesgos y mitigaciones.",
    },
    {
        "id": 8,
        "block": "B",
        "text": "¿Tiene implementado un programa de capacitación en protección de datos para los empleados?",
        "weight": 12,
        "role": "scored",
        "explain": "Evalúa si la organización forma a su personal en obligaciones de protección de datos, elemento clave para la efectividad del programa integral según el artículo 27 del Decreto 1377.",
        "guide": "Diseñe un programa anual de capacitación que cubra: marco legal, política interna, manejo de incidentes, derechos de titulares y sanciones. Incluya inducción para nuevos empleados y actualizaciones periódicas. Documente asistencia.",
    },
    {
        "id": 9,
        "block": "C",
        "text": "¿Ha implementado un procedimiento documentado para la gestión de incidentes de seguridad que involucren datos personales?",
        "weight": 16,
        "role": "scored",
        "explain": "Verifica la existencia de un protocolo de respuesta a incidentes, obligación derivada del principio de seguridad y del deber de reportar vulneraciones a la SIC según la Circular 002 de 2015.",
        "guide": "Desarrolle un procedimiento de gestión de incidentes que incluya: detección, contención, investigación, notificación a la SIC y a titulares afectados (cuando aplique), remediación y lecciones aprendidas. Defina roles y tiempos de respuesta.",
    },
    {
        "id": 10,
        "block": "C",
        "text": "¿Ha designado un Oficial de Protección de Datos Personales o un área responsable del cumplimiento?",
        "weight": 8,
        "role": "scored",
        "explain": "Evalúa si la organización ha asignado formalmente la responsabilidad del programa de protección de datos a una persona o área específica, como recomienda la SIC para organizaciones con tratamientos significativos.",
        "guide": "Designe formalmente un Oficial de Protección de Datos o un área responsable. Esta persona/área debe: supervisar el cumplimiento, atender consultas y reclamos, coordinar con la SIC, y reportar a la alta dirección.",
    },
    {
        "id": 11,
        "block": "C",
        "text": "¿El Oficial de Protección de Datos cuenta con designación formal documentada y recursos asignados?",
        "weight": 0,
        "role": "complementary",
        "explain": "Complementa la pregunta anterior verificando si la designación del oficial es formal (acta, resolución o contrato) y si cuenta con recursos (tiempo, presupuesto, herramientas) para ejercer su función efectivamente.",
        "guide": "Formalice la designación mediante documento oficial (resolución interna, modificación de funciones del cargo, o contrato). Asigne recursos específicos: dedicación horaria, presupuesto para capacitación y herramientas, y acceso a la alta dirección.",
    },
]


def get_question(question_id: int) -> Question | None:
    """Get a question by its ID."""
    for q in QUESTIONS:
        if q["id"] == question_id:
            return q
    return None


def get_questions_by_block(block: str) -> list[Question]:
    """Get all questions belonging to a specific block."""
    return [q for q in QUESTIONS if q["block"] == block]
