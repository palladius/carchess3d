/**
 * @fileoverview Declarative Data-Driven Registries (Niccolò Game Design Rule #6).
 *
 * Contains:
 * 1. `CHARACTER_REGISTRY`: Canonical metadata, heights, portraits, GLB paths, and
 *    animation clip aliases for the 6 Carlesso Family pieces + Classic Stone Rival set.
 * 2. `BATTLE_MATRIX[attacker][defender]`: Declarative 6x6 capture choreography &
 *    Easter Egg overrides (Seby <-> Pupurabbu Mega Cuddle Bounce, Riccardo <-> Kate
 *    Golden Toilet-Throne clash) — zero `if/else` ladders!
 * 3. Spatial coordinate helpers aligned with `docs/floorplan.svg` (`squareToWorld`, `worldToSquare`).
 * 4. Bilingual `I18N` dictionary (`it` 🇮🇹 & `en` 🇬🇧).
 */

import { CANONICAL_PIECE_HEIGHTS } from '../utils/glbGrounding.js';

export const FILES = Object.freeze(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);

/**
 * Converts an algebraic square ('a1'..'h8') to 3D world coordinates on the 8x8m altar (`y = 0`).
 * Square size = 1.0m. Center of board = (0, 0, 0).
 * File 'a'..'h' -> x = -3.5 .. +3.5
 * Rank '8'..'1' -> z = -3.5 .. +3.5 (Rank 1 White at South +Z, Rank 8 Black at North -Z)
 * @param {string} square
 * @returns {{ x: number, y: number, z: number, col: number, row: number }}
 */
export function squareToWorld(square) {
  const s = String(square || 'e4').toLowerCase();
  const col = Math.max(0, Math.min(7, FILES.indexOf(s[0])));
  const rank = parseInt(s[1], 10) || 1;
  const row = Math.max(0, Math.min(7, 8 - rank));
  return {
    x: col - 3.5,
    y: 0,
    z: row - 3.5,
    col,
    row,
  };
}

/**
 * Converts 3D world `(x, z)` coordinates back to an algebraic square ('a1'..'h8') or null if out of bounds.
 * @param {number} x
 * @param {number} z
 * @returns {string|null}
 */
export function worldToSquare(x, z) {
  const col = Math.round(x + 3.5);
  const row = Math.round(z + 3.5);
  if (col < 0 || col > 7 || row < 0 || row > 7) return null;
  const rank = 8 - row;
  return `${FILES[col]}${rank}`;
}

