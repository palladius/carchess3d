# 🏰 CARCHESS3D — Autonomous Full 3D Polish & In-Game Integration Goal

## Goal Overview
Execute end-to-end polish, modular weapons, and in-game gameplay integration for all 3D Carlesso family pieces, operating fully autonomously with subagents and zero Jerry-work.

---

## 5 Execution Pillars

### Pillar 1: In-Game 3D Integration & HUD Variant Selectors
- Update `src/core/Registry.js` and `src/managers/PieceManager.js`:
  - Register all canonical and remastered models in `CHARACTER_REGISTRY`:
    - Queen Kate: `young` (`queen-kate.glb`) & `wedding` (`queen-kate-wedding2016-remastered.glb`).
    - Bishop Ale: `hat` (`bishop-ale-1.glb`), `astrolabe` (`bishop-ale-2-remastered.glb`), and `rigged` (`bishop-ale-rigged.glb`).
  - Wire the HUD setup modal (`src/listeners/HudListener.js`) so players can choose their preferred skin directly in the game options.
  - Verify that running the game on `http://localhost:8080/` loads the selected 3D GLB models cleanly onto the 8x8 chessboard.

### Pillar 2: Knight Sebastian Modular Weapons (Seby 4-Weapons Suite)
- Build `tools/model-pipeline/seby/assemble_modular_seby.py` using headless Blender:
  - Base: clean golden-armored Sebastian on charger horse (`assets/models/knight-seby.glb`).
  - Attachments for his raised fist:
    1. **Alabarda Reale** (`assets/models/knight-seby-halberd.glb`): Golden halberd with sapphire blade edge.
    2. **Spada Laser / Beam Saber** (`assets/models/knight-seby-lightsaber.glb`): Glowing blue plasma saber.
    3. **Sigillo dell'Acquario** (`assets/models/knight-seby-aurora.glb`): Crystalline ice urn / aurora energy orb.
  - Generate 360° contact sheets and add to `docs/models-provenance.yaml`.

### Pillar 3: King Riccardo Polish & Royal Crown Jewel Refinement
- Build `tools/model-pipeline/king/clean_king_riccardo.py`:
  - Apply selective surface smoothing to the ermine cloak and royal robe.
  - Enhance scepter finial and royal orb crosses to be razor-sharp.
  - Verify watertightness, zero stray islands, and ground plane at $Z=0$.
  - Export `assets/models/king-riccardo-remastered.glb` and audit with `critic_vlm.py`.

### Pillar 4: Central QA Scoreboard & Refinement Automation
- Run `tools/model-pipeline/critic/refine_loop.py` on any model scoring below 7.0 in `docs/qa-scores.yaml`.
- Update `docs/models-provenance.yaml` with all MD5 checksums.

### Pillar 5: Continuous Verification, Version Bumps, and Documentation
- Run `just test` after every major milestone (all Node suites, Python checks, IP denylist, GLB headers).
- Maintain version bumps in `VERSION` and comprehensive entries in `CHANGELOG.md` and `tools/model-pipeline/RUNNING_DOC.md`.
- Keep git moving forward cleanly with descriptive commit messages.
