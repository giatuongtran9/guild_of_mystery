'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const game = require('../js/node-loader');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/ui.js'), 'utf8').split('// ===== Browser UI =====')[0];
const fx = JSON.parse(fs.readFileSync(path.join(root, 'data/fx.json'), 'utf8'));
const catalog = game.abilityPreviewCatalog().filter(entry => entry.sequence === 3);
const ids = Object.fromEntries(catalog.map(entry => [entry.ability.effectId || entry.ability.id, entry.path]));
const casterOnly = new Set(['devil_mutation', 'zombie_legion', 'spatial_concealment', 'deceive_impact', 'historical_summoning', 'flesh_creation', 'mystic_domain', 'lunar_blessing', 'flesh_mutation', 'war_command', 'thunder_god_stance']);
const damaging = ['concealment_realm', 'dream_prison', 'despair_thread', 'energy_cannon', 'exorcism_charter'];
const travel = ['despair_thread', 'energy_cannon', 'exorcism_charter'];
let passed = 0, failed = 0;

function fixture() {
  const dom = new JSDOM('<main></main>', { runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window, animations = [], preloads = [];
  Object.defineProperty(w, 'innerWidth', { value: 390 }); Object.defineProperty(w, 'innerHeight', { value: 900 });
  w.abbrNum = n => String(Math.round(n || 0)); w.matchMedia = () => ({ matches: false });
  w.G9_DATA = { fx, runtimeAssets: { entries: {} }, balance: { path_archetype: { moon: 'Caster' } } };
  w.Image = class { set src(value) { preloads.push(value); } };
  w.Element.prototype.animate = function(keyframes, timing) {
    const a = { element: this, keyframes, timing, currentTime: 0, playbackRate: 1, playState: 'running',
      pause() { this.playState = 'paused'; }, play() { this.playState = 'running'; },
      cancel() { this.playState = 'idle'; this.cancelled = true; this.oncancel?.(); } };
    animations.push(a); return a;
  };
  const positions = { caster: [80, 370], ally: [240, 370], enemy: [60, 80], enemy2: [170, 80], enemy3: [280, 80],
    preview_caster: [80, 370], preview_ally: [240, 370], preview_target_0: [60, 80], preview_target_1: [170, 80], preview_target_2: [280, 80] };
  w.Element.prototype.getBoundingClientRect = function() {
    const id = this.closest?.('[data-unit-id]')?.dataset.unitId, [left, top] = positions[id] || [0, 0];
    const width = id ? 64 : 390, height = id ? 64 : 650;
    return { left, top, right: left + width, bottom: top + height, width, height, x: left, y: top, toJSON() {} };
  };
  const api = w.eval('(function(){\n' + source + '\nreturn {createCombatFx,renderBattleLogComponent,readableCastDuration,battlePresentationDelay};\n})()');
  const units = Object.keys(positions).map(id => ({ id, name: id, path: id.includes('enemy') || id.includes('target') ? 'tyrant' : 'fool', sequence: 3,
    team: id.includes('enemy') || id.includes('target') ? 'enemy' : 'ally', hp: 80, curHp: 80, maxHp: 100, sp: 40, maxSP: 50, alive: true }));
  const map = Object.fromEntries(units.map(unit => [unit.id, unit]));
  w.document.querySelector('main').innerHTML = api.renderBattleLogComponent({ allies: units.filter(unit => unit.team === 'ally'), enemies: units.filter(unit => unit.team === 'enemy'), flattenedRows: [], shownCount: 0, isDone: false, speed: 1, summaryText: '' });
  const wrap = w.document.querySelector('.battle-log-wrap'), effects = api.createCombatFx(wrap); effects.sync(map);
  return { dom, w, api, wrap, map, effects, animations, preloads, positions,
    find: query => wrap.querySelector(query), all: query => [...wrap.querySelectorAll(query)] };
}
function test(name, fn) { let f; try { f = fixture(); fn(f); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + ': ' + e.stack); } finally { f?.effects.clear(); f?.dom.window.close(); } }
const event = (type, actorId, targetId, extra = {}) => ({ type, actorId, targetId, ...extra });
const step = event => ({ type: ['status', 'resist'].includes(event.type) ? 'note' : event.type, event });
const row = (id, timeline = [], actorId = 'caster', targetId = actorId === 'caster' ? 'enemy' : 'caster') => ({ type: 'turn', actorId, abilityId: id, sourceAbilityId: id, sourcePath: ids[id], sequence: 3, ability: id, timeline, presentationTargetId: targetId });
const active = f => f.animations.filter(a => !a.cancelled && a.playState !== 'finished');
const xy = frame => frame.transform.match(/translate\(([-\d.]+)px,([-\d.]+)px\)/).slice(1).map(Number);
const art = (f, id, stage = 'cast', field = 'asset') => f.all('.gm-combat-sequence3').find(n => n.dataset.stage === stage && n.dataset.abilityId === id && n.dataset.effectSrc === fx.sequence3Abilities?.[id]?.[field]);
const cast = (f, r, speed = 1) => f.effects.show({ type: 'cast', row: r, next: r.timeline.find(item => item.type === 'damage') || r.timeline[0] }, speed, 1250);
const outcome = (f, r, e) => f.effects.show({ type: e.type === 'status' ? 'note' : e.type, row: r, event: e }, 1, 500);
const reset = f => { f.effects.clear(); f.effects.sync(f.map); };
const native = id => game.buildAbilityPreview({ path: ids[id], sequence: 3 });
const nativeRow = id => native(id).groupedRounds.flatMap(group => group.rows).find(r => r.type === 'turn' && r.actorId === 'preview_caster');

test('all twenty native active casts use the approved PNG without modifying their tape', f => {
  assert.equal(catalog.length, 20);
  for (const id of Object.keys(ids)) {
    reset(f); const r = nativeRow(id), before = JSON.stringify(r); cast(f, r);
    const n = art(f, id); assert(n, id + ' authored cast');
    assert.equal(n.dataset.effectSrc, fx.sequence3Abilities[id].asset);
    assert.equal(n.dataset.targetId, casterOnly.has(id) ? 'preview_caster' : 'preview_target_0', id + ' recipient');
    assert(active(f).some(a => a.element === n && a.timing.duration === 1250), id + ' managed timeline');
    assert.equal(JSON.stringify(r), before, id + ' native tape unchanged');
    assert.equal(f.find('.gm-combat-heal, .gm-combat-status, .gm-battle-fx-number'), null, 'cast is an attempt');
  }
});
test('Sequence 3 alone gets the 1250ms cast hold, including copied powers and empty ward rows', f => {
  for (const id of Object.keys(ids)) {
    const r = row(id); assert.equal(f.api.readableCastDuration(r), 1250, id);
    assert.equal(f.api.battlePresentationDelay({turnRows:[r],currentTurn:0,eventCount:0}),1250,id);
    r.abilityId='combat_record';r.sourceAbilityId='record:'+id;assert.equal(f.api.readableCastDuration(r),1250);
  }
  assert.equal(f.api.readableCastDuration(row('unshadowed_execution')),800,'Sequence 4 retains its existing hold');
  assert.equal(f.api.readableCastDuration(row('basic_attack')),300,'basics retain their existing hold');
});
test('four phase animation preserves anticipation, activation, sustain and dissipation', f => {
  cast(f,row('historical_summoning'));const n=art(f,'historical_summoning');assert(n);
  const frames=active(f).find(a=>a.element===n).keyframes;
  for(const offset of [280/1250,460/1250,960/1250])assert(frames.some(k=>Math.abs(k.offset-offset)<1e-8),'phase boundary '+offset);
  assert.equal(frames.at(-1).opacity,0,'finite fade');
});
test('larger stationary and projectile frames preserve the 64px portrait size', f => {
  f.positions.caster=[163,350];f.positions.enemy=[163,150];
  for(const [id,ratio] of [['historical_summoning',120/104],['energy_cannon',108/92]]){
    const size=128*1.14*ratio;
    reset(f);cast(f,row(id));const n=art(f,id);assert(n);assert(Math.abs(Number(n.dataset.effectWidth)-size)<1e-8,id);assert(Math.abs(Number(n.dataset.effectHeight)-size)<1e-8,id);
    const image=n.querySelector('image');assert.equal(Number(image.getAttribute('width')),size);
  }
  assert([...f.wrap.querySelectorAll('.gm-unit-sprite-anchor')].every(node=>node.getBoundingClientRect().width===64));
});
test('Darkness separates the hostile hit from its own untargetability veil', f => {
  const r=nativeRow('concealment_realm');cast(f,r);assert.equal(art(f,'concealment_realm').dataset.targetId,'preview_target_0');
  assert.equal(art(f,'concealment_realm','cast-secondary','secondaryAsset').dataset.targetId,'preview_caster');
  const veil=r.timeline.find(s=>s.event.status==='untargetable').event;reset(f);outcome(f,r,veil);
  assert.equal(art(f,'concealment_realm','outcome','secondaryAsset').dataset.targetId,'preview_caster');
  assert.equal(f.all('.gm-combat-sequence3').some(n=>n.dataset.effectSrc===fx.sequence3Abilities.concealment_realm.asset),false);
});
test('Red Priest covers only living addressed allied recipients, with no enemy rally', f => {
  const r=nativeRow('war_command');cast(f,r);
  assert.deepEqual(f.all('.gm-combat-sequence3[data-stage="cast"]').map(n=>n.dataset.targetId).sort(),['preview_ally','preview_caster']);
  const buffs=r.timeline.filter(s=>s.event.beneficial&&s.event.targetId!=null);
  for(const s of buffs){reset(f);outcome(f,r,s.event);assert.equal(art(f,'war_command','outcome').dataset.targetId,s.event.targetId);}
});
test('Black Emperor and Fortune use each recorded enemy in their group applications', f => {
  for(const id of ['chaos_field','chaos_probability']){
    const r=nativeRow(id);cast(f,r);
    const expected=[...new Set(r.timeline.filter(s=>s.event.targetId&&s.event.beneficial!==true).map(s=>s.event.targetId))];
    assert.equal(expected.length,3,id+' real addressed applications');
    assert.deepEqual(f.all('.gm-combat-sequence3[data-stage="cast"]').map(n=>n.dataset.targetId).sort(),expected.sort());
  }
});
test('recorded misfire applications pulse each real enemy without fabricated damage',f=>{
  for(const id of ['chaos_field','chaos_probability']){
    const r=nativeRow(id),applied=r.timeline.filter(s=>s.event.subtype==='skill_misfire');assert.equal(applied.length,3);
    for(const s of applied){reset(f);outcome(f,r,s.event);assert.equal(art(f,id,'outcome').dataset.targetId,s.event.targetId);assert.equal(f.find('.gm-battle-fx-number'),null);}
    reset(f);outcome(f,r,{...applied[0].event,chance:0});assert.equal(f.find('.gm-combat-sequence3'),null,'zero misfire chance is not a successful application');
  }
});
test('an older group replay without target events only shows its documented selected target', f => {
  for(const id of ['chaos_field','chaos_probability']){
    reset(f);const r=row(id);r.presentationTargetMode='all_enemies';cast(f,r);
    assert.deepEqual(f.all('.gm-combat-sequence3[data-stage="cast"]').map(n=>n.dataset.targetId),['enemy']);
  }
});
test('Death remains single-target despite its domain name', f => {
  const r=nativeRow('underworld_domain');cast(f,r);assert.deepEqual(f.all('.gm-combat-sequence3[data-stage="cast"]').map(n=>n.dataset.targetId),['preview_target_0']);
  for(const s of r.timeline){reset(f);outcome(f,r,s.event);assert.equal(art(f,'underworld_domain','outcome').dataset.targetId,'preview_target_0');}
});
for(const actor of ['caster','enemy'])for(const id of travel)test(id+' follows its actual opposing anchors from '+actor,f=>{
  const victim=actor==='caster'?'enemy':'caster',r=row(id,[step(event('damage',actor,victim,{amount:20}))],actor,victim);cast(f,r);
  const n=art(f,id);assert(n);assert.equal(n.dataset.targetId,victim);assert.equal(n.dataset.flowDirection,'caster-to-target');
  const frames=active(f).find(a=>a.element===n).keyframes,start=xy(frames[0]),end=xy(frames.at(-1));assert.notDeepEqual(start,end);
  assert(Math.abs(Number(n.dataset.angleDeg)-Math.atan2(end[1]-start[1],end[0]-start[0])*180/Math.PI)<1e-8);
  const anticipation=frames.find(k=>Math.abs(k.offset-280/1250)<1e-8);assert(anticipation);assert.deepEqual(xy(anticipation),start,'gather at source before releasing');
});
test('real damage and successful hostile controls use their recorded recipient',f=>{
  for(const id of damaging){
    const r=nativeRow(id),hit=r.timeline.find(s=>s.event.type==='damage');assert(hit,id);reset(f);outcome(f,r,hit.event);assert.equal(art(f,id,'impact').dataset.targetId,hit.event.targetId);
  }
  for(const [id,status] of [['dream_prison','stunned'],['despair_thread','silenced'],['exorcism_charter','silenced'],['strict_prohibition','silenced']]){
    reset(f);outcome(f,row(id),event('status','caster','enemy',{status,beneficial:false}));assert.equal(art(f,id,'impact').dataset.targetId,'enemy');
  }
});
test('positive self shields, healing and buffs stay on their recorded owner',f=>{
  for(const id of ['historical_summoning','zombie_legion','flesh_creation','lunar_blessing','devil_mutation','mystic_domain','deceive_impact','flesh_mutation','thunder_god_stance']){
    const r=nativeRow(id),benefits=r.timeline.filter(s=>['heal','shield'].includes(s.event.type)||s.event.beneficial===true);assert(benefits.length,id+' native benefit');
    for(const s of benefits){reset(f);outcome(f,r,s.event);assert.equal(art(f,id,'outcome').dataset.targetId,s.event.targetId,id);}
  }
});
test('no self utility art becomes an offensive hit or invented summon',f=>{
  for(const id of casterOnly){reset(f);outcome(f,row(id),event('damage','caster','enemy',{amount:15,damageType:'physical'}));assert.equal(art(f,id,'impact'),undefined,id);assert.equal(f.find('.gm-combat-revive'),null);}
  for(const id of ['historical_summoning','zombie_legion','flesh_creation']){
    reset(f);const before=JSON.stringify(f.map);cast(f,nativeRow(id));assert.equal(JSON.stringify(f.map),before,id+' no created unit');
  }
});
test('utility fallback rows retain basic attack art instead of inheriting the support PNG',f=>{
  const preview=native('historical_summoning'),rows=preview.groupedRounds.flatMap(g=>g.rows),basic=rows.find(r=>r.actorId==='preview_caster'&&r.abilityId==='basic_attack');assert(basic);
  cast(f,basic);assert.equal(f.find('.gm-combat-sequence3'),null);
});
test('misses, resists and zero support cannot invent successful authored results',f=>{
  for(const id of [...damaging,'strict_prohibition','underworld_domain','chaos_field','chaos_probability'])for(const type of ['miss','resist']){
    reset(f);outcome(f,row(id),event(type,'caster','enemy'));assert.equal(f.find('.gm-combat-sequence3'),null,id+' '+type);
  }
  for(const id of ['historical_summoning','zombie_legion','flesh_creation','lunar_blessing'])for(const type of ['heal','shield']){
    reset(f);outcome(f,row(id),event(type,'caster','caster',{amount:0}));assert.equal(f.find('.gm-combat-sequence3'),null,id+' zero '+type);
  }
});
test('periodic, reflected, reaction and foreign damage cannot borrow authored attack art',f=>{
  for(const extra of [{isDot:true},{isReflect:true},{isReaction:true},{actorId:'ally'}]){
    reset(f);outcome(f,row('energy_cannon'),event('damage','caster','enemy',{amount:20,...extra}));assert.equal(f.find('.gm-combat-sequence3'),null);
  }
});
test('foreign source metadata cannot borrow this cast’s authored cue',f=>{
  for(const e of [event('damage','caster','enemy',{amount:20,sourceAbilityId:'holy_sun_bolt'}),event('status','caster','caster',{beneficial:true,subtype:'buff',sourceAbilityId:'devil_mutation'})]){
    reset(f);outcome(f,row('energy_cannon'),e);assert.equal(f.find('.gm-combat-sequence3'),null);
  }
});
test('Error, Mother and Tyrant prepare wards without immediate offensive art',f=>{
  for(const id of ['deceive_impact','flesh_mutation','thunder_god_stance']){
    reset(f);cast(f,nativeRow(id));assert.equal(art(f,id).dataset.targetId,'preview_caster');
    assert.equal(f.find('.gm-combat-projectile, .gm-combat-sequence3[data-stage="impact"]'),null);
    assert(f.all('.gm-combat-sequence3').every(n=>n.dataset.flightPath==='stationary'));
  }
});
test('later reflections pulse each actual ward owner, never a guard-shaped projectile',f=>{
  for(const id of ['deceive_impact','flesh_mutation','thunder_god_stance']){
    reset(f);const e=event('damage','caster','enemy',{sourceAbilityId:id,isReflect:true,amount:30,hpLoss:30,damageType:'lightning'});
    outcome(f,row('basic_attack',[],'enemy','caster'),e);const n=art(f,id,'guard');assert(n,id);assert.equal(n.dataset.ownerId,'caster');assert.equal(n.dataset.targetId,'caster');
    assert.equal(n.dataset.flightPath,'stationary');assert.equal(f.all('.gm-combat-sequence3').some(n=>n.dataset.mode==='travel'),false);
  }
});
test('copied source IDs retain the authored art without mutating the copied record',f=>{
  for(const id of ['historical_summoning','energy_cannon','concealment_realm']){
    reset(f);const r=row(id);r.abilityId='combat_record';r.sourceAbilityId='record:'+id;const before=JSON.stringify(r);cast(f,r);assert(art(f,id));assert.equal(JSON.stringify(r),before);
  }
});
test('only selected Sequence 3 PNGs preload once, including Darkness secondary',f=>{
  f.preloads.length=0;f.effects.prepare([row('concealment_realm'),row('concealment_realm')]);
  assert.deepEqual(f.preloads.filter(src=>src.includes('/sequence3/')).sort(),[fx.sequence3Abilities.concealment_realm.asset,fx.sequence3Abilities.concealment_realm.secondaryAsset].sort());
});
test('stationary effects remain upright when actor and recipient sides swap',f=>{
  for(const id of ['strict_prohibition','dream_prison','historical_summoning','chaos_field']){
    reset(f);cast(f,row(id,[],'enemy','caster'));assert.equal(Number(art(f,id).dataset.angleDeg),0,id);
  }
});
test('pause, speed, clear and compact playback share the existing animation controller',f=>{
  cast(f,row('energy_cannon'));assert(art(f,'energy_cannon'));f.effects.pause();assert(active(f).every(a=>a.playState==='paused'));
  f.effects.setSpeed(2);f.effects.resume();assert(active(f).every(a=>a.playState==='running'));
  reset(f);assert.equal(f.find('.gm-combat-sequence3'),null);cast(f,row('energy_cannon'),4);assert(art(f,'energy_cannon'));assert.equal(active(f).length,0);
});
test('reduced motion retains stationary readable cues without travel transforms',f=>{
  f.w.matchMedia=()=>({matches:true});cast(f,row('energy_cannon'));const n=art(f,'energy_cannon');assert(n);
  for(const a of active(f).filter(a=>a.element===n))assert.equal(new Set(a.keyframes.filter(k=>k.transform).map(k=>k.transform)).size<=1,true);
});
test('offscreen participants never produce detached or misplaced Sequence 3 art',f=>{
  f.positions.caster=[100,2000];cast(f,row('energy_cannon'));assert.equal(f.find('.gm-combat-sequence3'),null);
});
test('all native casts and recorded outcomes leave definitions, state and rows unchanged',f=>{
  for(const id of Object.keys(ids)){
    reset(f);const r=nativeRow(id),before=JSON.stringify({r,fx,map:f.map});cast(f,r);for(const s of r.timeline)outcome(f,r,s.event);assert.equal(JSON.stringify({r,fx,map:f.map}),before,id);
  }
});
console.log(`Sequence 3 battle FX regressions: ${passed} passed, ${failed} failed.`);
if(failed)process.exitCode=1;
