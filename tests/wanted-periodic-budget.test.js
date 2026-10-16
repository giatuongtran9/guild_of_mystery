'use strict';
const assert=require('node:assert/strict'),g=require('../js/node-loader');
function world(budget){
 const make=(path,id)=>{const a=g.makeAgent(()=>.5,{path,sequence:9,trait:'Stout Vitality'});Object.assign(a,{path,sequence:9,awakened:true,id,name:id,stats:{hp:10000,atk:100,def:1,int:100},weaponId:'none',weaponMastery:{},injuries:0,madness:0});return g.makeCombatUnit(a);};
 const u=make('sun','attacker'),v=make('fool','boss');v.hp=v.maxHp=10000;
 if(budget!==undefined)v.bossDefinition={periodicDamageTakenMultiplier:budget};
 const state={allies:[u],enemies:[v],events:[],balanceTrace:[],weaponUsage:{},currentRound:1,rng:()=>.99};
 return {u,v,state};
}
for(const budget of [undefined,.35]){
 const w=world(budget);w.v.shield=1000;
 assert(g.addStatus(w.v,'bleed',2,w.u.id));
 g.processStatuses(w.v,()=>{},w.state,true);
 const damage=w.state.events.find(e=>e.type==='damage'&&e.targetId===w.v.id);
 assert(damage,'the real status tick emits damage');
 const raw=w.v.maxHp*.03; // Authored Bleed tick: 3% target Max HP.
 const expected=Math.round(raw*g.GLOBAL_COMBAT.damage*(budget??1));
 assert.equal(damage.absorbed,expected,'periodic intake scales the tick before shield absorption');
 assert.equal(w.v.hp,10000,'shield absorbs the complete tick');
}
for(const opt of [{},{indirect:true},{reflect:true}]){
 const plain=world(),boss=world(.05);
 const a=g.resolveIncoming(plain.u,plain.v,100,plain.state,[],()=>.99,opt);
 const b=g.resolveIncoming(boss.u,boss.v,100,boss.state,[],()=>.99,opt);
 assert.equal(b.incoming,a.incoming,'direct, non-status indirect and reflect damage retain their normal budget');
 assert.equal(b.periodicMultiplier,1);
}
{
 const w=world(.35),r=g.resolveIncoming(w.u,w.v,100,w.state,[],()=>.99,{indirect:true,dotStatus:'curse'});
 assert.equal(r.periodicMultiplier,.35);assert.equal(r.incoming,Math.round(100*g.GLOBAL_COMBAT.damage*.35),'periodic telemetry reports the authored intake once');
 const before=w.v.hp;
 assert.equal(g.recoverHP(w.v,1000,{source:w.u,maxRecovery:7}),7);
 assert.equal(w.v.hp-before,7,'an actual recovery cap applies after modifiers');
}
console.log('Wanted periodic budgets: real status ticks, shields, default/direct/reflect parity and actual recovery cap passed.');
