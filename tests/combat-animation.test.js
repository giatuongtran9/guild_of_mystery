// Focused presentation regressions. NODE_PATH=<jsdom node_modules> node tests/combat-animation.test.js
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/ui.js'), 'utf8').split('// ===== Browser UI =====')[0];
let passed = 0, failed = 0;

const ally = { id: 'attacker', name: 'Attacker', team: 'ally', path: 'paragon', sequence: 0, hp: 50, maxHp: 100, sp: 20, maxSP: 20, alive: true, inForm: false };
const enemy = { id: 'defender', name: 'Defender', team: 'enemy', path: 'chained', sequence: 0, hp: 100, maxHp: 100, sp: 20, maxSP: 20, alive: true, inForm: false };

function action() {
  const timeline = [
    { type: 'damage', event: { type: 'damage', actorId: ally.id, actorName: ally.name, actorTeam: 'ally', targetId: enemy.id, targetName: enemy.name, targetTeam: 'enemy', damageType: 'physical', amount: 70, hpLoss: 70, hpAfter: 30, shieldAfter: 0 } },
    { type: 'mythical', event: { type: 'story', subtype: 'mythical_form', actorId: enemy.id, actorName: enemy.name, actorTeam: 'enemy', inTurn: true, text: 'Defender awakens Bandaged Curse Vessel.' } },
    { type: 'shield', event: { type: 'shield', actorId: enemy.id, actorName: enemy.name, actorTeam: 'enemy', targetId: enemy.id, targetName: enemy.name, targetTeam: 'enemy', amount: 25, shieldAfter: 25 } },
    { type: 'reaction', event: { type: 'damage', actorId: enemy.id, actorName: enemy.name, actorTeam: 'enemy', targetId: ally.id, targetName: ally.name, targetTeam: 'ally', damageType: 'dark', amount: 50, hpLoss: 50, hpAfter: 0, shieldAfter: 0, isReaction: true } },
    { type: 'death', event: { type: 'death', targetId: ally.id, targetName: ally.name, targetTeam: 'ally', text: 'Attacker falls.' } }
  ];
  return {
    type: 'turn', actorId: ally.id, actorName: ally.name, actorTeam: 'ally', ability: 'Runebore Revolver',
    timeline,
    damages: [timeline[0].event], shields: [timeline[2].event], reactions: [timeline[3].event], deaths: [timeline[4].event],
    heals: [], reflects: [], revives: [], subrows: [{ type: 'mythical', text: timeline[1].event.text }],
    resources: [{ ...ally, hp: 0, alive: false, sp: 3 }, { ...enemy, hp: 30, shield: 25, sp: 7, inForm: true }]
  };
}