export const CHARACTER_REGISTRY = Object.freeze({
  k: {
    type: 'k',
    role: 'king',
    glyph: '♔',
    name: 'Riccardo',
    title: { it: 'Re Riccardo (Carlesso al Cesso)', en: 'King Riccardo (Royal Throne)' },
    height: CANONICAL_PIECE_HEIGHTS.k,
    weight: 10,
    frontPortrait: 'assets/characters/king-riccardo-1.jpg',
    altPortrait: 'assets/characters/king-riccardo-2.jpg',
    backPortrait: 'tools/model-pipeline/king/back.png',
    glbUrl: 'assets/models/king-riccardo.glb',
    optionalGlbCandidates: ['assets/models/king-riccardo.glb'],
    accentColor: 0xffca28,
    signatureId: 'sceptre_lightning',
    animations: { idle: 'Idle', fire: 'Royal_Strike', attack: 'Sceptre_Thunder', victory: 'Throne_Spin' },
  },
  q: {
    type: 'q',
    role: 'queen',
    glyph: '♕',
    name: 'Kate',
    title: { it: 'Regina Kate (Ciocco-Onda Lilla)', en: 'Queen Kate (Lilac Choco-Wave)' },
    height: CANONICAL_PIECE_HEIGHTS.q,
    weight: 9,
    frontPortrait: 'assets/characters/queen-kate-4.jpg',
    altPortrait: 'assets/characters/queen-kate-1.jpg',
    backPortrait: 'assets/characters/queen-kate-2.jpg',
    glbUrl: 'assets/models/queen-kate.glb',
    altGlbUrl: 'assets/models/queen-kate-wedding2016.glb',
    optionalGlbCandidates: [
      'assets/models/queen-kate.glb',
      'assets/models/queen-kate-young.glb',
      'assets/models/queen-kate-wedding2016.glb',
    ],
    accentColor: 0xab47bc,
    signatureId: 'chocolate_wave',
    animations: { idle: 'Idle', fire: 'Choco_Swirl', attack: 'Chocolate_Tsunami', victory: 'Queen_Bow' },
  },
  b: {
    type: 'b',
    role: 'bishop',
    glyph: '♗',
    name: 'Ale',
    title: { it: 'Alfiere Ale & Draghetto Rosso 🐉', en: 'Bishop Ale & Red Dragon 🐉' },
    height: CANONICAL_PIECE_HEIGHTS.b,
    weight: 3,
    frontPortrait: 'assets/characters/bishop-ale-1.jpg',
    altPortrait: 'assets/characters/bishop-ale-2.jpg',
    backPortrait: 'tools/model-pipeline/ale/experiments_back/back_nb_2.1.png',
    glbUrl: 'assets/models/bishop-ale-1.glb',
    altGlbUrl: 'assets/models/bishop-ale-rigged.glb',
    optionalGlbCandidates: [
      'assets/models/bishop-ale-1.glb',
      'assets/models/bishop-ale-rigged.glb',
      'assets/models/bishop-ale-2.glb',
    ],
    accentColor: 0x2d6cdf,
    signatureId: 'crystal_shatter',
    animations: {
      idle: 'Idle_Track',
      fire: 'FireBreath_Track',
      attack: 'FireBreath_Track',
      victory: 'Idle_Track',
    },
  },
  n: {
    type: 'n',
    role: 'knight',
    glyph: '♘',
    name: 'Seby',
    title: { it: 'Cavaliere Seby (Pista Turbo!) 🏎️', en: 'Knight Seby (Loop-Track Turbo!) 🏎️' },
    height: CANONICAL_PIECE_HEIGHTS.n,
    weight: 3,
    frontPortrait: 'assets/characters/knight-seby-4.jpg',
    altPortrait: 'assets/characters/knight-seby-1.jpg',
    backPortrait: 'tools/model-pipeline/seby/back_nb_2.1.png',
    glbUrl: 'assets/models/knight-seby.glb',
    optionalGlbCandidates: ['assets/models/knight-seby.glb'],
    accentColor: 0xff7043,
    signatureId: 'loop_track_cars',
    animations: { idle: 'Idle', fire: 'Turbo_Rev', attack: 'Loop_Track_Storm', victory: 'Wheelie_Spin' },
  },
  r: {
    type: 'r',
    role: 'rook',
    glyph: '♖',
    name: 'Pupurabbu',
    title: { it: 'Torre Pupurabbu (Super Puffoso) 💜', en: 'Rook Pupurabbu (Mega Plushie) 💜' },
    height: CANONICAL_PIECE_HEIGHTS.r,
    weight: 5,
    frontPortrait: 'assets/characters/rook-pupurabbu.jpg',
    altPortrait: 'assets/characters/rook-pupurabbu.jpg',
    backPortrait: 'tools/model-pipeline/rook/back.png',
    glbUrl: 'assets/models/rook-pupurabbu.glb',
    optionalGlbCandidates: ['assets/models/rook-pupurabbu.glb'],
    accentColor: 0x7e57c2,
    signatureId: 'plush_ground_pound',
    animations: { idle: 'Idle', fire: 'Plush_Bounce', attack: 'Ground_Pound_Poof', victory: 'Belly_Wiggle' },
  },
  p: {
    type: 'p',
    role: 'pawn',
    glyph: '♙',
    name: 'Puffin',
    title: { it: 'Pedone Puffin Guardia Svizzera 🐟', en: 'Swiss Guard Puffin Pawn 🐟' },
    height: CANONICAL_PIECE_HEIGHTS.p,
    weight: 1,
    frontPortrait: 'assets/characters/pawn-puffin.jpg',
    altPortrait: 'assets/characters/pawn-puffin.jpg',
    backPortrait: 'tools/model-pipeline/nbviews/gemini-nano-banana-2.1/back.png',
    glbUrl: 'assets/models/pawn-puffin.glb',
    optionalGlbCandidates: ['assets/models/pawn-puffin.glb'],
    accentColor: 0x26a69a,
    signatureId: 'halberd_fish_slap',
    animations: { idle: 'Idle', fire: 'Halberd_Salute', attack: 'Fish_Slap_Spin', victory: 'Puffin_Hop' },
  },
});

