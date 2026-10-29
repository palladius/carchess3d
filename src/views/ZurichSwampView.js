/**
 * @fileoverview ZurichSwampView — "Enchanted Swamp of Zurich (Swamp-on-the-Limmat)" 3D Diorama.
 *
 * Canonical metric layout aligned with `docs/floorplan.svg` (1 unit = 1.0m, board surface y = 0.0m):
 * 1. 8x8 Carved Stone & Marble Altar (`y = 0.0m`):
 *    - 64 bevelled & gold-trimmed squares (`1.0m x 1.0m`, top strictly at `y = 0.0m`,
 *      square `(col, row)` at `(col - 3.5, 0, row - 3.5)`).
 *    - Warm veined ivory-cream marble (`0xf3ebd9`, roughness 0.28, metalness 0.08) and
 *      polished dark slate-obsidian (`0x232938`, roughness 0.22, metalness 0.18).
 *    - Carved dark stone altar border (`9.6m x 9.6m`, depth `y = -0.65m .. 0.0m`) with
 *      glowing golden Nordic/Carlesso family runes and mossy corner stones.
 * 2. 4 Corner Wizard Chess Flaming Braziers at `(±5.2m, y = 1.2m, ±5.2m)`:
 *    - Carved stone pedestals grounded from `y = -0.5m` to iron fire bowls at `y = 1.2m`.
 *    - Multi-layered animated flame cones (`0xff6d00`, `0xffca28`, `0xfff176`) +
 *      4 warm `THREE.PointLight`s (`0xff8f24`, intensity 3.2, distance 18) + rising embers.
 * 3. Foreground Enchanted Swamp Emerald Moat (`r = 6m .. 22m`, `y = -0.45m`):
 *    - Shimmering emerald water plane (`y = -0.45m`) with sunken glowing runes.
 *    - 20 sculpted 3D lily pads with pink/lilac lotus blossoms, cattails/reeds, and
 *      twisted mossy swamp tree roots framing `x = ±7.5m .. ±11m`.
 *    - 64 floating bioluminescent golden-green fireflies (`r = 5.5m .. 15m, y = 0.2m .. 3.5m`).
 * 4. Background Fairy-Tale Zurich Skyline & Limmat (`z = -10.5m .. -26m`):
 *    - Grossmünster Twin Towers at `x = ±5.8m, z = -10.5m` (`h = 11.0m`), framing the 16:9 Cinema Mirror.
 *    - St. Peter Spire at `x = -11.5m, z = -16.0m` (`h = 13.0m`) with giant `Ø 2.4m` golden clock face.
 *    - Fraumünster Spire at `x = +11.5m, z = -16.0m` (`h = 12.5m`) with slender verdigris-emerald spire.
 *    - Old town guild houses along the Limmat (`z = -14m .. -18m`), arched stone bridge, Zurich & Swiss banners.
 *    - Snow-capped Swiss Alps panorama at `z = -25.0m` (`width = 65m, height = 17m`) + starry twilight sky.
 */

import * as THREE from 'three';
import {
  FILES,
  squareToWorld,
  isMobilePhoneViewport,
  isMobileOrTabletDevice,
} from '../core/Registry.js';

const LIGHT_SQUARE_HEX = 0xfafbfd;
const DARK_SQUARE_HEX = 0x111317;
const SELECT_HIGHLIGHT_HEX = 0xffeb3b;
const LEGAL_MOVE_HEX = 0x4cd9a2;
const CAPTURE_MOVE_HEX = 0xff5252;
const CHECK_ALERT_HEX = 0xff1744;

export const ENVIRONMENT_PANORAMAS = Object.freeze({
  zurich: {
    id: 'zurich',
    url: './assets/environments/zurich_panorama.jpg',
    tint: 0xd8e2f0,
    bgColor: 0x0b1528,
  },
  swamp: {
    id: 'swamp',
    url: './assets/environments/swamp_panorama.jpg',
    tint: 0xd8ece0,
    bgColor: 0x071a14,
  },
  positano: {
    id: 'positano',
    url: './assets/environments/positano_panorama.jpg',
    tint: 0xf0e4d8,
    bgColor: 0x0d1b2e,
  },
});

export function normalizeEnvironmentMode(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'swamp' || s === 'palude' || s === 'orchi' || s === 'ogre') return 'swamp';
  if (s === 'positano' || s === 'amalfi' || s === 'italy' || s === 'italia') return 'positano';
  if (s === 'zurich' || s === 'zurigo' || s === 'zuerich') return 'zurich';
  return null;
}

export function resolveEnvironmentForFactions(whiteFamily = 'carlesso', rivalSetMode = 'classic') {
  if (whiteFamily === 'swamp' || rivalSetMode === 'swamp') return 'swamp';
  if (whiteFamily === 'classic') return 'positano';
  return 'zurich';
}

export class ZurichSwampView {
  /**
   * @param {THREE.Scene} scene
   * @param {import('../core/EventBus.js').GameEventBus} [bus]
   */
  constructor(scene, bus = null) {
    this.scene = scene;
    this.bus = bus;
    this.time = 0;

    this.root = new THREE.Group();
    this.root.name = 'ZurichSwampDiorama';
    this.scene.add(this.root);

    /** @type {Array<THREE.Mesh>} 64 raycastable square meshes */
    this.squareMeshes = [];
    /** @type {Map<string, THREE.Mesh>} Algebraic square -> mesh */
    this.squaresByName = new Map();
    /** @type {THREE.Group} Dynamic board highlights (selection, legal moves, check) */
    this.highlightGroup = new THREE.Group();
    this.highlightGroup.name = 'BoardHighlights';
    this.root.add(this.highlightGroup);

    /** @type {Array<THREE.PointLight>} */
    this.brazierLights = [];
    /** @type {Array<object>} */
    this.braziers = [];
    /** @type {Array<THREE.Mesh>} */
    this.banners = [];
    /** @type {Array<THREE.Material>} */
    this.runeMaterials = [];
    /** @type {Array<() => void>} */
    this.offs = [];

    this.debugConfig = {
      sunIntensity: 1.55,
      brazierIntensity: 3.2,
      brazierWarmth: 0.65,
      waterRoughness: 0.16,
    };

    let initialEnv = 'zurich';
    if (typeof window !== 'undefined' && window.location?.search) {
      const sp = new URLSearchParams(window.location.search);
      const explicitEnv = normalizeEnvironmentMode(sp.get('env') || sp.get('bg') || sp.get('map'));
      if (explicitEnv) {
        initialEnv = explicitEnv;
      } else {
        const wFam = sp.get('white') || sp.get('family') || 'carlesso';
        const bFam = sp.get('black') || sp.get('rival') || 'classic';
        initialEnv = resolveEnvironmentForFactions(wFam, bFam);
      }
    }
    /** @type {'zurich'|'swamp'|'positano'} */
    this.environmentMode = initialEnv;
    /** @type {Map<string, THREE.Texture>} */
    this._panoTextures = new Map();

    const initialSpec = ENVIRONMENT_PANORAMAS[this.environmentMode] || ENVIRONMENT_PANORAMAS.zurich;
    let initialStyle = 'painting';
    if (typeof window !== 'undefined' && window.location?.search) {
      const sp = new URLSearchParams(window.location.search);
      const qStyle = (sp.get('zurichStyle') || sp.get('backdrop') || '').toLowerCase();
      if (qStyle === 'relief' || qStyle === 'hybrid' || qStyle === 'painting') {
        initialStyle = qStyle;
      }
    }
    this.backdropStyle = initialStyle;
    this.combatBlend = 0.0;
    this.inCombatCinemaMode = false;
    this._zurichBgColor = new THREE.Color(initialSpec.bgColor);
    this._combatBgColor = new THREE.Color(0x05070e);
    this._dioramaFadeReady = false;
    this._dioramaGroups = [];
    this._dioramaMaterials = [];
    this.horizonYaw = 0.0;
    this.jumpingFrogs = [];
    this.swimmingFish = [];
    this.pondRipples = [];

    if (this.scene) {
      this.scene.userData = this.scene.userData || {};
      this.scene.userData.applySwampCombatBlend = (b) => this.setCombatBlend(b);
    }

    this.buildLightingAndSky();
    this.buildCarvedStoneAltar();
    this.buildCornerBraziers();
    this.buildEnchantedSwampMoat();
    this.buildFireflies();
    this.buildZurichSkylineAndAlps();
    this.setZurichBackdropStyle(this.backdropStyle);
    this.bindEvents();
  }

  // ===========================================================================
  // 0. LIGHTING & TWILIGHT SKY DOME
  // ===========================================================================

