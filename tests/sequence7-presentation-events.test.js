'use strict';
// These assertions exercise the real resolver and grouped replay. Presentation
// hints must describe existing outcomes without introducing a new event/action.
const {g,assert,world}=require('./phase3-test-helpers');
const loadout=require('../scripts/permanent-asset-loadouts');
const R=()=>.99;
let passed=0,failed=0;
function test(name,run){try{run();passed++;console.log('PASS '+name);}catch(e){failed++;console.error('FAIL '+name+': '+e.stack);}finally{g.bindBattle(null);}}
function ward(){
  const w=world('fool',7);g.bindBattle(w.state);
  assert(g.applyStructuredAbility(w.a,w.u,w.v,w.state,[],R,g.tierFor('fool',7).abilities[0]));
  w.state.events=[];
  return w;
}
test('Paper guard is tagged on the answered incoming hit before its separate reflection',()=>{
  const w=ward();
  g.attackOnce(w.v.agent,w.v,w.u,w.state,[],R);
  const hit=w.state.events.find(e=>e.type==='damage'&&e.targetId===w.u.id&&!e.isReflect);
  const reflection=w.state.events.find(e=>e.isReflect);
  assert.equal(hit.paperReboundOwnerId,w.u.id);
  assert.equal(reflection.sourceAbilityId,'paper_figurine_rebound');
  assert(!Object.hasOwn(reflection,'paperReboundOwnerId'));
  assert(w.state.events.indexOf(hit)<w.state.events.indexOf(reflection));
  const row=g.groupEventsToRows(w.state.events).flatMap(x=>x.rows).find(row=>row.damages.includes(hit));
  assert.deepEqual(row.timeline.filter(s=>s.type==='damage'||s.type==='reflect').map(s=>s.type),['damage','reflect']);
  assert.equal(row.timeline.find(s=>s.event===hit).event.paperReboundOwnerId,w.u.id);
});
test('ward preparation itself emits no guard-trigger hint',()=>{
  const w=world('fool',7);g.bindBattle(w.state);
  assert(g.applyStructuredAbility(w.a,w.u,w.v,w.state,[],R,g.tierFor('fool',7).abilities[0]));
  assert(!w.state.events.some(e=>Object.hasOwn(e,'paperReboundOwnerId')));
});
for(const [name,opt] of [['periodic',{indirect:true,dotStatus:'burn'}],['reflection',{reflect:true}],['indirect',{indirect:true}]])test(`${name} damage does not advertise a Paper guard trigger`,()=>{
  const w=ward();g.resolveIncoming(w.v,w.u,100,w.state,[],R,{damageType:'fire',...opt});
  assert(!w.state.events.some(e=>Object.hasOwn(e,'paperReboundOwnerId')));
});
for(const status of ['untargetable','possession_phase'])test(`${status} bypasses the ward and cannot advertise its guard`,()=>{
  const w=ward();g.addStatus(w.u,status,1,w.u.name);
  g.resolveIncoming(w.v,w.u,100,w.state,[],R,{damageType:'physical'});
  assert(!w.state.events.some(e=>Object.hasOwn(e,'paperReboundOwnerId')));
});
test('a ward-negated direct hit still records its real Paper guard activation',()=>{
  const w=ward();w.u._reflect.negate=true;
  const before=w.u.hp;g.resolveIncoming(w.v,w.u,100,w.state,[],R,{damageType:'physical'});
  const hit=w.state.events.find(e=>e.type==='damage'&&e.targetId===w.u.id&&!e.isReflect);
  assert.equal(hit.hpLoss,0);assert.equal(w.u.hp,before);assert.equal(hit.paperReboundOwnerId,w.u.id);
});
test('an expired Paper ward does not leave presentation activation behind',()=>{
  const w=ward();g.beginTurn(w.u);
  g.resolveIncoming(w.v,w.u,100,w.state,[],R,{damageType:'physical'});
  assert(!w.state.events.some(e=>Object.hasOwn(e,'paperReboundOwnerId')));
});
for(const path of ['sun','hanged_man','darkness','mother'])test(`${path} at full HP emits no invented healing result`,()=>{
  const w=world(path,7);g.bindBattle(w.state);w.u.hp=w.u.maxHp;
  assert(g.applyStructuredAbility(w.a,w.u,w.v,w.state,[],R,g.tierFor(path,7).abilities[0]));
  assert(!w.state.events.some(e=>e.type==='heal'&&e.actorId===w.u.id));
});
test('a real legacy Necromancy summon identifies the created unit on its existing status event',()=>{
  const w=world('death',7);g.bindBattle(w.state);
  assert(g.applyStructuredAbility(w.a,w.u,w.v,w.state,[],R,g.tierFor('death',7).abilities[0]));
  const note=w.state.events.find(e=>e.presentationEffect==='necromancy_summon');assert(note);
  const spirit=w.state.allies.find(u=>u.id===note.companionId);assert(spirit?.summoned);
  assert.equal(note.ownerId,w.u.id);assert.equal(note.targetId,spirit.id);assert.equal(note.beneficial,true);
});
test('a prepared owned spirit emits the same truthful creation marker',()=>{
  const w=world('death',7);loadout(g,w.a,'rare');g.bindBattle(w.state);
  g.initializePathwayBattle(w.state,{kind:'contract',id:'fx'},101);
  assert(g.applyStructuredAbility(w.a,w.u,w.v,w.state,[],R,g.tierFor('death',7).abilities[0]));
  const note=w.state.events.find(e=>e.presentationEffect==='necromancy_summon');assert(note);
  const spirit=w.state.allies.find(u=>u.id===note.companionId);assert(spirit?._assetId);
  assert.equal(spirit._assetOwnerId,w.u.id);assert.equal(note.beneficial,true);
});
test('an empty owned spirit inventory emits no successful summon marker',()=>{
  const w=world('death',7);g.bindBattle(w.state);
  g.initializePathwayBattle(w.state,{kind:'contract',id:'fx'},101);
  g.applyStructuredAbility(w.a,w.u,w.v,w.state,[],R,g.tierFor('death',7).abilities[0]);
  assert(!w.state.events.some(e=>e.presentationEffect==='necromancy_summon'));
  assert(!w.state.allies.some(u=>u.summoned));
});
console.log(`Sequence 7 presentation events: ${passed} passed, ${failed} failed.`);
if(failed)process.exitCode=1;
