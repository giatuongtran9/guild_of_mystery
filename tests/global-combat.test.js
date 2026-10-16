'use strict';
const assert=require('node:assert/strict'),g=require('../js/node-loader');
const copy=x=>JSON.parse(JSON.stringify(x));
function agent(path='fool',sequence=9,id='caster'){
 const a=g.makeAgent(()=>.5,{path,sequence,trait:'Stout Vitality'});a.id=id;a.name=id;g.restatAgent(a);a.sp=g.maxSPFor(a);return a;
}
function world(){const u=g.makeCombatUnit(agent()),v=g.makeCombatUnit(agent('fool',9,'victim'));u.hp=u.maxHp=v.hp=v.maxHp=100000;const s={allies:[u],enemies:[v],events:[],balanceTrace:[],weaponUsage:{},rng:()=>.99,currentRound:1,traitDeployment:{ally:1,enemy:1}};g.bindBattle(s,[]);return {u,v,s};}
assert.equal(g.GLOBAL_COMBAT.damage,1.5);assert.equal(g.GLOBAL_COMBAT.hp,1);
assert.equal(require('../data/formulas.json').combat_rates.dodge.max_rate,1);
assert(!('dodgeCap' in g.GLOBAL_COMBAT));assert(!('threadHpGate' in g.GLOBAL_COMBAT));
for(const p of g.PATH_KEYS)for(const sequence of [9,5,0]){
 const a=agent(p,sequence),before=copy(a),u=g.makeCombatUnit(a),prepared=g.makeCombatUnit(u);
 assert.deepEqual(u.stats,g.balancedStats(a.stats,p,sequence));assert.deepEqual(prepared.stats,u.stats,'prepared copy is not scaled twice');assert.deepEqual(a,before,'saved source is immutable');
 const quest={name:'Global parity probe',encounter:true,difficultySequence:sequence,roundLimit:1,rewards:{}};
 const r=g.resolveQuest([a],quest,12919,{individual:true,authoredOpponents:[{id:'other',name:'other',path:p,sequence,trait:a.trait,stats:a.stats,sp:a.sp}]});
 assert.equal(r.battleSnapshot.initialUnits[0].maxHp,r.battleSnapshot.initialUnits[1].maxHp,'authored and allied stats use the same global rules');
 assert.deepEqual(a,before);
}
let w=world();assert.equal(g.resolveIncoming(w.u,w.v,100,w.s,[],()=>.99,{indirect:true}).incoming,150);
w=world();w.s.currentRound=6;assert.equal(g.resolveIncoming(w.u,w.v,100,w.s,[],()=>.99,{indirect:true}).incoming,150);
w=world();w.u.hp=100;assert.equal(g.recoverHP(w.u,100),100);assert.equal(g.grantShield(w.u,100),100);
w=world();assert(g.addStatus(w.v,'stunned',5,'fixture'));assert.equal(w.v.statusMeta.stunned.duration,5);
assert(g.addStatus(w.v,'frozen',5,'fixture'));assert(g.hasStatus(w.v,'frozen'));
w.s.currentRound=4;assert(g.addStatus(w.v,'frozen',5,'fixture'));assert.equal(w.v.statusMeta.frozen.duration,5);
assert(g.addStatus(w.u,'evade',5,'fixture',{dodgeRate:1}));assert.equal(w.u.statusMeta.evade.duration,5);assert.equal(w.u.statusMeta.evade.dodgeRate,1);
w=world();const support={type:'active',id:'support',effectId:'support',name:'Support',costSP:0,cooldown:0,utilityStrike:.35,effects:[{type:'buff',stat:'def',amount:.1,duration:1}]};
g.applyStructuredAbility(w.u.agent,w.u,w.v,w.s,[],()=>.99,support);assert(w.s.events.some(e=>e.type==='damage'&&e.actorId===w.u.id),'utility strike is real damage');
w=world();w.u._nextAttackMiss=1;const damaging={...support,id:'forced_miss',effectId:'forced_miss',effects:[],damage:{scaling:'INT',multiplier:1,type:'elemental',element:'fire',formula:'pure_caster_ability'}};
const hp=w.v.hp;g.applyStructuredAbility(w.u.agent,w.u,w.v,w.s,[],()=>.99,damaging);assert.equal(w.v.hp,hp,'missed damaging cast cannot turn into a utility attack');
w=world();const owner=agent('fool',5,'owner');w.u=g.makeCombatUnit(owner);w.s.allies=[w.u];g.bindBattle(w.s,[]);
assert(g.applySpiritThread(w.u.agent,w.v,w.u,w.s,[],()=>.99));
for(let i=0;i<5;i++){w.s.currentRound=i+1;g.tickSpiritThread(w.v,w.s,[]);}
assert(!w.v.alive,'full-HP target converts after five original stages without an HP gate');
const mar=w.s.allies.find(u=>u.unitType==='marionette');assert(mar);
assert.equal(mar.stats.atk,Math.round(w.v.stats.atk*.55),'summon inherits balanced stats exactly once');
// The safety limit is universal, including oversized authored limits and omitted limits.
for(const roundLimit of [undefined,500]){
 const slow=agent('sun',9,'slow'),other=agent('justiciar',9,'other');
 slow.stats=other.stats={hp:1000000000,atk:1,def:1,int:1};
 const q={name:'Safety limit',encounter:true,difficultySequence:9,rewards:{}};
 if(roundLimit!==undefined)q.roundLimit=roundLimit;
 const result=g.resolveQuest([slow],q,1917,{individual:true,authoredOpponents:[{id:other.id,name:other.name,path:other.path,sequence:9,trait:other.trait,stats:other.stats,sp:other.sp}]});
 assert.equal(result.battleOutcome,'timeout');assert.equal(Math.max(...result.events.map(e=>e.round||0)),50);
}
g.bindBattle(null);
console.log('Live global combat passed: 66 rank/pathway stat parity cases, no saved-stat mutations, pacing damage, sustain, control, uncapped dodge probability, utility misses and original thread conversion.');
