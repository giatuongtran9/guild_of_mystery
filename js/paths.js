// ===== paths.js =====
// Runtime game data is loaded from /data/*.json before this file is executed.
// This file contains gameplay helpers only; no balance/content tables live here.
const G9D = G9_DATA;
const V15_DATA = {
  system_version: G9D.system.version,
  damage_formulas: G9D.formulas.damage_formulas,
  mythical_creature_form_rules: G9D.formulas.mythical_creature_form_rules,
  archetype_stat_progression: G9D.balance.archetype_stat_progression,
  pathways: G9D.pathways.definitions
};
const BASE_STAT_PROFILES = G9D.balance.base_stat_profiles;
const PATH_GROWTH = G9D.balance.path_growth;
const STAT_TABLE = G9D.balance.stat_table;
const PATH_ARCHETYPE = G9D.balance.path_archetype;
const WEAPONS = G9D.items.weapons;
const PATHS = G9D.pathways.paths;
const PATH_KEYS = G9D.pathways.path_keys.slice();
const PATH_COUNTERS = G9D.pathways.counters;
const PATH_METERS = G9D.pathways.meters;

function archetypeOf(path){ return PATH_ARCHETYPE[path] || 'Caster'; }
function tableStats(path, sequence=9){
  const seqKey=Math.max(0,Math.min(9,sequence));
  const row=STAT_TABLE[seqKey][archetypeOf(path)];
  return {hp:row[0],atk:row[1],def:row[2],int:row[3],spd:row[4]};
}
function humanScaled(h){ return {hp:h.hp*12,atk:h.atk*4,def:h.def*3,int:h.int*3}; }
function baseStatsFor(path, sequence=9, rng=Math.random){
  const p=BASE_STAT_PROFILES[path]||BASE_STAT_PROFILES.fool, jitter=()=>0.97+rng()*0.06;
  return {hp:Math.max(8,Math.round(100*p.hp*jitter())),atk:Math.max(5,Math.round(15*p.atk*jitter())),def:Math.max(5,Math.round(12*p.def*jitter())),int:Math.max(5,Math.round(15*p.int*jitter()))};
}
function rollVariance(rng=Math.random){return {hp:.90+rng()*.20,atk:.90+rng()*.20,def:.90+rng()*.20,int:.90+rng()*.20,speed:.90+rng()*.20};}
function statsFromVariance(agent,path,sequence=9){
  const base=tableStats(path,sequence),t=TRAITS[agent.trait]||TRAITS["Stout Vitality"],v=agent.statVariance||{hp:1,atk:1,def:1,int:1,speed:1};
  const stats={hp:Math.max(8,Math.round(base.hp*v.hp*(t.hp_mult||1))),atk:Math.max(5,Math.round(base.atk*v.atk*(t.atk_mult||1))),def:Math.max(5,Math.round(base.def*v.def*(t.def_mult||1))),int:Math.max(5,Math.round(base.int*v.int*(t.int_mult||1)))};
  if(agent.recommendedPath===path){
    const dominantInt=['visionary','hermit','door','fool'].includes(path),dominantBody=['twilight_giant','tyrant','red_priest'].includes(path);
    if(dominantBody)stats.atk=Math.round(stats.atk*1.07); else if(dominantInt)stats.int=Math.round(stats.int*1.07); else stats.atk=Math.round(stats.atk*1.07);
  }
  return stats;
}
function awakenStats(agent,path,rng=Math.random){const variance=rollVariance(rng);agent.statVariance=variance;agent.speedVariance=variance.speed;agent.basePathSpeed=basePathSpeed(path,9);return statsFromVariance(agent,path,9);}
function statRatio(path,fromSeq,toSeq){const a=tableStats(path,fromSeq),b=tableStats(path,toSeq);return {hp:b.hp/a.hp,atk:b.atk/a.atk,def:b.def/a.def,int:b.int/a.int};}
function advanceStats(stats,path,newSeq){const r=statRatio(path,newSeq+1,newSeq);return Object.fromEntries(Object.entries(stats).map(([k,v])=>[k,Math.round(v*(r[k]||1))]));}
function statsAtSequence(baseStats,sequence,path=null){if(!path)return {...baseStats};const r=statRatio(path,9,sequence);return Object.fromEntries(Object.entries(baseStats).map(([k,v])=>[k,Math.max(1,Math.round(v*(r[k]||1)))]));}
function getMeterValue(agent,path){const cfg=PATH_METERS[path]||PATH_METERS.fool;return Number(agent[cfg.key]||0);}
function setMeterValue(agent,path,v){const cfg=PATH_METERS[path]||PATH_METERS.fool;agent[cfg.key]=Math.max(0,Math.min(cfg.max,Number(v)||0));}
function changeMeter(agent,path,delta){const cfg=PATH_METERS[path]||PATH_METERS.fool;const v=Math.max(0,Math.min(cfg.max,getMeterValue(agent,path)+delta));setMeterValue(agent,path,v);return v;}
function specialStatFor(path,sequence,agent={}){
  if(path==='door')return {name:'Records',value:agent.recorded?.length||0,max:sequence<=5?4:1,gain:'Recording enemy abilities',spend:'Recorded powers'};
  if(path==='fool')return {name:'Thread Control',value:agent.activeThreads??0,max:threadSlots(sequence),gain:'Thread control',spend:'Marionettes and threads'};
  const meter=PATH_METERS[path]; if(meter)return {name:meter.name,value:getMeterValue(agent,path),max:meter.max,gain:meter.gain,spend:meter.spend,full:meter.full};
  return {name:'Special',value:0,max:100,gain:'',spend:''};
}
function threadSlots(sequence){if(sequence>5)return 0;return ({5:1,4:1,3:2,2:2,1:3,0:4})[sequence]||0;}
function threadRange(sequence){return ({5:16,4:24,3:35,2:50,1:80,0:120})[sequence]||16;}
function masteryKey(kind){return kind==='firearm'?'gun':kind==='blade'||kind==='blunt'?'weapon':kind;}
function weaponMasteryValue(agent,kind){return Math.max(0,Math.min(10,Number(agent.weaponMastery?.[masteryKey(kind)]||0)));}
function weaponStats(agent){const w=weaponFor(agent),m=weaponMasteryValue(agent,w.kind),isGun=w.kind==='gun',isUnarmed=w.kind==='unarmed';return {...w,mastery:m,masteryDamage:isUnarmed?1:(1+m*.03),masteryMiss:isGun?Math.max(0,.50-m*.05):0};}
function gainWeaponMastery(agent,kind,amount=1){if(!agent.weaponMastery)agent.weaponMastery={};const k=masteryKey(kind);agent.weaponMastery[k]=Math.min(10,(agent.weaponMastery[k]||0)+amount);}
function abilitySpec(path,sequence,text){const tier=tierFor(path,sequence),a=tier?.abilities?.[0];return {type:a?.type||'passive',effectId:a?.effectId||a?.id||`${path}_${sequence}`,text:text||a?.text||tier?.abilityText||'',effects:a?.effects||[]};}
function abilityDetail(t){return t.ability||'';}
function modifierText(m){const labels={atk:'ATK',def:'DEF',int:'INT',hp:'HP',crit:'Crit',damageTaken:'Damage Taken',initiative:'Initiative'};return Object.entries(m||{}).map(([k,v])=>`${labels[k]||k} ${v<0?'-':'+'}${Math.abs(v*100).toFixed(1)}%`).join(' · ');}
function normalizeAbilities(){
  for(const [path,p] of Object.entries(PATHS)) for(const t of p.sequences){
    t.abilityText=t.abilityText||t.ability; t.type=t.type||'passive'; t.effectId=t.effectId||`${path}_${t.sequence}`;
    t.abilities=(t.abilities||[]).map(a=>({
      type:a.type||'passive', effectId:a.id||a.effectId||t.effectId, name:a.name||String(a.text||t.abilityText).split(/\s(?:—|--)\s/)[0], text:a.text||t.abilityText,
      costSP:Number(a.costSP||0), cooldown:Number(a.cooldown||0), tag:a.tag||null,
      damage:a.damage||null, effects:Array.isArray(a.effects)?a.effects:[]
    }));
  }
}

