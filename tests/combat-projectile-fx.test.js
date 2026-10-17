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
  let now = 0, spriteSize = 64;
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
    const width = id ? spriteSize : 390, height = id ? spriteSize : 600;
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
  return { dom, w, wrap, effects, map, positions, animations, setNow: value => { now = value; }, setSpriteSize: value => { spriteSize = value; },
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

function pointFor(f, id, size = 64) {
  const [left, top] = f.positions[id];
  return { x: left + size / 2, y: top + size / 2 };
}
function approx(actual, expected, message, tolerance = .11) {
  assert(Math.abs(Number(actual) - expected) <= tolerance, `${message}: ${actual} versus ${expected}`);
}

test('gun basics fire a small rounded tracer from the forward hand in every aim direction', f => {
  for (const size of [64, 96]) for (const speed of [1, 2]) for (const targetPosition of [[10, 350], [270, 350], [110, 80], [110, 480]]) {
    f.setSpriteSize(size);
    const actorId = 'paragon', targetId = 'enemy';
    f.positions[targetId] = targetPosition;
    const row = { actorId, sourcePath: f.map[actorId].path, abilityId: 'basic_attack', attackKind: 'gun' };
    const projectile = cast(f, row, hit(actorId, targetId), speed, 600);
    const muzzle = f.find('.gm-combat-gun-muzzle');
    assert(projectile && muzzle, 'gun has a moving tracer and a stationary flash');
    assert.equal(projectile.dataset.family, 'bolt');
    assert.equal(projectile.dataset.pathKind, 'straight');
    assert(projectile.classList.contains('gm-combat-gun-tracer'), 'gun uses a dedicated rounded tracer rather than the generic bolt arrow');
    assert.equal(projectile.dataset.shape, 'bullet');
    assert(projectile.querySelector('rect[rx]'), 'the bullet uses rounded tracer geometry');
    assert.equal(projectile.querySelector('path'), null, 'gun shots do not reuse the generic arrow path');
    assert.equal(muzzle.querySelector('image'), null, 'a tiny procedural flash replaces the old large muzzle image');
    assert.equal(Number(muzzle.dataset.effectWidth), 24, 'flash stays 24px wide');
    assert.equal(Number(muzzle.dataset.effectHeight), 14, 'flash stays 14px high');
    assert(Number(projectile.dataset.size) <= 24, 'the tracer remains small relative to the 64px character');
    assert.equal(Number(projectile.dataset.effectWidth), 26, 'tracer length stays fixed on desktop');
    assert.equal(Number(projectile.dataset.effectHeight), 4, 'tracer thickness stays fixed on desktop');
    const from = pointFor(f, actorId, size), target = pointFor(f, targetId, size);
    const [left, top] = f.positions[actorId];
    const expectedHand = { x: left + size * (target.x < from.x ? .32 : .68), y: top + size * .55 };
    const angle = Math.atan2(target.y - expectedHand.y, target.x - expectedHand.x) * 180 / Math.PI;
    approx(projectile.dataset.angleDeg, angle, 'tracer faces its actual target');
    approx(muzzle.dataset.angleDeg, angle, 'muzzle faces its actual target');
    approx(projectile.dataset.startX, Number(muzzle.dataset.startX), 'tracer and flash share their launch x');
    approx(projectile.dataset.startY, Number(muzzle.dataset.startY), 'tracer and flash share their launch y');
    approx(muzzle.dataset.startX, expectedHand.x, 'flash is anchored to the forward hand, using the right hand for a vertical target');
    approx(muzzle.dataset.startY, expectedHand.y, 'flash uses the middle hand height rather than the head or sprite edge');
    const normalizedHeight = (Number(muzzle.dataset.startY) - top) / size;
    assert(normalizedHeight >= .45 && normalizedHeight <= .65, 'the muzzle remains within the character torso band');
    const flight = active(f).find(animation => animation.element === projectile);
    const flash = active(f).find(animation => animation.element === muzzle);
    assert(flight && flash, 'the tracer and flash share the replay animation clock');
    const delay = Number(projectile.dataset.travelDelayMs), duration = Number(projectile.dataset.travelMs);
    approx(delay + duration, 600, 'tracer reaches the next HP update');
    approx(muzzle.dataset.launchDelayMs, delay, 'muzzle fires when the tracer launches');
    approx(flight.timing.delay || 0, delay, 'flight waits through the cast windup');
    approx(flash.timing.delay || 0, delay, 'flash waits through the same cast windup');
    assert.equal(Number(flash.timing.duration), 140, 'muzzle is a brief flash');
    assert.equal(flight.playbackRate, speed, 'flight follows the selected battle speed');
    assert.equal(flash.playbackRate, speed, 'muzzle follows the same speed');
    for (const animation of [flight, flash]) {
      const translation = animation.keyframes[0].transform.match(/translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/);
      assert(translation, 'the visible cue starts at the declared muzzle position');
      approx(translation[1], Number(muzzle.dataset.startX), 'visible launch x follows the forward hand');
      approx(translation[2], Number(muzzle.dataset.startY), 'visible launch y follows the forward hand');
    }
    assert.equal(f.find('.gm-combat-punch-trail'), null);
    assert.equal(f.find('.gm-combat-ability-chip'), null, 'basic attacks do not show an ability chip');
    f.effects.clear(); f.effects.sync(f.map);
  }
});

test('physical unarmed basics use a bounded jab and retain their target punch artwork', f => {
  for (const size of [64, 96]) for (const speed of [1, 2]) {
    f.setSpriteSize(size);
    const row = { actorId: 'paragon', sourcePath: 'paragon', abilityId: 'basic_attack', attackKind: 'unarmed' };
    assert.equal(cast(f, row, hit('paragon'), speed, 600), null, 'physical punches do not fly across the field');
    const jab = f.find('.gm-combat-punch-trail');
    assert(jab, 'the attacker receives a short jab cue');
    assert.equal(Number(jab.getAttribute('stroke-width')), 3, 'jab is a thin strike cue');
    const coordinates = jab.getAttribute('d').match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi).map(Number);
    assert(coordinates.length >= 4 && coordinates.length % 2 === 0, 'jab uses inspectable vector geometry');
    const points = Array.from({ length: coordinates.length / 2 }, (_, index) => ({ x: coordinates[index * 2], y: coordinates[index * 2 + 1] }));
    const actor = pointFor(f, 'paragon', size);
    assert(points.every(point => Math.hypot(point.x - actor.x, point.y - actor.y) <= size / 2 + 24), 'the entire jab stays beside its attacker');
    const span = Math.hypot(points.at(-1).x - points[0].x, points.at(-1).y - points[0].y);
    assert(span >= 12 && span <= 24, 'the jab is approximately 18px long rather than a full-field sweep');
    const jabAnimation = active(f).find(animation => animation.element === jab);
    assert(jabAnimation && jabAnimation.timing.duration <= 600, 'jab stays inside the existing phase');
    assert.equal(jabAnimation.playbackRate, speed, 'jab follows battle playback speed');
    approx(Number(jabAnimation.timing.delay || 0) + Number(jabAnimation.timing.duration), 600, 'jab completes at the target impact boundary');
    assert.equal(f.find('.gm-combat-gun-muzzle'), null);
    f.effects.show({ type: 'damage', row, event: hit('paragon').event }, speed, 450);
    const punch = f.find('.gm-combat-punch-impact');
    assert(punch, 'the existing target punch artwork still lands with HP loss');
    assert.equal(punch.querySelector('image').getAttribute('href'), 'data/assets/effects/unarmed-punch-impact.png');
    assert.equal(Number(punch.dataset.effectHeight), size * 2, 'target impact remains 128px on phones and 192px on desktop');
    const punchAnimation = active(f).find(animation => animation.element === punch);
    assert(punchAnimation, 'the target punch artwork has its own replay animation');
    assert.equal(punchAnimation.playbackRate, speed, 'the target punch impact follows the selected battle speed');
    assert.equal(f.find('.gm-combat-punch-trail'), null, 'the short jab ends before the impact phase');
    f.effects.clear(); f.effects.sync(f.map);
  }
});

