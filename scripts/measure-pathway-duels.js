'use strict';
// One primary battle per independent seed. Team swaps verify parity without
// inflating win-rate sample counts. Mirrors measure duration, never fairness.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const h=require('./combat-benchmark-helpers'),g=require('../js/node-loader');
const opts=h.options(),seqs=h.sequences(opts.sequences),samples=Number(opts.seeds||4);
const seedBase=Number(opts.seed||810019),roundLimit=Number(opts.rounds||50),swap=opts.swap||'sample';
const focus=opts.focus?opts.focus.split(','):g.PATH_KEYS,includeMirrors=opts.mirrors!=='false';
const assets=opts.assets||'rare',weapon=opts.weapon||'rare_sword',fixture=opts['collection-fixture']||'balanced';
const output=path.resolve(opts.output||'reports/reputation-combat/pvp.json');
assert(Number.isInteger(samples)&&samples>0,'Seeds must be a positive integer.');
assert(Number.isInteger(roundLimit)&&roundLimit>0&&roundLimit<=50,'Benchmark safety limit is 1–50 rounds.');
assert(['none','sample','all'].includes(swap),'Swap mode is none, sample or all.');
assert(focus.every(p=>g.PATH_KEYS.includes(p)),'Unknown focus pathway.');
if(opts.profile){
 const profile=JSON.parse(fs.readFileSync(path.resolve(opts.profile),'utf8'));
 Object.assign(g.GLOBAL_COMBAT,profile);
}
const heroOpts={assets,weapon,collectionFixture:fixture,assetAge:Number(opts['asset-age']||0),charge:Number(opts.charge||0)};
const fingerprintFiles=['data/balance.json','data/formulas.json','data/items.json','data/traits.json',
 ...g.PATH_KEYS.map(p=>'data/pathways/'+p+'.json'),
 'js/paths.js','js/v15.js','js/engine.js','js/signatures.js','js/pathway-assets.js','js/battle-ai.js','js/mythical.js',
 'scripts/combat-benchmark-helpers.js','scripts/permanent-asset-loadouts.js','scripts/measure-pathway-duels.js'];
const fingerprint=crypto.createHash('sha256');
for(const file of fingerprintFiles){
 const absolute=path.join(__dirname,'..',file);
 if(fs.existsSync(absolute)){fingerprint.update(file);fingerprint.update(fs.readFileSync(absolute));}
}
const records=[],loadouts=[],started=Date.now();
let parityFailures=0,parityBattles=0;
for(const sequence of seqs){
 const subset=[];
 for(let i=0;i<g.PATH_KEYS.length;i++)for(let j=i;j<g.PATH_KEYS.length;j++){
  const pathA=g.PATH_KEYS[i],pathB=g.PATH_KEYS[j];
  if((i===j&&!includeMirrors)||(!focus.includes(pathA)&&!focus.includes(pathB)))continue;
  for(let sample=0;sample<samples;sample++){
   // Identity and team assignment each alternate independently over four seeds.
   const a=h.preparedHero(g,pathA,sequence,sample%2?'Beta0':'Alpha0',heroOpts);
   const b=h.preparedHero(g,pathB,sequence,sample%2?'Alpha0':'Beta0',heroOpts);
   if(sample===0)for(const agent of [a,b]){
    if(loadouts.some(l=>l.pathway===agent.path&&l.sequence===sequence))continue;
    loadouts.push({pathway:agent.path,sequence,weapon:agent.weaponId,
     assets:g.preparedPathwayAssets(agent).map(asset=>({kind:asset.kind,sourcePath:asset.sourcePath,
      sequence:asset.sequence,abilityId:asset.abilityId,definitionId:asset.definitionId,name:g.pathwayAssetName(asset),
      captureProvenance:asset.captureProvenance,capturedProfile:asset.kind==='marionette'?asset.profile:undefined}))});
   }
   const seed=seedBase+sequence*100003+i*1009+j*37+sample*997,reversed=sample%4>=2;
   const quest={name:'Equal-Sequence pathway benchmark',encounter:true,difficultySequence:sequence,
    roundLimit,rewards:{funds:0,reputation:0,materials:{}}};
   const run=reverse=>g.resolveQuest([reverse?b:a],quest,seed,{
    individual:true,authoredOpponents:[h.authoredProfile(reverse?a:b,heroOpts.charge)]});
   const result=run(reversed),record=h.battleRecord(result,a,b,sequence,seed,sample,reversed);
   if(swap==='all'||(swap==='sample'&&sample===0)){
    const other=h.battleRecord(run(!reversed),a,b,sequence,seed,sample,!reversed);
    const equal=JSON.stringify(record.final)===JSON.stringify(other.final)
     &&record.winner===other.winner&&record.rounds===other.rounds
     &&record.timeout===other.timeout&&record.mutual===other.mutual;
    parityFailures+=Number(!equal);parityBattles++;
    assert(equal,`Team parity failed: ${pathA} vs ${pathB}, Sequence ${sequence}, seed ${seed}`);
   }
   delete record.final;records.push(record);subset.push(record);
  }
 }
 const quick=h.summarize(subset,g.PATH_KEYS,[sequence],focus);
 console.log(JSON.stringify({sequence,battles:subset.length,draws:quick.summary.draws,
  completedBy12:quick.summary.completedBy12,meanRounds:quick.summary.meanObservedRounds,
  cohortsWithinTarget:quick.summary.cohortsWithinTarget,cohorts:quick.summary.cohorts,
  elapsedSeconds:Math.round((Date.now()-started)/1000)}));
}
const report=h.summarize(records,g.PATH_KEYS,seqs,focus);
Object.assign(report.summary,{independentSeededMatchups:records.length,parityBattles,parityFailures});
const method={
 sequences:seqs,samples,seedBase,roundLimit,assets,collectionFixture:fixture,collectionFixtureVersion:2,assetAge:heroOpts.assetAge,
 weapon,weaponMastery:0,trait:'Stout Vitality',statVariance:1,startingSP:'full',charge:heroOpts.charge,
 focus,mirrorMatches:'Included only in duration and parity; excluded from win-rate cohorts.',
 winRate:'Wins divided by all non-mirror attempts; draws count as non-wins and are reported separately.',
 decisiveWinRate:'Wins divided by decisive attempts, shown as a diagnostic only.',
 teamAssignment:'Identity and allied side independently alternate over four seeds.',
 swapMode:swap,parityReplays:'Not additional samples.',sourceFingerprint:fingerprint.digest('hex'),
 loadout:'Balanced: legal current powers selected for attack, recovery, defense and passive utility; full legal prepared caps; one vessel or knowledge modifier. Legacy: original low-tier record/soul choices.',
 marionettes:'Fixed unmodified same-Sequence Tyrant tableStats ×55%, full preparation cap. Captured profiles are disclosed in loadouts and do not depend on contract difficulty.'
};
fs.mkdirSync(path.dirname(output),{recursive:true});
const data={rules:g.GLOBAL_COMBAT,method,summary:report.summary,aggregates:report.aggregates,
 rows:report.rows,matchups:report.matchups,loadouts};
