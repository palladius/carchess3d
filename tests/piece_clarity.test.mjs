import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from '../vendor/three/three.module.js';
import {
  CLARITY_MODES,
  CLASSIC_ROLE_GLYPHS,
  CLASSIC_ROLE_SOLID_GLYPHS,
  CLASSIC_ROLE_LETTERS,
  CLASSIC_ROLE_BRAILLE,
  ZENITH_DISC_BOARD_Y,
  resolveClarityConfig,
  buildObsidianOrIvoryPedestal,
  buildPedestalRoleWreath,
  buildUniversalGlbRoleAddOn,
  computeGroundedHeadAnchor,
  buildFloatingRoleBillboard,
  buildZenithal2DClassicDisc,
  updateRoleIcon2DLettersMode,
  applyBlackTeamGlbContrast,
} from '../src/views/PieceClarityHelper.js';
import { CANONICAL_PIECE_HEIGHTS, PEDESTAL_HEIGHT } from '../src/utils/glbGrounding.js';

const ROLES = ['k', 'q', 'r', 'b', 'n', 'p'];

test('PieceClarityHelper: CLARITY_MODES and resolveClarityConfig default to s2 and auto-toggle 2D medallions on 📐 2D', () => {
  assert.deepEqual(CLARITY_MODES, ['off', 's1', 's2', 's3', 's4', 's5']);
  assert.equal(ZENITH_DISC_BOARD_Y, 0.04);

  // Default mode when unspecified is 's2' (clean 3D head-mounted crowns + obsidian contrast, NO floating 2D badges)
  const defaultCfg = resolveClarityConfig();
  assert.equal(defaultCfg.mode, 's2');
  assert.equal(defaultCfg.useObsidianContrast, true);
  assert.equal(defaultCfg.showUniversal3dAddon, true);
  assert.equal(defaultCfg.showZenith2dDisc, false);
  assert.equal(defaultCfg.showPedestalWreath, false);
  assert.equal(defaultCfg.showFloatingBillboard, false);

  // Baseline 'off': all clarity features disabled
  const offCfg = resolveClarityConfig('off', 0, true, true);
  assert.equal(offCfg.mode, 'off');
  assert.equal(offCfg.showZenith2dDisc, false);
  assert.equal(offCfg.showUniversal3dAddon, false);
  assert.equal(offCfg.useObsidianContrast, false);
  assert.equal(offCfg.showPedestalWreath, false);
  assert.equal(offCfg.showFloatingBillboard, false);

  // S1 (Zenith 2D): shows 2D classic medallions at 0° AND 30° (< 35°), hides at 45° unless forced/topDown
  const s1At0 = resolveClarityConfig('s1', 0, false, false);
  const s1At30 = resolveClarityConfig('s1', 30, false, false);
  const s1At45 = resolveClarityConfig('s1', 45, false, false);
  const s1Forced = resolveClarityConfig('s1', 45, false, true);
  assert.equal(s1At0.showZenith2dDisc, true);
  assert.equal(s1At30.showZenith2dDisc, true);
  assert.equal(s1At45.showZenith2dDisc, false);
  assert.equal(s1Forced.showZenith2dDisc, true);
  assert.equal(s1At0.useObsidianContrast, true);

  // S2 (Default 3D: Head-Mounted 3D Crowns/Crests + Obsidian Contrast):
  // In 3D (topDownCamera = false): shows 1 head-mounted 3D crown, ZERO 2D discs/billboards
  // When pressing '📐 2D' (topDownCamera = true): auto-enables showZenith2dDisc and hides 3D crown
  const s2Cfg3d = resolveClarityConfig('s2', 30, false, false);
  const s2Cfg2d = resolveClarityConfig('s2', 30, false, true);
  assert.equal(s2Cfg3d.showUniversal3dAddon, true);
  assert.equal(s2Cfg3d.useObsidianContrast, true);
  assert.equal(s2Cfg3d.showZenith2dDisc, false);
  assert.equal(s2Cfg3d.showPedestalWreath, false);
  assert.equal(s2Cfg3d.showFloatingBillboard, false);
  assert.equal(s2Cfg2d.showZenith2dDisc, true, 'Pressing 📐 2D in S2 must toggle ON the 2D medallion');
  assert.equal(s2Cfg2d.showUniversal3dAddon, false, 'Pressing 📐 2D in S2 hides 3D add-on while in 2D view');

  // S3 (Obsidian Contrast): pure material & pedestal contrast in 3D, auto-toggles 2D disc when 📐 2D is pressed
  const s3Cfg = resolveClarityConfig('s3', 30, false, false);
  const s3Top = resolveClarityConfig('s3', 30, false, true);
  assert.equal(s3Cfg.useObsidianContrast, true);
  assert.equal(s3Cfg.showUniversal3dAddon, false);
  assert.equal(s3Cfg.showPedestalWreath, false);
  assert.equal(s3Cfg.showFloatingBillboard, false);
  assert.equal(s3Top.showZenith2dDisc, true);

  // S4 (Pedestal Wreath + Floating Billboard)
  const s4Cfg = resolveClarityConfig('s4', 30, false, false);
  assert.equal(s4Cfg.showPedestalWreath, true);
  assert.equal(s4Cfg.showFloatingBillboard, true);
  assert.equal(s4Cfg.useObsidianContrast, true);
  assert.equal(s4Cfg.showUniversal3dAddon, false);

  // S5 (Hybrid Full): combines S2 + S3 + S4 and auto-activates S1 zenith disc at < 20° (0°) or topDownCamera
  const s5At0 = resolveClarityConfig('s5', 0, false, false);
  const s5At30 = resolveClarityConfig('s5', 30, false, false);
  assert.equal(s5At0.mode, 's5');
  assert.equal(s5At0.useObsidianContrast, true);
  assert.equal(s5At0.showUniversal3dAddon, false, 'At 0° zenith view, 3D add-ons hide so 2D disc sits cleanly');
  assert.equal(s5At0.showFloatingBillboard, false, 'S5 at 0° hides vertical billboard when zenith 2D disc is active');
  assert.equal(s5At0.showZenith2dDisc, true, 'S5 at 0° must show Zenith 2D disc');
  assert.equal(s5At30.showUniversal3dAddon, true, 'S5 at 30° shows 3D crowns');
  assert.equal(s5At30.showPedestalWreath, true, 'S5 at 30° shows pedestal wreath');
  assert.equal(s5At30.showFloatingBillboard, true, 'S5 at 30° shows floating billboard');
  assert.equal(s5At30.showZenith2dDisc, false, 'S5 at 30° must keep 3D crowns visible');
});

