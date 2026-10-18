// Sequence 8 presentation regressions. The supplied replay events are authoritative.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/ui.js'), 'utf8').split('// ===== Browser UI =====')[0];
const fx = JSON.parse(fs.readFileSync(path.join(root, 'data/fx.json'), 'utf8'));
const abilities = {
  desire_ignition: 'abyss', madness_curse: 'chained', midnight_requiem: 'darkness',
  undying_touch: 'death', instigation: 'demoness', elemental_spark: 'door',
  deceptive_feint: 'error', paper_card_dagger: 'fool', shadow_strike: 'hanged_man',
  mystic_spell: 'hermit', fines_penalties: 'justiciar', beast_command: 'moon',
  nature_growth: 'mother', crafted_blade: 'paragon', provocation: 'red_priest',
  holy_flash: 'sun', heavy_cleave: 'twilight_giant', raging_blow: 'tyrant',
  bad_luck_curse: 'wheel_of_fortune', analysis_weakness: 'white_tower'
};
const utility = new Set(['beast_command', 'provocation', 'bad_luck_curse']);
let passed = 0, failed = 0;

function makeEvents(id, options = {}) {
  const damage = { type: 'damage', actorId: 'caster', targetId: 'enemy', amount: 40,
    hpLoss: 40, hpAfter: 40, damageType: 'physical', isReaction: false, isReflect: false, isDot: false };
  const command = { type: 'status', subtype: 'signature', presentationEffect: 'beast_command',
    ownerId: 'caster', actorId: 'caster', targetId: options.commandTarget || 'beast' };
  const status = { type: 'status', actorId: 'caster', targetId: 'enemy', text: 'Enemy loses DEF.' };
  let steps = id === 'beast_command' && !options.fallback ? [{ type: 'note', event: command }]
    : id === 'provocation' ? [{ type: 'note', event: status }]
      : id === 'bad_luck_curse' ? []
        : [{ type: 'damage', event: damage }];
  if (options.leadingCharge) steps.unshift({ type: 'note', event: { type: 'status', actorId: 'caster', subtype: 'signature', text: 'Spends 100 charge.' } });
  const row = { type: 'turn', actorId: 'caster', abilityId: id, ability: id.replaceAll('_', ' '),
    sourcePath: abilities[id], timeline: steps };
  return { row, next: steps[0], steps, damage };
}

