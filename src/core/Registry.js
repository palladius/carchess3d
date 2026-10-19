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

export const APP_VERSION = '0.3.89';
export const GITHUB_REPO_URL = 'https://github.com/palladius/carchess3d';

export const GITHUB_NEW_ISSUE_URL = 'https://github.com/palladius/carchess3d/issues/new';

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
    variants: Object.freeze([
      {
        id: 'k_avanti',
        kind: 'signature',
        weight: 1.4,
        audioUrl: 'assets/audio/voices/voice-k.mp3',
        quote: {
          it: 'Avanti tutta! Re Carlesso al comando!',
          en: 'Avanti tutta! Re Carlesso al comando!',
        },
      },
      {
        id: 'k_hmm',
        kind: 'mumble',
        weight: 2.6,
        audioUrl: 'assets/audio/voices/voice-k-hmm.mp3',
        quote: {
          it: "Mmh-hmm... vediamo un po'!",
          en: "Mmh-hmm... let's see!",
        },
      },
    ]),
  },
  q: {
    type: 'q',
    name: 'Kate',
    quote: {
      it: "That's... interesting.",
      en: "That's... interesting.",
    },
    hoverSound: {
      id: 'queen_chime',
      label: { it: '♕ Hmm-hmm... *sospiro British*', en: '♕ Hmm-hmm... *British sigh*' },
    },
    audioUrl: 'assets/audio/voices/voice-q.mp3',
    speechLang: 'en-GB',
    voiceModel: 'gemini-3.8-flash-tts',
    voicePersona: 'en-gb-csagent-4',
    pitch: 1.02,
    rate: 0.95,
    variants: Object.freeze([
      {
        id: 'q_interesting',
        kind: 'signature',
        weight: 1.5,
        audioUrl: 'assets/audio/voices/voice-q.mp3',
        quote: {
          it: "That's... interesting.",
          en: "That's... interesting.",
        },
      },
      {
        id: 'q_mcmuffin',
        kind: 'signature',
        weight: 1.5,
        audioUrl: 'assets/audio/voices/voice-q-mcmuffin.mp3',
        quote: {
          it: 'Ok, Puffin McMuffin!',
          en: 'Ok, Puffin McMuffin!',
        },
      },
      {
        id: 'q_loveme',
        kind: 'signature',
        weight: 1.5,
        audioUrl: 'assets/audio/voices/voice-q-loveme.mp3',
        quote: {
          it: 'You... love me! I tell myself EVERY day!',
          en: 'You... love me! I tell myself EVERY day!',
        },
      },
      {
        id: 'q_facetious',
        kind: 'signature',
        weight: 1.6,
        audioUrl: 'assets/audio/voices/voice-q-facetious.mp3',
        quote: {
          it: "Don't be FACETIOUS!",
          en: "Don't be FACETIOUS!",
        },
      },
      {
        id: 'q_hmm',
        kind: 'mumble',
        weight: 2.8,
        audioUrl: 'assets/audio/voices/voice-q-hmm.mp3',
        quote: {
          it: 'Hmm-hmm...',
          en: 'Hmm-hmm...',
        },
      },
      {
        id: 'q_sbuffo',
        kind: 'mumble',
        weight: 2.4,
        audioUrl: 'assets/audio/voices/voice-q-sbuffo.mp3',
        quote: {
          it: 'Pff... oh, honestly!',
          en: 'Pff... oh, honestly!',
        },
      },
    ]),
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
    variants: Object.freeze([
      {
        id: 'b_ordini',
        kind: 'signature',
        weight: 1.4,
        audioUrl: 'assets/audio/voices/voice-b.mp3',
        quote: {
          it: 'Agli ordini, Signore!',
          en: 'Agli ordini, Signore!',
        },
      },
      {
        id: 'b_stillhungry',
        kind: 'signature',
        weight: 1.6,
        audioUrl: 'assets/audio/voices/voice-b-stillhungry.mp3',
        speechLang: 'en-GB',
        quote: {
          it: "Mummy... I'm still hungry!",
          en: "Mummy... I'm still hungry!",
        },
      },
      {
        id: 'b_cucinibene',
        kind: 'signature',
        weight: 1.6,
        audioUrl: 'assets/audio/voices/voice-b-cucinibene.mp3',
        quote: {
          it: 'Papino, tu sì che cucini bene!',
          en: 'Papino, tu sì che cucini bene!',
        },
      },
      {
        id: 'b_timanco',
        kind: 'signature',
        weight: 1.5,
        audioUrl: 'assets/audio/voices/voice-b-timanco.mp3',
        quote: {
          it: 'Papino, ti manco tantissimo!',
          en: 'Papino, ti manco tantissimo!',
        },
      },
      {
        id: 'b_piuforte',
        kind: 'signature',
        weight: 1.5,
        audioUrl: 'assets/audio/voices/voice-b-piuforte.mp3',
        quote: {
          it: 'Papino, qual è il più forte?',
          en: 'Papino, qual è il più forte?',
        },
      },
      {
        id: 'b_regalo',
        kind: 'signature',
        weight: 1.5,
        audioUrl: 'assets/audio/voices/voice-b-regalo.mp3',
        quote: {
          it: 'Papino, quando mi compri un regalo?',
          en: 'Papino, quando mi compri un regalo?',
        },
      },
      {
        id: 'b_cafonazzo',
        kind: 'signature',
        weight: 1.7,
        audioUrl: 'assets/audio/voices/voice-b-cafonazzo.mp3',
        quote: {
          it: 'Sei proprio un cafoNAZZO!',
          en: 'Sei proprio un cafoNAZZO!',
        },
      },
      {
        id: 'b_hmm',
        kind: 'mumble',
        weight: 2.8,
        audioUrl: 'assets/audio/voices/voice-b-hmm.mp3',
        quote: {
          it: 'Mmh-hmm... vediamo!',
          en: 'Mmh-hmm... vediamo!',
        },
      },
      {
        id: 'b_sbuffo',
        kind: 'mumble',
        weight: 2.4,
        audioUrl: 'assets/audio/voices/voice-b-sbuffo.mp3',
        quote: {
          it: 'Pff... ma dai!',
          en: 'Pff... ma dai!',
        },
      },
    ]),
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
    variants: Object.freeze([
      {
        id: 'n_dimmi',
        kind: 'signature',
        weight: 1.2,
        audioUrl: 'assets/audio/voices/voice-n.mp3',
        quote: {
          it: 'Dimmi papino!',
          en: 'Dimmi papino!',
        },
      },
      {
        id: 'n_scrivilescemo',
        kind: 'signature',
        weight: 1.8,
        audioUrl: 'assets/audio/voices/voice-n-scrivilescemo.mp3',
        quote: {
          it: 'Hey Google, metti Scrivile Scemo dei Pinguini Tattici Nucleari su YouTube Music!',
          en: 'Hey Google, play Scrivile Scemo by Pinguini Tattici Nucleari on YouTube Music!',
        },
      },
      {
        id: 'n_uccidimostro',
        kind: 'signature',
        weight: 1.8,
        audioUrl: 'assets/audio/voices/voice-n-uccidimostro.mp3',
        quote: {
          it: 'Hey Google, uccidi questo mostro per me!',
          en: 'Hey Google, kill this monster for me!',
        },
      },
      {
        id: 'n_papinooo',
        kind: 'signature',
        weight: 1.6,
        audioUrl: 'assets/audio/voices/voice-n-papinooo.mp3',
        quote: {
          it: 'Papinoooooo!!!',
          en: 'Papinoooooo!!!',
        },
      },
      {
        id: 'n_timanco',
        kind: 'signature',
        weight: 1.5,
        audioUrl: 'assets/audio/voices/voice-n-timanco.mp3',
        quote: {
          it: 'Papino, ti manco tantissimo!',
          en: 'Papino, ti manco tantissimo!',
        },
      },
      {
        id: 'n_mybody',
        kind: 'signature',
        weight: 1.5,
        audioUrl: 'assets/audio/voices/voice-n-mybody.mp3',
        speechLang: 'en-US',
        quote: {
          it: 'My body, my choice!',
          en: 'My body, my choice!',
        },
      },
      {
        id: 'n_cacca',
        kind: 'signature',
        weight: 1.5,
        audioUrl: 'assets/audio/voices/voice-n-cacca.mp3',
        quote: {
          it: 'Mi scappa la cacca!',
          en: 'Mi scappa la cacca!',
        },
      },
      {
        id: 'n_bottom',
        kind: 'signature',
        weight: 1.7,
        audioUrl: 'assets/audio/voices/voice-n-bottom.mp3',
        speechLang: 'en-GB',
        quote: {
          it: 'Mummy, can you clean my bottooooom?',
          en: 'Mummy, can you clean my bottooooom?',
        },
      },
      {
        id: 'n_hmm',
        kind: 'mumble',
        weight: 2.8,
        audioUrl: 'assets/audio/voices/voice-n-hmm.mp3',
        quote: {
          it: 'Mmh-hmm! Ehehe!',
          en: 'Mmh-hmm! Hehe!',
        },
      },
      {
        id: 'n_sbuffo',
        kind: 'mumble',
        weight: 2.4,
        audioUrl: 'assets/audio/voices/voice-n-sbuffo.mp3',
        quote: {
          it: 'Pff... uffaaa!',
          en: 'Pff... uffaaa!',
        },
      },
    ]),
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
    variants: Object.freeze([
      {
        id: 'r_boing',
        kind: 'signature',
        weight: 1.4,
        audioUrl: 'assets/audio/voices/voice-r.mp3',
        quote: {
          it: 'Boing boing! Super abbraccio Pupurabbu!',
          en: 'Boing boing! Super abbraccio Pupurabbu!',
        },
      },
      {
        id: 'r_hmm',
        kind: 'mumble',
        weight: 2.8,
        audioUrl: 'assets/audio/voices/voice-r-hmm.mp3',
        quote: {
          it: 'Mmh-boing! Prrr!',
          en: 'Mmh-boing! Prrr!',
        },
      },
    ]),
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
      label: { it: '🐧 Mmh-piu... *codina scodinzola*', en: '🐧 Mmh-piu... *cute tail wag*' },
    },
    audioUrl: 'assets/audio/voices/voice-p.mp3',
    speechLang: 'it-IT',
    pitch: 1.45,
    rate: 1.12,
    variants: Object.freeze([
      {
        id: 'p_eccomi',
        kind: 'signature',
        weight: 1.0,
        audioUrl: 'assets/audio/voices/voice-p.mp3',
        quote: {
          it: 'Piu piu! Eccomi, pronta guardia Puffin!',
          en: 'Piu piu! Eccomi, pronta guardia Puffin!',
        },
      },
      {
        id: 'p_hmm',
        kind: 'mumble',
        weight: 3.5,
        audioUrl: 'assets/audio/voices/voice-p-hmm.mp3',
        quote: {
          it: 'Mmh... piu!',
          en: 'Mmh... piu!',
        },
      },
    ]),
  },
});

