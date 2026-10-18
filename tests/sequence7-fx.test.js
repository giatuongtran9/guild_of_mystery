'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '..');
const ui = fs.readFileSync(path.join(root, 'js/ui.js'), 'utf8');
const source = ui.slice(0, ui.indexOf('// ===== Browser UI ====='));
const fx = JSON.parse(fs.readFileSync(path.join(root, 'data/fx.json'), 'utf8'));
const pathwayKeys = JSON.parse(fs.readFileSync(path.join(root, 'data/pathways/index.json'), 'utf8')).order;
let passed=0, failed=0;
function test(name, fn) { let f; try { f=fixture(); fn(f); passed++; console.log('PASS '+name); } catch (e) { failed++; console.error('FAIL '+name+': '+e.stack); } finally { f?.effects.clear(); f?.dom.window.close(); } }
function fixture() {
  const dom=new JSDOM('<main></main>',{runScripts:'dangerously',pretendToBeVisual:true}), w=dom.window, animations=[];
  Object.defineProperty(w,'innerWidth',{value:390}); Object.defineProperty(w,'innerHeight',{value:900});
  w.abbrNum=n=>String(Math.round(n||0)); w.matchMedia=()=>({matches:false});
  w.G9_DATA={fx,runtimeAssets:{entries:{}},balance:{path_archetype:{moon:'Caster'}}};
  w.Element.prototype.animate=function(frames,timing){const a={element:this,keyframes:frames,timing,currentTime:0,playbackRate:1,playState:'running',pause(){},play(){},cancel(){this.playState='idle';this.cancelled=true;this.oncancel?.()}};animations.push(a);return a;};
  const pos={caster:[100,370],ally:[230,370],enemy:[140,80]};
  w.Element.prototype.getBoundingClientRect=function(){const id=this.closest?.('[data-unit-id]')?.dataset.unitId,[left,top]=pos[id]||[0,0],width=id?64:390,height=id?64:650;return{left,top,right:left+width,bottom:top+height,width,height,x:left,y:top,toJSON(){}};};
  const api=w.eval('(function(){\n'+source+'\nreturn {createBattleEffects,renderBattleLogComponent};\n})()'); w.createBattleEffects=api.createBattleEffects; w.renderBattleLogComponent=api.renderBattleLogComponent;
  const make=(id,pathway,team='ally')=>({id,name:id,path:pathway,sequence:7,team,hp:80,maxHp:100,curHp:80,sp:40,maxSP:50,alive:true});
  const allies=[make('caster','fool'),make('ally','sun')],enemies=[make('enemy','red_priest','enemy')],map=Object.fromEntries([...allies,...enemies].map(x=>[x.id,x]));
  w.document.querySelector('main').innerHTML=w.renderBattleLogComponent({allies,enemies,flattenedRows:[],shownCount:0,isDone:false,speed:1,summaryText:''});
  const wrap=w.document.querySelector('.battle-log-wrap'),effects=w.createBattleEffects(wrap);effects.sync(map);
  return{dom,w,wrap,map,effects,animations,find:q=>wrap.querySelector(q),all:q=>[...wrap.querySelectorAll(q)]};
}
const active=f=>f.animations.filter(a=>!a.cancelled&&a.playState!=='finished');
const row=(id,sourcePath='fool',timeline=[],actorId='caster')=>({type:'turn',actorId,abilityId:id,sourceAbilityId:id,sourcePath,ability:id,timeline,targetId:'enemy'});
const event=(type,actorId,targetId,extra={})=>({type,actorId,targetId,...extra});

