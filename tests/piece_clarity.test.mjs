import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from '../vendor/three/three.module.js';
import {
  CLARITY_MODES,
  CLASSIC_ROLE_GLYPHS,
  CLASSIC_ROLE_LETTERS,
  resolveClarityConfig,
  buildObsidianOrIvoryPedestal,
  buildPedestalRoleWreath,
  buildUniversalGlbRoleAddOn,
  buildFloatingRoleBillboard,
  buildZenithal2DClassicDisc,
  applyBlackTeamGlbContrast,
} from '../src/views/PieceClarityHelper.js';
import { CANONICAL_PIECE_HEIGHTS, PEDESTAL_RADIUS } from '../src/utils/glbGrounding.js';

const ROLES = ['k', 'q', 'r', 'b', 'n', 'p'];

test('PieceClarityHelper: CLARITY_MODES and resolveClarityConfig cover s1..s5 + off at 0°, 30°, and 45°', () => {
  assert.deepEqual(CLARITY_MODES, ['off', 's1', 's2', 's3', 's4', 's5']);

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

  // S2 (GLB 3D Add-Ons): shows universal 3D add-ons + obsidian contrast
  const s2Cfg = resolveClarityConfig('s2', 30, false, false);
  assert.equal(s2Cfg.showUniversal3dAddon, true);
  assert.equal(s2Cfg.useObsidianContrast, true);
  assert.equal(s2Cfg.showPedestalWreath, false);
  assert.equal(s2Cfg.showFloatingBillboard, false);

  // S3 (Obsidian Contrast): pure material & pedestal contrast only
  const s3Cfg = resolveClarityConfig('s3', 30, false, false);
  assert.equal(s3Cfg.useObsidianContrast, true);
  assert.equal(s3Cfg.showUniversal3dAddon, false);
  assert.equal(s3Cfg.showPedestalWreath, false);
  assert.equal(s3Cfg.showFloatingBillboard, false);

  // S4 (Pedestal Wreath + Floating Billboard)
  const s4Cfg = resolveClarityConfig('s4', 30, false, false);
  assert.equal(s4Cfg.showPedestalWreath, true);
  assert.equal(s4Cfg.showFloatingBillboard, true);
  assert.equal(s4Cfg.useObsidianContrast, true);
  assert.equal(s4Cfg.showUniversal3dAddon, false);

  // S5 (Hybrid Champion, default): combines S2 + S3 + S4 and auto-activates S1 zenith disc at < 20° (0°)
  const s5At0 = resolveClarityConfig('s5', 0, false, false);
  const s5At30 = resolveClarityConfig('s5', 30, false, false);
  assert.equal(s5At0.mode, 's5');
  assert.equal(s5At0.useObsidianContrast, true);
  assert.equal(s5At0.showUniversal3dAddon, true);
  assert.equal(s5At0.showPedestalWreath, true);
  assert.equal(s5At0.showFloatingBillboard, false, 'S5 at 0° hides vertical billboard when zenith 2D disc is active');
  assert.equal(s5At0.showZenith2dDisc, true, 'S5 at 0° must show Zenith 2D disc');
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

test('PieceClarityHelper: buildPedestalRoleWreath & buildUniversalGlbRoleAddOn create distinct 3D silhouettes for all 6 roles', () => {
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
      assert.equal(addon.position.y, h, `Addon for ${role} must be mounted at y = pieceHeight (${h}m)`);
      assert.ok(addon.children.length >= 2, `Addon for ${role} must have sculpted 3D children`);
    }
  }

  // Verify Knight ('n') Universal 3D Add-On is WIDE (>= 0.50m along X axis)
  const knightAddon = buildUniversalGlbRoleAddOn(THREE, 'n', 'w', CANONICAL_PIECE_HEIGHTS.n);
  knightAddon.updateMatrixWorld(true);
  const knightBox = new THREE.Box3().setFromObject(knightAddon);
  const knightWidthX = knightBox.max.x - knightBox.min.x;
  assert.ok(
    knightWidthX >= 0.50,
    `Knight 3D warhorse crest must be >= 0.50m wide along X, got ${knightWidthX.toFixed(3)}m`,
  );

  // Verify King ('k') Cross Pattee Finial rises +0.28m above pieceHeight with >= 0.26m wide arms
  const kingH = CANONICAL_PIECE_HEIGHTS.k;
  const kingAddon = buildUniversalGlbRoleAddOn(THREE, 'k', 'w', kingH);
  kingAddon.updateMatrixWorld(true);
  const kingBox = new THREE.Box3().setFromObject(kingAddon);
  assert.ok(
    kingBox.max.y >= kingH + 0.27,
    `King Cross Pattee finial must reach ~+0.28m above ${kingH}m, got ${kingBox.max.y.toFixed(3)}m`,
  );
  assert.ok(
    kingBox.max.x - kingBox.min.x >= 0.25,
    `King Cross Pattee arms must be >= 0.26m wide`,
  );

  // Verify Queen ('q') 8-Pearl Coronet has Ø >= 0.40m
  const queenAddon = buildUniversalGlbRoleAddOn(THREE, 'q', 'w', CANONICAL_PIECE_HEIGHTS.q);
  queenAddon.updateMatrixWorld(true);
  const queenBox = new THREE.Box3().setFromObject(queenAddon);
  assert.ok(
    queenBox.max.x - queenBox.min.x >= 0.40,
    `Queen 8-pearl coronet must span >= 0.40m, got ${(queenBox.max.x - queenBox.min.x).toFixed(3)}m`,
  );

  // Verify Rook ('r') 6-Merlon Battlement Turret Crown has Ø >= 0.42m
  const rookAddon = buildUniversalGlbRoleAddOn(THREE, 'r', 'w', CANONICAL_PIECE_HEIGHTS.r);
  rookAddon.updateMatrixWorld(true);
  const rookBox = new THREE.Box3().setFromObject(rookAddon);
  assert.ok(
    rookBox.max.x - rookBox.min.x >= 0.41,
    `Rook 6-merlon turret crown must span ~0.42m, got ${(rookBox.max.x - rookBox.min.x).toFixed(3)}m`,
  );
});

