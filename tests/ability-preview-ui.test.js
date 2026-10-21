// The Simulator gallery reuses real cast data and shared combat effects without changing saves.
// NODE_PATH=<jsdom node_modules> node tests/sequence5-gallery-ui.test.js
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
  const w = dom.window, animations = [], timers = new Map();
  w.fetch = async url => ({ ok: true, json: async () => JSON.parse(fs.readFileSync(path.join(root, new URL(url).pathname.replace('/guild_of_mystery/', '')), 'utf8')) });
  w.eval(fs.readFileSync(path.join(root, 'js/data-loader.js'), 'utf8'));
  w.G9_DATA = await w.G9DataLoader.load();
  w.setInterval = () => 1; w.clearInterval = () => {}; w.scrollTo = () => {};
  w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  let clock = 0, serial = 0;
  w.performance.now = () => clock;
  w.setTimeout = (fn, delay = 0) => { timers.set(++serial, { fn, delay }); return serial; };
  w.clearTimeout = id => timers.delete(id);
  w.Element.prototype.animate = function(keyframes, timing) {
    const a = { element: this, keyframes, timing, playState: 'running', playbackRate: 1,
      pause() { this.playState = 'paused'; }, play() { this.playState = 'running'; },
      cancel() { this.playState = 'idle'; this.cancelled = true; this.oncancel?.(); } };
    animations.push(a); return a;
  };
  w.Element.prototype.getBoundingClientRect = function() {
    const card = this.closest?.('[data-unit-id]'), canvas = this.matches('.gm-dungeon-arena, .gm-battlefield-canvas');
    const gallery = !!this.closest?.('[data-gallery-ability]');
    const enemy = card?.classList.contains('enemy') || card?.dataset.unitId === 'preview_target_0';
    const left = canvas ? 0 : enemy ? 240 : 55, top = canvas ? 0 : gallery ? 70 : enemy ? 80 : 350;
    const width = canvas ? 390 : 64, height = canvas ? gallery ? 190 : 600 : 64;
    return { left, top, right: left + width, bottom: top + height, width, height, x: left, y: top, toJSON() {} };
  };
  const save = game.newGame(), agent = game.makeAgent(() => .4, { path: 'fool', sequence: 5, trait: 'Stout Vitality' });
  agent.id = 'gallery-guild-agent'; agent.name = 'Guild Agent'; game.restatAgent(agent);
  save.roster = [agent]; save.quests = [{ id: 'gallery-contract', name: 'Gallery Contract', encounter: true, objective: 'combat', difficultySequence: 5, rewards: { funds: 0, reputation: 0, materials: {} } }]; require('./pool-fixture')(game, save);
  w.localStorage.setItem(storageKey, JSON.stringify(save));
  const scripts = ['vendor/dayjs.min', 'paths', 'v15', 'generate', 'traits', 'market', 'pathway-assets', 'signatures', 'mythical', 'battle-ai', 'engine', 'state', 'campaign', 'ability-preview'];
  const spy = '\nwindow.__galleryBuilds=[]; const originalGalleryBuilder=buildAbilityPreview; buildAbilityPreview=function(...args){const result=originalGalleryBuilder(...args);window.__galleryBuilds.push({args:JSON.parse(JSON.stringify(args)),events:JSON.stringify(result.events),result});return result;};\n';
  w.eval(scripts.map(name => fs.readFileSync(path.join(root, `js/${name}.js`), 'utf8')).join('\n') + spy
    + fs.readFileSync(process.env.ABILITY_PREVIEW_UI_SOURCE || path.join(root, 'js/ui.js'), 'utf8'));
  const app = w.document.getElementById('app');
  const cards = () => [...app.querySelectorAll('[data-gallery-ability]')];
  const visible = () => cards().filter(card => !card.hidden);
  const card = id => cards().find(node => node.dataset.galleryAbility === id);
  const enter = () => { w.G9.tab('simulator'); w.G9.simulatorSection('animations'); };
  const replay = id => { const button = card(id)?.querySelector('[data-gallery-replay]'); assert(button, id + ' replay exists'); button.click(); };
  const tick = () => { assert.equal(timers.size, 1); const [id, timer] = timers.entries().next().value; timers.delete(id); clock += timer.delay; timer.fn(); };
  const active = () => animations.filter(a => !a.cancelled && a.playState !== 'finished');
  return { dom, w, app, timers, cards, visible, card, enter, replay, tick, active, agent, saved: () => w.localStorage.getItem(storageKey) };
}
async function test(name, run) {
  let f;
  try { f = await fixture(); await run(f); passed++; console.log('PASS ' + name); }
  catch (error) { failed++; console.error('FAIL ' + name + ': ' + error.stack); }
  finally { f?.dom.window.close(); }
}

