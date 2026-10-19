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
});
