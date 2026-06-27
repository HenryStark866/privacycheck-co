"""Seed script: generates synthetic data for Habeas Check API demo.

Generates:
- 50 empresas (Colombian companies across sectors)
- 30 users (admins, evaluadores, auditores)
- 150+ evaluaciones with varied scores and progression
- 20 chat sessions with messages

Run: docker compose exec api python -m src.seed
"""

import asyncio
import random
import uuid
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import async_session_factory, engine, Base
from src.models import (
    ChatMessage,
    ChatSession,
    Empresa,
    EmpresaUser,
    Evaluacion,
    ProviderEnum,
    RolEnum,
    User,
)
from src.modules.diagnostico.scoring import compute_score

# --- Colombian company data ---

SECTORES = [
    "Tecnología", "Salud", "Financiero", "Educación", "Comercio",
    "Manufactura", "Telecomunicaciones", "Energía", "Agroindustria",
    "Transporte", "Construcción", "Seguros", "Legal", "Consultoría",
    "Alimentos", "Retail", "Inmobiliario", "Turismo", "Medios",
    "Farmacéutico",
]

TAMANOS = ["Microempresa", "Pequeña", "Mediana", "Grande"]

EMPRESAS_NOMBRES = [
    "TechCo Colombia S.A.S", "Salud Digital Ltda", "FinPro Servicios Financieros",
    "EduTech Innovación S.A.", "ComercioNet S.A.S", "Manufactura Andina S.A.",
    "TeleCom Solutions Ltda", "EnergíaVerde Colombia S.A.", "AgroData S.A.S",
    "TransLogística S.A.", "Constructora DataSafe Ltda", "AseguraData S.A.",
    "LegalTech Abogados S.A.S", "Consultoría Habeas Ltda", "Alimentos PrimaData S.A.",
    "RetailSoft Colombia S.A.S", "Inmobiliaria ProtecData S.A.", "TurisTech Ltda",
    "Medios Digitales S.A.", "FarmaData Colombia S.A.S",
    "CyberGuard Solutions S.A.S", "DataSentry Ltda", "CloudPrivacy S.A.",
    "InfoSec Colombia Ltda", "BioData Health S.A.S", "NexGen Analytics S.A.",
    "SecureFinance Ltda", "EduProtect S.A.S", "GreenData Energy S.A.",
    "LogiSafe Transport Ltda", "BuildSecure S.A.S", "PolicyGuard Insurance S.A.",
    "LawData Partners Ltda", "StratConsult S.A.S", "FoodSafe Colombia S.A.",
    "ShopProtect Retail Ltda", "HomeData Inmobiliaria S.A.S", "TravelSafe Ltda",
    "MediaGuard Digital S.A.", "PharmaProtect S.A.S",
    "Innova Privacy S.A.S", "DataFirst Colombia Ltda", "CompliTech S.A.",
    "PrivacyHub Ltda", "SafeNet Solutions S.A.S", "TrustData S.A.",
    "ComplianceOne Ltda", "DataShield S.A.S", "SecurePath Colombia S.A.",
    "PrivaGuard Solutions Ltda",
]

