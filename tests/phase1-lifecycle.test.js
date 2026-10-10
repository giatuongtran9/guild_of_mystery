// Phase 1 semantic regressions: actual normalized casts, damage sources and turns.
// The in-memory loader shim exposes existing internal turn functions without
// changing their implementation or requiring production exports for RED.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const loaderFile = path.resolve(__dirname, '../js/node-loader.js');
const repo = path.dirname(path.dirname(loaderFile));
// RED can read the clean baseline while independent agents edit shared files.
const baseline = process.env.PHASE1_BASELINE_DIR;
const readSource = (file, encoding) => {
  const relative = path.relative(repo, file);
  if (baseline && !relative.startsWith('..')) {
    return fs.readFileSync(path.join(baseline, relative), encoding);
  }
  return fs.readFileSync(file, encoding);
};
const loaderSource = readSource(loaderFile, 'utf8');
const call = "new Function('module','exports','require','G9_DATA',src)(m,m.exports,require,G9_DATA);";
assert(loaderSource.includes(call), 'canonical Node loader entry must be present');
const internal = `
const lifecycleObservations=[];
const lifecycleOriginalPower=powerEffect;
powerEffect=function(a,actor,enemy,state,...rest){
  lifecycleObservations.push({round:state?.currentRound,id:actor.id,
    status:[...(actor.status||[])],hitDebuff:actor._hitChanceDebuff||0,
    hitDuration:actor._hitChanceDebuffDuration||0});
  return lifecycleOriginalPower(a,actor,enemy,state,...rest);
};
Object.assign(module.exports,{tickUnitStatuses,tryRevive,tryMythicalForm,maybeCounter,lifecycleObservations});`;
const testLoader = new Module(loaderFile, module);
testLoader.filename = loaderFile;
testLoader.paths = Module._nodeModulePaths(path.dirname(loaderFile));
const requireModule = testLoader.require.bind(testLoader);
testLoader.require = id => id === 'fs' ? { ...fs, readFileSync: readSource } : requireModule(id);
testLoader._compile(loaderSource.replace(call,
  `new Function('module','exports','require','G9_DATA',src+${JSON.stringify(internal)})(m,m.exports,require,G9_DATA);`), loaderFile);
