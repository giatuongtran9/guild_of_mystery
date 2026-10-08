// Regression cases use real normalized pathway definitions and the existing runtime APIs.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const g = require('../js/node-loader');
const root = path.join(__dirname, '..');
const copy = x => JSON.parse(JSON.stringify(x));
let passed = 0, failed = 0;
function test(label, fn) {
  try { fn(); passed++; console.log(`PASS ${label}`); }
  catch (error) { failed++; console.log(`FAIL ${label}: ${error.message}`); }
}
function agent(p, seq = 9) {
  const a = g.makeAgent(() => .5, { path: p, sequence: seq, trait: 'Stout Vitality' });
  a.id = `probe_${p}_${seq}`; a.name = `Probe ${p}`; a.recommendedPath = null;
  a.statVariance = { hp: 1, atk: 1, def: 1, int: 1, speed: 1 }; a.speedVariance = 1;
  a.weaponId = 'none'; a.weaponMastery = {}; a.injuries = 0;
  g.restatAgent(a); a.sp = g.maxSPFor(a); return a;
}
const expectedResistances = [
  ['abyss', 7, { physical: 15, fire: 35, magma: 20, corrosion: 10 }],
  ['chained', 9, { physical: 15, dark: 15, corrosion: 15 }],
  ['death', 9, { death: 20, dark: 10, corrosion: 10, frost: 10 }],
  ['demoness', 9, { frost: 15, poison: 40, dark: 10 }],
  ['mother', 9, { nature: 20, poison: 15, physical: 15 }],
  ['paragon', 9, { magic: 15, piercing: 10, corrosion: 10 }],
  ['twilight_giant', 3, { decay: 15, physical: 30 }],
  ['tyrant', 9, { lightning: 25, water: 25 }]
];