test('weapon launch cues wait for direct damage and survive intervening replay notes', f => {
  for (const attackKind of ['gun', 'unarmed']) {
    const row = { actorId: 'paragon', sourcePath: 'paragon', abilityId: 'basic_attack', attackKind };
    const note = { type: 'note', event: { type: 'note', actorId: 'paragon', text: 'A weapon effect is prepared.' } };
    cast(f, row, note, 1, 600);
    assert.equal(f.find('.gm-combat-gun-muzzle'), null, 'a note does not invent a muzzle flash');
    assert.equal(f.find('.gm-combat-punch-trail'), null, 'a note does not invent a punch swing');
    f.effects.show({ ...note, row, next: hit('paragon') }, 1, 180);
    assert(f.find(attackKind === 'gun' ? '.gm-combat-gun-muzzle' : '.gm-combat-punch-trail'), 'the actual pre-damage phase emits the matching cue');
    f.effects.show({ type: 'cast', row, next: { type: 'shield', event: { actorId: 'paragon', targetId: 'paragon', amount: 20 } } }, 1, 600);
    assert.equal(f.find('.gm-combat-gun-muzzle'), null, 'a shield phase never shoots a bullet');
    assert.equal(f.find('.gm-combat-punch-trail'), null, 'a shield phase never punches');
    f.effects.clear(); f.effects.sync(f.map);
  }
});

