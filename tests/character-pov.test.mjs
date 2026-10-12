import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  CARLESSO_HERO_KEYS,
  HERO_PROFILES,
  HERO_SOUNDBOARDS,
  getHeroAttacks,
  getHeroDefenses,
} from '../src/core/CharacterPovData.js';

test('CharacterPovData: all 6 Carlesso family heroes are registered', () => {
  assert.deepEqual(CARLESSO_HERO_KEYS, ['n', 'b', 'k', 'q', 'r', 'p']);
  for (const key of CARLESSO_HERO_KEYS) {
    const hero = HERO_PROFILES[key];
    assert.ok(hero, `Missing hero profile for ${key}`);
    assert.equal(hero.key, key);
    assert.ok(hero.heroName);
    assert.ok(hero.fullName);
    assert.ok(hero.role);
    assert.ok(hero.glyph);
    assert.ok(hero.avatar);
    assert.ok(Array.isArray(hero.models) && hero.models.length >= 1);
    assert.ok(hero.bio);
    assert.ok(hero.weapon);
    assert.ok(hero.counter);

    // Verify avatar image exists on disk
    const avatarPath = path.resolve(process.cwd(), hero.avatar);
    assert.ok(fs.existsSync(avatarPath), `Missing avatar file: ${hero.avatar}`);

    // Verify primary GLB exists on disk
    for (const m of hero.models) {
      const glbPath = path.resolve(process.cwd(), m.url.split('?')[0]);
      assert.ok(fs.existsSync(glbPath), `Missing GLB file: ${m.url}`);
    }
  }
});

test('CharacterPovData: soundboards contain valid voice clips & catchphrases', () => {
  for (const key of CARLESSO_HERO_KEYS) {
    const sounds = HERO_SOUNDBOARDS[key];
    assert.ok(Array.isArray(sounds) && sounds.length >= 2, `Expected sounds for ${key}`);
    for (const s of sounds) {
      assert.ok(s.id);
      assert.ok(s.label);
      assert.ok(s.quote);
      if (s.audio) {
        const audioPath = path.resolve(process.cwd(), s.audio);
        assert.ok(fs.existsSync(audioPath), `Audio file not found: ${s.audio}`);
      } else {
        assert.ok(s.speakText, `Sound without audio must have speakText: ${s.id}`);
      }
    }
  }

  // Verify Kate's "I'll bear that in mind"
  const kateSounds = HERO_SOUNDBOARDS.q;
  const kateCatchphrase = kateSounds.find((s) => s.id === 'voice-q-bearinmind');
  assert.ok(kateCatchphrase, 'Missing voice-q-bearinmind for Queen Kate');
  assert.equal(kateCatchphrase.speakText, "I'll bear that in mind");

  // Verify Pupurabbu's "Catchphrase!"
  const pupuSounds = HERO_SOUNDBOARDS.r;
  const pupuCatchphrase = pupuSounds.find((s) => s.id === 'voice-r-catchphrase');
  assert.ok(pupuCatchphrase, 'Missing voice-r-catchphrase for Rook Pupurabbu');
  assert.equal(pupuCatchphrase.speakText, 'Catchphrase!');
});

test('CharacterPovData: POV battles mapping gives 6 attacks + 6 defenses = 11 unique pairs', () => {
  for (const key of CARLESSO_HERO_KEYS) {
    const attacks = getHeroAttacks(key);
    const defenses = getHeroDefenses(key);

    assert.equal(attacks.length, 6, `Expected 6 attacks for ${key}`);
    assert.equal(defenses.length, 6, `Expected 6 defenses for ${key}`);

    const uniquePairs = new Set([...attacks.map((a) => a.pairId), ...defenses.map((d) => d.pairId)]);
    assert.equal(uniquePairs.size, 11, `Expected exactly 11 unique battle pairs for ${key}`);

    // Verify all videos and posters exist on disk
    for (const battle of [...attacks, ...defenses]) {
      const videoPath = path.resolve(process.cwd(), battle.videoMp4);
      assert.ok(fs.existsSync(videoPath), `Missing battle video: ${battle.videoMp4}`);
      const posterPath = path.resolve(process.cwd(), battle.poster);
      assert.ok(fs.existsSync(posterPath), `Missing battle poster: ${battle.poster}`);
      assert.ok(battle.targetPieceName, `Missing targetPieceName in ${battle.pairId}`);
      assert.ok(battle.targetPieceGlyph, `Missing targetPieceGlyph in ${battle.pairId}`);
      assert.ok(battle.targetMedallion, `Missing targetMedallion in ${battle.pairId}`);
      const medallionPath = path.resolve(process.cwd(), battle.targetMedallion);
      assert.ok(fs.existsSync(medallionPath), `Target medallion file missing: ${battle.targetMedallion}`);
    }
  }
});

test('CharacterPovData: 6+6 Risiko shelves and target piece badges are in showcase/index.html', () => {
  const showcasePath = path.resolve(process.cwd(), 'showcase/index.html');
  const html = fs.readFileSync(showcasePath, 'utf8');

  // Verify both Attack (Red Risiko) and Defense (Blue Risiko) grids exist simultaneously
  assert.ok(html.includes('id="attacks-cards-grid"'), 'Missing #attacks-cards-grid');
  assert.ok(html.includes('id="defenses-cards-grid"'), 'Missing #defenses-cards-grid');

  // Verify main screen target badge
  assert.ok(html.includes('id="netflix-screen-target-badge"'), 'Missing #netflix-screen-target-badge');

  // Verify film target overlay CSS class
  assert.ok(html.includes('film-target-overlay'), 'Missing .film-target-overlay');
  assert.ok(html.includes('target-medallion-circle'), 'Missing .target-medallion-circle');
});
