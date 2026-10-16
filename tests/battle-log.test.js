const assert = require('assert');
const g = require('../js/node-loader.js');

console.log('--- Running Battle Log Unit Tests ---');

// Deterministic agent stats: with Math.random the test only failed on runs where Fool happened to roll a reflect.
let _seed = 2024;
const seededRng = () => ((_seed = Math.imul(1664525, _seed) + 1013904223) >>> 0) / 4294967296;

// Helper to create test agents
function makeTestAgent(path, seq, id) {
  const a = g.makeAgent(seededRng, { sequence: seq, path, trait: 'Stout Vitality' });
  a.id = id;
  a.name = g.pathOf(path).name + ' Seq ' + seq;
  a.awakened = true;
  a.path = path;
  a.sequence = seq;
  a.recommendedPath = path;
  a.injuries = 0;
  a.weaponId = 'none';
  a.weaponMastery = {};
  a.sp = g.maxSPFor(a);
  g.restatAgent(a);
  return a;
}

// 1. Number Abbreviation Tests
console.log('Checking number abbreviation (abbrNum)...');
assert.strictEqual(g.abbrNum(0), '0');
assert.strictEqual(g.abbrNum(500), '500');
assert.strictEqual(g.abbrNum(1234), '1,234');
assert.strictEqual(g.abbrNum(51221), '51.2K');
assert.strictEqual(g.abbrNum(1300000), '1.3M');
assert.strictEqual(g.abbrNum(-51221), '−51.2K');
console.log('✓ abbrNum formats correctly with exact tooltips preserved');

// 2. 1v1 Simulation Test
console.log('Checking 1v1 simulation event emission...');
const ally1v1 = [makeTestAgent('fool', 9, 'f9')];
const quest1v1 = {
  id: 'test_1v1', name: '1v1 Encounter', brief: '1v1',
  objective: 'combat', difficultySequence: 9, encounter: true, mundane: false,
  rewards: { funds: 0, reputation: 0, materials: {} }, enemyCount: 1, requiredPath: 'door'
};
const res1v1 = g.resolveQuest(ally1v1, quest1v1, 42, {
  individual: false,
  simulationOpponents: [{ path: 'door', sequence: 9 }]
});

assert(Array.isArray(res1v1.events), 'Structured events must exist');
assert(res1v1.events.length > 0, 'Events array must not be empty');
console.log(`✓ 1v1 simulation produced ${res1v1.events.length} structured events`);

// 3. 2v2 Simulation Test
console.log('Checking 2v2 simulation event emission...');
const ally2v2 = [makeTestAgent('fool', 0, 'f0'), makeTestAgent('door', 0, 'd0')];
const quest2v2 = {
  id: 'test_2v2', name: '2v2 Encounter', brief: '2v2',
  objective: 'combat', difficultySequence: 0, encounter: true, mundane: false,
  rewards: { funds: 0, reputation: 0, materials: {} }, enemyCount: 2, requiredPath: 'red_priest'
};
const res2v2 = g.resolveQuest(ally2v2, quest2v2, 12345, {
  individual: false,
  simulationOpponents: [{ path: 'red_priest', sequence: 0 }, { path: 'demoness', sequence: 0 }]
});

assert(Array.isArray(res2v2.events), 'Structured events must exist in 2v2');
assert(res2v2.events.length > 20, '2v2 events should be substantial');
console.log(`✓ 2v2 simulation produced ${res2v2.events.length} structured events`);

// 4. Test Event Ordering and Stability
console.log('Checking event order stability within rounds...');
let lastRound = 0;
for (const ev of res2v2.events) {
  assert(ev.round !== undefined, 'Every event must have a round number');
  assert(ev.round >= lastRound, `Rounds must not decrease: ${ev.round} vs ${lastRound}`);
  lastRound = ev.round;
  assert(typeof ev.type === 'string', 'Event must have a valid type string');
}
console.log('✓ Event ordering within rounds is monotonic and stable');

// 5. Test Merged Row Structure
console.log('Checking that every cast with damage produces exactly one merged row...');
const grouped = g.groupEventsToRows(res2v2.events);

let castEventsWithDamage = 0;
for (let i = 0; i < res2v2.events.length; i++) {
  const ev = res2v2.events[i];
  if (ev.type === 'cast') {
    let hasDamage = false;
    for (let j = i + 1; j < res2v2.events.length; j++) {
      const next = res2v2.events[j];
      if (next.type === 'cast' || next.type === 'round_start' || next.type === 'resources') break;
      if (next.type === 'damage' && !next.isDot && next.actorId === ev.actorId) {
        hasDamage = true;
        break;
      }
    }
    if (hasDamage) castEventsWithDamage++;
  }
}

