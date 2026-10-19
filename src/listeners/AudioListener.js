/**
 * @fileoverview Procedural WebAudio SFX & Bilingual Lyria 3 Theme Song Listener (`AudioListener`).
 *
 * Follows Niccolò Game Design Rule #5 & #7:
 * - **Listeners, Not Callers**: Gameplay code never calls `Sound.play()`. Instead,
 *   `AudioListener` subscribes to `GameEventBus` facts (`MOVE_EXECUTED`, `PIECE_CAPTURED`,
 *   `CASTLING_EXECUTED`, `CHECK_DETECTED`, `CHECKMATE`, `DROP_SPAWNED`, `LUCK_RESET`,
 *   `BATTLE_STARTED`, `HINT_SUGGESTED`, `LANGUAGE_CHANGED`, `MUSIC_TOGGLE_REQUESTED`,
 *   `SFX_TOGGLE_REQUESTED`).
 * - **Data-Driven Signature SFX Table**: Maps each `BATTLE_MATRIX` effect (`sceptre_lightning`,
 *   `chocolate_wave`, `crystal_shatter`, `loop_track_cars`, `plush_ground_pound`,
 *   `halberd_fish_slap`, `mega_cuddle_bounce`, `golden_toilet_throne`) to a dedicated
 *   zero-dependency WebAudio synthesizer recipe.
 * - **Bilingual Theme Player ("Ale & Seby, Eroi della Scacchiera / Heroes of the Board")**:
 *   Attempts to play `assets/audio/theme-${lang}.mp3` if present on disk, and seamlessly
 *   falls back to a cheerful procedural WebAudio chiptune/orchestral adventure loop
 *   with synchronized bilingual karaoke captions (`LYRIA_CAPTION`).
 */

import { VOICE_LINES } from '../core/Registry.js';

const THEME_LYRICS = Object.freeze({
  it: [
    '🎻 Ouverture Barocca degli Scacchi — Ottetto d’archi in Mi Dorico!',
    '🐉 Ale col draghetto rosso vola in diagonale tra i violini!',
    '🏎️ Seby sulla pista turbo salta a L al ritmo dei violoncelli!',
    '🐟 I Puffin Guardia Svizzera marciano a tempo di staccato!',
    '💜 Pupurabbu super morbido danza con gli archi reali!',
    '🍫♕ Kate & 👑 Riccardo: Finale Sinfonico sulla Scacchiera!',
  ],
  en: [
    '🎻 Baroque String Octet Overture — Staccato Strings in E Dorian!',
    '🐉 Bishop Ale and his red dragon soar across the violins!',
    '🏎️ Knight Seby leaps in L-shapes to the driving cello pulse!',
    '🐟 Swiss-Guard Puffin Pawns march in crisp staccato rhythm!',
    '💜 Fluffy Rook Pupurabbu bounces to the chamber strings!',
    '🍫♕ Queen Kate & 👑 King Riccardo — Grand Symphonic Checkmate!',
  ],
});

// Baroque & Chamber String Octet Loops in E Dorian / E Minor (100% acoustic strings, zero 80s chiptune)
export const CHESS_STRINGS_THEME_URL = 'assets/audio/chess-strings-theme.mp3';
export const CHESS_STRINGS_BG_URL = 'assets/audio/chess-strings-bg.mp3';
export const CHECKMATE_AUDIO_URL = 'assets/audio/checkmate-jingle.mp3';
export const CHESS_STRINGS_TRACKS = Object.freeze([
  CHESS_STRINGS_THEME_URL,
  CHESS_STRINGS_BG_URL,
]);
const BAROQUE_VIOLIN_MELODY_HZ = Object.freeze([
  659.25, 739.99, 783.99, 739.99, 659.25, 587.33, 554.37, 523.25,
  493.88, 554.37, 523.25, 493.88, 392.00, 440.00, 493.88, 659.25,
]);
const BAROQUE_CELLO_STACCATO_HZ = Object.freeze([
  164.81, 246.94, 164.81, 277.18, 164.81, 261.63, 164.81, 246.94,
  130.81, 196.00, 246.94, 196.00, 146.83, 220.00, 164.81, 246.94,
]);

// Fiery 152 BPM D-Minor Phrygian Dominant 16th-note ostinato for combat suspense (D3, F3, G3, G#3, A3, Bb3, C#4, D4)
export const COMBAT_AUDIO_URL = 'assets/audio/combat-suspense.mp3';
// Every cue point leaves >= 14.0s of continuous forward playback before the 30.77s track ends (29.5s full music),
// so a 10s battle (+ 3.5s outro) NEVER reaches the end of the file or repeats any phrase!
export const COMBAT_CUE_POINTS_S = Object.freeze([0.0, 8.0, 15.5]);
// Calibrated music volumes: combat is strictly +15% above normal background music (1.15x, NEVER 100%+!)
export const NORMAL_MUSIC_VOLUME = 0.24;
export const COMBAT_MUSIC_PEAK_VOLUME = Number((NORMAL_MUSIC_VOLUME * 1.15).toFixed(3));
const COMBAT_OSTINATO_HZ = Object.freeze([
  146.83, 146.83, 174.61, 196.00, 207.65, 220.00, 233.08, 220.00,
  146.83, 220.00, 233.08, 277.18, 293.66, 277.18, 233.08, 220.00,
]);

// Rising high-tension Phrygian/Harmonic-Minor brass & string stabs (A4, Bb4, C#5, D5, E5, F5, G#5, A5)
const COMBAT_SUSPENSE_LEAD_HZ = Object.freeze([
  440.00, 466.16, 554.37, 587.33, 659.25, 698.46, 830.61, 880.00,
]);