test('weapon basics retain a directional slash with a distinct target impact', f => {
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
  assert.equal(impactFlash.hasAttribute('data-hit-stop-ms'), false, 'the distinct landing effect adds no hit-stop');
  const flashAnimation = active(f).find(animation => animation.element.closest?.('.gm-combat-impact') === impactFlash);
  assert(flashAnimation, 'the landing flash is visual-only and animated in place');
  assert.equal(Number(flashAnimation.timing.duration), fx.impact.durationMs, 'impact stays within the existing effect timing');
  assert.equal(f.find('.gm-combat-ability-chip'), null, 'basics do not repeat weapon names above the sprite');
});

test('Sequence 9 active abilities have distinct cast and outcome visuals within their existing windows', f => {
  const damage = hit('paragon');
  const cases = [
    ['brutal_strike', 'physical', '.gm-combat-sword-slash-travel', 'data/assets/effects/sword-slash.png'],
    ['exploit_loophole', 'disorder', '.gm-combat-loophole-seal', 'data/assets/effects/exploit-loophole.png'],
    ['combat_theft', 'physical', '.gm-combat-theft-siphon', 'data/assets/effects/combat-theft.png']
  ];
  for (const [ability, type, selector, asset] of cases) {
    const row = { actorId: 'paragon', sourcePath: 'paragon', abilityId: ability, sourceAbilityId: ability };
    const next = hit('paragon', 'enemy', type);
    f.effects.show({ type: 'cast', row, next }, 1, 480);
    const effect = f.find(selector);
    assert(effect, ability + ' cast has a distinctive visual');
    assert.equal(effect.querySelector('image')?.getAttribute('href'), asset);
    assert.equal(Number(effect.dataset.effectHeight), 128, ability + ' artwork is 2x the 64px character height');
    const animation = active(f).find(item => item.element === effect);
    assert(animation, ability + ' effect animates within cast');
    assert(animation.timing.duration <= 480, ability + ' does not extend cast window');
    if (ability === 'combat_theft') assert.equal(effect.dataset.travelDirection, 'target-to-attacker');
    if (ability === 'brutal_strike') assert.equal(Number(effect.dataset.effectHeight), 128, 'Brutal Strike slash is 2x sprite height');
    f.effects.clear(); f.effects.sync(f.map);
  }
  const row = { actorId: 'paragon', sourcePath: 'paragon', abilityId: 'healing_touch', sourceAbilityId: 'healing_touch' };
  f.effects.show({ type: 'cast', row, next: { type: 'heal', event: { type: 'heal', actorId: 'paragon', targetId: 'fool', amount: 20 } } }, 1, 480);
  const flight = f.find('.gm-combat-healing-touch-flight');
  assert(flight, 'Healing Touch sends a distinctive effect toward its recipient');
  assert.equal(flight.dataset.targetId, 'fool');
  assert.equal(flight.querySelector('image')?.getAttribute('href'), 'data/assets/effects/healing-touch.png');
  assert.equal(Number(flight.dataset.effectHeight), 128, 'Healing Touch flight is 2x the character height');
  const flightAnimation = active(f).find(item => item.element === flight);
  assert(flightAnimation && flightAnimation.timing.duration <= 480, 'Healing Touch stays inside cast timing');
  f.effects.show({ type: 'heal', row, event: { type: 'heal', actorId: 'paragon', targetId: 'fool', amount: 20 } }, 1, 400);
  assert(f.find('.gm-combat-healing-touch-impact'), 'successful heal resolves with a matching recipient pulse');
  assert(f.find('.gm-combat-healing-touch-impact').dataset.targetId === 'fool');
  assert.equal(Number(f.find('.gm-combat-healing-touch-impact').dataset.effectHeight), 128, 'Healing Touch impact is 2x sprite height');
});