const BASE_SIGNATURES = Object.freeze({
  k: {
    effect: 'sceptre_lightning',
    debrisType: 'golden_sparks',
    banner: { it: 'FULMINE REALE! ⚡👑', en: 'ROYAL LIGHTNING! ⚡👑' },
    victimReaction: 'levitate_dissolve',
  },
  q: {
    effect: 'chocolate_wave',
    debrisType: 'choco_lilac_confetti',
    banner: { it: 'CIOCCO-ONDA LILLA! 🍫✨', en: 'LILAC CHOCO-WAVE! 🍫✨' },
    victimReaction: 'sweet_melt',
  },
  b: {
    effect: 'crystal_shatter',
    debrisType: 'amethyst_ruby_shards',
    banner: { it: 'CRISTALLO DRAGO BAM! 💎🐉', en: 'DRAGON CRYSTAL SHATTER! 💎🐉' },
    victimReaction: 'crystallize_shatter',
  },
  n: {
    effect: 'loop_track_cars',
    debrisType: 'diecast_toy_cars',
    banner: { it: 'STECCHITO! PISTA TURBO! 🏎️✨', en: 'FLATTENED! TURBO TRACK! 🏎️✨' },
    victimReaction: 'bowled_flat_stars',
  },
  r: {
    effect: 'plush_ground_pound',
    debrisType: 'purple_poof_clouds',
    banner: { it: 'SCHIACCIATA PUFFOSA! 💥💜', en: 'PLUSHIE PANCAKE SLAM! 💥💜' },
    victimReaction: 'pancake_squash',
  },
  p: {
    effect: 'halberd_fish_slap',
    debrisType: 'fish_and_feathers',
    banner: { it: 'PUFFIN SLAP! PLING! 🐟⚔️', en: 'PUFFIN FISH-SLAP! 🐟⚔️' },
    victimReaction: 'spin_off_board',
  },
});

export const WOW_VIDEO_PLAYLIST = Object.freeze([
  {
    id: 'b_x_n',
    attacker: 'b',
    defender: 'n',
    url: 'assets/battles/videos/b_x_n.mp4',
    webmUrl: 'assets/battles/videos/b_x_n.webm',
    caption: { it: '🐉 Ale × Seby 🐴', en: '🐉 Ale × Seby 🐴' },
  },
  {
    id: 'n_x_b',
    attacker: 'n',
    defender: 'b',
    url: 'assets/battles/videos/n_x_b.mp4',
    webmUrl: 'assets/battles/videos/n_x_b.webm',
    caption: { it: '🏎️ Seby × Ale 💎', en: '🏎️ Seby × Ale 💎' },
  },
  {
    id: 'n_x_r',
    attacker: 'n',
    defender: 'r',
    url: 'assets/battles/videos/n_x_r.mp4',
    webmUrl: 'assets/battles/videos/n_x_r.webm',
    caption: { it: '💜 Seby & Pupurabbu 🤗', en: '💜 Seby & Pupurabbu 🤗' },
  },
]);

function resolveBattleVideoUrl(atk, def) {
  if (atk === 'b' && def === 'n') return 'assets/battles/videos/b_x_n.mp4';
  if (atk === 'n' && def === 'b') return 'assets/battles/videos/n_x_b.mp4';
  if ((atk === 'n' && def === 'r') || (atk === 'r' && def === 'n')) {
    return 'assets/battles/videos/n_x_r.mp4';
  }
  if (atk === 'b' || def === 'n') return 'assets/battles/videos/b_x_n.mp4';
  if (atk === 'n' || def === 'b') return 'assets/battles/videos/n_x_b.mp4';
  if (atk === 'r' || def === 'r') return 'assets/battles/videos/n_x_r.mp4';
  return 'assets/battles/videos/b_x_n.mp4';
}

