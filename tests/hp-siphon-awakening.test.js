'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const g = require('../js/node-loader');
require('./mechanics-fixture')(g);
const ui = { abbrNum: g.abbrNum };
vm.createContext(ui);
vm.runInContext(fs.readFileSync(require.resolve('../js/ui.js'), 'utf8').split('// ===== Browser UI =====')[0], ui);

const random = () => .99;
const siphonSpec = () => ({ id: 'fixture_siphon', effectId: 'fixture_siphon', name: 'Fixture Siphon',
  text: 'Fixture Siphon', type: 'active', costSP: 0, cooldown: 0, damage: null,
  effects: [{ type: 'steal_stat', stat: 'hp', amount: .3 }] });
function unit(path, id, hp, maxHp = 1000, sequence = 0) {
  const agent = g.makeAgent(() => .4, { path, sequence, trait: 'Stout Vitality' });
  Object.assign(agent, { id, name: id, path, sequence, awakened: true,
    stats: { hp: maxHp, atk: 100, def: 0, int: 100 }, baseStats: { hp: maxHp, atk: 100, def: 0, int: 100 },
    injuries: 0, weaponId: 'none', weaponMastery: {}, cooldowns: {}, sp: 1000, maxSP: 1000 });
  const combat = g.makeCombatUnit(agent, { hp, maxHp });
  combat.sp = combat.maxSP = 1000;
  return combat;
}
function world(side, options = {}) {
  const actor = unit('error', 'Siphoner', options.actorHp ?? 100);
  const target = unit(options.path || 'chained', 'Victim', options.hp ?? 700, options.maxHp ?? 1000, options.sequence ?? 0);
  actor._formUsed = true;
  target.shield = options.shield ?? 200;
  if (options.used) target._formUsed = true;
  if (options.dead) target.alive = false;
  const state = { allies: side === 'ally' ? [actor] : [target], enemies: side === 'ally' ? [target] : [actor],
    events: [], balanceTrace: [], weaponUsage: {}, currentRound: 1, currentTurn: 1, rng: random,
    battleMarionettes: [], createdMarionettes: [] };
  const snapshot = units => units.map(u => ({ id: u.id, name: u.name, hp: u.hp, maxHp: u.maxHp, shield: u.shield, alive: u.alive }));
  return { actor, target, state, lines: [], initialAllies: snapshot(state.allies), initialEnemies: snapshot(state.enemies) };
}
function cast(w, spec = siphonSpec()) {
  assert(g.applyStructuredAbility(w.actor.agent, w.actor, w.target, w.state, w.lines, random, spec));
  return w.state.events;
}
function awakeningEvents(w) { return w.state.events.filter(e => e.subtype === 'mythical_form'); }
function rows(events) { return g.groupEventsToRows(events).flatMap(round => round.rows); }
function replay(w, events = w.state.events) { return ui.calculateCurrentHp(w.initialAllies, w.initialEnemies, rows(events)); }

