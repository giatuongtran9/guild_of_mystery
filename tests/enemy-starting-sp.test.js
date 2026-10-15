'use strict';
const assert = require('node:assert/strict');
const g = require('../js/node-loader');
const loadout = require('../scripts/permanent-asset-loadouts');
const copy = value => JSON.parse(JSON.stringify(value));
let checks = 0;
function check(name, fn) { fn(); checks++; console.log(`PASS ${name}`); }
function hero(path = 'door', sequence = 8) {
  const a = g.makeAgent(() => .5, { path, sequence, trait: 'Stout Vitality' });
  Object.assign(a, { id: 'guild-agent', name: 'Guild agent', path, sequence, awakened: true,
    injuries: 0, madness: 0, weaponId: 'none', weaponMastery: {} });
  g.restatAgent(a); a.sp = g.maxSPFor(a); return a;
}
function quest(sequence = 8) {
  return { id: 'starting-sp', name: 'Starting SP probe', kind: 'contract', encounter: true,
    objective: 'combat', difficultySequence: sequence, enemyCount: 1, enemyPath: 'door',
    roundLimit: 1, rewards: { funds: 0, reputation: 0, materials: {} } };
}
function initialEnemy(result) { return result.battleSnapshot.initialUnits.find(u => u.team === 'enemy' && !u.summoned); }
function fullSP(unit) { assert(unit.maxSP > 0); assert.equal(unit.sp, unit.maxSP); }

check('all 22 generated pathways enter with full SP at every awakened Sequence', () => {
  for (const path of g.PATH_KEYS) for (let sequence = 9; sequence >= 0; sequence--) {
    fullSP(g.makeEnemy(sequence, () => .5, 0, path));
  }
  assert.equal(g.makeEnemy(10, () => .5, 0).sp, 0, 'ordinary humans retain zero starting SP');
});

check('ordinary contracts and simulator opponents have full SP before round-one regeneration', () => {
  const a = hero(), original = copy(a);
  for (const decisions of [{ individual: true }, { individual: true, simulationOpponents: [{ path: 'door', sequence: 8 }] }]) {
    const result = g.resolveQuest([a], quest(), 821, decisions);
    fullSP(initialEnemy(result));
    const firstResources = result.events.find(event => event.type === 'resources');
    fullSP(firstResources.units.find(u => u.team === 'enemy'));
  }
  assert.deepEqual(a, original, 'combat must not modify persistent player resources');
});

check('authored enemies fill their final maximum after either legacy or catalog SP traits', () => {
  const a = hero();
  for (const traitProfile of [{ trait: 'Fervent Spirit' }, { traitId: 'fervent_spirit' }]) {
    const spec = { path: 'door', sequence: 8, ...traitProfile };
    const result = g.resolveQuest([a], quest(), 821, { individual: true, authoredOpponents: [spec] });
    const enemy = initialEnemy(result);
    assert(enemy.maxSP > g.maxSPFor(a), 'the authored trait must increase the final SP capacity');
    fullSP(enemy);
  }
  const result = g.resolveQuest([a], quest(), 821, {
    individual: true, simulationOpponents: [{ path: 'door', sequence: 8, traitId: 'fervent_spirit' }]
  });
  fullSP(initialEnemy(result));
});

check('explicit authored SP, including zero, remains authoritative and clamps at maximum', () => {
  const a = hero();
  for (const sp of [0, 40, 1e6]) {
    const result = g.resolveQuest([a], quest(), 821, { individual: true,
      authoredOpponents: [{ path: 'door', sequence: 8, traitId: 'fervent_spirit', sp }] });
    const enemy = initialEnemy(result);
    assert.equal(enemy.sp, Math.min(sp, enemy.maxSP));
  }
  a.sp = 0;
  const result = g.resolveQuest([a], quest(), 821, { individual: true });
  assert.equal(result.battleSnapshot.initialUnits.find(u => u.id === a.id).sp, 0,
    'an exhausted player must not be refilled by the enemy default');
  assert.equal(a.sp, 0);
});

check('the protected chapter enemy starts with full SP', () => {
  const state = g.newGame(), a = hero('fool', 9); a.weaponId = 'knife'; state.roster = [a];
  for (const [id, choice] of [['open_doors', null], ['follow_whispers', 'interviews'], ['seal_and_supply', 'ward']]) {
    const started = g.campaignStart(state, id, [a.id], choice, 821);
    assert(started.ok, started.reason); assert(g.campaignSettle(state).ok);
  }
  const started = g.campaignStart(state, 'last_bell', [a.id], null, 821);
  assert(started.ok, started.reason); fullSP(started.pending.initialEnemies[0]);
});

check('Wanted bosses retain full starting SP', () => {
  const roster = ['fool', 'door', 'moon'].map(path => hero(path, 9));
  const wanted = g.makeWantedQuest(999, () => .5, roster, 'red_knife');
  fullSP(g.makeBossEnemy(wanted, () => .5));
});

check('companion entry preserves beast/device zero SP and stored marionette SP', () => {
  for (const [path, sequence] of [['moon', 8], ['paragon', 6], ['fool', 5]]) {
    const a = hero(path, sequence); loadout(g, a, 'rare');
    if (path === 'fool') for (const asset of a.pathwayInventory.assets) if (asset.kind === 'marionette') asset.sp = 7;
    const result = g.resolveQuest([a], quest(sequence), 821, { individual: true });
    const companions = result.battleSnapshot.initialUnits.filter(u => u.team === 'ally' && u.summoned);
    assert(companions.length > 0);
    for (const companion of companions) assert.equal(companion.sp, path === 'fool' ? 7 : 0);
  }
});

console.log(`${checks} starting-SP checks passed.`);