test('all map-form resistance JSON values use percentage points rather than fractional ratios', () => {
  const errors = [];
  for (const key of g.PATH_KEYS) {
    const p = JSON.parse(fs.readFileSync(path.join(root, 'data/pathways', `${key}.json`), 'utf8'));
    for (const tier of p.sequences) for (const e of tier.ability.effects || []) {
      if (e.type !== 'resistance' || !e.values) continue;
      for (const [element, value] of Object.entries(e.values)) {
        if (!Number.isFinite(value) || value < 1 || value > 100) errors.push(`${key} Seq${tier.sequence} ${element}=${value}`);
      }
    }
  }
  assert.deepStrictEqual(errors, [], errors.join('; '));
});
for (const [p, seq, expected] of expectedResistances) {
  test(`${p} Seq${seq}: aliases canonicalize and distinct passive resistance adds to defaults`, () => {
    assert.deepStrictEqual(g.combatRates(agent(p, seq)).resistances, expected);
  });
}
test('single element+amount protection is implemented: Darkness Fear25%, Hermit Curse25%', () => {
  const dark = agent('darkness'), hermit = agent('hermit');
  assert.strictEqual(g.statusResistChance({ agent: dark }, 'fear'), .25);
  assert.strictEqual(g.statusResistChance({ agent: hermit }, 'curse'), .25);
  assert(!Object.hasOwn(g.combatRates(dark).resistances, 'fear'), 'Fear is a status, not an elemental damage bucket');
  assert(!Object.hasOwn(g.combatRates(hermit).resistances, 'curse'), 'Curse is a status, not an elemental damage bucket');
});
test('physical+slashing/blunt in one resistance effect is deduplicated, not granted twice', () => {
  assert.strictEqual(g.combatRates(agent('chained')).resistances.physical, 15);
  assert.strictEqual(g.combatRates(agent('twilight_giant', 3)).resistances.physical, 30);
});
test('resistance aliases change actual damage mitigation, not only the displayed map', () => {
  const defender = agent('death'), attacker = agent('moon');
  const unit = { id: 'death_target', name: 'Death target', agent: defender,
    path: defender.path, sequence: defender.sequence, hp: defender.stats.hp,
    maxHp: defender.stats.hp, alive: true, status: [], resistances: g.combatRates(defender).resistances };
  const trace = {};
  g.v15Damage('pure_caster_ability', { agent: attacker, actor: { status: [] }, target: unit,
    abilityMult: 1, damageSpec: { scaling: 'INT', multiplier: 1, type: 'elemental', element: 'cold' }, trace });
  assert.strictEqual(trace.resistance, 10, 'Cold must use the Frost resistance granted by Cold Body');
  const rotTrace = {};
  g.v15Damage('pure_caster_ability', { agent: attacker, actor: { status: [] }, target: unit,
    abilityMult: 1, damageSpec: { scaling: 'INT', multiplier: 1, type: 'elemental', element: 'rot' }, trace: rotTrace });
  assert.strictEqual(rotTrace.resistance, 10, 'Rot must use the Corrosion resistance granted by Cold Body');
});
test('fresh generated enemies expose the same passive/default resistance total as a fresh agent', () => {
  const expected = g.combatRates(agent('abyss', 7)).resistances;
  const enemy = g.makeEnemy(7, () => .5, 0, 'abyss');
  assert.strictEqual(g.combatRates(enemy).resistances.fire, 35);
  assert.deepStrictEqual(g.combatRates(enemy).resistances, expected);
});
test('legacy resistance caches cannot override or double-count reconstructed passive protection', () => {
  const s = g.newGame(), a = agent('abyss', 7); a.resistances = { fire: .15, magma: 20, corrosion: 10 };
  s.roster = [a];
  const migrated = g.migrateSave(copy(s));
  assert.strictEqual(g.combatRates(migrated.roster[0]).resistances.fire, 35);
  assert.strictEqual(g.combatRates(migrated.roster[0]).resistances.magma, 20);
  const again = g.migrateSave(copy(migrated));
  assert.deepStrictEqual(g.combatRates(again.roster[0]).resistances, g.combatRates(migrated.roster[0]).resistances);
});
test('save repair preserves unrelated resistance extras, progress, guild resources, equipment and chapter', () => {
  const s = g.newGame(), a = agent('abyss', 7); a.digest = 63; a.injuries = 31; a.weaponId = 'knife';
  a.basePathSpeed = g.basePathSpeed('abyss', 9);
  a.resistances = { fire: .15, magma: 20, corrosion: 10, spatial: 7 };
  s.roster = [a]; s.funds = 417; s.day = 18; s.weapons.knife--; s.campaign.completed = ['open_doors'];
  const before = copy(s), migrated = g.migrateSave(copy(s));
  for (const key of ['funds', 'day', 'materials', 'weapons', 'quests', 'wanted', 'teams', 'campaign']) {
    assert.deepStrictEqual(migrated[key], before[key], key);
  }
  const repaired = migrated.roster[0];
  for (const key of ['stats', 'baseStats', 'digest', 'injuries', 'weaponId', 'statVariance', 'speedVariance']) {
    assert.deepStrictEqual(repaired[key], before.roster[0][key], key);
  }
  assert.strictEqual(g.combatRates(repaired).resistances.spatial, 7);
  assert.strictEqual(g.combatRates(repaired).resistances.fire, 35);
});
test('malformed saved resistance values cannot remove innate protection or create nonfinite totals', () => {
  const s = g.newGame(), a = agent('abyss', 7);
  a.resistances = { fire: null, magma: null, corrosion: false, physical: '', spatial: 7, water: 'Infinity' };
  s.roster = [a];
  const migrated = g.migrateSave(copy(s));
  const expected = { physical: 15, fire: 35, magma: 20, corrosion: 10, spatial: 7 };
  assert.deepStrictEqual(g.combatRates(migrated.roster[0]).resistances, expected);
  assert.deepStrictEqual(g.combatRates(g.migrateSave(copy(migrated)).roster[0]).resistances, expected);
});
test('valid extreme resistance bonuses clamp and invalid numeric datatypes are ignored', () => {
  const a = agent('abyss', 7);
  a.resistanceBonuses = { magma: 200, corrosion: -200, fire: Infinity, water: NaN, spatial: false, magic: [] };
  const res = g.combatRates(a).resistances;
  assert.deepStrictEqual(res, { physical: 15, fire: 35, magma: 90, corrosion: -100 });
  assert(Object.values(res).every(Number.isFinite));
});
test('reserved Object keys in saved resistance maps cannot resolve inherited aliases', () => {
  const a = agent('abyss', 7);
  a.resistanceBonuses = JSON.parse('{"constructor":5,"__proto__":5,"prototype":5,"spatial":7}');
  assert.deepStrictEqual(g.combatRates(a).resistances,
    { physical: 15, fire: 35, magma: 20, corrosion: 10, spatial: 7 });
});
test('resistance display uses additive points and deduplicated alias names', () => {
  const abyss = g.combatRates(agent('abyss', 7)), chained = g.combatRates(agent('chained'));
  assert.strictEqual(abyss.resistances.fire, 35);
  assert(abyss.passives.some(text => text.includes('15% Fire Res')));
  assert(!abyss.passives.some(text => text.includes('1500%')));
  assert(chained.passives.some(text => text.includes('15% Physical Res')));
  assert(!chained.passives.some(text => text.includes('Slashing Res')));
  assert(g.combatRates(agent('demoness')).passives.some(text => text.includes('25% Poison Res')));
});

