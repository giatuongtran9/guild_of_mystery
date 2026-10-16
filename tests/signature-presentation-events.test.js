'use strict';
const { g, assert, world } = require('./phase3-test-helpers');
require('./mechanics-fixture')(g);
const loadout = require('../scripts/permanent-asset-loadouts');
const R = () => .99;
const quest = { kind: 'contract', id: 'presentation', name: 'Presentation fixture' };
let passed = 0, failed = 0;
function test(name, run) {
  try { run(); passed++; console.log('PASS ' + name); }
  catch (error) { failed++; console.error('FAIL ' + name + ': ' + error.stack); }
  finally { g.bindBattle(null); }
}
function cast(w, spec, actor = w.u, target = w.v) {
  return g.applyStructuredAbility(actor.agent, actor, target, w.state, [], R, spec);
}
function prepared(path, sequence, side = 'allies') {
  const w = world(path, sequence, side);
  loadout(g, w.a, 'rare');
  g.initializePathwayBattle(w.state, quest, 71);
  g.deployPreparedPathwayCompanions(w.state, []);
  return w;
}
function companion(w) { return [...w.state.allies, ...w.state.enemies].find(u => u._assetOwnerId === w.u.id); }
function thread(w) { assert(g.applySpiritThread(w.a, w.v, w.u, w.state, [], R)); }
function awakenChained(side = 'allies', rng = R) {
  const w = world('chained', 0, side);
  g.mythicalAwaken(w.u, w.state, [], rng);
  w.linked = [...w.state.allies, ...w.state.enemies].find(u => u._mythicalCurseLink?.ownerId === w.u.id);
  return w;
}

