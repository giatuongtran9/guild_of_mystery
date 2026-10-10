// Browser bootstrap regressions without changing the authored gameplay data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/data-loader.js'), 'utf8');
const read = name => JSON.parse(fs.readFileSync(path.join(root, 'data', name), 'utf8'));
const manifest = read('pathways/index.json');
const names = ['items', 'enemies', 'contracts', 'formulas', 'balance', 'campaign'];
const rawBundle = () => ({
  schema: 'guild.runtime-data.v1', manifest,
  pathwayFiles: Object.fromEntries(manifest.order.map(key => [key, read(`pathways/${key}.json`)])),
  other: Object.fromEntries(names.map(name => [name, read(`${name}.json`)]))
});
function release(bundle = rawBundle()) {
  const text = JSON.stringify(bundle);
  const version = crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
  const scriptVersions = Object.fromEntries(['paths', 'v15', 'generate', 'signatures', 'mythical', 'engine', 'state', 'campaign', 'ui'].map(name => [`js/${name}.js`, '0123456789abcdef']));
  return { manifest: { schema: 'guild.runtime-manifest.v1', version, bundle: `data/runtime/data.${version}.json`, scriptVersions }, text };
}
function memoryCache() {
  const entries = new Map();
  return {
    entries,
    async open() { return {
      async match(url) { return entries.get(String(url))?.clone(); },
      async put(url, response) { entries.set(String(url), response.clone()); },
      async delete(url) { return entries.delete(String(url)); }
    }; }
  };
}
function browser(options = {}) {
  const current = options.current || release();
  const requests = [];
  const context = {
    URL, AbortController, Response, console,
    document: { baseURI: 'https://example.test/guild_of_mystery/' },
    setTimeout: (fn, delay) => setTimeout(fn, Math.min(delay, 5)), clearTimeout,
    caches: options.cache,
    fetch: async (url, request) => {
      requests.push({ url: String(url), ...request });
      const relative = new URL(url).pathname.replace('/guild_of_mystery/', '');
      if (options.fetch) {
        const response = await options.fetch(relative, requests.length);
        if (response) return response;
      }
      if (relative === 'data/runtime/manifest.json') return new Response(JSON.stringify(current.manifest));
      if (relative === current.manifest.bundle) return new Response(current.text);
      const file = path.join(root, relative);
      return fs.existsSync(file) ? new Response(fs.readFileSync(file)) : new Response('', { status: 404 });
    }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'js/data-loader.js' });
  return { load: context.G9DataLoader.load, requests };
}
let passed = 0, failed = 0;
async function test(name, body) {
  try { await body(); passed++; console.log(`PASS ${name}`); }
  catch (error) { failed++; console.error(`FAIL ${name}: ${error.message}`); }
}
(async () => {
  await test('cold startup downloads one revalidated manifest and one immutable data bundle', async () => {
    const b = browser(); await b.load();
    assert.equal(b.requests.length, 2, '29 authored JSON requests must become two runtime requests');
    assert.equal(b.requests[0].cache, 'no-cache');
    assert.equal(b.requests[1].cache, 'force-cache');
    assert.match(b.requests[1].url, /data\.[a-f0-9]{16}\.json$/);
  });
  await test('warm startup revalidates the release without downloading the cached bundle', async () => {
    const cache = memoryCache();
    await browser({ cache }).load();
    const warm = browser({ cache }); await warm.load();
    assert.equal(warm.requests.length, 1);
    assert.match(warm.requests[0].url, /data\/runtime\/manifest\.json$/);
  });
  await test('a new release bypasses the previous bundle cache', async () => {
    const cache = memoryCache(); await browser({ cache }).load();
    const bundle = rawBundle(); bundle.other.balance.system.phase2Probe = 'new-release';
    const next = browser({ cache, current: release(bundle) }); const data = await next.load();
    assert.equal(next.requests.length, 2);
    assert.equal(data.balance.system.phase2Probe, 'new-release');
  });
  await test('unavailable CacheStorage still boots using the HTTP cache', async () => {
    const b = browser({ cache: { async open() { throw new Error('storage denied'); } } });
    assert.equal((await b.load()).pathways.path_keys.length, 22);
    assert.equal(b.requests.length, 2);
  });
  await test('failed cache writes cannot prevent a valid startup', async () => {
    const b = browser({ cache: { async open() { return { async match() {}, async put() { throw new Error('quota'); } }; } } });
    assert.equal((await b.load()).pathways.path_keys.length, 22);
    assert.equal(b.requests.length, 2);
  });
  await test('failed cache reads cannot prevent a valid network startup', async () => {
    const b = browser({ cache: { async open() { return { async match() { throw new Error('storage denied'); } }; } } });
    assert.equal((await b.load()).pathways.path_keys.length, 22);
    assert.equal(b.requests.length, 2);
  });
  await test('corrupt cached JSON is replaced by the current valid network bundle', async () => {
    const current = release(), cache = memoryCache();
    cache.entries.set(`https://example.test/guild_of_mystery/${current.manifest.bundle}`, new Response('{invalid'));
    const b = browser({ cache, current });
    assert.equal((await b.load()).pathways.path_keys.length, 22);
    assert.equal(b.requests.length, 2);
    assert.equal((await cache.entries.values().next().value.json()).schema, 'guild.runtime-data.v1');
  });
  for (const badPath of ['https://other.test/data.json', '../data.json', 'data/runtime/../data.json', 'data/runtime/data.abc.json', 'data/runtime/data.0000000000000000.json?redirect=x']) {
    await test(`reject invalid runtime bundle path ${badPath}`, async () => {
      const current = release(); current.manifest.bundle = badPath;
      const b = browser({ current });
      await assert.rejects(b.load(), /runtime|bundle|manifest/i);
      assert.equal(b.requests.length, 1, 'invalid manifest must fail before any payload request');
    });
  }
  await test('the bundle hash must agree with the release version', async () => {
    const current = release(); current.manifest.version = '1111111111111111';
    await assert.rejects(browser({ current }).load(), /runtime|version|bundle|manifest/i);
  });
  await test('invalid runtime manifest schema is rejected', async () => {
    const current = release(); current.manifest.schema = 'unexpected';
    await assert.rejects(browser({ current }).load(), /schema/i);
  });
  await test('invalid engine module version mapping is rejected', async () => {
    const current = release(); current.manifest.scriptVersions = { 'js/ui.js': 'https://other.test/a.js' };
    await assert.rejects(browser({ current }).load(), /script versions/i);
  });
  await test('a missing engine module version mapping fails before bootstrap', async () => {
    const current = release(); delete current.manifest.scriptVersions;
    await assert.rejects(browser({ current }).load(), /script versions/i);
  });
  await test('invalid service worker version is rejected', async () => {
    const current = release(); current.manifest.serviceWorkerVersion = '<script>';
    await assert.rejects(browser({ current }).load(), /service worker version/i);
  });
  await test('invalid cached data schemas are replaced instead of reused', async () => {
    const current = release(), cache = memoryCache();
    cache.entries.set(`https://example.test/guild_of_mystery/${current.manifest.bundle}`, new Response(JSON.stringify({ schema: 'unexpected' })));
    const b = browser({ cache, current });
    assert.equal((await b.load()).pathways.path_keys.length, 22);
    assert.equal(b.requests.length, 2);
  });
  await test('missing shared dataset is a readable data-bundle failure', async () => {
    const bundle = rawBundle(); delete bundle.other.items;
    await assert.rejects(browser({ current: release(bundle) }).load(), /missing items/i);
  });
  await test('missing pathway is a readable data-bundle failure', async () => {
    const bundle = rawBundle(); delete bundle.pathwayFiles.fool;
    await assert.rejects(browser({ current: release(bundle) }).load(), /all 22 pathways/i);
  });
  await test('invalid portrait manifest is rejected before entering the UI', async () => {
    const bundle = rawBundle(); bundle.runtimeAssets = { schemaVersion: 7, version: '1234567890abcdef', entries: {} };
    await assert.rejects(browser({ current: release(bundle) }).load(), /portrait manifest/i);
  });
  await test('invalid bundled pathway schema retains the existing validation', async () => {
    const bundle = rawBundle(); bundle.pathwayFiles.fool.schema = 'unexpected';
    await assert.rejects(browser({ current: release(bundle) }).load(), /fool.*schema/i);
  });
  await test('missing rank in the bundled data retains the existing validation', async () => {
    const bundle = rawBundle(); bundle.pathwayFiles.error.sequences.pop();
    await assert.rejects(browser({ current: release(bundle) }).load(), /error.*Sequences/i);
  });
  await test('invalid bundled campaign retains the existing five-mission validation', async () => {
    const bundle = rawBundle(); bundle.other.campaign.missions.pop();
    await assert.rejects(browser({ current: release(bundle) }).load(), /five-mission/i);
  });
  await test('all 220 abilities and six shared datasets preserve authored content', async () => {
    const data = await browser().load(), raw = rawBundle();
    for (const key of manifest.order) {
      for (const tier of raw.pathwayFiles[key].sequences) {
        const runtime = data.pathways.paths[key].sequences.find(x => x.sequence === tier.sequence);
        assert.equal(runtime.name, tier.name);
        assert.equal(runtime.abilityText, tier.ability.description);
        assert.equal(runtime.abilities[0].id, tier.ability.id);
        assert.equal(runtime.abilities[0].costSP, Number(tier.ability.spCost) || 0);
        assert.equal(runtime.abilities[0].cooldown, tier.ability.cooldown ?? 0);
        assert.deepEqual(JSON.parse(JSON.stringify(runtime.abilities[0].effects)), tier.ability.effects || []);
      }
    }
    for (const name of names) assert.deepEqual(JSON.parse(JSON.stringify(data[name])), raw.other[name]);
  });
  await test('transient HTTP errors retry and retain the loading error label', async () => {
    let attempts = 0;
    const b = browser({ fetch: async relative => {
      if (relative === 'data/runtime/manifest.json' && ++attempts < 3) return new Response('', { status: 503 });
    } });
    await b.load(); assert.equal(attempts, 3);
  });
  await test('network errors remain a readable bootstrap failure after three attempts', async () => {
    const b = browser({ fetch: async relative => {
      if (relative === 'data/runtime/manifest.json') throw new Error('offline');
    } });
    await assert.rejects(b.load(), /runtime.*manifest.*offline/i);
    assert.equal(b.requests.length, 3);
  });
  console.log(`Startup loader regressions: ${passed} passed; ${failed} failed.`);
  process.exitCode = failed ? 1 : 0;
})();
