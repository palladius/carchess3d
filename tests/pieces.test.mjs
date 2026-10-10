import test from 'node:test';
import assert from 'node:assert/strict';
import { GameEventBus } from '../src/core/EventBus.js';
import { mulberry32 } from '../src/core/Rng.js';
import { BoardMapManager } from '../src/managers/BoardMapManager.js';
import { PieceManager, BISHOP_GLB_VARIANTS } from '../src/managers/PieceManager.js';
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

  // Check King Riccardo on e1
  const whiteKing = pieces.getPieceAt('e1');
  assert.ok(whiteKing);
  assert.equal(whiteKing.type, 'k');
  assert.equal(whiteKing.color, 'w');
  assert.equal(whiteKing.name, 'Riccardo');
  assert.equal(whiteKing.height, CANONICAL_PIECE_HEIGHTS.k);
  assert.equal(whiteKing.glbUrl, null);
  assert.ok(whiteKing.frontPortrait.includes('king-riccardo'));

  // Check Bishop Ale on c1 (defaults to rigged GLB)
  const whiteBishop = pieces.getPieceAt('c1');
  assert.ok(whiteBishop);
  assert.equal(whiteBishop.type, 'b');
  assert.equal(whiteBishop.name, 'Ale');
  assert.equal(whiteBishop.height, CANONICAL_PIECE_HEIGHTS.b);
  assert.equal(whiteBishop.glbUrl, BISHOP_GLB_VARIANTS.rigged);

  // Check Pawn Puffin on e2
  const whitePawn = pieces.getPieceAt('e2');
  assert.ok(whitePawn);
  assert.equal(whitePawn.type, 'p');
  assert.equal(whitePawn.name, 'Puffin');
  assert.equal(whitePawn.height, CANONICAL_PIECE_HEIGHTS.p);
  assert.equal(whitePawn.glbUrl, 'assets/models/pawn-puffin.glb');
});

test('PieceManager: toggles rival set mode (family vs stone) and Bishop Ale variant (rigged vs hat)', () => {
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

  // Toggle Bishop Ale variant to 'hat' (bishop-ale-1.glb)
  pieces.setBishopVariant('hat');
  bus.flush();
  assert.equal(pieces.getBishopVariant(), 'hat');
  assert.equal(pieces.getPieceAt('c1').glbUrl, BISHOP_GLB_VARIANTS.hat);

  // Restore family set so Black Bishop also uses the hat variant
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
