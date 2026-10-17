/**
 * @fileoverview 3D & 2D Piece Visual Recognition & Clarity Engine (`PieceClarityHelper`).
 *
 * Implements 5 combinable visual recognition solutions (`s1..s5` + `off` baseline)
 * to eliminate visual/cognitive fatigue when distinguishing White vs Black pieces
 * and the 6 chess roles (`k, q, r, b, n, p`) from overhead (`0°` vertical) and
 * semi-high (`30°` from vertical) camera angles across all 3 families
 * (`carlesso`, `swamp`, `classic`):
 *
 * - `s2` (`glb_addons`, DEFAULT in 3D): Single Sleek Head-Seated 3D Role Crown/Crest
 *   (King Imperial Arched Diadem + Flared Cross Pattee, Queen 8-Spire Tiara Coronet + Delicate Pearls,
 *   Rook Curved 6-Merlon Mural Crown, Bishop Mitre + Pastoral Cross, Knight Swept Bilateral Warhorse Crest,
 *   Pawn Staunton Finial Sphere + Tapered Pike) juxtaposed directly on each character's grounded head (`headTopY`),
 *   combined with True Matte Obsidian Black vs Warm Ivory White contrast (`s3`).
 *   Pressing `📐 2D` (`topDownCamera = true`) automatically toggles ON the board-level (`y = 0.04m`)
 *   100% square-aligned 2D Classic Tournament Medallions!
 * - `s1` (`zenith2d`): Automatic / Toggled Board-Level 2D Classic B/W Tournament Medallions (`0°..35°` or `2D`).
 * - `s3` (`obsidian_contrast`): True Deep Matte Obsidian Black (`0x0d1017` + Cobalt-Violet `0x7c4dff`)
 *   vs Warm Ivory Marble White (`0xfffdf5` + Royal Gold `0xffca28`) on pedestals & GLB materials.
 * - `s4` (`wreath_billboard`): Sculpted 3D Pedestal Role Wreath (`y = 0.04..0.24m`) + Floating 2D Role Crest.
 * - `s5` (`hybrid_champion`): All-in combination of `s2 + s3 + s4` with automatic `s1` below `20°`.
 * - `off`: Legacy baseline for comparison.
 */

import {
  CANONICAL_PIECE_HEIGHTS,
  PEDESTAL_RADIUS,
  PEDESTAL_HEIGHT,
} from '../utils/glbGrounding.js';

export const CLARITY_MODES = Object.freeze(['off', 's1', 's2', 's3', 's4', 's5']);

export const CLASSIC_ROLE_GLYPHS = Object.freeze({
  k: '♔',
  q: '♕',
  r: '♖',
  b: '♗',
  n: '♘',
  p: '♙',
});

export const CLASSIC_ROLE_SOLID_GLYPHS = Object.freeze({
  k: '♚',
  q: '♛',
  r: '♜',
  b: '♝',
  n: '♞',
  p: '♟',
});

export const CLASSIC_ROLE_LETTERS = Object.freeze({
  k: 'K',
  q: 'Q',
  r: 'R',
  b: 'B',
  n: 'N',
  p: 'P',
});

export const CLASSIC_ROLE_BRAILLE = Object.freeze({
  k: '⠇',
  q: '⠟',
  r: '⠗',
  b: '⠃',
  n: '⠝',
  p: '⠏',
});

/** Board-level Y elevation for 2D Zenithal Medallions (`0.04m` = zero perspective parallax offset!) */
export const ZENITH_DISC_BOARD_Y = 0.04;

const LIGHT_ACCENT_MATERIAL_NAMES = new Set([
  'accent_porcelain',
  'linen_cream',
  'burro_muzzle',
  'tower_stone',
  'skin_light',
  'ivory',
  'white',
]);

/**
 * Resolves the active clarity configuration flags for a given clarity mode and camera polar angle.
 *
 * - Default mode is `'s2'` (Single sleek head-mounted 3D crown + Obsidian/Ivory contrast; zero 2D clutter in 3D).
 * - Whenever `topDownCamera` (`📐 2D` button) or `force2dIcons` is active in any non-`'off'` mode,
 *   `showZenith2dDisc` is automatically `true` (and 3D crowns/wreaths/billboards hide so the 2D medallion
 *   sits flat on the board square with 100% alignment).
 *
 * @param {string} [mode='s2'] - `'off' | 's1' | 's2' | 's3' | 's4' | 's5'`
 * @param {number} [polarAngleDeg=45] - Camera polar angle in degrees from vertical zenith (`0°` = top-down)
 * @param {boolean} [topDownCamera=false] - Whether HUD top-down `2D` camera mode is active
 * @param {boolean} [force2dIcons=false] - Whether 2D icons are explicitly forced on
 * @returns {{
 *   mode: string,
 *   showZenith2dDisc: boolean,
 *   showUniversal3dAddon: boolean,
 *   useObsidianContrast: boolean,
 *   showPedestalWreath: boolean,
 *   showFloatingBillboard: boolean,
 *   zenithBlend: number
 * }}
 */
export function resolveClarityConfig(
  mode = 's2',
  polarAngleDeg = 45,
  topDownCamera = false,
  force2dIcons = false,
) {
  const raw = String(mode || 's2').trim().toLowerCase();
  const normMode = CLARITY_MODES.includes(raw) ? raw : 's2';
  const angle = Number.isFinite(polarAngleDeg) ? Math.max(0, polarAngleDeg) : 45;
  const isTopDown = Boolean(topDownCamera);
  const isForced2D = Boolean(force2dIcons);

  if (normMode === 'off') {
    return {
      mode: 'off',
      showZenith2dDisc: false,
      showUniversal3dAddon: false,
      useObsidianContrast: false,
      showPedestalWreath: false,
      showFloatingBillboard: false,
      zenithBlend: 0,
    };
  }

  if (normMode === 's1') {
    const showDisc = angle < 35 || isTopDown || isForced2D;
    const zenithBlend =
      isTopDown || isForced2D ? 1.0 : Math.max(0, Math.min(1, (35 - angle) / 25));
    return {
      mode: 's1',
      showZenith2dDisc: showDisc,
      showUniversal3dAddon: false,
      useObsidianContrast: true,
      showPedestalWreath: false,
      showFloatingBillboard: false,
      zenithBlend,
    };
  }

  if (normMode === 's2') {
    const showDisc = isTopDown || isForced2D;
    return {
      mode: 's2',
      showZenith2dDisc: showDisc,
      showUniversal3dAddon: !showDisc,
      useObsidianContrast: true,
      showPedestalWreath: false,
      showFloatingBillboard: false,
      zenithBlend: showDisc ? 1.0 : 0,
    };
  }

  if (normMode === 's3') {
    const showDisc = isTopDown || isForced2D;
    return {
      mode: 's3',
      showZenith2dDisc: showDisc,
      showUniversal3dAddon: false,
      useObsidianContrast: true,
      showPedestalWreath: false,
      showFloatingBillboard: false,
      zenithBlend: showDisc ? 1.0 : 0,
    };
  }

  if (normMode === 's4') {
    const showDisc = isTopDown || isForced2D;
    return {
      mode: 's4',
      showZenith2dDisc: showDisc,
      showUniversal3dAddon: false,
      useObsidianContrast: true,
      showPedestalWreath: !showDisc,
      showFloatingBillboard: !showDisc,
      zenithBlend: showDisc ? 1.0 : 0,
    };
  }

  // 's5' (Hybrid All-In)
  const showDisc = angle < 20 || isTopDown || isForced2D;
  const zenithBlend =
    isTopDown || isForced2D ? 1.0 : Math.max(0, Math.min(1, (24 - angle) / 16));
  return {
    mode: 's5',
    showZenith2dDisc: showDisc,
    showUniversal3dAddon: !showDisc,
    useObsidianContrast: true,
    showPedestalWreath: !showDisc,
    showFloatingBillboard: !showDisc,
    zenithBlend,
  };
}

