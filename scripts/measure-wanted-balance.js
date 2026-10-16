'use strict';
// Named live bosses against three actual equally equipped hero owners.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const h=require('./combat-benchmark-helpers'),g=require('../js/node-loader');
const opts=h.options(),samples=Number(opts.samples||40),weapon=opts.weapon||'rare_sword',assets=opts.assets||'rare';
const roundLimit=Number(opts.rounds||50),seedBase=Number(opts.seed||78319),battleSeedBase=Number(opts['battle-seed']||opts.battleSeed||61877);
const clearMin=Number(opts['clear-min']??.65),clearMax=Number(opts['clear-max']??.75);
const allDefinitions=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/contracts.json'),'utf8')).WANTED_TARGETS;
const definitions=allDefinitions.filter(b=>(!opts.bosses||opts.bosses.split(',').includes(b.id))
 &&(!opts.sequences||h.sequences(opts.sequences).includes(b.sequence)));
const teams=[['fool','tyrant','mother'],['door','visionary','fool'],['red_priest','sun','moon'],
 ['error','white_tower','twilight_giant'],['paragon','demoness','death'],['chained','wheel_of_fortune','black_emperor']];
const teamIndices=opts['team-indices']?opts['team-indices'].split(',').map(Number):teams.map((_,i)=>i);
assert(Number.isInteger(samples)&&samples>0,'Samples must be a positive integer.');
assert(Number.isInteger(roundLimit)&&roundLimit>0&&roundLimit<=50,'Safety limit must be 1–50 rounds.');
assert(Number.isFinite(clearMin)&&Number.isFinite(clearMax)&&clearMin>=0&&clearMax<=1&&clearMin<=clearMax,
 'Clear target must satisfy 0 <= --clear-min <= --clear-max <= 1.');
