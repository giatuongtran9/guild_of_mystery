// Existing authored promises exercised through real normalized abilities.
'use strict';
const assert=require('node:assert/strict');
const g=require('../js/node-loader.js');
let pass=0,fail=0;
function test(name,fn){try{fn();pass++;console.log(`PASS ${name}`);}catch(e){fail++;console.log(`FAIL ${name}: ${e.message}`);}}
const R=()=>.99;
function record(key,rank,id){
 const a=g.makeAgent(()=>.4,{path:key,sequence:rank});
 Object.assign(a,{id,name:id,path:key,sequence:rank,awakened:true,trait:'Stout Vitality',
  stats:{hp:10000,atk:123,def:97,int:149},baseStats:{hp:10000,atk:123,def:97,int:149},
  injuries:0,madness:0,weaponId:'none',weaponMastery:{},resistances:{},resistanceBonuses:{},
  cooldowns:{},status:[],statusMeta:{},speedVariance:1});
 a.sp=g.maxSPFor(a);return a;
}
function world(key,rank,targetKey='door'){
 const u=g.makeCombatUnit(record(key,rank,'caster')),v=g.makeCombatUnit(record(targetKey,rank,'victim'));
 const state={allies:[u],enemies:[v],events:[],balanceTrace:[],weaponUsage:{},currentRound:1,rng:R};
 return {u,v,a:u.agent,b:v.agent,state};
}
function cast(w,key,rank,r=R,actor=w.u,target=w.v){
 const spec=g.tierFor(key,rank).abilities[0];
 return g.applyStructuredAbility(actor.agent,actor,target,w.state,[],r,spec);
}
test('passive penetration applies once to a real inherited skill',()=>{
 const w=world('error',7);
 assert(cast(w,'error',8));
 const trace=w.state.balanceTrace.find(x=>x.abilityId==='deceptive_feint');
 assert(trace && !trace.isTrue);
 const expected=97*.5*(1-.22-.2);
 assert(Math.abs(trace.defenseReduction-expected)<1e-8,`${trace.defenseReduction} vs ${expected}`);
});
test('passive penetration is not doubled for ordinary attacks',()=>{
 const w=world('error',7);g.attackOnce(w.a,w.u,w.v,w.state,[],R,1);
 const trace=w.state.balanceTrace[0];
 assert.equal(trace.defenseReduction,97*.5*(1-.2));
});
test('explicit ignoreResistance bypasses numeric mental protection',()=>{
 const w=world('fool',0,'sun');w.b.trait='Stoic Mind';
 let n=0;assert(cast(w,'fool',0,()=>n++<2?.99:0));
 assert(g.hasStatus(w.v,'stunned'),'encoded resistance bypass was ignored');
});
test('general vulnerability also affects an actual basic strike',()=>{
 const marked=world('hanged_man',6),plain=world('hanged_man',6);
 assert(cast(marked,'hanged_man',6));
 const beforeM=marked.v.hp,beforeP=plain.v.hp;
 g.attackOnce(marked.a,marked.u,marked.v,marked.state,[],R,1);
 g.attackOnce(plain.a,plain.u,plain.v,plain.state,[],R,1);
 assert.equal(beforeM-marked.v.hp,Math.round((beforeP-plain.v.hp)*1.2));
});
test('Vampire Transformation grants exactly two turns of strike Lifesteal',()=>{
 const w=world('moon',5);w.u.hp=3000;assert(cast(w,'moon',5));
 const before=w.u.hp,victim=w.v.hp;
 g.attackOnce(w.a,w.u,w.v,w.state,[],R,1);
 assert.equal(w.u.hp-before,Math.round((victim-w.v.hp)*.2));
 g.tickCombatEffectDurations([w.u]);
 assert(w.u._lifestealBonus>0,'bonus should survive one affected turn');
 g.tickCombatEffectDurations([w.u]);
 assert.equal(w.u._lifestealBonus||0,0);
});
test('Iron Blood Vigor adds its published 15% Max HP on either side',()=>{
 const a=record('red_priest',5,'red');
 const u=g.makeCombatUnit(a);
 assert.equal(u.maxHp,11500);
 assert.equal(u.agent.stats.hp,10000,'computed passive must not permanently rewrite earned HP');
});
test('War Command applies and expires its published 25% Speed',()=>{
 const w=world('red_priest',3),before=g.speedFor(w.a);
 assert(cast(w,'red_priest',3));
 assert(Math.abs(g.speedFor(w.a)-before*1.25)<1e-8);
 g.tickCombatEffectDurations([w.u]);assert(w.a._buffs?.speed>1);
 g.tickCombatEffectDurations([w.u]);assert.equal(w.a._buffs?.speed||1,1);
});
test('Misfortune Aura applies its published 20-point accuracy loss for two turns',()=>{
 const w=world('wheel_of_fortune',6);assert(cast(w,'wheel_of_fortune',6));
 assert.equal(w.v._hitChanceDebuff,.2);
 g.tickCombatEffectDurations([w.v]);assert.equal(w.v._hitChanceDebuff,.2);
 g.tickCombatEffectDurations([w.v]);assert.equal(w.v._hitChanceDebuff||0,0);
});
test('Interdiction blocks an Escape-tagged cast without spending SP',()=>{
 const w=world('justiciar',6,'demoness');assert(cast(w,'justiciar',6));
 const spec=g.tierFor('demoness',6).abilities[0];assert.equal(spec.tag,'Escape');
 const before=w.b.sp;
 assert.equal(g.applyStructuredAbility(w.b,w.v,w.u,w.state,[],R,spec),false);
 assert.equal(w.b.sp,before);
 g.tickUnitStatuses(w.v);g.tickUnitStatuses(w.v);
 assert(g.applyStructuredAbility(w.b,w.v,w.u,w.state,[],R,spec),'Escape becomes available after Root expires');
});
test('Executioner Stance grants temporary bypass without an unadvertised attack',()=>{
 const w=world('justiciar',2),before=w.v.hp;assert(cast(w,'justiciar',2));
 assert.equal(w.v.hp,before,'a stance should not strike on activation');
 assert.equal(w.u._buffs.atk,1.25);assert.equal(w.u._defPenBonus,.3);
 g.tickCombatEffectDurations([w.u]);assert.equal(w.u._defPenBonus,.3);
 g.tickCombatEffectDurations([w.u]);assert.equal(w.u._defPenBonus||0,0);
});
test('solar reduction protects Dark and Shadow without reducing unrelated damage',()=>{
 for(const type of ['dark','shadow','physical','fire']){
  const w=world('sun',2),before=w.u.hp;
  g.resolveIncoming(w.v,w.u,100,w.state,[],R,{damageType:type});
  assert.equal(before-w.u.hp,['dark','shadow'].includes(type)?70:100,type);
 }
});
test('corruption bonuses read the victim backing record',()=>{
 const w=world('sun',5);w.b.corruption=10;assert(cast(w,'sun',5));
 assert.equal(w.v._vulnerability,1.4);
});
test('a current-state reset cannot erase its own advertised cooldown',()=>{
 const w=world('wheel_of_fortune',2);w.a.cooldowns.old_spell=3;
 assert(cast(w,'wheel_of_fortune',2));
 assert.equal(w.a.cooldowns.old_spell,undefined);
 assert.equal(w.a.cooldowns.reincarnation_loop,5);
});
console.log(`Phase 3 existing rules: ${pass} passed, ${fail} failed`);
if(fail)process.exitCode=1;