function fixture(reduced = false) {
  const dom = new JSDOM('<main></main>', { runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window, animations = [];
  Object.defineProperty(w, 'innerWidth', { value: 390 });
  Object.defineProperty(w, 'innerHeight', { value: 900 });
  w.abbrNum = number => String(Math.round(number || 0));
  w.matchMedia = () => ({ matches: reduced });
  w.G9_DATA = { fx, runtimeAssets: { entries: {} }, balance: { path_archetype: { moon: 'Caster' } } };
  w.Element.prototype.animate = function (keyframes, timing) {
    const animation = { element: this, keyframes, timing, currentTime: 0, playbackRate: 1, playState: 'running',
      pause() { this.playState = 'paused'; }, play() { this.playState = 'running'; },
      cancel() { this.playState = 'idle'; this.cancelled = true; this.oncancel?.(); },
      finish() { this.playState = 'finished'; this.onfinish?.(); } };
    animations.push(animation); return animation;
  };
  const positions = { caster: [100, 370], ally: [230, 370], beast: [200, 450], enemy: [140, 80] };
  w.Element.prototype.getBoundingClientRect = function () {
    const id = this.closest?.('[data-unit-id]')?.dataset.unitId;
    const [left, top] = positions[id] || [0, 0];
    const width = id ? id === 'beast' ? 32 : 64 : 390, height = id ? width : 650;
    return { left, top, right: left + width, bottom: top + height, width, height, x: left, y: top, toJSON() {} };
  };
  w.eval(source);
  const make = (id, pathway, team = 'ally', companion) => ({ id, name: id, path: pathway, team,
    sequence: 8, hp: 80, maxHp: 100, curHp: 80, sp: 40, maxSP: 50, alive: true,
    ...(companion ? { summoned: true, companion } : {}) });
  const allies = [make('caster', 'moon'), make('ally', 'white_tower'), make('beast', 'moon', 'ally', { ownerId: 'caster', kind: 'beast' })];
  const enemies = [make('enemy', 'error', 'enemy')];
  const map = Object.fromEntries([...allies, ...enemies].map(unit => [unit.id, unit]));
  w.document.querySelector('main').innerHTML = w.renderBattleLogComponent({ allies, enemies, flattenedRows: [], shownCount: 0,
    isDone: false, speed: 1, summaryText: '' });
  const wrap = w.document.querySelector('.battle-log-wrap'), effects = w.createBattleEffects(wrap);
  effects.sync(map);
  return { dom, w, wrap, map, effects, animations,
    find: selector => wrap.querySelector(selector), all: selector => [...wrap.querySelectorAll(selector)] };
}
function active(f) { return f.animations.filter(animation => !animation.cancelled && animation.playState !== 'finished'); }
function tracksFor(f, node) { return active(f).filter(animation => animation.element === node || node.contains(animation.element)); }
function cast(f, id, speed = 1, options) {
  const result = makeEvents(id, options);
  f.effects.show({ type: 'cast', row: result.row, next: result.next }, speed, 800);
  return result;
}
function test(name, fn, reduced = false) {
  let f;
  try { f = fixture(reduced); fn(f); passed++; console.log('PASS ' + name); }
  catch (error) { failed++; console.error('FAIL ' + name + ': ' + error.stack); }
  finally { f?.effects.clear(); f?.dom.window.close(); }
}

test('all 20 active abilities have distinct real PNG artwork and a pathway palette', () => {
  assert.deepEqual(Object.keys(fx.sequence8Abilities || {}).sort(), Object.keys(abilities).sort());
  const paths = new Set();
  for (const [id, pathway] of Object.entries(abilities)) {
    const effect = fx.sequence8Abilities[id];
    assert.equal(effect.pathway, pathway, id + ' retains its source pathway');
    assert.match(effect.color, /^#[0-9a-f]{6}$/i);
    assert(['travel', 'strike', 'caster', 'support'].includes(effect.mode));
    assert.match(effect.asset, /^data\/assets\/effects\/.+\.png$/);
    assert(!paths.has(effect.asset), id + ' has its own effect artwork'); paths.add(effect.asset);
    const bytes = fs.readFileSync(path.join(root, effect.asset));
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', id + ' is a PNG');
    assert(bytes.readUInt32BE(16) >= 64 && bytes.readUInt32BE(20) >= 64, id + ' has a usable source resolution');
  }
  for (const passive of ['barbaric_physique', 'predictive_parry']) assert(!fx.sequence8Abilities[passive]);
});

for (const id of Object.keys(abilities)) test(id + ' gives its PNG a complete readable cast before its recorded outcome', f => {
  const { row, next } = cast(f, id, 2);
  const node = f.find('.gm-combat-sequence8[data-stage="cast"]');
  assert(node, 'there is a distinct Sequence 8 cast');
  assert.equal(node.dataset.abilityId, id);
  assert.equal(node.dataset.ownerId, 'caster');
  assert.equal(node.dataset.effectSrc, fx.sequence8Abilities[id].asset);
  assert.equal(node.querySelector('image')?.getAttribute('href'), fx.sequence8Abilities[id].asset);
  const tracks = tracksFor(f, node);
  assert(tracks.length, 'the artwork uses the managed animation system');
  assert(tracks.every(animation => Number(animation.timing.duration) === 800));
  assert(tracks.every(animation => animation.playbackRate === 1.6), '800ms / 1.6 is a readable 500ms at 2x');
  assert.equal(f.find('.gm-combat-sequence8[data-stage="impact"]'), null);
  assert.equal(f.find('.gm-battle-fx-number'), null, 'no damage or recovery number appears before the outcome');
  if (utility.has(id)) assert.equal(f.find('.gm-combat-projectile'), null, 'utility cues do not invent a damaging projectile');
  const recorded = JSON.stringify({ row, next }), state = JSON.stringify(f.map);
  if (!utility.has(id)) {
    f.effects.show({ type: 'damage', row, event: next.event }, 2, 225);
    const hit = f.find('.gm-combat-sequence8[data-stage="impact"]');
    assert(hit, 'the target impact appears only at the real damage boundary');
    assert.equal(hit.dataset.targetId, 'enemy');
    assert.equal(f.find('.gm-combat-sequence8[data-stage="cast"]'), null, 'the cast cannot leak into the next event');
    assert(f.find('.gm-battle-fx-number')?.textContent.includes('40'));
  }
  assert.equal(JSON.stringify({ row, next }), recorded, 'rendering does not rewrite the replay');
  assert.equal(JSON.stringify(f.map), state, 'rendering cannot change combat outcomes');
});

test('Beast Command finds the actual command recipient after a charge note, including redirection', f => {
  for (const targetId of ['beast', 'enemy']) {
    const result = cast(f, 'beast_command', 1, { leadingCharge: true, commandTarget: targetId });
    const node = f.find('.gm-combat-sequence8');
    assert.equal(node.dataset.targetId, targetId);
    assert.equal(node.dataset.mode, 'support');
    assert.equal(f.find('.gm-combat-projectile'), null);
    assert.equal(f.find('.gm-combat-heal'), null, 'the command does not imply an unrecorded heal');
    assert.equal(f.find('.gm-combat-impact'), null, 'commanding does not grant an extra beast attack');
    assert.equal(result.row.timeline.at(-1).event.targetId, targetId);
    f.effects.clear(); f.effects.sync(f.map);
  }
});

test('Beast Command fallback strikes its real opponent without inventing a beast or command marker', f => {
  delete f.map.beast; f.effects.sync(f.map);
  const { row, next } = cast(f, 'beast_command', 1, { fallback: true });
  const node = f.find('.gm-combat-sequence8');
  assert.equal(node.dataset.targetId, 'enemy');
  assert.equal(node.dataset.mode, 'travel');
  assert.equal(f.find('[data-effect="beast_command"]'), null);
  f.effects.show({ type: 'damage', row, event: next.event }, 1, 225);
  assert.equal(f.find('.gm-combat-sequence8[data-stage="impact"]').dataset.targetId, 'enemy');
  assert.equal(f.find('.gm-combat-heal'), null);
});

test('Bad Luck keeps its cast visible even when the recorder has no target event', f => {
  const { row } = makeEvents('bad_luck_curse');
  const playing = { turnRows: [row], currentTurn: 0, eventCount: null };
  const cue = f.w.advanceBattlePresentation(playing);
  assert.equal(cue.type, 'cast'); assert.equal(cue.next, null);
  f.effects.show(cue, 1, f.w.battlePresentationDelay(playing));
  const node = f.find('.gm-combat-sequence8');
  assert(node && node.dataset.mode === 'caster');
  assert.equal(f.find('.gm-combat-projectile'), null);
  assert.equal(f.find('.gm-combat-status'), null, 'a cue cannot claim a silent secondary effect landed');
  assert.equal(f.w.advanceBattlePresentation(playing).type, 'settle');
  assert.equal(playing.currentTurn, 1);
});

test('secondary control only appears for an actual successful status event', f => {
  for (const [id, status] of [['midnight_requiem', 'sleep'], ['instigation', 'confused'], ['elemental_spark', 'freeze'], ['mystic_spell', 'burn']]) {
    const { row, next } = cast(f, id);
    assert.equal(f.find('.gm-combat-status'), null, 'a cast is not proof of applied ' + status);
    f.effects.show({ type: 'damage', row, event: next.event }, 1, 225);
    assert.equal(f.find('.gm-combat-status'), null, 'the damage event cannot invent ' + status);
    f.effects.show({ type: 'note', row, event: { type: 'status', actorId: 'caster', targetId: 'enemy', status } }, 1, 90);
    assert.equal(f.find('.gm-combat-status')?.dataset.targetId, 'enemy');
    f.effects.clear(); f.effects.sync(f.map);
  }
});

test('Nature Growth does not show healing or rooting; Heavy Cleave remains a single-target hit', f => {
  for (const id of ['nature_growth', 'heavy_cleave']) {
    const { row, next } = cast(f, id);
    f.effects.show({ type: 'damage', row, event: next.event }, 1, 225);
    assert.equal(f.all('.gm-combat-sequence8[data-stage="impact"]').length, 1);
    assert.equal(f.find('.gm-combat-heal, .gm-combat-status, .gm-combat-area-wave'), null);
    f.effects.clear(); f.effects.sync(f.map);
  }
});

test('reactions, reflected damage and later damage-over-time do not replay the originating active cast', f => {
  for (const [type, flags] of [['reaction', { actorId: 'enemy', targetId: 'caster', isReaction: true }],
    ['reflect', { actorId: 'enemy', targetId: 'caster', isReflect: true }],
    ['damage', { actorId: 'caster', targetId: 'enemy', isDot: true }]]) {
    const { row, damage } = makeEvents('desire_ignition');
    f.effects.show({ type, row, event: { ...damage, ...flags } }, 1, 225);
    assert.equal(f.find('.gm-combat-sequence8'), null, 'only the recorded direct ability hit owns the ability artwork');
    f.effects.clear(); f.effects.sync(f.map);
  }
});

test('Chained signature release keeps the curse owner and real dark-damage recipient', f => {
  const { row, next } = makeEvents('madness_curse');
  const speed = { type: 'status', actorId: 'caster', targetId: 'enemy', text: 'Enemy loses Speed.' };
  const charge = { type: 'status', subtype: 'signature', actorId: 'caster', text: 'Caster spends 100 Restraint.' };
  const release = { type: 'damage', actorId: 'caster', targetId: 'enemy', damageType: 'dark',
    amount: 30, hpLoss: 30, isSignature: true, isReaction: true, isReflect: false, isDot: false };
  row.timeline = [{ type: 'note', event: speed }, { type: 'note', event: charge }, { type: 'damage', event: release }, next];
  f.effects.show({ type: 'cast', row, next: row.timeline[0] }, 1, 800);
  assert.equal(f.find('.gm-combat-sequence8[data-stage="cast"]').dataset.targetId, 'enemy');
  assert.equal(f.find('.gm-battle-fx-number'), null);
  f.effects.show({ type: 'note', row, event: speed }, 1, 90);
  assert.equal(f.find('.gm-combat-status').dataset.targetId, 'enemy');
  f.effects.show({ type: 'note', row, event: charge }, 1, 90);
  assert.equal(f.find('.gm-combat-status'), null, 'charge spending is not a new curse affliction');
  f.effects.show({ type: 'damage', row, event: release }, 1, 225);
  const node = f.find('.gm-combat-sequence8[data-stage="impact"]');
  assert.equal(node.dataset.ownerId, 'caster'); assert.equal(node.dataset.targetId, 'enemy');
  assert.equal(node.dataset.signatureRelease, 'true');
  assert.equal(node.dataset.effectSrc, fx.sequence8Abilities.madness_curse.asset);
  assert(f.find('.gm-battle-fx-number').textContent.includes('30'));
  f.effects.show({ type: 'damage', row, event: next.event }, 1, 225);
  assert.equal(f.find('.gm-combat-sequence8[data-stage="impact"]').dataset.signatureRelease, 'false');
});

test('critical Sequence 8 hits keep identical impact animation and emphasize only the orange damage number', f => {
  const normal = makeEvents('raging_blow'), critical = makeEvents('raging_blow');
  critical.next.event.critical = true;
  const holds = [];
  for (const result of [normal, critical]) {
    f.effects.show({ type: 'damage', row: result.row, event: result.next.event }, 2, 225);
    const node = f.find('.gm-combat-sequence8[data-stage="impact"]'), number = f.find('.gm-battle-fx-number');
    const tracks = tracksFor(f, node);
    holds.push({ size: Number(node.dataset.effectHeight), color: node.style.getPropertyValue('--gm-fx-color'),
      artwork: node.querySelector('image')?.outerHTML,
      tracks: tracks.map(animation => ({ frames: JSON.parse(JSON.stringify(animation.keyframes)), duration: animation.timing.duration,
      delay: animation.timing.delay || 0, rate: animation.playbackRate })),
      phase: f.w.battlePresentationDelay({ turnRows: [result.row], currentTurn: 0, eventCount: 1 }, 2) });
    if (result === critical) {
      assert.equal(node.dataset.critical, 'true');
      assert(number.classList.contains('gm-battle-fx-number-critical'));
      assert.equal(number.style.getPropertyValue('--gm-fx-color'), fx.impact.critColor);
      assert(Number(number.style.getPropertyValue('--gm-fx-number-scale')) > 1);
    }
    assert(active(f).every(animation => animation.playState === 'running' && animation.playbackRate === 2), 'criticals do not pause the playback clock');
    f.effects.clear(); f.effects.sync(f.map);
  }
  assert.equal(holds[1].size, holds[0].size, 'critical hits cannot enlarge the impact artwork');
  assert.equal(holds[1].color, holds[0].color, 'critical hits cannot recolor the impact effect');
  assert.equal(holds[1].artwork, holds[0].artwork, 'critical hits use the same PNG and artwork geometry');
  assert.deepEqual(holds[1].tracks, holds[0].tracks, 'critical hits use identical keyframes, playback rate and duration');
  assert.equal(holds[1].phase, holds[0].phase);
});

test('copied and soul abilities retain their source artwork without changing their owner', f => {
  for (const id of Object.keys(abilities)) for (const prefix of ['record:', 'asset_soul:']) {
    const { row, next } = makeEvents(id);
    row.sourceAbilityId = id; row.abilityId = prefix + id; row.ownedPower = prefix === 'record:' ? 'record' : 'soul';
    f.effects.show({ type: 'cast', row, next }, 2, 800);
    const node = f.find('.gm-combat-sequence8');
    assert.equal(node.dataset.abilityId, id);
    assert.equal(node.dataset.effectSrc, fx.sequence8Abilities[id].asset);
    assert.equal(node.dataset.ownerId, 'caster');
    assert(tracksFor(f, node).every(animation => animation.playbackRate === 1.6));
    f.effects.clear(); f.effects.sync(f.map);
  }
});

test('resolved copied and soul rows warm their source PNGs before first playback', f => {
  const requested = [];
  f.w.Image = class { set src(value) { requested.push(value); } };
  const rows = [
    { actorId: 'caster', abilityId: 'record:paper_card_dagger', sourceAbilityId: 'paper_card_dagger' },
    { actorId: 'caster', abilityId: 'asset_soul:desire_ignition', sourceAbilityId: 'desire_ignition' },
    { actorId: 'caster', abilityId: 'record:paper_card_dagger', sourceAbilityId: 'paper_card_dagger' },
    { actorId: 'caster', abilityId: 'predictive_parry' }
  ];
  const before = JSON.stringify(rows);
  assert.equal(typeof f.effects.prepare, 'function'); f.effects.prepare(rows);
  assert.deepEqual(requested.sort(), [fx.sequence8Abilities.paper_card_dagger.asset, fx.sequence8Abilities.desire_ignition.asset].sort());
  f.effects.prepare(rows); assert.equal(requested.length, 2, 'warmup requests are deduplicated');
  assert.equal(JSON.stringify(rows), before, 'preloading cannot alter the resolved battle');
});

test('pause, live speed changes, resume, phase changes and Skip control every Sequence 8 track', f => {
  for (const id of Object.keys(abilities)) {
    cast(f, id, 2);
    const node = f.find('.gm-combat-sequence8'), tracks = tracksFor(f, node);
    f.effects.pause(); assert(active(f).every(animation => animation.playState === 'paused'));
    f.effects.setSpeed(1); assert(tracks.every(animation => animation.playState === 'paused' && animation.playbackRate === 1));
    f.effects.setSpeed(2); assert(tracks.every(animation => animation.playState === 'paused' && animation.playbackRate === 1.6));
    f.effects.resume(); assert(active(f).every(animation => animation.playState === 'running'));
    f.effects.clear();
    assert.equal(f.find('.gm-combat-fx-layer, .gm-pathway-fx-layer, .gm-battle-fx-layer'), null);
    assert.equal(active(f).length, 0, 'Skip does not leave an animation backlog');
    f.effects.sync(f.map);
  }
});

for (const reduced of [false, true]) test((reduced ? 'Reduced motion' : '4x compact playback') + ' retains a static identity without animation backlog', f => {
  for (const id of Object.keys(abilities)) {
    cast(f, id, reduced ? 2 : 4);
    assert.equal(f.find('.gm-combat-sequence8')?.dataset.abilityId, id);
    assert.equal(active(f).length, 0);
    f.effects.clear(); f.effects.sync(f.map);
  }
}, reduced);

test('passive abilities and ordinary attacks cannot accidentally use Sequence 8 artwork', f => {
  for (const id of ['barbaric_physique', 'predictive_parry', 'basic_attack']) {
    f.effects.show({ type: id === 'basic_attack' ? 'cast' : 'row', row: { actorId: 'caster', abilityId: id },
      event: { type: 'story', actorId: 'caster' }, next: { type: 'damage', event: { actorId: 'caster', targetId: 'enemy', hpLoss: 10 } } }, 1, 300);
    assert.equal(f.find('.gm-combat-sequence8'), null);
    f.effects.clear(); f.effects.sync(f.map);
  }
});

test('Shadow Strike, Crafted Blade, Nature Growth and Beast Command render distinct custom choreography', f => {
  // Shadow Strike
  const shadow = cast(f, 'shadow_strike');
  f.effects.show({ type: 'damage', row: shadow.row, event: shadow.next.event }, 1, 225);
  assert(f.find('.gm-combat-shadow-strike-impact-slash'), 'Shadow strike has abyssal slash');
  assert(f.find('.gm-combat-shadow-embers'), 'Shadow strike has shadow embers');
  f.effects.clear(); f.effects.sync(f.map);

  // Crafted Blade
  const crafted = cast(f, 'crafted_blade');
  f.effects.show({ type: 'damage', row: crafted.row, event: crafted.next.event }, 1, 225);
  assert(f.find('.gm-combat-crafted-blade-impact-slash'), 'Crafted blade has forged cleave');
  assert(f.find('.gm-combat-crafted-sparks'), 'Crafted blade has forged sparks');
  f.effects.clear(); f.effects.sync(f.map);

  // Nature Growth
  const nature = cast(f, 'nature_growth');
  const natureCastNode = f.find('.gm-combat-sequence8[data-stage="cast"]');
  const natureTracks = tracksFor(f, natureCastNode);
  const natureFrames = natureTracks[0]?.keyframes || [];
  assert(natureFrames.some(kf => kf.transform && kf.transform.includes('scale(1.08, 1.25)')), 'Nature growth has rapid vertical stretch');
  f.effects.show({ type: 'damage', row: nature.row, event: nature.next.event }, 1, 225);
  const natureImpactNode = f.find('.gm-combat-sequence8[data-stage="impact"]');
  const natureImpactTracks = tracksFor(f, natureImpactNode);
  const natureImpactFrames = natureImpactTracks[0]?.keyframes || [];
  assert(natureImpactFrames.some(kf => kf.transform && kf.transform.includes('scale(0.86)')), 'Nature growth impact clamps inward at scale 0.86');
  assert(f.find('.gm-combat-nature-particles'), 'Nature growth has emerald particles on impact');
  f.effects.clear(); f.effects.sync(f.map);

  // Beast Command fallback
  const beastFallback = cast(f, 'beast_command', 1, { companion: false });
  f.effects.show({ type: 'damage', row: beastFallback.row, event: beastFallback.next.event }, 1, 225);
  assert(f.find('.gm-combat-beast-claw-slash'), 'Beast Command fallback has savage claw slash');
  assert(f.find('.gm-combat-beast-claw-sparks'), 'Beast Command fallback has blood/lunar sparks');
  f.effects.clear(); f.effects.sync(f.map);
});

console.log(`\nSequence 8 FX: ${passed} passed, ${failed} failed.`);
if (failed) process.exitCode = 1;