// Invoke the real shipped advancement handler with the normal engine/state dependencies.
// DOM rendering and the confirmation dialog are replaced; the advancement mutation is not reimplemented.
function runUIAdvancement(s, id) {
  const source = fs.readFileSync(path.join(root, 'js/ui.js'), 'utf8');
  const match = source.match(/advance:id=>\{([\s\S]*?)\},\s*heal:id=>/);
  assert(match, 'The shipped advancement handler must be discoverable');
  const env = { ...g, state: s, chapterBlocked: () => false, confirm: () => true,
    toast: () => {}, pathName: p => g.pathOf(p).name, Date: { now: () => 1 },
    noteAgent: (a, day, text) => a.history.push({ day, text }),
    chronicle: (d, text) => d.chronicle.unshift({ day: d.day, text }) };
  env.commit = fn => { const draft = copy(env.state); fn(draft); env.state = draft; };
  const advance = new Function('env', `with (env) { return id => { ${match[1]} }; }`)(env);
  advance(id); return env.state;
}
for (const [p, from] of [['tyrant', 9], ['fool', 1]]) {
  test(`real UI advancement ${p} Seq${from}→${from - 1} updates current-Sequence base Speed`, () => {
    const s = g.newGame(), a = agent(p, from); a.digest = 100; s.roster = [a]; s.funds = 100000;
    s.materials[g.pathOf(p).material] = 100;
    const next = runUIAdvancement(s, a.id), advanced = next.roster[0];
    assert.strictEqual(advanced.sequence, from - 1, 'Fixed successful seed must really advance');
    assert.strictEqual(advanced.basePathSpeed, g.basePathSpeed(p, from - 1));
    const stats = advanced.stats;
    const expectedSpeed = g.basePathSpeed(p, from - 1) + .2 * stats.int + .1 * stats.atk;
    assert(Math.abs(g.speedFor(advanced) - expectedSpeed) < .000001);
  });
}
test('schema9 reload repairs stale base Speed without rerolling or rebuilding earned stats', () => {
  const s = g.newGame(), a = agent('tyrant', 8); a.basePathSpeed = g.basePathSpeed('tyrant', 9);
  a.stats.atk += 17; a.digest = 81; a.injuries = 29; s.roster = [a];
  const before = copy(a), repaired = g.migrateSave(copy(s)).roster[0];
  assert.strictEqual(repaired.basePathSpeed, g.basePathSpeed('tyrant', 8));
  for (const key of ['stats', 'baseStats', 'digest', 'injuries', 'statVariance', 'speedVariance']) {
    assert.deepStrictEqual(repaired[key], before[key], key);
  }
});
test('Sequence0 Speed fallback uses the Sequence0 table rather than treating0 as9', () => {
  const a = agent('fool', 0); delete a.basePathSpeed;
  const expected = g.basePathSpeed('fool', 0) + .2 * a.stats.int + .1 * a.stats.atk;
  assert(Math.abs(g.speedFor(a) - expected) < .000001);
});

