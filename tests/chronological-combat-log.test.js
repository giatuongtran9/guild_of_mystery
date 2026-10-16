'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const g = require('../js/node-loader');
const ui = { abbrNum: g.abbrNum };
vm.createContext(ui);
vm.runInContext(fs.readFileSync(require.resolve('../js/ui.js'), 'utf8').split('// ===== Browser UI =====')[0], ui);

function unit(path, id, hp, maxHp = hp) {
  const a = g.makeAgent(() => .4, { path, sequence: 0, trait: 'Stout Vitality' });
  Object.assign(a, { id, name: id, path, sequence: 0, awakened: true,
    stats: { hp: maxHp, atk: 12000, def: 0, int: 18456 }, injuries: 0,
    weaponId: 'none', weaponMastery: {}, cooldowns: {}, sp: 1000, maxSP: 1000 });
  const u = g.makeCombatUnit(a, { hp, maxHp });
  u.sp = u.maxSP = 1000;
  return u;
}
function siphon(stormHP, side = 'enemy', vulnerable = true) {
  const storm = unit('error', 'Storm Beast', stormHP, Math.max(stormHP, 300000));
  const chained = unit('chained', 'Chained Seq 0', 200000, 349517);
  storm._formUsed = true;
  if (!vulnerable) storm._damageTakenMultiplier = .5;
  const state = { allies: side === 'enemy' ? [chained] : [storm], enemies: side === 'enemy' ? [storm] : [chained],
    events: [], balanceTrace: [], weaponUsage: {}, currentRound: 3, currentTurn: 6,
    rng: () => .99, battleMarionettes: [], createdMarionettes: [] };
  const spec = g.activeSpecs(storm.agent).find(s => s.effectId === 'rust_siphon');
  const witnessed = g.activeSpecs(chained.agent).find(s => s.effectId === 'possession_phase');
  state._abilityHistoryByUnit = { [chained.id]: [{ spec: witnessed, sequence: 5, round: 2 }] };
  g.setMeterValue(storm.agent, 'error', 100);
  assert(g.applyStructuredAbility(storm.agent, storm, chained, state, [], () => .99, spec));
  return { storm, chained, state, row: g.groupEventsToRows(state.events)[0].rows[0] };
}

for (const side of ['ally', 'enemy']) {
  const { storm, chained, state, row } = siphon(34200, side);
  const events = state.events;
  assert.deepEqual(events.map(e => e.type), ['cast', 'status', 'status', 'damage', 'story', 'shield', 'status', 'status', 'damage', 'death']);
  assert.match(events[1].text, /spends 100 Theft/);
  assert.match(events[2].text, /steals one paid use/);
  assert.equal(events[3].hpLoss, 59201);
  assert.equal(events[3].shieldAfter, 0, 'triggering hit must not consume or claim the newly gained shield');
  assert.equal(events[5].amount, 104855);
  assert.equal(events[8].incoming, 59201, '100% HP-loss echo must not receive the global ×2 a second time');
  assert.equal(events[8].hpLoss, 34200, 'display actual loss, capped by the victim’s remaining HP');
  assert.equal(storm.alive, false);
  assert.equal(chained.shield, 104855);
  assert.equal(g.groupEventsToRows(events)[0].rows.length, 1, 'nested effects remain inside their causing cast');
  assert.deepEqual(row.timeline.map(s => s.type), ['note', 'note', 'damage', 'mythical', 'shield', 'note', 'note', 'reaction', 'death']);
  for (const details of [false, true]) {
    const html = ui.renderTurnRowHtml(row, details);
    const fragments = ['spends 100 Theft', 'steals one paid use', '−59.2K HP', 'MYTHICAL FORM AWAKENING', '+104.9K Shield', 'afflicts Storm Beast', 'Reaction · Chained Seq 0', '−34.2K HP', 'Storm Beast falls.'];
    let last = -1;
    for (const fragment of fragments) {
      const index = html.indexOf(fragment);
      assert(index > last, `${side}: ${fragment} must follow its cause with details=${details}`);
      last = index;
    }
  }
  const replay = ui.calculateCurrentHp([{ id: chained.id, name: chained.name, hp: 200000, maxHp: 349517 }], [{ id: storm.id, name: storm.name, hp: 34200, maxHp: 300000 }], [row]);
  assert.equal(replay[chained.id].curHp, 140799);
  assert.equal(replay[chained.id].curShield, 104855, 'reconstruction must apply awakening shield after the original hit');
  assert.equal(replay[storm.id].curHp, 0);
  assert.equal(replay[storm.id].alive, false);
}
const uncapped = siphon(1000000);
const direct = uncapped.state.events.find(e => e.type === 'damage' && e.actorId === uncapped.storm.id);
const echo = uncapped.state.events.find(e => e.type === 'damage' && e.actorId === uncapped.chained.id);
assert.equal(echo.incoming, direct.hpLoss);
assert.equal(echo.hpLoss, Math.round(echo.incoming * g.pathwayIncomingDamageScale(uncapped.storm)), 'target vulnerability still modifies the echo');
const mitigated = siphon(1000000, 'enemy', false);
const reduced = mitigated.state.events.find(e => e.type === 'damage' && e.actorId === mitigated.chained.id);
assert.equal(reduced.hpLoss, Math.round(reduced.incoming * g.pathwayIncomingDamageScale(mitigated.storm) * .5), 'target mitigation is retained');