(async () => {
  await test('the Simulator gallery covers exactly twenty new active skills without auto-playing', f => {
    f.enter();
    assert.deepEqual(f.cards().map(card => card.dataset.galleryAbility).sort(), Object.keys(f.w.G9_DATA.fx.sequence5Abilities).sort());
    assert.equal(f.cards().length, 20); assert.equal(f.timers.size, 0); assert.equal(f.active().length, 0);
    assert.equal(f.w.__galleryBuilds.length, 0, 'native cast tapes are built only when Replay is requested');
    assert(!f.app.querySelector('[data-gallery-ability="iron_blood_vigor"],[data-gallery-ability="reset_fate"]'));
    for (const id of ['gallery-search', 'gallery-path', 'gallery-placement', 'gallery-speed', 'gallery-swap', 'gallery-guides']) assert(f.app.querySelector('#' + id), id);
    for (const card of f.cards()) {
      assert.equal(card.querySelectorAll('.gm-arena-unit').length, 2);
      for (const portrait of card.querySelectorAll('.gm-arena-unit img')) {
        assert(Number(portrait.getAttribute('width')) > 0); assert(Number(portrait.getAttribute('height')) > 0);
      }
    }
  });

  await test('search, pathway and placement filters preserve cards and the focused input', f => {
    f.enter(); const input = f.app.querySelector('#gallery-search'), fool = f.card('thread_binding'), unsafeImages = f.app.querySelectorAll('img[onerror]').length; input.focus();
    f.w.G9.galleryFilter('search', 'thread');
    assert.deepEqual(f.visible().map(card => card.dataset.galleryAbility), ['thread_binding']);
    assert.equal(f.app.querySelector('#gallery-search'), input); assert.equal(f.w.document.activeElement, input); assert.equal(f.card('thread_binding'), fool);
    f.w.G9.galleryFilter('search', ''); f.w.G9.galleryFilter('path', 'mother');
    assert.deepEqual(f.visible().map(card => card.dataset.galleryAbility), ['life_bloom']);
    f.w.G9.galleryFilter('path', ''); f.w.G9.galleryFilter('placement', 'split'); assert.equal(f.visible().length, 4);
    f.w.G9.galleryFilter('placement', ''); f.w.G9.galleryFilter('search', '<img onerror="alert(1)">');
    assert.equal(f.visible().length, 0); assert.equal(f.app.querySelectorAll('img[onerror]').length, unsafeImages, 'search cannot inject image markup');
  });

  await test('Replay uses the shared Sequence 5 effect on a native cast without rebuilding other cards', f => {
    f.enter(); const before = f.saved(), card = f.card('thread_binding'), other = f.card('life_bloom'), portrait = other.querySelector('img');
    f.replay('thread_binding');
    assert(card.querySelector('.gm-combat-sequence5[data-ability-id="thread_binding"]'));
    assert.equal(f.app.querySelectorAll('.gm-combat-sequence5').length, 1);
    assert.equal(f.w.__galleryBuilds.length, 1); assert.equal(f.w.__galleryBuilds[0].args[0].sequence, 5);
    assert.equal(f.card('life_bloom'), other); assert.equal(other.querySelector('img'), portrait); assert.equal(f.timers.size, 1);
    assert(f.active().length > 0); f.tick();
    assert.equal(f.timers.size, 0); assert.equal(f.active().length, 0); assert.equal(f.saved(), before);
    assert.equal(JSON.stringify(f.w.__galleryBuilds[0].result.events), f.w.__galleryBuilds[0].events, 'gallery cannot mutate native events');
  });

  await test('only one gallery replay runs and an old timeout cannot clear a newer cast', f => {
    f.enter(); f.replay('holy_sun_bolt'); const stale = f.timers.values().next().value.fn;
    f.replay('ocean_calling'); assert.equal(f.timers.size, 1);
    assert.equal(f.card('holy_sun_bolt').querySelector('.gm-combat-sequence5'), null);
    assert(f.card('ocean_calling').querySelector('.gm-combat-sequence5'));
    stale(); assert(f.card('ocean_calling').querySelector('.gm-combat-sequence5')); assert.equal(f.timers.size, 1);
    f.tick(); assert.equal(f.timers.size, 0); assert.equal(f.active().length, 0);
  });

  await test('gallery speed controls the next one-shot duration and leaves no repeated playback', f => {
    f.enter(); f.w.G9.gallerySpeed(.5); f.replay('holy_sun_bolt');
    assert.equal(f.timers.size, 1); const slow = f.timers.values().next().value.delay; f.tick();
    f.w.G9.gallerySpeed(1.5); f.replay('holy_sun_bolt');
    const fast = f.timers.values().next().value.delay; assert(slow > fast && fast > 0); f.tick();
    assert.equal(f.timers.size, 0); assert.equal(f.active().length, 0);
  });

  await test('filtering and swapping cancel active art and reject stale callbacks', f => {
    const before = f.saved(); f.enter(); f.replay('thread_binding'); const stale = f.timers.values().next().value.fn;
    f.w.G9.galleryFilter('path', 'sun'); assert.equal(f.timers.size, 0); assert.equal(f.active().length, 0);
    stale(); assert.equal(f.app.querySelector('.gm-combat-sequence5'), null);
    f.w.G9.galleryFilter('path', ''); f.replay('ocean_calling');
    f.w.G9.gallerySwap(true); assert.equal(f.timers.size, 0); assert.equal(f.active().length, 0);
    f.replay('ocean_calling'); const effect = f.card('ocean_calling').querySelector('.gm-combat-sequence5');
    assert(effect); assert.equal(effect.dataset.flowDirection, 'caster-to-target');
    f.w.G9.galleryGuides(true); assert.equal(f.saved(), before);
  });

  await test('all ten Sequence choices show their entire native active catalog and reset filters', f => {
    f.enter(); const catalog = f.w.abilityPreviewCatalog(); let count = 0;
    assert.deepEqual([...f.app.querySelector('#gallery-sequence').options].map(option => Number(option.value)), [9,8,7,6,5,4,3,2,1,0]);
    for (let rank = 9; rank >= 0; rank--) {
      f.w.G9.galleryFilter('path', 'mother'); f.w.G9.gallerySequence(rank);
      const expected = catalog.filter(entry => entry.sequence === rank).map(entry => entry.ability.effectId || entry.ability.id).sort();
      assert.deepEqual(f.cards().map(card => card.dataset.galleryAbility).sort(), expected); assert.equal(f.visible().length, expected.length);
      assert.equal(f.app.querySelector('#gallery-path').value, ''); count += expected.length;
    }
    assert.equal(count, 188); assert.equal(f.w.__galleryBuilds.length, 0); assert.equal(f.timers.size, 0);
  });

  await test('gallery portraits stay lazy and normal priority even when scrolled into view', f => {
    f.enter(); f.w.document.dispatchEvent(new f.w.Event('scroll'));
    f.w.prioritizeVisiblePartyPortraits?.();
    for (const image of f.app.querySelectorAll('.ability-gallery img')) {
      assert.equal(image.getAttribute('loading'), 'lazy'); assert.notEqual(image.getAttribute('fetchpriority'), 'high');
    }
  });

  await test('Sequence 7 support samples belong to the caster while Beast Command stays targeted', f => {
    f.enter(); f.w.G9.gallerySequence(7);
    for (const [id, spec] of Object.entries(f.w.G9_DATA.fx.sequence7Abilities)) if (spec.mode === 'support') {
      assert.equal(f.card(id).dataset.placement, 'self', id + ' support belongs to caster');
      assert.equal(f.card(id).querySelector('.gallery-effect').dataset.placement, 'self');
    }
    f.w.G9.gallerySequence(8); assert.equal(f.card('beast_command').dataset.placement, 'target');
  });

  await test('idle Sequence 7 travel samples retain their native artwork orientation', f => {
    f.enter(); f.w.G9.gallerySequence(7);
    for (const [id, expected] of [['witch_s_curse', -30], ['bribe_weakening', 35], ['blood_siphon', 0]]) {
      const image = f.card(id).querySelector('.gallery-effect');
      const angle = image.dataset.angleDeg ?? image.style.getPropertyValue('--gallery-art-angle');
      assert.notEqual(String(angle), '', id + ' exposes its actual idle angle');
      assert.equal(parseFloat(angle), expected, id + ' uses flow minus native rotation');
    }
  });

  await test('Fool Sequence 4 uses its integrated PNG despite an earlier setup note', f => {
    f.enter(); f.w.G9.gallerySequence(4); f.replay('bizarro_transformation');
    assert(f.card('bizarro_transformation').querySelector('.gm-combat-sequence4[data-stage="cast"]'), 'approved PNG must accompany the chip');
  });

  await test('Sequence 4 upright target samples do not inherit the swapped travel angle', f => {
    f.enter(); f.w.G9.gallerySequence(4); f.w.G9.gallerySwap(true);
    for (const id of ['door_of_concealment', 'spiteful_shackles', 'nature_s_growth_surge']) {
      const art = f.card(id).querySelector('.gallery-idle .gallery-effect');
      assert.equal(art.style.getPropertyValue('--gallery-angle'), '0deg', id + ' stays upright');
    }
  });

  await test('Moon Sequence 4 idle spirituality returns through the travel lane', f => {
    f.enter(); f.w.G9.gallerySequence(4);
    const art = f.card('scarlet_blood_domain').querySelector('.gallery-idle .gallery-effect.secondary');
    assert.equal(art.dataset.placement, 'travel');
    assert.equal(art.style.getPropertyValue('--gallery-art-angle'), '180deg');
  });

  await test('Sequence 3 shows all20 approved active PNG samples with its one split layer', f => {
    f.enter(); f.w.G9.gallerySequence(3);
    const specs = f.w.G9_DATA.fx.sequence3Abilities;
    assert.deepEqual(f.cards().map(card => card.dataset.galleryAbility).sort(), Object.keys(specs).sort());
    assert.equal(f.cards().length, 20); assert.equal(f.app.querySelectorAll('.gallery-idle .gallery-effect').length, 21);
    assert.equal(f.timers.size, 0); assert.equal(f.w.__galleryBuilds.length, 0);
    assert(!f.card('giant_s_might') && !f.card('omniscient_eye'), 'passive ranks have no active animation');
    for (const [id, spec] of Object.entries(specs)) {
      const art = f.card(id).querySelector('.gallery-idle .gallery-effect');
      assert.equal(art.getAttribute('src'), spec.asset, id + ' uses its approved asset');
      assert.equal(art.dataset.placement, spec.mode === 'caster' ? 'self' : spec.mode === 'travel' ? 'travel' : 'target');
    }
    assert.equal(f.card('concealment_realm').querySelector('.gallery-effect.secondary').getAttribute('src'), specs.concealment_realm.secondaryAsset);
    assert.equal(f.card('concealment_realm').querySelector('.gallery-effect.secondary').dataset.placement, 'self');
  });

  await test('all20 Sequence 3 replays use1250ms native casts without outcomes or save mutations', f => {
    const before = f.saved(); f.enter(); f.w.G9.gallerySequence(3);
    const definitions = JSON.stringify(f.w.G9_DATA.fx);
    for (const id of Object.keys(f.w.G9_DATA.fx.sequence3Abilities)) {
      f.replay(id);
      const node = f.card(id).querySelector('.gm-combat-sequence3[data-stage="cast"]');
      assert(node, id + ' renders the native Sequence3 cast');
      assert.equal(node.dataset.effectSrc, f.w.G9_DATA.fx.sequence3Abilities[id].asset);
      assert.equal(f.timers.size, 1); assert.equal(f.timers.values().next().value.delay, 1250);
      assert.equal(f.card(id).querySelectorAll('.gm-battle-fx-number,.gm-combat-heal,[data-stage="impact"],[data-stage="outcome"]').length, 0);
      assert.equal(f.w.__galleryBuilds.at(-1).args[0].sequence, 3);
      f.tick(); assert.equal(f.active().length, 0); assert.equal(f.timers.size, 0);
    }
    assert.equal(f.saved(), before); assert.equal(JSON.stringify(f.w.G9_DATA.fx), definitions);
    for (const build of f.w.__galleryBuilds) assert.equal(JSON.stringify(build.result.events), build.events);
  });

  await test('Sequence 3 swap keeps stationary samples upright and directs only travel artwork', f => {
    f.enter(); f.w.G9.gallerySequence(3);
    for (const swapped of [false, true]) {
      f.w.G9.gallerySwap(swapped);
      for (const [id, spec] of Object.entries(f.w.G9_DATA.fx.sequence3Abilities)) {
        const art = f.card(id).querySelector('.gallery-idle .gallery-effect');
        if (spec.mode === 'travel') {
          assert.equal(parseFloat(art.style.getPropertyValue('--gallery-art-angle')), 0, id + ' retains its native art angle');
          assert.equal(art.style.getPropertyValue('--gallery-angle'), '', id + ' inherits the gallery side angle');
          assert.equal(f.app.querySelector('.ability-gallery').classList.contains('gallery-swapped'), swapped);
        } else assert.equal(art.style.getPropertyValue('--gallery-angle'), '0deg', id + ' stays upright');
      }
      const veil = f.card('concealment_realm').querySelector('.gallery-effect.secondary');
      assert.equal(veil.style.getPropertyValue('--gallery-angle'), '0deg');
      f.replay('concealment_realm');
      const primary = f.card('concealment_realm').querySelector('.gm-combat-sequence3[data-stage="cast"]');
      const secondary = f.card('concealment_realm').querySelector('.gm-combat-sequence3[data-stage="cast-secondary"]');
      assert(primary && secondary); assert.notEqual(primary.dataset.targetId, secondary.dataset.targetId);
      assert.equal(primary.dataset.angleDeg, '0'); assert.equal(secondary.dataset.angleDeg, '0'); f.tick();
    }
  });

  await test('changing Sequence cancels a long Sequence 3 replay and rejects its stale timeout', f => {
    f.enter(); f.w.G9.gallerySequence(3); f.replay('historical_summoning');
    const stale = f.timers.values().next().value.fn;
    f.w.G9.gallerySequence(4); assert.equal(f.timers.size, 0); assert.equal(f.active().length, 0);
    f.replay('bizarro_transformation'); assert.equal(f.timers.values().next().value.delay, 800);
    stale(); assert(f.card('bizarro_transformation').querySelector('.gm-combat-sequence4')); assert.equal(f.timers.size, 1);
    f.tick(); assert.equal(f.timers.size, 0);
  });

  await test('gallery navigation cleans its replay and ordinary 1v1/2v2 simulation stays usable', f => {
    const before = f.saved(); f.enter(); f.replay('holy_sun_bolt'); const stale = f.timers.values().next().value.fn;
    f.w.G9.simulatorSection('battle'); assert(f.app.querySelector('.sim-grid')); assert.equal(f.timers.size, 0); assert.equal(f.active().length, 0);
    const text = f.app.textContent; stale(); assert.equal(f.app.textContent, text); assert.equal(f.timers.size, 0);
    f.w.G9.simMode('2v2'); f.w.G9.runSimulation(); assert.equal(f.app.querySelectorAll('.gm-arena-unit.ally').length, 2);
    assert.equal(f.app.querySelectorAll('.gm-arena-unit.enemy').length, 2); f.w.G9.skipTicker(true);
    const completed = f.app.querySelector('#sim-viewport').textContent.trim(); f.w.G9.simulatorSection('animations'); f.w.G9.simulatorSection('battle');
    assert.equal(f.app.querySelector('#sim-viewport').textContent.trim(), completed);
    f.w.G9.simMode('1v1'); f.w.G9.runSimulation(); assert.equal(f.app.querySelectorAll('.gm-arena-unit.ally').length, 1); f.w.G9.skipTicker(true);
    f.enter(); f.replay('holy_sun_bolt'); f.w.G9.tab('hall'); assert.equal(f.timers.size, 0); assert.equal(f.active().length, 0); assert.equal(f.saved(), before);
  });

  await test('an active contract retains playback priority over gallery actions', f => {
    f.w.G9.plan('gallery-contract'); f.w.G9.toggleAssign(f.agent.id); f.w.G9.launch();
    assert(f.app.querySelector('#battle-viewport')); f.w.G9.tab('simulator'); f.w.G9.simulatorSection('animations');
    const before = f.timers.values().next().value; f.w.G9.galleryReplay('holy_sun_bolt');
    assert(f.app.querySelector('#battle-viewport')); assert.equal(f.timers.size, 1); assert.equal(f.timers.values().next().value, before);
    assert.equal(f.app.querySelector('.gm-combat-sequence5'), null); f.w.G9.skipTicker(); assert.equal(f.timers.size, 0);
    assert.equal(f.app.querySelector('.battle-completion').hidden, false);
  });

  console.log(`\nAbility gallery UI: ${passed} passed, ${failed} failed.`);
  if (failed) process.exitCode = 1;
})();
