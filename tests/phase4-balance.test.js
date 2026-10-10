// Approved shared form probability and controlled balance-fixture contracts.
const assert = require('assert');
const g = require('../js/node-loader.js');
const formulas = require('../data/formulas.json');
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`PASS ${name}`); }
  catch (err) { failed++; console.log(`FAIL ${name}: ${err.message}`); }
}
function agent(path, sequence, name) {
  const a = g.makeAgent(() => .5, { path, sequence: 10, trait: 'Stout Vitality' });
  Object.assign(a, { id: name, name, path, sequence, awakened: true, recommendedPath: null,
    injuries: 0, madness: 0, weaponId: 'none', weaponMastery: {}, cooldowns: {},
    statVariance: { hp: 1, atk: 1, def: 1, int: 1, speed: 1 }, speedVariance: 1 });
  g.restatAgent(a);
  a.sp = g.maxSPFor(a);
  return a;
}
test('mythical awakening uses the approved 70% probability in data and its shared description', () => {
  const rules = formulas.mythical_creature_form_rules;
  assert.strictEqual(rules.mental_pollution_chance, .7);
  assert(rules.stance_buffs.mental_pollution_aura.includes('70%'));
  assert(rules.stance_buffs.mental_pollution_aura.includes('5–9'));
});
test('the approved awakening stun affects Sequence 5–9 only on either team', () => {
  for (const side of ['allies', 'enemies']) {
    const caster = g.makeCombatUnit(agent('fool', 4, 'Caster'));
    caster.hp = Math.floor(caster.maxHp * .49);
    const targets = [9, 5, 4, 0].map(s => g.makeCombatUnit(agent('fool', s, `Target${s}`)));
    const state = { allies: side === 'allies' ? [caster] : targets,
      enemies: side === 'enemies' ? [caster] : targets, events: [], currentRound: 1 };
    g.tryMythicalForm(caster.agent, caster, state, [], () => .5);
    assert(caster._inForm, 'fixture must trigger transformation');
    for (const target of targets) assert.strictEqual(g.hasStatus(target, 'stunned'), target.sequence >= 5,
      `Sequence ${target.sequence} on ${side} transformation`);
  }
});
test('a large INT advantage does not double-count enough evasion to suppress physical attackers', () => {
  const attacker=g.makeCombatUnit(agent('tyrant',5,'Physical'));
  const target=g.makeCombatUnit(agent('fool',5,'Caster'));
  const state={allies:[attacker],enemies:[target],events:[],currentRound:1};
  assert.strictEqual(g.attackHit(attacker.agent,attacker,target,state,[],()=>.5),true,
    'the 50th-percentile roll should hit after the approved relative-INT coefficient reduction');
  assert.strictEqual(formulas.combat_rates.dodge.int_advantage_coefficient,.10);
});
test('authored and allied balance profiles retain matching initial charge, SP and damaged HP', () => {
  const a = agent('fool', 4, 'Alpha'), b = agent('door', 4, 'Beta');
  g.setMeterValue(a, a.path, 100); g.setMeterValue(b, b.path, 100);
  const ua = g.makeCombatUnit(a), ub = g.makeCombatUnit(b);
  ua.hp = Math.floor(ua.maxHp * .49); ub.hp = Math.floor(ub.maxHp * .49);
  const profile = { name: b.name, path: b.path, sequence: b.sequence, trait: b.trait,
    stats: b.stats, sp: b.sp, weaponId: 'none', weaponMastery: {}, meter: 100, startingHp: ub.hp };
  const quest = { name: 'Matched fixture', encounter: true, objective: 'combat', difficultySequence: 4,
    rewards: { funds: 0, reputation: 0, materials: {} } };
  const result = g.resolveQuest([ua], quest, 733, { individual: true, authoredOpponents: [profile] });
  const initial = result.battleSnapshot.initialUnits;
  assert(Array.isArray(initial), 'a battle must retain its authoritative starting resources');
  for (const [name, original] of [['Alpha', ua], ['Beta', ub]]) {
    const unit = initial.find(u => u.name === name);
    assert(unit, `missing ${name}`);
    assert.strictEqual(unit.hp, original.hp);
    assert.strictEqual(unit.maxHp, original.maxHp);
    assert.strictEqual(unit.sp, original.sp);
    assert.strictEqual(unit.meter.value, 100);
  }
});
test('zero-SP opening mixed parties meet the existing casualty target without changing neutral duels', () => {
  function seeded(seed) { let x=seed>>>0; return ()=>((x=Math.imul(1664525,x)+1013904223)>>>0)/4294967296; }
  function fresh(path, seed) {
    const r=seeded(seed), a=g.makeAgent(r,{path,sequence:10});
    a.path=path; a.sequence=9; a.awakened=true;
    a.stats=g.statsAtSequence(g.awakenStats(a,path,r),9,path);
    return a;
  }
  const quest={name:'Opening balance regression',difficultySequence:9,requiredPath:'fool',encounter:true,
    objective:'combat',rewards:{funds:0,reputation:0,materials:{}}};
  let deaths=0, wins=0;
  for(let i=0;i<200;i++) {
    const party=['door','visionary','fool'].map((path,k)=>fresh(path,i*3+k));
    const result=g.resolveQuest(party,quest,i+101,{approach:'scout',individual:false});
    deaths+=result.consequences.filter(c=>c.type==='death').length;
    wins+=Number(result.success);
  }
  assert(deaths/200<=.6,`${(deaths/200).toFixed(3)} deaths per opening quest exceed 0.60`);
  assert(wins/200>=.65&&wins/200<=.99,`${wins/2}% opening win rate is outside the existing range`);
  assert.strictEqual(g.COMBAT_BALANCE.enemyDamageIndividual,1,'neutral matched battles keep equal damage');
});
for(const pathway of ['death','darkness','wheel_of_fortune','black_emperor']) {
  test(`${pathway} uses its paid abilities to meet the unchanged Sequence 5 balance floor`,()=>{
    function fresh(seed) {
      let x=seed>>>0; const r=()=>((x=Math.imul(1664525,x)+1013904223)>>>0)/4294967296;
      const a=g.makeAgent(r,{path:pathway,sequence:10});
      a.path=pathway; a.sequence=5; a.awakened=true;
      a.stats=g.statsAtSequence(g.awakenStats(a,pathway,r),5,pathway);
      return a;
    }
    const quest={name:'Signature balance regression',difficultySequence:5,requiredPath:'fool',encounter:true,
      objective:'combat',rewards:{funds:0,reputation:0,materials:{}}};
    let wins=0;
    for(let i=0;i<200;i++) {
      const result=g.resolveQuest([1,2,3].map(k=>fresh(i*3+k)),quest,i+9005,{approach:'scout'});
      wins+=Number(result.success);
    }
    assert(wins/200>=.25,`${wins/2}% win rate falls below the 25% floor required by the existing 75pp spread limit`);
  });
}
test('Error theft retains the existing prepared solo campaign success threshold',()=>{
  let wins=0;
  for(let seed=1;seed<=20;seed++) {
    const state=g.newGame(), recruit=g.makeAgent(()=>.5,{path:'error',sequence:9,trait:'Stout Vitality'});
    recruit.id='agent_0'; recruit.name='Agent 0'; recruit.weaponId='knife'; g.restatAgent(recruit);
    state.roster=[recruit];
    for(const [mission,choice] of [['open_doors',null],['follow_whispers','interviews'],['seal_and_supply','ward']]) {
      assert(g.campaignStart(state,mission,[recruit.id],choice,1).ok); g.campaignSettle(state);
    }
    const started=g.campaignStart(state,'last_bell',[recruit.id],null,seed);
    assert(started.ok); wins+=Number(started.pending.result.success);
  }
  assert(wins>=14,`Error: only ${wins}/20 prepared solo wins`);
});
console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
