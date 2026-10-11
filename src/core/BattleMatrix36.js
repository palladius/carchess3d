/**
 * @fileoverview Complete 36-Pair (`6x6`) Declarative Battle & Cinema Choreography Matrix (`BattleMatrix36.js`).
 *
 * Follows Niccolò Game Design Rule #7 (Data-Driven over if/else) and Rule #6 (Headless Core):
 * - Defines all 36 (`6 x 6`) combinations of `['k', 'q', 'b', 'n', 'r', 'p']` x `['k', 'q', 'b', 'n', 'r', 'p']`.
 * - Every single entry has bespoke bilingual `title`, `banner`, `attackerWeapon`,
 *   Act 2 `defenderCounter` (`move`, `it`, `en`, `sfxText`), `clashStyle`, `finisherReaction`,
 *   and dedicated 16:9 `.mp4` + `.webm` video paths (`assets/battles/videos/<atk>_x_<def>.mp4`).
 */

export const PIECE_KEYS_36 = Object.freeze(['k', 'q', 'b', 'n', 'r', 'p']);

export const PIECE_META_36 = Object.freeze({
  k: Object.freeze({
    type: 'k',
    role: 'king',
    glyph: '♔',
    name: 'Riccardo',
    label: { it: 'Re Riccardo', en: 'King Riccardo' },
    portrait: 'assets/characters/king-riccardo-1.jpg',
    defaultWeapon: 'sceptre',
    effect: 'sceptre_lightning',
    debrisType: 'golden_sparks',
    victimReaction: 'levitate_dissolve',
  }),
  q: Object.freeze({
    type: 'q',
    role: 'queen',
    glyph: '♕',
    name: 'Kate',
    label: { it: 'Regina Kate', en: 'Queen Kate' },
    portrait: 'assets/characters/queen-kate-4.jpg',
    defaultWeapon: 'choco_wand',
    effect: 'chocolate_wave',
    debrisType: 'choco_lilac_confetti',
    victimReaction: 'sweet_melt',
  }),
  b: Object.freeze({
    type: 'b',
    role: 'bishop',
    glyph: '♗',
    name: 'Ale',
    label: { it: 'Alfiere Ale', en: 'Bishop Ale' },
    portrait: 'assets/characters/bishop-ale-1.jpg',
    defaultWeapon: 'dragon_crystal',
    effect: 'crystal_shatter',
    debrisType: 'amethyst_ruby_shards',
    victimReaction: 'crystallize_shatter',
  }),
  n: Object.freeze({
    type: 'n',
    role: 'knight',
    glyph: '♘',
    name: 'Seby',
    label: { it: 'Cavaliere Seby', en: 'Knight Seby' },
    portrait: 'assets/characters/knight-seby-4.jpg',
    defaultWeapon: 'turbo_cars',
    effect: 'loop_track_cars',
    debrisType: 'diecast_toy_cars',
    victimReaction: 'bowled_flat_stars',
  }),
  r: Object.freeze({
    type: 'r',
    role: 'rook',
    glyph: '♖',
    name: 'Pupurabbu',
    label: { it: 'Torre Pupurabbu', en: 'Rook Pupurabbu' },
    portrait: 'assets/characters/rook-pupurabbu.jpg',
    defaultWeapon: 'plush_belly',
    effect: 'plush_ground_pound',
    debrisType: 'purple_poof_clouds',
    victimReaction: 'pancake_squash',
  }),
  p: Object.freeze({
    type: 'p',
    role: 'pawn',
    glyph: '♙',
    name: 'Puffin',
    label: { it: 'Pedone Puffin', en: 'Pawn Puffin' },
    portrait: 'assets/characters/pawn-puffin.jpg',
    defaultWeapon: 'halberd_fish',
    effect: 'halberd_fish_slap',
    debrisType: 'fish_and_feathers',
    victimReaction: 'spin_off_board',
  }),
});

/**
 * Bespoke per-pair definitions for all 36 (`6 x 6`) combinations.
 */
