// Observable action rhythm and critical feedback, independent of combat rolls.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/ui.js'), 'utf8').split('// ===== Browser UI =====')[0];
const css = fs.readFileSync(path.join(root, 'css/components/dungeon-arena.css'), 'utf8');
const fx = JSON.parse(fs.readFileSync(path.join(root, 'data/fx.json'), 'utf8'));
let passed = 0, failed = 0;

function fixture(options = {}) {
  const dom = new JSDOM('<style></style><main></main>', { runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window, animations = [], clocks = [];
  w.document.querySelector('style').textContent = css;
  w.abbrNum = value => String(Math.round(value || 0));
  w.G9_DATA = { fx, runtimeAssets: { entries: {} }, balance: { path_archetype: { red_priest: 'Physical', hermit: 'Caster' } } };
  w.matchMedia = () => ({ matches: !!options.reducedMotion });
  w.Element.prototype.animate = function (keyframes, timing) {
    const animation = { element: this, keyframes, timing, playState: 'running', playbackRate: 1, currentTime: 0,
      pause() { this.playState = 'paused'; }, play() {
        // Native WAAPI play() rewinds a finished forward animation. A held
        // strike must avoid that when playback resumes after opening notes.
        if (this.currentTime >= timing.duration) this.currentTime = 0;
        this.playState = 'running';
      },
      cancel() { this.cancelled = true; this.playState = 'idle'; this.oncancel?.(); },
      updatePlaybackRate(rate) { this.playbackRate = rate; },
      finish() { this.currentTime = timing.duration; this.playState = 'finished'; this.onfinish?.(); } };
    animations.push(animation); return animation;
  };
  const positions = { attacker: [40, 350], defender: [170, 80] };
  w.Element.prototype.getBoundingClientRect = function () {
    const id = this.closest?.('[data-unit-id]')?.dataset.unitId;
    const [left, top] = positions[id] || [0, 0], size = id ? options.size || 64 : 390;
    return { x: left, y: top, left, top, width: size, height: id ? size : 600,
      right: left + size, bottom: top + (id ? size : 600), toJSON() {} };
  };
  w.eval(source);
  const make = (id, team, pathway) => ({ id, name: id, team, path: pathway, sequence: 0,
    hp: 100, maxHp: 100, sp: 50, maxSP: 50, alive: true });
  const allies = [make('attacker', 'ally', 'red_priest')], enemies = [make('defender', 'enemy', 'hermit')];
  const map = Object.fromEntries([...allies, ...enemies].map(unit => [unit.id, unit]));
  w.document.querySelector('main').innerHTML = w.renderBattleLogComponent({ allies, enemies, flattenedRows: [],
    shownCount: 0, isDone: false, speed: 1, summaryText: '' });
  const wrap = w.document.querySelector('.battle-log-wrap'), effects = w.createBattleEffects(wrap);
  effects.sync(map);
  // A decorative cue may own WAAPI animations, never another battle clock.
  for (const method of ['setTimeout', 'setInterval', 'requestAnimationFrame']) {
    const original = w[method]?.bind(w);
    w[method] = (...args) => { clocks.push(method); return original?.(...args); };
  }
  return { dom, w, wrap, effects, map, positions, animations, clocks,
    sprite: id => wrap.querySelector(`[data-unit-id="${id}"] .gm-unit-sprite`),
    find: selector => wrap.querySelector(selector) };
}
function test(name, fn, options) {
  let f;
  try { f = fixture(options); fn(f); passed++; console.log('PASS ' + name); }
  catch (error) { failed++; console.error('FAIL ' + name + ': ' + error.stack); }
  finally { f?.effects.clear(); f?.dom.window.close(); }
}
function damage(extra = {}) { return { type: 'damage', event: { type: 'damage', actorId: 'attacker',
  targetId: 'defender', damageType: 'physical', amount: 20, hpLoss: 20, ...extra } }; }
function row(kind = 'weapon', next = damage()) { return { type: 'turn', actorId: 'attacker', sourcePath: 'red_priest',
  abilityId: 'basic_attack', ability: 'Attack', attackKind: kind, timeline: [next] }; }
function cast(f, action = row(), next = action.timeline[0]) {
  f.effects.show({ type: 'cast', row: action, next }, 1, 600);
  return f.animations.filter(animation => animation.element === f.sprite('attacker') && !animation.cancelled).at(-1);
}
function pose(frame) {
  const transform = frame.transform || '', translation = transform.match(/translate(?:3d)?\(\s*([-\d.]+)(?:px)?\s*[, ]\s*([-\d.]+)(?:px)?/);
  const scale = transform.match(/scale\(\s*([-\d.]+)/);
  return { x: Number(translation?.[1] || 0), y: Number(translation?.[2] || 0), scale: Number(scale?.[1] || 1) };
}
function direction(f) {
  const a = f.sprite('attacker').getBoundingClientRect(), b = f.sprite('defender').getBoundingClientRect();
  const x = b.left + b.width / 2 - a.left - a.width / 2, y = b.top + b.height / 2 - a.top - a.height / 2;
  const length = Math.hypot(x, y); return { x: x / length, y: y / length };
}
function projection(p, vector) { return p.x * vector.x + p.y * vector.y; }
function active(f) { return f.animations.filter(animation => !animation.cancelled && animation.playState !== 'finished'); }
function assertContained(animation, size) {
  for (const frame of animation.keyframes) {
    const p = pose(frame), half = size / 2;
    assert(Math.abs(p.x) + half * p.scale <= half + .03, 'horizontal art extent stays within its fixed square');
    assert(Math.abs(p.y) + half * p.scale <= half + .03, 'vertical art extent stays within its fixed square');
  }
}
function numberColor(element) {
  const hex = element.style.getPropertyValue('--gm-fx-color').trim();
  assert.match(hex, /^#[0-9a-f]{6}$/i);
  return hex.slice(1).match(/../g).map(component => parseInt(component, 16));
}

test('a melee attack anticipates away, lunges toward its real target, and returns to its exact pose', f => {
  const action = row(), animation = cast(f, action); assert(animation, 'the attacker has a visible pose animation');
  const poses = animation.keyframes.map(pose), vector = direction(f), projected = poses.map(p => projection(p, vector));
  const anticipation = projected.findIndex(value => value < -.01), lunge = projected.findIndex(value => value > .01);
  assert(anticipation > 0 && lunge > anticipation, 'a readable backstep precedes the forward attack');
  assert.equal(projected[0], 0); assert(projected.at(-1) > 0, 'the attack pose remains forward until the impact boundary');
  assert.equal(animation.timing.fill, 'forwards'); assert(Number(animation.timing.duration) <= 600);
  assertContained(animation, 64);
  f.effects.show({ ...action.timeline[0], row: action }, 1, 450);
  const returning = active(f).filter(item => item.element === f.sprite('attacker')).at(-1);
  assert(returning, 'the recorded impact starts the attacker return');
  assert(Number(returning.timing.duration) < 450, 'the return fits inside the existing impact hold');
  const returnPoses = returning.keyframes.map(pose);
  assert.deepEqual(returnPoses[0], poses.at(-1), 'impact cannot snap the art back before its return');
  assert.deepEqual(returnPoses.at(-1), { x: 0, y: 0, scale: 1 }); assertContained(returning, 64);
});

test('attack direction follows horizontal targets rather than a hardcoded team direction', f => {
  f.positions.attacker = [40, 250]; f.positions.defender = [250, 250];
  let animation = cast(f), poses = animation.keyframes.map(pose);
  assert(poses.some(p => p.x > .01)); assert(poses.some(p => p.x < -.01));
  assert(poses.every(p => Math.abs(p.y) < .03), 'a horizontal target does not create vertical team-based movement');
  f.positions.attacker = [250, 250]; f.positions.defender = [40, 250];
  animation = cast(f); poses = animation.keyframes.map(pose);
  const firstMoving = poses.find(p => Math.abs(p.x) > .01);
  assert(firstMoving.x > 0, 'anticipation reverses when the target moves to the other side');
  assert(poses.some(p => p.x < -.01)); assertContained(animation, 64);
});

test('ranged recoil and spell gathering differ from the melee lunge without replacing character art', f => {
  const cards = [...f.wrap.querySelectorAll('.gm-arena-unit')], sprites = cards.map(card => card.querySelector('.gm-unit-sprite'));
  const images = [...f.wrap.querySelectorAll('.gm-unit-sprite img')], imageSources = images.map(image => image.getAttribute('src'));
  const melee = cast(f).keyframes.map(pose), vector = direction(f);
  const gunAnimation = cast(f, row('gun')), gun = gunAnimation.keyframes.map(pose);
  assert.notDeepEqual(gun, melee, 'a gun uses recoil rather than repeating the melee motion');
  const meleeForward = Math.max(...melee.map(p => projection(p, vector)));
  const gunForward = Math.max(...gun.map(p => projection(p, vector)));
  assert(gunForward < meleeForward, 'a shot has a smaller forward lunge than a melee swing');
  const next = damage({ damageType: 'mystic' });
  const spell = { actorId: 'attacker', abilityId: 'mystic_bolt', ability: 'Mystic Bolt', sourcePath: 'hermit', timeline: [next] };
  const spellAnimation = cast(f, spell, next);
  assert.notDeepEqual(spellAnimation.keyframes.map(pose), melee);
  assert(f.find('.gm-combat-ability-chip'), 'paid abilities retain an ability-name cue');
  assert.deepEqual([...f.wrap.querySelectorAll('.gm-arena-unit')], cards);
  assert.deepEqual(cards.map(card => card.querySelector('.gm-unit-sprite')), sprites);
  assert.deepEqual([...f.wrap.querySelectorAll('.gm-unit-sprite img')], images);
  assert.deepEqual(images.map(image => image.getAttribute('src')), imageSources);
});

test('knife and sword basics share the melee motion while unarmed attacks retain a forward strike', f => {
  const knife = cast(f, { ...row(), weaponId: 'knife', ability: 'Knife' }).keyframes.map(pose);
  const sword = cast(f, { ...row(), weaponId: 'sword', ability: 'Sword' }).keyframes.map(pose);
  assert.deepEqual(knife, sword, 'weapon labels do not make knife attacks use gun recoil');
  const punch = cast(f, row('unarmed')).keyframes.map(pose), vector = direction(f);
  assert(punch.some(p => projection(p, vector) > .01), 'a bare-handed strike still moves toward its target');
});

for (const size of [28, 32, 64, 96]) {
  test(`attack poses stay inside a ${size}px artwork square`, f => {
    for (const kind of ['weapon', 'unarmed', 'gun']) {
      const action = row(kind); assertContained(cast(f, action), size);
      f.effects.show({ ...action.timeline[0], row: action }, 1, 450);
      const returning = active(f).filter(item => item.element === f.sprite('attacker')).at(-1);
      assert(returning); assertContained(returning, size);
    }
  }, { size });
}

test('an attack keeps its forward pose through opening notes and returns when its recorded impact arrives', f => {
  const opening = { type: 'note', event: { type: 'note', actorId: 'attacker', text: 'Recoil spends HP.' } };
  const impact = damage(), action = { ...row('gun'), timeline: [opening, impact] };
  const attack = cast(f, action, opening), held = attack.keyframes.map(pose).at(-1);
  f.effects.show({ ...opening, row: action, next: impact }, 1, 180);
  assert(!attack.cancelled, 'a supporting note must not clear the held attack pose');
  f.effects.show({ ...impact, row: action }, 1, 450);
  const returning = active(f).filter(item => item.element === f.sprite('attacker')).at(-1);
  assert(returning); assert.deepEqual(pose(returning.keyframes[0]), held);
  assert.deepEqual(pose(returning.keyframes.at(-1)), { x: 0, y: 0, scale: 1 });
  assert.equal(f.clocks.length, 0);
});

test('resuming playback cannot restart an already completed held attack pose', f => {
  const impact = damage(), opening = { type: 'note', event: { type: 'note', text: 'The shot remains in flight.' } };
  const action = { ...row('gun'), timeline: [opening, impact] }, attack = cast(f, action, opening);
  attack.finish();
  f.effects.show({ ...opening, row: action, next: impact }, 1, 180);
  f.effects.pause(); f.effects.setSpeed(2); f.effects.resume();
  assert.equal(attack.currentTime, attack.timing.duration, 'resuming a filled pose must not rewind its anticipation');
  assert(!attack.cancelled, 'the final pose remains owned until impact');
  f.effects.show({ ...impact, row: action }, 2, 450);
  assert(attack.cancelled); assert(active(f).some(animation => animation.element === f.sprite('attacker')));
});

test('critical HP and shield-only hits use larger orange numbers without adding an action delay', f => {
  const action = row(), plain = damage();
  f.effects.show({ ...plain, row: action }, 1, 450);
  const regular = f.find('.gm-battle-fx-number'); assert(regular);
  const regularScale = Number(regular.style.getPropertyValue('--gm-fx-number-scale')) || 1, regularColor = numberColor(regular);
  const regularSpriteDuration = active(f).find(animation => animation.element === f.sprite('defender')).timing.duration;
  for (const change of [{ critical: true }, { critical: true, hpLoss: 0, absorbed: 20, shieldAfter: 30 }]) {
    f.effects.show({ ...damage(change), row: action }, 1, 450);
    const critical = f.find('.gm-battle-fx-number'), [red, green, blue] = numberColor(critical);
    assert(red > green && green - blue >= 45, 'critical feedback is orange');
    assert.notDeepEqual(numberColor(critical), regularColor);
    assert.equal(critical.dataset.critical, 'true');
    assert(critical.classList.contains('gm-battle-fx-number-critical'));
    // JSDOM does not resolve calc() with custom properties. Inspect the live
    // scale request here; Chromium resolves the responsive font-size rule.
    assert(Number(critical.style.getPropertyValue('--gm-fx-number-scale')) > regularScale, 'critical feedback requests larger responsive type');
    const spriteDuration = active(f).find(animation => animation.element === f.sprite('defender')).timing.duration;
    assert.equal(spriteDuration, regularSpriteDuration, 'critical impact does not add a hit-stop to character motion');
  }
  assert.equal(f.clocks.length, 0, 'critical feedback cannot create extra replay timers');
});

test('healing and shield abilities have a contained cast cue and distinct support feedback', f => {
  for (const type of ['heal', 'shield']) {
    const next = { type, event: { type, actorId: 'attacker', targetId: 'defender', amount: 10 } };
    const action = { actorId: 'attacker', sourcePath: 'hermit', abilityId: `${type}_spell`, ability: type, timeline: [next] };
    const animation = cast(f, action, next); assert(animation); assertContained(animation, 64);
    assert(f.find('.gm-combat-ability-chip')); assert.equal(f.find('.gm-combat-projectile'), null);
    f.effects.show({ ...next, row: action }, 1, 400);
    assert(f.find(`.gm-combat-${type}`)); assert.equal(f.find('.gm-combat-impact'), null);
    assert(f.find(`[data-unit-id="defender"] .gm-cue-${type}`));
  }
  assert.equal(f.clocks.length, 0);
});

test('anticipation and impact animations pause together, scale their clock, and clear on skip or close', f => {
  const state = JSON.stringify(f.map), cards = [...f.wrap.querySelectorAll('.gm-arena-unit')];
  cast(f); assert(active(f).length > 0);
  f.effects.pause(); assert(active(f).every(animation => animation.playState === 'paused'));
  f.effects.setSpeed(2); assert(active(f).every(animation => animation.playbackRate === 2));
  f.effects.resume(); assert(active(f).every(animation => animation.playState === 'running'));
  f.effects.clear(); f.effects.clear();
  assert.equal(active(f).length, 0);
  assert.equal(f.wrap.querySelectorAll('.gm-battle-fx-layer, .gm-combat-fx-layer, .gm-pathway-fx-layer, .gm-pathway-links').length, 0);
  assert.equal(JSON.stringify(f.map), state); assert.deepEqual([...f.wrap.querySelectorAll('.gm-arena-unit')], cards);
  assert(![...f.wrap.querySelectorAll('[class]')].some(node => [...node.classList].some(name => name.startsWith('gm-cue-'))));
  assert.equal(f.clocks.length, 0);
});

test('reduced motion keeps the action readable without moving character art', f => {
  const action = row(); cast(f, action);
  f.effects.show({ ...damage({ critical: true }), row: action }, 1, 450);
  assert.equal(f.animations.filter(animation => animation.element.matches('.gm-unit-sprite')).length, 0);
  assert(f.find('.gm-battle-fx-number')); assert(f.find('.gm-combat-impact'));
  assert.equal(f.clocks.length, 0);
}, { reducedMotion: true });

console.log(`\nAction rhythm and critical feedback: ${passed} passed, ${failed} failed.`);
if (failed) process.exitCode = 1;
