# Makefile - convenient shortcuts for this project

.PHONY: dev docker

# -------------------------------------------------
# Run the full stack locally (backend + frontend)
# -------------------------------------------------
# 1. Create & activate Python virtualenv for the backend
# 2. Install Python deps
# 3. Start FastAPI backend (in background)
# 4. Install Node deps (including devDependencies)
# 5. Run Next.js dev server
# -------------------------------------------------

dev:
	@echo "Setting up backend virtualenv..."
	cd backend && python3 -m venv venv
	@echo "Activating venv and installing Python deps..."
	cd backend && source venv/bin/activate && pip install -r requirements.txt
	@echo "Starting FastAPI backend in background..."
	source backend/venv/bin/activate && uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload &
	@echo "Installing Node dependencies..."
	npm ci
	@echo "Copying .env.local if missing..."
	@if [ ! -f .env.local ]; then cp .env.local.example .env.local; fi
	@echo "Starting Next.js dev server..."
	npm run dev

# -------------------------------------------------
# Build and run everything with Docker Compose
# -------------------------------------------------
# Requires Docker Desktop (Docker daemon) to be running.
# -------------------------------------------------

docker:
	docker compose up --build