/**
 * Builds the Sculpted 3D Faction Pedestal (`y = 0.00..0.22m`) with True Obsidian vs Warm Ivory contrast:
 * - When `useObsidianContrast === true` and `color === 'b'`:
 *   Top plate (`topCyl`), `midCyl`, and `baseCyl` use Deep Matte Obsidian (`0x0d1017`, roughness `0.36`,
 *   metalness `0.12`, emissive `0x03050a`, emissiveIntensity `0.15`) — ZERO `0xdce7f7` white/silver on top!
 *   Side trim rings (`lowerRing`, `bandCyl`) use Burnished Dark Bronze/Steel (`0x4e5d6c`) and
 *   vibrant Cobalt-Violet (`0x7c4dff`).
 * - When `color === 'w'`:
 *   Warm Ivory Marble (`0xfffdf5`, emissive `0x3a2e14`, emissiveIntensity `0.28`) + Gleaming Royal Gold (`0xffca28`).
 * - Pawns (`pieceType === 'p'`) have their X/Z radius scaled by `0.86` for a distinctly smaller footprint.
 *
 * @param {typeof import('three')} THREE
 * @param {'w'|'b'} color
 * @param {string} [pieceType='p']
 * @param {number} [accentColor=0xe6b84a]
 * @param {boolean} [useObsidianContrast=true]
 * @returns {import('three').Group}
 */
export function buildObsidianOrIvoryPedestal(
  THREE,
  color = 'w',
  pieceType = 'p',
  accentColor = 0xe6b84a,
  useObsidianContrast = true,
) {
  const isWhite = String(color || 'w').toLowerCase() !== 'b';
  const type = String(pieceType || 'p').toLowerCase();
  const radiusScale = useObsidianContrast && type === 'p' ? 0.86 : 1.0;
  const rBase = PEDESTAL_RADIUS * radiusScale;

  const pedGroup = new THREE.Group();
  pedGroup.name = `FactionPedestal_${isWhite ? 'White' : 'Black'}_${type}`;

  let marbleMat;
  let topPlateMat;
  let lowerTrimMat;
  let bandTrimMat;

  if (!useObsidianContrast) {
    // Legacy baseline ('off')
    marbleMat = new THREE.MeshStandardMaterial({
      color: isWhite ? 0xfcf6e8 : 0x1a2030,
      roughness: isWhite ? 0.24 : 0.22,
      metalness: isWhite ? 0.08 : 0.25,
      emissive: isWhite ? 0x261d0e : 0x0b1020,
      emissiveIntensity: 0.22,
    });
    lowerTrimMat = new THREE.MeshStandardMaterial({
      color: isWhite ? 0xffd54f : 0xdce7f7,
      roughness: isWhite ? 0.28 : 0.26,
      metalness: 0.38,
      emissive: isWhite ? 0x6e4b08 : 0x2c3e5e,
      emissiveIntensity: 0.42,
    });
    topPlateMat = lowerTrimMat;
    bandTrimMat = new THREE.MeshStandardMaterial({
      color: accentColor || (isWhite ? 0xffca28 : 0x7c4dff),
      roughness: 0.28,
      metalness: 0.35,
      emissive: accentColor || 0x222222,
      emissiveIntensity: 0.36,
    });
  } else if (isWhite) {
    // White Team: Warm Ivory Marble (0xfffdf5) + Gleaming Royal Gold (0xffca28) trim rings
    marbleMat = new THREE.MeshStandardMaterial({
      color: 0xfffdf5,
      roughness: 0.22,
      metalness: 0.06,
      emissive: 0x3a2e14,
      emissiveIntensity: 0.28,
    });
    topPlateMat = marbleMat;
    lowerTrimMat = new THREE.MeshStandardMaterial({
      color: 0xffca28,
      roughness: 0.24,
      metalness: 0.45,
      emissive: 0x6e4b08,
      emissiveIntensity: 0.38,
    });
    bandTrimMat = new THREE.MeshStandardMaterial({
      color: 0xffca28,
      roughness: 0.22,
      metalness: 0.48,
      emissive: accentColor || 0x6e4b08,
      emissiveIntensity: 0.36,
    });
  } else {
    // Black Team: Deep Matte Obsidian (0x0d1017) on baseCyl, midCyl, AND topCyl!
    // Side trim rings use Burnished Dark Bronze/Steel (0x4e5d6c) & Cobalt-Violet (0x7c4dff).
    marbleMat = new THREE.MeshStandardMaterial({
      color: 0x0d1017,
      roughness: 0.36,
      metalness: 0.12,
      emissive: 0x03050a,
      emissiveIntensity: 0.15,
    });
    topPlateMat = marbleMat;
    lowerTrimMat = new THREE.MeshStandardMaterial({
      color: 0x4e5d6c,
      roughness: 0.32,
      metalness: 0.42,
      emissive: 0x101824,
      emissiveIntensity: 0.22,
    });
    bandTrimMat = new THREE.MeshStandardMaterial({
      color: 0x7c4dff,
      roughness: 0.28,
      metalness: 0.38,
      emissive: 0x311b92,
      emissiveIntensity: 0.38,
    });
  }

  // Bottom plinth (y = 0.00 .. 0.08m, strictly min.y = 0.0)
  const h1 = 0.08;
  const baseCyl = new THREE.Mesh(
    new THREE.CylinderGeometry(rBase * 0.95, rBase, h1, 28),
    marbleMat,
  );
  baseCyl.name = 'PedestalBase';
  baseCyl.position.y = h1 * 0.5;
  baseCyl.castShadow = true;
  baseCyl.receiveShadow = true;
  pedGroup.add(baseCyl);

  // Lower metallic trim ring (y = 0.08m)
  const lowerRing = new THREE.Mesh(
    new THREE.CylinderGeometry(rBase * 0.97, rBase * 0.97, 0.024, 28),
    lowerTrimMat,
  );
  lowerRing.name = 'PedestalLowerRing';
  lowerRing.position.y = 0.08;
  lowerRing.castShadow = true;
  pedGroup.add(lowerRing);

  // Mid tapered cushion (y = 0.08 .. 0.17m)
  const h2 = 0.09;
  const midCyl = new THREE.Mesh(
    new THREE.CylinderGeometry(rBase * 0.78, rBase * 0.92, h2, 28),
    marbleMat,
  );
  midCyl.name = 'PedestalMid';
  midCyl.position.y = 0.08 + h2 * 0.5;
  midCyl.castShadow = true;
  midCyl.receiveShadow = true;
  pedGroup.add(midCyl);

  // Faction/Role band ring (y = 0.17 .. 0.19m)
  const bandCyl = new THREE.Mesh(
    new THREE.CylinderGeometry(rBase * 0.81, rBase * 0.81, 0.022, 28),
    bandTrimMat,
  );
  bandCyl.name = 'PedestalBand';
  bandCyl.position.y = 0.18;
  pedGroup.add(bandCyl);

  // Top stage plate (y = 0.18 .. 0.22m = PEDESTAL_HEIGHT)
  const h3 = 0.04;
  const topCyl = new THREE.Mesh(
    new THREE.CylinderGeometry(rBase * 0.84, rBase * 0.78, h3, 28),
    topPlateMat,
  );
  topCyl.name = 'PedestalTop';
  topCyl.position.y = PEDESTAL_HEIGHT - h3 * 0.5;
  topCyl.castShadow = true;
  topCyl.receiveShadow = true;
  pedGroup.add(topCyl);

  pedGroup.userData = {
    isPedestal: true,
    color: isWhite ? 'w' : 'b',
    pieceType: type,
    radiusScale,
    useObsidianContrast,
    baseCyl,
    lowerRing,
    midCyl,
    bandCyl,
    topCyl,
  };

  return pedGroup;
}