  buildLightingAndSky() {
    if (!this.scene.fog) {
      this.scene.fog = new THREE.FogExp2(0x0d1b2e, 0.011);
    }
    if (!this.scene.background) {
      this.scene.background = new THREE.Color(0x0b1528);
    }

    // Hemisphere twilight fill (deep alpine sky above, emerald swamp bounce below)
    this.hemiLight = new THREE.HemisphereLight(0xbbe0ff, 0x1d6b52, 1.32);
    this.hemiLight.position.set(0, 22, 0);
    this.root.add(this.hemiLight);

    // Moonlight / Alpine twilight directional light casting crisp piece shadows on y = 0.0m
    const isPhone = isMobilePhoneViewport();
    const isMobileOrTablet = isMobileOrTabletDevice();
    this.sunLight = new THREE.DirectionalLight(0xeef6ff, Math.max(2.15, this.debugConfig.sunIntensity));
    this.sunLight.position.set(8.5, 16.0, 9.5);
    this.sunLight.castShadow = !isPhone;
    const shadowRes = isMobileOrTablet ? 1024 : 2048;
    this.sunLight.shadow.mapSize.set(shadowRes, shadowRes);
    this.sunLight.shadow.camera.near = 2.0;
    this.sunLight.shadow.camera.far = 42.0;
    const d = 11.0;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.root.add(this.sunLight);

    // Warm torch/hearth front-fill light from South-West (+Z) so hero faces & dragons glow warmly
    this.frontFillLight = new THREE.DirectionalLight(0xfff0d4, 0.95);
    this.frontFillLight.position.set(-4.5, 7.5, 13.0);
    this.root.add(this.frontFillLight);

    // Subtle cool rim light from the North (-Z) so dark obsidian pieces pop against the swamp
    this.rimLight = new THREE.DirectionalLight(0x82b1ff, 0.72);
    this.rimLight.position.set(-6, 9, -12);
    this.root.add(this.rimLight);

    // Starry Twilight Sky Dome + Crescent Moon over Zurich
    const skyGeo = new THREE.SphereGeometry(52, 32, 20);
    const skyTex = this.createStarrySkyTexture();
    const skyMat = new THREE.MeshBasicMaterial({
      map: skyTex,
      color: skyTex ? 0xffffff : 0x0d172a,
      side: THREE.BackSide,
      depthWrite: false,
    });
    this.skyDome = new THREE.Mesh(skyGeo, skyMat);
    this.skyDome.name = 'TwilightSkyDome';
    this.root.add(this.skyDome);

    // Glowing Alpine Full/Crescent Moon at (-14.5, 11.2, -26.0) framed in overview
    const moonGroup = new THREE.Group();
    moonGroup.name = 'AlpineMoonGroup';
    moonGroup.position.set(-14.5, 11.2, -26.0);
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xfff6d6 });
    const moonMesh = new THREE.Mesh(new THREE.CircleGeometry(1.75, 32), moonMat);
    moonGroup.add(moonMesh);

    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x9ec5ff,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const haloMesh = new THREE.Mesh(new THREE.CircleGeometry(3.8, 32), haloMat);
    haloMesh.position.z = -0.05;
    moonGroup.add(haloMesh);
    this.moonGroup = moonGroup;
    this.root.add(moonGroup);
  }

  // ===========================================================================
  // 1. 8x8 CARVED STONE & MARBLE ALTAR (y = 0.0m)
  // ===========================================================================

  buildCarvedStoneAltar() {
    const altarGroup = new THREE.Group();
    altarGroup.name = 'CarvedStoneAltar';
    this.root.add(altarGroup);

    // Stone Sanctuary Island tucked cleanly under the 9.6m x 9.6m foundation (y = -0.55m .. -0.14m)
    const islandGeo = new THREE.CylinderGeometry(4.5, 4.7, 0.42, 24);
    islandGeo.translate(0, -0.35, 0);
    const islandMat = new THREE.MeshStandardMaterial({
      color: 0x2c3844,
      roughness: 0.82,
      metalness: 0.10,
    });
    const islandMesh = new THREE.Mesh(islandGeo, islandMat);
    islandMesh.receiveShadow = true;
    altarGroup.add(islandMesh);
    this.islandMesh = islandMesh;

    // Carved dark stone altar border (9.6m x 9.6m, depth y = -0.65m .. 0.0m)
    const foundationGeo = new THREE.BoxGeometry(9.6, 0.58, 9.6);
    foundationGeo.translate(0, -0.36, 0); // y = -0.65m .. -0.07m
    const runeFriezeTex = this.createRuneFriezeTexture();
    const foundationMat = new THREE.MeshStandardMaterial({
      color: 0x1e242d,
      roughness: 0.62,
      metalness: 0.16,
      map: runeFriezeTex,
      emissive: new THREE.Color(0xb0bec5),
      emissiveMap: runeFriezeTex,
      emissiveIntensity: 0.45,
    });
    this.runeMaterials.push(foundationMat);
    const foundationMesh = new THREE.Mesh(foundationGeo, foundationMat);
    foundationMesh.receiveShadow = true;
    foundationMesh.castShadow = true;
    altarGroup.add(foundationMesh);
    this.foundationMesh = foundationMesh;

    // 4 Carved Rune Border Rim Beams (0.8m wide around the 8.0m x 8.0m board, top at y = 0.0m)
    const topRuneTexH = this.createBorderTopTexture('horizontal');
    const topRuneTexV = this.createBorderTopTexture('vertical');

    const borderMatH = new THREE.MeshStandardMaterial({
      color: 0x242a33,
      roughness: 0.45,
      metalness: 0.22,
      map: topRuneTexH,
      emissive: new THREE.Color(0xb0bec5),
      emissiveMap: topRuneTexH,
      emissiveIntensity: 0.35,
    });
    const borderMatV = new THREE.MeshStandardMaterial({
      color: 0x242a33,
      roughness: 0.45,
      metalness: 0.22,
      map: topRuneTexV,
      emissive: new THREE.Color(0xb0bec5),
      emissiveMap: topRuneTexV,
      emissiveIntensity: 0.35,
    });
    this.runeMaterials.push(borderMatH, borderMatV);
    this.borderMatH = borderMatH;
    this.borderMatV = borderMatV;

    this.altarBorderMeshes = [];

    // North & South rims (9.6m x 0.08m x 0.8m, centered at z = ±4.4m, top at y = 0.0m)
    const nsGeo = new THREE.BoxGeometry(9.6, 0.08, 0.8);
    nsGeo.translate(0, -0.04, 0);
    for (const zPos of [-4.4, 4.4]) {
      const rim = new THREE.Mesh(nsGeo, borderMatH);
      rim.position.set(0, 0, zPos);
      rim.receiveShadow = true;
      altarGroup.add(rim);
      this.altarBorderMeshes.push(rim);
    }

    // West & East rims (0.8m x 0.08m x 8.0m, centered at x = ±4.4m, top at y = 0.0m)
    const weGeo = new THREE.BoxGeometry(0.8, 0.08, 8.0);
    weGeo.translate(0, -0.04, 0);
    for (const xPos of [-4.4, 4.4]) {
      const rim = new THREE.Mesh(weGeo, borderMatV);
      rim.position.set(xPos, 0, 0);
      rim.receiveShadow = true;
      altarGroup.add(rim);
      this.altarBorderMeshes.push(rim);
    }

    // Outer Silver-Platinum Bevel Molding framing the 8.0m x 8.0m board & 9.6m x 9.6m altar
    const goldTrimMat = new THREE.MeshStandardMaterial({
      color: 0xcfd8dc,
      roughness: 0.26,
      metalness: 0.55,
      emissive: 0x263238,
      emissiveIntensity: 0.35,
    });
    this.goldTrimMat = goldTrimMat;

    // Mossy Corner Stones & Stepped Buttresses grounded at y = -0.5m .. 0.0m
    const mossStoneMat = new THREE.MeshStandardMaterial({
      color: 0x333d47,
      roughness: 0.80,
      metalness: 0.10,
    });
    this.mossStoneMat = mossStoneMat;
    const cornerOffsets = [
      [-4.65, -4.65],
      [4.65, -4.65],
      [-4.65, 4.65],
      [4.65, 4.65],
    ];
    for (const [cx, cz] of cornerOffsets) {
      const cornerGeo = new THREE.BoxGeometry(0.62, 0.52, 0.62);
      cornerGeo.translate(0, -0.25, 0); // y = -0.51m .. +0.01m
      const cornerStone = new THREE.Mesh(cornerGeo, mossStoneMat);
      cornerStone.position.set(cx, 0, cz);
      cornerStone.receiveShadow = true;
      cornerStone.castShadow = true;
      altarGroup.add(cornerStone);
      this.altarBorderMeshes.push(cornerStone);

      // Silver-platinum corner cap medallion at y = 0.015m
      const capGeo = new THREE.CylinderGeometry(0.22, 0.26, 0.03, 8);
      const cap = new THREE.Mesh(capGeo, goldTrimMat);
      cap.position.set(cx, 0.015, cz);
      altarGroup.add(cap);
      this.altarBorderMeshes.push(cap);
    }

    // High-resolution procedural marble textures for Bianco Carrara & Nero Marquina
    const lightMarbleTex = this.createMarbleTexture('light');
    const darkMarbleTex = this.createMarbleTexture('dark');

    // 64 Bevelled / Framed Chess Squares (1.0m x 1.0m, top surface strictly at y = 0.0m)
    const tileThickness = 0.08;
    const squareGeo = new THREE.BoxGeometry(0.965, tileThickness, 0.965);
    squareGeo.translate(0, -tileThickness / 2, 0);

    // Micro-thin dark obsidian slate grout frame around each square at y = 0.001m (no yellow/gold borders)
    const inlayFrameGeo = new THREE.RingGeometry(0.468, 0.495, 4);
    inlayFrameGeo.rotateZ(Math.PI / 4);
    inlayFrameGeo.rotateX(-Math.PI / 2);

    const squaresContainer = new THREE.Group();
    squaresContainer.name = 'ChessSquares64';
    altarGroup.add(squaresContainer);

    const inlayContainer = new THREE.Group();
    inlayContainer.name = 'MarbleTileSeams';
    altarGroup.add(inlayContainer);
    this.squareInlayMat = new THREE.MeshStandardMaterial({
      color: 0x141820,
      roughness: 0.85,
      metalness: 0.12,
    });

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const isLight = (col + row) % 2 === 0;
        const baseColor = isLight ? LIGHT_SQUARE_HEX : DARK_SQUARE_HEX;
        const rank = 8 - row;
        const square = `${FILES[col]}${rank}`;

        const mat = new THREE.MeshStandardMaterial({
          color: baseColor,
          map: isLight ? lightMarbleTex : darkMarbleTex,
          roughness: isLight ? 0.18 : 0.14,
          metalness: isLight ? 0.04 : 0.08,
        });

        const sqMesh = new THREE.Mesh(squareGeo, mat);
        sqMesh.position.set(col - 3.5, 0, row - 3.5);
        sqMesh.receiveShadow = true;
        sqMesh.name = `Square_${square}`;
        sqMesh.userData = {
          square,
          col,
          row,
          baseColor,
          isLight,
        };

        squaresContainer.add(sqMesh);
        this.squareMeshes.push(sqMesh);
        this.squaresByName.set(square, sqMesh);

        // Dark obsidian slate tile seam at y = 0.001m
        const inlay = new THREE.Mesh(inlayFrameGeo, this.squareInlayMat);
        inlay.position.set(col - 3.5, 0.001, row - 3.5);
        inlay.receiveShadow = true;
        inlayContainer.add(inlay);
      }
    }
  }

  // ===========================================================================
  // 2. 4 CORNER WIZARD CHESS FLAMING BRAZIERS
  // ===========================================================================

  buildCornerBraziers() {
    const brazierGroup = new THREE.Group();
    brazierGroup.name = 'WizardCornerBraziers';
    this.root.add(brazierGroup);

    const stonePedestalMat = new THREE.MeshStandardMaterial({
      color: 0x453b32,
      roughness: 0.72,
      metalness: 0.16,
    });
    const ironBowlMat = new THREE.MeshStandardMaterial({
      color: 0x262c36,
      roughness: 0.38,
      metalness: 0.48,
    });
    const coalMat = new THREE.MeshBasicMaterial({
      color: 0xff5722,
    });

    const outerFlameMat = new THREE.MeshBasicMaterial({
      color: 0xff6d00,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const midFlameMat = new THREE.MeshBasicMaterial({
      color: 0xffca28,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const coreFlameMat = new THREE.MeshBasicMaterial({
      color: 0xfff176,
      transparent: true,
      opacity: 0.96,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const corners = [
      { id: 'NW', x: -4.95, z: -4.85, phase: 0.0 },
      { id: 'NE', x: 4.95, z: -4.85, phase: 1.7 },
      { id: 'SW', x: -4.95, z: 4.75, phase: 3.1 },
      { id: 'SE', x: 4.95, z: 4.75, phase: 4.8 },
    ];

    for (const c of corners) {
      const unit = new THREE.Group();
      unit.name = `Brazier_${c.id}`;
      unit.position.set(c.x, 0, c.z);

      // 1. Stepped stone pedestal base grounded at y = -0.5m up to y = 1.05m
      const plinthGeo = new THREE.BoxGeometry(0.92, 0.35, 0.92);
      plinthGeo.translate(0, -0.325, 0); // y = -0.50m .. -0.15m
      const plinth = new THREE.Mesh(plinthGeo, stonePedestalMat);
      plinth.castShadow = true;
      plinth.receiveShadow = true;
      unit.add(plinth);

      const shaftGeo = new THREE.CylinderGeometry(0.28, 0.38, 1.15, 10);
      shaftGeo.translate(0, 0.425, 0); // y = -0.15m .. +1.00m
      const shaft = new THREE.Mesh(shaftGeo, stonePedestalMat);
      shaft.castShadow = true;
      shaft.receiveShadow = true;
      unit.add(shaft);

      // Ornate golden rune collar at y = 0.96m
      const collarGeo = new THREE.TorusGeometry(0.31, 0.045, 8, 16);
      collarGeo.rotateX(Math.PI / 2);
      const collar = new THREE.Mesh(collarGeo, this.goldTrimMat);
      collar.position.y = 0.96;
      unit.add(collar);

      // 2. Forged iron fire bowl centered at y = 1.2m
      const bowlGeo = new THREE.CylinderGeometry(0.52, 0.24, 0.32, 12);
      const bowl = new THREE.Mesh(bowlGeo, ironBowlMat);
      bowl.position.y = 1.14;
      bowl.castShadow = true;
      unit.add(bowl);

      const coalBed = new THREE.Mesh(new THREE.CircleGeometry(0.44, 12), coalMat);
      coalBed.rotation.x = -Math.PI / 2;
      coalBed.position.y = 1.29;
      unit.add(coalBed);

      // 3. Multi-layered animated flame cones at y = 1.2m+
      const flameRoot = new THREE.Group();
      flameRoot.position.y = 1.25;
      unit.add(flameRoot);

      const outerGeo = new THREE.ConeGeometry(0.38, 0.88, 9);
      outerGeo.translate(0, 0.42, 0);
      const outerCone = new THREE.Mesh(outerGeo, outerFlameMat);
      flameRoot.add(outerCone);

      const midGeo = new THREE.ConeGeometry(0.26, 0.68, 8);
      midGeo.translate(0, 0.34, 0);
      const midCone = new THREE.Mesh(midGeo, midFlameMat);
      flameRoot.add(midCone);

      const coreGeo = new THREE.ConeGeometry(0.14, 0.46, 8);
      coreGeo.translate(0, 0.22, 0);
      const coreCone = new THREE.Mesh(coreGeo, coreFlameMat);
      flameRoot.add(coreCone);

      // Rising ember orbs
      const embers = [];
      const emberGeo = new THREE.SphereGeometry(0.035, 6, 6);
      for (let i = 0; i < 6; i++) {
        const ember = new THREE.Mesh(emberGeo, i % 2 === 0 ? midFlameMat : coreFlameMat);
        ember.position.set(
          Math.cos(i * 1.05) * 0.16,
          0.3 + i * 0.18,
          Math.sin(i * 1.05) * 0.16,
        );
        flameRoot.add(ember);
        embers.push({ mesh: ember, seed: i * 1.3 + c.phase });
      }

      // 4. Warm PointLight (0xff8f24, intensity 3.2, distance 18)
      const light = new THREE.PointLight(0xff8f24, this.debugConfig.brazierIntensity, 18, 1.5);
      light.position.set(0, 1.65, 0);
      light.visible = !isMobilePhoneViewport();
      unit.add(light);

      brazierGroup.add(unit);
      this.brazierLights.push(light);
      this.braziers.push({
        unit,
        flameRoot,
        outerCone,
        midCone,
        coreCone,
        embers,
        light,
        phase: c.phase,
      });
    }
  }

  // ===========================================================================
  // 3. FOREGROUND ENCHANTED SWAMP EMERALD MOAT (r = 6m .. 22m, y = -0.45m)
  // ===========================================================================

  buildEnchantedSwampMoat() {
    const swampGroup = new THREE.Group();
    swampGroup.name = 'EnchantedSwampMoat';
    this.root.add(swampGroup);
    this.swampGroup = swampGroup;

    // 1. Deep Underwater Seabed Basin at y = -1.15m (visible through the translucent emerald water!)
    const seabedTex = this.createSwampSeabedTexture();
    const seabedMat = new THREE.MeshStandardMaterial({
      color: 0x0a2e26,
      map: seabedTex,
      roughness: 0.85,
      metalness: 0.08,
      emissive: new THREE.Color(0x073b32),
      emissiveMap: seabedTex,
      emissiveIntensity: 0.72,
    });
    const seabedGeo = new THREE.RingGeometry(5.2, 10.7, 64, 4);
    seabedGeo.rotateX(-Math.PI / 2);
    this.seabedMesh = new THREE.Mesh(seabedGeo, seabedMat);
    this.seabedMesh.name = 'SwampUnderwaterSeabed';
    this.seabedMesh.position.y = -1.15;
    this.seabedMesh.receiveShadow = true;
    swampGroup.add(this.seabedMesh);

    // Underwater pebbles, glowing aquamarine crystals & swaying kelp fronds on the seabed (y = -1.15m .. -0.55m)
    const pebbleMat = new THREE.MeshStandardMaterial({
      color: 0x1e4d42,
      roughness: 0.75,
      metalness: 0.12,
    });
    const aquaCrystalMat = new THREE.MeshStandardMaterial({
      color: 0x00ffc8,
      roughness: 0.18,
      metalness: 0.35,
      emissive: 0x00e5ff,
      emissiveIntensity: 1.15,
    });
    const kelpMat = new THREE.MeshStandardMaterial({
      color: 0x1de9b6,
      roughness: 0.55,
      emissive: 0x00bfa5,
      emissiveIntensity: 0.45,
    });
    this.underwaterKelp = [];
    for (let k = 0; k < 28; k++) {
      const ang = (k / 28) * Math.PI * 2 + (k % 3) * 0.11;
      const rad = 6.1 + ((k * 43) % 100) * 0.036;
      const kx = Math.cos(ang) * rad;
      const kz = Math.sin(ang) * rad;

      const pebble = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22 + (k % 3) * 0.08, 1), pebbleMat);
      pebble.scale.set(1.3, 0.55, 1.1);
      pebble.position.set(kx, -1.10, kz);
      swampGroup.add(pebble);

      if (k % 2 === 0) {
        const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.16 + (k % 3) * 0.05, 0), aquaCrystalMat);
        crystal.scale.set(0.75, 1.65, 0.75);
        crystal.position.set(kx + 0.12, -0.96, kz - 0.08);
        crystal.rotation.set(0.2, ang, -0.18);
        swampGroup.add(crystal);
      }

      const frondH = 0.52 + (k % 3) * 0.12;
      const frond = new THREE.Mesh(new THREE.ConeGeometry(0.065, frondH, 5), kelpMat);
      frond.position.set(kx - 0.1, -1.12 + frondH * 0.5, kz + 0.1);
      swampGroup.add(frond);
      this.underwaterKelp.push({ mesh: frond, baseRotZ: (k % 2 === 0 ? 1 : -1) * 0.12, phase: k * 0.7 });
    }

    // 2. Volumetric 3D Liquid Body Layer (y = -1.14m .. -0.45m) giving true 3D water thickness & refraction feel
    const waterTex = this.createSwampWaterTexture();
    this.waterTexture = waterTex;
    this.waterBodyMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x0d7a5f,
      transparent: true,
      opacity: 0.36,
      roughness: 0.22,
      metalness: 0.08,
      emissive: new THREE.Color(0x064e3e),
      emissiveIntensity: 0.45,
      depthWrite: false,
    });
    const waterBodyGeo = new THREE.CylinderGeometry(10.55, 10.55, 0.68, 64, 1, false);
    this.waterBodyMesh = new THREE.Mesh(waterBodyGeo, this.waterBodyMaterial);
    this.waterBodyMesh.name = 'SwampVolumetric3DWaterBody';
    this.waterBodyMesh.position.y = -0.80;
    swampGroup.add(this.waterBodyMesh);

    // 3. Semi-Transparent 3D Wave-Animated Emerald Water Surface at y = -0.45m
    this.waterMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x18b88a,
      map: waterTex,
      transparent: true,
      opacity: 0.64,
      roughness: 0.10,
      metalness: 0.15,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      emissive: new THREE.Color(0x0c5944),
      emissiveMap: waterTex,
      emissiveIntensity: 0.68,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    // Compact moat ring around the 9.6m altar (r = 5.4m .. 10.6m) so the outer 180° Zurich/Limmat
    // cyclorama painting remains 100% visible around the background and sides!
    const waterGeo = new THREE.RingGeometry(5.4, 10.6, 96, 28);
    waterGeo.rotateX(-Math.PI / 2);
    const wPos = waterGeo.getAttribute('position');
    this.waterBaseXZ = new Float32Array(wPos.count * 2);
    for (let idx = 0; idx < wPos.count; idx++) {
      this.waterBaseXZ[idx * 2] = wPos.getX(idx);
      this.waterBaseXZ[idx * 2 + 1] = wPos.getZ(idx);
    }
    this.waterMesh = new THREE.Mesh(waterGeo, this.waterMaterial);
    this.waterMesh.name = 'SwampTranslucent3DWaterSurface';
    this.waterMesh.position.y = -0.45;
    this.waterMesh.receiveShadow = true;
    swampGroup.add(this.waterMesh);

    // No giant board-centered rings! Wave crests are localized around random insect/animal water touches.
    this.waveCrestRings = [];
    this.sunkenRuneMat = null;

    // 24 Sculpted 3D Lily Pads + Pink/Lilac/Golden Lotus Blossoms (r = 6.6m .. 15.5m)
    const padMat = new THREE.MeshStandardMaterial({
      color: 0x2a9d5c,
      roughness: 0.48,
      metalness: 0.08,
      emissive: 0x0c3d22,
      emissiveIntensity: 0.28,
    });
    const padRimMat = new THREE.MeshStandardMaterial({
      color: 0x4cd9a2,
      roughness: 0.4,
      emissive: 0x1b5e3a,
      emissiveIntensity: 0.35,
    });
    const petalPinkMat = new THREE.MeshStandardMaterial({
      color: 0xf48fb1,
      roughness: 0.30,
      emissive: 0x880e4f,
      emissiveIntensity: 0.42,
    });
    const petalLilacMat = new THREE.MeshStandardMaterial({
      color: 0xce93d8,
      roughness: 0.30,
      emissive: 0x4a148c,
      emissiveIntensity: 0.42,
    });
    const lotusCoreMat = new THREE.MeshBasicMaterial({ color: 0xffee58 });

    this.lilyPads = [];
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2 + (i % 3) * 0.14;
      const radius = 6.25 + ((i * 37) % 100) * 0.036; // 6.25m .. 9.85m
      const lx = Math.cos(angle) * radius;
      const lz = Math.sin(angle) * radius;
      const padRadius = 0.46 + (i % 4) * 0.12;

      const padGroup = new THREE.Group();
      padGroup.position.set(lx, -0.432, lz);
      padGroup.rotation.y = angle * 1.7;

      // Notched lily pad cylinder (pacman slice 0 .. 1.88*PI)
      const padGeo = new THREE.CylinderGeometry(
        padRadius,
        padRadius * 0.95,
        0.032,
        18,
        1,
        false,
        0,
        Math.PI * 1.86,
      );
      const padMesh = new THREE.Mesh(padGeo, padMat);
      padMesh.receiveShadow = true;
      padGroup.add(padMesh);

      // Subtle glowing rim vein on lily pad
      const rimRing = new THREE.Mesh(
        new THREE.RingGeometry(padRadius * 0.85, padRadius * 0.96, 16, 1, 0, Math.PI * 1.84),
        padRimMat,
      );
      rimRing.rotation.x = -Math.PI / 2;
      rimRing.position.y = 0.017;
      padGroup.add(rimRing);

      // Add sculpted double-layered lotus flower on every second pad
      if (i % 2 === 0) {
        const lotus = new THREE.Group();
        lotus.position.y = 0.022;
        const pMat = i % 4 === 0 ? petalPinkMat : petalLilacMat;
        const petalGeo = new THREE.ConeGeometry(0.09, 0.25, 5);
        petalGeo.translate(0, 0.095, 0);
        for (let p = 0; p < 8; p++) {
          const petal = new THREE.Mesh(petalGeo, pMat);
          petal.rotation.y = (p / 8) * Math.PI * 2;
          petal.rotation.z = 0.46;
          lotus.add(petal);
        }
        for (let p = 0; p < 5; p++) {
          const innerPetal = new THREE.Mesh(petalGeo, pMat);
          innerPetal.scale.setScalar(0.75);
          innerPetal.rotation.y = ((p + 0.5) / 5) * Math.PI * 2;
          innerPetal.rotation.z = 0.24;
          lotus.add(innerPetal);
        }
        const center = new THREE.Mesh(new THREE.SphereGeometry(0.072, 10, 10), lotusCoreMat);
        center.position.y = 0.055;
        lotus.add(center);
        padGroup.add(lotus);
      }

      swampGroup.add(padGroup);
      this.lilyPads.push({
        group: padGroup,
        x: lx,
        z: lz,
        baseY: -0.432,
        phase: i * 0.85,
      });
    }

    // Cattails / Swamp Reeds clusters + Twisted Mossy Swamp Tree Roots + Bioluminescent Mushrooms
    const reedStemMat = new THREE.MeshStandardMaterial({ color: 0x357a46, roughness: 0.72 });
    const reedHeadMat = new THREE.MeshStandardMaterial({ color: 0x5c3d33, roughness: 0.82 });
    const rootWoodMat = new THREE.MeshStandardMaterial({
      color: 0x473628,
      roughness: 0.82,
      emissive: 0x142416,
      emissiveIntensity: 0.22,
    });
    const mushroomStemMat = new THREE.MeshStandardMaterial({
      color: 0xe0f2f1,
      roughness: 0.5,
      emissive: 0x26a69a,
      emissiveIntensity: 0.35,
    });
    const mushroomCapCyanMat = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      roughness: 0.25,
      emissive: 0x00b8d4,
      emissiveIntensity: 0.85,
    });
    const mushroomCapGoldMat = new THREE.MeshStandardMaterial({
      color: 0xffea00,
      roughness: 0.25,
      emissive: 0xffab00,
      emissiveIntensity: 0.85,
    });
    const mossBoulderMat = new THREE.MeshStandardMaterial({
      color: 0x284b3a,
      roughness: 0.78,
      metalness: 0.08,
    });

    const rootClusters = [
      { x: -8.4, z: 3.6, rot: 0.4 },
      { x: 8.4, z: 3.6, rot: -0.4 },
      { x: -9.6, z: -2.5, rot: 0.9 },
      { x: 9.6, z: -2.5, rot: -0.9 },
      { x: -7.8, z: -6.8, rot: 1.2 },
      { x: 7.8, z: -6.8, rot: -1.2 },
      { x: -6.8, z: 7.4, rot: 0.65 },
      { x: 6.8, z: 7.4, rot: -0.65 },
    ];

    for (let cIdx = 0; cIdx < rootClusters.length; cIdx++) {
      const rc = rootClusters[cIdx];
      const cluster = new THREE.Group();
      cluster.position.set(rc.x, -0.45, rc.z);
      cluster.rotation.y = rc.rot;

      // Mossy shoreline boulder base
      const boulder = new THREE.Mesh(new THREE.DodecahedronGeometry(0.48, 1), mossBoulderMat);
      boulder.scale.set(1.3, 0.65, 1.1);
      boulder.position.set(0, 0.12, 0);
      cluster.add(boulder);

      // Twisted gnarled swamp root arch
      const archGeo = new THREE.TorusGeometry(0.95, 0.16, 8, 18, Math.PI);
      const arch = new THREE.Mesh(archGeo, rootWoodMat);
      arch.castShadow = true;
      cluster.add(arch);

      // Bioluminescent fairy mushrooms growing on the mossy roots
      for (let m = 0; m < 3; m++) {
        const mGroup = new THREE.Group();
        const mx = (m - 1) * 0.32;
        const mz = 0.24 + (m % 2) * 0.14;
        const mScale = 0.75 + (m % 2) * 0.35;
        mGroup.position.set(mx, 0.18, mz);
        mGroup.scale.setScalar(mScale);

        const mStem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.18, 8), mushroomStemMat);
        mStem.position.y = 0.09;
        const mCap = new THREE.Mesh(
          new THREE.SphereGeometry(0.11, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.58),
          (cIdx + m) % 2 === 0 ? mushroomCapCyanMat : mushroomCapGoldMat,
        );
        mCap.position.y = 0.16;
        mGroup.add(mStem, mCap);
        cluster.add(mGroup);
      }

      // Cattail reeds around the root base
      for (let r = 0; r < 5; r++) {
        const rx = (r - 2) * 0.28;
        const rz = (r % 2 === 0 ? 1 : -1) * 0.22;
        const h = 1.15 + (r % 3) * 0.28;
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.032, h, 6), reedStemMat);
        stem.position.set(rx, h / 2, rz);
        stem.rotation.z = (r - 2) * 0.06;
        cluster.add(stem);

        const spike = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.25, 8), reedHeadMat);
        spike.position.set(rx, h - 0.18, rz);
        cluster.add(spike);
      }

      swampGroup.add(cluster);
    }

    // -------------------------------------------------------------------------
    // 3C. LIVING SWAMP FAUNA: JUMPING FROGS, KOI/GOLDEN FISH & WATER RIPPLES!
    // -------------------------------------------------------------------------
    this.buildPondFrogsAndFish(swampGroup);
  }

  /**
   * Populates the Enchanted Swamp Moat with:
   * - 6 sculpted 3D Emerald Tree Frogs (`this.jumpingFrogs`) that leap in parabolic arcs
   *   between lily pads and out of the water with animated hind legs and vocal throat sacs!
   * - 8 sculpted 3D Golden-Orange & Silver-Blue Koi/Trout Fish (`this.swimmingFish`) that
   *   swim in graceful orbits around the island and periodically breach/jump above the surface!
   * - Animated expanding turquoise water splash ripple rings (`this.pondRipples`) at jump spots!
   * @param {THREE.Group} swampGroup
   */
  buildPondFrogsAndFish(swampGroup) {
    this.jumpingFrogs = [];
    this.swimmingFish = [];
    this.pondRipples = [];

    const frogBodyMat = new THREE.MeshStandardMaterial({
      color: 0x43e97b,
      roughness: 0.32,
      metalness: 0.08,
      emissive: 0x0f5228,
      emissiveIntensity: 0.35,
    });
    const frogBellyMat = new THREE.MeshStandardMaterial({
      color: 0xfff59d,
      roughness: 0.45,
      emissive: 0xfbc02d,
      emissiveIntensity: 0.25,
    });
    const frogEyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const frogPupilMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const frogCrownMat = new THREE.MeshStandardMaterial({
      color: 0xffd54f,
      roughness: 0.22,
      metalness: 0.85,
      emissive: 0xff8f00,
      emissiveIntensity: 0.45,
    });

    const rippleGeo = new THREE.RingGeometry(0.18, 0.26, 24);
    rippleGeo.rotateX(-Math.PI / 2);

    // 1. Create 6 Jumping Enchanted Swamp Frogs hopping across lily-pad arcs
    const frogCount = 6;
    for (let i = 0; i < frogCount; i++) {
      const padA = this.lilyPads[(i * 3) % this.lilyPads.length];
      const padB = this.lilyPads[(i * 3 + 2) % this.lilyPads.length];

      const frogGroup = new THREE.Group();
      frogGroup.name = `SwampJumpingFrog_${i}`;

      // Sculpted chubby frog body
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), frogBodyMat);
      body.scale.set(1.0, 0.78, 1.32);
      body.position.y = 0.11;
      frogGroup.add(body);

      // Puffy yellow vocal throat sac (inflates between jumps!)
      const throatSac = new THREE.Mesh(new THREE.SphereGeometry(0.095, 10, 8), frogBellyMat);
      throatSac.position.set(0, 0.09, 0.16);
      frogGroup.add(throatSac);

      // Big cute bulging eyes on top of head
      for (const side of [-1, 1]) {
        const eyeDome = new THREE.Mesh(new THREE.SphereGeometry(0.052, 8, 8), frogEyeWhiteMat);
        eyeDome.position.set(side * 0.085, 0.21, 0.12);
        const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.026, 6, 6), frogPupilMat);
        pupil.position.set(side * 0.088, 0.215, 0.162);
        frogGroup.add(eyeDome, pupil);
      }

      // Articulated hind legs that stretch out mid-jump
      const hindLegs = new THREE.Group();
      hindLegs.position.set(0, 0.08, -0.12);
      for (const side of [-1, 1]) {
        const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.028, 0.22, 8), frogBodyMat);
        thigh.position.set(side * 0.13, -0.02, -0.06);
        thigh.rotation.x = Math.PI * 0.35;
        hindLegs.add(thigh);
      }
      frogGroup.add(hindLegs);

      // Fairy-tale mini golden crown on the first two Prince Frogs!
      if (i % 2 === 0) {
        const crown = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.085, 5), frogCrownMat);
        crown.position.set(0, 0.26, 0.04);
        frogGroup.add(crown);
      }

      // Dedicated water splash ripple ring under each frog
      const rippleMat = new THREE.MeshBasicMaterial({
        color: 0x69f0ae,
        transparent: true,
        opacity: 0.0,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const rippleMesh = new THREE.Mesh(rippleGeo, rippleMat);
      rippleMesh.position.set(padA.x, -0.438, padA.z);
      swampGroup.add(rippleMesh);
      this.pondRipples.push(rippleMesh);

      frogGroup.position.set(padA.x, -0.41, padA.z);
      swampGroup.add(frogGroup);

      this.jumpingFrogs.push({
        group: frogGroup,
        throatSac,
        hindLegs,
        rippleMesh,
        rippleMat,
        startX: padA.x,
        startZ: padA.z,
        endX: padB.x,
        endZ: padB.z,
        baseY: -0.41,
        jumpHeight: 0.95 + (i % 3) * 0.28,
        cycleDuration: 3.2 + (i % 3) * 0.55,
        phaseOffset: i * 1.15,
      });
    }

    // 2. Create 8 Swimming & Leaping Koi / Magic Trout Fish in the Emerald Moat
    const fishGoldMat = new THREE.MeshStandardMaterial({
      color: 0xff7043,
      roughness: 0.22,
      metalness: 0.35,
      emissive: 0xd84315,
      emissiveIntensity: 0.45,
    });
    const fishSilverMat = new THREE.MeshStandardMaterial({
      color: 0x4fc3f7,
      roughness: 0.18,
      metalness: 0.55,
      emissive: 0x0288d1,
      emissiveIntensity: 0.45,
    });
    const fishFinMat = new THREE.MeshStandardMaterial({
      color: 0xfff176,
      roughness: 0.3,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    });

    const fishCount = 8;
    for (let i = 0; i < fishCount; i++) {
      const fishGroup = new THREE.Group();
      fishGroup.name = `SwampPondFish_${i}`;
      const isGold = i % 2 === 0;
      const bodyMat = isGold ? fishGoldMat : fishSilverMat;

      // Streamlined fish body
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), bodyMat);
      body.scale.set(0.72, 0.85, 2.25);
      fishGroup.add(body);

      // Dorsal fin
      const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 4), fishFinMat);
      dorsal.position.set(0, 0.12, -0.04);
      dorsal.rotation.x = -0.35;
      fishGroup.add(dorsal);

      // Animated swishing tail fin
      const tailPivot = new THREE.Group();
      tailPivot.position.set(0, 0, -0.28);
      const tailFin = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.24, 3), fishFinMat);
      tailFin.rotation.x = Math.PI * 0.5;
      tailFin.scale.set(0.45, 1.0, 1.2);
      tailFin.position.set(0, 0, -0.10);
      tailPivot.add(tailFin);
      fishGroup.add(tailPivot);

      // Dedicated splash ripple ring when the fish leaps out of the water
      const rippleMat = new THREE.MeshBasicMaterial({
        color: 0x80deea,
        transparent: true,
        opacity: 0.0,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const rippleMesh = new THREE.Mesh(rippleGeo, rippleMat);
      rippleMesh.position.y = -0.438;
      swampGroup.add(rippleMesh);
      this.pondRipples.push(rippleMesh);

      const orbitRadius = 6.4 + (i % 4) * 0.85;
      const startAngle = (i / fishCount) * Math.PI * 2;
      fishGroup.position.set(
        Math.cos(startAngle) * orbitRadius,
        -0.46,
        Math.sin(startAngle) * orbitRadius,
      );
      swampGroup.add(fishGroup);

      this.swimmingFish.push({
        group: fishGroup,
        tailPivot,
        rippleMesh,
        rippleMat,
        orbitRadius,
        orbitSpeed: (i % 2 === 0 ? 1 : -1) * (0.28 + (i % 3) * 0.07),
        startAngle,
        leapCycle: 4.0 + (i % 4) * 0.75,
        leapPhase: i * 0.95,
        leapHeight: 0.72 + (i % 3) * 0.22,
      });
    }

    // 3. Create 10 Water-Skating Insects (Gerridi / Pattinatori d'Acqua & Libellule Radenti)
    // that skate and touch down across the emerald water surface, generating multi-ring
    // concentric circular ripples (`insect.rippleRings`)!
    this.waterInsects = [];
    const insectBodyCyanMat = new THREE.MeshStandardMaterial({
      color: 0x00f5d4,
      roughness: 0.18,
      metalness: 0.65,
      emissive: 0x00bfa5,
      emissiveIntensity: 0.95,
    });
    const insectBodyGoldMat = new THREE.MeshStandardMaterial({
      color: 0xffe57f,
      roughness: 0.18,
      metalness: 0.65,
      emissive: 0xffab00,
      emissiveIntensity: 0.95,
    });
    const insectLegMat = new THREE.MeshBasicMaterial({ color: 0x80ffdb });
    const insectWingMat = new THREE.MeshBasicMaterial({
      color: 0xe0f7fa,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
    });
    const concentricRingGeo = new THREE.RingGeometry(0.08, 0.105, 32);
    concentricRingGeo.rotateX(-Math.PI / 2);

    const insectCount = 8;
    for (let idx = 0; idx < insectCount; idx++) {
      const insectGroup = new THREE.Group();
      insectGroup.name = `SwampWaterInsect_${idx}`;
      const isCyan = idx % 2 === 0;
      const bodyMat = isCyan ? insectBodyCyanMat : insectBodyGoldMat;

      // Slender iridescent water-strider / dragonfly thorax + abdomen
      const bodyMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.011, 0.22, 6), bodyMat);
      bodyMesh.rotation.x = Math.PI * 0.5;
      bodyMesh.position.y = 0.032;
      insectGroup.add(bodyMesh);

      const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), bodyMat);
      headMesh.position.set(0, 0.038, 0.11);
      insectGroup.add(headMesh);

      // 4 delicate translucent wings that flutter
      const wings = [];
      for (const side of [-1, 1]) {
        for (const foreBack of [-1, 1]) {
          const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.038), insectWingMat);
          wing.rotation.x = -Math.PI * 0.5;
          wing.rotation.z = side * (0.28 + foreBack * 0.18);
          wing.position.set(side * 0.072, 0.048, foreBack * 0.024);
          insectGroup.add(wing);
          wings.push({ mesh: wing, side, foreBack });
        }
      }

      // 4 long skating water-strider legs touching the water surface meniscus
      for (const side of [-1, 1]) {
        for (const fb of [-1, 1]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.004, 0.20, 4), insectLegMat);
          leg.position.set(side * 0.075, 0.015, fb * 0.065);
          leg.rotation.z = side * 1.15;
          leg.rotation.x = fb * 0.45;
          insectGroup.add(leg);
        }
      }

      // 3 Small Localized Concentric Circular Ripple Rings per water insect (only visible when touching water!)
      const rippleRings = [];
      for (let rIdx = 0; rIdx < 3; rIdx++) {
        const rMat = new THREE.MeshBasicMaterial({
          color: isCyan ? 0x80ffdb : 0xa7ffeb,
          transparent: true,
          opacity: 0.0,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const rMesh = new THREE.Mesh(concentricRingGeo, rMat);
        rMesh.name = `SwampInsectConcentricRipple_${idx}_${rIdx}`;
        rMesh.position.y = -0.434;
        swampGroup.add(rMesh);
        this.pondRipples.push(rMesh);
        const ringEntry = { mesh: rMesh, mat: rMat, phaseOffset: rIdx * 0.22 };
        rippleRings.push(ringEntry);
        if (this.waveCrestRings.length < 6) {
          this.waveCrestRings.push(ringEntry);
        }
      }

      const baseAngle = (idx / insectCount) * Math.PI * 2 + 0.24;
      const baseRadius = 6.35 + (idx % 4) * 0.72; // 6.35m .. 8.51m in the pond outside the chessboard
      const ix = Math.cos(baseAngle) * baseRadius;
      const iz = Math.sin(baseAngle) * baseRadius;
      insectGroup.position.set(ix, -0.435, iz);
      swampGroup.add(insectGroup);

      this.waterInsects.push({
        group: insectGroup,
        wings,
        rippleRings,
        idx,
        baseAngle,
        baseRadius,
        touchCycle: 6.4 + (idx % 3) * 1.3,
        phase: idx * 2.15,
        curX: ix,
        curZ: iz,
        isTouching: false,
        touchProgress: 0,
      });
    }
  }

  // ===========================================================================
  // 3B. 68 FLOATING BIOLUMINESCENT FIREFLIES (Soft Circular Glow Orbs)
  // ===========================================================================

  createFireflySpriteTexture() {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
      grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
      grad.addColorStop(0.32, 'rgba(255, 244, 180, 0.85)');
      grad.addColorStop(0.7, 'rgba(105, 240, 174, 0.28)');
      grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 64, 64);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  buildFireflies() {
    const count = 68;
    this.fireflyData = [];
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const colGold = new THREE.Color(0xffe082);
    const colEmerald = new THREE.Color(0x69f0ae);

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (i % 5) * 0.3;
      const radius = 5.6 + ((i * 29) % 100) * 0.095; // 5.6m .. 15.1m
      const baseY = 0.35 + ((i * 43) % 100) * 0.031; // 0.35m .. 3.45m
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      positions[i * 3] = x;
      positions[i * 3 + 1] = baseY;
      positions[i * 3 + 2] = z;

      const c = i % 3 === 0 ? colGold : colEmerald;
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;

      this.fireflyData.push({
        baseX: x,
        baseY,
        baseZ: z,
        speed: 0.8 + (i % 7) * 0.22,
        phase: i * 0.65,
      });
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const fireflyTex = this.createFireflySpriteTexture();
    this.fireflyMaterial = new THREE.PointsMaterial({
      size: 0.44,
      map: fireflyTex,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.fireflyPoints = new THREE.Points(geo, this.fireflyMaterial);
    this.fireflyPoints.name = 'SwampFireflies';
    this.root.add(this.fireflyPoints);
  }

  // ===========================================================================
  // 4. FULL-SCREEN 180° J-CURVED ZURICH & LIMMAT INFINITY CYCLORAMA
  // ===========================================================================

  _loadPanoramaTexture(envId = 'zurich') {
    const key = normalizeEnvironmentMode(envId) || 'zurich';
    if (this._panoTextures.has(key)) {
      return this._panoTextures.get(key);
    }
    if (typeof document === 'undefined') return null;
    const spec = ENVIRONMENT_PANORAMAS[key] || ENVIRONMENT_PANORAMAS.zurich;
    try {
      const loader = new THREE.TextureLoader();
      const tex = loader.load(spec.url);
      if (tex) {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        this._panoTextures.set(key, tex);
      }
      return tex;
    } catch {
      return null;
    }
  }

  /**
   * Switches the 180° full-screen cyclorama backdrop between:
   * - `'zurich'`: Fairy-tale Zurich on the Limmat (with Google Zurich Hürlimann & Gemini 4 Argon bridge plaque)
   * - `'swamp'`: Enchanted Ogre Swamp (tree-root hut, 'ATTENZIONE ORCHI' sign, lily pads & fireflies)
   * - `'positano'`: Positano & Amalfi Coast viewed from the sea (pastel cliffside pyramid, majolica dome & boats)
   * @param {'zurich'|'swamp'|'positano'} mode
   */
  setEnvironmentMode(mode = 'zurich') {
    const normalized = normalizeEnvironmentMode(mode) || 'zurich';
    this.environmentMode = normalized;
    const spec = ENVIRONMENT_PANORAMAS[normalized] || ENVIRONMENT_PANORAMAS.zurich;
    this._zurichBgColor.setHex(spec.bgColor);
    if (this.scene && !this.inCombatCinemaMode) {
      if (!this.scene.background || !this.scene.background.isColor) {
        this.scene.background = new THREE.Color(spec.bgColor);
      } else {
        this.scene.background.setHex(spec.bgColor);
      }
    }
    if (this.panoMaterial) {
      const tex = this._loadPanoramaTexture(normalized);
      this.panoMaterial.map = tex;
      this.panoMaterial.color.setHex(tex ? spec.tint : 0x1a2638);
      this.panoMaterial.needsUpdate = true;
    }
    return normalized;
  }

  buildZurichSkylineAndAlps() {
    const skyline = new THREE.Group();
    skyline.name = 'ZurichSkylineAndAlps';
    this.skylineGroup = skyline;
    this.root.add(skyline);

    const activeSpec = ENVIRONMENT_PANORAMAS[this.environmentMode] || ENVIRONMENT_PANORAMAS.zurich;
    const activeTex = this._loadPanoramaTexture(this.environmentMode);

    const panoGroup = new THREE.Group();
    panoGroup.name = 'ZurichFairytalePanoramaBackdrop';
    panoGroup.position.set(0, 0, 0);

    // Full-screen 180° wrap-around vertical cyclorama (64 horizontal x 16 vertical segments):
    // Pure vertical walls (vx, vz depend ONLY on u; vy depends ONLY on v -> zero diagonal stretching!)
    // wrapping from the front-left (z = +2.5m) around the back of the chessboard (z = -12.4m)
    // to the front-right (z = +2.5m), extending down to y = -4.2m .. -6.8m so 100% of the viewport
    // (top, sides, and bottom around the chessboard) is filled by the active 180° panorama!
    const segsX = 64;
    const segsY = 16;
    const panoGeo = new THREE.PlaneGeometry(1.0, 1.0, segsX, segsY);
    const posAttr = panoGeo.attributes.position;
    const uvAttr = panoGeo.attributes.uv;

    const radiusX = 11.8;
    const frontZ = 2.5;
    const backZ = -12.4;

    for (let i = 0; i < posAttr.count; i++) {
      const u = uvAttr.getX(i); // 0.0 (West / Left) -> 1.0 (East / Right)
      const v = uvAttr.getY(i); // 0.0 (Bottom water) -> 1.0 (Top sky)

      // Smooth linear+cubic angular mapping across 0 .. PI: preserves natural 1:1 horizontal
      // proportions in the center (so the Münsterbrücke 'MADE WITH GEMINI 4 ARGON' plaque is
      // never squeezed) while wrapping the outer flanks forward to z = +2.8m around the board!
      const centered = (u - 0.5) * 2.0; // -1.0 .. +1.0
      const shaped = 0.80 * centered + 0.20 * centered * centered * centered;
      const theta = (0.5 + 0.5 * shaped) * Math.PI; // 0 .. PI

      const sinT = Math.sin(theta);
      const cosT = Math.cos(theta);

      const vx = -cosT * radiusX;
      const vz = frontZ + (backZ - frontZ) * Math.pow(sinT, 0.78);

      // Vertical range: at back-center (sinT = 1), y spans -2.95m .. +10.85m so the Münsterbrücke
      // bridge (v ≈ 0.20) sits cleanly above the Black King & Queen crowns and the bottom (v = 0)
      // tucks behind the chessboard altar; toward the front flanks (sinT -> 0), the bottom extends
      // down to -6.8m so the bottom-left and bottom-right screen corners are 100% covered!
      const bottomY = -2.95 - (1.0 - sinT) * 3.85;
      const topY = 10.85 + (1.0 - sinT) * 1.15;
      const vy = bottomY + v * (topY - bottomY);

      posAttr.setXYZ(i, vx, vy, vz);
    }
    panoGeo.computeVertexNormals();

    const panoMat = new THREE.MeshBasicMaterial({
      map: activeTex,
      color: activeTex ? activeSpec.tint : 0x1a2638,
      side: THREE.DoubleSide,
      fog: false,
      depthWrite: true,
    });
    const panoMesh = new THREE.Mesh(panoGeo, panoMat);
    panoMesh.name = 'ZurichPanorama180Cyclorama';
    panoGroup.add(panoMesh);

    skyline.add(panoGroup);
    this.panoMesh = panoMesh;
    this.panoMaterial = panoMat;

    // Optional 3D Architectural Zurich Facade & Spires Layer ("Proposal 2 / 3": Grossmünster Twin Towers,
    // Fraumünster & St. Peter Spires, Limmat Guild Houses & Münsterbrücke in 3D relief!)
    this.reliefGroup = new THREE.Group();
    this.reliefGroup.name = 'Zurich3DArchitecturalRelief';
    this.reliefGroup.visible = false; // Enabled in 'relief' or 'hybrid' backdropStyle
    skyline.add(this.reliefGroup);
    this.buildZurich3DArchitecturalRelief(this.reliefGroup);
  }

  /**
   * Switches between the 3 Zurich Vision Styles:
   * - `'painting'`: Pure 180° Fairytale Zurich Painting (`zurich_panorama.jpg`) at Infinite Parallax + 3D Translucent Swamp Ring
   * - `'relief'`: 3D Sculpted Zurich Old-Town Guild Houses, Grossmünster Twin Towers, St. Peter & Fraumünster with Zurich Façade Skins
   * - `'hybrid'`: Multi-Depth 2.5D/3D Pop-Up Diorama combining the 180° Zurich Painting with 3D Sculpted Towers, Warm Lit Windows & Shimmering 3D Limmat River
   * @param {'painting'|'relief'|'hybrid'} style
   */
  setZurichBackdropStyle(style = 'painting') {
    this.backdropStyle = style;
    if (this.panoMesh) {
      this.panoMesh.visible = style === 'painting' || style === 'hybrid';
    }
    if (this.reliefGroup) {
      this.reliefGroup.visible = style === 'relief' || style === 'hybrid';
      const houses = this.reliefGroup.getObjectByName('ZurichReliefGuildHouses');
      if (houses) {
        houses.visible = style === 'relief';
      }
    }
  }

  buildZurich3DArchitecturalRelief(reliefRoot) {
    const facadeTex = this.createZurichGuildHouseSkinTexture('#f2e3c6', '#8d6e63', '#ffd54f');
    const facadeRoseTex = this.createZurichGuildHouseSkinTexture('#edd0c0', '#6d4c41', '#ffe082');
    const sandstoneTex = this.createZurichGuildHouseSkinTexture('#d7c49e', '#5d4037', '#ffca28');
    const roofTileMat = new THREE.MeshStandardMaterial({ color: 0x7f2f24, roughness: 0.55, metalness: 0.12 });
    const copperSpireMat = new THREE.MeshStandardMaterial({
      color: 0x26a69a,
      roughness: 0.32,
      metalness: 0.45,
      emissive: 0x004d40,
      emissiveIntensity: 0.35,
    });
    const domeRedMat = new THREE.MeshStandardMaterial({
      color: 0xb71c1c,
      roughness: 0.35,
      metalness: 0.25,
      emissive: 0x4a0e0e,
      emissiveIntensity: 0.3,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffd54f,
      roughness: 0.22,
      metalness: 0.85,
      emissive: 0xffa000,
      emissiveIntensity: 0.45,
    });

    const sandstoneMat = new THREE.MeshStandardMaterial({
      map: sandstoneTex,
      roughness: 0.62,
      metalness: 0.12,
      emissive: 0xffb300,
      emissiveMap: sandstoneTex,
      emissiveIntensity: 0.42,
    });

    // 1. Grossmünster Twin Romanesque Towers (Right-Center, matching the painting!)
    const grossGroup = new THREE.Group();
    grossGroup.name = 'ZurichReliefGrossmunster';
    grossGroup.position.set(5.4, -1.2, -10.8);
    grossGroup.rotation.y = -0.22;
    for (const tx of [-1.25, 1.25]) {
      const tower = new THREE.Group();
      tower.position.set(tx, 0, 0);
      const shaft = new THREE.Mesh(new THREE.BoxGeometry(1.75, 7.6, 1.75), sandstoneMat);
      shaft.position.y = 3.8;
      tower.add(shaft);
      for (const cy of [2.6, 5.1, 7.55]) {
        const cornice = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.18, 1.92), goldMat);
        cornice.position.y = cy;
        tower.add(cornice);
      }
      const belfry = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 1.02, 1.65, 8), sandstoneMat);
      belfry.position.y = 8.4;
      tower.add(belfry);
      const dome = new THREE.Mesh(new THREE.ConeGeometry(1.05, 2.35, 8), domeRedMat);
      dome.position.y = 10.35;
      tower.add(dome);
      const finial = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), goldMat);
      finial.position.y = 11.6;
      tower.add(finial);
      grossGroup.add(tower);
    }
    reliefRoot.add(grossGroup);

    // 2. Fraumünster Slender Verdigris Spire & St. Peter Giant Golden Clock Tower (Left-Center)
    const westChurches = new THREE.Group();
    westChurches.name = 'ZurichReliefFraumunsterAndStPeter';
    westChurches.position.set(-5.8, -1.2, -10.6);
    westChurches.rotation.y = 0.24;

    // Fraumünster
    const frauTower = new THREE.Mesh(new THREE.BoxGeometry(1.55, 6.8, 1.55), sandstoneMat);
    frauTower.position.set(-1.1, 3.4, 0);
    const frauSpire = new THREE.Mesh(new THREE.ConeGeometry(0.88, 5.2, 8), copperSpireMat);
    frauSpire.position.set(-1.1, 9.4, 0);
    westChurches.add(frauTower, frauSpire);

    // St. Peter with giant Ø 1.8m golden clock face
    const stPeterTower = new THREE.Mesh(new THREE.BoxGeometry(1.75, 6.4, 1.75), sandstoneMat);
    stPeterTower.position.set(1.4, 3.2, -0.6);
    const stPeterRoof = new THREE.Mesh(new THREE.ConeGeometry(1.22, 2.8, 4), roofTileMat);
    stPeterRoof.rotation.y = Math.PI / 4;
    stPeterRoof.position.set(1.4, 7.8, -0.6);
    const clockTex = this.createClockFaceTexture();
    const clockMat = new THREE.MeshBasicMaterial({ map: clockTex });
    const clockFace = new THREE.Mesh(new THREE.CircleGeometry(0.78, 24), clockMat);
    clockFace.position.set(1.4, 5.2, 0.30);
    westChurches.add(stPeterTower, stPeterRoof, clockFace);
    reliefRoot.add(westChurches);

    // 3. Limmat Guild Houses ("Skin Zurighese" half-timbered Fachwerk & shuttered facades)
    const housesGroup = new THREE.Group();
    housesGroup.name = 'ZurichReliefGuildHouses';
    const houseMat1 = new THREE.MeshStandardMaterial({
      map: facadeTex,
      roughness: 0.55,
      emissive: 0xffca28,
      emissiveMap: facadeTex,
      emissiveIntensity: 0.52,
    });
    const houseMat2 = new THREE.MeshStandardMaterial({
      map: facadeRoseTex,
      roughness: 0.55,
      emissive: 0xffca28,
      emissiveMap: facadeRoseTex,
      emissiveIntensity: 0.52,
    });

    const houseSpecs = [
      { x: -8.6, z: -8.2, w: 2.2, h: 4.4, d: 1.8, rot: 0.42, mat: houseMat1 },
      { x: -6.9, z: -9.4, w: 2.0, h: 4.8, d: 1.8, rot: 0.30, mat: houseMat2 },
      { x: -3.2, z: -11.2, w: 2.4, h: 4.0, d: 1.8, rot: 0.12, mat: houseMat1 },
      { x: 2.8, z: -11.2, w: 2.5, h: 4.2, d: 1.8, rot: -0.12, mat: houseMat2 },
      { x: 7.8, z: -9.2, w: 2.3, h: 4.6, d: 1.8, rot: -0.32, mat: houseMat1 },
      { x: 9.2, z: -7.8, w: 2.1, h: 4.2, d: 1.8, rot: -0.45, mat: houseMat2 },
    ];
    for (const hs of houseSpecs) {
      const hg = new THREE.Group();
      hg.position.set(hs.x, -1.2, hs.z);
      hg.rotation.y = hs.rot;
      const box = new THREE.Mesh(new THREE.BoxGeometry(hs.w, hs.h, hs.d), hs.mat);
      box.position.y = hs.h * 0.5;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(hs.w * 0.78, 1.65, 4), roofTileMat);
      roof.rotation.y = Math.PI / 4;
      roof.position.y = hs.h + 0.82;
      hg.add(box, roof);
      housesGroup.add(hg);
    }
    reliefRoot.add(housesGroup);
  }

  // ===========================================================================
  // 5. EVENT BUS BINDINGS FOR BOARD HIGHLIGHTS & ENVIRONMENT SWITCHING
  // ===========================================================================

  bindEvents() {
    if (!this.bus) return;
    this.offs.push(
      this.bus.on('MOVE_EXECUTED', (e) => {
        this.clearHighlights();
        if (e.move) this.renderLastMoveHighlight(e.move.from, e.move.to);
      }),
      this.bus.on('BOARD_RESET', () => {
        this.clearHighlights();
        this.setCombatCinemaMode(false);
      }),
      this.bus.on('FLOW_STATE_CHANGED', (e) => {
        if (e.to === 'Mode2_WowArena') this.clearHighlights();
      }),
      this.bus.on('ENVIRONMENT_CHANGED', (e) => {
        const nextEnv = normalizeEnvironmentMode(e?.environment || e?.mode);
        if (nextEnv) this.setEnvironmentMode(nextEnv);
      }),
      this.bus.on('PIECE_SET_CHANGED', (e) => {
        const explicitEnv = normalizeEnvironmentMode(e?.environment);
        if (explicitEnv) {
          this.setEnvironmentMode(explicitEnv);
        } else if (e?.whiteFamily || e?.rivalSetMode) {
          this.setEnvironmentMode(
            resolveEnvironmentForFactions(e.whiteFamily || 'carlesso', e.rivalSetMode || 'classic'),
          );
        }
      }),
      this.bus.on('BATTLE_STARTED', () => this.setCombatCinemaMode(true)),
      this.bus.on('WOW_ARENA_CLASH', () => this.setCombatCinemaMode(true)),
      this.bus.on('BATTLE_COMPLETED', () => this.setCombatCinemaMode(false)),
      this.bus.on('BATTLE_SKIPPED', () => this.setCombatCinemaMode(false)),
    );
  }

  /**
   * Collects all surrounding diorama groups (Swamp Moat, Zurich Skyline, Swiss Alps,
   * Corner Braziers, Sky Dome, Fireflies, plus under-board stone foundation/island/rims)
   * and caches their original material transparency states so they can smoothly dissolve (`1 -> 0`)
   * on combat entry and smoothly rematerialize (`0 -> 1`) during the exit sliding window!
   */
  _ensureDioramaFadeTargets() {
    if (this._dioramaFadeReady) return;
    this._dioramaFadeReady = true;
    this._dioramaGroups = [];
    this._dioramaMaterials = [];

    for (const child of this.root.children) {
      if (
        !child.isLight &&
        child.name !== 'CarvedStoneAltar' &&
        child.name !== 'BoardHighlights'
      ) {
        this._dioramaGroups.push(child);
      }
    }
    if (this.islandMesh) this._dioramaGroups.push(this.islandMesh);
    if (this.foundationMesh) this._dioramaGroups.push(this.foundationMesh);
    if (this.altarBorderMeshes) {
      for (const m of this.altarBorderMeshes) {
        this._dioramaGroups.push(m);
      }
    }

    const squareMats = new Set(this.squareMeshes.map((s) => s.material));
    if (this.squareInlayMat) squareMats.add(this.squareInlayMat);
    const seenMats = new Set();

    for (const grp of this._dioramaGroups) {
      grp.traverse?.((node) => {
        const mats = Array.isArray(node.material)
          ? node.material
          : node.material
            ? [node.material]
            : [];
        for (const mat of mats) {
          if (!mat || squareMats.has(mat) || seenMats.has(mat)) continue;
          seenMats.add(mat);
          this._dioramaMaterials.push({
            mat,
            origTransparent: Boolean(mat.transparent),
            origOpacity: Number.isFinite(mat.opacity) ? mat.opacity : 1.0,
            origDepthWrite: mat.depthWrite !== undefined ? Boolean(mat.depthWrite) : true,
          });
        }
      });
    }
  }

  _resolveTargetCombatAlpha() {
    let defaultAlpha = 0.10; // 90% transparent ("che si veda appena")
    if (typeof window !== 'undefined' && window.location?.search) {
      const q = new URLSearchParams(window.location.search).get('boardAlpha');
      if (q !== null && Number.isFinite(Number(q))) {
        defaultAlpha = Math.max(0.02, Math.min(1.0, Number(q)));
      }
    }
    return Number.isFinite(this.combatBoardAlpha) ? this.combatBoardAlpha : defaultAlpha;
  }

  /**
   * Smoothly interpolates the entire Zurich & Swamp Diorama + 8x8 Chessboard between:
   * - `blend = 0.0`: 100% normal mode (Swamp, Zurich, Alps, Foundation, and 64 Chessboard tiles at 100% opacity)
   * - `blend = 1.0`: 100% Cinema Combat XXL mode (Surrounding world hidden, 64 Chessboard tiles at 10% opacity / 90% transparent)
   * - `0.0 < blend < 1.0`: Sliding-window optical cross-fade where the Swamp, Zurich Skyline, and Chessboard
   *   smoothly rematerialize (`worldAlpha = 1.0 - blend`) as the Maxi Cinema screen zooms out!
   * @param {number} blend
   */
  setCombatBlend(blend) {
    this._ensureDioramaFadeTargets();
    const b = Math.max(0, Math.min(1, Number.isFinite(blend) ? blend : 0));
    this.combatBlend = b;
    this.inCombatCinemaMode = b > 0.002;

    if (this.scene) {
      if (!this.scene.background || !this.scene.background.isColor) {
        this.scene.background = new THREE.Color(0x0b1528);
      }
      this.scene.background.lerpColors(this._zurichBgColor, this._combatBgColor, b);
    }

    // 1. Surrounding Diorama (Swamp, Zurich Skyline, Alps, Braziers, Under-board Foundation & Island)
    const worldAlpha = 1.0 - b;
    const hideDiorama = worldAlpha <= 0.005;
    const fullDiorama = worldAlpha >= 0.995;

    for (const grp of this._dioramaGroups) {
      grp.visible = !hideDiorama;
    }

    if (!hideDiorama) {
      for (const item of this._dioramaMaterials) {
        const { mat, origTransparent, origOpacity, origDepthWrite } = item;
        const nextTransparent = fullDiorama ? origTransparent : true;
        const nextDepthWrite = fullDiorama ? origDepthWrite : false;
        if (mat.transparent !== nextTransparent || mat.depthWrite !== nextDepthWrite) {
          mat.transparent = nextTransparent;
          mat.depthWrite = nextDepthWrite;
          mat.needsUpdate = true;
        }
        mat.opacity = fullDiorama ? origOpacity : origOpacity * worldAlpha;
      }
    }

    // 2. 64 Chessboard Squares (`1.0` opacity in normal mode <-> `0.10` opacity in combat mode)
    const targetAlpha = this._resolveTargetCombatAlpha();
    const sqOpacity =
      b >= 0.999
        ? targetAlpha
        : b <= 0.001
          ? 1.0
          : Math.round((1.0 - b + targetAlpha * b) * 1e6) / 1e6;
    const isTranslucent = b > 0.002 && sqOpacity < 0.999;
    this._applyAltarTranslucency(isTranslucent, isTranslucent ? sqOpacity : 1.0, b);
  }

  /**
   * During combat (`BATTLE_STARTED`), transitions into Cinema Combat mode (`inCombatCinemaMode = true`),
   * and on `BATTLE_COMPLETED` transitions back (`inCombatCinemaMode = false`).
   * @param {boolean} active
   */
  setCombatCinemaMode(active) {
    this.inCombatCinemaMode = Boolean(active);
    // When VFXPoolView is not mounted (e.g., standalone unit tests), apply the target blend immediately;
    // when VFXPoolView is mounted, VFXPoolView drives `setCombatBlend(b)` smoothly across the sliding window!
    if (!this.scene?.userData?.vfxControlsCombatBlend) {
      this.setCombatBlend(active ? 1.0 : 0.0);
    } else if (active && this.combatBlend <= 0.001) {
      // Prime entry blend on frame 0 so the transition starts smoothly without a hard cut
      this.setCombatBlend(0.02);
    }
  }

  /**
   * Dynamically updates the chessboard alpha channel during combat (e.g., `0.10` for 90% transparency).
   * @param {number} alpha
   */
  setCombatBoardAlpha(alpha = 0.10) {
    this.combatBoardAlpha = Math.max(0.02, Math.min(1.0, Number(alpha) || 0.10));
    if (this.inCombatCinemaMode || this.combatBlend > 0.001) {
      this.setCombatBlend(this.combatBlend || 1.0);
    }
  }

  _applyAltarTranslucency(translucent, opacity, blend = translucent ? 1.0 : 0.0) {
    const scaleY = translucent ? 1.0 + (0.02 - 1.0) * blend : 1.0;
    for (const sqMesh of this.squareMeshes) {
      sqMesh.scale.y = scaleY;
      const mat = sqMesh.material;
      if (!mat) continue;
      const isLight = Boolean(sqMesh.userData?.isLight);
      const nextDepthWrite = !translucent;
      if (mat.transparent !== translucent || mat.depthWrite !== nextDepthWrite) {
        mat.transparent = translucent;
        mat.depthWrite = nextDepthWrite;
        mat.needsUpdate = true;
      }
      mat.opacity = opacity;
      mat.roughness = translucent ? (isLight ? 0.18 : 0.14) + 0.60 * blend : isLight ? 0.18 : 0.14;
    }
    if (this.squareInlayMat) {
      const nextDepthWrite = !translucent;
      if (
        this.squareInlayMat.transparent !== translucent ||
        this.squareInlayMat.depthWrite !== nextDepthWrite
      ) {
        this.squareInlayMat.transparent = translucent;
        this.squareInlayMat.depthWrite = nextDepthWrite;
        this.squareInlayMat.needsUpdate = true;
      }
      this.squareInlayMat.opacity = translucent ? Math.min(1.0, opacity * 1.6) : 1.0;
    }
  }

  clearHighlights() {
    while (this.highlightGroup.children.length > 0) {
      const child = this.highlightGroup.children.pop();
      child.geometry?.dispose?.();
      child.material?.dispose?.();
    }
  }

  renderSelectionHighlights({ square, legalMoves = [] }) {
    this.clearHighlights();
    if (square) {
      this.addSquareMarker(square, SELECT_HIGHLIGHT_HEX, 0.55, 'ring');
    }
    for (const m of legalMoves) {
      const isCapture = Boolean(m.captured) || (m.flags && m.flags.includes('e'));
      this.addSquareMarker(
        m.to,
        isCapture ? CAPTURE_MOVE_HEX : LEGAL_MOVE_HEX,
        0.72,
        isCapture ? 'ring' : 'dot',
      );
    }
  }

  renderLastMoveHighlight(from, to) {
    if (from) this.addSquareMarker(from, 0xffca28, 0.32, 'ring');
    if (to) this.addSquareMarker(to, 0xffca28, 0.42, 'ring');
  }

  renderCheckHighlight(kingSquare) {
    this.addSquareMarker(kingSquare, CHECK_ALERT_HEX, 0.82, 'ring');
  }

  addSquareMarker(square, hexColor, opacity = 0.6, style = 'ring') {
    const pos = squareToWorld(square);
    const geo =
      style === 'dot'
        ? new THREE.CircleGeometry(0.18, 24)
        : new THREE.RingGeometry(0.32, 0.45, 28);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: hexColor,
      transparent: true,
      opacity,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos.x, 0.006, pos.z);
    this.highlightGroup.add(mesh);
  }

  getSquareMesh(square) {
    return this.squaresByName.get(square) || null;
  }

  // ===========================================================================
  // 6. ART DIRECTOR LIVE DEBUG CONTROLS (`?debug=1`) & FRAME UPDATE
  // ===========================================================================

  /**
   * Live setter for Art Director `?debug=1` sliders.
   * @param {{ sunIntensity?: number, brazierIntensity?: number, brazierWarmth?: number, waterRoughness?: number }} params
   */
  applyDebugParams(params = {}) {
    if (typeof params.sunIntensity === 'number' && this.sunLight) {
      this.debugConfig.sunIntensity = params.sunIntensity;
      this.sunLight.intensity = params.sunIntensity;
      if (this.hemiLight) {
        this.hemiLight.intensity = Math.max(0.2, params.sunIntensity * 0.55);
      }
    }
    if (typeof params.brazierIntensity === 'number') {
      this.debugConfig.brazierIntensity = params.brazierIntensity;
      for (const light of this.brazierLights) {
        light.intensity = params.brazierIntensity;
      }
    }
    if (params.brazierWarmth !== undefined && params.brazierWarmth !== null) {
      this.debugConfig.brazierWarmth = params.brazierWarmth;
      let warmColor;
      if (typeof params.brazierWarmth === 'string') {
        warmColor = new THREE.Color(params.brazierWarmth);
      } else if (typeof params.brazierWarmth === 'number' && params.brazierWarmth > 1) {
        warmColor = new THREE.Color(params.brazierWarmth);
      } else if (typeof params.brazierWarmth === 'number') {
        const w = Math.max(0, Math.min(1, params.brazierWarmth));
        warmColor = new THREE.Color().setHSL(0.06 + (1 - w) * 0.06, 0.95, 0.56);
      }
      if (warmColor) {
        for (const light of this.brazierLights) {
          light.color.copy(warmColor);
        }
      }
    }
    if (typeof params.waterRoughness === 'number' && this.waterMaterial) {
      this.debugConfig.waterRoughness = params.waterRoughness;
      this.waterMaterial.roughness = Math.max(0.02, Math.min(1, params.waterRoughness));
    }
  }

  /**
   * Infinite Horizon Parallax ("Zurigo all'infinito"):
   * Ensures the observer (`camera`) is ALWAYS strictly between the chessboard and the external
   * Zurich Skyline / Swiss Alps / Alpine Moon backdrop, regardless of camera orbit (0°, 90°, 180°, 270°).
   * Meanwhile, the Enchanted Swamp Moat (`this.swampGroup`) stays anchored at the board origin `(0, 0, 0)`.
   * @param {THREE.Camera} [camera]
   * @param {THREE.Vector3|{x:number,y:number,z:number}} [target]
   */
  updateHorizonParallax(camera, target = null) {
    if (!camera || !camera.position) return;
    if (this.inCombatCinemaMode || this.combatBlend > 0.002) {
      return;
    }
    const tx = target && Number.isFinite(target.x) ? target.x : 0;
    const tz = target && Number.isFinite(target.z) ? target.z : 0;
    const dx = camera.position.x - tx;
    const dz = camera.position.z - tz;
    const hDist = Math.hypot(dx, dz);

    // Only update azimuth when camera is not strictly vertical (top-down zenith view has hDist ~ 0.001)
    if (hDist > 0.25) {
      this.horizonYaw = Math.atan2(dx, dz);
    }

    if (this.skylineGroup) {
      this.skylineGroup.rotation.y = this.horizonYaw;
      // Subtle horizon distance push when camera orbits far out so the observer is NEVER behind Grossmünster
      const extraPull = Math.max(0, hDist - 12.6) * 0.45;
      const forwardX = -Math.sin(this.horizonYaw);
      const forwardZ = -Math.cos(this.horizonYaw);
      this.skylineGroup.position.set(forwardX * extraPull, 0, forwardZ * extraPull);
    }

    if (this.moonGroup) {
      const baseMoonX = -14.5;
      const baseMoonY = 11.2;
      const baseMoonZ = -26.0;
      const cosA = Math.cos(this.horizonYaw);
      const sinA = Math.sin(this.horizonYaw);
      this.moonGroup.position.set(
        baseMoonX * cosA + baseMoonZ * sinA,
        baseMoonY,
        -baseMoonX * sinA + baseMoonZ * cosA,
      );
      this.moonGroup.rotation.y = this.horizonYaw;
    }

    if (this.skyDome) {
      // Subtle skybox starfield parallax (rotates at 85% of camera azimuth for deep celestial depth)
      this.skyDome.rotation.y = this.horizonYaw * 0.85;
    }
  }

  /**
   * Animates brazier flames/light flicker, fireflies, water shimmer, jumping frogs, swimming koi/trout fish,
   * banners, rune glow pulse, and infinite Zurich horizon parallax.
   * @param {number} dt
   * @param {THREE.Camera} [camera]
   * @param {THREE.Vector3|{x:number,y:number,z:number}} [target]
   */
  update(dt = 0.016, camera = null, target = null) {
    this.time += dt;
    const t = this.time;

    if (camera) {
      this.updateHorizonParallax(camera, target);
    }

    // 1. Animate 4 Corner Braziers (flame cones, embers, warm PointLight flicker)
    const baseBrazierInt = this.debugConfig.brazierIntensity;
    for (const b of this.braziers) {
      const flicker =
        Math.sin(t * 9.5 + b.phase) * 0.14 +
        Math.cos(t * 15.2 + b.phase * 1.7) * 0.09 +
        Math.sin(t * 23.0 + b.phase) * 0.05;

      b.light.intensity = Math.max(0.2, baseBrazierInt * (1.0 + flicker));
      b.outerCone.scale.set(1 + flicker * 0.35, 1 + flicker * 0.5, 1 - flicker * 0.25);
      b.midCone.scale.set(1 - flicker * 0.25, 1 + flicker * 0.65, 1 + flicker * 0.3);
      b.coreCone.scale.set(1 + flicker * 0.2, 1 - flicker * 0.3, 1 + flicker * 0.2);

      for (const e of b.embers) {
        const cycle = (t * 0.9 + e.seed) % 1.0;
        e.mesh.position.y = 0.25 + cycle * 1.25;
        e.mesh.position.x = Math.cos(t * 3.0 + e.seed) * (0.14 + cycle * 0.12);
        e.mesh.position.z = Math.sin(t * 3.0 + e.seed) * (0.14 + cycle * 0.12);
        const s = Math.sin(cycle * Math.PI);
        e.mesh.scale.setScalar(Math.max(0.1, s));
      }
    }

    // 2. Animate Bioluminescent Swamp Fireflies
    if (this.fireflyPoints) {
      const posAttr = this.fireflyPoints.geometry.getAttribute('position');
      for (let i = 0; i < this.fireflyData.length; i++) {
        const fd = this.fireflyData[i];
        posAttr.setXYZ(
          i,
          fd.baseX + Math.sin(t * fd.speed + fd.phase) * 0.38,
          fd.baseY + Math.cos(t * fd.speed * 1.3 + fd.phase) * 0.24,
          fd.baseZ + Math.cos(t * fd.speed * 0.9 + fd.phase) * 0.38,
        );
      }
      posAttr.needsUpdate = true;
    }

    // 3A. Animate Localized Random Water-Touch Insects (every 2-3s an insect dips to touch the water at a random spot!)
    if (this.waterInsects) {
      for (const ins of this.waterInsects) {
        const cycleTime = t + ins.phase;
        const cycleIdx = Math.floor(cycleTime / ins.touchCycle);
        const cycleU = (cycleTime % ins.touchCycle) / ins.touchCycle;

        // Deterministic pseudo-random localized spot in the pond outside the chessboard (r = 6.2m .. 9.3m)
        const randA = Math.sin(cycleIdx * 12.9898 + ins.idx * 78.233) * 43758.5453;
        const fracA = randA - Math.floor(randA);
        const randR = Math.sin(cycleIdx * 93.9898 + ins.idx * 47.113) * 29183.1234;
        const fracR = randR - Math.floor(randR);

        const touchAngle = ins.baseAngle + (fracA - 0.5) * 1.45;
        const touchRadius = 6.25 + fracR * 2.95; // 6.25m .. 9.20m
        const touchX = Math.cos(touchAngle) * touchRadius;
        const touchZ = Math.sin(touchAngle) * touchRadius;

        const baseLiquidY =
          Math.sin(touchX * 0.62 + t * 1.55) * 0.048 +
          Math.cos(touchZ * 0.58 - t * 1.35) * 0.044;

        // During cycleU in [0.0, 0.36] (~2.3s), the insect touches the water at (touchX, touchZ)
        // and generates small, localized concentric circular ripples from that exact point!
        if (cycleU < 0.36) {
          const touchProgress = cycleU / 0.36; // 0.0 -> 1.0
          ins.isTouching = true;
          ins.touchProgress = touchProgress;
          ins.curX = touchX;
          ins.curZ = touchZ;

          // Brief dip onto the water meniscus at touchProgress ~ 0.15, then hover/skim slightly above
          const dipLift = touchProgress < 0.25 ? Math.sin((touchProgress / 0.25) * Math.PI) * -0.02 : (touchProgress - 0.25) * 0.22;
          ins.group.position.set(touchX, -0.425 + baseLiquidY + dipLift, touchZ);
          ins.group.rotation.y = touchAngle + Math.PI * 0.5;

          if (ins.rippleRings) {
            for (const rr of ins.rippleRings) {
              const localU = touchProgress - rr.phaseOffset;
              if (localU > 0 && localU < 0.82) {
                const normU = localU / 0.82; // 0 -> 1
                rr.mesh.position.set(touchX, -0.432 + baseLiquidY * 0.9, touchZ);
                rr.mesh.scale.setScalar(0.35 + normU * 3.8); // Small localized radius (0.04m -> 0.42m)!
                rr.mat.opacity = Math.sin(normU * Math.PI) * 0.72 * (1.0 - normU * 0.55);
              } else {
                rr.mat.opacity = 0.0;
              }
            }
          }
        } else {
          // Rest of cycle: insect glides gently in the air toward the next spot; water surface is calm here
          ins.isTouching = false;
          ins.touchProgress = 0;
          const airU = (cycleU - 0.36) / 0.64;
          const hoverAngle = touchAngle + Math.sin(airU * Math.PI * 2) * 0.35;
          const hoverRadius = touchRadius + Math.cos(airU * Math.PI * 2) * 0.45;
          const hx = Math.cos(hoverAngle) * hoverRadius;
          const hz = Math.sin(hoverAngle) * hoverRadius;
          ins.curX = hx;
          ins.curZ = hz;
          ins.group.position.set(hx, -0.22 + Math.sin(t * 3.2 + ins.phase) * 0.08, hz);
          ins.group.rotation.y = hoverAngle + Math.PI;
          if (ins.rippleRings) {
            for (const rr of ins.rippleRings) {
              rr.mat.opacity = 0.0;
            }
          }
        }

        // Flutter translucent wings
        if (ins.wings) {
          const flap = Math.sin(t * 28.0 + ins.phase) * 0.35;
          for (const w of ins.wings) {
            w.mesh.rotation.y = w.side * flap;
          }
        }
      }
    }

    // 3. Animate 3D Liquid Pool Surface (gentle up-and-down liquid sloshing + localized circular wave packets at touch spots!)
    if (this.waterMesh && this.waterBaseXZ) {
      const wPos = this.waterMesh.geometry.getAttribute('position');
      for (let idx = 0; idx < wPos.count; idx++) {
        const wx = this.waterBaseXZ[idx * 2];
        const wz = this.waterBaseXZ[idx * 2 + 1];
        // Smooth non-bullseye liquid pool swell (water gently rises and falls up & down like a real liquid pool)
        let waveY =
          Math.sin(wx * 0.62 + t * 1.55) * 0.052 +
          Math.cos(wz * 0.58 - t * 1.35) * 0.048 +
          Math.sin((wx * 0.7 - wz * 0.65) + t * 1.1) * 0.032;

        // Localized concentric 3D wave packet originating ONLY where an insect is currently touching the water!
        if (this.waterInsects) {
          for (const ins of this.waterInsects) {
            if (!ins.isTouching) continue;
            const dist = Math.hypot(wx - ins.curX, wz - ins.curZ);
            if (dist < 1.45) {
              const envelope = (1.0 - dist / 1.45) * Math.sin(ins.touchProgress * Math.PI);
              waveY += Math.sin(dist * 16.0 - ins.touchProgress * 18.0) * 0.038 * envelope;
            }
          }
        }
        wPos.setY(idx, waveY);
      }
      wPos.needsUpdate = true;
      this.waterMesh.geometry.computeVertexNormals();
    }
    if (this.underwaterKelp) {
      for (const klp of this.underwaterKelp) {
        klp.mesh.rotation.z = klp.baseRotZ + Math.sin(t * 2.1 + klp.phase) * 0.18;
      }
    }
    if (this.lilyPads) {
      for (const lp of this.lilyPads) {
        const waveHeight =
          Math.sin(lp.x * 0.62 + t * 1.55) * 0.046 +
          Math.cos(lp.z * 0.58 - t * 1.35) * 0.042;
        lp.group.position.y = lp.baseY + waveHeight;
      }
    }
    if (this.waterTexture) {
      this.waterTexture.offset.x = Math.sin(t * 0.22) * 0.035;
      this.waterTexture.offset.y = Math.cos(t * 0.18) * 0.035;
    }

    // 3B. Animate Jumping Frogs & Splash Ripples
    if (this.jumpingFrogs) {
      for (const f of this.jumpingFrogs) {
        const cyclePos = ((t + f.phaseOffset) % f.cycleDuration) / f.cycleDuration;
        // Frogs spend 0.0..0.42 hopping A->B, 0.42..0.50 resting on B, 0.50..0.92 hopping B->A, 0.92..1.0 resting on A
        let jumpU = 0;
        let fromX = f.startX;
        let fromZ = f.startZ;
        let toX = f.endX;
        let toZ = f.endZ;
        let isJumping = false;

        if (cyclePos < 0.42) {
          jumpU = cyclePos / 0.42;
          isJumping = true;
        } else if (cyclePos < 0.50) {
          jumpU = 1.0;
        } else if (cyclePos < 0.92) {
          jumpU = (cyclePos - 0.50) / 0.42;
          fromX = f.endX;
          fromZ = f.endZ;
          toX = f.startX;
          toZ = f.startZ;
          isJumping = true;
        } else {
          jumpU = 1.0;
          fromX = f.endX;
          fromZ = f.endZ;
          toX = f.startX;
          toZ = f.startZ;
        }

        const curX = fromX + (toX - fromX) * jumpU;
        const curZ = fromZ + (toZ - fromZ) * jumpU;
        const arcY = isJumping ? Math.sin(jumpU * Math.PI) * f.jumpHeight : 0;
        f.group.position.set(curX, f.baseY + arcY, curZ);

        // Face travel direction and pitch nose up/down along parabolic arc
        const headingYaw = Math.atan2(toX - fromX, toZ - fromZ);
        const pitch = isJumping ? Math.cos(jumpU * Math.PI) * -0.52 : 0;
        f.group.rotation.set(pitch, headingYaw, 0);

        if (f.hindLegs) {
          f.hindLegs.rotation.x = isJumping ? Math.sin(jumpU * Math.PI) * 0.85 : 0;
        }
        if (f.throatSac) {
          const ribbitScale = !isJumping ? 1.0 + Math.abs(Math.sin(t * 12.0 + f.phaseOffset)) * 0.45 : 0.85;
          f.throatSac.scale.setScalar(ribbitScale);
        }
        if (f.rippleMesh && f.rippleMat) {
          if (isJumping && (jumpU < 0.25 || jumpU > 0.75)) {
            const rProgress = jumpU < 0.25 ? jumpU / 0.25 : (jumpU - 0.75) / 0.25;
            const rx = jumpU < 0.25 ? fromX : toX;
            const rz = jumpU < 0.25 ? fromZ : toZ;
            f.rippleMesh.position.set(rx, -0.438, rz);
            f.rippleMesh.scale.setScalar(0.7 + rProgress * 2.2);
            f.rippleMat.opacity = Math.max(0, (1.0 - rProgress) * 0.65);
          } else {
            f.rippleMat.opacity = 0;
          }
        }
      }
    }

    // 3C. Animate Swimming & Leaping Koi / Trout Fish
    if (this.swimmingFish) {
      for (const fish of this.swimmingFish) {
        const ang = fish.startAngle + t * fish.orbitSpeed;
        const fx = Math.cos(ang) * fish.orbitRadius;
        const fz = Math.sin(ang) * fish.orbitRadius;

        // Tangent heading along circular orbit
        const dirSign = fish.orbitSpeed >= 0 ? 1 : -1;
        const tangentX = -Math.sin(ang) * dirSign;
        const tangentZ = Math.cos(ang) * dirSign;
        const yaw = Math.atan2(tangentX, tangentZ);

        // Periodic dolphin-style breach out of the translucent emerald water (cruises visibly at y = -0.64m underwater!)
        const leapCyclePos = ((t + fish.leapPhase) % fish.leapCycle) / fish.leapCycle;
        let fy = -0.62 + Math.sin(t * 2.4 + fish.leapPhase) * 0.05;
        let pitch = 0;
        if (leapCyclePos < 0.28) {
          const lu = leapCyclePos / 0.28;
          fy = -0.62 + Math.sin(lu * Math.PI) * (fish.leapHeight + 0.18);
          pitch = Math.cos(lu * Math.PI) * -0.68;
          if (fish.rippleMesh && fish.rippleMat) {
            fish.rippleMesh.position.set(fx, -0.425, fz);
            fish.rippleMesh.scale.setScalar(0.6 + lu * 2.4);
            fish.rippleMat.opacity = Math.sin(lu * Math.PI) * 0.72;
          }
        } else if (fish.rippleMat) {
          fish.rippleMat.opacity = 0;
        }

        fish.group.position.set(fx, fy, fz);
        fish.group.rotation.set(pitch, yaw, 0);
        if (fish.tailPivot) {
          fish.tailPivot.rotation.y = Math.sin(t * 14.0 + fish.leapPhase) * 0.42;
        }
      }
    }

    // 4. Pulse Altar Golden Runes & Wave Zurich/Swiss Banners
    const runePulse = 0.36 + Math.sin(t * 2.1) * 0.12;
    for (const rm of this.runeMaterials) {
      rm.emissiveIntensity = runePulse;
    }
    for (const banner of this.banners) {
      banner.rotation.z = Math.sin(t * 2.4 + (banner.userData.phase || 0)) * 0.06;
    }
  }

  dispose() {
    for (const off of this.offs) off();
    this.offs = [];
    this.clearHighlights();
    if (this.root.parent) {
      this.root.parent.remove(this.root);
    }
  }

  // ===========================================================================
  // 7. PROCEDURAL CANVAS TEXTURE GENERATORS (SAFE IN HEADLESS NODE TOO)
  // ===========================================================================

  createMarbleTexture(type = 'light') {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const isLight = type === 'light' || type === '#f3ebd9' || type === '#fafbfd' || type === 0xfafbfd;

    if (isLight) {
      // 1. Bianco Carrara / Calacatta Luxury White Marble
      const baseGrad = ctx.createLinearGradient(0, 0, 512, 512);
      baseGrad.addColorStop(0.0, '#ffffff');
      baseGrad.addColorStop(0.3, '#f5f7fa');
      baseGrad.addColorStop(0.7, '#eef2f6');
      baseGrad.addColorStop(1.0, '#fafbfc');
      ctx.fillStyle = baseGrad;
      ctx.fillRect(0, 0, 512, 512);

      // Subtle soft smoky clouding
      ctx.fillStyle = 'rgba(176, 190, 197, 0.12)';
      for (let i = 0; i < 9; i++) {
        const cx = (i * 73) % 512;
        const cy = (i * 97) % 512;
        const r = 60 + (i % 4) * 35;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Primary smoky-grey branching fractures
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.38)';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 110);
      ctx.bezierCurveTo(140, 160, 260, 80, 512, 220);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(80, 512);
      ctx.bezierCurveTo(190, 360, 310, 390, 512, 340);
      ctx.stroke();

      // Secondary fine veins & branching offshoots
      ctx.strokeStyle = 'rgba(71, 85, 105, 0.28)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(170, 145);
      ctx.bezierCurveTo(240, 220, 290, 270, 380, 290);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(270, 95);
      ctx.bezierCurveTo(340, 140, 390, 110, 480, 160);
      ctx.stroke();

      // Delicate micro-veins
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
      ctx.lineWidth = 1.0;
      for (let i = 0; i < 6; i++) {
        const sy = 60 + i * 75;
        ctx.beginPath();
        ctx.moveTo(0, sy);
        ctx.bezierCurveTo(150, sy + 30, 340, sy - 30, 512, sy + 15);
        ctx.stroke();
      }
    } else {
      // 2. Nero Marquina / Black Obsidian Luxury Dark Marble
      const baseGrad = ctx.createLinearGradient(0, 0, 512, 512);
      baseGrad.addColorStop(0.0, '#0c0e12');
      baseGrad.addColorStop(0.4, '#14181f');
      baseGrad.addColorStop(0.7, '#101318');
      baseGrad.addColorStop(1.0, '#0a0c10');
      ctx.fillStyle = baseGrad;
      ctx.fillRect(0, 0, 512, 512);

      // Deep mineral smoky undertones
      ctx.fillStyle = 'rgba(30, 41, 59, 0.35)';
      for (let i = 0; i < 8; i++) {
        const cx = (i * 89) % 512;
        const cy = (i * 67) % 512;
        const r = 70 + (i % 3) * 40;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Crisp white calcite lightning fractures
      ctx.strokeStyle = 'rgba(248, 250, 252, 0.75)';
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 390);
      ctx.bezierCurveTo(120, 350, 210, 420, 340, 270);
      ctx.bezierCurveTo(410, 180, 460, 210, 512, 120);
      ctx.stroke();

      // Branching white calcite capillaries
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.55)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(170, 375);
      ctx.bezierCurveTo(220, 310, 280, 300, 360, 340);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(340, 270);
      ctx.bezierCurveTo(390, 310, 440, 360, 512, 380);
      ctx.stroke();

      // Pale grey crystalline vein webs
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.32)';
      ctx.lineWidth = 1.0;
      for (let i = 0; i < 5; i++) {
        const sy = 80 + i * 85;
        ctx.beginPath();
        ctx.moveTo(0, sy);
        ctx.bezierCurveTo(160, sy - 25, 320, sy + 35, 512, sy - 15);
        ctx.stroke();
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  createRuneFriezeTexture() {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#181d24';
    ctx.fillRect(0, 0, 1024, 128);

    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(8, 14, 1008, 100);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 42px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const runes = 'ᚠ ᚢ ᚦ ᚨ ᚱ ᚲ ♔ ♕ ♗ ♘ ♖ ♙ ᚷ ᚹ ᚺ ᚾ ᛁ ᛃ 🐉 🏎️ 💜 🐟 ᛇ ᛈ ᛉ ᛊ';
    ctx.fillText(runes, 512, 64);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  createBorderTopTexture(orientation = 'horizontal') {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = orientation === 'horizontal' ? 1024 : 128;
    canvas.height = orientation === 'horizontal' ? 128 : 1024;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#1e242d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (orientation === 'horizontal') {
      for (let i = 0; i < 8; i++) {
        const x = 85 + (i + 0.5) * ((1024 - 170) / 8);
        ctx.fillText(FILES[i].toUpperCase(), x, 64);
      }
    } else {
      for (let i = 0; i < 8; i++) {
        const y = 85 + (i + 0.5) * ((1024 - 170) / 8);
        ctx.fillText(String(8 - i), 64, y);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  createGeminiArgonPlaqueTexture() {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const grad = ctx.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, '#2d251d');
    grad.addColorStop(0.5, '#1e1814');
    grad.addColorStop(1, '#15110e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 128);

    ctx.strokeStyle = '#c5a059';
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, 500, 116);
    ctx.strokeStyle = '#e0c080';
    ctx.lineWidth = 1;
    ctx.strokeRect(12, 12, 488, 104);

    ctx.fillStyle = '#e0c080';
    for (const [rx, ry] of [[18, 18], [494, 18], [18, 110], [494, 110]]) {
      ctx.beginPath();
      ctx.arc(rx, ry, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.font = 'bold 15px sans-serif';
    ctx.fillStyle = '#b0bec5';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('STADT ZÜRICH · LIMMATQUAI', 256, 36);

    ctx.font = 'bold 24px sans-serif';
    ctx.fillStyle = '#ffe082';
    ctx.fillText('✦ MADE WITH GEMINI 4 ARGON ✦', 256, 76);

    ctx.font = 'italic 12px sans-serif';
    ctx.fillStyle = '#90a4ae';
    ctx.fillText('CarChess3D · Family Wizard Chess Demo', 256, 102);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  createHurlimannCampusSignTexture() {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#1c222a';
    ctx.fillRect(0, 0, 256, 64);

    ctx.strokeStyle = '#4285f4';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(4, 4, 248, 56);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('HÜRLIMANN AREAL', 128, 18);

    ctx.fillStyle = '#90caf9';
    ctx.font = '10px sans-serif';
    ctx.fillText('Brandschenkestrasse 110', 128, 34);

    // 4 subtle Google primary color dots: Blue, Red, Yellow, Green
    const colors = ['#4285f4', '#ea4335', '#fbbc05', '#34a853'];
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = colors[i];
      ctx.beginPath();
      ctx.arc(104 + i * 16, 48, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  createSwampWaterTexture() {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const grad = ctx.createRadialGradient(256, 256, 24, 256, 256, 256);
    grad.addColorStop(0, '#125c4b');
    grad.addColorStop(0.45, '#0c3f34');
    grad.addColorStop(0.8, '#082c25');
    grad.addColorStop(1, '#051a16');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // Soft organic liquid mottling (no giant board-centered circles!)
    for (let i = 0; i < 24; i++) {
      const cx = 48 + ((i * 97) % 416);
      const cy = 48 + ((i * 151) % 416);
      const rad = 28 + (i % 5) * 16;
      const patchGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, rad);
      patchGrad.addColorStop(0, 'rgba(100, 255, 218, 0.14)');
      patchGrad.addColorStop(0.6, 'rgba(38, 166, 154, 0.06)');
      patchGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = patchGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  createSwampSeabedTexture() {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const grad = ctx.createRadialGradient(256, 256, 30, 256, 256, 256);
    grad.addColorStop(0, '#0a382e');
    grad.addColorStop(0.55, '#062620');
    grad.addColorStop(1, '#031411');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // Underwater luminous caustic web on the sandy/mossy pond floor
    ctx.strokeStyle = 'rgba(100, 255, 218, 0.28)';
    ctx.lineWidth = 2.2;
    for (let i = 0; i < 28; i++) {
      const x1 = (i * 73) % 512;
      const y1 = (i * 137) % 512;
      const r = 22 + (i % 6) * 16;
      ctx.beginPath();
      ctx.arc(x1, y1, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  createClockFaceTexture() {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#12161f';
    ctx.beginPath();
    ctx.arc(128, 128, 122, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#ffd54f';
    ctx.lineWidth = 8;
    ctx.stroke();

    // Hour ticks
    ctx.save();
    ctx.translate(128, 128);
    for (let i = 0; i < 12; i++) {
      ctx.rotate(Math.PI / 6);
      ctx.fillStyle = '#ffe082';
      ctx.fillRect(-4, -108, 8, 22);
    }
    // Clock hands pointing to 10:10
    ctx.strokeStyle = '#ffd54f';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-48, -42);
    ctx.stroke();

    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(58, -54);
    ctx.stroke();
    ctx.restore();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  createBannerTexture(type = 'zurich') {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    if (type === 'swiss') {
      ctx.fillStyle = '#d32f2f';
      ctx.fillRect(0, 0, 128, 256);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(50, 74, 28, 108);
      ctx.fillRect(20, 114, 88, 28);
    } else {
      // Zurich diagonal blue & white crest
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 128, 256);
      ctx.fillStyle = '#1976d2';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(128, 256);
      ctx.lineTo(0, 256);
      ctx.closePath();
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  createStarrySkyTexture() {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, '#060a17');
    grad.addColorStop(0.55, '#131d38');
    grad.addColorStop(1, '#0e2e26');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 512);

    // Deterministic twilight stars
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 220; i++) {
      const sx = (i * 173) % 1024;
      const sy = (i * 97) % 340;
      const r = i % 7 === 0 ? 1.8 : 1.1;
      ctx.globalAlpha = 0.35 + (i % 5) * 0.15;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /**
   * Procedural "Skin Zurighese" texture generator for 3D Old-Town Guild Houses & Romanesque Towers:
   * Draws authentic Swiss timber framing (Fachwerk), sandstone blocks, shuttered windows, and warm glowing golden panes!
   */
  createZurichGuildHouseSkinTexture(wallHex = '#f2e3c6', timberHex = '#6d4c41', windowGlowHex = '#ffd54f') {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = wallHex;
    ctx.fillRect(0, 0, 256, 512);

    // Subtle stone/stucco horizontal courses
    ctx.strokeStyle = 'rgba(60, 40, 30, 0.14)';
    ctx.lineWidth = 2;
    for (let y = 16; y < 512; y += 24) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(256, y);
      ctx.stroke();
    }

    // Swiss Fachwerk half-timber beams
    ctx.strokeStyle = timberHex;
    ctx.lineWidth = 6;
    for (const y of [8, 128, 256, 384, 504]) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(256, y);
      ctx.stroke();
    }
    for (const x of [6, 128, 250]) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 512);
      ctx.stroke();
    }
    // Diagonal cross-braces on upper floors
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(6, 128);
    ctx.lineTo(64, 10);
    ctx.moveTo(250, 128);
    ctx.lineTo(192, 10);
    ctx.stroke();

    // 4 floors x 3 columns of arched/mullioned Zurich windows with green/red shutters and warm golden glow
    for (let row = 0; row < 4; row++) {
      const wy = 32 + row * 124;
      for (let col = 0; col < 3; col++) {
        const wx = 26 + col * 82;
        // Shutters
        ctx.fillStyle = row % 2 === 0 ? '#1b5e20' : '#8e2424';
        ctx.fillRect(wx - 10, wy, 8, 56);
        ctx.fillRect(wx + 38, wy, 8, 56);
        // Window frame
        ctx.fillStyle = '#2b1d16';
        ctx.fillRect(wx, wy - 2, 36, 60);
        // Warm lit glass
        ctx.fillStyle = windowGlowHex;
        ctx.fillRect(wx + 4, wy + 2, 28, 52);
        // Mullion cross
        ctx.strokeStyle = '#2b1d16';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(wx + 18, wy + 2);
        ctx.lineTo(wx + 18, wy + 54);
        ctx.moveTo(wx + 4, wy + 28);
        ctx.lineTo(wx + 32, wy + 28);
        ctx.stroke();
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
}