test('Thread Binding casts identify the skill and actual victim', () => {
  const w = world('fool', 5);
  for (const spec of g.unlockedAbilities(w.a)) if (spec.type === 'active' && spec.effectId !== 'thread_binding') w.a.cooldowns[spec.effectId] = 99;
  assert.equal(g.choosePathwayBattleAction(w.a, w.u, w.v, w.state).kind, 'thread');
  g.powerEffect(w.a, w.u, w.v, w.state, [], R);
  const event = w.state.events.find(e => e.type === 'cast');
  assert.equal(event.abilityId, 'thread_binding');
  assert.equal(event.sourceAbilityId, 'thread_binding');
  assert.equal(event.sourcePath, 'fool');
  assert.equal(event.targetId, w.v.id);
});
test('thread attachment and each progression event carry numeric owner and stage', () => {
  const w = world('fool', 5); thread(w);
  assert.deepEqual(w.state.events.at(-1).threadState, { ownerId: w.u.id, value: 0, max: 5 });
  for (let stage = 1; stage <= 4; stage++) {
    const start = w.state.events.length;
    g.tickSpiritThread(w.v, w.state, []);
    const events = w.state.events.slice(start).filter(e => e.type === 'thread');
    assert(events.length);
    for (const event of events) {
      assert.equal(event.targetId, w.v.id);
      assert.deepEqual(event.threadState, { ownerId: w.u.id, value: stage, max: 5 });
    }
  }
  assert.deepEqual(g.combatResourceSnapshot(w.v, w.state).threadProgress, { ownerId: w.u.id, value: 4, max: 5 });
});
test('thread damage interruption records the decremented stage at its exact event', () => {
  const w = world('fool', 5); thread(w);
  for (let i = 0; i < 3; i++) g.tickSpiritThread(w.v, w.state, []);
  g.resolveIncoming(w.u, w.v, w.v.maxHp * .31, w.state, [], R, { damageType: 'true', trueDamage: true });
  const event = w.state.events.find(e => e.subtype === 'damage_interrupt');
  assert.deepEqual(event.threadState, { ownerId: w.u.id, value: 2, max: 5 });
});
test('interrupted threads clear their link in both event and resource snapshot', () => {
  const w = world('fool', 5); thread(w);
  assert(g.interruptOwnerThreads(w.u, w.state, []));
  const event = w.state.events.find(e => e.type === 'thread' && e.subtype === 'interrupt');
  assert.equal(event.targetId, w.v.id); assert.equal(event.threadState, null);
  assert.equal(g.combatResourceSnapshot(w.v, w.state).threadProgress, null);
});
test('resisted attachment does not advertise a successful thread link', () => {
  const w = world('fool', 5);
  assert.equal(g.applySpiritThread(w.a, w.v, w.u, w.state, [], () => 0), false);
  assert(!w.state.events.some(e => e.type === 'thread'));
  assert.equal(g.combatResourceSnapshot(w.v, w.state).threadProgress, null);
});
test('conversion removes the thread and identifies the new owned marionette', () => {
  const w = world('fool', 5); thread(w);
  for (let i = 0; i < 5; i++) g.tickSpiritThread(w.v, w.state, []);
  assert(w.state.events.some(e => e.type === 'death' && e.converted));
  assert.equal(g.combatResourceSnapshot(w.v, w.state).threadProgress, null);
  const puppet = w.state.allies.find(u => u.summoned);
  assert.deepEqual(g.combatResourceSnapshot(puppet, w.state).companion, { ownerId: w.u.id, kind: 'marionette', definitionId: null });
});
test('stored Door replay advertises the actual borrowed source and record ownership', () => {
  const w = world('door', 6);
  g.initializePathwayBattle(w.state, quest, 71);
  const asset = g.newPathwayAsset(w.u, w.state, { kind: 'record', sourcePath: 'tyrant', sequence: 8, abilityId: 'raging_blow', sourceId: 'previous-foe' });
  g.addPathwayAsset(w.u, w.state, asset, []); w.a.pathwayInventory.policy = 'auto';
  g.initializePathwayBattle(w.state, quest, 72); g.setMeterValue(w.a, 'door', 100);
  assert(cast(w, g.tierFor('door', 6).abilities[0]));
  const event = w.state.events.find(e => e.type === 'cast');
  assert.equal(event.ownedPower, 'record'); assert.equal(event.sourcePath, 'tyrant');
  assert.equal(event.sourceAbilityId, 'raging_blow'); assert.equal(event.sourceUnitId, 'previous-foe');
  assert.equal(w.a.pathwayInventory.assets.length, 0, 'presentation must not change single-use consumption');
});
for (const type of ['active', 'passive']) test(`retained ${type} soul casts identify their original ability and soul ownership`, () => {
  const w = prepared('hanged_man', 5); g.setMeterValue(w.a, 'hanged_man', 100);
  const spec = g.pathwayAssetAbilities(w.a, w.u, w.state).find(s => g.pathwayAssetSpec(w.a.pathwayInventory.assets.find(a => a.id === s._assetId)).type === type);
  assert(spec, `prepared fixture must include ${type} soul`);
  const asset = w.a.pathwayInventory.assets.find(a => a.id === spec._assetId), count = w.a.pathwayInventory.assets.length;
  assert(cast(w, spec));
  const event = w.state.events.find(e => e.type === 'cast');
  assert.equal(event.ownedPower, 'soul'); assert.equal(event.sourcePath, asset.sourcePath);
  assert.equal(event.sourceAbilityId, asset.abilityId); assert.equal(event.sourceUnitId, asset.sourceId);
  assert.equal(w.a.pathwayInventory.assets.length, count, 'invocation retains soul ownership');
});
test('native casts do not masquerade as records or souls', () => {
  const w = world('door', 6); assert(cast(w, g.tierFor('door', 5).abilities[0]));
  assert.equal(w.state.events.find(e => e.type === 'cast').ownedPower, null);
});
for (const side of ['allies', 'enemies']) {
  for (const [path, sequence, kind] of [['moon', 8, 'beast'], ['paragon', 6, 'device']]) test(`${side}: ${kind} snapshots identify the real owner and definition`, () => {
    const w = prepared(path, sequence, side), vessel = companion(w);
    assert(vessel);
    assert.deepEqual(g.combatResourceSnapshot(vessel, w.state).companion, { ownerId: w.u.id, kind, definitionId: vessel._assetDefinitionId });
    assert.equal(g.combatResourceSnapshot(w.u, w.state).companion, null);
  });
  test(`${side}: Beast Command points to its actual successful recipient`, () => {
    const w = prepared('moon', 8, side), beast = companion(w);
    assert(cast(w, g.tierFor('moon', 8).abilities[0]));
    const event = w.state.events.find(e => e.presentationEffect === 'beast_command');
    assert.equal(event.ownerId, w.u.id); assert.equal(event.targetId, beast.id);
    assert.equal(event.targetTeam, side === 'allies' ? 'ally' : 'enemy');
    assert(beast._assetBeastCommand > 0);
  });
  test(`${side}: Alchemical Fire marks the companion and intended shot target`, () => {
    const w = prepared('paragon', 6, side), device = companion(w);
    assert(cast(w, g.tierFor('paragon', 6).abilities[0]));
    const event = w.state.events.find(e => e.presentationEffect === 'device_mark');
    assert.equal(event.ownerId, w.u.id); assert.equal(event.companionId, device.id);
    assert.equal(event.targetId, w.v.id); assert.equal(device._assetFireCommand.targetId, w.v.id);
  });
  test(`${side}: successful Chained awakening records the actual curse target`, () => {
    const w = awakenChained(side); assert(w.linked);
    const event = w.state.events.find(e => e.presentationEffect === 'curse_link');
    assert.equal(event.ownerId, w.u.id); assert.equal(event.targetId, w.linked.id);
    assert.deepEqual(event.curseLink, { ownerId: w.u.id, turns: event.turns });
    assert.deepEqual(g.combatResourceSnapshot(w.linked, w.state).curseLink, event.curseLink);
  });
}
test('Moon self-attack fallback never points to a missing beast', () => {
  const w = world('moon', 8); g.initializePathwayBattle(w.state, quest, 71);
  const hp = w.v.hp; assert(cast(w, g.tierFor('moon', 8).abilities[0])); assert(w.v.hp < hp);
  assert(!w.state.events.some(e => e.presentationEffect === 'beast_command'));
});
test('redirected companion commands identify the recipient that really gets the boost', () => {
  for (const [path, sequence, effect] of [['moon', 8, 'beast_command'], ['paragon', 6, 'device_mark']]) {
    const w = prepared(path, sequence); w.v._signatureRedirect = { turns: 2 };
    assert(cast(w, g.tierFor(path, sequence).abilities[0]));
    const event = w.state.events.find(e => e.presentationEffect === effect);
    assert.equal(effect === 'beast_command' ? event.targetId : event.companionId, w.v.id);
  }
});
test('resisted Chained control emits no successful curse-link cue', () => {
  const w = world('chained', 0);
  for (const target of w.state.enemies) target.agent._partyPassiveEffects.push({ type: 'status_resistance', status: 'curse_link', amount: 1 });
  g.mythicalAwaken(w.u, w.state, [], () => 0);
  assert(!w.state.enemies.some(target => target._mythicalCurseLink?.ownerId === w.u.id));
  assert(!w.state.events.some(e => e.presentationEffect === 'curse_link'));
  for (const unit of w.state.enemies) assert.equal(g.combatResourceSnapshot(unit, w.state).curseLink, null);
});
test('Chained direct-loss echo alone receives the echo cue and applies pacing only once', () => {
  const w = awakenChained(); assert(w.linked);
  const ownerHp = w.u.hp, targetHp = w.linked.hp;
  g.resolveIncoming(w.linked, w.u, 100, w.state, [], R, { damageType: 'true', trueDamage: true });
  const event = w.state.events.find(e => e.presentationEffect === 'curse_echo');
  assert(event); assert.equal(event.actorId, w.u.id); assert.equal(event.targetId, w.linked.id);
  assert.equal(event.damageType, 'dark'); assert.equal(ownerHp - w.u.hp, 100);
  assert.equal(targetHp - w.linked.hp, event.hpLoss);
  assert.equal(w.state.events.filter(e => e.presentationEffect === 'curse_echo').length, 1);
  const start = w.state.events.length;
  g.resolveIncoming(w.linked, w.u, 100, w.state, [], R, { damageType: 'true', trueDamage: true, indirect: true });
  assert(!w.state.events.slice(start).some(e => e.presentationEffect === 'curse_echo'));
});
test('cleansing emits link removal at the cleanse and prevents later echo', () => {
  const w = awakenChained(); const target = w.linked;
  const spec = { id: 'cleanse_fixture', effectId: 'cleanse_fixture', type: 'active', name: 'Cleanse', costSP: 0, cooldown: 0, effects: [{ type: 'cleanse' }] };
  assert(cast(w, spec, target, w.u));
  const event = w.state.events.find(e => e.presentationEffect === 'curse_link_end');
  assert(event); assert.equal(event.targetId, target.id); assert.equal(event.curseLink, null);
  assert.equal(g.combatResourceSnapshot(target, w.state).curseLink, null);
  const start = w.state.events.length;
  g.resolveIncoming(target, w.u, 100, w.state, [], R, { damageType: 'true', trueDamage: true });
  assert(!w.state.events.slice(start).some(e => e.presentationEffect === 'curse_echo'));
});
test('curse status expiry emits link removal without changing the authority duration', () => {
  const w = awakenChained(); g.bindBattle(w.state, []);
  const authorityTurns = w.u._mythicalAuthority.turns;
  w.linked.statusMeta.curse_link.duration = 1; g.tickUnitStatuses(w.linked);
  assert(w.state.events.some(e => e.presentationEffect === 'curse_link_end' && e.targetId === w.linked.id));
  assert.equal(g.combatResourceSnapshot(w.linked, w.state).curseLink, null);
  assert.equal(w.u._mythicalAuthority.turns, authorityTurns);
});
test('expired authority clears visuals even if the old status and form remain', () => {
  const w = awakenChained(); w.u._inForm = true;
  for (let i = 0; i < 2; i++) g.mythicalTurnEnd(w.u, w.state, []);
  assert(g.hasStatus(w.linked, 'curse_link')); assert(w.u._inForm);
  assert.equal(g.combatResourceSnapshot(w.linked, w.state).curseLink, null);
  assert(w.state.events.some(e => e.presentationEffect === 'curse_link_end'));
});
test('dead owner and dead target suppress stale curse-link snapshot markers', () => {
  for (const death of ['owner', 'target']) {
    const w = awakenChained(); (death === 'owner' ? w.u : w.linked).alive = false;
    assert.equal(g.combatResourceSnapshot(w.linked, w.state).curseLink, null);
  }
});
test('resource snapshots neither mutate combat state nor consume random draws', () => {
  const w = prepared('moon', 8), before = JSON.stringify(w.state);
  w.state.rng = () => { throw new Error('presentation used RNG'); };
  for (const unit of [...w.state.allies, ...w.state.enemies]) g.combatResourceSnapshot(unit, w.state);
  assert.equal(JSON.stringify(w.state), before);
});

console.log(`Signature presentation events: ${passed} passed; ${failed} failed.`);
if (failed) process.exitCode = 1;