const RAW_PAIRS_36 = {
  // ===========================================================================
  // ROW 1: ATTACKER = k (Re Riccardo — Golden Sceptre / Toilet Throne)
  // ===========================================================================
  k_x_k: {
    title: {
      it: 'Re Riccardo vs Re Riccardo (D&D Disintegrate 10d6+40)',
      en: 'King Riccardo vs Mirror King (D&D Disintegrate 10d6+40)',
    },
    banner: {
      it: 'D&D DISINTEGRATE (10d6+40)! RAGGIO VERDE POLVERIZZA IL RE RIVALE! 🟢✨🎲',
      en: 'D&D DISINTEGRATE (10d6+40)! EMERALD RAY VAPORIZES THE RIVAL KING! 🟢✨🎲',
    },
    dndSpell: 'disintegrate',
    attackerWeapon: 'sceptre',
    defenderCounter: {
      move: 'sceptre_parry_zap',
      it: 'Il Re Nero incrocia lo Scettro ma il raggio verde Disintegrate lo avvolge!',
      en: 'Black King crosses his Sceptre before the green Disintegrate ray strikes!',
      sfxText: 'ZAP!',
    },
    clashStyle: 'sword_duel',
    finisherReaction: 'levitate_dissolve_swamp',
  },
  k_x_q: {
    title: {
      it: 'Re Riccardo vs Regina Kate (D&D Pietrificazione & Trono d’Oro)',
      en: 'King Riccardo vs Queen Kate (D&D Petrification & Golden Throne)',
    },
    banner: {
      it: "CARLESSO AL CESSO & D&D PIETRIFICAZIONE! STATUA SUL TRONO D'ORO! 🗿🚽👑",
      en: 'CARLESSO AL CESSO & D&D PETRIFICATION! STATUE ON THE GOLDEN THRONE! 🗿🚽👑',
    },
    dndSpell: 'flesh_to_stone_petrification',
    attackerWeapon: 'toilet_throne',
    defenderCounter: {
      move: 'lilac_choco_shield',
      it: 'Regina Kate alza uno scudo di cioccolato lilla prima della Pietrificazione!',
      en: 'Queen Kate spins a glossy lilac chocolate shield against Petrification!',
      sfxText: 'SCUDO!',
    },
    clashStyle: 'royal_throne',
    finisherReaction: 'royal_throne_whirl_swamp',
    effect: 'golden_toilet_throne',
    debrisType: 'golden_sparks',
    victimReaction: 'royal_throne_whirl',
    easterEgg: 'carlesso_al_cesso_throne',
  },
  k_x_b: {
    title: {
      it: 'Re Riccardo vs Alfiere Ale (D&D Meteor Swarm 9° Livello)',
      en: 'King Riccardo vs Bishop Ale (D&D Meteor Swarm Lvl 9)',
    },
    banner: {
      it: 'D&D METEOR SWARM (9° LIV)! PIOGGIA DI METEORE SU ALE & DRAGO! ☄️🌋🎲',
      en: 'D&D METEOR SWARM (LVL 9)! BLAZING METEORS RAIN ON ALE & DRAGON! ☄️🌋🎲',
    },
    dndSpell: 'meteor_swarm',
    attackerWeapon: 'sceptre',
    defenderCounter: {
      move: 'dragon_flame_puff',
      it: 'Il draghetto di Ale soffia fuoco contro la pioggia di Meteore D&D!',
      en: "Ale's shoulder dragon puffs fire against the D&D Meteor Swarm!",
      sfxText: 'FIAMMA!',
    },
    clashStyle: 'sceptre_vs_dragon',
    finisherReaction: 'thunder_launch_swamp',
  },
  k_x_n: {
    title: {
      it: 'Re Riccardo vs Cavaliere Seby (D&D Chain Lightning)',
      en: 'King Riccardo vs Knight Seby (D&D Chain Lightning)',
    },
    banner: {
      it: 'D&D CHAIN LIGHTNING! CATENA DI FULMINI REALE SU SEBY TURBO! ⚡⛓️🎲',
      en: 'D&D CHAIN LIGHTNING! ARCING ROYAL BOLTS STRIKE TURBO SEBY! ⚡⛓️🎲',
    },
    dndSpell: 'chain_lightning',
    attackerWeapon: 'sceptre',
    defenderCounter: {
      move: 'warhorse_wheelie_kick',
      it: 'Seby impenna il destriero mentre la Catena di Fulmini rimbalza sulle macchinine!',
      en: 'Seby pops a warhorse wheelie as Chain Lightning arcs across his race cars!',
      sfxText: 'IMPENNATA!',
    },
    clashStyle: 'sceptre_vs_horse',
    finisherReaction: 'turbo_spin_swamp',
  },
  k_x_r: {
    title: {
      it: 'Re Riccardo vs Torre Pupurabbu (D&D Summon Comic Daemon)',
      en: 'King Riccardo vs Rook Pupurabbu (D&D Summon Comic Daemon)',
    },
    banner: {
      it: 'D&D SUMMON DAEMON! DEMONE BUFFO CON PIZZA CONTRO PUPURABBU! 😈🍕🎲',
      en: 'D&D SUMMON COMIC DAEMON! CHUBBY PIZZA DEMON VS PUPURABBU! 😈🍕🎲',
    },
    dndSpell: 'summon_comic_daemon',
    attackerWeapon: 'sceptre',
    defenderCounter: {
      move: 'plush_belly_bounce',
      it: 'Pupurabbu gonfia la pancia e fa a panciate col Demone Buffo D&D!',
      en: 'Pupurabbu puffs up his belly to belly-bump the Chubby D&D Demon!',
      sfxText: 'BOING!',
    },
    clashStyle: 'plush_bounce',
    finisherReaction: 'plush_float_swamp',
  },
  k_x_p: {
    title: {
      it: 'Re Riccardo vs Pedone Puffin (D&D Fireball 8d6)',
      en: 'King Riccardo vs Pawn Puffin (D&D Fireball 8d6)',
    },
    banner: {
      it: 'D&D FIREBALL (8d6)! PAPINO LANCIA PALLA DI FUOCO SUL PUFFIN! 🔥🎲',
      en: 'D&D FIREBALL (8d6)! PAPINO HURLS A BLAZING FIREBALL AT PUFFIN! 🔥🎲',
    },
    dndSpell: 'fireball',
    attackerWeapon: 'sceptre',
    defenderCounter: {
      move: 'halberd_fish_parry',
      it: 'Puffin alza l’alabarda e l’aringa contro la Palla di Fuoco D&D!',
      en: 'Puffin raises his halberd and silver fish against the D&D Fireball!',
      sfxText: 'PARATA!',
    },
    clashStyle: 'halberd_joust',
    finisherReaction: 'feathers_splash_swamp',
  },

  // ===========================================================================
  // ROW 2: ATTACKER = q (Regina Kate — Lilac Choco-Wave / Royal Wand)
  // ===========================================================================
  q_x_k: {
    title: {
      it: 'Regina Kate vs Re Riccardo (Trono d’Oro & Cioccolato)',
      en: 'Queen Kate vs King Riccardo (Golden Throne & Choco)',
    },
    banner: {
      it: "CARLESSO AL CESSO! ONDA LILLA SUL TRONO D'ORO! 🍫🚽",
      en: 'CARLESSO AL CESSO! LILAC CHOCO OVER GOLDEN THRONE! 🍫🚽',
    },
    attackerWeapon: 'toilet_throne',
    defenderCounter: {
      move: 'plunger_sceptre_zap',
      it: 'Re Riccardo alza lo scettro-sturalavandini d’oro in difesa!',
      en: 'King Riccardo raises his golden plunger-sceptre in defense!',
      sfxText: 'ZAP!',
    },
    clashStyle: 'royal_throne',
    finisherReaction: 'sweet_throne_splash_swamp',
    effect: 'golden_toilet_throne',
    debrisType: 'golden_sparks',
    victimReaction: 'royal_throne_whirl',
    easterEgg: 'carlesso_al_cesso_throne',
  },
  q_x_q: {
    title: {
      it: 'Regina Kate vs Regina Kate (Gala di Cioccolato)',
      en: 'Queen Kate vs Mirror Queen Kate (Choco Gala)',
    },
    banner: {
      it: 'DOPPIO VORTICE CIOCCO-LILLA IMPERIALE! 🍫👑',
      en: 'DOUBLE IMPERIAL LILAC CHOCO-WHIRL! 🍫👑',
    },
    attackerWeapon: 'choco_wand',
    defenderCounter: {
      move: 'mirror_wand_riposte',
      it: 'La Regina Nera risponde con una spirale di coriandoli lilla!',
      en: 'Black Queen counters with a spiral of lilac confetti!',
      sfxText: 'SCUDO!',
    },
    clashStyle: 'choco_whirl',
    finisherReaction: 'sweet_melt_swamp',
  },
  q_x_b: {
    title: {
      it: 'Regina Kate vs Alfiere Ale & Draghetto',
      en: 'Queen Kate vs Bishop Ale & Red Dragon',
    },
    banner: {
      it: 'MERENDA DI CIOCCOLATO PER IL DRAGHETTO DI ALE! 🍫🐉',
      en: "CHOCOLATE SNACK WAVE FOR ALE'S DRAGON! 🍫🐉",
    },
    attackerWeapon: 'choco_wand',
    defenderCounter: {
      move: 'dragon_roast_cocoa',
      it: 'Il draghetto di Ale prova a tostare il cioccolato col fuoco!',
      en: "Ale's dragon tries to toast the chocolate wave with fire!",
      sfxText: 'FIAMMA!',
    },
    clashStyle: 'choco_whirl',
    finisherReaction: 'choco_coated_swamp',
  },
  q_x_n: {
    title: {
      it: 'Regina Kate vs Cavaliere Seby Turbo',
      en: 'Queen Kate vs Turbo Knight Seby',
    },
    banner: {
      it: 'PISTA TURBO INCOLLATA NEL CIOCCOLATO LILLA! 🍫🏎️',
      en: 'TURBO TRACK DRIFTING IN LILAC CHOCOLATE! 🍫🏎️',
    },
    attackerWeapon: 'choco_wand',
    defenderCounter: {
      move: 'turbo_drift_splash',
      it: 'Seby derapa col cavallo sollevando spruzzi di cacao!',
      en: 'Seby drifts his warhorse kicking up cocoa splashes!',
      sfxText: 'IMPENNATA!',
    },
    clashStyle: 'choco_whirl',
    finisherReaction: 'sweet_drift_swamp',
  },
  q_x_r: {
    title: {
      it: 'Regina Kate vs Torre Pupurabbu Puffoso',
      en: 'Queen Kate vs Giant Plushie Pupurabbu',
    },
    banner: {
      it: 'PIOGGIA DI PRALINE LILLA SU PUPURABBU! 🍫💜',
      en: 'LILAC PRALINE SHOWER ON PUPURABBU! 🍫💜',
    },
    attackerWeapon: 'choco_wand',
    defenderCounter: {
      move: 'plush_hug_parry',
      it: 'Pupurabbu rimbalza sulle praline con un salto gommoso!',
      en: 'Pupurabbu bounces across the pralines with a squishy hop!',
      sfxText: 'BOING!',
    },
    clashStyle: 'plush_bounce',
    finisherReaction: 'sugar_bounce_swamp',
  },
  q_x_p: {
    title: {
      it: 'Regina Kate vs Pedone Puffin Guardia Svizzera',
      en: 'Queen Kate vs Swiss Guard Pawn Puffin',
    },
    banner: {
      it: 'PESCIOLINO DI CIOCCOLATO PER IL PUFFIN! 🍫🐟',
      en: 'CHOCOLATE FISH SURPRISE FOR PUFFIN! 🍫🐟',
    },
    attackerWeapon: 'choco_wand',
    defenderCounter: {
      move: 'halberd_stir_choco',
      it: 'Puffin usa l’alabarda come cucchiaio nel vortice dolce!',
      en: 'Puffin uses his halberd like a spoon in the sweet whirlpool!',
      sfxText: 'PARATA!',
    },
    clashStyle: 'choco_whirl',
    finisherReaction: 'choco_spin_swamp',
  },

  // ===========================================================================
  // ROW 3: ATTACKER = b (Alfiere Ale — Red Shoulder Dragon / Amethyst Crystal)
  // ===========================================================================
  b_x_k: {
    title: {
      it: 'Alfiere Ale vs Re Riccardo (Scacco del Drago)',
      en: 'Bishop Ale vs King Riccardo (Dragon Check)',
    },
    banner: {
      it: 'DRAGHETTO DI ALE CRISTALLIZZA LA CORONA REALE! 🐉👑',
      en: "ALE'S DRAGON CRYSTALLIZES THE ROYAL CROWN! 🐉👑",
    },
    attackerWeapon: 'dragon_crystal',
    defenderCounter: {
      move: 'royal_sceptre_guard',
      it: 'Re Riccardo para la fiammata con lo Scettro dei Fulmini!',
      en: 'King Riccardo blocks the flame stream with his Lightning Sceptre!',
      sfxText: 'ZAP!',
    },
    clashStyle: 'sceptre_vs_dragon',
    finisherReaction: 'crystallize_shatter_swamp',
  },
  b_x_q: {
    title: {
      it: 'Alfiere Ale vs Regina Kate (Ametista & Lilla)',
      en: 'Bishop Ale vs Queen Kate (Amethyst & Lilac)',
    },
    banner: {
      it: 'FIAMMA DEL DRAGO E GEMME VIOLA PER MAMMA KATE! 💎💜',
      en: 'DRAGON FLAME & PURPLE GEMS FOR QUEEN KATE! 💎💜',
    },
    attackerWeapon: 'dragon_crystal',
    defenderCounter: {
      move: 'wand_sparkle_veil',
      it: 'Regina Kate evoca un velo scintillante di polvere lilla!',
      en: 'Queen Kate conjures a shimmering veil of lilac stardust!',
      sfxText: 'SCUDO!',
    },
    clashStyle: 'dragon_vs_wand',
    finisherReaction: 'crystallize_shatter_swamp',
  },
  b_x_b: {
    title: {
      it: 'Alfiere Ale vs Alfiere Ale (Duello dei Due Draghi)',
      en: 'Bishop Ale vs Mirror Bishop Ale (Twin Dragon Duel)',
    },
    banner: {
      it: 'SCONTRO TRA DRAGHETTI ROSSI! PIOGGIA DI AMETISTE! 🐉💎',
      en: 'TWIN RED DRAGON CLASH! AMETHYST SHARD STORM! 🐉💎',
    },
    attackerWeapon: 'dragon_crystal',
    defenderCounter: {
      move: 'twin_dragon_fireball',
      it: 'Il Draghetto Nero sputa una palla di fuoco contraria!',
      en: 'The Black Dragon spits a counter-fireball mid-air!',
      sfxText: 'FIAMMA!',
    },
    clashStyle: 'twin_dragons',
    finisherReaction: 'crystallize_shatter_swamp',
  },
  b_x_n: {
    title: {
      it: 'Alfiere Ale vs Cavaliere Seby (Drago vs Pista Turbo)',
      en: 'Bishop Ale vs Knight Seby (Dragon vs Turbo Track)',
    },
    banner: {
      it: 'ALE vs SEBY: CRISTALLO DRAGO SUL CAVALLINO! 💎🐉',
      en: 'ALE vs SEBY: DRAGON CRYSTAL HORSE FREEZE! 💎🐉',
    },
    attackerWeapon: 'dragon_crystal',
    defenderCounter: {
      move: 'horse_rear_kick',
      it: 'Seby impenna il cavallo e lancia una macchinina contro la fiamma!',
      en: 'Seby rears his warhorse and launches a toy car against the flame!',
      sfxText: 'IMPENNATA!',
    },
    clashStyle: 'dragon_vs_horse',
    finisherReaction: 'crystallize_shatter_swamp',
    easterEgg: 'brothers_dragon_vs_turbo',
  },
  b_x_r: {
    title: {
      it: 'Alfiere Ale vs Torre Pupurabbu (Gemma Puffosa)',
      en: 'Bishop Ale vs Rook Pupurabbu (Crystal Plushie)',
    },
    banner: {
      it: 'CRISTALLO DI FUOCO SUL GIGANTE PUPURABBU! 🐉💜',
      en: 'FIRE CRYSTAL SHATTER ON GIANT PUPURABBU! 🐉💜',
    },
    attackerWeapon: 'dragon_crystal',
    defenderCounter: {
      move: 'plush_belly_shield',
      it: 'Pupurabbu fa rimbalzare i cristalli sulla pancia morbida!',
      en: 'Pupurabbu bounces the crystal shards off his squishy belly!',
      sfxText: 'BOING!',
    },
    clashStyle: 'plush_bounce',
    finisherReaction: 'crystallize_shatter_swamp',
  },
  b_x_p: {
    title: {
      it: 'Alfiere Ale vs Pedone Puffin (Fiamma & Alabarda)',
      en: 'Bishop Ale vs Pawn Puffin (Flame & Halberd)',
    },
    banner: {
      it: 'PESCE ARROSTO E GEMME PER IL PUFFIN! 🔥🐟',
      en: 'ROASTED HERRING & GEMS FOR THE PUFFIN! 🔥🐟',
    },
    attackerWeapon: 'dragon_crystal',
    defenderCounter: {
      move: 'fish_shield_block',
      it: 'Puffin usa il pesce d’argento come scudo termico!',
      en: 'Puffin holds up his silver fish as a heat shield!',
      sfxText: 'PARATA!',
    },
    clashStyle: 'halberd_joust',
    finisherReaction: 'crystallize_shatter_swamp',
  },

  // ===========================================================================
  // ROW 4: ATTACKER = n (Cavaliere Seby — Warhorse / Orange Loop-Track Toy Cars)
  // ===========================================================================
  n_x_k: {
    title: {
      it: 'Cavaliere Seby vs Re Riccardo (Giro della Morte sul Re)',
      en: 'Knight Seby vs King Riccardo (Loop-Track Over the King)',
    },
    banner: {
      it: 'SUPER LOOP ARANCIONE ATTORNO AL TRONO DI PAPÀ! 🏎️👑',
      en: "ORANGE LOOP-TRACK SPIN AROUND DAD'S THRONE! 🏎️👑",
    },
    attackerWeapon: 'turbo_cars',
    defenderCounter: {
      move: 'sceptre_traffic_stop',
      it: 'Re Riccardo alza lo Scettro come vigile urbano dei fulmini!',
      en: 'King Riccardo raises his Sceptre like a lightning traffic cop!',
      sfxText: 'ZAP!',
    },
    clashStyle: 'sceptre_vs_horse',
    finisherReaction: 'bowled_flat_stars_swamp',
  },
  n_x_q: {
    title: {
      it: 'Cavaliere Seby vs Regina Kate (Slalom nel Cioccolato)',
      en: 'Knight Seby vs Queen Kate (Choco-Wave Slalom)',
    },
    banner: {
      it: 'MACCHININE TURBO IN DERAPATA SULLA REGINA! 🏎️🍫',
      en: 'TURBO TOY CARS DRIFTING AROUND THE QUEEN! 🏎️🍫',
    },
    attackerWeapon: 'turbo_cars',
    defenderCounter: {
      move: 'choco_ramp_barrier',
      it: 'Regina Kate solleva una rampa di cioccolato lilla per rallentare Seby!',
      en: 'Queen Kate raises a lilac chocolate ramp to slow Seby down!',
      sfxText: 'SCUDO!',
    },
    clashStyle: 'choco_whirl',
    finisherReaction: 'bowled_flat_stars_swamp',
  },
  n_x_b: {
    title: {
      it: 'Cavaliere Seby vs Alfiere Ale (Pista Turbo vs Drago)',
      en: 'Knight Seby vs Bishop Ale (Turbo Track vs Dragon)',
    },
    banner: {
      it: 'SEBY vs ALE: STECCHITO! MACCHININE CONTRO DRAGO! 🏎️🐉',
      en: 'SEBY vs ALE: FLATTENED! TURBO CARS VS DRAGON! 🏎️🐉',
    },
    attackerWeapon: 'turbo_cars',
    defenderCounter: {
      move: 'dragon_wing_flare',
      it: 'Ale apre le ali del draghetto e spara scintille cremisi!',
      en: "Ale flares his dragon's wings and shoots crimson sparks!",
      sfxText: 'FIAMMA!',
    },
    clashStyle: 'dragon_vs_horse',
    finisherReaction: 'bowled_flat_stars_swamp',
    easterEgg: 'brothers_turbo_vs_dragon',
  },
  n_x_n: {
    title: {
      it: 'Cavaliere Seby vs Cavaliere Seby (Gran Premio Doppio Loop)',
      en: 'Knight Seby vs Mirror Knight Seby (Double Loop GP)',
    },
    banner: {
      it: 'DOPPIA PISTA HOT-WHEELS! DUE CAVALLI IN IMPENNATA! 🏎️🐴',
      en: 'DOUBLE HOT-WHEELS LOOP! TWIN REARING WARHORSES! 🏎️🐴',
    },
    attackerWeapon: 'turbo_cars',
    defenderCounter: {
      move: 'mirror_hoof_clash',
      it: 'Il Cavaliere Nero impenna e incrocia gli zoccoli in aria!',
      en: 'The Black Knight rears up and clashes hooves mid-air!',
      sfxText: 'IMPENNATA!',
    },
    clashStyle: 'horse_joust',
    finisherReaction: 'bowled_flat_stars_swamp',
  },
  n_x_r: {
    title: {
      it: 'Cavaliere Seby <3 Torre Pupurabbu (Super Abbraccio)',
      en: 'Knight Seby <3 Rook Pupurabbu (Mega Cuddle Hug)',
    },
    banner: {
      it: 'SEBY & PUPURABBU: SUPER ABBRACCIO PUFFOSO! 💜🤗',
      en: 'SEBY & PUPURABBU: MEGA FLUFFY CUDDLE HUG! 💜🤗',
    },
    attackerWeapon: 'turbo_cars',
    defenderCounter: {
      move: 'happy_plush_cuddle',
      it: 'Pupurabbu apre le braccia giganti per un abbraccio pieno di cuori!',
      en: 'Pupurabbu opens his giant plush arms for a heart-filled hug!',
      sfxText: 'BOING!',
    },
    clashStyle: 'cuddle_hug',
    finisherReaction: 'happy_cuddle_hop_swamp',
    effect: 'mega_cuddle_bounce',
    debrisType: 'floating_purple_hearts',
    victimReaction: 'happy_cuddle_hop',
    easterEgg: 'seby_pupurabbu_cuddle',
    nonLethalCuddle: true,
  },
  n_x_p: {
    title: {
      it: 'Cavaliere Seby vs Pedone Puffin (Sacro Acquarius & Teca di Ghiaccio)',
      en: 'Knight Seby vs Pawn Puffin (Sacred Aquarius & Ice Coffin)',
    },
    banner: {
      it: 'SACRO ACQUARIUS! SEBY CONGELA PUFFIN NELLA TECA DI GHIACCIO! ♒❄️💎',
      en: 'SACRED AQUARIUS! SEBY FREEZES PUFFIN IN THE ICE COFFIN! ♒❄️💎',
    },
    attackerWeapon: 'turbo_cars',
    defenderCounter: {
      move: 'puffin_halberd_vault',
      it: 'Puffin alza l’alabarda contro il vento glaciale dello Zero Assoluto!',
      en: 'Puffin raises his halberd against the Absolute Zero blizzard!',
      sfxText: 'PARATA!',
    },
    clashStyle: 'sacro_acquarius_ice',
    finisherReaction: 'frozen_coffin_crumble_swamp',
    effect: 'sacro_acquarius_ice_coffin',
    debrisType: 'diamond_ice_crystals',
    victimReaction: 'frozen_coffin_crumble',
    easterEgg: 'seby_sacro_acquarius',
  },

  // ===========================================================================
  // ROW 5: ATTACKER = r (Torre Pupurabbu — Giant Purple Plushie / Belly Slam)
  // ===========================================================================
  r_x_k: {
    title: {
      it: 'Torre Pupurabbu vs Re Riccardo (Atterraggio sul Re)',
      en: 'Rook Pupurabbu vs King Riccardo (Royal Belly Slam)',
    },
    banner: {
      it: 'SALTO GIGANTE DI PUPURABBU SULLA CORONA D’ORO! 💥👑',
      en: 'PUPURABBU GIANT BELLY SLAM ON THE GOLDEN CROWN! 💥👑',
    },
    attackerWeapon: 'plush_belly',
    defenderCounter: {
      move: 'sceptre_poke_plush',
      it: 'Re Riccardo punzecchia la pancia viola col lampo reale!',
      en: 'King Riccardo pokes the giant purple belly with royal lightning!',
      sfxText: 'ZAP!',
    },
    clashStyle: 'plush_bounce',
    finisherReaction: 'pancake_squash_swamp',
  },
  r_x_q: {
    title: {
      it: 'Torre Pupurabbu vs Regina Kate (Cuscino & Cioccolato)',
      en: 'Rook Pupurabbu vs Queen Kate (Plushie & Choco)',
    },
    banner: {
      it: 'BOMBOLONE PUFFOSO NEL VORTICE DI REGINA KATE! 💜🍫',
      en: "FLUFFY CANNONBALL INTO QUEEN KATE'S CHOCO WHIRL! 💜🍫",
    },
    attackerWeapon: 'plush_belly',
    defenderCounter: {
      move: 'choco_cushion_wave',
      it: 'Regina Kate avvolge Pupurabbu in un nastro di seta e cacao!',
      en: 'Queen Kate wraps Pupurabbu in a ribbon of silk and cocoa!',
      sfxText: 'SCUDO!',
    },
    clashStyle: 'plush_bounce',
    finisherReaction: 'pancake_squash_swamp',
  },
  r_x_b: {
    title: {
      it: 'Torre Pupurabbu vs Alfiere Ale (Rimbalzo sul Drago)',
      en: 'Rook Pupurabbu vs Bishop Ale (Dragon Belly Bounce)',
    },
    banner: {
      it: 'PANCIA GOMMOSA DI PUPURABBU SPEGNE IL DRAGO! 💜🐉',
      en: 'PUPURABBU SQUISHY BELLY BOUNCES THE DRAGON! 💜🐉',
    },
    attackerWeapon: 'plush_belly',
    defenderCounter: {
      move: 'dragon_tickle_flame',
      it: 'Il draghetto di Ale fa il solletico a Pupurabbu con una fiammella!',
      en: "Ale's dragon tickles Pupurabbu with a tiny flame puff!",
      sfxText: 'FIAMMA!',
    },
    clashStyle: 'plush_bounce',
    finisherReaction: 'pancake_squash_swamp',
  },
  r_x_n: {
    title: {
      it: 'Torre Pupurabbu <3 Cavaliere Seby (Coccole Giganti)',
      en: 'Rook Pupurabbu <3 Knight Seby (Giant Plush Cuddles)',
    },
    banner: {
      it: 'PUPURABBU & SEBY: SUPER ABBRACCIO PUFFOSO GIGANTE! 🤗💜',
      en: 'PUPURABBU & SEBY: GIANT MEGA FLUFFY CUDDLE HUG! 🤗💜',
    },
    attackerWeapon: 'plush_belly',
    defenderCounter: {
      move: 'seby_happy_wheelie_hug',
      it: 'Seby salta giù da cavallo per tuffarsi nella pancia di Pupurabbu!',
      en: "Seby hops off his horse to dive into Pupurabbu's plush belly!",
      sfxText: 'IMPENNATA!',
    },
    clashStyle: 'cuddle_hug',
    finisherReaction: 'happy_cuddle_hop_swamp',
    effect: 'mega_cuddle_bounce',
    debrisType: 'floating_purple_hearts',
    victimReaction: 'happy_cuddle_hop',
    easterEgg: 'seby_pupurabbu_cuddle',
    nonLethalCuddle: true,
  },
  r_x_r: {
    title: {
      it: 'Torre Pupurabbu vs Torre Pupurabbu (Sumo tra Peluche)',
      en: 'Rook Pupurabbu vs Mirror Pupurabbu (Plushie Sumo)',
    },
    banner: {
      it: 'DOPPIO BOING PUFFOSO! SCONTRO SUMŌ VIOLA! 💥💜',
      en: 'DOUBLE SQUISHY BOING! PURPLE PLUSHIE SUMO SLAM! 💥💜',
    },
    attackerWeapon: 'plush_belly',
    defenderCounter: {
      move: 'belly_to_belly_boing',
      it: 'I due Pupurabbu rimbalzano pancia contro pancia facendo POOF!',
      en: 'Both Pupurabbus bounce belly-to-belly in a giant POOF!',
      sfxText: 'BOING!',
    },
    clashStyle: 'plush_bounce',
    finisherReaction: 'pancake_squash_swamp',
  },
  r_x_p: {
    title: {
      it: 'Torre Pupurabbu vs Pedone Puffin (Schiacciata Morbida)',
      en: 'Rook Pupurabbu vs Pawn Puffin (Squishy Pancake Slam)',
    },
    banner: {
      it: 'FRITTELLA DI PUFFIN SOTTO IL PELUCHE GIGANTE! 💜🐟',
      en: 'PUFFIN PANCAKE UNDER THE GIANT PURPLE PLUSHIE! 💜🐟',
    },
    attackerWeapon: 'plush_belly',
    defenderCounter: {
      move: 'halberd_umbrella_brace',
      it: 'Puffin punta l’alabarda verso l’alto come un ombrellino!',
      en: 'Puffin points his halberd upward like a tiny umbrella!',
      sfxText: 'PARATA!',
    },
    clashStyle: 'plush_bounce',
    finisherReaction: 'pancake_squash_swamp',
  },

  // ===========================================================================
  // ROW 6: ATTACKER = p (Pedone Puffin — Swiss Guard Halberd / Silver Fish Slap)
  // ===========================================================================
  p_x_k: {
    title: {
      it: 'Pedone Puffin vs Re Riccardo (Colpo di Stato col Pesce!)',
      en: 'Pawn Puffin vs King Riccardo (Fish-Slap Royal Coup!)',
    },
    banner: {
      it: 'ARINGA D’ARGENTO SUL BAFFO DI RE RICCARDO! PLING! 🐟👑',
      en: "SILVER HERRING SLAP ON KING RICCARDO'S BEARD! PLING! 🐟👑",
    },
    attackerWeapon: 'halberd_fish',
    defenderCounter: {
      move: 'royal_sceptre_parry',
      it: 'Re Riccardo cerca di friggere il pesce con un lampo d’oro!',
      en: 'King Riccardo tries to zap the flying fish with golden lightning!',
      sfxText: 'ZAP!',
    },
    clashStyle: 'halberd_joust',
    finisherReaction: 'spin_off_board_swamp',
  },
  p_x_q: {
    title: {
      it: 'Pedone Puffin vs Regina Kate (Guardia Svizzera Ribelle)',
      en: 'Pawn Puffin vs Queen Kate (Rebel Swiss Guard)',
    },
    banner: {
      it: 'PUFFIN SLAP CONTRO LA BACCHETTA DI REGINA KATE! 🐟💜',
      en: "PUFFIN FISH-SLAP VS QUEEN KATE'S ROYAL WAND! 🐟💜",
    },
    attackerWeapon: 'halberd_fish',
    defenderCounter: {
      move: 'choco_shield_splash',
      it: 'Regina Kate alza un’onda di cioccolato per fermare la carica del Puffin!',
      en: "Queen Kate raises a chocolate wave to block the Puffin's charge!",
      sfxText: 'SCUDO!',
    },
    clashStyle: 'halberd_joust',
    finisherReaction: 'spin_off_board_swamp',
  },
  p_x_b: {
    title: {
      it: 'Pedone Puffin vs Alfiere Ale (Pesce Fresco contro Drago)',
      en: 'Pawn Puffin vs Bishop Ale (Fresh Fish vs Dragon)',
    },
    banner: {
      it: 'SCHIAFFO DI TROTA SUL NASO DEL DRAGHETTO DI ALE! 🐟🐉',
      en: "TROUT SLAP RIGHT ON ALE'S DRAGON SNOUT! 🐟🐉",
    },
    attackerWeapon: 'halberd_fish',
    defenderCounter: {
      move: 'dragon_fire_parry',
      it: 'Il draghetto di Ale soffia scintille contro l’alabarda!',
      en: "Ale's dragon breathes fiery sparks against the halberd!",
      sfxText: 'FIAMMA!',
    },
    clashStyle: 'halberd_joust',
    finisherReaction: 'spin_off_board_swamp',
  },
  p_x_n: {
    title: {
      it: 'Pedone Puffin vs Cavaliere Seby (Alabarda Stop-Traffico)',
      en: 'Pawn Puffin vs Knight Seby (Halberd Traffic Stop)',
    },
    banner: {
      it: 'ALTOLÀ GUARDIA SVIZZERA! PESCIATA ALLA PISTA TURBO! 🐟🏎️',
      en: 'HALT SWISS GUARD! FISH-SLAP ON THE TURBO TRACK! 🐟🏎️',
    },
    attackerWeapon: 'halberd_fish',
    defenderCounter: {
      move: 'horse_jump_halberd',
      it: 'Seby prova a saltare l’alabarda impennando il cavallo!',
      en: 'Seby tries to jump over the halberd by rearing his warhorse!',
      sfxText: 'IMPENNATA!',
    },
    clashStyle: 'halberd_joust',
    finisherReaction: 'spin_off_board_swamp',
  },
  p_x_r: {
    title: {
      it: 'Pedone Puffin vs Torre Pupurabbu (Davide contro Peluche)',
      en: 'Pawn Puffin vs Rook Pupurabbu (Puffin vs Giant Plushie)',
    },
    banner: {
      it: 'PICCOLO PUFFIN FA VOLARE IL GIGANTE PUPURABBU! 🐟💜',
      en: 'TINY PUFFIN SENDS GIANT PUPURABBU FLYING! 🐟💜',
    },
    attackerWeapon: 'halberd_fish',
    defenderCounter: {
      move: 'plush_belly_wobble',
      it: 'Pupurabbu dondola la pancia cercando di assorbire la pesciata!',
      en: 'Pupurabbu wobbles his belly trying to absorb the fish-slap!',
      sfxText: 'BOING!',
    },
    clashStyle: 'halberd_joust',
    finisherReaction: 'spin_off_board_swamp',
  },
  p_x_p: {
    title: {
      it: 'Pedone Puffin vs Pedone Puffin (Duello delle Alabarde)',
      en: 'Pawn Puffin vs Mirror Pawn Puffin (Halberd & Fish Duel)',
    },
    banner: {
      it: 'DOPPIA GUARDIA SVIZZERA! SCHERMA DI PESCI D’ARGENTO! 🐟⚔️',
      en: 'DOUBLE SWISS GUARD! SILVER FISH FENCING DUEL! 🐟⚔️',
    },
    attackerWeapon: 'halberd_fish',
    defenderCounter: {
      move: 'fish_sword_clash',
      it: 'Il Puffin Nero incrocia il suo pesce d’argento come una spada!',
      en: 'The Black Puffin crosses his silver fish like a fencing sword!',
      sfxText: 'PARATA!',
    },
    clashStyle: 'sword_duel',
    finisherReaction: 'spin_off_board_swamp',
  },
};

