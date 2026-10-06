# Makefile - convenient shortcuts for this project

.PHONY: dev check docker

# Run the app locally (needs .env.local -- see .env.example)
dev:
	npm ci
	@if [ ! -f .env.local ]; then cp .env.example .env.local; echo "Created .env.local -- fill in your keys"; fi
	npm run dev

# Everything CI runs
check:
	npm run lint
	npx tsc --noEmit
	npm run test
	npm run build

# Build and run the production image with Docker Compose
docker:
	docker compose up --build
