// Real AI regressions: ready advanced abilities remain useful alongside signatures.
const assert = require('assert');
const g = require('../js/node-loader.js');
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`PASS ${name}`); }
  catch (err) { failed++; console.log(`FAIL ${name}: ${err.message}`); }
}
function agent(path, sequence, id = `${path}-${sequence}`) {
  const a = g.makeAgent(() => 0.5, { path, sequence, trait: 'Ironclad' });
  Object.assign(a, { id, name: id, path, sequence, awakened: true, injuries: 0,
    madness: 0, corruption: 0, status: 'active', weaponId: 'none', weaponMastery: {},
    recommendedPath: null, cooldowns: {}, statVariance: { hp: 1, atk: 1, def: 1, int: 1, speed: 1 },
    speedVariance: 1 });
  g.restatAgent(a);
  a.sp = a.maxSP = g.maxSPFor(a);
  return a;
}
function unit(a) {
  return { id: a.id, name: a.name, agent: a, path: a.path, sequence: a.sequence,
    hp: a.stats.hp, maxHp: a.stats.hp, alive: true, inCombat: true,
    status: [], statusMeta: {}, distance: 5, resistances: {} };
}
function fixture(path, sequence) {
  const a = agent(path, sequence), b = agent('paragon', sequence, 'opponent');
  const actor = unit(a), enemy = unit(b);
  const state = { allies: [actor], enemies: [enemy], currentRound: 1,
    balanceTrace: [], events: [], weaponUsage: {}, createdMarionettes: [], battleMarionettes: [] };
  return { a, b, actor, enemy, state };
}
const idOf = spec => spec && (spec.effectId || spec.id);
const choose = w => g.chooseStructuredAbility(w.a, w.actor, w.enemy, w.state);
const hurt = w => { w.actor.hp = Math.round(w.actor.maxHp * 0.4); };
function shapedFixture(path, sequence, canonical) {
  const w = fixture(path, sequence);
  if (canonical) {
    w.actor = g.makeCombatUnit(w.a); w.a = w.actor.agent;
    w.enemy = g.makeCombatUnit(w.b); w.b = w.enemy.agent;
    w.state.allies = [w.actor]; w.state.enemies = [w.enemy];
  }
  return w;
}
function lock(w, predicate) {
  for (const spec of g.activeSpecs(w.a)) if (predicate(spec)) w.a.cooldowns[idOf(spec)] = 99;
}

for (const [path, seq, expected] of [['door', 0, 'conceptual_unseal_seal']]) test(`${path} Sequence ${seq} uses advanced ready enemy control`, () => {
  const w = fixture(path, seq);
  assert.strictEqual(idOf(choose(w)), expected);
});
for(const [path,seq,signature,advanced] of [['chained',0,'madness_curse','god_of_chains'],['darkness',2,'dream_slumber','serenity_realm']])test(`${path} prepares its signature and still uses advanced control when preparation is unavailable`,()=>{
  const w=fixture(path,seq);assert.strictEqual(idOf(choose(w)),signature);
  w.a.cooldowns[signature]=99;assert.strictEqual(idOf(choose(w)),advanced);
});

test('self evasion is not chosen as offensive crowd control', () => {
  const w = fixture('door', 5);
  // At full health Blink Strike is useful as a damaging attack, not a control
  // reason to precede a stronger ready skill. Door 0 provides that comparison.
  const high = fixture('door', 0);
  assert.notStrictEqual(idOf(choose(high)), 'blink_strike');
  assert.strictEqual(idOf(choose(w)), 'blink_strike');
});

for (const [path, seq, expected] of [
  ['moon', 3, 'lunar_blessing'],
  ['mother', 2, 'mother_s_touch'],
  ['paragon', 2, 'divine_metallurgy']
]) test(`${path} Sequence ${seq} uses advanced survival upgrade at low HP`, () => {
  const w = fixture(path, seq); hurt(w);
  assert.strictEqual(idOf(choose(w)), expected);
});

test('fallback support considers the latest useful unlocked skill', () => {
  const w = fixture('paragon', 4);
  lock(w, s => (s.damage?.multiplier || s.scale || 0) > 0);
  assert.strictEqual(idOf(choose(w)), 'alchemical_overclock');
});