test('PieceClarityHelper: buildObsidianOrIvoryPedestal eliminates ice-white topCyl on Black and scales Pawn by 0.86x', () => {
  const blackKingPed = buildObsidianOrIvoryPedestal(THREE, 'b', 'k', 0xffca28, true);
  const whiteKingPed = buildObsidianOrIvoryPedestal(THREE, 'w', 'k', 0xffca28, true);
  const blackPawnPed = buildObsidianOrIvoryPedestal(THREE, 'b', 'p', 0xffca28, true);
  const legacyBlackPed = buildObsidianOrIvoryPedestal(THREE, 'b', 'k', 0xffca28, false);

  // 1. Black Obsidian pedestal top plate, midCyl, and baseCyl must be pure matte obsidian (0x0d1017), NOT 0xdce7f7!
  assert.equal(blackKingPed.userData.topCyl.material.color.getHex(), 0x0d1017);
  assert.equal(blackKingPed.userData.midCyl.material.color.getHex(), 0x0d1017);
  assert.equal(blackKingPed.userData.baseCyl.material.color.getHex(), 0x0d1017);
  assert.equal(blackKingPed.userData.topCyl.material.roughness, 0.36);
  assert.equal(blackKingPed.userData.topCyl.material.metalness, 0.12);
  assert.equal(blackKingPed.userData.topCyl.material.emissive.getHex(), 0x03050a);
  assert.equal(blackKingPed.userData.topCyl.material.emissiveIntensity, 0.15);

  // Side trim rings on Black use Burnished Dark Bronze/Steel (0x4e5d6c) and Cobalt-Violet (0x7c4dff)
  assert.equal(blackKingPed.userData.lowerRing.material.color.getHex(), 0x4e5d6c);
  assert.equal(blackKingPed.userData.bandCyl.material.color.getHex(), 0x7c4dff);

  // 2. White Ivory pedestal uses Warm Ivory Marble (0xfffdf5) + Gleaming Royal Gold (0xffca28)
  assert.equal(whiteKingPed.userData.topCyl.material.color.getHex(), 0xfffdf5);
  assert.equal(whiteKingPed.userData.baseCyl.material.color.getHex(), 0xfffdf5);
  assert.equal(whiteKingPed.userData.lowerRing.material.color.getHex(), 0xffca28);
  assert.equal(whiteKingPed.userData.bandCyl.material.color.getHex(), 0xffca28);

  // 3. Pawn pedestal radius is scaled by 0.86x compared to major pieces
  assert.equal(blackKingPed.userData.radiusScale, 1.0);
  assert.equal(blackPawnPed.userData.radiusScale, 0.86);
  const kingBox = new THREE.Box3().setFromObject(blackKingPed);
  const pawnBox = new THREE.Box3().setFromObject(blackPawnPed);
  const kingWidth = kingBox.max.x - kingBox.min.x;
  const pawnWidth = pawnBox.max.x - pawnBox.min.x;
  assert.ok(
    Math.abs(pawnWidth / kingWidth - 0.86) < 0.02,
    `Expected Pawn pedestal width ratio ~0.86, got ${(pawnWidth / kingWidth).toFixed(3)}`,
  );
  assert.ok(Math.abs(kingBox.min.y) < 1e-6, 'Pedestal must be grounded strictly at y = 0.0m');

  // 4. Legacy ('off') baseline preserves original 0xdce7f7 for A/B comparison
  assert.equal(legacyBlackPed.userData.topCyl.material.color.getHex(), 0xdce7f7);
});