test('knife and sword weapon basics use the same directional slash artwork and scale', f => {
  for (const size of [64, 96]) {
    f.setSpriteSize(size);
    const results = [];
    for (const weapon of ['sword', 'knife']) {
      const row = { actorId: 'paragon', sourcePath: 'paragon', abilityId: 'basic_attack', attackKind: 'weapon', ability: weapon };
      cast(f, row, hit('paragon'), 1, 600);
      const slash = f.find('.gm-combat-sword-slash-travel');
      assert(slash, weapon + ' uses the shared directional weapon slash');
      const image = slash.querySelector('image');
      results.push({ src: image.getAttribute('href'), width: image.getAttribute('width'), height: image.getAttribute('height'), transform: image.getAttribute('transform') });
      assert.equal(Number(image.getAttribute('height')), size * 2);
      assert.equal(f.find('.gm-combat-punch-trail'), null);
      assert.equal(f.find('.gm-combat-gun-muzzle'), null);
      f.effects.clear(); f.effects.sync(f.map);
    }
    assert.deepEqual(results[0], results[1], 'blade names do not change the shared weapon cue');
  }
});

test('critical punch feedback remains visible above the existing punch artwork', f => {
  const row = { actorId: 'paragon', sourcePath: 'paragon', abilityId: 'basic_attack', attackKind: 'unarmed' };
  f.effects.show({ ...hit('paragon', 'enemy', 'physical', { critical: true }), row }, 1, 450);
  const punch = f.find('.gm-combat-punch-impact'), burst = f.find('.gm-combat-impact');
  assert(punch && burst);
  assert(burst.compareDocumentPosition(punch) & f.w.Node.DOCUMENT_POSITION_PRECEDING,
    'the broad punch image must not cover the stepped critical burst');
  assert.equal(burst.dataset.critical, 'true');
  assert(burst.getAttribute('style').includes(fx.impact.critColor));
  assert(Number(burst.dataset.impactScale) > 1);
});

test('gun and fist cues are restricted to basic attacks, including when an active row carries attackKind', f => {
  for (const attackKind of ['gun', 'unarmed']) {
    for (const abilityId of ['mystic_orb', 'brutal_strike', 'healing_touch', 'exploit_loophole', 'combat_theft']) {
      const row = { actorId: 'paragon', sourcePath: 'paragon', abilityId, sourceAbilityId: abilityId, attackKind };
      const next = abilityId === 'healing_touch'
        ? { type: 'heal', event: { type: 'heal', actorId: 'paragon', targetId: 'fool', amount: 20 } }
        : hit('paragon');
      cast(f, row, next, 1, 600);
      assert.equal(f.find('.gm-combat-gun-muzzle'), null, abilityId + ' is not a gun basic');
      assert.equal(f.find('.gm-combat-gun-tracer'), null, abilityId + ' does not borrow the gun basic tracer');
      assert.equal(f.find('.gm-combat-punch-trail'), null, abilityId + ' is not a fist basic');
      f.effects.show({ ...next, row }, 1, 450);
      assert.equal(f.find('.gm-combat-punch-impact'), null, abilityId + ' does not borrow the unarmed basic impact');
      f.effects.clear(); f.effects.sync(f.map);
    }
  }
});

