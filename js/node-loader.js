// Node-only helper for tests. Mirrors the browser manifest bootstrap without fetch().
const fs=require('fs'),path=require('path');
const DATA_DIR=path.join(__dirname,'..','data');
const readJsonFile=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const readJson=name=>readJsonFile(path.join(DATA_DIR,name));
const manifest=readJson('pathways/index.json');
if(!Array.isArray(manifest.order)||manifest.order.length!==22)throw new Error('Invalid pathway manifest');
const pathwayDir=path.join(DATA_DIR,'pathways');
const diskPathways=fs.readdirSync(pathwayDir).filter(f=>f.endsWith('.json')&&f!=='index.json').map(f=>f.replace(/\.json$/,''));
const diskSet=new Set(diskPathways),orderSet=new Set(manifest.order);
if(diskPathways.length!==22||diskSet.size!==22)throw new Error('Pathway directory must contain exactly 22 pathway files');
for(const key of manifest.order){if(!diskSet.has(key))throw new Error(`Manifest pathway missing on disk: ${key}.json`);}
for(const key of diskPathways){if(!orderSet.has(key))throw new Error(`Pathway file not listed in manifest: ${key}.json`);}
const pathwayFiles={};
for(const key of manifest.order){const p=readJson(`pathways/${key}.json`);if(p.key!==key)throw new Error(`Pathway key mismatch for ${key}.json`);const seq=p.sequences?.map(x=>Number(x.sequence)).sort((a,b)=>b-a);if(!seq||seq.length!==10||seq.some((x,i)=>x!==9-i))throw new Error(`Invalid sequences in ${key}.json`);pathwayFiles[key]=p;}
for(const key of manifest.order){if(!Object.prototype.hasOwnProperty.call(manifest.counters,key))throw new Error(`Counter missing for ${key}`);if(!orderSet.has(manifest.counters[key]))throw new Error(`Counter target missing: ${manifest.counters[key]}`);}
if(Object.keys(manifest.counters).length!==22)throw new Error('Counters must contain 22 keys');
const balance=readJson('balance.json');
function runtimeAbility(a){const effects=Array.isArray(a.effects)?a.effects.filter(e=>e&&typeof e==='object'&&e.type):[];const damage=Number(a.scale||0)>0?{scaling:a.stat||'INT',multiplier:Number(a.scale)||0,type:a.damageType==='true'?'true':(['physical','elemental'].includes(a.damageType)?a.damageType:'elemental'),element:a.damageType&&!['physical','elemental','true'].includes(a.damageType)?a.damageType:null,formula:a.formula||'pure_caster_ability',components:effects.filter(e=>e.type==='damage_component').map(e=>({stat:e.stat,multiplier:Number(e.multiplier)||0})),elements:a.damageType&&!['physical','elemental','true'].includes(a.damageType)?[a.damageType]:[]}:null;return {type:a.kind||'passive',id:a.id,effectId:a.id,name:a.name,text:a.description||'',costSP:Number(a.spCost)||0,cooldown:Number(a.cooldown)||0,tag:a.tag??null,damage,effects};}

const paths={},meters={},archetype={},introductions={},definitions={},sequence_names={};
for(const key of manifest.order){const p=pathwayFiles[key],seqs=p.sequences.map(t=>{const a=runtimeAbility(t.ability);return {sequence:t.sequence,name:t.name,ability:a.text,abilityText:a.text,type:a.type,effectId:a.effectId,abilities:[a],cost:balance.pathway_advancement_costs?.[key]?.[String(t.sequence)]||{funds:0,material:0},abilityType:t.ability.label||a.type};});paths[key]={name:p.name,material:p.material,special:p.meter?.name||'Special',specialMax:p.meter?.max??100,characteristic:p.archetype,role:p.role,quirkName:p.meter?.name||'Special',quirkText:p.intro,sequences:seqs,group:p.group,archetype:p.archetype,mythicalForm:p.mythicalForm,survival:p.survival};meters[key]=p.meter||{};archetype[key]=p.archetype;introductions[key]=p.intro;sequence_names[key]=Object.fromEntries(seqs.map(t=>[String(t.sequence),t.name]));definitions[p.name]={group:p.group,archetype:p.archetype,mythical_creature_form:p.mythicalForm,survival_mechanics:p.survival,abilities:seqs.map(t=>({sequence:t.sequence,name:t.name,type:t.abilityType,sp_cost:t.abilities[0].costSP,cooldown:t.abilities[0].cooldown,description:t.abilityText}))};}
const pathways={version:'v17.0',paths,path_keys:manifest.order.slice(),counters:manifest.counters,meters,archetype,sequence_names,extras:{},definitions,introductions};
const enemies=readJson('enemies.json'),contracts=readJson('contracts.json');
const system={...(balance.system||{}),contracts:contracts.system||{},enemy_names:enemies.enemy_names||[],combat:balance.system?.combat||'json-driven-elemental-pipeline'};
const characters={FIRST:enemies.FIRST||enemies.human_enemy_names?.first||[],LAST:enemies.LAST||enemies.human_enemy_names?.last||[],TRAITS:enemies.TRAITS||{},TRAIT_NAMES:enemies.TRAIT_NAMES||[],OCCUPATIONS:enemies.OCCUPATIONS||enemies.human_enemy_occupations||[]};
const G9_DATA={pathways,formulas:readJson('formulas.json'),balance,items:readJson('items.json'),enemies,characters,contracts,campaign:readJson('campaign.json'),system};
const files=['paths.js','v15.js','generate.js','signatures.js','mythical.js','engine.js','state.js','campaign.js','exports.js'];
const src=files.map(f=>fs.readFileSync(path.join(__dirname,f),'utf8')).join('\n');
const m={exports:{}};
new Function('module','exports','require','G9_DATA',src)(m,m.exports,require,G9_DATA);
module.exports=m.exports;