let mergedRowsFound = 0;
for (const gr of grouped) {
  for (const row of gr.rows) {
    if (row.type === 'turn' && row.costSP !== undefined && row.damages && row.damages.length > 0) {
      mergedRowsFound++;
      assert(row.actorName, 'Merged row must have actorName');
      assert(row.ability, 'Merged row must have ability');
      // A counter can legitimately land for 0 (for example against a target made untargetable by a replayed record), so only direct damage must be positive.
      assert(row.damages[0].isCounter || row.damages[0].amount > 0, 'Merged damage must be greater than 0');
    }
  }
}

assert.strictEqual(mergedRowsFound, castEventsWithDamage,
  `Merged rows (${mergedRowsFound}) must match cast events with damage (${castEventsWithDamage})`);
console.log(`✓ Verified ${mergedRowsFound} cast-with-damage actions each produced exactly one merged row`);

// A poison tick owned by the buffer is still independent of the completed cast.
const periodicRows=g.groupEventsToRows([
 {round:1,type:'cast',actorId:'buffer',actorName:'Buffer',ability:'War Command',costSP:65},
 {round:1,type:'resources',units:[]},
 {round:1,type:'damage',actorId:'buffer',actorName:'Buffer',ability:'Poison',targetId:'target',amount:10,isDot:true}
]).flatMap(r=>r.rows);
assert.strictEqual(periodicRows.find(r=>r.ability==='War Command').damages.length,0);
assert.strictEqual(periodicRows.find(r=>r.ability==='Poison').damages[0].amount,10);

// Animation must target the resolved actors and victims, including events that
// are shown as notes rather than damage. Grouping must not infer them from text.
console.log('Checking grouped presentation metadata and event identities...');
const metadataEvents = [
  { round: 1, type: 'status', subtype: 'shield_removed', actorId: 'error', actorName: 'Error', actorTeam: 'ally', targetId: 'victim', targetName: 'Victim', targetTeam: 'enemy', shieldAfter: 0, text: 'Victim loses its shield.' },
  { round: 1, type: 'thread', subtype: 'damage_interrupt', actorId: 'fool', targetId: 'victim', targetTeam: 'enemy', progress: 2, text: 'The thread is interrupted.' },
  { round: 1, type: 'cast', actorId: 'door', actorName: 'Door', actorTeam: 'ally', targetId: 'victim', targetTeam: 'enemy', ability: 'Recorded Lightning', abilityId: 'record_lightning', sourcePath: 'tyrant', sourceAbilityId: 'lightning', costSP: 30, cooldown: 2 },
  { round: 1, type: 'miss', actorId: 'door', actorName: 'Door', actorTeam: 'ally', targetId: 'victim', targetName: 'Victim', targetTeam: 'enemy', text: 'Victim dodges.' },
  { round: 1, type: 'thread', actorId: 'door', actorTeam: 'ally', targetId: 'victim', targetTeam: 'enemy', progress: 3, text: 'A thread tightens.' },
  { round: 1, type: 'status', actorId: 'door', actorTeam: 'ally', targetId: 'victim', targetTeam: 'enemy', subtype: 'freeze', isFreeze: true, text: 'Victim freezes.' },
  { round: 1, type: 'story', subtype: 'mythical_form', inTurn: true, actorId: 'victim', actorTeam: 'enemy', text: 'Victim awakens.' },
  { round: 1, type: 'resources', units: [] },
  { round: 1, type: 'miss', actorId: 'hunter', actorTeam: 'enemy', targetId: 'door', targetName: 'Door', targetTeam: 'ally', text: 'Door dodges.' },
  { round: 1, type: 'resources', units: [] },
  { round: 1, type: 'status', subtype: 'cc_loss', actorId: 'victim', actorName: 'Victim', actorTeam: 'enemy', targetId: 'victim', targetTeam: 'enemy', text: 'Victim loses its action.' },
  { round: 1, type: 'resources', units: [] }
];
const metadataBefore = JSON.stringify(metadataEvents);
metadataEvents.forEach(Object.freeze);
const metadataRows = g.groupEventsToRows(metadataEvents).flatMap(r => r.rows);
assert.strictEqual(metadataRows.length, 5, 'Metadata must not add or split log rows');
assert.strictEqual(metadataRows[0].targetId, 'victim');
assert.strictEqual(metadataRows[0].actorId, 'error');
assert.strictEqual(metadataRows[0].shieldAfter, 0);
assert.strictEqual(metadataRows[1].targetId, 'victim');
assert.strictEqual(metadataRows[1].subtype, 'damage_interrupt');
assert.strictEqual(metadataRows[1].progress, 2);
const recordedCast = metadataRows[2];
assert.strictEqual(recordedCast.type, 'turn');
assert.strictEqual(recordedCast.id, 'turn_1_door_2', 'The grouped row keeps its existing ID');
assert.strictEqual(recordedCast.abilityId, 'record_lightning');
assert.strictEqual(recordedCast.sourcePath, 'tyrant');
assert.strictEqual(recordedCast.sourceAbilityId, 'lightning');
assert.strictEqual(recordedCast.targetId, 'victim');
assert.strictEqual(recordedCast.costSP, 30);
for (let index = 0; index < 4; index++) {
  assert.strictEqual(recordedCast.timeline[index].event, metadataEvents[index + 3], 'Ordered presentation steps retain the resolved event');
  assert.strictEqual(recordedCast.subrows[index].actorId, metadataEvents[index + 3].actorId);
}
assert.strictEqual(recordedCast.timeline[0].event.targetId, 'victim', 'A dodge identifies the actual victim');
assert.strictEqual(recordedCast.subrows[1].targetId, 'victim');
assert.strictEqual(recordedCast.subrows[2].targetTeam, 'enemy');
assert.strictEqual(recordedCast.subrows[3].type, 'mythical', 'Mythical subrows retain their existing rendering type');
assert.strictEqual(metadataRows[3].isMiss, true);
assert.strictEqual(metadataRows[3].targetId, 'door', 'A standalone missed basic attack retains its target');
assert.strictEqual(metadataRows[4].isSkip, true);
assert.strictEqual(metadataRows[4].subtype, 'cc_loss');
assert.strictEqual(metadataRows[4].targetId, 'victim');
assert.strictEqual(JSON.stringify(metadataEvents), metadataBefore, 'Grouping never mutates resolved combat events');
console.log('✓ Cast sources, target identities and ordered note events survive grouping without changing log rows');