/**
 * Builds the Sculpted 3D Pedestal Role Wreath (`y = 0.04..0.24m`) around the pedestal perimeter (`s4`/`s5`).
 *
 * @param {typeof import('three')} THREE
 * @param {string} pieceType - `'k' | 'q' | 'r' | 'b' | 'n' | 'p'`
 * @param {'w'|'b'} color
 * @returns {import('three').Group}
 */
export function buildPedestalRoleWreath(THREE, pieceType = 'p', color = 'w') {
  const type = String(pieceType || 'p').toLowerCase();
  const isWhite = String(color || 'w').toLowerCase() !== 'b';

  const wreath = new THREE.Group();
  wreath.name = `PedestalRoleWreath_${isWhite ? 'w' : 'b'}_${type}`;

  const primaryMat = new THREE.MeshStandardMaterial({
    color: isWhite ? 0xffca28 : 0x161229,
    roughness: 0.25,
    metalness: 0.55,
    emissive: isWhite ? 0x6e4b08 : 0x1f0d3d,
    emissiveIntensity: 0.36,
  });

  const accentMat = new THREE.MeshStandardMaterial({
    color: isWhite ? 0xfffdf5 : 0x7c4dff,
    roughness: 0.20,
    metalness: 0.38,
    emissive: isWhite ? 0xffd54f : 0x4a148c,
    emissiveIntensity: 0.46,
  });

  if (type === 'k') {
    const collar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.39, 0.41, 0.075, 8),
      primaryMat,
    );
    collar.position.y = 0.11;
    wreath.add(collar);

    const dirs = [
      { x: 0, z: -0.41, rotY: 0 },
      { x: 0, z: 0.41, rotY: Math.PI },
      { x: 0.41, z: 0, rotY: Math.PI * 0.5 },
      { x: -0.41, z: 0, rotY: -Math.PI * 0.5 },
    ];
    for (const d of dirs) {
      const crossGrp = new THREE.Group();
      crossGrp.position.set(d.x, 0.15, d.z);
      crossGrp.rotation.y = d.rotY;
      const vBar = new THREE.Mesh(new THREE.ConeGeometry(0.036, 0.14, 4), accentMat);
      const hBar = new THREE.Mesh(new THREE.ConeGeometry(0.036, 0.14, 4), accentMat);
      hBar.rotation.z = Math.PI * 0.5;
      crossGrp.add(vBar, hBar);
      wreath.add(crossGrp);
    }
  } else if (type === 'q') {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.38, 0.032, 12, 28),
      primaryMat,
    );
    ring.rotation.x = Math.PI * 0.5;
    ring.position.y = 0.11;
    wreath.add(ring);

    const pointGeo = new THREE.ConeGeometry(0.042, 0.13, 12);
    const pearlGeo = new THREE.SphereGeometry(0.034, 14, 14);
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const cx = Math.cos(ang);
      const sz = Math.sin(ang);

      const spike = new THREE.Mesh(pointGeo, primaryMat);
      spike.position.set(cx * 0.39, 0.15, sz * 0.39);
      spike.rotation.z = -cx * 0.38;
      spike.rotation.x = sz * 0.38;
      wreath.add(spike);

      const pearl = new THREE.Mesh(pearlGeo, accentMat);
      pearl.position.set(cx * 0.41, 0.21, sz * 0.41);
      wreath.add(pearl);
    }
  } else if (type === 'r') {
    const wall = new THREE.Mesh(
      new THREE.CylinderGeometry(0.385, 0.405, 0.11, 24),
      primaryMat,
    );
    wall.position.y = 0.105;
    wreath.add(wall);

    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      const merlon = new THREE.Mesh(
        new THREE.CylinderGeometry(0.41, 0.40, 0.12, 10, 1, false, ang - 0.24, 0.48),
        accentMat,
      );
      merlon.position.y = 0.165;
      wreath.add(merlon);
    }
  } else if (type === 'b') {
    const archGeo = new THREE.ConeGeometry(0.058, 0.16, 12);
    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * Math.PI * 2 + Math.PI * 0.25;
      const arch = new THREE.Mesh(archGeo, primaryMat);
      arch.position.set(Math.cos(ang) * 0.39, 0.15, Math.sin(ang) * 0.39);
      wreath.add(arch);
    }
    for (const zSign of [-1, 1]) {
      const crossGrp = new THREE.Group();
      crossGrp.position.set(0, 0.16, zSign * 0.40);
      const b1 = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.15, 8), accentMat);
      b1.rotation.z = 0.35;
      const b2 = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.12, 8), accentMat);
      b2.rotation.z = 0.35 + Math.PI * 0.5;
      crossGrp.add(b1, b2);
      wreath.add(crossGrp);
    }
  } else if (type === 'n') {
    const horseshoe = new THREE.Mesh(
      new THREE.TorusGeometry(0.39, 0.042, 12, 28, Math.PI * 1.45),
      primaryMat,
    );
    horseshoe.rotation.x = Math.PI * 0.5;
    horseshoe.rotation.z = -Math.PI * 0.225;
    horseshoe.position.y = 0.11;
    wreath.add(horseshoe);

    for (const xSign of [-1, 1]) {
      const finGrp = new THREE.Group();
      finGrp.position.set(xSign * 0.42, 0.16, 0);
      const neck = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.14, 12), accentMat);
      neck.rotation.z = -xSign * 0.35;
      const snout = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.11, 12), primaryMat);
      snout.rotation.x = Math.PI * 0.45;
      snout.position.set(xSign * 0.02, 0.03, 0.05);
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.08, 10), accentMat);
      ear.position.set(0, 0.09, -0.01);
      finGrp.add(neck, snout, ear);
      wreath.add(finGrp);
    }
  } else {
    const guardRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.032, 12, 24),
      primaryMat,
    );
    guardRing.rotation.x = Math.PI * 0.5;
    guardRing.position.y = 0.10;
    wreath.add(guardRing);

    const chevron = new THREE.Mesh(
      new THREE.ConeGeometry(0.062, 0.15, 12),
      accentMat,
    );
    chevron.rotation.x = Math.PI * 0.35;
    chevron.position.set(0, 0.14, 0.35);
    wreath.add(chevron);

    const rearStud = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 12, 12),
      accentMat,
    );
    rearStud.position.set(0, 0.12, -0.33);
    wreath.add(rearStud);
  }

  wreath.userData = {
    isPedestalWreath: true,
    pieceType: type,
    color: isWhite ? 'w' : 'b',
  };

  return wreath;
}

