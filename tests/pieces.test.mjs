import test from 'node:test';
import assert from 'node:assert/strict';
import { GameEventBus } from '../src/core/EventBus.js';
import { mulberry32 } from '../src/core/Rng.js';
import { BoardMapManager } from '../src/managers/BoardMapManager.js';
import { PieceManager, BISHOP_GLB_VARIANTS, QUEEN_GLB_VARIANTS } from '../src/managers/PieceManager.js';
import { CANONICAL_PIECE_HEIGHTS } from '../src/utils/glbGrounding.js';

function createPieceSetup() {
  const bus = new GameEventBus();
  const rng = mulberry32(2026);
  const board = new BoardMapManager();
  const pieces = new PieceManager();
  const ctx = { bus, rng, board, pieces };
  board.init(ctx);
  pieces.init(ctx);
  return { bus, board, pieces, ctx };
}

test('PieceManager: resolves 32 initial pieces with canonical heights, GLBs, and portraits', () => {
  const { pieces } = createPieceSetup();
  const living = pieces.getLivingPieces();
  assert.equal(living.length, 32);

  // Check King Riccardo on e1 (canonical 3D GLB from main)
  const whiteKing = pieces.getPieceAt('e1');
  assert.ok(whiteKing);
  assert.equal(whiteKing.type, 'k');
  assert.equal(whiteKing.color, 'w');
  assert.equal(whiteKing.name, 'Riccardo');
  assert.equal(whiteKing.height, CANONICAL_PIECE_HEIGHTS.k);
  assert.equal(whiteKing.glbUrl, 'assets/models/king-riccardo.glb');
  assert.ok(whiteKing.frontPortrait.includes('king-riccardo'));

  // Check Queen Kate on d1, Knight Seby on b1, Rook Pupurabbu on a1
  assert.equal(pieces.getPieceAt('d1').glbUrl, 'assets/models/queen-kate.glb');
  assert.equal(pieces.getPieceAt('b1').glbUrl, 'assets/models/knight-seby.glb');
  assert.equal(pieces.getPieceAt('a1').glbUrl, 'assets/models/rook-pupurabbu.glb');

  // Check Bishop Ale on c1 (defaults to canonical hat GLB)
  const whiteBishop = pieces.getPieceAt('c1');
  assert.ok(whiteBishop);
  assert.equal(whiteBishop.type, 'b');
  assert.equal(whiteBishop.name, 'Ale');
  assert.equal(whiteBishop.height, CANONICAL_PIECE_HEIGHTS.b);
  assert.equal(whiteBishop.glbUrl, BISHOP_GLB_VARIANTS.hat);

  // Check Pawn Puffin on e2
  const whitePawn = pieces.getPieceAt('e2');
  assert.ok(whitePawn);
  assert.equal(whitePawn.type, 'p');
  assert.equal(whitePawn.name, 'Puffin');
  assert.equal(whitePawn.height, CANONICAL_PIECE_HEIGHTS.p);
  assert.equal(whitePawn.glbUrl, 'assets/models/pawn-puffin.glb');
});

