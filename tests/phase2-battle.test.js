// Real browser-UI regressions. NODE_PATH=/tmp/guild-ui-check/node_modules node tests/phase2-battle.test.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const g = require('../js/node-loader');
const root = path.resolve(__dirname, '..');
let passed = 0, failed = 0;

async function fixture(sim = false) {
  const dom = new JSDOM('<div id="app"></div>', { url: 'https://example.test/guild_of_mystery/', runScripts: 'dangerously' });
  const w = dom.window;
  const style = w.document.createElement('style');
  style.textContent = fs.readFileSync(path.join(root, 'css/components/battle-log.css'), 'utf8');
  w.document.head.append(style);
  w.fetch = async url => ({ ok: true, json: async () => JSON.parse(fs.readFileSync(path.join(root, new URL(url).pathname.replace('/guild_of_mystery/', '')), 'utf8')) });
  w.eval(fs.readFileSync(path.join(root, 'js/data-loader.js'), 'utf8'));
  w.G9_DATA = await w.G9DataLoader.load();
  const positions = new WeakMap();
  Object.defineProperties(w.HTMLElement.prototype, {
    clientHeight: { get() { return this.matches('.battle-ticker-viewport') ? 240 : 600; } },
    scrollHeight: { get() { return this.matches('.battle-ticker-viewport') ? this.children.length * 28 : 1200; } },
    scrollTop: { get() { return positions.get(this) || 0; }, set(v) { positions.set(this, Math.max(0, Math.min(v, this.scrollHeight - this.clientHeight))); } }
  });
  w.scrollTo = (x, y) => { w.scrollX = x; w.scrollY = y; };
  let timerId = 0;
  const timers = new Map();
  w.setTimeout = (fn, delay) => { timers.set(++timerId, { fn, delay }); return timerId; };
  w.clearTimeout = id => timers.delete(id);
  const tick = () => {
    assert(timers.size, 'an active playback timer must be available');
    const [id, timer] = timers.entries().next().value;
    timers.delete(id); timer.fn();
  };
  const state = g.newGame();
  const agent = g.makeAgent(() => .4, { path: 'fool', sequence: 9, trait: 'Stout Vitality' });
  agent.id = 'test-agent'; agent.name = 'Test Agent'; g.restatAgent(agent);
  state.roster = [agent];
  state.quests = [{ id: 'test-contract', name: 'The Chapel Below', encounter: true, objective: 'combat', difficultySequence: 9, rewards: { funds: 0, reputation: 0, materials: {} }, tags: ['occult'] }];
  w.localStorage.setItem('guild-rpg-browser-v9', JSON.stringify(state));
  w.eval(['paths', 'v15', 'generate', 'signatures', 'mythical', 'engine', 'state', 'campaign', 'ui'].map(name => fs.readFileSync(path.join(root, `js/${name}.js`), 'utf8')).join('\n'));
  const allyId = sim ? 'sim_0_fool_9' : agent.id;
  w.groupEventsToRows = () => [{ round: 1, initiative: 'Test order', rows: [
    { type: 'turn', actorId: 'enemy_0', actorName: 'Enemy', actorTeam: 'enemy', ability: 'Strike', costSP: 10,
      damages: [{ targetId: allyId, targetName: sim ? 'The Fool Seq 9' : agent.name, amount: 25, hpAfter: 125 }],
      shields: [{ targetId: allyId, amount: 40 }], subrows: [{ type: 'status', text: 'Test Agent is bound for 1 turn.' }] },
    { type: 'turn', actorId: 'enemy_0', actorName: 'Enemy', actorTeam: 'enemy', ability: 'Strike',
      damages: [{ targetId: allyId, amount: 10, hpAfter: 115, absorbed: 10, shieldAfter: 30 }] },
    { type: 'turn', actorId: 'enemy_0', actorName: 'Enemy', actorTeam: 'enemy', ability: 'Strike',
      deaths: [{ targetId: allyId, targetName: agent.name }] },
    { type: 'turn', actorId: allyId, actorName: agent.name, actorTeam: 'ally', ability: 'Resurrection',
      revives: [{ targetId: allyId, hpAfter: 50 }] },
    ...Array.from({ length: 145 }, (_, i) => ({ type: 'story', text: `Event ${i}: <img src=x onerror="window.hacked=true">` }))
  ] }];
  const config = w.G9_DATA.contracts.battlefields;
  config.defaultImage = 'data/assets/battlefields/default.webp';
  config.encounters['The Chapel Below'] = 'data/assets/battlefields/chapel.webp';
  config.simulatorImage = 'data/assets/battlefields/training.webp';
  if (sim) { w.G9.tab('simulator'); w.G9.runSimulation(); }
  else { w.G9.plan('test-contract'); w.G9.toggleAssign(agent.id); w.G9.launch(); }
  const app = w.document.getElementById('app');
  const nodes = {
    unit: app.querySelector('.gm-rank-allies .gm-arena-unit'),
    portrait: app.querySelector('.combat-sprite-img'), arena: app.querySelector('.gm-dungeon-arena'),
    backdrop: app.querySelector('.gm-battlefield-image'), viewport: app.querySelector('.battle-ticker-viewport'),
    toolbar: app.querySelector('.battle-toolbar'), nav: app.querySelector('nav.tabs'), modal: app.querySelector('.quest-modal')
  };
  return { dom, w, app, timers, tick, nodes, config, agent };
}

