/**
 * @fileoverview Character POV Showcase Data Registry (`CharacterPovData.js`).
 *
 * Provides structured data for the Kid-Friendly & Heroic "Per Personaggio (Showcase POV)" view:
 * - 6 Main Carlesso Family Heroes (Seby, Ale, Riccardo, Kate, Pupurabbu, Puffin).
 * - Full Soundboard audio catalogue (`assets/audio/voices/`) with catchphrases.
 * - 3D GLB Model variations (canonico, rigged dragon for Ale, wedding 2016 for Kate).
 * - Dual-POV 11-battle mapping:
 *   - ⚔️ "Le Mie Vittorie (Attacchi)" (6 video)
 *   - 🛡️ "Quando Vengo Mangiato (Difese)" (6 video)
 *   - Mirror match present in both (11 unique videos).
 */

import { BATTLE_MATRIX_36, PIECE_META_36 } from './BattleMatrix36.js';

export const CARLESSO_HERO_KEYS = Object.freeze(['n', 'b', 'k', 'q', 'r', 'p']);

export const PIECE_SLUGS = Object.freeze({
  k: 'king',
  q: 'queen',
  b: 'bishop',
  n: 'knight',
  r: 'rook',
  p: 'pawn',
});

/**
 * Returns the path to the classical circular Staunton chess medallion SVG.
 * @param {string} key 'k'|'q'|'b'|'n'|'r'|'p'
 * @param {'white'|'black'} [color='white']
 * @param {string} [prefix='']
 * @returns {string}
 */
export function getPieceMedallion(key, color = 'white', prefix = '') {
  const slug = PIECE_SLUGS[key] || 'pawn';
  const c = color === 'black' ? 'black' : 'white';
  return `${prefix}assets/icons/chess/${c}/${slug}.svg`;
}

