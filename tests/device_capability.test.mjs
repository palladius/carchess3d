import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectHardwareTier,
  detectRpiTurboMode,
  resolveModelLod,
  QUALITY_TIERS,
} from '../src/core/DeviceCapabilityHelper.js';
import { resolvePieceGlbForLod } from '../src/core/Registry.js';

describe('DeviceCapabilityHelper', () => {
  it('defines valid QUALITY_TIERS', () => {
    assert.deepEqual(QUALITY_TIERS, ['low', 'medium', 'high', 'auto']);
  });

  it('detects mobile phones as low tier', () => {
    const tier = detectHardwareTier({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
      screenWidth: 390,
      screenHeight: 844,
      deviceMemory: 4,
      hardwareConcurrency: 4,
    });
    assert.equal(tier, 'low');
  });

  it('detects iPad / tablets as medium tier', () => {
    const tier = detectHardwareTier({
      userAgent: 'Mozilla/5.0 (iPad; CPU OS 16_5 like Mac OS X)',
      screenWidth: 820,
      screenHeight: 1180,
      deviceMemory: 6,
      hardwareConcurrency: 8,
    });
    assert.equal(tier, 'medium');
  });

  it('detects powerful desktop rigs as high tier', () => {
    const tier = detectHardwareTier({
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
      screenWidth: 2560,
      screenHeight: 1440,
      deviceMemory: 16,
      hardwareConcurrency: 16,
    });
    assert.equal(tier, 'high');
  });

  it('honors manual override over auto-detected tier', () => {
    assert.equal(resolveModelLod('low', 'high'), 'low');
    assert.equal(resolveModelLod('high', 'low'), 'high');
    assert.equal(resolveModelLod('medium', 'high'), 'medium');
    assert.equal(resolveModelLod('auto', 'medium'), 'medium');
    assert.equal(resolveModelLod('auto', 'low'), 'low');
    assert.equal(resolveModelLod(null, 'medium'), 'medium');
  });

  it('detects Raspberry Pi Linux aarch64, DPR <= 0.85 runner, and query overrides', () => {
    assert.equal(
      detectRpiTurboMode({
        userAgent: 'Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 Chrome/130.0.0.0',
      }),
      true,
    );
    assert.equal(
      detectHardwareTier({
        userAgent: 'Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36',
        screenWidth: 1920,
        screenHeight: 1080,
      }),
      'low',
    );
    assert.equal(
      detectRpiTurboMode({
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
        devicePixelRatio: 0.75,
      }),
      true,
    );
    assert.equal(
      detectRpiTurboMode({
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
        search: '?rpi=1',
      }),
      true,
    );
    assert.equal(
      detectRpiTurboMode({
        userAgent: 'Mozilla/5.0 (X11; Linux aarch64)',
        search: '?rpi=0',
      }),
      false,
    );
    assert.equal(
      detectRpiTurboMode({
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
        devicePixelRatio: 1,
      }),
      false,
    );
  });

  it('resolves -10k.glb low-poly models across factions in low LOD tier', () => {
    for (const family of ['carlesso', 'classic', 'swamp']) {
      for (const pieceKey of ['k', 'q', 'b', 'n', 'r', 'p']) {
        const url = resolvePieceGlbForLod(pieceKey, 'low', { family });
        assert.ok(url.endsWith('-10k.glb'), `expected -10k.glb for ${family}/${pieceKey}, got ${url}`);
      }
    }
    assert.equal(
      resolvePieceGlbForLod('q', 'low', { family: 'carlesso', queenVariant: 'wedding' }).endsWith('-10k.glb'),
      true,
    );
  });
});
