'use strict';
const fs=require('node:fs'),path=require('node:path'),g=require('../js/node-loader');
const opts=Object.fromEntries(process.argv.slice(2).map(a=>a.replace(/^--/,'').split('='))),guildCount=Number(opts.guilds||30),days=Number(opts.days||60),jobsPerDay=Number(opts.jobs||8),startDate=opts.startDate||g.dayjs().format('YYYY-MM-DD');
if(opts.rules)Object.assign(g.GLOBAL_COMBAT,JSON.parse(fs.readFileSync(opts.rules,'utf8')));
const random=seed=>{let x=seed>>>0;return()=>((x=Math.imul(1664525,x)+1013904223)>>>0)/4294967296;};
const actualNow=Date.now;
const rank={normal:0,rare:1,epic:2,legendary:3},rows=[];
for(let guild=0;guild<guildCount;guild++){
 Date.now=()=>g.dayjs(startDate).startOf('day').valueOf();const s=g.newGame(),r=random(517811+guild*1009),metrics={guild,attempts:0,wins:0,retreats:0,combatLosses:0,advancementLosses:0,recruits:0,training:0,heals:0,weaponPurchases:0,materialPurchases:0,weaponSpending:0,materialSpending:0,healingSpending:0,recruitSpending:0,advancementSpending:0,refreshSpending:0,contractIncome:0,stalledDispatches:0,unaffordableTreatment:0,bestSequence:9},snapshots=[];
 s.worldSeed=517811+guild*1009;s.calendar={version:1,originDate:startDate,originDay:1,currentDate:startDate};s.day=1;s.market=null;s.contractPool=null;s.quests=[];s.recruitPool=g.makeRecruitPool(4,s.worldSeed,0);s.recruitRefreshDay=8;g.maintainMarket(s);g.maintainGuildBoards(s);
 function recruit(){if(s.roster.length>=3||s.funds<150)return;const candidate=[...s.recruitPool].sort((a,b)=>rank[g.traitRarity(b)]-rank[g.traitRarity(a)])[0];if(!candidate)return;
  const result=g.hireRecruitmentCandidate(s,candidate.id);if(!result.ok)return;metrics.recruits++;metrics.recruitSpending+=150;
  const a=s.roster.find(a=>a.id===candidate.id),key=g.PATH_KEYS[(guild+metrics.recruits*7)%g.PATH_KEYS.length],material=g.pathOf(key).material;
  if(s.materials[material]<1){const purchase=g.buyMarketMaterial(s,material,1);if(!purchase.ok)return;metrics.materialPurchases++;metrics.materialSpending+=purchase.cost;}
  a.path=key;a.sequence=9;a.awakened=true;a.digest=0;a.stats=g.awakenStats(a,key,r);a.baseStats={...a.stats};a.maxSP=g.maxSPFor(a);a.sp=a.maxSP;a.cooldowns={};s.materials[material]--;g.ensurePathwayInventory(a);g.maintainGuildBoards(s);
 }
 function equip(a){
  if(a.weaponId==='none'){const available=['knife','sword','club','pistol','revolver'].find(id=>(s.weapons[id]||0)>0);if(available){s.weapons[available]--;a.weaponId=available;}}
  const current=g.WEAPONS[a.weaponId],offer=s.market.offers.filter(o=>rank[g.WEAPONS[o.weaponId].tier||'normal']>rank[current.tier||'normal']||a.weaponId==='none').sort((x,y)=>g.WEAPONS[x.weaponId].price-g.WEAPONS[y.weaponId].price)[0];
  if(offer){const item=g.WEAPONS[offer.weaponId];if(s.funds-item.price>=1000||a.weaponId==='none'&&s.funds-item.price>=200){const purchase=g.buyMarketWeapon(s,offer.id);if(purchase.ok){if(a.weaponId!=='none')s.weapons[a.weaponId]=(s.weapons[a.weaponId]||0)+1;s.weapons[item.id]--;a.weaponId=item.id;metrics.weaponPurchases++;metrics.weaponSpending+=item.price;}}}
 }
 function treat(a){if(a.injuries<25)return true;const cost=g.healCost(a),material=Object.keys(s.materials).sort((x,y)=>s.materials[y]-s.materials[x])[0],short=Math.max(0,cost.material-s.materials[material]),total=cost.funds+short*g.MARKET.materialPrices[material];
  if(s.funds<total){metrics.unaffordableTreatment++;return a.injuries<50;}
  if(short){const purchase=g.buyMarketMaterial(s,material,short);if(!purchase.ok)return false;metrics.materialPurchases+=short;metrics.materialSpending+=purchase.cost;}
  s.funds-=cost.funds;s.materials[material]-=cost.material;a.injuries=0;a.madness=Math.max(0,a.madness-15);metrics.heals++;metrics.healingSpending+=cost.funds;return true;
 }
 function train(a){const info=g.canTrain(s,a);if(!info?.ready)return;const short=Math.max(0,info.materialCost-s.materials[info.mat]),total=info.fundsCost+short*g.MARKET.materialPrices[info.mat];if(s.funds<total+300)return;
  if(short){const purchase=g.buyMarketMaterial(s,info.mat,short);if(!purchase.ok)return;metrics.materialPurchases+=short;metrics.materialSpending+=purchase.cost;}
  s.funds-=info.fundsCost;s.materials[info.mat]-=info.materialCost;metrics.advancementSpending+=info.fundsCost;const outcome=g.attemptTraining(a,Math.floor(r()*4294967296));
  if(outcome.ok){a.sequence--;a.digest=0;a.stats=g.advanceStats(a.stats,a.path,a.sequence);a.maxSP=g.maxSPFor(a);a.sp=Math.min(a.maxSP,a.sp||a.maxSP);a.cooldowns={};metrics.training++;metrics.bestSequence=Math.min(metrics.bestSequence,a.sequence);g.ensurePathwayInventory(a);}else{g.applyConsequences(s,[outcome.consequence]);metrics.advancementLosses++;}g.maintainGuildBoards(s);
 }
 // The protected case's actual one-time rewards give the starting party its intended supplies.
 for(let i=0;i<3;i++)recruit();for(const a of s.roster)equip(a);
 const caseIds=s.roster.map(a=>a.id);for(const [mission,choice]of [['open_doors',null],['follow_whispers','interviews'],['seal_and_supply','ward'],['last_bell',null],['daybreak',null]]){const started=g.campaignStart(s,mission,caseIds,choice,Math.floor(r()*4294967296));if(!started.ok||!started.pending.result.success)break;g.campaignSettle(s);}
 for(let day=1;day<=days;day++){
  const simulatedNow=g.dayjs(startDate).add(day-1,'day').valueOf();Date.now=()=>simulatedNow;g.advanceGuildDay(s,0,simulatedNow);for(let i=0;i<3;i++)recruit();for(const a of [...s.roster]){equip(a);train(a);}
  for(let job=0;job<jobsPerDay;job++){
   const choices=s.roster.filter(a=>a.status==='active'&&a.awakened&&a.unitType!=='marionette').map(a=>({a,q:s.quests.find(q=>q.difficultySequence===a.sequence)||s.quests.find(q=>q.difficultySequence===Math.min(9,a.sequence+1))})).filter(x=>x.q).sort((x,y)=>x.a.injuries-y.a.injuries||x.a.digest-y.a.digest);
   const pick=choices.find(x=>treat(x.a));if(!pick){metrics.stalledDispatches++;break;}
   const {a,q}=pick;if(!g.reserveContractDispatch(s,q).ok)throw Error('Dispatch failed');const result=g.resolveQuest([a],q,Math.floor(r()*4294967296),{individual:true,day:s.day});
   for(const offer of result.assetOffers||[])offer.choice='declined';s.pendingContract={quest:q,result};const settled=g.settleContract(s);if(!settled.ok)throw Error(settled.reason);
   metrics.attempts++;metrics.wins+=Number(result.success);metrics.retreats+=Number(result.retreat?.success);metrics.combatLosses+=result.consequences.filter(c=>['death','corruptedDeath'].includes(c.type)).length;metrics.contractIncome+=result.rewards.funds;
   const returned=s.roster.find(x=>x.id===a.id);if(returned)train(returned);recruit();
  }
  if(day%7===0||day===days)snapshots.push({day,funds:s.funds,reputation:s.reputation,roster:s.roster.map(a=>({path:a.path,sequence:a.sequence,digest:a.digest,injuries:a.injuries,tier:g.WEAPONS[a.weaponId]?.tier||'normal'}))});
 }
 rows.push({...metrics,endFunds:s.funds,endReputation:s.reputation,roster:s.roster.length,snapshots});console.log(JSON.stringify({guild,attempts:metrics.attempts,winRate:metrics.wins/Math.max(1,metrics.attempts),bestSequence:metrics.bestSequence,endFunds:s.funds,losses:metrics.combatLosses+metrics.advancementLosses}));
}
Date.now=actualNow;
const totals=Object.fromEntries(['attempts','wins','retreats','combatLosses','advancementLosses','recruits','training','heals','weaponSpending','materialSpending','healingSpending','recruitSpending','advancementSpending','contractIncome','unaffordableTreatment','stalledDispatches'].map(key=>[key,rows.reduce((n,r)=>n+r[key],0)]));
const summary={guilds:guildCount,days,jobsPerDay,...totals,winRate:totals.wins/Math.max(1,totals.attempts),medianEndFunds:[...rows].sort((a,b)=>a.endFunds-b.endFunds)[Math.floor(rows.length/2)].endFunds,bestSequenceRange:[Math.min(...rows.map(r=>r.bestSequence)),Math.max(...rows.map(r=>r.bestSequence))]};
const output=path.resolve(opts.output||'reports/market-balance/persistent-economy.json');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify({method:{guilds:guildCount,days,jobsPerDay,startDate,clock:'Day.js local calendar; actions never advance the day',strategy:'three rotating recruits, inexpensive available weapons, upgrades with cash reserve, treatment at 25 injuries, legal advancement, one protected case; no paid market refresh and no Wanted windfall'},summary,rows},null,2)+'\n');console.log(JSON.stringify(summary));