test('PieceClarityHelper: buildFloatingRoleBillboard & buildZenithal2DClassicDisc work in both headless Node and Canvas 2D contexts', () => {
  // 1. Headless mode (typeof document === 'undefined')
  for (const role of ROLES) {
    const h = CANONICAL_PIECE_HEIGHTS[role];
    const wBillboard = buildFloatingRoleBillboard(THREE, role, 'w', h);
    const bBillboard = buildFloatingRoleBillboard(THREE, role, 'b', h);
    assert.ok(wBillboard.isSprite);
    assert.ok(Math.abs(wBillboard.position.y - (h + 0.36)) < 1e-6);
    assert.ok(Math.abs(wBillboard.scale.x - 0.38) < 1e-6);
    assert.equal(wBillboard.userData.glyph, CLASSIC_ROLE_GLYPHS[role]);
    assert.equal(bBillboard.userData.letter, CLASSIC_ROLE_LETTERS[role]);

    const wDisc = buildZenithal2DClassicDisc(THREE, role, 'w', h);
    const bDisc = buildZenithal2DClassicDisc(THREE, role, 'b', h);
    assert.ok(wDisc.isMesh);
    assert.ok(Math.abs(wDisc.position.y - (h + 0.30)) < 1e-6);
    assert.equal(wDisc.userData.background, '#e8dec8');
    assert.equal(wDisc.userData.outerRing, '#2a1d08');
    assert.equal(wDisc.userData.innerRing, '#c69214');
    assert.equal(wDisc.userData.iconColor, '#070a10');
    assert.equal(bDisc.userData.background, '#090c14');
    assert.equal(bDisc.userData.outerRing, '#b388ff');
    assert.equal(bDisc.userData.innerRing, '#00e5ff');
    assert.equal(bDisc.userData.iconColor, '#ffffff');
  }

  // 2. Mock DOM Canvas 2D context to exercise drawTournamentChessIcon2D for all 6 roles
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
    for (const role of ROLES) {
      const disc = buildZenithal2DClassicDisc(THREE, role, 'b', 1.5);
      const sprite = buildFloatingRoleBillboard(THREE, role, 'w', 1.5);
      assert.equal(disc.material.map.userData.width, 512);
      assert.equal(sprite.material.map.userData.width, 256);
    }
    assert.ok(drawCalls.includes('fillText:♔K'));
    assert.ok(drawCalls.includes('fillText:♕Q'));
    assert.ok(drawCalls.includes('fillText:♖R'));
    assert.ok(drawCalls.includes('fillText:♗B'));
    assert.ok(drawCalls.includes('fillText:♘N'));
    assert.ok(drawCalls.includes('fillText:♙P'));
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