USERS_DATA = [
    # Admins (5)
    ("Carlos Rodríguez", "carlos.rodriguez@habeascheck.co", "admin"),
    ("María García", "maria.garcia@habeascheck.co", "admin"),
    ("Andrés López", "andres.lopez@habeascheck.co", "admin"),
    ("Laura Martínez", "laura.martinez@habeascheck.co", "admin"),
    ("Juan Hernández", "juan.hernandez@habeascheck.co", "admin"),
    # Evaluadores (18)
    ("Sofía Ramírez", "sofia.ramirez@eval.co", "evaluador"),
    ("Diego Torres", "diego.torres@eval.co", "evaluador"),
    ("Valentina Castro", "valentina.castro@eval.co", "evaluador"),
    ("Santiago Morales", "santiago.morales@eval.co", "evaluador"),
    ("Isabella Vargas", "isabella.vargas@eval.co", "evaluador"),
    ("Mateo Jiménez", "mateo.jimenez@eval.co", "evaluador"),
    ("Camila Rojas", "camila.rojas@eval.co", "evaluador"),
    ("Daniel Ortiz", "daniel.ortiz@eval.co", "evaluador"),
    ("Gabriela Ruiz", "gabriela.ruiz@eval.co", "evaluador"),
    ("Sebastián Díaz", "sebastian.diaz@eval.co", "evaluador"),
    ("Mariana Peña", "mariana.pena@eval.co", "evaluador"),
    ("Nicolás Guerrero", "nicolas.guerrero@eval.co", "evaluador"),
    ("Paula Restrepo", "paula.restrepo@eval.co", "evaluador"),
    ("Alejandro Sánchez", "alejandro.sanchez@eval.co", "evaluador"),
    ("Ana Cardenas", "ana.cardenas@eval.co", "evaluador"),
    ("Felipe Muñoz", "felipe.munoz@eval.co", "evaluador"),
    ("Carolina Mejía", "carolina.mejia@eval.co", "evaluador"),
    ("Ricardo Ospina", "ricardo.ospina@eval.co", "evaluador"),
    # Auditores (7)
    ("Patricia Herrera", "patricia.herrera@audit.co", "auditor"),
    ("Fernando Gómez", "fernando.gomez@audit.co", "auditor"),
    ("Claudia Beltrán", "claudia.beltran@audit.co", "auditor"),
    ("Roberto Acosta", "roberto.acosta@audit.co", "auditor"),
    ("Mónica Cifuentes", "monica.cifuentes@audit.co", "auditor"),
    ("Gustavo Pardo", "gustavo.pardo@audit.co", "auditor"),
    ("Adriana Quintero", "adriana.quintero@audit.co", "auditor"),
]

# Answer profiles for different maturity levels
ANSWER_PROFILES = {
    "lider": {  # 95-100%
        "q1_true": True,
        "block_a_prob": 0.95,
        "block_b_prob": 0.95,
        "q9_prob": 0.98,
        "q10_prob": 0.95,
    },
    "optimizado": {  # 75-94%
        "q1_true": True,
        "block_a_prob": 0.85,
        "block_b_prob": 0.80,
        "q9_prob": 0.90,
        "q10_prob": 0.80,
    },
    "gestionado": {  # 50-74%
        "q1_true": True,
        "block_a_prob": 0.60,
        "block_b_prob": 0.55,
        "q9_prob": 0.70,
        "q10_prob": 0.50,
    },
    "basico": {  # 25-49%
        "q1_true": True,
        "block_a_prob": 0.35,
        "block_b_prob": 0.30,
        "q9_prob": 0.40,
        "q10_prob": 0.30,
    },
    "inicial": {  # 0-24%
        "q1_true": False,
        "block_a_prob": 0.10,
        "block_b_prob": 0.15,
        "q9_prob": 0.10,
        "q10_prob": 0.05,
    },
}

CHAT_MESSAGES = [
    ("user", "¿Qué es la Ley 1581 de 2012?"),
    ("assistant", "La Ley 1581 de 2012 es la norma colombiana de protección de datos personales (Habeas Data). Establece principios, derechos de los titulares y obligaciones para quienes tratan datos personales."),
    ("user", "¿Qué significa la pregunta 1 del diagnóstico?"),
    ("assistant", "La pregunta 1 evalúa si su organización ha adoptado una Política de Tratamiento de Datos Personales conforme al artículo 12 de la Ley 1581. Es la base de todo el programa de cumplimiento."),
    ("user", "¿Cómo puedo mejorar mi puntaje?"),
    ("assistant", "Basado en sus brechas, le recomiendo priorizar: 1) Implementar un procedimiento de gestión de incidentes (Q9, +16%), 2) Realizar evaluaciones de impacto PIA (Q7, +12%). Estas dos acciones tendrían el mayor impacto."),
    ("user", "¿Qué pasa si no cumplo con la ley?"),
    ("assistant", "La SIC puede imponer sanciones que van desde multas de hasta 2.000 SMLMV, suspensión de actividades de tratamiento por hasta 6 meses, cierre temporal o definitivo de operaciones, y registro en el RNBD."),
    ("user", "Explícame la pregunta 9"),
    ("assistant", "La pregunta 9 evalúa si tiene un procedimiento documentado para gestión de incidentes de seguridad con datos personales. Esto incluye: detección, contención, notificación a la SIC y a titulares, y lecciones aprendidas."),
]


