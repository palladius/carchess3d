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

export const VOICE_LINES = Object.freeze({
  k: {
    type: 'k',
    name: 'Riccardo',
    quote: {
      it: 'Avanti tutta! Re Carlesso al comando!',
      en: 'Avanti tutta! Re Carlesso al comando!',
    },
    hoverSound: {
      id: 'king_sceptre_hum',
      label: { it: '♔ Zzt-hum! *scettro reale*', en: '♔ Zzt-hum! *royal sceptre*' },
    },
    audioUrl: 'assets/audio/voices/voice-k.mp3',
    speechLang: 'it-IT',
    pitch: 0.95,
    rate: 1.0,
  },
  q: {
    type: 'q',
    name: 'Kate',
    quote: {
      it: 'This is an interesting choice...',
      en: 'This is an interesting choice...',
    },
    hoverSound: {
      id: 'queen_chime',
      label: { it: '♕ Hmm... *sarcastic British sigh*', en: '♕ Hmm... *sarcastic British sigh*' },
    },
    audioUrl: 'assets/audio/voices/voice-q.mp3',
    speechLang: 'en-GB',
    pitch: 1.04,
    rate: 0.92,
  },
  b: {
    type: 'b',
    name: 'Ale',
    quote: {
      it: 'Agli ordini, Signore!',
      en: 'Agli ordini, Signore!',
    },
    hoverSound: {
      id: 'dragon_whistle',
      label: { it: '🐉 Fiuuu! *sbuffo del draghetto*', en: '🐉 Fiuuu! *dragon wing flutter*' },
    },
    audioUrl: 'assets/audio/voices/voice-b.mp3',
    speechLang: 'it-IT',
    pitch: 1.18,
    rate: 1.06,
  },
  n: {
    type: 'n',
    name: 'Seby',
    quote: {
      it: 'Dimmi papino!',
      en: 'Dimmi papino!',
    },
    hoverSound: {
      id: 'horse_snort',
      label: { it: '🐴 Snort! Prrr! *cavallo scalpita*', en: '🐴 Snort! Prrr! *horse paws in place*' },
    },
    audioUrl: 'assets/audio/voices/voice-n.mp3',
    speechLang: 'it-IT',
    pitch: 1.28,
    rate: 1.08,
  },
  r: {
    type: 'r',
    name: 'Pupurabbu',
    quote: {
      it: 'Boing boing! Super abbraccio Pupurabbu!',
      en: 'Boing boing! Super abbraccio Pupurabbu!',
    },
    hoverSound: {
      id: 'plush_boing',
      label: { it: '💜 Boing-purr! *pancia morbida*', en: '💜 Boing-purr! *squishy plush bounce*' },
    },
    audioUrl: 'assets/audio/voices/voice-r.mp3',
    speechLang: 'it-IT',
    pitch: 1.22,
    rate: 1.05,
  },
  p: {
    type: 'p',
    name: 'Puffin',
    quote: {
      it: 'Piu piu! Eccomi, pronta guardia Puffin!',
      en: 'Piu piu! Eccomi, pronta guardia Puffin!',
    },
    hoverSound: {
      id: 'puffin_peep',
      label: { it: '🐧 Piu-piu! *codina scodinzola*', en: '🐧 Piu-piu! *cute tail wag*' },
    },
    audioUrl: 'assets/audio/voices/voice-p.mp3',
    speechLang: 'it-IT',
    pitch: 1.45,
    rate: 1.12,
  },
});

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
    voiceLine: VOICE_LINES.k,
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
    voiceLine: VOICE_LINES.q,
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
    voiceLine: VOICE_LINES.b,
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
    voiceLine: VOICE_LINES.n,
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
    voiceLine: VOICE_LINES.r,
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
    voiceLine: VOICE_LINES.p,
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
        videoUrl: `assets/battles/videos/${atk}_x_${def}.mp4`,
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
      videoUrl: 'assets/battles/videos/n_x_r.mp4',
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
  { id: 'sticker_riccardo_throne', name: { it: 'Trono d’Oro di Re Riccardo 🚽👑', en: 'King Riccardo Golden Throne 🚽👑' } },
  { id: 'sticker_kate_choco', name: { it: 'Onda Ciocco-Lilla di Regina Kate 🍫💜', en: 'Queen Kate Choco-Lilac Wave 🍫💜' } },
  { id: 'sticker_ale_dragon', name: { it: 'Draghetto Fiammeggiante di Ale 🐉💎', en: 'Ale Fiery Shoulder Dragon 🐉💎' } },
  { id: 'sticker_seby_turbo', name: { it: 'Super Pista Loop di Seby 🏎️🔥', en: 'Seby Orange Loop-Track Turbo 🏎️🔥' } },
  { id: 'sticker_pupurabbu_hug', name: { it: 'Super Abbraccio di Pupurabbu 🤗💜', en: 'Pupurabbu Mega Plushie Hug 🤗💜' } },
  { id: 'sticker_puffin_halberd', name: { it: 'Puffin Guardia Svizzera Colpo-Pesce 🐟⚔️', en: 'Swiss-Guard Puffin Fish-Slap 🐟⚔️' } },
]);

