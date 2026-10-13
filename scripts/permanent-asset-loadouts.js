'use strict';
// Reproducible representative legal collections for diagnostics, not acquisition rewards.
// Door uses one recorded attack at Sequence 6 and three from Sequence 5; Hanged Man prepares five powers.
module.exports=(g,a,tier='rare')=>{
 const balance=require('../data/balance.json'),c=g.pathwayCollection(a);if(!c)return;
 const inv=g.ensurePathwayInventory(a);inv.policy='auto';let serial=0;
 const add=fields=>{const asset={id:`benchmark_${a.id}_${serial++}`,ownerId:a.id,kind:c.kind,sequence:a.sequence,condition:'ready',sourceContract:'Balance fixture',...fields};inv.assets.push(asset);if(inv.prepared.length<g.pathwayPreparationLimit(a)&&g.pathwayAssetUsable(a,asset))inv.prepared.push(asset.id);};
 if(['device','beast'].includes(c.kind))add({definitionId:g.pathwayLootDefinition(c.kind,tier),hpRatio:1});
 if(c.kind==='spirit')add({definitionId:'soul_reaper',hpRatio:1});
 if(c.kind==='formula')add({definitionId:'blood_inscription'});
 if(c.kind==='doctrine')add({definitionId:'channeling_thesis'});
 if(c.kind==='conditioning')add({definitionId:'aggression_pattern'});
 if(c.kind==='marionette'&&a.sequence<=5){const raw=g.statsFromVariance({trait:'Stout Vitality',statVariance:{hp:1,atk:1,def:1,int:1,speed:1}},'tyrant',a.sequence),budget=balance.contract_encounters.enemy_stat_multiplier_by_sequence[a.sequence];for(let i=0;i<g.threadSlots(a.sequence);i++)add({sourcePath:'tyrant',sourceName:'Retained Sailor '+i,hpRatio:1,profile:{path:'tyrant',sequence:a.sequence,name:'Retained Sailor '+i,trait:'Stout Vitality',stats:Object.fromEntries(['hp','atk','def','int'].map(k=>[k,Math.max(1,Math.round(raw[k]*budget*.55))])),speedVariance:1}});}
 const candidates=[['tyrant',8,'raging_blow'],['hermit',8,'mystic_spell'],['hanged_man',7,'flesh_healing'],['white_tower',9,'combat_analysis'],['moon',9,'healing_touch'],['darkness',9,'nocturnal_vigor']];
 if(['record','soul'].includes(c.kind)&&a.sequence<=c.unlock){for(const [p,sequence,id]of candidates){const spec=g.pathOf(p).sequences.find(t=>t.sequence===sequence)?.abilities.find(s=>s.effectId===id);if(!spec||sequence<a.sequence)continue;if(c.kind==='record'&&(spec.type!=='active'||g.abilityEffects(spec).some(e=>e.type==='signature')))continue;if(c.kind==='soul'&&!g.soulAbilityEligible(spec))continue;add({sourcePath:p,sequence,abilityId:id,sourceId:'fixture_'+p,sourceName:g.pathOf(p).name});if(inv.assets.length===g.pathwayAssetCapacity(a))break;}}
};
