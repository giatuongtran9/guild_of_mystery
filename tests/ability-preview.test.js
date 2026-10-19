'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const g=require('../js/node-loader');
let passed=0,failed=0;
function test(name,run){try{run();passed++;console.log('PASS '+name);}catch(error){failed++;console.error('FAIL '+name+': '+error.stack);}}
const preview=(path,sequence)=>g.buildAbilityPreview({path,sequence});
const casts=demo=>demo.events.filter(event=>event.type==='cast');
test('catalog contains precisely the 188 authored active tiers and hides all passives',()=>{
 const authored=g.PATH_KEYS.flatMap(path=>g.pathOf(path).sequences.filter(t=>t.abilities[0].type==='active').map(t=>path+':'+t.sequence));
 const catalog=g.abilityPreviewCatalog();
 assert.equal(catalog.length,188);assert.deepEqual(catalog.map(item=>item.path+':'+item.sequence),authored);
 assert(!catalog.some(item=>item.path==='fool'&&item.sequence===9));
 catalog[0].ability.effects.push({type:'not_a_live_effect'});
 assert(!g.abilityPreviewCatalog()[0].ability.effects.some(effect=>effect.type==='not_a_live_effect'));
});
test('all 188 demonstrations resolve the chosen native ability or its genuine recorded source',()=>{
 const before=JSON.stringify({paths:g.PATHS,balance:g.GLOBAL_COMBAT});
 for(const {path,sequence,ability} of g.abilityPreviewCatalog()){
  const demo=preview(path,sequence),first=casts(demo)[0],id=ability.effectId||ability.id;
  assert(first,`${path} ${sequence}: cast missing`);
  assert.equal(first.actorId,'preview_caster');
  if(['combat_record','spell_imitation'].includes(id)){
   assert.equal(first.sourceAbilityId,'raging_blow');
   assert.equal(first.ownedPower,id==='combat_record'?'record':'imitation');
  }else assert.equal(first.sourceAbilityId,id,`${path} ${sequence}: wrong ability`);
  assert(demo.groupedRounds.length);assert(demo.initialAllies.length>=2);assert(demo.initialEnemies.length>=1);
  assert(!demo.events.some(event=>/misses|resists|misfires/.test(event.text||'')),`${path} ${sequence}: unreadable failed demonstration`);
  assert(!demo.events.some(event=>event.type==='cast'&&event.actorId.startsWith('preview_target')&&id!=='paper_figurine_rebound'),`${path} ${sequence}: unrelated enemy action`);
 }
 assert.equal(JSON.stringify({paths:g.PATHS,balance:g.GLOBAL_COMBAT}),before,'preview changed shared game definitions');
});
test('previews are deterministic fresh records and do not use global random or recruitment IDs',()=>{
 const originalRandom=Math.random;
 Math.random=()=>{throw new Error('global random was touched');};
 try{
  const first=preview('mother',6),second=preview('mother',6);
  assert.deepEqual(first,second);
  first.events.length=0;first.initialAllies[0].hp=1;first.ability.effects.length=0;
  assert.deepEqual(preview('mother',6),second);
 }finally{Math.random=originalRandom;}
 const source=fs.readFileSync(path.join(__dirname,'../js/ability-preview.js'),'utf8');
 assert(!/\b(?:makeAgent|newId|resolveQuest|saveGame|applyConsequences|Math\.random)\s*\(/.test(source));
});
test('temporary battle binding restores an existing caller on success and rejected selections',()=>{
 const unit=g.makeCombatUnit({id:'sentinel',name:'Sentinel',path:'tyrant',sequence:9,awakened:false,stats:{hp:100,atk:10,def:10,int:10},trait:'Stout Vitality',sp:10,weaponId:'none'});
 const state={allies:[unit],enemies:[],events:[]};
 try{
  g.bindBattle(state,[]);preview('moon',9);assert.throws(()=>preview('fool',9),/active ability/);
  g.addStatus(unit,'curse_link',1,'sentinel');unit._mythicalCurseLink={ownerId:'sentinel'};
  g.removeStatus(unit,'curse_link');assert(state.events.some(event=>event.targetId==='sentinel'));
 }finally{g.bindBattle(null);}
});
test('Paper Rebound shows its guard only on a real incoming hit and records separate reflection',()=>{
 const demo=preview('fool',7),incoming=demo.events.findIndex(event=>event.paperReboundOwnerId==='preview_caster');
 assert(incoming>0);assert.equal(demo.events[incoming].actorId,'preview_target_0');
 const reflection=demo.events.findIndex(event=>event.isReflect&&event.sourceAbilityId==='paper_figurine_rebound');
 assert(reflection>incoming);assert.equal(demo.events[reflection].actorId,'preview_caster');
 assert.equal(demo.events[reflection].targetId,'preview_target_0');
 assert.equal(casts(demo).filter(event=>event.actorId==='preview_target_0').length,1);
});
test('Death summons a genuine prepared spirit with a real owned vessel snapshot',()=>{
 const demo=preview('death',7),spawn=demo.events.find(event=>event.presentationEffect==='necromancy_summon');
 assert(spawn);assert.equal(spawn.ownerId,'preview_caster');
 assert(!demo.initialAllies.some(unit=>unit.id===spawn.targetId));
 const final=demo.finalUnits.find(unit=>unit.id===spawn.targetId);assert(final);
 assert.equal(final.companion.definitionId,'graveguard');assert.equal(final.companion.ownerId,'preview_caster');
});
test('Door and White Tower retain borrowed provenance while Error performs its selected theft',()=>{
 for(const path of ['door','white_tower']){
  const demo=preview(path,6),cast=casts(demo)[0];assert.equal(cast.sourcePath,'tyrant');
  assert.equal(cast.sourceUnitId,'preview_target_0');assert.equal(cast.sourceAbilityId,'raging_blow');
  assert(demo.notes.some(note=>/Raging Blow/.test(note)));
 }
 const theft=preview('error',6);assert.equal(casts(theft)[0].sourceAbilityId,'rust_siphon');
 assert(theft.events.some(event=>/steals one paid use/.test(event.text||'')));
});
test('healing and cleansing use genuine prepared health and removable statuses',()=>{
 const heal=preview('moon',9),caster=heal.initialAllies[0];assert(caster.hp<caster.maxHp);
 assert(heal.events.some(event=>event.type==='heal'&&event.amount>0));
 const cleanse=preview('sun',7);assert(cleanse.initialAllies[0].statuses.some(status=>status.name==='poison'));
 assert(!cleanse.finalUnits.find(unit=>unit.id==='preview_caster').statuses.some(status=>status.name==='poison'));
});
test('Mother regeneration, parasite drain and rewind are resolved by real follow-up hooks',()=>{
 const seed=preview('mother',6);assert(seed.events.some(event=>event.type==='heal'&&event.round===4));
 const parasite=preview('error',4);assert(parasite.events.some(event=>/parasite siphons/.test(event.text||'')));
 const rewind=preview('wheel_of_fortune',2);assert(rewind.events.some(event=>/Perfect Loop/.test(event.text||'')));
 assert(rewind.events.some(event=>event.type==='heal'&&event.targetId==='preview_caster'));
});
test('prepared beasts and turrets exist before commands without creating extra combat actions',()=>{
 for(const [path,sequence,kind,marker] of [['moon',8,'beast','beast_command'],['paragon',6,'device','device_mark']]){
  const demo=preview(path,sequence);assert(demo.initialAllies.some(unit=>unit.companion?.kind===kind));
  assert(demo.events.some(event=>event.presentationEffect===marker));
  assert(!casts(demo).some(event=>event.actorId.startsWith('vessel_')));
 }
});
test('Thread Binding uses the live dedicated cast rather than its no-op structured signature',()=>{
 const demo=preview('fool',5),thread=demo.events.find(event=>event.type==='thread');assert(thread);
 assert.equal(thread.targetId,'preview_target_0');assert.equal(thread.threadState.ownerId,'preview_caster');
 assert.equal(thread.threadState.value,0);assert.equal(casts(demo)[0].abilityId,'thread_binding');
});
test('explicit Thread cast and normal AI action have identical payment, events and random draws',()=>{
 const {world}=require('./phase3-test-helpers');
 const fresh=()=>{const w=world('fool',5);for(const spec of g.unlockedAbilities(w.a))if(spec.type==='active'&&spec.effectId!=='thread_binding')w.a.cooldowns[spec.effectId]=99;return w;};
 const live=fresh(),explicit=fresh();assert.equal(g.choosePathwayBattleAction(live.a,live.u,live.v,live.state).kind,'thread');
 let liveDraws=0,explicitDraws=0;
 g.powerEffect(live.a,live.u,live.v,live.state,[],()=>{liveDraws++;return .99;});
 g.castThreadBinding(explicit.a,explicit.u,explicit.v,explicit.state,[],()=>{explicitDraws++;return .99;});
 assert.equal(liveDraws,explicitDraws);assert.deepEqual(live.state.events,explicit.state.events);
 assert.deepEqual(live.v.thread,explicit.v.thread);assert.equal(live.a.sp,explicit.a.sp);
 assert.deepEqual(live.a.cooldowns,explicit.a.cooldowns);
 // Both paths share the extracted cast; ensure the original branch was moved,
 // not replaced with AI forcing or a preview-only implementation.
 const engine=fs.readFileSync(path.join(__dirname,'../js/engine.js'),'utf8');
 assert.equal((engine.match(/ability: 'Thread Binding'/g)||[]).length,1);
 assert(engine.includes("action.kind==='thread'&&castThreadBinding(a,actor,enemy,state,lines,r)"));
});
console.log(`Ability preview: ${passed} passed, ${failed} failed.`);if(failed)process.exitCode=1;