const g = testLoader.exports;

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`PASS ${name}`); }
  catch (e) { failed++; console.log(`FAIL ${name}: ${e.message}`); }
}
const R = () => 0.99;
function sequence(values, fallback = .99) { let i = 0; return () => values[i++] ?? fallback; }
function agent(key, rank, id, trait = 'Ironclad') {
  const a = g.makeAgent(() => .4, { path: key, sequence: rank, trait });
  Object.assign(a, { id, name: id, path: key, sequence: rank, awakened: true,
    stats: { hp: 1000, atk: 100, def: 100, int: 100 },
    baseStats: { hp: 1000, atk: 100, def: 100, int: 100 },
    basePathSpeed: 100, speedVariance: 1, weaponId: 'none', weaponMastery: {},
    cooldowns: {}, status: [], statusMeta: {}, resistances: {}, madness: 0 });
  a.sp = g.maxSPFor(a);
  return a;
}
function unit(a, side = 'ally') {
  const u = { id: a.id, name: a.name, path: a.path, sequence: a.sequence,
    awakened: true, hp: 1000, maxHp: 1000, atk: 100, def: 100, int: 100,
    alive: true, inCombat: true, status: [], statusMeta: {}, resistances: {},
    distance: 5, stats: a.stats, trait: a.trait, weaponId: 'none', weaponMastery: {},
    cooldowns: {}, sp: a.sp, maxSP: a.maxSP, speedVariance: 1, basePathSpeed: 100 };
  if (side === 'ally') u.agent = a;
  return u;
}
function fixture(key = 'fool', rank = 7, targetKey = 'door', targetRank = rank) {
  const a = agent(key, rank, 'caster'), b = agent(targetKey, targetRank, 'target');
  const u = unit(a), v = unit(b);
  return { a, b, u, v, state: { allies: [u], enemies: [v], events: [],
    balanceTrace: [], weaponUsage: {}, currentRound: 1, rng: R } };
}
function cast(w, key, rank, target = w.v, rng = R) {
  const spec = structuredClone(g.tierFor(key, rank).abilities[0]);
  assert.strictEqual(spec.type, 'active', `${key} ${rank} must be an actual active cast`);
  assert(g.applyStructuredAbility(w.a, w.u, target, w.state, [], rng, spec), 'cast must execute');
  return spec;
}
function action(w, victim) {
  victim._acting = true;
  g.beginTurn(victim);
  g.processStatuses(victim, () => {}, w.state, false);
  g.tickUnitStatuses(victim);
  g.tickCombatEffectDurations([victim]);
  victim._acting = false;
}
function elementalBurn(w) {
  // .34 passes accuracy and the 35% proc, selects Burn in the three-status
  // pool, and avoids criticals without depending on a particular roll count.
  cast(w, 'door', 8, w.v, () => .34);
  assert(g.hasStatus(w.v, 'burn'), 'real Elemental Spark must apply Burn');
}
function schoolWard(key,rank,side){
  const defender=g.makeCombatUnit(agent(key,rank,'defender'));
  const attacker=g.makeCombatUnit(agent('door',rank,'attacker'));
  defender._formUsed=attacker._formUsed=true;
  const state={allies:side==='ally'?[defender]:[attacker],enemies:side==='ally'?[attacker]:[defender],events:[],currentRound:1,rng:R,balanceTrace:[],weaponUsage:{}};
  const spec=structuredClone(g.tierFor(key,rank).abilities[0]);
  if(spec.type==='active')assert(g.applyStructuredAbility(defender.agent,defender,attacker,state,[],R,spec),'actual ward must cast on either side');
  return {defender,attacker,state};
}
for(const side of ['ally','enemy']){
  for(const [key,rank,capacity] of [['hermit',7,200],['white_tower',2,300]]){
    test(`${side} ${key}${rank} magic-only shield preserves its pool on physical/true and absorbs elemental/psychic hits`,()=>{
      for(const [kind,absorbed] of [['physical',0],['piercing',0],['true',0],['fire',100],['mystic',100],['psychic',100]]){
        const w=schoolWard(key,rank,side),before=w.defender.hp;
        const receipt=g.resolveIncoming(w.attacker,w.defender,100,w.state,[],R,{damageType:kind});
        assert.strictEqual(receipt.absorbed,absorbed,`${kind} absorption follows the declared magic-only contract`);
        assert.strictEqual(w.defender.shield,capacity-absorbed,`${kind} cannot consume an ineligible barrier`);
        assert.strictEqual(before-w.defender.hp,absorbed?0:100);
      }
    });
  }
  test(`${side} WhiteTower7 Predictive Guard reduces magic including psychic but excludes physical/true`,()=>{
    for(const [kind,loss] of [['physical',100],['piercing',100],['true',100],['fire',80],['mystic',80],['psychic',80]]){
      const w=schoolWard('white_tower',7,side);
      assert.strictEqual(g.resolveIncoming(w.attacker,w.defender,100,w.state,[],R,{damageType:kind}).hpLoss,loss,kind);
    }
  });
  test(`${side} Paragon5 Matter Fortification reduces physical aliases but excludes magic/true`,()=>{
    for(const [kind,loss] of [['physical',80],['piercing',80],['blunt',80],['fire',100],['mystic',100],['psychic',100],['true',100]]){
      const w=schoolWard('paragon',5,side);
      assert.strictEqual(g.resolveIncoming(w.attacker,w.defender,100,w.state,[],R,{damageType:kind}).hpLoss,loss,kind);
    }
  });
  test(`${side} Hermit2 Scroll Gate reflects magic including psychic but excludes physical/true`,()=>{
    for(const [kind,reflected] of [['physical',0],['piercing',0],['true',0],['fire',50],['mystic',50],['psychic',50]]){
      const w=schoolWard('hermit',2,side),before=w.attacker.hp;
      const receipt=g.resolveIncoming(w.attacker,w.defender,100,w.state,[],R,{damageType:kind});
      assert.strictEqual(receipt.reflected,reflected,kind);
      assert.strictEqual(before-w.attacker.hp,reflected,kind);
    }
  });
}
test('a weaker generic shield cast cannot retag a stronger magic barrier; a stronger mythical barrier clears its category',()=>{
  const w=schoolWard('white_tower',2,'ally');
  const ordinary=structuredClone(g.tierFor('paragon',7).abilities[0]);
  assert(g.applyStructuredAbility(w.defender.agent,w.defender,w.attacker,w.state,[],R,ordinary));
  assert.strictEqual(w.defender.shield,300);
  assert.strictEqual(g.resolveIncoming(w.attacker,w.defender,50,w.state,[],R,{damageType:'physical'}).absorbed,0);
  // The initial magical barrier has50 HP left after an eligible hit.
  g.resolveIncoming(w.attacker,w.defender,250,w.state,[],R,{damageType:'fire'});
  w.defender.hp=500;w.defender._formUsed=false;
  g.tryMythicalForm(w.defender.agent,w.defender,w.state,[],R);
  assert.strictEqual(w.defender.shield,300,'a stronger generic mythical shield replaces the restricted pool');
  assert.strictEqual(g.resolveIncoming(w.attacker,w.defender,100,w.state,[],R,{damageType:'physical'}).absorbed,100);
});
test('a missed real spell cannot trigger or consume a magic-only ward',()=>{
  const w=schoolWard('hermit',2,'enemy'),before=w.attacker.hp,start=w.state.events.length;
  const spec=structuredClone(g.tierFor('door',8).abilities[0]);
  assert(g.applyStructuredAbility(w.attacker.agent,w.attacker,w.defender,w.state,[],()=>0,spec));
  assert(w.state.events.slice(start).some(e=>e.type==='miss'),'the actual spell must miss');
  assert(!w.state.events.slice(start).some(e=>e.isReflect));
  assert.strictEqual(w.attacker.hp,before);
});
for(const side of ['ally','enemy'])for(const source of ['darkness','visionary']){
  test(`${side} actual ${source}0 True Psychic casts bypass magic-only shields/reduction/reflection`,()=>{
    for(const [key,rank] of [['hermit',7],['white_tower',2],['white_tower',7],['hermit',2]]){
      const w=schoolWard(key,rank,side),attacker=g.makeCombatUnit(agent(source,0,'attacker'));
      attacker._formUsed=true;
      w.state[side==='ally'?'enemies':'allies']=[attacker];
      const hp=w.defender.hp,shield=w.defender.shield||0,attackerHp=attacker.hp;
      assert(g.applyStructuredAbility(attacker.agent,attacker,w.defender,w.state,[],R,structuredClone(g.tierFor(source,0).abilities[0])));
      const trace=w.state.balanceTrace.at(-1);
      assert(trace.isTrue,'the actual authored True Psychic ability must resolve as true');
      assert.strictEqual(w.defender.shield||0,shield,`${key}${rank} cannot consume a magic-only barrier against true damage`);
      assert.strictEqual(hp-w.defender.hp,Math.min(hp,trace.final),`${key}${rank} cannot reduce true damage through a magic-only guard`);
      assert.strictEqual(attacker.hp,attackerHp,`${key}${rank} cannot reflect true damage through a magic-only ward`);
    }
  });
}
test('fresh combat units discard typed ward caches left by a prior saved battle',()=>{
  const saved=agent('white_tower',7,'saved');
  saved._shieldIncomingCategory='magic';saved._damageTakenByCategory={magic:.5};
  const fresh=g.makeCombatUnit(saved);
  for(const key of ['_shieldIncomingCategory','_damageTakenByCategory']){
    assert.strictEqual(fresh[key],undefined,`${key} must not alter a fresh unit`);
    assert.strictEqual(fresh.agent[key],undefined,`${key} must not survive on its backing agent`);
  }
  assert.strictEqual(saved._damageTakenByCategory.magic,.5,'source saves remain unmodified by construction');
});
for(const side of ['ally','enemy']){
  test(`${side} actual Law Enforcement Piercing hit triggers the physical counter rule; True Psychic does not`,()=>{
    for(const [key,rank,expected] of [['justiciar',5,true],['darkness',0,false]]){
      const defender=g.makeCombatUnit(agent('door',rank,'defender')),attacker=g.makeCombatUnit(agent(key,rank,'attacker'));
      defender._formUsed=attacker._formUsed=true;
      const w={defender,state:{allies:side==='ally'?[defender]:[attacker],enemies:side==='ally'?[attacker]:[defender],events:[],currentRound:1,rng:R,balanceTrace:[],weaponUsage:{}}};
      const rng=()=>w.state.events.some(e=>e.type==='damage'&&e.actorId===attacker.id)?0:.99;
      assert(g.applyStructuredAbility(attacker.agent,attacker,w.defender,w.state,[],rng,structuredClone(g.tierFor(key,rank).abilities[0])));
      assert(w.state.events.some(e=>e.type==='damage'&&e.actorId===attacker.id&&e.amount>0),'the authored ability must land a damaging hit');
      assert.strictEqual(w.state.events.some(e=>e.type==='damage'&&e.isCounter),expected,`${key}${rank} counter dispatch follows actual incoming category`);
    }
  });
}

