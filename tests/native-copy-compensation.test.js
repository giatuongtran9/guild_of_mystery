'use strict';
// Real native, prepared-record, witnessed-imitation and captured-companion casts.
const assert = require('node:assert/strict');
const g = require('../js/node-loader');
const h = require('../scripts/combat-benchmark-helpers');
const clone = value => JSON.parse(JSON.stringify(value));
const originalRules = clone(g.GLOBAL_COMBAT);
const canonical = g.tierFor('fool', 0).abilities.find(spec => spec.effectId === 'fooling_reality');
const originalSource = clone(canonical);

function setRules(multiplier) {
  for (const key of Object.keys(g.GLOBAL_COMBAT)) delete g.GLOBAL_COMBAT[key];
  Object.assign(g.GLOBAL_COMBAT, clone(originalRules));
  g.GLOBAL_COMBAT.incoming_by_pathway_sequence ||= {};
  g.GLOBAL_COMBAT.incoming_by_pathway_sequence.fool ||= {};
  g.GLOBAL_COMBAT.incoming_by_pathway_sequence.fool[0] = 12;
  g.GLOBAL_COMBAT.native_ability_damage_by_pathway_sequence ||= {};
  g.GLOBAL_COMBAT.native_ability_damage_by_pathway_sequence.fool ||= {};
  g.GLOBAL_COMBAT.native_ability_damage_by_pathway_sequence.fool[0] ||= {};
  g.GLOBAL_COMBAT.native_ability_damage_by_pathway_sequence.fool[0].fooling_reality = multiplier;
}

function unit(pathway, id, assets = 'empty') {
  const agent = h.preparedHero(g, pathway, 0, id, {
    assets, weapon: 'rare_sword', collectionFixture: 'balanced', charge: 0
  });
  const result = g.makeCombatUnit(agent);
  result._formUsed = result.agent._formUsed = true;
  return result;
}

