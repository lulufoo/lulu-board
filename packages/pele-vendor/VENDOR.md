# Pele (vendored browser build)

- Package: `pele`
- Version / pin: `1.7.0`
- Upstream: https://github.com/obsidianmd/pele
- Pin file: `packages/pele-vendor/PELE_PIN`
- License: MIT — see `packages/pele-vendor/LICENSE`
- Runtime copy: `packages/drawer-app/vendor/pele.global.js` (`dist/pele.global.js`)

Board renders Mermaid 12.1.0 syntax through Pele. Do not load Mermaid.js.
This slice renders `flowchart` / `graph` and the design group. Other Mermaid keywords are refused.
