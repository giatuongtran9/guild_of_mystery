'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const source = fs.readFileSync(path.resolve(__dirname, '../js/ui.js'), 'utf8').split('// ===== Browser UI =====')[0];
const fx = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/fx.json'), 'utf8'));
let passed = 0;
function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
function fixture(options = {}) {
  const dom = new JSDOM('<main></main>', { runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window, animations = [], seen = [];
  w.abbrNum = value => String(value);
  w.G9_DATA = { fx, runtimeAssets: { entries: {} } };
  w.matchMedia = () => ({ matches: !!options.reduced });
  w.Element.prototype.getBoundingClientRect = function () {
    const id = this.closest?.('[data-unit-id]')?.dataset.unitId;
    const left = id === 'attacker' ? 40 : id ? 190 : 0;
    const top = id === 'attacker' ? 350 : id ? 80 : 0;
    const width = id ? 64 : 390, height = id ? 64 : 600;
    return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top };
  };
  w.Element.prototype.animate = function (keyframes, timing) {
    const animation = { element: this, keyframes, timing, playbackRate: 1, currentTime: 0, playState: 'running',
      pause() { this.playState = 'paused'; }, play() { this.playState = 'running'; },
      cancel() { this.cancelled = true; this.playState = 'idle'; this.oncancel?.(); },
      finish() { this.currentTime = timing.duration; this.playState = 'finished'; this.onfinish?.(); } };
    animations.push(animation); return animation;
  };
  w.eval(source);
  const original = w.createCombatFx;
  w.createCombatFx = wrap => {
    const controller = original(wrap);
    return { ...controller, show(cue, ...args) { seen.push(cue); controller.show(cue, ...args); } };
  };
  const make = (id, team, pathway) => ({ id, name: id, team, path: pathway, sequence: 9, hp: 100, maxHp: 100, alive: true });
  const allies = [make('attacker', 'ally', 'hermit')], enemies = [make('defender', 'enemy', 'red_priest')];
  w.document.querySelector('main').innerHTML = w.renderBattleLogComponent({ allies, enemies, flattenedRows: [], shownCount: 0, isDone: false, speed: 1 });
  const wrap = w.document.querySelector('.battle-log-wrap'), effects = w.createBattleEffects(wrap);
  effects.sync(Object.fromEntries([...allies, ...enemies].map(unit => [unit.id, unit])));
  return { dom, w, wrap, effects, animations, seen,
    sprite: () => wrap.querySelector('[data-unit-id="attacker"] .gm-unit-sprite') };
}
function test(name, run, options) {
  const f = fixture(options);
  try { run(f); passed++; console.log('PASS ' + name); }
  finally { f.effects.clear(); f.dom.window.close(); }
}
function hit() { return { type: 'damage', event: { type: 'damage', actorId: 'attacker', targetId: 'defender',
  actorTeam: 'ally', targetTeam: 'enemy', amount: 20, hpLoss: 20, damageType: 'physical', isCounter: true } }; }
function counter(options = {}) {
  const impact = hit();
  return { type: 'turn', actorId: 'attacker', actorTeam: 'ally', ability: 'Counter', isCounter: true,
    damages: [impact.event], timeline: [impact], ...options };
}
function basic(kind = 'gun', weaponId = 'pistol', options = {}) {
  return { type: 'turn', actorId: 'attacker', ability: 'Pistol', abilityId: 'basic_attack',
    attackKind: kind, weaponId, sourcePath: 'hermit', timeline: [], ...options };
}
function showCast(f, row, speed = 1) { f.effects.show({ type: 'cast', event: row, row, next: row.timeline[0] }, speed, 300); }

for (const [kind, weaponId, selector] of [
  ['gun', 'pistol', '.gm-combat-gun-muzzle'],
  ['unarmed', 'none', '.gm-combat-punch-trail'],
  ['weapon', 'knife', '.gm-combat-sword-slash-travel']
]) test(`saved ${kind} Counter borrows a later same-actor basic without changing the replay`, f => {
  const action = counter(), donor = basic(kind, weaponId);
  const rows = freeze([action, basic('gun', 'revolver', { actorId: 'defender', sourcePath: 'red_priest' }), donor]);
  const snapshot = JSON.stringify(rows);
  f.effects.prepare(rows);
  showCast(f, action);
  assert(f.wrap.querySelector(selector), 'the old Counter uses its recorded equipped-weapon cue');
  const presentation = f.seen.at(-1).row;
  assert.notStrictEqual(presentation, action);
  assert.equal(presentation.ability, 'Counter');
  assert.equal(presentation.abilityId, 'basic_attack');
  assert.equal(presentation.attackKind, kind);
  assert.equal(presentation.weaponId, weaponId);
  assert.equal(presentation.sourcePath, 'hermit');
  assert.strictEqual(presentation.timeline, action.timeline);
  assert.strictEqual(presentation.damages, action.damages);
  assert.strictEqual(f.seen.at(-1).event, action, 'the original cast event is not rewritten');
  f.effects.show({ ...action.timeline[0], row: action }, 1, 300);
  assert.strictEqual(f.seen.at(-1).row, presentation, 'impact uses the same presentation row');
  assert.strictEqual(f.seen.at(-1).event, action.timeline[0].event);
  assert.equal(JSON.stringify(rows), snapshot);
});

test('saved Counter copies stay stable through notes, repeated preparation, Pause and impact return', f => {
  const note = { type: 'note', event: { type: 'note', text: 'An opening reaction note.' } };
  const action = counter(); action.timeline.unshift(note);
  const rows = freeze([action, basic()]), snapshot = JSON.stringify(rows);
  f.effects.prepare(rows); showCast(f, action);
  const presentation = f.seen.at(-1).row;
  const lunge = f.animations.filter(animation => animation.element === f.sprite()).at(-1);
  assert(lunge && lunge.timing.fill === 'forwards');
  const forward = lunge.keyframes.at(-1).transform;
  lunge.finish();
  f.effects.prepare(rows);
  f.effects.show({ ...note, row: action, next: action.timeline[1] }, 1, 90);
  assert.strictEqual(f.seen.at(-1).row, presentation);
  assert(!lunge.cancelled, 'an intervening note preserves the original held pose');
  f.effects.pause(); f.effects.setSpeed(2); f.effects.resume();
  assert(!lunge.cancelled);
  assert.equal(lunge.currentTime, lunge.timing.duration);
  f.effects.show({ ...action.timeline[1], row: action }, 2, 225);
  const returning = f.animations.filter(animation => animation.element === f.sprite() && !animation.cancelled).at(-1);
  assert(returning && returning !== lunge);
  assert.equal(returning.keyframes[0].transform, forward);
  assert.equal(returning.keyframes.at(-1).transform, 'translate(0,0) scale(1)');
  assert(lunge.cancelled);
  assert.equal(JSON.stringify(rows), snapshot);
});

test('a legacy Counter label with counter damage is supported without requiring a cast flag', f => {
  const action = counter(); delete action.isCounter;
  const rows = freeze([action, basic()]);
  f.effects.prepare(rows); showCast(f, action);
  assert.equal(f.seen.at(-1).row.attackKind, 'gun');
  assert(f.wrap.querySelector('.gm-combat-gun-muzzle'));
});

test('unknown historical weapons and unrelated Counter labels remain unchanged', f => {
  const unknown = counter(), unrelated = counter({ damages: [{ ...hit().event, isCounter: false }] });
  delete unrelated.isCounter;
  const rows = freeze([unknown, basic('gun', 'pistol', { actorId: 'defender' }), unrelated]);
  const snapshot = JSON.stringify(rows);
  f.effects.prepare(rows);
  for (const action of [unknown, unrelated]) {
    showCast(f, action);
    assert.strictEqual(f.seen.at(-1).row, action);
    assert(!f.wrap.querySelector('.gm-combat-gun-muzzle'));
    assert(!f.wrap.querySelector('.gm-combat-punch-trail'));
  }
  assert.equal(JSON.stringify(rows), snapshot);
});

test('a modern Counter preserves its own metadata and original row identity', f => {
  const action = counter({ abilityId: 'basic_attack', attackKind: 'unarmed', weaponId: 'none', sourcePath: 'hermit' });
  const rows = freeze([action, basic('gun', 'pistol')]);
  f.effects.prepare(rows); showCast(f, action);
  assert.strictEqual(f.seen.at(-1).row, action);
  assert(f.wrap.querySelector('.gm-combat-punch-trail'));
  assert(!f.wrap.querySelector('.gm-combat-gun-muzzle'));
});

test('a label alone cannot convert an unrelated paid ability into a weapon attack', f => {
  const action = counter({ damages: [{ ...hit().event, isCounter: false }] });
  delete action.isCounter;
  const rows = freeze([action, basic()]), snapshot = JSON.stringify(rows);
  f.effects.prepare(rows); showCast(f, action);
  assert.strictEqual(f.seen.at(-1).row, action);
  assert(!f.wrap.querySelector('.gm-combat-gun-muzzle'));
  assert.equal(JSON.stringify(rows), snapshot);
});

for (const options of [{ reduced: true }, { speed: 4 }]) test('saved Counter backfill respects compact or reduced-motion playback', f => {
  const action = counter(), rows = freeze([action, basic()]), snapshot = JSON.stringify(rows);
  f.effects.prepare(rows); showCast(f, action, options.speed || 1);
  assert.equal(f.seen.at(-1).row.attackKind, 'gun');
  assert.equal(f.animations.length, 0, 'compact playback does not create moving artwork');
  assert.equal(JSON.stringify(rows), snapshot);
}, options);

console.log(`Legacy Counter presentation: ${passed} checks passed`);