assert(definitions.length,'No bosses match the selection.');
assert(teamIndices.length&&teamIndices.every(i=>Number.isInteger(i)&&teams[i]),'Invalid team indices.');
if(opts.bosses)assert(opts.bosses.split(',').every(id=>allDefinitions.some(b=>b.id===id)),'Unknown boss ID.');
const profileInput=opts.profile?path.resolve(opts.profile):null,profileText=profileInput?fs.readFileSync(profileInput,'utf8'):null;
const mergeProfile=(target,source)=>{for(const [key,value]of Object.entries(source)){if(value&&typeof value==='object'&&!Array.isArray(value)){if(!target[key]||typeof target[key]!=='object'||Array.isArray(target[key]))target[key]={};mergeProfile(target[key],value);}else target[key]=value;}};
if(profileText)mergeProfile(g.GLOBAL_COMBAT,JSON.parse(profileText));
const profileMethod=profileText?{path:profileInput,sha256:crypto.createHash('sha256').update(profileText).digest('hex'),application:'In-memory nested merge of GLOBAL_COMBAT only; source data and saved character stats are unchanged.'}:null;
const bossProfileInput=opts['boss-profile']?path.resolve(opts['boss-profile']):null;
const bossProfileText=bossProfileInput?fs.readFileSync(bossProfileInput,'utf8'):null;
if(bossProfileText){
 const parsed=JSON.parse(bossProfileText),recommendations=Array.isArray(parsed)?parsed:(parsed.WANTED_TARGETS||parsed.recommendations||parsed.results?.map(r=>r.recommendation));
 assert(Array.isArray(recommendations),'Boss profile must contain an array of boss recommendations.');
 for(const recommendation of recommendations){
  assert(allDefinitions.some(b=>b.id===recommendation.id),'Unknown boss in profile: '+recommendation.id);
  const allowed=['statMultipliers','damageMultiplier','statusDamageMultiplier','periodicDamageTakenMultiplier','redirectedDamageMultiplier'];
  const patch=Object.fromEntries(allowed.filter(key=>recommendation[key]!==undefined).map(key=>[key,recommendation[key]]));
  if(patch.statMultipliers)for(const [stat,value]of Object.entries(patch.statMultipliers))assert(['hp','atk','def','int'].includes(stat)&&Number.isFinite(value)&&value>0,'Invalid boss stat multiplier: '+stat);
  for(const key of allowed.filter(key=>key!=='statMultipliers'))if(patch[key]!==undefined)assert(Number.isFinite(patch[key])&&patch[key]>=0,'Invalid boss budget: '+key);
  mergeProfile(g.bossDefinition(recommendation.id),patch);
 }
}
const bossProfileMethod=bossProfileText?{path:bossProfileInput,sha256:crypto.createHash('sha256').update(bossProfileText).digest('hex'),application:'In-memory merge of named boss numeric budgets only; repository data is unchanged.'}:null;
const heroOpts={assets,weapon,collectionFixture:opts['collection-fixture']||'balanced',assetAge:Number(opts['asset-age']||0),charge:Number(opts.charge||0)};
const output=path.resolve(opts.output||'reports/progression-review/wanted-balance.json');
const sourceFingerprint=crypto.createHash('sha256');
for(const file of ['data/balance.json','data/contracts.json','data/formulas.json','data/items.json','data/traits.json','data/permanent-assets.json',
 ...g.PATH_KEYS.map(p=>'data/pathways/'+p+'.json'),'js/paths.js','js/v15.js','js/engine.js','js/signatures.js','js/pathway-assets.js',
 'js/battle-ai.js','js/mythical.js','js/generate.js','js/state.js','js/traits.js','js/node-loader.js','scripts/combat-benchmark-helpers.js','scripts/permanent-asset-loadouts.js','scripts/measure-wanted-balance.js']){
 const absolute=path.join(__dirname,'..',file);if(fs.existsSync(absolute)){sourceFingerprint.update(file);sourceFingerprint.update(fs.readFileSync(absolute));}
}
const rows=[],records=[],loadouts=[],started=Date.now();let battles=0,errorCount=0;
const percentile=(values,fraction)=>values.length?[...values].sort((a,b)=>a-b)[Math.min(values.length-1,Math.floor(values.length*fraction))]:null;
const interval=(wins,count)=>{if(!count)return null;const z=1.959964,z2=z*z,p=wins/count,d=1+z2/count,c=(p+z2/(2*count))/d,m=z*Math.sqrt(p*(1-p)/count+z2/(4*count*count))/d;return [Math.max(0,c-m),Math.min(1,c+m)];};
for(const boss of definitions){
 const bossIndex=allDefinitions.findIndex(definition=>definition.id===boss.id);
 for(const teamIndex of teamIndices){
  const paths=teams[teamIndex],row={bossId:boss.id,sequence:boss.sequence,teamIndex,paths,samples,completedSamples:0,wins:0,timeouts:0,
   deaths:0,casualties:0,retreatAttempts:0,retreats:0,rounds:0,observedRounds:[],phaseEvents:0,attemptsWithPhase:0,
   winsWithoutPhase:0,phaseRounds:[],returnedAgents:0,totalInjuries:0,maxInjuries:0,retreatInjury99:0,
   treatmentFunds:0,treatmentMaterials:0,errors:[]};
  for(let sample=0;sample<samples;sample++){
   const members=paths.map((p,i)=>h.preparedHero(g,p,boss.sequence,`hero_${i}`,heroOpts));
   assert.equal(members.length,3,'Wanted benchmark requires three hero owners.');
   assert(members.every(a=>a.awakened&&a.unitType!=='marionette'),'Companions cannot count toward Wanted party size.');
   if(sample===0)loadouts.push({bossId:boss.id,teamIndex,members:members.map(a=>({pathway:a.path,sequence:a.sequence,weapon:a.weaponId,
    assets:g.preparedPathwayAssets(a).map(asset=>({kind:asset.kind,sourcePath:asset.sourcePath,sequence:asset.sequence,
     abilityId:asset.abilityId,definitionId:asset.definitionId,capturedProfile:asset.kind==='marionette'?asset.profile:undefined}))}))});
   const quest=g.makeWantedQuest(999,h.seeded(seedBase+bossIndex*100003+sample*773),members,boss.id);
   quest.roundLimit=roundLimit;
   const battleSeed=battleSeedBase+bossIndex*100003+teamIndex*1009+sample*991;
   try{
    const result=g.resolveQuest(members,quest,battleSeed,{individual:false,day:1}),ownerIds=new Set(members.map(a=>a.id));
    const lostIds=new Set(result.consequences.filter(c=>['death','corruptedDeath'].includes(c.type)&&ownerIds.has(c.agentId)).map(c=>c.agentId));
    const rounds=Math.max(0,...result.events.map(e=>e.round||0)),phases=result.events.filter(e=>e.subtype==='boss_phase');
    assert(rounds<=roundLimit,'Wanted encounter exceeded its safety limit.');
    assert.equal(result.events.filter(e=>e.subtype==='retreat').length,Number(result.retreat?.success),'Successful defeated-party retreat must emit exactly one event.');
    assert(phases.length<=1,'A Wanted boss phase must trigger at most once.');
    assert(phases.every(e=>e.actorId==='boss_'+boss.id),'Unexpected actor emits the Wanted phase.');
    const ownerReports=result.rosterReport.filter(r=>ownerIds.has(r.id));
    assert.equal(ownerReports.length,3,'Wanted result must report every deployed hero owner.');
    row.completedSamples++;row.wins+=Number(result.success);row.timeouts+=Number(result.battleOutcome==='timeout');
    row.deaths+=lostIds.size;row.casualties+=Number(lostIds.size>0);row.retreatAttempts+=Number(result.retreat?.attempted);
    row.retreats+=Number(result.retreat?.success);row.rounds+=rounds;row.observedRounds.push(rounds);
    row.phaseEvents+=phases.length;row.attemptsWithPhase+=Number(phases.length>0);row.phaseRounds.push(...phases.map(e=>e.round));
    row.winsWithoutPhase+=Number(result.success&&phases.length===0);battles++;
    for(const report of ownerReports.filter(r=>r.survived)){
     const injury=Number(report.injuries||0),cost=injury>0?g.healCost({injuries:injury}):{funds:0,material:0};
     row.returnedAgents++;row.totalInjuries+=injury;row.maxInjuries=Math.max(row.maxInjuries,injury);
     row.treatmentFunds+=cost.funds;row.treatmentMaterials+=cost.material;
     if(result.retreat?.success){assert.equal(injury,99,'A party retreat must return every owner at 99 injuries.');row.retreatInjury99++;}
    }
    if(result.retreat?.success)assert.equal(result.retreat.agentIds.filter(id=>ownerIds.has(id)).length,3,'One successful party retreat must recover all three owners.');
    if(opts.details==='true')records.push({bossId:boss.id,sequence:boss.sequence,teamIndex,sample,battleSeed,
     success:result.success,outcome:result.battleOutcome,rounds,retreat:result.retreat,deaths:[...lostIds],roster:ownerReports,
     phases:phases.map(e=>({round:e.round,text:e.text})),
     feedback:result.events.filter(e=>['boss_phase','retreat'].includes(e.subtype)).map(e=>e.text)});
   }catch(error){errorCount++;row.errors.push({sample,battleSeed,message:error.message});}
  }
  const count=row.completedSamples;
  Object.assign(row,{winRate:count?row.wins/count:null,winRate95CI:interval(row.wins,count),casualtyRate:count?row.casualties/count:null,casualtyRate95CI:interval(row.casualties,count),
   timeoutRate:count?row.timeouts/count:null,retreatRate:count?row.retreats/count:null,
   retreatSuccessRate:row.retreatAttempts?row.retreats/row.retreatAttempts:null,meanRounds:count?row.rounds/count:null,
   p90Rounds:percentile(row.observedRounds,.9),phaseRate:count?row.attemptsWithPhase/count:null,
   meanPhaseRound:row.phaseRounds.length?row.phaseRounds.reduce((n,r)=>n+r,0)/row.phaseRounds.length:null,
   meanSurvivorInjuries:row.returnedAgents?row.totalInjuries/row.returnedAgents:null,
   meanTreatmentFundsPerAttempt:count?row.treatmentFunds/count:null,
   meanTreatmentMaterialsPerAttempt:count?row.treatmentMaterials/count:null,
   meetsClearTarget:count>0&&row.wins/count>=clearMin&&row.wins/count<=clearMax,
   meetsCasualtyTarget:count>0&&row.casualties/count<=.1});
  rows.push(row);
 }
 console.log(JSON.stringify({boss:boss.id,rows:rows.filter(r=>r.bossId===boss.id).map(r=>({teamIndex:r.teamIndex,paths:r.paths,
  winRate:r.winRate,casualtyRate:r.casualtyRate,timeouts:r.timeouts,phaseRate:r.phaseRate,meanRounds:r.meanRounds})),
  battles,errors:errorCount,elapsedSeconds:Math.round((Date.now()-started)/1000)}));
}
const aggregates=definitions.map(b=>{
 const rr=rows.filter(r=>r.bossId===b.id),count=rr.reduce((n,r)=>n+r.completedSamples,0),sum=key=>rr.reduce((n,r)=>n+r[key],0);
 const rate=key=>count?sum(key)/count:null;
 return {bossId:b.id,sequence:b.sequence,samples:count,wins:sum('wins'),winRate:rate('wins'),winRate95CI:interval(sum('wins'),count),deaths:sum('deaths'),
  casualties:sum('casualties'),casualtyRate:rate('casualties'),casualtyRate95CI:interval(sum('casualties'),count),timeouts:sum('timeouts'),timeoutRate:rate('timeouts'),
  retreatAttempts:sum('retreatAttempts'),retreats:sum('retreats'),retreatSuccessRate:sum('retreatAttempts')?sum('retreats')/sum('retreatAttempts'):null,
  meanRounds:rate('rounds'),p90Rounds:percentile(rr.flatMap(r=>r.observedRounds),.9),phaseRate:rate('attemptsWithPhase'),
  winsWithoutPhase:sum('winsWithoutPhase'),meanSurvivorInjuries:sum('returnedAgents')?sum('totalInjuries')/sum('returnedAgents'):null,
  meanTreatmentFundsPerAttempt:rate('treatmentFunds'),meanTreatmentMaterialsPerAttempt:rate('treatmentMaterials'),
  meetsClearTarget:count>0&&rate('wins')>=clearMin&&rate('wins')<=clearMax,meetsCasualtyTarget:count>0&&rate('casualties')<=.1,
  mechanic:b.mechanic,phase:b.phase,descriptionWarnings:/15 rounds/.test(b.mechanic)&&roundLimit!==15?['Mechanic text still promises a 15-round limit.']:[]};
});
const bossBudgets=definitions.map(b=>{const live=g.bossDefinition(b.id);return{id:b.id,sequence:b.sequence,statMultipliers:live.statMultipliers,damageMultiplier:live.damageMultiplier,
 statusDamageMultiplier:live.statusDamageMultiplier??1,periodicDamageTakenMultiplier:live.periodicDamageTakenMultiplier??1,redirectedDamageMultiplier:live.redirectedDamageMultiplier??1};});
