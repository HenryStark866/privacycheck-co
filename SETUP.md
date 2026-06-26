# Guía de instalación y despliegue — CAVALTEC Ley 1581

## Prerrequisitos
- Node.js 18+
- Cuenta en [Supabase](https://supabase.com) (gratis)
- Cuenta en [Vercel](https://vercel.com) (gratis)
- Clave API de [Anthropic](https://console.anthropic.com)

---

## 1. Configurar Supabase

1. Crea un proyecto en https://supabase.com/dashboard
2. Ve a **SQL Editor** y ejecuta el contenido de `supabase/migrations/001_initial.sql`
3. Ve a **Authentication → Providers** y activa:
   - **Google**: necesitas credenciales OAuth en [Google Cloud Console](https://console.cloud.google.com)
   - **Azure** (Microsoft): necesitas un App Registration en [Azure Portal](https://portal.azure.com)
4. En ambos proveedores, añade como **Redirect URL**:
   ```
   https://TU-PROYECTO.supabase.co/auth/v1/callback
   ```
5. Copia tu **Project URL** y **anon key** desde Settings → API

---

## 2. Variables de entorno

Copia `.env.local.example` como `.env.local` y completa:

```bash
cp .env.local.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 3. Instalar y ejecutar en local

```bash
npm install
npm run dev
```

Abre http://localhost:3000

---

## 4. Desplegar en Vercel

```bash
npm i -g vercel
vercel
```

O conecta el repositorio desde https://vercel.com/new

Añade las variables de entorno en **Vercel → Settings → Environment Variables**:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `ANTHROPIC_API_KEY`
- `NEXT_PUBLIC_APP_URL` (tu dominio de Vercel, ej. `https://mi-app.vercel.app`)

Actualiza también la **Redirect URL** de OAuth en Supabase:
```
https://mi-app.vercel.app/auth/callback
```

---

## 5. Arquitectura del proyecto

```
src/
├── app/
│   ├── (auth)/login/          → Pantalla de login OAuth (Google + Microsoft)
│   ├── auth/callback/         → Callback OAuth de Supabase
│   ├── (app)/
│   │   ├── dashboard/         → Vista general con estadísticas
│   │   ├── companies/         → CRUD de empresas
│   │   └── evaluations/[id]/
│   │       ├── diagnose/      → Formulario de 11 preguntas con lógica condicional
│   │       └── results/       → Velocímetro, desglose, brechas, IA, PDF
│   └── api/
│       ├── ai/                → Módulo IA (Anthropic) — clave solo en servidor
│       └── report/[id]/       → Generación de PDF exportable
├── lib/
│   ├── scoring.ts             → Motor de puntuación (fuente de verdad)
│   ├── questions.ts           → 11 preguntas con lógica condicional
│   ├── supabase/              → Cliente browser + servidor
│   └── ai/prompts.ts          → Plantillas de prompts + fallbacks
└── components/
    ├── Gauge.tsx              → Velocímetro SVG 0–100%
    ├── BlockBreakdown.tsx     → Barras por bloque A/B/C
    ├── GapList.tsx            → Lista de brechas con acciones
    ├── QuestionCard.tsx       → Tarjeta de pregunta + IA contextual
    ├── AIExplainPopover.tsx   → Popover "explicar" / "cómo responder"
    ├── WhatIfSimulator.tsx    → Simulador "¿qué pasaría si…?"
    └── MaturityBadge.tsx      → Badge Inicial/Básico/Gestionado/Optimizado/Líder
```

---

## 6. Criterios del reto cubiertos

| Criterio (peso) | Implementación |
|-----------------|---------------|
| Alineación Ley 1581 (20%) | 11 preguntas exactas del brief, 3 bloques, pesos correctos, lógica padre/hijo/complementaria |
| Desarrollo técnico (20%) | Next.js 14 + TypeScript + Supabase + Anthropic SDK, arquitectura limpia, RLS |
| Seguridad (15%) | OAuth PKCE (Google + Microsoft), RLS multi-tenant, clave IA solo en servidor, OWASP |
| Uso de IA (15%) | 4 funciones: explain, guide, action_plan, interpret — con fallback determinístico |
| Experiencia usuario (10%) | Formulario condicional, diseño intuitivo en español, progreso en tiempo real |
| Calidad diagnóstico (10%) | Velocímetro, desglose por bloque, lista de brechas priorizada, exportar PDF |
| Innovación (10%) | Simulador "what-if", niveles de madurez (Inicial→Líder), historial por empresa |