if(opts.details==='true')data.battles=records;
fs.writeFileSync(output,JSON.stringify(data,null,2)+'\n');
const csv=output.replace(/\.json$/i,'')+'.csv';
fs.writeFileSync(csv,['pathway,sequence,battles,wins,losses,draws,win_percent,draw_percent,decisive_win_percent,mean_observed_rounds',
 ...report.rows.map(r=>[r.pathway,r.sequence,r.battles,r.wins,r.losses,r.draws,
  (r.winRate*100).toFixed(2),(r.drawRate*100).toFixed(2),(r.decisiveWinRate*100).toFixed(2),r.meanObservedRounds.toFixed(2)].join(','))].join('\n')+'\n');
const md=output.replace(/\.json$/i,'')+'.md',percent=n=>(n*100).toFixed(1)+'%';
const lines=[
 '# Equal-Sequence pathway benchmark','',
 `Assets: ${assets}; fixture: ${fixture}; weapon: ${weapon}; full SP; zero individual variation; starting charge ${heroOpts.charge}; ${roundLimit}-round limit.`,'',
 `${records.length.toLocaleString()} independent seeded matchups. ${parityBattles.toLocaleString()} side-swap replays; ${parityFailures} parity failures. Mirrors are excluded from win rates. Draws count as non-wins.`,'',
 `Draws ${percent(report.summary.drawRate)}; decisive by round 12 ${percent(report.summary.completedBy12)}; completed median / p90 / p99: ${report.summary.medianCompletedRounds} / ${report.summary.p90CompletedRounds} / ${report.summary.p99CompletedRounds}. ${report.summary.cohortsWithinTarget}/${report.summary.cohorts} pathway–Sequence cohorts meet 45–55% wins.`,'',
 '| Pathway | Overall | '+seqs.map(s=>'S'+s).join(' | ')+' | Draws |',
 '| --- | ---: | '+seqs.map(()=>'---:').join(' | ')+' | ---: |',
 ...report.aggregates.map(a=>'| '+g.pathOf(a.pathway).name+' | '+percent(a.winRate)+' | '+seqs.map(s=>{
  const row=report.rows.find(r=>r.pathway===a.pathway&&r.sequence===s);return row?percent(row.winRate):'—';
 }).join(' | ')+' | '+percent(a.drawRate)+' |'),'',
 'This is a controlled benchmark. The curated collection is fixed across opponents and contains only powers legal at the current Sequence. It does not represent randomly acquired inventories. Use independent seed bases and empty/older/Legendary collection checks before treating a tuning result as stable.',''
];
fs.writeFileSync(md,lines.join('\n'));
console.log(JSON.stringify({output,csv,markdown:md,summary:report.summary,
 weakest:report.aggregates.slice(-4).map(r=>[r.pathway,percent(r.winRate)]),
 strongest:report.aggregates.slice(0,4).map(r=>[r.pathway,percent(r.winRate)])}));
