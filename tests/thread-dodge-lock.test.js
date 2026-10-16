'use strict';
// Exercise the real hit resolver after attaching and advancing Spirit Threads.
const {g,assert,world}=require('./phase3-test-helpers');
let passed=0;
function check(name,fn){fn();passed++;console.log('PASS '+name);}
function attached(stage,side='allies'){
 const w=world('fool',0,side);
 w.lines=[];
 w.b.stats.int=1000000;
 assert(g.applySpiritThread(w.a,w.v,w.u,w.state,w.lines,()=>.99));
 for(let i=0;i<stage;i++)g.tickSpiritThread(w.v,w.state,w.lines);
 assert.equal(w.v.thread.progress,stage);
 return w;
}
function hit(w,draws=[.99],options={}){
 let calls=0;
 const result=g.attackHit(w.a,w.u,w.v,w.state,w.lines,()=>{
  assert(calls<draws.length,'hit resolution must not draw an extra dodge roll');
  return draws[calls++];
 },options);
 return {result,calls};
}
for(const side of ['allies','enemies']){
 for(const stage of [1,2]){
  check(`${side}: Thread stage ${stage} still permits high-INT random dodge`,()=>{
   const w=attached(stage,side);
   assert.equal(w.v._threadLockDodge,false);
   const actual=hit(w,[0]);
   assert.equal(actual.result,false);
   assert.equal(actual.calls,1);
   assert(w.lines.some(x=>/reads the movement and dodges/.test(x.text)));
  });
  check(`${side}: Thread stage ${stage} still permits guaranteed Evade`,()=>{
   const w=attached(stage,side);
   g.addStatus(w.v,'evade',1,'test');w.v.statusMeta.evade.dodgeRate=1;
   assert.deepEqual(hit(w,[]),{result:false,calls:0});
   assert(w.lines.some(x=>/Evasion lets them slip away untouched/.test(x.text)));
  });
 }
 for(const stage of [3,4]){
  check(`${side}: Thread stage ${stage} bypasses high-INT dodge without rolling it`,()=>{
   const w=attached(stage,side);
   assert.equal(w.v._threadLockDodge,true);
   assert.deepEqual(hit(w,[0]),{result:true,calls:1},'only the separate zero-chance accuracy check draws');
   assert.equal(w.state.events.filter(e=>e.type==='miss').length,0);
  });
  for(const rate of [1,undefined]){
   check(`${side}: Thread stage ${stage} bypasses ${rate===1?'100%':'implicit guaranteed'} Evade`,()=>{
    const w=attached(stage,side);
    g.addStatus(w.v,'evade',1,'test');
    if(rate===undefined)delete w.v.statusMeta.evade.dodgeRate;
    else w.v.statusMeta.evade.dodgeRate=rate;
    assert.deepEqual(hit(w,[0]),{result:true,calls:1});
    assert(g.hasStatus(w.v,'evade'),'the dodge lock does not consume or remove Evade');
   });
  }
 }
 check(`${side}: Thread dodge lock bypasses the ordinary 3% minimum too`,()=>{
  const w=attached(3,side);w.b.stats.int=1;w.a.stats.int=1000000;
  assert.deepEqual(hit(w,[0]),{result:true,calls:1});
 });
 check(`${side}: forced miss still defeats Thread dodge lock without RNG`,()=>{
  const w=attached(3,side);
  assert.deepEqual(hit(w,[],{forcedMiss:true}),{result:false,calls:0});
  assert(w.lines.some(x=>/forced to miss/.test(x.text)));
 });
 check(`${side}: attacker accuracy debuffs still cause misses against locked targets`,()=>{
  const w=attached(3,side);w.u._hitChanceDebuff=.5;
  assert.deepEqual(hit(w,[.1]),{result:false,calls:1});
 });
 check(`${side}: gun mastery accuracy still applies against locked targets`,()=>{
  const w=attached(3,side);w.a.weaponId='pistol';w.a.weaponMastery={gun:0};
  assert.deepEqual(hit(w,[.1],{weaponAttack:true}),{result:false,calls:1});
  assert(w.lines.some(x=>/Gun Mastery Lv.0 gives 50% accuracy/.test(x.text)));
 });
 for(const targetState of ['dead','untargetable']){
  check(`${side}: ${targetState} targets remain invalid despite Thread dodge lock`,()=>{
   const w=attached(3,side);
   if(targetState==='dead')w.v.alive=false;else g.addStatus(w.v,'untargetable',1,'test');
   assert.deepEqual(hit(w,[]),{result:false,calls:0});
   assert(w.lines.some(x=>/cannot target/.test(x.text)));
  });
 }
 check(`${side}: Thread dodge lock cannot bypass the Sequence authority rule`,()=>{
  const w=attached(3,side);w.a.sequence=5;
  const before=w.v.hp;
  assert.equal(g.attackOnce(w.a,w.u,w.v,w.state,w.lines,()=>{throw Error('suppressed attack should not roll');}),false);
  assert.equal(w.v.hp,before);
  assert(w.lines.some(x=>/suppressed by the enemy's higher Authority/.test(x.text)));
 });
 check(`${side}: AI predicts accuracy-only hits against locked guaranteed Evade`,()=>{
  const w=attached(3,side);g.addStatus(w.v,'evade',1,'test');w.v.statusMeta.evade.dodgeRate=1;
  assert.equal(g.battleAIHitChance(w.a,w.u,w.v),1);
  w.u._hitChanceDebuff=.5;
  assert.equal(g.battleAIHitChance(w.a,w.u,w.v),.5,'attacker accuracy still affects preview');
  w.u._nextAttackMiss=1;
  assert.equal(g.battleAIHitChance(w.a,w.u,w.v),0,'forced miss still affects preview');
 });
 check(`${side}: AI still predicts zero hits against stage-one guaranteed Evade`,()=>{
  const w=attached(1,side);g.addStatus(w.v,'evade',1,'test');w.v.statusMeta.evade.dodgeRate=1;
  assert.equal(g.battleAIHitChance(w.a,w.u,w.v),0);
 });
 check(`${side}: explicit unlocked unit overrides a stale agent lock in resolver and AI`,()=>{
  const w=attached(3,side);w.v._threadLockDodge=false;
  assert.equal(w.b._threadLockDodge,true,'fixture preserves a stale copied agent flag');
  g.addStatus(w.v,'evade',1,'test');w.v.statusMeta.evade.dodgeRate=1;
  assert.equal(g.battleAIHitChance(w.a,w.u,w.v),0);
  assert.deepEqual(hit(w,[]),{result:false,calls:0});
 });
}
check('unthreaded guaranteed Evade remains unrestricted',()=>{
 const w=world('fool',0);w.lines=[];
 g.addStatus(w.v,'evade',1,'test');w.v.statusMeta.evade.dodgeRate=1;
 assert.deepEqual(hit(w,[]),{result:false,calls:0});
});
console.log(`Thread dodge lock: ${passed} checks passed`);
