// Real browser-UI playback regressions. NODE_PATH=<jsdom node_modules> node tests/combat-animation-controls.test.js
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const g = require('../js/node-loader');
const root = path.resolve(__dirname, '..');
let passed = 0, failed = 0;

async function fixture(options = {}) {
  const dom = new JSDOM('<div id="app"></div>', { url: 'https://example.test/guild_of_mystery/', runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window;
  w.fetch = async url => ({ ok: true, json: async () => JSON.parse(fs.readFileSync(path.join(root, new URL(url).pathname.replace('/guild_of_mystery/', '')), 'utf8')) });
  w.eval(fs.readFileSync(path.join(root, 'js/data-loader.js'), 'utf8'));
  w.G9_DATA = await w.G9DataLoader.load();
  w.setInterval = () => 1; w.clearInterval = () => {}; w.scrollTo = () => {};
  w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  let timerId = 0, clock = 0;
  w.performance.now = () => clock;
  const timers = new Map(), animations = [];
  w.setTimeout = (fn, delay) => { timers.set(++timerId, { fn, delay }); return timerId; };
  w.clearTimeout = id => timers.delete(id);
  w.HTMLElement.prototype.animate = function () {
    const animation = {
      playState: 'running', playbackRate: 1,
      pause() { this.playState = 'paused'; }, play() { this.playState = 'running'; },
      cancel() { this.playState = 'idle'; this.cancelled = true; this.oncancel?.(); }
    };
    animations.push(animation); return animation;
  };
  w.HTMLElement.prototype.getBoundingClientRect = function () {
    const card = this.closest?.('[data-unit-id]'), canvas = this.matches('.gm-dungeon-arena, .gm-battlefield-canvas');
    const left = canvas ? 0 : card?.classList.contains('enemy') ? 180 : 60;
    const top = canvas ? 0 : card?.classList.contains('enemy') ? 80 : 350;
    const width = canvas ? 390 : 64, height = canvas ? 600 : 64;
    return { left, top, right: left + width, bottom: top + height, width, height, x: left, y: top, toJSON() {} };
  };
  const save = g.newGame();
  const agent = g.makeAgent(() => .4, { path: 'fool', sequence: 5, trait: 'Stout Vitality' });
  agent.id = 'animation-agent'; agent.name = 'Chronicle Agent'; g.restatAgent(agent);
  save.roster = [agent];
  save.quests = [{ id: 'animation-contract', name: 'Presentation Fixture', encounter: true, objective: 'combat', difficultySequence: 5, rewards: { funds: 0, reputation: 0, materials: {} } }];
  require('./pool-fixture')(g, save);
  w.localStorage.setItem('guild-rpg-browser-v9', JSON.stringify(save));
  w.eval(['vendor/dayjs.min', 'paths', 'v15', 'generate', 'traits', 'market', 'pathway-assets', 'signatures', 'mythical', 'battle-ai', 'engine', 'state', 'campaign', 'ui'].map(name => fs.readFileSync(path.join(root, `js/${name}.js`), 'utf8')).join('\n'));
  const resolve = w.resolveQuest;
  let allyId = agent.id;
  const enemyId = 'enemy_0';
  w.resolveQuest = (...args) => {
    const result = resolve(...args);
    allyId = args[0][0].id;
    const ally = { id: allyId, name: 'Chronicle Agent', team: 'ally', path: 'fool', sequence: 0, hp: 50, maxHp: 100, sp: 20, maxSP: 20, alive: true, inForm: false };
    const enemy = { id: enemyId, name: 'Curse Vessel', team: 'enemy', path: 'chained', sequence: 0, hp: 100, maxHp: 100, sp: 20, maxSP: 20, alive: true, inForm: false };
    result.events = [
      { round: 1, type: 'round_start' },
      { round: 1, type: 'cast', actorId: allyId, actorName: ally.name, actorTeam: 'ally', ability: 'Runebore Revolver', costSP: 4 },
      { round: 1, type: 'damage', actorId: allyId, actorName: ally.name, actorTeam: 'ally', targetId: enemyId, targetName: enemy.name, targetTeam: 'enemy', damageType: 'physical', amount: 70, hpLoss: 70, hpAfter: 30, shieldAfter: 0 },
      { round: 1, type: 'story', subtype: 'mythical_form', actorId: enemyId, actorName: enemy.name, actorTeam: 'enemy', inTurn: true, text: 'Curse Vessel awakens Bandaged Curse Vessel.' },
      { round: 1, type: 'shield', actorId: enemyId, actorName: enemy.name, actorTeam: 'enemy', targetId: enemyId, targetName: enemy.name, targetTeam: 'enemy', amount: 25, shieldAfter: 25 },
      { round: 1, type: 'damage', actorId: enemyId, actorName: enemy.name, actorTeam: 'enemy', targetId: allyId, targetName: ally.name, targetTeam: 'ally', damageType: 'dark', amount: 50, hpLoss: 50, hpAfter: 0, shieldAfter: 0, isReaction: true },
      { round: 1, type: 'death', targetId: allyId, targetName: ally.name, targetTeam: 'ally', text: 'Chronicle Agent falls.' },
      { round: 1, type: 'resources', units: [{ ...ally, hp: 0, alive: false, sp: 3 }, { ...enemy, hp: 30, shield: 25, inForm: true, sp: 7 }] },
      { round: 1, type: 'cast', actorId: enemyId, actorName: enemy.name, actorTeam: 'enemy', ability: 'Gather Shadows', costSP: 2 },
      { round: 1, type: 'shield', actorId: enemyId, actorName: enemy.name, actorTeam: 'enemy', targetId: enemyId, targetName: enemy.name, targetTeam: 'enemy', amount: 5, shieldAfter: 30 },
      { round: 1, type: 'resources', units: [{ ...ally, hp: 0, alive: false, sp: 3 }, { ...enemy, hp: 30, shield: 30, inForm: true, sp: 5 }] },
      { round: 1, type: 'story', text: 'The encounter is recorded.' }
    ];
    if (options.basic) result.events = [
      ...result.events.slice(0, 3),
      { round: 1, type: 'resources', units: [{ ...ally, sp: 16 }, { ...enemy, hp: 30 }] },
      { round: 1, type: 'story', text: 'The encounter is recorded.' }
    ];
    result.success = false; result.battleOutcome = 'defeat';
    result.battleSnapshot = {
      ...result.battleSnapshot, outcome: 'defeat',
      initialUnits: [ally, enemy],
      allies: [{ ...ally, hp: 0, alive: false }],
      enemies: [{ ...enemy, hp: 30, alive: !options.allFinalDead }]
    };
    return result;
  };
  if (options.sim) { w.G9.tab('simulator'); w.G9.runSimulation(); }
  else { w.G9.plan('animation-contract'); w.G9.toggleAssign(agent.id); w.G9.launch(); }
  const app = w.document.getElementById('app');
  const card = id => [...app.querySelectorAll('.gm-arena-unit')].find(node => node.dataset.unitId === id);
  const tick = () => {
    assert.equal(timers.size, 1, 'exactly one scheduler can advance the presentation');
    const [id, timer] = timers.entries().next().value;
    timers.delete(id); clock += timer.delay; timer.fn();
  };
  return { dom, w, app, timers, animations, tick, card, elapse: ms => { clock += ms; }, get time() { return clock; }, get allyId() { return allyId; }, enemyId };
}

async function test(name, fn, options) {
  let f;
  try { f = await fixture(options); await fn(f); passed++; console.log('PASS ' + name); }
  catch (error) { failed++; console.error('FAIL ' + name + ': ' + error.stack); }
  finally { f?.dom.window.close(); }
}

function hp(node) { return node.querySelector('.gm-hp-num').textContent; }
function sp(node) { return node.querySelector('.gm-float-gauge.mp .gm-float-num').textContent; }
function log(f) { return f.app.querySelector('.battle-ticker-viewport'); }
function beginHit(f) { f.tick(); f.tick(); f.tick(); }
function clean(f) {
  assert.equal(f.app.querySelectorAll('.gm-battle-fx-layer, .gm-battle-fx, .gm-battle-fx-number').length, 0);
  assert(![...f.app.querySelectorAll('[class]')].some(node => [...node.classList].some(name => name.startsWith('gm-cue-'))));
}

(async () => {
  await test('the live scheduler reveals cast, hit, awakening, shield, reaction and death in causal order', f => {
    const ally = f.card(f.allyId), enemy = f.card(f.enemyId), allyImage = ally.querySelector('img'), enemyImage = enemy.querySelector('img');
    assert.equal(hp(ally), '50/100'); assert.equal(hp(enemy), '100/100');
    f.tick(); assert(log(f).textContent.includes('Round 1')); assert.equal(log(f).querySelectorAll('.b-turn-header').length, 0);
    f.tick(); assert(log(f).textContent.includes('Runebore Revolver')); assert.equal(hp(enemy), '100/100'); assert.equal(sp(ally), '16/20');
    assert(!log(f).textContent.includes('70 HP')); assert(!enemy.classList.contains('mythical'));
    f.tick(); assert.equal(hp(enemy), '30/100'); assert(log(f).textContent.includes('70 HP')); assert(!log(f).textContent.includes('MYTHICAL FORM AWAKENING'));
    assert.equal(sp(enemy), '20/20'); assert(enemy.querySelector('.gm-shield-num').hidden);
    f.tick(); assert(enemy.classList.contains('mythical')); assert(log(f).textContent.includes('MYTHICAL FORM AWAKENING')); assert(enemy.querySelector('.gm-shield-num').hidden);
    assert.equal(enemy.querySelector('img'), enemyImage); assert(enemyImage.getAttribute('src').includes('chained_mythical'));
    f.tick(); assert.equal(enemy.querySelector('.gm-shield-num').textContent, '25 Shield'); assert(!enemy.querySelector('.gm-shield-num').hidden);
    assert.equal(hp(ally), '50/100'); assert(!log(f).textContent.includes('Reaction ·'));
    f.tick(); assert.equal(hp(ally), '0/100'); assert(log(f).textContent.includes('Reaction ·')); assert(!log(f).textContent.includes('Chronicle Agent falls'));
    assert.equal(sp(enemy), '20/20', 'the authoritative end-of-action snapshot is still unrevealed');
    f.tick(); assert(log(f).textContent.includes('Chronicle Agent falls')); assert(ally.classList.contains('dead'));
    assert.equal(sp(ally), '16/20', 'the final impact remains readable before reconciliation');
    f.tick();
    assert.equal(sp(ally), '3/20'); assert.equal(sp(enemy), '7/20');
    assert.equal(f.card(f.allyId), ally); assert.equal(ally.querySelector('img'), allyImage);
    assert(f.app.querySelector('.battle-completion').hidden, 'settlement waits for the remaining encounter rows');
  });

  await test('Pause freezes a partial action and stale callbacks; Step finishes one action and resume schedules once', f => {
    beginHit(f);
    const stale = f.timers.values().next().value.fn;
    const enemy = f.card(f.enemyId);
    f.w.G9.toggleTickerPause(); assert.equal(f.timers.size, 0); assert.equal(f.app.querySelector('[data-pause]').textContent, 'Resume');
    const before = log(f).textContent;
    assert(f.animations.filter(animation => !animation.cancelled).every(animation => animation.playState === 'paused'));
    stale(); assert.equal(log(f).textContent, before); assert.equal(hp(enemy), '30/100'); assert(!enemy.classList.contains('mythical'));
    f.w.G9.stepTicker(); assert.equal(f.timers.size, 0); assert(enemy.classList.contains('mythical')); assert.equal(sp(enemy), '7/20');
    assert.equal(log(f).querySelectorAll('.b-turn-header').length, 1); assert(!log(f).textContent.includes('Gather Shadows'));
    clean(f);
    f.w.G9.toggleTickerPause(); assert.equal(f.timers.size, 1); assert.equal(f.app.querySelector('[data-pause]').textContent, 'Pause');
    f.tick(); assert.equal(log(f).querySelectorAll('.b-turn-header').length, 2); assert(log(f).textContent.includes('Gather Shadows'));
    assert.equal(f.timers.size, 1);
  });

  await test('paused speed changes stay paused and live speed changes replace the scheduler without replay', f => {
    beginHit(f);
    f.w.G9.toggleTickerPause(); f.w.G9.setTickerSpeed(2); assert.equal(f.timers.size, 0);
    f.w.G9.toggleTickerPause(); assert.equal(f.timers.size, 1); assert.equal(f.timers.values().next().value.delay, 225);
    const stale = f.timers.values().next().value.fn;
    f.w.G9.setTickerSpeed(4); assert.equal(f.timers.size, 1); assert.equal(f.timers.values().next().value.delay, 112.5);
    const before = log(f).textContent; stale(); assert.equal(log(f).textContent, before);
    f.tick(); assert.equal(log(f).querySelectorAll('.b-turn-header').length, 1); assert.equal(sp(f.card(f.enemyId)), '20/20');
    assert(log(f).textContent.includes('MYTHICAL FORM AWAKENING')); assert(!log(f).textContent.includes('Chronicle Agent falls'));
    f.tick(); f.tick(); f.tick(); f.tick();
    assert.equal(sp(f.card(f.enemyId)), '7/20');
    assert(log(f).textContent.includes('Chronicle Agent falls')); assert(!log(f).textContent.includes('Gather Shadows'));
    f.tick(); assert.equal(log(f).querySelectorAll('.b-turn-header').length, 2);
    f.tick(); f.tick(); assert.equal(sp(f.card(f.enemyId)), '5/20');
    assert.equal(log(f).textContent.split('Runebore Revolver').length - 1, 1, 'speed changes cannot duplicate an action');
  });

  await test('Skip during an action commits final state, clears pending effects and enables the result controls', f => {
    beginHit(f);
    const stale = f.timers.values().next().value.fn;
    f.w.G9.skipTicker(); assert.equal(f.timers.size, 0); clean(f);
    const completed = log(f).textContent; stale(); assert.equal(log(f).textContent, completed);
    assert.equal(sp(f.card(f.enemyId)), '5/20'); assert.equal(f.card(f.enemyId).querySelector('.gm-shield-num').textContent, '30 Shield');
    assert(f.card(f.allyId).classList.contains('dead')); assert(log(f).textContent.includes('The encounter is recorded.'));
    assert.equal(f.app.querySelector('.battle-completion').hidden, false);
    assert(f.app.querySelector('[data-pause]').disabled); assert(f.app.querySelector('[data-step]').disabled); assert(f.app.querySelector('[data-skip]').hidden);
    assert([...f.app.querySelectorAll('.battle-completion button')].some(button => button.textContent === 'Return to Guild' && !button.disabled));
  });

  await test('natural completion reconciles the final state and stops the scheduler', f => {
    for (let guard = 0; f.timers.size && guard < 30; guard++) f.tick();
    assert.equal(f.timers.size, 0); assert.equal(log(f).querySelectorAll('.b-turn-header').length, 2);
    assert.equal(sp(f.card(f.enemyId)), '5/20'); assert.equal(f.app.querySelector('.battle-completion').hidden, false);
    assert(f.app.querySelector('[data-pause]').disabled); assert(log(f).textContent.includes('The encounter is recorded.'));
  });

  await test('simulator starts its eventual casualties alive using initial snapshots on both teams', f => {
    for (const card of f.app.querySelectorAll('.gm-arena-unit')) assert(!card.classList.contains('dead'), 'final casualty flags cannot appear before their death event');
    assert.equal(hp(f.card(f.allyId)), '50/100'); assert.equal(hp(f.card(f.enemyId)), '100/100');
    f.tick(); f.tick(); assert(!f.card(f.allyId).classList.contains('dead')); assert(!f.card(f.enemyId).classList.contains('dead'));
  }, { sim: true, allFinalDead: true });

  await test('leaving a simulator clears effects and stale callbacks cannot alter the next view', f => {
    beginHit(f);
    const stale = f.timers.values().next().value.fn, previous = log(f), previousText = previous.textContent;
    f.w.G9.tab('hall'); assert.equal(f.timers.size, 0); clean(f);
    const nav = f.app.querySelector('nav.tabs'); stale();
    assert.equal(f.app.querySelector('nav.tabs'), nav); assert.equal(f.app.querySelector('.battle-ticker-viewport'), null);
    assert.equal(previous.textContent, previousText, 'detached rows cannot receive a stale event');
  }, { sim: true });

  await test('clearing and restarting a simulator invalidates callbacks from the previous battle', f => {
    beginHit(f);
    const stale = f.timers.values().next().value.fn;
    f.w.G9.clearSimulation(); assert.equal(f.timers.size, 0); assert.equal(log(f), null); clean(f);
    f.w.G9.runSimulation(); assert.equal(f.timers.size, 1);
    const fresh = log(f), initial = fresh.textContent; stale();
    assert.equal(log(f), fresh); assert.equal(fresh.textContent, initial); assert.equal(hp(f.card(f.enemyId)), '100/100');
    f.tick(); assert.equal(log(f).querySelectorAll('.b-turn-header').length, 0); assert(log(f).textContent.includes('Round 1'));
  }, { sim: true });

  await test('simulator Skip also clears partial phases and stops all playback', f => {
    beginHit(f); f.w.G9.toggleTickerPause(); f.w.G9.skipTicker(true);
    assert.equal(f.timers.size, 0); clean(f); assert.equal(sp(f.card(f.enemyId)), '5/20');
    assert(f.app.querySelector('[data-pause]').disabled); assert(f.app.querySelector('[data-step]').disabled);
    assert.equal(f.app.querySelector('.b-result-box').hidden, false);
  }, { sim: true });

  for (const speed of [.5, 1, 2, 4]) await test(`ordinary action lasts ${2000 / speed}ms at ${speed}x with ordered impacts`, f => {
    f.w.G9.setTickerSpeed(speed); f.tick(); f.tick();
    const started = f.time;
    assert.equal(hp(f.card(f.enemyId)), '100/100');
    f.tick(); assert.equal(hp(f.card(f.enemyId)), '30/100');
    assert(f.app.querySelector('.battle-partial-row'));
    f.tick(); assert.equal(f.time - started, 2000 / speed);
    assert.equal(f.app.querySelector('.battle-partial-row'), null);
  }, { basic: true });

  await test('complex actions retain extra reading time and Pause preserves the remaining phase clock', f => {
    f.tick(); f.tick(); const started = f.time;
    for (let i = 0; i < 6; i++) f.tick();
    assert.equal(f.time - started, 3700);
    assert(log(f).textContent.includes('Chronicle Agent falls'));
  });

  await test('Pause and speed changes preserve elapsed reading time without advancing while paused', f => {
    beginHit(f); f.elapse(200); f.w.G9.toggleTickerPause();
    f.elapse(10000); f.w.G9.toggleTickerPause();
    assert.equal(f.timers.values().next().value.delay, 250);
    f.elapse(50); f.w.G9.setTickerSpeed(2);
    assert.equal(f.timers.values().next().value.delay, 100);
    f.tick(); assert(log(f).textContent.includes('MYTHICAL FORM AWAKENING'));
  });

  console.log(`\nCombat animation controls: ${passed} passed, ${failed} failed.`);
  if (failed) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
