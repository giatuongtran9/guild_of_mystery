'use strict';
// Counter changes are presentation metadata only: the reacting character keeps
// the old counter damage, one chance roll, and reaction lifecycle.
const { g, assert, world } = require('./phase3-test-helpers');
let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('PASS ' + name); }
  finally { g.bindBattle(null); }
}
function fixture(weaponId = 'none', team = 'allies') {
  const w = world('hermit', 9, team);
  w.a.weaponId = weaponId;
  w.u.hp = w.u.maxHp = 100000;
  w.v.hp = w.v.maxHp = 100000;
  w.v.shield = 17;
  w.a.sp = 100;
  w.a.cooldowns = { remembered_spell: 2 };
  w.u._nextAttackMiss = 1;
  w.u._nextCritFail = 1;
  return w;
}

for (const [weaponId, kind] of [
  ['none', 'unarmed'], ['knife', 'weapon'], ['sword', 'weapon'],
  ['club', 'weapon'], ['pistol', 'gun'], ['epic_pistol', 'gun'],
  ['epic_revolver', 'gun']
]) {
  test(`${weaponId}: counter owns the equipped weapon cue without normal-attack mechanics`, () => {
    const w = fixture(weaponId), lines = [];
    const before = { hp: w.u.hp, sp: w.a.sp, cooldowns: { ...w.a.cooldowns } };
    let rolls = 0;
    g.maybeCounter(w.u, w.v, w.state, lines, () => { rolls++; return 0; });
    assert.equal(rolls, 1, 'only the existing counter chance is rolled');
    const [cast, hit] = w.state.events;
    assert.deepEqual(w.state.events.map(event => event.type), ['cast', 'damage']);
    assert.equal(cast.ability, 'Counter', 'the log still labels the reaction Counter');
    assert.equal(cast.abilityId, 'basic_attack');
    assert.equal(cast.attackKind, kind);
    assert.equal(cast.weaponId, weaponId);
    assert.equal(cast.sourcePath, 'hermit', 'a caster with bare hands still gets a punch');
    assert.equal(cast.actorId, w.u.id);
    assert.equal(cast.isCounter, true);
    assert.equal(cast.costSP, 0);
    assert.equal(cast.cooldown, 0);
    // Equal Sequence, no pathway authority matchup, and a passive-free victim.
    // Counters retain their legacy 38% ATK + weapon ATK - 15% DEF formula.
    const weaponAtk = g.WEAPONS[weaponId].atk;
    const raw = Math.max(1, Math.round(123 * .38 + weaponAtk - 97 * .15));
    const expected = Math.round(raw * g.GLOBAL_COMBAT.damage);
    assert.equal(hit.amount, expected);
    assert.equal(hit.absorbed, Math.min(17, expected));
    assert.equal(hit.hpLoss, Math.max(0, expected - 17));
    assert.equal(hit.targetId, w.v.id);
    assert.equal(hit.actorId, w.u.id);
    assert.equal(hit.isCounter, true);
    assert.equal(hit.damageType, 'physical');
    assert(!hit.critical, 'an equipped first-shot weapon cannot turn a counter into its opening basic');
    assert.equal(w.u.hp, before.hp, 'no recoil or normal-attack weapon hook runs');
    assert.equal(w.a.sp, before.sp);
    assert.deepEqual(w.a.cooldowns, before.cooldowns);
    assert.equal(w.u._nextAttackMiss, 1);
    assert.equal(w.u._nextCritFail, 1);
    assert.equal(w.a._weaponState, undefined);
    assert.deepEqual(w.state.weaponUsage, {});
    const row = g.groupEventsToRows(w.state.events)[0].rows[0];
    for (const field of ['ability', 'abilityId', 'attackKind', 'weaponId', 'sourcePath', 'isCounter'])
      assert.equal(row[field], cast[field], `grouping preserves ${field}`);
    assert.deepEqual(row.timeline, [{ type: 'damage', event: hit }]);
  });
}

test('an enemy counter uses its own pistol and remains after the incoming hit', () => {
  const w = fixture('pistol', 'enemies');
  const originalCast = { round: 1, type: 'cast', actorId: w.v.id, actorName: w.v.name,
    actorTeam: 'ally', ability: 'Attack', abilityId: 'basic_attack', attackKind: 'unarmed' };
  const originalHit = { round: 1, type: 'damage', actorId: w.v.id, actorName: w.v.name,
    actorTeam: 'ally', targetId: w.u.id, targetName: w.u.name, targetTeam: 'enemy', amount: 23, hpLoss: 23 };
  w.state.events.push(originalCast, originalHit);
  g.maybeCounter(w.u, w.v, w.state, [], () => 0);
  const rows = g.groupEventsToRows(w.state.events)[0].rows;
  assert.equal(rows.length, 2);
  assert.equal(rows[0].actorId, w.v.id);
  assert.deepEqual(rows[0].timeline, [{ type: 'damage', event: originalHit }]);
  assert.equal(rows[1].actorId, w.u.id);
  assert.equal(rows[1].actorTeam, 'enemy');
  assert.equal(rows[1].attackKind, 'gun');
  assert.equal(rows[1].weaponId, 'pistol');
  assert.equal(rows[1].timeline[0].event.targetId, w.v.id);
});

test('counter weapon metadata does not turn a reaction into a Thread Binding action', () => {
  const w = world('fool', 0);
  w.b.weaponId = 'pistol';
  assert(g.applySpiritThread(w.a, w.v, w.u, w.state, [], () => .99));
  g.tickSpiritThread(w.v, w.state, []);
  const before = JSON.parse(JSON.stringify(w.v.thread));
  const eventStart = w.state.events.length;
  g.maybeCounter(w.v, w.u, w.state, [], () => 0);
  assert.deepEqual(w.v.thread, before);
  const events = w.state.events.slice(eventStart);
  assert(events.some(event => event.type === 'cast' && event.isCounter && event.attackKind === 'gun'));
  assert(!events.some(event => event.type === 'thread'));
});

test('failed counter chance and dead participants do not invent attack cues', () => {
  const w = fixture('pistol');
  let rolls = 0;
  g.maybeCounter(w.u, w.v, w.state, [], () => { rolls++; return .99; });
  assert.equal(rolls, 1);
  assert.deepEqual(w.state.events, []);
  for (const unit of [w.u, w.v]) {
    unit.alive = false;
    g.maybeCounter(w.u, w.v, w.state, [], () => { throw Error('dead participants must not roll'); });
    unit.alive = true;
  }
  assert.deepEqual(w.state.events, []);
});

console.log(`Counter weapon presentation: ${passed} checks passed`);
