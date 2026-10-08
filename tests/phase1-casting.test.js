// Phase 1 regressions exercise real normalized skills rather than effect-name coverage.
const assert = require('node:assert/strict');

function loadGame() {
  delete require.cache[require.resolve('../js/node-loader.js')];
  return require('../js/node-loader.js');
}

function agent(g, path, sequence, id) {
  const a = g.makeAgent(() => 0.5, { path, sequence: 10 });
  Object.assign(a, {
    id, name: id, path, sequence, awakened: true,
    trait: 'Stout Vitality', weaponId: 'none', weaponMastery: {},
    stats: { hp: 100000, atk: 100, def: 10, int: 100 },
    baseStats: { hp: 100000, atk: 100, def: 10, int: 100 },
    sp: 1000, cooldowns: {}, injuries: 0, madness: 0, resistances: {}
  });
  a.maxSP = g.maxSPFor(a);
  a.sp = a.maxSP;
  return a;
}

function unit(a) {
  return {
    id: a.id, name: a.name, agent: a,
    hp: a.stats.hp, maxHp: a.stats.hp, atk: a.stats.atk,
    def: a.stats.def, int: a.stats.int,
    sp: a.sp, maxSP: a.maxSP,
    alive: true, inCombat: true, distance: 5,
    status: [], statusMeta: {}, resistances: {}
  };
}

function world(g, path = 'door', sequence = 6, enemyPath = 'sun') {
  const a = agent(g, path, sequence, 'caster');
  const b = agent(g, enemyPath, sequence, 'enemy');
  const c = agent(g, enemyPath, sequence, 'second_enemy');
  const d = agent(g, 'sun', sequence, 'teammate');
  const actor = unit(a), enemy = unit(b), second = unit(c), teammate = unit(d);
  const state = {
    allies: [actor, teammate], enemies: [enemy, second],
    balanceTrace: [], weaponUsage: {}, events: [], currentRound: 1
  };
  return { a, b, c, d, actor, enemy, second, teammate, state, lines: [] };
}

function skill(g, a, id) {
  const spec = g.activeSpecs(a).find(x => x.effectId === id);
  assert.ok(spec, `${a.path} ${a.sequence} does not unlock ${id}`);
  return spec;
}

function cast(g, w, id, rng = () => 0.99) {
  return g.applyStructuredAbility(
    w.a, w.actor, w.enemy, w.state, w.lines, rng, skill(g, w.a, id)
  );
}

function witness(g, w, path, sequence, id) {
  const source = agent(g, path, sequence, 'source');
  const spec = skill(g, source, id);
  w.state._abilityHistoryByUnit = {
    [w.enemy.id]: [{ spec, round: w.state.currentRound }]
  };
}

const cases = [];
const test = (name, fn) => cases.push({ name, fn });