let scenarios = 0;
for (const side of ['ally', 'enemy']) {
  for (const damage of [1, 1.5, 2]) {
    g.GLOBAL_COMBAT.damage = damage;
    const w = world(side), events = cast(w);
    const loss = events.find(e => e.subtype === 'hp_siphon');
    assert.equal(loss.amount, 300, 'Max HP siphon is independent of the global damage multiplier');
    assert.equal(loss.hpLoss, 300);
    assert.equal(loss.absorbed, 0, 'siphoning bypasses the existing shield');
    assert.equal(loss.shieldAfter, 200, 'damage snapshot precedes awakening shield');
    assert.equal(loss.hpAfter, 400);
    assert.equal(w.actor.hp, 400, 'restore actual HP removed, once');
    assert.equal(w.target.hp, 400);
    assert.equal(w.target.shield, 300);
    assert.equal(w.target._formUsed, true);
    assert.equal(w.target._formBoost, 1.2);
    assert.equal(awakeningEvents(w).length, 1);
    assert.equal(awakeningEvents(w)[0].inTurn, true);
    assert.equal(w.state._mythicalFromHit, undefined, 'temporary cast context is restored');
    assert.equal(events.filter(e => e.type === 'damage').length, 1, 'HP removal does not add normal hit reactions or a Chained echo');
    assert.deepEqual(events.slice(0, 5).map(e => e.type), ['cast', 'damage', 'heal', 'story', 'shield']);
    assert.equal(rows(events).length, 1, 'awakening belongs to the causing cast');
    assert.equal(replay(w)[w.target.id].curShield, 300);
    assert.equal(replay(w)[w.target.id].curHp, 400);
    for (const details of [false, true]) {
      const html = ui.renderTurnRowHtml(rows(events)[0], details);
      assert.match(html, /<small>HP siphon<\/small>/);
      assert(!html.includes('<small>physical</small>'));
      assert(html.indexOf('HP siphon') < html.indexOf('+300 HP'));
      assert(html.indexOf('+300 HP') < html.indexOf('MYTHICAL FORM AWAKENING'));
      assert(html.indexOf('MYTHICAL FORM AWAKENING') < html.indexOf('+100 Shield'));
    }
    scenarios++;
  }
  g.GLOBAL_COMBAT.damage = 1.5;
  for (const [hp, awake] of [[801, false], [800, true]]) {
    const w = world(side, { hp });cast(w);
    assert.equal(awakeningEvents(w).length, Number(awake), 'awakening starts at exactly 50% remaining HP');
    scenarios++;
  }
  for (const options of [{ used: true }, { sequence: 5 }, { dead: true }]) {
    const w = world(side, options);cast(w);
    assert.equal(awakeningEvents(w).length, 0, 'previously used, ineligible and dead units do not awaken');
    scenarios++;
  }
  for (const hp of [1, 50]) {
    const w = world(side, { hp, used: true }), loss = cast(w).find(e => e.subtype === 'hp_siphon');
    assert.equal(w.target.hp, 1, 'siphon alone never kills');
    assert.equal(w.target.alive, true);
    assert.equal(loss.hpLoss, hp - 1);
    assert.equal(w.actor.hp, 100 + hp - 1, 'healing uses the capped loss');
    assert.equal(w.target.shield, 200);
    scenarios++;
  }
  const once = world(side);cast(once);cast(once);
  assert.equal(awakeningEvents(once).length, 1, 'later siphoning cannot awaken the same unit twice');
  assert.equal(once.target.shield, 300, 'later siphoning preserves the existing shield');
  scenarios++;

  const noReaction = world(side);cast(noReaction);noReaction.target.shield = 0;
  const incoming = g.resolveIncoming(noReaction.actor, noReaction.target, 20, noReaction.state, noReaction.lines, random, { damageType: 'physical' });
  const echo = noReaction.state.events.find(e => e.type === 'damage' && e.actorId === noReaction.target.id);
  assert(echo, 'ordinary direct damage still triggers the awakened Chained curse');
  assert.equal(echo.incoming, incoming.hpLoss, 'ordinary echo is not scaled globally a second time');
  scenarios++;

  for (const maxHp of [1000, 100000]) {
    const w = world(side, { hp: maxHp * .7, maxHp, shield: 200 });
    // Keep a wounded caster so actual restoration appears between removal and awakening.
    const spec = g.activeSpecs(w.actor.agent).find(s => s.effectId === 'systemic_glitch');
    const events = cast(w, spec);
    const lossIndex = events.findIndex(e => e.subtype === 'hp_siphon');
    const awakeningIndex = events.findIndex(e => e.subtype === 'mythical_form');
    const shieldIndex = events.findIndex(e => e.type === 'shield');
    const removalIndex = events.findIndex(e => e.subtype === 'shield_removed');
    const mainIndex = events.findIndex(e => e.type === 'damage' && e.subtype !== 'hp_siphon');
    assert(lossIndex < awakeningIndex && awakeningIndex < shieldIndex && shieldIndex < removalIndex && removalIndex < mainIndex,
      'real Systemic Glitch resolves siphon → awakening → shield → stripping → main hit');
    assert.equal(awakeningEvents(w).length, 1);
    assert.equal(w.target._formUsed, true, 'the form activates even if the following hit proves fatal');
    assert.equal(events[removalIndex].shieldAfter, 0);
    assert.equal(events[removalIndex].targetId, w.target.id);
    assert.equal(events[mainIndex].absorbed, 0, 'the existing strip rule removes the new shield before the damaging hit');
    assert.equal(replay(w, events.slice(0, removalIndex + 1))[w.target.id].curShield, 0, 'replay applies shield stripping before any following hit');
    const final = replay(w)[w.target.id];
    assert.equal(final.curHp, w.target.hp);
    assert.equal(final.curShield, 0);
    assert.equal(final.alive, w.target.alive);
    assert.equal(w.target.alive, maxHp > 1000, 'fixture covers lethal and survived follow-up hits');
    for (const details of [false, true]) {
      const html = ui.renderTurnRowHtml(rows(events)[0], details);
      const fragments = ['HP siphon', 'MYTHICAL FORM AWAKENING', 'Shield', 'stripped away!', '<small>true</small>'];
      let previous = -1;
      for (const fragment of fragments) { const index = html.indexOf(fragment, previous + 1);assert(index > previous, `${fragment} follows its cause`);previous = index; }
    }
    scenarios++;
  }
}
console.log(`PASS HP siphon awakening (${scenarios} scenarios, both teams, threshold, nonlethal bypass, once per battle, real Systemic Glitch chronology and replay)`);
