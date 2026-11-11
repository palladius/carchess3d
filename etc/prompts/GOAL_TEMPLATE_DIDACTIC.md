# 🎓 `/goal` Template — Build a 3D Browser Game Hands-Off (Didactic Version)

> This is the **cleaned-up, reusable** version of the `/goal` that built CarChess3D
> ([original, warts and all](GOAL_BUILD_CARCHESS3D.md)). After reviewing the original,
> [Geneviève Huskens](https://www.linkedin.com/in/ghuskens/) made one sharp point:
> *it micromanages the subagents*. The original told the orchestrator exactly which four
> subagents to spawn and which files each one owned. That worked, but it is the human doing
> the planner's job. This template keeps what mattered — **guardrails, phases as outcomes,
> test-first, an adversarial critic with a numeric exit gate** — and leaves the
> decomposition to the agent. Project-specific details, in-jokes and personal paths are gone;
> `<angle brackets>` mark what you fill in.

**How to use:** run `/grill-me` first so the agent interviews you and produces a plan file,
then paste the block below (pointing at that plan) and walk away.

---

## 📋 Copy-paste `/goal`

```text
/goal Build the complete v1 of <GAME NAME> in this git worktree by executing
<path/to/plan.md> end-to-end. Do NOT stop after a couple of rounds: iterate autonomously —
with parallel subagents where it helps, unit tests, and an Adversarial Art Director Critic —
until every acceptance gate below is green and the critic rates the result >= 9/10.

GUARDRAILS (non-negotiable)
- Work ONLY in the current git worktree. Never touch other worktrees, secrets, or dotfiles.
- Commit small and often with conventional-commit messages; every milestone commit must
  pass the project test command (`<just test | npm test>`).
- Zero build step: vanilla ES modules, vendored dependencies, 100% offline-capable (PWA).
- Follow the architecture skill at <path/to/architecture SKILL.md> strictly:
  one manager = one responsibility (<= 300 LOC/file); rules live with the data they
  inspect; components communicate only through a queued, deterministic event bus flushed
  once per fixed tick; views/audio/storage are listeners, never callers; the simulation
  core is headless (no DOM, no renderer imports) and covered by Node unit tests;
  data-driven registries and object pools instead of if/else ladders and per-frame
  allocations; seeded PRNG for deterministic tests.
- IP-safe and public-repo clean: no third-party brands or characters, no secrets, no
  internal links.

PHASE 1 — BLUEPRINT BEFORE CODE
Produce a 2D spatial blueprint (SVG) with real metric dimensions for the board/arena,
the canonical height of each piece/character class, props and camera targets. Vendor the
3D/engine addons you need. Write the asset-grounding helper (bounding box -> feet at y=0,
scale to canonical height) before any asset is placed.

PHASE 2 — HEADLESS CORE, TEST-FIRST
Write failing Node tests first, then implement: event bus + seeded RNG + fixed-step game
loop; game-flow state machine; rules manager wrapping <rules library>; progression/reward
manager with a deterministic Monte-Carlo test (>= 10,000 iterations); a non-blocking AI
opponent in a Web Worker with Easy/Medium/Hard tiers and a hard time budget.

PHASE 3 — THE WORLD, THE PIECES, THE MODES
Deliver the playable 3D scene from the blueprint, the piece factory (real assets when
present, graceful procedural fallback when not), interaction (hover/select/legal-move
hints/capture feedback), the signature capture choreography for every attacker x defender
pair from a declarative matrix, the secondary "inspect & play" mode, a kid-friendly
bilingual HUD with passwordless profiles, procedural SFX + a theme, and PWA offline support.
Decompose this phase into parallel subagents however you see fit; give each a disjoint
set of files, and have them report back to you, not to the user.

PHASE 4 — ART DIRECTOR'S SEAT
Add a `?debug=1` on-screen panel (lighting, bloom, camera, piece scale sliders) and a
`progress.html` gallery that records a screenshot + notes per round.

PHASE 5 — ADVERSARIAL CRITIC LOOP (EXIT GATE)
After every round, render four diagnostic views (3/4 overview, close-up, low-angle
grounding check at y=0, wireframe). Spawn a read-only Adversarial Critic subagent that
inspects them, lists at least three concrete flaws, and scores the scene /10. Fix every
flaw, update progress.html, and repeat until:
- critic score >= 9/10,
- all unit tests pass with > 80% coverage of the headless core,
- the project test command passes 100%.
Then write a short RUNNING_DOC summarizing what was built, what was rejected and why.
```

---

## 🧭 What changed vs. the original (and why)

| Original | Template | Why |
| :-- | :-- | :-- |
| Named four subagents and assigned each a list of files | "Decompose however you see fit; disjoint files; report to you" | Geneviève's note: let the orchestrator plan; humans state outcomes and constraints. |
| Exact meters for braziers, moat radius, cinema screen position | "Blueprint with real metric dimensions" | The *practice* (blueprint first) is the lesson, not our numbers. |
| Family gags, catchphrases, Easter eggs | `<GAME NAME>`, generic "signature choreography per pair" | Didactic reuse; also keeps the public repo clean. |
| Commit author/co-author email trailers | "Conventional commits, tests green per milestone" | Personal git config does not belong in a prompt. |
| Mentions of personal dotfiles to avoid | "Never touch other worktrees, secrets, or dotfiles" | Same rule, no personal paths. |

## ✅ What stayed (the parts that made it work)

1. **Guardrails first**, phrased as prohibitions.
2. **Blueprint before code** — the 2D SVG with real meters prevented a week of "floating pieces".
3. **Test-first headless core** — the agent could prove correctness without a browser.
4. **Phases as outcomes** with explicit deliverables, not steps.
5. **A read-only adversarial critic with a numeric exit gate** — the loop knows when to stop.