export const PROFILES = Object.freeze([
  { id: 'ale', name: 'Ale 🐉', avatar: 'assets/characters/bishop-ale-1.jpg', favPiece: 'b' },
  { id: 'seby', name: 'Seby 🏎️', avatar: 'assets/characters/knight-seby-4.jpg', favPiece: 'n' },
  { id: 'riccardo', name: 'Riccardo 👑', avatar: 'assets/characters/king-riccardo-1.jpg', favPiece: 'k' },
  { id: 'kate', name: 'Kate 💜', avatar: 'assets/characters/queen-kate-4.jpg', favPiece: 'q' },
  { id: 'ospite', name: 'Ospite 🌟', avatar: 'assets/characters/pawn-puffin.jpg', favPiece: 'p' },
]);

export const SWAMP_REGISTRY = Object.freeze({
  k: {
    ...CHARACTER_REGISTRY.k,
    name: 'Orco Brontolo',
    title: { it: 'Re Orco Brontolo 🐸🧅', en: 'King Grumpy Ogre 🐸🧅' },
    frontPortrait: 'assets/characters/king-swamp-orco.jpg',
    altPortrait: 'assets/characters/king-swamp-orco.jpg',
    backPortrait: 'assets/characters/king-swamp-orco.jpg',
    glbUrl: 'assets/models/swamp/king-swamp-orco.glb',
    optionalGlbCandidates: ['assets/models/swamp/king-swamp-orco.glb'],
    accentColor: 0x6ba32d,
  },
  q: {
    ...CHARACTER_REGISTRY.q,
    name: 'Principessa Orchessa',
    title: { it: 'Principessa Orchessa (Kung-Fu) 👑🥋', en: 'Ogress Princess (Kung-Fu) 👑🥋' },
    frontPortrait: 'assets/characters/queen-swamp-orchessa.jpg',
    altPortrait: 'assets/characters/queen-swamp-orchessa.jpg',
    backPortrait: 'assets/characters/queen-swamp-orchessa.jpg',
    glbUrl: 'assets/models/swamp/queen-swamp-orchessa.glb',
    optionalGlbCandidates: ['assets/models/swamp/queen-swamp-orchessa.glb'],
    accentColor: 0x2e7d32,
  },
  b: {
    ...CHARACTER_REGISTRY.b,
    name: 'Mago Focaccina',
    title: { it: 'Mago Focaccina Ligure 🫒🥖', en: 'Ligurian Focaccia Wizard 🫒🥖' },
    frontPortrait: 'assets/characters/bishop-swamp-focaccina.jpg',
    altPortrait: 'assets/characters/bishop-swamp-focaccina.jpg',
    backPortrait: 'assets/characters/bishop-swamp-focaccina.jpg',
    glbUrl: 'assets/models/swamp/bishop-swamp-focaccina.glb',
    optionalGlbCandidates: ['assets/models/swamp/bishop-swamp-focaccina.glb'],
    accentColor: 0xd49b4b,
  },
  n: {
    ...CHARACTER_REGISTRY.n,
    name: 'Asinello',
    title: { it: 'Asinello Chiacchierone 🫏✨', en: 'Chatterbox Donkey 🫏✨' },
    frontPortrait: 'assets/characters/knight-swamp-asinello.jpg',
    altPortrait: 'assets/characters/knight-swamp-asinello.jpg',
    backPortrait: 'assets/characters/knight-swamp-asinello.jpg',
    glbUrl: 'assets/models/swamp/knight-swamp-asinello.glb',
    optionalGlbCandidates: ['assets/models/swamp/knight-swamp-asinello.glb'],
    accentColor: 0x8d6e63,
  },
  r: {
    ...CHARACTER_REGISTRY.r,
    name: 'Draghessa',
    title: { it: 'Torre Draghessa della Palude 🐉🏰', en: 'Swamp Dragoness Rook 🐉🏰' },
    frontPortrait: 'assets/characters/rook-swamp-draghessa.jpg',
    altPortrait: 'assets/characters/rook-swamp-draghessa.jpg',
    backPortrait: 'assets/characters/rook-swamp-draghessa.jpg',
    glbUrl: 'assets/models/swamp/rook-swamp-draghessa.glb',
    optionalGlbCandidates: ['assets/models/swamp/rook-swamp-draghessa.glb'],
    accentColor: 0xc2185b,
  },
  p: {
    ...CHARACTER_REGISTRY.p,
    name: 'Guardia Re Tappo',
    title: { it: 'Pedone Guardia di Re Tappo 🛡️🧅', en: 'Short-Lord Guard Pawn 🛡️🧅' },
    frontPortrait: 'assets/characters/pawn-swamp-tappo.jpg',
    altPortrait: 'assets/characters/pawn-swamp-tappo.jpg',
    backPortrait: 'assets/characters/pawn-swamp-tappo.jpg',
    glbUrl: 'assets/models/swamp/pawn-swamp-tappo.glb',
    optionalGlbCandidates: ['assets/models/swamp/pawn-swamp-tappo.glb'],
    accentColor: 0xb71c1c,
  },
});

