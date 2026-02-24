# Riven (Ø) — Agent Instructions

## Cursor Cloud specific instructions

Riven is a zero-dependency, pure client-side flow-based programming framework. There is no build step, no backend, and no database.

### Services

| Service | Command | Port |
|---|---|---|
| Static dev server | `npx serve . -l 3000` | 3000 |

### Key commands

- **Lint:** `npm run lint` (runs `standard`)
- **Lint fix:** `npm run lint:fix` (runs `standard --fix`)
- **Dev server:** `npm run dev` (runs `serve . -l 3000`)
- **Test:** `npm test` (runs `standard` — no unit tests exist)

### Notes

- The project is vanilla JS with no transpilation. JS files are loaded directly via `<script>` tags in the HTML example files.
- The `package.json` `standard.globals` config declares `RIVEN` and `Ø` as global variables for the linter.
- There are three example HTML files at the repo root: `example.math.html`, `example.conditional.html`, `example.mesh.html`. Open any of them in a browser (via the dev server) to see the interactive SVG graph.
- The `serve` static file server redirects with 301 to paths with trailing slash; use `-L` with curl to follow redirects.