test('PieceManager: toggles rival set mode (family vs stone), Bishop Ale variants (hat, astrolabe, rigged), and Queen Kate variants (young, wedding)', () => {
  const { bus, pieces } = createPieceSetup();
  const setEvents = [];
  bus.on('PIECE_SET_CHANGED', (e) => setEvents.push(e));

  pieces.setRivalSetMode('stone');
  bus.flush();
  assert.equal(pieces.getRivalSetMode(), 'stone');
  assert.equal(setEvents.length, 1);

  const blackKing = pieces.getPieceAt('e8');
  const whiteKing = pieces.getPieceAt('e1');
  assert.equal(blackKing.isStoneSet, true);
  assert.equal(blackKing.glbUrl, null);
  assert.equal(whiteKing.isStoneSet, false);

  // Toggle Bishop Ale variant to 'rigged' (bishop-ale-rigged.glb)
  pieces.setBishopVariant('rigged');
  bus.flush();
  assert.equal(pieces.getBishopVariant(), 'rigged');
  assert.equal(pieces.getPieceAt('c1').glbUrl, BISHOP_GLB_VARIANTS.rigged);

  // Toggle Black rival set to 'swamp' and 'classic'
  pieces.setRivalSetMode('swamp');
  bus.flush();
  assert.equal(pieces.getRivalSetMode(), 'swamp');
  assert.equal(pieces.getPieceAt('e8').name, 'Orco Brontolo');
  assert.equal(pieces.getPieceAt('e8').glbUrl, 'assets/models/swamp/king-swamp-orco.glb');
  assert.equal(pieces.getPieceAt('c8').glbUrl, 'assets/models/swamp/bishop-swamp-focaccina.glb');

  pieces.setRivalSetMode('classic');
  bus.flush();
  assert.equal(pieces.getRivalSetMode(), 'classic');
  assert.equal(pieces.getPieceAt('c8').name, 'San Gennaro');
  assert.equal(pieces.getPieceAt('c8').glbUrl, 'assets/models/classic/bishop-classic-vescovo.glb');
  assert.equal(pieces.getPieceAt('a8').name, 'Torre Matildea');
  assert.equal(pieces.getPieceAt('a8').glbUrl, 'assets/models/classic/rook-classic-torre.glb');

  // Toggle White family to 'swamp' and 'classic', then restore 'carlesso'
  pieces.setWhiteFamily('swamp');
  bus.flush();
  assert.equal(pieces.getWhiteFamily(), 'swamp');
  assert.equal(pieces.getPieceAt('e1').glbUrl, 'assets/models/swamp/king-swamp-orco.glb');
  pieces.setWhiteFamily('carlesso');
  bus.flush();

  // Toggle Bishop Ale variant to 'astrolabe' (bishop-ale-2-remastered.glb)
  pieces.setBishopVariant('astrolabe');
  bus.flush();
  assert.equal(pieces.getBishopVariant(), 'astrolabe');
  assert.equal(pieces.getPieceAt('c1').glbUrl, BISHOP_GLB_VARIANTS.astrolabe);

  // Toggle Queen Kate variant to 'wedding' (queen-kate-wedding2016-remastered.glb)
  assert.equal(pieces.getQueenVariant(), 'young');
  assert.equal(pieces.getPieceAt('d1').glbUrl, QUEEN_GLB_VARIANTS.young);
  pieces.setQueenVariant('wedding');
  bus.flush();
  assert.equal(pieces.getQueenVariant(), 'wedding');
  assert.equal(pieces.getPieceAt('d1').glbUrl, QUEEN_GLB_VARIANTS.wedding);

  // Test PIECE_VARIANT_REQUESTED bus event
  bus.emit({ type: 'PIECE_VARIANT_REQUESTED', bishopVariant: 'hat', queenVariant: 'young' });
  bus.flush();
  assert.equal(pieces.getBishopVariant(), 'hat');
  assert.equal(pieces.getQueenVariant(), 'young');
  assert.equal(pieces.getPieceAt('c1').glbUrl, BISHOP_GLB_VARIANTS.hat);
  assert.equal(pieces.getPieceAt('d1').glbUrl, QUEEN_GLB_VARIANTS.young);

  // Restore family set and verify mirror black bishop
  pieces.setRivalSetMode('family');
  bus.flush();
  assert.equal(pieces.getPieceAt('c8').isStoneSet, false);
  assert.equal(pieces.getPieceAt('c8').glbUrl, BISHOP_GLB_VARIANTS.hat);
});

