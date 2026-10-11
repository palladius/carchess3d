import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SHOWCASE_HTML_PATH = path.join(ROOT, 'showcase', 'index.html');

/**
 * Chromium/Blink hard limit on active WebGL contexts per page (`kMaxActiveWebGLContexts = 16`).
 * When a page creates a 17th and 18th `THREE.WebGLRenderer` (for 18 cards), Chromium evicts
 * context #0 (Ale 1) and context #1 (Re Riccardo), turning their `<canvas>` elements into
 * solid white boxes!
 */
const CHROMIUM_MAX_WEBGL_CONTEXTS = 16;
const MAX_VISIBLE_CARDS_PER_FAMILY = 6;

test('Showcase TDD: all 2D & 3D asset URLs in showcase/index.html exist and are valid GLBs', () => {
  const html = fs.readFileSync(SHOWCASE_HTML_PATH, 'utf8');

  // Extract all '../assets/...' and '../tools/...' asset references from CHARACTERS
  const assetMatches = [...html.matchAll(/['"](\.\.\/(?:assets|tools)\/[^'"]+)['"]/g)].map(
    (m) => m[1]
  );
  assert.ok(
    assetMatches.length >= 30,
    `Expected at least 30 asset URLs in showcase/index.html, found ${assetMatches.length}`
  );

  for (const rawUrl of assetMatches) {
    const cleanRel = rawUrl.split('?')[0].replace(/^\.\.\//, '');
    const absPath = path.join(ROOT, cleanRel);
    assert.ok(
      fs.existsSync(absPath),
      `Showcase references missing asset: ${rawUrl} -> ${absPath}`
    );
    const stat = fs.statSync(absPath);
    assert.ok(stat.size > 100, `Showcase asset is empty/corrupt: ${cleanRel}`);

    if (cleanRel.endsWith('.glb')) {
      const buf = fs.readFileSync(absPath);
      const magic = buf.subarray(0, 4).toString('ascii');
      const version = buf.readUInt32LE(4);
      const declaredLen = buf.readUInt32LE(8);
      assert.equal(magic, 'glTF', `Invalid GLB magic in ${cleanRel}`);
      assert.equal(version, 2, `Invalid GLB version in ${cleanRel}`);
      assert.equal(
        declaredLen,
        buf.length,
        `GLB length mismatch in ${cleanRel}: declared ${declaredLen} vs actual ${buf.length}`
      );
    }
  }
});

test('Showcase TDD: splits showcase into 3 families (carlesso, classic, swamp/shrek) showing strictly 6 pieces at a time', () => {
  const html = fs.readFileSync(SHOWCASE_HTML_PATH, 'utf8');

  // 1. Verify there is NO `data-family="all"` tab that forces all 18 cards onto the screen at once
  assert.equal(
    /data-family=["']all["']/.test(html),
    false,
    'showcase/index.html must NOT have a data-family="all" tab that displays all 18 cards simultaneously; only 1 family (6 cards) should be shown at a time'
  );

  // 2. Verify the 3 family tabs exist (`carlesso`, `classic`, `swamp`)
  const tabFamilies = [...html.matchAll(/<button[^>]+data-family=["']([^"']+)["']/g)].map(
    (m) => m[1]
  );
  assert.deepEqual(
    tabFamilies,
    ['carlesso', 'classic', 'swamp'],
    'showcase/index.html #family-tabs must contain exactly the 3 family tabs: carlesso, classic, swamp'
  );

  // 3. Verify each of the 3 families has exactly 6 cards (<= MAX_VISIBLE_CARDS_PER_FAMILY = 6 < 16 WebGL limit)
  for (const fam of ['carlesso', 'classic', 'swamp']) {
    const count = [...html.matchAll(new RegExp(`\\bfamily:\\s*['"]${fam}['"]`, 'g'))].length;
    assert.equal(
      count,
      MAX_VISIBLE_CARDS_PER_FAMILY,
      `Family "${fam}" must have exactly ${MAX_VISIBLE_CARDS_PER_FAMILY} cards, found ${count}`
    );
    assert.ok(
      count < CHROMIUM_MAX_WEBGL_CONTEXTS,
      `Family "${fam}" card count (${count}) must stay well below Chrome's ${CHROMIUM_MAX_WEBGL_CONTEXTS} WebGL context limit`
    );
  }
});

test('Showcase TDD: never creates per-card WebGLRenderer instances (prevents Chrome 16-context eviction on Ale & Re Riccardo)', () => {
  const html = fs.readFileSync(SHOWCASE_HTML_PATH, 'utf8');

  // 1. Extract makeView(pane, models) body and verify it does NOT call `new THREE.WebGLRenderer`
  const makeViewMatch = html.match(/function\s+makeView\s*\([^)]*\)\s*\{([\s\S]*?)\n\s*return\s+view;\s*\n\s*\}/);
  assert.ok(makeViewMatch, 'showcase/index.html must define function makeView(pane, models)');
  const makeViewBody = makeViewMatch[1];

  assert.equal(
    /new\s+THREE\.WebGLRenderer\b/.test(makeViewBody),
    false,
    'BUG: makeView() instantiates `new THREE.WebGLRenderer` per card! ' +
      'Chrome evicts the oldest WebGL contexts (Card #0 Ale 1 and Card #1 Re Riccardo), turning them into white boxes!'
  );

  // 2. Verify the entire showcase/index.html instantiates `new THREE.WebGLRenderer` at most ONCE (shared renderer)
  const webglRendererInstantiations = [...html.matchAll(/new\s+THREE\.WebGLRenderer\s*\(/g)];
  assert.equal(
    webglRendererInstantiations.length,
    1,
    `Expected exactly 1 shared THREE.WebGLRenderer in showcase/index.html, found ${webglRendererInstantiations.length}`
  );

  // 3. Verify each card uses a lightweight 2D canvas context (`getContext('2d')`) + `drawImage` from the shared WebGLRenderer
  assert.match(
    makeViewBody,
    /getContext\(\s*['"]2d['"]\s*\)/,
    'Each card in makeView() must use a 2D canvas (`canvas.getContext("2d")`) to receive frames from the single shared WebGLRenderer'
  );
  assert.match(
    html,
    /\.drawImage\s*\(\s*sharedRenderer\.domElement\b/,
    'Showcase render loop must blit from sharedRenderer.domElement into each visible card 2D canvas via drawImage()'
  );
});
