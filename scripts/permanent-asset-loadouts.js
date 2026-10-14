'use strict';
const assert = require('node:assert/strict');
const collectionCache = new WeakMap();

// Experienced, prepared characters for diagnostics. These inventories are
// never granted to saves. Selection uses legal current powers, not duel results.
function abilityCandidates(g, agent, kind) {
 return g.PATH_KEYS.filter(p=>p!==agent.path).flatMap(sourcePath=>g.pathOf(sourcePath).sequences
  .filter(t=>t.sequence>=agent.sequence).flatMap(t=>t.abilities.map(spec=>({sourcePath,sequence:t.sequence,spec}))))
  .filter(({spec})=>kind==='soul'?g.soulAbilityEligible(spec)
   :spec.type==='active'&&!g.abilityEffects(spec).some(e=>e.type==='signature'));
}
function balancedAbilities(g,agent,kind,capacity) {
 const cache=collectionCache.get(g)||new Map();collectionCache.set(g,cache);
 const cacheKey=JSON.stringify([agent.path,agent.sequence,kind,capacity,agent.stats]);
 if(cache.has(cacheKey))return cache.get(cacheKey);
 const pool=abilityCandidates(g,agent,kind),selected=[];
 const score=(candidate,key)=>{
  const s=candidate.spec,effects=g.abilityEffects(s),st=agent.stats;
  if(key==='attack') {
   if(!s.damage)return 0;
   const damage=g.v15Damage(s.damage.formula||'pure_caster_ability',{
    agent,actor:null,target:{stats:{def:0},sequence:agent.sequence,path:agent.path},
    abilityMult:s.damage.multiplier,damageSpec:s.damage,trueDamage:s.damage.type==='true'});
   const control=effects.reduce((n,e)=>n+(['status','status_chance'].includes(e.type)
    &&['stunned','freeze','frozen','sleep','bound','silenced','polymorphed'].includes(e.status)?Number(e.chance??1):0),0);
   return damage/Math.max(st.atk,st.int)+control*.8+(effects.some(e=>e.type==='strip_buffs')?.4:0);
  }
  if(key==='heal')return effects.filter(e=>e.type==='heal').reduce((n,e)=>n+Number(e.maxHpRatio||0)
   +Number(e.multiplier||0)*(String(e.scaling).toUpperCase()==='ATK'?st.atk:st.int)/st.hp,0);
  let amount=0;
  for(const e of effects){
   if(key==='defense'){
    if(e.type==='shield')amount+=Number(e.maxHpRatio||0);
    if(['damage_taken','damageTaken'].includes(e.type))amount+=Math.max(0,-Number(e.amount||0))*(e.incomingCategory?.5:1);
    if(e.type==='dodge')amount+=Number(e.amount||0);
    if(e.type==='stat_modifier'&&['hp','def'].includes(e.stat))amount+=Number(e.amount||0)*.6;
    if(e.type==='lifesteal')amount+=Number(e.ratio||0)*.6;
    if(e.type==='status'&&['untargetable','possession_phase','evade'].includes(e.status))amount+=.25;
    if(e.type==='reflect'&&e.negate)amount+=.25;
   }
   if(key==='offense'){
    if(e.type==='stat_modifier'&&['atk','int'].includes(e.stat))amount+=Number(e.amount||0)*st[e.stat]/Math.max(st.atk,st.int);
    if(['hitChance','crit','defPen','defense_penetration','spell_penetration'].includes(e.type))amount+=Number(e.amount||0)*.5;
   }
  }
  return amount;
 };
 const add=(key,predicate=()=>true)=>{
  const next=pool.filter(c=>!selected.includes(c)&&predicate(c)&&score(c,key)>0)
   .sort((a,b)=>score(b,key)-score(a,key)||a.sequence-b.sequence||a.spec.effectId.localeCompare(b.spec.effectId))[0];
  if(next&&selected.length<capacity)selected.push(next);
 };
 add('attack',c=>c.spec.type==='active');
 if(capacity>1)add('heal',c=>c.spec.type==='active');
 if(kind==='soul'){
  add('defense',c=>c.spec.type==='passive');
  add('offense',c=>c.spec.type==='passive');
  add('defense',c=>c.spec.type==='active'&&!c.spec.damage);
 }else{
  add('defense',c=>c.spec.type==='active'&&!c.spec.damage);
  add('attack',c=>c.spec.type==='active');
 }
 while(selected.length<capacity){const before=selected.length;add('attack',c=>c.spec.type==='active');if(selected.length===before)break;}
 cache.set(cacheKey,selected);return selected;
}
module.exports=(g,a,tier='rare',opts={})=>{
 const c=g.pathwayCollection(a);if(!c||a.sequence>c.unlock)return;
 const inv=g.ensurePathwayInventory(a),fixture=opts.fixture||'balanced';inv.policy='auto';let serial=0;
 assert(['balanced','legacy'].includes(fixture),'Unknown collection fixture: '+fixture);
 assert(['normal','rare','epic','legendary'].includes(tier),'Unknown collection rarity: '+tier);
 const acquiredSequence=Math.min(9,a.sequence+Math.max(0,Math.floor(Number(opts.assetAge||0))));
 const add=fields=>{
  const asset={id:`benchmark_${a.id}_${serial++}`,ownerId:a.id,kind:c.kind,sequence:acquiredSequence,
   condition:'ready',sourceContract:'Balance fixture',...fields};
  assert(inv.assets.length<g.pathwayAssetCapacity(a),'Fixture exceeds storage capacity.');
  assert(g.pathwayAssetUsable(a,asset),'Fixture contains a sealed or future-Sequence asset.');
  inv.assets.push(asset);if(inv.prepared.length<g.pathwayPreparationLimit(a))inv.prepared.push(asset.id);
 };
 if(['device','beast'].includes(c.kind))add({definitionId:g.pathwayLootDefinition(c.kind,tier),hpRatio:1});
 if(c.kind==='spirit')add({definitionId:'soul_reaper',hpRatio:1});
 if(c.kind==='formula')add({definitionId:fixture==='legacy'?'blood_inscription':'thorn_tale',sequence:c.unlock});
 if(c.kind==='doctrine')add({definitionId:'channeling_thesis',sequence:c.unlock});
 if(c.kind==='conditioning')add({definitionId:'aggression_pattern',sequence:c.unlock});
 if(c.kind==='marionette'){
  // Hold captured inputs fixed while contracts are retuned. This is a
  // same-Sequence character's base body, retained at the existing 55% rule.
  const raw=g.tableStats('tyrant',acquiredSequence);
  for(let i=0;i<g.threadSlots(a.sequence);i++)add({sourcePath:'tyrant',sourceName:'Retained Sailor '+i,hpRatio:1,
   profile:{path:'tyrant',sequence:acquiredSequence,name:'Retained Sailor '+i,trait:'Stout Vitality',
    stats:Object.fromEntries(['hp','atk','def','int'].map(k=>[k,Math.max(1,Math.round(raw[k]*.55))])),speedVariance:1},
   captureProvenance:'Unmodified same-Sequence Tyrant base body; existing 55% retention; independent of contract difficulty.'});
 }
 if(['record','soul'].includes(c.kind)){
  let candidates;
  if(fixture==='balanced')candidates=balancedAbilities(g,a,c.kind,g.pathwayAssetCapacity(a));
  else candidates=[['tyrant',8,'raging_blow'],['hermit',8,'mystic_spell'],['hanged_man',7,'flesh_healing'],
   ['white_tower',9,'combat_analysis'],['moon',9,'healing_touch'],['darkness',9,'nocturnal_vigor']]
   .flatMap(([sourcePath,sequence,id])=>{
    const spec=g.pathOf(sourcePath).sequences.find(t=>t.sequence===sequence)?.abilities.find(s=>s.effectId===id);
    if(!spec||sequence<a.sequence||(c.kind==='record'
     ?spec.type!=='active'||g.abilityEffects(spec).some(e=>e.type==='signature'):!g.soulAbilityEligible(spec)))return [];
    return [{sourcePath,sequence,spec}];
   }).slice(0,g.pathwayAssetCapacity(a));
  for(const candidate of candidates)add({sourcePath:candidate.sourcePath,sequence:candidate.sequence,
   abilityId:candidate.spec.effectId||candidate.spec.id,sourceId:'fixture_'+candidate.sourcePath,sourceName:g.pathOf(candidate.sourcePath).name});
 }
};
module.exports.abilityCandidates=abilityCandidates;
module.exports.balancedAbilities=balancedAbilities;
