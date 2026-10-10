// DOM regression checks; requires jsdom (npm install --prefix /tmp/guild-ui-check jsdom).
// NODE_PATH=/tmp/guild-ui-check/node_modules node tests/battle-ui.test.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const g = require('../js/node-loader');

async function main() {
  const root = path.resolve(__dirname, '..');
  const dom = new JSDOM('<div id="app"></div>', { url: 'https://example.test/guild_of_mystery/', runScripts: 'dangerously' });
  const w = dom.window;
  w.fetch = async url => ({ ok: true, json: async () => JSON.parse(fs.readFileSync(path.join(root, new URL(url).pathname.replace('/guild_of_mystery/', '')), 'utf8')) });
  w.eval(fs.readFileSync(path.join(root, 'js/data-loader.js'), 'utf8'));
  w.G9_DATA = await w.G9DataLoader.load();
  const positions = new WeakMap();
  Object.defineProperties(w.HTMLElement.prototype, {
    clientHeight: { get() { return this.matches('.battle-ticker-viewport') ? 240 : 600; } },
    scrollHeight: { get() { return this.matches('.battle-ticker-viewport') ? this.children.length * 28 : 1200; } },
    scrollTop: { get() { return positions.get(this) || 0; }, set(value) { positions.set(this, Math.max(0, Math.min(value, this.scrollHeight - this.clientHeight))); } }
  });
  w.scrollTo = (x, y) => { w.scrollX = x; w.scrollY = y; };
  let timerId = 0;
  const timers = new Map();
  w.setTimeout = (fn, delay) => { timers.set(++timerId, { fn, delay }); return timerId; };
  w.clearTimeout = id => timers.delete(id);
  const tick = () => { const [id, timer] = timers.entries().next().value; timers.delete(id); timer.fn(); };
  const fixture = g.newGame();
  const agent = g.makeAgent(() => 0.4, { path: 'fool', sequence: 9, trait: 'Stout Vitality' });
  agent.id = 'test-agent'; g.restatAgent(agent);
  fixture.roster = [agent];
  fixture.quests = [{ id: 'test-contract', name: 'The Chapel Below', encounter: true, objective: 'combat', difficultySequence: 9, rewards: { funds: 0, reputation: 0, materials: {} }, tags: ['occult'] }];
  w.localStorage.setItem('guild-rpg-browser-v9', JSON.stringify(fixture));
  w.eval(['paths', 'v15', 'generate', 'signatures', 'mythical', 'engine', 'state', 'campaign', 'ui'].map(name => fs.readFileSync(path.join(root, `js/${name}.js`), 'utf8')).join('\n'));
  // A deliberately long battle exercises the former 70-event collapsing boundary.
  w.groupEventsToRows = () => [{ round: 1, rows: Array.from({ length: 150 }, (_, i) => ({ type: 'story', text: `Event ${i}: the combatants continue their battle.` })) }];
  const config = w.G9_DATA.contracts.battlefields;
  config.defaultImage = 'data/assets/battlefields/default.webp';
  config.encounters['The Chapel Below'] = 'data/assets/battlefields/chapel.webp';
  config.environments.urban = 'data/assets/battlefields/street.webp';
  assert.equal(w.battlefieldImageFor(fixture.quests[0]), config.encounters['The Chapel Below']);
  assert.equal(w.battlefieldImageFor({ tags: ['urban'] }), config.environments.urban);
  assert.equal(w.battlefieldImageFor({ name: 'Unmatched' }), config.defaultImage);
  assert.equal(w.battlefieldImageFor({}, true), config.defaultImage);
  config.simulatorImage = 'data/assets/battlefields/training.webp';
  assert.equal(w.battlefieldImageFor({}, true), config.simulatorImage);

  w.G9.plan('test-contract'); w.G9.toggleAssign(agent.id); w.G9.launch();
  let vp = w.document.querySelector('#battle-viewport');
  const image = w.document.querySelector('.gm-battlefield-image');
  assert.equal(image.getAttribute('src'), config.encounters['The Chapel Below']);
  image.dispatchEvent(new w.Event('error'));
  assert.equal(image.hidden, true, 'Failed image must hide and reveal dark backdrop');
  assert.equal(w.document.querySelector('.battle-log-wrap').firstElementChild.className, 'battle-toolbar');
  assert.equal(timers.values().next().value.delay, 500);
  w.G9.setTickerSpeed(2); assert.equal(timers.size, 1); assert.equal(timers.values().next().value.delay, 250);
  for (let i = 0; i < 40; i++) tick();
  vp = w.document.querySelector('#battle-viewport');
  assert.equal(vp.scrollTop, vp.scrollHeight - vp.clientHeight, 'Bottom must follow events');
  vp.scrollTop = 140;
  w.document.querySelector('.quest-modal').scrollTop = 180;
  w.scrollTo(0, 220);
  for (let i = 0; i < 40; i++) tick();
  vp = w.document.querySelector('#battle-viewport');
  assert.equal(vp.scrollTop, 140, 'Reading position must survive ticks and the 70-event boundary');
  assert.equal(w.document.querySelector('.quest-modal').scrollTop, 180, 'Outer dialog must not reset');
  assert.equal(w.scrollY, 220, 'Page must not reset');
  assert.equal(vp.querySelectorAll('.b-row').length, 79);
  w.G9.toggleDetails(); assert.equal(w.document.querySelector('#battle-viewport').scrollTop, 140);
  w.G9.skipTicker(); assert.equal(timers.size, 0); assert.equal(w.document.querySelector('#battle-viewport').scrollTop, 140);
  w.G9.closeQuest();

  w.G9.tab('simulator'); w.G9.runSimulation();
  assert.equal(w.document.querySelector('.gm-battlefield-image').getAttribute('src'), config.simulatorImage);
  w.G9.setTickerSpeed(4); assert.equal(timers.values().next().value.delay, 100);
  for (let i = 0; i < 45; i++) tick();
  w.document.querySelector('#sim-viewport').scrollTop = 100;
  for (let i = 0; i < 5; i++) tick();
  assert.equal(w.document.querySelector('#sim-viewport').scrollTop, 100);
  w.G9.toggleSimDetails(); assert.equal(w.document.querySelector('#sim-viewport').scrollTop, 100);
  w.G9.skipTicker(true); assert.equal(timers.size, 0);
  assert.equal(w.document.querySelector('#sim-viewport').querySelectorAll('.b-row').length, 150);
  config.defaultImage = null; config.simulatorImage = null;
  w.G9.toggleSimDetails(); assert.equal(w.document.querySelector('.gm-battlefield-image'), null);
  dom.window.close();
  console.log('Battle UI checks passed: image selection/fallback, top toolbar, speeds/skip, and scroll preservation in both views.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
