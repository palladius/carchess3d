import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BATTLE_MATRIX_36,
  PIECE_KEYS_36,
  getBattle36,
  listAllBattles36,
} from '../src/core/BattleMatrix36.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

const VALID_WEAPONS = new Set([
  'sceptre',
  'toilet_throne',
  'choco_wand',
  'dragon_crystal',
  'turbo_cars',
  'plush_belly',
  'halberd_fish',
]);

const VALID_COUNTER_SFX = new Set([
  'PARATA!',
  'FIAMMA!',
  'IMPENNATA!',
  'BOING!',
  'SCUDO!',
  'ZAP!',
]);

describe('Issue #11 — BATTLE_MATRIX_36 & 36x2 (MP4 + WebM) 16:9 Videos', () => {
  it('defines all 36 (6x6) combinations with unique titles and unique banners', () => {
    assert.deepEqual(PIECE_KEYS_36, ['k', 'q', 'b', 'n', 'r', 'p']);
    const allEntries = listAllBattles36();
    assert.equal(allEntries.length, 36);

    const seenIds = new Set();
    const seenSlugs = new Set();
    const seenTitleIt = new Set();
    const seenTitleEn = new Set();
    const seenBannerIt = new Set();
    const seenBannerEn = new Set();

    for (const atk of PIECE_KEYS_36) {
      assert.ok(BATTLE_MATRIX_36[atk], `Missing attacker row ${atk}`);
      for (const def of PIECE_KEYS_36) {
        const entry = BATTLE_MATRIX_36[atk][def];
        assert.ok(entry, `Missing matrix cell ${atk}_x_${def}`);
        assert.equal(entry.id, `${atk}_x_${def}`);
        assert.equal(entry.attacker, atk);
        assert.equal(entry.defender, def);

        seenIds.add(entry.id);
        seenSlugs.add(entry.pairSlug);
        seenTitleIt.add(entry.title?.it);
        seenTitleEn.add(entry.title?.en);
        seenBannerIt.add(entry.banner?.it);
        seenBannerEn.add(entry.banner?.en);

        assert.ok(
          VALID_WEAPONS.has(entry.attackerWeapon),
          `Invalid attackerWeapon for ${entry.id}: ${entry.attackerWeapon}`,
        );
        assert.ok(entry.clashStyle && entry.clashStyle.length > 3, `Missing clashStyle for ${entry.id}`);
        assert.ok(
          entry.finisherReaction && entry.finisherReaction.length > 3,
          `Missing finisherReaction for ${entry.id}`,
        );

        // Validate Act 2 defenderCounter
        assert.ok(entry.defenderCounter, `Missing defenderCounter for ${entry.id}`);
        assert.ok(entry.defenderCounter.move?.length > 3, `Missing defenderCounter.move for ${entry.id}`);
        assert.ok(entry.defenderCounter.it?.length > 10, `Missing defenderCounter.it for ${entry.id}`);
        assert.ok(entry.defenderCounter.en?.length > 10, `Missing defenderCounter.en for ${entry.id}`);
        assert.ok(
          VALID_COUNTER_SFX.has(entry.defenderCounter.sfxText),
          `Unexpected defenderCounter.sfxText for ${entry.id}: ${entry.defenderCounter.sfxText}`,
        );

        assert.equal(entry.videoUrl, `assets/battles/videos/${atk}_x_${def}.mp4`);
        assert.equal(entry.webmUrl, `assets/battles/videos/${atk}_x_${def}.webm`);
      }
    }

    assert.equal(seenIds.size, 36, 'Expected 36 unique pair IDs');
    assert.equal(seenSlugs.size, 36, 'Expected 36 unique pairSlugs');
    assert.equal(seenTitleIt.size, 36, 'Expected 36 unique Italian titles');
    assert.equal(seenTitleEn.size, 36, 'Expected 36 unique English titles');
    assert.equal(seenBannerIt.size, 36, 'Expected 36 unique Italian banners');
    assert.equal(seenBannerEn.size, 36, 'Expected 36 unique English banners');
  });

  it('preserves Carlesso family Easter Eggs (Seby<->Pupurabbu, Riccardo<->Kate, Ale<->Seby)', () => {
    const nxr = getBattle36('n', 'r');
    const rxn = getBattle36('r', 'n');
    assert.equal(nxr.nonLethalCuddle, true);
    assert.equal(rxn.nonLethalCuddle, true);
    assert.match(nxr.banner.it, /SUPER ABBRACCIO PUFFOSO/);
    assert.match(rxn.banner.it, /SUPER ABBRACCIO PUFFOSO/);

    const kxq = getBattle36('k', 'q');
    const qxk = getBattle36('q', 'k');
    assert.match(kxq.banner.it, /CARLESSO AL CESSO.*TRONO D'ORO/);
    assert.match(qxk.banner.it, /CARLESSO AL CESSO.*TRONO D'ORO/);

    const bxn = getBattle36('bishop', 'knight');
    const nxb = getBattle36('knight', 'bishop');
    assert.equal(bxn.id, 'b_x_n');
    assert.equal(nxb.id, 'n_x_b');
    assert.match(bxn.banner.it, /ALE vs SEBY/);
    assert.match(nxb.banner.it, /SEBY vs ALE/);
  });

  it('has all 36 .mp4 and all 36 .webm 16:9 battle video files on disk (> 10KB each)', () => {
    for (const atk of PIECE_KEYS_36) {
      for (const def of PIECE_KEYS_36) {
        const entry = BATTLE_MATRIX_36[atk][def];
        const mp4Abs = path.join(ROOT_DIR, entry.videoUrl);
        const webmAbs = path.join(ROOT_DIR, entry.webmUrl);

        assert.ok(fs.existsSync(mp4Abs), `Missing MP4 file: ${entry.videoUrl}`);
        assert.ok(fs.existsSync(webmAbs), `Missing WebM file: ${entry.webmUrl}`);

        const mp4Size = fs.statSync(mp4Abs).size;
        const webmSize = fs.statSync(webmAbs).size;
        assert.ok(
          mp4Size > 10 * 1024,
          `MP4 file too small (${mp4Size} bytes <= 10KB): ${entry.videoUrl}`,
        );
        assert.ok(
          webmSize > 10 * 1024,
          `WebM file too small (${webmSize} bytes <= 10KB): ${entry.webmUrl}`,
        );
      }
    }
  });
});