test('PieceClarityHelper: buildUniversalGlbRoleAddOn & computeGroundedHeadAnchor create sleek, zero-cube head-mounted crowns', () => {
  for (const role of ROLES) {
    for (const color of ['w', 'b']) {
      const h = CANONICAL_PIECE_HEIGHTS[role];
      const wreath = buildPedestalRoleWreath(THREE, role, color);
      const addon = buildUniversalGlbRoleAddOn(THREE, role, color, h);

      assert.equal(wreath.userData.isPedestalWreath, true);
      assert.equal(wreath.userData.pieceType, role);
      assert.ok(wreath.children.length >= 2, `Wreath for ${role} must have sculpted 3D children`);

      assert.equal(addon.userData.isUniversalRoleAddon, true);
      assert.equal(addon.userData.pieceType, role);
      assert.equal(addon.position.y, h, `Addon for ${role} defaults to y = pieceHeight (${h}m) before GLB head anchoring`);
      assert.ok(addon.children.length >= 2, `Addon for ${role} must have sculpted 3D children`);

      // Verify ZERO blocky BoxGeometry cubes are used in S2 head-mounted crowns!
      addon.traverse((child) => {
        if (child.isMesh && child.geometry) {
          assert.notEqual(
            child.geometry.type,
            'BoxGeometry',
            `S2 head-mounted crown for role '${role}' must use sleek sculpted geometry, never BoxGeometry`,
          );
        }
      });
    }
  }

  // Verify head-proportioned bounds and computeGroundedHeadAnchor seating directly on actual GLB head top
  const kingH = 1.184; // Actual grounded King Riccardo top Y
  const kingAddon = buildUniversalGlbRoleAddOn(THREE, 'k', 'w', kingH);
  kingAddon.updateMatrixWorld(true);
  const kingBox = new THREE.Box3().setFromObject(kingAddon);
  const kingSpanX = kingBox.max.x - kingBox.min.x;
  assert.ok(
    kingSpanX >= 0.24 && kingSpanX <= 0.36,
    `King head-proportioned imperial crown must span ~0.28m, got ${kingSpanX.toFixed(3)}m`,
  );
  assert.ok(
    kingBox.max.y >= kingH + 0.21,
    `King imperial arched crown + cross finial must rise ~0.23m above head, got ${(kingBox.max.y - kingH).toFixed(3)}m`,
  );

  const queenH = 1.141; // Actual grounded Queen Kate top Y
  const queenAddon = buildUniversalGlbRoleAddOn(THREE, 'q', 'w', queenH);
  queenAddon.updateMatrixWorld(true);
  const queenBox = new THREE.Box3().setFromObject(queenAddon);
  const queenSpanX = queenBox.max.x - queenBox.min.x;
  assert.ok(
    queenSpanX >= 0.24 && queenSpanX <= 0.36,
    `Queen 8-spire tiara coronet must span ~0.29m, got ${queenSpanX.toFixed(3)}m`,
  );

  // Verify computeGroundedHeadAnchor finds the true top of a grounded mesh
  const mockHolder = new THREE.Group();
  const bodyMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.22, 0.96, 16),
    new THREE.MeshBasicMaterial(),
  );
  bodyMesh.position.set(0.01, PEDESTAL_HEIGHT + 0.48, -0.015);
  mockHolder.add(bodyMesh);
  const anchor = computeGroundedHeadAnchor(
    THREE,
    mockHolder,
    { finalMaxY: PEDESTAL_HEIGHT + 0.96 },
    'k',
  );
  assert.ok(Math.abs(anchor.y - (PEDESTAL_HEIGHT + 0.96)) < 1e-3);
  assert.ok(Math.abs(anchor.x - 0.01) < 0.05);
  assert.ok(Math.abs(anchor.z - -0.015) < 0.05);
});

