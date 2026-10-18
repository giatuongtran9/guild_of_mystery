// Direction, shared impact and weapon-counter presentation regressions.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/ui.js'), 'utf8').split('// ===== Browser UI =====')[0];
const fx = JSON.parse(fs.readFileSync(path.join(root, 'data/fx.json'), 'utf8'));
let passed = 0, failed = 0;

function fixture(reduced = false) {
  const dom = new JSDOM('<main></main>', { runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window, animations = [], positions = { caster: [110, 350], enemy: [110, 80] };
  Object.defineProperty(w, 'innerWidth', { value: 390 });
  Object.defineProperty(w, 'innerHeight', { value: 900 });
  w.abbrNum = n => String(Math.round(n || 0)); w.matchMedia = () => ({ matches: reduced });
  w.G9_DATA = { fx, runtimeAssets: { entries: {} }, balance: { path_archetype: { tyrant: 'Physical', hermit: 'Caster' } } };
  w.Element.prototype.animate = function (keyframes, timing) {
    const animation = { element: this, keyframes, timing, currentTime: 0, playbackRate: 1, playState: 'running',
      pause() { this.playState = 'paused'; }, play() { this.playState = 'running'; },
      cancel() { this.playState = 'idle'; this.cancelled = true; this.oncancel?.(); },
      finish() { this.playState = 'finished'; this.onfinish?.(); } };
    animations.push(animation); return animation;
  };
  w.Element.prototype.getBoundingClientRect = function () {
    const id = this.closest?.('[data-unit-id]')?.dataset.unitId;
    const [left, top] = positions[id] || [0, 0], width = id ? 64 : 390, height = id ? 64 : 650;
    return { left, top, right: left + width, bottom: top + height, width, height, x: left, y: top, toJSON() {} };
  };
  w.eval(source);
  const make = (id, pathway, team) => ({ id, name: id, path: pathway, team, sequence: 8,
    hp: 100, maxHp: 100, curHp: 100, sp: 100, maxSP: 100, alive: true });
  const allies = [make('caster', 'tyrant', 'ally')], enemies = [make('enemy', 'hermit', 'enemy')];
  const map = Object.fromEntries([...allies, ...enemies].map(u => [u.id, u]));
  w.document.querySelector('main').innerHTML = w.renderBattleLogComponent({ allies, enemies, flattenedRows: [], shownCount: 0,
    isDone: false, speed: 1, summaryText: '' });
  const wrap = w.document.querySelector('.battle-log-wrap'), effects = w.createBattleEffects(wrap);
  effects.sync(map);
  return { dom, w, wrap, effects, map, positions, animations,
    field: wrap.querySelector('.gm-battlefield-canvas'), find: selector => wrap.querySelector(selector) };
}
function active(f) { return f.animations.filter(a => !a.cancelled && a.playState !== 'finished'); }
function tracks(f, node) { return active(f).filter(a => a.element === node || node?.contains(a.element)); }
function shake(f) { return active(f).filter(a => a.element === f.field); }
function clean(f) { f.effects.clear(); f.effects.sync(f.map); }
function test(name, run, reduced = false) {
  let f;
  try { f = fixture(reduced); run(f); passed++; console.log('PASS ' + name); }
  catch (e) { failed++; console.error('FAIL ' + name + ': ' + e.stack); }
  finally { f?.effects.clear(); f?.dom.window.close(); }
}
function action(id = 'raging_blow', attackKind, extras = {}) {
  const event = { type: 'damage', actorId: 'caster', targetId: 'enemy', amount: 40, hpLoss: 40,
    damageType: 'physical', ...extras };
  const row = { type: 'turn', actorId: 'caster', sourcePath: fx.sequence8Abilities[id]?.pathway || 'tyrant',
    abilityId: id, ability: id === 'basic_attack' ? 'Attack' : id.replaceAll('_', ' '),
    ...(attackKind ? { attackKind } : {}), timeline: [{ type: event.isReaction ? 'reaction' : 'damage', event }] };
  return { row, event, next: row.timeline[0] };
}
function showCast(f, entry, speed = 1) { f.effects.show({ type: 'cast', row: entry.row, next: entry.next }, speed, entry.row.abilityId === 'basic_attack' ? 300 : 800); }
function showHit(f, entry, speed = 1) { f.effects.show({ type: entry.next.type, row: entry.row, event: entry.event }, speed, 225); }
function angle(actual, expected, message) { assert(Math.abs(Number(actual) - expected) <= .02, message + ': ' + actual + ' versus ' + expected); }
function rotations(frames) { return frames.map(frame => [...String(frame.transform || '').matchAll(/rotate\((-?[\d.]+)deg\)/g)].map(m => Number(m[1]))); }
function snapshot(f) {
  const node = f.find('.gm-combat-fx-layer').cloneNode(true);
  for (const child of [node, ...node.querySelectorAll('*')]) child.removeAttribute('data-critical');
  node.querySelectorAll('.gm-combat-ability-chip').forEach(chip => chip.remove());
  return { html: node.outerHTML, tracks: active(f).filter(a => a.element !== f.find('.gm-battle-fx-number'))
    .map(a => ({ element: a.element.tagName + '.' + a.element.getAttribute('class'), keyframes: a.keyframes,
      timing: a.timing, rate: a.playbackRate })) };
}

test('every damaging Sequence 8 cast and impact share their attacker-to-target heading', f => {
  const damaging = Object.entries(fx.sequence8Abilities).filter(([, spec]) => spec.mode === 'travel');
  for (const [id] of damaging) for (const [x, y] of [[260, 350], [10, 350], [110, 80], [110, 520]]) {
    f.positions.enemy = [x, y]; const entry = action(id);
    const expected = Math.atan2(y - 350, x - 110) * 180 / Math.PI;
    showCast(f, entry); const cast = f.find('.gm-combat-sequence8[data-stage="cast"]');
    angle(cast.dataset.angleDeg, expected, id + ' cast heading');
    const castTrack = tracks(f, cast).find(a => a.element === cast);
    assert(castTrack, 'cast is managed');
    angle(rotations(castTrack.keyframes).at(-1)[0], expected, id + ' finishes flight facing the target');
    showHit(f, entry); const impact = f.find('.gm-combat-sequence8[data-stage="impact"]');
    angle(impact.dataset.angleDeg, expected, id + ' impact heading');
    for (const frame of rotations(tracks(f, impact).find(a => a.element === impact).keyframes)) angle(frame[0], expected, id + ' impact retains heading');
    clean(f);
  }
});

test('Raging Blow keeps its authored 180-degree art flip on both flight and impact', f => {
  const entry = action('raging_blow');
  for (const stage of ['cast', 'impact']) {
    if (stage === 'cast') showCast(f, entry); else showHit(f, entry);
    const art = f.find(`.gm-combat-sequence8[data-stage="${stage}"] image`);
    assert.equal(art.dataset.flipDeg, '180'); assert.equal(art.getAttribute('transform'), 'rotate(180)');
  }
});

test('Heavy Cleave visibly travels from attacker to its single target', f => {
  assert.equal(fx.sequence8Abilities.heavy_cleave.mode, 'travel');
  const entry = action('heavy_cleave'); showCast(f, entry);
  const node = f.find('.gm-combat-sequence8'); assert.equal(node.dataset.mode, 'travel');
  const frames = tracks(f, node).find(a => a.element === node).keyframes;
  assert.match(frames[0].transform, /translate\(142px,382px\)/);
  assert.match(frames.at(-1).transform, /translate\(142px,112px\)/);
  assert.equal(f.find('.gm-combat-area-wave'), null);
});

test('every landed direct impact uses one managed 160ms battlefield shake', f => {
  const cases = [action('basic_attack', 'weapon'), action('basic_attack', 'gun'), action('basic_attack', 'unarmed'),
    action('heavy_cleave'), action('raging_blow'), action('brutal_strike'), action('unlisted_spell'),
    action('basic_attack', 'weapon', { isReaction: true, isCounter: true, abilityId: 'basic_attack', attackKind: 'weapon' }),
    action('basic_attack', 'weapon', { hpLoss: 0, absorbed: 40 })];
  for (const entry of cases) {
    const before = JSON.stringify(entry); showHit(f, entry, 2);
    assert.equal(shake(f).length, 1, entry.row.ability + ' creates one shake, not duplicate ability + generic shakes');
    const motion = shake(f)[0]; assert.equal(Number(motion.timing.duration), 160); assert.equal(motion.playbackRate, 2);
    assert(motion.keyframes.some(frame => /translate\(-?\d+px,\s*-?\d+px\)/.test(frame.transform)), 'a real directional shake is authored');
    assert.equal(JSON.stringify(entry), before, 'effect presentation cannot mutate the battle');
    clean(f); assert.equal(active(f).length, 0); assert(f.field.isConnected, 'the canvas is not removed when the shake clears');
  }
});

test('battlefield shake follows Pause, speed switching, Resume, phase cleanup and Skip', f => {
  const entry = action('heavy_cleave'); f.field.style.transform = 'scale(1)'; showHit(f, entry);
  const motion = shake(f)[0]; assert(motion);
  f.effects.pause(); assert.equal(motion.playState, 'paused');
  f.effects.setSpeed(2); assert.equal(motion.playState, 'paused'); assert.equal(motion.playbackRate, 2);
  f.effects.resume(); assert.equal(motion.playState, 'running');
  f.effects.show({ type: 'note', row: entry.row, event: { type: 'story', text: 'The attack ends.' } }, 2, 90);
  assert.equal(motion.cancelled, true); assert.equal(shake(f).length, 0); assert.equal(f.field.style.transform, 'scale(1)');
  showHit(f, entry); const next = shake(f)[0]; f.effects.clear();
  assert.equal(next.cancelled, true); assert.equal(f.field.style.transform, 'scale(1)'); assert(f.field.isConnected);
});

test('finishing a shake leaves the battlefield attached and restores its preexisting transform', f => {
  f.field.style.transform = 'scale(1)'; showHit(f, action('brutal_strike'));
  const motion = shake(f)[0]; motion.finish();
  assert.equal(shake(f).length, 0); assert(f.field.isConnected); assert.equal(f.field.style.transform, 'scale(1)');
});

for (const reduced of [false, true]) test((reduced ? 'Reduced motion' : '4x compact playback') + ' suppresses impact shake', f => {
  for (const entry of [action('basic_attack', 'unarmed'), action('heavy_cleave'), action('brutal_strike')]) {
    showHit(f, entry, reduced ? 2 : 4); assert.equal(shake(f).length, 0); clean(f);
  }
}, reduced);

test('damage-over-time, misses and support effects do not shake the battlefield', f => {
  showHit(f, action('basic_attack', 'weapon', { isDot: true })); assert.equal(shake(f).length, 0); clean(f);
  for (const type of ['heal', 'shield', 'note']) {
    f.effects.show({ type, row: { actorId: 'caster', abilityId: 'healing_touch' },
      event: { type: type === 'note' ? 'status' : type, actorId: 'caster', targetId: 'enemy', amount: 30, status: type === 'note' ? 'sleep' : undefined } }, 1, 400);
    assert.equal(shake(f).length, 0); clean(f);
  }
  const entry = action('basic_attack', 'weapon'); entry.event.type = 'miss'; entry.event.hpLoss = 0;
  showCast(f, entry); assert.equal(shake(f).length, 0);
});

test('Counter reuses the corresponding normal weapon animation during its recorded reaction', f => {
  for (const [kind, selector] of [['weapon', '.gm-combat-sword-slash-travel'], ['gun', '.gm-combat-gun-muzzle'], ['unarmed', '.gm-combat-punch-trail']]) {
    const entry = action('basic_attack', kind, { isReaction: true, isCounter: true, abilityId: 'basic_attack', attackKind: kind });
    entry.row.ability = 'Counter'; entry.row.isCounter = true; showCast(f, entry);
    assert(f.find(selector), kind + ' counter has the normal basic weapon effect');
    assert.equal(f.find('.gm-combat-ability-chip'), null, 'Counter does not become a paid spell');
    showHit(f, entry); assert.equal(shake(f).length, 1);
    if (kind === 'unarmed') assert(f.find('.gm-combat-impact-image-punch'), 'unarmed counter has the punch impact');
    clean(f);
  }
});

test('critical hits retain identical attack artwork, size, color, keyframes and timing; only damage numbers gain emphasis', f => {
  for (const [id, kind] of [['raging_blow'], ['heavy_cleave'], ['brutal_strike'], ['unlisted_spell'],
    ['basic_attack', 'weapon'], ['basic_attack', 'gun'], ['basic_attack', 'unarmed']]) {
    const recorded = [];
    for (const critical of [false, true]) {
      const entry = action(id, kind, { critical }); showHit(f, entry, 2);
      const number = f.find('.gm-battle-fx-number'); assert(number);
      if (critical) {
        assert(number.classList.contains('gm-battle-fx-number-critical'));
        assert.equal(number.style.getPropertyValue('--gm-fx-color'), fx.impact.critColor);
        assert(Number(number.style.getPropertyValue('--gm-fx-number-scale')) > 1);
      } else assert(!number.classList.contains('gm-battle-fx-number-critical'));
      recorded.push({ visual: snapshot(f), duration: f.w.battlePresentationDelay({ turnRows: [entry.row], currentTurn: 0, eventCount: 1 }, 2) });
      assert(active(f).every(a => a.playState === 'running' && a.playbackRate === 2), 'criticals introduce no pause or hit-stop');
      clean(f);
    }
    assert.deepEqual(recorded[1], recorded[0], id + ' critical changes only its number treatment');
  }
});

console.log(`\nCombat FX alignment: ${passed} passed, ${failed} failed.`);
if (failed) process.exitCode = 1;
