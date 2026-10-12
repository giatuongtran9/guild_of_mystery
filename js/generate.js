// ===== generate.js =====
const FIRST = G9D.characters.FIRST;
const LAST = G9D.characters.LAST;
const TRAITS = G9D.characters.TRAITS;
const TRAIT_NAMES = G9D.characters.TRAIT_NAMES;
const OCCUPATIONS = G9D.characters.OCCUPATIONS;
const QUEST_TEMPLATES = G9D.contracts.QUEST_TEMPLATES;
const tags = G9D.contracts.tags;
const WANTED_TARGETS = G9D.contracts.WANTED_TARGETS;
function traitData(agent){return typeof resolvedTraitModifiers==='function'?resolvedTraitModifiers(agent):TRAITS[agent?.trait]||TRAITS["Stout Vitality"];}
function randomTrait(rng=Math.random){return pick(rng,TRAIT_NAMES);}
let counter=0;
const newId=(prefix="u")=>`${prefix}_${Date.now().toString(36)}_${(counter++).toString(36)}`;
const pick=(rng,a)=>a[Math.floor(rng()*a.length)];
const randRange=(rng,min,max)=>Math.floor(rng()*(max-min+1))+min;
function humanStats(rng=Math.random){return {hp:randRange(rng,5,10),atk:randRange(rng,5,10),def:randRange(rng,5,10),int:randRange(rng,5,10)};}
function makeAgent(rng=Math.random,options={}){
  const forced=options.traitId&&TRAIT_DATA.entries[options.traitId];
  if(options.traitId&&!forced)throw new Error('Unknown trait ID: '+options.traitId);
  const catalog=forced?{traitId:options.traitId,traitTier:forced.tier,traitSource:'catalog_v1',trait:forced.name}:options.catalog?rollCatalogTrait(rng):null;
  const trait=catalog?.trait||options.trait||randomTrait(rng),statVariance=rollVariance(rng),sequence=options.sequence??10;
  const path=sequence<10?(options.path||pick(rng,PATH_KEYS)):null,human=humanStats(rng);
  return {
    ...(catalog||{}),id:newId("ag"),name:`${pick(rng,FIRST)} ${pick(rng,LAST)}`,occupation:pick(rng,OCCUPATIONS),trait,traits:{name:trait,desc:catalog?traitDescription(catalog):TRAITS[trait].desc},
    stats:{...human},baseStats:{...human},humanStats:{...human},statVariance,speedVariance:statVariance.speed,basePathSpeed:null,
    path,sequence,awakened:sequence<10,
    abilities:sequence<10?[tierFor(path,sequence).ability]:[],
    abilityHistory:sequence<10?[{sequence,name:tierFor(path,sequence).name,ability:tierFor(path,sequence).ability}]:[],
    introduction:`Born into an ordinary ${pick(rng,OCCUPATIONS).toLowerCase()} life, ${pick(rng,["they kept their head down and worked","they learned to read people quickly","they developed a reputation for reliability","they were fascinated by things others ignored"])}. Their combat characteristic is ${trait}, which shapes how they survive and fight.`,
    status:"active",unitType:"agent",digest:0,sp:0,maxSP:0,cooldowns:{},madness:0,corruption:0,fear:0,fortune:0,wrath:0,radiance:0,insight:0,knowledge:0,mystery:0,resolve:0,warMomentum:0,activeThreads:0,threadTargets:[],injuries:0,recorded:[],permanentTraits:[],weaponId:"none",originEvent:null,
    history:[{day:0,text:`Joined the recruitment office as an ordinary ${pick(rng,OCCUPATIONS).toLowerCase()}.`}]
  };
}
function rollRecruitSequence(){return 10;}
function makeRecruitPool(size=4,seed=Date.now(),guildReputation=0){const rng=(()=>{let x=seed>>>0;return()=>((x=Math.imul(1664525,x)+1013904223)>>>0)/4294967296;})();return Array.from({length:size},()=>makeAgent(rng,{sequence:10,catalog:true}));}
function maxContractSequence(rep){const rows=G9D.system.contracts.max_sequence_by_reputation;return rows.filter(x=>rep>=x.min).sort((a,b)=>b.min-a.min)[0]?.max??9;}
function rosterProfile(roster=[]){
 const paths=roster.map(a=>typeof a==='string'?a:a.path).filter(p=>PATH_KEYS.includes(p));
 const agents=roster.filter(a=>a&&typeof a==='object'&&a.awakened&&a.status==='active'&&a.sequence<=9&&a.unitType!=='marionette');
 return {paths,agents,bestSequence:agents.length?Math.min(...agents.map(a=>a.sequence)):9};
}
function contractSequenceWeights(rep,roster=[]){
 return {...reputationRank(rep).sequenceOdds};
}
function reputationRank(rep=0){return G9D.system.contracts.reputation_ranks.filter(rank=>rep>=rank.minimumReputation).at(-1)||G9D.system.contracts.reputation_ranks[0];}
function nextReputationRank(rep=0){return G9D.system.contracts.reputation_ranks.find(rank=>rank.minimumReputation>rep)||null;}
function weightedSequence(r,rep,roster=[]){
 const arr=Object.entries(contractSequenceWeights(rep,roster)).map(([seq,w])=>[Number(seq),w]),total=arr.reduce((a,x)=>a+x[1],0);let n=r()*total;
 for(const [seq,w] of arr){n-=w;if(n<0)return seq;}return arr.at(-1)[0];
}
function bossDefinition(id){return WANTED_TARGETS.find(b=>b.id===id)||null;}
function makeWantedQuest(rep=15,rng=Math.random,roster=[],bossId=null){
 const eligible=WANTED_TARGETS.filter(b=>rep>=b.minReputation),w=bossId?bossDefinition(bossId):pick(rng,eligible);
 if(!w)return null;
 const profile=rosterProfile(roster),materialPaths=[...new Set(profile.paths)].slice(0,3),materials={};
 for(const p of materialPaths.length?materialPaths:[w.path])materials[pathOf(p).material]=w.rewardMaterials;
 return {id:newId('w'),kind:'wanted',bossId:w.id,name:w.title,brief:w.story,story:w.story,target:w.target,knownPath:pathOf(w.path).name,threat:`Sequence ${w.sequence} boss`,lastSeen:w.lastSeen,mechanic:w.mechanic,objectiveText:`Defeat ${w.target} with three awakened agents`,objective:'combat',difficultySequence:w.sequence,encounter:true,mundane:false,requiredPath:w.path,requiredPartySize:3,roundLimit:G9D.balance.contract_encounters.boss_round_limit,rewards:{funds:w.rewardFunds,reputation:w.rewardRep,materials},tags:['wanted','boss'],dayCost:1};
}
function makeQuest(rng=Math.random,min=9,max=10,rep=0,roster=[],forcedSequence=null){
 const tpl=pick(rng,QUEST_TEMPLATES),difficultySequence=Number.isInteger(forcedSequence)?forcedSequence:weightedSequence(rng,rep,roster);
 const profile=rosterProfile(roster),materialPath=pick(rng,profile.paths.length?profile.paths:PATH_KEYS),mat=pathOf(materialPath).material;
 const difficultyScale=1+(9-difficultySequence)*.25,trustScale=1+Math.min(rep,400)*.002;
 const funds=Math.round(randRange(rng,170,250)*difficultyScale*trustScale),reputation=3+Math.floor((9-difficultySequence)/2),materials=1+Math.floor((9-difficultySequence)/4);
 return {id:newId('q'),kind:'contract',name:tpl[0],brief:tpl[1],story:tpl[1],requiredPath:null,tags:[tpl[2],pick(rng,tags)],difficultySequence,objective:'combat',encounter:true,mundane:false,materialPath,rewards:{funds,reputation,materials:{[mat]:materials}},dayCost:1};
}
function guildQuestTier(rep){return rep>=80?4:rep>=50?3:rep>=30?2:rep>=15?1:0;}
function questCountForReputation(rep){if(rep<5)return 2;if(rep<15)return 3;if(rep<50)return 4;if(rep<80)return 5;return 6;}
function makeQuestBoard(count=null,seed=Date.now(),rep=0,roster=[]){
 const rng=(()=>{let x=(seed+7777)>>>0;return()=>((x=Math.imul(1664525,x)+1013908577)>>>0)/4294967296;})();
 const n=count==null?questCountForReputation(rep):Math.min(count,questCountForReputation(rep)),board=Array.from({length:n},()=>makeQuest(rng,9,10,rep,roster));
 if(n>0&&!board.some(q=>q.difficultySequence===9))board[n-1]=makeQuest(rng,9,10,rep,roster,9);
 const best=rosterProfile(roster).bestSequence;
 if(n>1&&best!==9&&!board.some(q=>q.difficultySequence===best)){const index=board.findIndex(q=>q.difficultySequence!==9);board[index>=0?index:0]=makeQuest(rng,9,10,rep,roster,best);}
 return board;
}