export const QUEEN_GLB_VARIANTS = Object.freeze({
  young: 'assets/models/queen-kate.glb',
  wedding: 'assets/models/queen-kate-wedding2016-remastered.glb',
});

export const BISHOP_GLB_VARIANTS = Object.freeze({
  hat: 'assets/models/bishop-ale-1.glb',
  astrolabe: 'assets/models/bishop-ale-2-remastered.glb',
  rigged: 'assets/models/bishop-ale-rigged.glb',
});

export const CHARACTER_REGISTRY = Object.freeze({
  k: {
    type: 'k',
    role: 'king',
    glyph: '♔',
    name: 'Riccardo',
    title: { it: 'Re Riccardo (Trono Reale 🚽)', en: 'King Riccardo (Royal Throne)' },
    height: CANONICAL_PIECE_HEIGHTS.k,
    weight: 10,
    frontPortrait: 'assets/characters/king-riccardo-1.jpg',
    altPortrait: 'assets/characters/king-riccardo-2.jpg',
    backPortrait: 'tools/model-pipeline/king/back.png',
    glbUrl: 'assets/models/king-riccardo.glb',
    altGlbUrl: 'assets/models/king-riccardo-remastered.glb',
    optionalGlbCandidates: [
      'assets/models/king-riccardo.glb',
      'assets/models/king-riccardo-remastered.glb',
    ],
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
    altGlbUrl: 'assets/models/queen-kate-wedding2016-remastered.glb',
    optionalGlbCandidates: [
      'assets/models/queen-kate.glb',
      'assets/models/queen-kate-wedding2016-remastered.glb',
      'assets/models/queen-kate-young.glb',
      'assets/models/queen-kate-wedding2016.glb',
    ],
    variants: QUEEN_GLB_VARIANTS,
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
      'assets/models/bishop-ale-2-remastered.glb',
      'assets/models/bishop-ale-rigged.glb',
      'assets/models/bishop-ale-2.glb',
    ],
    variants: BISHOP_GLB_VARIANTS,
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
    optionalGlbCandidates: [
      'assets/models/knight-seby.glb',
      'assets/models/knight-seby-halberd.glb',
      'assets/models/knight-seby-lightsaber.glb',
      'assets/models/knight-seby-aurora.glb',
    ],
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

export const DEDICATED_VIDEO_PAIRS = Object.freeze(new Set(['b_x_n', 'n_x_b', 'n_x_r', 'r_x_n']));

export const ANIM_3D_DESCRIPTIONS = Object.freeze({
  sceptre_lightning: {
    it: '⚡ Scettro Fulmine + Cerchio Runico + 28 Scintille d’Oro',
    en: '⚡ Sceptre Lightning + Rune Circle + 28 Golden Sparks',
  },
  golden_toilet_throne: {
    it: '🚽👑 Trono d’Oro Reale dal Cielo + Fulmini + Vortice',
    en: '🚽👑 Descending Golden Throne + Lightning + Whirl',
  },
  chocolate_wave: {
    it: '🍫✨ Onda Ciocco-Lilla Lucida + 40 Coriandoli + Fusione Dolce',
    en: '🍫✨ Glossy Choco-Wave + 40 Confetti + Sweet Melt',
  },
  crystal_shatter: {
    it: '🐉💎 Clip GLB FireBreath_Track + Teca Ametista + 52 Gemme',
    en: '🐉💎 GLB FireBreath_Track + Amethyst Case + 52 Gem Shards',
  },
  loop_track_cars: {
    it: '🏎️✨ Pista Loop Arancione + 8 Macchinine + Stelle Giramento',
    en: '🏎️✨ Orange Loop-Track + 8 Toy Cars + Dizzy Stars',
  },
  plush_ground_pound: {
    it: '💥💜 Salto 2.6m + Schiacciata Pancake + 32 Nuvole Puffose',
    en: '💥💜 2.6m Leap + Pancake Squash + 32 Plush Poof Clouds',
  },
  halberd_fish_slap: {
    it: '🐟⚔️ Schiaffo Pesce Azzurro 3D + Volo Fuori Scacchiera',
    en: '🐟⚔️ 3D Silver-Blue Fish Slap + Off-Board Spin Arc',
  },
  mega_cuddle_bounce: {
    it: '💜🤗 Rimbalzo Abbraccio Sincronizzato + 36 Cuori 3D Fluttuanti',
    en: '💜🤗 Synchronized Cuddle Hop + 36 Floating 3D Hearts',
  },
});

export const FAMILY_ROSTERS = Object.freeze({
  carlesso: {
    id: 'carlesso',
    label: { it: '👨‍👩‍👦‍👦 Famiglia Carlesso', en: '👨‍👩‍👦‍👦 Carlesso Family' },
    pieces: {
      k: { name: 'Riccardo', glyph: '♔', badge: '👑', attackLabel: 'Scettro Fulmine / Trono d’Oro 🚽⚡' },
      q: { name: 'Kate', glyph: '♕', badge: '💜', attackLabel: 'Ciocco-Onda Lilla 🍫✨' },
      b: { name: 'Ale', glyph: '♗', badge: '🐉', attackLabel: 'Soffio Drago & Cristallo 💎🐉' },
      n: { name: 'Seby', glyph: '♘', badge: '🏎️', attackLabel: 'Pista Loop & 8 Macchinine 🏎️🔥' },
      r: { name: 'Pupurabbu', glyph: '♖', badge: '🤗', attackLabel: 'Schiacciata Puffosa / Abbraccio 💜' },
      p: { name: 'Puffin', glyph: '♙', badge: '🐟', attackLabel: 'Alabarda & Pesce Slap 🐟⚔️' },
    },
  },
  classic: {
    id: 'classic',
    label: { it: '🏛️ Classici Carlessiani', en: '🏛️ Classic Set' },
    pieces: {
      k: { name: 'Re Classico', glyph: '♔', badge: '🏛️', attackLabel: 'Decreto Croce Reale & Scintille ♔⚡' },
      q: { name: 'Regina Classica', glyph: '♕', badge: '✨', attackLabel: 'Onda Corona Imperiale ♕✨' },
      b: { name: 'San Gennaro', glyph: '♗', badge: '🩸', attackLabel: 'Raggio Ampolla Sacra & Gemme ♗🩸' },
      n: { name: 'Destriero Classico', glyph: '♘', badge: '🐎', attackLabel: 'Carica Cavalleria & Stelle 💥🐎' },
      r: { name: 'Torre Matildea', glyph: '♖', badge: '🏰', attackLabel: 'Schianto Rocca Estense 🏰💥' },
      p: { name: 'Pedone Classico', glyph: '♙', badge: '🛡️', attackLabel: 'Colpo Marcia Staunton 🛡️⚔️' },
    },
  },
  swamp: {
    id: 'swamp',
    label: { it: '🐸 Famiglia della Palude', en: '🐸 Swamp Family' },
    pieces: {
      k: { name: 'Orco Brontolo', glyph: '♔', badge: '🐸', attackLabel: 'Rutto Cipolla di Palude 🐸🧅' },
      q: { name: 'Principessa Orchessa', glyph: '♕', badge: '🥋', attackLabel: 'Calcio Kung-Fu Slow-Mo 👑🥋' },
      b: { name: 'Don Gatto Spadaccino-Vescovo', glyph: '♗', badge: '🐱', attackLabel: 'Stoccata Spadaccino-Vescovo 🐱⚔️' },
      n: { name: 'Asinello 40 Denti', glyph: '♘', badge: '🫏', attackLabel: 'Calcio Doppio d’Asinello 🫏✨' },
      r: { name: 'Draghessa', glyph: '♖', badge: '🐉', attackLabel: 'Fumo Cuore di Draghessa 🐉🏰' },
      p: { name: 'Zenzy Pan di Zenzero', glyph: '♙', badge: '🍪', attackLabel: 'Alabarda Pan di Zenzero & Focaccina 🍪⚔️' },
    },
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
      const videoPairKey = `${atk}_x_${def}`;
      const hasDedicatedVideo = DEDICATED_VIDEO_PAIRS.has(videoPairKey);
      const hasSkeletalGlbClip = atk === 'b';
      matrix[atk][def] = {
        id: pairId,
        videoPairKey,
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
        hasDedicatedVideo,
        videoSourceType: hasDedicatedVideo ? 'veo_mp4' : 'rendered_3d_mp4',
        hasSkeletalGlbClip,
        skeletalClipName: hasSkeletalGlbClip ? 'FireBreath_Track' : null,
        anim3dDesc: ANIM_3D_DESCRIPTIONS[baseSig.effect],
        videoUrl: `assets/battles/videos/${atk}_x_${def}.mp4`,
        webmUrl: `assets/battles/videos/${atk}_x_${def}.webm`,
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
      videoUrl: `assets/battles/videos/${a}_x_${d}.mp4`,
      webmUrl: `assets/battles/videos/${a}_x_${d}.webm`,
      effect: 'mega_cuddle_bounce',
      debrisType: 'floating_purple_hearts',
      victimReaction: 'happy_cuddle_hop',
      easterEgg: 'seby_pupurabbu_cuddle',
      nonLethalCuddle: true,
      anim3dDesc: ANIM_3D_DESCRIPTIONS.mega_cuddle_bounce,
      banner: {
        it: 'SUPER ABBRACCIO PUFFOSO! 💜🤗',
        en: 'MEGA FLUFFY CUDDLE HUG! 💜🤗',
      },
    };
  }

  // Easter Egg #2: Riccardo (k) <-> Kate (q) Golden Toilet-Throne clash
  for (const [a, d] of [['k', 'q'], ['q', 'k']]) {
    matrix[a][d] = {
      ...matrix[a][d],
      effect: 'golden_toilet_throne',
      debrisType: 'golden_sparks',
      victimReaction: 'royal_throne_whirl',
      easterEgg: 'carlesso_al_cesso_throne',
      anim3dDesc: ANIM_3D_DESCRIPTIONS.golden_toilet_throne,
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

  // Easter Egg #4: Seby (n) -> Pawn Puffin (p): "Sigillo dell’Acquario & Teca di Ghiaccio Eterno" ♒❄️💎
  matrix.n.p = {
    ...matrix.n.p,
    effect: 'sigillo_acquario_ice_coffin',
    debrisType: 'diamond_ice_crystals',
    victimReaction: 'frozen_coffin_crumble',
    easterEgg: 'seby_sigillo_acquario',
    banner: {
      it: 'SIGILLO DELL’ACQUARIO! SEBY CONGELA PUFFIN NELLA TECA DI GHIACCIO! ♒❄️💎',
      en: 'SACRED AQUARIUS! SEBY FREEZES PUFFIN IN THE ICE COFFIN! ♒❄️💎',
    },
  };

  // Easter Egg #4b: Ale (b) -> Mom Queen Kate (q): "Teca Sacra di Tanzanite Blu-Viola" 💎💙💜
  matrix.b.q = {
    ...matrix.b.q,
    easterEgg: 'ale_tanzanite_coffin_for_mom',
    banner: {
      it: 'TECA DI TANZANITE BLU-VIOLA! MAMMA KATE BLOCCATA NEL CRISTALLO! 💎💙💜',
      en: 'BLUE-VIOLET TANZANITE CASE! MOM KATE SAFELY LOCKED IN CRYSTAL! 💎💙💜',
    },
  };

  // Easter Egg #5: King Riccardo ("Papino" `k`) casts a DIFFERENT Spell for each of his 6 targets! 🎲🧙‍♂️
  const PAPINO_DND_SPELLS = {
    k: {
      dndSpell: 'disintegrate',
      banner: {
        it: 'DISINTEGRATE (10d6+40)! RAGGIO VERDE POLVERIZZA IL RE RIVALE! 🟢✨🎲',
        en: 'DISINTEGRATE (10d6+40)! EMERALD RAY VAPORIZES THE RIVAL KING! 🟢✨🎲',
      },
    },
    q: {
      dndSpell: 'kiss_of_death_blight',
      banner: {
        it: "CARLESSO AL CESSO & KISS OF DEATH! AVVIZZITA SUL TRONO D'ORO! 💋🥀💀",
        en: 'CARLESSO AL CESSO & KISS OF DEATH! WITHERED ON THE GOLDEN THRONE! 💋🥀💀',
      },
    },
    b: {
      dndSpell: 'meteor_swarm',
      banner: {
        it: 'METEOR SWARM (9° LIV)! PIOGGIA DI METEORE SU ALE & DRAGO! ☄️🌋🎲',
        en: 'METEOR SWARM (LVL 9)! BLAZING METEORS RAIN ON ALE & DRAGON! ☄️🌋🎲',
      },
    },
    n: {
      dndSpell: 'chain_lightning',
      banner: {
        it: 'CHAIN LIGHTNING! CATENA DI FULMINI REALE SU SEBY TURBO! ⚡⛓️🎲',
        en: 'CHAIN LIGHTNING! ARCING ROYAL BOLTS STRIKE TURBO SEBY! ⚡⛓️🎲',
      },
    },
    r: {
      dndSpell: 'summon_comic_daemon',
      banner: {
        it: 'SUMMON DAEMON! DEMONE BUFFO CON PIZZA CONTRO PUPURABBU! 😈🍕🎲',
        en: 'SUMMON COMIC DAEMON! CHUBBY PIZZA DEMON VS PUPURABBU! 😈🍕🎲',
      },
    },
    p: {
      dndSpell: 'fireball',
      banner: {
        it: 'FIREBALL (8d6)! PAPINO LANCIA PALLA DI FUOCO SUL PUFFIN! 🔥🎲',
        en: 'FIREBALL (8d6)! PAPINO HURLS A BLAZING FIREBALL AT PUFFIN! 🔥🎲',
      },
    },
  };
  for (const [defKey, dndSpec] of Object.entries(PAPINO_DND_SPELLS)) {
    matrix.k[defKey] = {
      ...matrix.k[defKey],
      dndSpell: dndSpec.dndSpell,
      banner: dndSpec.banner,
    };
  }

  return Object.freeze(matrix);
}

export const BATTLE_MATRIX = buildBattleMatrix();

/**
 * Resolves a full matchup summary for `(familyId, attacker, defender)` so the UI can
 * inspect all 36 combinations per family (`carlesso`, `classic`, `swamp`).
 */
export function resolveFamilyMatchup(familyId = 'carlesso', attacker = 'n', defender = 'b') {
  const fam = FAMILY_ROSTERS[familyId] || FAMILY_ROSTERS.carlesso;
  const reg = FAMILY_REGISTRIES[fam.id] || CHARACTER_REGISTRY;
  const atkKey = String(attacker || 'p').toLowerCase();
  const defKey = String(defender || 'p').toLowerCase();
  const base = BATTLE_MATRIX[atkKey]?.[defKey] || BATTLE_MATRIX.p.p;
  const atkPiece = fam.pieces[atkKey] || fam.pieces.p;
  const defPiece = fam.pieces[defKey] || fam.pieces.p;
  const atkReg = reg[atkKey] || CHARACTER_REGISTRY[atkKey];
  const defReg = reg[defKey] || CHARACTER_REGISTRY[defKey];
  return {
    ...base,
    familyId: fam.id,
    familyLabel: fam.label,
    attackerDisplayName: `${atkPiece.badge} ${atkPiece.name}`,
    defenderDisplayName: `${defPiece.badge} ${defPiece.name}`,
    attackSignatureLabel: atkPiece.attackLabel,
    attackerImg: atkReg?.frontPortrait || base.attackerImg,
    defenderImg: defReg?.frontPortrait || base.defenderImg,
  };
}

export const FAMILY_STICKERS = Object.freeze([
  { id: 'sticker_riccardo_throne', name: { it: 'Trono d’Oro di Re Riccardo 🚽👑', en: 'King Riccardo Golden Throne 🚽👑' } },
  { id: 'sticker_kate_choco', name: { it: 'Onda Ciocco-Lilla di Regina Kate 🍫💜', en: 'Queen Kate Choco-Lilac Wave 🍫💜' } },
  { id: 'sticker_ale_dragon', name: { it: 'Draghetto Fiammeggiante di Ale 🐉💎', en: 'Ale Fiery Shoulder Dragon 🐉💎' } },
  { id: 'sticker_seby_turbo', name: { it: 'Super Pista Loop di Seby 🏎️🔥', en: 'Seby Orange Loop-Track Turbo 🏎️🔥' } },
  { id: 'sticker_pupurabbu_hug', name: { it: 'Super Abbraccio di Pupurabbu 🤗💜', en: 'Pupurabbu Mega Plushie Hug 🤗💜' } },
  { id: 'sticker_puffin_halberd', name: { it: 'Puffin Guardia Svizzera Colpo-Pesce 🐟⚔️', en: 'Swiss-Guard Puffin Fish-Slap 🐟⚔️' } },
]);

export const PROFILES = Object.freeze([
  { id: 'susan', name: 'Nonna Susan 👵🇬🇧', avatar: 'assets/characters/queen-kate-4.jpg', favPiece: 'q' },
  { id: 'ale', name: 'Ale 🐉', avatar: 'assets/characters/bishop-ale-1.jpg', favPiece: 'b' },
  { id: 'seby', name: 'Seby 🏎️', avatar: 'assets/characters/knight-seby-4.jpg', favPiece: 'n' },
  { id: 'riccardo', name: 'Riccardo 👑', avatar: 'assets/characters/king-riccardo-1.jpg', favPiece: 'k' },
  { id: 'kate', name: 'Kate 💜', avatar: 'assets/characters/queen-kate-4.jpg', favPiece: 'q' },
  { id: 'ospite', name: 'Guest / Ospite 🌟', avatar: 'assets/characters/pawn-puffin.jpg', favPiece: 'p' },
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
    name: 'Gatto Spadaccino-Vescovo',
    title: { it: 'Don gatto spadaccino (Spadaccino-Vescovo) 🐱⚔️♗', en: 'Don Swordcat (Masked Swordsman Bishop) 🐱⚔️♗' },
    frontPortrait: 'assets/characters/bishop-swamp-gatto.jpg',
    altPortrait: 'assets/characters/bishop-swamp-gatto.jpg',
    backPortrait: 'assets/characters/bishop-swamp-gatto.jpg',
    glbUrl: 'assets/models/swamp/bishop-swamp-focaccina.glb',
    optionalGlbCandidates: ['assets/models/swamp/bishop-swamp-focaccina.glb'],
    accentColor: 0xd84315,
  },
  n: {
    ...CHARACTER_REGISTRY.n,
    name: 'Asinello 40 Denti',
    title: { it: 'Asinello Chiacchierone (Sorrisone a 40 Denti!) 🫏😁✨', en: 'Chatterbox Burro (40-Tooth Grin!) 🫏😁✨' },
    frontPortrait: 'assets/characters/knight-swamp-asinello.jpg',
    altPortrait: 'assets/characters/knight-swamp-asinello-2.jpg',
    backPortrait: 'assets/characters/knight-swamp-asinello-2.jpg',
    glbUrl: 'assets/models/swamp/knight-swamp-asinello.glb',
    optionalGlbCandidates: ['assets/models/swamp/knight-swamp-asinello.glb'],
    accentColor: 0x8d6e63,
  },
  r: {
    ...CHARACTER_REGISTRY.r,
    name: 'Draghessa',
    title: { it: 'Torre Draghessa della Palude (Spire Inesorabili!) 🐉🏰', en: 'Swamp Dragoness Rook (Inexorable Coils!) 🐉🏰' },
    frontPortrait: 'assets/characters/rook-swamp-draghessa.jpg',
    altPortrait: 'assets/characters/rook-swamp-draghessa.jpg',
    backPortrait: 'assets/characters/rook-swamp-draghessa.jpg',
    glbUrl: 'assets/models/swamp/rook-swamp-draghessa.glb',
    optionalGlbCandidates: ['assets/models/swamp/rook-swamp-draghessa.glb'],
    accentColor: 0xc2185b,
  },
  p: {
    ...CHARACTER_REGISTRY.p,
    name: 'Zenzy Pan di Zenzero',
    title: { it: 'Pedone Zenzy Pan di Zenzero & Focaccina 🍪🫒⚔️', en: 'Zenzy Italian Gingerbread & Focaccina Guard 🍪🫒⚔️' },
    frontPortrait: 'assets/characters/pawn-swamp-zenzy.jpg',
    altPortrait: 'assets/characters/pawn-swamp-focaccina.jpg',
    backPortrait: 'assets/characters/pawn-swamp-porcellini.jpg',
    glbUrl: 'assets/models/swamp/pawn-swamp-tappo.glb',
    optionalGlbCandidates: ['assets/models/swamp/pawn-swamp-tappo.glb'],
    accentColor: 0xd49b4b,
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
    signatureId: 'san_gennaro_miracle',
    animations: {
      idle: 'Idle_Track',
      fire: 'San_Gennaro_Miracle',
      attack: 'San_Gennaro_Miracle',
      victory: 'San_Gennaro_Miracle',
    },
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
    matrixBtn: '🎬 Matrice 6×6',
    matrix36Btn: '🎬 Matrice 6×6 (36 Scontri)',
    galleryBtn: '🎬 Cinema Eroi POV',
    videosBtn: '🎬 Cinema Eroi POV',
    skeletonsBtn: '🦴 Scheletri',
    swampBtn: '🐸 Palude',
    trackpadRotateBtn: '🖐️ 2-Dita: Ruota',
    trackpadZoomBtn: '🔍 2-Dita: Zoom',
    showTopbarBtn: '☰ Mostra Barra',
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
    luckBar: '🎲 Dado d20 Rubino',
    d20RollTooltip:
      '🎲 Dado d20 in marmo rosso rubino! Si tira ad ogni cattura (20 = Critico Dorato!) oppure clicca / premi D per tirarlo sulla scacchiera 3D!',
    confirmNewTitle: '⚠️ Ricominciare la partita da capo?',
    confirmNewSub:
      'Tutti i 32 pezzi torneranno alla posizione iniziale e le mosse della partita in corso andranno perse.',
    confirmNewCancelBtn: '✕ Annulla',
    confirmNewYesBtn: '🔄 Sì, Nuova Partita!',
    hintBtn: '💡 Suggerimento',
    flipCamBtn: '🔄 Gira Scacchiera',
    topCamBtn: '📐 Vista dall’Alto',
    resetCamBtn: '🎥 Ripristina Telecamera (R)',
    newGameBtn: '🔄 Nuova Partita',
    fenBtn: '📋 FEN / PGN',
    musicBtn: '🎵 Inno Ale & Seby',
    sfxBtn: '🔊 Effetti',
    skipBtn: '⏭️ Salta Animazione (Spazio)',
    checkAlert: '⚠️ SCACCO AL RE!',
    checkmateTitle: '🏆 SCACCO MATTO!',
    checkmateBanner: '👑 CAPITOLAZIONE DEL RE! SCACCO MATTO! 💥',
    drawTitle: '🤝 PATTA!',
    playAgainBtn: '✨ Gioca Ancora!',
    promoTitle: '✨ Promozione Magica del Puffin! Scegli l’Eroe:',
    wowInspectorTab: '🔍 Ispettore 3D 360°',
    wowArenaTab: '🎬 Arena Battaglie & Cinema Veo',
    wowChooseHero: '🦸 Scegli l’Eroe della Famiglia:',
    wowAnimTitle: '🎬 Animazioni 3D & Soffio Drago:',
    wowCardFlipBtn: '🖼️ Carta 2D: Fronte/Retro',
    wowAutoRotateBtn: '🔄 Auto-Gira',
    wowArenaTitle: '⚔️ Sfida 6×6 & Specchio Cinema Veo:',
    wowAtkLabel: 'Attaccante (Bianco):',
    wowDefLabel: 'Difensore (Nero):',
    wowCritLabel: '🌟 Forza Colpo Critico Dorato (Golden Crit!)',
    triggerBattleBtn: '⚔️ Lancia Sfida 3D + Cinema!',
    setupBtn: '⚙️ Modifica Partita',
    setupTitle: '🏰 CarChess3D · Sfida di Famiglia',
    setupSub: 'Scegli il tuo Eroe, la difficoltà e scendi sulla scacchiera 3D!',
    quickHeroTitle: 'Scegli il tuo Eroe:',
    quickDiffTitle: 'Avversario:',
    playNowBtn: 'GIOCA SUBITO! ✨',
    advancedSetupToggle: '⚙️ Opzioni Avanzate (Fazioni, Varianti 3D, Chiarezza) ▼',
    hideAdvancedSetupToggle: '▲ Chiudi Opzioni Avanzate',
    applyCurrentBtn: '💾 Modifica Partita in Corso (Senza Reset)',
    startMatchBtn: '🔄 Nuova Partita (Reset Pezzi) ✨',
    whiteSide: '⚪ Squadra Bianca (Avorio & Oro / Sud)',
    blackSide: '⚫ Squadra Nera (Ossidiana & Argento / Nord)',
    factionLabel: 'Fazione / Set:',
    controlLabel: 'Controllo:',
    playerHuman: '👤 Umano',
    playerHumanHotseat: '👤 Umano (Hotseat)',
    playerAi: '🤖 Computer AI',
    difficultyLabel: 'Livello AI:',
    profileLabel: 'Profilo Giocatore:',
    hotseatDesc: '👥 Modalità 2 Giocatori Locale sullo stesso schermo.',
    setupWhiteCarlesso: '🏰 Famiglia Carlesso (Ale, Seby, Riccardo, Kate...)',
    setupWhiteSwamp: '🐸 Palude di Zurigo (Orco & Focaccina)',
    setupWhiteClassic: '♔ Scacchi Classici (San Gennaro & Matildea)',
    setupBlackClassic: '♔ Scacchi Classici (San Gennaro & Matildea)',
    setupBlackSwamp: '🐸 Palude di Zurigo (Orco & Focaccina)',
    setupBlackFamily: '🏰 Famiglia Carlesso (Specchio)',
    setupBlackStone: '🗿 Pietra Magica (Wizard)',
    fenModalTitle: '📋 FEN & PGN Scacchiera',
    loadFenBtn: '📥 Carica FEN',
    loadPgnBtn: '📥 Carica PGN',
    matrix36ModalTitle: '🎬 Matrice Interattiva 6×6 — Tutte le 36 Scazzottate 3D & Video 16:9',
    matrix36ModalSub: '6 Attaccanti (Righe) × 6 Difensori (Colonne) · Clicca 🥊 per la Scazzottata 3D + Specchio o ▶️ per il Video 16:9!',
    matrix36MarathonBtn: '▶️ Riproduci Tutti i 36 Scontri (Maratona 6×6)',
    matrix36GalleryLink: '🌐 Galleria 36 Video (battles.html)',
    matrix36LaunchBtn: '🥊 Scazzottata 3D + Cinema sulla Scacchiera!',
    closeBtn: '✕ Chiudi',
    toggleTopbarBtn: '☰ Menu / Barra',
    quakeConsoleBtn: '~_ Console',
    defaultSetupBadge: '✨ Default: Famiglia Carlesso (Bianco / Umano) vs Scacchi Classici (Nero / AI Facile)',
    mobileQuickTitle: 'CarChess3D · Partita Rapida',
    mobileQuickSub: '1-Tap Easy Start · Parti dall’Alto (facile!) e al 1° attacco si accende il Cinema 3D!',
    mobileQuickYou: '🧑 Guest (Tu)',
    mobileQuickPapinoTeam: '👨‍👩‍👦‍👦 Squadra di Papino (Carlesso)',
    mobileQuickCpu: '🤖 Computer',
    mobileQuickCpuTeam: '🏛️ Squadra del Computer (Classici)',
    mobileDiffEasy: '🤖 Facile',
    mobileDiffMed: '🧠 Medio',
    mobileDiff2P: '👥 2 Giocatori',
    mobilePlayNowBtn: '▶️ GIOCA SUBITO! ✨',
    mobileAdvOptionsBtn: '⚙️ Opzioni avanzate (Fazioni & Profili)',
    mobileHideAdvBtn: '▲ Chiudi opzioni avanzate',
    rotateTitle: 'Ehi! Ruotalo in orizzontale 🔄📱',
    rotateSub: 'I film 16:9 e la Scacchiera 3D della Famiglia Carlesso si vedono alla grande in orizzontale (come al cinema! 🍿🎬)',
    rotateDismissBtn: '📱 Gioca comunque in verticale →',
    mobileCamTopBtn: '📐 Vista: Alto',
    mobileCam3dBtn: '🎬 Vista: 3D',
    mobile3dUnlockedToast: '🎬 1° Attacco! Modalità 3D Attivata! (Tocca 📐 Alto / 🎬 3D per cambiare vista)',
    mobileStartToast: '📐 Vista Alto-Basso attiva! Fai la prima mossa: al 1° attacco entri nel 3D! ✨',
    queenVariantLabel: 'Variante Regina:',
    bishopVariantLabel: 'Variante Alfiere:',
    queenVariantYoung: '👑 Kate Young (Canonico)',
    queenVariantWedding: '👰 Kate Nozze 2016 (Remaster)',
    bishopVariantHat: '🎩 Ale Mitria (Canonico)',
    bishopVariantAstrolabe: '🟢 Ale Astrolabio (Remaster)',
    bishopVariantRigged: '🐉 Ale Rigged (Drago)',
    clarityBtn: '🔍 Chiarezza Pezzi',
    clarityLabel: '🔍 Chiarezza Visiva (Riconoscimento Pezzi):',
    clarityS2: '👑 S2 (Default 3D): Corone & Stemmi 3D sulla Testa + Contrasto Ossidiana/Avorio',
    clarityS1: '📐 S1: Medaglioni 2D Classici B/N Allineati alla Casella',
    clarityS3: '🌑 S3: Solo Contrasto Puro Nero Ossidiana vs Bianco Avorio',
    clarityS4: '🛡️ S4: Ghirlanda 3D Piedistallo + Stemma 2D Flottante',
    clarityS5: '✨ S5: Ibrida Completa (Corone 3D + Ghirlanda + Ossidiana + 2D dall’Alto)',
    clarityOff: '🎨 Off: Solo Modelli 3D Originali',
    helpBtn: '❓ Aiuto & Comandi (H / ?)',
    helpModalTitle: '🏰❓ Guida Rapida, Telecamera 3D & Scorciatoie',
    helpModalSub:
      'Tutto quello che serve per muovere la telecamera, usare la rotella per lo zoom e goderti gli Scacchi di Famiglia (Premi H, ? o Esc per chiudere)',
    clarityLettersLabel: '🔤 Accessibilità: Mostra lettere e Braille (K, Q, R, B, N, P) sulle icone 2D',
    qualityLabel: '⚡ Qualità Grafica 3D (LOD):',
    qualityAuto: '🤖 Auto (Consigliata per il tuo dispositivo)',
    qualityHigh: '💻 Alta (~1000k poly / PC potente)',
    qualityMedium: '📱 Media (~50k poly / iPad & tablet)',
    qualityLow: '🔋 Bassa (~10k poly / smartphone o risparmio batteria)',
  },
  en: {

    title: 'CarChess3D · Family Wizard Chess',
    subtitle: 'Magical 3D Chess in the Enchanted Swamp of Zurich',
    mode1Btn: '♟️ 3D Chess Match',
    mode2Btn: '🌟 3D WOW Mode & Cinema',
    matrixBtn: '🎬 6×6 Matrix',
    matrix36Btn: '🎬 6×6 Matrix (36 Clashes)',
    galleryBtn: '🎬 Heroes POV Cinema',
    videosBtn: '🎬 Heroes POV Cinema',
    skeletonsBtn: '🦴 Skeletons',
    swampBtn: '🐸 Swamp',
    trackpadRotateBtn: '🖐️ 2-Finger: Rotate',
    trackpadZoomBtn: '🔍 2-Finger: Zoom',
    showTopbarBtn: '☰ Show Bar',
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
    luckBar: '🎲 Ruby d20',
    d20RollTooltip:
      '🎲 Solid Ruby-Marble d20! Rolls on every capture (20 = Golden Crit!) or click / press D to roll it on the 3D board!',
    confirmNewTitle: '⚠️ Restart match from scratch?',
    confirmNewSub:
      'All 32 pieces will reset to their starting squares and the current match progress will be lost.',
    confirmNewCancelBtn: '✕ Cancel',
    confirmNewYesBtn: '🔄 Yes, New Match!',
    hintBtn: '💡 Magic Hint',
    flipCamBtn: '🔄 Flip Board',
    topCamBtn: '📐 Top-Down View',
    resetCamBtn: '🎥 Reset Camera View (R)',
    newGameBtn: '🔄 New Match',
    fenBtn: '📋 FEN / PGN',
    musicBtn: '🎵 Ale & Seby Anthem',
    sfxBtn: '🔊 SFX',
    skipBtn: '⏭️ Skip Cutscene (Space)',
    checkAlert: '⚠️ KING IN CHECK!',
    checkmateTitle: '🏆 CHECKMATE!',
    checkmateBanner: '👑 ROYAL CAPITULATION! CHECKMATE! 💥',
    drawTitle: '🤝 DRAW!',
    playAgainBtn: '✨ Play Again!',
    promoTitle: '✨ Magical Puffin Promotion! Choose Your Hero:',
    wowInspectorTab: '🔍 360° 3D Character Inspector',
    wowArenaTab: '🎬 Battle Cinema Stage',
    wowChooseHero: '🦸 Choose Family Hero:',
    wowAnimTitle: '🎬 3D Animations & Dragon Breath:',
    wowCardFlipBtn: '🖼️ 2D Card: Front/Back',
    wowAutoRotateBtn: '🔄 Auto-Rotate',
    wowArenaTitle: '⚔️ 6×6 Clash & Veo Cinema Mirror:',
    wowAtkLabel: 'Attacker (White):',
    wowDefLabel: 'Defender (Black):',
    wowCritLabel: '🌟 Force Golden Critical Hit (Golden Crit!)',
    triggerBattleBtn: '⚔️ Launch 3D Clash + Veo Cinema!',
    setupBtn: '⚙️ Edit Match',
    setupTitle: '🏰 CarChess3D · Family Wizard Chess',
    setupSub: 'Pick your Hero, difficulty and jump onto the 3D chessboard!',
    quickHeroTitle: 'Choose your Hero:',
    quickDiffTitle: 'Opponent Mode:',
    playNowBtn: 'PLAY NOW! ✨',
    advancedSetupToggle: '⚙️ Advanced Options (Factions, 3D Variants, Clarity) ▼',
    hideAdvancedSetupToggle: '▲ Hide Advanced Options',
    applyCurrentBtn: '💾 Update Current Match (No Reset)',
    startMatchBtn: '🔄 New Match (Reset Board) ✨',
    whiteSide: '⚪ White Team (Ivory & Gold / South)',
    blackSide: '⚫ Black Team (Obsidian & Silver / North)',
    factionLabel: 'Faction / Set:',
    controlLabel: 'Control:',
    playerHuman: '👤 Human',
    playerHumanHotseat: '👤 Human (Hotseat)',
    playerAi: '🤖 Computer AI',
    difficultyLabel: 'AI Level:',
    profileLabel: 'Player Profile:',
    hotseatDesc: '👥 Local 2-Player mode on the same screen.',
    setupWhiteCarlesso: '🏰 Carlesso Family (Ale, Seby, Riccardo, Kate...)',
    setupWhiteSwamp: '🐸 Zurich Swamp (Ogre & Focaccina)',
    setupWhiteClassic: '♔ Classic Chess (San Gennaro & Matildea)',
    setupBlackClassic: '♔ Classic Chess (San Gennaro & Matildea)',
    setupBlackSwamp: '🐸 Zurich Swamp (Ogre & Focaccina)',
    setupBlackFamily: '🏰 Carlesso Family (Mirror)',
    setupBlackStone: '🗿 Wizard Stone',
    fenModalTitle: '📋 Board FEN & PGN',
    loadFenBtn: '📥 Load FEN',
    loadPgnBtn: '📥 Load PGN',
    matrix36ModalTitle: '🎬 Interactive 6×6 Matrix — All 36 3D Brawls & 16:9 Videos',
    matrix36ModalSub: '6 Attackers (Rows) × 6 Defenders (Columns) · Click 🥊 for 3D Brawl + Cinema or ▶️ for 16:9 Video!',
    matrix36MarathonBtn: '▶️ Play All 36 Clashes (6×6 Marathon)',
    matrix36GalleryLink: '🌐 36 Videos Gallery (battles.html)',
    matrix36LaunchBtn: '🥊 Launch 3D Brawl + Cinema on the Board!',
    closeBtn: '✕ Close',
    toggleTopbarBtn: '☰ Menu / Bar',
    quakeConsoleBtn: '~_ Console',
    defaultSetupBadge: '✨ Default: Carlesso Family (White / Human) vs Classic Chess (Black / AI Easy)',
    mobileQuickTitle: 'CarChess3D · Quick Match',
    mobileQuickSub: '1-Tap Easy Start · Start Top-Down (easy moves!) & unlock 3D Cinema on 1st attack!',
    mobileQuickYou: '🧑 Guest (You)',
    mobileQuickPapinoTeam: '👨‍👩‍👦‍👦 Papino’s Team (Carlesso Family)',
    mobileQuickCpu: '🤖 Computer',
    mobileQuickCpuTeam: '🏛️ Computer’s Team (Classic)',
    mobileDiffEasy: '🤖 Easy',
    mobileDiffMed: '🧠 Medium',
    mobileDiff2P: '👥 2 Players',
    mobilePlayNowBtn: '▶️ PLAY NOW! ✨',
    mobileAdvOptionsBtn: '⚙️ Advanced options (Factions & Profiles)',
    mobileHideAdvBtn: '▲ Hide advanced options',
    rotateTitle: 'Hey! Rotate your phone to Landscape 🔄📱',
    rotateSub: 'Our 16:9 Battle Movies and 3D Family Chessboard look best in horizontal mode (just like the movies! 🍿🎬)',
    rotateDismissBtn: '📱 Play in vertical anyway →',
    mobileCamTopBtn: '📐 View: Top',
    mobileCam3dBtn: '🎬 View: 3D',
    mobile3dUnlockedToast: '🎬 1st Attack! 3D Mode Unlocked! (Tap 📐 Top / 🎬 3D anytime to switch)',
    mobileStartToast: '📐 Easy Top-Down View active! Make a move: 1st attack unlocks 3D Mode! ✨',
    queenVariantLabel: 'Queen Variant:',
    bishopVariantLabel: 'Bishop Variant:',
    queenVariantYoung: '👑 Kate Young (Canonical)',
    queenVariantWedding: '👰 Kate Wedding 2016 (Remaster)',
    bishopVariantHat: '🎩 Ale Mitre (Canonical)',
    bishopVariantAstrolabe: '🟢 Ale Astrolabe (Remaster)',
    bishopVariantRigged: '🐉 Ale Rigged (Dragon)',
    clarityBtn: '🔍 Piece Clarity',
    clarityLabel: '🔍 Visual Clarity (Piece Recognition):',
    clarityS2: '👑 S2 (Default 3D): Head-Mounted 3D Crowns/Crests + Obsidian/Ivory Contrast',
    clarityS1: '📐 S1: Square-Aligned Classic 2D B/W Medallions',
    clarityS3: '🌑 S3: Pure Obsidian Black vs Ivory White Contrast Only',
    clarityS4: '🛡️ S4: 3D Pedestal Role Wreath + Floating 2D Crest',
    clarityS5: '✨ S5: Hybrid Full (3D Crowns + Wreath + Obsidian + Auto-2D Top)',
    clarityOff: '🎨 Off: Original 3D Models Only',
    helpBtn: '❓ Help & Controls (H / ?)',
    helpModalTitle: '🏰❓ Quick Guide, 3D Camera & Shortcuts',
    helpModalSub:
      'Everything you need to control the 3D camera, zoom with the mouse wheel, and enjoy Family Wizard Chess (Press H, ? or Esc to close)',
    clarityLettersLabel: '🔤 Accessibility: Show role letters & Braille (K, Q, R, B, N, P) on 2D icons',
    qualityLabel: '⚡ 3D Graphics Quality (LOD):',
    qualityAuto: '🤖 Auto (Recommended for your hardware)',
    qualityHigh: '💻 High (~1000k poly / powerful desktop)',
    qualityMedium: '📱 Medium (~50k poly / iPad & tablet)',
    qualityLow: '🔋 Low (~10k poly / phone or battery saver)',
  },
});


/**
 * Pure camera mouse-wheel / trackpad gesture handler for `OrbitControls`.
 *
 * - **Default (`controls.trackpadTwoFingerRotate === false`)**: Mouse wheel (and 2-finger scroll)
 *   zooms in (`deltaY < 0` -> `_dollyIn`) and zooms out (`deltaY > 0` -> `_dollyOut`).
 * - **`Ctrl` or `Cmd` (`metaKey`) + Wheel / Trackpad Pinch**: Always zooms in/out.
 * - **`Shift` + Wheel**: Pans the camera target (`_pan`).
 * - **`Alt` + Wheel** (or 2-finger scroll when `controls.trackpadTwoFingerRotate === true`):
 *   Orbits/rotates left/right (`_rotateLeft`) and up/down (`_rotateUp`).
 *
 * @param {object} controls
 * @param {{ clientX?: number, clientY?: number, deltaX?: number, deltaY?: number, ctrlKey?: boolean, metaKey?: boolean, altKey?: boolean, shiftKey?: boolean }} event
 * @returns {'zoom'|'pan'|'rotate'}
 */
export function applyWheelZoomOrOrbit(controls, event = {}) {
  if (!controls) return 'zoom';
  controls._updateZoomParameters?.(event.clientX ?? 0, event.clientY ?? 0);

  const deltaX = Number(event.deltaX ?? 0);
  const deltaY = Number(event.deltaY ?? 0);
  const zoomSpeed = Number(controls.zoomSpeed ?? 1.25);
  const rotateSpeed = Number(controls.rotateSpeed ?? 0.95);

  if (event.shiftKey && !event.ctrlKey && !event.metaKey) {
    controls._pan?.(-deltaX * 0.65, -deltaY * 0.65);
    controls.update?.();
    return 'pan';
  }

  const shouldZoom =
    Boolean(event.ctrlKey) ||
    Boolean(event.metaKey) ||
    (!event.altKey && !controls.trackpadTwoFingerRotate);

  if (shouldZoom) {
    const pinchScale = Math.pow(
      0.95,
      zoomSpeed * Math.min(8.0, Math.abs(deltaY) * 0.025 + 0.35),
    );
    if (deltaY < 0) {
      controls._dollyIn?.(pinchScale);
    } else if (deltaY > 0) {
      controls._dollyOut?.(pinchScale);
    }
    controls.update?.();
    return 'zoom';
  }

  const h = Math.max(1, Number(controls.domElement?.clientHeight || 800));
  const twoPi = Math.PI * 2;
  controls._rotateLeft?.((twoPi * deltaX * rotateSpeed * 0.85) / h);
  controls._rotateUp?.((twoPi * deltaY * rotateSpeed * 0.85) / h);
  controls.update?.();
  return 'rotate';
}

/**
 * Detects whether the current viewport is a compact smartphone (e.g., Pixel 10, iPhone)
 * while strictly leaving iPads/Tablets (`shortSide >= 600px`) and Desktops untouched.
 * Supports `?mobile=1` (force mobile mode) and `?mobile=0` / `?desktop=1` (force desktop mode).
 *
 * @param {{ width?: number, height?: number, search?: string }} [env]
 * @returns {boolean}
 */
export function isMobilePhoneViewport(env = {}) {
  const win = typeof window !== 'undefined' ? window : null;
  const search =
    env.search !== undefined
      ? String(env.search || '')
      : win?.location?.search
        ? String(win.location.search)
        : '';

  if (search && typeof URLSearchParams !== 'undefined') {
    const params = new URLSearchParams(search);
    const mobileParam = (params.get('mobile') || '').toLowerCase();
    const desktopParam = (params.get('desktop') || '').toLowerCase();
    if (mobileParam === '1' || mobileParam === 'true') return true;
    if (
      mobileParam === '0' ||
      mobileParam === 'false' ||
      desktopParam === '1' ||
      desktopParam === 'true'
    ) {
      return false;
    }
  }

  const width = Number(env.width ?? win?.innerWidth ?? 0);
  const height = Number(env.height ?? win?.innerHeight ?? 0);
  if (!(width > 0 && height > 0)) return false;

  const shortSide = Math.min(width, height);
  const longSide = Math.max(width, height);
  // Smartphones have shortSide < 600px (e.g. Pixel 10 is 412x915, iPhone Pro Max is 440x956).
  // iPads start at 768x1024 (shortSide = 768 >= 600) and Desktops are >= 1024x768.
  return shortSide < 600 && longSide <= 1024;
}

/**
 * Returns true when the viewport is currently in Portrait (`height > width`).
 * @param {{ width?: number, height?: number }} [env]
 * @returns {boolean}
 */
export function isPortraitOrientation(env = {}) {
  const win = typeof window !== 'undefined' ? window : null;
  const width = Number(env.width ?? win?.innerWidth ?? 0);
  const height = Number(env.height ?? win?.innerHeight ?? 0);
  if (!(width > 0 && height > 0)) return false;
  return height > width;
}

/**
 * Detects whether the current device is a mobile phone OR a touch tablet (e.g., Pixel 10,
 * Samsung Galaxy Tab S10, iPad) so WebGL can bypass heavy desktop post-processing FBOs
 * (`UnrealBloomPass` HalfFloatType mip chains) that trigger white/dead canvases on mobile GPUs.
 *
 * @param {{ width?: number, height?: number, search?: string, userAgent?: string, maxTouchPoints?: number }} [env]
 * @returns {boolean}
 */
export function isMobileOrTabletDevice(env = {}) {
  if (isMobilePhoneViewport(env)) return true;

  const win = typeof window !== 'undefined' ? window : null;
  const nav = typeof navigator !== 'undefined' ? navigator : null;
  const search =
    env.search !== undefined
      ? String(env.search || '')
      : win?.location?.search
        ? String(win.location.search)
        : '';

  if (search && typeof URLSearchParams !== 'undefined') {
    const params = new URLSearchParams(search);
    const desktopParam = (params.get('desktop') || '').toLowerCase();
    const tabletParam = (params.get('tablet') || '').toLowerCase();
    if (desktopParam === '1' || desktopParam === 'true') return false;
    if (tabletParam === '1' || tabletParam === 'true') return true;
  }

  const ua = String(env.userAgent ?? nav?.userAgent ?? '');
  if (/Android|iPhone|iPad|iPod|Mobile|Tablet|Silk/i.test(ua)) {
    return true;
  }

  const touchPoints = Number(env.maxTouchPoints ?? nav?.maxTouchPoints ?? 0);
  const width = Number(env.width ?? win?.innerWidth ?? 0);
  const height = Number(env.height ?? win?.innerHeight ?? 0);
  const longSide = Math.max(width, height);
  if (touchPoints > 0 && longSide > 0 && longSide <= 1920) {
    return true;
  }

  return false;
}

/**
 * Determines whether `PieceView` should use lightweight 3D sculptures (3D Faction Pedestals +
 * 3D Columns + Double-Sided 2D Cutie Portrait Medallions + 3D Role Crowns / Stone Warriors)
 * instead of full 3D `.glb` character meshes.
 *
 * - Default `false` everywhere (Full 3D `.glb` models enabled by default on Pixel 10, tablets, and desktop
 *   now that `HalfFloatType` Bloom FBOs are bypassed on mobile GPUs!).
 * - Opt-in via `?lite=1` / `?lite3d=1` for ultra-low-memory devices.
 *
 * @param {{ width?: number, height?: number, search?: string }} [env]
 * @returns {boolean}
 */
export function shouldUseMobileLite3D(env = {}) {
  const win = typeof window !== 'undefined' ? window : null;
  const search =
    env.search !== undefined
      ? String(env.search || '')
      : win?.location?.search
        ? String(win.location.search)
        : '';

  if (search && typeof URLSearchParams !== 'undefined') {
    const params = new URLSearchParams(search);
    const liteParam = (params.get('lite') || params.get('lite3d') || '').toLowerCase();
    const glbParam = (params.get('glb') || params.get('hd') || '').toLowerCase();
    if (liteParam === '1' || liteParam === 'true') return true;
    if (
      liteParam === '0' ||
      liteParam === 'false' ||
      glbParam === '1' ||
      glbParam === 'true'
    ) {
      return false;
    }
  }

  return false;
}

/**
 * Resolves GLB path for a piece role, considering family, variants, and LOD tier ('low'|'medium'|'high').
 *
 * @param {string} pieceKey 'k'|'q'|'b'|'n'|'r'|'p'
 * @param {'low'|'medium'|'high'|string} [lodTier='high']
 * @param {{ family?: string, bishopVariant?: string, queenVariant?: string }} [opts]
 * @returns {string} Relative GLB model path
 */
export function resolvePieceGlbForLod(pieceKey, lodTier = 'high', opts = {}) {
  const familyId = opts.family || 'carlesso';
  const reg = FAMILY_REGISTRIES[familyId] || CHARACTER_REGISTRY;
  const def = reg[pieceKey] || CHARACTER_REGISTRY[pieceKey];
  if (!def) return '';

  let canonicalPath = def.glbUrl;

  if (pieceKey === 'b') {
    const bVar = opts.bishopVariant || 'hat';
    if (bVar && BISHOP_GLB_VARIANTS[bVar]) {
      canonicalPath = BISHOP_GLB_VARIANTS[bVar];
    }
  } else if (pieceKey === 'q') {
    const qVar = opts.queenVariant || 'young';
    if (qVar && QUEEN_GLB_VARIANTS[qVar]) {
      canonicalPath = QUEEN_GLB_VARIANTS[qVar];
    }
  }

  // If def provides explicit lodGlbUrls dictionary, use it:
  if (def.lodGlbUrls && def.lodGlbUrls[lodTier]) {
    return def.lodGlbUrls[lodTier];
  }

  return canonicalPath;
}

