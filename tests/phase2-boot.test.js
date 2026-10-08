const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/boot.js'), 'utf8');
const scripts = ['paths', 'v15', 'generate', 'engine', 'state', 'campaign', 'ui'].map(name => `js/${name}.js`);
const flush = () => new Promise(resolve => setImmediate(resolve));
function bootstrap({ reject, registration } = {}) {
  const app = { innerHTML: '' }, appended = [], registrations = [], listeners = new Map();
  const data = { runtimeManifest: { scriptVersions: Object.fromEntries(scripts.map((src, i) => [src, String(i + 1).repeat(16)])), serviceWorkerVersion: '0123456789abcdef' } };
  const context = {
    URL, console: { error() {} },
    document: {
      baseURI: 'https://example.test/guild_of_mystery/',
      getElementById: () => app,
      createElement: tag => ({ tagName: tag.toUpperCase() }),
      head: { appendChild: node => appended.push(node) }
    },
    G9DataLoader: { load: async progress => {
      progress({ phase: 'data', current: 1, total: 1, label: 'Guild data ready' });
      if (reject) throw new Error(reject);
      return data;
    } },
    navigator: { serviceWorker: { register: (...args) => {
      registrations.push(args);
      return registration ? registration() : Promise.resolve();
    } } },
    addEventListener: (name, callback) => { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(callback); },
    removeEventListener: (name, callback) => listeners.get(name)?.delete(callback)
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'js/boot.js' });
  return { context, app, appended, registrations, listeners };
}
let passed = 0, failed = 0;
async function test(name, body) {
  try { await body(); passed++; console.log(`PASS ${name}`); }
  catch (error) { failed++; console.error(`FAIL ${name}: ${error.message}`); }
}
(async () => {
  await test('all seven engine scripts preload concurrently before ordered execution', async () => {
    const b = bootstrap(); await flush();
    const links = b.appended.filter(node => node.tagName === 'LINK');
    assert.equal(links.length, 7, 'all fetch hints must be appended before the first module executes');
    assert(links.every(node => node.rel === 'preload' && node.as === 'script'));
    assert.deepEqual(links.map(node => new URL(node.href).pathname.split('/').slice(-2).join('/')), scripts);
    assert.equal(b.appended.filter(node => node.tagName === 'SCRIPT').length, 1);
    for (let i = 0; i < scripts.length; i++) {
      const modules = b.appended.filter(node => node.tagName === 'SCRIPT');
      assert.equal(modules.length, i + 1);
      assert.equal(new URL(modules[i].src).pathname.split('/').slice(-2).join('/'), scripts[i]);
      assert.equal(modules[i].async, false);
      modules[i].onload(); await flush();
    }
    assert.equal(b.listeners.get('error').size, 0, 'finished modules must release their error listeners');
    assert(b.context.G9_DATA, 'data must be installed before any game module executes');
  });
  await test('every engine module URL includes its current content version', async () => {
    const b = bootstrap(); await flush();
    const links = b.appended.filter(node => node.tagName === 'LINK');
    assert.equal(links.length, 7);
    for (let i = 0; i < scripts.length; i++) assert.equal(new URL(links[i].href).searchParams.get('v'), String(i + 1).repeat(16));
  });
  await test('service worker registration is versioned, same-origin, scoped and does not block engine loading', async () => {
    const b = bootstrap({ registration: () => new Promise(() => {}) }); await flush();
    assert.equal(b.appended.filter(node => node.tagName === 'LINK').length, 7);
    assert.equal(b.appended.filter(node => node.tagName === 'SCRIPT').length, 1);
    assert.equal(b.registrations.length, 1);
    assert.equal(b.registrations[0][0], 'https://example.test/guild_of_mystery/sw.js?v=0123456789abcdef');
    assert.equal(b.registrations[0][1].scope, '/guild_of_mystery/');
    assert.equal(b.registrations[0][1].updateViaCache, 'none');
  });
  await test('service worker denial does not turn a successful data load into an error screen', async () => {
    const b = bootstrap({ registration: () => Promise.reject(new Error('denied')) }); await flush(); await flush();
    assert.equal(b.appended.filter(node => node.tagName === 'LINK').length, 7);
    assert.equal(b.appended.filter(node => node.tagName === 'SCRIPT').length, 1);
    assert(!b.app.innerHTML.includes('The ledger could not be opened'));
  });
  await test('data errors render as escaped text and do not load engine modules', async () => {
    const b = bootstrap({ reject: '<img src=x onerror=alert(1)>' }); await flush();
    assert.equal(b.appended.length, 0);
    assert(b.app.innerHTML.includes('The ledger could not be opened'));
    assert(!b.app.innerHTML.includes('<img src=x'));
    assert(b.app.innerHTML.includes('&lt;img src=x'));
  });
  await test('an engine download failure retains the readable retry/error screen', async () => {
    const b = bootstrap(); await flush();
    b.appended.find(node => node.tagName === 'SCRIPT').onerror(); await flush();
    assert(b.app.innerHTML.includes('Could not load js/paths.js'));
    assert(b.app.innerHTML.includes('The ledger could not be opened'));
  });
  await test('module execution errors retain a readable failure and stop later game modules', async () => {
    const b = bootstrap(); await flush();
    const first = b.appended.find(node => node.tagName === 'SCRIPT');
    for (const listener of b.listeners.get('error') || []) listener({ filename: first.src, message: 'Deliberate execution failure', error: new Error('Deliberate execution failure') });
    first.onload(); await flush();
    assert(b.app.innerHTML.includes('The ledger could not be opened'));
    assert(b.app.innerHTML.includes('Deliberate execution failure'));
    assert.equal(b.appended.filter(node => node.tagName === 'SCRIPT').length, 1, 'later UI must not execute after the preceding module failed');
  });
  await test('a failed script download never queues the later UI to overwrite the error screen', async () => {
    const b = bootstrap(); await flush();
    b.appended.find(node => node.tagName === 'SCRIPT').onerror(); await flush();
    assert.equal(b.appended.filter(node => node.tagName === 'SCRIPT').length, 1);
    assert(b.app.innerHTML.includes('The ledger could not be opened'));
  });
  console.log(`Boot regressions: ${passed} passed; ${failed} failed.`);
  process.exitCode = failed ? 1 : 0;
})();