test('PieceClarityHelper: buildZenithal2DClassicDisc sits at board level (y=0.04m) and renders simplified single icon by default', () => {
  // 1. Headless mode (typeof document === 'undefined')
  for (const role of ROLES) {
    const h = CANONICAL_PIECE_HEIGHTS[role];
    const wBillboard = buildFloatingRoleBillboard(THREE, role, 'w', h);
    const bBillboard = buildFloatingRoleBillboard(THREE, role, 'b', h);
    assert.ok(wBillboard.isSprite);
    assert.ok(Math.abs(wBillboard.position.y - (h + 0.36)) < 1e-6);
    assert.ok(Math.abs(wBillboard.scale.x - 0.38) < 1e-6);
    assert.equal(wBillboard.userData.glyph, CLASSIC_ROLE_GLYPHS[role]);
    assert.equal(wBillboard.userData.solidGlyph, CLASSIC_ROLE_SOLID_GLYPHS[role]);
    assert.equal(bBillboard.userData.letter, CLASSIC_ROLE_LETTERS[role]);
    assert.equal(bBillboard.userData.braille, CLASSIC_ROLE_BRAILLE[role]);
    assert.equal(wBillboard.userData.showRoleLetters, false);

    const wDisc = buildZenithal2DClassicDisc(THREE, role, 'w', h);
    const bDisc = buildZenithal2DClassicDisc(THREE, role, 'b', h);
    assert.ok(wDisc.isMesh);
    // CRITICAL FOR SQUARE ALIGNMENT: Zenith 2D disc sits at board level (0.04m), NOT pieceHeight + 0.30!
    assert.ok(
      Math.abs(wDisc.position.y - ZENITH_DISC_BOARD_Y) < 1e-6,
      `Expected Zenith 2D disc at board level y=${ZENITH_DISC_BOARD_Y}m for zero parallax offset, got ${wDisc.position.y}`,
    );
    assert.equal(wDisc.userData.background, '#e8dec8');
    assert.equal(wDisc.userData.outerRing, '#2a1d08');
    assert.equal(wDisc.userData.innerRing, '#c69214');
    assert.equal(wDisc.userData.iconColor, '#070a10');
    assert.equal(bDisc.userData.background, '#090c14');
    assert.equal(bDisc.userData.outerRing, '#b388ff');
    assert.equal(bDisc.userData.innerRing, '#00e5ff');
    assert.equal(bDisc.userData.iconColor, '#ffffff');
  }

  // 2. Mock DOM Canvas 2D context to verify simplified single-icon default vs accessibility letters+Braille mode
  const drawCalls = [];
  const mockCtx2D = {
    save() {},
    restore() {},
    clearRect() {},
    fillRect() {
      drawCalls.push('fillRect');
    },
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    quadraticCurveTo() {},
    arc() {
      drawCalls.push('arc');
    },
    fill() {
      drawCalls.push('fill');
    },
    stroke() {
      drawCalls.push('stroke');
    },
    translate() {},
    strokeText(txt) {
      drawCalls.push(`strokeText:${txt}`);
    },
    fillText(txt) {
      drawCalls.push(`fillText:${txt}`);
    },
  };
  globalThis.document = {
    createElement(tag) {
      assert.equal(tag, 'canvas');
      return {
        width: 0,
        height: 0,
        getContext(type) {
          return type === '2d' ? mockCtx2D : null;
        },
      };
    },
  };
  try {
    // Default (showRoleLetters = false): ONLY the single centered classic icon (♚ ♛ ♜ ♝ ♞ ♟), NO letters!
    for (const role of ROLES) {
      const disc = buildZenithal2DClassicDisc(THREE, role, 'b', 1.5, false);
      const sprite = buildFloatingRoleBillboard(THREE, role, 'w', 1.5, false);
      assert.equal(disc.material.map.userData.width, 512);
      assert.equal(sprite.material.map.userData.width, 256);
    }
    assert.ok(drawCalls.includes('fillText:♚'));
    assert.ok(drawCalls.includes('fillText:♛'));
    assert.ok(drawCalls.includes('fillText:♜'));
    assert.ok(drawCalls.includes('fillText:♝'));
    assert.ok(drawCalls.includes('fillText:♞'));
    assert.ok(drawCalls.includes('fillText:♟'));
    assert.ok(!drawCalls.some((c) => c.includes('K ⠇')), 'Letters/Braille must be OFF by default');

    // Toggle accessibility letters + Braille ON via updateRoleIcon2DLettersMode
    const kingDisc = buildZenithal2DClassicDisc(THREE, 'k', 'w', 1.85, false);
    updateRoleIcon2DLettersMode(kingDisc, true);
    assert.equal(kingDisc.userData.showRoleLetters, true);
    assert.ok(drawCalls.includes('fillText:K ⠇'), 'Accessibility toggle must render role letter + Braille');
  } finally {
    delete globalThis.document;
  }
});