/**
 * Build the complete 6x6 declarative `BATTLE_MATRIX[attacker][defender]` with
 * family Easter Eggs baked directly into the table (zero runtime if/else ladders!).
 */
function buildBattleMatrix() {
  const keys = Object.keys(CHARACTER_REGISTRY);
  const matrix = {};
  for (const atk of keys) {
    matrix[atk] = {};
    const atkChar = CHARACTER_REGISTRY[atk];
    const baseSig = BASE_SIGNATURES[atk];
    for (const def of keys) {
      const defChar = CHARACTER_REGISTRY[def];
      const pairId = `${atkChar.role}_vs_${defChar.role}`;
      matrix[atk][def] = {
        id: pairId,
        attacker: atk,
        defender: def,
        attackerName: atkChar.name,
        defenderName: defChar.name,
        effect: baseSig.effect,
        debrisType: baseSig.debrisType,
        victimReaction: baseSig.victimReaction,
        banner: baseSig.banner,
        easterEgg: null,
        nonLethalCuddle: false,
        videoUrl: resolveBattleVideoUrl(atk, def),
        compositeUrl: `assets/battles/keyframes/${pairId}.svg`,
        attackerImg: atkChar.frontPortrait,
        defenderImg: defChar.frontPortrait,
      };
    }
  }

  // Easter Egg #1: Seby (n) <-> Pupurabbu (r) NEVER hurt each other! Mega Cuddle Bounce 💜
  for (const [a, d] of [['n', 'r'], ['r', 'n']]) {
    matrix[a][d] = {
      ...matrix[a][d],
      effect: 'mega_cuddle_bounce',
      debrisType: 'floating_purple_hearts',
      victimReaction: 'happy_cuddle_hop',
      easterEgg: 'seby_pupurabbu_cuddle',
      nonLethalCuddle: true,
      banner: {
        it: 'SUPER ABBRACCIO PUFFOSO! 💜🤗',
        en: 'MEGA FLUFFY CUDDLE HUG! 💜🤗',
      },
    };
  }

  // Easter Egg #2: Riccardo (k) <-> Kate (q) Golden Toilet-Throne ("Carlesso al Cesso") clash
  for (const [a, d] of [['k', 'q'], ['q', 'k']]) {
    matrix[a][d] = {
      ...matrix[a][d],
      effect: 'golden_toilet_throne',
      debrisType: 'golden_sparks',
      victimReaction: 'royal_throne_whirl',
      easterEgg: 'carlesso_al_cesso_throne',
      banner: {
        it: 'CARLESSO AL CESSO! TRONO D’ORO! 🚽👑',
        en: 'ROYAL GOLDEN THRONE STRIKE! 🚽👑',
      },
    };
  }

  // Easter Egg #3: Seby (n) <-> Ale (b) Brother Rivalry
  matrix.n.b = {
    ...matrix.n.b,
    easterEgg: 'brothers_turbo_vs_dragon',
    banner: {
      it: 'SEBY vs ALE: MACCHININE CONTRO DRAGO! 🏎️🐉',
      en: 'SEBY vs ALE: TURBO CARS VS DRAGON! 🏎️🐉',
    },
  };
  matrix.b.n = {
    ...matrix.b.n,
    easterEgg: 'brothers_dragon_vs_turbo',
    banner: {
      it: 'ALE vs SEBY: CRISTALLO SUL CAVALLINO! 💎🐴',
      en: 'ALE vs SEBY: CRYSTAL HORSE FREEZE! 💎🐴',
    },
  };

  return Object.freeze(matrix);
}

export const BATTLE_MATRIX = buildBattleMatrix();