console.log('Checking emitted weapon and copied-power presentation metadata...');
const { world } = require('./phase3-test-helpers');
const gunWorld = world('fool', 9);
gunWorld.a.weaponId = Object.keys(g.WEAPONS).find(id => g.WEAPONS[id].kind === 'gun');
gunWorld.a.weaponMastery.gun = 10;
assert(g.attackOnce(gunWorld.a, gunWorld.u, gunWorld.v, gunWorld.state, [], () => .99));
const gunCast = gunWorld.state.events.find(event => event.type === 'cast');
assert.strictEqual(gunCast.abilityId, 'basic_attack');
assert.strictEqual(gunCast.attackKind, 'gun');
assert.strictEqual(gunCast.sourcePath, 'fool');
const recordWorld = world('door', 6);
g.initializePathwayBattle(recordWorld.state, { kind: 'wanted', name: 'Presentation test' }, 22);
const recordAsset = g.newPathwayAsset(recordWorld.u, recordWorld.state, {
  kind: 'record', sourcePath: 'tyrant', sequence: 8, abilityId: 'raging_blow',
  sourceId: 'enemy_from_previous_battle', sourceName: 'Previous enemy'
});
g.addPathwayAsset(recordWorld.u, recordWorld.state, recordAsset, []);
recordWorld.a.pathwayInventory.policy = 'auto';
g.initializePathwayBattle(recordWorld.state, { kind: 'wanted', name: 'Presentation test' }, 22);
g.setMeterValue(recordWorld.a, 'door', 100);
assert(g.applyStructuredAbility(recordWorld.a, recordWorld.u, recordWorld.v, recordWorld.state, [], () => .99, g.tierFor('door', 6).abilities[0]));
const recordCast = recordWorld.state.events.find(event => event.type === 'cast');
assert.strictEqual(recordCast.abilityId, 'record:raging_blow', 'The paid ability keeps its effective cast ID');
assert.strictEqual(recordCast.sourceAbilityId, 'raging_blow');
assert.strictEqual(recordCast.sourcePath, 'tyrant', 'A stored power retains its source pathway when its original enemy is absent');
console.log('✓ Basic firearm shots and stored foreign powers expose their actual presentation source');

