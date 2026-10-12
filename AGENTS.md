# AGENTS.md: carchess3d 🏰🚽

This is the **implementation** repo for the Carlesso family 3D chess.

- **Spec = source of truth**: [`docs/spec/SPEC.md`](docs/spec/SPEC.md) (with the
  original idea in `docs/spec/input_prompt.md`). The spec lives **in this repo** and
  may be edited here: when code and spec drift, update the spec in the same change
  and mention it in `CHANGELOG.md`. (History: it was born in `palladius/respec`;
  that repo is no longer a dependency.)
- Stack per spec: Three.js ES modules, no build step, vendored deps, offline PWA.
- CPU opponent: turn-taking is owned by `AIWorkerManager` (reacts to
  `OPPONENT_CHANGED` / `MOVE_EXECUTED` / `BATTLE_*`); `BoardMapManager` applies
  `AI_MOVE_READY`. `main.js` and the HUD never call the AI directly.
- Architettura giochi 3D: usa sempre la skill di Niccolò (`.agents/skills/niccolo-game-design`).
- After every change: `just test`, bump `VERSION`, add a `CHANGELOG.md` entry.
- **Public repo**: no secrets (pass `HF_TOKEN` / `GEMINI_API_KEY` via env only),
  no internal paths or links. Never touch `.env` or `.riccardo/`.
- 🚫 **Be Googley, IP safety**: never name protected brands, franchises or characters
  (Shrek, Netflix, Saint Seiya, D&D, Zorro, Hot Wheels…) in the **app**: code,
  identifiers, UI text, data, generation prompts. Use generic descriptions ("orco",
  "asinello", "Maxischermo", "fantasy spell"). Only `docs/` and `CHANGELOG` may cite
  them. Exception: "Pixar-style" is allowed in generation prompts only (image quality),
  never in UI. `just test` fails on `etc/ip-denylist.txt` hits; extend that list,
  don't bypass it.
- Git: only move forward (no `reset --hard`, no `clean`, no force push).
- 3D pipeline work goes in `tools/model-pipeline/` and is logged in its
  `RUNNING_DOC.md` (prompts, API/MCP calls, parameters, results).
