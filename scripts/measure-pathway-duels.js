'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),g=require('../js/node-loader');
const opts=Object.fromEntries(process.argv.slice(2).map(a=>a.replace(/^--/,'').split('='))),rules={};
const seqs=(opts.sequences||'9,8,7,6,5,4,3,2,1,0').split(',').map(Number),samples=Number(opts.seeds||2),rows=[],seedBase=Number(opts.seed||810019);
let battles=0,totalRounds=0,draws=0,under15=0,under12=0,parityFailures=0;const histogram={};
function hero(p,s,n){const a=g.makeAgent(()=>.5,{sequence:10,trait:'Stout Vitality'});Object.assign(a,{id:n,name:n,path:p,sequence:s,awakened:true,injuries:0,madness:0,weaponId:'none',weaponMastery:{},cooldowns:{},statVariance:{hp:1,atk:1,def:1,int:1,speed:1},speedVariance:1});g.restatAgent(a);
 for(const k of ['hp','atk','def','int']){const mult=(k==='hp'?(rules.hp||1):1)*Number(rules.stats?.[p]?.[s]?.[k]??rules.stats?.[p]?.[k]??1);a.stats[k]=Math.max(1,Math.round(a.stats[k]*mult));}
 a.sp=g.maxSPFor(a);g.setMeterValue(a,p,Number(opts.charge||0));if(opts.assets&&opts.assets!=='empty')require('./permanent-asset-loadouts')(g,a,opts.assets);return a;}
function profile(a){return {id:a.id,name:a.name,path:a.path,sequence:a.sequence,trait:a.trait,stats:{...a.stats},sp:a.sp,weaponId:'none',weaponMastery:{},meter:Number(opts.charge||0),pathwayInventory:a.pathwayInventory?JSON.parse(JSON.stringify(a.pathwayInventory)):null};}
function sig(r){return [...r.battleSnapshot.allies,...r.battleSnapshot.enemies].map(a=>[a.id,a.name,a.alive,a.hp,a.maxHp,a.sp]).sort((a,b)=>a[0].localeCompare(b[0]));}
for(const seq of seqs){const tally=Object.fromEntries(g.PATH_KEYS.map(p=>[p,{pathway:p,sequence:seq,battles:0,wins:0,losses:0,draws:0,rounds:0}]));
 for(let i=0;i<g.PATH_KEYS.length;i++)for(let j=i;j<g.PATH_KEYS.length;j++)for(let seed=0;seed<samples;seed++){
  const a=hero(g.PATH_KEYS[i],seq,'Alpha0'),b=hero(g.PATH_KEYS[j],seq,'Beta0'),q={name:'PvP proposal experiment',encounter:true,difficultySequence:seq,roundLimit:15,rewards:{funds:0,reputation:0,materials:{}}};
  const rngSeed=seedBase+seq*100003+i*1009+j*37+seed*997;
  const f=g.resolveQuest([a],q,rngSeed,{individual:true,authoredOpponents:[profile(b)]}),r=g.resolveQuest([b],q,rngSeed,{individual:true,authoredOpponents:[profile(a)]});
  parityFailures+=Number(JSON.stringify(sig(f))!==JSON.stringify(sig(r)));
  for(const result of [f,r]){for(const u of [...result.battleSnapshot.allies,...result.battleSnapshot.enemies])for(const k of ['hp','maxHp','sp','maxSP'])assert(Number.isFinite(u[k])&&u[k]>=0,'invalid '+k);const rounds=Math.max(0,...result.events.map(e=>e.round||0));battles++;totalRounds+=rounds;histogram[rounds]=(histogram[rounds]||0)+1;draws+=Number(result.battleOutcome==='timeout'||result.battleOutcome==='mutual_defeat');under15+=Number(['victory','defeat'].includes(result.battleOutcome)&&rounds<15);under12+=Number(['victory','defeat'].includes(result.battleOutcome)&&rounds<=12);}
  for(const [result,teamA,teamB] of [[f,'allies','enemies'],[r,'enemies','allies']]){
   for(const [p,own,foes] of [[a.path,teamA,teamB],[b.path,teamB,teamA]]){const tr=tally[p],alive=result.battleSnapshot[own].some(x=>x.alive),enemyAlive=result.battleSnapshot[foes].some(x=>x.alive);tr.battles++;tr.rounds+=Math.max(0,...result.events.map(e=>e.round||0));if(alive&&!enemyAlive)tr.wins++;else if(!alive&&enemyAlive)tr.losses++;else tr.draws++;}
  }
 }
 rows.push(...Object.values(tally));console.log(JSON.stringify({sequence:seq,battles,drawRate:draws/battles,meanRounds:totalRounds/battles,parityFailures}));
}
assert.equal(parityFailures,0,'Both team assignments must produce identical final state.');
for(const r of rows){r.winRate=r.wins/r.battles;r.drawRate=r.draws/r.battles;r.meanRounds=r.rounds/r.battles;}
const summary={battles,drawRate:draws/battles,meanRounds:totalRounds/battles,completedBefore15:under15/battles,completedBy12:under12/battles,parityFailures,histogram};const aggregates=g.PATH_KEYS.map(p=>{const rr=rows.filter(r=>r.pathway===p);const n=rr.reduce((s,r)=>s+r.battles,0);return {pathway:p,winRate:rr.reduce((s,r)=>s+r.wins,0)/n,drawRate:rr.reduce((s,r)=>s+r.draws,0)/n,minRankWin:Math.min(...rr.map(r=>r.winRate)),maxRankWin:Math.max(...rr.map(r=>r.winRate))};}).sort((a,b)=>b.winRate-a.winRate);
fs.mkdirSync(path.dirname(opts.output||path.join(__dirname,'../reports/reputation-combat/pvp.json')),{recursive:true});fs.writeFileSync(opts.output||path.join(__dirname,'../reports/reputation-combat/pvp.json'),JSON.stringify({rules:g.GLOBAL_COMBAT,method:{sequences:seqs,samples,seedBase,assets:opts.assets||'empty',loadout:'Representative legal collection; fixed library and one prepared vessel/knowledge modifier',charge:Number(opts.charge||0),weapon:'none',trait:'Stout Vitality',roundLimit:15},summary,aggregates,rows},null,2)+'\n');console.log(JSON.stringify({summary,aggregates}));
