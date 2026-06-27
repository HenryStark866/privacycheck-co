# PrivacyCheck Colombia — Autodiagnóstico Ley 1581 de 2012

> Plataforma web multi-tenant para autodiagnóstico de cumplimiento de la Ley 1581 de 2012 (Habeas Data) en empresas colombianas. Integra motor de puntuación, IA explicativa, reportes PDF y gateway WhatsApp.

**Reto CAVALTEC** — Talento Tech · iTraining · Universidad de Antioquia · Universidad de Caldas · Ubicuo

---

## ¿Qué hace?

Permite a cualquier organización colombiana evaluar su cumplimiento con la Ley 1581 en la fase de diseño:

1. **Diagnóstico de 11 preguntas** con lógica condicional alineada a la ley
2. **Puntaje de cumplimiento** (0–100%) desglosado por 3 bloques temáticos
3. **Identificación de brechas** priorizadas por impacto
4. **Recomendaciones de IA** — explica preguntas, guía respuestas, genera plan de acción
5. **Reporte PDF** exportable
6. **Integración WhatsApp** para consultas via chatbot
7. **Historial** de evaluaciones por empresa

---

## Stack Tecnológico

| Capa | Tecnologías |
|------|-------------|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS |
| Backend Web | Next.js API Routes, Firebase Admin SDK |
| Backend API | FastAPI, PostgreSQL 16, Redis 7, SQLAlchemy 2.0 |
| IA | Anthropic Claude (Haiku), DeepSeek Chat |
| Auth | Firebase Auth — OAuth Google + Microsoft |
| WhatsApp | OpenWA Gateway + localtunnel |
| Infraestructura | Docker, Vercel, Firebase Firestore |

---

## Instalación Rápida

### Requisitos

- Node.js ≥ 18
- Proyecto Firebase (Firestore + Auth con Google y Microsoft)
- API Key de Anthropic — [console.anthropic.com](https://console.anthropic.com)

### 1. Clonar e instalar

```bash
git clone https://github.com/tu-usuario/privacycheck-co.git
cd privacycheck-co
npm install
```

### 2. Configurar variables de entorno

```bash
cp .env.local.example .env.local
```

Completar en `.env.local`:

```env
# Firebase Cliente (público)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=tu-proyecto
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=tu-proyecto.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123

# Firebase Admin (servidor — NUNCA exponer)
FIREBASE_ADMIN_PROJECT_ID=tu-proyecto
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxx@tu-proyecto.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# IA
ANTHROPIC_API_KEY=sk-ant-api03-...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Ejecutar

```bash
npm run dev
```

Abrir http://localhost:3000

---

## Gateway WhatsApp (Opcional)

El gateway WhatsApp permite a los usuarios interactuar con la plataforma desde WhatsApp.

### Inicio rápido

```bash
conectar_wa.bat
```

Esto levanta el gateway OpenWA + el túnel localtunnel en un solo paso.

### Inicio manual

```bash
cd OpenWA-main
npm install
npm start
# En otra terminal:
npx localtunnel --port 3001 --subdomain cavaltec-wa-gateway-1234
```

---

## Backend FastAPI (Opcional)

Para el backend extendido con PostgreSQL, Redis y chat con streaming:

```bash
cd api
cp .env.example .env        # Completar credenciales
make build && make up       # Docker
make migrate                # Migraciones
```

API en http://localhost:8000 — Docs en http://localhost:8000/docs

---

## Motor de Puntuación

| Bloque | Preguntas | Peso Máximo |
|--------|-----------|-------------|
| A — Política de datos personales | Q2, Q3, Q4, Q5 | 40% |
| B — Privacidad desde el diseño | Q6, Q7, Q8 | 36% |
| C — Gobernanza | Q9, Q10 | 24% |
| **Total** | | **100%** |

**Reglas especiales:**
- Q1 es padre → habilita Q2–Q5 condicionalmente (hereda peso de hijas)
- Q11 es complementaria → no suma al total
- 5 niveles de madurez: Inicial · Básico · Gestionado · Optimizado · Líder

---

## Módulo de IA

4 funciones con prompts en español colombiano alineados con la Ley 1581:

| Función | Descripción |
|---------|-------------|
| Explicar | Traduce la pregunta legal a lenguaje sencillo |
| Guiar | Indica qué debe existir para responder "Sí" |
| Plan de acción | Genera acciones priorizadas para cerrar brechas |
| Interpretar | Explica el resultado para público no técnico |

Si la IA falla, el sistema genera recomendaciones automáticas con un fallback determinístico.

---

## Seguridad

- OAuth 2.0 (Google + Microsoft) con session cookies HTTP-only
- Multi-tenant con aislamiento real (Firestore Rules + RLS en PostgreSQL)
- Rate limiting, security headers OWASP, input validation
- Claves de IA solo en servidor
- Non-root user en contenedores Docker

---

## Despliegue

| Componente | Destino | Comando |
|------------|---------|---------|
| Frontend | Vercel | `commit_all.bat` o conectar repo a Vercel |
| Backend API | Docker | `cd api && docker compose up -d` |
| WhatsApp | Local | `conectar_wa.bat` |

---

## Estructura de Directorios

```
/src
 ├── app/             # Rutas, API endpoints y UI (Next.js App Router)
 ├── components/      # Componentes UI (Gauge, GapList, AIChat, WhatIf...)
 ├── lib/             # Lógica de negocio (scoring, questions, whatsapp, AI, Firebase)
 └── assets/          # diagnostic-questions.json (11 preguntas)
/api                  # Backend FastAPI (PostgreSQL + Redis + Docker)
/OpenWA-main          # Gateway WhatsApp (NestJS + localtunnel)
/supabase             # Migraciones SQL con RLS
/scripts              # Utilidades de verificación y setup
```

---

## Troubleshooting

| Problema | Solución |
|----------|----------|
| Firebase Admin: faltan variables | Verificar `FIREBASE_ADMIN_*` en `.env.local` |
| IA no responde | Verificar `ANTHROPIC_API_KEY`. El fallback genera recomendaciones igualmente |
| Error 502 en WhatsApp | Verificar cabecera `Bypass-Tunnel-Reminder: true` en `src/lib/whatsapp.ts` |
| OpenWA se cierra | Ejecutar `cd OpenWA-main && npm run build` |
| Backend no arranca | `cd api && make logs` para ver errores |

---

## Cumplimiento del Reto CAVALTEC

| Criterio | Peso | Estado |
|----------|------|--------|
| Alineación con la Ley 1581 | 20% | ✅ |
| Desarrollo técnico | 20% | ✅ |
| Seguridad | 15% | ✅ |
| Uso de IA | 15% | ✅ |
| Experiencia de usuario | 10% | ✅ |
| Calidad del diagnóstico | 10% | ✅ |
| Innovación | 10% | ✅ |

**Nivel alcanzado: 3 (Avanzado)** — Multi-tenant, roles, IA, reportes, históricos, seguridad avanzada, WhatsApp.

---

## Equipo

- María Isabel Arias Escudero
- Henry Camilo Taborda Galeano
- Luis Carlos Cabezas Castro
- Manuel Fernando Toro Muriel

---

**Fecha de entrega:** 27 de junio de 2025
