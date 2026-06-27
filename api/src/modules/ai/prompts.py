"""System prompt builder for DeepSeek AI interactions.

Builds context-aware system prompts with Law 1581 expertise,
company context, and current diagnostic state.
"""

from dataclasses import dataclass


@dataclass
class CompanyContext:
    """Company information for contextualizing AI responses."""

    nombre: str
    sector: str | None = None
    tamano: str | None = None


@dataclass
class DiagnosticState:
    """Current diagnostic state for the conversation."""

    score: int | None = None
    maturity: str | None = None
    gaps: list[dict] | None = None
    answers: dict[int, bool] | None = None


@dataclass
class ChatContext:
    """Full context for an AI chat interaction."""

    company: CompanyContext | None = None
    diagnostic: DiagnosticState | None = None
    history: list[dict] | None = None  # [{"role": "user"|"assistant", "content": str}]


def build_system_prompt(context: ChatContext | None = None) -> str:
    """Build the system prompt with Law 1581 expertise and contextual information.

    The prompt establishes the AI as a Colombian data protection expert and
    includes company-specific context and diagnostic state when available.

    Args:
        context: Optional chat context with company and diagnostic information.

    Returns:
        Complete system prompt string.
    """
    base_prompt = (
        "Eres un experto en protección de datos personales en Colombia, "
        "especializado en la Ley 1581 de 2012 (Ley de Habeas Data) y sus decretos reglamentarios "
        "(Decreto 1377 de 2013, Decreto 886 de 2014). "
        "Tu rol es asistir a empresas colombianas en su autodiagnóstico de cumplimiento "
        "mediante el sistema Habeas Check.\n\n"
        "CAPACIDADES:\n"
        "- Explicar cada una de las 11 preguntas del diagnóstico y su fundamento legal\n"
        "- Interpretar resultados de cumplimiento (puntaje, nivel de madurez, brechas)\n"
        "- Generar planes de acción priorizados según las brechas identificadas\n"
        "- Simular escenarios \"qué pasaría si\" para mostrar el impacto de mejoras\n"
        "- Orientar sobre procedimientos ante la SIC (Superintendencia de Industria y Comercio)\n\n"
        "HERRAMIENTAS DISPONIBLES:\n"
        "Usa las herramientas (function calling) para obtener datos determinísticos. "
        "NUNCA inventes puntajes ni cálculos; siempre usa calculate_score o simulate_whatif.\n\n"
        "DIRECTRICES DE RESPUESTA:\n"
        "- Responde siempre en español colombiano profesional\n"
        "- Sé conciso pero completo\n"
        "- Cita artículos específicos de la Ley 1581 cuando sea relevante\n"
        "- Si no tienes certeza sobre algo, indícalo claramente\n"
        "- Incluye recomendaciones accionables cuando sea apropiado\n"
        "- No repitas información que el usuario ya conoce del contexto\n"
    )

    sections: list[str] = [base_prompt]

    if context and context.company:
        company = context.company
        company_section = "\nCONTEXTO DE LA EMPRESA:\n"
        company_section += f"- Nombre: {company.nombre}\n"
        if company.sector:
            company_section += f"- Sector: {company.sector}\n"
        if company.tamano:
            company_section += f"- Tamaño: {company.tamano}\n"
        sections.append(company_section)

    if context and context.diagnostic:
        diag = context.diagnostic
        diag_section = "\nESTADO DEL DIAGNÓSTICO ACTUAL:\n"
        if diag.score is not None:
            diag_section += f"- Puntaje: {diag.score}/100\n"
        if diag.maturity:
            diag_section += f"- Nivel de madurez: {diag.maturity}\n"
        if diag.gaps:
            gap_ids = [str(g.get("question_id", "")) for g in diag.gaps]
            diag_section += f"- Brechas (preguntas): {', '.join(gap_ids)}\n"
        if diag.answers:
            answered = len(diag.answers)
            positive = sum(1 for v in diag.answers.values() if v)
            diag_section += f"- Preguntas respondidas: {answered}/11 ({positive} positivas)\n"
        sections.append(diag_section)

    return "".join(sections)
