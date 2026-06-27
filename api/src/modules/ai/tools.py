"""Tool definitions for OpenAI function calling format.

Defines the tools that DeepSeek can invoke during conversation:
- explain_question: Get deterministic explanation for a diagnostic question
- calculate_score: Compute compliance score from answers
- generate_plan: Generate prioritized improvement actions
- simulate_whatif: Simulate score impact of improvements
"""

# Tool definitions in OpenAI function calling format
TOOL_DEFINITIONS: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": "explain_question",
            "description": (
                "Obtiene la explicación determinística y guía de cumplimiento "
                "para una pregunta específica del diagnóstico de la Ley 1581. "
                "Usa esta herramienta cuando el usuario pregunte sobre una pregunta específica."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "question_id": {
                        "type": "integer",
                        "description": "ID de la pregunta del diagnóstico (1-11)",
                        "minimum": 1,
                        "maximum": 11,
                    }
                },
                "required": ["question_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "calculate_score",
            "description": (
                "Calcula el puntaje de cumplimiento a partir de las respuestas del diagnóstico. "
                "Delega al motor de puntuación determinístico. "
                "Usa esta herramienta cuando necesites computar o recalcular el puntaje."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "answers": {
                        "type": "object",
                        "description": (
                            "Diccionario con las respuestas: claves son IDs de pregunta (1-11) "
                            "como strings, valores son booleanos."
                        ),
                        "additionalProperties": {"type": "boolean"},
                    }
                },
                "required": ["answers"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "generate_plan",
            "description": (
                "Genera un plan de acción priorizado basado en las brechas identificadas, "
                "el sector y tamaño de la empresa. "
                "Usa esta herramienta cuando el usuario solicite un plan de mejora."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "gaps": {
                        "type": "array",
                        "description": "Lista de brechas con question_id, weight, y text",
                        "items": {
                            "type": "object",
                            "properties": {
                                "question_id": {"type": "integer"},
                                "weight": {"type": "integer"},
                                "text": {"type": "string"},
                            },
                            "required": ["question_id", "weight"],
                        },
                    },
                    "sector": {
                        "type": "string",
                        "description": "Sector económico de la empresa",
                    },
                    "size": {
                        "type": "string",
                        "description": "Tamaño de la empresa (Micro, Pequeña, Mediana, Grande)",
                    },
                },
                "required": ["gaps"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "simulate_whatif",
            "description": (
                "Simula el impacto en el puntaje si se implementan mejoras específicas. "
                "Usa esta herramienta cuando el usuario pregunte '¿qué pasaría si...?' "
                "o quiera ver el efecto de implementar una mejora."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "current_answers": {
                        "type": "object",
                        "description": (
                            "Respuestas actuales: claves son IDs de pregunta como strings, "
                            "valores son booleanos."
                        ),
                        "additionalProperties": {"type": "boolean"},
                    },
                    "improvements": {
                        "type": "array",
                        "description": "Lista de IDs de preguntas a mejorar (cambiar a True)",
                        "items": {"type": "integer"},
                    },
                },
                "required": ["current_answers", "improvements"],
            },
        },
    },
]


def get_tool_definitions() -> list[dict]:
    """Return the tool definitions for the OpenAI function calling API."""
    return TOOL_DEFINITIONS