export const HERO_SOUNDBOARDS = Object.freeze({
  n: [
    { id: 'voice-n', label: '🐴 Sono Seby!', audio: 'assets/audio/voices/voice-n.mp3', quote: 'Dimmi papino!', badge: 'Saluto' },
    { id: 'voice-n-scrivilescemo', label: '🐧 Scrivile Scemo!', audio: 'assets/audio/voices/voice-n-scrivilescemo.mp3', quote: 'Hey Google, metti Scrivile Scemo dei Pinguini Tattici Nucleari su YouTube Music!', badge: 'Musica' },
    { id: 'voice-n-bottom', label: '🧻 Clean My Bottom!', audio: 'assets/audio/voices/voice-n-bottom.mp3', quote: 'Mummy, can you clean my bottooooom?!', badge: 'Iconico' },
    { id: 'voice-n-cacca', label: '💩 Cacca!', audio: 'assets/audio/voices/voice-n-cacca.mp3', quote: 'Mi scappa la cacca!', badge: 'Risate' },
    { id: 'voice-n-mybody', label: '💪 My Body!', audio: 'assets/audio/voices/voice-n-mybody.mp3', quote: 'My body, my choice!', badge: 'Top' },
    { id: 'voice-n-papinooo', label: '🥺 Papinoooo!', audio: 'assets/audio/voices/voice-n-papinooo.mp3', quote: 'Papinoooooo!!!', badge: 'Affetto' },
    { id: 'voice-n-timanco', label: '❤️ Ti Manco?', audio: 'assets/audio/voices/voice-n-timanco.mp3', quote: 'Papino, ti manco tantissimo?', badge: 'Dolce' },
    { id: 'voice-n-sbuffo', label: '😤 Sbuffo', audio: 'assets/audio/voices/voice-n-sbuffo.mp3', quote: 'Pff... uffaaa!', badge: 'Reazione' },
    { id: 'voice-n-hmm', label: '🤔 Hmm...', audio: 'assets/audio/voices/voice-n-hmm.mp3', quote: 'Mmh-hmm! Ehehe!', badge: 'Mumble' },
  ],
  b: [
    { id: 'voice-b', label: '🧙‍♂️ Sono Ale!', audio: 'assets/audio/voices/voice-b.mp3', quote: 'Agli ordini, Signore!', badge: 'Saluto' },
    { id: 'voice-b-cafonazzo', label: '💥 CafoNAZZO!', audio: 'assets/audio/voices/voice-b-cafonazzo.mp3', quote: 'Sei proprio un cafoNAZZO!', badge: 'Iconico' },
    { id: 'voice-b-piuforte', label: '🏆 Il Più Forte!', audio: 'assets/audio/voices/voice-b-piuforte.mp3', quote: 'Papino, qual è il più forte?', badge: 'Domanda' },
    { id: 'voice-b-regalo', label: '🎁 Un Regalo!', audio: 'assets/audio/voices/voice-b-regalo.mp3', quote: 'Papino, quando mi compri un regalo?', badge: 'Desiderio' },
    { id: 'voice-b-timanco', label: '❤️ Ti Manco?', audio: 'assets/audio/voices/voice-b-timanco.mp3', quote: 'Papino, ti manco tantissimo?', badge: 'Dolce' },
    { id: 'voice-b-sbuffo', label: '😤 Sbuffo', audio: 'assets/audio/voices/voice-b-sbuffo.mp3', quote: 'Pff... ma dai!', badge: 'Reazione' },
    { id: 'voice-b-hmm', label: '🤔 Hmm...', audio: 'assets/audio/voices/voice-b-hmm.mp3', quote: 'Mmh-hmm... vediamo!', badge: 'Mumble' },
  ],
  k: [
    { id: 'voice-k', label: '👑 Re Riccardo!', audio: 'assets/audio/voices/voice-k.mp3', quote: 'Avanti tutta! Re Carlesso al comando!', badge: 'Reale' },
    { id: 'voice-k-hmm', label: '🤔 Hmm...', audio: 'assets/audio/voices/voice-k-hmm.mp3', quote: "Mmh-hmm... vediamo un po'!", badge: 'Mumble' },
  ],
  q: [
    { id: 'voice-q', label: '👸 Regina Kate', audio: 'assets/audio/voices/voice-q.mp3', quote: "That's... interesting.", badge: 'Reale' },
    { id: 'voice-q-facetious', label: '🧐 Facetious!', audio: 'assets/audio/voices/voice-q-facetious.mp3', quote: "Don't be FACETIOUS!", badge: 'Iconico' },
    { id: 'voice-q-bearinmind', label: '🧠 Bear In Mind!', quote: "I'll bear that in mind", speakText: "I'll bear that in mind", speechLang: 'en-GB', badge: 'Catchphrase!' },
    { id: 'voice-q-mcmuffin', label: '🍔 Sausage McMuffin', audio: 'assets/audio/voices/voice-q-mcmuffin.mp3', quote: 'Ok, Puffin McMuffin!', badge: 'Colazione' },
    { id: 'voice-q-loveme', label: '💖 Love Me?', audio: 'assets/audio/voices/voice-q-loveme.mp3', quote: 'You... love me! I tell myself EVERY day!', badge: 'Dolce' },
    { id: 'voice-q-sbuffo', label: '😤 Sbuffo British', audio: 'assets/audio/voices/voice-q-sbuffo.mp3', quote: 'Pff... oh, honestly!', badge: 'Reazione' },
    { id: 'voice-q-hmm', label: '🤔 Hmm...', audio: 'assets/audio/voices/voice-q-hmm.mp3', quote: 'Hmm-hmm...', badge: 'Mumble' },
  ],
  r: [
    { id: 'voice-r', label: '🏰 Boing Pupurabbu!', audio: 'assets/audio/voices/voice-r.mp3', quote: 'Boing boing! Super abbraccio Pupurabbu!', badge: 'Abbraccio' },
    { id: 'voice-r-catchphrase', label: '👕 Catchphrase!', quote: 'Catchphrase! (Blue Shirt Guy)', speakText: 'Catchphrase!', speechLang: 'en-US', badge: 'Blue Shirt Guy 👕' },
    { id: 'voice-r-hmm', label: '🤔 Hmm Boing', audio: 'assets/audio/voices/voice-r-hmm.mp3', quote: 'Mmh-boing! Prrr!', badge: 'Mumble' },
  ],
  p: [
    { id: 'voice-p', label: '♟️ Attenti Puffin!', audio: 'assets/audio/voices/voice-p.mp3', quote: 'Piu piu! Eccomi, pronta guardia Puffin!', badge: 'Guardia' },
    { id: 'voice-p-hmm', label: '🤔 Hmm Piu', audio: 'assets/audio/voices/voice-p-hmm.mp3', quote: 'Mmh-piu! *pesce pronto*', badge: 'Mumble' },
  ],
});

