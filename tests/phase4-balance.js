// Neutral full-battle round robin. No runtime dependencies or production mutation.
// node tests/phase4-balance.js --phase=after --seeds=2
// A committed baseline can be loaded with --game-dir=/tmp/phase4-baseline.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const options = Object.fromEntries(process.argv.slice(2).map(arg => {
  const [key, ...value] = arg.replace(/^--/, '').split('=');
  return [key, value.join('=')];
}));
const gameDir = path.resolve(options['game-dir'] || path.join(__dirname, '..'));
const g = require(path.join(gameDir, 'js/node-loader.js'));
const phase = options.phase || 'after';
assert(/^[a-z0-9-]+$/.test(phase), 'phase must be a simple report name');
const seeds = Number(options.seeds || 2);
assert(Number.isInteger(seeds) && seeds >= 1 && seeds <= 100, 'seeds must be 1–100');
const sequences = options.sequences ? options.sequences.split(',').map(Number) : [9,8,7,6,5,4,3,2,1,0];
const charges = options.charges ? options.charges.split(',').map(Number) : [0,50,100];
const sizes = options.sizes ? options.sizes.split(',').map(Number) : [1,3];
const modes = options.modes ? options.modes.split(',') : ['normal','form-entry'];
assert(sequences.every(n => Number.isInteger(n) && n >= 0 && n <= 9));
assert(charges.every(n => [0,50,100].includes(n)));
assert(sizes.every(n => [1,3].includes(n)));
assert(modes.every(n => ['normal','form-entry'].includes(n)));
const pathways = options.pathways ? options.pathways.split(',') : g.PATH_KEYS;
assert(pathways.every(p => g.PATH_KEYS.includes(p)));
const output = path.join(__dirname, '..', 'reports', 'phase4');
fs.mkdirSync(output, { recursive: true });
const definitions = JSON.stringify(g.PATHS);
const rows = new Map();
let totalBattles = 0, swappedMismatches = 0, fixtureMismatches = 0;
const swappedExamples = [];
const start = Date.now();
function agent(pathway, sequence, name, charge) {
  const a = g.makeAgent(() => .5, { path: pathway, sequence: 10, trait: 'Stout Vitality' });
  Object.assign(a, { id: name, name, path: pathway, sequence, awakened: true, recommendedPath: null,
    injuries: 0, madness: 0, weaponId: 'none', weaponMastery: {}, cooldowns: {},
    statVariance: { hp: 1, atk: 1, def: 1, int: 1, speed: 1 }, speedVariance: 1 });
  g.restatAgent(a);
  a.sp = g.maxSPFor(a);
  g.setMeterValue(a, pathway, charge);
  return a;
}
function members(pathway, sequence, name, size, charge, mode) {
  return Array.from({ length: size }, (_, i) => {
    const a = agent(pathway, sequence, `${name}${i}`, charge);
    if (mode === 'normal') return a;
    const unit = g.makeCombatUnit(a);
    unit.hp = Math.floor(unit.maxHp * .49);
    return unit;
  });
}
function profile(source, charge, mode) {
  const a = g.getCombatAgent(source);
  const spec = { name: a.name, path: a.path, sequence: a.sequence, trait: a.trait,
    stats: { ...a.stats }, sp: a.sp, weaponId: 'none', weaponMastery: {}, meter: charge };
  if (mode !== 'normal') spec.startingHp = source.hp;
  return spec;
}
function signature(result) {
  // Actor names are kept with each profile when teams swap, including tie breaks.
  return [...result.battleSnapshot.allies, ...result.battleSnapshot.enemies]
    .map(u => [u.name, u.path, u.sequence, u.alive, u.hp, u.maxHp, u.sp, u.maxSP])
    .sort((a,b) => a[0].localeCompare(b[0]));
}
function verify(result, left, right, charge, mode) {
  const snapshot = result.battleSnapshot;
  for (const u of [...snapshot.allies, ...snapshot.enemies]) {
    assert(g.PATH_KEYS.includes(u.path), 'undefined combat pathway');
    assert(Number.isInteger(u.sequence) && u.sequence >= 0 && u.sequence <= 9, 'undefined Sequence');
    for (const key of ['hp','maxHp','sp','maxSP','initiative']) assert(Number.isFinite(u[key]), `invalid ${key}`);
    for (const key of ['hp','atk','def','int']) assert(Number.isFinite(u.stats[key]), `invalid stat ${key}`);
    assert(u.hp >= 0 && u.hp <= u.maxHp && u.sp >= 0 && u.sp <= u.maxSP, 'invalid resource bounds');
  }
  if (snapshot.initialUnits) {
    const initial = snapshot.initialUnits;
    for (const source of [...left,...right]) {
      const a = g.getCombatAgent(source), unit = initial.find(u => u.name === a.name);
      assert(unit, `missing starting profile ${a.name}`);
      if (unit.meter.value !== charge || (mode !== 'normal' && unit.hp !== source.hp)) fixtureMismatches++;
    }
  } else if (charge !== 0 || mode !== 'normal') {
    throw new Error('This engine cannot verify controlled charge / form-entry profiles. Use --charges=0 --modes=normal for the committed baseline.');
  }
}
function tally(result, pathway, sequence, size, charge, mode, team, opponent) {
  const key = [pathway,sequence,size,charge,mode].join(':');
  if (!rows.has(key)) rows.set(key, { pathway, sequence, team_size: size, initial_charge: charge, mode,
    battles: 0, wins: 0, losses: 0, draws: 0, deaths: 0, rounds: 0, forms: 0, signature_casts: 0,
    opponents: new Set() });
  const row = rows.get(key), own = result.battleSnapshot[team];
  const foes = result.battleSnapshot[team === 'allies' ? 'enemies' : 'allies'];
  const ownAlive = own.some(u => u.alive), enemyAlive = foes.some(u => u.alive);
  row.battles++; row.opponents.add(opponent);
  if (ownAlive && !enemyAlive) row.wins++;
  else if (!ownAlive && enemyAlive) row.losses++;
  else row.draws++;
  row.deaths += own.filter(u => !u.alive && /^(Alpha|Beta)\d+$/.test(u.name)).length;
  row.rounds += Math.max(0, ...result.events.map(e => e.round || 0));
  const eventTeam = team === 'allies' ? 'ally' : 'enemy';
  row.forms += result.events.filter(e => e.actorTeam === eventTeam && e.subtype === 'mythical_form').length;
  const abilities = g.unlockedAbilities({ path: pathway, sequence });
  const signatureNames = abilities.filter(a => g.abilityEffects(a).some(e => e.type === 'signature')).map(a => a.name);
  row.signature_casts += result.events.filter(e => e.actorTeam === eventTeam && e.type === 'cast' && signatureNames.includes(e.ability)).length;
}
for (const sequence of sequences) for (const size of sizes) for (const charge of charges) for (const mode of modes) {
  if (mode === 'form-entry' && sequence > 4) continue;
  for (let first = 0; first < pathways.length; first++) for (let second = first; second < pathways.length; second++) {
    const leftPath = pathways[first], rightPath = pathways[second];
    for (let sample = 0; sample < seeds; sample++) {
      const left = members(leftPath, sequence, 'Alpha', size, charge, mode);
      const right = members(rightPath, sequence, 'Beta', size, charge, mode);
      const pristine = JSON.stringify([left,right]);
      const quest = { name: 'Neutral paired trial', encounter: true, objective: 'combat', difficultySequence: sequence,
        rewards: { funds: 0, reputation: 0, materials: {} } };
      const seed = 810019 + sequence * 100003 + first * 1009 + second * 37 + sample * 997;
      const run = (allies, enemies) => g.resolveQuest(allies, quest, seed,
        { individual: true, authoredOpponents: enemies.map(u => profile(u, charge, mode)) });
      const forward = run(left,right), reverse = run(right,left);
      totalBattles += 2;
      verify(forward,left,right,charge,mode); verify(reverse,right,left,charge,mode);
      if (JSON.stringify(signature(forward)) !== JSON.stringify(signature(reverse))) {
        swappedMismatches++;
        if (swappedExamples.length < 20) swappedExamples.push({ leftPath, rightPath, sequence, size, charge, mode, seed,
          forward: signature(forward), reverse: signature(reverse) });
      }
      assert.strictEqual(JSON.stringify([left,right]), pristine, 'simulation mutated source profiles');
      for (const [result, lteam, rteam] of [[forward,'allies','enemies'],[reverse,'enemies','allies']]) {
        tally(result,leftPath,sequence,size,charge,mode,lteam,rightPath);
        tally(result,rightPath,sequence,size,charge,mode,rteam,leftPath);
      }
    }
  }
  console.log(`${phase}: Seq${sequence}, ${size}v${size}, charge${charge}, ${mode}: ${totalBattles} battles`);
}
assert.strictEqual(JSON.stringify(g.PATHS), definitions, 'simulation mutated shared pathway definitions');
assert.strictEqual(fixtureMismatches, 0, 'controlled initial resources differed between teams');
const ordered = [...rows.values()].sort((a,b) => a.pathway.localeCompare(b.pathway) || b.sequence-a.sequence || a.team_size-b.team_size || a.initial_charge-b.initial_charge || a.mode.localeCompare(b.mode));
const fields = ['pathway','sequence','team_size','initial_charge','mode','opponents','battles','wins','losses','draws','win_rate','draw_rate','deaths_per_battle','average_rounds','forms_per_battle','signature_casts_per_battle'];
const percent = n => (n*100).toFixed(2);
const csvRows = ordered.map(r => [r.pathway,r.sequence,r.team_size,r.initial_charge,r.mode,r.opponents.size,r.battles,r.wins,r.losses,r.draws,
  percent(r.wins/r.battles),percent(r.draws/r.battles),(r.deaths/r.battles).toFixed(3),(r.rounds/r.battles).toFixed(3),(r.forms/r.battles).toFixed(3),(r.signature_casts/r.battles).toFixed(3)].join(','));
