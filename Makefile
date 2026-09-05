.PHONY: install console dev api web test lint bench clean

install:
	uv venv && uv pip install -e ".[dev]"

console:      ## Milestone 1: one turn, no browser
	python -m agent.main console

dev:          ## Connect the worker to LiveKit Cloud
	python -m agent.main dev

api:          ## Token server + static client on :8080
	uvicorn api.server:app --reload --port 8080

test:
	pytest -q

lint:
	ruff check . && ruff format --check .

bench:        ## Milestone 3 gate
	python -m bench.latency --min-turns 20

clean:
	rm -rf .pytest_cache .ruff_cache **/__pycache__