export const CLASSIC_REGISTRY = Object.freeze({
  k: {
    ...CHARACTER_REGISTRY.k,
    name: 'Re Classico',
    title: { it: 'Re Staunton Classico ♔👑', en: 'Classic Staunton King ♔👑' },
    frontPortrait: 'assets/characters/king-classic-re.jpg',
    altPortrait: 'assets/characters/king-classic-re.jpg',
    backPortrait: 'assets/characters/king-classic-re.jpg',
    glbUrl: 'assets/models/classic/king-classic-re.glb',
    optionalGlbCandidates: ['assets/models/classic/king-classic-re.glb'],
    accentColor: 0xd4af37,
  },
  q: {
    ...CHARACTER_REGISTRY.q,
    name: 'Regina Classica',
    title: { it: 'Regina Staunton Classica ♕✨', en: 'Classic Staunton Queen ♕✨' },
    frontPortrait: 'assets/characters/queen-classic-regina.jpg',
    altPortrait: 'assets/characters/queen-classic-regina.jpg',
    backPortrait: 'assets/characters/queen-classic-regina.jpg',
    glbUrl: 'assets/models/classic/queen-classic-regina.glb',
    optionalGlbCandidates: ['assets/models/classic/queen-classic-regina.glb'],
    accentColor: 0xffe082,
  },
  b: {
    ...CHARACTER_REGISTRY.b,
    name: 'San Gennaro',
    title: { it: 'Alfiere San Gennaro (Ampolla del Sangue) ♗🩸', en: 'Bishop St. Januarius (Sacred Ampoule) ♗🩸' },
    frontPortrait: 'assets/characters/bishop-classic-vescovo.jpg',
    altPortrait: 'assets/characters/bishop-classic-vescovo.jpg',
    backPortrait: 'assets/characters/bishop-classic-vescovo.jpg',
    glbUrl: 'assets/models/classic/bishop-classic-vescovo.glb',
    optionalGlbCandidates: ['assets/models/classic/bishop-classic-vescovo.glb'],
    accentColor: 0xc62828,
  },
  n: {
    ...CHARACTER_REGISTRY.n,
    name: 'Destriero Classico',
    title: { it: 'Cavallo Staunton Classico ♘🐎', en: 'Classic Staunton Warhorse ♘🐎' },
    frontPortrait: 'assets/characters/knight-classic-cavallo.jpg',
    altPortrait: 'assets/characters/knight-classic-cavallo.jpg',
    backPortrait: 'assets/characters/knight-classic-cavallo.jpg',
    glbUrl: 'assets/models/classic/knight-classic-cavallo.glb',
    optionalGlbCandidates: ['assets/models/classic/knight-classic-cavallo.glb'],
    accentColor: 0xd4af37,
  },
  r: {
    ...CHARACTER_REGISTRY.r,
    name: 'Torre Matildea',
    title: { it: 'Torre Matildea / Rocca Estense ♖🏰', en: 'Matildea / Estense Tower Rook ♖🏰' },
    frontPortrait: 'assets/characters/rook-classic-torre.jpg',
    altPortrait: 'assets/characters/rook-classic-torre.jpg',
    backPortrait: 'assets/characters/rook-classic-torre.jpg',
    glbUrl: 'assets/models/classic/rook-classic-torre.glb',
    optionalGlbCandidates: ['assets/models/classic/rook-classic-torre.glb'],
    accentColor: 0xb84a2c,
  },
  p: {
    ...CHARACTER_REGISTRY.p,
    name: 'Pedone Classico',
    title: { it: 'Pedone Staunton Classico ♙🏛️', en: 'Classic Staunton Pawn ♙🏛️' },
    frontPortrait: 'assets/characters/pawn-classic-pedone.jpg',
    altPortrait: 'assets/characters/pawn-classic-pedone.jpg',
    backPortrait: 'assets/characters/pawn-classic-pedone.jpg',
    glbUrl: 'assets/models/classic/pawn-classic-pedone.glb',
    optionalGlbCandidates: ['assets/models/classic/pawn-classic-pedone.glb'],
    accentColor: 0xd4af37,
  },
});