test('PieceClarityHelper: applyBlackTeamGlbContrast darkens textured and untextured Black GLB materials', () => {
  // 1. Textured Black GLB material (Carlesso + classic Re/Cavallo + swamp Asinello)
  const dummyTex = new THREE.Texture();
  const texBlackMat = new THREE.MeshStandardMaterial({
    map: dummyTex,
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveMap: dummyTex,
    emissiveIntensity: 0.32,
  });
  applyBlackTeamGlbContrast(texBlackMat, false, true);
  assert.equal(texBlackMat.color.getHex(), 0x48506a);
  assert.equal(texBlackMat.emissive.getHex(), 0x140c2e);
  assert.equal(texBlackMat.emissiveMap, null);
  assert.equal(texBlackMat.emissiveIntensity, 0.14);

  // 2. Untextured faction_primary and faction_trim for Black
  const primaryMat = new THREE.MeshStandardMaterial({ name: 'faction_primary', color: 0xffffff });
  const trimMat = new THREE.MeshStandardMaterial({ name: 'faction_trim', color: 0xffffff });
  applyBlackTeamGlbContrast(primaryMat, false, true);
  applyBlackTeamGlbContrast(trimMat, false, true);
  assert.equal(primaryMat.color.getHex(), 0x0d1017);
  assert.equal(trimMat.color.getHex(), 0x7c4dff);

  // 3. Light porcelain / cream / stone accent materials on Black pieces are darkened by 0.38x
  for (const name of ['accent_porcelain', 'linen_cream', 'burro_muzzle', 'tower_stone']) {
    const mat = new THREE.MeshStandardMaterial({ name, color: 0xffffff });
    applyBlackTeamGlbContrast(mat, false, true);
    assert.ok(
      Math.abs(mat.color.r - 0.38) < 0.02,
      `Expected ${name} to be darkened by 0.38x, got r=${mat.color.r.toFixed(3)}`,
    );
  }
});

test('PieceView integration: wires PieceClarityHelper, CLARITY_MODE_CHANGED, and uIsBlackObsidian fragment clamp', () => {
  const pieceViewSrc = fs.readFileSync(
    path.resolve(process.cwd(), 'src/views/PieceView.js'),
    'utf8',
  );
  assert.match(pieceViewSrc, /from '\.\/PieceClarityHelper\.js'/);
  assert.match(pieceViewSrc, /CLARITY_MODE_CHANGED/);
  assert.match(pieceViewSrc, /setClarityMode\(/);
  assert.match(pieceViewSrc, /uIsBlackObsidian/);
  assert.match(pieceViewSrc, /#include <dithering_fragment>/);
  assert.match(pieceViewSrc, /updateClarityVisibilities\(/);
});
