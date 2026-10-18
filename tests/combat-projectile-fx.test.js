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
function cast(f, row, next = hit(row.actorId), speed = 1, hold = 300) {
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

function clippedReveal(f, node) {
  const id = node?.getAttribute('clip-path')?.match(/#([^)]*)/)?.[1];
  const reveal = id && f.wrap.querySelector(`#${id} rect`);
  return { reveal, animation: active(f).find(item => item.element === reveal) };
}
function assertMuzzlePng(muzzle) {
  assert(muzzle, 'gun has a muzzle flash');
  const artwork = muzzle.querySelector('image.gm-combat-gun-muzzle-image');
  assert(artwork, 'the muzzle uses the existing PNG artwork');
  assert.equal(muzzle.querySelectorAll('image').length, 1, 'one image supplies the flash');
  assert.equal(muzzle.querySelector('path, polygon'), null, 'the old procedural flash is removed');
  const src = 'data/assets/effects/gun-muzzle.png';
  assert.match(artwork.getAttribute('href'), /^data\/assets\/effects\/gun-muzzle\.png\?v=[a-f0-9]+$/);
  assert.equal(muzzle.dataset.effectSrc, artwork.getAttribute('href'));
  const png = fs.readFileSync(path.join(root, src));
  const sourceWidth = png.readUInt32BE(16), sourceHeight = png.readUInt32BE(20);
  assert.equal(sourceWidth, 979); assert.equal(sourceHeight, 547, 'the authored flash is cropped without redrawing');
  const width = Number(artwork.getAttribute('width')), height = Number(artwork.getAttribute('height'));
  assert.equal(width, 288, 'the transparent artwork canvas keeps its established fixed width');
  approx(height, sourceHeight * width / sourceWidth, 'the PNG retains its source proportions', .001);
  approx(muzzle.dataset.effectWidth, width, 'declared flash width matches the artwork');
  approx(muzzle.dataset.effectHeight, height, 'declared flash height matches the artwork');
  assert.equal(artwork.getAttribute('preserveAspectRatio'), 'xMidYMid meet');
  approx(Number(artwork.getAttribute('x')) + 105 * width / sourceWidth, 0, 'the cropped source ignition x is anchored at the firing hand', .001);
  approx(Number(artwork.getAttribute('y')) + 274 * height / sourceHeight, 0, 'the cropped source ignition y is anchored at the firing hand', .001);
  assert.equal(artwork.getAttribute('transform'), 'rotate(180)', 'the source burst points forward from its ignition point');
  return artwork;
}

test('gun basics fire a thin straight tracer from the forward hand within the 300ms cast', f => {
  for (const size of [64, 96]) for (const speed of [1, 2]) for (const targetPosition of [[10, 350], [270, 350], [110, 80], [110, 480]]) {
    f.setSpriteSize(size);
    const actorId = 'paragon', targetId = 'enemy';
    f.positions[targetId] = targetPosition;
    const row = { actorId, sourcePath: f.map[actorId].path, abilityId: 'basic_attack', attackKind: 'gun' };
    const projectile = cast(f, row, hit(actorId, targetId), speed, 300);
    const muzzle = f.find('.gm-combat-gun-muzzle');
    assert(projectile && muzzle, 'gun has a revealing straight tracer and a stationary flash');
    assert(projectile.classList.contains('gm-combat-gun-shot-line'), 'gun uses its dedicated thin tracer');
    assert.equal(projectile.querySelector('path, polygon'), null, 'gunfire never uses the generic arrow shape');
    const line = projectile.querySelector('line');
    assert(line, 'gunfire uses straight line geometry');
    assert.equal(line.getAttribute('y1'), '0'); assert.equal(line.getAttribute('y2'), '0');
    assert.equal(Number(line.getAttribute('stroke-width')), 1.5, 'small gun sparks stay independent of character scale');
    assertMuzzlePng(muzzle);
    const from = pointFor(f, actorId, size), target = pointFor(f, targetId, size);
    const [left, top] = f.positions[actorId];
    const expectedHand = { x: left + size * (target.x < from.x ? .32 : .68), y: top + size * .55 };
    const angle = Math.atan2(target.y - expectedHand.y, target.x - expectedHand.x) * 180 / Math.PI;
    approx(muzzle.dataset.angleDeg, angle, 'muzzle faces its actual target');
    assert.match(projectile.getAttribute('transform'), new RegExp(`rotate\\(${angle}\\)`), 'the tracer points from the same hand toward its target');
    approx(projectile.dataset.startX, Number(muzzle.dataset.startX), 'tracer and flash share their launch x');
    approx(projectile.dataset.startY, Number(muzzle.dataset.startY), 'tracer and flash share their launch y');
    approx(muzzle.dataset.startX, expectedHand.x, 'flash is anchored to the forward hand');
    approx(muzzle.dataset.startY, expectedHand.y, 'flash uses the torso hand height');
    const { animation: flight } = clippedReveal(f, projectile);
    const flash = active(f).find(animation => animation.element === muzzle);
    assert(flight && flash, 'the tracer and flash share the replay animation clock');
    const shotDelay = Number(muzzle.dataset.launchDelayMs), flashDuration = Number(flash.timing.duration);
    const revealDelay = Number(flight.timing.delay), revealDuration = Number(flight.timing.duration);
    assert.equal(shotDelay, 120, 'the 300ms cast retains its short anticipation');
    assert.equal(flashDuration, 90, 'the muzzle uses its current brief flash');
    assert.equal(revealDelay, shotDelay + flashDuration, 'the tracer follows the muzzle flash');
    assert.equal(revealDuration, 70, 'the straight shot remains snappy');
    assert(revealDelay + revealDuration <= 300, 'the complete gun cue fits before the HP boundary');
    assert.equal(flight.playbackRate, speed); assert.equal(flash.playbackRate, speed);
    const translation = flash.keyframes[0].transform.match(/translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/);
    assert(translation, 'the flash starts at the declared muzzle position');
    approx(translation[1], Number(muzzle.dataset.startX), 'visible launch x follows the hand');
    approx(translation[2], Number(muzzle.dataset.startY), 'visible launch y follows the hand');
    assert.equal(f.find('.gm-combat-punch-trail'), null);
    assert.equal(f.find('.gm-combat-ability-chip'), null, 'basic attacks do not show an ability chip');
    f.effects.clear(); f.effects.sync(f.map);
  }
});

test('unarmed basics retain a thin punch cue and the authored target punch within playback windows', f => {
  for (const size of [64, 96]) for (const speed of [1, 2]) {
    f.setSpriteSize(size);
    const row = { actorId: 'paragon', sourcePath: 'paragon', abilityId: 'basic_attack', attackKind: 'unarmed' };
    const jab = cast(f, row, hit('paragon'), speed, 300);
    assert(jab?.classList.contains('gm-combat-punch-trail'), 'unarmed basics use their own punch cue');
    assert.equal(f.find('.gm-combat-projectile:not(.gm-combat-punch-trail)'), null, 'unarmed basics never borrow a magic projectile');
    const line = jab.querySelector('line'); assert(line);
    assert.equal(Number(line.getAttribute('stroke-width')), Math.max(1.5, Math.min(2.5, size * .022)));
    assert.equal(Number(jab.dataset.referenceHeight), size * 2, 'the cue retains its sword-scale reference');
    const { animation } = clippedReveal(f, jab); assert(animation);
    assert.equal(Number(animation.timing.delay), 120);
    assert.equal(Number(animation.timing.duration), 96);
    assert(Number(animation.timing.delay) + Number(animation.timing.duration) <= 300);
    assert.equal(animation.playbackRate, speed);
    assert.equal(f.find('.gm-combat-gun-muzzle'), null);
    f.effects.show({ type: 'damage', row, event: hit('paragon').event }, speed, 450);
    const punch = f.find('.gm-combat-impact[data-punch-burst="true"]');
    assert(punch, 'the existing target punch artwork lands with HP loss');
    const artwork = punch.querySelector('.gm-combat-impact-image-punch'); assert(artwork);
    assert.match(artwork.getAttribute('href'), /^data\/assets\/effects\/unarmed-punch-impact\.png\?v=[a-f0-9]+$/);
    const height = Math.max(120, Math.min(210, size * 1.5));
    assert.equal(Number(artwork.getAttribute('height')), height, 'the established punch image keeps its height');
    approx(artwork.getAttribute('width'), height * 880 / 929, 'the original punch retains its proportions');
    const punchAnimation = active(f).find(item => item.element === artwork); assert(punchAnimation);
    assert.equal(punchAnimation.playbackRate, speed);
    assert(Number(punchAnimation.timing.duration) <= 450, 'the complete contact effect fits the outcome phase');
    assert.equal(f.find('.gm-combat-punch-trail'), null, 'the approach cue clears before contact');
    f.effects.clear(); f.effects.sync(f.map);
  }
});

test('gun, unarmed and sword cues remain readable within the same basic playback window', f => {
  for (const size of [64, 96]) for (const speed of [1, 2]) {
    f.setSpriteSize(size);
    for (const attackKind of ['weapon', 'gun', 'unarmed']) {
      const row = { actorId: 'paragon', sourcePath: 'paragon', abilityId: 'basic_attack', attackKind };
      cast(f, row, hit('paragon'), speed, 300);
      const main = f.find(attackKind === 'gun' ? '.gm-combat-gun-shot-line' : attackKind === 'unarmed' ? '.gm-combat-punch-trail' : '.gm-combat-sword-slash-travel');
      assert(main, attackKind + ' has a distinct main attack cue');
      const animation = attackKind === 'weapon' ? active(f).find(item => item.element === main) : clippedReveal(f, main).animation;
      assert(animation, attackKind + ' follows the replay clock');
      assert(Number(animation.timing.delay || 0) + Number(animation.timing.duration) <= 300, attackKind + ' completes within the approved 300ms basic cast');
      assert.equal(animation.playbackRate, speed);
      if (attackKind === 'weapon') assert.equal(Number(main.dataset.effectHeight), size * 2, 'sword art retains its established scale');
      if (attackKind === 'gun') assertMuzzlePng(f.find('.gm-combat-gun-muzzle'));
      f.effects.clear(); f.effects.sync(f.map);
    }
  }
});

test('basic misses animate the attack attempt but never a successful impact', f => {
  const initial = JSON.stringify(f.map);
  for (const speed of [1, 2]) for (const attackKind of ['gun', 'weapon', 'unarmed']) {
    const row = { actorId: 'paragon', sourcePath: 'paragon', abilityId: 'basic_attack', attackKind };
    const miss = { type: 'note', event: { type: 'miss', actorId: 'paragon', targetId: 'enemy', reason: 'evade', text: 'The target dodges.' } };
    cast(f, row, miss, speed, 300);
    const attempt = f.find(attackKind === 'gun' ? '.gm-combat-gun-shot-line' : attackKind === 'weapon' ? '.gm-combat-sword-slash-travel' : '.gm-combat-punch-trail');
    assert(attempt, attackKind + ' misses retain their normal attack attempt');
    if (attackKind === 'gun') assert(f.find('.gm-combat-gun-muzzle'), 'a missed shot still fires at the hand');
    const animation = attackKind === 'weapon' ? active(f).find(item => item.element === attempt) : clippedReveal(f, attempt).animation;
    assert(animation);
    assert(Number(animation.timing.delay || 0) + Number(animation.timing.duration) <= 300, 'a missed attempt fits the same cast window');
    assert.equal(animation.playbackRate, speed);
    f.effects.show({ ...miss, row }, speed, 450);
    assert.equal(f.find('.gm-combat-impact'), null, 'a miss has no successful impact');
    assert.equal(f.find('.gm-combat-impact-image-punch'), null, 'a missed punch has no contact artwork');
    assert.equal(f.find('.gm-combat-gun-shot-line'), null, 'the prior attempt ends with the miss phase');
    assert.equal(JSON.stringify(f.map), initial, 'attempt effects never alter combat HP or state');
    f.effects.clear(); f.effects.sync(f.map);
  }
  const activeRow = { actorId: 'paragon', sourcePath: 'paragon', abilityId: 'precision_shot', attackKind: 'gun' };
  const miss = { type: 'note', event: { type: 'miss', actorId: 'paragon', targetId: 'enemy' } };
  cast(f, activeRow, miss);
  assert.equal(f.find('.gm-combat-gun-shot-line'), null, 'active misses do not borrow basic weapon animations');
  assert.equal(f.find('.gm-combat-gun-muzzle'), null);
});

test('weapon launch cues wait for direct damage and survive intervening replay notes', f => {
  for (const attackKind of ['gun', 'unarmed']) {
    const row = { actorId: 'paragon', sourcePath: 'paragon', abilityId: 'basic_attack', attackKind };
    const note = { type: 'note', event: { type: 'note', actorId: 'paragon', text: 'A weapon effect is prepared.' } };
    cast(f, row, note, 1, 300);
    assert.equal(f.find('.gm-combat-gun-muzzle'), null, 'a note does not invent a muzzle flash');
    assert.equal(f.find('.gm-combat-punch-trail'), null, 'a note does not invent a punch swing');
    f.effects.show({ ...note, row, next: hit('paragon') }, 1, 180);
    assert(f.find(attackKind === 'gun' ? '.gm-combat-gun-muzzle' : '.gm-combat-punch-trail'), 'the actual pre-damage phase emits the matching cue');
    f.effects.show({ type: 'cast', row, next: { type: 'shield', event: { actorId: 'paragon', targetId: 'paragon', amount: 20 } } }, 1, 300);
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
    ['brutal_strike', 'physical', '.gm-combat-brutal-strike-travel', 'data/assets/effects/brutal-strike.png'],
    ['exploit_loophole', 'disorder', '.gm-combat-loophole-seal', 'data/assets/effects/exploit-loophole.png'],
    ['combat_theft', 'physical', '.gm-combat-theft-siphon', 'data/assets/effects/combat-theft.png']
  ];
  for (const [ability, type, selector, asset] of cases) {
    const row = { actorId: 'paragon', sourcePath: 'paragon', abilityId: ability, sourceAbilityId: ability };
    const next = hit('paragon', 'enemy', type);
    const hold = ability === 'brutal_strike' ? 300 : 800;
    f.effects.show({ type: 'cast', row, next }, 1, hold);
    const effect = f.find(selector);
    assert(effect, ability + ' cast has a distinctive visual');
    assert.equal(effect.querySelector('image')?.getAttribute('href'), asset);
    if (ability === 'combat_theft') {
      const actor = pointFor(f, row.actorId), target = pointFor(f, next.event.targetId);
      const width = Math.max(Math.hypot(target.x - actor.x, target.y - actor.y), 120);
      approx(effect.dataset.effectHeight, width * 768 / 1376, 'the theft tether spans caster to victim using its original proportions');
    } else assert.equal(Number(effect.dataset.effectHeight), 128, ability + ' retains its character-relative reference height');
    const animations = active(f).filter(item => item.element === effect || effect.contains(item.element));
    assert(animations.length, ability + ' artwork animates within cast');
    assert(animations.every(item => Number(item.timing.delay || 0) + Number(item.timing.duration) <= hold), ability + ' finishes every artwork layer within its approved cast window');
    if (ability === 'combat_theft') assert.equal(effect.dataset.travelDirection, 'attacker-to-target', 'the dark caster vortex and runic victim ends keep their authored alignment');
    if (ability === 'brutal_strike') {
      assert.equal(Number(effect.dataset.effectHeight), 128, 'Brutal Strike slash is 2x sprite height');
      assert(effect.classList.contains('gm-combat-brutal-strike-travel'), 'Abyss gets its sequence-specific travel treatment');
      assert(effect.querySelector('.gm-combat-brutal-strike-projectile'), 'Abyss uses its authored crimson slash PNG');
    }
    f.effects.clear(); f.effects.sync(f.map);
  }
  const brutalRow = { actorId: 'paragon', sourcePath: 'abyss', abilityId: 'brutal_strike', sourceAbilityId: 'brutal_strike' };
  f.effects.show({ ...hit('paragon', 'enemy'), row: brutalRow }, 1, 480);
  assert.equal(f.find('.gm-combat-impact')?.dataset.brutalStrike, 'true', 'Brutal Strike impact is marked distinctly');
  assert(f.find('.gm-combat-brutal-strike-impact-slash'), 'Brutal Strike impact uses its authored crimson slash');
  f.effects.clear(); f.effects.sync(f.map);
  const row = { actorId: 'paragon', sourcePath: 'paragon', abilityId: 'healing_touch', sourceAbilityId: 'healing_touch' };
  f.effects.show({ type: 'cast', row, next: { type: 'heal', event: { type: 'heal', actorId: 'paragon', targetId: 'fool', amount: 20 } } }, 1, 800);
  const flight = f.find('.gm-combat-healing-touch-flight');
  assert(flight, 'Healing Touch sends a distinctive effect toward its recipient');
  assert.equal(flight.dataset.targetId, 'fool');
  assert.equal(flight.querySelector('image')?.getAttribute('href'), 'data/assets/effects/healing-touch.png');
  const healer = pointFor(f, 'paragon'), recipient = pointFor(f, 'fool');
  const streamWidth = Math.max(Math.hypot(recipient.x - healer.x, recipient.y - healer.y), 140);
  approx(flight.dataset.effectHeight, streamWidth * 768 / 1376, 'Healing Touch spans the actual ally distance without distorting its artwork');
  const flightAnimation = active(f).find(item => item.element === flight);
  assert(flightAnimation && flightAnimation.timing.duration <= 800, 'Healing Touch stays inside cast timing');
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
      cast(f, row, hit('paragon'), 1, 300);
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

test('critical punches preserve the normal punch artwork without adding effect emphasis', f => {
  const row = { actorId: 'paragon', sourcePath: 'paragon', abilityId: 'basic_attack', attackKind: 'unarmed' };
  f.effects.show({ ...hit('paragon', 'enemy', 'physical'), row }, 1, 450);
  const normal = f.find('.gm-combat-impact'); assert(normal);
  const normalScale = Number(normal.dataset.impactScale), normalStyle = normal.getAttribute('style');
  const artwork = normal.querySelector('.gm-combat-impact-image-punch')?.outerHTML;
  assert(artwork, 'the normal punch uses the authored impact image');
  f.effects.show({ ...hit('paragon', 'enemy', 'physical', { critical: true }), row }, 1, 450);
  const burst = f.find('.gm-combat-impact'); assert(burst);
  assert.equal(burst.dataset.critical, 'true');
  assert.equal(burst.getAttribute('style'), normalStyle, 'criticals retain the normal punch palette');
  assert.equal(Number(burst.dataset.impactScale), normalScale);
  assert.equal(burst.querySelector('.gm-combat-impact-image-punch')?.outerHTML, artwork);
});

test('gun and fist cues are restricted to basic attacks, including when an active row carries attackKind', f => {
  for (const attackKind of ['gun', 'unarmed']) {
    for (const abilityId of ['mystic_orb', 'brutal_strike', 'healing_touch', 'exploit_loophole', 'combat_theft']) {
      const row = { actorId: 'paragon', sourcePath: 'paragon', abilityId, sourceAbilityId: abilityId, attackKind };
      const next = abilityId === 'healing_touch'
        ? { type: 'heal', event: { type: 'heal', actorId: 'paragon', targetId: 'fool', amount: 20 } }
        : hit('paragon');
      cast(f, row, next, 1, 300);
      assert.equal(f.find('.gm-combat-gun-muzzle'), null, abilityId + ' is not a gun basic');
      assert.equal(f.find('.gm-combat-gun-shot-line'), null, abilityId + ' does not borrow the gun basic tracer');
      assert.equal(f.find('.gm-combat-punch-trail'), null, abilityId + ' is not a fist basic');
      f.effects.show({ ...next, row }, 1, 450);
      assert.equal(f.find('.gm-combat-impact-image-punch'), null, abilityId + ' does not borrow the unarmed basic impact');
      f.effects.clear(); f.effects.sync(f.map);
    }
  }
});

test('unarmed caster basics retain the same punch cue and impact as other unarmed characters', f => {
  for (const damageType of ['physical', 'mystic']) {
    const row = { actorId: 'hermit', sourcePath: 'hermit', abilityId: 'basic_attack', attackKind: 'unarmed' };
    const jab = cast(f, row, hit('hermit', 'enemy', damageType));
    assert(jab?.classList.contains('gm-combat-punch-trail'), 'casters with bare hands use a punch cue');
    assert.equal(f.find('.gm-combat-projectile:not(.gm-combat-punch-trail)'), null, 'caster unarmed basics do not become magic projectiles');
    assert.equal(Number(jab.querySelector('line').getAttribute('stroke-width')), 1.5);
    assert(clippedReveal(f, jab).animation, 'caster punches use the shared replay clock');
    f.effects.show({ type: 'damage', row, event: hit('hermit', 'enemy', damageType).event }, 1, 450);
    assert(f.find('.gm-combat-impact-image-punch'), 'caster punches retain the authored target artwork');
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
  assert(gun.classList.contains('gm-combat-gun-shot-line'));
  assert(gun.querySelector('line'));
  assert.equal(gun.querySelector('path, polygon'), null, 'guns retain a thin straight tracer rather than a magic arrow');
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

test('physical ability projectiles are straight while spell paths curve with afterimages', f => {
  const shot = cast(f, { actorId: 'paragon', sourcePath: 'paragon', abilityId: 'precision_shot' });
  const shotDuration = Number(shot.dataset.travelMs);
  assert.equal(shot.dataset.pathKind, 'straight');
  const spell = cast(f, { actorId: 'hermit', sourcePath: 'hermit', abilityId: 'mystic_orb' }, hit('hermit', 'enemy', 'mystic'));
  assert.equal(spell.dataset.pathKind, 'arc');
  assert(Number(spell.dataset.travelMs) >= shotDuration);
  assert(f.all('.gm-combat-afterimage').length >= 2, 'spells leave a fading trail');
  const movement = active(f).find(animation => animation.element === spell);
  assert(movement.keyframes.length >= 3, 'the spell has a curved intermediate travel point');
});

test('impact feedback preserves all four normal pixel frames for critical hits without added time', f => {
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
  assert.equal(Number(critical.dataset.impactScale), normalScale);
  assert.equal(critical.hasAttribute('data-hit-stop-ms'), false);
  assert.equal(critical.getAttribute('style'), normal.getAttribute('style'), 'criticals keep the normal effect color');
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
      assert.equal(Number(burst.dataset.impactScale), 1, 'critical effects keep the normal impact scale');
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
  const firstImpact = f.find('.gm-combat-impact');
  f.effects.show({ ...second, row }, 1, 450);
  const impact = f.find('.gm-combat-impact');
  assert(!firstImpact.isConnected, 'the first burst clears before the second recorded hit');
  assert.notEqual(impact, firstImpact);
  assert.equal(impact.dataset.ownerId, second.event.actorId);
  assert.equal(impact.dataset.targetId, second.event.targetId);
  assert.equal(row.timeline[1].event, second.event, 'the second recorded hit owns the current burst');
  const sparks = active(f).filter(animation => animation.element.closest?.('.gm-combat-impact') === impact);
  const staggered = sparks.filter(animation => animation.element.tagName.toLowerCase() === 'rect');
  assert.deepEqual(staggered.map(animation => Number(animation.timing.delay)), [0, 35, 70], 'three secondary sparks stagger on the second recorded hit');
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

test('the PNG muzzle pauses and changes speed with its shot, then clears with the phase', f => {
  const row = { actorId: 'paragon', sourcePath: 'paragon', abilityId: 'basic_attack', attackKind: 'gun' };
  cast(f, row, hit('paragon'), 1, 300);
  const muzzle = f.find('.gm-combat-gun-muzzle'), artwork = assertMuzzlePng(muzzle);
  const flash = active(f).find(animation => animation.element === muzzle);
  assert(flash, 'PNG flash is animated on the replay clock');
  f.effects.pause();
  assert.equal(flash.playState, 'paused');
  assert.equal(f.find('.gm-combat-gun-muzzle-image'), artwork, 'pausing preserves the same loaded image');
  f.effects.setSpeed(2);
  assert.equal(flash.playbackRate, 2, 'flash follows the selected replay speed');
  assert.equal(Number(flash.timing.duration), 90, 'speed does not rewrite the unscaled flash duration');
  f.effects.resume();
  assert.equal(flash.playState, 'running');
  f.effects.show({ ...hit('paragon'), row }, 2, 450);
  assert(flash.cancelled, 'the following impact cancels the earlier flash animation');
  assert.equal(f.find('.gm-combat-gun-muzzle'), null);
  f.effects.clear();
  assert.equal(f.all('.gm-combat-fx-layer').length, 0);
});

test('reduced motion keeps a static PNG muzzle without a moving shot', f => {
  const row = { actorId: 'paragon', sourcePath: 'paragon', abilityId: 'basic_attack', attackKind: 'gun' };
  cast(f, row, hit('paragon'), 1, 300);
  const muzzle = f.find('.gm-combat-gun-muzzle');
  assertMuzzlePng(muzzle);
  assert(Number(muzzle.getAttribute('opacity')) > 0, 'the static flash remains visible');
  assert.match(muzzle.getAttribute('transform'), /translate\([^)]+\) rotate\([^)]+\)/, 'static flash keeps its hand position and aim');
  assert.equal(f.all('.gm-combat-gun-shot-line').length, 1, 'reduced motion retains one static straight tracer');
  assert.equal(f.find('.gm-combat-afterimage'), null);
  assert.equal(f.animations.length, 0);
  f.effects.show({ ...hit('paragon'), row }, 1, 450);
  assert.equal(f.find('.gm-combat-gun-muzzle'), null, 'the static flash clears on the next phase');
}, true);

test('4x uses one static PNG muzzle and leaves no flash backlog', f => {
  const row = { actorId: 'paragon', sourcePath: 'paragon', abilityId: 'basic_attack', attackKind: 'gun' };
  for (let index = 0; index < 4; index++) {
    cast(f, { ...row }, hit('paragon'), 4, 300);
    const muzzle = f.find('.gm-combat-gun-muzzle');
    assertMuzzlePng(muzzle);
    assert(Number(muzzle.getAttribute('opacity')) > 0);
    assert.equal(f.all('.gm-combat-gun-muzzle').length, 1);
    assert.equal(f.all('.gm-combat-gun-shot-line').length, 1, 'compact mode retains one static tracer without a backlog');
    assert.equal(f.find('.gm-combat-afterimage'), null);
    assert.equal(f.animations.length, 0);
    f.effects.show({ ...hit('paragon'), row }, 4, 450);
    assert.equal(f.find('.gm-combat-gun-muzzle'), null);
  }
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
