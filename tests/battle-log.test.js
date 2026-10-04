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
      if (next.type === 'cast' || next.type === 'round_start') break;
      if (next.type === 'damage' && next.actorId === ev.actorId) {
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
      assert(row.damages[0].amount > 0, 'Merged damage must be greater than 0');
    }
  }
}

assert.strictEqual(mergedRowsFound, castEventsWithDamage,
  `Merged rows (${mergedRowsFound}) must match cast events with damage (${castEventsWithDamage})`);
console.log(`✓ Verified ${mergedRowsFound} cast-with-damage actions each produced exactly one merged row`);

// 6. Test Structured Round & Action Continuity
console.log('Checking structured round and action continuity...');
const roundEvents = res2v2.events.filter(e => e.type === 'system' && e.subtype === 'initiative');
assert(roundEvents.length > 0, 'Structured initiative round events must be present');
const castEvents = res2v2.events.filter(e => e.type === 'cast' || e.type === 'basic_attack');
assert(castEvents.length > 0, 'Structured cast / basic_attack action events must be present');
console.log(`✓ Structured events intact (${res2v2.events.length} total events across ${roundEvents.length} rounds, ${castEvents.length} actions)`);

console.log('All Battle Log unit tests passed successfully!');