/**
 * Computes the exact grounded 3D head apex `(x, y, z, scale)` of a normalized `.glb` holder
 * so the single `S2` 3D Role Crown sits snugly juxtaposed right on the character's head
 * (`headTopY - 0.025m`) with zero air gap and zero duplicate crown!
 *
 * @param {typeof import('three')} THREE
 * @param {import('three').Object3D} groundedHolder
 * @param {{ finalMaxY?: number }} [transform]
 * @param {string} [pieceType='p']
 * @returns {{ x: number, y: number, z: number, headRadius: number, scale: number }}
 */
export function computeGroundedHeadAnchor(
  THREE,
  groundedHolder,
  transform = {},
  pieceType = 'p',
) {
  const type = String(pieceType || 'p').toLowerCase();
  const fallbackY =
    Number.isFinite(transform?.finalMaxY) && transform.finalMaxY > 0
      ? transform.finalMaxY
      : (CANONICAL_PIECE_HEIGHTS[type] ?? 1.25);

  const scaleByRole = {
    k: 0.96,
    q: 0.94,
    b: 0.90,
    n: 0.88,
    r: 0.92,
    p: 0.84,
  };
  const roleScale = scaleByRole[type] ?? 0.90;

  const seatOffsetByRole = {
    k: -0.068,
    q: -0.068,
    b: -0.055,
    n: -0.045,
    r: -0.045,
    p: -0.045,
  };
  const seatOffset = seatOffsetByRole[type] ?? -0.05;

  if (!groundedHolder || typeof groundedHolder.traverse !== 'function') {
    return { x: 0, y: fallbackY, seatY: fallbackY + seatOffset, z: 0, headRadius: 0.11, scale: roleScale };
  }

  groundedHolder.updateMatrixWorld?.(true);
  const v = new THREE.Vector3();
  let centralMaxY = -Infinity;

  // Pass 1: find highest vertex near the central vertical axis (r <= 0.15m)
  groundedHolder.traverse((child) => {
    if (child.isMesh && child.geometry?.attributes?.position) {
      const pos = child.geometry.attributes.position;
      const step = Math.max(1, Math.floor(pos.count / 2500));
      for (let i = 0; i < pos.count; i += step) {
        v.fromBufferAttribute(pos, i).applyMatrix4(child.matrixWorld);
        if (Math.hypot(v.x, v.z) <= 0.15 && v.y > centralMaxY) {
          centralMaxY = v.y;
        }
      }
    }
  });

  const headTopY = Number.isFinite(centralMaxY) && centralMaxY > PEDESTAL_HEIGHT
    ? centralMaxY
    : fallbackY;

  // Pass 2: find horizontal centroid of the top 0.08m of the head
  let sumX = 0;
  let sumZ = 0;
  let count = 0;
  groundedHolder.traverse((child) => {
    if (child.isMesh && child.geometry?.attributes?.position) {
      const pos = child.geometry.attributes.position;
      const step = Math.max(1, Math.floor(pos.count / 2500));
      for (let i = 0; i < pos.count; i += step) {
        v.fromBufferAttribute(pos, i).applyMatrix4(child.matrixWorld);
        if (Math.hypot(v.x, v.z) <= 0.16 && v.y >= headTopY - 0.08) {
          sumX += v.x;
          sumZ += v.z;
          count += 1;
        }
      }
    }
  });

  const rawX = count > 0 ? sumX / count : 0;
  const rawZ = count > 0 ? sumZ / count : 0;
  // Clamp horizontal offset so the crown stays balanced over the head center
  const clampXZ = (val) => Math.max(-0.045, Math.min(0.045, val));

  return {
    x: clampXZ(rawX),
    y: headTopY,
    seatY: headTopY + seatOffset,
    z: clampXZ(rawZ),
    headRadius: 0.115,
    scale: roleScale,
  };
}

/**
 * Builds the Single Sculpted 3D Role Crown/Crest (`S2`) seated directly on the character's head (`headTopY`).
 * Crafted entirely with smooth, high-segment royal geometry (zero raw `BoxGeometry` cubes!):
 * - `k`: Imperial Arched Diadem (`32`-seg circlet + velvet cushion + 4 braided half-torus arches + monde orb + flared pyramidal Cross Pattee).
 * - `q`: Graceful 8-Spire Royal Tiara Coronet (`32`-seg filigree band + satin dome + 8 outward-curved spires + 8 delicate proportionate pearls).
 * - `r`: Curved 6-Merlon Castle Battlement Mural Crown (`32`-seg flared parapet + 6 curved cylindrical-sector merlons).
 * - `b`: Sculpted Liturgical Mitre + Flared Pastoral Cross Finial.
 * - `n`: Corinthian Warhorse Plume + Swept Bilateral Pegasus/Steed Side-Crests.
 * - `p`: Sleek Swiss-Guard Braided Circlet + Polished Staunton Sphere + Tapered Halberd Spike.
 *
 * @param {typeof import('three')} THREE
 * @param {string} pieceType - `'k' | 'q' | 'r' | 'b' | 'n' | 'p'`
 * @param {'w'|'b'} color
 * @param {number} [pieceHeight]
 * @returns {import('three').Group}
 */
