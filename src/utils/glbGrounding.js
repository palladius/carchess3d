/**
 * @fileoverview GLB Grounding & Rank-Height Normalization Utility.
 * Ensures every loaded .glb (and procedural fallback) sits cleanly at y = 0.0m
 * on the 8x8 board surface and matches the canonical piece height hierarchy
 * defined in docs/floorplan.svg.
 *
 * Headless-safe math functions (`computeGroundingTransform`, `CANONICAL_PIECE_HEIGHTS`)
 * can be imported in Node unit tests without Three.js or DOM.
 */

export const CANONICAL_PIECE_HEIGHTS = Object.freeze({
  p: 0.80,
  pawn: 0.80,
  r: 2.50,
  rook: 2.50,
  n: 1.92,
  knight: 1.92,
  b: 1.55,
  bishop: 1.55,
  q: 1.68,
  queen: 1.68,
  k: 1.86,
  king: 1.86,
});

export const PEDESTAL_DIAMETER = 0.75;
export const PEDESTAL_RADIUS = PEDESTAL_DIAMETER / 2; // 0.375m
export const PEDESTAL_HEIGHT = 0.22; // 0.22m base height

/**
 * Resolves the canonical target height in meters for a piece type/rank.
 * @param {string|number} rankOrHeight - 'p'|'r'|'n'|'b'|'q'|'k' or numeric height
 * @returns {number}
 */
export function resolveCanonicalHeight(rankOrHeight) {
  if (typeof rankOrHeight === 'number' && rankOrHeight > 0) {
    return rankOrHeight;
  }
  const key = String(rankOrHeight || 'p').toLowerCase();
  return CANONICAL_PIECE_HEIGHTS[key] ?? 1.20;
}

/**
 * Computes the uniform scale and local translation offset so an arbitrary 3D
 * bounding box `{ min: {x,y,z}, max: {x,y,z} }` is horizontally centered at
 * `(0, 0)` and grounded at `y = 0` (`finalMinY === 0`), scaled to `targetHeight`.
 *
 * @param {{ min: {x:number, y:number, z:number}, max: {x:number, y:number, z:number} }} bbox
 * @param {string|number} rankOrHeight
 * @param {object} [opts]
 * @param {number} [opts.maxRadius] - Optional max horizontal radius cap
 * @param {number} [opts.baseElevation] - Optional Y elevation above 0 (e.g. when placed atop a pedestal)
 * @returns {{ scale: number, offset: {x:number, y:number, z:number}, targetHeight: number, finalHeight: number, finalMinY: number, finalMaxY: number }}
 */
export function computeGroundingTransform(bbox, rankOrHeight, opts = {}) {
  const targetHeight = resolveCanonicalHeight(rankOrHeight);
  const baseElevation = opts.baseElevation ?? 0;
  const maxRadius = opts.maxRadius ?? Infinity;

  const sizeX = Math.max(1e-6, bbox.max.x - bbox.min.x);
  const sizeY = Math.max(1e-6, bbox.max.y - bbox.min.y);
  const sizeZ = Math.max(1e-6, bbox.max.z - bbox.min.z);

  const centerX = (bbox.min.x + bbox.max.x) * 0.5;
  const centerZ = (bbox.min.z + bbox.max.z) * 0.5;
  const horizRadius = Math.hypot(sizeX, sizeZ) * 0.5;

  const heightScale = targetHeight / sizeY;
  const radiusScale = Number.isFinite(maxRadius) && horizRadius > 1e-6
    ? maxRadius / horizRadius
    : heightScale;
  const scale = Math.min(heightScale, radiusScale);

  // To place the scaled object's bottom at y = baseElevation and X/Z center at 0:
  // worldPos = (vertexPos + localOffset) * scale + holderPos
  // If we apply scale on the holder and localOffset on the inner mesh:
  // innerMesh.position = (-centerX, -bbox.min.y, -centerZ)
  // holder.position.y = baseElevation
  const offset = {
    x: -centerX,
    y: -bbox.min.y,
    z: -centerZ,
  };

  const finalMinY = baseElevation + (bbox.min.y + offset.y) * scale;
  const finalHeight = sizeY * scale;
  const finalMaxY = finalMinY + finalHeight;

  return {
    scale,
    offset,
    targetHeight,
    finalHeight,
    finalMinY: Math.abs(finalMinY) < 1e-9 ? 0 : finalMinY,
    finalMaxY,
  };
}

/**
 * Normalizes and grounds a Three.js Object3D inside a wrapper Group so its
 * world/local bounding box has `min.y === baseElevation` (default 0) and height
 * matching the canonical rank height.
 *
 * @param {typeof import('three')} THREE
 * @param {import('three').Object3D} object3D
 * @param {string|number} rankOrHeight
 * @param {object} [opts]
 * @returns {{ holder: import('three').Group, transform: ReturnType<typeof computeGroundingTransform> }}
 */
export function groundAndNormalizeObject3D(THREE, object3D, rankOrHeight, opts = {}) {
  object3D.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object3D);
  const bbox = {
    min: { x: box.min.x, y: box.min.y, z: box.min.z },
    max: { x: box.max.x, y: box.max.y, z: box.max.z },
  };

  const transform = computeGroundingTransform(bbox, rankOrHeight, opts);
  object3D.position.set(transform.offset.x, transform.offset.y, transform.offset.z);

  const holder = new THREE.Group();
  holder.name = `GroundedPiece_${String(rankOrHeight)}`;
  holder.scale.setScalar(transform.scale);
  holder.position.set(0, opts.baseElevation ?? 0, 0);
  holder.add(object3D);
  holder.updateMatrixWorld(true);

  return { holder, transform };
}
