// Focused regressions for the readable utility casts; combat is already resolved.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/ui.js'), 'utf8').split('// ===== Browser UI =====')[0];
const fx = JSON.parse(fs.readFileSync(path.join(root, 'data/fx.json'), 'utf8'));
const readable = ['exploit_loophole', 'combat_theft', 'healing_touch'];
let passed = 0, failed = 0;

function fixture(reduced = false) {
  const dom = new JSDOM('<main></main>', { runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window, animations = [];
  Object.defineProperty(w, 'innerWidth', { value: 390 });
  Object.defineProperty(w, 'innerHeight', { value: 800 });
  w.abbrNum = n => String(Math.round(n || 0));
  w.matchMedia = () => ({ matches: reduced });
  w.G9_DATA = { fx, runtimeAssets: { entries: {} }, balance: { path_archetype: { moon: 'Caster' } } };
  w.Element.prototype.animate = function (keyframes, timing) {
    const animation = {
      element: this, keyframes, timing, currentTime: 0, playbackRate: 1, playState: 'running',
      pause() { this.playState = 'paused'; },
      play() { this.playState = 'running'; },
      cancel() { this.playState = 'idle'; this.cancelled = true; this.oncancel?.(); },
      finish() { this.playState = 'finished'; this.onfinish?.(); }
    };
    animations.push(animation);
    return animation;
  };
  const positions = { caster: [110, 350], ally: [240, 350], enemy: [140, 80] };
  w.Element.prototype.getBoundingClientRect = function () {
    const id = this.closest?.('[data-unit-id]')?.dataset.unitId;
    const [left, top] = positions[id] || [0, 0];
    const width = id ? 64 : 390, height = id ? 64 : 600;
    return { left, top, right: left + width, bottom: top + height, width, height, x: left, y: top, toJSON() {} };
  };
  w.eval(source);
  const make = (id, pathway, team = 'ally') => Object.freeze({ id, name: id, path: pathway, team,
    sequence: 9, hp: 80, maxHp: 100, curHp: 80, sp: 40, maxSP: 50, alive: true });
  const allies = [make('caster', 'moon'), make('ally', 'black_emperor')], enemies = [make('enemy', 'error', 'enemy')];
  const map = Object.freeze(Object.fromEntries([...allies, ...enemies].map(unit => [unit.id, unit])));
  w.document.querySelector('main').innerHTML = w.renderBattleLogComponent({ allies, enemies, flattenedRows: [],
    shownCount: 0, isDone: false, speed: 1, summaryText: '' });
  const wrap = w.document.querySelector('.battle-log-wrap'), effects = w.createCombatFx(wrap);
  effects.sync(map);
  return { dom, w, wrap, map, effects, animations,
    find: selector => wrap.querySelector(selector), all: selector => [...wrap.querySelectorAll(selector)] };
}

function test(name, fn, reduced = false) {
  let f;
  try { f = fixture(reduced); fn(f); passed++; console.log('PASS ' + name); }
  catch (error) { failed++; console.error('FAIL ' + name + ': ' + error.stack); }
  finally { f?.effects.clear(); f?.dom.window.close(); }
}
function active(f) { return f.animations.filter(a => !a.cancelled && a.playState !== 'finished'); }
function rowFor(id, extra = {}) {
  return { type: 'turn', actorId: 'caster', abilityId: id, ability: id,
    sourcePath: id === 'healing_touch' ? 'moon' : id === 'combat_theft' ? 'error' : 'black_emperor', ...extra };
}
function nextFor(id, targetId) {
  const heal = id === 'healing_touch';
  return { type: heal ? 'heal' : id === 'combat_theft' ? 'note' : 'damage', event: {
    type: heal ? 'heal' : id === 'combat_theft' ? 'stat' : 'damage', actorId: 'caster',
    targetId: targetId || (heal ? 'ally' : 'enemy'), amount: 10, hpLoss: heal ? 0 : 10,
    hpAfter: heal ? 90 : 70, damageType: 'disorder' } };
}
function cast(f, id, speed = 1, extra = {}, targetId) {
  const row = rowFor(id, extra), next = nextFor(id, targetId);
  f.effects.show({ type: 'cast', row, next }, speed, 800);
  return { row, next };
}
function ownAnimations(f, selector) {
  const node = f.find(selector);
  assert(node, selector + ' exists');
  return active(f).filter(a => a.element === node || node.contains(a.element));
}
function assertDuration(animations, duration) {
  assert(animations.length, 'the effect has managed animations');
  assert(animations.every(a => Number(a.timing.duration) === duration), 'all main effect tracks share the provided phase');
}

test('only the three readable casts use 500ms at 2x and normalize copied source IDs', f => {
  for (const id of readable) for (const row of [rowFor(id), rowFor('record:' + id), rowFor('soul:' + id), rowFor('copy:other', { sourceAbilityId: id })]) {
    assert.equal(f.w.battleAnimationRate(row, 2, 'cast'), 1.6);
    assert.equal(800 / f.w.battleAnimationRate(row, 2, 'cast'), 500);
    assert.equal(f.w.battleAnimationRate(row, 1.6, 'cast'), 1.6, 'controller delegation is idempotent');
    assert.equal(f.w.battleAnimationRate(row, .5, 'cast'), .5, 'Read mode retains its ordinary rate');
    assert.equal(f.w.battleAnimationRate(row, 4, 'cast'), 4, 'compact playback retains 4x');
    for (const phase of ['damage', 'note', 'heal', 'settle']) assert.equal(f.w.battleAnimationRate(row, 2, phase), 2);
  }
  for (const id of ['basic_attack', 'brutal_strike', 'danger_sense', 'mystic_orb']) {
    assert.equal(f.w.battleAnimationRate(rowFor(id), 2, 'cast'), 2, id + ' keeps its existing rate');
  }
});

test('Exploit Loophole preserves an intact plateau and gives its split time before outcome', f => {
  cast(f, 'exploit_loophole');
  const tracks = ownAnimations(f, '.gm-combat-loophole-seal');
  assertDuration(tracks, 800);
  const intact = tracks.find(a => a.element.classList.contains('gm-loophole-intact'));
  const plateau = intact.keyframes.filter(k => Number(k.opacity) >= .9);
  assert(plateau.length >= 2 && plateau.at(-1).offset - plateau[0].offset >= .3, 'the intact seal is readable before breaking');
  for (const className of ['gm-loophole-half-top', 'gm-loophole-half-bot']) {
    const track = tracks.find(a => a.element.classList.contains(className));
    const firstVisible = track.keyframes.find(k => Number(k.opacity) > 0);
    assert(firstVisible.offset >= .5 && firstVisible.offset <= .65, 'the split becomes visible around the middle of the cast');
    assert((1 - firstVisible.offset) * track.timing.duration >= 250, 'separation and fade have a visible window');
    assert.equal(track.keyframes.at(-1).opacity, 0, 'split pieces finish before the damage boundary');
  }
});

test('Exploit Loophole completion removes its masks and container without a later phase', f => {
  cast(f, 'exploit_loophole');
  const tracks = ownAnimations(f, '.gm-combat-loophole-seal');
  assert.equal(f.all('clipPath').length, 2);
  for (const track of tracks) track.finish();
  assert.equal(f.find('.gm-combat-loophole-seal'), null);
  assert.equal(f.all('clipPath').length, 0, 'finish callbacks dispose of temporary masks');
  assert.equal(f.find('.gm-loophole-intact'), null, 'the intact emblem cannot reappear when an animation is cancelled');
});

test('Combat Theft uses the full 800ms for its reveal, plateau and fade', f => {
  cast(f, 'combat_theft');
  const tracks = ownAnimations(f, '.gm-combat-theft-siphon');
  assertDuration(tracks, 800);
  const plateau = tracks[0].keyframes.filter(k => Number(k.opacity) >= .9);
  assert(plateau.length >= 2 && (plateau.at(-1).offset - plateau[0].offset) * 800 >= 250);
  assert.equal(tracks[0].keyframes[0].opacity, 0);
  assert.equal(tracks[0].keyframes.at(-1).opacity, 0);
  assert.equal(f.find('.gm-combat-impact'), null, 'a utility cast does not invent a hit before its recorded outcome');
});

test('Healing Touch ally reveal and self-cast honor the same 800ms phase', f => {
  cast(f, 'healing_touch');
  assertDuration(ownAnimations(f, '.gm-combat-healing-touch-flight'), 800);
  const reveal = active(f).find(a => a.element.matches('clipPath rect'));
  assert(reveal, 'the ally stream has a progressive reveal');
  assert.equal(Number(reveal.timing.duration), 800);
  assert(parseFloat(reveal.keyframes.at(-1).width) > parseFloat(reveal.keyframes[0].width));
  assert.equal(f.find('.gm-combat-impact'), null, 'healing has no damage impact');
  f.effects.clear(); f.effects.sync(f.map);
  cast(f, 'healing_touch', 1, {}, 'caster');
  assertDuration(ownAnimations(f, '.gm-combat-healing-touch-flight'), 800);
  assert.equal(f.find('.gm-combat-projectile'), null, 'self-healing does not fire an attack projectile');
});

test('Healing Touch ally completion disposes of its reveal mask', f => {
  cast(f, 'healing_touch');
  const tracks = ownAnimations(f, '.gm-combat-healing-touch-flight');
  assert.equal(f.all('clipPath').length, 1);
  for (const track of tracks) track.finish();
  assert.equal(f.find('.gm-combat-healing-touch-flight'), null);
  assert.equal(f.all('clipPath').length, 0);
});

test('Healing Touch recovery stays readable for 500ms in its outcome phase, including at 2x', f => {
  const { row, next } = cast(f, 'healing_touch', 2);
  f.effects.show({ type: 'heal', row, event: next.event }, 2, 625);
  const emblem = ownAnimations(f, '.gm-combat-healing-touch-impact');
  assertDuration(emblem, 625);
  assert(active(f).every(a => Number(a.timing.duration) + Number(a.timing.delay || 0) <= 625
    || a.element.closest?.('.gm-combat-ability-chip')), 'recovery tracks fit before the next outcome');
  assert(emblem.every(a => a.playbackRate === 1.25), 'the readable heal phase uses its 1.25x support clock');
  assert.equal(f.find('.gm-combat-impact'), null);
});

for (const id of readable) test(id + ' shares pause, resume and live speed changes with the cast clock', f => {
  const { row, next } = cast(f, id, 2);
  assert(active(f).every(a => a.playbackRate === 1.6), '2x presentation gives an 800/1.6 = 500ms cast');
  f.effects.pause();
  assert(active(f).every(a => a.playState === 'paused'));
  f.effects.setSpeed(1);
  assert(active(f).every(a => a.playState === 'paused' && a.playbackRate === 1));
  f.effects.setSpeed(2);
  assert(active(f).every(a => a.playState === 'paused' && a.playbackRate === 1.6));
  f.effects.resume();
  assert(active(f).every(a => a.playState === 'running'));
  f.effects.show({ type: next.type, row, event: next.event }, 2, 400);
  const outcomeRate = id === 'healing_touch' ? 1.25 : 2;
  assert(active(f).filter(a => !a.element.closest?.('.gm-combat-ability-chip')).every(a => a.playbackRate === outcomeRate), 'recorded outcome effects match their replay phase rate');
  f.effects.setSpeed(1); f.effects.setSpeed(2);
  assert(active(f).every(a => a.playbackRate === (id === 'healing_touch' ? 1.25 : 2)));
});

test('copied utility casts retain the original effect and readable rate', f => {
  for (const id of readable) {
    const { row, next } = cast(f, id, 2, { abilityId: 'record:' + id, sourceAbilityId: id });
    assert(f.find('[data-ability-id="' + id + '"]'));
    assert(active(f).every(a => a.playbackRate === 1.6));
    f.effects.show({ type: next.type, row, event: next.event }, 2, 400);
    f.effects.clear(); f.effects.sync(f.map);
  }
});

test('compact playback and reduced motion keep static effects without unmanaged motion', f => {
  for (const id of readable) {
    cast(f, id, 4);
    assert(f.find('[data-ability-id="' + id + '"]'), 'compact playback keeps the effect identity');
    assert.equal(active(f).length, 0);
    f.effects.clear(); f.effects.sync(f.map);
  }
});

test('reduced-motion casts keep static readable cues', f => {
  for (const id of readable) {
    cast(f, id, 2);
    assert(f.find('[data-ability-id="' + id + '"]'));
    assert.equal(active(f).length, 0);
    f.effects.clear(); f.effects.sync(f.map);
  }
}, true);

test('phase changes, reflow and clear remove obsolete utility effects', f => {
  cast(f, 'exploit_loophole');
  cast(f, 'combat_theft');
  assert.equal(f.find('.gm-combat-loophole-seal'), null);
  assert.equal(f.all('clipPath').length, 0);
  f.effects.reflow();
  assert.equal(f.find('.gm-combat-fx-layer'), null);
  assert.equal(active(f).length, 0);
  cast(f, 'healing_touch');
  f.effects.clear();
  assert.equal(f.find('.gm-combat-fx-layer'), null);
  assert.equal(active(f).length, 0);
});

test('presentation preserves recorded state and does not add passive or basic utility effects', f => {
  const before = JSON.stringify(f.map);
  for (const id of readable) {
    const { row, next } = cast(f, id);
    const recorded = JSON.stringify({ row, next });
    f.effects.show({ type: next.type, row, event: next.event }, 1, 400);
    assert.equal(JSON.stringify({ row, next }), recorded, 'presentation does not rewrite replay events');
    f.effects.clear(); f.effects.sync(f.map);
  }
  for (const row of [rowFor('basic_attack', { attackKind: 'weapon' }), rowFor('brutal_strike'), rowFor('danger_sense')]) {
    f.effects.show({ type: row.abilityId === 'danger_sense' ? 'row' : 'cast', row,
      event: { type: 'story', actorId: 'caster' }, next: nextFor('exploit_loophole') }, 2, 300);
    assert.equal(f.find('.gm-combat-loophole-seal, .gm-combat-theft-siphon, .gm-combat-healing-touch-flight'), null);
    assert(active(f).every(a => a.playbackRate === 2), 'other casts retain their normal speed');
    f.effects.clear(); f.effects.sync(f.map);
  }
  assert.equal(JSON.stringify(f.map), before, 'HP, SP and all other combat snapshot values are unchanged');
});

console.log(`\nReadable Sequence 9 FX: ${passed} passed, ${failed} failed.`);
if (failed) process.exitCode = 1;
