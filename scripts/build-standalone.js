#!/usr/bin/env node
// Build script: generates a self-contained index.html from the admin source
// Usage: node scripts/build-standalone.js

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf-8');

// --- Read source files ---
let html = read('public/admin/index.html');
const themeCss = read('public/shared/theme.css');
const boardCss = read('public/shared/board.css');
const charsJs = read('public/shared/chars.js');
const audioJs = read('public/shared/audio.js');
const boardJs = read('public/shared/board.js');
const storageLocalJs = read('public/shared/storage-local.js');

// --- Strip ES module export/import keywords from shared modules ---
function stripModuleSyntax(code) {
  // Remove import lines
  code = code.replace(/^import\s+.*$/gm, '');
  // Remove 'export ' prefix from declarations
  code = code.replace(/^export\s+/gm, '');
  return code;
}

const charsInline = stripModuleSyntax(charsJs);
const audioInline = stripModuleSyntax(audioJs);
const boardInline = stripModuleSyntax(boardJs);
const storageLocalInline = stripModuleSyntax(storageLocalJs);

// --- Transform the HTML ---

// 1. Change title
html = html.replace(
  /<title>Flippy Board — Admin<\/title>/,
  '<title>Flippy Board</title>'
);

// 2. Inline CSS (replace link tags with style blocks)
html = html.replace(
  /<link rel="stylesheet" href="\/shared\/board\.css">\s*\n\s*<link rel="stylesheet" href="\/shared\/theme\.css">/,
  `<style>\n${themeCss}\n${boardCss}\n</style>`
);

// 3. Change toolbar title (remove "admin" label)
html = html.replace(
  /Flippy Board <span style="font-weight:400;font-size:11px;opacity:0.6">admin<\/span>/,
  'Flippy Board'
);

// 4. Change sound button (standalone label)
html = html.replace(
  /<span id="sound-label">Sound: Display<\/span>/,
  '<span id="sound-label">Sound: On</span>'
);

// 5. Add fullscreen button after sound button
const fullscreenBtn = `
  <button class="toolbar-btn" id="btn-fullscreen" title="Fullscreen">
    <svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
    <span>Fullscreen</span>
  </button>`;
html = html.replace(
  '</div>\n\n<div class="board-frame">',
  fullscreenBtn + '\n</div>\n\n<div class="board-frame">'
);

// 6. Add API tab button and pane
html = html.replace(
  '<button class="tab" data-tab="settings">Settings</button>',
  '<button class="tab" data-tab="settings">Settings</button>\n    <button class="tab" data-tab="api">API</button>'
);

const apiPane = `
    <!-- API -->
    <div class="tab-pane" id="pane-api">
      <div class="api-section">
        <h4>BroadcastChannel API</h4>
        <p style="color:var(--text-dim);line-height:1.5;margin-bottom:4px">
          Send messages from any script running on the same origin using <code style="color:var(--accent)">BroadcastChannel</code>.
        </p>
        <div class="code-block"><span class="cmt">// From any page on the same origin:</span>
<span class="kw">const</span> ch = <span class="kw">new</span> BroadcastChannel(<span class="str">'splitflap'</span>);
ch.postMessage({ <span class="str">text</span>: <span class="str">'HELLO WORLD'</span> });

<span class="cmt">// Set specific rows (array of strings):</span>
ch.postMessage({ <span class="str">rows</span>: [<span class="str">'LINE ONE'</span>, <span class="str">'LINE TWO'</span>] });

<span class="cmt">// Clear the board:</span>
ch.postMessage({ <span class="str">clear</span>: <span class="kw">true</span> });

<span class="cmt">// Colour tiles — use {R} {O} {Y} {G} {B} {V} {W}:</span>
ch.postMessage({ <span class="str">text</span>: <span class="str">'{R}{R}{R} ALERT {R}{R}{R}'</span> });</div>
      </div>
      <div class="api-section">
        <h4>Window PostMessage</h4>
        <p style="color:var(--text-dim);line-height:1.5;margin-bottom:4px">
          If embedding this page in an iframe, use <code style="color:var(--accent)">postMessage</code>.
        </p>
        <div class="code-block"><span class="cmt">// From parent page:</span>
<span class="kw">const</span> iframe = document.getElementById(<span class="str">'splitflap'</span>);
iframe.contentWindow.postMessage(
  { <span class="str">text</span>: <span class="str">'HELLO FROM PARENT'</span> },
  <span class="str">'*'</span>
);</div>
      </div>
      <div class="api-section">
        <h4>Bookmarklet</h4>
        <p style="color:var(--text-dim);line-height:1.5;margin-bottom:4px">
          Drag this to your bookmarks bar, then click it on any page to send text to the board:
        </p>
        <div class="code-block" style="user-select:all;cursor:copy">javascript:void(new BroadcastChannel('splitflap').postMessage({text:prompt('Message:')}))</div>
      </div>
    </div>`;

