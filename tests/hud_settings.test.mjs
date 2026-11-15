import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { HudListener } from '../src/listeners/HudListener.js';
import { GameEventBus } from '../src/core/EventBus.js';

describe('HudListener Quality Controls', () => {
  it('manages qualityTier (low, medium, high, auto) and broadcasts QUALITY_TIER_CHANGED', () => {
    const bus = new GameEventBus();
    const hud = new HudListener();
    hud.init({ bus });
    let received = null;
    bus.on('QUALITY_TIER_CHANGED', (e) => { received = e; });

    hud.setQualityTier('low');
    assert.equal(hud.qualityTier, 'low');
    bus.flush();
    assert.deepEqual(received, { type: 'QUALITY_TIER_CHANGED', tier: 'low', effectiveLod: 'low' });

    hud.setQualityTier('high');
    bus.flush();
    assert.deepEqual(received, { type: 'QUALITY_TIER_CHANGED', tier: 'high', effectiveLod: 'high' });
  });

  it('toggles RPi Turbo mode and updates auto LOD tier + callback cleanly', () => {
    const bus = new GameEventBus();
    const applied = [];
    let pieceTier = null;
    const hud = new HudListener();
    hud.init({
      bus,
      applyRpiTurboMode: (v) => applied.push(v),
      pieces: {
        setQualityTier: (tier, lod) => {
          pieceTier = { tier, lod };
        },
      },
    });

    hud.setRpiTurboMode(true, { silent: true });
    assert.equal(hud.rpiTurboMode, true);
    assert.equal(hud.detectedHardwareTier, 'low');
    assert.equal(hud.effectiveLod, 'low');
    assert.deepEqual(pieceTier, { tier: 'auto', lod: 'low' });
    assert.deepEqual(applied, [true]);

    hud.setRpiTurboMode(false, { silent: true });
    assert.equal(hud.rpiTurboMode, false);
    assert.deepEqual(applied, [true, false]);
  });
});