export class AudioListener {
  /**
   * @param {object} [ctx]
   */
  constructor(ctx = null) {
    this.ctx = ctx;
    /** @type {'it'|'en'} */
    this.lang = 'it';
    this.sfxEnabled = true;
    this.musicPlaying = false;
    this.audioCtx = null;
    this.audioEl = null;
    this.themeTrackIndex = 0;
    this.themeAudioFailed = false;
    this.checkmateAudioEl = null;
    this.castlingAudioEl = null;
    this.combatAudioEl = null;
    this.combatAudioFailed = false;
    this.combatMusicActive = false;
    this.combatFadingOut = false;
    this.combatEnvelope = 0.0;
    this.combatStep = 0;
    this.combatCueIndex = 0;
    this.combatTimer = null;
    this.combatFadeTimer = null;
    this.voiceEl = null;
    this.voiceAudioCache = new Map();
    /** @type {Map<string, number>} Count of voice plays per piece type */
    this.voicePlayCountByType = new Map();
    /** @type {Map<string, Array<string>>} Ring buffer of recent variant IDs per piece type (prevents immediate repeats) */
    this.recentVariantIdsByType = new Map();
    /** @type {Map<string, Array<object>>} Shuffled deck of unseen signature variants per piece type */
    this.signatureDeckByType = new Map();
    /** @type {Map<string, string>} Last played kind ('signature' | 'mumble') per piece type */
    this.lastKindByType = new Map();
    /** @type {Map<string, number>} Timestamp of last hover SFX per piece type (anti-spam for pawn rows) */
    this.lastHoverTimeByType = new Map();
    this.hoverStepCounter = 0;
    this.loopTimer = null;
    this.melodyStep = 0;
    this.lyricStep = 0;
    /** @type {Array<string>} Log of triggered SFX for headless unit test verification */
    this.playedSfx = [];
    /** @type {Array<object>} Log of spoken character voice lines for headless unit test verification */
    this.playedVoices = [];
    this.offs = [];

    // Declarative table of signature battle synthesizer recipes (Rule #7: zero if/else chains)
    this.battleSynthTable = Object.freeze({
      sceptre_lightning: () => this.synthLightningZap(),
      golden_toilet_throne: () => this.synthGoldenThroneClash(),
      chocolate_wave: () => this.synthChocolateSplash(),
      crystal_shatter: () => this.synthCrystalShatter(),
      loop_track_cars: () => this.synthRaceCarVroom(),
      plush_ground_pound: () => this.synthPlushieSqueakBoom(),
      halberd_fish_slap: () => this.synthFishSlapPling(),
      mega_cuddle_bounce: () => this.synthCuddleHarpArpeggio(),
      sigillo_acquario_ice_coffin: () => this.synthSigilloAcquarioIce(),
      tanzanite_crystal_coffin: () => this.synthSigilloAcquarioIce(),
    });

    // Declarative table of per-piece hover creature sound effects (snort, fiuu, piu-piu, boing)
    this.hoverSynthTable = Object.freeze({
      n: () => this.synthHorseSnort(),
      b: () => this.synthDragonWhistle(),
      p: () => this.synthPuffinPeep(),
      r: () => this.synthPlushBoing(),
      q: () => this.synthQueenChime(),
      k: () => this.synthKingSceptreHum(),
    });

    if (ctx) {
      this.init(ctx);
    }
  }

  /**
   * @param {object} ctx
   */
  init(ctx = {}) {
    this.ctx = ctx;
    const bus = ctx.bus;
    if (!bus || this.offs.length > 0) return;

    this.offs.push(
      bus.on('PIECE_HOVERED', (e) => {
        const pType = String(e?.pieceType || e?.piece?.type || 'p').toLowerCase();
        this.playHoverSfxWithAntiSpam(pType);
      }),
      bus.on('PIECE_SELECTED', (e) => {
        const pType = String(e?.piece?.type || e?.pieceType || 'p').toLowerCase();
        const recipe = this.hoverSynthTable[pType] || this.hoverSynthTable.p;
        this.playSfx(`select_${pType}`, recipe);
        this.playCharacterVoiceLine(pType, e?.square || null);
      }),
      bus.on('MOVE_EXECUTED', (e) => {
        if (!e.captured && !e.isCastle) {
          this.playSfx('move_hop', () => this.synthStoneHop());
        }
      }),
      bus.on('CASTLING_EXECUTED', (e) => {
        this.playSfx('castling_boing', () => this.synthCastlingBoing());
        this.playCastlingTheme();
      }),
      bus.on('PIECE_CAPTURED', (e) => {
        this.playSfx(`capture_${e.attacker}`, () => this.synthCaptureImpact());
      }),
      bus.on('BATTLE_STARTED', (e) => {
        const effectKey = e.effect || 'sceptre_lightning';
        const recipe = this.battleSynthTable[effectKey] || this.battleSynthTable.sceptre_lightning;
        this.playSfx(`battle_${effectKey}`, recipe);
        this.startCombatMusic(e);
      }),
      bus.on('BATTLE_COMPLETED', () => {
        this.stopCombatMusic(false);
      }),
      bus.on('BATTLE_SKIPPED', () => {
        // Smooth, measured 2.5s audio cross-fade on Space/Click forced exit (never abrupt!)
        this.stopCombatMusic(false, 2500);
      }),
      bus.on('BOARD_RESET', () => {
        this.stopCombatMusic(true);
        this.stopCheckmateJingle();
        if (this.castlingAudioEl) {
          try {
            this.castlingAudioEl.pause();
            this.castlingAudioEl.currentTime = 0;
          } catch {}
        }
        if (this.themeTrackIndex !== 0) {
          this.switchThemeTrack(0);
        }
      }),
      bus.on('CHECK_DETECTED', () => {
        this.playSfx('check_alarm', () => this.synthCheckAlarm());
      }),
      bus.on('CHECKMATE', (e) => {
        this.playSfx('checkmate_fanfare', () => this.synthCheckmateFanfare());
        this.playCheckmateJingle(e);
      }),
      bus.on('DROP_SPAWNED', (e) => {
        if (e.tier === 'golden_crit' || e.sticker) {
          this.playSfx('golden_crit_chime', () => this.synthGoldenCritChime());
        }
      }),
      bus.on('LUCK_RESET', () => {
        this.playSfx('luck_reset_sparkle', () => this.synthHintSparkle());
      }),
      bus.on('HINT_SUGGESTED', () => {
        this.playSfx('hint_sparkle', () => this.synthHintSparkle());
      }),
      bus.on('LANGUAGE_CHANGED', (e) => {
        this.lang = e.lang === 'en' ? 'en' : 'it';
        if (this.musicPlaying) {
          this.restartThemeForLanguage();
        }
      }),
      bus.on('MUSIC_TOGGLE_REQUESTED', (e) => {
        const target = typeof e.playing === 'boolean' ? e.playing : !this.musicPlaying;
        if (target) this.startThemeSong();
        else this.stopThemeSong();
      }),
      bus.on('SFX_TOGGLE_REQUESTED', (e) => {
        this.sfxEnabled = typeof e.enabled === 'boolean' ? e.enabled : !this.sfxEnabled;
        if (!this.sfxEnabled && !this.musicPlaying) {
          this.stopCombatMusic(true);
        }
      }),
    );
  }