// Insert API pane before the settings pane
html = html.replace(
  '    <!-- SETTINGS -->',
  apiPane + '\n\n    <!-- SETTINGS -->'
);

// 7. Replace the module script with inline script
// Extract the script content between <script type="module"> and </script>
const scriptMatch = html.match(/<script type="module">([\s\S]*?)<\/script>/);
if (!scriptMatch) {
  console.error('Could not find <script type="module"> block');
  process.exit(1);
}

let adminScript = scriptMatch[1];

// Remove import lines from admin script
adminScript = adminScript.replace(/^import\s+.*$/gm, '');

// Replace the StorageAPI instantiation with StorageLocal
// StorageLocal needs handleWsMessage as a callback, but it's defined later.
// Use a wrapper function that forwards to handleWsMessage once it exists.
adminScript = adminScript.replace(
  /\/\/ In admin mode this is StorageAPI.*\nconst storage = new StorageAPI\(\);/,
  'const storage = new StorageLocal((msg) => handleWsMessage(msg));'
);

// Remove the WebSocket connection code block (connectWs function and ws variable setup)
// We keep handleWsMessage because StorageLocal calls it
adminScript = adminScript.replace(
  /\/\/ --- WebSocket for live preview ---\nlet ws = null;\nlet reconnectDelay = 1000;/,
  ''
);
adminScript = adminScript.replace(
  /function connectWs\(\) \{[\s\S]*?\n\}/,
  ''
);

// Replace the conditional init block
adminScript = adminScript.replace(
  /if \(!window\.__STANDALONE__\) \{\n\s*connectWs\(\);\n\} else \{/,
  '{'
);

// Build the standalone script with all modules inlined
const standaloneScript = `
window.__STANDALONE__ = true;

// --- chars.js ---
${charsInline}

// --- audio.js ---
${audioInline}

// --- board.js ---
${boardInline}

// --- storage-local.js ---
${storageLocalInline}

// --- Admin logic (adapted) ---
${adminScript}

// --- Standalone extras ---

// BroadcastChannel listener
try {
  const channel = new BroadcastChannel('splitflap');
  channel.onmessage = (e) => {
    const d = e.data;
    if (!d) return;
    storage.stopQueue();
    if (d.clear) { storage.displayClear(); return; }
    if (d.rows && Array.isArray(d.rows)) { handleWsMessage({ action: 'setRows', rows: d.rows }); return; }
    if (d.text) { storage.displayText({ text: d.text }); return; }
  };
} catch {}

// postMessage listener (for iframe embedding)
window.addEventListener('message', (e) => {
  const d = e.data;
  if (!d || typeof d !== 'object') return;
  storage.stopQueue();
  if (d.clear) { storage.displayClear(); return; }
  if (d.rows && Array.isArray(d.rows)) { handleWsMessage({ action: 'setRows', rows: d.rows }); return; }
  if (d.text) { storage.displayText({ text: d.text }); return; }
});

// Fullscreen button
document.getElementById('btn-fullscreen').addEventListener('click', () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen();
  }
});
`;

// Replace the entire script tag
html = html.replace(
  /<script type="module">[\s\S]*?<\/script>/,
  '<script>\n' + standaloneScript + '\n</script>'
);

// --- Write output ---
const outPath = path.join(ROOT, 'index.html');
fs.writeFileSync(outPath, html, 'utf-8');
console.log('Built standalone: ' + outPath);
console.log('Size: ' + (Buffer.byteLength(html) / 1024).toFixed(1) + ' KB');