test('ready damage still precedes fallback preparation buffs', () => {
  const w = fixture('paragon', 4);
  assert.strictEqual(idOf(choose(w)), 'alchemical_fire');
});

test('existing large shield prevents wasting a turn on a weaker pure shield', () => {
  const w = fixture('paragon', 2); hurt(w); w.actor.shield = w.actor.maxHp;
  const selected = choose(w);
  assert(selected, 'another useful action should remain available');
  const types = g.abilityEffects(selected).filter(e => e.type !== 'targeting').map(e => e.type);
  assert(!types.length || !types.every(type => type === 'shield'), `${idOf(selected)} would only replace a larger shield`);
});

for (const canonical of [false, true]) {
  const shape = canonical ? 'canonical unit' : 'split agent';
  test(`${shape}: no-heal prevents a pure healing cast and preserves its SP`, () => {
    const w = shapedFixture('moon', 9, canonical); hurt(w);
    g.addStatus(w.actor, 'no_heal', 2, 'opponent');
    assert.strictEqual(choose(w), null, 'prohibited Healing Touch must fall back to an attack');
    const sp = w.a.sp, hp = w.actor.hp;
    g.powerEffect(w.a, w.actor, w.enemy, w.state, [], () => 0.99);
    assert.strictEqual(w.a.sp, sp);
    assert.strictEqual(w.actor.hp, hp);
    assert(!w.state.events.some(e => e.type === 'cast' && e.costSP > 0));
  });
  test(`${shape}: no-shield prevents a pure shield cast and preserves its SP`, () => {
    const w = shapedFixture('paragon', 7, canonical); hurt(w);
    lock(w, s => idOf(s) !== 'runic_shield');
    g.addStatus(w.actor, 'no_shield', 2, 'opponent');
    assert.strictEqual(choose(w), null, 'prohibited Runic Shield must fall back to an attack');
    const sp = w.a.sp;
    g.powerEffect(w.a, w.actor, w.enemy, w.state, [], () => 0.99);
    assert.strictEqual(w.a.sp, sp);
    assert.strictEqual(w.actor.shield || 0, 0);
    assert(!w.state.events.some(e => e.type === 'cast' && e.costSP > 0));
  });
  test(`${shape}: no-heal preserves a mixed healing and useful cleanse cast`, () => {
    const w = shapedFixture('sun', 7, canonical); hurt(w);
    g.addStatus(w.actor, 'no_heal', 2, 'opponent');
    g.addStatus(w.actor, 'poison', 2, 'opponent');
    assert.strictEqual(idOf(choose(w)), 'purification_halo');
    const hp = w.actor.hp;
    g.powerEffect(w.a, w.actor, w.enemy, w.state, [], () => 0.99);
    assert(!g.hasStatus(w.actor, 'poison'), 'mixed cast still performs its useful cleanse');
    assert(g.hasStatus(w.actor, 'no_heal'));
    assert.strictEqual(w.actor.hp, hp, 'prohibition still blocks its healing component');
  });
}

test('no-heal preserves mixed healing and enemy SP drain', () => {
  const w = shapedFixture('error', 4, true); hurt(w);
  g.addStatus(w.actor, 'no_heal', 2, 'opponent');
  lock(w, s => idOf(s) !== 'parasitic_contagion');
  assert.strictEqual(idOf(choose(w)), 'parasitic_contagion');
  const hp = w.actor.hp, sp = w.b.sp;
  g.powerEffect(w.a, w.actor, w.enemy, w.state, [], () => 0.99);
  assert.strictEqual(w.b.sp,sp,'parasitism drains on the host turn, rather than on attachment');
  g.signatureTurnStart(w.enemy,w.state,[],()=>.99);
  assert.strictEqual(w.b.sp,sp-20,'the attached parasite retains its useful SP drain on the host turn');
  assert.strictEqual(w.actor.hp, hp);
});

test('no-shield preserves a mixed shield and armor buff', () => {
  const w = shapedFixture('twilight_giant', 4, true); hurt(w);
  g.addStatus(w.actor, 'no_shield', 2, 'opponent');
  assert.strictEqual(idOf(choose(w)), 'dawn_guardian_barrier');
  g.powerEffect(w.a, w.actor, w.enemy, w.state, [], () => 0.99);
  assert((w.actor._buffs?.def || 1) > 1, 'the useful armor buff must execute');
  assert.strictEqual(w.actor.shield || 0, 0);
});

