'use strict';
// A failed basic attack keeps its resolved mechanics and event order, while
// standalone miss rows retain enough metadata for the existing replay clock.
const {g,assert,world}=require('./phase3-test-helpers');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
let passed=0;
function test(name,fn){try{fn();passed++;console.log('PASS '+name);}finally{g.bindBattle(null);}}
const presentationFields=['abilityId','attackKind','sourcePath','ability','weaponId'];
function fixture(weaponId='epic_revolver'){
 const w=world('fool',9);w.a.weaponId=weaponId;
 w.u.hp=w.u.maxHp=100000;w.v.hp=w.v.maxHp=1000000;
 w.u.shield=123;w.v.shield=456;w.lines=[];
 return w;
}
function attempt(w,draws=[.99],options={}){
 let calls=0;
 const result=g.attackOnce(w.a,w.u,w.v,w.state,w.lines,()=>{
  assert(calls<draws.length,'miss resolution must not consume another random draw');
  return draws[calls++];
 },1,options);
 return {result,calls};
}
function rows(events){return g.groupEventsToRows(events).flatMap(round=>round.rows);}
function miss(fields={}){return {round:1,type:'miss',actorId:'hero',actorName:'Hero',actorTeam:'ally',
 targetId:'enemy',targetName:'Enemy',targetTeam:'enemy',text:'Hero misses.',...fields};}
function cast(actorId='hero',abilityId='paid_spell'){
 return {round:1,type:'cast',actorId,actorName:actorId,actorTeam:'ally',abilityId,ability:abilityId,costSP:12};
}
const basicMetadata={abilityId:'basic_attack',attackKind:'gun',sourcePath:'fool',ability:'Runebore Revolver',weaponId:'epic_revolver'};
function strippedSnapshot(w){
 const snapshot=JSON.parse(JSON.stringify({u:w.u,v:w.v,state:w.state,lines:w.lines}));
 for(const event of snapshot.state.events)if(event.type==='miss')for(const field of presentationFields)delete event[field];
 return snapshot;
}

test('a guaranteed gun miss preserves resources, recoil, companion hooks and event count',()=>{
 const w=fixture();w.u._nextAttackMiss=1;
 w.u._assetDefinitionId='mirror_battery';w.u._assetMirrorCharge=321;
 const before={hp:w.u.hp,enemyHp:w.v.hp,sp:w.a.sp,shield:w.u.shield,enemyShield:w.v.shield};
 assert.deepEqual(attempt(w,[.5]),{result:false,calls:1});
 assert.deepEqual({hp:w.u.hp,enemyHp:w.v.hp,sp:w.a.sp,shield:w.u.shield,enemyShield:w.v.shield},before);
 assert.equal(w.u._assetMirrorCharge,321,'the before-basic companion hook did not consume its charge');
 assert.equal(w.a._weaponState,undefined,'opening recoil was neither charged nor marked spent');
 assert.deepEqual(w.state.balanceTrace,[]);assert.deepEqual(w.state.weaponUsage,{});
 assert.deepEqual(w.state.events.map(event=>event.type),['miss'],'no speculative cast or hit was added');
 const event=w.state.events[0];
 for(const [field,value] of Object.entries(basicMetadata))assert.equal(event[field],value);
});