export const FAMILY_STICKERS = Object.freeze([
  { id: 'sticker_riccardo_throne', name: { it: 'Trono d’Oro 🚽👑', en: 'Golden Throne 🚽👑' } },
  { id: 'sticker_kate_choco', name: { it: 'Onda Ciocco-Lilla 🍫💜', en: 'Choco-Lilac Wave 🍫💜' } },
  { id: 'sticker_ale_dragon', name: { it: 'Draghetto di Ale 🐉💎', en: 'Ale Dragon 🐉💎' } },
  { id: 'sticker_seby_turbo', name: { it: 'Pista Loop di Seby 🏎️🔥', en: 'Seby Loop-Track 🏎️🔥' } },
  { id: 'sticker_pupurabbu_hug', name: { it: 'Abbraccio Pupurabbu 🤗💜', en: 'Pupurabbu Hug 🤗💜' } },
  { id: 'sticker_puffin_halberd', name: { it: 'Puffin Alabarda 🐟⚔️', en: 'Puffin Halberd 🐟⚔️' } },
]);

export const PROFILES = Object.freeze([
  { id: 'ale', name: 'Ale 🐉', avatar: 'assets/characters/bishop-ale-1.jpg', favPiece: 'b' },
  { id: 'seby', name: 'Seby 🏎️', avatar: 'assets/characters/knight-seby-4.jpg', favPiece: 'n' },
  { id: 'riccardo', name: 'Riccardo 👑', avatar: 'assets/characters/king-riccardo-1.jpg', favPiece: 'k' },
  { id: 'kate', name: 'Kate 💜', avatar: 'assets/characters/queen-kate-4.jpg', favPiece: 'q' },
  { id: 'ospite', name: 'Ospite 🌟', avatar: 'assets/characters/pawn-puffin.jpg', favPiece: 'p' },
]);

export const I18N = Object.freeze({
  it: {
    title: 'CarChess3D',
    subtitle: 'Zurigo 3D',
    mode1Btn: '♟️ Gioca',
    mode2Btn: '🌟 WOW',
    whoPlays: 'Profilo',
    opponent: 'VS',
    hotseat: '👥 2P',
    cpuEasy: '🤖 Facile',
    cpuMed: '🤖 Media',
    cpuHard: '🤖 Maestro',
    rivalSet: 'Set',
    setFamily: '👨‍👩‍👦‍👦 Famiglia',
    setStone: '🗿 Pietra',
    turnWhite: 'Turno Bianco',
    turnBlack: 'Turno Nero',
    luckBar: '🍀',
    hintBtn: '💡',
    flipCamBtn: '🔄',
    topCamBtn: '📐',
    newGameBtn: '✨ Nuova',
    fenBtn: '📋 FEN',
    musicBtn: '🎵',
    sfxBtn: '🔊',
    skipBtn: '⏭️ Salta',
    checkAlert: '⚠️ SCACCO!',
    checkmateTitle: '🏆 SCACCO MATTO!',
    drawTitle: '🤝 PATTA!',
    promoTitle: '✨ Promozione Puffin:',
    wowInspectorTab: '🔍 360°',
    wowArenaTab: '🎬 Arena',
    triggerBattleBtn: '⚔️ Azione!',
  },
  en: {
    title: 'CarChess3D',
    subtitle: 'Zurich 3D',
    mode1Btn: '♟️ Play',
    mode2Btn: '🌟 WOW',
    whoPlays: 'Player',
    opponent: 'VS',
    hotseat: '👥 2P',
    cpuEasy: '🤖 Easy',
    cpuMed: '🤖 Med',
    cpuHard: '🤖 Hard',
    rivalSet: 'Set',
    setFamily: '👨‍👩‍👦‍👦 Family',
    setStone: '🗿 Stone',
    turnWhite: 'White Turn',
    turnBlack: 'Black Turn',
    luckBar: '🍀',
    hintBtn: '💡',
    flipCamBtn: '🔄',
    topCamBtn: '📐',
    newGameBtn: '✨ New',
    fenBtn: '📋 FEN',
    musicBtn: '🎵',
    sfxBtn: '🔊',
    skipBtn: '⏭️ Skip',
    checkAlert: '⚠️ CHECK!',
    checkmateTitle: '🏆 CHECKMATE!',
    drawTitle: '🤝 DRAW!',
    promoTitle: '✨ Puffin Promotion:',
    wowInspectorTab: '🔍 360°',
    wowArenaTab: '🎬 Arena',
    triggerBattleBtn: '⚔️ Clash!',
  },
});
