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

const THEME_LYRICS = Object.freeze({
  it: [
    '🐉 Ale col draghetto rosso vola in diagonale!',
    '🏎️ Seby sulla pista turbo salta a L spaziale!',
    '🐟 I Puffin Guardia Svizzera difendono il castello!',
    '💜 Pupurabbu super morbido fa un balzo colossale!',
    '🍫 Regina Kate lancia l’onda ciocco-lilla!',
    '🚽👑 Re Riccardo sul Trono d’Oro: Scacco Matto, brilla!',
  ],
  en: [
    '🐉 Bishop Ale and his fiery dragon glide across the board!',
    '🏎️ Knight Seby revs his orange loop-track turbo roar!',
    '🐟 Swiss-Guard Puffin Pawns stand ready with a fish-slap pling!',
    '💜 Fluffy Rook Pupurabbu gives a giant cuddle spring!',
    '🍫 Queen Kate swirls her magical lilac chocolate wave!',
    '🚽👑 King Riccardo on the Golden Throne — Checkmate to the brave!',
  ],
});

// Melodic adventure motif in C major / A minor (frequencies in Hz)
const ADVENTURE_MELODY_HZ = Object.freeze([
  523.25, 659.25, 783.99, 1046.5, 880.0, 783.99, 659.25, 587.33,
  659.25, 783.99, 880.0, 987.77, 1046.5, 783.99, 659.25, 523.25,
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
    this.loopTimer = null;
    this.melodyStep = 0;
    this.lyricStep = 0;
    /** @type {Array<string>} Log of triggered SFX for headless unit test verification */
    this.playedSfx = [];
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
      bus.on('MOVE_EXECUTED', (e) => {
        if (!e.captured && !e.isCastle) {
          this.playSfx('move_hop', () => this.synthStoneHop());
        }
      }),
      bus.on('CASTLING_EXECUTED', () => {
        this.playSfx('castling_boing', () => this.synthCastlingBoing());
      }),
      bus.on('PIECE_CAPTURED', (e) => {
        this.playSfx(`capture_${e.attacker}`, () => this.synthCaptureImpact());
      }),
      bus.on('BATTLE_STARTED', (e) => {
        const effectKey = e.effect || 'sceptre_lightning';
        const recipe = this.battleSynthTable[effectKey] || this.battleSynthTable.sceptre_lightning;
        this.playSfx(`battle_${effectKey}`, recipe);
      }),
      bus.on('CHECK_DETECTED', () => {
        this.playSfx('check_alarm', () => this.synthCheckAlarm());
      }),
      bus.on('CHECKMATE', () => {
        this.playSfx('checkmate_fanfare', () => this.synthCheckmateFanfare());
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

    // Attempt to play `assets/audio/theme-${lang}.mp3` if present, otherwise procedural loop
    if (typeof Audio !== 'undefined') {
      try {
        const audio = new Audio(`assets/audio/theme-${this.lang}.mp3`);
        audio.loop = true;
        audio.volume = 0.45;
        this.audioEl = audio;
        audio.play().catch(() => {
          this.audioEl = null;
        });
      } catch {
        this.audioEl = null;
      }
    }

    this._emitNextLyricCaption();
    this.loopTimer = setInterval(() => {
      if (!this.musicPlaying) return;
      if (!this.audioEl || this.audioEl.paused || this.audioEl.error) {
        const freq = ADVENTURE_MELODY_HZ[this.melodyStep % ADVENTURE_MELODY_HZ.length];
        this.synthTone(freq, freq, 0.24, 'triangle', 0.09, 0);
        if (this.melodyStep % 2 === 0) {
          this.synthTone(freq * 0.5, freq * 0.5, 0.28, 'sine', 0.07, 0);
        }
      }
      this.melodyStep++;
      if (this.melodyStep % 6 === 0) {
        this._emitNextLyricCaption();
      }
    }, 320);
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

  dispose() {
    this.stopThemeSong();
    for (const off of this.offs) off();
    this.offs = [];
  }
}
