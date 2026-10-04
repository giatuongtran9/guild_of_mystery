// Mythical Form awakened by a hit must render inside that attack's row, not above it.
const assert = require('assert');
const g = require('../js/node-loader.js');
const mk = (path, seq, id) => { const a = g.makeAgent(Math.random, { sequence: seq, path, trait: 'Stout Vitality' }); Object.assign(a, { id, name: g.pathOf(path).name + ' Seq ' + seq, awakened: true, path, sequence: seq, recommendedPath: path, injuries: 0, weaponId: 'none', weaponMastery: {} }); g.restatAgent(a); a.sp = g.maxSPFor(a); return a; };

// --- synthetic: cast -> mythical story (from hit) -> shield -> stun -> damage
{
  const ev = [
    { round: 1, type: 'cast', actorId: 'S', actorName: 'Scholar', actorTeam: 'enemy', ability: 'Systemic Glitch' },
    { round: 1, type: 'story', subtype: 'mythical_form', inTurn: true, actorId: 'W', actorName: 'Wheel', text: 'MYTHICAL FORM: Wheel awakens' },
    { round: 1, type: 'shield', actorId: 'W', targetId: 'W', amount: 5 },
    { round: 1, type: 'status', actorId: 'W', targetId: 'S', text: 'Scholar is overwhelmed by mental pollution' },
    { round: 1, type: 'damage', actorId: 'S', actorName: 'Scholar', targetId: 'W', targetName: 'Wheel', amount: 143800 },
  ];
  const rows = g.groupEventsToRows(ev)[0].rows;
  assert.strictEqual(rows.length, 1, 'awakening must not create a row above the attack');
  assert.strictEqual(rows[0].ability, 'Systemic Glitch');
  assert.strictEqual(rows[0].damages.length, 1);
  assert.deepStrictEqual(rows[0].subrows.map(s => s.type), ['mythical', 'status'], 'order: awakening, then stun');
}
// --- synthetic: awakening NOT caused by a hit keeps its own row, after the pending turn
{
  const ev = [
    { round: 1, type: 'cast', actorId: 'A', actorName: 'A', actorTeam: 'ally', ability: 'Strike' },
    { round: 1, type: 'damage', actorId: 'A', actorName: 'A', targetId: 'B', amount: 10 },
    { round: 1, type: 'story', subtype: 'mythical_form', inTurn: false, actorId: 'B', actorName: 'B', text: 'MYTHICAL FORM: B awakens' },
  ];
  const rows = g.groupEventsToRows(ev)[0].rows;
  assert.deepStrictEqual(rows.map(r => r.type), ['turn', 'story'], 'chronological order preserved');
}
// --- real battles: whenever a hit awakens a Mythical Form it is inside a turn row
let seen = 0;
for (let sd = 1; sd <= 80; sd++) {
  const q = { id: 's', name: 'x', brief: '', story: '', objective: 'combat', difficultySequence: 0, encounter: true, mundane: false, rewards: { funds: 0, reputation: 0, materials: {} }, enemyCount: 2, requiredPath: 'door' };
  const res = g.resolveQuest([mk('wheel_of_fortune', 0, 'W'), mk('fool', 0, 'F')], q, sd, { individual: false, simulationOpponents: [{ path: 'door', sequence: 0 }, { path: 'error', sequence: 0 }] });
  // Only awakenings that happen while an attack row is pending (a cast/damage/miss earlier in the same round).
  // A DoT tick at the start of a round has no pending attack row, so a standalone row is correct there.
  const midAttack = (e) => {
    const i = res.events.indexOf(e);
    for (let j = i - 1; j >= 0; j--) {
      const t = res.events[j].type;
      if (t === 'round_start') return false;
      if (t === 'cast' || t === 'damage' || t === 'miss') return true;
    }
    return false;
  };
  const mythEvents = res.events.filter(e => e.subtype === 'mythical_form' && e.inTurn && midAttack(e));
  const rows = g.groupEventsToRows(res.events).flatMap(r => r.rows);
  for (const e of mythEvents) {
    seen++;
    assert(!rows.some(r => r.type === 'story' && r.text === e.text), 'in-hit awakening must not be a standalone row');
    assert(rows.some(r => r.type === 'turn' && r.subrows.some(s => s.type === 'mythical' && s.text === e.text)), 'in-hit awakening must be a subrow of the attack turn');
  }
}
console.log(`PASS mythical-order (${seen} in-hit awakenings checked)`);