async function test(name, fn, sim = false) {
  let f;
  try { f = await fixture(sim); await fn(f); passed++; console.log(`PASS ${name}`); }
  catch (error) { failed++; console.log(`FAIL ${name}: ${error.message}`); }
  finally { f?.dom.window.close(); }
}
function assertStable(f) {
  for (const [key, node] of Object.entries(f.nodes)) {
    if (node) assert(node.isConnected, `${key} node must stay attached`);
  }
  assert.equal(f.app.querySelector('.combat-sprite-img'), f.nodes.portrait, 'portrait identity must be preserved');
  assert.equal(f.app.querySelector('.gm-rank-allies .gm-arena-unit'), f.nodes.unit, 'unit identity must be preserved');
}

async function main() {
  await test('scrolling a party portrait into view promotes only that visible image', f => {
    const portrait = f.nodes.portrait;
    portrait.loading = 'lazy'; portrait.fetchPriority = 'auto';
    portrait.getBoundingClientRect = () => ({top:900,bottom:968,left:10,right:78,width:68,height:68});
    f.w.dispatchEvent(new f.w.Event('scroll'));
    assert.equal(portrait.loading, 'lazy');
    portrait.getBoundingClientRect = () => ({top:30,bottom:98,left:10,right:78,width:68,height:68});
    f.w.dispatchEvent(new f.w.Event('scroll'));
    assert.equal(portrait.loading, 'eager');
    assert.equal(portrait.fetchPriority, 'high');
    assertStable(f);
  });
  await test('quest timer tick preserves portrait, unit, arena, viewport, toolbar and navigation', f => { f.tick(); assertStable(f); });
  await test('quest tick does not remove any arena unit or image from the live DOM', async f => {
    const records = [];
    const observer = new f.w.MutationObserver(m => records.push(...m));
    observer.observe(f.app, { childList: true, subtree: true });
    f.tick(); await Promise.resolve(); observer.disconnect();
    assert(!records.some(m => [...m.removedNodes].some(n => n === f.nodes.unit || n === f.nodes.portrait || n.contains?.(f.nodes.unit))), 'no removed subtree may contain a portrait or unit');
  });
  await test('quest playback updates HP and shield gauges on the original unit', f => {
    f.tick(); f.tick();
    assertStable(f);
    assert.equal(f.nodes.unit.querySelector('.gm-float-gauge.hp .gm-float-num').textContent, `125/${g.abbrNum(f.agent.stats.hp)}`);
    assert.equal(f.nodes.unit.querySelector('.gm-float-fill.shield').style.width, `${Math.round(40 / f.agent.stats.hp * 100)}%`);
    f.tick();
    assert.equal(f.nodes.unit.querySelector('.gm-float-gauge.hp .gm-float-num').textContent, `115/${g.abbrNum(f.agent.stats.hp)}`);
  });
  await test('quest death and revival toggle the original unit class without replacing it', f => {
    for (let i = 0; i < 4; i++) f.tick();
    assertStable(f); assert(f.nodes.unit.classList.contains('dead'));
    f.tick(); assertStable(f); assert(!f.nodes.unit.classList.contains('dead'));
    assert(f.nodes.unit.querySelector('.gm-float-num').textContent.startsWith('50/'));
  });
  await test('existing log rows and status text survive subsequent ticks in place', f => {
    f.tick(); f.tick(); const row = f.nodes.viewport.querySelector('.b-row');
    assert(row.textContent.includes('bound for 1 turn'));
    f.tick(); assert.equal(f.nodes.viewport.querySelector('.b-row'), row);
  });
  await test('speed changes preserve all battle nodes and replace one timer', f => {
    f.w.G9.setTickerSpeed(2); assertStable(f); assert.equal(f.timers.size, 1);
    assert.equal(f.timers.values().next().value.delay, 250);
    assert.equal(f.nodes.toolbar.querySelector('.speed-controls button.active').textContent, '2x');
    f.w.G9.setTickerSpeed(4); assertStable(f); assert.equal(f.timers.size, 1);
    assert.equal(f.timers.values().next().value.delay, 100);
  });
  await test('Details toggle updates row detail text while preserving portraits and reading position', f => {
    for (let i = 0; i < 35; i++) f.tick();
    f.nodes.viewport.scrollTop = 100;
    f.w.G9.toggleDetails(); assertStable(f); assert.equal(f.nodes.viewport.scrollTop, 100);
    assert(f.nodes.viewport.textContent.includes('10 SP'));
    f.w.G9.toggleDetails(); assertStable(f); assert(!f.nodes.viewport.textContent.includes('10 SP'));
  });
  await test('failed battlefield image stays hidden across playback ticks', f => {
    f.nodes.backdrop.dispatchEvent(new f.w.Event('error')); assert(f.nodes.backdrop.hidden);
    f.tick(); assertStable(f); assert.equal(f.app.querySelector('.gm-battlefield-image'), f.nodes.backdrop);
    assert(f.nodes.backdrop.hidden);
  });
  await test('quest skip completes in place, shows settlement action and stops the timer', f => {
    f.w.G9.skipTicker(); assertStable(f); assert.equal(f.timers.size, 0);
    assert.equal(f.nodes.viewport.querySelectorAll('.b-row').length, 149);
    assert.equal(f.nodes.viewport.querySelector('.typing'), null);
    assert([...f.app.querySelectorAll('button')].some(b => !b.closest('[hidden]') && b.textContent === 'Return to Guild'));
  });
  await test('completed Skip control stays hidden under the actual toolbar stylesheet', f => {
    const skip = [...f.nodes.toolbar.querySelectorAll('button')].find(b => b.textContent === 'Skip');
    assert.notEqual(f.w.getComputedStyle(skip).display, 'none');
    f.w.G9.skipTicker();
    const remaining = [...f.app.querySelectorAll('.battle-toolbar button')].find(b => b.textContent === 'Skip');
    assert(!remaining || f.w.getComputedStyle(remaining).display === 'none', 'finished Skip cannot remain visibly active');
  });
  await test('log text stays escaped when appended during playback', f => {
    for (let i = 0; i < 7; i++) f.tick();
    assert.equal(f.nodes.viewport.querySelector('img'), null);
    assert(f.nodes.viewport.textContent.includes('<img src=x'));
    assert.equal(f.w.hacked, undefined);
  });
  await test('quest modal and page scroll remain stable through long playback', f => {
    for (let i = 0; i < 40; i++) f.tick();
    f.nodes.viewport.scrollTop = 140; f.nodes.modal.scrollTop = 180; f.w.scrollTo(0, 220);
    for (let i = 0; i < 45; i++) f.tick();
    assertStable(f); assert.equal(f.nodes.viewport.scrollTop, 140); assert.equal(f.nodes.modal.scrollTop, 180); assert.equal(f.w.scrollY, 220);
  });
  await test('simulator timer tick preserves its existing portrait and viewport', f => { f.tick(); assertStable(f); }, true);
  await test('simulator HP changes update the existing unit', f => {
    f.tick(); f.tick(); assertStable(f);
    assert(f.nodes.unit.querySelector('.gm-float-num').textContent.startsWith('125/'));
  }, true);
  await test('simulator Details and speed controls preserve portraits', f => {
    f.tick(); f.tick(); f.w.G9.toggleSimDetails(); assertStable(f);
    f.w.G9.setTickerSpeed(4); assertStable(f); assert.equal(f.timers.size, 1);
  }, true);
  await test('simulator skip preserves nodes and stops playback', f => {
    f.w.G9.skipTicker(true); assertStable(f); assert.equal(f.timers.size, 0);
    assert.equal(f.nodes.viewport.querySelectorAll('.b-row').length, 149);
    assert(f.app.querySelector('.b-result-box'));
  }, true);
  await test('leaving simulator clears its timer and old callback cannot advance a new view', f => {
    const old = f.timers.values().next().value.fn;
    f.w.G9.tab('hall'); assert.equal(f.timers.size, 0);
    const nav = f.app.querySelector('nav.tabs'); old();
    assert.equal(f.app.querySelector('nav.tabs'), nav);
    assert.equal(f.app.querySelector('.battle-ticker-viewport'), null);
  }, true);
  await test('clearing a simulation cancels the timer', f => {
    f.w.G9.clearSimulation(); assert.equal(f.timers.size, 0);
    assert.equal(f.app.querySelector('.battle-ticker-viewport'), null);
  }, true);
  await test('finished quest can settle normally after in-place playback', f => {
    f.w.G9.skipTicker(); f.w.G9.closeQuest(); assert.equal(f.timers.size, 0);
    assert.equal(f.app.querySelector('.quest-modal'), null);
    const saved = JSON.parse(f.w.localStorage.getItem('guild-rpg-browser-v9'));
    assert(!saved.quests.some(q => q.id === 'test-contract'));
  });
  console.log(`Phase 2 battle DOM: ${passed} passed, ${failed} failed.`);
  if (failed) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