test('actual fast Door battle gives one-action Burn its damage opportunity', () => {
  let observedBurn = 0, damageTicks = 0;
  for (let seed = 1; seed <= 10; seed++) {
    const a = agent('door', 8, 'fast_door'); a.basePathSpeed = 1000;a.speedVariance=10;
    a.stats.hp = a.baseStats.hp = 10000;
    g.lifecycleObservations.length = 0;
    const result = g.resolveQuest([a], { id:'dot', name:'DoT lifecycle', encounter:true,
      difficultySequence:8, rewards:{funds:0,reputation:0,materials:{}} }, seed,
    { individual:true, authoredOpponents:[{path:'death',sequence:8,name:'Burn victim',
      trait:'Ironclad',stats:{hp:100000,atk:1,def:100,int:100}}] });
    observedBurn += g.lifecycleObservations.filter(o => o.id==='enemy_0'&&o.status.includes('burn')).length;
    damageTicks += result.lines.filter(l => /Burn damage/.test(l.text)).length;
  }
  assert(observedBurn > 0, 'deterministic real casts must actually produce Burn before victim action');
  assert(damageTicks > 0, 'real resolveQuest must tick those Burns before they expire');
});

test('actual slow Sun cast preserves its two-action accuracy penalty after the victim already moved', () => {
  const a = agent('sun', 8, 'slow_sun'); a.basePathSpeed = 1;a.speedVariance=.01;
  a.stats.hp = a.baseStats.hp = 10000;
  g.lifecycleObservations.length = 0;
  g.resolveQuest([a], {id:'duration',name:'Duration lifecycle',encounter:true,
    difficultySequence:8,rewards:{funds:0,reputation:0,materials:{}}}, 7,
  {individual:true,authoredOpponents:[{path:'death',sequence:8,name:'Fast victim',
    trait:'Ironclad',stats:{hp:100000,atk:1,def:100,int:100}}]});
  const target = g.lifecycleObservations.filter(o=>o.id==='enemy_0');
  assert.strictEqual(target.find(o=>o.round===1).hitDebuff,0,'victim moves before first Holy Flash');
  assert(target.find(o=>o.round===2).hitDebuff>0,'first victim action after application');
  assert(target.find(o=>o.round===3).hitDebuff>0,'second victim action must retain the two-action penalty');
});

