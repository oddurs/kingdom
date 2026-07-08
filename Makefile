# Yggdrasil — dev loop.  Needs python3 and node (+ Chrome/Chromium for `test`).
# Run `make` with no target for the list.
.DEFAULT_GOAL := help
.PHONY: help build test check serve clean

help: ## show this help
	@grep -hE '^[a-z]+:.*##' $(MAKEFILE_LIST) | sort | sed -E 's/:.*## / — /'

build: ## rebuild plant-tree.html from build/src + data
	python3 build/build.py

test: build ## rebuild, then run the headless-Chrome regression suite
	node test/smoke.mjs

check: test ## build + test — the pre-commit gate

serve: build ## build, then serve the repo at http://localhost:8000
	@echo "serving http://localhost:8000  (Ctrl-C to stop)"
	@python3 -m http.server 8000

clean: ## remove build caches
	rm -rf build/__pycache__
