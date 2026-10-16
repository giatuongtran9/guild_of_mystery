'use strict';
const {g,assert,world}=require('./phase3-test-helpers');
require('./mechanics-fixture')(g);
let passed=0;
function test(name,fn){fn();passed++;console.log('PASS '+name);}
function spell(mode,damaging=true){return {id:'target_fixture',effectId:'target_fixture',type:'active',name:'Target Fixture',costSP:10,cooldown:0,
 damage:damaging?{scaling:'INT',multiplier:.1,type:'elemental',element:'fire',formula:'pure_caster_ability'}:null,
 effects:[...(mode?[{type:'targeting',mode}]:[]),...(!damaging?[{type:'shield',maxHpRatio:.1}]:[])]};}
function cast(w,spec){assert(g.applyStructuredAbility(w.a,w.u,w.v,w.state,[],()=>.99,spec));return w.state.events.find(e=>e.type==='cast');}
for(const side of ['allies','enemies']){
 for(const mode of [undefined,'single_enemy','all_enemies','up_to_3_enemies']){
  test(`${side}: ${mode||'default single'} casts advertise actual targeting`,()=>{
   const w=world('door',0,side),event=cast(w,spell(mode));
   assert.equal(event.presentationTargetMode,mode||'single_enemy');
   const damage=w.state.events.filter(e=>e.type==='damage'&&!e.isCounter&&!e.isReaction&&!e.isReflect);
   assert(damage.length);
   assert(damage.every(e=>e.area===['all_enemies','up_to_3_enemies'].includes(mode)));
   const rows=g.groupEventsToRows(w.state.events).flatMap(r=>r.rows);
   assert.equal(rows.find(r=>r.ability==='Target Fixture').presentationTargetMode,mode||'single_enemy','grouped playback retains additive cast metadata');
  });
 }
 test(`${side}: all-allies support metadata does not invent damage`,()=>{
  const w=world('door',0,side),event=cast(w,spell('all_allies',false));
  assert.equal(event.presentationTargetMode,'all_allies');
  assert(!w.state.events.some(e=>e.type==='damage'));
  assert.equal(w.state.events.filter(e=>e.type==='shield').length,2);
 });
 test(`${side}: Unbound Canticle expansion advertises an area cast`,()=>{
  const w=world('door',0,side);
  Object.assign(w.a,{traitSource:'catalog_v1',traitId:'unbound_canticle',traitTier:'legendary'});
  const event=cast(w,spell('single_enemy'));
  assert.equal(event.presentationTargetMode,'all_enemies');
  assert.equal(new Set(w.state.events.filter(e=>e.type==='damage'&&!e.isCounter&&!e.isReaction&&!e.isReflect).map(e=>e.targetId)).size,2);
 });
 test(`${side}: copied area powers retain the effective source targeting`,()=>{
  const w=world('door',0,side),source=spell('all_enemies');
  source.id=source.effectId='borrowed_area_fixture';
  w.state._abilityHistoryByUnit={[w.v.id]:[{spec:source,sequence:0,round:1}]};
  const copy={id:'copy_fixture',effectId:'copy_fixture',type:'active',name:'Copy Fixture',costSP:0,cooldown:0,effects:[{type:'copy_ability'}]};
  const event=cast(w,copy);
  assert.equal(event.presentationTargetMode,'all_enemies');
  assert.equal(event.sourceAbilityId,'borrowed_area_fixture');
  assert.equal(w.state.events.filter(e=>e.type==='damage'&&e.area).length,2);
 });
 test(`${side}: a one-target area cast still remains an area cast`,()=>{
  const w=world('door',0,side);
  w.state[side==='allies'?'enemies':'allies']=[w.v];
  assert.equal(cast(w,spell('all_enemies')).presentationTargetMode,'all_enemies');
  assert.equal(w.state.events.filter(e=>e.type==='damage'&&e.area).length,1);
 });
}
test('resolved damage carries the explicit area option without changing its result',()=>{
 const losses=[];
 for(const area of [undefined,false,true]){
  const w=world('door',0),hit=g.resolveIncoming(w.u,w.v,10,w.state,[],()=>.99,{damageType:'fire',area});
  assert.equal(hit.event.area,!!area);
  losses.push(hit.hpLoss);
 }
 assert.equal(new Set(losses).size,1,'presentation metadata does not change damage');
});
test('reflection does not inherit the area marker from its incoming hit',()=>{
 const w=world('door',0);w.v._reflect={mode:'share',share:.5,element:'physical'};
 g.resolveIncoming(w.u,w.v,10,w.state,[],()=>.99,{damageType:'physical',area:true});
 assert(w.state.events.some(e=>e.type==='damage'&&e.area&&!e.isReflect));
 assert(w.state.events.some(e=>e.type==='damage'&&e.isReflect&&e.area===false));
});
console.log(`Combat presentation targeting: ${passed} checks passed`);
