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
function maxContractSequence(rep){const rows=G9D.system.contracts.max_sequence_by_reputation;return rows.filter(x=>rep>=x.min).sort((a,b)=>b.min-a.min)[0]?.max||9;}
function contractSequenceWeights(rep){const rows=G9D.system.contracts.sequence_odds_by_reputation||[];return rows.filter(x=>rep>=x.min).sort((a,b)=>b.min-a.min)[0]?.weights||{'9':100,'8':0,'7':0,'6':0,'5':0};}
function weightedSequence(r,rep){const weights=contractSequenceWeights(rep);const arr=Object.entries(weights).map(([seq,w])=>[Number(seq),Number(w)||0]).filter(([,w])=>w>0);const total=arr.reduce((a,x)=>a+x[1],0);if(!total)return 9;let n=r()*total;for(const [seq,w] of arr){n-=w;if(n<=0)return seq;}return arr[arr.length-1][0];}
function makeWantedQuest(rep=15,rng=Math.random,rosterPaths=[]){const w=WANTED_TARGETS[Math.floor(rng()*WANTED_TARGETS.length)];const pathKey=PATH_KEYS.includes(String(w.path).toLowerCase().replace(/ /g,'_'))?String(w.path).toLowerCase().replace(/ /g,'_'):null;const seq=Math.min(maxContractSequence(rep),Math.max(5,8-Math.floor(rep/30)));return {id:newId('w'),name:`The Red Knife`,brief:w.story,story:w.story,target:w.target,knownPath:w.path,threat:w.threat,lastSeen:w.lastSeen,objectiveText:`Capture or kill ${w.target}`,objective:'combat',difficultySequence:seq,encounter:true,mundane:false,requiredPath:pathKey,rewards:{funds:w.rewardFunds,reputation:w.rewardRep,materials:{[pathOf(rosterPaths[0]||'fool').material]:w.rewardMaterials}},tags:['wanted','bounty'],dayCost:1};}

function makeQuest(rng=Math.random,min=9,max=10,rep=0,rosterPaths=[]){
 const mundane=rep<G9D.system.contracts.mundane_max_reputation+1 && rng()<G9D.system.contracts.mundane_base_chance; let tpl;
 if(mundane) tpl=pick(rng,QUEST_TEMPLATES.slice(0,2)); else {const pool=rep>=80?QUEST_TEMPLATES.slice(2):rep>=50?QUEST_TEMPLATES.slice(2,7):rep>=30?QUEST_TEMPLATES.slice(2,6):QUEST_TEMPLATES.slice(2,5);tpl=pick(rng,pool.length?pool:QUEST_TEMPLATES.slice(0,2));}
 let difficultySequence=10;
 if(!mundane){difficultySequence=weightedSequence(rng,rep); if(tpl[2]==='mystery')difficultySequence=Math.min(difficultySequence,Math.max(8,maxContractSequence(rep)));}
 const pathPool=rosterPaths.length?rosterPaths:PATH_KEYS; const materialPath=pick(rng,pathPool); const mat=pathOf(materialPath).material;
 const baseFunds=mundane?randRange(rng,45,95):tpl[2]==='mystery'?randRange(rng,150,260):randRange(rng,260,500);
 const repGain=mundane?Math.max(0,Math.min(2,10-rep)):tpl[2]==='mystery'?3:5;
 const rewardScale=mundane?1-Math.min(rep,10)*.035:1+Math.min(rep,80)*.008;
 const materials=mundane?1:Math.max(1,Math.round(2+(10-difficultySequence)*.45));
 return {id:newId('q'),name:tpl[0],brief:tpl[1],story:tpl[1],requiredPath:null,tags:[tpl[2],pick(rng,tags)],difficultySequence,objective:tpl[0]==='A Missing Cat'?'rescue':mundane?'investigation':'combat',encounter:!mundane && tpl[0]!=='A Missing Cat',mundane,materialPath,rewards:{funds:Math.max(25,Math.round(baseFunds*rewardScale)),reputation:repGain,materials:{[mat]:materials}},dayCost:tpl[2]==='mystery'?1:1};
}
function guildQuestTier(rep){return rep>=80?4:rep>=50?3:rep>=30?2:rep>=15?1:0;}
function questCountForReputation(rep){if(rep<5)return 2;if(rep<15)return 3;if(rep<30)return 4;if(rep<50)return 4;if(rep<80)return 5;return 6;}
function makeQuestBoard(count=null,seed=Date.now(),rep=0,rosterPaths=[]){const rng=(()=>{let x=(seed+7777)>>>0;return()=>((x=Math.imul(1664525,x)+1013908577)>>>0)/4294967296;})();const n=count==null?questCountForReputation(rep):Math.min(count,questCountForReputation(rep));const board=Array.from({length:n},(_,i)=>{if(rep<5&&!rosterPaths.length)return makeQuest(()=>.01,9,10,rep,rosterPaths);return makeQuest(rng,9,10,rep,rosterPaths);});if(rosterPaths.length&&board.every(q=>!q.encounter))board[board.length-1]=makeQuest(()=>.99,9,10,Math.max(5,rep),rosterPaths);return board;}