def generate_answers(profile_name: str) -> dict[int, bool]:
    """Generate answers based on a maturity profile."""
    profile = ANSWER_PROFILES[profile_name]
    answers: dict[int, bool] = {}

    # Q1 (gate)
    answers[1] = profile["q1_true"] if random.random() < 0.85 else not profile["q1_true"]

    # Block A (Q2-Q5) - only meaningful if Q1=True
    for q in [2, 3, 4, 5]:
        answers[q] = random.random() < profile["block_a_prob"]

    # Block B (Q6-Q8)
    for q in [6, 7, 8]:
        answers[q] = random.random() < profile["block_b_prob"]

    # Q9
    answers[9] = random.random() < profile["q9_prob"]

    # Q10
    answers[10] = random.random() < profile["q10_prob"]

    # Q11 (only if Q10=True)
    if answers[10]:
        answers[11] = random.random() < 0.6
    else:
        answers[11] = False

    return answers


async def seed_data():
    """Main seed function."""
    print("🌱 Starting seed process...")
    print("=" * 60)

    async with async_session_factory() as session:
        # Check if data already exists
        result = await session.execute(select(Empresa))
        existing = result.scalars().all()
        if len(existing) > 5:
            print(f"⚠️  Database already has {len(existing)} empresas. Skipping seed.")
            print("   Run 'docker compose down -v && docker compose up -d' to reset.")
            return

        # --- Create Users ---
        print("\n👤 Creating 30 users...")
        users: list[User] = []
        for name, email, role in USERS_DATA:
            user = User(
                id=uuid.uuid4(),
                email=email,
                name=name,
                provider=random.choice([ProviderEnum.google, ProviderEnum.microsoft]),
                provider_id=f"dev-{uuid.uuid4().hex[:12]}",
                is_active=True,
            )
            session.add(user)
            users.append(user)
        await session.flush()
        print(f"   ✅ {len(users)} users created")

        # Separate by role
        admins = [u for u, (_, _, r) in zip(users, USERS_DATA) if r == "admin"]
        evaluadores = [u for u, (_, _, r) in zip(users, USERS_DATA) if r == "evaluador"]
        auditores = [u for u, (_, _, r) in zip(users, USERS_DATA) if r == "auditor"]

        # --- Create Empresas ---
        print("\n🏢 Creating 50 empresas...")
        empresas: list[Empresa] = []
        for i, nombre in enumerate(EMPRESAS_NOMBRES):
            nit_base = 9000000000 + i * 11111
            nit = str(nit_base)[:10]
            empresa = Empresa(
                id=uuid.uuid4(),
                nombre=nombre,
                nit=nit,
                sector=SECTORES[i % len(SECTORES)],
                tamano=random.choice(TAMANOS),
            )
            session.add(empresa)
            empresas.append(empresa)
        await session.flush()
        print(f"   ✅ {len(empresas)} empresas created")

        # --- Create Memberships ---
        print("\n🔗 Assigning memberships...")
        membership_count = 0

        # Admins get access to all empresas
        for admin in admins:
            for empresa in empresas[:10]:  # Each admin manages ~10 empresas
                m = EmpresaUser(user_id=admin.id, empresa_id=empresa.id, rol=RolEnum.admin)
                session.add(m)
                membership_count += 1

        # Evaluadores get 2-4 empresas each
        for i, evaluador in enumerate(evaluadores):
            start_idx = (i * 3) % len(empresas)
            for j in range(random.randint(2, 4)):
                emp_idx = (start_idx + j) % len(empresas)
                m = EmpresaUser(
                    user_id=evaluador.id,
                    empresa_id=empresas[emp_idx].id,
                    rol=RolEnum.evaluador,
                )
                session.add(m)
                membership_count += 1

        # Auditores get 3-5 empresas each
        for i, auditor in enumerate(auditores):
            start_idx = (i * 5) % len(empresas)
            for j in range(random.randint(3, 5)):
                emp_idx = (start_idx + j) % len(empresas)
                m = EmpresaUser(
                    user_id=auditor.id,
                    empresa_id=empresas[emp_idx].id,
                    rol=RolEnum.auditor,
                )
                session.add(m)
                membership_count += 1

        await session.flush()
        print(f"   ✅ {membership_count} memberships created")

        # --- Create Evaluaciones ---
        print("\n📊 Creating 150+ evaluaciones with scoring...")
        eval_count = 0
        profiles = list(ANSWER_PROFILES.keys())
        base_date = datetime(2025, 1, 15)

        for empresa in empresas:
            # Each empresa gets 2-5 evaluations over time (showing progression)
            num_evals = random.randint(2, 5)

            # Choose a starting profile and potentially improve
            start_profile_idx = random.randint(0, len(profiles) - 1)

            for eval_num in range(num_evals):
                # Tend to improve over time
                profile_idx = max(0, start_profile_idx - eval_num)
                profile_name = profiles[profile_idx]

                answers = generate_answers(profile_name)
                score_result = compute_score(answers)

                # Random evaluador with membership in this empresa
                evaluator = random.choice(evaluadores)

                eval_date = base_date + timedelta(
                    days=eval_num * random.randint(30, 90),
                    hours=random.randint(8, 18),
                    minutes=random.randint(0, 59),
                )

                evaluacion = Evaluacion(
                    id=uuid.uuid4(),
                    empresa_id=empresa.id,
                    user_id=evaluator.id,
                    answers=answers,
                    score=score_result.score,
                    maturity=score_result.maturity.label,
                    blocks={
                        k: {"name": v.name, "earned": v.earned, "max": v.max}
                        for k, v in score_result.blocks.items()
                    },
                    gaps=[
                        {"question_id": g.question_id, "weight": g.weight, "text": g.text}
                        for g in score_result.gaps
                    ],
                    notes=score_result.notes,
                    created_at=eval_date,
                )
                session.add(evaluacion)
                eval_count += 1

        await session.flush()
        print(f"   ✅ {eval_count} evaluaciones created")

        # --- Create Chat Sessions ---
        print("\n💬 Creating chat sessions with messages...")
        chat_count = 0
        msg_count = 0

        for i in range(20):
            user = random.choice(evaluadores)
            empresa = random.choice(empresas)

            chat_session = ChatSession(
                id=uuid.uuid4(),
                user_id=user.id,
                empresa_id=empresa.id,
                channel=random.choice(["web", "web", "web", "api"]),
                is_active=True,
                created_at=base_date + timedelta(days=random.randint(1, 365)),
            )
            session.add(chat_session)
            await session.flush()
            chat_count += 1

            # Add 2-5 message pairs
            num_pairs = random.randint(2, 5)
            msg_indices = random.sample(
                range(0, len(CHAT_MESSAGES), 2),
                min(num_pairs, len(CHAT_MESSAGES) // 2),
            )

            for j, msg_idx in enumerate(msg_indices):
                for offset in range(2):
                    if msg_idx + offset < len(CHAT_MESSAGES):
                        role, content = CHAT_MESSAGES[msg_idx + offset]
                        msg = ChatMessage(
                            id=uuid.uuid4(),
                            session_id=chat_session.id,
                            role=role,
                            content=content,
                            created_at=chat_session.created_at + timedelta(minutes=j * 2 + offset),
                        )
                        session.add(msg)
                        msg_count += 1

        await session.flush()
        print(f"   ✅ {chat_count} chat sessions, {msg_count} messages created")

        # --- Commit ---
        await session.commit()

    print("\n" + "=" * 60)
    print("🎉 Seed complete!")
    print(f"   📦 50 empresas")
    print(f"   👤 30 users (5 admin, 18 evaluador, 7 auditor)")
    print(f"   📊 {eval_count} evaluaciones")
    print(f"   💬 {chat_count} chat sessions ({msg_count} messages)")
    print(f"   🔗 {membership_count} memberships")
    print("\n💡 Use POST /api/v1/auth/dev/login to get a token and explore the data.")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(seed_data())
