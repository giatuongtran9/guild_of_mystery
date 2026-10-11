'use strict';
// Spirit Thread timing and interruption: per-victim ticks, immediate release on owner CC, Parasitic Contagion SP ratio.
const {g,assert,world}=require('./phase3-test-helpers');
let passed=0,failed=0;
function check(name,fn){try{fn();passed++;console.log('PASS '+name);}catch(e){failed++;console.error('FAIL '+name+': '+e.message);}finally{g.bindBattle(null);}}
const CC=['stunned','frozen','freeze','sleep','polymorphed','bound','unconscious','banished'];
// A Sequence 5 Fool with a thread already on the victim, advanced `stage` stages. The battle is bound so CC is seen as it lands.
function attached(stage=0,bind=true){
  const w=world('fool',5),lines=[];
  if(bind)g.bindBattle(w.state,lines);
  assert(g.applySpiritThread(w.a,w.v,w.u,w.state,[],()=>.99));
  for(let i=0;i<stage;i++)g.tickSpiritThread(w.v,w.state,lines);
  w.lines=lines;return w;
}
const released=w=>w.v.thread===null&&!(w.a.threadTargets||[]).includes(w.v.id)&&!g.hasStatus(w.v,'threaded');

check('a thread advances exactly one stage per victim tick',()=>{
  const w=attached(0);
  g.tickSpiritThread(w.v,w.state,w.lines);assert.equal(w.v.thread.progress,1);
  g.tickSpiritThread(w.v,w.state,w.lines);assert.equal(w.v.thread.progress,2);
});
for(const status of CC){
  check(`owner ${status} cuts the thread the moment it lands`,()=>{
    const w=attached(3);
    g.addStatus(w.u,status,1,'test');
    assert(released(w),'thread released immediately');
    assert(w.a.cooldowns.thread_binding>0,'Thread Binding goes on cooldown');
    assert(w.lines.some(l=>/interrupted and its progress resets/.test(l.text)),'interrupt is logged');
    assert(w.state.events.some(ev=>ev.type==='thread'&&ev.subtype==='interrupt'),'interrupt event emitted');
    assert.equal(g.tickSpiritThread(w.v,w.state,w.lines),false,'nothing left to tick');
  });
}
check('CC that expires before the victim acts still cost the thread (round 5 stun, round 6 tick)',()=>{
  const w=attached(4);
  g.addStatus(w.u,'stunned',1,'Pale Hunter');
  g.tickUnitStatuses(w.u); // the stun runs out at the end of the owner's skipped turn
  assert(!g.hasStatus(w.u,'stunned'));
  g.tickSpiritThread(w.v,w.state,w.lines);
  assert(w.v.alive,'victim is not converted');
  assert(released(w));
  assert(!w.state.battleMarionettes?.length,'no marionette was created');
});
check('banish on the owner cuts the thread even though it is gone by the victim\'s next turn (round 14 banish, round 15 tick)',()=>{
  const w=attached(3);
  g.addStatus(w.u,'banished',1,'Pale Hunter');
  g.tickUnitStatuses(w.u);
  assert(!g.hasStatus(w.u,'banished'));
  assert(released(w));
  assert.equal(g.tickSpiritThread(w.v,w.state,w.lines),false);
});
check('fear, confusion, silence and mounting madness do not interrupt a thread',()=>{
  const w=attached(2);
  for(const status of ['fear','confused','silenced','curse','evade'])g.addStatus(w.u,status,1,'test');
  w.u.agent.madness=80;
  assert(!released(w));
  g.tickSpiritThread(w.v,w.state,w.lines);assert.equal(w.v.thread.progress,3);
});
check('a thread still stops at the next tick if CC landed while no battle was bound',()=>{
  const w=attached(2,false);
  g.addStatus(w.u,'sleep',1,'test');
  assert(w.v.thread,'nothing intercepted the status');
  g.tickSpiritThread(w.v,w.state,w.lines);
  assert(released(w));
});
check('CC on a Fool with no threads does nothing',()=>{
  const w=world('fool',5);g.bindBattle(w.state,[]);
  assert.equal(g.interruptOwnerThreads(w.u,w.state,[]),false);
  g.addStatus(w.u,'stunned',1,'test');assert(g.hasStatus(w.u,'stunned'));
});
check('a dead victim frees its thread slot at round cleanup',()=>{
  const w=attached(2);
  w.v.hp=0;w.v.alive=false;
  g.cleanupSpiritThreads(w.state,w.lines);
  assert(released(w));assert.equal(g.threadUsage(w.state,w.a),0);
});
check('a dead owner cuts the thread at the next victim tick',()=>{
  const w=attached(2);
  w.u.hp=0;w.u.alive=false;
  g.tickSpiritThread(w.v,w.state,w.lines);
  assert(released(w));
});
check('completing the fifth stage converts the victim and frees nothing early',()=>{
  const w=attached(4);
  g.tickSpiritThread(w.v,w.state,w.lines);
  assert(!w.v.alive);assert(w.state.allies.some(x=>x.summoned),'marionette joins the owner side');
  assert.equal(g.threadUsage(w.state,w.a),1,'the living marionette occupies the slot');
});