export const HERO_PROFILES = Object.freeze({
  n: {
    key: 'n',
    heroName: 'Sebi',
    fullName: 'Cavaliere Seby',
    role: 'Cavaliere (Cavallo)',
    glyph: '♘',
    themeColor: '#ffb300',
    themeGradient: 'linear-gradient(135deg, #ffd54f 0%, #ff8f00 100%)',
    avatar: 'assets/characters/knight-seby-4.jpg',
    models: [
      { label: 'Destriero d’Oro 3D', url: 'assets/models/knight-seby.glb', note: 'Cavaliere in armatura dorata su destriero con mantello blu reale' },
    ],
    catchphrase: 'Can you clean my bottooooom?!',
    bio: 'Il più giovane e veloce pilota dell’Acquario! Salta a L sopra qualsiasi ostacolo con le sue macchinine turbo e il suo destriero.',
    weapon: '🏎️ Pista Loop Turbo & Macchinine Die-Cast',
    counter: '🐴 Impennata e Calcio a Molla',
    easterEgg: '💜 Abbraccio Puffoso con Pupurabbu · 🏎️ Sfida Fratelli con Ale',
  },
  b: {
    key: 'b',
    heroName: 'Ale',
    fullName: 'Alfiere Ale',
    role: 'Alfiere',
    glyph: '♗',
    themeColor: '#ab47bc',
    themeGradient: 'linear-gradient(135deg, #ba68c8 0%, #7b1fa2 100%)',
    avatar: 'assets/characters/bishop-ale-1.jpg',
    models: [
      { label: 'Ale con Drago 3D', url: 'assets/models/bishop-ale-1.glb', note: 'Mitria blu/oro, occhioni vispi e drago rosso sulla spalla' },
      { label: 'Variante Riggata 🐉', url: 'assets/models/bishop-ale-rigged.glb', note: 'Drago riggato a 26 ossa con animazione fiammata' },
    ],
    catchphrase: 'Sei proprio un cafoNAZZO!',
    bio: 'Mago supremo del Cristallo Ametista. Con il suo fidato drago rosso lancia saette magiche e diagonali imprendibili.',
    weapon: '🐉 Draghetto & Cristallo Ametista',
    counter: '🔥 Soffio Difensivo del Draghetto',
    easterEgg: '🐉 vs 🏎️ Sfida Fratelli con Sebi',
  },
  k: {
    key: 'k',
    heroName: 'Riccardo',
    fullName: 'Re Riccardo',
    role: 'Re',
    glyph: '♔',
    themeColor: '#e53935',
    themeGradient: 'linear-gradient(135deg, #ef5350 0%, #c62828 100%)',
    avatar: 'assets/characters/king-riccardo-1.jpg',
    models: [
      { label: 'Re Riccardo 3D', url: 'assets/models/king-riccardo.glb', note: 'Corona imperiale, globo crucigero e scettro reale d’oro' },
    ],
    catchphrase: 'Avanti tutta! Re Carlesso al comando!',
    bio: 'Monarca della Casa Carlesso e stratega supremo. Difende il trono d’oro con il fulmine del suo scettro reale.',
    weapon: '⚡ Scettro Reale & Trono d’Oro',
    counter: '⚡ Lampo Reale di Scettro (ZAP!)',
    easterEgg: "🚽 Trono d'Oro con la Regina Kate",
  },
  q: {
    key: 'q',
    heroName: 'Kate',
    fullName: 'Regina Kate',
    role: 'Regina',
    glyph: '♕',
    themeColor: '#8e24aa',
    themeGradient: 'linear-gradient(135deg, #ab47bc 0%, #6a1b9a 100%)',
    avatar: 'assets/characters/queen-kate-4.jpg',
    models: [
      { label: 'Regina Giovane 3D (Kate 🏆)', url: 'assets/models/queen-kate.glb', note: 'Capelli biondi mossi, occhiali viola e abito regale' },
      { label: 'Nozze 2016 👰', url: 'assets/models/queen-kate-wedding2016.glb', note: 'Stile nozze 2016 con chignon e abito porpora' },
    ],
    catchphrase: "I'll bear that in mind / Don't be FACETIOUS!",
    bio: 'Sovrana indiscussa della scacchiera con il raggio di movimento più potente. Domina con la sua bacchetta Ciocco-Onda lilla.',
    weapon: '🍫 Bacchetta Ciocco-Onda Lilla',
    counter: '🛡️ Scudo Ciocco-Vortice Lilla',
    easterEgg: "🚽 Trono d'Oro con Re Riccardo",
  },
  r: {
    key: 'r',
    heroName: 'Pupurabbu',
    fullName: 'Torre Pupurabbu',
    role: 'Torre',
    glyph: '♖',
    themeColor: '#5c6bc0',
    themeGradient: 'linear-gradient(135deg, #7986cb 0%, #3949ab 100%)',
    avatar: 'assets/characters/rook-pupurabbu.jpg',
    models: [
      { label: 'Pupurabbu 3D', url: 'assets/models/rook-pupurabbu.glb', note: 'Creatura pelosa viola affacciata dai merli della torre' },
    ],
    catchphrase: 'Catchphrase! 👕 (Blue Shirt Guy)',
    bio: 'La fortezza più soffice e inespugnabile della scacchiera. Rimbalza e schiaccia con panciate e abbracci puffosi.',
    weapon: '💜 Guantoni Puffosi & Panciata Morbida',
    counter: '💜 Rimbalzo Pancia Gommoso (BOING!)',
    easterEgg: '💜 Super Abbraccio Morbido con Sebi',
  },
  p: {
    key: 'p',
    heroName: 'Puffin',
    fullName: 'Guardia Svizzera Puffin',
    role: 'Pedone',
    glyph: '♙',
    themeColor: '#00acc1',
    themeGradient: 'linear-gradient(135deg, #26c6da 0%, #00838f 100%)',
    avatar: 'assets/characters/pawn-puffin.jpg',
    models: [
      { label: 'Puffin Swiss Guard 3D', url: 'assets/models/pawn-puffin.glb', note: 'Pulcinella di mare in uniforme da Guardia Svizzera con alabarda' },
    ],
    catchphrase: 'Piu piu! Eccomi, pronta guardia Puffin!',
    bio: 'Fiero e instancabile guardiano della prima linea. Difende la famiglia con colpi d’alabarda e lo schiaffo del pesce sacro.',
    weapon: '🐟 Alabarda Svizzera & Schiaffo col Pesce',
    counter: '⚔️ Parata d’Alabarda & Fish Slap',
    easterEgg: '🛡️ Promozione a Regina nei finali di partita',
  },
});

