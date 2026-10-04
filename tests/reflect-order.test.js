// Reflect damage fires while the attacker's hit is still resolving; it must stay inside that attack row.
const assert = require('assert');
const g = require('../js/node-loader.js');
const mk = (path, seq, id) => { const a = g.makeAgent(Math.random, { sequence: seq, path, trait: 'Stout Vitality' }); Object.assign(a, { id, name: g.pathOf(path).name + ' Seq ' + seq, awakened: true, path, sequence: seq, recommendedPath: path, injuries: 0, weaponId: 'none', weaponMastery: {} }); g.restatAgent(a); a.sp = g.maxSPFor(a); return a; };

// --- synthetic: cast -> reflect (hits the caster) -> caster's own damage => ONE row
{
  const ev = [
    { round: 1, type: 'cast', actorId: 'D', actorName: 'Dream Eater', actorTeam: 'enemy', ability: "Reaper's Harvest", costSP: 35 },
    { round: 1, type: 'damage', isReflect: true, actorId: 'F', actorName: 'Fool', targetId: 'D', targetName: 'Dream Eater', amount: 18349, damageType: 'fire', text: 'Fool reflects 18349 damage back at Dream Eater.' },
    { round: 1, type: 'damage', actorId: 'D', actorName: 'Dream Eater', targetId: 'F', targetName: 'Fool', amount: 15310, damageType: 'psychic' },
  ];
  const rows = g.groupEventsToRows(ev)[0].rows;
  assert.strictEqual(rows.length, 1, 'cast + reflect + hit must be one row');
  assert.strictEqual(rows[0].ability, "Reaper's Harvest");
  assert.strictEqual(rows[0].costSP, 35);
  assert.strictEqual(rows[0].damages.length, 1, "the attacker's own damage stays in damages");
  assert.strictEqual(rows[0].reflects.length, 1, 'reflect is kept for HP tracking');
  assert.deepStrictEqual(rows[0].subrows.map(s => s.type), ['reflect']);
  assert(/reflects 18\.3K damage back at Dream Eater/.test(rows[0].subrows[0].text), rows[0].subrows[0].text);
}
// --- synthetic: reflect with no pending attack row (e.g. a DoT tick) still shows as its own row
{
  const ev = [{ round: 2, type: 'damage', isReflect: true, actorId: 'F', actorName: 'Fool', targetId: 'D', targetName: 'D', amount: 10, damageType: 'fire', text: 'x' }];
  const rows = g.groupEventsToRows(ev)[0].rows;
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].damages.length, 1);
}
// --- real battles: a reflect belongs to the row of the attack it answered, and every damaging cast is one merged row
let _seed = 7;
const seededRng = () => ((_seed = Math.imul(1664525, _seed) + 1013904223) >>> 0) / 4294967296;
const mkSeeded = (path, seq, id) => { const a = g.makeAgent(seededRng, { sequence: seq, path, trait: 'Stout Vitality' }); Object.assign(a, { id, name: g.pathOf(path).name + ' Seq ' + seq, awakened: true, path, sequence: seq, recommendedPath: path, injuries: 0, weaponId: 'none', weaponMastery: {} }); g.restatAgent(a); a.sp = g.maxSPFor(a); return a; };
let reflects = 0;
const q = { id: 's', name: 'x', brief: '', story: '', objective: 'combat', difficultySequence: 0, encounter: true, mundane: false, rewards: { funds: 0, reputation: 0, materials: {} }, enemyCount: 2, requiredPath: 'red_priest' };
for (let sd = 1; sd <= 200; sd++) {
  const res = g.resolveQuest([mkSeeded('fool', 0, 'f0'), mkSeeded('door', 0, 'd0')], q, sd, { individual: false, simulationOpponents: [{ path: 'red_priest', sequence: 0 }, { path: 'demoness', sequence: 0 }] });
  const ev = res.events, rows = g.groupEventsToRows(ev).flatMap(r => r.rows);
  let expected = 0;
  for (let i = 0; i < ev.length; i++) {
    if (ev[i].type !== 'cast') continue;
    for (let j = i + 1; j < ev.length; j++) {
      const x = ev[j];
      if (x.type === 'cast' || x.type === 'round_start') break;
      if (x.type === 'damage' && x.actorId === ev[i].actorId) { expected++; break; }
    }
  }
  const merged = rows.filter(r => r.type === 'turn' && r.costSP !== undefined && r.damages && r.damages.length > 0).length;
  assert.strictEqual(merged, expected, `seed ${sd}: merged rows ${merged} != casts with damage ${expected}`);
  ev.forEach((e, i) => {
    if (!e.isReflect) return;
    let hit = null; // the attack it answered: first non-reflect damage after it, aimed at the reflecting unit
    for (let j = i + 1; j < ev.length; j++) { if (ev[j].type === 'round_start') break; if (ev[j].type === 'damage' && !ev[j].isReflect) { hit = ev[j]; break; } }
    if (!hit || hit.actorId !== e.targetId) return;
    reflects++;
    const row = rows.find(r => r.type === 'turn' && (r.reflects || []).includes(e));
    assert(row, `seed ${sd}: reflect must be inside an attack row`);
    assert.strictEqual(row.actorId, e.targetId, `seed ${sd}: reflect shown under ${row.actorName}'s row`);
  });
}
assert(reflects > 20, 'test must actually exercise reflects');
console.log(`PASS reflect-order (${reflects} reflects, each inside the row of the attack it answered)`);
