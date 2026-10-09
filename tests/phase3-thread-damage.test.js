'use strict';
const assert=require('node:assert/strict'),g=require('../js/node-loader.js');
let pass=0,fail=0;
const R=()=>.99;
function test(name,fn){try{fn();pass++;console.log(`PASS ${name}`);}catch(e){fail++;console.log(`FAIL ${name}: ${e.message}`);}}
function fixture(stage=3,swapped=false){
 const make=(path,id)=>{const a=g.makeAgent(()=>.4,{path,sequence:5});Object.assign(a,{id,name:id,path,sequence:5,awakened:true,trait:'Stout Vitality',stats:{hp:10000,atk:123,def:97,int:149},baseStats:{hp:10000,atk:123,def:97,int:149},injuries:0,madness:0,weaponId:'none',weaponMastery:{},cooldowns:{},status:[],statusMeta:{},resistances:{},resistanceBonuses:{},speedVariance:1});a.sp=g.maxSPFor(a);return g.makeCombatUnit(a);};
 const owner=make('fool','owner'),victim=make('door','victim');
 const state={allies:swapped?[victim]:[owner],enemies:swapped?[owner]:[victim],currentRound:1,currentTurn:1,events:[],rng:R};
 assert(g.applySpiritThread(owner.agent,victim,owner,state,[],R));
 for(let i=0;i<stage;i++)g.processSpiritThreads(state,[]);
 return {owner,victim,state,hit(amount,opt={}){return g.resolveIncoming(owner,victim,amount,state,[],R,opt);}};
}
test('exactly 30% of victim Max HP does not remove a stack',()=>{const w=fixture();w.hit(3000);assert.equal(w.victim.thread.progress,3);});
test('more than 30% removes one stack on either side',()=>{for(const swapped of [false,true]){const w=fixture(3,swapped);w.hit(3001);assert.equal(w.victim.thread.progress,2);}});
test('multiple hits aggregate within the same turn and remove at most one stack',()=>{const w=fixture();w.hit(2000);w.hit(1001);assert.equal(w.victim.thread.progress,2);w.hit(3100);assert.equal(w.victim.thread.progress,2);});
test('damage from different turns does not aggregate',()=>{const w=fixture();w.hit(2000);w.state.currentTurn++;w.hit(2000);assert.equal(w.victim.thread.progress,3);w.hit(1001);assert.equal(w.victim.thread.progress,2);});
test('shield absorption does not count toward the HP threshold',()=>{const w=fixture();w.victim.shield=2000;w.hit(5000);assert.equal(w.victim.thread.progress,3);w.hit(1);assert.equal(w.victim.thread.progress,2);});
test('damage reduction is applied before the threshold',()=>{const w=fixture();w.victim._damageTakenMultiplier=.5;w.hit(6000);assert.equal(w.victim.thread.progress,3);w.hit(2);assert.equal(w.victim.thread.progress,2);});
test('losing a stage recalculates its Speed and Dodge penalties',()=>{const w=fixture();w.hit(3001);assert.equal(w.victim._threadSpeedDebuff,.15);assert.equal(w.victim._threadDodgeDebuff,-.1);assert.equal(w.victim._threadLockDodge,false);assert.equal(w.victim.agent._threadLockDodge,false);});
test('losing the first stack clears penalties while keeping the attached thread',()=>{const w=fixture(1);w.hit(3001);assert.equal(w.victim.thread.progress,0);assert.equal(w.victim._threadSpeedDebuff,0);assert.equal(w.owner.agent.activeThreads,1);assert(g.hasStatus(w.victim,'threaded'));});
test('zero-stack thread cannot become negative',()=>{const w=fixture(0);w.hit(3001);assert.equal(w.victim.thread.progress,0);});
test('periodic damage participates in the same turn threshold',()=>{const w=fixture();g.addStatus(w.victim,'burn',1,'owner');w.hit(2400);g.processStatuses(w.victim,()=>{},w.state,false);assert.equal(w.victim.thread.progress,2);});
test('reflected HP loss counts for the threaded attacker',()=>{const w=fixture();w.owner._reflect={mode:'share',share:1,negate:true,rounds:2};g.resolveIncoming(w.victim,w.owner,3001,w.state,[],R);assert.equal(w.victim.thread.progress,2);});
test('one stack may be lost again on a later turn without resetting ownership',()=>{const w=fixture();w.hit(3001);w.state.currentTurn++;w.hit(3001);assert.equal(w.victim.thread.progress,1);assert.equal(w.victim.thread.ownerId,w.owner.id);});
test('battle entry never imports thread-damage tracking from an earlier encounter',()=>{const w=fixture();w.hit(3001);const fresh=g.makeCombatUnit(w.victim.agent);assert.equal(fresh.thread,null);assert.equal(fresh.agent.thread,null);});
console.log(`Phase 3 thread damage: ${pass} passed, ${fail} failed`);if(fail)process.exitCode=1;