test('all 18 active sequence 7 effects have valid unique RGBA PNG artwork and pathway palettes',()=>{
  assert.equal(Object.keys(fx.sequence7Abilities).length,18);
  const names=new Set();
  for(const [id,spec] of Object.entries(fx.sequence7Abilities)){
    assert(spec.pathway,id);assert.match(spec.color,/^#[\da-f]{6}$/i);assert(['travel','strike','support','caster'].includes(spec.mode));
    for(const src of [spec.asset,spec.reflectAsset].filter(Boolean)){
      const rel=src.split('?')[0],file=path.join(root,rel),b=fs.readFileSync(file);assert.equal(b.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(b.readUInt32BE(16),256);assert.equal(b.readUInt32BE(20),256);
      assert(!names.has(rel),id+' duplicate asset');names.add(rel);assert(b.includes(Buffer.from([0,0,0,0])),'transparent RGBA pixels in '+rel);
    }
  }
  assert.equal(names.size,19);
});
test('traveling cast effect follows caster-to-target vector and keeps its recorded target',f=>{
  const r=row('fireball_barrage','red_priest',[{type:'damage',event:event('damage','caster','enemy')}]);
  f.effects.show({type:'cast',row:r,next:r.timeline[0]},1,500);
  const n=f.find('.gm-combat-sequence7[data-stage="cast"]');assert(n);assert.equal(n.dataset.targetId,'enemy');assert.equal(n.dataset.mode,'travel');
  assert(Number(n.dataset.angleDeg)>-90&&Number(n.dataset.angleDeg)<0,'angle heads from lower caster toward upper enemy');
  const frames=active(f).find(a=>a.element===n)?.keyframes;assert(frames?.length===5);const flightCoords=frames.map(k=>k.transform.match(/translate\(([-\d.]+)px,([-\d.]+)px\)/)?.slice(1).map(Number));assert(flightCoords[0][0] < flightCoords.at(-1)[0] && flightCoords[0][1] > flightCoords.at(-1)[1]);
});
test('support effect attaches to actual support outcome, not the enemy target',f=>{
  const r=row('flesh_healing','hanged_man',[{type:'heal',event:event('heal','caster','ally')}]);
  f.effects.show({type:'cast',row:r,next:r.timeline[0]},1,500);
  const n=f.find('.gm-combat-sequence7[data-stage="cast"]');assert(n);assert.equal(n.dataset.targetId,'ally');assert.equal(n.dataset.mode,'support');
});
for (const type of ['heal','shield']) test(`copied support selects its real ${type} recipient before reproduction narration`,f=>{
  const id=type==='heal'?'flesh_healing':'runic_shield',path=type==='heal'?'hanged_man':'paragon';
  const r=row(id,path,[
    {type:'note',event:event('status','caster','enemy',{text:'caster reproduces ['+id+']!'})},
    {type,event:event(type,'caster','ally',{amount:20})}
  ]);
  r.abilityId='copy_ability';r.sourceAbilityId='record:'+id;
  f.effects.show({type:'cast',row:r,next:r.timeline[0]},1,800);
  const n=f.find('.gm-combat-sequence7[data-stage="cast"]');
  assert.equal(n.dataset.targetId,'ally');
  assert.equal(n.hasAttribute('data-damage-target-id'),false);
});
test('copied support with no recovery does not attach to enemy narration',f=>{
  const r=row('flesh_healing','hanged_man',[{type:'note',event:event('status','caster','enemy',{text:'caster reproduces [Flesh Healing]!'})}]);
  f.effects.show({type:'cast',row:r,next:r.timeline[0]},1,800);
  assert.equal(f.find('.gm-combat-sequence7[data-stage="cast"]').dataset.targetId,'caster');
});
const xy=frame=>frame.transform.match(/translate\(([-\d.]+)px,([-\d.]+)px\)/).slice(1).map(Number);
for (const id of ['psychic_frenzy','fireball_barrage','witch_s_curse','blood_siphon','bribe_weakening']) {
  for (const actorId of ['caster','enemy']) test(`${id} travel and impact share their authored heading with ${actorId} attacking`,f=>{
    const targetId=actorId==='caster'?'enemy':'caster',spec=fx.sequence7Abilities[id];
    const hit=event('damage',actorId,targetId,{amount:20,hpLoss:20,damageType:'physical'});
    const r=row(id,spec.pathway,[{type:'damage',event:hit}],actorId);
    f.effects.show({type:'cast',row:r,next:r.timeline[0]},1,800);
    const travel=f.find('.gm-combat-sequence7[data-stage="cast"]');assert(travel);
    const angle=Number(travel.dataset.angleDeg),native=Number(spec.nativeAngleDeg||0);
    assert(Math.abs(angle+native-Number(travel.dataset.flowAngleDeg))<1e-9);
    const flight=active(f).find(a=>a.element===travel).keyframes,start=xy(flight[0]),end=xy(flight.at(-1));
    const heading=Math.atan2(end[1]-start[1],end[0]-start[0])*180/Math.PI;
    assert(Math.abs(heading-(angle+native))<1e-9,'native artwork heading must follow movement');
    assert.equal(travel.dataset.flowFromId,id==='blood_siphon'?targetId:actorId);
    assert.equal(travel.dataset.flowToId,id==='blood_siphon'?actorId:targetId);
    f.effects.show({type:'damage',row:r,event:hit},1,225);
    const impact=f.find('.gm-combat-sequence7[data-stage="impact"]');assert(impact);
    assert.equal(Number(impact.dataset.angleDeg),angle);
    assert.equal(impact.dataset.flowFromId,travel.dataset.flowFromId);
    assert.equal(impact.dataset.flowToId,travel.dataset.flowToId);
    const impactFrames=active(f).find(a=>a.element===impact).keyframes;
    assert.deepEqual(xy(impactFrames[0]),end,'arrival artwork stays at the same endpoint');
    assert.equal(f.find('.gm-combat-impact').dataset.targetId,targetId,'actual hit cue remains on recorded victim');
    if(id==='blood_siphon'){
      assert.equal(impact.dataset.targetId,actorId,'siphon artwork arrives at caster');
      assert.equal(impact.dataset.damageTargetId,targetId,'recorded victim stays explicit');
      assert.equal(f.find('.gm-combat-heal'),null,'receipt artwork must not invent a healing event');
    }
  });
}
test('caster-local abilities do not invent a travel target',f=>{
  const r=row('wind_step','tyrant',[{type:'status',event:event('status','caster','caster',{status:'evade'})}]);
  f.effects.show({type:'cast',row:r,next:r.timeline[0]},1,500);
  assert.equal(f.find('.gm-combat-sequence7[data-stage="cast"]').dataset.targetId,'caster');
});
test('Paper Figurine Rebound reserves its guard for the actual hit, then reflects separately',f=>{
  const r=row('paper_figurine_rebound','fool',[{type:'status',event:event('status','caster','caster')}]);
  f.effects.show({type:'cast',row:r,next:r.timeline[0]},1,500);
  assert.equal(f.find('.gm-combat-sequence7'),null,'preparing a ward must not depict an incoming hit');
  const incoming=event('damage','enemy','caster',{amount:20,hpLoss:20,paperReboundOwnerId:'caster'});
  const enemyRow=row('basic_attack','red_priest',[{type:'damage',event:incoming}],'enemy');
  f.effects.show({type:'damage',row:enemyRow,event:incoming},1,600);
  const guard=f.find('.gm-combat-sequence7[data-stage="guard"]');assert(guard);assert.equal(guard.dataset.effectSrc,fx.sequence7Abilities.paper_figurine_rebound.asset);assert.equal(guard.dataset.targetId,'caster');
  assert.equal(f.find('.gm-combat-sequence7[data-stage="reflect"]'),null);
  f.effects.clear();f.effects.sync(f.map);
  const hit=event('damage','caster','enemy',{isReflect:true,sourceAbilityId:'paper_figurine_rebound'});
  f.effects.show({type:'damage',row:r,event:hit},1,225);
  assert.equal(f.find('.gm-combat-sequence7[data-stage="guard"]'),null,'reflection begins after the guard stage');
  const reflection=f.find('.gm-combat-sequence7[data-stage="reflect"]');assert(reflection);assert.equal(reflection.dataset.effectSrc,fx.sequence7Abilities.paper_figurine_rebound.reflectAsset);assert.equal(reflection.dataset.ownerId,'caster');
  const flight=active(f).find(a=>a.element===reflection)?.keyframes;assert(flight?.length===5);const reflectCoords=flight.map(k=>k.transform.match(/translate\(([-\d.]+)px,([-\d.]+)px\)/)?.slice(1).map(Number));assert(reflectCoords[0][0] < reflectCoords.at(-1)[0] && reflectCoords[0][1] > reflectCoords.at(-1)[1]);
  f.effects.clear();f.effects.sync(f.map);
  f.effects.show({type:'damage',row:r,event:event('damage','caster','enemy',{isReflect:true,sourceAbilityId:'other_ward'})},1,225);
  assert.equal(f.find('.gm-combat-sequence7[data-stage="reflect"]'),null);
});
test('untagged and periodic hits cannot invent a Paper guard',f=>{
  const r=row('basic_attack','red_priest',[],'enemy');
  for(const extra of [{},{paperReboundOwnerId:'caster',isDot:true},{paperReboundOwnerId:'caster',isReflect:true}]){
    f.effects.show({type:'damage',row:r,event:event('damage','enemy','caster',{amount:20,hpLoss:20,...extra})},1,600);
    assert.equal(f.find('.gm-combat-sequence7[data-stage="guard"]'),null);
  }
});
for(const [id,type] of Object.entries({purification_halo:'heal',flesh_healing:'heal',peaceful_rest:'heal',harvest_blessing:'heal',dawn_shield:'shield',scroll_ward:'shield',runic_shield:'shield',prohibition_barrier:'shield',possession_phase:'status'})){
  test(`${id} holds its own PNG across cast and actual support on the real recipient`,f=>{
    const hit=event(type,'caster','ally',{amount:20,beneficial:true,status:type==='status'?'possession_phase':undefined});
    const r=row(id,fx.sequence7Abilities[id].pathway,[{type:type==='status'?'note':type,event:hit}]);
    f.effects.show({type:'cast',row:r,next:r.timeline[0]},1,800);
    const cast=f.find('.gm-combat-sequence7[data-stage="cast"]');assert(cast);
    const castFrames=active(f).find(a=>a.element===cast).keyframes;
    assert.equal(castFrames[1].offset,.15);assert.equal(castFrames[2].offset,.85);
    assert.equal(castFrames[1].opacity,1);assert.equal(castFrames[2].opacity,1);
    f.effects.show({type:type==='status'?'note':type,row:r,event:hit},1,600);
    const result=f.find('.gm-combat-sequence7[data-stage="support"]');assert(result);
    assert.equal(result.dataset.targetId,'ally');assert.equal(result.dataset.effectSrc,fx.sequence7Abilities[id].asset);
    const a=active(f).find(a=>a.element===result);assert.equal(a.timing.duration,600);
    assert.equal(a.keyframes[1].offset,.15);assert.equal(a.keyframes[2].offset,.85);
    assert.equal(a.keyframes[1].opacity,1);assert.equal(a.keyframes[2].opacity,1);
    f.effects.pause();f.effects.setSpeed(2);f.effects.resume();
    f.effects.clear();assert.equal(f.find('.gm-combat-sequence7'),null);
  });
}
test('full-HP attempts and unrelated status narration do not invent support PNG results',f=>{
  const r=row('flesh_healing','hanged_man',[]);
  f.effects.show({type:'heal',row:r,event:event('heal','caster','ally',{amount:0})},1,600);
  assert.equal(f.find('.gm-combat-sequence7[data-stage="support"]'),null);
  f.effects.show({type:'note',row:r,event:event('status','caster','enemy',{text:'caster reproduces Flesh Healing'})},1,90);
  assert.equal(f.find('.gm-combat-sequence7[data-stage="support"]'),null);
});
test('Necromancy requires an actual creation or sustain event and keeps the new companion identity',f=>{
  const r=row('necromancy_summon','death',[]);
  f.effects.show({type:'cast',row:r},1,800);assert.equal(f.find('.gm-combat-sequence7'),null);
  const spawn=event('status','caster','new-spirit',{presentationEffect:'necromancy_summon',ownerId:'caster',companionId:'new-spirit',beneficial:true});
  r.timeline=[{type:'note',event:spawn}];
  f.effects.show({type:'cast',row:r,next:r.timeline[0]},1,800);assert(f.find('.gm-combat-sequence7[data-stage="cast"]'));
  f.effects.show({type:'note',row:r,event:spawn},1,600);
  const result=f.find('.gm-combat-sequence7[data-stage="support"]');assert(result);
  assert.equal(result.dataset.targetId,'new-spirit');assert.equal(result.dataset.companionId,'new-spirit');
  assert.equal(f.find('.gm-combat-impact'),null);
});
test('Paper reflection heading derives from its actual defender even inside another actor’s row',f=>{
  const r=row('fireball_barrage','red_priest',[],'enemy');
  const hit=event('damage','caster','enemy',{isReflect:true,sourceAbilityId:'paper_figurine_rebound',amount:20,hpLoss:20,damageType:'fire'});
  f.effects.show({type:'reflect',row:r,event:hit},1,275);
  const n=f.find('.gm-combat-sequence7[data-stage="reflect"]');assert(n);
  assert.equal(n.dataset.ownerId,'caster');assert.equal(n.dataset.targetId,'enemy');
  assert.equal(n.dataset.flowFromId,'caster');assert.equal(n.dataset.flowToId,'enemy');
  const frames=active(f).find(a=>a.element===n).keyframes,start=xy(frames[0]),end=xy(frames.at(-1));
  const heading=Math.atan2(end[1]-start[1],end[0]-start[0])*180/Math.PI;
  assert.equal(Number(n.dataset.angleDeg),heading);
});
try { require(path.join(root,'js/data-loader.js')).validateBattleFx(fx,pathwayKeys); passed++; console.log('PASS Sequence 7 FX metadata validates'); }
catch(e){failed++;console.error('FAIL Sequence 7 FX metadata validates: '+e.stack);}
console.log(`\nSequence 7 FX: ${passed} passed, ${failed} failed.`);if(failed)process.exitCode=1;
