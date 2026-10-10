// NODE_PATH=/tmp/guild-ui-check/node_modules node tests/phase4-ui.test.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const g = require('../js/node-loader');
const root = path.resolve(__dirname, '..');
let passed = 0, failed = 0;
const unit = { id: 'reader', name: 'Reader', path: 'fool', sequence: 5, team: 'ally', maxHp: 100, hp: 100, sp: 0, maxSP: 80 };
const enemy = { ...unit, id: 'enemy', name: 'Opponent', team: 'enemy', path: 'door', sequence: 5 };

function pureFixture() {
  const dom = new JSDOM('<div id="app"></div>', { runScripts: 'dangerously' });
  const w = dom.window;
  w.abbrNum = g.abbrNum;
  w.G9_DATA = { runtimeAssets: { entries: {
    'data/assets/characters/fool/fool_mythical.png': {
      full: { src: 'data/assets/characters/fool/fool_mythical.png?v=0123456789abcdef', width: 1254, height: 1254 },
      portrait: { src: 'data/assets/runtime/characters/fool/fool_mythical.192.0123456789abcdef.webp', width: 192, height: 192 }
    }
  } } };
  w.eval(fs.readFileSync(path.join(root, 'js/ui.js'), 'utf8').split('// ===== Browser UI =====')[0]);
  return { dom, w };
}

async function browserFixture(outcome) {
  const dom = new JSDOM('<div id="app"></div>', { url: 'https://example.test/guild_of_mystery/', runScripts: 'dangerously' });
  const w = dom.window;
  w.fetch = async url => ({ ok: true, json: async () => JSON.parse(fs.readFileSync(path.join(root, new URL(url).pathname.replace('/guild_of_mystery/', '')), 'utf8')) });
  w.eval(fs.readFileSync(path.join(root, 'js/data-loader.js'), 'utf8'));
  w.G9_DATA = await w.G9DataLoader.load();
  w.scrollTo = () => {};
  let id = 0;
  const timers = new Map();
  w.setTimeout = (fn, delay) => { timers.set(++id, { fn, delay }); return id; };
  w.clearTimeout = timer => timers.delete(timer);
  const save = g.newGame();
  const agent = g.makeAgent(() => .4, { path: 'fool', sequence: 5, trait: 'Stout Vitality' });
  agent.id = unit.id; agent.name = unit.name; g.restatAgent(agent);
  save.roster = [agent];
  save.quests = [{ id: 'test', name: 'Test', encounter: true, objective: 'combat', difficultySequence: 5, rewards: { funds: 0, reputation: 0, materials: {} } }];
  w.localStorage.setItem('guild-rpg-browser-v9', JSON.stringify(save));
  w.eval(['paths','v15','generate','signatures','mythical','engine','state','campaign','ui'].map(name => fs.readFileSync(path.join(root, `js/${name}.js`), 'utf8')).join('\n'));
  if (outcome) {
    const resolve = w.resolveQuest;
    w.resolveQuest = (...args) => { const result = resolve(...args); result.success = false; result.battleOutcome = outcome; result.battleSnapshot.outcome = outcome; return result; };
  }
  w.groupEventsToRows = () => [{ round: 1, rows: [
    { type: 'turn', actorId: unit.id, actorName: unit.name, actorTeam: 'ally', ability: 'Thread Binding', damages: [], resources: [{ ...unit, hp: 70, shield: 25, sp: 12, meter: { name: 'Thread Control', value: 100, max: 100 }, threadSlots: { used: 1, max: 2 }, threadProgress: { value: 3, max: 5 }, statuses: [{ name: 'Bound', turns: 1 }], inForm: true }] },
    { type: 'turn', actorId: unit.id, actorName: unit.name, actorTeam: 'ally', ability: 'Strike', damages: [{ targetId: 'enemy', amount: 30, hpLoss: 10, absorbed: 20, hpAfter: 90, shieldAfter: 0 }] },
    { type: 'story', text: 'Done.' }
  ] }];
  w.G9.plan('test'); w.G9.toggleAssign(unit.id); w.G9.launch();
  return { dom, w, timers, app: w.document.getElementById('app') };
}

async function test(name, fn, browser = false) {
  let f;
  try { f = browser ? await browserFixture(typeof browser === 'string' ? browser : undefined) : pureFixture(); await fn(f); passed++; console.log(`PASS ${name}`); }
  catch (e) { failed++; console.log(`FAIL ${name}: ${e.message}`); }
  finally { f?.dom.window.close(); }
}