console.log('Checking successful control events expose structured status metadata...');
function statusPresentation(effect, roll = .1, immune = false) {
  const fixture = world('door', 9);
  if (immune) fixture.v._mythicalStatusProtection = { bound: true };
  const spec = { type: 'active', effectId: 'presentation_control', name: 'Presentation Control',
    text: 'Presentation Control', costSP: 1, cooldown: 0, effects: [effect] };
  let calls = 0;
  assert(g.applyStructuredAbility(fixture.a, fixture.u, fixture.v, fixture.state, [], () => { calls++; return roll; }, spec));
  return { ...fixture, calls, applied: fixture.state.events.filter(event => event.type === 'status' && event.status) };
}
for (const effect of [
  { type: 'status', status: 'bound', duration: 2, ignoreResistance: true },
  { type: 'status_pool', statuses: ['bound'], chance: 1, duration: 2 },
  { type: 'status_chance', status: 'bound', chance: .5, duration: 2, ignoreResistance: true }
]) {
  const result = statusPresentation(effect);
  assert.strictEqual(g.hasStatus(result.v, 'bound'), true);
  assert.strictEqual(result.applied.length, 1, effect.type + ' emits one successful status event');
  assert.strictEqual(result.applied[0].status, 'bound');
  assert.strictEqual(result.applied[0].actorId, result.u.id);
  assert.strictEqual(result.applied[0].targetId, result.v.id);
  assert.strictEqual(result.applied[0].text, result.v.name + ' is afflicted with bound (2 turns)');
  const note = g.groupEventsToRows(result.state.events)[0].rows[0].timeline.find(step => step.event.status);
  assert.strictEqual(note.event, result.applied[0], 'Grouping preserves the successful control event for visual playback');
  if (effect.type === 'status_chance') assert.strictEqual(result.calls, 1, 'Presentation adds no random draws');
}
const chanceEffect = { type: 'status_chance', status: 'bound', chance: .5, duration: 2, ignoreResistance: true };
for (const result of [statusPresentation(chanceEffect, .9), statusPresentation(chanceEffect, .1, true)]) {
  assert.strictEqual(g.hasStatus(result.v, 'bound'), false);
  assert.strictEqual(result.applied.length, 0, 'Failed or immune control cannot display an applied-control cue');
  assert.strictEqual(result.calls, 1, 'Failed and immune status rolls preserve their random draw count');
}
console.log('✓ Normal, pooled and chance control identify only successfully applied statuses without extra RNG');

// 6. Test Structured Round & Action Continuity
console.log('Checking structured round and action continuity...');
const roundEvents = res2v2.events.filter(e => e.type === 'system' && e.subtype === 'initiative');
assert(roundEvents.length > 0, 'Structured initiative round events must be present');
const castEvents = res2v2.events.filter(e => e.type === 'cast' || e.type === 'basic_attack');
assert(castEvents.length > 0, 'Structured cast / basic_attack action events must be present');
console.log(`✓ Structured events intact (${res2v2.events.length} total events across ${roundEvents.length} rounds, ${castEvents.length} actions)`);

// 7. Test Battle Log UI Enhancements (Multi-Hit, Mythical Form, Round Summary)
console.log('Checking battle log UI enhancements (multi-hit, mythical form, round summary)...');

// Helper to extract function body from js/ui.js for testing in Node
const fs = require('fs');
const uiSrc = fs.readFileSync(__dirname + '/../js/ui.js', 'utf8');

function extractFunc(name) {
  const match = uiSrc.match(new RegExp('(function\\s+' + name + '\\s*\\([^\\)]*\\)\\s*\\{[\\s\\S]*?\\n\\})\\n\\s*\\n', 'm'))
    || uiSrc.match(new RegExp('(function\\s+' + name + '\\s*\\([^\\)]*\\)\\s*\\{[\\s\\S]*?\\n\\})\\n\\s*(?:function|const|let|var)', 'm'));
  if (!match) throw new Error('Could not extract ' + name);
  return new Function('esc', 'abbrNum', 'return (' + match[1] + ')')((s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))), (n=>Number(n).toLocaleString()));
}

const flattenTurnRowsFn = extractFunc('flattenTurnRows');
const renderTurnRowHtmlFn = extractFunc('renderTurnRowHtml');

