'use strict';
const fs=require('node:fs'),path=require('node:path'),g=require('../js/node-loader');
const options=Object.fromEntries(process.argv.slice(2).map(arg=>arg.replace(/^--/,'').split('='))),samples=Number(options.samples||40);
const definitions=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/contracts.json'))).WANTED_TARGETS;
const teams=[['fool','tyrant','mother'],['door','visionary','fool'],['red_priest','sun','moon'],['error','white_tower','twilight_giant'],['paragon','demoness','death'],['chained','wheel_of_fortune','black_emperor']];
const seeded=seed=>{let x=seed>>>0;return()=>((x=Math.imul(1664525,x)+1013904223)>>>0)/4294967296;};
const rows=[];let battles=0;
for(const boss of definitions){
 for(const [teamIndex,paths]of teams.entries()){
  let wins=0,timeouts=0,phaseEvents=0,deaths=0;
  for(let sample=0;sample<samples;sample++){
   const members=paths.map((p,i)=>{const r=seeded(78319+sample*773+i*37+teamIndex*1009),a=g.makeAgent(r,{sequence:10,catalog:true});a.path=p;a.sequence=boss.sequence;a.awakened=true;a.id=`hero_${i}`;a.name=`Hero ${i}`;a.stats=g.statsAtSequence(g.awakenStats(a,p,r),boss.sequence,p);a.weaponId=i===1?'sword':'knife';a.sp=g.maxSPFor(a);return a;});
   const quest=g.makeWantedQuest(999,()=>.5,members,boss.id),result=g.resolveQuest(members,quest,61877+sample*991,{individual:false});
   wins+=Number(result.success);timeouts+=Number(result.battleOutcome==='timeout');deaths+=result.consequences.filter(c=>c.type==='death').length;phaseEvents+=result.events.filter(e=>e.subtype==='boss_phase').length;battles++;
  }
  rows.push({bossId:boss.id,sequence:boss.sequence,paths,samples,wins,winRate:wins/samples,timeouts,deaths,phaseEvents});
 }
 console.log(JSON.stringify({boss:boss.id,rows:rows.filter(r=>r.bossId===boss.id).map(r=>({paths:r.paths,winRate:r.winRate,timeouts:r.timeouts,phaseEvents:r.phaseEvents}))}));
}
const output=path.resolve(options.output||'reports/progression-review/wanted-balance.json');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify({samples,teams,battles,rows},null,2)+'\n');
