# Habeas Check API

Backend API para autodiagnóstico de cumplimiento de la Ley 1581 de 2012 (Habeas Data) en empresas colombianas.

## Quick Start

### Requisitos previos

- [Docker](https://docs.docker.com/get-docker/) >= 24.0
- [Docker Compose](https://docs.docker.com/compose/install/) >= 2.20
- [Make](https://www.gnu.org/software/make/) (opcional, pero recomendado)

### 1. Configurar variables de entorno

```bash
cp .env.example .env
# Editar .env con tus valores reales (API keys, secrets, etc.)
```

### 2. Construir y levantar servicios

```bash
make build
make up
```

O sin Make:

```bash
docker compose build
docker compose up -d
```

### 3. Ejecutar migraciones

```bash
make migrate
```

### 4. Verificar que todo funciona

```bash
curl http://localhost:8000/health
```

Respuesta esperada:
```json
{
  "status": "healthy",
  "version": "0.1.0",
  "service": "Habeas Check API",
  "dependencies": {
    "database": "healthy"
  }
}
```

La documentación interactiva está disponible en: http://localhost:8000/docs

---

## Desarrollo Local

El archivo `docker-compose.override.yml` se carga automáticamente y habilita:

- **Hot reload**: Cambios en `src/` se reflejan sin reiniciar el contenedor
- **Volume mounts**: Código fuente montado como volumen de solo lectura
- **Debug mode**: Variable `DEBUG=true` activada

Para desarrollo, simplemente:

```bash
make up
# Editar código en src/ — los cambios se aplican automáticamente
```

### Sin Docker (desarrollo nativo)

```bash
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
# .venv\Scripts\activate   # Windows

pip install -e ".[dev]"
uvicorn src.main:app --reload --port 8000
```

Requiere PostgreSQL y Redis corriendo localmente.

---

## Producción

Para producción, no uses `docker-compose.override.yml`:

```bash
docker compose -f docker-compose.yml up -d
```

O renombra/elimina el override:

```bash
mv docker-compose.override.yml docker-compose.override.yml.bak
docker compose up -d
```

---

## Servicios Opcionales

### WhatsApp (Evolution API)

Para habilitar el adaptador de WhatsApp vía Evolution API:

```bash
make channels
# o
docker compose --profile channels up -d
```

Requiere configurar en `.env`:
```
CHANNEL_WHATSAPP_ENABLED=true
EVOLUTION_API_KEY=tu-api-key
EVOLUTION_INSTANCE_NAME=habeas-check
```

---

## Comandos Make disponibles

| Comando | Descripción |
|---------|-------------|
| `make build` | Construir imágenes Docker |
| `make up` | Iniciar todos los servicios |
| `make down` | Detener todos los servicios |
| `make migrate` | Ejecutar migraciones de base de datos |
| `make test` | Ejecutar suite de tests |
| `make logs` | Ver logs en tiempo real |
| `make shell` | Abrir shell en contenedor API |
| `make channels` | Iniciar con Evolution API (WhatsApp) |
| `make lint` | Ejecutar linting |
| `make clean` | Eliminar volúmenes y limpiar |
| `make status` | Ver estado de servicios |
| `make migration msg="desc"` | Generar nueva migración Alembic |
| `make help` | Mostrar ayuda |

---

## Variables de Entorno

Toda la configuración se inyecta vía variables de entorno. No hay valores hardcodeados en la imagen.

### Aplicación

| Variable | Descripción | Default |
|----------|-------------|---------|
| `APP_NAME` | Nombre de la aplicación | Habeas Check API |
| `APP_VERSION` | Versión | 0.1.0 |
| `DEBUG` | Modo debug | false |
| `API_PORT` | Puerto expuesto del API | 8000 |

### Base de Datos

| Variable | Descripción | Default |
|----------|-------------|---------|
| `DATABASE_URL` | URL de conexión PostgreSQL | postgresql+asyncpg://postgres:postgres@localhost:5432/habeas_check |
| `POSTGRES_USER` | Usuario PostgreSQL | postgres |
| `POSTGRES_PASSWORD` | Contraseña PostgreSQL | postgres |
| `POSTGRES_DB` | Nombre de la base de datos | habeas_check |
| `POSTGRES_PORT` | Puerto PostgreSQL expuesto | 5432 |

### Redis

| Variable | Descripción | Default |
|----------|-------------|---------|
| `REDIS_URL` | URL de conexión Redis | redis://localhost:6379/0 |
| `REDIS_PORT` | Puerto Redis expuesto | 6379 |

### Autenticación (Supabase)

| Variable | Descripción | Default |
|----------|-------------|---------|
| `SUPABASE_JWT_SECRET` | Secret para validar JWT de Supabase | (requerido) |

### IA (DeepSeek)

| Variable | Descripción | Default |
|----------|-------------|---------|
| `AI_API_KEY` | API key de DeepSeek | (requerido) |
| `AI_BASE_URL` | URL base de la API | https://api.deepseek.com |
| `AI_MODEL` | Modelo a usar | deepseek-chat |
| `AI_TIMEOUT_SECONDS` | Timeout para llamadas IA | 10 |

### CORS

| Variable | Descripción | Default |
|----------|-------------|---------|
| `CORS_ORIGINS` | Orígenes permitidos (separados por coma) | http://localhost:3000,http://localhost:5173 |

### Canales

| Variable | Descripción | Default |
|----------|-------------|---------|
| `CHANNEL_WHATSAPP_ENABLED` | Habilitar WhatsApp | false |
| `CHANNEL_TELEGRAM_ENABLED` | Habilitar Telegram | false |
| `EVOLUTION_API_URL` | URL Evolution API | http://localhost:8080 |
| `EVOLUTION_API_KEY` | API key Evolution | (requerido si WhatsApp activo) |
| `EVOLUTION_INSTANCE_NAME` | Nombre de instancia | habeas-check |
| `TELEGRAM_BOT_TOKEN` | Token del bot Telegram | (requerido si Telegram activo) |
| `TELEGRAM_WEBHOOK_SECRET` | Secret para webhooks | (requerido si Telegram activo) |

### Rate Limiting

| Variable | Descripción | Default |
|----------|-------------|---------|
| `RATE_LIMIT_AUTH` | Requests/min en auth | 10 |
| `RATE_LIMIT_CHAT` | Requests/min en chat | 30 |
| `RATE_LIMIT_WEBHOOKS` | Requests/min en webhooks | 100 |
| `RATE_LIMIT_DEFAULT` | Requests/min default | 60 |

### Cache

| Variable | Descripción | Default |
|----------|-------------|---------|
| `CACHE_TTL_SECONDS` | TTL del cache semántico | 604800 (7 días) |

---

## Arquitectura Docker

```
┌─────────────────────────────────────────────────┐
│  Docker Compose Network (habeas-network)         │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │   API    │  │ Postgres │  │  Redis   │      │
│  │ :8000    │  │ :5432    │  │ :6379    │      │
│  │ FastAPI  │  │  v16     │  │  v7      │      │
│  └────┬─────┘  └──────────┘  └──────────┘      │
│       │                                          │
│  ┌────┴──────────────┐ (profile: channels)      │
│  │  Evolution API    │                           │
│  │  :8080 (optional) │                           │
│  └───────────────────┘                           │
└─────────────────────────────────────────────────┘
```

### Multi-stage Build

El Dockerfile usa un build multi-etapa para minimizar el tamaño de la imagen:

1. **Builder**: Instala dependencias de compilación y pip packages
2. **Runtime**: Solo contiene las libs necesarias + código fuente

Resultado: imagen ~250MB vs ~1GB+ sin multi-stage.

---

## Troubleshooting

### La API no arranca

```bash
make logs
# Verificar que .env tiene DATABASE_URL correcto
# Verificar que postgres está healthy: make status
```

### Error de conexión a base de datos

```bash
# Verificar que postgres está corriendo
docker compose ps postgres
# Reiniciar postgres
docker compose restart postgres
# Esperar y reintentar
make migrate
```

### Limpiar todo y empezar de cero

```bash
make clean
make build
make up
make migrate
```