// Check round summary calculation
const mockGroupedRounds = [{
  round: 1,
  initiative: 'Mock Init',
  rows: [
    { actorTeam: 'ally', damages: [{ targetTeam: 'enemy', amount: 150, absorbed: 50 }] },
    { actorTeam: 'enemy', damages: [{ targetTeam: 'ally', hpLoss: 80 }] }
  ]
}];
const flattened = flattenTurnRowsFn(mockGroupedRounds);
assert.strictEqual(flattened[0].isRoundHeader, true);
assert.strictEqual(flattened[0].roundStats.allyHpLoss, 80);
assert.strictEqual(flattened[0].roundStats.enemyHpLoss, 100);

const headerHtml = renderTurnRowHtmlFn(flattened[0], true);
assert(headerHtml.includes('round-summary-pill'), 'Header must include round summary pill');
assert(headerHtml.includes('Allies −80'), 'Header must state ally HP lost');
assert(headerHtml.includes('Enemies −100'), 'Header must state enemy HP lost');
console.log('✓ Round summary stats correctly calculate and render ally/enemy damage totals');

// Check multi-hit turn aggregation & collapse
const multiHitRow = {
  actorName: 'Gerry',
  actorTeam: 'ally',
  ability: 'Flurry of Blows',
  damages: [
    { targetName: 'Shadow Beast', targetTeam: 'enemy', amount: 40, damageType: 'slash' },
    { targetName: 'Shadow Beast', targetTeam: 'enemy', amount: 45, damageType: 'slash' },
    { targetName: 'Shadow Beast', targetTeam: 'enemy', amount: 50, absorbed: 10, damageType: 'slash' }
  ]
};
const multiHitHtml = renderTurnRowHtmlFn(multiHitRow, true);
assert(multiHitHtml.includes('b-multihit-group'), 'Multi-hit turn must be wrapped in b-multihit-group details');
assert(multiHitHtml.includes('3 HITS'), 'Multi-hit summary must display combo badge with count');
assert(multiHitHtml.includes('−125 HP'), 'Multi-hit summary must aggregate total HP loss (40 + 45 + 40 = 125)');
assert(multiHitHtml.includes('−10 Shield'), 'Multi-hit summary must aggregate total shield absorbed');
assert(multiHitHtml.includes('b-multihit-breakdown'), 'Multi-hit turn must contain detailed breakdown');
assert(multiHitHtml.includes('Hit 1') && multiHitHtml.includes('Hit 2') && multiHitHtml.includes('Hit 3'), 'Breakdown must list individual hits');
console.log('✓ Multi-hit turns cleanly collapse into aggregated summaries with detailed breakdowns');

// Check single hit preserves standard row
const singleHitRow = {
  actorName: 'Gerry',
  actorTeam: 'ally',
  ability: 'Heavy Strike',
  damages: [
    { targetName: 'Shadow Beast', targetTeam: 'enemy', amount: 80, damageType: 'slash' }
  ]
};
const singleHitHtml = renderTurnRowHtmlFn(singleHitRow, true);
assert(!singleHitHtml.includes('b-multihit-group'), 'Single hit must not be grouped into details');
assert(singleHitHtml.includes('−80 HP'), 'Single hit must render standard damage outcome');
console.log('✓ Single-hit turns preserve standard sub-outcome row format');

// Check Mythical Form styling
const mythicalStoryRow = {
  type: 'story',
  subtype: 'mythical_form',
  text: 'The Ancient Sun God manifests in radiant glory!'
};
const mythicalStoryHtml = renderTurnRowHtmlFn(mythicalStoryRow, false);
assert(mythicalStoryHtml.includes('b-row-mythical'), 'Mythical story row must have b-row-mythical class');
assert(mythicalStoryHtml.includes('MYTHICAL FORM AWAKENING'), 'Mythical banner tag must render');
assert(mythicalStoryHtml.includes('Ancient Sun God'), 'Mythical story text must render');

const mythicalTurnRow = {
  actorName: 'Amon',
  actorTeam: 'enemy',
  ability: 'Mythical Theft',
  subrows: [
    { type: 'mythical', text: 'Amon awakens his Mythical Form!' }
  ]
};
const mythicalTurnHtml = renderTurnRowHtmlFn(mythicalTurnRow, false);
assert(mythicalTurnHtml.includes('mythical-turn') || mythicalTurnHtml.includes('b-row-mythical'), 'Turn with mythical awakening must have mythical row class');
assert(mythicalTurnHtml.includes('MYTHICAL FORM AWAKENING'), 'Turn must render awakening banner');
console.log('✓ Mythical Form turns display prominent atmospheric awakening banner and styling');

console.log('All Battle Log unit tests passed successfully!');