// Execute the shipped display helper and dossier renderer without loading a DOM.
// The rendered numeric values, not a reimplemented display formula, are tested.
function shippedDossierUI(a) {
  const source = fs.readFileSync(path.join(root, 'js/ui.js'), 'utf8');
  const pathSource = fs.readFileSync(path.join(root, 'js/paths.js'), 'utf8');
  const weaponHelpers = ['masteryKey', 'weaponMasteryValue', 'weaponStats', 'weaponFor'].map(name => {
    const match = pathSource.match(new RegExp(`^function ${name}\\(.*$`, 'm'));
    assert(match, `Shipped ${name} dependency must be discoverable`); return match[0];
  }).join('\n');
  const helperStart = source.indexOf('function combatDisplayStats(a)');
  const helperEnd = source.indexOf('function statPair(', helperStart);
  const dossierStart = source.indexOf('function dossier()');
  const dossierEnd = source.indexOf('function assignmentModal()', dossierStart);
  assert(helperStart >= 0 && helperEnd > helperStart && dossierStart >= 0 && dossierEnd > dossierStart);
  const s = g.newGame(); s.roster = [a];
  const env = { ...g, TRAITS: JSON.parse(fs.readFileSync(path.join(root, 'data/enemies.json'), 'utf8')).TRAITS,
    state: s, selected: a.id, esc: value => String(value),
    pathName: p => g.pathOf(p).name, statusBar: () => '', equipmentPicker: () => '' };
  return new Function('env', `with (env) {
    ${weaponHelpers}
    ${source.slice(helperStart, helperEnd)}
    ${source.slice(dossierStart, dossierEnd)}
    return { combatDisplayStats, dossier, weaponStats };
  }`)(env);
}
for (const [p, seq] of [['tyrant', 9], ['abyss', 9], ['white_tower', 9], ['twilight_giant', 3]]) {
  test(`shipped ${p} dossier injured HP/ATK/DEF/INT match canonical passive and weapon stats`, () => {
    const a = agent(p, seq); a.injuries = 100; a.weaponId = 'knife'; a.weaponMastery = { weapon: 3 };
    const before = copy(a), unit = g.makeCombatUnit(a), pm = g.passiveCombatModifier(unit.agent), ui = shippedDossierUI(a);
    const expected = { hp: unit.maxHp,
      atk: Math.round(unit.stats.atk * pm.atk + ui.weaponStats(unit.agent).atk),
      def: Math.round(unit.stats.def * pm.def), int: Math.round(unit.stats.int * pm.int) };
    const display = ui.combatDisplayStats(a), markup = ui.dossier();
    for (const [key, value] of Object.entries(expected)) {
      assert.strictEqual(display[key], value, `${key} helper must match combat`);
      const rendered = markup.match(new RegExp(`<span>${key.toUpperCase()}</span><b>([0-9]+)</b>`));
      assert(rendered, `${key} must appear in the actual dossier`);
      assert.strictEqual(Number(rendered[1]), value, `${key} rendered value must match combat`);
    }
    assert.deepStrictEqual(a, before, 'Rendering must not mutate persistent stats or progression');
  });
}
test('shipped injured dossier Speed/AV/dodge/counter use the canonical effective record', () => {
  const a = agent('tyrant', 7); a.injuries = 100;
  const unit = g.makeCombatUnit(a), expected = g.combatRates(unit.agent, unit), ui = shippedDossierUI(a);
  assert.strictEqual(ui.combatDisplayStats(a).spd, Math.round(expected.speed));
  const markup = ui.dossier(), speedAV = markup.match(/Speed ([0-9.]+) · AV ([0-9.]+)/);
  assert(speedAV, 'Actual dossier must render Speed and AV');
  assert.strictEqual(speedAV[1], expected.speed.toFixed(1));
  assert.strictEqual(speedAV[2], expected.av.toFixed(1));
  assert(markup.includes(`Dodge ${Math.round(expected.dodge * 100)}%`));
  assert(markup.includes(`Counter ${Math.round(expected.counter * 100)}%`));
});