test('unarmed caster basics use the same short jab and punch impact as other unarmed characters', f => {
  for (const damageType of ['physical', 'mystic']) {
    const row = { actorId: 'hermit', sourcePath: 'hermit', abilityId: 'basic_attack', attackKind: 'unarmed' };
    assert.equal(cast(f, row, hit('hermit', 'enemy', damageType)), null, 'a caster without a weapon punches instead of shooting magic');
    const jab = f.find('.gm-combat-punch-trail');
    assert(jab, 'caster unarmed attacks have a short jab');
    assert.equal(Number(jab.getAttribute('stroke-width')), 3);
    assert.equal(Number(jab.dataset.length), 18);
    f.effects.show({ type: 'damage', row, event: hit('hermit', 'enemy', damageType).event }, 1, 450);
    assert(f.find('.gm-combat-punch-impact'), 'caster unarmed attacks retain the target punch artwork');
    assert.equal(f.find('.gm-combat-projectile'), null);
    f.effects.clear(); f.effects.sync(f.map);
  }
});

test('explicit magic basics use pathway magic, retaining damage type color', f => {
  const projectile = cast(f, { actorId: 'hermit', sourcePath: 'hermit', abilityId: 'basic_attack', attackKind: 'magic' }, hit('hermit', 'enemy', 'mystic'));
  assert.equal(projectile.dataset.family, fx.basicAttack.pathways.hermit);
  assert.equal(projectile.dataset.damageType, 'mystic');
  assert.equal(Number(projectile.dataset.effectHeight), 128, 'spell projectile scales to 2x sprite height');
  assert(projectile.getAttribute('style')?.includes(fx.damageColors.mystic) || projectile.outerHTML.includes(fx.damageColors.mystic));
});