export const CHESS_PIECE_LABELS = Object.freeze({
  k: { name: 'RE', glyph: '♚', role: 'Re', label: 'Re' },
  q: { name: 'REGINA', glyph: '♛', role: 'Regina', label: 'Regina' },
  b: { name: 'ALFIERE', glyph: '♝', role: 'Alfiere', label: 'Alfiere' },
  n: { name: 'CAVALLO', glyph: '♞', role: 'Cavallo', label: 'Cavallo' },
  r: { name: 'TORRE', glyph: '♜', role: 'Torre', label: 'Torre' },
  p: { name: 'PEDONE', glyph: '♟', role: 'Pedone', label: 'Pedone' },
});

/**
 * Builds the 6 Offensive Battle items for heroKey (when hero attacks and captures defender).
 * @param {string} heroKey
 * @param {string} [prefix=''] Path prefix (e.g. '../' when in showcase/)
 * @returns {Array<Object>}
 */
export function getHeroAttacks(heroKey, prefix = '') {
  return CARLESSO_HERO_KEYS.map((defKey) => {
    const pairId = `${heroKey}_x_${defKey}`;
    const entry = BATTLE_MATRIX_36[heroKey]?.[defKey] || {};
    const defHero = HERO_PROFILES[defKey];
    const isMirror = heroKey === defKey;
    const targetLabel = CHESS_PIECE_LABELS[defKey] || { name: defKey.toUpperCase(), glyph: '♟', role: 'Pezzo' };
    return {
      pairId,
      attackerKey: heroKey,
      defenderKey: defKey,
      targetKey: defKey,
      targetPieceName: targetLabel.name,
      targetPieceGlyph: targetLabel.glyph,
      targetPieceRole: targetLabel.role,
      isMirror,
      type: 'attack',
      title: entry.title?.it || `${HERO_PROFILES[heroKey]?.fullName} vs ${defHero?.fullName}`,
      banner: entry.banner?.it || `${HERO_PROFILES[heroKey]?.heroName} mangia ${defHero?.heroName}!`,
      weapon: entry.attackerWeapon || HERO_PROFILES[heroKey]?.weapon,
      counter: entry.defenderCounter?.it || defHero?.counter,
      counterSfx: entry.defenderCounter?.sfxText || 'BAM!',
      videoMp4: `${prefix}assets/battles/videos/${pairId}.mp4`,
      videoWebm: `${prefix}assets/battles/videos/${pairId}.webm`,
      poster: `${prefix}assets/battles/keyframes/${pairId}.png`,
      attackerMedallion: getPieceMedallion(heroKey, 'white', prefix),
      defenderMedallion: getPieceMedallion(defKey, 'black', prefix),
      targetMedallion: getPieceMedallion(defKey, 'black', prefix),
      targetHero: defHero,
    };
  });
}

