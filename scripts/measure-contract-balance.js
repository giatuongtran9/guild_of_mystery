'use strict';
// Seeded real solo contract battles; candidate strengths only alter authored NPC profiles.
const fs=require('node:fs'),path=require('node:path'),g=require('../js/node-loader');
const options=Object.fromEntries(process.argv.slice(2).map(arg=>arg.replace(/^--/,'').split('=')));
const samples=Number(options.samples||100),sequences=(options.sequences||'9,8,7,6,5,4,3,2,1,0').split(',').map(Number);
const strengths=(options.strengths||'live').split(','),weapon=options.weapon||'knife';
const roundLimit=Number(options.rounds||45),seedBase=Number(options.seed||710019);
const output=path.resolve(options.output||'reports/progression-review/solo-contracts.json');
const seeded=seed=>{let x=seed>>>0;return()=>((x=Math.imul(1664525,x)+1013904223)>>>0)/4294967296;};
const results=[];let battles=0;
for(const strength of strengths)for(const sequence of sequences){
 const rows=[];
 for(const [index,pathway] of g.PATH_KEYS.entries()){
  let wins=0,timeouts=0,deaths=0;const errors=[];
  for(let sample=0;sample<samples;sample++){
   const seed=seedBase+sequence*100003+index*1009+sample*997,r=seeded(seed);
   const a=g.makeAgent(r,{sequence:10,catalog:true});a.id='solo_agent';a.name='Solo agent';a.path=pathway;a.sequence=sequence;a.awakened=true;
   a.stats=g.statsAtSequence(g.awakenStats(a,pathway,r),sequence,pathway);a.baseStats={...a.stats};a.weaponId=weapon;a.weaponMastery={};a.sp=g.maxSPFor(a);a.maxSP=a.sp;if(options.assets&&options.assets!=='empty')require('./permanent-asset-loadouts')(g,a,options.assets);
   const quest={name:'Solo contract verification',kind:'contract',difficultySequence:sequence,objective:'combat',encounter:true,roundLimit,rewards:{funds:200,reputation:3,materials:{}},dayCost:1};
   const decisions={individual:true};
   if(strength!=='live'){
    const foe=g.makeEnemy(sequence,seeded(seed+19319),0);
    decisions.authoredOpponents=[{name:'Contract adversary',path:foe.path,sequence,trait:foe.trait,stats:Object.fromEntries(Object.entries(foe.stats).map(([k,v])=>[k,Math.max(1,Math.round(v*Number(strength)))])),sp:0}];
   }
   try{const result=g.resolveQuest([a],quest,seed+11939,decisions);wins+=Number(result.success);timeouts+=Number(result.battleOutcome==='timeout');deaths+=result.consequences.filter(c=>c.type==='death'||c.type==='corruptedDeath').length;battles++;}
   catch(e){errors.push(e.message);}
  }
  rows.push({pathway,sequence,samples,wins,winRate:wins/samples,timeouts,deaths,errors});
 }
 results.push({strength,sequence,rows});
 console.log(JSON.stringify({strength,sequence,meanWinRate:rows.reduce((sum,x)=>sum+x.winRate,0)/rows.length,below80:rows.filter(x=>x.winRate<.8).map(x=>[x.pathway,x.winRate,x.timeouts]),battles}));
}
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify({method:{samples,sequences,assets:options.assets||'empty',weapon,startingSP:'full',injuries:0,mastery:0,traitGeneration:'live rarity odds',roundLimit,seedBase},results,battles},null,2)+'\n');