test('one-action Burn cast before victim acts damages once before expiry', () => {
  const w = fixture('door', 8); elementalBurn(w);
  const hp = w.v.hp; action(w, w.v);
  assert.strictEqual(hp - w.v.hp, 70, 'Burn must get its 7%-Max-HP damage opportunity');
  assert(!g.hasStatus(w.v, 'burn'), 'one-action Burn expires after that damage opportunity');
});
test('one-action Burn cast after victim acts damages once on next action', () => {
  const w = fixture('door', 8); action(w, w.v); elementalBurn(w);
  const hp = w.v.hp; action(w, w.v);
  assert.strictEqual(hp - w.v.hp, 70);
  assert(!g.hasStatus(w.v, 'burn'));
});
test('a real same-source Burn tick stays separate from the preceding cast in browser rows', () => {
  const w=fixture('door',8);elementalBurn(w);
  g.processStatuses(w.v,()=>{},w.state,false);
  const rows=g.groupEventsToRows(w.state.events).flatMap(round=>round.rows);
  const casting=rows.find(row=>row.costSP!==undefined&&row.actorId===w.u.id);
  assert(casting?.damages.length,'the actual Elemental Spark cast retains its direct hit');
  assert(!casting.damages.some(hit=>hit.isDot),'a victim-turn tick is not damage from the preceding cast');
  const tick=rows.find(row=>row.damages?.some(hit=>hit.isDot));
  assert(tick&&tick!==casting,'the ongoing effect has a separate chronological row');
  assert.strictEqual(tick.ability,'Burn','the row names the ongoing effect instead of a new Attack');
});
test('real Burn consumes shield first then the authored Wheel reduction and reports resolved damage', () => {
  const w=fixture('door',8,'wheel_of_fortune',5);elementalBurn(w);
  w.v.shield=20;const before=w.v.hp;
  action(w,w.v);
  assert.strictEqual(w.v.shield,0,'the initial20 shield HP absorbs part of70 incoming Burn');
  assert.strictEqual(before-w.v.hp,43,'the remaining50 damage receives15% passive reduction, rounded to43');
  const tick=w.state.events.find(e=>e.isDot);
  assert.strictEqual(tick.amount,63,'damage receipt includes20 absorbed plus43 HP lost');
  assert.strictEqual(tick.incoming,70);
  assert.strictEqual(tick.absorbed,20);
  assert.strictEqual(tick.hpLoss,43);
  assert.strictEqual(tick.hpAfter,before-43);
});
test('fully shielded Burn preserves a one-HP victim and does not spend automatic revival', () => {
  const w=fixture('door',8,'wheel_of_fortune',5);elementalBurn(w);
  w.v.hp=1;w.v.shield=70;action(w,w.v);
  assert(w.v.alive);
  assert.strictEqual(w.v.hp,1);
  assert.strictEqual(w.v.shield,0);
  assert(!w.v._revived,'shield absorption is not lethal damage');
  assert(!w.state.events.some(e=>e.type==='revive'));
  const tick=w.state.events.find(e=>e.isDot);
  assert.strictEqual(tick.amount,70);
  assert.strictEqual(tick.absorbed,70);
  assert.strictEqual(tick.hpLoss,0);
});
test('a fatal Burn remainder after shielding revives once and reports actual loss plus absorption', () => {
  const w=fixture('door',8,'wheel_of_fortune',5);elementalBurn(w);
  w.v.hp=1;w.v.shield=69;action(w,w.v);
  assert(w.v.alive&&w.v._revived);
  assert.strictEqual(w.v.hp,350);
  assert.strictEqual(w.v.shield,0);
  assert.strictEqual(w.state.events.filter(e=>e.type==='revive').length,1);
  const tick=w.state.events.find(e=>e.isDot);
  assert.strictEqual(tick.amount,70);
  assert.strictEqual(tick.absorbed,69);
  assert.strictEqual(tick.hpLoss,1);
  assert.strictEqual(tick.hpAfter,350);
});
test('standalone DoT API ticks and decrements duration exactly once', () => {
  const w = fixture(); g.addStatus(w.v, 'burn', 2, 'caster');
  g.processStatuses(w.v, () => {});
  assert.strictEqual(w.v.hp, 930);
  assert.strictEqual(w.v.statusMeta.burn.duration, 1);
  g.processStatuses(w.v, () => {});
  assert.strictEqual(w.v.hp, 860);
  assert(!g.hasStatus(w.v, 'burn'));
});

