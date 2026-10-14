/**
 * @fileoverview 3D & 2D Piece Visual Recognition & Clarity Engine (`PieceClarityHelper`).
 *
 * Implements 5 combinable visual recognition solutions (`s1..s5` + `off` baseline)
 * to eliminate visual/cognitive fatigue when distinguishing White vs Black pieces
 * and the 6 chess roles (`k, q, r, b, n, p`) from overhead (`0°` vertical) and
 * semi-high (`30°` from vertical) camera angles across all 3 families
 * (`carlesso`, `swamp`, `classic`):
 *
 * - `s1` (`zenith2d`): Automatic / Toggled Zenithal 2D Classic B/W Tournament Medallions (`0°..35°`).
 * - `s2` (`glb_addons`): Universal Static 3D Role Add-Ons (King Cross Crown, Queen 8-Pearl Coronet,
 *   Rook 6-Merlon Turret, Bishop Tall Mitre Cross, Knight Wide Bilateral Warhorse Crest, Pawn Pike + Sphere).
 * - `s3` (`obsidian_contrast`): True Deep Matte Obsidian Black (`0x0d1017` + Cobalt-Violet `0x7c4dff`)
 *   vs Warm Ivory Marble White (`0xfffdf5` + Royal Gold `0xffca28`) on pedestals & GLB materials.
 * - `s4` (`wreath_billboard`): Sculpted 3D Pedestal Role Wreath (`y = 0.04..0.24m`) + Floating 2D Role Crest.
 * - `s5` (`hybrid_champion`, default): All-in combination of `s2 + s3 + s4` with automatic `s1` below `20°`.
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

export const CLASSIC_ROLE_LETTERS = Object.freeze({
  k: 'K',
  q: 'Q',
  r: 'R',
  b: 'B',
  n: 'N',
  p: 'P',
});

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
 * @param {string} [mode='s5'] - `'off' | 's1' | 's2' | 's3' | 's4' | 's5'`
 * @param {number} [polarAngleDeg=45] - Camera polar angle in degrees from vertical zenith (`0°` = top-down)
 * @param {boolean} [topDownCamera=false] - Whether HUD top-down camera mode is active
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
  mode = 's5',
  polarAngleDeg = 45,
  topDownCamera = false,
  force2dIcons = false,
) {
  const raw = String(mode || 's5').trim().toLowerCase();
  const normMode = CLARITY_MODES.includes(raw) ? raw : 's5';
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
    const showDisc = angle < 22 || angle < 35 || isTopDown || isForced2D;
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
    return {
      mode: 's2',
      showZenith2dDisc: isForced2D,
      showUniversal3dAddon: true,
      useObsidianContrast: true,
      showPedestalWreath: false,
      showFloatingBillboard: false,
      zenithBlend: isForced2D ? 1.0 : 0,
    };
  }

  if (normMode === 's3') {
    return {
      mode: 's3',
      showZenith2dDisc: isForced2D,
      showUniversal3dAddon: false,
      useObsidianContrast: true,
      showPedestalWreath: false,
      showFloatingBillboard: false,
      zenithBlend: isForced2D ? 1.0 : 0,
    };
  }

  if (normMode === 's4') {
    return {
      mode: 's4',
      showZenith2dDisc: isForced2D,
      showUniversal3dAddon: false,
      useObsidianContrast: true,
      showPedestalWreath: true,
      showFloatingBillboard: true,
      zenithBlend: isForced2D ? 1.0 : 0,
    };
  }

  // Default: 's5' (Hybrid Champion)
  const showDisc = angle < 20 || isTopDown || isForced2D;
  const zenithBlend =
    isTopDown || isForced2D ? 1.0 : Math.max(0, Math.min(1, (24 - angle) / 16));
  return {
    mode: 's5',
    showZenith2dDisc: showDisc,
    showUniversal3dAddon: true,
    useObsidianContrast: true,
    showPedestalWreath: true,
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
 * Builds the Sculpted 3D Pedestal Role Wreath (`y = 0.04..0.24m`) around the pedestal perimeter:
 * - `k`: Octagonal imperial collar + 4 cardinal Cross Pattee reliefs (`N, S, E, W` at `r = 0.41m`).
 * - `q`: 8-pointed star coronet ring with 8 glowing pearls around the base perimeter (`r = 0.41m`).
 * - `r`: Thick hexagonal/square castle battlement wall with 6 tall square merlons (`r = 0.40m`).
 * - `b`: 4 mitre-shaped gothic arches + oblique sacred cross on front/back.
 * - `n`: Wide U-shaped Horseshoe track arch around the base + 2 protruding stylized horse-head fins on Left/Right (`x = ±0.42m`).
 * - `p`: Compact guard ring with a forward-pointing pike chevron spearhead.
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
    // Octagonal imperial collar + 4 cardinal Cross Pattee reliefs (N, S, E, W at r = 0.41m)
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
      const vBar = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.14, 0.055), accentMat);
      const hBar = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.055, 0.055), accentMat);
      crossGrp.add(vBar, hBar);
      wreath.add(crossGrp);
    }
  } else if (type === 'q') {
    // 8-pointed star coronet ring with 8 glowing pearls around base perimeter (r = 0.41m)
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.38, 0.032, 10, 24),
      primaryMat,
    );
    ring.rotation.x = Math.PI * 0.5;
    ring.position.y = 0.11;
    wreath.add(ring);

    const pointGeo = new THREE.ConeGeometry(0.052, 0.13, 4);
    const pearlGeo = new THREE.SphereGeometry(0.046, 12, 12);
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
    // Thick hexagonal castle battlement wall with 6 tall square merlons (r = 0.40m)
    const wall = new THREE.Mesh(
      new THREE.CylinderGeometry(0.385, 0.405, 0.11, 6),
      primaryMat,
    );
    wall.position.y = 0.105;
    wreath.add(wall);

    const merlonGeo = new THREE.BoxGeometry(0.11, 0.13, 0.085);
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      const merlon = new THREE.Mesh(merlonGeo, accentMat);
      merlon.position.set(Math.cos(ang) * 0.40, 0.175, Math.sin(ang) * 0.40);
      merlon.rotation.y = -ang + Math.PI * 0.5;
      wreath.add(merlon);
    }
  } else if (type === 'b') {
    // 4 mitre-shaped gothic arches + oblique sacred cross on front/back
    const archGeo = new THREE.ConeGeometry(0.062, 0.16, 4);
    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * Math.PI * 2 + Math.PI * 0.25;
      const arch = new THREE.Mesh(archGeo, primaryMat);
      arch.position.set(Math.cos(ang) * 0.39, 0.15, Math.sin(ang) * 0.39);
      wreath.add(arch);
    }
    for (const zSign of [-1, 1]) {
      const crossGrp = new THREE.Group();
      crossGrp.position.set(0, 0.16, zSign * 0.40);
      const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.15, 0.048), accentMat);
      b1.rotation.z = 0.35;
      const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.048, 0.048), accentMat);
      b2.rotation.z = 0.35;
      crossGrp.add(b1, b2);
      wreath.add(crossGrp);
    }
  } else if (type === 'n') {
    // Wide U-shaped Horseshoe track arch around base + 2 protruding stylized horse-head fins on Left/Right (x = ±0.42m)
    const horseshoe = new THREE.Mesh(
      new THREE.TorusGeometry(0.39, 0.042, 10, 24, Math.PI * 1.45),
      primaryMat,
    );
    horseshoe.rotation.x = Math.PI * 0.5;
    horseshoe.rotation.z = -Math.PI * 0.225;
    horseshoe.position.y = 0.11;
    wreath.add(horseshoe);

    for (const xSign of [-1, 1]) {
      const finGrp = new THREE.Group();
      finGrp.position.set(xSign * 0.42, 0.16, 0);
      const neck = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.13, 0.08), accentMat);
      const snout = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.065, 0.12), primaryMat);
      snout.position.set(xSign * 0.03, 0.02, 0.05);
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.08, 5), accentMat);
      ear.position.set(0, 0.09, -0.01);
      finGrp.add(neck, snout, ear);
      wreath.add(finGrp);
    }
  } else {
    // Pawn ('p'): Compact guard ring with forward-pointing pike chevron spearhead
    const guardRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.032, 10, 22),
      primaryMat,
    );
    guardRing.rotation.x = Math.PI * 0.5;
    guardRing.position.y = 0.10;
    wreath.add(guardRing);

    const chevron = new THREE.Mesh(
      new THREE.ConeGeometry(0.065, 0.15, 4),
      accentMat,
    );
    chevron.rotation.x = Math.PI * 0.35;
    chevron.position.set(0, 0.14, 0.35);
    wreath.add(chevron);

    const rearStud = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.08, 0.08),
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
 * Builds the Universal Static 3D Role Add-On mounted in `pieceGroup` at `y = pieceHeight`
 * (outside `bodyContainer` so loading `.glb` NEVER removes it!):
 * - `k`: Single-diadem royal crown halo + Tall Cross Pattee Finial (`+0.28m` high, wide arms `0.26m`).
 * - `q`: Wide 8-Point Splayed Royal Coronet with 8 Pearls (`Ø 0.40m`, radius `0.20m`).
 * - `r`: Wide 6-Merlon Castle Battlement Turret Crown (`Ø 0.42m`, radius `0.21m`).
 * - `b`: Tall Episcopal Mitre Halo + High Golden/Violet Crosier Cross (`+0.26m`).
 * - `n`: WIDE Heraldic Warhorse Crest (`width >= 0.50m` along X axis: twin sculpted horse-head silhouettes + arched mane + horseshoe arch).
 * - `p`: Vertical Swiss-Guard Pike / Halberd Spearhead + Staunton Sphere rising `+0.22m` above the pawn.
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
    color: isWhite ? 0xffd54f : 0x141824,
    roughness: 0.22,
    metalness: 0.62,
    emissive: isWhite ? 0x7a5200 : 0x160f2e,
    emissiveIntensity: 0.44,
  });

  const gemAccentMat = new THREE.MeshStandardMaterial({
    color: isWhite ? 0xfffdf5 : 0x7c4dff,
    roughness: 0.16,
    metalness: 0.35,
    emissive: isWhite ? 0xffca28 : 0x651fff,
    emissiveIntensity: 0.56,
  });

  if (type === 'k') {
    // Single-diadem royal crown halo + Tall Cross Pattee Finial (+0.28m high, wide arms 0.26m)
    const diadem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.175, 0.155, 0.08, 16),
      royalMetalMat,
    );
    diadem.position.y = 0.01;
    const diademRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.17, 0.028, 10, 24),
      gemAccentMat,
    );
    diademRim.rotation.x = Math.PI * 0.5;
    diademRim.position.y = 0.05;

    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.068, 14, 14), gemAccentMat);
    orb.position.y = 0.095;

    const crossVert = new THREE.Mesh(
      new THREE.BoxGeometry(0.062, 0.24, 0.062),
      royalMetalMat,
    );
    crossVert.position.y = 0.16; // reaches +0.28m

    const crossHorizX = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.062, 0.062),
      gemAccentMat,
    );
    crossHorizX.position.y = 0.19;

    const crossHorizZ = new THREE.Mesh(
      new THREE.BoxGeometry(0.062, 0.062, 0.26),
      gemAccentMat,
    );
    crossHorizZ.position.y = 0.19;

    const coreGem = new THREE.Mesh(new THREE.SphereGeometry(0.052, 12, 12), gemAccentMat);
    coreGem.position.y = 0.19;

    addon.add(diadem, diademRim, orb, crossVert, crossHorizX, crossHorizZ, coreGem);
  } else if (type === 'q') {
    // Wide 8-Point Splayed Royal Coronet with 8 Pearls (Ø 0.40m -> radius 0.20m)
    const baseRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.155, 0.028, 10, 24),
      royalMetalMat,
    );
    baseRing.rotation.x = Math.PI * 0.5;
    baseRing.position.y = 0.01;
    addon.add(baseRing);

    const dome = new THREE.Mesh(new THREE.OctahedronGeometry(0.068, 1), gemAccentMat);
    dome.position.y = 0.07;
    addon.add(dome);

    const spikeGeo = new THREE.ConeGeometry(0.038, 0.15, 6);
    const pearlGeo = new THREE.SphereGeometry(0.044, 12, 12);
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const cx = Math.cos(ang);
      const sz = Math.sin(ang);

      const spike = new THREE.Mesh(spikeGeo, royalMetalMat);
      spike.position.set(cx * 0.175, 0.07, sz * 0.175);
      spike.rotation.z = -cx * 0.36;
      spike.rotation.x = sz * 0.36;
      addon.add(spike);

      const pearl = new THREE.Mesh(pearlGeo, gemAccentMat);
      pearl.position.set(cx * 0.20, 0.14, sz * 0.20);
      addon.add(pearl);
    }
  } else if (type === 'r') {
    // Wide 6-Merlon Castle Battlement Turret Crown (Ø 0.42m -> outer radius 0.21m)
    const parapet = new THREE.Mesh(
      new THREE.CylinderGeometry(0.195, 0.17, 0.085, 12),
      royalMetalMat,
    );
    parapet.position.y = 0.02;
    addon.add(parapet);

    const merlonGeo = new THREE.BoxGeometry(0.088, 0.115, 0.072);
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      const merlon = new THREE.Mesh(merlonGeo, gemAccentMat);
      merlon.position.set(Math.cos(ang) * 0.185, 0.095, Math.sin(ang) * 0.185);
      merlon.rotation.y = -ang + Math.PI * 0.5;
      addon.add(merlon);
    }
  } else if (type === 'b') {
    // Tall Episcopal Mitre Halo + High Golden/Violet Crosier Cross (+0.26m)
    const mitreHalo = new THREE.Mesh(
      new THREE.TorusGeometry(0.14, 0.026, 10, 20),
      royalMetalMat,
    );
    mitreHalo.rotation.x = Math.PI * 0.5;
    mitreHalo.position.y = 0.01;

    const mitrePeak = new THREE.Mesh(
      new THREE.ConeGeometry(0.115, 0.15, 12),
      royalMetalMat,
    );
    mitrePeak.position.y = 0.075;

    const crosierShaft = new THREE.Mesh(
      new THREE.BoxGeometry(0.052, 0.22, 0.052),
      gemAccentMat,
    );
    crosierShaft.position.y = 0.15; // reaches +0.26m

    const crosierBeam = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.05, 0.05),
      gemAccentMat,
    );
    crosierBeam.position.y = 0.195;

    const crosierLoop = new THREE.Mesh(
      new THREE.TorusGeometry(0.065, 0.02, 8, 16),
      royalMetalMat,
    );
    crosierLoop.position.y = 0.20;

    addon.add(mitreHalo, mitrePeak, crosierShaft, crosierBeam, crosierLoop);
  } else if (type === 'n') {
    // WIDE Heraldic Warhorse Crest (width >= 0.50m along X axis: twin sculpted horse-head silhouettes + arched mane + horseshoe arch)
    const horseshoeArch = new THREE.Mesh(
      new THREE.TorusGeometry(0.15, 0.032, 10, 20, Math.PI * 1.4),
      royalMetalMat,
    );
    horseshoeArch.rotation.z = -Math.PI * 0.2;
    horseshoeArch.position.y = 0.08;
    addon.add(horseshoeArch);

    const maneCrest = new THREE.Mesh(
      new THREE.BoxGeometry(0.10, 0.16, 0.18),
      gemAccentMat,
    );
    maneCrest.position.set(0, 0.11, -0.02);
    addon.add(maneCrest);

    for (const xSign of [-1, 1]) {
      const horseWing = new THREE.Group();
      // Extends from x = ±0.11m out to x = ±0.27m -> total width = 0.54m (>= 0.50m) along X!
      const neckBlade = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.13, 0.085),
        gemAccentMat,
      );
      neckBlade.position.set(xSign * 0.17, 0.08, 0.01);
      neckBlade.rotation.z = -xSign * 0.22;

      const horseSnout = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.075, 0.14),
        royalMetalMat,
      );
      horseSnout.position.set(xSign * 0.22, 0.065, 0.06);

      const horseEar = new THREE.Mesh(
        new THREE.ConeGeometry(0.036, 0.09, 6),
        gemAccentMat,
      );
      horseEar.position.set(xSign * 0.20, 0.165, -0.01);

      horseWing.add(neckBlade, horseSnout, horseEar);
      addon.add(horseWing);
    }
  } else {
    // Pawn ('p'): Vertical Swiss-Guard Pike / Halberd Spearhead + Staunton Sphere rising +0.22m
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.11, 0.024, 8, 18),
      royalMetalMat,
    );
    collar.rotation.x = Math.PI * 0.5;
    collar.position.y = 0.01;

    const stauntonSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.088, 14, 14),
      gemAccentMat,
    );
    stauntonSphere.position.y = 0.065;

    const pikeSpearhead = new THREE.Mesh(
      new THREE.ConeGeometry(0.055, 0.16, 4),
      royalMetalMat,
    );
    pikeSpearhead.position.y = 0.16; // reaches +0.24m (>= +0.22m)

    const halberdAxe = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.055, 0.032),
      gemAccentMat,
    );
    halberdAxe.position.y = 0.125;

    addon.add(collar, stauntonSphere, pikeSpearhead, halberdAxe);
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
 * Draws a crisp, tournament-grade 2D classic Staunton vector silhouette + Unicode glyph + role letter
 * onto a 2D canvas context so recognition is 100% deterministic even without system Unicode chess fonts.
 *
 * @param {CanvasRenderingContext2D} c
 * @param {number} size
 * @param {string} type
 * @param {boolean} isWhite
 * @param {boolean} [isZenithDisc=true]
 */
