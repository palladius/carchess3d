# 🏰🚽 CarChess3D — Daily UAT Playtest & Adversarial Critic Prompt

> **File location**: `etc/prompts/daily_uat_prompt.md`  
> **Target conversation title**: `"$YYMMDD Daily  UAT"` (e.g. `261011 Daily  UAT`)  
> **Model tier**: Gemini 4 / Pro (`--model=pro`)  
> **Cadence**: Daily at 08:00 Europe/Zurich  
> **Owner**: Riccardo (@palladius / RiccardinoCM26 🦖)

---

## 🎯 Mission

You are the **Daily UAT & Adversarial Playtest Agent** for **CarChess3D** (*Carlesso al Cesso* 🏰🚽).
Every morning, your job is to run unit tests, inspect git code changes since the previous run, simulate a playful human tester playing against **CPU Easy**, record a short gameplay movie (<1 min), audit all visual angles (checking for black screens and orientation glitches), and open or update a dedicated GitHub Issue titled:

```text
Gemini UAT $YYYYMMDD
```

tagged with the unique label **`gemini-uat`**.

---

## 📋 Execution Protocol

### Step 1: Unit Tests & Code Sanity
Run stdlib unit tests and asset/architecture checks:
```bash
just test
```
Verify that all 42 GLBs, character portraits, provenance models, and Node/Python test suites pass 100%.

### Step 2: Git Hygiene & Recent Commits Inspection
Inspect what has changed in the codebase over the last 24 hours:
```bash
git fetch --all --prune
git log -n 5 --oneline
git status
```
Note down any new commits, merges, or open GitHub Issues (`gh issue list --state open`).

### Step 3: Run the UAT Playtest & Video Recording
Run the automated Playwright/Chromium adversarial suite:
```bash
just daily-uat
```
*(Or directly: `UV_INDEX_URL="https://pypi.org/simple" uv run --with playwright --with pillow python3 scripts/daily_uat_playtest.py --publish-ghi`)*

This script automatically:
1. **Launches Headless Google Chrome** with WebGL and starts video recording (`record_video_dir`).
2. **Audits Piece Orientations**:
   - White pieces must face North (`homeYaw ≈ 3.142 rad` / 180° towards rank 8).
   - Black pieces must face South (`homeYaw ≈ 0.0 rad` / 0° towards rank 1).
   - Flags an immediate defect if pieces are facing the same direction.
3. **Audits Camera Angles for Black Screen Bugs**:
   - Clicks `#hud-flip-btn` (Inverti vista 180°): computes pixel luminance and contrast stddev to ensure the scene remains vibrantly lit and not pitch-black.
   - Clicks `#hud-top-btn` (Vista dall'alto): verifies top-down tactical framing is non-black.
4. **Adversarial UI Clicking**:
   - Toggles `#hud-skeletons-btn` (3D Articulated Skeletons).
   - Toggles `#hud-swamp-btn` (Ogre Swamp Moat party).
   - Opens and closes `#hud-matrix36-btn` (6×6 Battle Matrix modal with 36 video pairings).
   - Inspects `#hud-mode2-btn` (WOW Turntable & Arena) and returns to `#hud-mode1-btn`.
5. **Simulates a Human vs CPU Easy Match**:
   - Human plays White, CPU plays Black (`#hud-opponent-select` = `easy`).
   - Plays a sequence of moves (e.g. `e2->e4`, `g1->f3`, `d2->d4`, and tactical capture).
   - Measures CPU response latency (must be <1.5s).
   - Verifies capture cutscene, comic impact banner (`#hud-comic-banner`), and skip button (`#hud-skip-btn`).
6. **Encodes Short Match Movie (<1 min)**:
   - Generates `log/uat/uat_gameplay.mp4` and `log/uat/uat_gameplay.webm`.
   - Generates animated preview `log/uat/uat_gameplay.gif` for inline GitHub Issue rendering.
7. **Publishes / Updates GitHub Issue**:
   - Creates or updates issue `"Gemini UAT $YYYYMMDD"` with label `"gemini-uat"`.

---

## 🔍 Specific Defects to Hunt For

Always look out for subtle regressions:
1. **Orientation Glitches**: Are any pieces facing backwards or sideways? Are all pieces facing the same direction?
2. **Black Screen on Camera Flip**: Does inverting the camera to 180° cause the camera to be placed inside a tower or behind an opaque wall?
3. **CPU Freezes**: Does the Web Worker CPU reply within 1.5 seconds? Does it ever stop responding after a capture?
4. **Z-Fighting / Floating Pedestals**: Are pedestals grounded cleanly at `y = 0.0m`?
5. **Console Warnings**: Check for Three.js shader compile errors or asset 404s.

---

## 🛠️ How to Customize This Prompt

Riccardo can freely edit this file to:
- Add specific chess opening sequences to test (e.g. Sicilian Defense, Queen's Gambit).
- Add new UI buttons or views to click during the adversarial phase.
- Change the target opponent difficulty (e.g. test `cpuHard` or `hotseat`).
- Add assertions for specific 3D animations or sound effects.
