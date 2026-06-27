"""Deterministic Fallback Provider for AI responses.

When the AI provider (DeepSeek) is unavailable or times out, this module
provides pre-authored, template-based responses that ensure the diagnostic
experience is never interrupted.

Implements the FallbackProvider protocol defined in gateway.py.
"""

from src.modules.ai.cache import classify_intent, extract_question_id
from src.modules.ai.prompts import ChatContext
from src.modules.diagnostico.questions import QUESTIONS, get_question


# --- Score interpretation templates ---

_INTERPRETATION_TEMPLATES: dict[str, str] = {
    "Líder": (
        "Su organización ha alcanzado un nivel de madurez **Líder** con un puntaje de {score}/100. "
        "Esto indica un cumplimiento ejemplar de la Ley 1581 de 2012. "
        "Su programa de protección de datos personales está consolidado y puede servir "
        "como referente en su sector. Mantenga las prácticas actuales y revise periódicamente "
        "ante cambios normativos."
    ),
    "Optimizado": (
        "Su organización se encuentra en nivel **Optimizado** con un puntaje de {score}/100. "
        "El cumplimiento es sólido con oportunidades puntuales de mejora. "
        "Los controles implementados cubren la mayoría de las obligaciones de la Ley 1581. "
        "Enfoque sus esfuerzos en cerrar las brechas restantes para alcanzar el nivel Líder."
    ),
    "Gestionado": (
        "Su organización se encuentra en nivel **Gestionado** con un puntaje de {score}/100. "
        "Existe un programa de protección de datos en desarrollo, pero aún hay brechas "
        "significativas que requieren atención. Priorice las acciones según el peso de cada "
        "brecha identificada para maximizar el impacto de sus mejoras."
    ),
    "Básico": (
        "Su organización se encuentra en nivel **Básico** con un puntaje de {score}/100. "
        "Se han dado pasos iniciales hacia el cumplimiento, pero la mayoría de los "
        "controles aún no están implementados. Es fundamental establecer un plan de acción "
        "priorizado y asignar recursos para avanzar en el cumplimiento de la Ley 1581."
    ),
    "Inicial": (
        "Su organización se encuentra en nivel **Inicial** con un puntaje de {score}/100. "
        "El cumplimiento de la Ley 1581 de 2012 es mínimo o inexistente. "
        "Se recomienda iniciar de inmediato con la adopción de una Política de Tratamiento "
        "de Datos Personales y el registro ante la SIC, ya que la organización puede estar "
        "expuesta a sanciones."
    ),
}

# Block-level interpretation
_BLOCK_DESCRIPTIONS: dict[str, str] = {
    "A": "Política de datos personales (cumplimiento documental y de consentimiento)",
    "B": "Privacidad desde el diseño (medidas técnicas, PIA y capacitación)",
    "C": "Gobernanza (gestión de incidentes y designación de oficial)",
}

# --- Generic fallback message ---

_GENERIC_FALLBACK = (
    "Soy el asistente de Habeas Check, especializado en la Ley 1581 de 2012 "
    "(Ley de Habeas Data de Colombia). Puedo ayudarle con:\n\n"
    "• **Explicar** cada pregunta del diagnóstico y su fundamento legal\n"
    "• **Interpretar** su puntaje y nivel de madurez\n"
    "• **Generar un plan** de acción priorizado según sus brechas\n"
    "• **Simular** el impacto de implementar mejoras específicas\n\n"
    "¿En qué puedo asistirle?"
)