test('explicit magic basics retain magical arcs and trails even when their recorded damage is physical', f => {
  const row = { actorId: 'hermit', sourcePath: 'hermit', abilityId: 'basic_attack', attackKind: 'magic' };
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

test('all eight projectile families are normalized to the sword-slash 2x height', f => {
  const cases = [
    ['slash', 'moon', 'physical', false, 20],
    ['bolt', 'tyrant', 'fire', false, 24],
    ['beam', 'sun', 'holy', false, 40],
    ['orb', 'hermit', 'mystic', false, 16],
    ['shard', 'justiciar', 'piercing', false, 19],
    ['wisp', 'chained', 'corrosion', false, 19],
    ['thread', 'fool', 'nature', false, 24],
    ['wave', 'tyrant', 'fire', true, 20]
  ];
  for (const [family, sourcePath, damageType, area, extent] of cases) {
    const row = { actorId: 'paragon', sourcePath, abilityId: 'area_test', presentationTargetMode: area ? 'all_enemies' : undefined };
    const event = { ...hit('paragon', 'enemy', damageType).event, area };
    const projectile = cast(f, row, { type: 'damage', event });
    assert(projectile, family + ' projectile is rendered');
    assert.equal(projectile.dataset.family, family, family + ' selects the expected visual family');
    assert.equal(Number(projectile.dataset.effectHeight), 128, family + ' uses twice the 64px sprite height');
    assert(Math.abs(Number(projectile.dataset.size) * extent / 20 - 128) < .1,
      family + ' scales its longest base-geometry dimension to 128px');
    f.effects.clear(); f.effects.sync(f.map);
  }
});

test('green enemy attack projectiles follow their damage type and use the shared 2x scale', f => {
  const projectile = cast(f, { actorId: 'enemy', sourcePath: 'chained', abilityId: 'venom_strike' }, hit('enemy', 'paragon', 'corrosion'));
  assert.equal(projectile.dataset.damageType, 'corrosion');
  assert.equal(projectile.dataset.family, 'wisp');
  assert.equal(Number(projectile.dataset.effectHeight), 128, 'enemy projectile is 2x the 64px sprite height');
  assert(projectile.getAttribute('style')?.includes(fx.damageColors.corrosion), 'the green color identifies corrosion damage');
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

test('impact feedback has four stepped pixel frames and larger orange crits without added time', f => {
  const row = { actorId: 'paragon', sourcePath: 'paragon', abilityId: 'shot' };
  f.effects.show({ ...hit(), row }, 1, 450);
  const normal = f.find('.gm-combat-impact');
  assert(normal); assert.equal(normal.querySelectorAll('.gm-combat-impact-frame').length, 4);
  const normalScale = Number(normal.dataset.impactScale || 1);
  assert.equal(normal.hasAttribute('data-hit-stop-ms'), false);
  assert(normal.getAttribute('style').includes(fx.damageColors.physical));
  const normalFrames = active(f).filter(animation => animation.element.closest?.('.gm-combat-impact') === normal);
  assert(normalFrames.every(animation => Number(animation.timing.duration) === fx.impact.durationMs));
  f.effects.show({ ...hit('paragon', 'enemy', 'physical', { critical: true }), row }, 1, 450);
  const critical = f.find('.gm-combat-impact');
  assert.equal(critical.dataset.critical, 'true');
  assert(Number(critical.dataset.impactScale) > normalScale);
  assert.equal(critical.hasAttribute('data-hit-stop-ms'), false);
  assert(critical.getAttribute('style').includes(fx.impact.critColor || '#ffa64d'));
  const frameAnimations = active(f).filter(animation => animation.element.closest?.('.gm-combat-impact') === critical);
  assert(frameAnimations.length >= 4, 'each stepped frame is represented in the visible burst');
  assert(frameAnimations.every(animation => Number(animation.timing.duration) === fx.impact.durationMs));
  for (const [index, animation] of frameAnimations.entries()) {
    assert.deepEqual(animation.keyframes, normalFrames[index].keyframes, 'critical frames follow the same impact rhythm');
    assert.equal(animation.timing.easing, 'linear', 'the overall clock must reach intermediate pixel frames');
    assert(animation.keyframes.every(key => key.easing === 'steps(1,end)'), 'pixel opacity steps belong to individual keyframe segments');
  }
});

test('sword slash and critical number styles preserve mobile readability and draw damage over effects', f => {
  const css = fs.readFileSync(path.join(root, 'css/components/dungeon-arena.css'), 'utf8');
  assert.match(css, /\.gm-combat-fx-layer\s*\{[^}]*z-index:\s*4/s);
  assert.match(css, /\.gm-battle-fx-layer\s*\{[^}]*z-index:\s*5/s);
  assert.match(css, /\.gm-battle-fx-number-critical\s*\{[^}]*font-size:\s*calc\(13px\s*\*\s*var\(--gm-fx-number-scale,\s*1\.25\)\)/s);
  assert.match(css, /@media \(max-width:\s*560px\)[\s\S]*?\.gm-battle-fx-number-critical\s*\{[^}]*font-size:\s*calc\(12px\s*\*\s*var\(--gm-fx-number-scale,\s*1\.25\)\)/s);
  assert.match(css, /\.gm-combat-sword-slash-image,\s*\.gm-combat-sword-slash-projectile\s*\{[^}]*transform-origin:\s*center/s);
  assert.match(css, /\.gm-unit-sprite-anchor\.gm-cue-actor\s*\{[^}]*#ffd078/s, 'attacker cue is gold and distinct from the red target cue');
  assert.match(css, /\.gm-unit-sprite-anchor\.gm-cue-damage\s*\{[^}]*#f39991/s, 'target damage cue remains red');
});

test('criticals keep normal impact timing at Read, 1x, 2x and 4x speeds', f => {
  const row = { actorId: 'paragon', sourcePath: 'paragon', abilityId: 'shot' };
  for (const speed of [.5, 1, 2, 4]) {
    const timings = [];
    for (const critical of [false, true]) {
      f.effects.show({ ...hit('paragon', 'enemy', 'physical', { critical }), row }, speed, 450);
      const burst = f.find('.gm-combat-impact');
      const frames = active(f).filter(animation => animation.element.closest?.('.gm-combat-impact') === burst);
      assert.equal(frames.length, speed === 4 ? 0 : fx.impact.frames);
      assert.equal(Number(burst.dataset.impactScale), critical ? fx.impact.critScale : 1);
      assert.equal(burst.hasAttribute('data-hit-stop-ms'), false);
      timings.push(frames.map(animation => [animation.timing.duration, animation.timing.delay, animation.playbackRate]));
      for (const animation of frames) assert.equal(animation.playbackRate, speed);
      if (speed === 4) assert.equal(burst.querySelector('.gm-combat-impact-frame:last-child').getAttribute('opacity'), '1');
    }
    assert.deepEqual(timings[0], timings[1], `critical timing matches normal timing at ${speed}x`);
  }
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