function cast(mode, multiplier) {
  setRules(multiplier);
  const pathway = mode === 'record' ? 'door' : mode === 'imitation' ? 'white_tower' : 'fool';
  const owner = unit(pathway, 'owner', ['native', 'tyrant'].includes(mode) ? 'rare' : 'empty');
  const target = unit('fool', 'source');
  // Nonfatal targets keep HP caps and survival from obscuring the source boundary.
  target.hp = target.maxHp = 1000000000;
  const state = {
    allies: [owner], enemies: [target], currentRound: 1, events: [], balanceTrace: [],
    weaponUsage: {}, rng: () => .99, battleMarionettes: []
  };
  let actor = owner, request = clone(canonical);

  if (mode === 'record') {
    const inventory = g.ensurePathwayInventory(owner.agent);
    inventory.policy = 'auto';
    const asset = {
      id: 'prepared_fool_record', ownerId: owner.id, kind: 'record', condition: 'ready',
      sourcePath: 'fool', sourceId: target.id, sequence: 0, abilityId: 'fooling_reality'
    };
    inventory.assets.push(asset);
    inventory.prepared.push(asset.id);
    g.initializePathwayBattle(state, { kind: 'contract', id: 'native-copy-boundary' }, 1);
    request = g.tierFor('door', 6).abilities[0];
    g.setMeterValue(owner.agent, 'door', 100);
  } else if (mode === 'imitation') {
    // The source is witnessed twice through the actual cast path.
    owner.hp = owner.maxHp = 1000000000;
    for (let observation = 0; observation < 2; observation++) {
      target.agent.cooldowns = {};
      assert(g.applyStructuredAbility(target.agent, target, owner, state, [], state.rng, clone(canonical)),
        'Fool casts the source ability for White Tower to observe');
    }
    assert.equal(state._abilityHistoryByUnit[target.id].length, 2);
    g.removeStatus(owner, 'stunned');
    state.events = [];
    state.balanceTrace = [];
    request = g.tierFor('white_tower', 6).abilities[0];
    g.setMeterValue(owner.agent, 'white_tower', 100);
  }

  if (mode === 'native' || mode === 'tyrant') {
    g.initializePathwayBattle(state, { kind: 'contract', id: 'native-copy-boundary' }, 1);
    g.deployPreparedPathwayCompanions(state, []);
    assert.equal(owner._assetStartingMarionettes, 4);
    assert.equal(g.pathwayIncomingDamageScale(owner), 12);
    if (mode === 'tyrant') {
      actor = state.allies.find(candidate => candidate.summoned && candidate._assetOwnerId === owner.id);
      assert(actor, 'The retained Tyrant deploys through the collection path');
      request = g.tierFor('tyrant', 0).abilities[0];
      assert.equal(g.pathwayIncomingDamageScale(actor), 1);
    }
  }

  const prepared = g.signaturePrepareCast(actor.agent, actor, target, state, [], state.rng, request);
  assert(prepared, 'Real source preparation succeeds for ' + mode);
  if (mode !== 'tyrant') {
    assert.deepEqual(prepared.damage, originalSource.damage, mode + ' retains the source damage formula');
    assert.deepEqual(prepared.effects, originalSource.effects, mode + ' retains targeting and control');
    assert.equal(prepared.costSP, originalSource.costSP);
    assert.equal(prepared.cooldown, originalSource.cooldown);
  }
  if (mode === 'record' || mode === 'imitation') {
    assert(prepared._signatureOwned);
    assert.equal(prepared._signatureCopied, true);
  }
  for (const flag of ['_signatureOwned', '_signatureCopied', '_assetOwned']) {
    assert.equal(g.nativeAbilityDamageMultiplier({ path: 'fool', sequence: 0 }, { ...canonical, [flag]: true }), 1,
      flag + ' keeps the original source output even for a matching caster pathway');
  }

  assert(g.applyStructuredAbility(actor.agent, actor, target, state, [], state.rng, request));
  const trace = state.balanceTrace.find(entry => entry.attacker === actor.name);
  const damage = state.events.find(event => event.type === 'damage' && event.actorId === actor.id);
  assert(trace && damage, mode + ' resolves a real damaging cast');
  const result = {
    incoming: trace.incoming, hpLoss: damage.hpLoss,
    nativeMultiplier: g.nativeAbilityDamageMultiplier(actor.agent, prepared),
    compensation: trace.effectContributions.filter(effect => effect.type === 'native_ability_compensation'),
    stunned: g.hasStatus(target, 'stunned'),
    recordConsumed: mode !== 'record' || (owner.agent._signatureRecords.length === 0
      && !owner.agent.pathwayInventory.assets.some(asset => asset.id === 'prepared_fool_record'))
  };
  assert.deepEqual(canonical, originalSource, 'Actual casts never mutate the canonical source');
  return result;
}

try {
  for (const mode of ['native', 'record', 'imitation', 'tyrant']) {
    const original = cast(mode, 1), reduced = cast(mode, .25);
    if (mode === 'native') {
      // Compensation rounds before global pacing; permit only integer rounding.
      assert(Math.abs(reduced.incoming - original.incoming * .25) <= Number(g.GLOBAL_COMBAT.damage || 1));
      assert.equal(reduced.nativeMultiplier, .25);
      assert.deepEqual(reduced.compensation, [{ type: 'native_ability_compensation', multiplier: .25 }]);
    } else {
      assert.equal(reduced.incoming, original.incoming, mode + ' retains original formula output');
      assert.equal(reduced.hpLoss, original.hpLoss, mode + ' retains actual HP damage');
      assert.equal(reduced.nativeMultiplier, 1);
      assert.deepEqual(reduced.compensation, []);
    }
    if (mode !== 'tyrant') assert(original.stunned && reduced.stunned, mode + ' retains control');
    if (mode === 'record') assert(original.recordConsumed && reduced.recordConsumed);
  }
} finally {
  for (const key of Object.keys(g.GLOBAL_COMBAT)) delete g.GLOBAL_COMBAT[key];
  Object.assign(g.GLOBAL_COMBAT, originalRules);
}

console.log('Native compensation: real source casts, prepared records, witnessed imitation and retained companions preserve their boundaries.');