for (const side of ['ally', 'enemy']) {
  for (const source of ['direct', 'basic', 'ability', 'counter', 'reflect', 'dot', 'distorted_ability']) {
    test(`${side} Wheel revival automatically handles lethal ${source} damage once`, () => {
      const a = agent('wheel_of_fortune', 5, 'reviver');
      const v = unit(a, side); v.hp = 1; v._formUsed = true;
      const other = unit(agent(source === 'distorted_ability' ? 'error' : 'door', 5, 'opponent'));
      const state = { allies: side === 'ally' ? [v] : [other],
        enemies: side === 'ally' ? [other] : [v], rng: R, currentRound: 1,
        events: [], balanceTrace: [], weaponUsage: {} };
      if (source === 'direct') g.resolveIncoming(other, v, 500, state, [], R);
      if (source === 'basic') g.attackOnce(other.agent, other, v, state, [], R);
      if (source === 'ability') {
        g.applyStructuredAbility(other.agent, other, v, state, [], R,
          structuredClone(g.tierFor('door', 8).abilities[0]));
      }
      if (source === 'counter') {
        other.agent.stats.atk = 1000; other.atk = 1000;
        g.maybeCounter(other, v, state, [], () => 0);
      }
      if (source === 'reflect') {
        other._reflect = { mode: 'share', share: 1, rounds: 1 };
        g.resolveIncoming(v, other, 100, state, [], R);
      }
      if (source === 'dot') {
        g.addStatus(v, 'poison', 1, other.name);
        g.processStatuses(v, () => {}, state, false);
      }
      if (source === 'distorted_ability') {
        const controller = unit(agent('error', 5, 'controller'));
        const puppet = unit(agent('door', 5, 'puppet'));
        if (side === 'ally') { state.enemies = [controller]; state.allies.push(puppet); }
        else { state.allies = [controller]; state.enemies.push(puppet); }
        puppet.agent.stats.atk = 1000; puppet.atk = 1000;
        assert(g.applyStructuredAbility(controller.agent, controller, puppet, state, [], R,
          structuredClone(g.tierFor('error', 5).abilities[0])));
        assert.strictEqual(v.hp,1,'distortion cannot create an immediate extra attack');
        assert(g.applyStructuredAbility(puppet.agent,puppet,controller,state,[],R,
          structuredClone(g.tierFor('door',8).abilities[0])),'the next paid ability is redirected to the reviver');
      }
      assert(v.alive, 'automatic revival must restore the victim on either side');
      assert.strictEqual(v.hp, 350, 'Reset Fate restores the stated 35% Max HP');
      assert.strictEqual(state.events.filter(e => e.type === 'revive' && e.targetId === v.id).length, 1,
        'one lethal source must dispatch one revival event');
      // Direct incoming damage is also the central fatal entry used by callers.
      g.resolveIncoming(other, v, 2000, state, [], R);
      assert.strictEqual(v.alive, false, 'a second lethal hit cannot reuse the once-per-match revival');
      assert.strictEqual(state.events.filter(e => e.type === 'revive' && e.targetId === v.id).length, 1);
    });
  }
  test(`${side} Fool revival restores 25%, consumes SP, and applies one-action exhaustion`, () => {
    const a = agent('fool', 2, 'fool'); a.sp = 83;
    const v = unit(a, side); v.sp = 83; v.hp = 1; v._formUsed = true;
    const other = unit(agent('door', 2, 'opponent'));
    const state = { allies: side === 'ally' ? [v] : [other], enemies: side === 'ally' ? [other] : [v],
      rng: R, events: [], currentRound: 1, balanceTrace: [], weaponUsage: {} };
    g.resolveIncoming(other, v, 200, state, [], R);
    assert(v.alive);
    assert.strictEqual(v.hp, 250);
    assert.strictEqual((v.agent || v).sp, 0);
    assert(g.hasStatus(v, 'spiritual_exhaustion'), 'the advertised exhaustion must be represented');
    assert.strictEqual(v.statusMeta.spiritual_exhaustion.duration, 1);
  });
}

