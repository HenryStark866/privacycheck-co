"""Report generation service for PDF export of evaluations."""

from datetime import UTC, datetime
from pathlib import Path

from jinja2 import Environment, FileSystemLoader

from src.models import Empresa, Evaluacion, User

# Template directory path
TEMPLATES_DIR = Path(__file__).parent / "templates"

# Maturity level color mapping
MATURITY_COLORS = {
    "Líder": "#1a8c37",
    "Optimizado": "#27ae60",
    "Gestionado": "#f39c12",
    "Básico": "#e67e22",
    "Inicial": "#e74c3c",
}


class ReportService:
    """Service for generating PDF reports from evaluation data."""

    def __init__(self) -> None:
        """Initialize Jinja2 template environment."""
        self._env = Environment(
            loader=FileSystemLoader(str(TEMPLATES_DIR)),
            autoescape=True,
        )

    def generate_pdf(
        self,
        evaluacion: Evaluacion,
        empresa: Empresa,
        evaluador: User | None,
    ) -> bytes:
        """
        Generate a PDF report for the given evaluation.

        Args:
            evaluacion: The evaluation record with score, blocks, gaps, notes.
            empresa: The company associated with the evaluation.
            evaluador: The user who performed the evaluation (may be None).

        Returns:
            PDF file content as bytes.
        """
        template = self._env.get_template("report.html")

        # Prepare blocks data for the template
        blocks = evaluacion.blocks or {}
        # Ensure blocks have proper structure for template rendering
        template_blocks = {}
        for key, block_data in blocks.items():
            if isinstance(block_data, dict):
                template_blocks[key] = block_data
            else:
                template_blocks[key] = {"name": str(block_data), "earned": 0, "max": 0}

        # Prepare gaps data
        gaps = evaluacion.gaps or []

        # Prepare notes
        notes = evaluacion.notes or []

        # Format dates
        fecha_evaluacion = evaluacion.created_at.strftime("%d/%m/%Y %H:%M")
        fecha_generacion = datetime.now(UTC).strftime("%d/%m/%Y %H:%M UTC")

        # Get maturity color
        maturity = evaluacion.maturity or "Inicial"
        maturity_color = MATURITY_COLORS.get(maturity, "#999")

        # Build template context
        context = {
            "empresa_nombre": empresa.nombre,
            "empresa_nit": empresa.nit,
            "empresa_sector": empresa.sector,
            "empresa_tamano": empresa.tamano,
            "fecha_evaluacion": fecha_evaluacion,
            "evaluador_nombre": evaluador.name if evaluador else "No especificado",
            "evaluacion_id": str(evaluacion.id),
            "score": evaluacion.score or 0,
            "maturity": maturity,
            "maturity_color": maturity_color,
            "blocks": template_blocks,
            "gaps": gaps,
            "notes": notes,
            "fecha_generacion": fecha_generacion,
        }

        # Render HTML from template
        html_content = template.render(**context)

        # Convert HTML to PDF using WeasyPrint (lazy import to allow
        # the module to load even when system libraries are missing,
        # e.g., during testing on machines without GTK/Pango)
        from weasyprint import HTML

        pdf_bytes = HTML(string=html_content).write_pdf()

        return pdf_bytes