function drawTournamentChessIcon2D(c, size, type, isWhite, isZenithDisc = true) {
  const cx = size * 0.5;
  const cy = size * 0.5;
  const r = size * 0.48;

  const bgHex = isWhite ? '#e8dec8' : '#090c14';
  const outerRingHex = isWhite ? '#2a1d08' : '#b388ff';
  const innerRingHex = isWhite ? '#c69214' : '#00e5ff';
  const fgHex = isWhite ? '#070a10' : '#ffffff';
  const strokeAccentHex = isWhite ? '#b8860b' : '#7c4dff';

  c.save();
  c.clearRect(0, 0, size, size);

  if (isZenithDisc) {
    // Fill entire texture with background so cylinder rim & cap edges never bleed
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
  c.lineWidth = size * 0.055;
  c.stroke();

  // Inner ring
  c.beginPath();
  c.arc(cx, cy, size * 0.395, 0, Math.PI * 2);
  c.strokeStyle = innerRingHex;
  c.lineWidth = size * 0.028;
  c.stroke();

  // Vector Staunton Silhouette in upper-center
  c.fillStyle = fgHex;
  c.strokeStyle = strokeAccentHex;
  c.lineWidth = size * 0.012;

  const s = size / 512;
  c.save();
  c.translate(cx, cy - 36 * s);

  if (type === 'k') {
    // Classic King Crown + Tall Cross
    c.fillRect(-14 * s, -148 * s, 28 * s, 72 * s);
    c.fillRect(-44 * s, -126 * s, 88 * s, 26 * s);
    c.beginPath();
    c.moveTo(-110 * s, 68 * s);
    c.lineTo(-128 * s, -48 * s);
    c.quadraticCurveTo(-65 * s, -95 * s, 0, -68 * s);
    c.quadraticCurveTo(65 * s, -95 * s, 128 * s, -48 * s);
    c.lineTo(110 * s, 68 * s);
    c.closePath();
    c.fill();
    c.stroke();
    c.fillRect(-118 * s, 76 * s, 236 * s, 28 * s);
  } else if (type === 'q') {
    // Classic 5-Point Splayed Queen Coronet + 5 Pearls
    const tips = [
      [-126, -56],
      [-66, -96],
      [0, -112],
      [66, -96],
      [126, -56],
    ];
    c.beginPath();
    c.moveTo(-104 * s, 68 * s);
    c.lineTo(tips[0][0] * s, tips[0][1] * s);
    c.lineTo(-76 * s, 12 * s);
    c.lineTo(tips[1][0] * s, tips[1][1] * s);
    c.lineTo(-32 * s, 8 * s);
    c.lineTo(tips[2][0] * s, tips[2][1] * s);
    c.lineTo(32 * s, 8 * s);
    c.lineTo(tips[3][0] * s, tips[3][1] * s);
    c.lineTo(76 * s, 12 * s);
    c.lineTo(tips[4][0] * s, tips[4][1] * s);
    c.lineTo(104 * s, 68 * s);
    c.closePath();
    c.fill();
    c.stroke();
    for (const [tx, ty] of tips) {
      c.beginPath();
      c.arc(tx * s, (ty - 18) * s, 18 * s, 0, Math.PI * 2);
      c.fill();
    }
    c.fillRect(-114 * s, 76 * s, 228 * s, 28 * s);
  } else if (type === 'r') {
    // Classic Crenellated Castle Rook Tower (3 chunky merlons)
    c.beginPath();
    c.moveTo(-106 * s, 72 * s);
    c.lineTo(-86 * s, -36 * s);
    c.lineTo(-110 * s, -36 * s);
    c.lineTo(-110 * s, -108 * s);
    c.lineTo(-54 * s, -108 * s);
    c.lineTo(-54 * s, -68 * s);
    c.lineTo(-26 * s, -68 * s);
    c.lineTo(-26 * s, -108 * s);
    c.lineTo(26 * s, -108 * s);
    c.lineTo(26 * s, -68 * s);
    c.lineTo(54 * s, -68 * s);
    c.lineTo(54 * s, -108 * s);
    c.lineTo(110 * s, -108 * s);
    c.lineTo(110 * s, -36 * s);
    c.lineTo(86 * s, -36 * s);
    c.lineTo(106 * s, 72 * s);
    c.closePath();
    c.fill();
    c.stroke();
    c.fillRect(-118 * s, 78 * s, 236 * s, 28 * s);
  } else if (type === 'b') {
    // Classic Bishop Mitre + Top Orb/Cross + Diagonal Mitre Slash
    c.beginPath();
    c.arc(0, -118 * s, 20 * s, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.moveTo(-88 * s, 68 * s);
    c.quadraticCurveTo(-112 * s, -28 * s, 0, -98 * s);
    c.quadraticCurveTo(112 * s, -28 * s, 88 * s, 68 * s);
    c.closePath();
    c.fill();
    c.stroke();
    // High-contrast liturgical cross/slash inside mitre
    c.fillStyle = bgHex;
    c.fillRect(-12 * s, -54 * s, 24 * s, 78 * s);
    c.fillRect(-38 * s, -28 * s, 76 * s, 24 * s);
    c.fillStyle = fgHex;
    c.fillRect(-108 * s, 76 * s, 216 * s, 28 * s);
  } else if (type === 'n') {
    // Classic Staunton Knight Horse Head Silhouette
    c.beginPath();
    c.moveTo(-96 * s, 72 * s);
    c.quadraticCurveTo(-88 * s, -12 * s, -38 * s, -84 * s);
    c.lineTo(-48 * s, -126 * s);
    c.lineTo(-6 * s, -98 * s);
    c.quadraticCurveTo(72 * s, -96 * s, 108 * s, -18 * s);
    c.lineTo(94 * s, 72 * s);
    c.lineTo(24 * s, 72 * s);
    c.quadraticCurveTo(32 * s, 8 * s, -8 * s, -12 * s);
    c.lineTo(-78 * s, 14 * s);
    c.lineTo(-92 * s, -18 * s);
    c.lineTo(-34 * s, -58 * s);
    c.closePath();
    c.fill();
    c.stroke();
    // Eye cutout
    c.fillStyle = bgHex;
    c.beginPath();
    c.arc(-18 * s, -62 * s, 11 * s, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = fgHex;
    c.fillRect(-112 * s, 76 * s, 224 * s, 28 * s);
  } else {
    // Classic Staunton Pawn (Round Head Sphere + Collar + Tapered Base)
    c.beginPath();
    c.arc(0, -68 * s, 48 * s, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.fillRect(-58 * s, -18 * s, 116 * s, 20 * s);
    c.beginPath();
    c.moveTo(-42 * s, 2 * s);
    c.lineTo(-86 * s, 72 * s);
    c.lineTo(86 * s, 72 * s);
    c.lineTo(42 * s, 2 * s);
    c.closePath();
    c.fill();
    c.fillRect(-102 * s, 76 * s, 204 * s, 28 * s);
  }
  c.restore();

  // Bold Role Letter + Unicode Glyph Pill at bottom
  const glyph = CLASSIC_ROLE_GLYPHS[type] || '♙';
  const letter = CLASSIC_ROLE_LETTERS[type] || 'P';
  c.fillStyle = fgHex;
  c.font = `900 ${Math.round(108 * s)}px system-ui, sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(`${glyph}${letter}`, cx, cy + 126 * s);

  c.restore();
}

/**
 * Builds the Floating 2D Role Billboard (`THREE.Sprite`) at `y = pieceHeight + 0.34m`
 * with headless fallback when `document` is undefined in Node unit tests.
 *
 * @param {typeof import('three')} THREE
 * @param {string} pieceType
 * @param {'w'|'b'} color
 * @param {number} [pieceHeight]
 * @returns {import('three').Sprite}
 */
export function buildFloatingRoleBillboard(THREE, pieceType = 'p', color = 'w', pieceHeight = 0) {
  const type = String(pieceType || 'p').toLowerCase();
  const isWhite = String(color || 'w').toLowerCase() !== 'b';
  const baseHeight = pieceHeight > 0 ? pieceHeight : (CANONICAL_PIECE_HEIGHTS[type] ?? 1.25);
  const glyph = CLASSIC_ROLE_GLYPHS[type] || '♙';
  const letter = CLASSIC_ROLE_LETTERS[type] || 'P';

  let texture;
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const c = canvas.getContext('2d');
    if (c) {
      drawTournamentChessIcon2D(c, 256, type, isWhite, false);
    }
    texture = new THREE.CanvasTexture(canvas);
    if (THREE.SRGBColorSpace) {
      texture.colorSpace = THREE.SRGBColorSpace;
    }
    texture.userData = {
      canvas,
      width: 256,
      height: 256,
      pieceType: type,
      color: isWhite ? 'w' : 'b',
      glyph,
      letter,
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
      letter,
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
    letter,
  };

  return sprite;
}

/**
 * Builds the Flat Horizontal Zenithal 2D/2.5D Classic Tournament Medallion Disc
 * (`CylinderGeometry(0.42, 0.42, 0.04, 32)` at `y = pieceHeight + 0.30m`)
 * with a `512x512` `CanvasTexture` on its top face:
 * - White piece: `#e8dec8` anti-bloom ivory parchment, `#2a1d08` + `#c69214` double ring, bold dark `#070a10` chess icon.
 * - Black piece: `#090c14` pure obsidian background, `#b388ff` + `#00e5ff` double ring, bold `#ffffff` chess icon.
 *
 * @param {typeof import('three')} THREE
 * @param {string} pieceType
 * @param {'w'|'b'} color
 * @param {number} [pieceHeight]
 * @returns {import('three').Mesh}
 */
export function buildZenithal2DClassicDisc(THREE, pieceType = 'p', color = 'w', pieceHeight = 0) {
  const type = String(pieceType || 'p').toLowerCase();
  const isWhite = String(color || 'w').toLowerCase() !== 'b';
  const baseHeight = pieceHeight > 0 ? pieceHeight : (CANONICAL_PIECE_HEIGHTS[type] ?? 1.25);
  const glyph = CLASSIC_ROLE_GLYPHS[type] || '♙';
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
      drawTournamentChessIcon2D(c, 512, type, isWhite, true);
    }
    texture = new THREE.CanvasTexture(canvas);
    if (THREE.SRGBColorSpace) {
      texture.colorSpace = THREE.SRGBColorSpace;
    }
    texture.userData = {
      canvas,
      width: 512,
      height: 512,
      pieceType: type,
      color: isWhite ? 'w' : 'b',
      glyph,
      letter,
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
      letter,
      ...palette,
    };
  }

  const geo = new THREE.CylinderGeometry(0.42, 0.42, 0.04, 32);
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    color: typeof document !== 'undefined' ? (isWhite ? 0xdcd2be : 0xffffff) : isWhite ? 0xdcd2be : 0x090c14,
  });

  const discMesh = new THREE.Mesh(geo, mat);
  discMesh.name = `Zenithal2DClassicDisc_${isWhite ? 'w' : 'b'}_${type}`;
  discMesh.position.set(0, baseHeight + 0.30, 0);
  // Align top-cap UV so canvas top (-Z) is always North/Up in world space
  discMesh.rotation.y = isWhite ? -Math.PI * 0.5 : Math.PI * 0.5;
  discMesh.renderOrder = 15;

  discMesh.userData = {
    isZenithal2dDisc: true,
    pieceType: type,
    color: isWhite ? 'w' : 'b',
    glyph,
    letter,
    ...palette,
  };

  return discMesh;
}

/**
 * Applies high-contrast Faction Albedo & Emissive rules to `.glb` materials so Black pieces
 * never look ivory/white (even when UV-mapped textures or light porcelain accents are present!).
 *
 * - When `!isWhite` and `useObsidianContrast`:
 *   - If `mat.map` is present: sets `mat.color.setHex(0x48506a)`, `mat.emissive.setHex(0x140c2e)`,
 *     `mat.emissiveMap = null`, `mat.emissiveIntensity = 0.14`.
 *   - If `!mat.map`: sets `faction_primary` to `0x0d1017` (pure obsidian), `faction_trim` to `0x7c4dff`
 *     (royal violet-silver), and darkens light porcelain/ivory/linen accent materials
 *     (`accent_porcelain`, `linen_cream`, `burro_muzzle`, `tower_stone`) by `0.38x`.
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

  // Multi-material untextured PBR models (Swamp & Classic families + baked add-ons)
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