function injuryBattle(p, injuries) {
  const a = agent(p, 7); a.stats = { hp: 10000, atk: 300, def: 300, int: 300 };
  a.baseStats = { hp: 7500, atk: 225, def: 225, int: 225 }; a.injuries = injuries; a.sp = g.maxSPFor(a);
  const before = copy(a);
  const q = { name: 'Injury Regression', story: '', encounter: true, difficultySequence: 7,
    enemyCount: 1, requiredPath: p, rewards: { funds: 0, reputation: 0, materials: {} } };
  // Comparable INT avoids a low-INT attacker hitting the shared 75% dodge cap.
  const result = g.resolveQuest([a], q, 21, { authoredOpponents: [{ id: 'dummy', name: 'Dummy',
    path: p, sequence: 7, trait: 'Stout Vitality', stats: { hp: 100000, atk: 10, def: 100, int: 300 } }] });
  return { a, before, result, trace: result.battleSnapshot.balanceTrace };
}
test('injuries scale real INT ability damage by the displayed effective-stat penalty', () => {
  const clean = injuryBattle('moon', 0), injured = injuryBattle('moon', 100);
  const cleanHit = clean.trace.find(t => t.attacker === clean.a.name && t.abilityId === 'blood_siphon');
  const injuryHit = injured.trace.find(t => t.attacker === injured.a.name && t.abilityId === 'blood_siphon');
  assert(cleanHit && injuryHit, 'Both real battles must cast Blood Siphon');
  assert(Math.abs(injuryHit.raw - cleanHit.raw * .7) < .000001,
    `injured raw${injuryHit.raw} should be70% of clean raw${cleanHit.raw}`);
});
test('injuries scale real hybrid ATK/INT ability damage and defender DEF consistently', () => {
  const clean = injuryBattle('tyrant', 0), injured = injuryBattle('tyrant', 100);
  const hit = x => x.trace.find(t => t.attacker === x.a.name);
  assert(Math.abs(hit(injured).raw - hit(clean).raw * .7) < .000001);
  const defended = injured.trace.find(t => t.target === injured.a.name);
  assert(defended, 'Enemy must land a traceable strike');
  assert.strictEqual(defended.defense, g.effectiveStats(injured.before).def);
});
test('combat and consequence settlement preserve uninjured stats/baseStats instead of compounding penalties', () => {
  const battle = injuryBattle('moon', 100), s = g.newGame(); s.roster = [battle.a];
  assert.deepStrictEqual(battle.a.stats, battle.before.stats, 'resolveQuest must not modify caller stats');
  g.applyConsequences(s, battle.result.consequences);
  assert.strictEqual(s.roster.length, 1, 'The survivor must settle');
  assert.deepStrictEqual(s.roster[0].stats, battle.before.stats, 'Persistent stats must retain the uninjured values');
  assert.deepStrictEqual(s.roster[0].baseStats, battle.before.baseStats);
  assert.deepStrictEqual(g.effectiveStats(s.roster[0]), g.effectiveStats(battle.before), 'Injury penalty applies exactly once');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
