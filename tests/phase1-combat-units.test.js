// Phase 1 contracts for real combat construction, side parity and resources.
// Plain Node + assert; no dependencies, browser storage or source instrumentation.
const assert = require('assert');
const g = require('../js/node-loader.js');
const balance = require('../data/balance.json');
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`PASS ${name}`); }
  catch (err) { failed++; console.log(`FAIL ${name}: ${err.message.split('\n').slice(0, 5).join(' ').slice(0, 500)}`); }
}
const clone = value => JSON.parse(JSON.stringify(value));
function agent(path, sequence, id = 'A') {
  const a = g.makeAgent(() => .5, { path, sequence: 10, trait: 'Stout Vitality' });
  Object.assign(a, { id, name: id, path, sequence, awakened: true, recommendedPath: null,
    injuries: 0, madness: 0, weaponId: 'none', weaponMastery: {}, cooldowns: {},
    statVariance: { hp: 1, atk: 1, def: 1, int: 1, speed: 1 }, speedVariance: 1 });
  g.restatAgent(a);
  a.sp = g.maxSPFor(a);
  return a;
}
function quest(sequence = 9) {
  return { id: 'unit-probe', name: 'Unit probe', story: '', objective: 'combat',
    encounter: true, mundane: false, difficultySequence: sequence, enemyCount: 1,
    rewards: { funds: 0, reputation: 0, materials: {} } };
}
function profile(a) {
  return { name: a.name, path: a.path, sequence: a.sequence, trait: a.trait,
    stats: clone(a.stats), sp: a.sp, weaponId: a.weaponId,
    weaponMastery: clone(a.weaponMastery) };
}
function world(a, b) {
  const ua = g.makeCombatUnit(a), ub = g.makeCombatUnit(b);
  return { ua, ub, state: { allies: [ua], enemies: [ub], currentRound: 1,
    events: [], balanceTrace: [], weaponUsage: {} } };
}
function rngValues(values) { return () => values.length ? values.shift() : .99; }
function battleSignature(result) {
  const snapshot = result.battleSnapshot;
  return {
    units: [...snapshot.allies, ...snapshot.enemies]
      .map(x => ({ name: x.name, hp: x.hp, maxHp: x.maxHp, alive: x.alive }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    attacks: snapshot.balanceTrace.map(t => ({ round: t.round, attacker: t.attacker,
      target: t.target, ability: t.abilityId, raw: t.raw, final: t.final,
      critical: t.critical, resistance: t.resistance })),
    outcomes: (result.events || []).filter(e => ['cast', 'miss', 'revive', 'damage', 'heal'].includes(e.type))
      .map(e => ({ round: e.round, type: e.type, actor: e.actorName,
        target: e.targetName, ability: e.ability, amount: e.amount }))
  };
}

for (const path of g.PATH_KEYS) {
  for (const sequence of [9, 5, 0]) {
    test(`${path} Seq ${sequence}: generated foes have a separate persistent agent and matching identity`, () => {
      const e = g.makeEnemy(sequence, () => .5, 0, path);
      assert(e.agent, 'generated enemy has no persistent .agent');
      assert.notStrictEqual(e.agent, e, 'combat agent must not refer to its own wrapper');
      assert.strictEqual(e.agent.path, e.path);
      assert.strictEqual(e.agent.sequence, e.sequence);
      assert.deepStrictEqual(e.agent.stats, e.stats);
      assert.strictEqual(e.agent.sp, e.sp);
      assert.strictEqual(e.agent.maxSP, e.maxSP);
      assert.strictEqual(g.unlockedAbilities(e.agent).length, 10 - sequence);
      assert.doesNotThrow(() => JSON.stringify(e), 'combat unit must serialize without cycles');
    });
  }
}

test('ordinary enemy initial SP stays zero; explicit authored profile starts at its configured SP', () => {
  assert.strictEqual(g.makeEnemy(9, () => .5, 0, 'error').sp, 0);
  const a = agent('error', 9), b = agent('error', 9, 'B');
  b.sp = 40;
  const result = g.resolveQuest([a], quest(), 15,
    { individual: true, authoredOpponents: [profile(b)] });
  const cast = result.events.find(e => e.actorName === 'B' && e.type === 'cast');
  assert(cast && cast.ability === 'Combat Theft', 'explicit enemy SP must fund its first cast');
});

test('real lower-Sequence enemy basic attacks respect a Sequence 4 allied authority lock', () => {
  const a = agent('fool', 4);
  a.stats = { hp: 1e7, atk: 1, def: 1, int: 1 };
  const b = agent('fool', 9, 'B');
  b.stats = { hp: 1e7, atk: 100, def: 1, int: 10000 };
  b.sp = 0;
  const result = g.resolveQuest([a], quest(), 13,
    { individual: true, authoredOpponents: [profile(b)] });
  assert(!result.battleSnapshot.balanceTrace.some(t => t.attacker === 'B'),
    'Sequence 9 foe damaged a Sequence 4 ally despite the basic-attack authority lock');
});

test('real enemy-to-ally basics use the defender pathway and Sequence for the matchup multiplier', () => {
  const a = agent('fool', 9);
  a.stats = { hp: 1e6, atk: 1, def: 1, int: 1 };
  const b = agent('error', 9, 'B');
  b.stats = { hp: 1e6, atk: 100, def: 1, int: 100 };
  b.sp = 0;
  const result = g.resolveQuest([a], quest(), 20,
    { individual: true, authoredOpponents: [profile(b)] });
  const first = result.battleSnapshot.balanceTrace.find(t => t.attacker === 'B' && t.abilityId === 'basic_attack');
  assert(first, 'fixture must exercise an enemy basic attack');
  assert.strictEqual(first.raw, 100 * g.damageMultiplier(9, 9, 'error', 'fool'));
});

test('a non-Fool foe keeps SP spent on its cast and regenerates from that remainder next round', () => {
  const a = agent('fool', 9);
  a.stats = { hp: 1e6, atk: 1, def: 1, int: 1 };
  const b = agent('door', 8, 'B');
  b.stats = { hp: 1e6, atk: 1, def: 1, int: 1 };
  b.sp = 0;
  const result = g.resolveQuest([a], quest(8), 8,
    { individual: true, authoredOpponents: [profile(b)] });
  const casts = result.events.filter(e => e.actorName === 'B' && e.type === 'cast' && e.costSP > 0);
  assert(casts.length >= 2, 'fixture must exercise repeated actual enemy casts');
  const regen = balance.archetype_stat_progression[g.archetypeOf('door')]['Seq 8'].sp_regen;
  let previousRound = 0, available = 0;
  for (const cast of casts) {
    available = Math.min(g.maxSPFor(b), available + (cast.round - previousRound) * regen);
    assert(available >= cast.costSP,
      `round ${cast.round}: foe cast costs ${cast.costSP} but only ${available} SP was earned`);
    available -= cast.costSP;
    previousRound = cast.round;
  }
  const rounds = result.events.filter(e => e.type === 'round_start').length;
  available = Math.min(g.maxSPFor(b), available + (rounds - previousRound) * regen);
  assert.strictEqual(result.battleSnapshot.enemies.find(e => e.name === 'B').sp, available,
    'final foe SP must retain every cast deduction, including rounds with no cast');
});

test('basic physical hits can trigger surviving foe counters just as surviving ally counters', () => {
  const attacker = agent('fool', 9), defender = agent('visionary', 8, 'B');
  attacker.sequence = 8;
  attacker.stats = { hp: 10000, atk: 100, def: 20, int: 100 };
  defender.stats = { hp: 10000, atk: 100, def: 20, int: 100 };
  const enemy = g.makeEnemy(8, () => .5, 0, 'visionary');
  enemy.name = 'B'; enemy.hp = enemy.maxHp = 10000;
  enemy.stats = clone(defender.stats);
  enemy.atk = 100; enemy.def = 20; enemy.int = 100;
  if (enemy.agent) enemy.agent.stats = clone(defender.stats);
  const ally = { id: attacker.id, name: attacker.name, agent: attacker,
    path: attacker.path, sequence: attacker.sequence, hp: 10000, maxHp: 10000,
    alive: true, inCombat: true, status: [], statusMeta: {} };
  const state = { allies: [ally], enemies: [enemy], currentRound: 1,
    events: [], balanceTrace: [], weaponUsage: {} }, lines = [];
  g.attackOnce(attacker, ally, enemy, state, lines, rngValues([.99, .99, .99, 0]));
  assert(lines.some(l => /B counters/.test(l.text)), 'surviving foe never reacted with a counter');
  assert(ally.hp < 10000, 'counter must actually damage the attacker');
});

test('Darkness enemy initiative receives the same passive bonus as an allied Darkness agent', () => {
  const a = agent('darkness', 9);
  const b = agent('darkness', 9, 'B');
  b.stats = clone(a.stats);
  const result = g.resolveQuest([a], quest(), 8,
    { individual: true, authoredOpponents: [profile(b)] });
  const order = result.events.find(e => e.type === 'system' && e.subtype === 'initiative');
  assert(order, 'fixture must exercise actual turn ordering');
  const scores = [...order.details.matchAll(/([AB]) ([\d.]+)/g)];
  assert.strictEqual(scores.length, 2, 'must find both participants in initiative output');
  assert.strictEqual(Number(scores[0][2]), Number(scores[1][2]), 'equal Darkness profiles have different initiative');
});

test('common ally construction exposes effective injured stats without mutating roster base stats', () => {
  const a = agent('fool', 8);
  a.injuries = 100;
  const before = clone(a), unit = g.makeCombatUnit(a);
  assert.deepStrictEqual(unit.agent.stats, g.effectiveStats(a));
  assert.deepStrictEqual(unit.stats, g.effectiveStats(a));
  assert.strictEqual(unit.path, a.path);
  assert.strictEqual(unit.sequence, a.sequence);
  assert.deepStrictEqual(a, before, 'combat construction mutated its roster input');
});

test('SP drains reduce the same resource used by an allied caster on its next action', () => {
  const a = agent('justiciar', 8), b = agent('fool', 8, 'B');
  const { ua, ub, state } = world(a, b);
  ub.agent.sp = 30;
  const spec = clone(g.activeSpecs(ua.agent).find(s => s.effectId === 'fines_penalties'));
  g.applyStructuredAbility(ua.agent, ua, ub, state, [], () => .99, spec);
  assert.strictEqual(ub.agent.sp, 20);
  assert.strictEqual(ub.sp, 20, 'wrapper SP differs from its caster resource');
});

test('a +50% cost penalty deducts and logs the increased cost rather than only blocking readiness', () => {
  const a = agent('fool', 8), b = agent('door', 8, 'B');
  const { ua, ub, state } = world(a, b);
  ua.agent._spCostMultiplier = .5;
  const spec = clone(g.activeSpecs(ua.agent).find(s => s.effectId === 'paper_card_dagger'));
  const before = ua.agent.sp, cost = Math.round(spec.costSP * 1.5);
  g.applyStructuredAbility(ua.agent, ua, ub, state, [], () => .99, spec);
  assert.strictEqual(before - ua.agent.sp, cost);
  assert.strictEqual(state.events.find(e => e.type === 'cast').costSP, cost);
});

for (const allied of [true, false]) {
  test(`a ${allied ? 'friendly' : 'hostile'} battle marionette has matching combat identity and the captured trait`, () => {
    const ownerAgent = agent('fool', 5, 'Owner');
    ownerAgent._teamDamageMultiplier = allied ? 1 : balance.combat_balance.enemyDamageParty;
    const targetAgent = agent('error', 5, 'Captured');
    targetAgent.trait = 'Glass Cannon';
    const owner = { id: ownerAgent.id, name: ownerAgent.name, agent: ownerAgent, alive: true };
    const target = { id: targetAgent.id, name: targetAgent.name, agent: targetAgent,
      sequence: targetAgent.sequence, path: targetAgent.path, maxHp: targetAgent.stats.hp };
    const state = { allies: allied ? [owner] : [], enemies: allied ? [] : [owner],
      rng: () => .5, events: [], battleMarionettes: [] };
    g.joinMarionette(state, ownerAgent, target, []);
    const unit = state.battleMarionettes[0].unit;
    assert(unit.agent && unit.agent !== unit, 'marionette needs a persistent, noncyclic combat agent');
    assert.strictEqual(unit.path, targetAgent.path);
    assert.strictEqual(unit.sequence, targetAgent.sequence);
    assert.strictEqual(unit.agent.trait, targetAgent.trait);
    assert.deepStrictEqual(unit.stats, unit.agent.stats);
    assert.strictEqual(unit.agent._teamDamageMultiplier, ownerAgent._teamDamageMultiplier,
      'summon must inherit the configured owner team damage factor');
    assert.doesNotThrow(() => JSON.stringify(unit));
  });
}

test('real Bizarro Transformation fractional evasion permits a strike above its Dodge rate', () => {
  const a = agent('fool', 4), b = agent('fool', 4, 'B');
  const { ua, ub, state } = world(a, b);
  const spec = clone(g.activeSpecs(ub.agent).find(s => s.effectId === 'bizarro_transformation'));
  g.applyStructuredAbility(ub.agent, ub, ua, state, [], () => .99, spec);
  assert.strictEqual(ub.statusMeta.evade.dodgeRate, .5, 'actual skill must grant its authored fractional rate');
  const before = ub.hp;
  g.attackOnce(ua.agent, ua, ub, state, [], () => .99);
  assert(ub.hp < before, 'fractional evasion must allow a high-roll attack to land');
});

for (const [path, id] of [['door', 'blink_strike'], ['white_tower', 'prophetic_evade']]) {
  test(`${path}: full or unspecified evasion retains complete avoidance`, () => {
    const a = agent('fool', 5), b = agent(path, 5, 'B');
    const { ua, ub, state } = world(a, b);
    const spec = clone(g.activeSpecs(ub.agent).find(s => s.effectId === id));
    g.applyStructuredAbility(ub.agent, ub, ua, state, [], () => .99, spec);
    assert(g.hasStatus(ub, 'evade'));
    const before = ub.hp;
    g.attackOnce(ua.agent, ua, ub, state, [], () => .99);
    assert.strictEqual(ub.hp, before);
  });
}

test('actual counters emit a Counter cast followed by typed damage under the reacting actor', () => {
  const a = agent('visionary', 8), b = agent('visionary', 8, 'B');
  const { ua, ub, state } = world(a, b);
  const before = ua.hp;
  g.maybeCounter(ub, ua, state, [], () => 0);
  const cast = state.events.find(e => e.type === 'cast' && e.ability === 'Counter');
  const hit = state.events.find(e => e.type === 'damage' && e.isCounter);
  assert(cast && hit, 'reactive hit must be visible in structured battle events');
  assert.strictEqual(cast.actorId, ub.id);
  assert.strictEqual(hit.actorId, ub.id);
  assert.strictEqual(hit.targetId, ua.id);
  assert.strictEqual(hit.amount, before - ua.hp);
  assert.strictEqual(hit.damageType, 'physical');
  assert(state.events.indexOf(cast) < state.events.indexOf(hit));
});

test('a target that automatically revives from the hit cannot counter that lethal hit', () => {
  const a = agent('fool', 1), b = agent('wheel_of_fortune', 1, 'B');
  a.stats = { hp: 1e6, atk: 1e6, def: 100, int: 100 };
  b.stats = { hp: 1000, atk: 100, def: 10, int: 100 };
  const { ua, ub, state } = world(a, b);
  const lines = [];
  g.attackOnce(ua.agent, ua, ub, state, lines, rngValues([.99, .99, .99, .99, 0]));
  assert(ub.alive && ub._revived, 'fixture must actually exercise automatic lethal-hit revival');
  assert(!lines.some(l => /counters for/.test(l.text)), 'lethal hit grants a premature post-revival counter');
});

test('repeated weapon Bleed keeps bounded source metadata rather than embedding combat-agent snapshots', () => {
  const a = agent('fool', 9), b = agent('fool', 9, 'B');
  a.weaponId = b.weaponId = 'knife';
  a.stats = b.stats = { hp: 1e6, atk: 100, def: 20, int: 100 };
  const { ua, ub, state } = world(a, b);
  for (let i = 0; i < 12; i++) {
    g.attackOnce(ua.agent, ua, ub, state, [], rngValues([.99, .99, .99, 0, .99]));
    g.attackOnce(ub.agent, ub, ua, state, [], rngValues([.99, .99, .99, 0, .99]));
  }
  assert(g.hasStatus(ua, 'bleed') && g.hasStatus(ub, 'bleed'), 'fixture must repeatedly inflict real weapon Bleed');
  assert(JSON.stringify(ua.statusMeta).length < 512 && JSON.stringify(ub.statusMeta).length < 512,
    'status metadata grows by nesting whole previous combat records');
  assert.doesNotThrow(() => JSON.stringify(state));
});

test('damaging skills preserve the legacy flat enemy profile API', () => {
  const a = agent('fool', 8), actor = g.makeCombatUnit(a);
  const enemy = { id: 'flat', name: 'Flat enemy', path: 'door', sequence: 8,
    hp: 100000, maxHp: 100000, atk: 100, def: 20, int: 100,
    alive: true, inCombat: true, status: [], statusMeta: {}, weaponId: 'none' };
  const state = { allies: [actor], enemies: [enemy], currentRound: 1,
    events: [], balanceTrace: [], weaponUsage: {} };
  const spec = clone(g.activeSpecs(actor.agent).find(s => s.effectId === 'paper_card_dagger'));
  assert.doesNotThrow(() => g.applyStructuredAbility(actor.agent, actor, enemy, state, [], () => .99, spec));
  assert(enemy.hp < enemy.maxHp, 'flat profile must receive an actual damaging hit');
});

test('basic lifesteal event reports actual recovery capped by the attacker remaining health', () => {
  const a = agent('fool', 9), b = agent('fool', 9, 'B');
  a.trait = 'Bloodthirst';
  const { ua, ub, state } = world(a, b);
  ua.hp = ua.maxHp - 1;
  g.attackOnce(ua.agent, ua, ub, state, [], () => .99);
  const heal = state.events.find(e => e.type === 'heal' && e.actorId === ua.id);
  assert(heal, 'fixture must exercise actual basic lifesteal');
  assert.strictEqual(ua.hp, ua.maxHp);
  assert.strictEqual(heal.amount, 1, 'log must show actual recovered HP rather than uncapped potential recovery');
});

test('a real timed Moon stance expires across quest settlement, save reload and the next encounter', () => {
  const a = agent('moon', 5, 'Moon');
  a.trait = 'Ironclad';
  a.stats = a.baseStats = { hp: 1e7, atk: 1, def: 1, int: 1 };
  const opponent = { name: 'foe', path: 'sun', sequence: 5, stats: clone(a.stats), sp: 0 };
  const first = g.resolveQuest([a], quest(5), 7, { individual: true, authoredOpponents: [opponent] });
  assert(first.events.some(e => e.actorName === 'Moon' && e.ability === 'Vampire Transformation'),
    'first real quest must actually cast the timed stance');
  const guild = g.newGame();guild.roster = [clone(a)];
  g.applyConsequences(guild, first.consequences);
  const loaded = g.migrateSave(JSON.parse(JSON.stringify(guild))),saved = loaded.roster[0];
  assert(saved, 'fixture must survive the first encounter');
  const clean = clone(saved);delete clean._buffs;
  const expected = g.speedFor(g.makeCombatUnit(clean).agent).toFixed(1);
  const second = g.resolveQuest([saved], quest(5), 7, { individual: true, authoredOpponents: [opponent] });
  const order = second.events.find(e => e.subtype === 'initiative');
  assert.strictEqual(order.details.match(/Moon ([\d.]+)/)[1], expected,
    'expired previous-quest stance permanently boosts the next encounter initiative');
  assert.strictEqual(saved._buffs, undefined, 'timed combat cache must not be serialized as a permanent buff');
  assert.strictEqual(saved._partyPassiveEffects, undefined, 'party-derived cache must be recomputed for each encounter');
  assert.deepStrictEqual(saved.stats, a.stats);
  assert.deepStrictEqual(saved.baseStats, a.baseStats);
});

test('settling a real quest removes legacy saved combat cache keys from the existing roster merge', () => {
  const a = agent('fool', 5);
  a.stats = a.baseStats = { hp: 1e7, atk: 1, def: 1, int: 1 };
  Object.assign(a, { _buffs: { atk: 1.6 }, _partyPassiveEffects: [{ type: 'initiative', amount: 50 }] });
  const guild = g.newGame();guild.roster = [clone(a)];
  const result = g.resolveQuest([a], quest(9), 3, { individual: true });
  const sync = result.consequences.find(c => c.type === 'syncAgent');
  assert(sync, 'fixture must survive its actual quest');
  assert.strictEqual(sync.agent._buffs, undefined, 'combat settlement already produces a clean replacement record');
  g.applyConsequences(guild, result.consequences);
  assert.strictEqual(guild.roster[0]._buffs, undefined, 'merge retained a stale key omitted by cleaned syncAgent');
  assert.strictEqual(guild.roster[0]._partyPassiveEffects, undefined);
  const loaded = g.migrateSave(JSON.parse(JSON.stringify(guild)));
  assert.strictEqual(loaded.roster[0]._buffs, undefined);
  assert.strictEqual(loaded.roster[0]._partyPassiveEffects, undefined);
  assert.deepStrictEqual(loaded.roster[0].stats, a.stats);
  assert.deepStrictEqual(loaded.roster[0].baseStats, a.baseStats);
});

test('schema9 reload repairs legacy timed combat caches before dossier rates without changing persistent save data', () => {
  const a = agent('fool', 5);
  Object.assign(a, { digest: 62, madness: 7, corruption: 8, injuries: 20, sp: 28,
    weaponId: 'knife', weaponMastery: { melee: 17 }, cooldowns: { paper_card_dagger: 3 },
    _buffs: { atk: 1.6, speed: 1.15 }, _partyPassiveEffects: [{ type: 'initiative', amount: 50 }],
    _spCostMultiplier: .5, _cooldownPenalty: 2 });
  const guild = g.newGame();guild.roster = [a];guild.funds = 417;guild.day = 18;
  const before = clone(guild),loaded = g.migrateSave(JSON.parse(JSON.stringify(guild))),saved = loaded.roster[0];
  const clean = clone(saved);delete clean._buffs;delete clean._partyPassiveEffects;
  assert.strictEqual(g.speedFor(saved), g.speedFor(clean), 'dossier Speed retained a timerless15% stance');
  assert.strictEqual(g.passiveCombatModifier(saved).atk, g.passiveCombatModifier(clean).atk,
    'dossier passive ATK retained a timerless60% buff');
  for (const key of ['stats', 'baseStats', 'digest', 'madness', 'corruption', 'injuries', 'sp', 'weaponId', 'weaponMastery', 'cooldowns'])
    assert.deepStrictEqual(saved[key], before.roster[0][key], key);
  for (const key of ['funds', 'day', 'materials', 'weapons', 'quests', 'wanted', 'teams', 'campaign'])
    assert.deepStrictEqual(loaded[key], before[key], key);
});

test('a fresh battle clears legacy transient combat caches while preserving progress, equipment, SP and ordinary cooldowns', () => {
  const a = agent('fool', 5);
  Object.assign(a, { digest: 61, madness: 7, corruption: 8, injuries: 20, weaponId: 'knife',
    weaponMastery: { melee: 17 }, sp: 28, cooldowns: { paper_card_dagger: 3 },
    _buffs: { atk: 1.6 }, _spCostMultiplier: .5, _cooldownPenalty: 2,
    _partyPassiveEffects: [{ type: 'initiative', amount: 50 }], _teamDamageMultiplier: 2,
    _threadAttempts: 2, threadTargets: ['old-enemy'], activeThreads: 1 });
  const before = clone(a), unit = g.makeCombatUnit(a);
  assert.strictEqual(unit.agent._buffs, undefined);
  assert.strictEqual(unit.agent._spCostMultiplier, undefined);
  assert.strictEqual(unit.agent._cooldownPenalty, undefined);
  assert.strictEqual(unit.agent._partyPassiveEffects, undefined);
  assert.strictEqual(unit.agent._teamDamageMultiplier, undefined);
  assert.strictEqual(unit.agent._threadAttempts || 0, 0);
  assert.deepStrictEqual(unit.agent.threadTargets, []);
  assert.strictEqual(unit.agent.activeThreads, 0);
  for (const key of ['digest', 'madness', 'corruption', 'injuries', 'weaponId', 'weaponMastery', 'sp', 'cooldowns'])
    assert.deepStrictEqual(unit.agent[key], a[key], `${key} was changed while clearing battle-only fields`);
  assert.deepStrictEqual(a, before, 'entry cleanup mutated the persisted roster input');
});

test('two real Fool quests restore a per-battle thread budget and convert only its pending-lock sentinel to a normal cooldown', () => {
  const a = agent('fool', 5);
  a.stats = a.baseStats = { hp: 1e7, atk: 1, def: 1, int: 1 };
  const opponent = { name: 'foe', path: 'sun', sequence: 5, stats: clone(a.stats), sp: 0 };
  const first = g.resolveQuest([a], quest(5), 1, { individual: true, authoredOpponents: [opponent] });
  assert(first.events.some(e => e.actorName === 'A' && e.ability === 'Thread Binding'),
    'first quest must attempt a real thread');
  const guild = g.newGame();guild.roster = [clone(a)];g.applyConsequences(guild, first.consequences);
  const saved = g.migrateSave(JSON.parse(JSON.stringify(guild))).roster[0];
  assert(saved, 'fixture must survive first quest');
  const second = g.resolveQuest([saved], quest(5), 2, { individual: true, authoredOpponents: [opponent] });
  assert(second.events.some(e => e.actorName === 'A' && e.ability === 'Thread Binding'),
    'previous quest consumed the next encounter per-battle attempt budget');
  const locked = clone(saved);locked.threadTargets = ['discarded-enemy'];locked.activeThreads = 1;
  locked._threadAttempts = 1;locked.cooldowns = { thread_binding: 999, paper_card_dagger: 3 };
  const unit = g.makeCombatUnit(locked);
  const spec = g.activeSpecs(unit.agent).find(s => s.effectId === 'thread_binding');
  assert.strictEqual(unit.agent.cooldowns.thread_binding, spec.cooldown + 1,
    'stale in-progress sentinel must become the authored resolved-thread cooldown');
  assert.strictEqual(unit.agent.cooldowns.paper_card_dagger, 3);
});

test('a real round-15 pending thread normalizes its decremented lock before saving', () => {
  const a = agent('fool', 5, 'F');a.trait = 'Ironclad';
  a.stats = a.baseStats = { hp: 1e7, atk: 1, def: 1, int: 1 };
  const result = g.resolveQuest([a], quest(5), 3, { individual: true,
    authoredOpponents: [{ name: 'foe', path: 'sun', sequence: 5, stats: clone(a.stats), sp: 0 }] });
  const bindings = result.events.filter(e => e.actorName === 'F' && e.ability === 'Thread Binding');
  assert(bindings.some(e => e.round >= 13), 'fixture must leave a thread pending when the real battle times out');
  const saved = result.consequences.find(c => c.type === 'syncAgent').agent;
  const spec = g.activeSpecs(saved).find(s => s.effectId === 'thread_binding');
  assert.strictEqual(saved.cooldowns.thread_binding, spec.cooldown + 1,
    'round regeneration decremented999, but that value is still an in-progress lock');
  assert.deepStrictEqual(saved.threadTargets, []);
  assert.strictEqual(saved.activeThreads, 0);
});

test('battle snapshots retain actual combat identity and injured stats before roster restoration', () => {
  const a = agent('fool', 8);a.injuries = 100;
  const b = agent('door', 8, 'B');
  const result = g.resolveQuest([a], quest(8), 7, { individual: true, authoredOpponents: [profile(b)] });
  const ally = result.battleSnapshot.allies.find(e => e.name === 'A');
  assert.strictEqual(ally.id, a.id);
  assert.strictEqual(ally.path, a.path);
  assert.strictEqual(ally.sequence, a.sequence);
  assert.deepStrictEqual(ally.stats, g.effectiveStats(a), 'snapshot must describe combat stats, not restored roster base stats');
  assert(Number.isFinite(ally.initiative) && ally.initiative > 0);
});

for (const path of g.PATH_KEYS) {
  for (const sequence of [9, 5, 0]) {
    test(`${path} Seq ${sequence}: authored side swaps preserve combat outcomes and definitions`, () => {
      const a = agent(path, sequence), b = agent('fool', sequence, 'B');
      a.stats.atk += 3;
      b.stats.int += 1;
      const beforeA = clone(a), beforeB = clone(b), definitions = JSON.stringify(g.PATHS);
      const run = (ally, foe) => g.resolveQuest([ally], quest(sequence), 613,
        { individual: true, authoredOpponents: [profile(foe)] });
      const first = run(a, b), second = run(b, a), repeated = run(a, b);
      assert.deepStrictEqual(battleSignature(first), battleSignature(second), 'changing teams changed the same profiles’ combat');
      assert.deepStrictEqual(battleSignature(first), battleSignature(repeated), 'repeating a fixed encounter changed its outcome');
      assert.strictEqual(JSON.stringify(g.PATHS), definitions, 'battle mutated global pathway definitions');
      assert.deepStrictEqual(a, beforeA, 'battle mutated the allied roster record');
      assert.deepStrictEqual(b, beforeB, 'battle mutated the opposing profile');
    });
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
