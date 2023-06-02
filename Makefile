VERSION ?= 0.1.0

clean:
	find dist/* -not -path "dist/userscript*" -prune -exec rm -rf {} \;

change-version:
	sed -i -e "s/\"version\": \".*\"/\"version\": \"$(VERSION)\"/" src/browser-extension/manifest.json
	sed -i -e "s/\"version\": \".*\"/\"version\": \"$(VERSION)\"/" src/browser-extension/manifest.firefox.json
	sed -i -e "s/\"version\": \".*\"/\"version\": \"$(VERSION)\"/" src-tauri/tauri.conf.json
	sed -i -e "s/\"version\": \".*\"/\"version\": \"$(VERSION)\"/" package.json
	sed -i -e "s/\/\/ @version.*/\/\/ @version $(VERSION)/" public/userscript.js
	sed -i -E 's|futurenav-xj-assistant@[^/]+|futurenav-xj-assistant@v$(VERSION)|g' public/userscript.js

build-browser-extension: change-version
	pnpm vite build -c vite.config.chromium.ts
	pnpm vite build -c vite.config.firefox.ts
	cd dist/browser-extension/chromium && zip -r ../chromium.zip .
	cd dist/browser-extension/firefox && zip -r ../firefox.zip .

build-popclip-extension:
	rm -f dist/futurenav-xj-assistant.popclipextz
	mkdir -p dist/futurenav-xj-assistant.popclipext
	cp -r clip-extensions/popclip/* dist/futurenav-xj-assistant.popclipext
	cd dist && zip -r futurenav-xj-assistant.popclipextz futurenav-xj-assistant.popclipext && rm -r futurenav-xj-assistant.popclipext

build-snipdo-extension:
	rm -f dist/futurenav-xj-assistant.pbar
	zip -j -r dist/futurenav-xj-assistant.pbar clip-extensions/snipdo/*