test('PieceManager: tracks moves, captures into West/East trays, castling belly-bounce, and clip aliases', () => {
  const { bus, board, pieces } = createPieceSetup();
  const animEvents = [];
  bus.on('PIECE_ANIM_REQUESTED', (e) => animEvents.push(e));

  // 1. Play e2->e4, d7->d5, e4xd5 capture
  assert.ok(board.move('e2', 'e4'));
  bus.flush();
  assert.equal(pieces.getPieceAt('e2'), null);
  assert.equal(pieces.getPieceAt('e4')?.type, 'p');

  assert.ok(board.move('d7', 'd5'));
  bus.flush();
  assert.ok(board.move('e4', 'd5'));
  bus.flush();

  const trays = pieces.getCapturedTrays();
  assert.equal(trays.b.length, 1);
  assert.equal(trays.b[0].type, 'p');
  assert.equal(trays.b[0].color, 'b');
  assert.ok(trays.b[0].trayX > 4.5, 'Captured Black piece should be placed in East tray (+X)');

  // 2. Castling emits castling_belly_bounce animation request
  board.loadFen('r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1');
  bus.flush();
  assert.ok(board.move('e1', 'g1'));
  bus.flush();
  bus.flush();

  assert.equal(pieces.getPieceAt('g1')?.type, 'k');
  assert.equal(pieces.getPieceAt('f1')?.type, 'r');
  assert.ok(animEvents.some((e) => e.animType === 'castling_belly_bounce'));

  // 3. WOW_TRIGGER_ANIMATION maps 'Idle' -> 'Idle_Track' and 'Click_Fire_Breath' -> 'FireBreath_Track'
  bus.emit({ type: 'WOW_TRIGGER_ANIMATION', pieceType: 'b', square: 'c1', clipKey: 'Click_Fire_Breath' });
  bus.flush();
  bus.flush();

  const clipEvt = animEvents.find((e) => e.animType === 'clip' && e.clipKey === 'Click_Fire_Breath');
  assert.ok(clipEvt);
  assert.equal(clipEvt.resolvedClip, 'FireBreath_Track');
});

test('PieceManager: seedSwampParty and synthetic handlePieceCaptured are strictly idempotent and preserve living board pieces', () => {
  const { bus, pieces } = createPieceSetup();

  assert.equal(pieces.getLivingPieces().length, 32);

  // First click on Palude populates 6 swimmers (3 White, 3 Black)
  const firstAdded = pieces.seedSwampParty();
  bus.flush();
  assert.equal(firstAdded, 6);
  assert.equal(pieces.getCapturedTrays().w.length, 3);
  assert.equal(pieces.getCapturedTrays().b.length, 3);
  assert.equal(pieces.getLivingPieces().length, 32, 'All 32 living board pieces must remain intact');
  assert.ok(pieces.getPieceAt('c1'), 'White bishop on c1 must not be deleted by swamp demo');
  assert.ok(pieces.getPieceAt('h8'), 'Black rook on h8 must not be deleted by swamp demo');

  // Second and third clicks on Palude are no-ops (0 added, still 3 + 3 in trays)
  assert.equal(pieces.seedSwampParty(), 0);
  assert.equal(pieces.seedSwampParty(), 0);
  assert.equal(pieces.getCapturedTrays().w.length, 3);
  assert.equal(pieces.getCapturedTrays().b.length, 3);
  assert.equal(pieces.getLivingPieces().length, 32);
});

test('PieceManager: handles QUALITY_TIER_CHANGED and updates qualityTier & effectiveLod', () => {
  const { bus, pieces } = createPieceSetup();
  assert.equal(pieces.getQualityTier(), 'auto');

  bus.emit({ type: 'QUALITY_TIER_CHANGED', tier: 'low', effectiveLod: 'low' });
  bus.flush();

  assert.equal(pieces.getQualityTier(), 'low');
  assert.equal(pieces.getEffectiveLod(), 'low');

  pieces.setQualityTier('high');
  bus.flush();
  assert.equal(pieces.getQualityTier(), 'high');
  assert.equal(pieces.getEffectiveLod(), 'high');
});

