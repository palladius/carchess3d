/**
 * Antigravity Inline GLB / 3D Turntable Viewer Sidecar (v0.2.0)
 *
 * Self-contained zero-network-import architecture:
 * - Inlines Three.js + BufferGeometryUtils + OrbitControls + GLTFLoader directly into
 *   /view.html as a single plain <script> (avoiding iframe ES module import() issues).
 * - Pre-bundles the requested ?file=/path/to/model.glb (metadata + base64 binary)
 *   directly into the server-rendered /view.html response when opened in the Aux Pane,
 *   and also exposes POST/GET /api/bundle for instant Prev/Next folder switching.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { homedir } from 'node:os';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const IS_SIDECAR_ENV = Boolean(
  process.env.ANTIGRAVITY_LS_ADDRESS &&
  process.env.ANTIGRAVITY_CSRF_TOKEN &&
  process.env.ANTIGRAVITY_SIDECAR_WEB_PORT
);

class StandaloneApp {
  #pages = new Map();
  #apis = new Map();
  page(p, h) { this.#pages.set(p, h); }
  api(p, h, m = 'POST') {
    if (!this.#apis.has(p)) this.#apis.set(p, new Map());
    this.#apis.get(p).set(m.toUpperCase(), h);
  }
  run() {
    this.#pages.set('/preload.js', () => 'window.sidecar = window.sidecar || {};');
    const port = Number(process.env.PORT || process.env.ANTIGRAVITY_SIDECAR_WEB_PORT || 0);
    const server = createServer(async (req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (req.method === 'GET' && this.#pages.has(url.pathname)) {
        const content = await this.#pages.get(url.pathname)();
        const isJS = url.pathname.endsWith('.js');
        res.writeHead(200, { 'Content-Type': isJS ? 'application/javascript' : 'text/html; charset=utf-8' });
        res.end(content);
        return;
      }
      if (this.#apis.has(url.pathname) && this.#apis.get(url.pathname).has(req.method)) {
        const handler = this.#apis.get(url.pathname).get(req.method);
        let body = '';
        req.on('data', (c) => { body += c; });
        req.on('end', async () => {
          try {
            const data = Object.fromEntries(url.searchParams.entries());
            if (body) Object.assign(data, JSON.parse(body));
            const out = await handler(data);
            if (out && out.contentType && out.body !== undefined) {
              res.writeHead(out.status || 200, { 'Content-Type': out.contentType, ...out.headers });
              res.end(out.body);
              return;
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(out));
          } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
          }
        });
        return;
      }
      res.writeHead(404);
      res.end('Not found');
    });
    return new Promise((resolveServer) => {
      server.listen(port, '127.0.0.1', () => {
        const actualPort = server.address().port;
        const argFile = process.argv[2] ? `?file=${encodeURIComponent(resolve(process.argv[2]))}` : '';
        console.log(`[glb-viewer] listening on http://127.0.0.1:${actualPort}/view.html${argFile}`);
        resolveServer(server);
      });
    });
  }
}

let app;
let ResponseClass;
if (IS_SIDECAR_ENV) {
  const sdk = await import('sidecar_sdk');
  app = new sdk.SidecarApp();
  ResponseClass = sdk.Response;
} else {
  app = new StandaloneApp();
  ResponseClass = class {
    constructor(body, { contentType = 'text/plain', status = 200, headers } = {}) {
      this.body = body;
      this.contentType = contentType;
      this.status = status;
      this.headers = headers;
    }
  };
}
const Response = ResponseClass;
const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));

function resolveVendorFile(filename) {
  const candidates = [
    join(CURRENT_DIR, 'vendor', filename),
    join(CURRENT_DIR, '..', '..', 'vendor', 'three', filename),
    join(CURRENT_DIR, '..', '..', 'vendor', 'three', 'addons', 'controls', filename),
    join(CURRENT_DIR, '..', '..', 'vendor', 'three', 'addons', 'loaders', filename),
    join(CURRENT_DIR, '..', '..', 'vendor', 'three', 'addons', 'utils', filename),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  throw new Error(`Vendor file not found: ${filename}`);
}

function buildInlineThreeBundle() {
  const three = readFileSync(resolveVendorFile('three.module.js'), 'utf-8')
    .replace(/export\s*\{([\s\S]*?)\};?\s*$/, 'window.THREE = {$1};');

  const bgu = readFileSync(resolveVendorFile('BufferGeometryUtils.js'), 'utf-8')
    .replace(/import\s*\{[\s\S]*?\}\s*from\s*['"]three['"];?/g, '')
    .replace(/\bexport\s+(function|const|let|var|class)\b/g, '$1')
    .replace(/export\s*\{[\s\S]*?\};?\s*$/, 'window.toTrianglesDrawMode = toTrianglesDrawMode;');

  const orbit = readFileSync(resolveVendorFile('OrbitControls.js'), 'utf-8')
    .replace(/import\s*\{[\s\S]*?\}\s*from\s*['"]three['"];?/g, '')
    .replace(/\bexport\s+(function|const|let|var|class)\b/g, '$1')
    .replace(/export\s*\{[\s\S]*?\};?\s*$/, 'window.OrbitControls = OrbitControls;');

  const gltf = readFileSync(resolveVendorFile('GLTFLoader.js'), 'utf-8')
    .replace(/import\s*\{[\s\S]*?\}\s*from\s*['"]three['"];?/g, '')
    .replace(/import\s*\{[\s\S]*?\}\s*from\s*['"]\.\.\/utils\/BufferGeometryUtils\.js['"];?/g, '')
    .replace(/\bexport\s+(function|const|let|var|class)\b/g, '$1')
    .replace(/export\s*\{[\s\S]*?\};?\s*$/, 'window.GLTFLoader = GLTFLoader;');

  return `(function(){\n${three}\n{\n${bgu}\n}\n{\n${orbit}\n}\n{\nconst toTrianglesDrawMode = window.toTrianglesDrawMode;\n${gltf}\n}\n})();`;
}

const THREE_BUNDLE_JS = buildInlineThreeBundle();

function normalizeFilePath(rawPath) {
  if (!rawPath || typeof rawPath !== 'string') return null;
  let p = rawPath.trim();
  if (p.startsWith('file://')) {
    try {
      p = fileURLToPath(p);
    } catch {
      p = decodeURIComponent(p.replace(/^file:\/\//, ''));
    }
  }
  if (p.startsWith('~/')) {
    p = join(homedir(), p.slice(2));
  }
  p = resolve(p);
  if (!existsSync(p)) return null;
  try {
    if (!statSync(p).isFile()) return null;
  } catch {
    return null;
  }
  return p;
}

function parseGlbHeaderMetadata(filePath) {
  const meta = {
    gltfVersion: '2.0',
    generator: '',
    meshesCount: 0,
    nodesCount: 0,
    materialsCount: 0,
    texturesCount: 0,
    animationsCount: 0,
    skinsCount: 0,
    accessorsCount: 0,
    animationNames: [],
    materialNames: [],
    meshNames: [],
  };

  try {
    const ext = extname(filePath).toLowerCase();
    let json = null;

    if (ext === '.gltf') {
      json = JSON.parse(readFileSync(filePath, 'utf-8'));
    } else {
      const buf = readFileSync(filePath);
      if (buf.length >= 20) {
        const magic = buf.readUInt32LE(0);
        const version = buf.readUInt32LE(4);
        const chunk0Len = buf.readUInt32LE(12);
        const chunk0Type = buf.readUInt32LE(16);
        meta.gltfVersion = String(version);
        if (magic === 0x46546c67 && chunk0Type === 0x4e4f534a && buf.length >= 20 + chunk0Len) {
          const jsonStr = buf.subarray(20, 20 + chunk0Len).toString('utf-8');
          json = JSON.parse(jsonStr);
        }
      }
    }

    if (json && typeof json === 'object') {
      if (json.asset?.version) meta.gltfVersion = String(json.asset.version);
      if (json.asset?.generator) meta.generator = String(json.asset.generator);
      meta.meshesCount = Array.isArray(json.meshes) ? json.meshes.length : 0;
      meta.nodesCount = Array.isArray(json.nodes) ? json.nodes.length : 0;
      meta.materialsCount = Array.isArray(json.materials) ? json.materials.length : 0;
      meta.texturesCount = Array.isArray(json.textures) ? json.textures.length : 0;
      meta.animationsCount = Array.isArray(json.animations) ? json.animations.length : 0;
      meta.skinsCount = Array.isArray(json.skins) ? json.skins.length : 0;
      meta.accessorsCount = Array.isArray(json.accessors) ? json.accessors.length : 0;
      if (Array.isArray(json.animations)) {
        meta.animationNames = json.animations.map((a, i) => a?.name || `Animation_${i + 1}`);
      }
      if (Array.isArray(json.materials)) {
        meta.materialNames = json.materials.map((m, i) => m?.name || `Material_${i + 1}`);
      }
      if (Array.isArray(json.meshes)) {
        meta.meshNames = json.meshes.map((m, i) => m?.name || `Mesh_${i + 1}`);
      }
    }
  } catch (err) {
    console.warn('[glb-viewer] header parse warning:', err.message);
  }

  return meta;
}

function listSiblingGlbFiles(filePath) {
  const dir = dirname(filePath);
  const siblings = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isFile()) continue;
      const lower = e.name.toLowerCase();
      if (lower.endsWith('.glb') || lower.endsWith('.gltf')) {
        const full = resolve(dir, e.name);
        let sizeBytes = 0;
        try {
          sizeBytes = statSync(full).size;
        } catch {
          // ignore
        }
        siblings.push({
          filename: e.name,
          file: full,
          sizeBytes,
        });
      }
    }
    siblings.sort((a, b) => a.filename.localeCompare(b.filename, undefined, { numeric: true }));
  } catch {
    // ignore
  }
  const currentIndex = Math.max(
    0,
    siblings.findIndex((s) => s.file === filePath)
  );
  return {
    directory: dir,
    siblings,
    currentIndex,
    totalSiblings: siblings.length,
  };
}

function getGlbInfo(filePath) {
  const stat = statSync(filePath);
  const headerMeta = parseGlbHeaderMetadata(filePath);
  const folderInfo = listSiblingGlbFiles(filePath);
  return {
    file: filePath,
    filename: basename(filePath),
    sizeBytes: stat.size,
    mtimeMs: stat.mtimeMs,
    ...headerMeta,
    ...folderInfo,
  };
}

function getGlbBundle(filePath) {
  const info = getGlbInfo(filePath);
  const base64 = readFileSync(filePath).toString('base64');
  return { info, base64 };
}

function renderViewHtml(initialBundle = null) {
  const bundleJson = JSON.stringify(initialBundle).replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>GLB 3D Viewer 🧊</title>
<script src="/preload.js"></script>
<style>
  :root {
    --bg: #141416;
    --fg: #ececf1;
    --card-bg: #1e1f23;
    --border-col: #2e3038;
    --muted: #9ca3af;
    --accent: #60a5fa;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #141416 !important;
    color: #ececf1 !important;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    user-select: none;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 12px;
    background: #1e1f23 !important;
    color: #ececf1 !important;
    border-bottom: 1px solid #2e3038;
    flex-shrink: 0;
    flex-wrap: wrap;
    z-index: 20;
  }
  .file-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 220px;
    flex: 1;
    overflow: hidden;
  }
  .file-title {
    font-size: 13px;
    font-weight: 600;
    color: #f3f4f6;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  select#sibling-select {
    background: #272930;
    color: #f3f4f6;
    border: 1px solid #3f424e;
    border-radius: 6px;
    padding: 4px 8px;
    font-size: 12.5px;
    font-weight: 600;
    min-width: 0;
    flex: 1;
    max-width: 230px;
    cursor: pointer;
    outline: none;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  select#sibling-select:hover {
    border-color: var(--accent);
  }
  .badge {
    font-size: 11px;
    color: #cbd5e1;
    background: rgba(255,255,255,0.1);
    padding: 2px 8px;
    border-radius: 999px;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .toolbar {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
  }
  .page-nav-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: rgba(255,255,255,0.08);
    border: 1px solid #3f424e;
    border-radius: 8px;
    padding: 2px 4px;
    margin-right: 4px;
  }
  .page-nav-pill button {
    border: none;
    background: transparent;
    padding: 3px 7px;
    font-weight: 700;
    color: #f3f4f6;
  }
  .page-nav-pill button:hover:not(:disabled) {
    background: rgba(255,255,255,0.18);
  }
  .page-nav-pill button:disabled {
    opacity: 0.35;
    cursor: default;
  }
  #model-counter {
    font-size: 12px;
    font-weight: 600;
    min-width: 58px;
    text-align: center;
    font-variant-numeric: tabular-nums;
    color: #f3f4f6;
  }
  button {
    background: rgba(255,255,255,0.08);
    color: #f3f4f6;
    border: 1px solid #3f424e;
    border-radius: 6px;
    padding: 4px 8px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.12s ease;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
  }
  button:hover:not(:disabled) {
    background: rgba(255,255,255,0.18);
    border-color: var(--accent);
  }
  button.active {
    background: var(--accent);
    color: #000;
    border-color: var(--accent);
    font-weight: 600;
  }
  button.primary-action {
    background: rgba(59, 130, 246, 0.22);
    border-color: rgba(96, 165, 250, 0.5);
  }
  button.primary-action:hover {
    background: rgba(59, 130, 246, 0.36);
    border-color: var(--accent);
  }
  .viewport-wrapper {
    position: relative;
    flex: 1;
    display: flex;
    overflow: hidden;
    background: radial-gradient(circle at 50% 42%, #262936 0%, #121318 75%, #090a0d 100%);
  }
  .viewport-wrapper.bg-emerald {
    background: radial-gradient(circle at 50% 42%, #13332a 0%, #091915 75%, #040b09 100%);
  }
  .viewport-wrapper.bg-black {
    background: #050506;
  }
  .viewport-wrapper.bg-light {
    background: radial-gradient(circle at 50% 42%, #f8fafc 0%, #cbd5e1 85%);
  }
  .viewport-wrapper.bg-checker {
    background-color: #1e1e24;
    background-image:
      linear-gradient(45deg, #2a2a32 25%, transparent 25%),
      linear-gradient(-45deg, #2a2a32 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #2a2a32 75%),
      linear-gradient(-45deg, transparent 75%, #2a2a32 75%);
    background-size: 24px 24px;
    background-position: 0 0, 0 12px, 12px -12px, -12px 0;
  }
  #canvas-container {
    flex: 1;
    width: 100%;
    height: 100%;
    position: relative;
    outline: none;
  }
  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
  .mega-nav-btn {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 46px;
    height: 92px;
    border-radius: 14px;
    background: rgba(25, 26, 32, 0.82);
    backdrop-filter: blur(8px);
    color: #fff;
    border: 1px solid rgba(255,255,255,0.22);
    font-size: 22px;
    font-weight: 700;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    cursor: pointer;
    z-index: 15;
    box-shadow: 0 6px 20px rgba(0,0,0,0.45);
    transition: all 0.15s ease;
    user-select: none;
  }
  .mega-nav-btn span.sub {
    font-size: 9px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    opacity: 0.75;
  }
  .mega-nav-btn:hover:not(:disabled) {
    background: var(--accent);
    color: #000;
    border-color: var(--accent);
    transform: translateY(-50%) scale(1.06);
  }
  .mega-nav-btn:disabled {
    opacity: 0.22;
    cursor: default;
  }
  .mega-prev { left: 10px; }
  .mega-next { right: 10px; }

  .hud-top-left {
    position: absolute;
    top: 12px;
    left: 14px;
    display: flex;
    align-items: center;
    gap: 8px;
    z-index: 12;
    pointer-events: none;
    flex-wrap: wrap;
  }
  .gif-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    background: rgba(16, 185, 129, 0.2);
    color: #34d399;
    border: 1px solid rgba(52, 211, 153, 0.45);
    backdrop-filter: blur(6px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  }
  .gif-pill.paused {
    background: rgba(156, 163, 175, 0.2);
    color: #cbd5e1;
    border-color: rgba(156, 163, 175, 0.4);
  }
  .spin-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #34d399;
    box-shadow: 0 0 8px #34d399;
    animation: pulse-dot 1.2s infinite ease-in-out;
  }
  .gif-pill.paused .spin-dot {
    background: #cbd5e1;
    box-shadow: none;
    animation: none;
  }
  @keyframes pulse-dot {
    0%, 100% { transform: scale(0.85); opacity: 0.7; }
    50% { transform: scale(1.25); opacity: 1; }
  }
  .stats-pill {
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 500;
    background: rgba(20, 20, 26, 0.82);
    color: #f1f5f9;
    border: 1px solid rgba(255,255,255,0.18);
    backdrop-filter: blur(6px);
    font-variant-numeric: tabular-nums;
  }
  .hud-bottom-bar {
    position: absolute;
    bottom: 12px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px;
    border-radius: 999px;
    background: rgba(22, 23, 29, 0.88);
    border: 1px solid rgba(255,255,255,0.2);
    backdrop-filter: blur(10px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.45);
    z-index: 12;
  }
  .hud-bottom-bar span.hint {
    font-size: 11px;
    color: #cbd5e1;
    padding: 0 6px;
    white-space: nowrap;
  }
  #info-drawer {
    display: none;
    position: absolute;
    top: 12px;
    right: 66px;
    width: 320px;
    max-height: calc(100% - 24px);
    overflow-y: auto;
    background: rgba(24, 25, 32, 0.95);
    backdrop-filter: blur(12px);
    border: 1px solid #3f424e;
    border-radius: 12px;
    padding: 14px;
    z-index: 18;
    box-shadow: 0 12px 32px rgba(0,0,0,0.55);
    font-size: 12px;
    line-height: 1.5;
    user-select: text;
    color: #f3f4f6;
  }
  #info-drawer h4 {
    font-size: 12.5px;
    margin-bottom: 8px;
    color: var(--accent);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .info-grid {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 10px;
    margin-bottom: 10px;
  }
  .info-grid dt { color: #9ca3af; }
  .info-grid dd { font-weight: 600; text-align: right; font-variant-numeric: tabular-nums; color: #f8fafc; }

  .status-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 24px;
    text-align: center;
    z-index: 14;
    pointer-events: none;
  }
  #status-text {
    color: #f8fafc !important;
    background: rgba(15, 23, 42, 0.88);
    border: 1px solid rgba(255, 255, 255, 0.22);
    border-radius: 10px;
    padding: 10px 18px;
    font-size: 13px;
    font-weight: 500;
    box-shadow: 0 8px 24px rgba(0,0,0,0.5);
  }
  footer {
    flex-shrink: 0;
    padding: 5px 12px;
    background: #1e1f23 !important;
    border-top: 1px solid #2e3038;
    text-align: center;
    font-size: 11.5px;
    font-style: italic;
    color: #9ca3af !important;
    z-index: 20;
  }
  footer a {
    color: #60a5fa !important;
    text-decoration: none;
    font-weight: 500;
  }
  footer a:hover {
    text-decoration: underline;
  }
</style>
</head>
<body>
  <header>
    <div class="file-meta">
      <span>🧊</span>
      <span class="file-title" id="filename">GLB 3D Viewer</span>
      <select id="sibling-select" style="display:none;" title="Cambia modello 3D nella stessa cartella"></select>
      <span class="badge" id="size-badge">–</span>
    </div>
    <div class="toolbar">
      <div class="page-nav-pill" title="Naviga tra i file .glb della cartella (Frecce ⬅️ / ➡️)">
        <button id="top-prev" onclick="stepModel(-1)" title="Modello precedente (⬅️)">◀</button>
        <span id="model-counter">1 / 1</span>
        <button id="top-next" onclick="stepModel(1)" title="Modello successivo (➡️)">▶</button>
      </div>
      <button id="btn-autorotate" class="active" onclick="toggleAutoRotate()" title="Auto-rotazione 360° come una GIF animata (Spazio)">🔄 GIF 360°</button>
      <button id="btn-speed" onclick="cycleSpeed()" title="Velocità di auto-rotazione">⚡ 1x</button>
      <button id="btn-wire" onclick="cycleWireframe()" title="Ispeziona topologia e triangoli (Solido / Overlay / Wireframe)">🕸️ Wire</button>
      <button id="btn-pedestal" class="active" onclick="togglePedestal()" title="Mostra/nascondi piedistallo turntable">💿 Base</button>
      <button id="btn-bg" onclick="cycleBackground()" title="Cambia sfondo studio">🎨 Sfondo</button>
      <button id="btn-cam" onclick="cycleCameraPreset()" title="Cambia angolo camera (3/4, Frontale, Profilo, Dall'alto)">🎥 Vista</button>
      <button id="btn-anim" style="display:none;" onclick="cycleAnimation()" title="Cambia animazione scheletrica">🎬 Anim</button>
      <button id="btn-info" onclick="toggleInfoDrawer()" title="Dettagli glTF, poligoni e materiali">📊 Info</button>
      <button id="btn-snap" class="primary-action" onclick="copyPngSnapshot()" title="Copia istantanea PNG negli appunti">📸 PNG</button>
      <button id="btn-chat" onclick="sendToChat()" title="Invia dettagli del modello 3D in chat">💬 In Chat</button>
    </div>
  </header>

  <div class="viewport-wrapper" id="viewport-wrapper">
    <div class="hud-top-left">
      <div class="gif-pill" id="gif-pill">
        <span class="spin-dot"></span>
        <span id="gif-status-text">AUTO-ROTATE GIF • 1x</span>
      </div>
      <div class="stats-pill" id="poly-pill">Pronto</div>
    </div>

    <button id="mega-prev" class="mega-nav-btn mega-prev" onclick="stepModel(-1)" title="Modello .glb Precedente nella cartella (Freccia Sinistra ⬅️)">
      <span>◀</span>
      <span class="sub">Prev</span>
    </button>

    <div id="canvas-container" tabindex="0"></div>

    <div class="status-overlay" id="status-overlay">
      <div id="status-text">⏳ Inizializzazione motore 3D Three.js...</div>
    </div>

    <div id="info-drawer">
      <h4>
        <span>📊 Telemetria Modello GLB</span>
        <button onclick="toggleInfoDrawer()" style="padding:1px 6px;font-size:11px;">✕</button>
      </h4>
      <dl class="info-grid" id="info-grid"></dl>
      <div id="info-extra" style="font-size:11px;color:#9ca3af;word-break:break-all;"></div>
    </div>

    <div class="hud-bottom-bar">
      <span class="hint">🖱️ Trascina: Ruota • Rotella: Zoom • Tasto DX: Pan • Spazio: Pausa/Play GIF • ⬅️/➡️: Prev/Next GLB</span>
    </div>

    <button id="mega-next" class="mega-nav-btn mega-next" onclick="stepModel(1)" title="Modello .glb Successivo nella cartella (Freccia Destra ➡️)">
      <span>▶</span>
      <span class="sub">Next</span>
    </button>
  </div>

  <footer>
    Made by 💛 <a href="https://www.linkedin.com/in/riccardocarlesso/" target="_blank" rel="noopener noreferrer">Riccardo</a> with <a href="https://antigravity.google/" target="_blank" rel="noopener noreferrer">Antigravity</a>
  </footer>

<script>
window.__INITIAL_GLB_BUNDLE__ = ${bundleJson};
</script>
<script>
${THREE_BUNDLE_JS}
</script>
<script>
(function() {
  const THREE = window.THREE;
  const OrbitControls = window.OrbitControls;
  const GLTFLoader = window.GLTFLoader;

  const params = new URLSearchParams(window.location.search);
  let currentFile = params.get('file') || params.get('path') || params.get('uri') || '';
  let glbMeta = null;
  let siblings = [];
  let currentIndex = 0;

  function clientLog(msg, extra) {
    try {
      if (window.sidecar && typeof window.sidecar.fetch === 'function') {
        window.sidecar.fetch('/api/client-log', {
          method: 'POST',
          body: JSON.stringify({ msg, extra }),
        }).catch(() => {});
      } else {
        fetch('api/client-log?msg=' + encodeURIComponent(msg) + '&extra=' + encodeURIComponent(JSON.stringify(extra || {}))).catch(() => {});
      }
    } catch {}
  }

  clientLog('boot', { href: window.location.href, search: window.location.search, hash: window.location.hash });

  function extractGlbPathFromObject(obj, depth = 0) {
    if (!obj || depth > 5) return null;
    if (typeof obj === 'string') {
      const s = obj.trim();
      if (/\\.(glb|gltf)(\\?.*)?$/i.test(s)) return s.replace(/\\?.*$/, '');
      return null;
    }
    if (Array.isArray(obj)) {
      for (const item of obj) {
        const found = extractGlbPathFromObject(item, depth + 1);
        if (found) return found;
      }
      return null;
    }
    if (typeof obj === 'object') {
      for (const [k, v] of Object.entries(obj)) {
        if (k === 'cssVariables') continue;
        const found = extractGlbPathFromObject(v, depth + 1);
        if (found) return found;
      }
    }
    return null;
  }

  window.addEventListener('message', (event) => {
    const t = event.data?.type || 'unknown';
    if (t !== 'theme-change') {
      clientLog('postMessage:' + t, event.data);
    }
    const maybeGlb = extractGlbPathFromObject(event.data);
    if (maybeGlb && maybeGlb !== currentFile) {
      clientLog('postMessage-loadGlb', { file: maybeGlb });
      loadGlb(maybeGlb);
    }
  });

  const container = document.getElementById('canvas-container');
  const statusOverlay = document.getElementById('status-overlay');
  const statusText = document.getElementById('status-text');

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(container.clientWidth || 640, container.clientHeight || 480);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    38,
    (container.clientWidth || 640) / (container.clientHeight || 480),
    0.05,
    100
  );
  camera.position.set(0, 1.45, 3.6);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.target.set(0, 0.95, 0);
  controls.autoRotate = true;
  controls.autoRotateSpeed = 3.6;
  controls.minDistance = 0.4;
  controls.maxDistance = 18;

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x334155, 1.35);
  hemiLight.position.set(0, 10, 0);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xfff7ed, 2.2);
  keyLight.position.set(3.5, 5.5, 4.0);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 1024;
  keyLight.shadow.mapSize.height = 1024;
  keyLight.shadow.camera.near = 0.5;
  keyLight.shadow.camera.far = 15;
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x93c5fd, 1.15);
  fillLight.position.set(-4.0, 2.8, 2.0);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0xfde047, 1.25);
  rimLight.position.set(0, 4.0, -4.5);
  scene.add(rimLight);

  const pedestalGroup = new THREE.Group();
  const discGeo = new THREE.CylinderGeometry(1.15, 1.24, 0.08, 64);
  const discMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.65,
    roughness: 0.32,
  });
  const discMesh = new THREE.Mesh(discGeo, discMat);
  discMesh.position.y = -0.04;
  discMesh.receiveShadow = true;
  pedestalGroup.add(discMesh);

  const ringGeo = new THREE.RingGeometry(1.11, 1.145, 64);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x60a5fa,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.65,
  });
  const ringMesh = new THREE.Mesh(ringGeo, ringMat);
  ringMesh.rotation.x = -Math.PI / 2;
  ringMesh.position.y = 0.002;
  pedestalGroup.add(ringMesh);

  const gridHelper = new THREE.PolarGridHelper(1.1, 12, 5, 64, 0x334155, 0x1e293b);
  gridHelper.position.y = 0.001;
  pedestalGroup.add(gridHelper);
  scene.add(pedestalGroup);

  const modelRoot = new THREE.Group();
  scene.add(modelRoot);

  const wireOverlayRoot = new THREE.Group();
  scene.add(wireOverlayRoot);

  const loader = new GLTFLoader();
  const clock = new THREE.Clock();

  let mixer = null;
  let animations = [];
  let activeAnimIdx = 0;
  let currentAction = null;

  let autoRotateEnabled = true;
  const speedPresets = [
    { label: '⚡ 1x', speed: 3.6 },
    { label: '🏃 2x', speed: 7.2 },
    { label: '🚀 4x', speed: 14.4 },
    { label: '🐢 0.5x', speed: 1.8 },
    { label: '↩️ -1x', speed: -3.6 },
  ];
  let speedIdx = 0;

  let wireMode = 0;
  let pedestalVisible = true;
  const bgClasses = ['', 'bg-emerald', 'bg-black', 'bg-light', 'bg-checker'];
  let bgIdx = 0;

  const camPresets = [
    { name: '3/4', pos: [0, 1.38, 3.35], target: [0, 0.92, 0] },
    { name: 'Front', pos: [0, 1.05, 3.2], target: [0, 0.95, 0] },
    { name: 'Side', pos: [3.2, 1.1, 0], target: [0, 0.95, 0] },
    { name: 'Top', pos: [0, 4.2, 0.01], target: [0, 0, 0] },
  ];
  let camPresetIdx = 0;

  let runtimeStats = {
    triangles: 0,
    vertices: 0,
    meshes: 0,
    materials: 0,
    bones: 0,
    bboxSize: [0, 0, 0],
  };

  function formatBytes(b) {
    if (!b) return '0 B';
    if (b < 1024) return b + ' B';
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
    return (b / (1024 * 1024)).toFixed(2) + ' MB';
  }

  function formatNum(n) {
    return Number(n || 0).toLocaleString('it-IT');
  }

  function base64ToArrayBuffer(b64) {
    const bin = atob(b64);
    const len = bin.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    return bytes.buffer;
  }

  function updateGifBadge() {
    const pill = document.getElementById('gif-pill');
    const txt = document.getElementById('gif-status-text');
    const btn = document.getElementById('btn-autorotate');
    const preset = speedPresets[speedIdx];
    if (autoRotateEnabled) {
      pill.classList.remove('paused');
      txt.textContent = 'AUTO-ROTATE GIF • ' + preset.label.replace(/^[^ ]+ /, '');
      btn.classList.add('active');
    } else {
      pill.classList.add('paused');
      txt.textContent = 'PAUSED (SPAZIO PER PLAY)';
      btn.classList.remove('active');
    }
  }

  function updateNavUI() {
    const total = Math.max(1, siblings.length);
    const cur = siblings.length > 0 ? currentIndex + 1 : 1;
    document.getElementById('model-counter').textContent = cur + ' / ' + total;

    const disablePrev = siblings.length <= 1 || currentIndex <= 0;
    const disableNext = siblings.length <= 1 || currentIndex >= siblings.length - 1;
    document.getElementById('top-prev').disabled = disablePrev;
    document.getElementById('top-next').disabled = disableNext;
    document.getElementById('mega-prev').disabled = disablePrev;
    document.getElementById('mega-next').disabled = disableNext;

    const sel = document.getElementById('sibling-select');
    const titleEl = document.getElementById('filename');
    if (siblings.length > 1) {
      sel.style.display = 'inline-block';
      titleEl.style.display = 'none';
      sel.innerHTML = '';
      siblings.forEach((s, idx) => {
        const opt = document.createElement('option');
        opt.value = s.file;
        opt.textContent = (idx + 1) + '. ' + s.filename;
        if (idx === currentIndex) opt.selected = true;
        sel.appendChild(opt);
      });
    } else {
      sel.style.display = 'none';
      titleEl.style.display = 'inline';
    }
  }

  document.getElementById('sibling-select').addEventListener('change', (e) => {
    if (e.target.value) loadGlb(e.target.value);
  });

  function clearCurrentModel() {
    if (mixer) {
      mixer.stopAllAction();
      mixer = null;
    }
    animations = [];
    currentAction = null;
    while (modelRoot.children.length > 0) {
      modelRoot.remove(modelRoot.children[0]);
    }
    while (wireOverlayRoot.children.length > 0) {
      wireOverlayRoot.remove(wireOverlayRoot.children[0]);
    }
  }

  function applyWireframeMode() {
    const btn = document.getElementById('btn-wire');
    btn.classList.toggle('active', wireMode > 0);
    if (wireMode === 0) {
      btn.textContent = '🕸️ Wire';
    } else if (wireMode === 1) {
      btn.textContent = '🕸️ Overlay';
    } else {
      btn.textContent = '🕸️ Pure';
    }

    wireOverlayRoot.visible = wireMode === 1;
    modelRoot.traverse((child) => {
      if (child.isMesh && child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((m) => {
          m.wireframe = wireMode === 2;
        });
      }
    });
  }

  function populateInfoDrawer() {
    if (!glbMeta) return;
    const grid = document.getElementById('info-grid');
    const dims = runtimeStats.bboxSize.map((v) => v.toFixed(2)).join(' × ');
    const rows = [
      ['File', glbMeta.filename],
      ['Dimensione', formatBytes(glbMeta.sizeBytes)],
      ['Triangoli', formatNum(runtimeStats.triangles)],
      ['Vertici', formatNum(runtimeStats.vertices)],
      ['Mesh / Nodi', runtimeStats.meshes + ' / ' + (glbMeta.nodesCount || '–')],
      ['Materiali / Tex', runtimeStats.materials + ' / ' + (glbMeta.texturesCount || 0)],
      ['Ossa (Rig)', formatNum(runtimeStats.bones)],
      ['Animazioni', String(animations.length)],
      ['BBox (orig)', dims],
      ['glTF / Gen', (glbMeta.gltfVersion || '2.0') + (glbMeta.generator ? ' • ' + glbMeta.generator : '')],
    ];
    grid.innerHTML = rows
      .map(([k, v]) => '<dt>' + k + '</dt><dd>' + v + '</dd>')
      .join('');
    document.getElementById('info-extra').innerHTML =
      '<b>Percorso:</b> <code>' + glbMeta.file + '</code>';
  }

  async function renderFromBundle(bundle) {
    const info = bundle.info;
    glbMeta = info;
    currentFile = info.file;
    siblings = info.siblings || [];
    currentIndex = info.currentIndex || 0;

    document.getElementById('filename').textContent = info.filename;
    document.getElementById('filename').title = info.file;
    document.getElementById('size-badge').textContent = formatBytes(info.sizeBytes);
    updateNavUI();

    const arrayBuffer = base64ToArrayBuffer(bundle.base64);
    const gltf = await new Promise((resolveLoad, rejectLoad) => {
      loader.parse(arrayBuffer, '', resolveLoad, rejectLoad);
    });

    clearCurrentModel();

    const model = gltf.scene || gltf.scenes[0];

    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    runtimeStats.bboxSize = [size.x, size.y, size.z];

    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    const targetScale = 1.95 / maxDim;
    model.scale.setScalar(targetScale);

    const scaledBox = new THREE.Box3().setFromObject(model);
    const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
    model.position.x -= scaledCenter.x;
    model.position.z -= scaledCenter.z;
    model.position.y -= scaledBox.min.y;

    let tris = 0;
    let verts = 0;
    let meshes = 0;
    let bones = 0;
    const matSet = new Set();

    model.traverse((child) => {
      if (child.isBone) bones++;
      if (child.isMesh) {
        meshes++;
        child.castShadow = true;
        child.receiveShadow = true;
        const geo = child.geometry;
        if (geo) {
          const pos = geo.attributes.position;
          if (pos) verts += pos.count;
          if (geo.index) {
            tris += Math.round(geo.index.count / 3);
          } else if (pos) {
            tris += Math.round(pos.count / 3);
          }
        }
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((m) => {
          if (!m) return;
          matSet.add(m.uuid);
          if (geo && geo.attributes.color && !m.map) {
            m.vertexColors = true;
            m.needsUpdate = true;
          }
        });
      }
    });

    runtimeStats.triangles = tris;
    runtimeStats.vertices = verts;
    runtimeStats.meshes = meshes;
    runtimeStats.materials = matSet.size;
    runtimeStats.bones = bones;

    modelRoot.add(model);

    const wireClone = model.clone(true);
    const wireOverlayMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: true,
      transparent: true,
      opacity: 0.38,
      depthTest: true,
    });
    wireClone.traverse((c) => {
      if (c.isMesh) c.material = wireOverlayMat;
    });
    wireOverlayRoot.add(wireClone);
    applyWireframeMode();

    const finalBox = new THREE.Box3().setFromObject(model);
    const finalHeight = Math.max(0.4, finalBox.max.y - finalBox.min.y);
    controls.target.set(0, finalHeight * 0.48, 0);
    controls.update();

    animations = gltf.animations || [];
    const animBtn = document.getElementById('btn-anim');
    if (animations.length > 0) {
      mixer = new THREE.AnimationMixer(model);
      activeAnimIdx = 0;
      currentAction = mixer.clipAction(animations[0]);
      currentAction.play();
      animBtn.style.display = 'inline-flex';
      animBtn.classList.add('active');
      animBtn.textContent = '🎬 ' + (animations[0].name || 'Anim 1') + ' (' + animations.length + ')';
    } else {
      animBtn.style.display = 'none';
    }

    document.getElementById('poly-pill').textContent =
      formatNum(tris) + ' tris • ' + formatNum(verts) + ' verts • ' + meshes + (meshes === 1 ? ' mesh' : ' meshes');

    populateInfoDrawer();
    statusOverlay.style.display = 'none';
    clientLog('rendered-ok', { file: info.filename, tris, verts, meshes, siblings: siblings.length });
  }

  async function fetchBundle(filePath) {
    // 1. Try sidecar SDK secureFetch POST
    if (window.sidecar && typeof window.sidecar.fetch === 'function') {
      try {
        const res = await window.sidecar.fetch('/api/bundle', {
          method: 'POST',
          body: JSON.stringify({ file: filePath }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.info && data.base64) return data;
        }
      } catch (e) {
        console.warn('[glb-viewer] sidecar.fetch fallback:', e);
      }
    }
    // 2. Try relative GET api/bundle
    const q = new URLSearchParams(window.location.search);
    if (filePath) q.set('file', filePath);
    const res = await fetch('api/bundle?' + q.toString());
    return await res.json();
  }

  async function loadGlb(filePath) {
    statusOverlay.style.display = 'flex';
    statusText.textContent = '⏳ Caricamento 3D ' + (filePath ? filePath.split('/').pop() : '') + '...';

    try {
      if (
        window.__INITIAL_GLB_BUNDLE__ &&
        window.__INITIAL_GLB_BUNDLE__.info &&
        window.__INITIAL_GLB_BUNDLE__.base64 &&
        (!filePath || window.__INITIAL_GLB_BUNDLE__.info.file === filePath)
      ) {
        const b = window.__INITIAL_GLB_BUNDLE__;
        window.__INITIAL_GLB_BUNDLE__ = null;
        await renderFromBundle(b);
        return;
      }

      const bundle = await fetchBundle(filePath);
      if (bundle.error) {
        statusText.textContent = '⚠️ ' + bundle.error;
        return;
      }
      await renderFromBundle(bundle);
    } catch (err) {
      console.error('[glb-viewer] load error:', err);
      statusOverlay.style.display = 'flex';
      statusText.textContent = '⚠️ Errore caricamento GLB: ' + err.message;
      clientLog('render-error', { error: err.message, stack: err.stack });
    }
  }

  window.stepModel = (delta) => {
    if (siblings.length <= 1) return;
    const nextIdx = Math.max(0, Math.min(siblings.length - 1, currentIndex + delta));
    if (nextIdx !== currentIndex) {
      loadGlb(siblings[nextIdx].file);
    }
  };

  window.toggleAutoRotate = () => {
    autoRotateEnabled = !autoRotateEnabled;
    controls.autoRotate = autoRotateEnabled;
    updateGifBadge();
  };

  window.cycleSpeed = () => {
    speedIdx = (speedIdx + 1) % speedPresets.length;
    const preset = speedPresets[speedIdx];
    controls.autoRotateSpeed = preset.speed;
    document.getElementById('btn-speed').textContent = preset.label;
    if (!autoRotateEnabled) {
      autoRotateEnabled = true;
      controls.autoRotate = true;
    }
    updateGifBadge();
  };

  window.cycleWireframe = () => {
    wireMode = (wireMode + 1) % 3;
    applyWireframeMode();
  };

  window.togglePedestal = () => {
    pedestalVisible = !pedestalVisible;
    pedestalGroup.visible = pedestalVisible;
    document.getElementById('btn-pedestal').classList.toggle('active', pedestalVisible);
  };

  window.cycleBackground = () => {
    const wrapper = document.getElementById('viewport-wrapper');
    bgClasses.forEach((cls) => { if (cls) wrapper.classList.remove(cls); });
    bgIdx = (bgIdx + 1) % bgClasses.length;
    if (bgClasses[bgIdx]) wrapper.classList.add(bgClasses[bgIdx]);
  };

  window.cycleCameraPreset = () => {
    camPresetIdx = (camPresetIdx + 1) % camPresets.length;
    const p = camPresets[camPresetIdx];
    camera.position.set(p.pos[0], p.pos[1], p.pos[2]);
    controls.target.set(p.target[0], p.target[1], p.target[2]);
    controls.update();
    document.getElementById('btn-cam').textContent = '🎥 ' + p.name;
  };

  window.cycleAnimation = () => {
    if (!mixer || animations.length === 0) return;
    activeAnimIdx = (activeAnimIdx + 1) % (animations.length + 1);
    const animBtn = document.getElementById('btn-anim');
    mixer.stopAllAction();
    if (activeAnimIdx === animations.length) {
      animBtn.classList.remove('active');
      animBtn.textContent = '🎬 Posa Statica';
    } else {
      const clip = animations[activeAnimIdx];
      currentAction = mixer.clipAction(clip);
      currentAction.reset().play();
      animBtn.classList.add('active');
      animBtn.textContent = '🎬 ' + (clip.name || ('Anim ' + (activeAnimIdx + 1)));
    }
  };

  window.toggleInfoDrawer = () => {
    const drawer = document.getElementById('info-drawer');
    const open = drawer.style.display === 'block';
    drawer.style.display = open ? 'none' : 'block';
    document.getElementById('btn-info').classList.toggle('active', !open);
  };

  window.copyPngSnapshot = async () => {
    const btn = document.getElementById('btn-snap');
    const orig = btn.textContent;
    try {
      renderer.render(scene, camera);
      const blob = await new Promise((r) => renderer.domElement.toBlob(r, 'image/png'));
      if (blob && navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        btn.textContent = '✅ PNG Copiato!';
      } else {
        const url = renderer.domElement.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
        a.download = (glbMeta?.filename || 'model').replace(/\\.(glb|gltf)$/i, '') + '-snapshot.png';
        a.click();
        btn.textContent = '💾 Scaricato!';
      }
    } catch (e) {
      console.error(e);
      btn.textContent = '⚠️ Errore';
    }
    setTimeout(() => { btn.textContent = orig; }, 2000);
  };

  window.sendToChat = async () => {
    if (!glbMeta) return;
    const btn = document.getElementById('btn-chat');
    const orig = btn.textContent;
    try {
      btn.textContent = '⏳...';
      const msg =
        '🧊 **[' + glbMeta.filename + '](file://' + glbMeta.file + ')** (' + formatBytes(glbMeta.sizeBytes) + ')\\n' +
        '- **Poligoni:** ' + formatNum(runtimeStats.triangles) + ' triangoli (' + formatNum(runtimeStats.vertices) + ' vertici)\\n' +
        '- **Mesh / Materiali:** ' + runtimeStats.meshes + ' mesh, ' + runtimeStats.materials + ' materiali\\n' +
        '- **Animazioni / Ossa:** ' + animations.length + ' animazioni, ' + runtimeStats.bones + ' ossa';

      if (window.sidecar?.agent?.sendMessage) {
        const convId = params.get('conversationId') || window.sidecar.conversationId;
        if (convId) {
          await window.sidecar.agent.sendMessage(msg, convId);
          btn.textContent = '✅ Inviato!';
          setTimeout(() => { btn.textContent = orig; }, 2000);
          return;
        }
      }
      await navigator.clipboard.writeText(msg);
      btn.textContent = '📋 Copiato!';
    } catch (e) {
      console.error(e);
      btn.textContent = '⚠️ Errore';
    }
    setTimeout(() => { btn.textContent = orig; }, 2000);
  };

  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      e.preventDefault();
      window.stepModel(-1);
    } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
      e.preventDefault();
      window.stepModel(1);
    } else if (e.key === ' ') {
      e.preventDefault();
      window.toggleAutoRotate();
    } else if (e.key === 'w' || e.key === 'W') {
      window.cycleWireframe();
    }
  });

  const ro = new ResizeObserver(() => {
    const w = container.clientWidth || 640;
    const h = container.clientHeight || 480;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
  ro.observe(container);

  function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();
    if (mixer) mixer.update(dt);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  updateGifBadge();
  loadGlb(currentFile);
})();
</script>
</body>
</html>`;
}

function findDefaultFallbackGlb() {
  const home = homedir();
  const candidates = [
    join(CURRENT_DIR, 'mini-test-turntable.glb'),
    join(CURRENT_DIR, '..', '..', 'assets', 'models', 'mini-test-turntable.glb'),
    join(home, '.gemini', 'antigravity', 'worktrees', 'carchess3d', 'auto_rotating_glb_viewer', 'assets', 'models', 'mini-test-turntable.glb'),
    join(home, 'git', 'carchess3d', 'assets', 'models', 'mini-test-turntable.glb'),
    join(home, '.gemini', 'antigravity', 'worktrees', 'carchess3d', 'auto_rotating_glb_viewer', 'assets', 'models', 'king-riccardo-10k.glb'),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

app.page('/', () => renderViewHtml(null));
app.page('/view.html', () => renderViewHtml(null));

const handleBundleRequest = (data) => {
  const raw = data.file || data.path || data.uri || '';
  const filePath = normalizeFilePath(raw) || findDefaultFallbackGlb();
  if (!filePath) {
    return { error: `File GLB/GLTF non trovato: ${raw || '(nessun file specificato)'}` };
  }
  return getGlbBundle(filePath);
};

app.api('/api/bundle', handleBundleRequest, 'GET');
app.api('/api/bundle', handleBundleRequest, 'POST');

app.api('/api/client-log', (data) => {
  console.log('[glb-viewer][CLIENT]', data.msg || '', JSON.stringify(data.extra || {}));
  return { ok: true };
}, 'GET');
app.api('/api/client-log', (data) => {
  console.log('[glb-viewer][CLIENT]', data.msg || '', JSON.stringify(data.extra || {}));
  return { ok: true };
}, 'POST');

app.api('/api/info', (data) => {
  const raw = data.file || data.path || data.uri || '';
  const filePath = normalizeFilePath(raw) || findDefaultFallbackGlb();
  if (!filePath) {
    return { error: `File GLB/GLTF non trovato: ${raw || '(nessun file specificato)'}` };
  }
  return getGlbInfo(filePath);
}, 'GET');

app.api('/raw.glb', (data) => {
  const filePath = normalizeFilePath(data.file || data.path || data.uri) || findDefaultFallbackGlb();
  if (!filePath) {
    return new Response('File not found', { status: 404, contentType: 'text/plain' });
  }
  const buf = readFileSync(filePath);
  const isGltf = filePath.toLowerCase().endsWith('.gltf');
  return new Response(buf, {
    status: 200,
    contentType: isGltf ? 'model/gltf+json' : 'model/gltf-binary',
    headers: {
      'Content-Disposition': `inline; filename="${basename(filePath)}"`,
      'Cache-Control': 'private, max-age=30',
    },
  });
}, 'GET');

// Intercept GET /view.html and GET / so we can pre-bundle the requested ?file= right into the HTML!
const origRun = app.run.bind(app);
app.run = async () => {
  const server = await origRun();
  const origListeners = server.listeners('request');
  server.removeAllListeners('request');
  server.on('request', (req, res) => {
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      console.log(`[glb-viewer] ${req.method} ${url.pathname}${url.search}`);
      if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/view.html')) {
        const rawFile =
          url.searchParams.get('file') ||
          url.searchParams.get('path') ||
          url.searchParams.get('uri') ||
          '';
        const resolved = normalizeFilePath(rawFile) || findDefaultFallbackGlb();
        let initialBundle = null;
        if (resolved) {
          try {
            initialBundle = getGlbBundle(resolved);
          } catch (err) {
            console.warn('[glb-viewer] bundle pre-load error:', err.message);
          }
        }
        const html = renderViewHtml(initialBundle);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
        return;
      }
    } catch (err) {
      console.error('[glb-viewer] request interceptor error:', err.message);
    }
    for (const listener of origListeners) {
      listener.call(server, req, res);
    }
  });
  return server;
};

app.run();
