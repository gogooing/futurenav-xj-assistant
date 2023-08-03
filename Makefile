VERSION ?= 0.1.0

clean:
	rm -rf dist

change-version:
	sed -i -e "s/\"version\": \".*\"/\"version\": \"$(VERSION)\"/" src-tauri/tauri.conf.json

change-package-version:
	sed -i -e "s/\"version\": \".*\"/\"version\": \"$(VERSION)\"/" package.json

build-browser-extension: change-package-version
	pnpm vite build -c vite.config.chromium.ts
	pnpm vite build -c vite.config.firefox.ts
	cd dist/browser-extension/chromium && zip -r ../chromium.zip .
	cd dist/browser-extension/firefox && zip -r ../firefox.zip .

build-userscript: change-package-version
	pnpm vite build -c vite.config.userscript.ts

build-popclip-extension:
	rm -f dist/futurenav-xj-assistant.popclipextz
	mkdir -p dist/futurenav-xj-assistant.popclipext
	cp -r clip-extensions/popclip/* dist/futurenav-xj-assistant.popclipext
	cd dist && zip -r futurenav-xj-assistant.popclipextz futurenav-xj-assistant.popclipext && rm -r futurenav-xj-assistant.popclipext

build-snipdo-extension:
	rm -f dist/futurenav-xj-assistant.pbar
	zip -j -r dist/futurenav-xj-assistant.pbar clip-extensions/snipdo/*