function buildBattleMatrix36() {
  const matrix = {};
  for (const atk of PIECE_KEYS_36) {
    matrix[atk] = {};
    const atkMeta = PIECE_META_36[atk];
    for (const def of PIECE_KEYS_36) {
      const defMeta = PIECE_META_36[def];
      const id = `${atk}_x_${def}`;
      const pairSlug = `${atkMeta.role}_vs_${defMeta.role}`;
      const raw = RAW_PAIRS_36[id];
      matrix[atk][def] = Object.freeze({
        id,
        pairSlug,
        attacker: atk,
        defender: def,
        attackerRole: atkMeta.role,
        defenderRole: defMeta.role,
        attackerName: atkMeta.name,
        defenderName: defMeta.name,
        attackerGlyph: atkMeta.glyph,
        defenderGlyph: defMeta.glyph,
        attackerImg: atkMeta.portrait,
        defenderImg: defMeta.portrait,
        title: Object.freeze({ ...raw.title }),
        banner: Object.freeze({ ...raw.banner }),
        attackerWeapon: raw.attackerWeapon || atkMeta.defaultWeapon,
        defenderCounter: Object.freeze({ ...raw.defenderCounter }),
        clashStyle: raw.clashStyle,
        finisherReaction: raw.finisherReaction,
        effect: raw.effect || atkMeta.effect,
        dndSpell: raw.dndSpell || null,
        debrisType: raw.debrisType || atkMeta.debrisType,
        victimReaction: raw.victimReaction || atkMeta.victimReaction,
        easterEgg: raw.easterEgg || null,
        nonLethalCuddle: Boolean(raw.nonLethalCuddle),
        compositeUrl: `assets/battles/keyframes/${pairSlug}.svg`,
        keyframeUrl: `assets/battles/keyframes/${id}.png`,
        videoUrl: `assets/battles/videos/${id}.mp4`,
        webmUrl: `assets/battles/videos/${id}.webm`,
      });
    }
    Object.freeze(matrix[atk]);
  }
  return Object.freeze(matrix);
}