  ensureAudioContext() {
    if (this.audioCtx) {
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      return this.audioCtx;
    }
    if (typeof window === 'undefined') return null;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    try {
      this.audioCtx = new Ctor();
      return this.audioCtx;
    } catch {
      return null;
    }
  }

  playSfx(label, synthFn) {
    this.playedSfx.push(label);
    if (this.playedSfx.length > 100) this.playedSfx.shift();
    if (!this.sfxEnabled) return;
    const ac = this.ensureAudioContext();
    if (!ac) return;
    try {
      synthFn(ac);
    } catch {
      // Ignore WebAudio autoplay restrictions prior to first gesture
    }
  }

  toggleSfx() {
    this.sfxEnabled = !this.sfxEnabled;
    return this.sfxEnabled;
  }

  // ===========================================================================
  // 1. PROCEDURAL WEBAUDIO SYNTHESIZER RECIPES
  // ===========================================================================

  synthTone(freqStart, freqEnd, durationS, type = 'sine', peakGain = 0.16, delayS = 0) {
    const ac = this.ensureAudioContext();
    if (!ac) return;
    const now = ac.currentTime + delayS;
    const osc = ac.createOscillator();
    const gain = ac.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freqStart), now);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + durationS);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(peakGain, now + Math.min(0.02, durationS * 0.25));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationS);

    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(now);
    osc.stop(now + durationS + 0.02);
  }

  synthStoneHop() {
    this.synthTone(190, 320, 0.11, 'triangle', 0.14, 0);
    this.synthTone(260, 140, 0.09, 'sine', 0.12, 0.09);
  }

  synthCastlingBoing() {
    this.synthTone(220, 580, 0.18, 'sine', 0.18, 0);
    this.synthTone(580, 340, 0.16, 'triangle', 0.16, 0.14);
    this.synthTone(440, 880, 0.22, 'sine', 0.15, 0.26);
  }

  synthCaptureImpact() {
    this.synthTone(160, 55, 0.16, 'sawtooth', 0.16, 0);
  }

  synthLightningZap() {
    this.synthTone(980, 140, 0.22, 'sawtooth', 0.18, 0);
    this.synthTone(1320, 220, 0.26, 'square', 0.12, 0.08);
    this.synthTone(523.25, 1046.5, 0.35, 'triangle', 0.15, 0.22);
  }

  synthGoldenThroneClash() {
    // Royal trumpet chord + comic plunger boing
    [523.25, 659.25, 783.99, 1046.5].forEach((f, idx) => {
      this.synthTone(f, f * 1.02, 0.35, 'triangle', 0.14, idx * 0.07);
    });
    this.synthTone(180, 620, 0.25, 'sine', 0.20, 0.32);
  }

  synthChocolateSplash() {
    [330, 440, 554.37, 659.25, 880].forEach((f, i) => {
      this.synthTone(f * 0.85, f * 1.15, 0.14, 'sine', 0.14, i * 0.055);
    });
  }

  synthCrystalShatter() {
    [1046.5, 1318.5, 1567.98, 2093.0, 1760.0].forEach((f, i) => {
      this.synthTone(f, f * 1.25, 0.18, 'sine', 0.13, i * 0.045);
    });
  }

  synthRaceCarVroom() {
    this.synthTone(110, 480, 0.32, 'sawtooth', 0.16, 0);
    this.synthTone(480, 190, 0.28, 'sawtooth', 0.14, 0.28);
  }

  synthPlushieSqueakBoom() {
    // High cute squeak followed by soft bass thump
    this.synthTone(780, 1280, 0.10, 'sine', 0.16, 0);
    this.synthTone(1280, 920, 0.09, 'sine', 0.15, 0.09);
    this.synthTone(140, 42, 0.32, 'triangle', 0.22, 0.20);
  }

  synthFishSlapPling() {
    this.synthTone(320, 960, 0.09, 'triangle', 0.18, 0);
    this.synthTone(960, 1480, 0.24, 'sine', 0.16, 0.07);
  }

  synthCuddleHarpArpeggio() {
    [523.25, 659.25, 783.99, 987.77, 1046.5, 1318.5].forEach((f, i) => {
      this.synthTone(f, f, 0.28, 'sine', 0.14, i * 0.065);
    });
  }

  synthSigilloAcquarioIce() {
    // Cosmic Aurora Freeze sweep + shimmering ice freeze + diamond coffin shatter chimes
    this.synthTone(440, 1760, 0.38, 'sine', 0.16, 0);
    [1318.5, 1567.98, 1975.5, 2637.0].forEach((f, i) => {
      this.synthTone(f, f * 1.15, 0.24, 'triangle', 0.14, 0.25 + i * 0.07);
    });
  }

  synthCheckAlarm() {
    this.synthTone(587.33, 440, 0.18, 'sawtooth', 0.16, 0);
    this.synthTone(587.33, 440, 0.22, 'sawtooth', 0.16, 0.20);
  }

  synthCheckmateFanfare() {
    const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
    const delays = [0, 0.12, 0.24, 0.36, 0.54, 0.68];
    notes.forEach((f, i) => {
      this.synthTone(f, f, i === notes.length - 1 ? 0.55 : 0.16, 'triangle', 0.18, delays[i]);
    });
  }

  synthGoldenCritChime() {
    [587.33, 783.99, 987.77, 1174.66, 1567.98].forEach((f, i) => {
      this.synthTone(f, f * 1.05, 0.24, 'triangle', 0.15, i * 0.05);
    });
  }

  synthHintSparkle() {
    [659.25, 880, 1318.5].forEach((f, i) => {
      this.synthTone(f, f * 1.1, 0.16, 'sine', 0.13, i * 0.06);
    });
  }

  // ===========================================================================
  // 1B. CREATURE HOVER SFX & SPOKEN CHARACTER VOICE LINES
  // ===========================================================================

  /**
   * Plays hover SFX with anti-spam protection so sweeping the cursor across a row of 8 Puffin pawns
   * doesn't blast 10 consecutive high-pitched chirps:
   * - Always records `hover_${pType}` in `this.playedSfx` for deterministic headless unit tests.
   * - In browser runtime, enforces a per-type cooldown (`2400ms` for pawns `'p'`, `900ms` for others)
   *   and alternates with a soft, low-volume `"hmm / sbuffo"` micro-breath (`synthSoftSbuffo`).
   * @param {string} pType
   */
  playHoverSfxWithAntiSpam(pType = 'p') {
    const now = typeof Date !== 'undefined' ? Date.now() : 0;
    const lastMs = this.lastHoverTimeByType.get(pType) || 0;
    const minCooldownMs = pType === 'p' ? 2400 : 900;
    const isRapidRepeat = typeof window !== 'undefined' && lastMs > 0 && now - lastMs < minCooldownMs;
    this.lastHoverTimeByType.set(pType, now);
    this.hoverStepCounter++;

    const recipe = this.hoverSynthTable[pType] || this.hoverSynthTable.p;
    if (isRapidRepeat) {
      // Record event for telemetry/tests but play only a barely-audible micro-rustle (or silence)
      this.playedSfx.push(`hover_${pType}`);
      if (this.playedSfx.length > 100) this.playedSfx.shift();
      return;
    }

    // With higher probability (especially on pawns), play a soft natural "hmm-hmm / sbuffo" breath
    const useSoftSbuffo = pType === 'p' ? this.hoverStepCounter % 3 !== 1 : this.hoverStepCounter % 2 === 0;
    this.playSfx(`hover_${pType}`, () => {
      if (useSoftSbuffo) {
        this.synthSoftSbuffo(pType);
      } else {
        recipe();
      }
    });
  }

  synthSoftSbuffo(pType = 'p') {
    // Gentle, low-volume "hmm-hmm" or "pff" breath so hover feels alive without shrill repetition
    const baseHz = pType === 'q' ? 310 : pType === 'n' ? 240 : pType === 'b' ? 280 : pType === 'p' ? 420 : 210;
    const detune = 0.94 + Math.random() * 0.12;
    this.synthTone(baseHz * detune, baseHz * detune * 0.82, 0.09, 'sine', 0.055, 0);
    this.synthTone(baseHz * detune * 0.88, baseHz * detune * 0.72, 0.11, 'triangle', 0.045, 0.08);
  }

  synthHorseSnort() {
    // Horse snort ("prrr-snort!") + double hoof tap
    this.synthTone(155, 82, 0.11, 'sawtooth', 0.10, 0);
    this.synthTone(135, 68, 0.10, 'sawtooth', 0.09, 0.08);
    this.synthTone(260, 110, 0.05, 'triangle', 0.11, 0.19);
    this.synthTone(290, 120, 0.05, 'triangle', 0.11, 0.27);
  }

  synthDragonWhistle() {
    // Magical dragon whistle ("fiuuu!") + wing flutter
    this.synthTone(580, 1360, 0.16, 'sine', 0.10, 0);
    this.synthTone(1360, 920, 0.14, 'sine', 0.09, 0.14);
    this.synthTone(240, 160, 0.07, 'triangle', 0.08, 0.22);
  }

  synthPuffinPeep() {
    // Gentle, lower-pitched puffin murmur ("mmh-piu!") — no longer shrill
    const detune = 0.92 + Math.random() * 0.14;
    this.synthTone(620 * detune, 880 * detune, 0.07, 'sine', 0.065, 0);
    this.synthTone(740 * detune, 640 * detune, 0.08, 'sine', 0.055, 0.09);
  }

  synthPlushBoing() {
    // Squishy plush monster bounce ("boing-purr!")
    this.synthTone(220, 520, 0.14, 'sine', 0.12, 0);
    this.synthTone(520, 340, 0.12, 'triangle', 0.10, 0.12);
  }

  synthQueenChime() {
    // Elegant sarcastic British crystal chime
    this.synthTone(783.99, 1174.66, 0.15, 'triangle', 0.10, 0);
    this.synthTone(1046.5, 987.77, 0.18, 'sine', 0.09, 0.11);
  }

  synthKingSceptreHum() {
    // Warm royal golden sceptre hum
    this.synthTone(261.63, 392.0, 0.16, 'triangle', 0.11, 0);
    this.synthTone(523.25, 659.25, 0.18, 'sine', 0.10, 0.10);
  }

  /**
   * Smart Anti-Repetition Voice Variant Selector:
   * 1. On the very first selection of `type` (`playCount === 0`), returns `variants[0]` (the canonical
   *    signature line) for deterministic onboarding and unit-test compatibility.
   * 2. On subsequent selections (`playCount >= 1`):
   *    - Excludes recently played variant IDs (`this.recentVariantIdsByType`) so the same clip NEVER plays back-to-back.
   *    - Gives higher probability (`~55%`) to non-verbal vocalizations (`kind === 'mumble'`, e.g. `"Hmm-hmm..."`,
   *      `"Pff... uffaaa!"`, `"Pff... oh, honestly!"`), especially right after a full spoken sentence.
   *    - Uses a shuffled deck (`this.signatureDeckByType`) for `kind === 'signature'` lines so every signature
   *      quote is heard before any signature quote repeats!
   * @param {string} pieceType
   * @param {{ rng?: () => number, forceKind?: 'signature'|'mumble' }} [opts]
   * @returns {object}
   */
  selectVoiceVariant(pieceType = 'p', opts = {}) {
    const type = String(pieceType || 'p').toLowerCase();
    const spec = VOICE_LINES[type] || VOICE_LINES.p;
    const variants = Array.isArray(spec.variants) && spec.variants.length > 0
      ? spec.variants
      : [{ id: `${type}_default`, kind: 'signature', weight: 1.0, audioUrl: spec.audioUrl, quote: spec.quote }];

    const rng = typeof opts.rng === 'function' ? opts.rng : Math.random;
    const playCount = this.voicePlayCountByType.get(type) || 0;
    this.voicePlayCountByType.set(type, playCount + 1);

    const recentIds = this.recentVariantIdsByType.get(type) || [];
    const maxRecent = Math.max(1, Math.min(2, variants.length - 1));

    const recordChoice = (chosen) => {
      recentIds.push(chosen.id);
      while (recentIds.length > maxRecent) {
        recentIds.shift();
      }
      this.recentVariantIdsByType.set(type, recentIds);
      this.lastKindByType.set(type, chosen.kind || 'signature');
      return chosen;
    };

    // First play of this character: play canonical primary signature line (unless forceKind specified)
    if (playCount === 0 && !opts.forceKind) {
      return recordChoice(variants[0]);
    }

    const mumbles = variants.filter((v) => v.kind === 'mumble');
    const signatures = variants.filter((v) => v.kind !== 'mumble');
    const lastKind = this.lastKindByType.get(type);

    // Determine whether to pick a mumble (hmm-hmm / sbuffo) or a signature sentence
    let targetKind = opts.forceKind || null;
    if (!targetKind) {
      if (mumbles.length > 0 && signatures.length > 0) {
        // Higher probability for mumble/sbuffo (~58% overall, or 68% right after a spoken signature sentence,
        // and 78% for Puffin pawns so pawns mostly sigh/murmur softly)
        const mumbleProb = type === 'p' ? 0.78 : lastKind === 'signature' ? 0.65 : 0.45;
        targetKind = rng() < mumbleProb ? 'mumble' : 'signature';
      } else if (mumbles.length > 0) {
        targetKind = 'mumble';
      } else {
        targetKind = 'signature';
      }
    }

    const lastId = recentIds.length > 0 ? recentIds[recentIds.length - 1] : null;

    if (targetKind === 'mumble' && mumbles.length > 0) {
      const freshMumbles = mumbles.filter((v) => !recentIds.includes(v.id));
      if (freshMumbles.length > 0) {
        const totalWeight = freshMumbles.reduce((acc, v) => acc + (Number(v.weight) || 1), 0);
        let roll = rng() * totalWeight;
        for (const item of freshMumbles) {
          roll -= Number(item.weight) || 1;
          if (roll <= 0) return recordChoice(item);
        }
        return recordChoice(freshMumbles[freshMumbles.length - 1]);
      }
      // All mumbles were played very recently: switch to a fresh signature line so we never repeat a mumble!
      targetKind = 'signature';
    }

    // Signature shuffle-bag: cycle through all signature sentences without repeating any until all have been heard
    let deck = this.signatureDeckByType.get(type) || [];
    deck = deck.filter((v) => !recentIds.includes(v.id) && v.id !== lastId);
    if (deck.length === 0) {
      const freshSigs = signatures.filter((v) => !recentIds.includes(v.id) && v.id !== lastId);
      const nonLastSigs = signatures.filter((v) => v.id !== lastId);
      const source = freshSigs.length > 0
        ? [...freshSigs]
        : nonLastSigs.length > 0
          ? [...nonLastSigs]
          : [...signatures];
      // Fisher-Yates shuffle
      for (let i = source.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [source[i], source[j]] = [source[j], source[i]];
      }
      deck = source;
    }
    let chosenSig = deck.shift() || signatures[0] || variants[0];
    this.signatureDeckByType.set(type, deck);
    if (chosenSig.id === lastId && variants.length > 1) {
      chosenSig = variants.find((v) => v.id !== lastId) || chosenSig;
    }
    return recordChoice(chosenSig);
  }

  /**
   * Plays a randomized character voice line or non-verbal vocalization (`hmm-hmm` / `sbuffo`)
   * from `VOICE_LINES[type].variants` (generated via Gemini 3.8 Flash TTS), falling back to
   * `window.speechSynthesis` if needed, and emits `VOICE_LINE_SPOKEN` on the bus.
   * @param {string} pieceType - `'k' | 'q' | 'b' | 'n' | 'r' | 'p'`
   * @param {string|null} [square]
   * @param {object} [opts]
   */
  playCharacterVoiceLine(pieceType = 'p', square = null, opts = {}) {
    const type = String(pieceType || 'p').toLowerCase();
    const spec = VOICE_LINES[type] || VOICE_LINES.p;
    const variant = this.selectVoiceVariant(type, opts);
    const quoteText = variant.quote?.[this.lang] || variant.quote?.it || spec.quote?.[this.lang] || spec.quote?.it || '';
    const audioUrl = variant.audioUrl || spec.audioUrl;
    const speechLang =
      variant.speechLang ||
      (this.lang === 'en'
        ? (type === 'q' ? 'en-GB' : 'en-US')
        : (spec.speechLang || 'it-IT'));

    const voiceRecord = {
      pieceType: type,
      square,
      name: spec.name,
      variantId: variant.id,
      kind: variant.kind || 'signature',
      quote: quoteText,
      audioUrl,
      speechLang,
    };
    this.playedVoices.push(voiceRecord);
    if (this.playedVoices.length > 50) this.playedVoices.shift();
    this.playedSfx.push(`voice_${type}`);
    if (this.playedSfx.length > 100) this.playedSfx.shift();

    this.ctx?.bus?.emit?.({
      ...voiceRecord,
      type: 'VOICE_LINE_SPOKEN',
    });

    if (!this.sfxEnabled) return voiceRecord;

    if (typeof Audio !== 'undefined' && audioUrl) {
      try {
        if (this.voiceEl) {
          try {
            this.voiceEl.pause();
            this.voiceEl.currentTime = 0;
          } catch {}
        }
        let audio = this.voiceAudioCache.get(audioUrl);
        if (!audio) {
          audio = new Audio(audioUrl);
          audio.preload = 'auto';
          this.voiceAudioCache.set(audioUrl, audio);
        }
        audio.currentTime = 0;
        audio.volume = variant.kind === 'mumble' ? 0.82 : 0.94;
        this.voiceEl = audio;
        const playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => {
            this._speakFallbackUtterance({ ...spec, speechLang }, quoteText);
          });
        }
        return voiceRecord;
      } catch {
        this._speakFallbackUtterance({ ...spec, speechLang }, quoteText);
      }
    } else {
      this._speakFallbackUtterance({ ...spec, speechLang }, quoteText);
    }
    return voiceRecord;
  }

  _speakFallbackUtterance(spec, quoteText) {
    if (
      typeof window === 'undefined' ||
      !window.speechSynthesis ||
      typeof window.SpeechSynthesisUtterance !== 'function'
    ) {
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const u = new window.SpeechSynthesisUtterance(quoteText);
      u.lang = spec.speechLang || (this.lang === 'en' ? 'en-US' : 'it-IT');
      u.pitch = spec.pitch ?? 1.0;
      u.rate = spec.rate ?? 1.0;
      window.speechSynthesis.speak(u);
    } catch {}
  }

  // ===========================================================================
  // 2. BILINGUAL LYRIA 3 THEME SONG PLAYER + KARAOKE CAPTIONS
  // ===========================================================================

  toggleThemeSong() {
    if (this.musicPlaying) {
      this.stopThemeSong();
    } else {
      this.startThemeSong();
    }
    return this.musicPlaying;
  }

  startThemeSong() {
    this.stopThemeSong();
    this.musicPlaying = true;
    this.melodyStep = 0;
    this.lyricStep = 0;
    this.themeAudioFailed = false;

    // Play the warm, non-fatiguing 30s Lyria 3 Chamber Strings Background Loop (`assets/audio/chess-strings-bg.mp3`)
    // cycling cleanly with the Baroque String Overture (`assets/audio/chess-strings-theme.mp3`).
    // Never plays 80s arcade chiptune oscillator loops in the browser unless the MP3 files fail to load.
    if (typeof Audio !== 'undefined') {
      try {
        const trackUrl =
          CHESS_STRINGS_TRACKS[this.themeTrackIndex % CHESS_STRINGS_TRACKS.length] ||
          CHESS_STRINGS_THEME_URL;
        const audio = new Audio(trackUrl);
        audio.preload = 'auto';
        audio.loop = true;
        audio.volume = this.combatMusicActive ? 0.06 : NORMAL_MUSIC_VOLUME;
        audio.onerror = () => {
          this.themeAudioFailed = true;
        };
        this.audioEl = audio;
        const p = audio.play();
        if (p && typeof p.catch === 'function') {
          p.catch(() => {
            // Autoplay blocked until next gesture; keep audioEl ready without falling back to 8-bit bleeps
          });
        }
      } catch {
        this.audioEl = null;
        this.themeAudioFailed = true;
      }
    } else {
      this.themeAudioFailed = true;
    }

    this._emitNextLyricCaption();
    this.loopTimer = setInterval(() => {
      if (!this.musicPlaying || this.combatMusicActive) return;
      // Only run the procedural fallback in headless Node tests or if the MP3 file genuinely errored
      if (this.themeAudioFailed) {
        const idx = this.melodyStep % BAROQUE_VIOLIN_MELODY_HZ.length;
        const vFreq = BAROQUE_VIOLIN_MELODY_HZ[idx];
        const cFreq = BAROQUE_CELLO_STACCATO_HZ[idx];
        this.synthTone(cFreq, cFreq * 0.998, 0.13, 'triangle', 0.055, 0);
        this.synthTone(vFreq, vFreq * 1.002, 0.21, 'sine', 0.05, 0.015);
      }
      this.melodyStep++;
      if (this.melodyStep % 8 === 0) {
        this._emitNextLyricCaption();
      }
    }, 234);
    this.loopTimer.unref?.();
  }

  restartThemeForLanguage() {
    if (!this.musicPlaying) return;
    this.startThemeSong();
  }

  _emitNextLyricCaption() {
    const lines = THEME_LYRICS[this.lang] || THEME_LYRICS.it;
    const text = lines[this.lyricStep % lines.length];
    this.lyricStep++;
    this.ctx?.bus?.emit({
      type: 'LYRIA_CAPTION',
      lang: this.lang,
      text,
    });
    this.ctx?.bus?.flush?.();
  }

  stopThemeSong() {
    this.musicPlaying = false;
    if (this.loopTimer) {
      clearInterval(this.loopTimer);
      this.loopTimer = null;
    }
    if (this.audioEl) {
      try {
        this.audioEl.pause();
      } catch {}
      this.audioEl = null;
    }
    this.ctx?.bus?.emit({ type: 'LYRIA_CAPTION', lang: this.lang, text: '' });
    this.ctx?.bus?.flush?.();
  }

  /**
   * Switches the active theme music track to another track in `CHESS_STRINGS_TRACKS`.
   * @param {string|number} trackUrlOrIndex
   */
  switchThemeTrack(trackUrlOrIndex) {
    if (typeof trackUrlOrIndex === 'number') {
      this.themeTrackIndex = trackUrlOrIndex;
    } else if (typeof trackUrlOrIndex === 'string') {
      const idx = CHESS_STRINGS_TRACKS.indexOf(trackUrlOrIndex);
      this.themeTrackIndex = idx >= 0 ? idx : 0;
    }
    const targetUrl =
      CHESS_STRINGS_TRACKS[this.themeTrackIndex % CHESS_STRINGS_TRACKS.length] ||
      CHESS_STRINGS_THEME_URL;

    if (this.musicPlaying && typeof Audio !== 'undefined') {
      try {
        if (!this.audioEl) {
          this.audioEl = new Audio(targetUrl);
          this.audioEl.preload = 'auto';
          this.audioEl.loop = true;
        } else if (!this.audioEl.src.includes(targetUrl)) {
          this.audioEl.src = targetUrl;
          this.audioEl.currentTime = 0;
        }
        this.audioEl.volume = this.combatMusicActive ? 0.06 : NORMAL_MUSIC_VOLUME;
        this.audioEl.play().catch(() => {});
      } catch {}
    }
  }

  /**
   * Plays the warm chamber strings fortress loop (`chess-strings-bg.mp3`) when castling (arrocco),
   * putting track 1 to good use ("per non buttarla via") so the king enjoys royal chamber peace.
   */
  playCastlingTheme() {
    this.playedSfx.push('castling_theme');
    if (this.playedSfx.length > 100) this.playedSfx.shift();

    if (this.musicPlaying) {
      this.switchThemeTrack(CHESS_STRINGS_BG_URL);
    } else if (this.sfxEnabled && typeof Audio !== 'undefined') {
      try {
        if (!this.castlingAudioEl) {
          this.castlingAudioEl = new Audio(CHESS_STRINGS_BG_URL);
          this.castlingAudioEl.preload = 'auto';
        }
        this.castlingAudioEl.currentTime = 0;
        this.castlingAudioEl.volume = 0.52;
        this.castlingAudioEl.play().catch(() => {});
      } catch {}
    }
  }

  /**
   * Plays the hilarious checkmate jingle (`assets/audio/checkmate-jingle.mp3`) with deep baritone
   * "BUAHAHAHAHAH!" villain laughter, defeated "Ooh no!", and comic "Scacco Matto, Checkmate!" chorus.
   * @param {object} [e]
   */
  playCheckmateJingle(e = null) {
    this.playedSfx.push('checkmate_jingle');
    if (this.playedSfx.length > 100) this.playedSfx.shift();

    // Duck background music while comic victory jingle plays
    if (this.audioEl && this.musicPlaying) {
      try {
        this.audioEl.volume = 0.05;
      } catch {}
    }

    this.ctx?.bus?.emit?.({
      type: 'LYRIA_CAPTION',
      lang: this.lang,
      text: '😂 BUAHAHAHAHAH! ... "Ooh no!" 🏆 SCACCO MATTO / CHECKMATE!',
    });
    this.ctx?.bus?.flush?.();

    if (typeof Audio !== 'undefined') {
      try {
        if (!this.checkmateAudioEl) {
          this.checkmateAudioEl = new Audio(CHECKMATE_AUDIO_URL);
          this.checkmateAudioEl.preload = 'auto';
          this.checkmateAudioEl.onended = () => {
            if (this.audioEl && this.musicPlaying && !this.combatMusicActive) {
              try {
                this.audioEl.volume = NORMAL_MUSIC_VOLUME;
              } catch {}
            }
          };
        }
        this.checkmateAudioEl.currentTime = 0;
        this.checkmateAudioEl.volume = 0.88;
        const p = this.checkmateAudioEl.play();
        if (p && typeof p.catch === 'function') {
          p.catch(() => {});
        }
      } catch {}
    }
  }

  stopCheckmateJingle() {
    if (this.checkmateAudioEl) {
      try {
        this.checkmateAudioEl.pause();
        this.checkmateAudioEl.currentTime = 0;
      } catch {}
    }
    if (this.audioEl && this.musicPlaying && !this.combatMusicActive) {
      try {
        this.audioEl.volume = NORMAL_MUSIC_VOLUME;
      } catch {}
    }
  }

  // ===========================================================================
  // 3. FIERY, FAST-PACED, SUSPENSEFUL COMBAT SOUNDTRACK (LYRIA 3 MP3)
  // ===========================================================================

  /**
   * Starts the fiery, fast-paced, suspenseful combat soundtrack on `BATTLE_STARTED`:
   * Plays the Lyria 3 orchestral battle track (`assets/audio/combat-suspense.mp3`)
   * cycling across 4 dramatic cue points (`0.0s, 7.6s, 15.2s, 22.0s`), with zero 80s
   * arcade oscillator bleeps overlaid when the MP3 is available.
   * @param {object} [battleEvent]
   */
  startCombatMusic(battleEvent = null) {
    this._clearCombatTimers();
    this.combatMusicActive = true;
    this.combatFadingOut = false;
    this.combatEnvelope = 1.0;
    this.combatStep = 0;
    this.combatAudioFailed = false;

    this.playedSfx.push('combat_music_started');
    if (this.playedSfx.length > 100) this.playedSfx.shift();

    if (!this.sfxEnabled && !this.musicPlaying) return;

    // Duck background strings loop if playing
    if (this.audioEl) {
      try {
        this.audioEl.volume = 0.06;
      } catch {}
    }

    // 1. Start Lyria 3 Fiery Combat MP3 (`assets/audio/combat-suspense.mp3`)
    if (typeof Audio !== 'undefined') {
      try {
        if (!this.combatAudioEl) {
          this.combatAudioEl = new Audio(COMBAT_AUDIO_URL);
          this.combatAudioEl.preload = 'auto';
          this.combatAudioEl.onerror = () => {
            this.combatAudioFailed = true;
          };
        }
        // NEVER loop combat music during a 10s battle — each cue point (0.0s, 8.0s, 15.5s) has >= 14.0s
        // of continuous non-repeating orchestral music before the 30.77s track ends!
        this.combatAudioEl.loop = false;
        const cueS = COMBAT_CUE_POINTS_S[this.combatCueIndex % COMBAT_CUE_POINTS_S.length];
        this.combatCueIndex++;
        try {
          this.combatAudioEl.currentTime = cueS;
        } catch {}
        // Combat volume is strictly +15% above normal background music (0.276 vs 0.24), never 100%+!
        this.combatAudioEl.volume = COMBAT_MUSIC_PEAK_VOLUME;
        const p = this.combatAudioEl.play();
        if (p && typeof p.catch === 'function') {
          p.catch(() => {});
        }
      } catch {
        this.combatAudioFailed = true;
      }
    } else {
      this.combatAudioFailed = true;
    }

    // 2. Soft low-end cinema sub-bass thud on combat entry (`t = 0.0s`, no harsh sawtooth buzzers)
    this.synthCombatEntryBraaam();

    // 3. Fallback sequencer (only runs in headless tests or if combat-suspense.mp3 fails to load)
    this.combatTimer = setInterval(() => {
      if (!this.combatMusicActive) return;
      this._stepCombatSequencer(battleEvent);
    }, 98);
    this.combatTimer.unref?.();
  }

  /**
   * Warm cinema sub-bass "TU-DUM" pulse (pure sine/triangle, zero harsh sawtooth oscillators).
   */
  synthCombatEntryBraaam() {
    const ac = this.ensureAudioContext();
    if (!ac) return;
    this.synthTone(73.42, 48.0, 0.16, 'triangle', 0.06, 0.0);
    this.synthTone(146.83, 55.0, 0.24, 'sine', 0.07, 0.13);
  }

  /**
   * Fallback combat sequencer — completely bypassed in browser when `combat-suspense.mp3` is loaded
   * so no 1980s pixel arcade oscillator bleeps ever play over the orchestral soundtrack.
   * Through-composed across 102 steps (`10.0s`) and stops cleanly at `s > 102` with zero looping.
   */
  _stepCombatSequencer() {
    if (!this.sfxEnabled && !this.musicPlaying) return;
    if (typeof Audio !== 'undefined' && !this.combatAudioFailed) return;
    const ac = this.ensureAudioContext();
    if (!ac) return;

    const env = Math.max(0, Math.min(1, this.combatEnvelope));
    if (env <= 0.01) return;

    // Gentle +15% gain calibration for fallback procedural voices
    const mix = env * 0.22;

    const s = this.combatStep++;
    // Never repeat/loop after the 10-second battle window (`102 * 98ms ≈ 10.0s`)
    if (s > 102) return;
    const step16 = s % 16;
    const barIndex = Math.floor(s / 16);
    const isAct2Brawl = s >= 10 && s < 78 && !this.combatFadingOut;
    const isAct3Climax = s >= 78 && s <= 102 && !this.combatFadingOut;

    // A. Evolving 16th-note D-Minor Phrygian Ostinato (transposes across bars so it never repeats a short loop)
    const barTranspose = [1.0, 1.05946, 1.12246, 1.18921, 1.25992, 1.33484, 1.49831][barIndex % 7];
    const ostFreq = COMBAT_OSTINATO_HZ[step16] * barTranspose;
    const accent = step16 % 4 === 0 ? 1.25 : step16 % 2 === 0 ? 1.05 : 0.85;
    this.synthTone(
      ostFreq,
      ostFreq * 1.004,
      0.085,
      isAct2Brawl || isAct3Climax ? 'sawtooth' : 'triangle',
      0.075 * accent * mix,
      0,
    );

    // Sub-bass octave lock on every 8th note (`D2 / A1 / Bb1`)
    if (step16 % 2 === 0) {
      this.synthTone(ostFreq * 0.5, ostFreq * 0.5, 0.11, 'sine', 0.095 * mix, 0);
    }

    // B. Thunderous Taiko War Drums & Syncopated Off-Beat Percussion
    if (step16 === 0 || step16 === 6 || step16 === 8 || step16 === 12 || (isAct2Brawl && step16 % 2 === 1)) {
      const isHeavyDownbeat = step16 === 0 || step16 === 8;
      this.synthTone(
        isHeavyDownbeat ? 125 : 95,
        isHeavyDownbeat ? 36 : 44,
        isHeavyDownbeat ? 0.14 : 0.09,
        'triangle',
        (isHeavyDownbeat ? 0.16 : 0.10) * mix,
        0,
      );
    }

    // Metallic sword/halberd rim-shot pulse on off-beats (`step16 === 4, 12` or rapid snare build in Act 2/3)
    if (step16 === 4 || step16 === 12 || (isAct2Brawl && step16 === 14) || (isAct3Climax && step16 % 2 === 0)) {
      this.synthTone(920, 260, 0.055, 'sawtooth', 0.065 * mix, 0);
      this.synthTone(1680, 640, 0.04, 'square', 0.04 * mix, 0.01);
    }

    // C. Suspenseful Continuous Rising Phrygian Brass & Tremolo Lead across the full 10s duel
    if (isAct2Brawl && step16 % 2 === 0) {
      const leadProgress = Math.min(1, Math.max(0, (s - 10) / 68));
      const leadIdx = Math.min(
        COMBAT_SUSPENSE_LEAD_HZ.length - 1,
        Math.floor(leadProgress * COMBAT_SUSPENSE_LEAD_HZ.length),
      );
      const leadFreq = COMBAT_SUSPENSE_LEAD_HZ[leadIdx] * (1 + leadProgress * 0.12);
      this.synthTone(leadFreq, leadFreq * 1.01, 0.13, 'sawtooth', 0.068 * mix, 0);
      // Minor-second / tritone suspense harmony on every bar boundary
      if (step16 === 0 || step16 === 8) {
        this.synthTone(leadFreq * 1.05946, leadFreq * 1.05946, 0.16, 'triangle', 0.05 * mix, 0.02);
      }
    }

    // D. Act 3 K.O. Climax Chord Hit (`s === 80`, ~7.8s into the 10s duel when victim is launched into the swamp!)
    if (s === 80 && !this.combatFadingOut) {
      [293.66, 349.23, 440.0, 587.33, 698.46, 880.0].forEach((f, idx) => {
        this.synthTone(f, f * 1.015, 0.45, 'sawtooth', 0.08 * mix, idx * 0.03);
      });
    }
  }

  _getExitWindowMs(immediate = false) {
    if (immediate) return 450;
    if (typeof window !== 'undefined' && window.location?.search) {
      const q = new URLSearchParams(window.location.search).get('transitionSeconds');
      if (q !== null && Number.isFinite(Number(q))) {
        return Math.max(500, Math.min(8000, Number(q) * 1000));
      }
    }
    return 3500;
  }

  /**
   * Smoothly fades out the fiery combat music over the `3.5s` sliding window (`immediate = false`)
   * when the duel finishes (`BATTLE_COMPLETED`) or over `2.5s` when forced via Space/Click (`BATTLE_SKIPPED`),
   * or stops immediately in headless unit tests / `BOARD_RESET`.
   * @param {boolean} [immediate=false]
   * @param {number|null} [customDurationMs=null]
   */
  stopCombatMusic(immediate = false, customDurationMs = null) {
    if (!this.combatMusicActive && !this.combatFadingOut) return;

    this.playedSfx.push('combat_music_stopped');
    if (this.playedSfx.length > 100) this.playedSfx.shift();

    // In headless Node tests (no `window`), clean up synchronously so test runners exit immediately
    if (immediate || typeof window === 'undefined') {
      this._haltCombatMusicNow();
      return;
    }

    this.combatFadingOut = true;
    if (this.combatFadeTimer) {
      clearInterval(this.combatFadeTimer);
      this.combatFadeTimer = null;
    }

    const fadeDurationMs = Number.isFinite(customDurationMs) ? customDurationMs : this._getExitWindowMs(false);
    const tickMs = 80;
    const totalTicks = Math.max(1, Math.round(fadeDurationMs / tickMs));
    let tick = 0;

    this.combatFadeTimer = setInterval(() => {
      tick++;
      const progress = Math.min(1, tick / totalTicks);
      // Smoothstep fade curve matching VFXPoolView's 3.5s visual sliding window
      const smooth = progress * progress * (3 - 2 * progress);
      this.combatEnvelope = Math.max(0, 1.0 - smooth);

      if (this.combatAudioEl) {
        try {
          this.combatAudioEl.volume = Math.max(0, COMBAT_MUSIC_PEAK_VOLUME * this.combatEnvelope);
        } catch {}
      }
      if (this.audioEl && this.musicPlaying) {
        try {
          this.audioEl.volume = 0.06 + (NORMAL_MUSIC_VOLUME - 0.06) * (1.0 - this.combatEnvelope);
        } catch {}
      }

      if (progress >= 1.0) {
        this._haltCombatMusicNow();
      }
    }, tickMs);
    this.combatFadeTimer.unref?.();
  }

  _clearCombatTimers() {
    if (this.combatTimer) {
      clearInterval(this.combatTimer);
      this.combatTimer = null;
    }
    if (this.combatFadeTimer) {
      clearInterval(this.combatFadeTimer);
      this.combatFadeTimer = null;
    }
  }

  _haltCombatMusicNow() {
    this._clearCombatTimers();
    this.combatMusicActive = false;
    this.combatFadingOut = false;
    this.combatEnvelope = 0.0;
    if (this.combatAudioEl) {
      try {
        this.combatAudioEl.pause();
      } catch {}
    }
    if (this.audioEl && this.musicPlaying) {
      try {
        this.audioEl.volume = NORMAL_MUSIC_VOLUME;
      } catch {}
    }
  }

  dispose() {
    this._haltCombatMusicNow();
    this.stopThemeSong();
    this.stopCheckmateJingle();
    if (this.castlingAudioEl) {
      try {
        this.castlingAudioEl.pause();
      } catch {}
      this.castlingAudioEl = null;
    }
    for (const off of this.offs) off();
    this.offs = [];
  }
}