// A death/revival and an intervening recovery cannot be sorted into type buckets.
const target = { id: 'target', name: 'Target', hp: 100, maxHp: 100, alive: true };
const steps = [
  { type: 'damage', event: { targetId: 'target', targetName: 'Target', hpLoss: 100, hpAfter: 0 } },
  { type: 'death', event: { targetId: 'target', targetName: 'Target' } },
  { type: 'revive', event: { targetId: 'target', targetName: 'Target', hpAfter: 40, text: 'Target revives.' } },
  { type: 'heal', event: { targetId: 'target', targetName: 'Target', amount: 20, hpAfter: 60 } },
  { type: 'damage', event: { targetId: 'target', targetName: 'Target', hpLoss: 10, hpAfter: 50 } }
];
const row = { actorName: 'Caster', ability: 'Multi-hit', timeline: steps };
const html = ui.renderTurnRowHtml(row, false);
assert(!html.includes('b-multihit-group'), 'intervening events must prevent hit aggregation');
assert(html.indexOf('−100 HP') < html.indexOf('Target revives.'));
assert(html.indexOf('Target revives.') < html.indexOf('+20 HP'));
assert(html.indexOf('+20 HP') < html.indexOf('−10 HP'));
const replay = ui.calculateCurrentHp([target], [], [row]).target;
assert.equal(replay.curHp, 50);
assert.equal(replay.alive, true);

const striker = unit('error', 'Striker', 50, 1000), warder = unit('fool', 'Warder', 1000);
striker._formUsed = warder._formUsed = true;
warder._reflect = { mode: 'share', share: 1, element: 'dark' };
const reflectedState = { allies: [striker], enemies: [warder], currentRound: 1, events: [
  { type: 'cast', round: 1, actorId: striker.id, actorName: striker.name, ability: 'Strike' }
] };
g.resolveIncoming(striker, warder, 100, reflectedState, [], () => .99, { damageType: 'physical' });
assert.deepEqual(reflectedState.events.map(event => event.type), ['cast', 'damage', 'damage', 'death']);
assert.equal(reflectedState.events[2].isReflect, true);
assert.equal(reflectedState.events[3].targetId, striker.id);
const reflectedRow = g.groupEventsToRows(reflectedState.events)[0].rows[0];
assert.deepEqual(reflectedRow.timeline.map(step => step.type), ['damage', 'reflect', 'death']);

console.log('PASS chronological combat log (both sides, immediate awakening echo, target mitigation, ordered replay and interleaved multi-hit effects)');
