# AGENTS.md: carchess3d 🏰🚽

This is the **implementation** repo for the Carlesso family 3D chess.

- **Spec = source of truth**: `palladius/respec` → `carlesso-family/chess3d/SPEC.md`
  (locally `~/git/respec`). Don't change the spec from here: propose 1-2 line
  changes to Riccardo, and report any drift between code and spec.
- Stack per spec: Three.js ES modules, no build step, vendored deps, offline PWA.
- Architettura giochi 3D: usa sempre la skill di Niccolò (`.agents/skills/niccolo-game-design`).
- After every change: `just test`, bump `VERSION`, add a `CHANGELOG.md` entry.
- **Public repo**: no secrets (pass `HF_TOKEN` / `GEMINI_API_KEY` via env only),
  no internal paths or links. Never touch `.env` or `.riccardo/`.
- Git: only move forward (no `reset --hard`, no `clean`, no force push).
- 3D pipeline work goes in `tools/model-pipeline/` and is logged in its
  `RUNNING_DOC.md` (prompts, API/MCP calls, parameters, results).
