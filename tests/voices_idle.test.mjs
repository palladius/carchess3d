import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import * as THREE from '../vendor/three/three.module.js';
import { GameEventBus } from '../src/core/EventBus.js';
import { CHARACTER_REGISTRY, VOICE_LINES } from '../src/core/Registry.js';
import { AudioListener } from '../src/listeners/AudioListener.js';
import { HudListener } from '../src/listeners/HudListener.js';
import {
  createArticulatedSkeletonRig,
  updateSkeletonRigPose,
} from '../src/views/SkeletonRigHelper.js';

const PIECE_KEYS = ['k', 'q', 'b', 'n', 'r', 'p'];

describe('Living Idle Animations & Character Hover/Select Voices', () => {
  it('defines VOICE_LINES and authentic MP3 audio files for all 6 piece types', () => {
    for (const type of PIECE_KEYS) {
      const v = VOICE_LINES[type];
      assert.ok(v, `Missing VOICE_LINES[${type}]`);
      assert.ok(v.hoverSound?.id, `Missing hoverSound.id for ${type}`);
      assert.ok(v.hoverSound?.label?.it, `Missing hoverSound.label.it for ${type}`);
      assert.ok(v.quote?.it, `Missing quote.it for ${type}`);
      assert.ok(v.audioUrl, `Missing audioUrl for ${type}`);
      assert.equal(CHARACTER_REGISTRY[type].voiceLine, v);

      const diskPath = path.resolve(process.cwd(), v.audioUrl);
      assert.ok(fs.existsSync(diskPath), `Expected voice MP3 file to exist: ${v.audioUrl}`);
      const stat = fs.statSync(diskPath);
      assert.ok(stat.size > 5000, `Expected non-empty MP3 for ${v.audioUrl}`);
    }

    assert.equal(VOICE_LINES.n.quote.it, 'Dimmi papino!');
    assert.equal(VOICE_LINES.b.quote.it, 'Agli ordini, Signore!');
    assert.equal(VOICE_LINES.q.quote.it, 'This is an interesting choice...');
    assert.equal(VOICE_LINES.q.speechLang, 'en-GB');
    assert.ok(VOICE_LINES.p.quote.it.includes('Puffin'));
  });

  it('AudioListener plays creature sound on PIECE_HOVERED and character voice on PIECE_SELECTED', () => {
    const bus = new GameEventBus();
    const audio = new AudioListener({ bus });
    const spokenEvents = [];
    bus.on('VOICE_LINE_SPOKEN', (e) => spokenEvents.push(e));

    bus.emit({ type: 'PIECE_HOVERED', square: 'g1', piece: { type: 'n', color: 'w' } });
    bus.flush();
    assert.equal(audio.playedSfx.at(-1), 'hover_n');

    bus.emit({ type: 'PIECE_HOVERED', square: 'c1', piece: { type: 'b', color: 'w' } });
    bus.flush();
    assert.equal(audio.playedSfx.at(-1), 'hover_b');

    bus.emit({ type: 'PIECE_HOVERED', square: 'e2', piece: { type: 'p', color: 'w' } });
    bus.flush();
    assert.equal(audio.playedSfx.at(-1), 'hover_p');

    bus.emit({
      type: 'PIECE_SELECTED',
      square: 'g1',
      piece: { type: 'n', color: 'w' },
      legalMoves: [],
    });
    bus.flush();
    bus.flush();
    assert.equal(audio.playedSfx.at(-1), 'voice_n');
    assert.equal(audio.playedVoices.at(-1)?.quote, 'Dimmi papino!');
    assert.equal(spokenEvents.length, 1);
    assert.equal(spokenEvents[0].quote, 'Dimmi papino!');

    bus.emit({
      type: 'PIECE_SELECTED',
      square: 'd1',
      piece: { type: 'q', color: 'w' },
      legalMoves: [],
    });
    bus.flush();
    bus.flush();
    assert.equal(audio.playedSfx.at(-1), 'voice_q');
    assert.equal(audio.playedVoices.at(-1)?.quote, 'This is an interesting choice...');
  });

  it('HudListener updates toast and tracks lastHoverSound and lastVoiceQuote', () => {
    const bus = new GameEventBus();
    const hud = new HudListener({ bus });

    bus.emit({ type: 'PIECE_HOVERED', square: 'c1', piece: { type: 'b', color: 'w' } });
    bus.flush();
    assert.equal(hud.lastHoverSound, VOICE_LINES.b.hoverSound.label.it);
    assert.ok(hud.lastToast.includes('Ale'));

    bus.emit({
      type: 'PIECE_SELECTED',
      square: 'c1',
      piece: { type: 'b', color: 'w' },
      legalMoves: [{ from: 'c1', to: 'f4' }],
    });
    bus.flush();
    assert.equal(hud.lastVoiceQuote, 'Agli ordini, Signore!');
    assert.ok(hud.lastToast.includes('Agli ordini, Signore!'));
  });

  it('SkeletonRigHelper includes tail bone and animates continuous living idle poses', () => {
    for (const type of ['n', 'p', 'b', 'r', 'q', 'k']) {
      const rig = createArticulatedSkeletonRig(THREE, type, 1.35, 'w');
      assert.ok(rig.userData.joints.tail, `Expected tail joint on ${type}`);

      updateSkeletonRigPose(rig, type, {
        walkPhase: 0,
        walkAmp: 0,
        idlePhase: 1.1,
        idleAmp: 0.75,
      });

      const tailRotY = rig.userData.joints.tail.rotation.y;
      const headRotY = rig.userData.joints.head.rotation.y;
      assert.notEqual(
        tailRotY,
        0,
        `Expected tail Y rotation to be non-zero during living idle for piece type ${type}`,
      );
      assert.notEqual(
        headRotY,
        0,
        `Expected head Y rotation to be non-zero during living idle for piece type ${type}`,
      );
    }
  });
});