for(const [weaponId,kind] of [['none','unarmed'],['knife','weapon'],['pistol','gun']]){
 test(`${weaponId} miss records its actual basic-attack family`,()=>{
  const w=fixture(weaponId);w.u._nextAttackMiss=1;attempt(w,[.5]);
  const event=w.state.events[0];assert.equal(event.abilityId,'basic_attack');
  assert.equal(event.attackKind,kind);assert.equal(event.weaponId,weaponId);
  assert.equal(event.ability,weaponId==='none'?'Attack':g.WEAPONS[weaponId].name);
 });
}
test('gun mastery miss consumes the same two draws and preserves its accuracy message',()=>{
 const w=fixture('pistol');
 assert.deepEqual(attempt(w,[.99,0]),{result:false,calls:2});
 assert.match(w.state.events[0].text,/Gun Mastery Lv\.0 gives 50% accuracy/);
});
test('metadata does not alter forced-miss state or RNG compared with the internal no-cast route',()=>{
 const normal=fixture(),internal=fixture();normal.u._nextAttackMiss=internal.u._nextAttackMiss=1;
 assert.deepEqual(attempt(normal,[.5]),attempt(internal,[.5],{emitCast:false}));
 assert.deepEqual(strippedSnapshot(normal),strippedSnapshot(internal));
 assert(!Object.hasOwn(internal.state.events[0],'abilityId'),'an owned paid fallback does not invent basic-cast metadata');
});
test('failed-attack signature reactions keep their random draws, state and event ordering',()=>{
 const normal=fixture(),internal=fixture();
 for(const w of [normal,internal]){w.u._nextAttackMiss=1;w.u._signatureCalamity={ownerId:w.v.id,amount:.1};w.state.currentTurn=1;}
 const draws=Array(20).fill(.99);
 assert.deepEqual(attempt(normal,draws),attempt(internal,draws,{emitCast:false}));
 assert.deepEqual(strippedSnapshot(normal),strippedSnapshot(internal));
 assert.equal(normal.state.events[0].type,'miss');
 assert(normal.state.events.slice(1).some(event=>event.type==='damage'),'the existing failed-attack reaction still resolves after the miss');
});
test('direct hit-resolver callers retain their existing miss event shape',()=>{
 const w=fixture();
 assert.equal(g.attackHit(w.a,w.u,w.v,w.state,w.lines,()=>{throw Error('forced miss must not roll');},{forcedMiss:true}),false);
 for(const field of presentationFields)assert(!Object.hasOwn(w.state.events[0],field));
});
test('authority suppression still has no attempted cast, miss event or random roll',()=>{
 const w=fixture();w.a.sequence=5;w.b.sequence=0;w.v.sequence=0;
 assert.equal(g.attackOnce(w.a,w.u,w.v,w.state,w.lines,()=>{throw Error('suppression must not roll');}),false);
 assert.deepEqual(w.state.events,[]);assert.match(w.lines[0].text,/higher Authority/);
});
test('a standalone basic miss owns exactly one ordered note and its weapon label',()=>{
 const event=miss(basicMetadata),grouped=rows([event]);
 assert.equal(grouped.length,1);assert.equal(grouped[0].isMiss,true);
 assert.equal(grouped[0].ability,'Runebore Revolver');assert.equal(grouped[0].weaponId,'epic_revolver');
 assert.deepEqual(grouped[0].timeline,[{type:'note',event}]);
 assert.deepEqual(grouped[0].damages,[]);assert.deepEqual(grouped[0].subrows,[]);
});
test('standalone basic-miss playback retains its original two-second action duration at every speed',()=>{
 const source=fs.readFileSync(path.resolve(__dirname,'../js/ui.js'),'utf8').split('// Presentation only:')[0];
 const replay=vm.runInNewContext(`${source}\n({battlePresentationDelay,advanceBattlePresentation})`);
 const row=rows([miss(basicMetadata)])[0];
 for(const speed of [.5,1,2,4]){
  const legacy={turnRows:[{type:'turn',isMiss:true}],currentTurn:0,eventCount:null};
  const playing={turnRows:[row],currentTurn:0,eventCount:null};
  assert.equal(replay.advanceBattlePresentation(playing).type,'cast');
  const castDelay=replay.battlePresentationDelay(playing,speed);
  assert.equal(castDelay,600/speed);
  const outcome=replay.advanceBattlePresentation(playing);assert.equal(outcome.type,'note');assert.equal(outcome.event.type,'miss');
  const missDelay=replay.battlePresentationDelay(playing,speed);
  assert.equal(castDelay+missDelay,replay.battlePresentationDelay(legacy,speed));
  assert.equal(replay.advanceBattlePresentation(playing).type,'settle');
 }
});
test('a different actor basic miss closes the preceding cast without duplicating the miss',()=>{
 const event=miss(basicMetadata),grouped=rows([cast('other'),event]);
 assert.equal(grouped.length,2);assert.equal(grouped[0].abilityId,'paid_spell');
 assert.deepEqual(grouped[1].timeline,[{type:'note',event}]);
});
for(const abilityId of ['paid_spell','basic_attack']){
 test(`a same-actor basic miss stays inside the existing ${abilityId} row`,()=>{
  const event=miss(basicMetadata),grouped=rows([cast('hero',abilityId),event]);
  assert.equal(grouped.length,1);assert.equal(grouped[0].abilityId,abilityId);
  assert.equal(grouped[0].isMiss,undefined,'an attached utility miss does not change its enclosing cast');
  assert.deepEqual(grouped[0].subrows,[event]);assert.deepEqual(grouped[0].timeline,[{type:'note',event}]);
 });
}
test('a resource boundary leaves a following basic miss in its existing separate action row',()=>{
 const event=miss(basicMetadata),grouped=rows([cast(),{round:1,type:'resources',units:[]},event]);
 assert.equal(grouped.length,2);assert.deepEqual(grouped[0].resources,[]);
 assert.deepEqual(grouped[1].timeline,[{type:'note',event}]);
});
test('a paid damaging ability miss remains attached to its paid cast without weapon metadata',()=>{
 const w=fixture();w.u._nextAttackMiss=1;
 const spec={type:'active',id:'paid_probe',effectId:'paid_probe',name:'Paid Probe',costSP:12,cooldown:2,
  effects:[],damage:{scaling:'INT',multiplier:1,type:'elemental',element:'fire',formula:'pure_caster_ability'}};
 assert(g.applyStructuredAbility(w.a,w.u,w.v,w.state,w.lines,()=>.99,spec));
 const event=w.state.events.find(item=>item.type==='miss');assert(event);
 assert(!Object.hasOwn(event,'attackKind'));assert(!Object.hasOwn(event,'abilityId'));
 const grouped=rows(w.state.events);assert.equal(grouped.length,1);assert.equal(grouped[0].abilityId,'paid_probe');
 assert.deepEqual(grouped[0].timeline,[{type:'note',event}]);
});
test('legacy standalone misses keep their original non-timeline grouping',()=>{
 const grouped=rows([miss()]);assert.equal(grouped.length,1);
 assert.equal(grouped[0].ability,'Attack');assert.equal(grouped[0].timeline,undefined);
});
console.log(`Basic miss presentation: ${passed} checks passed`);