test('older affordable healing remains available when the upgrade is on cooldown', () => {
  const w = fixture('moon', 3); hurt(w);
  lock(w, s => s.tag === 'Defense' || idOf(s) === 'lunar_blessing');
  assert.strictEqual(idOf(choose(w)), 'healing_touch');
});

test('SP affordability still allows an older low-cost survival ability', () => {
  const w = fixture('moon', 3); hurt(w); w.a.sp = 15;
  const selected = choose(w);
  assert.strictEqual(idOf(selected), 'healing_touch');
  assert.strictEqual(selected.costSP, 15);
});

test('a pure silence is not recast onto a target already silenced', () => {
  const w = fixture('chained', 5);
  w.enemy.status.push('silenced');
  assert.notStrictEqual(idOf(choose(w)), 'desire_control');
});

for (const path of ['door', 'white_tower']) test(`${path} copy is held until witnessed, analyzed and fully charged`, () => {
  const w = fixture(path,6),rule=path==='door'?'door_record':'tower_imitation';
  lock(w, s => !g.abilityEffects(s).some(e => e.rule===rule));
  assert.strictEqual(choose(w), null);
  const witnessed = g.activeSpecs(w.b).find(s => !g.abilityEffects(s).some(e => ['copy_ability','signature'].includes(e.type)));
  assert(witnessed, 'fixture must provide a real enemy skill');
  assert(g.applyStructuredAbility(w.b,w.enemy,w.actor,w.state,[],()=>.99,witnessed));
  assert.strictEqual(choose(w),null,'observation alone cannot spend an incomplete charge');
  g.setMeterValue(w.a,path,100);
  if(path==='white_tower'){
    assert.strictEqual(choose(w),null,'one observation cannot satisfy Polymath analysis');
    assert(g.applyStructuredAbility(w.b,w.enemy,w.actor,w.state,[],()=>.99,witnessed));
  }
  assert(g.abilityEffects(choose(w)).some(e => e.rule===rule));
});

test('witnessing only another copy spell does not unlock a recursive copy cast', () => {
  const w = fixture('white_tower', 6);
  lock(w, s => !g.abilityEffects(s).some(e => e.rule==='tower_imitation'));g.setMeterValue(w.a,'white_tower',100);
  const enemyCopy = g.activeSpecs(agent('white_tower', 6, 'copying-opponent')).find(s=>g.abilityEffects(s).some(e=>e.rule==='tower_imitation'));
  w.state._abilityHistoryByUnit = { [w.enemy.id]: [{ spec: enemyCopy, round: 1,sequence:6 },{spec:enemyCopy,round:2,sequence:6}] };
  assert.strictEqual(choose(w), null);
});

test('automatic self revival does not waste an AI cast turn', () => {
  const w = fixture('wheel_of_fortune', 5);
  lock(w, s => !g.abilityEffects(s).some(e => e.type === 'revive' && e.self));
  assert.strictEqual(choose(w), null);
});

test('Fool still banks SP for available Thread Binding', () => {
  const w = fixture('fool', 4); hurt(w); w.a.sp = 35;
  assert.strictEqual(choose(w), null);
});

test('Fool banks for Thread Binding at the effective modified SP cost', () => {
  const w = fixture('fool', 5);
  w.a.sp = 50;
  w.a._spCostMultiplier = 0.5;
  assert.strictEqual(choose(w), null,
    '50 SP cannot afford the 68 SP binding and must not be spent on a cheap cast');
});

test('an active allied thread still prevents target banishment', () => {
  const w = fixture('door', 0);
  w.enemy.thread = { ownerId: 'friendly-fool', progress: 2, required: 5 };
  const selected = choose(w);
  assert(selected);
  assert(!g.abilityEffects(selected).some(e => e.type === 'banish' || (e.type === 'status' && e.status === 'banished')));
});

test('Time Theft is not chosen after all foes have already acted', () => {
  const w = fixture('error', 1);
  w.enemy._actedThisRound = true;
  assert.notStrictEqual(idOf(choose(w)), 'time_theft');
});

