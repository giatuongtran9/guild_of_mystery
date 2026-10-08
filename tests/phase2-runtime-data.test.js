const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const builder = path.join(root, 'scripts/build-runtime-data.js');
assert(fs.existsSync(builder), 'runtime data must have a repeatable build script');
const { buildRuntimeData } = require(builder);
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'guild-runtime-data-test-'));
try {
  fs.cpSync(path.join(root, 'data'), path.join(temp, 'data'), { recursive: true, filter: name => !name.includes(`${path.sep}assets`) && !name.includes(`${path.sep}runtime`) });
  fs.mkdirSync(path.join(temp, 'js'));
  for (const name of ['paths', 'v15', 'generate', 'engine', 'state', 'campaign', 'ui']) fs.writeFileSync(path.join(temp, `js/${name}.js`), `// ${name}\n`);
  for (const name of ['data-loader', 'boot']) fs.writeFileSync(path.join(temp, `js/${name}.js`), `// ${name}\n`);
  fs.mkdirSync(path.join(temp, 'css')); fs.writeFileSync(path.join(temp, 'css/tokens.css'), ':root { color: white; }\n');
  fs.writeFileSync(path.join(temp, 'index.html'), '<link rel="stylesheet" href="css/tokens.css">\n<script src="js/data-loader.js"></script>\n<script src="js/boot.js"></script>\n');
  fs.writeFileSync(path.join(temp, 'sw.js'), '// service worker\n');
  const originals = fs.readdirSync(path.join(temp, 'data')).filter(name => name.endsWith('.json')).map(name => path.join(temp, 'data', name));
  for (const name of fs.readdirSync(path.join(temp, 'data/pathways'))) originals.push(path.join(temp, 'data/pathways', name));
  const before = Object.fromEntries(originals.map(file => [file, hash(file)]));
  const first = buildRuntimeData({ root: temp });
  const html = fs.readFileSync(path.join(temp, 'index.html'), 'utf8');
  assert.match(html, /href="css\/tokens\.css\?v=[a-f0-9]{16}"/, 'stylesheet URL must use its content hash');
  assert.match(html, /src="js\/data-loader\.js\?v=[a-f0-9]{16}"/, 'loader URL must use its content hash');
  assert.match(html, /src="js\/boot\.js\?v=[a-f0-9]{16}"/, 'bootstrap URL must use its content hash');
  const manifest = JSON.parse(fs.readFileSync(path.join(temp, 'data/runtime/manifest.json')));
  const bytes = fs.readFileSync(path.join(temp, manifest.bundle));
  const bundle = JSON.parse(bytes);
  assert.equal(manifest.schema, 'guild.runtime-manifest.v1');
  assert.equal(manifest.version, crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 16));
  assert.equal(bundle.schema, 'guild.runtime-data.v1');
  assert.equal(Object.keys(bundle.pathwayFiles).length, 22);
  assert.equal(Object.values(bundle.pathwayFiles).reduce((n, p) => n + p.sequences.length, 0), 220);
  assert.equal(Object.keys(manifest.scriptVersions).length, 7);
  assert.match(manifest.serviceWorkerVersion, /^[a-f0-9]{16}$/);
  for (const file of originals) assert.equal(hash(file), before[file], `authored JSON changed: ${file}`);
  assert.equal(buildRuntimeData({ root: temp }).version, first.version, 'same inputs must create identical releases');
  assert.equal(fs.readFileSync(path.join(temp, 'index.html'), 'utf8'), html, 'unchanged builds must not change index.html');
  assert.doesNotThrow(() => buildRuntimeData({ root: temp, check: true }));
  fs.writeFileSync(path.join(temp, 'css/tokens.css'), ':root { color: blue; }\n');
  fs.writeFileSync(path.join(temp, 'js/boot.js'), '// new bootstrap\n');
  assert.throws(() => buildRuntimeData({ root: temp, check: true }), /stale|out.of.date|rebuild/i);
  assert.equal(buildRuntimeData({ root: temp }).version, first.version, 'CSS/bootstrap changes must not duplicate unchanged gameplay payloads');
  const refreshedHTML = fs.readFileSync(path.join(temp, 'index.html'), 'utf8');
  assert.notEqual(refreshedHTML.match(/css\/tokens\.css\?v=([a-f0-9]+)/)[1], html.match(/css\/tokens\.css\?v=([a-f0-9]+)/)[1]);
  assert.notEqual(refreshedHTML.match(/js\/boot\.js\?v=([a-f0-9]+)/)[1], html.match(/js\/boot\.js\?v=([a-f0-9]+)/)[1]);
  const balanceFile = path.join(temp, 'data/balance.json');
  const balance = JSON.parse(fs.readFileSync(balanceFile)); balance.system.phase2Probe = 'fresh-data';
  fs.writeFileSync(balanceFile, JSON.stringify(balance));
  assert.throws(() => buildRuntimeData({ root: temp, check: true }), /stale|out.of.date|rebuild/i);
  const next = buildRuntimeData({ root: temp });
  assert.notEqual(next.version, first.version, 'changed authored data must change the payload URL');
  fs.writeFileSync(path.join(temp, 'js/ui.js'), '// updated UI\n');
  assert.throws(() => buildRuntimeData({ root: temp, check: true }), /stale|out.of.date|rebuild/i);
  const scriptRelease = buildRuntimeData({ root: temp });
  assert.equal(scriptRelease.version, next.version, 'script-only updates must not duplicate unchanged gameplay payloads');
  assert.notEqual(scriptRelease.scriptVersions['js/ui.js'], manifest.scriptVersions['js/ui.js']);
  fs.mkdirSync(path.join(temp, 'data/assets/runtime/characters'), { recursive: true });
  const source = 'data/assets/characters/fool/fool_seq9.png';
  const descriptor = size => ({ src: `data/assets/runtime/characters/fool/fool_seq9.${size}.0123456789abcdef.webp`, width: size, height: size, bytes: 12345, sha256: '0'.repeat(64) });
  const art = { schemaVersion: 1, version: '1234567890abcdef', entries: {
    [source]: { source: { src: source, width: 1254, height: 1254, bytes: 999999, sha256: '1'.repeat(64) }, portrait: descriptor(192), dossier: descriptor(384) }
  } };
  fs.writeFileSync(path.join(temp, 'data/assets/runtime/characters/manifest.json'), JSON.stringify(art));
  const artRelease = buildRuntimeData({ root: temp });
  const compact = JSON.parse(fs.readFileSync(path.join(temp, artRelease.bundle))).runtimeAssets;
  assert.deepEqual(compact, { schemaVersion: 1, version: art.version, entries: {
    [source]: { portrait: { src: descriptor(192).src, width: 192, height: 192 }, dossier: { src: descriptor(384).src, width: 384, height: 384 } }
  } }, 'the boot payload must preserve lookup URLs/dimensions without shipping unused source/output byte counts and hashes');
  assert.notEqual(artRelease.version, next.version, 'changed portrait release must change the payload URL');
  art.entries[source].portrait.src = 'data/assets/runtime/characters/fool/fool_seq9.192.extra.0123456789abcdef.webp';
  fs.writeFileSync(path.join(temp, 'data/assets/runtime/characters/manifest.json'), JSON.stringify(art));
  assert.throws(() => buildRuntimeData({ root: temp }), /Invalid versioned runtime portrait/i, 'portrait paths must match the exact content-versioned filename contract');
  // Existing output files and ancestors must stay inside the selected repository.
  fs.writeFileSync(path.join(temp, 'data/assets/runtime/characters/manifest.json'), JSON.stringify({ schemaVersion: 1, version: art.version, entries: {} }));
  const confinement = fs.mkdtempSync(path.join(os.tmpdir(), 'guild-runtime-outside-'));
  const output = path.join(temp, 'data/runtime');
  try {
    fs.rmSync(output, { recursive: true, force: true });
    fs.symlinkSync(confinement, output, 'dir');
    assert.throws(() => buildRuntimeData({ root: temp }), /symlink|inside|confine|repository/i, 'symlinked output directories must be rejected before writing');
    assert.equal(fs.readdirSync(confinement).length, 0, 'no output may escape the selected repository');
  } finally { fs.unlinkSync(output); fs.rmSync(confinement, { recursive: true, force: true }); }
  buildRuntimeData({ root: temp });
  for (const relative of ['data/runtime/manifest.json', 'index.html', 'css/tokens.css', 'data/balance.json']) {
    const file = path.join(temp, relative), backup = `${file}.fixture-backup`;
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'guild-runtime-link-'));
    const target = path.join(outside, 'protected');
    fs.writeFileSync(target, 'must remain untouched');
    fs.renameSync(file, backup); fs.symlinkSync(target, file);
    try {
      assert.throws(() => buildRuntimeData({ root: temp }), /symlink|inside|confine|repository/i, `symlinked ${relative} must be rejected`);
      assert.equal(fs.readFileSync(target, 'utf8'), 'must remain untouched');
    } finally { fs.unlinkSync(file); fs.renameSync(backup, file); fs.rmSync(outside, { recursive: true, force: true }); }
  }
  console.log('PASS runtime data build: deterministic versioning, 29-file/220-rank parity, immutable originals, stale-build check, script/SW versions, portrait manifest inclusion.');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
