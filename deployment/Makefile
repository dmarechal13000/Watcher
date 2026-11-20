# --- Makefile ---
include .env

.PHONY: help netcheck up down build pull deploy migrate backup populate-db superuser create-certs init dev dev-down dev-logs docs

NETCHECK_CMD = ./scripts/check-network.sh
REPLACE_TLS_CMD = ./scripts/replace-tls.sh

# Local development stack (see compose.dev.yaml)
DEV_COMPOSE = DEV_UID=$(shell id -u) DEV_GID=$(shell id -g) docker compose -f docker-compose.yml -f compose.dev.yaml --env-file .env

help:
	@echo "Available commands:"
	@echo "  up            - Start services"
	@echo "  down          - Stop services"
	@echo "  build         - Build Docker images"
	@echo "  pull          - Pull Docker images"
	@echo "  deploy        - Deploy application"
	@echo "  migrate       - Run database migrations"
	@echo "  backup        - Backup the database"
	@echo "  populate-db   - Populate database with sample data"
	@echo "  superuser     - Create a superuser account"
	@echo "  create-certs  - Generate TLS certificates"
	@echo "  init          - Initialize the project"
	@echo "  dev           - Start the local dev stack (hot reload: runserver + webpack watch)"
	@echo "  dev-down      - Stop the local dev stack"
	@echo "  dev-logs      - Follow watcher and frontend logs of the dev stack"
	@echo "  docs          - Build the Sphinx documentation (Watcher/docs/_build) in the watcher:dev image"

up:
	$(NETCHECK_CMD)
	$(REPLACE_TLS_CMD)
	@echo "Starting services..."
	@docker compose --env-file .env up -d

down:
	@echo "Stopping services..."
	@docker compose --env-file .env down --remove-orphans

build:
	@echo "Building images..."
	@docker compose --env-file .env build

pull:
	@echo "Pulling images..."
	@docker compose --env-file .env pull

deploy:
	$(NETCHECK_CMD)
	$(REPLACE_TLS_CMD)
	@echo "Deploying..."
	@./scripts/deploy.sh

migrate:
	@echo "Running migrations..."
	@./scripts/migrate.sh

backup:
	@echo "Backing up database..."
	@./scripts/backup-db.sh

populate-db:
	@echo "Populating database with sample data..."
	@./scripts/populate-db.sh

superuser:
	@echo "Creating superuser..."
	@./scripts/create-superuser.sh

create-certs:
	@echo "Generating certificates..."
	@./scripts/openssl-certificates-generator.sh

init:
	@echo "Initializing project..."
	@./scripts/init.sh
	@echo "Initialization complete."

dev:
	$(NETCHECK_CMD)
	$(REPLACE_TLS_CMD)
	@echo "Starting local dev stack..."
	@$(DEV_COMPOSE) up -d --build

dev-down:
	@echo "Stopping local dev stack..."
	@$(DEV_COMPOSE) down --remove-orphans

dev-logs:
	@$(DEV_COMPOSE) logs -f watcher frontend

# Sphinx and every dependency autodoc imports are in the watcher:dev image.
# Run as the host user: build_the_docs.sh temporarily rewrites source files with sed -i.
docs:
	@echo "Building the documentation..."
	@$(DEV_COMPOSE) build watcher
	@docker run --rm --user $(shell id -u):$(shell id -g) -e HOME=/tmp \
		-v "$(abspath $(WATCHER_PATH))/Watcher:/src" -w /src/docs \
		--entrypoint ./build_the_docs.sh watcher:dev
