.PHONY: help install dev start test lint format clean docker-build docker-up docker-down build-exe

help:
	@echo "Noria — Development Commands"
	@echo ""
	@echo "Setup:"
	@echo "  make install          Install dependencies"
	@echo "  make setup            Setup development environment"
	@echo ""
	@echo "Development:"
	@echo "  make dev              Start development server (auto-reload)"
	@echo "  make start            Start production server"
	@echo "  make build            Build for production"
	@echo "  make build-exe        Build Noria.exe standalone executable (Windows)"
	@echo ""
	@echo "Quality:"
	@echo "  make lint             Run ESLint"
	@echo "  make lint-fix         Fix ESLint issues"
	@echo "  make format           Format code with Prettier"
	@echo "  make test             Run tests"
	@echo "  make test-coverage    Run tests with coverage"
	@echo ""
	@echo "Docker:"
	@echo "  make docker-build     Build Docker image"
	@echo "  make docker-up        Start Docker container"
	@echo "  make docker-down      Stop Docker container"
	@echo ""
	@echo "Maintenance:"
	@echo "  make clean            Clean build artifacts and cache"
	@echo "  make deps-update      Update dependencies"

install:
	npm install

setup: install
	npm run prepare
	cp -n .env.example .env
	@echo "✓ Setup complete. Configure .env and run: make dev"

dev:
	npm run dev

start:
	npm start

build:
	npm run build

build-exe:
	npm run build:exe

lint:
	npm run lint

lint-fix:
	npm run lint:fix

format:
	npm run format

test:
	npm test

test-coverage:
	npm test -- --coverage

docker-build:
	docker build -f docker/Dockerfile -t noria:latest .

docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

docker-dev:
	docker-compose --profile dev up

docker-logs:
	docker-compose logs -f noria

clean:
	rm -rf dist build coverage .nyc_output
	npm cache clean --force

deps-audit:
	npm audit

deps-update:
	npm update
	npm audit fix

.DEFAULT_GOAL := help