const report={rules:g.GLOBAL_COMBAT,bossBudgets,method:{profile:profileMethod,bossProfile:bossProfileMethod,samples,seedBase,battleSeedBase,assets,weapon,collectionFixture:heroOpts.collectionFixture,
 collectionFixtureVersion:2,assetAge:heroOpts.assetAge,startingSP:'full',charge:heroOpts.charge,injuries:0,mastery:0,
 trait:'Stout Vitality',statVariance:1,roundLimit,teams:teamIndices.map(i=>({teamIndex:i,paths:teams[i]})),
 party:'Exactly three awakened owners; owned companions enter as additional units without changing the party-size requirement.',
 teamCoverage:'Six fixed representative compositions. These do not exhaust every three-pathway composition.',
 clearTarget:{minimum:clearMin,maximum:clearMax,validation:'Inclusive sample clear-rate point estimate for each team row and each boss aggregate; confidence intervals express sampling uncertainty.'},
 injuryRecovery:'No passive injury recovery. Treatment clears injuries immediately for funds and materials; no real day passes.',
 retreat:'One 30% roll per defeated party. Success recovers all owners at 99 injuries. Casualty counts include partial losses in victories and timeouts.',
 sampleResolution:1/samples,confidenceIntervals:'Wilson 95% intervals; six fixed compositions do not establish performance across all parties.',
 marionettes:'Captured table body and 55% retention stay independent of boss difficulty.',sourceFingerprint:sourceFingerprint.digest('hex')},
 battles,errors:errorCount,rows,aggregates,loadouts};
if(opts.details==='true')report.records=records;
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({output,battles,errors:errorCount,aggregates}));
if(errorCount)process.exitCode=1;