export function buildUniversalGlbRoleAddOn(THREE, pieceType = 'p', color = 'w', pieceHeight = 0) {
  const type = String(pieceType || 'p').toLowerCase();
  const isWhite = String(color || 'w').toLowerCase() !== 'b';
  const baseHeight = pieceHeight > 0 ? pieceHeight : (CANONICAL_PIECE_HEIGHTS[type] ?? 1.25);

  const addon = new THREE.Group();
  addon.name = `UniversalRoleAddon_${isWhite ? 'w' : 'b'}_${type}`;
  addon.position.set(0, baseHeight, 0);

  const royalMetalMat = new THREE.MeshStandardMaterial({
    color: isWhite ? 0xffb300 : 0x161926,
    roughness: isWhite ? 0.28 : 0.22,
    metalness: isWhite ? 0.34 : 0.68,
    emissive: isWhite ? 0xb26a00 : 0x1a1036,
    emissiveIntensity: isWhite ? 0.26 : 0.42,
  });

  const gemAccentMat = new THREE.MeshStandardMaterial({
    color: isWhite ? 0xffe082 : 0x8c5eff,
    roughness: 0.20,
    metalness: 0.26,
    emissive: isWhite ? 0xc67c00 : 0x651fff,
    emissiveIntensity: isWhite ? 0.24 : 0.54,
  });

  const velvetCapMat = new THREE.MeshStandardMaterial({
    color: isWhite ? 0xb71c1c : 0x260e4d,
    roughness: 0.48,
    metalness: 0.08,
    emissive: isWhite ? 0x4a0808 : 0x14052b,
    emissiveIntensity: 0.25,
  });

  if (type === 'k') {
    // 1. Smooth 32-segment royal circlet band + lower/upper braided torus rims
    const circlet = new THREE.Mesh(
      new THREE.CylinderGeometry(0.128, 0.114, 0.046, 32),
      royalMetalMat,
    );
    circlet.position.y = 0.023;

    const lowerRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.116, 0.012, 14, 36),
      gemAccentMat,
    );
    lowerRim.rotation.x = Math.PI * 0.5;
    lowerRim.position.y = 0.004;

    const upperRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.128, 0.013, 14, 36),
      gemAccentMat,
    );
    upperRim.rotation.x = Math.PI * 0.5;
    upperRim.position.y = 0.046;

    // 2. Royal velvet cushion cap inside the circlet
    const velvetDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.108, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.52),
      velvetCapMat,
    );
    velvetDome.position.y = 0.016;

    // 3. 8 cabochon gem studs around the circlet
    const studGeo = new THREE.SphereGeometry(0.014, 12, 12);
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const stud = new THREE.Mesh(studGeo, gemAccentMat);
      stud.position.set(Math.cos(ang) * 0.124, 0.025, Math.sin(ang) * 0.124);
      addon.add(stud);
    }

    // 4. Two crossed imperial half-torus arches meeting at the monde orb
    for (const rotY of [0, Math.PI * 0.5]) {
      const arch = new THREE.Mesh(
        new THREE.TorusGeometry(0.112, 0.013, 12, 32, Math.PI),
        royalMetalMat,
      );
      arch.rotation.y = rotY;
      arch.position.y = 0.042;
      addon.add(arch);
    }

    // 5. Globus Cruciger (Monde Orb + Equatorial Collar)
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.036, 20, 20), gemAccentMat);
    orb.position.y = 0.158;
    const orbRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.038, 0.008, 10, 24),
      royalMetalMat,
    );
    orbRing.rotation.x = Math.PI * 0.5;
    orbRing.position.y = 0.158;

    // 6. Sculpted Flared Cross Pattee Finial (4 flared pyramidal arms + central jewel, zero cubes!)
    const crossCenterY = 0.228;
    const armGeo = new THREE.ConeGeometry(0.032, 0.088, 4);
    // Top flared arm (base flares up)
    const armTop = new THREE.Mesh(armGeo, gemAccentMat);
    armTop.rotation.x = Math.PI;
    armTop.rotation.y = Math.PI * 0.25;
    armTop.position.set(0, crossCenterY + 0.028, 0);
    // Bottom flared stem
    const armBot = new THREE.Mesh(armGeo, royalMetalMat);
    armBot.rotation.y = Math.PI * 0.25;
    armBot.position.set(0, crossCenterY - 0.028, 0);
    // Left & Right flared arms
    for (const xSign of [-1, 1]) {
      const armSide = new THREE.Mesh(armGeo, gemAccentMat);
      armSide.rotation.z = xSign * Math.PI * 0.5;
      armSide.rotation.x = Math.PI * 0.25;
      armSide.position.set(xSign * 0.038, crossCenterY, 0);
      addon.add(armSide);
    }
    // Front & Back flared arms for 360° top-down recognition
    for (const zSign of [-1, 1]) {
      const armFB = new THREE.Mesh(armGeo, gemAccentMat);
      armFB.rotation.x = -zSign * Math.PI * 0.5;
      armFB.rotation.y = Math.PI * 0.25;
      armFB.position.set(0, crossCenterY, zSign * 0.038);
      addon.add(armFB);
    }
    const coreJewel = new THREE.Mesh(new THREE.OctahedronGeometry(0.026, 1), royalMetalMat);
    coreJewel.position.y = crossCenterY;

    addon.add(
      circlet,
      lowerRim,
      upperRim,
      velvetDome,
      orb,
      orbRing,
      armTop,
      armBot,
      coreJewel,
    );
  } else if (type === 'q') {
    // Graceful 8-Spire Royal Tiara Coronet with 8 delicate, proportionate pearls
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(0.128, 0.112, 0.042, 32),
      royalMetalMat,
    );
    band.position.y = 0.021;

    const lowerFiligree = new THREE.Mesh(
      new THREE.TorusGeometry(0.114, 0.011, 14, 36),
      gemAccentMat,
    );
    lowerFiligree.rotation.x = Math.PI * 0.5;
    lowerFiligree.position.y = 0.004;

    const upperFiligree = new THREE.Mesh(
      new THREE.TorusGeometry(0.128, 0.011, 14, 36),
      gemAccentMat,
    );
    upperFiligree.rotation.x = Math.PI * 0.5;
    upperFiligree.position.y = 0.042;

    const innerDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.102, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.5),
      velvetCapMat,
    );
    innerDome.position.y = 0.014;

    const topJewel = new THREE.Mesh(new THREE.OctahedronGeometry(0.024, 1), gemAccentMat);
    topJewel.position.y = 0.122;

    addon.add(band, lowerFiligree, upperFiligree, innerDome, topJewel);

    const tallSpireGeo = new THREE.ConeGeometry(0.018, 0.105, 16);
    const medSpireGeo = new THREE.ConeGeometry(0.016, 0.088, 16);
    const pearlGeo = new THREE.SphereGeometry(0.019, 16, 16);

    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const cx = Math.cos(ang);
      const sz = Math.sin(ang);
      const isMajor = i % 2 === 0;

      const spire = new THREE.Mesh(isMajor ? tallSpireGeo : medSpireGeo, royalMetalMat);
      const rSpire = 0.132;
      spire.position.set(cx * rSpire, isMajor ? 0.078 : 0.070, sz * rSpire);
      spire.rotation.z = -cx * 0.28;
      spire.rotation.x = sz * 0.28;
      addon.add(spire);

      const pearl = new THREE.Mesh(pearlGeo, gemAccentMat);
      const rPearl = 0.148;
      pearl.position.set(cx * rPearl, isMajor ? 0.132 : 0.116, sz * rPearl);
      addon.add(pearl);
    }
  } else if (type === 'r') {
    // Curved 6-Merlon Castle Battlement Mural Crown (zero boxy blocks!)
    const parapet = new THREE.Mesh(
      new THREE.CylinderGeometry(0.138, 0.118, 0.056, 32),
      royalMetalMat,
    );
    parapet.position.y = 0.028;

    const lowerMolding = new THREE.Mesh(
      new THREE.TorusGeometry(0.120, 0.011, 12, 32),
      gemAccentMat,
    );
    lowerMolding.rotation.x = Math.PI * 0.5;
    lowerMolding.position.y = 0.005;

    const upperMolding = new THREE.Mesh(
      new THREE.TorusGeometry(0.138, 0.012, 12, 32),
      royalMetalMat,
    );
    upperMolding.rotation.x = Math.PI * 0.5;
    upperMolding.position.y = 0.056;

    addon.add(parapet, lowerMolding, upperMolding);

    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      const merlonArc = new THREE.Mesh(
        new THREE.CylinderGeometry(0.148, 0.140, 0.068, 12, 1, false, ang - 0.28, 0.56),
        gemAccentMat,
      );
      merlonArc.position.y = 0.088;
      addon.add(merlonArc);
    }
  } else if (type === 'b') {
    // Sculpted Cleft Liturgical Mitre + Flared Pastoral Cross Finial
    const mitreCirclet = new THREE.Mesh(
      new THREE.TorusGeometry(0.106, 0.013, 14, 32),
      gemAccentMat,
    );
    mitreCirclet.rotation.x = Math.PI * 0.5;
    mitreCirclet.position.y = 0.008;

    const mitrePeak = new THREE.Mesh(
      new THREE.ConeGeometry(0.104, 0.125, 24),
      royalMetalMat,
    );
    mitrePeak.position.y = 0.070;

    const orphreyRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.068, 0.010, 12, 24),
      gemAccentMat,
    );
    orphreyRing.rotation.x = Math.PI * 0.5;
    orphreyRing.position.y = 0.058;

    const crossVert = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.016, 0.11, 14),
      gemAccentMat,
    );
    crossVert.position.y = 0.165;

    const crossHoriz = new THREE.Mesh(
      new THREE.CylinderGeometry(0.011, 0.011, 0.105, 14),
      gemAccentMat,
    );
    crossHoriz.rotation.z = Math.PI * 0.5;
    crossHoriz.position.y = 0.182;

    const haloLoop = new THREE.Mesh(
      new THREE.TorusGeometry(0.038, 0.010, 12, 24),
      royalMetalMat,
    );
    haloLoop.position.y = 0.182;

    addon.add(mitreCirclet, mitrePeak, orphreyRing, crossVert, crossHoriz, haloLoop);
  } else if (type === 'n') {
    // Corinthian Warhorse Plume + Swept Bilateral Pegasus/Steed Side-Crests
    const helmCirclet = new THREE.Mesh(
      new THREE.TorusGeometry(0.105, 0.014, 14, 28),
      royalMetalMat,
    );
    helmCirclet.rotation.x = Math.PI * 0.5;
    helmCirclet.position.y = 0.010;

    const plumeArch = new THREE.Mesh(
      new THREE.TorusGeometry(0.095, 0.022, 14, 28, Math.PI * 1.15),
      gemAccentMat,
    );
    plumeArch.rotation.y = Math.PI * 0.5;
    plumeArch.rotation.z = -Math.PI * 0.08;
    plumeArch.position.y = 0.045;

    addon.add(helmCirclet, plumeArch);

    for (const xSign of [-1, 1]) {
      const wingGrp = new THREE.Group();
      const primaryPinion = new THREE.Mesh(
        new THREE.ConeGeometry(0.032, 0.16, 16),
        gemAccentMat,
      );
      primaryPinion.position.set(xSign * 0.135, 0.075, -0.01);
      primaryPinion.rotation.z = -xSign * 1.05;
      primaryPinion.rotation.y = -xSign * 0.22;

      const secondaryPinion = new THREE.Mesh(
        new THREE.ConeGeometry(0.026, 0.13, 14),
        royalMetalMat,
      );
      secondaryPinion.position.set(xSign * 0.115, 0.105, -0.025);
      secondaryPinion.rotation.z = -xSign * 0.78;

      const steedEar = new THREE.Mesh(
        new THREE.ConeGeometry(0.022, 0.075, 12),
        gemAccentMat,
      );
      steedEar.position.set(xSign * 0.085, 0.115, 0.02);
      steedEar.rotation.z = -xSign * 0.35;

      wingGrp.add(primaryPinion, secondaryPinion, steedEar);
      addon.add(wingGrp);
    }
  } else {
    // Pawn ('p'): Sleek Swiss-Guard Braided Circlet + Polished Staunton Sphere + Tapered Pike Finial
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.088, 0.014, 14, 28),
      royalMetalMat,
    );
    collar.rotation.x = Math.PI * 0.5;
    collar.position.y = 0.008;

    const stauntonSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.052, 20, 20),
      gemAccentMat,
    );
    stauntonSphere.position.y = 0.052;

    const upperCollar = new THREE.Mesh(
      new THREE.TorusGeometry(0.034, 0.009, 12, 24),
      royalMetalMat,
    );
    upperCollar.rotation.x = Math.PI * 0.5;
    upperCollar.position.y = 0.095;

    const pikeSpearhead = new THREE.Mesh(
      new THREE.ConeGeometry(0.028, 0.115, 16),
      royalMetalMat,
    );
    pikeSpearhead.position.y = 0.148;

    addon.add(collar, stauntonSphere, upperCollar, pikeSpearhead);
  }

  addon.userData = {
    isUniversalRoleAddon: true,
    pieceType: type,
    color: isWhite ? 'w' : 'b',
    baseHeight,
  };

  return addon;
}

