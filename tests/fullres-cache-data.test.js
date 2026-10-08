'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const { buildRuntimeData } = require('../scripts/build-runtime-data.js');
let passed = 0, failed = 0;
async function test(name, body) {
  try { await body(); passed++; console.log('PASS ' + name); }
  catch (error) { failed++; console.error('FAIL ' + name + ': ' + error.message); }
}
function worker(options = {}) {
  const events = {}, files = new Map(), stats = { fetches: 0 };
  const self = { registration: { scope: 'https://example.test/guild_of_mystery/' },
    addEventListener: (name, handler) => events[name] = handler };
  const caches = { open: async () => {
    if (options.openFail) throw Error('denied');
    return { match: async request => files.get(request.url)?.clone(), put: async (request, response) => {
      if (options.putFail) throw Error('quota');
      files.set(request.url, response.clone());
    } };
  } };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'sw.js'), 'utf8'), { self, caches, URL,
    fetch: async () => { stats.fetches++; return new Response('unchanged original PNG', { status: options.status || 200 }); } }, { filename: path.join(root, 'sw.js') });
  const request = (relative, init = {}) => new Request(new URL(relative, self.registration.scope), init);
  const dispatch = async request => { let result = null; events.fetch({ request, respondWith: value => result = value }); return result; };
  return { files, stats, request, dispatch };
}
const original = 'data/assets/characters/fool/fool_seq9.png';
const full = original + '?v=1111111111111111';
const descriptor = size => ({ src: `data/assets/runtime/characters/fool/fool_seq9.${size}.0123456789abcdef.webp`, width: size, height: size });
const source = { src: original, width: 1254, height: 837, bytes: 1234567, sha256: '1'.repeat(64) };
const fullDescriptor = { ...source, src: full };
const assetManifest = () => ({ schemaVersion: 1, version: '1234567890abcdef', entries: {
  [original]: { source: { ...source }, full: { ...fullDescriptor }, portrait: descriptor(192), dossier: descriptor(384) }
} });
(async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'guild-fullres-data-'));
  try {
    fs.cpSync(path.join(root, 'data'), path.join(temp, 'data'), { recursive: true, filter: name => !name.includes(`${path.sep}assets`) && !name.includes(`${path.sep}runtime`) });
    fs.mkdirSync(path.join(temp, 'js'));
    for (const name of ['paths', 'v15', 'generate', 'engine', 'state', 'campaign', 'ui']) fs.writeFileSync(path.join(temp, `js/${name}.js`), '// fixture');
    fs.writeFileSync(path.join(temp, 'index.html'), '');
    const manifestPath = path.join(temp, 'data/assets/runtime/characters/manifest.json');
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    const write = manifest => fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    await test('compact boot data preserves full original URL and exact rectangular dimensions', () => {
      write(assetManifest());
      const release = buildRuntimeData({ root: temp });
      const actual = JSON.parse(fs.readFileSync(path.join(temp, release.bundle))).runtimeAssets.entries[original];
      assert.deepEqual(actual.full, { src: full, width: 1254, height: 837 });
      assert.deepEqual(actual.portrait, descriptor(192));
      assert.deepEqual(actual.dossier, descriptor(384));
    });
    for (const [name, mutate] of [
      ['external URL', entry => entry.full.src = 'https://evil.test/art.png?v=1111111111111111'],
      ['different source', entry => entry.full.src = 'data/assets/characters/fool/fool_seq8.png?v=1111111111111111'],
      ['unversioned source', entry => entry.full.src = original],
      ['wrong content hash', entry => entry.full.src = original + '?v=2222222222222222'],
      ['extra query', entry => entry.full.src += '&redirect=elsewhere'],
      ['wrong width', entry => entry.full.width = 192],
      ['wrong height', entry => entry.full.height = 384],
      ['invalid source dimension', entry => entry.source.width = entry.full.width = 0],
      ['fractional source dimension', entry => entry.source.height = entry.full.height = 53.5],
      ['invalid source hash', entry => entry.source.sha256 = entry.full.sha256 = '<script>'],
      ['changed bytes', entry => entry.full.bytes++],
      ['changed SHA', entry => entry.full.sha256 = '2'.repeat(64)],
      ['missing source metadata', entry => delete entry.source],
      ['different source metadata URL', entry => entry.source.src = 'data/assets/characters/error/error_seq9.png'],
      ['zero source byte count', entry => entry.source.bytes = entry.full.bytes = 0],
      ['fractional source byte count', entry => entry.source.bytes = entry.full.bytes = 34.5],
      ['null full metadata', entry => entry.full = null],
    ]) await test('full metadata rejects ' + name, () => {
      const manifest = assetManifest(); mutate(manifest.entries[original]); write(manifest);
      assert.throws(() => buildRuntimeData({ root: temp }), /full|original/i);
    });
    await test('previous releases without full metadata remain compatible', () => {
      const manifest = assetManifest(); delete manifest.entries[original].full; write(manifest);
      const release = buildRuntimeData({ root: temp });
      const actual = JSON.parse(fs.readFileSync(path.join(temp, release.bundle))).runtimeAssets.entries[original];
      assert.deepEqual(actual, { portrait: descriptor(192), dossier: descriptor(384) });
    });
    await test('the real data loader preserves full metadata through network and warm-cache startup', async () => {
      write(assetManifest());
      const release = buildRuntimeData({ root: temp });
      const payload = fs.readFileSync(path.join(temp, release.bundle), 'utf8');
      const stored = new Map(), requests = [];
      const context = { URL, AbortController, Response, setTimeout, clearTimeout,
        document: { baseURI: 'https://example.test/guild_of_mystery/' },
        caches: { open: async () => ({ match: async url => stored.get(url)?.clone(),
          put: async (url, response) => stored.set(url, response.clone()) }) },
        fetch: async url => { requests.push(String(url));
          return new Response(String(url).endsWith('manifest.json') ? JSON.stringify(release) : payload); }
      };
      context.window = context;
      vm.runInNewContext(fs.readFileSync(path.join(root, 'js/data-loader.js'), 'utf8'), context, { filename: path.join(root, 'js/data-loader.js') });
      const first = await context.G9DataLoader.load();
      assert.deepEqual(JSON.parse(JSON.stringify(first.runtimeAssets.entries[original].full)), { src: full, width: 1254, height: 837 });
      assert.equal(requests.length, 2);
      const warm = await context.G9DataLoader.load();
      assert.equal(requests.length, 3, 'warm startup only revalidates the release manifest');
      assert.deepEqual(JSON.parse(JSON.stringify(warm.runtimeAssets)), JSON.parse(JSON.stringify(first.runtimeAssets)));
    });
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
  await test('versioned full originals are stored durably without changing their response', async () => {
    const w = worker(); assert.equal(await (await w.dispatch(w.request(full))).text(), 'unchanged original PNG');
    await w.dispatch(w.request(full)); assert.equal(w.stats.fetches, 1); assert.equal(w.files.size, 1);
  });
  await test('new original hashes cache separately without deleting the previous version', async () => {
    const w = worker(); await w.dispatch(w.request(full)); await w.dispatch(w.request(original + '?v=2222222222222222'));
    assert.equal(w.stats.fetches, 2); assert.equal(w.files.size, 2);
  });
  for (const relative of [original, original + '?v=invalid', full + '&redirect=external', original + '?v=1111111111111111&v=2222222222222222',
    'data/assets/characters/fool/other.png?v=1111111111111111',
    'https://evil.test/guild_of_mystery/' + full, 'https://example.test/other-app/' + full]) {
    await test('unversioned or unrelated full URL bypasses caching: ' + relative, async () => {
      const w = worker(); assert.equal(await w.dispatch(w.request(relative)), null); assert.equal(w.stats.fetches, 0);
    });
  }
  for (const [label, init] of [['Authorization', { headers: { Authorization: 'test' } }], ['Range', { headers: { Range: 'bytes=0-20' } }], ['POST', { method: 'POST', body: 'test' }]]) {
    await test(label + ' requests for full artwork bypass caching', async () => {
      const w = worker(); assert.equal(await w.dispatch(w.request(full, init)), null); assert.equal(w.stats.fetches, 0);
    });
  }
  await test('a failed full-art HTTP response is not cached', async () => {
    const w = worker({ status: 404 }); await w.dispatch(w.request(full)); await w.dispatch(w.request(full));
    assert.equal(w.stats.fetches, 2); assert.equal(w.files.size, 0);
  });
  for (const option of ['openFail', 'putFail']) await test(option + ' does not prevent full artwork from loading', async () => {
    const w = worker({ [option]: true }); assert.equal(await (await w.dispatch(w.request(full))).text(), 'unchanged original PNG');
  });
  console.log(`${passed} passed, ${failed} failed`); if (failed) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