export const BATTLE_MATRIX_36 = buildBattleMatrix36();

/**
 * Look up any of the 36 (`6 x 6`) battle choreographies by attacker & defender piece codes.
 * Accepts piece codes (`'k'|'q'|'b'|'n'|'r'|'p'`) or role names (`'king'|'queen'|...`).
 *
 * @param {string} attacker
 * @param {string} defender
 * @returns {object}
 */
export function getBattle36(attacker, defender) {
  const roleToCode = {
    king: 'k',
    queen: 'q',
    bishop: 'b',
    knight: 'n',
    rook: 'r',
    pawn: 'p',
  };
  const aRaw = String(attacker || 'b').toLowerCase().trim();
  const dRaw = String(defender || 'n').toLowerCase().trim();
  const a = roleToCode[aRaw] || (PIECE_META_36[aRaw] ? aRaw : 'b');
  const d = roleToCode[dRaw] || (PIECE_META_36[dRaw] ? dRaw : 'n');
  return BATTLE_MATRIX_36[a][d];
}

/**
 * Returns a flat array of all 36 battle entries in canonical 6x6 row-major order.
 * @returns {Array<object>}
 */
export function listAllBattles36() {
  const list = [];
  for (const atk of PIECE_KEYS_36) {
    for (const def of PIECE_KEYS_36) {
      list.push(BATTLE_MATRIX_36[atk][def]);
    }
  }
  return list;
}
