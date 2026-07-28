# Yggdrasil — dev loop.  Needs python3 and node (+ Chrome/Chromium for `test`).
# The design-system workshop (`storybook`) additionally needs `npm install`.
# Run `make` with no target for the list.
.DEFAULT_GOAL := help
.PHONY: help build test test-pages check live site serve clean fonts og storybook storybook-build

help: ## show this help
	@grep -hE '^[a-z-]+:.*##' $(MAKEFILE_LIST) | sort | sed -E 's/:.*## / — /'

build: ## rebuild plant-tree.html from build/src + data
	python3 build/build.py

test: build ## rebuild, then run the headless-Chrome regression suite
	node test/smoke.mjs

test-pages: site ## assemble, then check the 567 generated taxon pages (no browser)
	node test/pages.mjs

check: test test-pages ## build + both suites — the pre-commit gate

live: build ## verify the PUBLISHED site — canonical resolves, robots/sitemap reachable
	node test/live.mjs

site: build ## assemble the deployable site into _site/ (app + 567 taxon pages)
	python3 build/site.py

serve: site ## assemble, then serve _site at http://localhost:8000 — same layout CI deploys
	@echo "serving http://localhost:8000  (Ctrl-C to stop)"
	@cd _site && python3 -m http.server 8000

fonts: ## regenerate design/fonts.css (inlined webfont) from node_modules (needs `npm install`)
	python3 build/fonts.py

og: build ## regenerate og.jpg — the social-share preview (needs Chrome/Chromium)
	node build/og.mjs

storybook: ## run the design-system workshop at http://localhost:6006 (needs `npm install`)
	npm run storybook

storybook-build: ## build the static design-system site to storybook-static/
	npm run build-storybook


clean: ## remove build caches
	rm -rf build/__pycache__ storybook-static og.jpg _site