for (const [path, copyId] of [
  ['door', 'combat_record'], ['white_tower', 'spell_imitation']
]) {
  test(`${path}: copied AoE retains both targets and its debuffs`, () => {
    const g = loadGame(), w = world(g, path, 1, 'door');
    witness(g, w, 'door', 1, 'star_gate_tear');
    cast(g, w, copyId);
    assert.ok(w.enemy.hp < w.enemy.maxHp, 'selected enemy must take damage');
    assert.ok(w.second.hp < w.second.maxHp, 'copied all-enemy targeting must survive copying');
    assert.equal(w.enemy._debuffs.atk, 0.75);
    assert.equal(w.second._debuffs.def, 0.75);
  });

  test(`${path}: copied reflect support executes once on the copier`, () => {
    const g = loadGame(), w = world(g, path, 2, 'hermit');
    witness(g, w, 'hermit', 2, 'scroll_gate');
    cast(g, w, copyId);
    assert.equal(w.actor._reflect?.share, 0.5, 'copied reflection must be applied');
    assert.equal(w.enemy._reflect, undefined, 'support ward belongs to copier');
    assert.equal(w.lines.filter(x => /reproduces \[/.test(x.text)).length, 1);
  });

  test(`${path}: copied healing support heals and cleanses copier only`, () => {
    const g = loadGame(), w = world(g, path, 6);
    w.actor.hp = w.actor.maxHp / 2;
    g.addStatus(w.actor, 'burn', 2, 'enemy');
    witness(g, w, 'sun', 7, 'purification_halo');
    cast(g, w, copyId);
    assert.equal(w.actor.hp, 62000);
    assert.equal(g.hasStatus(w.actor, 'burn'), false);
    assert.equal(w.enemy.hp, 100000);
    assert.equal(w.teammate.hp, 100000);
  });

  // No current active spell declares all_allies. Exercise the supported target
  // schema with real normalized healing and buff effects, changing only scope.
  test(`${path}: copied party healing and cleansing preserve all_allies scope`, () => {
    const g = loadGame(), w = world(g, path, 6);
    w.actor.hp = w.teammate.hp = 50000;
    g.addStatus(w.actor, 'burn', 2, 'enemy');
    g.addStatus(w.teammate, 'burn', 2, 'enemy');
    witness(g, w, 'sun', 7, 'purification_halo');
    w.state._abilityHistoryByUnit[w.enemy.id][0].spec.effects.push({
      type: 'targeting', mode: 'all_allies'
    });
    cast(g, w, copyId);
    assert.equal(w.actor.hp, 62000);
    assert.equal(w.teammate.hp, 62000);
    assert.equal(g.hasStatus(w.teammate, 'burn'), false);
    assert.equal(w.enemy.hp, 100000);
  });

  test(`${path}: copied party shield and buff preserve all_allies scope`, () => {
    const g = loadGame(), w = world(g, path, 4);
    witness(g, w, 'twilight_giant', 4, 'dawn_guardian_barrier');
    w.state._abilityHistoryByUnit[w.enemy.id][0].spec.effects.push({
      type: 'targeting', mode: 'all_allies'
    });
    cast(g, w, copyId);
    assert.equal(w.actor.shield, 20000);
    assert.equal(w.teammate.shield, 20000);
    assert.equal(w.teammate._buffs.def, 1.25);
    assert.equal(w.enemy.shield || 0, 0);
  });

  test(`${path}: copying never mutates shared PATHS across successive casts and actors`, () => {
    const g = loadGame(), before = JSON.stringify(g.PATHS);
    const first = world(g, path, 2, 'hermit');
    witness(g, first, 'hermit', 2, 'scroll_gate');
    cast(g, first, copyId);
    assert.ok(JSON.stringify(g.PATHS) === before, 'first replay must not modify definitions');
    const second = world(g, path, 2, 'sun');
    witness(g, second, 'sun', 8, 'holy_flash');
    cast(g, second, copyId);
    assert.ok(JSON.stringify(g.PATHS) === before, 'new actor must receive pristine definitions');
    assert.equal(second.actor._reflect, undefined, 'previous copied ward must not leak');
    assert.equal(second.actor._outgoingMultiplier, undefined);
  });

  test(`${path}: real consecutive encounters leave normalized content unchanged`, () => {
    const g = loadGame(), a = agent(g, path, 6, 'copy_agent');
    const before = JSON.stringify(g.PATHS);
    const quest = {
      encounter: true, name: 'Casting regression encounter', story: 'Test fixture',
      difficultySequence: 6, enemyCount: 1, requiredPath: 'sun',
      rewards: { funds: 0, reputation: 0, material: 0 }, dayCost: 1
    };
    let copies = 0;
    for (const seed of [7, 11]) {
      const result = g.resolveQuest([a], quest, seed);
      copies += result.lines.filter(x => /reproduces \[/.test(x.text)).length;
      assert.ok(JSON.stringify(g.PATHS) === before, `encounter seed ${seed} mutated content`);
    }
    assert.ok(copies > 0, 'fixture must actually cast the copying ability');
  });

  test(`${path}: replay charges wrapper SP and cooldown, not copied spell cost`, () => {
    const g = loadGame(), w = world(g, path, 1, 'door');
    const spec = skill(g, w.a, copyId), startSP = w.a.sp;
    witness(g, w, 'door', 1, 'star_gate_tear');
    cast(g, w, copyId);
    assert.equal(w.a.sp, startSP - spec.costSP);
    assert.equal(w.a.cooldowns[copyId], spec.cooldown + 1);
    assert.equal(w.a.cooldowns.star_gate_tear, undefined);
  });
}

test('modified SP cost is charged, rounded, and shown in the cast event', () => {
  const g = loadGame(), w = world(g, 'door', 8);
  w.a._spCostMultiplier = w.actor._spCostMultiplier = 0.5;
  const start = w.a.sp;
  cast(g, w, 'elemental_spark');
  assert.equal(w.a.sp, start - 23);
  assert.equal(w.state.events.find(x => x.type === 'cast').costSP, 23);
});

test('modified SP cost prevents casting when base cost alone is affordable', () => {
  const g = loadGame(), w = world(g, 'door', 8);
  w.a._spCostMultiplier = w.actor._spCostMultiplier = 0.5;
  w.a.sp = 20;
  assert.equal(cast(g, w, 'elemental_spark'), false);
  assert.equal(w.a.sp, 20);
  assert.equal(w.a.cooldowns.elemental_spark, undefined);
  assert.equal(w.enemy.hp, w.enemy.maxHp);
});

test('actual Parasitic Contagion drains the target caster resource', () => {
  const g = loadGame(), w = world(g, 'error', 4);
  w.b.sp = w.enemy.sp = 100;
  cast(g, w, 'parasitic_contagion');
  assert.equal(w.b.sp, 80, 'agent SP is the castable resource');
  assert.equal(w.enemy.sp, 80, 'combat display SP must agree');
});

test('a misfire aura does not cause its own first cast to misfire', () => {
  const g = loadGame(), w = world(g, 'wheel_of_fortune', 3);
  const start = w.a.sp;
  cast(g, w, 'chaos_probability', () => 0.2);
  assert.equal(w.enemy._skillMisfireChance, 0.4);
  assert.equal(w.second._skillMisfireChance, 0.4);
  assert.equal(w.lines.some(x => /misfires due to disorder/.test(x.text)), false);
  assert.equal(w.a.sp, start - 70);
});

test('an applied caster misfire debuff wastes exactly one real cast', () => {
  const g = loadGame(), w = world(g, 'door', 8);
  w.actor._skillMisfireChance = 1;
  const start = w.a.sp;
  cast(g, w, 'elemental_spark', () => 0.5);
  assert.equal(w.enemy.hp, w.enemy.maxHp);
  assert.equal(w.a.sp, start - 15);
  assert.equal(w.a.cooldowns.elemental_spark, 2);
  assert.equal(w.lines.filter(x => /misfires due to disorder/.test(x.text)).length, 1);
});

test('forced miss suppresses a damaging skill and its hostile on-hit effects', () => {
  const g = loadGame(), w = world(g, 'error', 8);
  cast(g, w, 'deceptive_feint');
  assert.equal(w.enemy._nextAttackMiss, 1);
  const hp = w.actor.hp;
  g.applyStructuredAbility(w.b, w.enemy, w.actor, w.state, w.lines, () => 0.99,
    skill(g, w.b, 'holy_flash'));
  assert.equal(w.actor.hp, hp);
  assert.equal(w.actor._hitChanceDebuff || 0, 0);
  assert.equal(w.enemy._nextAttackMiss || 0, 0);
  assert.ok(w.state.events.some(x => x.type === 'miss' && x.actorId === w.enemy.id));
});

test('one forced-miss token consumes one AoE damaging action, including all targets', () => {
  const g = loadGame(), w = world(g, 'door', 1, 'door');
  w.actor._nextAttackMiss = 1;
  cast(g, w, 'star_gate_tear');
  assert.equal(w.enemy.hp, w.enemy.maxHp);
  assert.equal(w.second.hp, w.second.maxHp);
  assert.equal(w.enemy._debuffs, undefined);
  assert.equal(w.second._debuffs, undefined);
  assert.equal(w.actor._nextAttackMiss || 0, 0);
  assert.equal(w.a.cooldowns.star_gate_tear, 5, 'attempted skill still costs its cooldown');
});

test('Spatial Exile uses its declared one victim action before or after that victim acts', () => {
  for (const actedThisRound of [false, true]) {
    const g = loadGame(), w = world(g, 'door', 2);
    w.enemy._actedThisRound = actedThisRound;
    cast(g, w, 'spatial_exile');
    assert.equal(w.enemy._skipTurns, 1, 'one-action banish must not gain a legacy round-compensation action');
    assert.equal(w.enemy.statusMeta.banished.duration, 1);
    assert.equal(w.enemy.statusMeta.untargetable.duration, 1);
  }
});

test('non-damaging support does not consume a forced-miss token', () => {
  const g = loadGame(), w = world(g, 'hermit', 7);
  w.actor._nextAttackMiss = 1;
  cast(g, w, 'scroll_ward');
  assert.equal(w.actor.shield, 20000);
  assert.equal(w.actor._nextAttackMiss, 1);
});

test('damaging skills respect ordinary target dodge', () => {
  const g = loadGame(), w = world(g, 'door', 8);
  cast(g, w, 'elemental_spark', () => 0);
  assert.equal(w.enemy.hp, w.enemy.maxHp);
  assert.deepEqual(w.enemy.status, [], 'a dodged spell must not freeze its target');
  assert.ok(w.state.events.some(x => x.type === 'miss'));
});

test('damaging skills read accuracy penalties from the actual actor', () => {
  const g = loadGame(), w = world(g, 'door', 8);
  w.actor._hitChanceDebuff = 0.95;
  cast(g, w, 'elemental_spark', () => 0.9);
  assert.equal(w.enemy.hp, w.enemy.maxHp);
  assert.ok(w.state.events.some(x => x.type === 'miss'));
});

test('pure spells do not inherit firearm training miss chance', () => {
  const g = loadGame(), w = world(g, 'door', 8);
  const firearm = Object.values(g.WEAPONS).find(x => x.kind === 'gun');
  assert.ok(firearm, 'fixture requires one gun');
  w.a.weaponId = firearm.id;
  w.a.weaponMastery.gun = 0;
  cast(g, w, 'elemental_spark', () => 0.4);
  assert.ok(w.enemy.hp < w.enemy.maxHp, 'spell should connect despite untrained gun');
});

test('critical failure belongs to the attacking caster, including structured skills', () => {
  const g = loadGame(), w = world(g, 'door', 8);
  w.a._partyPassiveEffects = [{ type: 'crit', amount: 1 }];
  w.actor._nextCritFail = 1;
  cast(g, w, 'elemental_spark', () => 0.8);
  assert.equal(w.state.balanceTrace[0].critical, false);
  assert.equal(w.actor._nextCritFail || 0, 0);
});

test('a target pending critical failure does not suppress the attacker critical', () => {
  const g = loadGame(), w = world(g, 'door', 8);
  w.a._partyPassiveEffects = [{ type: 'crit', amount: 1 }];
  w.enemy._nextCritFail = 1;
  cast(g, w, 'elemental_spark', () => 0.8);
  assert.equal(w.state.balanceTrace[0].critical, true);
  assert.equal(w.enemy._nextCritFail, 1);
});

test('one critical-failure token suppresses every critical in one AoE action', () => {
  const g = loadGame(), w = world(g, 'door', 1, 'door');
  w.a._partyPassiveEffects = [{ type: 'crit', amount: 1 }];
  w.actor._nextCritFail = 1;
  cast(g, w, 'star_gate_tear', () => 0.8);
  assert.equal(w.state.balanceTrace.length, 2);
  assert.ok(w.state.balanceTrace.every(x => x.critical === false));
  assert.equal(w.actor._nextCritFail || 0, 0);
});

test('physical damaging abilities allow a surviving target counter', () => {
  const g = loadGame(), w = world(g, 'fool', 8);
  w.b._partyPassiveEffects = [{ type: 'counter', amount: 1 }];
  const hp = w.actor.hp;
  cast(g, w, 'paper_card_dagger', () => 0.2);
  assert.ok(w.actor.hp < hp, 'surviving physical hit should trigger forced counter fixture');
  assert.ok(w.lines.some(x => /counters for/.test(x.text)));
});

test('a target resurrected from a lethal physical ability does not counter that killing hit', () => {
  const g = loadGame(), w = world(g, 'fool', 2, 'fool');
  w.b._partyPassiveEffects = [{ type: 'counter', amount: 1 }];
  w.enemy.hp = 1;
  const hp = w.actor.hp;
  cast(g, w, 'paper_card_dagger', () => 0.2);
  assert.equal(w.enemy._revived, true, 'fixture must actually resurrect');
  assert.equal(w.enemy.alive, true);
  assert.equal(w.actor.hp, hp, 'resurrection does not grant an immediate same-hit counter');
  assert.ok(!w.lines.some(x => /counters for/.test(x.text)));
});

test('execution below the declared threshold is lethal despite damage reduction', () => {
  const g = loadGame(), w = world(g, 'chained', 1);
  w.enemy.hp = 10000;
  w.enemy.shield = 5000;
  w.enemy._damageTakenMultiplier = 0.01;
  w.b._mythicalTried = true;
  cast(g, w, 'spiteful_depravity');
  assert.equal(w.enemy.alive, false, 'execution claim must actually defeat this nonreviving target');
  assert.equal(w.enemy.hp, 0);
  assert.equal(w.state.events.filter(x => x.type === 'death' && x.targetId === w.enemy.id).length, 1);
  assert.equal(w.state.events.find(x => x.type === 'damage' && x.targetId === w.enemy.id).instantKill, true);
});

test('living no-heal prohibits active healing', () => {
  const g = loadGame(), w = world(g, 'sun', 7);
  w.actor.hp = 50000;
  g.addStatus(w.actor, 'no_heal', 2, 'enemy');
  cast(g, w, 'purification_halo');
  assert.equal(w.actor.hp, 50000);
});

test('living no-heal also prohibits HP-theft recovery', () => {
  const g = loadGame(), w = world(g, 'error', 0);
  w.actor.hp = 50000;
  g.addStatus(w.actor, 'no_heal', 2, 'enemy');
  cast(g, w, 'systemic_glitch');
  assert.equal(w.actor.hp, 50000);
  assert.ok(w.enemy.hp < w.enemy.maxHp, 'enemy HP theft still applies');
  assert.ok(!w.state.events.some(x => x.type === 'heal' && x.targetId === w.actor.id));
});

test('HP theft restores only HP actually removed from a nearly defeated target', () => {
  const g = loadGame(), w = world(g, 'error', 0);
  w.actor.hp = 50000;
  w.enemy.hp = 500;
  w.b._mythicalTried = true;
  cast(g, w, 'systemic_glitch');
  assert.equal(w.actor.hp, 50499);
  assert.equal(w.state.events.find(x => x.type === 'heal').amount, 499);
});

test('no-shield prohibits an active shield', () => {
  const g = loadGame(), w = world(g, 'hermit', 7);
  g.addStatus(w.actor, 'no_shield', 2, 'enemy');
  cast(g, w, 'scroll_ward');
  assert.equal(w.actor.shield || 0, 0);
});

test('no-heal alone does not prohibit a shield', () => {
  const g = loadGame(), w = world(g, 'hermit', 7);
  g.addStatus(w.actor, 'no_heal', 2, 'enemy');
  cast(g, w, 'scroll_ward');
  assert.equal(w.actor.shield, 20000);
});

let failures = 0;
for (const { name, fn } of cases) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures++;
    console.error(`FAIL ${name}\n  ${error.message}`);
  }
}
console.log(`${cases.length - failures} passed; ${failures} failed; ${cases.length} casting regressions`);
process.exitCode = failures ? 1 : 0;
