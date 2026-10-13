'use strict';
const fs=require('node:fs'),path=require('node:path'),g=require('../js/node-loader');
const options=Object.fromEntries(process.argv.slice(2).map(arg=>arg.replace(/^--/,'').split('='))),samples=Number(options.samples||40);
const definitions=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/contracts.json'))).WANTED_TARGETS;
const teams=[['fool','tyrant','mother'],['door','visionary','fool'],['red_priest','sun','moon'],['error','white_tower','twilight_giant'],['paragon','demoness','death'],['chained','wheel_of_fortune','black_emperor']];
const seeded=seed=>{let x=seed>>>0;return()=>((x=Math.imul(1664525,x)+1013904223)>>>0)/4294967296;};
const rows=[];let battles=0;
for(const boss of definitions){
 for(const [teamIndex,paths]of teams.entries()){
  let wins=0,timeouts=0,phaseEvents=0,deaths=0,casualties=0,retreats=0,rounds=0;
  for(let sample=0;sample<samples;sample++){
   const members=paths.map((p,i)=>{const r=seeded(Number(options.seed||78319)+sample*773+i*37+teamIndex*1009),a=g.makeAgent(r,{sequence:10,catalog:true});a.path=p;a.sequence=boss.sequence;a.awakened=true;a.id=`hero_${i}`;a.name=`Hero ${i}`;a.stats=g.statsAtSequence(g.awakenStats(a,p,r),boss.sequence,p);a.weaponId=i===1?'sword':'knife';a.sp=g.maxSPFor(a);if(options.assets&&options.assets!=='empty')require('./permanent-asset-loadouts')(g,a,options.assets);return a;});
   const quest=g.makeWantedQuest(999,()=>.5,members,boss.id),result=g.resolveQuest(members,quest,Number(options.battleSeed||61877)+sample*991,{individual:false}),lost=result.consequences.filter(c=>c.type==='death'||c.type==='corruptedDeath').length;
   wins+=Number(result.success);timeouts+=Number(result.battleOutcome==='timeout');deaths+=lost;casualties+=Number(lost>0);retreats+=Number(result.retreat?.success);rounds+=Math.max(0,...result.events.map(e=>e.round||0));phaseEvents+=result.events.filter(e=>e.subtype==='boss_phase').length;battles++;
  }
  rows.push({bossId:boss.id,sequence:boss.sequence,paths,samples,wins,winRate:wins/samples,timeouts,deaths,casualties,casualtyRate:casualties/samples,retreats,meanRounds:rounds/samples,phaseEvents});
 }
 console.log(JSON.stringify({boss:boss.id,rows:rows.filter(r=>r.bossId===boss.id).map(r=>({paths:r.paths,winRate:r.winRate,timeouts:r.timeouts,phaseEvents:r.phaseEvents}))}));
}
const aggregates=definitions.map(b=>{const rr=rows.filter(r=>r.bossId===b.id),count=rr.reduce((n,r)=>n+r.samples,0);return {bossId:b.id,samples:count,winRate:rr.reduce((n,r)=>n+r.wins,0)/count,casualtyRate:rr.reduce((n,r)=>n+r.casualties,0)/count,timeouts:rr.reduce((n,r)=>n+r.timeouts,0),meanRounds:rr.reduce((n,r)=>n+r.meanRounds*r.samples,0)/count};});
const output=path.resolve(options.output||'reports/progression-review/wanted-balance.json');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify({samples,assets:options.assets||'empty',seed:Number(options.seed||78319),battleSeed:Number(options.battleSeed||61877),teams,battles,rows,aggregates},null,2)+'\n');console.log(JSON.stringify(aggregates));
