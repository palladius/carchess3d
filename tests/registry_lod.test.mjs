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
    assert.ok(classicKing.includes('classic'), 'should resolve classic family model');

    const bishopAstrolabe = resolvePieceGlbForLod('b', 'high', { family: 'carlesso', bishopVariant: 'astrolabe' });
    assert.ok(bishopAstrolabe.includes('bishop-ale-2'), 'should resolve astrolabe variant');
  });

  it('falls back to canonical glbUrl if specific lod is missing', () => {
    const resolved = resolvePieceGlbForLod('k', 'unknown-tier');
    assert.equal(resolved, CHARACTER_REGISTRY.k.glbUrl);
  });
});
