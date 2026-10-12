#!/usr/bin/env node
'use strict';
// Read-only assessment of shipped rules and real complete contract battles.
// node scripts/assess-progression.js --baseline=/tmp/guild-progression-baseline
const fs=require('node:fs'),path=require('node:path');
const options=Object.fromEntries(process.argv.slice(2).map(arg=>arg.replace(/^--/,'').split('=')));
const root=path.resolve(__dirname,'..'),samples=Number(options.samples||40);
if(!Number.isInteger(samples)||samples<10||samples>1000)throw new Error('samples must be 10–1000');
const output=path.resolve(options.output||path.join(root,'reports/progression-review'));
fs.mkdirSync(output,{recursive:true});
const seeded=seed=>{let x=seed>>>0;return()=>((x=Math.imul(1664525,x)+1013904223)>>>0)/4294967296;};
const copy=x=>JSON.parse(JSON.stringify(x));
function agent(g,pathway,sequence,seed,id){
 const r=seeded(seed),a=g.makeAgent(r,{sequence:10,catalog:true,recommendedPath:pathway});
 Object.assign(a,{id,name:id,path:pathway,sequence,awakened:true,injuries:0,madness:0});
 a.stats=g.statsAtSequence(g.awakenStats(a,pathway,r),sequence,pathway);a.maxSP=g.maxSPFor(a);a.sp=a.maxSP;
 return a;
}
function assessRules(g,dir){
 const balance=JSON.parse(fs.readFileSync(path.join(dir,'data/balance.json')));
 const contracts=JSON.parse(fs.readFileSync(path.join(dir,'data/contracts.json')));
 const contractRows=[];
 for(const reputation of [0,9,10,15,30,50,80,150]){
  const count=10000,seqs={},r=seeded(987119+reputation),funds=[],reps=[],materials=[];let mundane=0,aboveRange=0;
  const declaredRange=contracts.system.max_sequence_by_reputation.filter(row=>reputation>=row.min).at(-1).max;
  for(let i=0;i<count;i++){
   const q=g.makeQuest(r,9,10,reputation,['fool']);seqs[q.difficultySequence]=(seqs[q.difficultySequence]||0)+1;
   mundane+=Number(q.mundane);aboveRange+=Number(!q.mundane&&q.difficultySequence<declaredRange);
   funds.push(q.rewards.funds);reps.push(q.rewards.reputation);materials.push(Object.values(q.rewards.materials).reduce((a,b)=>a+b,0));
  }
  let beginnerBoards=0;
  for(let i=0;i<2000;i++)beginnerBoards+=Number(g.makeQuestBoard(null,91377+i*997,reputation,['fool']).some(q=>q.encounter&&q.difficultySequence===9));
  const avg=a=>Number((a.reduce((x,y)=>x+y,0)/a.length).toFixed(2));
  contractRows.push({reputation,boardSize:g.questCountForReputation(reputation),samples:count,sequenceCounts:seqs,mundaneRate:mundane/count,aboveDeclaredRangeRate:aboveRange/count,averageFunds:avg(funds),fundsRange:[Math.min(...funds),Math.max(...funds)],averageReputation:avg(reps),averageMaterials:avg(materials),boardsWithSequence9:beginnerBoards/2000});
 }
 const progression=[];let cumulativeSurvival=1;
 for(let sequence=9;sequence>=1;sequence--){
  const a=agent(g,'fool',sequence,87313,'progression');a.digest=100;
  const info=g.canTrain({funds:999999,materials:{[g.pathOf(a.path).material]:999}},a);
  const r=seeded(98217+sequence);let wins=0;const draws=20000;
  for(let i=0;i<draws;i++)wins+=Number(g.attemptTraining(a,Math.floor(r()*4294967296)).ok);
  const measuredChance=wins/draws;cumulativeSurvival*=measuredChance;
  const row={sequence,next:sequence-1,shownChance:info.successChance,measuredChance,attemptSamples:draws,cumulativeSurvival,fundsCost:info.fundsCost,materialCost:info.materialCost,gainByContractSequence:{}};
  for(const difficultySequence of [10,9,8,7,6,5]){
   const q={difficultySequence},party=g.digestGain(q,false,a),solo=g.digestGain(q,true,a);
   row.gainByContractSequence[difficultySequence]={party,solo,partySuccesses:Math.ceil(100/party),soloSuccesses:Math.ceil(100/solo)};
  }
  progression.push(row);
 }
 const a=agent(g,'fool',9,8744,'Failure probe');
 const q={name:'Failure reward probe',objective:'combat',difficultySequence:5,requiredPath:'darkness',encounter:true,rewards:{funds:100,reputation:5,materials:{[g.pathOf('fool').material]:3}},dayCost:1};
 const combatFailure=g.resolveQuest([a],q,1009,{individual:true});
 const fresh=g.newGame();
 return {configuredDigestion:balance.system.digestion,contractRows,progression,combatFailure:{success:combatFailure.success,outcome:combatFailure.battleOutcome,rewards:combatFailure.rewards},freshGuild:{reputation:fresh.reputation,contracts:fresh.quests.map(q=>({name:q.name,sequence:q.difficultySequence})),wanted:fresh.wanted.map(q=>({name:q.name,sequence:q.difficultySequence,target:q.target||null,rewards:q.rewards}))}};
}
function assessBattles(g,label){
 const rows=[],errors=[],started=Date.now();let total=0;
 const run=(sequence,enemySequence,paths,mode,n,key)=>{
  let wins=0,deaths=0,timeouts=0,rounds=0;const byTrait={};
  for(let sample=0;sample<n;sample++){
   const members=paths.map((p,i)=>agent(g,p,sequence,73097+sequence*100003+sample*997+i*37,`Agent ${i}`));
   const q={name:'Assessment contract',objective:'combat',difficultySequence:enemySequence,encounter:true,rewards:{funds:375,reputation:5,materials:{[g.pathOf('fool').material]:3}},dayCost:1};
   try{
    const r=g.resolveQuest(copy(members),q,912217+sample*773+enemySequence*1009,{individual:mode==='solo'});total++;
    wins+=Number(r.success);deaths+=r.consequences.filter(c=>c.type==='death'||c.type==='corruptedDeath').length;
    timeouts+=Number(r.battleOutcome==='timeout');rounds+=Math.max(0,...r.events.map(e=>e.round||0));
    for(const a of members)byTrait[a.traitTier]=(byTrait[a.traitTier]||0)+1;
   }catch(e){errors.push({key,sample,message:e.message});}
  }
  rows.push({key,sequence,enemySequence,mode,paths,samples:n,winRate:wins/n,deathsPerContract:deaths/n,timeoutRate:timeouts/n,averageRounds:rounds/n,traitCounts:byTrait});
 };
 for(const sequence of [9,8,7,6,5]){
  for(const p of g.PATH_KEYS)for(const mode of ['solo','party'])run(sequence,sequence,mode==='solo'?[p]:[p,p,p],mode,samples,`${p}:${sequence}:${mode}`);
  console.log(`${label}: matched Sequence ${sequence}, ${total} battles, ${((Date.now()-started)/1000).toFixed(1)}s`);
 }
 for(const sequence of [4,3,2,1,0])for(const p of g.PATH_KEYS)run(sequence,5,[p],'solo',Math.max(10,Math.floor(samples/4)),`${p}:${sequence}:late-solo`);
 for(const enemySequence of [9,8,7,6])run(9,enemySequence,['door','visionary','fool'],'party',150,`opening:${enemySequence}`);
 return {total,seconds:(Date.now()-started)/1000,errors,rows};
}
const current=require(path.join(root,'js/node-loader.js'));
const result={metadata:{baselineCommit:'38f252bacafa727ad4d7f688d6acfd2e1e11a2dc',samplesPerPathway:samples,contractSamplesPerReputation:10000,boardSamplesPerReputation:2000,method:'New catalog traits at configured odds; seeded individual variance; full initial SP; no equipment, injury or initial charge; actual automatic battles against random contract enemies. Baseline follows its recommendation, so paired differences isolate removal of the 7% bonus. These are fresh-encounter samples, not long campaigns or a rarity-specific balance proof.'},current:{rules:assessRules(current,root),battles:assessBattles(current,'current')}};
if(options.baseline){
 const dir=path.resolve(options.baseline),g=require(path.join(dir,'js/node-loader.js'));
 result.baseline={rules:assessRules(g,dir),battles:assessBattles(g,'baseline')};
 const old=new Map(result.baseline.battles.rows.map(row=>[row.key,row]));
 result.pairedComparison=result.current.battles.rows.map(row=>({key:row.key,before:old.get(row.key).winRate,after:row.winRate,delta:row.winRate-old.get(row.key).winRate}));
}
fs.writeFileSync(path.join(output,'assessment.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({output:path.join(output,'assessment.json'),battles:result.current.battles.total+(result.baseline?.battles.total||0),runtimeErrors:result.current.battles.errors.length+(result.baseline?.battles.errors.length||0)}));
