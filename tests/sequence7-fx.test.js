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
test('caster-local abilities do not invent a travel target',f=>{
  const r=row('wind_step','tyrant',[{type:'status',event:event('status','caster','caster',{status:'evade'})}]);
  f.effects.show({type:'cast',row:r,next:r.timeline[0]},1,500);
  assert.equal(f.find('.gm-combat-sequence7[data-stage="cast"]').dataset.targetId,'caster');
});
test('Paper Figurine Rebound displays the guard and only its own tagged reflection travels outward',f=>{
  const r=row('paper_figurine_rebound','fool',[{type:'status',event:event('status','caster','caster')}]);
  f.effects.show({type:'cast',row:r,next:r.timeline[0]},1,500);
  const guard=f.find('.gm-combat-sequence7[data-stage="cast"]');assert(guard);assert.equal(guard.dataset.effectSrc,fx.sequence7Abilities.paper_figurine_rebound.asset);assert.equal(guard.dataset.targetId,'caster');
  f.effects.clear();f.effects.sync(f.map);
  const hit=event('damage','caster','enemy',{isReflect:true,sourceAbilityId:'paper_figurine_rebound'});
  f.effects.show({type:'damage',row:r,event:hit},1,225);
  const reflection=f.find('.gm-combat-sequence7[data-stage="reflect"]');assert(reflection);assert.equal(reflection.dataset.effectSrc,fx.sequence7Abilities.paper_figurine_rebound.reflectAsset);assert.equal(reflection.dataset.ownerId,'caster');
  const flight=active(f).find(a=>a.element===reflection)?.keyframes;assert(flight?.length===5);const reflectCoords=flight.map(k=>k.transform.match(/translate\(([-\d.]+)px,([-\d.]+)px\)/)?.slice(1).map(Number));assert(reflectCoords[0][0] < reflectCoords.at(-1)[0] && reflectCoords[0][1] > reflectCoords.at(-1)[1]);
  f.effects.clear();f.effects.sync(f.map);
  f.effects.show({type:'damage',row:r,event:event('damage','caster','enemy',{isReflect:true,sourceAbilityId:'other_ward'})},1,225);
  assert.equal(f.find('.gm-combat-sequence7[data-stage="reflect"]'),null);
});
try { require(path.join(root,'js/data-loader.js')).validateBattleFx(fx,pathwayKeys); passed++; console.log('PASS Sequence 7 FX metadata validates'); }
catch(e){failed++;console.error('FAIL Sequence 7 FX metadata validates: '+e.stack);}
console.log(`\nSequence 7 FX: ${passed} passed, ${failed} failed.`);if(failed)process.exitCode=1;
