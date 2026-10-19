// Animation-lab lifecycle checks exercise the browser UI with its real engine.
// NODE_PATH=<jsdom node_modules> node tests/ability-preview-ui.test.js
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const game = require('../js/node-loader');
const root = path.resolve(__dirname, '..');
const storageKey = 'guild-rpg-browser-v9';
let passed = 0, failed = 0;

async function fixture() {
  const dom = new JSDOM('<div id="app"></div>', { url: 'https://example.test/guild_of_mystery/', runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window;
  w.fetch = async url => ({ ok: true, json: async () => JSON.parse(fs.readFileSync(path.join(root, new URL(url).pathname.replace('/guild_of_mystery/', '')), 'utf8')) });
  w.eval(fs.readFileSync(path.join(root, 'js/data-loader.js'), 'utf8'));
  w.G9_DATA = await w.G9DataLoader.load();
  w.setInterval = () => 1; w.clearInterval = () => {}; w.scrollTo = () => {};
  w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  let clock = 0, serial = 0;
  const timers = new Map();
  w.performance.now = () => clock;
  w.setTimeout = (fn, delay = 0) => { timers.set(++serial, { fn, delay }); return serial; };
  w.clearTimeout = id => timers.delete(id);
  w.Element.prototype.animate = function () {
    return { playState: 'running', playbackRate: 1, pause() { this.playState = 'paused'; }, play() { this.playState = 'running'; }, cancel() { this.playState = 'idle'; this.oncancel?.(); } };
  };
  w.Element.prototype.getBoundingClientRect = function () {
    const card = this.closest?.('[data-unit-id]'), canvas = this.matches('.gm-dungeon-arena, .gm-battlefield-canvas');
    const left = canvas ? 0 : card?.classList.contains('enemy') ? 180 : 60;
    const top = canvas ? 0 : card?.classList.contains('enemy') ? 80 : 350;
    const width = canvas ? 390 : 64, height = canvas ? 600 : 64;
    return { left, top, right: left + width, bottom: top + height, width, height, x: left, y: top, toJSON() {} };
  };
  const save = game.newGame(), agent = game.makeAgent(() => .4, { path: 'fool', sequence: 5, trait: 'Stout Vitality' });
  agent.id = 'lab-guild-agent'; agent.name = 'Guild Agent'; game.restatAgent(agent);
  save.roster = [agent];
  save.quests = [{ id: 'lab-contract', name: 'Training Contract', encounter: true, objective: 'combat', difficultySequence: 5, rewards: { funds: 0, reputation: 0, materials: {} } }];
  require('./pool-fixture')(game, save);
  w.localStorage.setItem(storageKey, JSON.stringify(save));
  const scripts = ['vendor/dayjs.min', 'paths', 'v15', 'generate', 'traits', 'market', 'pathway-assets', 'signatures', 'mythical', 'battle-ai', 'engine', 'state', 'campaign', 'ability-preview'];
  const spy = '\nwindow.__previewBuilds=[]; const originalAbilityPreviewBuilder=buildAbilityPreview; buildAbilityPreview=function(...args){const result=originalAbilityPreviewBuilder(...args);window.__previewBuilds.push({args:JSON.parse(JSON.stringify(args)),events:JSON.stringify(result.events),result});return result;};\n';
  w.eval(scripts.map(name => fs.readFileSync(path.join(root, `js/${name}.js`), 'utf8')).join('\n') + spy + fs.readFileSync(path.join(root, 'js/ui.js'), 'utf8'));
  const app = w.document.getElementById('app');
  const tick = () => {
    assert.equal(timers.size, 1, 'only one playback/restart scheduler may be pending');
    const [id, timer] = timers.entries().next().value;
    timers.delete(id); clock += timer.delay; timer.fn();
  };
  const change = (selector, value) => {
    const element = app.querySelector(selector);
    assert(element, selector + ' exists');
    if (element.type === 'checkbox') element.checked = !!value; else element.value = String(value);
    element.dispatchEvent(new w.Event('change', { bubbles: true }));
  };
  const enter = () => { w.G9.tab('simulator'); w.G9.simulatorSection('animations'); };
  const status = () => app.querySelector('[data-animation-status]')?.textContent;
  const log = () => app.querySelector('#animation-viewport')?.textContent || '';
  const finish = () => { for (let count = 0; status() !== 'Preview complete' && count < 100; count++) tick(); assert.equal(status(), 'Preview complete'); };
  return { dom, w, app, timers, tick, change, enter, status, log, finish, agent, saved: () => w.localStorage.getItem(storageKey) };
}

async function test(name, run) {
  let f;
  try { f = await fixture(); await run(f); passed++; console.log('PASS ' + name); }
  catch (error) { failed++; console.error('FAIL ' + name + ': ' + error.stack); }
  finally { f?.dom.window.close(); }
}

(async () => {
  await test('entering the lab automatically demonstrates Fool’s highest active Sequence and hides its passive tier', f => {
    const before = f.saved(); f.enter();
    assert.equal(f.app.querySelector('#animation-path').value, 'fool');
    assert.equal(f.app.querySelector('#animation-sequence').value, '8');
    const options = [...f.app.querySelector('#animation-sequence').options];
    assert(!options.some(option => option.value === '9'), 'Spirit Vision must not be selectable');
    assert(f.app.querySelector('.animation-ability-heading').textContent.includes('Paper Card Dagger'));
    assert.equal(f.w.__previewBuilds.length, 1); assert.equal(f.timers.size, 1);
    f.finish(); assert(f.log().includes('Paper Card Dagger')); assert.equal(f.timers.size, 0);
    assert.equal(f.saved(), before, 'previewing must not write guild resources, roster, progression or collections');
  });

  await test('every Pathway offers only its actual native active abilities, including all active Sequences 9–0', f => {
    f.enter(); const catalog = f.w.abilityPreviewCatalog();
    assert.equal(catalog.length, 188);
    const paths = [...f.app.querySelector('#animation-path').options].map(option => option.value);
    assert.equal(paths.length, 22);
    let count = 0;
    for (const pathway of paths) {
      f.change('#animation-path', pathway);
      const expected = catalog.filter(entry => entry.path === pathway);
      const actual = [...f.app.querySelector('#animation-sequence').options];
      assert.deepEqual(actual.map(option => Number(option.value)), [...expected].map(entry => entry.sequence));
      for (const entry of expected) assert(actual.some(option => option.textContent.includes(entry.ability.name)));
      count += actual.length;
    }
    assert.equal(count, 188);
  });

  await test('Replay resets the same recorded demonstration instead of rerolling its engine events', f => {
    f.enter(); f.finish();
    const first = f.w.__previewBuilds[0], completed = f.log();
    f.app.querySelector('[data-animation-replay]').click();
    assert.equal(f.w.__previewBuilds.length, 1, 'Replay reuses its original immutable event tape');
    assert.equal(f.status(), 'Playing preview'); assert(!f.log().includes('Paper Card Dagger'));
    f.finish(); assert.equal(f.log(), completed);
    assert.equal(JSON.stringify(first.result.events), first.events, 'playback cannot modify engine records');
  });

  await test('Loop toggles do not reset an in-flight phase and restart only after natural completion', f => {
    f.enter(); f.tick(); f.tick();
    const current = f.log(), viewport = f.app.querySelector('#animation-viewport'), pending = f.timers.values().next().value;
    f.change('#animation-loop', true);
    assert.equal(f.app.querySelector('#animation-viewport'), viewport, 'Loop must not rebuild the currently animated battlefield');
    assert.equal(f.log(), current); assert.equal(f.timers.size, 1);
    assert.equal(f.timers.values().next().value.delay, pending.delay);
    f.finish(); assert.equal(f.timers.size, 1, 'natural completion schedules one idle restart');
    assert(f.timers.values().next().value.delay > 0);
    f.tick(); assert.equal(f.status(), 'Playing preview'); assert.equal(f.w.__previewBuilds.length, 1);
    assert(!f.log().includes('Paper Card Dagger')); assert.equal(f.timers.size, 1);
    f.change('#animation-loop', false); f.finish(); assert.equal(f.timers.size, 0);
  });

  await test('a completed Loop restart is cancelled by Pause, Step, Skip, Clear and leaving the tester', f => {
    const operations = [
      () => f.w.G9.toggleTickerPause(),
      () => f.w.G9.stepTicker(),
      () => f.w.G9.skipTicker(true),
      () => f.w.G9.clearAnimationPreview(),
      () => f.w.G9.simulatorSection('battle'),
      () => f.w.G9.tab('hall')
    ];
    for (const operation of operations) {
      f.enter(); f.app.querySelector('[data-animation-replay]').click();
      f.change('#animation-loop', true); f.finish();
      const stale = f.timers.values().next().value.fn;
      operation(); assert.equal(f.timers.size, 0);
      const text = f.app.textContent; stale();
      assert.equal(f.app.textContent, text); assert.equal(f.timers.size, 0, 'invalidated idle callback must not restart');
    }
  });

  await test('Pause, Step, speed changes and Skip operate on the selected preview without stale progress', f => {
    f.enter(); f.tick(); f.tick(); const stale = f.timers.values().next().value.fn;
    f.w.G9.toggleTickerPause(); const paused = f.log();
    assert.equal(f.timers.size, 0); assert.equal(f.status(), 'Paused');
    stale(); assert.equal(f.log(), paused);
    f.w.G9.setTickerSpeed(2); assert.equal(f.timers.size, 0);
    f.w.G9.stepTicker(); assert.equal(f.timers.size, 0);
    if (f.status() !== 'Preview complete') f.w.G9.toggleTickerPause();
    f.w.G9.skipTicker(true); assert.equal(f.status(), 'Preview complete'); assert.equal(f.timers.size, 0);
    assert(f.app.querySelector('[data-pause]').disabled); assert(f.app.querySelector('[data-step]').disabled);
  });

  await test('rapid selection preserves an available active Sequence and rejects timers from older selections', f => {
    f.enter(); f.change('#animation-sequence', 7);
    const stale = f.timers.values().next().value.fn;
    f.change('#animation-path', 'moon'); assert.equal(f.app.querySelector('#animation-sequence').value, '7');
    const current = f.app.querySelector('#animation-viewport'), initial = current.textContent;
    stale(); assert.equal(f.app.querySelector('#animation-viewport'), current); assert.equal(current.textContent, initial);
    f.change('#animation-sequence', 9); f.change('#animation-path', 'fool');
    assert.equal(f.app.querySelector('#animation-sequence').value, '8', 'passive Sequence falls back to the highest active tier');
    assert.equal(f.timers.size, 1); f.finish(); assert(f.log().includes('Paper Card Dagger'));
  });

  await test('Clear and tab/mode exits discard timers and effects without writing the save', f => {
    const before = f.saved(); f.enter(); f.tick(); f.tick();
    const stale = f.timers.values().next().value.fn;
    f.w.G9.clearAnimationPreview(); assert.equal(f.timers.size, 0);
    assert.equal(f.app.querySelector('#animation-viewport'), null); assert.equal(f.status(), 'Preview ready');
    assert.equal(f.app.querySelectorAll('.gm-combat-fx-layer,.gm-battle-fx-layer').length, 0);
    stale(); assert.equal(f.app.querySelector('#animation-viewport'), null);
    f.app.querySelector('[data-animation-replay]').click(); f.w.G9.tab('hall'); assert.equal(f.timers.size, 0);
    f.enter(); f.w.G9.simulatorSection('battle'); assert.equal(f.timers.size, 0);
    assert.equal(f.saved(), before);
  });

  await test('ordinary 1v1 and 2v2 simulation remains separate and survives a visit to the animation tester', f => {
    const before = f.saved(); f.w.G9.tab('simulator'); f.w.G9.simMode('2v2'); f.w.G9.runSimulation();
    assert.equal(f.app.querySelectorAll('.gm-arena-unit.ally').length, 2);
    assert.equal(f.app.querySelectorAll('.gm-arena-unit.enemy').length, 2);
    f.w.G9.skipTicker(true); const original = f.app.querySelector('#sim-viewport').textContent.trim();
    f.w.G9.simulatorSection('animations'); f.w.G9.skipTicker(true); f.w.G9.simulatorSection('battle');
    assert.equal(f.app.querySelector('#sim-viewport').textContent.trim(), original);
    assert.equal(f.app.querySelectorAll('.gm-arena-unit.ally').length, 2);
    f.w.G9.simMode('1v1'); f.w.G9.runSimulation();
    assert.equal(f.app.querySelectorAll('.gm-arena-unit.ally').length, 1);
    assert.equal(f.app.querySelectorAll('.gm-arena-unit.enemy').length, 1);
    f.w.G9.skipTicker(true); assert.equal(f.timers.size, 0); assert.equal(f.saved(), before);
  });

  await test('an active contract retains playback priority over a simulator animation selection', f => {
    f.w.G9.plan('lab-contract'); f.w.G9.toggleAssign(f.agent.id); f.w.G9.launch();
    const battle = f.app.querySelector('#battle-viewport'); assert(battle);
    f.w.G9.tab('simulator'); f.w.G9.simulatorSection('animations');
    assert(f.app.querySelector('#battle-viewport')); assert.equal(f.timers.size, 1);
    f.tick(); f.tick(); assert(f.app.querySelector('#battle-viewport').textContent.length > 0);
    assert.equal(f.app.querySelector('#animation-viewport')?.querySelectorAll('.b-turn-header').length || 0, 0);
    f.w.G9.skipTicker(); assert.equal(f.timers.size, 0);
    assert.equal(f.app.querySelector('.battle-completion').hidden, false);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exitCode = 1;
})();