/**
 * Builds the 6 Defensive Battle items for heroKey (when hero is attacked and defeated).
 * @param {string} heroKey
 * @param {string} [prefix=''] Path prefix (e.g. '../' when in showcase/)
 * @returns {Array<Object>}
 */
export function getHeroDefenses(heroKey, prefix = '') {
  return CARLESSO_HERO_KEYS.map((atkKey) => {
    const pairId = `${atkKey}_x_${heroKey}`;
    const entry = BATTLE_MATRIX_36[atkKey]?.[heroKey] || {};
    const atkHero = HERO_PROFILES[atkKey];
    const isMirror = atkKey === heroKey;
    const targetLabel = CHESS_PIECE_LABELS[atkKey] || { name: atkKey.toUpperCase(), glyph: '♟', role: 'Pezzo' };
    return {
      pairId,
      attackerKey: atkKey,
      defenderKey: heroKey,
      targetKey: atkKey,
      targetPieceName: targetLabel.name,
      targetPieceGlyph: targetLabel.glyph,
      targetPieceRole: targetLabel.role,
      isMirror,
      type: 'defense',
      title: entry.title?.it || `${atkHero?.fullName} vs ${HERO_PROFILES[heroKey]?.fullName}`,
      banner: entry.banner?.it || `${atkHero?.heroName} sconfigge ${HERO_PROFILES[heroKey]?.heroName}!`,
      weapon: entry.attackerWeapon || atkHero?.weapon,
      counter: entry.defenderCounter?.it || HERO_PROFILES[heroKey]?.counter,
      counterSfx: entry.defenderCounter?.sfxText || 'BAM!',
      videoMp4: `${prefix}assets/battles/videos/${pairId}.mp4`,
      videoWebm: `${prefix}assets/battles/videos/${pairId}.webm`,
      poster: `${prefix}assets/battles/keyframes/${pairId}.png`,
      attackerMedallion: getPieceMedallion(atkKey, 'white', prefix),
      defenderMedallion: getPieceMedallion(heroKey, 'black', prefix),
      targetMedallion: getPieceMedallion(atkKey, 'white', prefix),
      targetHero: atkHero,
    };
  });
}