async function main() {
  await test('initial SP uses actual zero on both sides instead of invented MP', f => {
    const hpMap = f.w.calculateCurrentHp([unit], [enemy], []);
    const html = f.w.renderHpStrip(hpMap, [unit], [enemy]);
    f.w.document.body.innerHTML = html;
    assert.equal(f.w.document.querySelectorAll('.gm-float-gauge.mp').length, 2);
    for (const value of f.w.document.querySelectorAll('.gm-float-gauge.mp .gm-float-num')) assert.equal(value.textContent, '0/80 SP');
    assert(!html.includes('80 MP'));
  });
  await test('authoritative resources update HP shield SP charge slots binding and status', f => {
    const row = { resources: [{ ...unit, hp: 65, shield: 40, sp: 10, meter: { name: 'Thread Control', value: 100, max: 100 }, threadSlots: { used: 1, max: 2 }, threadProgress: { value: 3, max: 5 }, statuses: [{ name: 'Bound', turns: 1 }], inForm: true }] };
    const map = f.w.calculateCurrentHp([unit], [enemy], [row]);
    assert.equal(map.reader.curHp, 65); assert.equal(map.reader.curShield, 40); assert.equal(map.reader.sp, 10);
    f.w.document.body.innerHTML = f.w.renderHpStrip(map, [unit], [enemy]);
    const node = f.w.document.querySelector('.gm-arena-unit.ally');
    for (const text of ['40 Shield', '10/80 SP', '100/100', 'Slots 1/2', 'Binding 3/5', 'Bound · 1 turn']) assert(node.textContent.includes(text), text);
  });
  await test('shield-only damage cannot reduce reconstructed HP', f => {
    const map = f.w.calculateCurrentHp([unit], [], [{ shields: [{ targetId: unit.id, amount: 30 }] }, { damages: [{ targetId: unit.id, amount: 20, hpLoss: 0, absorbed: 20, shieldAfter: 10 }] }]);
    assert.equal(map.reader.curHp, 100); assert.equal(map.reader.curShield, 10);
  });
  await test('shield overlays the HP track while keeping HP and shield numbers distinct', f => {
    const map = f.w.calculateCurrentHp([unit], [enemy], [{ resources: [{ ...unit, hp: 65, shield: 40 }] }]);
    f.w.document.body.innerHTML = f.w.renderHpStrip(map, [unit], [enemy]);
    const node = f.w.document.querySelector('.gm-arena-unit.ally');
    const track = node.querySelector('.gm-float-gauge.hp .gm-float-track');
    assert(track.querySelector('.gm-float-fill.shield'), 'shield must share the HP track');
    assert.equal(node.querySelector('.gm-float-fill.hp').style.width, '65%');
    assert.equal(node.querySelector('.gm-float-fill.shield').style.width, '40%');
    assert.equal(node.querySelector('.gm-hp-num').textContent, '65/100');
    assert.equal(node.querySelector('.gm-shield-num').textContent, '40 Shield');
    assert(!node.querySelector('.gm-float-gauge.shield'), 'no separate shield bar');
  });
  await test('playback removes an exhausted shield overlay without changing HP or image nodes', f => {
    const rows = [{ resources: [{ ...unit, hp: 65, shield: 40 }] }, { resources: [{ ...unit, hp: 65, shield: 0 }] }];
    const props = { allies: [unit], enemies: [enemy], flattenedRows: rows, shownCount: 1, isDone: false, speed: 1 };
    f.w.document.body.innerHTML = f.w.renderBattleLogComponent(props);
    const wrap = f.w.document.querySelector('.battle-log-wrap'), node = wrap.querySelector('.gm-arena-unit.ally');
    const image = node.querySelector('img'), shield = node.querySelector('.gm-float-fill.shield');
    f.w.updateBattleLogComponent(wrap, { ...props, shownCount: 2 });
    assert.equal(node.querySelector('img'), image); assert.equal(node.querySelector('.gm-float-fill.shield'), shield);
    assert.equal(shield.style.display, 'none'); assert(node.querySelector('.gm-shield-num').hidden);
    assert.equal(node.querySelector('.gm-hp-num').textContent, '65/100');
  });
  await test('shield overlay is white and layered above the HP fill', f => {
    const style = f.w.document.createElement('style');
    style.textContent = fs.readFileSync(path.join(root, 'css/components/dungeon-arena.css'), 'utf8');
    f.w.document.head.append(style);
    f.w.document.body.innerHTML = f.w.renderCombatEntity({ ...unit, curHp: 65, curShield: 40 }, 'ally', 0, {});
    const shield = f.w.getComputedStyle(f.w.document.querySelector('.gm-float-fill.shield'));
    assert.equal(shield.backgroundColor, 'rgb(255, 255, 255)');
    assert.equal(shield.position, 'absolute'); assert.equal(shield.zIndex, '1');
  });
  await test('both battle teams defer original image requests until their portraits are visible', f => {
    const map = f.w.calculateCurrentHp([unit], [enemy], []);
    f.w.document.body.innerHTML = f.w.renderHpStrip(map, [unit], [enemy]);
    for (const image of f.w.document.querySelectorAll('.gm-arena-unit img')) {
      assert(!image.hasAttribute('src'), 'offscreen battle art must not start a download');
      assert(image.dataset.src.endsWith('.png')); assert.equal(image.getAttribute('loading'), 'lazy');
      assert.equal(image.getAttribute('decoding'), 'async');
    }
  });
  await test('scrolling reveals deferred originals while clipped portraits stay unfetched', f => {
    const map = f.w.calculateCurrentHp([unit, { ...unit, id: 'second' }], [enemy], []);
    f.w.document.body.innerHTML = f.w.renderHpStrip(map, [unit, { ...unit, id: 'second' }], [enemy]);
    const images = Array.from(f.w.document.querySelectorAll('.gm-rank-allies img'));
    const row = f.w.document.querySelector('.gm-rank-allies');
    row.getBoundingClientRect = () => ({ left: 10, right: 180, top: 10, bottom: 100 });
    images[0].getBoundingClientRect = () => ({ left: 20, right: 84, top: 20, bottom: 84, width: 64, height: 64 });
    images[1].getBoundingClientRect = () => ({ left: 200, right: 264, top: 20, bottom: 84, width: 64, height: 64 });
    f.w.prioritizeVisiblePartyPortraits();
    assert(images[0].getAttribute('src').endsWith('.png')); assert.equal(images[0].fetchPriority, 'high');
    assert(!images[1].hasAttribute('src')); assert.equal(images[1].getAttribute('loading'), 'lazy');
    images[1].getBoundingClientRect = images[0].getBoundingClientRect;
    f.w.prioritizeVisiblePartyPortraits();
    assert(images[1].getAttribute('src').endsWith('.png')); assert(!images[1].hasAttribute('data-src'));
  });
  await test('battle mythical art uses the original without changing the dossier portrait policy', f => {
    const data = { ...unit, curHp: 100, inForm: true };
    f.w.document.body.innerHTML = f.w.renderCombatEntity(data, 'ally', 0, {});
    const image = f.w.document.querySelector('img');
    assert.equal(image.dataset.src, 'data/assets/characters/fool/fool_mythical.png?v=0123456789abcdef');
    assert.equal(image.getAttribute('width'), '1254');
    const dossier = f.w.getCombatSprite(data, { variant: 'full', loading: 'eager', priority: 'auto' });
    assert(dossier.includes('fool_mythical.192.0123456789abcdef.webp'), 'existing dossier behavior must stay unchanged');
    assert(dossier.includes('src="')); assert(!dossier.includes('data-src="'));
  });
  await test('mythical artwork uses the versioned 192 portrait instead of original sequence art', f => {
    const html = f.w.getCombatSprite({ ...unit, inForm: true }, { variant: 'portrait' });
    assert(html.includes('fool_mythical.192.0123456789abcdef.webp'));
    assert(html.includes('width="192"')); assert(html.includes('Mythical Form'));
  });
  await test('damage log always separates HP loss from shield absorption', f => {
    const html = f.w.renderTurnRowHtml({ type: 'turn', actorTeam: 'enemy', actorName: 'Enemy', ability: 'Hit', damages: [{ targetName: 'Reader', amount: 40, hpLoss: 10, absorbed: 30, damageType: 'physical' }] }, false);
    assert(html.includes('10 HP')); assert(html.includes('30 Shield'));
  });
  await test('reflected hits also show real HP loss and shield absorption', f => {
    const html = f.w.renderTurnRowHtml({ type: 'turn', actorTeam: 'ally', actorName: 'Reader', ability: 'Hit', reflects: [{ targetName: 'Reader', amount: 30, hpLoss: 5, absorbed: 25, isReflect: true }] }, false);
    assert(html.includes('5 HP')); assert(html.includes('25 Shield')); assert(html.includes('REFLECT'));
  });
  await test('nested authority reactions update HP and explain their own source', f => {
    const row = { type: 'turn', actorName: 'Reader', actorTeam: 'ally', ability: 'Strike', reactions: [{ type: 'damage', actorName: 'Abyss', targetName: 'Reader', targetId: unit.id, amount: 30, hpLoss: 5, absorbed: 25, shieldAfter: 5, subtype: 'mythical_authority' }], subrows: [{ type: 'reaction', text: 'Abyss reacts.' }] };
    const map = f.w.calculateCurrentHp([unit], [], [row]);
    assert.equal(map.reader.curHp, 95); assert.equal(map.reader.curShield, 5);
    const html = f.w.renderTurnRowHtml(row, false);
    assert(html.includes('5 HP')); assert(html.includes('25 Shield')); assert(html.includes('Reaction · Abyss'));
  });
  await test('reactive recovery and shields identify their source and recipient', f => {
    const html = f.w.renderTurnRowHtml({ type: 'turn', actorId: 'enemy', actorTeam: 'enemy', actorName: 'Enemy', ability: 'Strike', heals: [{ actorId: 'moon', actorName: 'Moon', targetName: 'Reader', targetTeam: 'ally', amount: 10 }], shields: [{ actorId: 'mother', actorName: 'Mother', targetName: 'Reader', targetTeam: 'ally', amount: 20 }] }, false);
    for (const text of ['Moon', 'Mother', 'Reader', '10 HP', '20 Shield']) assert(html.includes(text), text);
  });
  await test('result styling follows actual victory instead of guessing from summary words', f => {
    const html = f.w.renderBattleLogComponent({ allies: [unit], enemies: [enemy], flattenedRows: [], shownCount: 0, isDone: true, speed: 1, summaryText: 'Both teams fought for 5 rounds.', success: true });
    f.w.document.body.innerHTML = html;
    assert(f.w.document.querySelector('.b-result-box').classList.contains('victory'));
  });
  await test('round-limit result explains an incomplete contract without claiming defeat', f => {
    f.w.G9.skipTicker(false);
    const heading = f.app.querySelector('.b-result-box h4').textContent;
    assert(heading.includes('Round limit reached'), heading);
    assert(heading.includes('Contract incomplete'), heading);
    assert(!heading.includes('Defeat'), heading);
    assert(f.app.querySelector('.battle-completion .result').textContent.includes('ROUND LIMIT'));
  }, 'timeout');
  await test('simulator distinguishes a timed draw from Team B victory', f => {
    f.w.G9.skipTicker(false); f.w.G9.closeQuest();
    f.w.G9.tab('simulator'); f.w.G9.runSimulation(); f.w.G9.skipTicker(true);
    const heading = f.app.querySelector('.sim-result .section-head h3').textContent;
    assert.equal(heading, 'Draw · Round limit reached');
    assert(f.app.querySelector('.b-result-box h4').textContent.includes('Round limit reached'));
  }, 'timeout');
  await test('resource updates preserve the original image and unit nodes during form switch', f => {
    const node = f.app.querySelector('.gm-arena-unit.ally'), image = node.querySelector('img');
    f.w.G9.toggleTickerPause(); f.w.G9.stepTicker();
    assert.equal(f.app.querySelector('.gm-arena-unit.ally'), node); assert.equal(node.querySelector('img'), image);
    assert((image.getAttribute('src') || image.dataset.src).includes('fool_mythical.png?v=')); assert(node.textContent.includes('25 Shield')); assert(node.textContent.includes('12/80 SP'));
  }, true);
  await test('summon snapshots append once and show expiration without inventing HP loss', f => {
    const summon = { ...unit, id: 'summon', name: 'Companion', hp: 20, maxHp: 20, alive: true, summoned: true };
    const rows = [{ resources: [summon] }, { resources: [{ ...summon, alive: false, inCombat: false }] }];
    const props = { allies: [unit], enemies: [enemy], flattenedRows: rows, shownCount: 0, isDone: false, speed: 1, summaryText: '', isSim: false };
    f.w.document.body.innerHTML = f.w.renderBattleLogComponent(props);
    const wrap = f.w.document.querySelector('.battle-log-wrap');
    f.w.updateBattleLogComponent(wrap, { ...props, shownCount: 1 });
    const node = wrap.querySelector('[data-unit-id="summon"]'), image = node.querySelector('img');
    f.w.updateBattleLogComponent(wrap, { ...props, shownCount: 2 });
    assert.equal(wrap.querySelectorAll('[data-unit-id="summon"]').length, 1);
    assert.equal(wrap.querySelector('[data-unit-id="summon"]'), node); assert.equal(node.querySelector('img'), image);
    assert(node.classList.contains('dead'), 'expired summon must read as inactive');
    assert(node.querySelector('.gm-float-gauge.hp .gm-float-num').textContent.includes('20/20'));
  });
  await test('pause cancels playback, step reveals one complete action and resume creates one timer', f => {
    f.w.G9.toggleTickerPause(); assert.equal(f.timers.size, 0);
    const button = f.app.querySelector('[data-pause]'); assert.equal(button.textContent, 'Resume');
    f.w.G9.stepTicker(); assert.equal(f.timers.size, 0); assert.equal(f.app.querySelectorAll('.b-turn-header').length, 1);
    f.w.G9.toggleTickerPause(); assert.equal(f.timers.size, 1); assert.equal(button.textContent, 'Pause');
  }, true);
  await test('paused speed changes do not start timer; Read pace stays available', f => {
    f.w.G9.toggleTickerPause(); f.w.G9.setTickerSpeed(.5); assert.equal(f.timers.size, 0);
    f.w.G9.toggleTickerPause(); assert.equal(f.timers.size, 1); assert.equal(f.timers.values().next().value.delay, 1600);
  }, true);
  await test('stale scheduled callback cannot advance a paused battle', f => {
    const stale = f.timers.values().next().value.fn;
    f.w.G9.toggleTickerPause(); stale();
    assert.equal(f.app.querySelectorAll('.b-turn-header').length, 0); assert.equal(f.timers.size, 0);
  }, true);
  await test('skip stops paused playback and disables final playback controls', f => {
    f.w.G9.toggleTickerPause(); f.w.G9.skipTicker(); assert.equal(f.timers.size, 0);
    assert(f.app.querySelector('[data-pause]').disabled); assert(f.app.querySelector('[data-step]').disabled);
  }, true);
  await test('resource labels remain escaped against markup injection', f => {
    const map = f.w.calculateCurrentHp([unit], [], [{ resources: [{ ...unit, meter: { name: '<img src=x onerror=alert(1)>', value: 5, max: 100 }, statuses: [{ name: '<script>bad</script>', turns: 2 }] }] }]);
    f.w.document.body.innerHTML = f.w.renderHpStrip(map, [unit], []);
    assert.equal(f.w.document.querySelector('script'), null); assert.equal(f.w.document.querySelectorAll('img').length, 1);
    assert(f.w.document.body.textContent.includes('<script>bad</script>'));
  });
  await test('malformed resource counters cannot become injected image markup', f => {
    const malicious = '<img src=x onerror=alert(1)>';
    const map = f.w.calculateCurrentHp([unit], [], [{ resources: [{ ...unit, path: 'door', recordCount: malicious, threadSlots: { used: malicious, max: 2 }, threadProgress: { value: malicious, max: 5 } }] }]);
    f.w.document.body.innerHTML = f.w.renderHpStrip(map, [unit], []);
    assert.equal(f.w.document.querySelectorAll('img').length, 1);
    assert(f.w.document.body.textContent.includes(malicious));
  });
  await test('resource IDs that match object prototypes remain ordinary owned records', f => {
    const map = f.w.calculateCurrentHp([], [], [{ resources: [{ id: 'constructor', name: 'Prototype-shaped ID', hp: 7, maxHp: 10, shield: 0 }] }]);
    assert.equal(map.constructor.curHp, 7);
    assert.equal(f.w.Object.hp, undefined);
    assert.equal(Object.getPrototypeOf(map), null);
  });
  await test('phone resource text and playback buttons have readable size', f => {
    const css = fs.readFileSync(path.join(root, 'css/components/dungeon-arena.css'), 'utf8') + fs.readFileSync(path.join(root, 'css/components/battle-log.css'), 'utf8');
    const style = f.w.document.createElement('style'); style.textContent = css; f.w.document.head.append(style);
    const map = f.w.calculateCurrentHp([unit], [enemy], []);
    f.w.document.body.innerHTML = f.w.renderBattleLogComponent({ allies: [unit], enemies: [enemy], flattenedRows: [], shownCount: 0, isDone: false, speed: 1, summaryText: '', isSim: false });
    assert(parseFloat(f.w.getComputedStyle(f.w.document.querySelector('.gm-float-num')).fontSize) >= .75);
    assert.equal(f.w.getComputedStyle(f.w.document.querySelector('[data-pause]')).minHeight, '44px');
  });
  console.log(`Phase 4 UI: ${passed} passed, ${failed} failed.`);
  if (failed) process.exitCode = 1;
}
main().catch(e => { console.error(e); process.exitCode = 1; });