/**
 * Draws a crisp, simplified 2D classic chess icon onto a 2D canvas context:
 * - By default (`showRoleLetters === false`): draws ONLY ONE single, large, dead-centered
 *   classic chess piece icon (`♚ ♛ ♜ ♝ ♞ ♟`) in the exact center of the medallion —
 *   no duplicate silhouette and no letters (`K, Q, R, B, N, P`).
 * - When `showRoleLetters === true` (Accessibility / Braille / Letters toggle):
 *   also renders the bold role letter (`K, Q, R, B, N, P`) + Braille symbol (`⠇ ⠟ ⠗ ⠃ ⠝ ⠏`) underneath.
 *
 * @param {CanvasRenderingContext2D} c
 * @param {number} size
 * @param {string} type
 * @param {boolean} isWhite
 * @param {boolean} [isZenithDisc=true]
 * @param {boolean} [showRoleLetters=false]
 */
export function drawTournamentChessIcon2D(
  c,
  size,
  type,
  isWhite,
  isZenithDisc = true,
  showRoleLetters = false,
) {
  const cx = size * 0.5;
  const cy = size * 0.5;
  const r = size * 0.48;
  const s = size / 512;

  const bgHex = isWhite ? '#e8dec8' : '#090c14';
  const outerRingHex = isWhite ? '#2a1d08' : '#b388ff';
  const innerRingHex = isWhite ? '#c69214' : '#00e5ff';
  const fgHex = isWhite ? '#070a10' : '#ffffff';
  const strokeAccentHex = isWhite ? '#b8860b' : '#7c4dff';

  c.save();
  c.clearRect(0, 0, size, size);

  if (isZenithDisc) {
    c.fillStyle = bgHex;
    c.fillRect(0, 0, size, size);
  }

  // Circular medallion disc
  c.beginPath();
  c.arc(cx, cy, r, 0, Math.PI * 2);
  c.fillStyle = bgHex;
  c.fill();

  // Outer contrast ring
  c.beginPath();
  c.arc(cx, cy, size * 0.45, 0, Math.PI * 2);
  c.strokeStyle = outerRingHex;
  c.lineWidth = size * 0.052;
  c.stroke();

  // Inner ring
  c.beginPath();
  c.arc(cx, cy, size * 0.398, 0, Math.PI * 2);
  c.strokeStyle = innerRingHex;
  c.lineWidth = size * 0.024;
  c.stroke();

  const solidGlyph = CLASSIC_ROLE_SOLID_GLYPHS[type] || '♟';
  const letter = CLASSIC_ROLE_LETTERS[type] || 'P';
  const braille = CLASSIC_ROLE_BRAILLE[type] || '⠏';

  c.textAlign = 'center';
  c.textBaseline = 'middle';

  if (!showRoleLetters) {
    // Simplified Default: ONE single large classic chess icon dead-center in the medallion!
    c.font = `900 ${Math.round(308 * s)}px "Noto Sans Symbols 2", "Segoe UI Symbol", "Apple Symbols", "DejaVu Sans", serif`;
    c.strokeStyle = strokeAccentHex;
    c.lineWidth = Math.max(2, Math.round(10 * s));
    c.strokeText(solidGlyph, cx, cy + 10 * s);
    c.fillStyle = fgHex;
    c.fillText(solidGlyph, cx, cy + 10 * s);
  } else {
    // Accessibility Mode (Letters + Braille enabled): icon above + bold Letter & Braille below
    c.font = `900 ${Math.round(220 * s)}px "Noto Sans Symbols 2", "Segoe UI Symbol", "Apple Symbols", "DejaVu Sans", serif`;
    c.strokeStyle = strokeAccentHex;
    c.lineWidth = Math.max(2, Math.round(8 * s));
    c.strokeText(solidGlyph, cx, cy - 48 * s);
    c.fillStyle = fgHex;
    c.fillText(solidGlyph, cx, cy - 48 * s);

    c.font = `900 ${Math.round(92 * s)}px system-ui, -apple-system, sans-serif`;
    c.fillStyle = fgHex;
    c.fillText(`${letter} ${braille}`, cx, cy + 122 * s);
  }

  c.restore();
}

