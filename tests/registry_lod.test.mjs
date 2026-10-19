import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHARACTER_REGISTRY,
  FAMILY_REGISTRIES,
  resolvePieceGlbForLod,
} from '../src/core/Registry.js';

describe('Registry LOD Support', () => {
  it('resolves piece GLB path for low, medium, and high LOD tiers', () => {
    for (const key of ['k', 'q', 'b', 'n', 'r', 'p']) {
      const low = resolvePieceGlbForLod(key, 'low');
      const med = resolvePieceGlbForLod(key, 'medium');
      const high = resolvePieceGlbForLod(key, 'high');

      assert.ok(typeof low === 'string' && low.endsWith('.glb'), `low glb for ${key} must end with .glb`);
      assert.ok(typeof med === 'string' && med.endsWith('.glb'), `med glb for ${key} must end with .glb`);
      assert.ok(typeof high === 'string' && high.endsWith('.glb'), `high glb for ${key} must end with .glb`);
    }
  });

  it('honors family and variants when resolving LOD', () => {
    const classicKing = resolvePieceGlbForLod('k', 'low', { family: 'classic' });
    assert.equal(classicKing, 'assets/models/classic/king-classic-re-10k.glb');

    const swampQueen = resolvePieceGlbForLod('q', 'low', { family: 'swamp' });
    assert.equal(swampQueen, 'assets/models/swamp/queen-swamp-orchessa-10k.glb');

    const carlessoKingLow = resolvePieceGlbForLod('k', 'low');
    assert.equal(carlessoKingLow, 'assets/models/king-riccardo-10k.glb');

    const carlessoKingMed = resolvePieceGlbForLod('k', 'medium');
    assert.equal(carlessoKingMed, 'assets/models/king-riccardo-50k.glb');

    const bishopAstrolabeHigh = resolvePieceGlbForLod('b', 'high', { family: 'carlesso', bishopVariant: 'astrolabe' });
    assert.equal(bishopAstrolabeHigh, 'assets/models/bishop-ale-2-remastered.glb');

    const bishopAstrolabeLow = resolvePieceGlbForLod('b', 'low', { family: 'carlesso', bishopVariant: 'astrolabe' });
    assert.equal(bishopAstrolabeLow, 'assets/models/bishop-ale-2-remastered-10k.glb');

    const bishopHy2Low = resolvePieceGlbForLod('b', 'low', { family: 'carlesso', bishopVariant: 'hy2' });
    assert.equal(bishopHy2Low, 'assets/models/bishop-ale-hy2-10k.glb');
  });

  it('falls back to canonical glbUrl if specific lod is missing', () => {
    const resolved = resolvePieceGlbForLod('k', 'unknown-tier');
    assert.equal(resolved, CHARACTER_REGISTRY.k.glbUrl);
  });
});
