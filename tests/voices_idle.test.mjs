import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import * as THREE from '../vendor/three/three.module.js';
import { GameEventBus } from '../src/core/EventBus.js';
import { CHARACTER_REGISTRY, VOICE_LINES } from '../src/core/Registry.js';
import {
  AudioListener,
  CHESS_STRINGS_BG_URL,
  CHESS_STRINGS_THEME_URL,
  COMBAT_AUDIO_URL,
  COMBAT_CUE_POINTS_S,
  COMBAT_MUSIC_PEAK_VOLUME,
  NORMAL_MUSIC_VOLUME,
} from '../src/listeners/AudioListener.js';
import { HudListener } from '../src/listeners/HudListener.js';
import {
  createArticulatedSkeletonRig,
  updateSkeletonRigPose,
} from '../src/views/SkeletonRigHelper.js';

const PIECE_KEYS = ['k', 'q', 'b', 'n', 'r', 'p'];

describe('Living Idle Animations & Character Hover/Select Voices', () => {
  it('defines VOICE_LINES, multi-clip variants, and authentic Gemini 3.8 TTS MP3 audio files for all 6 piece types', () => {
    for (const type of PIECE_KEYS) {
      const v = VOICE_LINES[type];
      assert.ok(v, `Missing VOICE_LINES[${type}]`);
      assert.ok(v.hoverSound?.id, `Missing hoverSound.id for ${type}`);
      assert.ok(v.hoverSound?.label?.it, `Missing hoverSound.label.it for ${type}`);
      assert.ok(v.quote?.it, `Missing quote.it for ${type}`);
      assert.ok(v.audioUrl, `Missing audioUrl for ${type}`);
      assert.ok(Array.isArray(v.variants) && v.variants.length >= 2, `Expected variants array for ${type}`);
      assert.equal(CHARACTER_REGISTRY[type].voiceLine, v);

      const diskPath = path.resolve(process.cwd(), v.audioUrl);
      assert.ok(fs.existsSync(diskPath), `Expected voice MP3 file to exist: ${v.audioUrl}`);
      const stat = fs.statSync(diskPath);
      assert.ok(stat.size > 5000, `Expected non-empty MP3 for ${v.audioUrl}`);

      for (const variant of v.variants) {
        assert.ok(variant.id, `Missing variant.id in ${type}`);
        assert.ok(variant.audioUrl, `Missing variant.audioUrl in ${variant.id}`);
        assert.ok(variant.quote?.it, `Missing variant.quote.it in ${variant.id}`);
        const varDiskPath = path.resolve(process.cwd(), variant.audioUrl);
        assert.ok(fs.existsSync(varDiskPath), `Expected variant MP3 to exist: ${variant.audioUrl}`);
        assert.ok(fs.statSync(varDiskPath).size > 5000, `Expected non-empty MP3 for ${variant.audioUrl}`);
      }
    }

    assert.equal(VOICE_LINES.n.quote.it, 'Dimmi papino!');
    assert.equal(VOICE_LINES.b.quote.it, 'Agli ordini, Signore!');
    assert.equal(VOICE_LINES.q.quote.it, "That's... interesting.");
    assert.equal(VOICE_LINES.q.speechLang, 'en-GB');
    assert.ok(VOICE_LINES.p.quote.it.includes('Puffin'));

    // Verify all requested signature lines for Kate, Seby, and Ale are registered
    const kateQuotes = VOICE_LINES.q.variants.map((v) => v.quote.en);
    assert.ok(kateQuotes.includes("That's... interesting."));
    assert.ok(kateQuotes.includes('Ok, Puffin McMuffin!'));
    assert.ok(kateQuotes.includes('You... love me! I tell myself EVERY day!'));
    assert.ok(kateQuotes.includes("Don't be FACETIOUS!"));

    const sebyQuotes = VOICE_LINES.n.variants.map((v) => v.quote.it);
    assert.ok(sebyQuotes.includes('Papinoooooo!!!'));
    assert.ok(sebyQuotes.includes('Papino, ti manco tantissimo!'));
    assert.ok(sebyQuotes.includes('My body, my choice!'));
    assert.ok(sebyQuotes.includes('Mi scappa la cacca!'));
    assert.ok(sebyQuotes.includes('Mummy, can you clean my bottooooom?'));

    const aleQuotes = VOICE_LINES.b.variants.map((v) => v.quote.it);
    assert.ok(aleQuotes.includes('Agli ordini, Signore!'));
    assert.ok(aleQuotes.includes('Papino, ti manco tantissimo!'));
    assert.ok(aleQuotes.includes('Papino, qual è il più forte?'));
    assert.ok(aleQuotes.includes('Papino, quando mi compri un regalo?'));
    assert.ok(aleQuotes.includes('Sei proprio un cafoNAZZO!'));
  });

  it('AudioListener plays creature sound on PIECE_HOVERED, avoids back-to-back voice repeats, and mixes signature lines with mumble/sbuffo reactions', () => {
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
    assert.equal(audio.playedVoices.at(-1)?.quote, "That's... interesting.");

    // Verify anti-repetition: 12 consecutive selections on Queen Kate, Seby, and Ale never play the same variantId twice in a row
    for (const pType of ['q', 'n', 'b']) {
      let prevId = null;
      const seenKinds = new Set();
      for (let i = 0; i < 12; i++) {
        const rec = audio.playCharacterVoiceLine(pType, 'e4');
        assert.notEqual(
          rec.variantId,
          prevId,
          `Expected ${pType} not to repeat variant ${rec.variantId} back-to-back`,
        );
        prevId = rec.variantId;
        seenKinds.add(rec.kind);
      }
      assert.ok(seenKinds.has('mumble'), `Expected ${pType} to include mumble/sbuffo reactions`);
      assert.ok(seenKinds.has('signature'), `Expected ${pType} to include signature sentences`);
    }

    // Verify fiery combat music MP3 and Baroque String Chess Overture MP3 exist on disk
    const combatMp3Path = path.resolve(process.cwd(), COMBAT_AUDIO_URL);
    assert.ok(fs.existsSync(combatMp3Path), `Expected ${COMBAT_AUDIO_URL} to exist on disk`);
    assert.ok(fs.statSync(combatMp3Path).size > 100_000, 'Expected non-empty Lyria 3 combat MP3');

    const stringsBgPath = path.resolve(process.cwd(), CHESS_STRINGS_BG_URL);
    assert.ok(fs.existsSync(stringsBgPath), `Expected ${CHESS_STRINGS_BG_URL} to exist on disk`);
    assert.ok(
      fs.statSync(stringsBgPath).size > 100_000,
      'Expected non-empty Lyria 3 Warm Chamber Strings Background Loop MP3',
    );

    const stringsMp3Path = path.resolve(process.cwd(), CHESS_STRINGS_THEME_URL);
    assert.ok(fs.existsSync(stringsMp3Path), `Expected ${CHESS_STRINGS_THEME_URL} to exist on disk`);
    assert.ok(
      fs.statSync(stringsMp3Path).size > 100_000,
      'Expected non-empty Lyria 3 Baroque String Chess Overture MP3',
    );

    assert.equal(audio.toggleThemeSong(), true);
    assert.equal(audio.musicPlaying, true);
    assert.equal(audio.toggleThemeSong(), false);
    assert.equal(audio.musicPlaying, false);

    bus.emit({ type: 'BATTLE_STARTED', effect: 'halberd_fish_slap', attacker: 'p', defender: 'p' });
    bus.flush();
    assert.equal(audio.combatMusicActive, true);
    assert.ok(audio.playedSfx.includes('combat_music_started'));

    // Verify combat music volume is strictly +15% above normal music (never 100%+)
    assert.equal(COMBAT_MUSIC_PEAK_VOLUME, Number((NORMAL_MUSIC_VOLUME * 1.15).toFixed(3)));
    assert.ok(COMBAT_MUSIC_PEAK_VOLUME <= 0.30, 'Combat music peak volume must stay gentle (<= 0.30)');
    // Verify every cue point leaves >= 13.5s before 29.5s so a 10s battle (+3.5s outro) never loops
    for (const cueS of COMBAT_CUE_POINTS_S) {
      assert.ok(
        cueS + 13.5 <= 29.5,
        `Cue point ${cueS}s must leave >= 13.5s before end of 30s track so it never loops during a 10s battle`,
      );
    }

    bus.emit({ type: 'BATTLE_COMPLETED', attacker: 'p', defender: 'p' });
    bus.flush();
    assert.equal(audio.combatMusicActive, false);
    assert.ok(audio.playedSfx.includes('combat_music_stopped'));
    audio.dispose();
  });

  it('HudListener defaults to English, switches to Italian on setLanguage("it"), and keeps voice quotes intact', () => {
    const bus = new GameEventBus();
    const hud = new HudListener({ bus });

    assert.equal(hud.lang, 'en');
    assert.equal(hud.t('title'), 'CarChess3D · Family Wizard Chess');

    bus.emit({ type: 'PIECE_HOVERED', square: 'c1', piece: { type: 'b', color: 'w' } });
    bus.flush();
    assert.equal(hud.lastHoverSound, VOICE_LINES.b.hoverSound.label.en);
    assert.ok(hud.lastToast.includes('Ale'));

    hud.setLanguage('it');
    assert.equal(hud.lang, 'it');
    assert.equal(hud.t('title'), 'CarChess3D · Carlesso al Cesso');

    bus.emit({ type: 'PIECE_HOVERED', square: 'c1', piece: { type: 'b', color: 'w' } });
    bus.flush();
    assert.equal(hud.lastHoverSound, VOICE_LINES.b.hoverSound.label.it);

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

  it('SkeletonRigHelper includes tail bone, animates continuous living idle poses, and stays hidden in production during walk/combat unless skeletonsVisible is true', () => {
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
      assert.equal(rig.visible, false, `Expected rig.visible === false in production idle for ${type}`);

      // Even during walking and combat, rig.visible must stay false in production unless skeletonsVisible is true
      updateSkeletonRigPose(rig, type, {
        walkPhase: 1.2,
        walkAmp: 1.5,
        combatPhase: 2.0,
        combatAmp: 1.8,
        skeletonsVisible: false,
      });
      assert.equal(rig.visible, false, `Expected rig.visible === false in production combat for ${type}`);

      // When debug/experiment toggle enables skeletonsVisible, rig.visible becomes true
      updateSkeletonRigPose(rig, type, {
        walkPhase: 1.2,
        walkAmp: 1.5,
        combatPhase: 2.0,
        combatAmp: 1.8,
        skeletonsVisible: true,
      });
      assert.equal(rig.visible, true, `Expected rig.visible === true when skeletonsVisible is true for ${type}`);
    }
  });
});
