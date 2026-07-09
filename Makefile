# Yggdrasil — dev loop.  Needs python3 and node (+ Chrome/Chromium for `test`).
# The design-system workshop (`storybook`) additionally needs `npm install`.
# Run `make` with no target for the list.
.DEFAULT_GOAL := help
.PHONY: help build test check serve clean fonts storybook storybook-build storybook-deploy

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

fonts: ## regenerate design/fonts.css (inlined webfont) from node_modules (needs `npm install`)
	python3 build/fonts.py

storybook: ## run the design-system workshop at http://localhost:6006 (needs `npm install`)
	npm run storybook

storybook-build: ## build the static design-system site to storybook-static/
	npm run build-storybook

storybook-deploy: storybook-build ## rebuild + refresh the committed storybook/ folder (served on Pages at /kingdom/storybook/)
	rm -rf storybook && mkdir storybook && cp -r storybook-static/. storybook/
	@echo "refreshed storybook/ — commit it to publish to https://oddurs.github.io/kingdom/storybook/"

clean: ## remove build caches
	rm -rf build/__pycache__ storybook-static