function fixture(options = {}) {
  const dom = new JSDOM('<main id="fixture"></main>', { runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window;
  w.abbrNum = value => String(Math.round(value || 0));
  w.G9_DATA = { runtimeAssets: { entries: {} } };
  w.matchMedia = query => ({ matches: !!options.reducedMotion && query.includes('prefers-reduced-motion'), media: query, addEventListener() {}, removeEventListener() {} });
  const animations = [];
  if (options.waapi) {
    w.HTMLElement.prototype.animate = function (keyframes, timing) {
      const animation = {
        element: this, keyframes, timing, playbackRate: 1, playState: 'running', onfinish: null,
        pause() { this.playState = 'paused'; },
        play() { this.playState = 'running'; },
        cancel() { this.playState = 'idle'; this.cancelled = true; this.oncancel?.(); },
        updatePlaybackRate(value) { this.playbackRate = value; },
        finish() { this.playState = 'finished'; this.onfinish?.(); },
        finished: Promise.resolve()
      };
      animations.push(animation);
      return animation;
    };
  }
  w.HTMLElement.prototype.getBoundingClientRect = function () {
    const card = this.closest?.('[data-unit-id]');
    const x = card?.dataset.unitId === enemy.id ? 140 : 40;
    const y = card?.dataset.unitId === enemy.id ? 80 : 350;
    const canvas = this.matches('.gm-dungeon-arena, .gm-battlefield-canvas');
    const left = canvas ? 0 : x, top = canvas ? 0 : y, width = canvas ? 390 : 64, height = canvas ? 600 : 64;
    return { x: left, y: top, left, top, right: left + width, bottom: top + height, width, height, toJSON() {} };
  };
  w.eval(source);
  const props = { allies: [ally], enemies: [enemy], flattenedRows: [], shownCount: 0, isDone: false, showDetails: false, speed: 1, summaryText: '', isSim: false };
  w.document.getElementById('fixture').innerHTML = w.renderBattleLogComponent(props);
  const wrap = w.document.querySelector('.battle-log-wrap');
  return { dom, w, wrap, props, animations };
}

function test(name, fn, options) {
  let f;
  try { f = fixture(options); fn(f); passed++; console.log('PASS ' + name); }
  catch (error) { failed++; console.error('FAIL ' + name + ': ' + error.stack); }
  finally { f?.dom.window.close(); }
}

function current(f, row, count) {
  return f.w.calculateCurrentHp([ally], [enemy], f.w.battlePresentationRows([row], 0, count));
}

test('partial actions preserve hit, awakening, shield, reaction and death order without leaking final snapshots', f => {
  const row = action(), original = JSON.stringify(row);
  const cast = current(f, row, 0);
  assert.equal(cast.defender.curHp, 100); assert.equal(cast.defender.inForm, false);
  assert.equal(cast.attacker.sp, 20);
  const hit = current(f, row, 1);
  assert.equal(hit.defender.curHp, 30); assert.equal(hit.defender.inForm, false); assert.equal(hit.defender.curShield, 0);
  const awakening = current(f, row, 2);
  assert.equal(awakening.defender.inForm, true); assert.equal(awakening.defender.curShield, 0);
  assert.equal(awakening.attacker.curHp, 50); assert.equal(awakening.defender.sp, 20);
  const shield = current(f, row, 3);
  assert.equal(shield.defender.curHp, 30); assert.equal(shield.defender.curShield, 25);
  const reaction = current(f, row, 4);
  assert.equal(reaction.attacker.curHp, 0); assert.notEqual(reaction.attacker.alive, false);
  const death = current(f, row, 5);
  assert.equal(death.attacker.alive, false); assert.equal(death.attacker.sp, 20);
  const complete = f.w.calculateCurrentHp([ally], [enemy], f.w.battlePresentationRows([row], 1, null));
  assert.equal(complete.attacker.sp, 3); assert.equal(complete.defender.sp, 7); assert.equal(complete.defender.curShield, 25);
  assert.equal(JSON.stringify(row), original, 'reconstructing intermediate states cannot mutate battle results');
});

test('partial rows contain only the revealed timeline and omit category arrays and authoritative resources', f => {
  const row = action(), rows = f.w.battlePresentationRows([row], 0, 2), partial = rows[0];
  assert.equal(rows.length, 1); assert.equal(partial.presentationPartial, true); assert.equal(partial.timeline.length, 2);
  assert.equal(partial.resources, undefined);
  for (const key of ['damages', 'heals', 'shields', 'reactions', 'reflects', 'deaths', 'revives', 'subrows']) assert.equal(partial[key]?.length || 0, 0, key + ' cannot disclose later effects');
  assert.equal(row.timeline.length, 5); assert.equal(row.resources.length, 2);
  assert.equal(f.w.battlePresentationRows([row], 0, null).length, 0, 'a pending action is invisible before its cast');
});

test('partial timeline logs conceal the later awakening, retaliation and death', f => {
  const row = action();
  const first = f.w.renderTurnRowHtml(f.w.battlePresentationRows([row], 0, 1)[0], false);
  assert(first.includes('70 HP')); assert(!first.includes('MYTHICAL FORM AWAKENING')); assert(!first.includes('Reaction')); assert(!first.includes('falls'));
  const awakened = f.w.renderTurnRowHtml(f.w.battlePresentationRows([row], 0, 2)[0], false);
  assert(awakened.includes('MYTHICAL FORM AWAKENING')); assert(!awakened.includes('25 Shield')); assert(!awakened.includes('Reaction'));
});

test('the presentation cursor emits one cast then each timeline event exactly once', f => {
  const row = action(), original = JSON.stringify(row), playing = { turnRows: [row], currentTurn: 0, eventCount: null };
  const cues = [];
  cues.push(f.w.advanceBattlePresentation(playing));
  assert.equal(cues[0].type, 'cast'); assert.equal(playing.currentTurn, 0); assert.equal(playing.eventCount, 0);
  for (let i = 0; i < row.timeline.length; i++) {
    cues.push(f.w.advanceBattlePresentation(playing));
    assert.equal(cues.at(-1).type, row.timeline[i].type);
    assert.equal(cues.at(-1).event.targetId || cues.at(-1).event.actorId, row.timeline[i].event.targetId || row.timeline[i].event.actorId);
    if (i < row.timeline.length - 1) { assert.equal(playing.currentTurn, 0); assert.equal(playing.eventCount, i + 1); }
  }
  assert.equal(playing.currentTurn, 0); assert.equal(playing.eventCount, row.timeline.length);
  assert.equal(f.w.advanceBattlePresentation(playing).type, 'settle');
  assert.equal(playing.currentTurn, 1); assert.equal(playing.eventCount, null);
  assert.equal(JSON.stringify(row), original, 'the presentation cursor cannot mutate combat events');
  assert.equal(f.w.advanceBattlePresentation(playing), null, 'a completed replay produces no new cue');
});

test('settling completes the current action once and leaves the next action untouched', f => {
  const first = action(), second = { type: 'story', text: 'Another action.' };
  const playing = { turnRows: [first, second], currentTurn: 0, eventCount: null };
  f.w.advanceBattlePresentation(playing); f.w.advanceBattlePresentation(playing);
  while (playing.currentTurn === 0) f.w.advanceBattlePresentation(playing);
  assert.equal(playing.currentTurn, 1); assert.equal(playing.eventCount, null);
  const shown = f.w.battlePresentationRows(playing.turnRows, playing.currentTurn, playing.eventCount);
  assert.equal(shown.length, 1); assert.equal(shown[0].resources[0].sp, 3);
  const next = f.w.advanceBattlePresentation(playing);
  assert.equal(next.type, 'row'); assert.equal(playing.currentTurn, 2); assert.equal(playing.eventCount, null);
});

test('round headers and story rows remain complete rows without invented animation stages', f => {
  const playing = { turnRows: [{ isRoundHeader: true, round: 1, resources: [ally, enemy] }, { type: 'story', text: 'Battle begins.' }], currentTurn: 0, eventCount: null };
  assert.equal(f.w.advanceBattlePresentation(playing).type, 'row'); assert.equal(playing.currentTurn, 1);
  assert.equal(f.w.advanceBattlePresentation(playing).type, 'row'); assert.equal(playing.currentTurn, 2);
});

test('standalone mythical stories change form at their own presentation boundary', f => {
  const row = { type: 'story', subtype: 'mythical_form', actorId: enemy.id, actorName: enemy.name, text: 'Defender awakens.' };
  const before = f.w.calculateCurrentHp([ally], [enemy], []), after = f.w.calculateCurrentHp([ally], [enemy], [row]);
  assert.equal(before.defender.inForm, false); assert.equal(after.defender.inForm, true);
});

test('missing Web Animations API remains decorative and clear removes every transient cue', f => {
  const row = action(), original = JSON.stringify(row), originalCards = [...f.wrap.querySelectorAll('.gm-arena-unit')];
  const effects = f.w.createBattleEffects(f.wrap);
  effects.show({ type: 'cast', row }, 1);
  effects.show({ ...row.timeline[0], row }, 1);
  effects.pause(); effects.setSpeed(4); effects.resume(); effects.clear(); effects.clear();
  assert.equal(f.wrap.querySelectorAll('.gm-battle-fx-layer, .gm-battle-fx, .gm-battle-fx-number').length, 0);
  assert(![...f.wrap.querySelectorAll('[class]')].some(node => [...node.classList].some(name => name.startsWith('gm-cue-'))));
  assert.deepEqual([...f.wrap.querySelectorAll('.gm-arena-unit')], originalCards);
  assert.equal(f.wrap.querySelector('.gm-arena-unit.ally .gm-hp-num').textContent, '50/100', 'decorative effects cannot apply combat damage');
  assert.equal(JSON.stringify(row), original, 'decorative effects cannot alter battle results');
});

test('active effects pause and resume, and a new cue or clear cancels their animations', f => {
  const row = action(), effects = f.w.createBattleEffects(f.wrap);
  effects.show({ ...row.timeline[0], row }, 1);
  const first = f.animations.filter(animation => animation.playState === 'running');
  assert(first.length > 0, 'damage has a visible animation when WAAPI is available');
  effects.pause(); assert(first.every(animation => animation.playState === 'paused'));
  effects.setSpeed(2); assert(first.every(animation => animation.playbackRate === 2));
  effects.resume(); assert(first.every(animation => animation.playState === 'running'));
  effects.show({ ...row.timeline[2], row }, 2);
  assert(first.every(animation => animation.cancelled), 'starting the next effect cannot leave older animations running');
  effects.clear(); assert(f.animations.every(animation => animation.cancelled || animation.playState === 'finished'));
  assert.equal(f.wrap.querySelectorAll('.gm-battle-fx-layer, .gm-battle-fx, .gm-battle-fx-number').length, 0);
}, { waapi: true });

test('finished effects release their animation handles and can be cleared repeatedly', f => {
  const row = action(), effects = f.w.createBattleEffects(f.wrap);
  effects.show({ ...row.timeline[0], row }, 1);
  for (const animation of [...f.animations]) animation.finish();
  effects.pause(); effects.resume(); effects.clear(); effects.clear();
  assert.equal(f.wrap.querySelectorAll('.gm-battle-fx-layer, .gm-battle-fx, .gm-battle-fx-number').length, 0);
}, { waapi: true });

test('reduced motion preserves cues without translating or scaling characters', f => {
  const row = action(), effects = f.w.createBattleEffects(f.wrap);
  effects.show({ type: 'cast', row }, 1);
  effects.show({ ...row.timeline[0], row }, 1);
  effects.show({ ...row.timeline[1], row }, 1);
  for (const animation of f.animations) {
    const frames = Array.isArray(animation.keyframes) ? animation.keyframes : [animation.keyframes];
    for (const frame of frames) assert(!frame.transform || frame.transform === 'none', 'reduced motion cannot translate or scale artwork');
  }
  effects.clear(); assert.equal(f.wrap.querySelectorAll('.gm-battle-fx-layer').length, 0);
}, { waapi: true, reducedMotion: true });

test('missing targets and a detached battle view do not prevent effect cleanup', f => {
  const effects = f.w.createBattleEffects(f.wrap);
  effects.show({ type: 'damage', row: { actorId: 'missing' }, event: { targetId: 'missing', amount: 12, damageType: 'fire' } }, 4);
  f.wrap.remove(); effects.pause(); effects.resume(); effects.setSpeed(1); effects.clear();
  assert.equal(f.wrap.querySelectorAll('.gm-battle-fx-layer, .gm-battle-fx, .gm-battle-fx-number').length, 0);
}, { waapi: true });

test('completed casts retain SP and HP payments before an authoritative snapshot', f => {
  const row = { type: 'turn', actorId: ally.id, costSP: 6, costHP: 7, timeline: [] };
  const partial = f.w.calculateCurrentHp([ally], [], f.w.battlePresentationRows([row], 0, 0));
  const complete = f.w.calculateCurrentHp([ally], [], [row]);
  for (const map of [partial, complete]) { assert.equal(map.attacker.sp, 14); assert.equal(map.attacker.curHp, 43); }
  const reconciled = f.w.calculateCurrentHp([ally], [], [{ ...row, resources: [{ ...ally, hp: 41, sp: 11 }] }]);
  assert.equal(reconciled.attacker.curHp, 41); assert.equal(reconciled.attacker.sp, 11);
});

test('periodic damage reveals its tick without an invented casting action', f => {
  const row = action(); row.timeline = [{ ...row.timeline[0], event: { ...row.timeline[0].event, isDot: true } }];
  const playing = { currentTurn: 0, turnRows: [row] };
  const cue = f.w.advanceBattlePresentation(playing);
  assert.equal(cue.type, 'damage'); assert.equal(playing.currentTurn, 0);
  assert.equal(f.w.advanceBattlePresentation(playing).type, 'settle'); assert.equal(playing.currentTurn, 1);
});

test('finished final effects remove their numbers and cue outlines', f => {
  const row = action(), effects = f.w.createBattleEffects(f.wrap);
  effects.show({ ...row.timeline[0], row, isDone: true });
  assert(f.wrap.querySelector('.gm-battle-fx-number'));
  for (const animation of f.animations) animation.finish();
  assert.equal(f.wrap.querySelectorAll('.gm-battle-fx-layer, .gm-battle-fx-number, [class*="gm-cue-"]').length, 0);
}, { waapi: true });

console.log(`\nCombat animation presentation: ${passed} passed, ${failed} failed.`);
if (failed) process.exitCode = 1;