// ---- Losing an action to Madness or Fear cuts the Fool's threads; Confusion does not (real seeded battles, judged from the battle log)
function actionLossBattles(mode,seeds=40){
  const LOSS={madness:/^Fool.* loses the action to mounting Madness/,fear:/^Fool.* loses this action to a status effect/,confused:/^Fool.* is Confused and targets an ally/};
  const quest={id:'q',name:'Sim',difficultySequence:4,encounter:true,story:'x',rewards:{funds:0,reputation:0,materials:{}},enemyCount:2,requiredPath:'door',dayCost:1};
  let lossesWithThread=0,violations=0,interruptsDuringConfusion=0,seed=11;
  const rng=()=>((seed=Math.imul(1664525,seed)+1013904223)>>>0)/4294967296;
  for(let s=1;s<=seeds;s++){
    const a=g.makeAgent(rng,{sequence:4,path:'fool',trait:'Stout Vitality'});
    Object.assign(a,{id:'f',name:'Fool Seq 4',awakened:true,path:'fool',sequence:4,injuries:0,weaponId:'none',weaponMastery:{},madness:mode==='madness'?80:0});
    a.sp=g.maxSPFor(a);g.restatAgent(a);
    let member=a;
    if(mode!=='madness'){member=g.makeCombatUnit(a);g.addStatus(member,mode==='fear'?'fear':'confused',99,'test');}
    const res=g.resolveQuest([member],quest,s,{individual:true,simulationOpponents:[{path:'door',sequence:5},{path:'red_priest',sequence:5}]});
    const text=res.lines.map(l=>l.text),attached=new Set();let armed=false;
    text.forEach((x,i)=>{
      let m;
      if((m=/grasps the invisible Spirit Body Thread attached to (.+)\.$/.exec(x)))attached.add(m[1]);
      if(armed&&mode==='confused'&&/The thread on .+ is interrupted/.test(x)&&!/^Initiative:/.test(x))interruptsDuringConfusion++;
      if((m=/The thread on (.+) is interrupted/.exec(x)))attached.delete(m[1]);
      if((m=/Spirit Body Thread\. (.+) dies and becomes/.exec(x)))attached.delete(m[1]);
      if((m=/The thread ends because (.+) is dead/.exec(x)))attached.delete(m[1]);
      if(LOSS[mode].test(x)&&attached.size){lossesWithThread++;armed=true;}
      if(armed&&(/^(ACTION:|Initiative:|· Round)/.test(x)||i===text.length-1)){if(attached.size&&mode!=='confused')violations++;armed=false;}
    });
  }
  return {lossesWithThread,violations,interruptsDuringConfusion};
}
for(const [mode,label] of [['madness','mounting Madness'],['fear','Fear']]){
  check(`losing the action to ${label} cuts every attached thread`,()=>{
    const r=actionLossBattles(mode);
    assert(r.lossesWithThread>0,'the scenario must actually produce an action loss while a thread is attached');
    assert.equal(r.violations,0,`${r.violations} action losses left the thread attached`);
  });
}
check('being Confused does not cost the Fool the turn, so it never cuts a thread',()=>{
  const r=actionLossBattles('confused');
  assert(r.lossesWithThread>0,'the scenario must actually produce a Confused action while a thread is attached');
  assert.equal(r.interruptsDuringConfusion,0,'a Confused action must not interrupt any thread');
});

// ---- Parasitic Contagion: flat drain plus a share of the host's Max SP
const parasite={type:'active',id:'parasitic_contagion',effectId:'parasitic_contagion',name:'Parasitic Contagion',text:'Parasitic Contagion',costSP:0,cooldown:0,
  effects:[{type:'signature',rule:'error_parasite',chargeCost:100,duration:2,amount:20,spRatio:.1,maxHpRatio:.1}]};
const castParasite=w=>g.applyStructuredAbility(w.u.agent,w.u,w.v,w.state,[],()=>.99,parasite);
check('Parasitic Contagion drains 20 plus 10% of the host\'s Max SP, limited to the SP it has',()=>{
  const w=world('error',4),before=w.b.sp,want=Math.round(20+.1*w.b.maxSP);
  castParasite(w);g.signatureTurnStart(w.v,w.state,[],()=>.99);
  assert.equal(before-w.b.sp,Math.min(want,before));
  assert(want>20,'the ratio adds to the flat drain');
});
check('a lone host is drained 50% harder, flat and ratio alike',()=>{
  const w=world('error',4);g.setMeterValue(w.a,w.a.path,100);
  w.state.enemies=[w.v]; // only one foe, so Contagion's lone-host bonus applies
  const before=w.b.sp,want=Math.round(30+.15*w.b.maxSP);
  castParasite(w);g.signatureTurnStart(w.v,w.state,[],()=>.99);
  assert.equal(before-w.b.sp,Math.min(want,before));
});
check('the drained SP is credited to the owner up to its maximum',()=>{
  const w=world('error',4);w.a.sp=0;
  const before=w.b.sp,want=Math.min(Math.round(20+.1*w.b.maxSP),before);
  castParasite(w);g.signatureTurnStart(w.v,w.state,[],()=>.99);
  assert.equal(w.a.sp,Math.min(w.a.maxSP,want));
});

console.log(`Thread CC interrupt: ${passed} passed, ${failed} failed`);
if(failed)process.exitCode=1;