test('revival remains allowed under no_heal because resurrection is explicitly exempt', () => {
  const w = fixture('door', 5, 'wheel_of_fortune', 5); w.v.hp = 1; w.v._formUsed = true;
  g.addStatus(w.v, 'no_heal', 2, 'judge');
  g.resolveIncoming(w.u, w.v, 500, w.state, [], R);
  assert(w.v.alive); assert.strictEqual(w.v.hp, 350);
  assert(g.hasStatus(w.v, 'no_heal'));
});

test('no_heal blocks basic-attack trait lifesteal', () => {
  const w = fixture('door', 8); w.a.trait = 'Bloodthirst'; w.u.hp = 500;
  g.addStatus(w.u, 'no_heal', 2, 'judge');
  g.attackOnce(w.a, w.u, w.v, w.state, [], R);
  assert(w.v.hp < 1000, 'actual damaging basic attack must connect');
  assert.strictEqual(w.u.hp, 500);
});
test('no_heal blocks direct heal, active lifesteal, and damage-ratio healing', () => {
  for (const [key, rank] of [['moon', 9], ['moon', 8], ['mother', 6]]) {
    const w = fixture(key, rank); w.u.hp = 500;
    g.addStatus(w.u, 'no_heal', 2, 'judge'); cast(w, key, rank);
    assert.strictEqual(w.u.hp, 500, `${key} ${rank} cannot restore living HP`);
  }
});
test('no_heal blocks HP-theft restoration without preventing stolen HP damage', () => {
  const w = fixture('error', 0); w.u.hp = 500; w.v.hp = w.v.maxHp = 10000;
  g.addStatus(w.u, 'no_heal', 2, 'judge'); cast(w, 'error', 0);
  assert(w.v.hp < 10000); assert.strictEqual(w.u.hp, 500);
});
test('no_heal alone does not prohibit an ordinary shield', () => {
  const w = fixture('justiciar', 7); g.addStatus(w.u, 'no_heal', 2, 'judge');
  cast(w, 'justiciar', 7); assert.strictEqual(w.u.shield, 200);
});
test('no_shield prohibits ordinary and mythical shields', () => {
  const w = fixture('justiciar', 4); g.addStatus(w.u, 'no_shield', 2, 'judge');
  cast(w, 'justiciar', 7); assert(!(w.u.shield > 0));
  w.u.hp = 500; g.tryMythicalForm(w.a, w.u, w.state, [], R);
  assert(w.u._inForm, 'prohibition does not cancel the transformation');
  assert(!(w.u.shield > 0), 'mythical shield must obey no_shield too');
  assert(w.state.events.some(e=>e.subtype==='mythical_form'), 'the aura still appears in the combat log');
  assert(!w.state.events.some(e=>e.type==='shield'), 'blocked shielding must not report a shield grant');
});
test('an existing larger barrier preserves mythical awakening without claiming new shield HP', () => {
  const w=fixture('justiciar',4);w.u.hp=500;w.u.shield=600;
  g.tryMythicalForm(w.a,w.u,w.state,[],R);
  assert.strictEqual(w.u.shield,600);
  assert(w.u._inForm&&w.u._formBoost>1);
  assert(w.state.events.some(e=>e.subtype==='mythical_form'));
  assert(!w.state.events.some(e=>e.type==='shield'), 'unchanged shielding is not a new HP grant');
});
test('mythical pollution rolls independently at 70% only for living Sequence 5–9 enemies', () => {
  const w = fixture('justiciar', 4,'door',5); w.u.hp = 500;
  const second = unit(agent('door', 9, 'second')),high=unit(agent('door',4,'immune-rank'));
  w.state.enemies.push(second,high);
  let calls = 0; const values = [.69, .70];
  g.tryMythicalForm(w.a, w.u, w.state, [], () => values[calls++] ?? .99);
  assert.strictEqual(calls, 2, 'one independent 70% roll per eligible enemy only');
  assert(g.hasStatus(w.v, 'stunned')); assert(!g.hasStatus(second, 'stunned'));
  assert(!g.hasStatus(high,'stunned'),'Sequence 4 is outside the approved pollution target range');
});

