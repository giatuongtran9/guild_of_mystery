// Observable combat FX regressions; effects must never write combat state.
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
  const w = dom.window, animations = [];
  let now = 0;
  Object.defineProperty(w.performance, 'now', { value: () => now });
  w.abbrNum = number => String(Math.round(number || 0));
  w.matchMedia = () => ({ matches: reduced });
  w.G9_DATA = { fx, runtimeAssets: { entries: {} }, balance: { path_archetype: { hermit: 'Caster', fool: 'Agility', paragon: 'Physical' } } };
  w.Element.prototype.animate = function (keyframes, timing) {
    let done;
    const finished = new Promise(resolve => { done = resolve; });
    const animation = {
      element: this, keyframes, timing, playbackRate: 1, playState: 'running', currentTime: 0,
      finished, pause() { this.playState = 'paused'; }, play() { this.playState = 'running'; },
      cancel() { this.playState = 'idle'; this.cancelled = true; this.oncancel?.(); },
      updatePlaybackRate(rate) { this.playbackRate = rate; },
      finish() { this.playState = 'finished'; this.onfinish?.(); done(); },
      effect: { getComputedTiming: () => timing }
    };
    animations.push(animation); return animation;
  };
  const positions = { fool: [30, 350], paragon: [110, 350], hermit: [190, 350], enemy: [140, 80], enemy2: [240, 80] };
  w.Element.prototype.getBoundingClientRect = function () {
    const id = this.closest?.('[data-unit-id]')?.dataset.unitId;
    const [left, top] = positions[id] || [0, 0];
    const width = id ? 64 : 390, height = id ? 64 : 600;
    return { x: left, y: top, left, top, width, height, right: left + width, bottom: top + height, toJSON() {} };
  };
  w.eval(source);
  const make = (id, pathway, team = 'ally') => ({ id, name: id, path: pathway, team, sequence: 0,
    hp: 100, maxHp: 100, curHp: 100, sp: 80, maxSP: 100, alive: true });
  const allies = [make('fool', 'fool'), make('paragon', 'paragon'), make('hermit', 'hermit')];
  const enemies = [make('enemy', 'chained', 'enemy'), make('enemy2', 'tyrant', 'enemy')];
  const map = Object.fromEntries([...allies, ...enemies].map(unit => [unit.id, unit]));
  w.document.querySelector('main').innerHTML = w.renderBattleLogComponent({ allies, enemies, flattenedRows: [],
    shownCount: 0, isDone: false, speed: 1, summaryText: '' });
  const wrap = w.document.querySelector('.battle-log-wrap');
  const effects = w.createCombatFx(wrap);
  effects.sync(map);
  return { dom, w, wrap, effects, map, positions, animations, setNow: value => { now = value; },
    find: selector => wrap.querySelector(selector), all: selector => [...wrap.querySelectorAll(selector)] };
}

function test(name, fn, reduced) {
  let f;
  try { f = fixture(reduced); fn(f); passed++; console.log('PASS ' + name); }
  catch (error) { failed++; console.error('FAIL ' + name + ': ' + error.stack); }
  finally { f?.effects.clear(); f?.dom.window.close(); }
}

function hit(actorId = 'paragon', targetId = 'enemy', damageType = 'physical', extra = {}) {
  return { type: 'damage', event: { type: 'damage', actorId, targetId, damageType, hpLoss: 10, amount: 10, ...extra } };
}
function cast(f, row, next = hit(row.actorId), speed = 1, hold = 600) {
  f.effects.show({ type: 'cast', row, next }, speed, hold);
  return f.find('.gm-combat-projectile');
}
function active(f) { return f.animations.filter(animation => !animation.cancelled && animation.playState !== 'finished'); }

