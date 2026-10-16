'use strict';
// Observe the real battle loop while selecting deterministic, real native casts.
// This shim changes AI choices only; Thread ticks, bonus grants and all action
// and scheduled-turn lifecycle work use the production implementations.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const loaderFile=path.resolve(__dirname,'../js/node-loader.js');
const loader=fs.readFileSync(loaderFile,'utf8');
const call="new Function('module','exports','require','G9_DATA','dayjs',src)(m,m.exports,require,G9_DATA,require('./vendor/dayjs.min.js'));";
assert(loader.includes(call));
const observe=`
let threadBonusFixture=null;
const threadBonusOriginalBind=tryThreadBindingControl;
tryThreadBindingControl=function(target,state,lines,r){
 return threadBonusOriginalBind(target,state,lines,threadBonusFixture&&target.id==='victim'?()=>{
  threadBonusFixture.bindingRolls++;
  return threadBonusFixture.bindingRoll??.99;
 }:r);
};
const threadBonusOriginalChoose=choosePathwayBattleAction;
choosePathwayBattleAction=function(a,actor,enemy,state,context){
 if(!threadBonusFixture)return threadBonusOriginalChoose(a,actor,enemy,state,context);
 if(actor.id==='victim'&&threadBonusFixture.mode==='native'&&!threadBonusFixture.castUsed){
  threadBonusFixture.castUsed=true;
  return {kind:'ability',spec:cloneE(tierFor('error',2).abilities[0])};
 }
 return {kind:'attack'};
};
const threadBonusOriginalPower=powerEffect;
powerEffect=function(a,actor,enemy,state,lines,r,context){
 if(threadBonusFixture&&actor.id==='victim')threadBonusFixture.actions.push({
  stage:actor.thread?.progress??null,turn:state.currentTurn,
  duration:actor.statusMeta?.guarded?.duration,cooldown:a.cooldowns.probe,
  origin:context?.origin||'normal'
 });
 return threadBonusOriginalPower(a,actor,enemy,state,lines,r,context);
};
Object.assign(module.exports,{setThreadBonusFixture:fixture=>threadBonusFixture=fixture});`;
const loaded=new Module(loaderFile,module);loaded.filename=loaderFile;loaded.paths=Module._nodeModulePaths(path.dirname(loaderFile));
loaded._compile(loader.replace(call,`new Function('module','exports','require','G9_DATA','dayjs',src+${JSON.stringify(observe)})(m,m.exports,require,G9_DATA,require('./vendor/dayjs.min.js'));`),loaderFile);
const g=require('./mechanics-fixture')(loaded.exports);
let passed=0;
function test(name,fn){fn();passed++;console.log('PASS '+name);}
function victim(mode,progress=1){
 const agent=g.makeAgent(()=>.4,{path:'error',sequence:0,trait:'Stout Vitality'});
 Object.assign(agent,{id:'victim',name:'Threaded Actor',path:'error',sequence:0,awakened:true,
  stats:{hp:1000000,atk:100,def:100,int:100},baseStats:{hp:1000000,atk:100,def:100,int:100},
  injuries:0,madness:0,weaponId:'none',weaponMastery:{},cooldowns:{probe:9},speedVariance:100});
 if(['lone_sovereign','fractured_moment'].includes(mode))Object.assign(agent,{traitId:mode,traitTier:g.TRAIT_DATA.entries[mode].tier,traitSource:'catalog_v1'});
 agent.sp=agent.maxSP=g.maxSPFor(agent);
 const unit=g.makeCombatUnit(agent);unit._formUsed=true;unit.agent._formUsed=true;
 unit.thread={ownerId:'owner',progress,required:5};
 g.addStatus(unit,'guarded',3,'fixture');
 if(mode==='boss'){unit.bossPhaseUsed=true;unit.bossDefinition={phase:{extraActions:1}};}
 return unit;
}
function battle(mode,progress=1,options={}){
 const fixture={mode,actions:[],bindingRolls:0,bindingRoll:options.bindingRoll};g.setThreadBonusFixture(fixture);
 const actor=victim(mode,progress);
 if(options.traitId)Object.assign(actor.agent,{traitId:options.traitId,traitTier:g.TRAIT_DATA.entries[options.traitId].tier,traitSource:'catalog_v1'});
 if(options.sp!==undefined)actor.sp=options.sp;
 if(options.disabled)g.addStatus(actor,'stunned',3,'fixture');
 const quest={id:'thread-bonus',name:'Thread Bonus Fixture',encounter:true,difficultySequence:0,roundLimit:1,
  rewards:{funds:0,reputation:0,materials:{}}};
 const result=g.resolveQuest([actor],quest,42,{individual:true,authoredOpponents:[{
  id:'owner',name:'Thread Owner',path:'fool',sequence:0,trait:'Stout Vitality',weaponId:'none',
  stats:{hp:100000000,atk:1,def:1,int:1},sp:0
 }]});
 g.setThreadBonusFixture(null);
 return {fixture,result};
}
for(const mode of ['native','lone_sovereign','fractured_moment','boss']){
 test(`${mode}: an eligible granted action advances binding before it acts`,()=>{
  const {fixture,result}=battle(mode);
  assert.equal(fixture.actions.length,2,'normal action and one granted bonus execute');
  assert.deepEqual(fixture.actions.map(x=>x.stage),[2,3]);
  assert.deepEqual(fixture.actions.map(x=>x.duration),[3,3],'bonus does not age statuses');
  assert.deepEqual(fixture.actions.map(x=>x.cooldown),[8,8],'only round start ages cooldowns');
  assert.equal(fixture.actions[0].turn,fixture.actions[1].turn,'bonus shares scheduled turn damage budget');
  const own=result.battleSnapshot.allies.find(u=>u.id==='victim');
  assert.equal(own.threadProgress.value,3);
  assert.equal(own.statuses.find(status=>status.name==='guarded').turns,2,'status ages once after the enclosing scheduled turn');
  assert.equal(fixture.bindingRolls,0,'stages below four do not roll binding');
  const casts=result.events.filter(e=>e.type==='cast'&&e.actorId==='victim');
  assert(casts.length>=2);
  const stageIndex=result.events.findIndex(e=>e.type==='thread'&&e.threadState?.value===3);
  assert(result.events.indexOf(casts.at(-1))>stageIndex,'stage event precedes bonus cast');
 });
}
for(const mode of ['native','lone_sovereign','fractured_moment','boss']){
 test(`${mode}: conversion at the bonus boundary cancels that action`,()=>{
  const {fixture,result}=battle(mode,3);
  assert.equal(fixture.actions.length,1,'conversion prevents the granted action from executing');
  assert.equal(fixture.actions[0].stage,4);
  assert.equal(fixture.bindingRolls,1,'only the scheduled stage-four action rolls; conversion cancels before another roll');
  const death=result.events.find(e=>e.type==='death'&&e.targetId==='victim'&&e.converted);
  assert(death,'fifth step converts the victim');
  assert(result.battleSnapshot.enemies.some(u=>u.id==='mar_victim'&&u.alive),'converted marionette joins owner');
  assert(!result.events.slice(result.events.indexOf(death)+1).some(e=>e.type==='cast'&&e.actorId==='victim'));
 });
}
test('stage four binding blocks the current scheduled action immediately',()=>{
 const {fixture,result}=battle('native',3,{bindingRoll:0});
 assert.equal(fixture.bindingRolls,1);
 assert.equal(fixture.actions.length,0,'binding precedes the scheduled CC gate');
 const unit=result.battleSnapshot.allies.find(u=>u.id==='victim');
 assert.equal(unit.threadProgress.value,4);
 assert(!unit.statuses.some(status=>status.name==='bound'),'one-turn binding expires after consuming this turn');
 assert(result.events.some(event=>event.subtype==='cc_loss'&&event.actorId==='victim'));
});
test('a failed stage-four roll permits the scheduled action without a second roll',()=>{
 const {fixture,result}=battle('none',3,{bindingRoll:.3});
 assert.equal(fixture.bindingRolls,1,'30% threshold is exclusive and rolls once');
 assert.equal(fixture.actions.length,1);
 assert(!result.events.some(event=>event.status==='bound'&&event.targetId==='victim'));
});
for(const mode of ['native','lone_sovereign','fractured_moment','boss']){
 test(`${mode}: stage four binding rolls before and cancels a granted bonus`,()=>{
  const {fixture,result}=battle(mode,2,{bindingRoll:0});
  assert.equal(fixture.bindingRolls,1,'only the bonus stage-four action rolls binding');
  assert.equal(fixture.actions.length,1,'the normal action executes; the bonus does not');
  assert.equal(fixture.actions[0].stage,3);
  const unit=result.battleSnapshot.allies.find(u=>u.id==='victim');
  assert.equal(unit.threadProgress.value,4);
  assert(!unit.statuses.some(status=>status.name==='bound'),'no second scheduled action is lost to grace');
  const bind=result.events.findIndex(event=>event.status==='bound'&&event.targetId==='victim');
  const loss=result.events.findIndex(event=>event.subtype==='cc_loss'&&event.actorId==='victim');
  assert(bind>=0&&loss>bind,'binding cause precedes the skipped-action log');
 });
}
test('a failed stage-four bonus roll permits that bonus without a second roll',()=>{
 const {fixture,result}=battle('native',2,{bindingRoll:.3});
 assert.equal(fixture.bindingRolls,1);
 assert.deepEqual(fixture.actions.map(action=>action.stage),[3,4]);
 assert(!result.events.some(event=>event.status==='bound'&&event.targetId==='victim'));
});
test('Unbroken Will can pay to act through scheduled Thread binding',()=>{
 const {fixture,result}=battle('native',3,{bindingRoll:0,traitId:'unbroken_will'});
 assert.equal(fixture.bindingRolls,1);
 assert.equal(fixture.actions.length,1,'paid control resistance preserves the normal action');
 assert.equal(fixture.actions[0].stage,4);
 assert(result.lines.some(line=>/to act through control/.test(line.text)));
 assert(result.events.some(event=>event.type==='death'&&event.converted&&event.targetId==='victim'),'control resistance does not prevent fifth-stage conversion');
});
test('Unbroken Will can pay to act through bonus-action Thread binding',()=>{
 const {fixture,result}=battle('native',2,{bindingRoll:0,traitId:'unbroken_will'});
 assert.equal(fixture.bindingRolls,1);
 assert.deepEqual(fixture.actions.map(action=>action.stage),[3,4]);
 assert(result.lines.some(line=>/to act through control/.test(line.text)));
 assert(!result.events.some(event=>event.subtype==='cc_loss'&&event.actorId==='victim'));
});
test('a skipped controlled actor gets no nonexistent bonus countdown',()=>{
 const {fixture,result}=battle('lone_sovereign',1,{disabled:true});
 assert.equal(fixture.actions.length,0);
 assert.equal(result.battleSnapshot.allies.find(u=>u.id==='victim').threadProgress.value,2,'only the scheduled turn advanced it');
});
test('counters and reflections remain reactions without binding progression',()=>{
 const {g:base,world}=require('./phase3-test-helpers'),w=world('fool',0),lines=[];
 assert(base.applySpiritThread(w.a,w.v,w.u,w.state,lines,()=>.99));
 base.tickSpiritThread(w.v,w.state,lines);
 const initial=w.v.thread.progress;
 base.maybeCounter(w.v,w.u,w.state,lines,()=>0);
 assert.equal(w.v.thread.progress,initial);
 assert(w.state.events.some(e=>e.isCounter));
 w.v._reflect={mode:'share',share:.5,element:'physical'};
 base.resolveIncoming(w.u,w.v,1,w.state,lines,()=>.99,{damageType:'physical'});
 assert.equal(w.v.thread.progress,initial);
 assert(w.state.events.some(e=>e.isReflect));
});
test('authored and generated Thread Binding descriptions document bonus actions',()=>{
 const authored=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../data/pathways/fool.json'),'utf8'));
 for(const text of [authored.sequences.find(t=>t.sequence===5).ability.description,g.tierFor('fool',5).abilities[0].text]){
  assert.match(text,/scheduled turns and granted bonus actions/);
  assert.match(text,/not counters or reflections/);
 }
});
console.log(`Thread bonus actions: ${passed} checks passed`);