export const FAMILY_REGISTRIES = Object.freeze({
  carlesso: CHARACTER_REGISTRY,
  family: CHARACTER_REGISTRY,
  swamp: SWAMP_REGISTRY,
  classic: CLASSIC_REGISTRY,
});

export const I18N = Object.freeze({
  it: {
    title: 'CarChess3D · Carlesso al Cesso',
    subtitle: 'Scacchi Magici nella Palude Incantata di Zurigo',
    mode1Btn: '♟️ Partita 3D',
    mode2Btn: '🌟 WOW Mode & Cinema',
    whoPlays: 'Chi gioca?',
    opponent: 'Avversario:',
    hotseat: '2 Giocatori (Famiglia)',
    cpuEasy: '🤖 CPU Facile (Acchiappa-Pezzi!)',
    cpuMed: '🤖 CPU Media (Pensatore)',
    cpuHard: '🤖 CPU Difficile (Maestro)',
    whiteSet: 'Set Bianco:',
    rivalSet: 'Set Nero:',
    setWhiteCarlesso: '⚪👨‍👩‍👦‍👦 Bianco: Carlesso',
    setWhiteSwamp: '⚪🐸 Bianco: Palude (Orco)',
    setWhiteClassic: '⚪♔ Bianco: Classici (San Gennaro)',
    setFamily: '⚫👨‍👩‍👦‍👦 Nero: Carlesso (Specchio)',
    setSwamp: '⚫🐸 Nero: Palude (Orco & Focaccina)',
    setClassic: '⚫♔ Nero: Classici (San Gennaro & Matildea)',
    setStone: '⚫🗿 Nero: Pietra Magica (Wizard)',
    turnWhite: 'Turno del Bianco (Avorio & Oro)',
    turnBlack: 'Turno del Nero (Ossidiana & Argento)',
    luckBar: '🍀 Barra della Fortuna',
    hintBtn: '💡 Suggerimento',
    flipCamBtn: '🔄 Gira Scacchiera',
    topCamBtn: '📐 Vista dall’Alto',
    newGameBtn: '✨ Nuova Partita',
    fenBtn: '📋 FEN / PGN',
    musicBtn: '🎵 Inno Ale & Seby',
    sfxBtn: '🔊 Effetti',
    skipBtn: '⏭️ Salta Animazione (Spazio)',
    checkAlert: '⚠️ SCACCO AL RE!',
    checkmateTitle: '🏆 SCACCO MATTO!',
    drawTitle: '🤝 PATTA!',
    promoTitle: '✨ Promozione Magica del Puffin! Scegli l’Eroe:',
    wowInspectorTab: '🔍 Ispettore 3D 360°',
    wowArenaTab: '🎬 Arena Battaglie & Cinema Veo',
    triggerBattleBtn: '⚔️ Lancia Sfida 3D + Cinema!',
  },
  en: {
    title: 'CarChess3D · Family Wizard Chess',
    subtitle: 'Magical 3D Chess in the Enchanted Swamp of Zurich',
    mode1Btn: '♟️ 3D Chess Match',
    mode2Btn: '🌟 3D WOW Mode & Cinema',
    whoPlays: 'Who plays?',
    opponent: 'Opponent:',
    hotseat: '2 Players (Hot-Seat)',
    cpuEasy: '🤖 CPU Easy (Capture Lover!)',
    cpuMed: '🤖 CPU Medium (Thinker)',
    cpuHard: '🤖 CPU Hard (Grandmaster)',
    whiteSet: 'White Set:',
    rivalSet: 'Black Set:',
    setWhiteCarlesso: '⚪👨‍👩‍👦‍👦 White: Carlesso',
    setWhiteSwamp: '⚪🐸 White: Swamp (Ogre)',
    setWhiteClassic: '⚪♔ White: Classic (San Gennaro)',
    setFamily: '⚫👨‍👩‍👦‍👦 Black: Carlesso (Mirror)',
    setSwamp: '⚫🐸 Black: Swamp (Ogre & Focaccina)',
    setClassic: '⚫♔ Black: Classic (San Gennaro & Matildea)',
    setStone: '⚫🗿 Black: Wizard Stone',
    turnWhite: 'White’s Turn (Ivory & Gold)',
    turnBlack: 'Black’s Turn (Obsidian & Silver)',
    luckBar: '🍀 Luck Meter',
    hintBtn: '💡 Magic Hint',
    flipCamBtn: '🔄 Flip Board',
    topCamBtn: '📐 Top-Down View',
    newGameBtn: '✨ New Match',
    fenBtn: '📋 FEN / PGN',
    musicBtn: '🎵 Ale & Seby Anthem',
    sfxBtn: '🔊 SFX',
    skipBtn: '⏭️ Skip Cutscene (Space)',
    checkAlert: '⚠️ KING IN CHECK!',
    checkmateTitle: '🏆 CHECKMATE!',
    drawTitle: '🤝 DRAW!',
    promoTitle: '✨ Magical Puffin Promotion! Choose Your Hero:',
    wowInspectorTab: '🔍 360° 3D Character Inspector',
    wowArenaTab: '🎬 Battle Cinema Stage',
    triggerBattleBtn: '⚔️ Launch 3D Clash + Veo Cinema!',
  },
});
