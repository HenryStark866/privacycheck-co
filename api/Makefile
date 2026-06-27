# =============================================================================
# Habeas Check API - Makefile
# =============================================================================

.PHONY: build up down migrate test logs shell lint clean channels

# Build Docker images
build:
	docker compose build

# Start all services in background
up:
	docker compose up -d

# Stop all services
down:
	docker compose down

# Run database migrations
migrate:
	docker compose exec api alembic upgrade head

# Run test suite
test:
	docker compose exec api pytest

# Follow service logs
logs:
	docker compose logs -f

# Open a shell in the API container
shell:
	docker compose exec api bash

# Start with optional channel services (Evolution API)
channels:
	docker compose --profile channels up -d

# Run linting
lint:
	docker compose exec api python -m flake8 src/

# Remove volumes and clean up
clean:
	docker compose down -v --remove-orphans

# Show running services status
status:
	docker compose ps

# Generate a new Alembic migration
migration:
	docker compose exec api alembic revision --autogenerate -m "$(msg)"

# Help
help:
	@echo "Available targets:"
	@echo "  build      - Build Docker images"
	@echo "  up         - Start all services"
	@echo "  down       - Stop all services"
	@echo "  migrate    - Run database migrations"
	@echo "  test       - Run test suite"
	@echo "  logs       - Follow service logs"
	@echo "  shell      - Open shell in API container"
	@echo "  channels   - Start with WhatsApp (Evolution API)"
	@echo "  lint       - Run linting"
	@echo "  clean      - Remove volumes and clean up"
	@echo "  status     - Show running services"
	@echo "  migration  - Generate new migration (msg=description)"
	@echo "  help       - Show this help"
