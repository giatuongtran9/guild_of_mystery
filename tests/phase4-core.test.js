'use strict';
const {g,assert,world}=require('./phase3-test-helpers');
let passed=0,failed=0;
function test(name,fn){try{fn();passed++;console.log(`PASS ${name}`);}catch(e){failed++;console.log(`FAIL ${name}: ${e.message}`);}}
test('charged Fool removes the attachment resistance floor on either side',()=>{
 for(const side of ['allies','enemies']){
  const w=world('fool',0,side);w.v.path='door';w.v.agent.awakened=true;
  g.setMeterValue(w.a,'fool',100);
  assert(g.applySpiritThread(w.a,w.v,w.u,w.state,[],()=>.05));
  assert.equal(g.getMeterValue(w.a,'fool'),0);
  assert.equal(w.v.thread.progress,0);
 }
});
test('Seq5 full charge penetrates 20 percentage points without skipping stages',()=>{
 const w=world('fool',5);g.setMeterValue(w.a,'fool',100);
 assert(g.applySpiritThread(w.a,w.v,w.u,w.state,[],()=>.5));
 assert.equal(w.v.thread.progress,0);assert.equal(w.v.thread.required,5);
});
test('Fool progression earns one ten-point bonus per round without old conversion awards',()=>{
 const w=world('fool',0);assert(g.applySpiritThread(w.a,w.v,w.u,w.state,[],()=>.99));
 g.setMeterValue(w.a,'fool',0);
 g.processSpiritThreads(w.state,[]);g.processSpiritThreads(w.state,[]);
 assert.equal(g.getMeterValue(w.a,'fool'),10);
 w.state.currentRound++;
 g.processSpiritThreads(w.state,[]);assert.equal(g.getMeterValue(w.a,'fool'),20);
});
test('a rejected attachment keeps full charge when all control slots are occupied',()=>{
 const w=world('fool',5);w.state.battleMarionettes=[{ownerId:w.a.id,unit:{alive:true}}];
 g.setMeterValue(w.a,'fool',100);
 assert.equal(g.applySpiritThread(w.a,w.v,w.u,w.state,[],()=>.99),false);
 assert.equal(g.getMeterValue(w.a,'fool'),100);
});
test('damage events distinguish shield absorption from actual HP loss',()=>{
 const w=world('fool',9);w.v.shield=1000;
 g.attackOnce(w.a,w.u,w.v,w.state,[],()=>.99);
 const ev=w.state.events.find(e=>e.type==='damage');assert(ev);
 assert.equal(ev.hpLoss,0);assert(ev.absorbed>0);
 assert.equal(ev.amount,ev.hpLoss+ev.absorbed);
 assert.equal(ev.shieldAfter,w.v.shield);
});
test('duplicate character names cannot change the actual combat team',()=>{
 const w=world('fool',9);w.u.name=w.v.name='Same name';
 g.attackOnce(w.b,w.v,w.u,w.state,[],()=>.99);
 assert.equal(w.state.events.find(e=>e.type==='damage').actorTeam,'enemy');
});
test('saved IDs matching prototype keys can cast without corrupting the history map',()=>{
 for(const id of ['constructor','__proto__']){
  const w=world('door',8);w.u.id=id;
  assert(g.applyStructuredAbility(w.a,w.u,w.v,w.state,[],()=>.99,g.tierFor('door',8).abilities[0]));
  assert(Object.hasOwn(w.state._abilityHistoryByUnit,id));
  assert(Array.isArray(w.state._abilityHistoryByUnit[id]));
 }
});
test('full Fortune charge retries the actual failed hit contest',()=>{
 const w=world('wheel_of_fortune',7);g.setMeterValue(w.a,w.a.path,100);
 w.u._signatureRetry={chargeCost:100,turns:2};const rolls=[0,.99,.99,.99,.99];
 assert(g.attackOnce(w.a,w.u,w.v,w.state,[],()=>rolls.shift()??.99));
 assert(w.v.hp<w.v.maxHp);assert.equal(g.getMeterValue(w.a,w.a.path),0);
});
test('Calamity punishes an actually resisted offensive thread attempt once per action',()=>{
 const w=world('wheel_of_fortune',5);w.v.path='fool';w.v.agent.awakened=true;
 w.v._signatureCalamity={ownerId:w.u.id,turns:2,amount:.75};w.state.currentTurn=1;
 const hp=w.v.hp;assert.equal(g.applySpiritThread(w.b,w.u,w.v,w.state,[],()=>0),false);
 assert(w.v.hp<hp);const after=w.v.hp;
 g.applySpiritThread(w.b,w.u,w.v,w.state,[],()=>0);assert.equal(w.v.hp,after);
});
test('an Error fatal redirect reports no HP loss or thread damage on the escaped victim',()=>{
 const w=world('error',4);w.u.hp=w.u.maxHp=100;w.u.shield=20;
 w.u._mythicalAuthority={path:'error',turns:2,used:false};w.u._signatureParasite={hostId:w.v.id};
 w.u.thread={ownerId:w.v.id,progress:3,required:5};w.state.currentTurn=1;
 const res=g.resolveIncoming(w.v,w.u,200,w.state,[],()=>.99,{damageType:'physical'});
 assert.equal(w.u.hp,100);assert.equal(w.u.shield,20);
 assert.equal(res.hpLoss,0);assert.equal(res.absorbed,0);assert.equal(res.redirected,true);
 assert.equal(w.u.thread.progress,3);assert(w.v.hp<w.v.maxHp);
});
test('simultaneous completed Fool threads use the same identity order on both sides',()=>{
 function battle(swapped){const w=world('fool',0);w.v.path='fool';w.b.awakened=true;
  w.u.name='Alpha';w.v.name='Beta';
  assert(g.applySpiritThread(w.a,w.v,w.u,w.state,[],()=>.99));
  assert(g.applySpiritThread(w.b,w.u,w.v,w.state,[],()=>.99));
  w.u.thread.progress=w.v.thread.progress=4;
  if(swapped)[w.state.allies,w.state.enemies]=[w.state.enemies,w.state.allies];
  g.processSpiritThreads(w.state,[]);
  return [w.u,w.v].map(u=>({name:u.name,alive:u.alive,hp:u.hp}));
 }
 assert.deepEqual(battle(false),battle(true));
});
test('resource snapshots stay attached to their action without a separate log row',()=>{
 const units=[{id:'caster',hp:5,shield:3,sp:12}];
 const rounds=g.groupEventsToRows([{round:1,type:'cast',actorId:'caster',ability:'Test'},
  {round:1,type:'resources',units}]);
 assert.equal(rounds[0].rows.length,1);assert.deepEqual(rounds[0].rows[0].resources,units);
});
test('reactive mythical and signature hits remain inside their triggering cast row',()=>{
 const rows=g.groupEventsToRows([{round:1,type:'cast',actorId:'A',actorName:'A',ability:'Spell'},
  {round:1,type:'damage',subtype:'mythical_authority',actorId:'B',actorName:'B',targetId:'A',targetName:'A',amount:12,text:'B retaliates for 12.'},
  {round:1,type:'damage',isSignature:true,actorId:'C',actorName:'C',targetId:'A',targetName:'A',amount:5},
  {round:1,type:'damage',actorId:'A',targetId:'B',amount:30}])[0].rows;
 assert.equal(rows.length,1);assert.equal(rows[0].actorId,'A');assert.equal(rows[0].damages.length,1);
 assert.equal(rows[0].reactions.length,2);assert.equal(rows[0].subrows.length,2);
});
test('an awakening caused by a nested mythical cleave keeps the original action context',()=>{
 const w=world('red_priest',4);w.u._mythicalAuthority={path:'red_priest',turns:2};
 w.other.path='door';w.other.agent.awakened=true;w.other.sequence=4;
 w.other.hp=w.other.maxHp=100;w.other._formUsed=w.other.agent._formUsed=false;
 g.resolveIncoming(w.u,w.v,100,w.state,[],()=>.99,{damageType:'fire'});
 const awakening=w.state.events.find(e=>e.subtype==='mythical_form');assert(awakening);
 assert.equal(awakening.inTurn,true);
});
test('reaction recovery is retained and resource snapshots close an action before turn-start recovery',()=>{
 const grouped=g.groupEventsToRows([{round:1,type:'cast',actorId:'A',actorName:'A',ability:'Spell'},
  {round:1,type:'heal',actorId:'M',actorName:'Moon',targetId:'A',amount:12,hpAfter:50},
  {round:1,type:'resources',units:[{id:'A',hp:50}]},
  {round:1,type:'heal',actorId:'N',actorName:'Mother',targetId:'B',amount:10,hpAfter:60},
  {round:1,type:'cast',actorId:'B',actorName:'B',ability:'Next spell'}])[0].rows;
 assert.equal(grouped.length,3);assert.equal(grouped[0].heals.length,1);assert.equal(grouped[0].heals[0].actorId,'M');
 assert.equal(grouped[1].actorId,'N');assert.equal(grouped[1].heals[0].hpAfter,60);
 assert.equal(grouped[2].actorId,'B');
});
test('battle summaries count HP damage by team and exclude revived casualties',()=>{
 const events=[{round:2,type:'damage',actorTeam:'ally',amount:100,absorbed:70,hpLoss:30},
  {round:2,type:'damage',actorTeam:'enemy',amount:50,absorbed:5,hpLoss:45},
  {round:2,type:'death',targetId:'A',targetName:'A',targetTeam:'ally'},
  {round:2,type:'revive',targetId:'A',targetName:'A',targetTeam:'ally'}];
 const summary=g.summarizeBattleEvents(events,{allies:[{id:'A',name:'A',alive:true}],enemies:[]});
 assert.equal(summary.allyHpDamage,30);assert.equal(summary.enemyHpDamage,45);
 assert.deepEqual(summary.deadAllies,[]);assert.equal(summary.allySurvivors,1);
});
test('a live stalemate at the round cap reports timeout without completing the contract',()=>{
 const a=g.makeAgent(()=>.4,{path:'fool',sequence:9});Object.assign(a,{path:'fool',sequence:9,awakened:true,stats:{hp:1e8,atk:1,def:1,int:1},sp:0});
 const result=g.resolveQuest([a],{name:'Stalemate',difficultySequence:9,requiredPath:'fool',encounter:true,objective:'combat',rewards:{funds:0,reputation:0,materials:{}}},11,
  {individual:true,authoredOpponents:[{path:'fool',sequence:9,name:'Durable foe',stats:{hp:1e8,atk:1,def:1,int:1},sp:0}]});
 assert.equal(result.success,false);assert.equal(result.battleOutcome,'timeout');assert.equal(result.battleSnapshot.outcome,'timeout');
 assert(result.lines.some(line=>/round limit/i.test(line.text)));
});
console.log(`Phase 4 core: ${passed} passed, ${failed} failed`);if(failed)process.exitCode=1;
