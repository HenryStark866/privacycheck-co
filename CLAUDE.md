CAVALTEC — Autodiagnóstico Ley 1581 (Privacy by Design)
This skill builds the strongest possible submission for the CAVALTEC challenge: a secure, intuitive, multi-tenant web app that lets organizations self-assess their compliance with Colombia's Ley 1581 de 2012 in the design phase, producing a compliance percentage, a gauge visualization, gap identification, and AI-powered recommendations.
The whole point is to win. The judges score on seven weighted criteria (see references/regulatory-and-scoring.md). This skill is organized so that every architectural and product decision maps to one of those criteria. Read the workflow below, pick the target level, then load the reference files you need.
Step 0 — Orient before building
The user is competing. Before writing code, settle four things (ask only what isn't already clear from the conversation — infer the rest and state your assumptions):

Target level — Level 1 (basic), 2 (intermediate), or 3 (advanced). Default to Level 3 unless the user signals limited time/scope, because the rubric rewards multi-tenant, roles, AI, exportable reports, and history. If time is tight, build Level 3 architecture but ship a Level 2 feature set with clean upgrade seams.
Stack — Default to the stack in references/architecture.md (Next.js + Supabase + Anthropic API), which the judges' "Desarrollo técnico" and "Seguridad" criteria reward and which deploys fast on Vercel. Honor a different stack if the user already has one.
Real vs. demo auth — Real OAuth (Google/Microsoft) scores best. If the user can't configure OAuth providers in time, ship Supabase Auth with a Google provider stub and document the Microsoft path, so the demo still shows the OAuth flow.
AI key — Confirm the Anthropic API key path. In-artifact demos can use the window.claude.complete / fetch pattern; production uses a server route that never exposes the key to the client.

Then state a short build plan tied to the rubric and proceed. Don't over-interview; competitors value momentum.
Step 1 — Lock the scoring engine FIRST
The diagnostic scoring is the heart of the app and the easiest place to lose "Alineación con la ley" and "Calidad del diagnóstico" points by getting it subtly wrong. The brief specifies a non-obvious model: weighted blocks, a parent question (Q1) that inherits the weight of its children (Q2–Q5), and a complementary question (Q11) that does not add to the total.
Before building any UI, implement and unit-test the scoring engine exactly as specified in references/regulatory-and-scoring.md. Copy scripts/scoring_engine.js (or its Python twin scripts/scoring_engine.py) into the project as the single source of truth, and run scripts/test_scoring.js to confirm the canonical test vectors pass (empty = 0%, all-yes = 100%, and the parent-inheritance and complementary-exclusion cases). A correct engine here is worth more than any visual polish.
Never re-derive the weights from memory. Read them from the reference file every time.
Step 2 — Build by level
Each level is additive. Read references/architecture.md for the full module breakdown, data model, and folder layout. The short version:

Level 1 (básico): diagnostic form (11 questions, conditional sub-questions), scoring engine, percentage result, gauge, simple clean UI. No auth required, single-session.
Level 2 (intermedio): add OAuth login, a results dashboard, conditional question logic (Q1 gates Q2–Q5; Q10 gates Q11), and basic AI recommendations.
Level 3 (avanzado): add multi-tenant (each empresa → many evaluations), roles (administrador / evaluador / auditor), full AI module (explain questions, guide answers, interpret results, action plan), downloadable PDF reports, evaluation history, and the advanced security baseline.

Build in this order regardless of target level: scoring engine → diagnostic form → results/gauge → auth → multi-tenant/roles → AI → reports/history. This keeps a working demo at every checkpoint.
Step 3 — Wire the AI module deliberately
The "Uso de IA" criterion rewards useful, accurate AI, not a chatbot bolted on. Implement the four AI functions the brief names, each with a focused prompt: (1) explain a legal question in plain Spanish, (2) guide how to interpret/answer it, (3) generate a prioritized action plan to close gaps, (4) interpret the overall result. Use the prompt templates and the JSON-output contract in references/ai-integration.md. Always respond in Colombian Spanish, ground answers in Ley 1581, and degrade gracefully if the API is unavailable.
Step 4 — Apply the security baseline
"Seguridad" is 15% of the score and underpins "Alineación con la ley." Apply the controls in references/security.md: OAuth done right (PKCE, no tokens in the client beyond what's needed), secure sessions, input validation, OWASP Top 10 mitigations, secrets only on the server, and — critically for multi-tenant — Row-Level Security so one empresa can never read another's evaluations. The app is about data protection; insecure handling of the user's own data is disqualifying.
Step 5 — Make the diagnosis visual, clear, and actionable
"Experiencia de usuario," "Calidad del diagnóstico," and "Innovación" together are 30% of the score. Deliver: a gauge (velocímetro) 0–100%, a per-block breakdown, an explicit gaps list (the questions that failed) ranked by weight/impact, the AI action plan, and an exportable PDF/dashboard. Follow the design direction in references/architecture.md (and the frontend-design skill if available) so it doesn't look templated. Innovation differentiators that judges like: benchmarking against an anonymized average, a "what-if" simulator showing how each fix moves the score, and a maturity-level label (Inicial / Básico / Gestionado / Optimizado) derived from the percentage.
Files in this skill

references/regulatory-and-scoring.md — Read first. Ley 1581 mapping, the exact 11-question diagnostic, block weights, parent/child inheritance, complementary-question rule, maturity bands, and the judging rubric.
references/architecture.md — Stack, data model (multi-tenant, roles), folder structure, module-by-module spec for Levels 1–3, UI/UX direction.
references/ai-integration.md — Prompt templates and JSON contracts for the four AI functions, Colombian-Spanish persona, fallback behavior, and the in-artifact vs. server patterns.
references/security.md — OAuth, sessions, OWASP Top 10 checklist, multi-tenant RLS, secrets handling, mapped to the brief's security table.
scripts/scoring_engine.js / scripts/scoring_engine.py — Drop-in, tested scoring implementation. The source of truth for the percentage.
scripts/test_scoring.js — Canonical test vectors. Run before trusting any UI.
assets/diagnostic-questions.json — The 11 questions with weights, blocks, parent/child and complementary flags, ready to import.

Anti-patterns to avoid (these lose the reto)

Re-deriving weights from memory instead of assets/diagnostic-questions.json. The model is specific; guess and you lose law-alignment points.
Letting Q11 add to the total, or letting Q1 carry its own weight on top of its children. Both break the spec.
Storing the Anthropic key in client code or an artifact that ships to judges.
A multi-tenant app with no RLS — a cross-tenant leak in a data-protection tool is the worst possible look.
A generic Bootstrap-looking dashboard. Spend the UI budget; 30% of the score is experience/clarity/innovation.
Englishifying the UI or AI. The audience and law are Colombian; keep it in Colombian Spanish.