class DeterministicFallbackProvider:
    """Deterministic fallback provider for when AI is unavailable.

    All methods return pre-authored, template-based text without any
    external API calls. Guarantees non-empty responses for all valid inputs.

    Implements the FallbackProvider protocol from gateway.py.
    """

    def explain(self, question_id: int) -> str:
        """Return pre-authored explanation and guidance for a question.

        Args:
            question_id: Question number (1-11).

        Returns:
            Non-empty string with explanation and guidance text.
            Returns a generic message if question_id is out of range.
        """
        question = get_question(question_id)
        if question is None:
            return (
                f"La pregunta {question_id} no se encuentra en el diagnóstico. "
                "El cuestionario contiene 11 preguntas (numeradas del 1 al 11)."
            )

        parts: list[str] = []
        parts.append(f"**Pregunta {question['id']}:** {question['text']}\n")
        parts.append(f"**¿Qué evalúa?** {question['explain']}\n")
        parts.append(f"**Guía de cumplimiento:** {question['guide']}")

        # Add contextual info about role/block
        if question["role"] == "gate":
            parts.append(
                "\n\n*Nota: Esta es una pregunta de control que condiciona "
                "la aplicabilidad de otras preguntas.*"
            )
        elif question["role"] == "complementary":
            parts.append(
                "\n\n*Nota: Esta es una pregunta complementaria que no suma "
                "puntos al puntaje total, pero cualifica la respuesta anterior.*"
            )
        elif question["block"]:
            parts.append(
                f"\n\n*Bloque {question['block']} — Peso: {question['weight']}%*"
            )

        return "\n".join(parts)

    def interpret(self, score: int, maturity: str, blocks: dict) -> str:
        """Return template-based interpretation of score results.

        Args:
            score: Compliance score (0-100).
            maturity: Maturity level label (Líder, Optimizado, etc.)
            blocks: Dict with block results, e.g. {"A": {"earned": 30, "max": 40}, ...}

        Returns:
            Non-empty interpretation string.
        """
        # Get the template for the maturity level, fallback to generic
        template = _INTERPRETATION_TEMPLATES.get(maturity)
        if template:
            interpretation = template.format(score=score)
        else:
            # Fallback for any unexpected maturity label
            interpretation = (
                f"Su puntaje es {score}/100, correspondiente al nivel de madurez "
                f"'{maturity}'. Consulte las brechas identificadas para determinar "
                "las acciones prioritarias de mejora."
            )

        # Add block breakdown if available
        if blocks:
            block_lines: list[str] = ["\n\n**Desglose por bloques:**"]
            for block_key in sorted(blocks.keys()):
                block_data = blocks[block_key]
                earned = block_data.get("earned", 0) if isinstance(block_data, dict) else getattr(block_data, "earned", 0)
                max_val = block_data.get("max", 0) if isinstance(block_data, dict) else getattr(block_data, "max", 0)
                desc = _BLOCK_DESCRIPTIONS.get(block_key, block_key)
                block_lines.append(
                    f"• Bloque {block_key} ({desc}): {earned}/{max_val}"
                )
            interpretation += "\n".join(block_lines)

        return interpretation

    def plan(self, gaps: list[dict], sector: str | None = None) -> str:
        """Return prioritized action plan based on gap weights.

        Gaps are presented in priority order (weight descending).

        Args:
            gaps: List of gap dicts with keys: question_id, weight, text.
                  Expected to be pre-sorted by weight descending.
            sector: Optional company sector for contextual notes.

        Returns:
            Non-empty prioritized action plan string.
        """
        if not gaps:
            return (
                "No se identificaron brechas en su diagnóstico. "
                "¡Felicitaciones! Su organización cumple con todos los "
                "requisitos evaluados de la Ley 1581 de 2012."
            )

        # Sort gaps by weight descending to ensure priority order
        sorted_gaps = sorted(gaps, key=lambda g: g.get("weight", 0), reverse=True)

        lines: list[str] = ["**Plan de Acción Priorizado**\n"]

        if sector:
            lines.append(
                f"*Plan personalizado para el sector: {sector}*\n"
            )

        total_potential = sum(g.get("weight", 0) for g in sorted_gaps)
        lines.append(
            f"Se identificaron {len(sorted_gaps)} brechas con un potencial "
            f"de mejora de {total_potential} puntos.\n"
        )

        for i, gap in enumerate(sorted_gaps, 1):
            q_id = gap.get("question_id", 0)
            weight = gap.get("weight", 0)
            question = get_question(q_id)

            if question:
                lines.append(
                    f"**{i}. [Prioridad {weight}%] Pregunta {q_id}:** "
                    f"{question['text']}"
                )
                lines.append(f"   → {question['guide']}\n")
            else:
                text = gap.get("text", f"Pregunta {q_id}")
                lines.append(
                    f"**{i}. [Prioridad {weight}%]** {text}\n"
                )

        lines.append(
            "---\n*Recomendación: Aborde las acciones en orden de prioridad "
            "(mayor peso = mayor impacto en el puntaje).*"
        )

        return "\n".join(lines)

    def generate_response(
        self, message: str, context: ChatContext | None = None
    ) -> str:
        """Main entry point. Detects intent and dispatches to appropriate method.

        Classifies the user's intent using keyword-based classification from cache.py,
        extracts question_id if applicable, and routes to the appropriate handler.

        Falls back to a generic helpful message if no specific response can be generated.

        Args:
            message: User message text.
            context: Optional chat context with company/diagnostic state.

        Returns:
            Non-empty response string.
        """
        intent = classify_intent(message)
        question_id = extract_question_id(message)

        # Dispatch based on intent
        if intent in ("explain", "guide") and question_id is not None:
            return self.explain(question_id)

        if intent == "interpret" and context and context.diagnostic:
            diag = context.diagnostic
            score = diag.score if diag.score is not None else 0
            maturity = diag.maturity or "Inicial"
            blocks = {}
            if diag.gaps is not None:
                # Build blocks from context if available
                pass
            return self.interpret(score, maturity, blocks)

        if intent == "plan" and context and context.diagnostic:
            diag = context.diagnostic
            gaps = diag.gaps or []
            sector = None
            if context.company and context.company.sector:
                sector = context.company.sector
            return self.plan(gaps, sector)

        if intent == "whatif":
            return (
                "La simulación de escenarios requiere acceso al motor de cálculo. "
                "En este momento el servicio de IA no está disponible para realizar "
                "simulaciones en tiempo real. Por favor, utilice el endpoint "
                "POST /api/v1/diagnostico/simulate con sus respuestas actuales "
                "y las preguntas que desea mejorar."
            )

        # If intent is explain/guide but no question_id, try to be helpful
        if intent in ("explain", "guide") and question_id is None:
            return (
                "¿Sobre cuál pregunta del diagnóstico desea información? "
                "El cuestionario contiene 11 preguntas:\n\n"
                + "\n".join(
                    f"• **P{q['id']}:** {q['text'][:80]}..."
                    if len(q["text"]) > 80
                    else f"• **P{q['id']}:** {q['text']}"
                    for q in QUESTIONS
                )
            )

        # If intent is interpret/plan but no context
        if intent in ("interpret", "plan"):
            return (
                "Para generar una interpretación o plan de acción, necesito los "
                "resultados de su diagnóstico. Por favor, complete primero la "
                "evaluación en POST /api/v1/evaluaciones y luego consulte aquí "
                "para obtener orientación personalizada."
            )

        # Default generic fallback
        return _GENERIC_FALLBACK
