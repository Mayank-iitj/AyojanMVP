.PHONY: dev build start test eval lint migrate

dev:
	npm run dev

build:
	npm run build

start:
	npm run start

test:
	npm run test

eval:
	npm run eval

lint:
	npm run lint

migrate:
	@echo "Applying /migrations/001_init_aayojan.sql when DATABASE_URL is configured..."
	@if [ -n "$$DATABASE_URL" ]; then psql "$$DATABASE_URL" -f migrations/001_init_aayojan.sql; else echo "Using built-in seeded Version Store (no DATABASE_URL required for standalone deployment)."; fi
