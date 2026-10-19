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

    this.combatBlend = 0.0;
    this.inCombatCinemaMode = false;
    this._zurichBgColor = new THREE.Color(0x0b1528);
    this._combatBgColor = new THREE.Color(0x05070e);
    this._dioramaFadeReady = false;
    this._dioramaGroups = [];
    this._dioramaMaterials = [];

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

    // Emerald water plane at y = -0.45m (outer radius 24m)
    const waterTex = this.createSwampWaterTexture();
    this.waterTexture = waterTex;
    this.waterMaterial = new THREE.MeshStandardMaterial({
      color: 0x156b52,
      map: waterTex,
      roughness: 0.26,
      metalness: 0.22,
      emissive: new THREE.Color(0x0f4d3a),
      emissiveMap: waterTex,
      emissiveIntensity: 0.72,
    });
    const waterGeo = new THREE.CircleGeometry(25.0, 64);
    waterGeo.rotateX(-Math.PI / 2);
    this.waterMesh = new THREE.Mesh(waterGeo, this.waterMaterial);
    this.waterMesh.position.y = -0.45;
    this.waterMesh.receiveShadow = true;
    swampGroup.add(this.waterMesh);

    // Glowing Sunken Magic Rune Ring beneath the water surface (y = -0.445m, r = 7.1m .. 7.9m)
    const sunkenRingGeo = new THREE.RingGeometry(7.0, 7.85, 48);
    sunkenRingGeo.rotateX(-Math.PI / 2);
    this.sunkenRuneMat = new THREE.MeshBasicMaterial({
      color: 0x52ebb0,
      transparent: true,
      opacity: 0.34,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const sunkenRing = new THREE.Mesh(sunkenRingGeo, this.sunkenRuneMat);
    sunkenRing.position.y = -0.442;
    swampGroup.add(sunkenRing);

    // 20 Sculpted 3D Lily Pads + Pink/Lilac Lotus Blossoms (r = 6.5m .. 15.5m)
    const padMat = new THREE.MeshStandardMaterial({
      color: 0x268c55,
      roughness: 0.56,
      metalness: 0.08,
      emissive: 0x0b3820,
      emissiveIntensity: 0.25,
    });
    const petalPinkMat = new THREE.MeshStandardMaterial({
      color: 0xf48fb1,
      roughness: 0.35,
      emissive: 0x880e4f,
      emissiveIntensity: 0.35,
    });
    const petalLilacMat = new THREE.MeshStandardMaterial({
      color: 0xce93d8,
      roughness: 0.35,
      emissive: 0x4a148c,
      emissiveIntensity: 0.35,
    });
    const lotusCoreMat = new THREE.MeshBasicMaterial({ color: 0xffeb3b });

    this.lilyPads = [];
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2 + (i % 3) * 0.14;
      const radius = 6.8 + ((i * 37) % 100) * 0.082; // 6.8m .. 15.0m
      const lx = Math.cos(angle) * radius;
      const lz = Math.sin(angle) * radius;
      const padRadius = 0.44 + (i % 4) * 0.12;

      const padGroup = new THREE.Group();
      padGroup.position.set(lx, -0.435, lz);
      padGroup.rotation.y = angle * 1.7;

      // Notched lily pad cylinder (pacman slice 0 .. 1.88*PI)
      const padGeo = new THREE.CylinderGeometry(padRadius, padRadius * 0.95, 0.03, 18, 1, false, 0, Math.PI * 1.86);
      const padMesh = new THREE.Mesh(padGeo, padMat);
      padMesh.receiveShadow = true;
      padGroup.add(padMesh);

      // Add sculpted lotus flower on every second or third pad
      if (i % 2 === 0) {
        const lotus = new THREE.Group();
        lotus.position.y = 0.02;
        const pMat = i % 4 === 0 ? petalPinkMat : petalLilacMat;
        const petalGeo = new THREE.ConeGeometry(0.085, 0.24, 5);
        petalGeo.translate(0, 0.09, 0);
        for (let p = 0; p < 6; p++) {
          const petal = new THREE.Mesh(petalGeo, pMat);
          petal.rotation.y = (p / 6) * Math.PI * 2;
          petal.rotation.z = 0.42;
          lotus.add(petal);
        }
        const center = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), lotusCoreMat);
        center.position.y = 0.05;
        lotus.add(center);
        padGroup.add(lotus);
      }

      swampGroup.add(padGroup);
      this.lilyPads.push({ group: padGroup, baseY: -0.435, phase: i * 0.85 });
    }

    // Cattails / Swamp Reeds clusters + Twisted Mossy Swamp Tree Roots (x = ±7.5m .. ±11.5m)
    const reedStemMat = new THREE.MeshStandardMaterial({ color: 0x357a46, roughness: 0.72 });
    const reedHeadMat = new THREE.MeshStandardMaterial({ color: 0x5c3d33, roughness: 0.82 });
    const rootWoodMat = new THREE.MeshStandardMaterial({
      color: 0x473628,
      roughness: 0.82,
      emissive: 0x142416,
      emissiveIntensity: 0.22,
    });

    const rootClusters = [
      { x: -8.4, z: 3.6, rot: 0.4 },
      { x: 8.4, z: 3.6, rot: -0.4 },
      { x: -9.6, z: -2.5, rot: 0.9 },
      { x: 9.6, z: -2.5, rot: -0.9 },
      { x: -7.8, z: -6.8, rot: 1.2 },
      { x: 7.8, z: -6.8, rot: -1.2 },
    ];

    for (const rc of rootClusters) {
      const cluster = new THREE.Group();
      cluster.position.set(rc.x, -0.45, rc.z);
      cluster.rotation.y = rc.rot;

      // Twisted gnarled swamp root arch
      const archGeo = new THREE.TorusGeometry(0.95, 0.16, 8, 18, Math.PI);
      const arch = new THREE.Mesh(archGeo, rootWoodMat);
      arch.castShadow = true;
      cluster.add(arch);

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

    // Hide legacy flat green moat circle & brown torus arches so the full-screen
    // J-curved Zurich & Limmat cyclorama fills the lower viewport without obstruction
    swampGroup.visible = false;
    this.swampGroup = swampGroup;
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

  buildZurichSkylineAndAlps() {
    const skyline = new THREE.Group();
    skyline.name = 'ZurichSkylineAndAlps';
    this.root.add(skyline);

    let zurichTex = null;
    if (typeof document !== 'undefined') {
      try {
        const loader = new THREE.TextureLoader();
        zurichTex = loader.load('./assets/environments/zurich_panorama.jpg');
        if (zurichTex) {
          zurichTex.colorSpace = THREE.SRGBColorSpace;
          zurichTex.minFilter = THREE.LinearFilter;
          zurichTex.magFilter = THREE.LinearFilter;
        }
      } catch {
        zurichTex = null;
      }
    }

    const panoGroup = new THREE.Group();
    panoGroup.name = 'ZurichFairytalePanoramaBackdrop';
    panoGroup.position.set(0, 0, 0);

    // Full-screen 180° wrap-around vertical cyclorama (64 horizontal x 16 vertical segments):
    // Pure vertical walls (vx, vz depend ONLY on u; vy depends ONLY on v -> zero diagonal stretching!)
    // wrapping from the front-left (z = +2.5m) around the back of the chessboard (z = -12.4m)
    // to the front-right (z = +2.5m), extending down to y = -4.2m .. -6.8m so 100% of the viewport
    // (top, sides, and bottom around the chessboard) is filled by the Zurich panorama!
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
      const v = uvAttr.getY(i); // 0.0 (Bottom river) -> 1.0 (Top sky)

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
      map: zurichTex,
      color: zurichTex ? 0xd8e2f0 : 0x1a2638,
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
  }

  // ===========================================================================
  // 5. EVENT BUS BINDINGS FOR BOARD HIGHLIGHTS
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
        child.name !== 'BoardHighlights' &&
        child.name !== 'EnchantedSwampMoat'
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
   * Animates brazier flames/light flicker, fireflies, water shimmer, banners, and rune glow pulse.
   * @param {number} dt
   */
  update(dt = 0.016) {
    this.time += dt;
    const t = this.time;

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

    // 3. Animate Lily Pads gentle bobbing & Sunken Rune shimmer
    if (this.lilyPads) {
      for (const lp of this.lilyPads) {
        lp.group.position.y = lp.baseY + Math.sin(t * 1.4 + lp.phase) * 0.012;
      }
    }
    if (this.sunkenRuneMat) {
      this.sunkenRuneMat.opacity = 0.22 + Math.sin(t * 1.8) * 0.08;
    }
    if (this.waterTexture) {
      this.waterTexture.offset.x = Math.sin(t * 0.18) * 0.03;
      this.waterTexture.offset.y = Math.cos(t * 0.14) * 0.03;
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

    const grad = ctx.createRadialGradient(256, 256, 30, 256, 256, 256);
    grad.addColorStop(0, '#16694e');
    grad.addColorStop(0.55, '#0d4232');
    grad.addColorStop(1, '#062119');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // Shimmering bioluminescent ripple rings
    ctx.strokeStyle = 'rgba(105, 240, 174, 0.24)';
    ctx.lineWidth = 2;
    for (let r = 45; r < 250; r += 28) {
      ctx.beginPath();
      ctx.arc(256, 256, r, 0, Math.PI * 2);
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
}