fs.writeFileSync(path.join(output,`${phase}-neutral.csv`), `${fields.join(',')}\n${csvRows.join('\n')}\n`);
if (swappedExamples.length) fs.writeFileSync(path.join(output,`${phase}-swapped-examples.json`), `${JSON.stringify(swappedExamples,null,2)}\n`);
const table = pathways.map(p => {
  const ranks = sequences.map(s => {
    const selected = ordered.filter(r => r.pathway===p && r.sequence===s && r.mode==='normal' && r.initial_charge===0 && r.team_size===3);
    const b = selected.reduce((sum,r) => sum+r.battles,0), w = selected.reduce((sum,r) => sum+r.wins,0), d = selected.reduce((sum,r) => sum+r.draws,0);
    return b ? `${percent(w/b)} / ${percent(d/b)}` : '—';
  });
  return `| ${p} | ${ranks.join(' | ')} |`;
});
const report = `# Phase 4 ${phase}: neutral matched battles\n\n`+
  `Ran ${totalBattles} complete battles with ${seeds} paired seed(s) per pathway matchup and mode.\n\n`+
  `Same Sequence, neutral variance, Stout Vitality trait, no equipment, full initial SP and no injury/madness. Each pair runs with both team assignments using the same seed and persistent actor names. Individual mode removes the PvE enemy damage multiplier. Archetype stats and innate pathway passives remain. Mirrors are included.\n\n`+
  `Draw means both sides survive the existing 15-round cap (or simultaneous defeat); it is not counted as a loss. Form-entry fixtures begin at 49% HP on both sides for Sequence 4–0. These probe form interactions, not typical encounter win rates. A support pathway need not win 50% of duels. Small seed counts give direction, not precise rankings.\n\n`+
  `Controlled fixture mismatches: ${fixtureMismatches}. Swapped final-state mismatches: ${swappedMismatches}; these must be reviewed before concluding side parity. Runtime: ${((Date.now()-start)/1000).toFixed(1)} seconds. Original profiles and shared pathway definitions stayed unchanged.\n\n`+
  `Table: normal 3v3, zero initial charge; each cell is win % / draw %. The CSV includes 1v1 and 3v3, charge 0/50/100 and controlled form entry where requested.\n\n`+
  `| Pathway | ${sequences.map(s=>`Seq${s}`).join(' | ')} |\n| --- | ${sequences.map(()=> '---').join(' | ')} |\n${table.join('\n')}\n`;
fs.writeFileSync(path.join(output,`${phase}-neutral.md`), report);
console.log(`Wrote ${phase}-neutral.csv/.md; ${totalBattles} battles, ${swappedMismatches} swapped mismatches.`);
process.exitCode = fixtureMismatches || swappedMismatches ? 1 : 0;