test('gun and unarmed basics retain procedural projectiles while weapon basics travel as a directional slash', f => {
  for (const [kind, family] of [['gun', 'bolt'], ['unarmed', 'slash']]) {
    const projectile = cast(f, { actorId: 'paragon', sourcePath: 'paragon', abilityId: 'basic_attack', attackKind: kind });
    assert(projectile, kind + ' retains its existing projectile cue');
    assert.equal(projectile.dataset.family, family);
    assert.equal(projectile.dataset.pathKind, 'straight');
  }
  const weapon = { actorId: 'paragon', sourcePath: 'paragon', abilityId: 'basic_attack', attackKind: 'weapon' };
  f.effects.show({ type: 'cast', row: weapon, next: hit('paragon') }, 1, 450);
  assert.equal(f.find('.gm-combat-projectile'), null, 'the custom weapon slash is not layered over a procedural slash');
  const travelingSlash = f.find('.gm-combat-sword-slash-travel');
  assert(travelingSlash, 'the slash launches from the attacker during the cast cue');
  assert.equal(travelingSlash.dataset.ownerId, 'paragon');
  assert.equal(travelingSlash.dataset.targetId, 'enemy');
  assert.equal(travelingSlash.querySelector('image').getAttribute('href'), 'data/assets/effects/sword-slash.png');
  const travelingArt = travelingSlash.querySelector('image');
  assert.equal(travelingArt.getAttribute('transform'), 'rotate(180)', 'the slash art is flipped upside down locally');
  assert.equal(travelingArt.dataset.flipDeg, '180');
  assert.equal(Number(travelingArt.getAttribute('width')), 128, 'the slash is twice the 64px character sprite height');
  assert.equal(Number(travelingArt.getAttribute('height')), 128, 'the slash stays square at twice the character sprite height');
  assert.equal(travelingArt.dataset.spriteScale, '2');
  assert.equal(Number(travelingSlash.dataset.travelMs), 450,
    'slash uses the full existing cast window for a clearly readable flight');
  assert.equal(Number(travelingSlash.dataset.travelDelayMs), 0,
    'slash launches as soon as the attacker cue appears, without extending the turn');
  const travelAnimation = active(f).find(animation => animation.element === travelingSlash);
  assert(travelAnimation?.keyframes.some(frame => /rotate\(/.test(frame.transform || '')), 'slash rotates along the attacker-to-target direction');
  assert(travelAnimation.keyframes.every(frame => !/rotate\(180\)/.test(frame.transform || '')), 'the local upside-down flip does not reverse the travel bearing');
  const firstTravel = travelAnimation.keyframes[0].transform;
  const lastTravel = travelAnimation.keyframes.at(-1).transform;
  assert.match(firstTravel, /translate\(\d+(?:\.\d+)?px,\d+(?:\.\d+)?px\)/, 'slash begins inset from the attacker center');
  assert.notEqual(firstTravel, lastTravel, 'slash advances through the existing cast window');
  const angle = Math.atan2((80 + 32) - (350 + 32), (140 + 32) - (110 + 32)) * 180 / Math.PI;
  assert(Math.abs(Number(travelingSlash.dataset.angleDeg) - angle) < .1, 'slash orientation follows the actual target vector');
  f.effects.show({ ...hit('paragon'), row: weapon }, 1, 450);
  const impactFlash = f.find('.gm-combat-impact');
  assert(impactFlash, 'the landing uses the existing distinct impact flash instead of repeating the traveling crescent');
  assert(f.find('.gm-combat-impact-frame'), 'the target receives the short impact/spark frames');
  assert.equal(f.find('.gm-combat-sword-slash-image'), null, 'the full slash artwork is not stamped over the target a second time');
  assert.equal(Number(impactFlash.dataset.hitStopMs), 0, 'the distinct landing effect adds no hit-stop');
  const flashAnimation = active(f).find(animation => animation.element.closest?.('.gm-combat-impact') === impactFlash);
  assert(flashAnimation, 'the landing flash is visual-only and animated in place');
  assert.equal(Number(flashAnimation.timing.duration), fx.impact.durationMs, 'impact stays within the existing effect timing');
  assert.equal(f.find('.gm-combat-ability-chip'), null, 'basics do not repeat weapon names above the sprite');
});

test('caster basics use pathway magic, retaining damage type color', f => {
  const projectile = cast(f, { actorId: 'hermit', sourcePath: 'hermit', abilityId: 'basic_attack', attackKind: 'unarmed' }, hit('hermit', 'enemy', 'mystic'));
  assert.equal(projectile.dataset.family, fx.basicAttack.pathways.hermit);
  assert.equal(projectile.dataset.damageType, 'mystic');
  assert(projectile.getAttribute('style')?.includes(fx.damageColors.mystic) || projectile.outerHTML.includes(fx.damageColors.mystic));
});

test('caster basics retain magical arcs and trails even when their recorded damage is physical', f => {
  const row = { actorId: 'hermit', sourcePath: 'hermit', abilityId: 'basic_attack', attackKind: 'unarmed' };
  const projectile = cast(f, row, hit('hermit', 'enemy', 'physical'));
  assert.equal(projectile.dataset.family, fx.basicAttack.pathways.hermit);
  assert.equal(projectile.dataset.pathKind, 'arc');
  assert.equal(projectile.dataset.damageType, 'physical');
  assert(projectile.getAttribute('style')?.includes(fx.damageColors.physical), 'the color still describes resolved damage');
  assert(f.all('.gm-combat-afterimage').length >= 2);
  const gun = cast(f, { ...row, attackKind: 'gun' }, hit('hermit', 'enemy', 'physical'));
  assert.equal(gun.dataset.family, 'bolt'); assert.equal(gun.dataset.pathKind, 'straight');
  assert.equal(f.find('.gm-combat-afterimage'), null, 'equipped guns retain straight shots for casters');
});

test('recorded damage uses its source pathway while reactions use their actual actor', f => {
  const row = { actorId: 'fool', sourcePath: 'sun', abilityId: 'record:holy_ray', ability: 'Recorded Ray' };
  let projectile = cast(f, row, hit('fool', 'enemy', 'holy'));
  assert.equal(projectile.dataset.family, fx.pathwayDamageOverrides.sun.holy);
  f.effects.show({ type: 'damage', row, event: hit('fool').event,
    next: { type: 'reaction', event: hit('enemy', 'fool', 'dark').event } }, 1, 650);
  projectile = f.find('.gm-combat-projectile');
  assert.equal(projectile.dataset.ownerId, 'enemy');
  assert.equal(projectile.dataset.targetId, 'fool');
  assert.equal(projectile.dataset.family, fx.pathwayDamageOverrides.chained.dark);
});

test('distance changes travel duration and both near and far projectiles arrive at the HP boundary', f => {
  const row = { actorId: 'hermit', sourcePath: 'hermit', abilityId: 'mystic_orb', ability: 'Mystic Orb' };
  f.positions.enemy = [190, 270];
  const near = cast(f, row, hit('hermit', 'enemy', 'mystic'), 1, 600);
  const nearDuration = Number(near.dataset.travelMs);
  assert.equal(Number(near.dataset.travelDelayMs) + nearDuration, 600);
  f.positions.enemy = [20, 30];
  const far = cast(f, { ...row }, hit('hermit', 'enemy', 'mystic'), 1, 600);
  assert(Number(far.dataset.travelMs) > nearDuration);
  assert.equal(Number(far.dataset.travelDelayMs) + Number(far.dataset.travelMs), 600);
  const movement = active(f).find(animation => animation.element === far);
  assert(movement, 'the actual projectile owns its movement clock');
  assert.equal(Number(movement.timing.delay || 0) + Number(movement.timing.duration), 600);
});

test('physical shots are fast and straight while spell paths curve with afterimages', f => {
  const shot = cast(f, { actorId: 'paragon', sourcePath: 'paragon', abilityId: 'basic_attack', attackKind: 'gun' });
  const shotDuration = Number(shot.dataset.travelMs);
  assert.equal(shot.dataset.pathKind, 'straight');
  const spell = cast(f, { actorId: 'hermit', sourcePath: 'hermit', abilityId: 'mystic_orb' }, hit('hermit', 'enemy', 'mystic'));
  assert.equal(spell.dataset.pathKind, 'arc');
  assert(Number(spell.dataset.travelMs) >= shotDuration);
  assert(f.all('.gm-combat-afterimage').length >= 2, 'spells leave a fading trail');
  const movement = active(f).find(animation => animation.element === spell);
  assert(movement.keyframes.length >= 3, 'the spell has a curved intermediate travel point');
});

test('impact feedback retains stepped frames and critical hits scale visually without any hit-stop', f => {
  const row = { actorId: 'paragon', sourcePath: 'paragon', abilityId: 'shot' };
  f.effects.show({ ...hit(), row }, 1, 450);
  const normal = f.find('.gm-combat-impact');
  assert(normal); assert.equal(normal.querySelectorAll('.gm-combat-impact-frame').length, 4);
  const normalScale = Number(normal.dataset.impactScale || 1);
  assert.equal(Number(normal.dataset.hitStopMs), 0, 'ordinary hits do not receive a critical stop');
  assert(active(f).filter(animation => animation.element.closest?.('.gm-combat-impact') === normal)
    .every(animation => Number(animation.timing.duration) === fx.impact.durationMs));
  f.effects.show({ ...hit('paragon', 'enemy', 'physical', { critical: true }), row }, 1, 500);
  const critical = f.find('.gm-combat-impact');
  assert.equal(critical.dataset.critical, 'true');
  assert(Number(critical.dataset.impactScale) > normalScale);
  assert.equal(Number(critical.dataset.hitStopMs), 0);
  const frameAnimations = active(f).filter(animation => animation.element.closest?.('.gm-combat-impact') === critical);
  assert(frameAnimations.length >= 4, 'each stepped frame is represented in the visible burst');
  assert(frameAnimations.every(animation => Number(animation.timing.duration) === fx.impact.durationMs), 'critical visuals never extend the impact clock');
  for (const animation of frameAnimations) {
    assert.equal(animation.timing.easing, 'linear', 'the overall clock must reach intermediate pixel frames');
    assert(animation.keyframes.every(key => key.easing === 'steps(1,end)'), 'pixel opacity steps belong to individual keyframe segments');
  }
});

test('sword slash and critical number styles preserve mobile readability and draw damage over effects', f => {
  const css = fs.readFileSync(path.join(root, 'css/components/dungeon-arena.css'), 'utf8');
  assert.match(css, /\.gm-combat-fx-layer\s*\{[^}]*z-index:\s*4/s);
  assert.match(css, /\.gm-battle-fx-layer\s*\{[^}]*z-index:\s*5/s);
  assert.match(css, /\.gm-battle-fx-number-critical\s*\{[^}]*font-size:\s*16px/s);
  assert.match(css, /@media \(max-width:\s*560px\)[\s\S]*?\.gm-battle-fx-number-critical\s*\{[^}]*font-size:\s*15px/s);
  assert.match(css, /\.gm-combat-sword-slash-image,\s*\.gm-combat-sword-slash-projectile\s*\{[^}]*transform-origin:\s*center/s);
  assert.match(css, /\.gm-unit-sprite-anchor\.gm-cue-actor\s*\{[^}]*#ffd078/s, 'attacker cue is gold and distinct from the red target cue');
  assert.match(css, /\.gm-unit-sprite-anchor\.gm-cue-damage\s*\{[^}]*#f39991/s, 'target damage cue remains red');
});

test('a heal rises as green motes with no damaging projectile or impact', f => {
  const row = { actorId: 'hermit', abilityId: 'healing', ability: 'Recovery', sourcePath: 'hermit' };
  cast(f, row, { type: 'heal', event: { actorId: 'hermit', targetId: 'fool', amount: 20 } });
  assert.equal(f.find('.gm-combat-projectile'), null);
  f.effects.show({ type: 'heal', row, event: { actorId: 'hermit', targetId: 'fool', amount: 20 } }, 1, 400);
  assert(f.find('.gm-combat-heal')); assert.equal(f.find('.gm-combat-impact'), null);
  assert.equal(f.find('.gm-combat-heal').dataset.targetId, 'fool');
  const color = f.find('.gm-combat-heal').getAttribute('style').match(/#[0-9a-f]{6}/i)?.[0];
  assert(color, 'heal has a visible support color');
  const [red, green, blue] = color.slice(1).match(/../g).map(component => parseInt(component, 16));
  assert(green > red && green > blue, 'heal uses green motes');
});

test('shields use target rings and statuses use icon pops without projectiles', f => {
  const row = { actorId: 'hermit', abilityId: 'barrier', ability: 'Barrier' };
  f.effects.show({ type: 'shield', row, event: { actorId: 'hermit', targetId: 'fool', amount: 20 } }, 1, 400);
  assert(f.find('.gm-combat-shield')); assert.equal(f.find('.gm-combat-projectile'), null);
  assert(f.find('.gm-combat-shield').querySelector('circle, path, rect'), 'shield has visible ring geometry');
  f.effects.show({ type: 'note', row, event: { type: 'status', actorId: 'hermit', targetId: 'enemy', status: 'bound', text: 'Bound' } }, 1, 350);
  assert(f.find('.gm-combat-status')); assert.equal(f.find('.gm-combat-projectile'), null);
  assert.equal(f.find('.gm-combat-status').dataset.targetId, 'enemy');
});

test('pure support casts do not launch projectiles and a new phase cancels old spell trails', f => {
  const row = { actorId: 'hermit', sourcePath: 'hermit', abilityId: 'mystic_orb', ability: 'Mystic Orb' };
  cast(f, row, hit('hermit', 'enemy', 'mystic'));
  const trails = active(f); assert(trails.length > 0); assert(f.find('.gm-combat-afterimage'));
  const shield = { type: 'shield', event: { actorId: 'hermit', targetId: 'fool', amount: 20 } };
  cast(f, { actorId: 'hermit', abilityId: 'barrier', ability: 'Barrier' }, shield);
  assert.equal(f.find('.gm-combat-projectile'), null); assert.equal(f.find('.gm-combat-afterimage'), null);
  assert(trails.every(animation => animation.cancelled), 'support does not leave the last damaging spell in flight');
  for (const step of [shield, { type: 'heal', event: { actorId: 'hermit', targetId: 'fool', amount: 20 } },
    { type: 'note', event: { type: 'status', actorId: 'hermit', targetId: 'enemy', status: 'bound' } }]) {
    cast(f, { actorId: 'hermit', abilityId: 'support' }, step);
    assert.equal(f.find('.gm-combat-projectile'), null);
  }
});

test('periodic damage never invents a fresh cast projectile or direct-hit burst', f => {
  const row = { actorId: 'hermit', sourcePath: 'hermit', abilityId: 'burn', ability: 'Burn' };
  const tick = hit('hermit', 'enemy', 'fire', { isDot: true });
  cast(f, row, tick); assert.equal(f.find('.gm-combat-projectile'), null);
  f.effects.show({ ...tick, row }, 1, 450);
  assert.equal(f.find('.gm-combat-impact'), null);
});

test('an AoE cast emits one shared wave but retains ordered target impacts', f => {
  const row = { actorId: 'hermit', sourcePath: 'hermit', abilityId: 'storm', ability: 'Storm', presentationTargetMode: 'all_enemies' };
  const first = hit('hermit', 'enemy', 'lightning', { area: true });
  const second = hit('hermit', 'enemy2', 'lightning', { area: true });
  cast(f, row, first);
  assert.equal(f.find('.gm-combat-projectile').dataset.family, 'wave');
  f.effects.show({ ...first, row, next: second }, 1, 450);
  assert.equal(f.find('.gm-combat-projectile'), null, 'later AoE targets cannot relaunch the rank wave');
  assert.equal(f.find('.gm-combat-impact').dataset.targetId, 'enemy');
  f.effects.show({ ...second, row, next: null }, 1, 450);
  assert.equal(f.find('.gm-combat-impact').dataset.targetId, 'enemy2');
});

test('multi-hit follow-ups expose their hit order and stagger a compact burst', f => {
  const first = hit(), second = hit();
  const row = { actorId: 'paragon', sourcePath: 'paragon', abilityId: 'double_shot', timeline: [first, second] };
  f.effects.show({ ...first, row, next: second }, 1, 450);
  f.effects.show({ ...second, row }, 1, 450);
  const impact = f.find('.gm-combat-impact');
  assert.equal(Number(impact.dataset.hitIndex), 2);
  const sparks = active(f).filter(animation => animation.element.closest?.('.gm-combat-impact') === impact);
  assert(sparks.some(animation => Number(animation.timing.delay) >= 35), 'secondary bursts stagger rather than stacking on one frame');
});

test('ability chips last half a second across short notes and never show for basics', f => {
  const row = { actorId: 'hermit', sourcePath: 'hermit', abilityId: 'mystic_orb', ability: '<Mystic Orb>' };
  cast(f, row, hit('hermit', 'enemy', 'mystic'));
  const chip = f.find('.gm-combat-ability-chip');
  assert.equal(chip.textContent, '<Mystic Orb>'); assert.equal(chip.querySelector('mystic'), null, 'ability labels are text, not markup');
  const lifetime = active(f).find(animation => animation.element === chip);
  assert.equal(Number(lifetime.timing.duration), 500);
  f.setNow(100);
  f.effects.show({ type: 'note', row, event: { type: 'note', text: 'A short supporting note.' } }, 1, 180);
  assert.equal(f.find('.gm-combat-ability-chip'), chip, 'short notes do not erase an ability chip');
  cast(f, { actorId: 'paragon', abilityId: 'basic_attack', attackKind: 'gun', ability: 'Revolver' });
  assert.equal(f.find('.gm-combat-ability-chip'), null);
});

test('effects pause, resume and change speed together without mutating cards or combat state', f => {
  const state = JSON.stringify(f.map), cards = f.all('.gm-arena-unit'), html = cards.map(card => card.innerHTML);
  cast(f, { actorId: 'hermit', sourcePath: 'hermit', abilityId: 'mystic_orb', ability: 'Mystic Orb' }, hit('hermit', 'enemy', 'mystic'));
  assert(active(f).length > 0);
  f.effects.pause(); assert(active(f).every(animation => animation.playState === 'paused'));
  f.effects.setSpeed(2); assert(active(f).every(animation => animation.playbackRate === 2));
  f.effects.resume(); assert(active(f).every(animation => animation.playState === 'running'));
  assert.equal(JSON.stringify(f.map), state);
  assert.deepEqual(f.all('.gm-arena-unit'), cards); assert.deepEqual(cards.map(card => card.innerHTML), html);
  f.effects.clear(); f.effects.clear();
  assert.equal(f.all('.gm-combat-fx-layer').length, 0); assert(active(f).length === 0);
});

test('reflow cancels travel so stale endpoints cannot survive a layout change', f => {
  cast(f, { actorId: 'hermit', sourcePath: 'hermit', abilityId: 'mystic_orb' }, hit('hermit', 'enemy', 'mystic'));
  const previous = active(f); assert(previous.length > 0);
  f.positions.enemy = [280, 50]; f.effects.reflow();
  assert.equal(f.find('.gm-combat-projectile'), null);
  assert(previous.every(animation => animation.cancelled || animation.playState === 'finished'));
});

test('switching to compact speed cancels flights and later slow playback resumes on the same controller', f => {
  const row = { actorId: 'hermit', sourcePath: 'hermit', abilityId: 'mystic_orb', ability: 'Mystic Orb' };
  cast(f, row, hit('hermit', 'enemy', 'mystic'));
  const old = active(f); f.effects.pause(); f.effects.setSpeed(4);
  assert(old.every(animation => animation.cancelled));
  assert.equal(f.find('.gm-combat-projectile'), null);
  f.effects.setSpeed(1);
  cast(f, { ...row }, hit('hermit', 'enemy', 'mystic'));
  assert(active(f).length > 0); assert(active(f).every(animation => animation.playState === 'paused'));
  f.effects.resume(); assert(active(f).every(animation => animation.playState === 'running'));
});

test('reduced motion retains static impacts and support cues without travel or afterimages', f => {
  const row = { actorId: 'hermit', sourcePath: 'hermit', abilityId: 'mystic_orb', ability: 'Mystic Orb' };
  cast(f, row, hit('hermit', 'enemy', 'mystic'));
  assert.equal(f.find('.gm-combat-projectile'), null); assert.equal(f.find('.gm-combat-afterimage'), null);
  f.effects.show({ ...hit('hermit', 'enemy', 'mystic'), row }, 1, 450);
  assert(f.find('.gm-combat-impact')); assert.equal(f.animations.length, 0);
  f.effects.show({ type: 'heal', row, event: { actorId: 'hermit', targetId: 'fool', amount: 10 } }, 1, 400);
  assert(f.find('.gm-combat-heal')); assert.equal(f.animations.length, 0);
}, true);

test('4x keeps compact feedback without animated projectiles or an accumulating backlog', f => {
  const row = { actorId: 'hermit', sourcePath: 'hermit', abilityId: 'mystic_orb', ability: 'Mystic Orb' };
  for (let i = 0; i < 5; i++) {
    cast(f, { ...row }, hit('hermit', 'enemy', 'mystic'), 4);
    f.effects.show({ ...hit('hermit', 'enemy', 'mystic'), row }, 4, 450);
    assert.equal(f.find('.gm-combat-projectile'), null); assert.equal(f.find('.gm-combat-afterimage'), null);
    assert(f.find('.gm-combat-impact'));
    assert(f.all('.gm-combat-impact').length <= 1);
  }
  assert.equal(f.animations.length, 0);
});

test('missing actors, missing targets and a detached battlefield remain safe to clear', f => {
  cast(f, { actorId: 'missing', abilityId: 'unknown' }, hit('missing', 'none'));
  f.wrap.remove(); f.effects.pause(); f.effects.resume(); f.effects.setSpeed(2); f.effects.reflow(); f.effects.clear();
  assert.equal(f.all('.gm-combat-fx-layer').length, 0);
});

test('unsupported animation APIs keep support feedback and still allow complete cleanup', f => {
  delete f.w.Element.prototype.animate;
  const row = { actorId: 'hermit', abilityId: 'recovery', ability: 'Recovery' };
  cast(f, row, { type: 'heal', event: { actorId: 'hermit', targetId: 'fool', amount: 10 } });
  f.effects.show({ type: 'heal', row, event: { actorId: 'hermit', targetId: 'fool', amount: 10 } }, 1, 400);
  assert(f.find('.gm-combat-heal')); assert.equal(f.animations.length, 0);
  f.effects.pause(); f.effects.setSpeed(2); f.effects.resume(); f.effects.clear();
  assert.equal(f.all('.gm-combat-fx-layer').length, 0);
});

console.log(`\nProjectile and impact presentation: ${passed} passed, ${failed} failed.`);
if (failed) process.exitCode = 1;