/**
 * Builds the Floating 2D Role Billboard (`THREE.Sprite`) at `y = pieceHeight + 0.34m` (`s4`)
 * with headless fallback when `document` is undefined in Node unit tests.
 *
 * @param {typeof import('three')} THREE
 * @param {string} pieceType
 * @param {'w'|'b'} color
 * @param {number} [pieceHeight]
 * @param {boolean} [showRoleLetters=false]
 * @returns {import('three').Sprite}
 */
export function buildFloatingRoleBillboard(
  THREE,
  pieceType = 'p',
  color = 'w',
  pieceHeight = 0,
  showRoleLetters = false,
) {
  const type = String(pieceType || 'p').toLowerCase();
  const isWhite = String(color || 'w').toLowerCase() !== 'b';
  const baseHeight = pieceHeight > 0 ? pieceHeight : (CANONICAL_PIECE_HEIGHTS[type] ?? 1.25);
  const glyph = CLASSIC_ROLE_GLYPHS[type] || '♙';
  const solidGlyph = CLASSIC_ROLE_SOLID_GLYPHS[type] || '♟';
  const letter = CLASSIC_ROLE_LETTERS[type] || 'P';
  const braille = CLASSIC_ROLE_BRAILLE[type] || '⠏';

  let texture;
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const c = canvas.getContext('2d');
    if (c) {
      drawTournamentChessIcon2D(c, 256, type, isWhite, false, showRoleLetters);
    }
    texture = new THREE.CanvasTexture(canvas);
    if (THREE.SRGBColorSpace) {
      texture.colorSpace = THREE.SRGBColorSpace;
    }
    texture.userData = {
      canvas,
      ctx: c,
      width: 256,
      height: 256,
      pieceType: type,
      color: isWhite ? 'w' : 'b',
      glyph,
      solidGlyph,
      letter,
      braille,
      showRoleLetters: Boolean(showRoleLetters),
    };
  } else {
    texture = new THREE.Texture();
    texture.userData = {
      headlessFallback: true,
      width: 256,
      height: 256,
      pieceType: type,
      color: isWhite ? 'w' : 'b',
      glyph,
      solidGlyph,
      letter,
      braille,
      showRoleLetters: Boolean(showRoleLetters),
    };
  }

  const mat = new THREE.SpriteMaterial({
    map: texture,
    color: isWhite ? 0xdcd2be : 0xffffff,
    transparent: true,
    depthTest: true,
    depthWrite: false,
  });

  const sprite = new THREE.Sprite(mat);
  sprite.name = `FloatingRoleBillboard_${isWhite ? 'w' : 'b'}_${type}`;
  sprite.position.set(0, baseHeight + 0.36, 0);
  sprite.scale.set(0.38, 0.38, 1.0);
  sprite.renderOrder = 16;
  sprite.userData = {
    isFloatingBillboard: true,
    pieceType: type,
    color: isWhite ? 'w' : 'b',
    glyph,
    solidGlyph,
    letter,
    braille,
    showRoleLetters: Boolean(showRoleLetters),
  };

  return sprite;
}

/**
 * Builds the Flat Horizontal Board-Level 2D Classic Tournament Medallion Disc
 * (`CylinderGeometry(0.42, 0.42, 0.04, 32)` at `y = ZENITH_DISC_BOARD_Y = 0.04m`)
 * so that all 32 medallions sit on the exact same board plane `(square.x, 0.04, square.z)`
 * with ZERO height-dependent perspective parallax (`100%` square-aligned!):
 * - White piece: `#e8dec8` anti-bloom ivory parchment, `#2a1d08` + `#c69214` double ring, bold `#070a10` chess icon.
 * - Black piece: `#090c14` pure obsidian background, `#b388ff` + `#00e5ff` double ring, bold `#ffffff` chess icon.
 *
 * @param {typeof import('three')} THREE
 * @param {string} pieceType
 * @param {'w'|'b'} color
 * @param {number} [pieceHeight]
 * @param {boolean} [showRoleLetters=false]
 * @returns {import('three').Mesh}
 */
export function buildZenithal2DClassicDisc(
  THREE,
  pieceType = 'p',
  color = 'w',
  pieceHeight = 0,
  showRoleLetters = false,
) {
  const type = String(pieceType || 'p').toLowerCase();
  const isWhite = String(color || 'w').toLowerCase() !== 'b';
  const baseHeight = pieceHeight > 0 ? pieceHeight : (CANONICAL_PIECE_HEIGHTS[type] ?? 1.25);
  const glyph = CLASSIC_ROLE_GLYPHS[type] || '♙';
  const solidGlyph = CLASSIC_ROLE_SOLID_GLYPHS[type] || '♟';
  const letter = CLASSIC_ROLE_LETTERS[type] || 'P';

  const palette = isWhite
    ? {
        background: '#e8dec8',
        outerRing: '#2a1d08',
        innerRing: '#c69214',
        iconColor: '#070a10',
      }
    : {
        background: '#090c14',
        outerRing: '#b388ff',
        innerRing: '#00e5ff',
        iconColor: '#ffffff',
      };

  let texture;
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const c = canvas.getContext('2d');
    if (c) {
      drawTournamentChessIcon2D(c, 512, type, isWhite, true, showRoleLetters);
    }
    texture = new THREE.CanvasTexture(canvas);
    if (THREE.SRGBColorSpace) {
      texture.colorSpace = THREE.SRGBColorSpace;
    }
    texture.userData = {
      canvas,
      ctx: c,
      width: 512,
      height: 512,
      pieceType: type,
      color: isWhite ? 'w' : 'b',
      glyph,
      solidGlyph,
      letter,
      showRoleLetters: Boolean(showRoleLetters),
      ...palette,
    };
  } else {
    texture = new THREE.Texture();
    texture.userData = {
      headlessFallback: true,
      width: 512,
      height: 512,
      pieceType: type,
      color: isWhite ? 'w' : 'b',
      glyph,
      solidGlyph,
      letter,
      showRoleLetters: Boolean(showRoleLetters),
      ...palette,
    };
  }

  const geo = new THREE.CylinderGeometry(0.42, 0.42, 0.04, 32);
  // Remap planar XZ top/bottom cap UVs so +X is East (u=1) and -Z is North/Up (v=1)
  const posAttr = geo.attributes?.position;
  const uvAttr = geo.attributes?.uv;
  if (posAttr && uvAttr) {
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);
      uvAttr.setXY(i, (vx / 0.42) * 0.5 + 0.5, (-vz / 0.42) * 0.5 + 0.5);
    }
    uvAttr.needsUpdate = true;
  }
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    color:
      typeof document !== 'undefined'
        ? isWhite
          ? 0xdcd2be
          : 0xffffff
        : isWhite
          ? 0xdcd2be
          : 0x090c14,
  });

  const discMesh = new THREE.Mesh(geo, mat);
  discMesh.name = `Zenithal2DClassicDisc_${isWhite ? 'w' : 'b'}_${type}`;
  discMesh.position.set(0, ZENITH_DISC_BOARD_Y, 0);
  // Cancel pieceGroup's homeYaw (White=Math.PI, Black=0) so world yaw is 0 and icons stand upright facing North (-Z)
  discMesh.rotation.y = isWhite ? Math.PI : 0;
  discMesh.renderOrder = 15;

  discMesh.userData = {
    isZenithal2dDisc: true,
    pieceType: type,
    color: isWhite ? 'w' : 'b',
    glyph,
    solidGlyph,
    letter,
    baseHeight,
    boardY: ZENITH_DISC_BOARD_Y,
    showRoleLetters: Boolean(showRoleLetters),
    ...palette,
  };

  return discMesh;
}

