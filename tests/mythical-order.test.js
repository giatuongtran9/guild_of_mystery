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
// --- synthetic: a reactive authority must not steal the row from the hit that awakened it
{
  const ev = [
    { round: 1, type: 'cast', actorId: 'S', actorName: 'Scholar', actorTeam: 'enemy', ability: 'Strike', costSP: 10 },
    { round: 1, type: 'story', subtype: 'mythical_form', inTurn: true, actorId: 'W', actorName: 'Wheel', text: 'MYTHICAL FORM: Wheel awakens' },
    { round: 1, type: 'damage', subtype: 'mythical_authority', actorId: 'W', actorName: 'Wheel', targetId: 'S', amount: 20, hpLoss: 20, absorbed: 0 },
    { round: 1, type: 'damage', actorId: 'S', actorName: 'Scholar', targetId: 'W', amount: 50, hpLoss: 50, absorbed: 0 },
    { round: 1, type: 'resources', units: [{ id: 'W', hp: 50 }, { id: 'S', hp: 80 }] },
  ];
  const rows = g.groupEventsToRows(ev)[0].rows;
  assert.strictEqual(rows.length, 1, 'awakening and its authority remain inside the causing attack');
  assert.strictEqual(rows[0].actorId, 'S');
  assert.strictEqual(rows[0].damages[0], ev[3]);
  assert.strictEqual(rows[0].reactions[0], ev[2], 'reactive damage retains its own actor');
  assert.deepStrictEqual(rows[0].subrows.map(s => s.type), ['mythical', 'reaction']);
  assert.strictEqual(rows[0].resources, ev[4].units, 'final resources attach to the complete attack');
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
// --- real battles: an awakening caused by a hit must sit inside THAT attacker's row (basic attacks included)
let _seed = 99;
const seededRng = () => ((_seed = Math.imul(1664525, _seed) + 1013904223) >>> 0) / 4294967296;
const mkSeeded = (path, seq, id) => { const a = g.makeAgent(seededRng, { sequence: seq, path, trait: 'Stout Vitality' }); Object.assign(a, { id, name: g.pathOf(path).name + ' Seq ' + seq, awakened: true, path, sequence: seq, recommendedPath: path, injuries: 0, weaponId: 'none', weaponMastery: {} }); g.restatAgent(a); a.sp = g.maxSPFor(a); return a; };
let seen = 0, basic = 0;
for (let sd = 1; sd <= 150; sd++) {
  const q = { id: 's', name: 'x', brief: '', story: '', objective: 'combat', difficultySequence: 0, encounter: true, mundane: false, rewards: { funds: 0, reputation: 0, materials: {} }, enemyCount: 2, requiredPath: 'door' };
  const res = g.resolveQuest([mkSeeded('wheel_of_fortune', 0, 'W'), mkSeeded('fool', 0, 'F')], q, sd, { individual: false, simulationOpponents: [{ path: 'door', sequence: 0 }, { path: 'error', sequence: 0 }] });
  const ev = res.events, rows = g.groupEventsToRows(ev).flatMap(r => r.rows);
  ev.forEach((e, i) => {
    if (!(e.subtype === 'mythical_form' && e.inTurn)) return;
    // The causing attack follows the awakening; reflected hits may awaken its caster instead of its target.
    let hit = null;
    for (let j = i + 1; j < ev.length; j++) { if (ev[j].type === 'round_start') break; if (ev[j].type === 'damage' && !ev[j].isReflect && !ev[j].isSignature && ev[j].subtype !== 'mythical_authority') { hit = ev[j]; break; } }
    if (!hit) return; // not caused by an attack hit (e.g. start-of-round DoT tick)
    seen++; if (ev.slice(i + 1, ev.indexOf(hit)).some(x => x.type === 'cast')) basic++;
    assert(!rows.some(r => r.type === 'story' && r.text === e.text), `seed ${sd}: in-hit awakening must not be a standalone row`);
    const row = rows.find(r => r.type === 'turn' && r.subrows.some(sr => sr.type === 'mythical' && sr.text === e.text));
    assert(row, `seed ${sd}: awakening must be a subrow of an attack turn`);
    assert.strictEqual(row.actorId, hit.actorId, `seed ${sd}: awakening shown under ${row.actorName}'s row but caused by ${hit.actorName}'s hit`);
  });
}
assert(seen > 50, 'test must actually exercise in-hit awakenings');
console.log(`PASS mythical-order (${seen} in-hit awakenings checked, each under the right attacker's row)`);