function weaponFor(agent){return WEAPONS[agent.weaponId]||WEAPONS.none;}
function unlockedTiers(agent){if(!agent?.awakened||agent.sequence>9)return [];return pathOf(agent.path).sequences.filter(t=>t.sequence>=agent.sequence);}
function unlockedAbilities(agent){return unlockedTiers(agent).flatMap(t=>t.abilities||[{type:t.type,effectId:t.effectId,text:t.abilityText||t.ability}]);}
function hasActiveAbility(agent){return unlockedAbilities(agent).some(x=>x.type==='active');}
const combatSeq=(names,specs)=>names.map((name,i)=>({sequence:9-i,name,ability:specs[i].text,abilityText:specs[i].text,type:specs[i].type,effectId:specs[i].id,abilities:[{type:specs[i].type,id:specs[i].id,text:specs[i].text,costSP:specs[i].sp||0,cooldown:specs[i].cd||0,damage:specs[i].scale?{scaling:specs[i].stat||'INT',multiplier:specs[i].scale,type:(specs[i].damageType||'Physical').toLowerCase()==='true'?'true':'physical',element:(specs[i].damageType||'Physical')}:null,effects:[]}],cost:{funds:Math.round(120*Math.pow(1.38,i)),material:i===0?0:(i<=2?1:2)}}));
const A=(type,id,text,sp=0,cd=0,scale=0,stat='INT',damageType='Physical',tag=null,modifier={})=>({type,id,text,sp,cd,scale,stat,damageType,tag,modifier});
function pathOf(p){return PATHS[p];}
function tierFor(p,s){const x=pathOf(p);return x?.sequences?.find(t=>t.sequence===s)||{sequence:s,name:`Sequence ${s}`,ability:'',abilities:[]};}
function nextTier(p,s){return tierFor(p,s-1);}

function pathMatchup(attacker,defender){if(!attacker||!defender||attacker===defender)return 'even';if(PATH_COUNTERS[attacker]===defender)return 'favored';if(PATH_COUNTERS[defender]===attacker)return 'disfavored';return 'even';}
function authorityTier(sequence){if(sequence>=5)return 'Beyonder';if(sequence===4)return 'Demigod / Saint';if(sequence===3)return 'Angel';if(sequence===2)return 'High Angel';if(sequence===1)return 'Archangel / King';return 'Deity';}
function authorityGap(attackerSeq,defenderSeq){if(attackerSeq===defenderSeq)return 'even';if(attackerSeq<=4&&defenderSeq>attackerSeq)return 'dominated';const gap=defenderSeq-attackerSeq;if(gap>=3)return 'overwhelmed';if(gap>=1)return 'favored';if(gap<=-3)return 'outclassed';return 'disadvantaged';}