test('Death retains its explicit critical-health aura priority', () => {
  const w = fixture('death', 0); w.actor.hp = Math.round(w.actor.maxHp * 0.25);
  assert.strictEqual(idOf(choose(w)), 'undying_rebirth_aura');
});

test('silence blocks advanced casts without changing the available definitions', () => {
  const w = fixture('door', 0), before = JSON.stringify(g.PATHS.door);
  w.actor.status.push('silenced');
  assert.strictEqual(choose(w), null);
  assert.strictEqual(JSON.stringify(g.PATHS.door), before);
});

test('real battles prepare the signature and repeatedly use advanced control afterward', () => {
  const firstCasts = {}, advancedCounts = {};
  for (const [path, expected] of [['door', 'Conceptual Unseal & Seal'], ['chained', 'God of Chains']]) {
    firstCasts[path] = {}; advancedCounts[path] = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const a = agent(path, 0, `${path}-hero`);
      a.stats = { hp: 1e6, atk: 100, def: 20, int: 100 };
      a.basePathSpeed = 1e5; // The player takes the first turn; survival is unnecessary.
      const q = { id: 'ai-frequency', name: 'AI Regression Encounter', story: '', brief: '',
        objective: 'combat', encounter: true, difficultySequence: 0, enemyCount: 1,
        rewards: { funds: 0, reputation: 0, materials: {} }, dayCost: 1 };
      const res = g.resolveQuest([a], q, seed, { individual: true,
        authoredOpponents: [{ path: 'tyrant', sequence: 0, trait: 'Ironclad',
          name: 'Durable Target', stats: { hp: 1e8, atk: 1, def: 1, int: 1 } }] });
      const casts = res.events.filter(e => e.type === 'cast' && e.actorId === a.id);
      assert(casts.length > 0, 'real engine must execute player actions');
      const first = casts[0].ability;
      firstCasts[path][first] = (firstCasts[path][first] || 0) + 1;
      advancedCounts[path] += casts.filter(e => e.ability === expected).length;
    }
  }
  console.log('Real-cast evidence:', JSON.stringify({ firstCasts, advancedCounts }));
  assert.deepStrictEqual(firstCasts.door, { 'Conceptual Unseal & Seal': 12 });
  assert.deepStrictEqual(firstCasts.chained, { 'Madness Curse': 12 });
  assert(advancedCounts.door >= 12 && advancedCounts.chained >= 12);
});
test('Chained builds charge from zero and can release its curse after the real cooldown',()=>{
  const a=agent('chained',8,'curse-owner');a.stats=a.baseStats={hp:1e6,atk:1,def:1,int:1};g.setMeterValue(a,'chained',0);
  const spec=g.tierFor('chained',8).abilities[0],rule=spec.effects.find(e=>e.rule==='chained_release');
  const q={id:'curse-cycle',name:'Curse cycle',story:'',objective:'combat',encounter:true,difficultySequence:9,enemyCount:1,rewards:{funds:0,reputation:0,materials:{}}};
  const result=g.resolveQuest([a],q,3,{individual:true,authoredOpponents:[{name:'durable-foe',path:'fool',sequence:9,stats:{hp:1e8,atk:1,def:1,int:1},sp:0}]});
  const casts=result.events.filter(e=>e.actorId===a.id&&e.ability==='Madness Curse'),release=result.events.find(e=>e.actorId===a.id&&e.isSignature&&e.type==='damage');
  assert(release,'the contained curse must still exist when the signature is ready to release');
  assert.strictEqual(casts[0].round,1,'containment starts through a real zero-charge cast');
  assert(release.round>=casts[0].round+spec.cooldown+1,'release must respect the ability cooldown and cast grace');
  assert(casts.some(e=>e.round===release.round),'release occurs as part of the actual eligible ability cast');
  assert.strictEqual(release.hpLoss,Math.round(a.stats.hp*rule.amount),'release deals the configured Max HP damage');
  assert(result.events.some(e=>e.actorId===a.id&&e.subtype==='signature'&&e.round===release.round&&e.text.includes('100 Restraint')),'charge is really spent at release');
});

console.log(`Phase 1 AI: ${passed} passed, ${failed} failed.`);
if (failed) process.exitCode = 1;
