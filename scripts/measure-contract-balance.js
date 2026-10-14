'use strict';
// Real matching-Sequence encounters: fixture heroes do not depend on NPC tuning.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const h=require('./combat-benchmark-helpers'),g=require('../js/node-loader');
const opts=h.options(),samples=Number(opts.samples||100),sequences=h.sequences(opts.sequences);
const strengths=(opts.strengths||'live').split(','),weapon=opts.weapon||'rare_sword',assets=opts.assets||'rare';
const roundLimit=Number(opts.rounds||50),seedBase=Number(opts.seed||710019),variants=opts.variants||'live';
const pathways=opts.focus?opts.focus.split(','):g.PATH_KEYS,fixture=opts['collection-fixture']||'balanced';
const output=path.resolve(opts.output||'reports/progression-review/solo-contracts.json');
assert(Number.isInteger(samples)&&samples>0,'Samples must be a positive integer.');
assert(Number.isInteger(roundLimit)&&roundLimit>0&&roundLimit<=50,'Safety limit must be 1–50 rounds.');
assert(pathways.length&&pathways.every(p=>g.PATH_KEYS.includes(p)),'Unknown focus pathway.');
assert(['live','none'].includes(variants),'Variants must be live or none.');
assert(strengths.every(s=>s==='live'||Number.isFinite(Number(s))&&Number(s)>0),'Strengths must be live or positive multipliers.');
const profileInput=opts.profile?path.resolve(opts.profile):null,profileText=profileInput?fs.readFileSync(profileInput,'utf8'):null;
const mergeProfile=(target,source)=>{for(const [key,value]of Object.entries(source)){if(value&&typeof value==='object'&&!Array.isArray(value)){if(!target[key]||typeof target[key]!=='object'||Array.isArray(target[key]))target[key]={};mergeProfile(target[key],value);}else target[key]=value;}};
if(profileText)mergeProfile(g.GLOBAL_COMBAT,JSON.parse(profileText));
const profileMethod=profileText?{path:profileInput,sha256:crypto.createHash('sha256').update(profileText).digest('hex'),application:'In-memory nested merge of GLOBAL_COMBAT only; source data and saved character stats are unchanged.'}:null;
const encounterProfileInput=opts['encounter-profile']?path.resolve(opts['encounter-profile']):null;
const encounterProfileText=encounterProfileInput?fs.readFileSync(encounterProfileInput,'utf8'):null;
if(encounterProfileText){
 const parsed=JSON.parse(encounterProfileText),keys=Object.keys(parsed),multipliers=parsed.enemy_stat_multiplier_by_sequence||parsed.contract_encounters?.enemy_stat_multiplier_by_sequence||(keys.length&&keys.every(key=>/^[0-9]$/.test(key))?parsed:null);
 assert(multipliers&&typeof multipliers==='object','Encounter profile must contain enemy_stat_multiplier_by_sequence.');
 for(const [sequence,value]of Object.entries(multipliers)){
  assert(Number.isInteger(Number(sequence))&&Number(sequence)>=0&&Number(sequence)<=9&&Number.isFinite(value)&&value>0,'Invalid NPC multiplier at Sequence '+sequence);
  g.CONTRACT_ENCOUNTERS.enemy_stat_multiplier_by_sequence[sequence]=value;
 }
}
const encounterProfileMethod=encounterProfileText?{path:encounterProfileInput,sha256:crypto.createHash('sha256').update(encounterProfileText).digest('hex'),application:'In-memory merge of live contract NPC strength only; repository data and captured hero fixtures are unchanged.'}:null;
const heroOpts={assets,weapon,collectionFixture:fixture,assetAge:Number(opts['asset-age']||0),charge:Number(opts.charge||0)};
const sourceFingerprint=crypto.createHash('sha256');
for(const file of ['data/balance.json','data/contracts.json','data/formulas.json','data/items.json','data/traits.json','data/permanent-assets.json',
 ...g.PATH_KEYS.map(p=>'data/pathways/'+p+'.json'),'js/paths.js','js/v15.js','js/engine.js','js/signatures.js','js/pathway-assets.js',
 'js/battle-ai.js','js/mythical.js','js/generate.js','js/state.js','js/traits.js','js/node-loader.js','scripts/combat-benchmark-helpers.js','scripts/permanent-asset-loadouts.js','scripts/measure-contract-balance.js']){
 const absolute=path.join(__dirname,'..',file);if(fs.existsSync(absolute)){sourceFingerprint.update(file);sourceFingerprint.update(fs.readFileSync(absolute));}
}
const results=[],records=[],loadouts=[],started=Date.now();let battles=0,errorCount=0;
const percentile=(values,fraction)=>values.length?[...values].sort((a,b)=>a-b)[Math.min(values.length-1,Math.floor(values.length*fraction))]:null;
const interval=(wins,count)=>{if(!count)return null;const z=1.959964,z2=z*z,p=wins/count,d=1+z2/count,c=(p+z2/(2*count))/d,m=z*Math.sqrt(p*(1-p)/count+z2/(4*count*count))/d;return [Math.max(0,c-m),Math.min(1,c+m)];};
const finish=row=>{
 const count=row.completedSamples;
 return Object.assign(row,{winRate:count?row.wins/count:null,winRate95CI:interval(row.wins,count),timeoutRate:count?row.timeouts/count:null,
  casualtyRate:count?row.casualties/count:null,retreatRate:count?row.retreats/count:null,
  retreatSuccessRate:row.retreatAttempts?row.retreats/row.retreatAttempts:null,
  meanRounds:count?row.rounds/count:null,p90Rounds:percentile(row.observedRounds,.9),
  meanSurvivorInjuries:row.returnedAgents?row.totalInjuries/row.returnedAgents:null,
  meanTreatmentFundsPerAttempt:count?row.treatmentFunds/count:null,
  meanTreatmentMaterialsPerAttempt:count?row.treatmentMaterials/count:null,
  meetsClearTarget:count>0&&row.wins/count>=.85&&row.wins/count<=.9});
};
for(const strength of strengths)for(const sequence of sequences){
 const rows=[];
 for(const pathway of pathways){
  const index=g.PATH_KEYS.indexOf(pathway),row={pathway,sequence,samples,completedSamples:0,wins:0,timeouts:0,deaths:0,casualties:0,
   retreatAttempts:0,retreats:0,rounds:0,observedRounds:[],returnedAgents:0,totalInjuries:0,maxInjuries:0,
   retreatInjury99:0,treatmentFunds:0,treatmentMaterials:0,errors:[],encounters:{}};
  for(let sample=0;sample<samples;sample++){
   // All hero pathways face the same NPC body, trait, definition and variant
   // per sample. Battle rolls differ by pathway; opponent paths cycle evenly.
   const encounterSeed=seedBase+sequence*100003+sample*997,battleSeed=encounterSeed+index*1009+11939;
   const a=h.preparedHero(g,pathway,sequence,'solo_agent',heroOpts);
   if(sample===0)loadouts.push({pathway,sequence,weapon:a.weaponId,
    assets:g.preparedPathwayAssets(a).map(asset=>({kind:asset.kind,sourcePath:asset.sourcePath,sequence:asset.sequence,
     abilityId:asset.abilityId,definitionId:asset.definitionId,capturedProfile:asset.kind==='marionette'?asset.profile:undefined}))});
   const quest={id:'solo_verification',name:'Solo contract verification',kind:'contract',difficultySequence:sequence,
    objective:'combat',encounter:true,roundLimit,rewards:{funds:200,reputation:3,materials:{}},dayCost:0};
   const definitions=g.CONTRACT_POOL.definitions.filter(d=>d.sequence===sequence);
   assert(definitions.length,'No live contracts at Sequence '+sequence);
   const definition=definitions[sample%definitions.length];
   quest.poolDefinitionId=definition.id;quest.enemySeed=encounterSeed+19319;
   quest.enemyPath=g.PATH_KEYS[(sample+sequence*3)%g.PATH_KEYS.length];
   if(variants==='live')quest.encounterVariant=g.contractEncounterVariant(definition.id,h.seeded(encounterSeed+33179));
   const encounterKey=definition.id+':'+(quest.encounterVariant?.id||'none');
   const encounter=row.encounters[encounterKey]||={definitionId:definition.id,variantId:quest.encounterVariant?.id||null,
    name:quest.encounterVariant?.name||definition.name,samples:0,wins:0,timeouts:0,casualties:0};
   const decisions={individual:true,day:1};
   if(strength!=='live'){
    const foe=g.makeEnemy(sequence,h.seeded(quest.enemySeed),0,quest.enemyPath);
    decisions.authoredOpponents=[{name:'Contract adversary',path:foe.path,sequence,trait:foe.trait,
     stats:Object.fromEntries(Object.entries(foe._originalStats).map(([k,v])=>[k,Math.max(1,Math.round(v*Number(strength)))])),sp:0}];
   }
   try{
    const result=g.resolveQuest([a],quest,battleSeed,decisions),lossIds=new Set(result.consequences
     .filter(c=>['death','corruptedDeath'].includes(c.type)&&c.agentId===a.id).map(c=>c.agentId));
    const rounds=Math.max(0,...result.events.map(e=>e.round||0)),retreat=result.retreat;
    assert(rounds<=roundLimit,'Contract exceeded its safety limit.');
    assert.equal(result.events.filter(e=>e.subtype==='retreat').length,Number(retreat?.success),'Successful defeated-party retreat must emit exactly one event.');
    row.completedSamples++;row.wins+=Number(result.success);row.timeouts+=Number(result.battleOutcome==='timeout');
    row.deaths+=lossIds.size;row.casualties+=Number(lossIds.size>0);row.retreatAttempts+=Number(retreat?.attempted);
    row.retreats+=Number(retreat?.success);row.rounds+=rounds;row.observedRounds.push(rounds);battles++;
    const report=result.rosterReport.find(r=>r.id===a.id);
    if(report?.survived){
     const injury=Number(report.injuries||0),cost=injury>0?g.healCost({injuries:injury}):{funds:0,material:0};
     row.returnedAgents++;row.totalInjuries+=injury;row.maxInjuries=Math.max(row.maxInjuries,injury);
     row.treatmentFunds+=cost.funds;row.treatmentMaterials+=cost.material;
     if(retreat?.success){assert.equal(injury,99,'A successful retreat must return the owner at 99 injuries.');row.retreatInjury99++;}
    }
    encounter.samples++;encounter.wins+=Number(result.success);encounter.timeouts+=Number(result.battleOutcome==='timeout');encounter.casualties+=Number(lossIds.size>0);
    if(opts.details==='true')records.push({strength,pathway,sequence,sample,battleSeed,encounterSeed,enemyPath:quest.enemyPath,
     definitionId:definition.id,variant:quest.encounterVariant?.id||null,success:result.success,outcome:result.battleOutcome,
     rounds,retreat:result.retreat,deaths:[...lossIds],roster:result.rosterReport.filter(r=>r.id===a.id),
     feedback:result.events.filter(e=>['encounter_variant','retreat'].includes(e.subtype)).map(e=>e.text)});
   }catch(error){errorCount++;row.errors.push({sample,battleSeed,message:error.message});}
  }
  row.encounters=Object.values(row.encounters).map(e=>({...e,winRate:e.samples?e.wins/e.samples:null}));
  rows.push(finish(row));
 }
 const count=rows.reduce((sum,r)=>sum+r.completedSamples,0),wins=rows.reduce((sum,r)=>sum+r.wins,0);
 results.push({strength,sequence,samples:count,wins,winRate:wins/Math.max(1,count),rows});
 console.log(JSON.stringify({strength,sequence,meanWinRate:wins/Math.max(1,count),cohortsWithinTarget:rows.filter(r=>r.meetsClearTarget).length,
  below85:rows.filter(r=>r.winRate<.85).map(r=>[r.pathway,r.winRate,r.timeouts]),above90:rows.filter(r=>r.winRate>.9).map(r=>[r.pathway,r.winRate]),
  timeouts:rows.reduce((n,r)=>n+r.timeouts,0),casualties:rows.reduce((n,r)=>n+r.casualties,0),battles,errors:errorCount,
  elapsedSeconds:Math.round((Date.now()-started)/1000)}));
}
const allRows=results.flatMap(r=>r.rows),totalWins=allRows.reduce((n,r)=>n+r.wins,0);
const report={rules:g.GLOBAL_COMBAT,encounterRules:g.CONTRACT_ENCOUNTERS,method:{profile:profileMethod,encounterProfile:encounterProfileMethod,samples,sequences,pathways,strengths,assets,collectionFixture:fixture,
 collectionFixtureVersion:2,assetAge:heroOpts.assetAge,variants,weapon,startingSP:'full',charge:heroOpts.charge,
 injuries:0,mastery:0,trait:'Stout Vitality',statVariance:1,roundLimit,seedBase,
 enemyPreparation:'Live unarmed random-trait enemies; balanced opponent pathway cycle; identical NPC inputs per hero pathway/sample.',
 injuryRecovery:'No passive injury recovery. Treatment removes all injuries immediately, spending funds and materials; no real day passes.',
 retreat:'One 30% party retreat roll only on defeated live parties; successful retreat sets every returning owner to 99 injuries. Authored strength diagnostics disable retreat.',
 sampleResolution:1/samples,confidenceIntervals:'Wilson 95% intervals; a short screen does not establish true target rates.',
 marionettes:'Captured table body and 55% retention stay independent of NPC difficulty.',sourceFingerprint:sourceFingerprint.digest('hex')},
 loadouts,results,battles,errors:errorCount,summary:{winRate:totalWins/Math.max(1,battles),
 timeouts:allRows.reduce((n,r)=>n+r.timeouts,0),casualties:allRows.reduce((n,r)=>n+r.casualties,0),
 retreatAttempts:allRows.reduce((n,r)=>n+r.retreatAttempts,0),retreats:allRows.reduce((n,r)=>n+r.retreats,0),
 cohortsWithinTarget:allRows.filter(r=>r.meetsClearTarget).length,cohorts:allRows.length}};
if(opts.details==='true')report.records=records;
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({output,...report.summary,errors:errorCount}));
if(errorCount)process.exitCode=1;
