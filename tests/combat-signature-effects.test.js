// Presentation identity and lifecycle checks, without running a visual clock.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/ui.js'), 'utf8').split('// ===== Browser UI =====')[0];
let passed = 0, failed = 0;

function fixture(reduced = false) {
  const dom = new JSDOM('<main></main>', { runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window, animations = [];
  w.abbrNum = number => String(Math.round(number || 0));
  w.matchMedia = () => ({ matches: reduced });
  w.G9_DATA = { runtimeAssets: { entries: {} } };
  w.Element.prototype.animate = function () {
    const animation = { playState: 'running', playbackRate: 1,
      pause() { this.playState = 'paused'; }, play() { this.playState = 'running'; },
      cancel() { this.playState = 'idle'; this.cancelled = true; this.oncancel?.(); } };
    animations.push(animation); return animation;
  };
  const positions = { fool: [30, 350], door: [95, 350], hanged: [160, 350], paragon: [225, 350],
    moon: [290, 350], enemy: [140, 80], beast: [280, 430], device: [225, 430], machine: [80, 430] };
  w.Element.prototype.getBoundingClientRect = function () {
    const id = this.closest?.('[data-unit-id]')?.dataset.unitId;
    const [left, top] = positions[id] || [0, 0];
    const width = id ? ['beast', 'device', 'machine'].includes(id) ? 32 : 64 : 390;
    const height = id ? width : 600;
    return { left, top, width, height, right: left + width, bottom: top + height };
  };
  w.eval(source);
  const make = (id, pathway, team = 'ally', companion) => ({ id, name: id, path: pathway, team,
    sequence: 0, hp: 100, maxHp: 100, curHp: 100, sp: 100, maxSP: 100, alive: true,
    ...(companion ? { summoned: true, companion } : {}) });
  const allies = [make('fool', 'fool'), make('door', 'door'), make('hanged', 'hanged_man'),
    make('paragon', 'paragon'), make('moon', 'moon'),
    make('beast', 'moon', 'ally', { ownerId: 'moon', kind: 'beast' }),
    make('device', 'paragon', 'ally', { ownerId: 'paragon', kind: 'device' }),
    make('machine', 'paragon', 'ally', { ownerId: 'paragon', kind: 'historical_machine' })];
  const enemies = [make('enemy', 'chained', 'enemy')];
  const map = Object.fromEntries([...allies, ...enemies].map(unit => [unit.id, unit]));
  w.document.querySelector('main').innerHTML = w.renderBattleLogComponent({ allies, enemies,
    flattenedRows: [], shownCount: 0, isDone: false, speed: 1, summaryText: '' });
  const wrap = w.document.querySelector('.battle-log-wrap'), effects = w.createBattleEffects(wrap);
  effects.sync(map);
  return { dom, w, wrap, effects, map, allies, enemies, animations,
    effect: kind => wrap.querySelector(`[data-effect="${kind}"]`) };
}
function test(name, fn, reduced) {
  let f;
  try { f = fixture(reduced); fn(f); passed++; console.log('PASS ' + name); }
  catch (error) { failed++; console.error('FAIL ' + name + ': ' + error.stack); }
  finally { f?.effects.clear(); f?.dom.window.close(); }
}

test('Fool binding lines keep real endpoints and numeric progress across unrelated actions', f => {
  f.map.enemy.threadProgress = { ownerId: 'fool', value: 2, max: 5 }; f.effects.sync(f.map);
  assert.equal(f.effect('thread').dataset.ownerId, 'fool');
  assert.equal(f.effect('thread').dataset.targetId, 'enemy');
  assert.equal(f.effect('thread-progress').textContent, '2/5');
  f.effects.show({ type: 'damage', row: { actorId: 'paragon' }, event: { actorId: 'paragon', targetId: 'enemy', hpLoss: 1 } });
  assert(f.effect('thread')); assert.equal(f.effect('thread-progress').textContent, '2/5');
  f.map.enemy.threadProgress = { ownerId: 'fool', value: 3, max: 5 }; f.effects.sync(f.map);
  assert.equal(f.effect('thread-progress').textContent, '3/5');
});

test('thread attachment, progress and interruption reconstruct at their actual subevents', f => {
  const event = state => ({ type: 'thread', actorId: 'fool', targetId: 'enemy', threadState: state });
  const row = { actorId: 'fool', timeline: [
    { type: 'note', event: event({ ownerId: 'fool', value: 0, max: 5 }) },
    { type: 'note', event: event({ ownerId: 'fool', value: 2, max: 5 }) },
    { type: 'note', event: event(null) }
  ] };
  for (const [count, value] of [[1, '0/5'], [2, '2/5'], [3, null]]) {
    const map = f.w.calculateCurrentHp(f.allies, f.enemies, f.w.battlePresentationRows([row], 0, count));
    f.effects.sync(map);
    assert.equal(f.effect('thread-progress')?.textContent || null, value);
  }
});

test('Door records show a portal for their owner while ordinary weapon attacks do not', f => {
  f.effects.show({ type: 'cast', row: { actorId: 'door', abilityId: 'record:raging_blow', ownedPower: 'record', sourcePath: 'tyrant' } });
  assert.equal(f.effect('portal').dataset.ownerId, 'door');
  f.effects.show({ type: 'cast', row: { actorId: 'door', abilityId: 'basic_attack', attackKind: 'gun' } });
  assert.equal(f.effect('portal'), null);
  f.effects.show({ type: 'cast', row: { actorId: 'door', abilityId: 'spatial_seal' } });
  assert(f.effect('portal'));
});

for (const ability of ['asset_soul:active_power', 'asset_soul:passive_manifestation']) test(`Hanged Man soul silhouette follows ${ability}`, f => {
  f.effects.show({ type: 'cast', row: { actorId: 'hanged', abilityId: ability, ownedPower: 'soul', sourcePath: 'tyrant' } });
  assert.equal(f.effect('soul').dataset.ownerId, 'hanged');
  assert(f.effect('soul').getAttribute('style').includes('#a9cfe5'));
  f.effects.show({ type: 'cast', row: { actorId: 'hanged', abilityId: 'native_dark_attack' } });
  assert.equal(f.effect('soul'), null);
});

test('Paragon muzzle flashes belong to actual devices rather than owners or historical machines', f => {
  for (const id of ['paragon', 'machine', 'device']) {
    f.effects.show({ type: 'cast', row: { actorId: id, abilityId: 'basic_attack', attackKind: 'unarmed' } });
    assert.equal(!!f.effect('muzzle'), id === 'device');
  }
  assert.equal(f.effect('muzzle').dataset.ownerId, 'paragon');
  f.effects.show({ type: 'note', row: {}, event: { presentationEffect: 'device_mark', ownerId: 'paragon', companionId: 'device', targetId: 'enemy' } });
  assert.equal(f.effect('device_mark').dataset.targetId, 'enemy');
});

test('Moon command shows the actual recipient, including a redirected command, without a phantom beast', f => {
  for (const targetId of ['beast', 'enemy']) {
    f.effects.show({ type: 'note', row: {}, event: { presentationEffect: 'beast_command', ownerId: 'moon', targetId } });
    assert.equal(f.effect('beast_command').dataset.ownerId, 'moon');
    assert.equal(f.effect('beast_command').dataset.targetId, targetId);
  }
  f.effects.show({ type: 'cast', row: { actorId: 'moon', abilityId: 'beast_command' } });
  assert.equal(f.effect('beast_command'), null, 'fallback attack has no successful companion command marker');
});

test('Chained curse lines survive other actions and brighten only for explicit curse reactions', f => {
  f.map.fool.curseLink = { ownerId: 'enemy', turns: 2 }; f.effects.sync(f.map);
  assert.equal(f.effect('curse').dataset.ownerId, 'enemy');
  f.effects.show({ type: 'reaction', row: {}, event: { actorId: 'enemy', targetId: 'fool', damageType: 'dark', hpLoss: 5, presentationEffect: 'curse_echo' } });
  assert(f.effect('curse')); assert.equal(f.effect('curse_echo').dataset.targetId, 'fool');
  f.effects.show({ type: 'damage', row: {}, event: { actorId: 'enemy', targetId: 'fool', damageType: 'dark', hpLoss: 5 } });
  assert(f.effect('curse')); assert.equal(f.effect('curse_echo'), null);
});

test('cleansing, authority expiry and dead endpoints remove persistent links', f => {
  const initial = { ...f.map.fool, curseLink: { ownerId: 'enemy', turns: 2 } };
  const row = { type: 'status', targetId: 'fool', curseLink: null, presentationEffect: 'curse_link_end' };
  const map = f.w.calculateCurrentHp([initial], [f.map.enemy], [row]);
  f.effects.sync(map); assert.equal(f.effect('curse'), null);
  f.map.fool.curseLink = { ownerId: 'enemy', turns: 0 }; f.effects.sync(f.map);
  assert.equal(f.effect('curse'), null);
  f.map.fool.curseLink = { ownerId: 'enemy', turns: 2 }; f.effects.sync(f.map); assert(f.effect('curse'));
  f.map.enemy.alive = false; f.effects.sync(f.map); assert.equal(f.effect('curse'), null);
  f.map.enemy.alive = true; f.map.fool.curHp = 0; f.effects.sync(f.map); assert.equal(f.effect('curse'), null);
});

test('signature effects are decorative, pause with playback and clear every layer', f => {
  f.map.enemy.threadProgress = { ownerId: 'fool', value: 1, max: 5 }; f.effects.sync(f.map);
  const original = JSON.stringify(f.map);
  f.effects.show({ type: 'cast', row: { actorId: 'door', abilityId: 'portal' } });
  f.effects.pause(); assert(f.animations.filter(a => !a.cancelled).every(a => a.playState === 'paused'));
  f.effects.resume(); f.effects.setSpeed(2);
  assert.equal(JSON.stringify(f.map), original);
  f.effects.clear(); assert.equal(f.wrap.querySelectorAll('.gm-pathway-links, .gm-pathway-fx-layer').length, 0);
  assert(f.animations.every(a => a.cancelled));
});

test('reduced motion retains static signature cues and persistent links without animation', f => {
  f.map.enemy.threadProgress = { ownerId: 'fool', value: 2, max: 5 }; f.effects.sync(f.map);
  f.effects.show({ type: 'cast', row: { actorId: 'hanged', ownedPower: 'soul' } });
  assert(f.effect('thread')); assert(f.effect('soul')); assert.equal(f.animations.length, 0);
}, true);

test('4x retains compact signature feedback without an animation backlog', f => {
  f.effects.show({ type: 'cast', row: { actorId: 'door', abilityId: 'record:power', ownedPower: 'record' } }, 4);
  assert(f.effect('portal')); assert.equal(f.animations.length, 0);
  assert(f.wrap.querySelector('.gm-pathway-fx-layer').childElementCount <= 1);
});

console.log(`\nSignature visual presentation: ${passed} passed, ${failed} failed.`);
if (failed) process.exitCode = 1;