/**
 * Re-renders the 2D canvas texture on a `Zenithal2DClassicDisc` or `FloatingRoleBillboard`
 * when `showRoleLetters` (Letters / Braille accessibility toggle) changes at runtime.
 *
 * @param {import('three').Object3D} discOrSprite
 * @param {boolean} showRoleLetters
 */
export function updateRoleIcon2DLettersMode(discOrSprite, showRoleLetters = false) {
  if (!discOrSprite?.material?.map?.userData) return;
  const ud = discOrSprite.material.map.userData;
  const nextFlag = Boolean(showRoleLetters);
  if (ud.showRoleLetters === nextFlag) return;
  ud.showRoleLetters = nextFlag;
  if (discOrSprite.userData) {
    discOrSprite.userData.showRoleLetters = nextFlag;
  }
  if (ud.ctx && ud.canvas) {
    const isWhite = ud.color !== 'b';
    const isZenith = Boolean(discOrSprite.userData?.isZenithal2dDisc);
    drawTournamentChessIcon2D(
      ud.ctx,
      ud.width || 512,
      ud.pieceType || 'p',
      isWhite,
      isZenith,
      nextFlag,
    );
    discOrSprite.material.map.needsUpdate = true;
  }
}

/**
 * Applies high-contrast Faction Albedo & Emissive rules to `.glb` materials so Black pieces
 * never look ivory/white (even when UV-mapped textures or light porcelain accents are present!).
 *
 * @param {import('three').Material & Record<string, any>} mat
 * @param {boolean} isWhite
 * @param {boolean} [useObsidianContrast=true]
 */
export function applyBlackTeamGlbContrast(mat, isWhite, useObsidianContrast = true) {
  if (!mat) return mat;

  if (mat.map) {
    mat.metalness = 0.04;
    mat.metalnessMap = null;
    mat.roughness = 0.52;
    mat.roughnessMap = null;

    if (isWhite) {
      if (mat.color) mat.color.setHex(0xffffff);
      if (mat.emissive) {
        mat.emissiveMap = mat.map;
        mat.emissive.setHex(0xffffff);
        mat.emissiveIntensity = 0.34;
      }
    } else if (useObsidianContrast) {
      if (mat.color) mat.color.setHex(0x48506a);
      if (mat.emissive) {
        mat.emissiveMap = null;
        mat.emissive.setHex(0x140c2e);
        mat.emissiveIntensity = 0.14;
      }
    } else {
      // Legacy baseline ('off')
      if (mat.color) mat.color.setHex(0xb8c6f0);
      if (mat.emissive) {
        mat.emissiveMap = mat.map;
        mat.emissive.setHex(0x7c90e8);
        mat.emissiveIntensity = 0.22;
      }
    }
    return mat;
  }

  // Multi-material untextured PBR models (Swamp & Classic families)
  const matName = String(mat.name || '').trim().toLowerCase();

  if (isWhite) {
    if (matName === 'faction_primary' && mat.color) {
      mat.color.setHex(0xf5f0e6);
      mat.roughness = 0.26;
      mat.metalness = 0.06;
    } else if (matName === 'faction_trim' && mat.color) {
      mat.color.setHex(0xd4af37);
      mat.roughness = 0.24;
      mat.metalness = 0.78;
    } else {
      mat.metalness = Math.min(0.75, mat.metalness ?? 0.12);
      mat.roughness = Math.max(0.22, mat.roughness ?? 0.45);
    }
    if (mat.emissive && mat.color) {
      mat.emissive.copy(mat.color);
      mat.emissiveIntensity = 0.24;
    }
    return mat;
  }

  if (useObsidianContrast) {
    if (matName === 'faction_primary' && mat.color) {
      mat.color.setHex(0x0d1017);
      mat.roughness = 0.32;
      mat.metalness = 0.16;
    } else if (matName === 'faction_trim' && mat.color) {
      mat.color.setHex(0x7c4dff);
      mat.roughness = 0.24;
      mat.metalness = 0.65;
    } else if (mat.color) {
      const luma =
        mat.color.r * 0.299 + mat.color.g * 0.587 + mat.color.b * 0.114;
      if (LIGHT_ACCENT_MATERIAL_NAMES.has(matName) || luma > 0.55) {
        mat.color.multiplyScalar(0.38);
      }
      mat.metalness = Math.min(0.75, mat.metalness ?? 0.15);
      mat.roughness = Math.max(0.26, mat.roughness ?? 0.45);
    }
    if (mat.emissive) {
      if (matName === 'faction_trim') {
        mat.emissive.setHex(0x311b92);
        mat.emissiveIntensity = 0.28;
      } else {
        mat.emissive.setHex(0x060810);
        mat.emissiveIntensity = 0.12;
      }
    }
  } else {
    // Legacy baseline ('off')
    if (matName === 'faction_primary' && mat.color) {
      mat.color.setHex(0x232a3a);
      mat.roughness = 0.24;
      mat.metalness = 0.22;
    } else if (matName === 'faction_trim' && mat.color) {
      mat.color.setHex(0xc0cce0);
      mat.roughness = 0.24;
      mat.metalness = 0.78;
    } else {
      mat.metalness = Math.min(0.75, mat.metalness ?? 0.12);
      mat.roughness = Math.max(0.22, mat.roughness ?? 0.45);
    }
    if (mat.emissive && mat.color) {
      mat.emissive.copy(mat.color);
      mat.emissiveIntensity = 0.16;
    }
  }

  return mat;
}