test('Paper Figurine shield-first reduction and reflect last until holder next turn', () => {
  const w = fixture('fool', 7); cast(w, 'fool', 7);
  w.u.shield = 100; const hp = w.u.hp;
  const first = g.resolveIncoming(w.v, w.u, 300, w.state, [], R);
  assert.strictEqual(first.absorbed, 100, 'shield is consumed before damage reduction');
  assert.strictEqual(first.hpLoss, 100, 'remaining200 damage receives50% reduction');
  assert(w.v.hp < 1000, 'real INT-fire reflect occurs');
  g.tickCombatEffectDurations([w.u]);
  assert.strictEqual(g.resolveIncoming(w.v, w.u, 100, w.state, [], R).hpLoss, 50,
    'a round/duration tick does not expire next-turn reduction');
  g.beginTurn(w.u); const enemyHp = w.v.hp;
  assert.strictEqual(g.resolveIncoming(w.v, w.u, 100, w.state, [], R).hpLoss, 100);
  assert.strictEqual(w.v.hp, enemyHp, 'reflect expires at holder next-turn start');
  assert.strictEqual(hp - w.u.hp, 250);
});
test('Mother physical-share reflect rejects elemental hits and expires at holder next turn', () => {
  const w = fixture('mother', 3); cast(w, 'mother', 3);
  const hp = w.v.hp;
  g.resolveIncoming(w.v, w.u, 100, w.state, [], R, { damageType: 'fire' });
  assert.strictEqual(w.v.hp, hp, 'Flesh Mutation promises physical reflection only');
  g.resolveIncoming(w.v, w.u, 100, w.state, [], R, { damageType: 'physical' });
  assert.strictEqual(w.v.hp, hp - 30);
  g.beginTurn(w.u); const before = w.v.hp;
  g.resolveIncoming(w.v, w.u, 100, w.state, [], R, { damageType: 'physical' });
  assert.strictEqual(w.v.hp, before);
});
test('a fatal reflected hit reports resolved HP loss and the final target HP', () => {
  const w=fixture('mother',3,'hanged_man',4);w.v.hp=30;w.v._formUsed=true;
  cast(w,'mother',3);
  g.resolveIncoming(w.v,w.u,200,w.state,[],R,{damageType:'physical'});
  const reflect=w.state.events.find(e=>e.isReflect);
  assert(reflect,'a real physical reflecting ward must respond to the hit');
  assert.strictEqual(reflect.amount,30,'overkill is not HP actually lost');
  assert.strictEqual(reflect.hpAfter,0);
  assert.strictEqual(reflect.maxHp,1000);
});
test('Freeze and frozen both disable exactly their stated victim action count', () => {
  const w = fixture('death', 2); cast(w, 'death', 2);
  for (let i = 0; i < 3; i++) { assert(g.actionDisabled(w.v), `Freeze action${i + 1}`); action(w, w.v); }
  assert(!g.actionDisabled(w.v));
  g.addStatus(w.v, 'frozen', 2, 'legacy');
  for (let i = 0; i < 2; i++) { assert(g.actionDisabled(w.v)); action(w, w.v); }
  assert(!g.actionDisabled(w.v));
});
test('JSON-duration numeric debuffs expire on victim actions rather than global round ticks', () => {
  const w = fixture('sun', 8); cast(w, 'sun', 8);
  assert.strictEqual(w.v._hitChanceDebuffDuration, 2);
  // Other combatants acting does not age the target's debuff.
  action(w, w.u); assert.strictEqual(w.v._hitChanceDebuffDuration, 2);
  action(w, w.v); assert.strictEqual(w.v._hitChanceDebuffDuration, 1);
  action(w, w.v); assert.strictEqual(w.v._hitChanceDebuff || 0, 0);
});

console.log(`Lifecycle semantic regressions: ${passed} passed; ${failed} failed`);
if (failed) process.exitCode = 1;
