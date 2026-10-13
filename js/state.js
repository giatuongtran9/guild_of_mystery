// ===== state.js =====
const SAVE_VERSION=16;
const KEY="guild-rpg-browser-v9";
const cloneS=x=>JSON.parse(JSON.stringify(x));
let saveLoadError=null;
function saveError(){return saveLoadError;}
function recruitmentSeed(s){
 let hash=Number(s.worldSeed)||2166136261;
 for(const ch of `${s.day}:${s.recruitmentRollCounter||0}:${s.roster?.[0]?.id||'guild'}`)hash=Math.imul(hash^ch.charCodeAt(0),16777619)>>>0;
 return hash;
}
function refreshRecruitmentIfDue(s){
 if(s.recruitPool?.length&&s.day<(s.recruitRefreshDay||s.day+7))return false;
 s.recruitmentRollCounter=(s.recruitmentRollCounter||0)+1;
 s.recruitPool=makeRecruitPool(TRAIT_DATA.poolSize,recruitmentSeed(s),s.reputation);
 s.recruitRefreshDay=s.day+7;return true;
}
function advanceGuildDay(s,_legacyDays=0,now=Date.now()){
 const today=dayjs(now).startOf('day'),before=s.day;
 if(s.calendar?.version!==1||!dayjs(s.calendar.originDate).isValid()||!Number.isFinite(s.calendar.originDay))s.calendar={version:1,originDate:today.format('YYYY-MM-DD'),originDay:s.day};
 s.day=Math.max(s.day,s.calendar.originDay+Math.max(0,today.diff(dayjs(s.calendar.originDate).startOf('day'),'day')));
 s.calendar.currentDate=today.format('YYYY-MM-DD');
 refreshRecruitmentIfDue(s);maintainMarket(s);maintainPathwayInventories(s);maintainGuildBoards(s);return s.day-before;
}
const CONTRACT_POOL=G9D.contracts.pool;
const contractDefinition=id=>CONTRACT_POOL.definitions.find(d=>d.id===id);
function contractSeed(s,label){let h=Number(s.worldSeed)||2166136261;for(const c of `${s.day}:${label}`)h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h;}
function poolRandom(pool){pool.rngState=(Math.imul(1664525,pool.rngState)+1013904223)>>>0;return pool.rngState/4294967296;}
function validateContractPool(s){
 const fresh=s.contractPool?.version!==CONTRACT_POOL.version;
 if(fresh){
  s.contractPool={version:CONTRACT_POOL.version,rngState:contractSeed(s,'pool'),available:{},reservations:{},cooling:[],lastRefreshDay:s.day,boardCapacity:0};
  // A resolved legacy battle must settle once, outside the new finite stock.
  s.quests=s.pendingContract?.quest?.kind!=='wanted'&&s.pendingContract?.quest?[s.pendingContract.quest]:[];
 }
 const pool=s.contractPool;
 if(!Number.isInteger(pool.rngState))pool.rngState=contractSeed(s,'pool');
 if(!Number.isFinite(pool.lastRefreshDay))pool.lastRefreshDay=s.day;
 pool.cooling=Array.isArray(pool.cooling)?pool.cooling:[];
 const used={},reservations={},quests=[],seen=new Set();
 const take=id=>{const def=contractDefinition(id);if(!def||(used[id]||0)>=def.copies)return false;used[id]=(used[id]||0)+1;return true;};
 const pending=s.pendingContract?.quest;
 if(pending?.poolDefinitionId&&take(pending.poolDefinitionId))reservations[pending.id]={definitionId:pending.poolDefinitionId,location:'pending'};
 // Reconcile authoritative placements, not a stale available-count cache.
 pool.cooling=pool.cooling.filter(c=>Number.isFinite(c.readyDay)&&c.readyDay>s.day&&take(c.definitionId));
 for(const quest of s.quests||[]){
  if(!quest?.id||seen.has(quest.id))continue;seen.add(quest.id);
  if(quest.id===pending?.id){quests.push(pending);continue;}
  const def=contractDefinition(quest.poolDefinitionId);
  if(!def||quest.difficultySequence!==def.sequence||!Number.isInteger(quest.enemySeed)||!take(def.id))continue;
  quests.push(quest);reservations[quest.id]={definitionId:def.id,location:'posted'};
 }
 s.quests=quests;pool.reservations=reservations;
 pool.available=Object.fromEntries(CONTRACT_POOL.definitions.map(def=>[def.id,def.copies-(used[def.id]||0)]));
 return fresh;
}
function contractPoolStock(s,sequence){return CONTRACT_POOL.definitions.filter(d=>d.sequence===sequence).reduce((n,d)=>n+(s.contractPool?.available[d.id]||0),0);}
function returnPostedContract(s,quest){
 const pool=s.contractPool,reservation=pool.reservations[quest.id];
 if(reservation?.location==='pending')return false;
 if(reservation){pool.available[reservation.definitionId]++;delete pool.reservations[quest.id];}
 s.quests=s.quests.filter(q=>q.id!==quest.id);if(s.teams)delete s.teams[quest.id];return true;
}
function postPoolContract(s,sequence=null,protection=null){
 const pool=s.contractPool;
 const local=protection?rand(contractSeed(s,protection+':'+sequence)):()=>poolRandom(pool);
 if(sequence===null){
  const choices=Object.entries(reputationRank(s.reputation).sequenceOdds).filter(([seq,w])=>w>0&&contractPoolStock(s,Number(seq))>0);
  let roll=local()*choices.reduce((n,[seq,w])=>n+w,0);
  for(const [seq,w]of choices){roll-=w;if(roll<0){sequence=Number(seq);break;}}
 }
 const choices=CONTRACT_POOL.definitions.filter(d=>d.sequence===sequence&&pool.available[d.id]>0);
 let roll=local()*choices.reduce((n,d)=>n+pool.available[d.id],0),def=null;
 for(const d of choices){roll-=pool.available[d.id];if(roll<0){def=d;break;}}
 if(!def)return null;
 const seed=protection?contractSeed(s,protection+':'+def.id):Math.floor(local()*4294967296),r=rand(seed);
 const quest=makeQuest(r,9,10,s.reputation,s.roster||[],sequence);
 Object.assign(quest,{name:def.title,brief:def.story,story:def.story,poolDefinitionId:def.id,enemySeed:seed,enemyPath:pick(r,PATH_KEYS),encounterVariant:contractEncounterVariant(def.id,r),protectedPost:protection});
 pool.available[def.id]--;pool.reservations[quest.id]={definitionId:def.id,location:'posted'};s.quests.push(quest);return quest;
}
function protectedContractIds(s){
 const ids=new Set(),beginner=s.quests.find(q=>q.difficultySequence===9);if(beginner)ids.add(beginner.id);
 const best=rosterProfile(s.roster||[]).bestSequence;
 const progression=s.quests.find(q=>q.difficultySequence===best)||s.quests.find(q=>q.difficultySequence===Math.min(9,best+1));
 if(progression)ids.add(progression.id);if(s.pendingContract?.quest)ids.add(s.pendingContract.quest.id);return ids;
}
function maintainContractPool(s){
 const fresh=validateContractPool(s),pool=s.contractPool,target=questCountForReputation(s.reputation),daily=pool.lastRefreshDay<s.day;
 if(daily){for(const q of [...s.quests])if(q.id!==s.pendingContract?.quest?.id)returnPostedContract(s,q);pool.lastRefreshDay=s.day;}
 const makeRoom=()=>{if(s.quests.length<target)return;const protectedIds=protectedContractIds(s),q=[...s.quests].reverse().find(q=>!protectedIds.has(q.id));if(q)returnPostedContract(s,q);};
 if(!s.quests.some(q=>q.difficultySequence===9)){makeRoom();postPoolContract(s,9,'beginner');}
 const best=rosterProfile(s.roster||[]).bestSequence;
 if(best!==9&&!s.quests.some(q=>q.difficultySequence===best||q.difficultySequence===best+1)){
  makeRoom();postPoolContract(s,best,'progression')||postPoolContract(s,Math.min(9,best+1),'progression');
 }
 // A declined random slot stays empty until a new day or a paid refresh.
 if(fresh||daily||target>(pool.boardCapacity||0))while(s.quests.length<target){if(!postPoolContract(s))break;}
 pool.boardCapacity=target;
}
function declineContract(s,id){
 maintainContractPool(s);const quest=s.quests.find(q=>q.id===id);
 if(!quest)return {ok:false,reason:'This contract is no longer posted.'};
 if(quest.id===s.pendingContract?.quest?.id)return {ok:false,reason:'Record the saved contract result first.'};
 returnPostedContract(s,quest);maintainContractPool(s);return {ok:true};
}
function refreshContracts(s){
 if(s.pendingContract||s.campaign?.pending)return {ok:false,reason:'Record the saved battle result first.'};
 if(s.funds<CONTRACT_POOL.refreshCost)return {ok:false,reason:`Refreshing contracts requires £${CONTRACT_POOL.refreshCost}.`};
 maintainContractPool(s);const protectedIds=protectedContractIds(s);
 if(s.quests.length>=questCountForReputation(s.reputation)&&s.quests.every(q=>protectedIds.has(q.id)))return {ok:false,reason:'Every current post is protected beginner or progression work.'};
 if(!s.quests.some(q=>!protectedIds.has(q.id))&&!Object.values(s.contractPool.available).some(n=>n>0))return {ok:false,reason:'All contract copies are posted or cooling down. Used copies return after three real days.'};
 for(const q of [...s.quests])if(!protectedIds.has(q.id))returnPostedContract(s,q);
 while(s.quests.length<questCountForReputation(s.reputation)){if(!postPoolContract(s))break;}
 s.funds-=CONTRACT_POOL.refreshCost;chronicle(s,`Refreshed the contract board for £${CONTRACT_POOL.refreshCost}.`);return {ok:true};
}
function reserveContractDispatch(s,quest){
 if(s.pendingContract)return {ok:false,reason:'A saved contract is already awaiting settlement.'};
 if(![...(s.quests||[]),...(s.wanted||[])].some(q=>q.id===quest.id))return {ok:false,reason:'This contract is no longer posted.'};
 const reservation=s.contractPool?.reservations[quest.id];if(reservation)reservation.location='pending';return {ok:true};
}
function coolCompletedContract(s,quest){
 const pool=s.contractPool,reservation=pool?.reservations[quest.id];if(!reservation)return;
 delete pool.reservations[quest.id];pool.cooling.push({definitionId:reservation.definitionId,readyDay:s.day+CONTRACT_POOL.returnDays});
}
function maintainGuildBoards(s){
 const roster=(s.roster||[]).filter(a=>a.awakened&&a.status==='active');
 maintainContractPool(s);
 s.defeatedBosses=Array.isArray(s.defeatedBosses)?s.defeatedBosses:[];
 const active=roster.filter(a=>a.unitType!=='marionette');
 const eligible=WANTED_TARGETS.filter(b=>s.reputation>=b.minReputation&&active.filter(a=>a.sequence<=b.sequence).length>=3&&!s.defeatedBosses.includes(b.id)&&s.bossDeferrals?.[b.id]!==s.day);
 s.wanted=(s.wanted||[]).filter(q=>q.bossId&&eligible.some(b=>b.id===q.bossId));
 for(const b of eligible)if(!s.wanted.some(q=>q.bossId===b.id))s.wanted.push(makeWantedQuest(s.reputation,()=>.5,roster,b.id));
}
function settleContract(s){
 const pending=s.pendingContract;
 if(!pending?.quest||!pending.result)return {ok:false,reason:'There is no saved contract outcome.'};
 const q=pending.quest,res=pending.result,previousBoardSize=s.quests.length;
 if((res.assetOffers||[]).some(o=>o.choice==null))return {ok:false,reason:'Resolve the saved collection choices before recording this outcome.'};
 applyConsequences(s,res.consequences);addMarionettes(s,res);
 const rewards=res.rewards||{funds:0,reputation:0,materials:{}};
 s.funds+=rewards.funds||0;s.reputation+=res.success?(rewards.reputation||0):0;
 if(res.success)for(const [material,amount]of Object.entries(rewards.materials||{}))s.materials[material]=(s.materials[material]||0)+amount;
 coolCompletedContract(s,q);s.quests=s.quests.filter(x=>x.id!==q.id);s.wanted=(s.wanted||[]).filter(x=>x.id!==q.id);if(s.teams)delete s.teams[q.id];
 if(res.success&&q.bossId)s.defeatedBosses=[...new Set([...(s.defeatedBosses||[]),q.bossId])];
 s.pendingContract=null;advanceGuildDay(s);if(q.kind==='contract')while(s.quests.length<Math.min(previousBoardSize,questCountForReputation(s.reputation))){if(!postPoolContract(s))break;}maintainGuildBoards(s);
 chronicle(s,res.success?`${q.name}: contract fulfilled.`:`${q.name}: contract failed.`);
 return {ok:true,success:res.success};
}
function ensureAgentSchema(a){
 // Recommendations are retired. Saved awakened stats remain untouched.
 delete a.recommendedPath;
 if(!a.awakened)a.path=null;
 if(Array.isArray(a.history))a.history=a.history.map(h=>({...h,text:typeof h.text==='string'?h.text.replace(/ Recommended Pathway: [^.]+\.$/,''):h.text}));
 // The old Demoness meter shared corruption's storage. Preserve that value
 // as corruption and copy its charge once into the separate Affliction field.
 if(a.path==='demoness'&&!Number.isFinite(a.affliction))a.affliction=Math.max(0,Math.min(100,Number(a.corruption)||0));
 if(!normalizeTrait(a)){
 if(!a.trait || !TRAITS[a.trait]){
   const old=a.traits||{};
   const map={coward:'Ironclad',cruelty:'Glass Cannon',calm:'Stoic Mind',loyalty:'Stout Vitality',curiosity:'Fervent Spirit',greed:'Glass Cannon',madnessTolerance:'Stoic Mind'};
   const oldKeys=Object.keys(old).filter(k=>k!=='name'&&Number(old[k])>0);
   a.trait=map[oldKeys.sort((x,y)=>(Number(old[y])||0)-(Number(old[x])||0))[0]]||'Stout Vitality';
 }
 a.traits={name:a.trait,desc:TRAITS[a.trait].desc};
 }
 if(!a.statVariance)a.statVariance=rollVariance();
 a.speedVariance=a.speedVariance||a.statVariance.speed;
 clearCombatTransient(a);
 ensurePathwayInventory(a);
 a.status=a.status||'active';a.unitType=a.unitType||'agent';a.weaponId=a.weaponId||'none';a.weaponMastery=a.weaponMastery||{};a.madness=Math.max(0,Math.min(100,a.madness||0));a.corruption=Math.max(0,Math.min(100,a.corruption||0));a.injuries=Math.max(0,Math.min(100,a.injuries||0));a.digest=Math.max(0,Math.min(100,a.digest||0));a.history=a.history||[];a.abilities=a.abilities||[];a.abilityHistory=a.abilityHistory||[];a.recorded=a.recorded||[];a.threadTargets=a.threadTargets||[];a.activeThreads=a.activeThreads||0;a.statusEffects=a.statusEffects||{};for(const p of PATH_KEYS){const cfg=PATH_METERS[p];if(a[cfg.key]==null)a[cfg.key]=0;}return a;
}
function newGame(){const materials={};Object.values(PATHS).forEach(p=>materials[p.material]=2);const s={schema:SAVE_VERSION,worldSeed:Date.now()>>>0,defeatedBosses:[],day:1,funds:1000,reputation:0,materials,weapons:{revolver:2,pistol:2,sword:2,knife:2,club:2,none:99},roster:[],recruitPool:makeRecruitPool(4,Date.now(),0),quests:[],wanted:[],teams:{},recruitRefreshDay:8,chronicle:[{day:1,text:"The guild opens its doors with an empty roster, £1,000, and enough basic materials to awaken one Sequence 9 candidate from every Pathway."}]};campaignEnsure(s);advanceGuildDay(s);return s;}
// v9: stats now come from STAT_TABLE. Rebuild every awakened character's stats from the table using
// their own stored variance and trait, keeping Sequence, abilities, injuries and progress intact.
function restatAgent(a){
  if(!a.awakened||!a.path)return;
  const seq=Math.max(0,Math.min(9,a.sequence));
  if(a.unitType==='marionette'){const t=tableStats(a.path,seq);a.stats={hp:Math.round(t.hp*.55),atk:Math.round(t.atk*.55),def:Math.round(t.def*.55),int:Math.round(t.int*.55)};a.baseStats={...a.stats};return;}
  const base9=statsFromVariance(a,a.path,9);
  a.baseStats={...base9};
  a.stats=statsAtSequence(base9,seq,a.path);
  a.basePathSpeed=basePathSpeed(a.path,seq);
}
function repairAgentCombatCache(a){
  if(!a.awakened||!PATHS[a.path])return;
  a.basePathSpeed=basePathSpeed(a.path,a.sequence);
  a.resistanceBonuses=resistanceBonusesFor(a);
  a.resistances=combatResistances(a);
}
function migrateSave(x){if(!x||typeof x!=='object'||Array.isArray(x))return null;const _origSchema=x.schema||1;x.schema=_origSchema;x.funds=Number.isFinite(x.funds)?x.funds:1000;x.reputation=Number.isFinite(x.reputation)?x.reputation:0;x.day=Number.isFinite(x.day)?x.day:1;x.materials=x.materials||{};for(const p of Object.values(PATHS))if(x.materials[p.material]==null)x.materials[p.material]=2;x.weapons=x.weapons||{revolver:2,pistol:2,sword:2,knife:2,club:2,none:99};x.roster=(Array.isArray(x.roster)?x.roster:[]).map(ensureAgentSchema);x.recruitPool=Array.isArray(x.recruitPool)?x.recruitPool.map(ensureAgentSchema):makeRecruitPool(4,Date.now(),x.reputation);x.quests=Array.isArray(x.quests)?x.quests:makeQuestBoard(null,Date.now(),x.reputation,x.roster.filter(a=>a.awakened).map(a=>a.path));x.wanted=Array.isArray(x.wanted)?x.wanted:[];x.teams=x.teams||{};x.recruitRefreshDay=x.recruitRefreshDay||x.day+7;x.chronicle=x.chronicle||[];for(const a of x.roster){repairAgentCombatCache(a);a.maxSP=maxSPFor(a);if(!Number.isFinite(a.sp))a.sp=a.maxSP;a.cooldowns=a.cooldowns||{};a.weaponMastery=a.weaponMastery||{};if(a.awakened&&a.path&&(_origSchema<15||!a.abilityHistory?.length||a.abilityHistory.length!==10-a.sequence)){a.abilityHistory=pathOf(a.path).sequences.filter(t=>t.sequence>=a.sequence).flatMap(t=>(t.abilities||[]).map(ab=>({sequence:t.sequence,name:t.name,ability:ab.text||t.abilityText||t.ability,type:ab.type,effectId:ab.effectId,damage:ab.damage||null,effects:ab.effects||[],effects:ab.effects||[]})));a.abilities=a.abilityHistory.map(t=>t);}a.introduction=a.introduction||`An ordinary ${a.occupation||'person'} whose life has begun to intersect with the hidden world.`;}if(_origSchema<9){for(const a of x.roster)restatAgent(a);x.chronicle=[{day:x.day,text:'Stat scale updated: characters now use the Sequence stat table (HP, ATK, DEF, INT and base Speed by archetype).'},...x.chronicle].slice(0,200);}if(x.calendar?.version!==1)x.calendar={version:1,originDate:dayjs().format('YYYY-MM-DD'),originDay:x.day,currentDate:dayjs().format('YYYY-MM-DD')};maintainMarket(x);maintainPathwayInventories(x);maintainGuildBoards(x);x.schema=SAVE_VERSION;campaignEnsure(x);return x;}
function loadGame(){
 saveLoadError=null;
 try{
  const keys=[KEY,'guild-rpg-browser-v8','guild-rpg-browser-v6','guild-rpg-browser-v5','guild-rpg-browser-v4','guild-rpg-browser-v3','guild-rpg-browser-v2'];let raw=null;
  for(const k of keys){raw=localStorage.getItem(k);if(raw)break;}if(!raw)return null;
  const x=migrateSave(JSON.parse(raw));if(!x)throw new Error('Invalid saved guild');const due=cloneS(x);advanceGuildDay(due);if(JSON.stringify(due)!==JSON.stringify(x)){if(saveGame(due))return due;return x;}saveGame(x);return x;
 }catch{saveLoadError='The saved guild could not be loaded. Reload to retry, or reset the guild to replace it.';return null;}
}
function saveGame(s,{reset=false}={}){
 if(saveLoadError&&!reset)return false;
 try{localStorage.setItem(KEY,JSON.stringify(s));if(reset)saveLoadError=null;return true;}catch{return false;}
}
function clearSave(){try{localStorage.removeItem(KEY);saveLoadError=null;return true;}catch{return false;}}
function chronicle(s,text){s.chronicle=[{day:s.day,text},...(s.chronicle||[])].slice(0,200);}
function noteAgent(a,day,text){a.history=[...(a.history||[]),{day,text}];}
function effectiveStats(a){const injuryFactor=1-Math.min(.30,(a.injuries||0)/100*.30),stats=balancedStats(a.stats,a.path,a.sequence);return Object.fromEntries(['hp','atk','def','int'].map(key=>[key,Math.max(1,Math.round(stats[key]*injuryFactor))]));}
function applyConsequences(state,cs){for(const c of cs||[]){if(c.type==='newUnit'){state.roster.push(c.unit);chronicle(state,c.text);continue;}const a=state.roster.find(x=>x.id===c.agentId);if(!a)continue;ensureAgentSchema(a);if(c.type==='syncAgent'&&c.agent){Object.assign(a,cloneS(c.agent));clearCombatTransient(a);ensurePathwayInventory(a);a.status='active';continue;}if(c.type==='death'||c.type==='corruptedDeath'){a.status='dead';if(c.type==='corruptedDeath'){a.madness=100;a.corruption=100;}}if(c.type==='madness')a.madness=Math.min(100,a.madness+c.amount);if(c.type==='injury')a.injuries=Math.min(100,a.injuries+c.amount);if(c.type==='digest')a.digest=Math.min(100,a.digest+c.amount);if(c.type==='statGain')a.stats[c.stat]+=c.amount;noteAgent(a,state.day,c.text||'A consequence changed this character.');chronicle(state,`${a.name} — ${c.text||c.type}`);}state.roster=state.roster.filter(a=>a.status==='active');const owners=new Set(state.roster.filter(a=>a.unitType!=='marionette').map(a=>a.id));state.roster=state.roster.filter(a=>a.unitType!=='marionette'||owners.has(a.ownerId));}
function addMarionettes(state,result){for(const m of result.marionettes||[]){const source=m.source,owner=state.roster.find(x=>x.id===m.ownerId&&x.status==='active');if(!owner||!source)continue;const pct=.55;state.roster.push({id:`mar_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`,name:`${source.name} — Marionette`,occupation:"Marionette",traits:{...owner.traits},stats:{hp:Math.max(1,Math.round(source.maxHp*pct)),atk:Math.max(1,Math.round(source.atk*pct)),def:Math.max(1,Math.round(source.def*pct)),int:Math.max(1,Math.round(source.int*pct))},baseStats:{...source},humanStats:{...source},path:source.path,sequence:source.sequence,awakened:true,status:'active',unitType:'marionette',ownerId:owner.id,digest:100,madness:0,corruption:0,injuries:0,threadTargets:[],activeThreads:0,abilities:[],abilityHistory:[],permanentTraits:['Marionette','Cannot advance','Permanent death'],history:[{day:state.day,text:`Converted into a Marionette by ${owner.name}.`}]});chronicle(state,`${source.name} becomes a Marionette under ${owner.name}.`);}}
function advancementChance(targetSequence){return Number(G9D.system.advancement.success_by_target_sequence[targetSequence]??0);}
function canTrain(state,a){if(!a?.awakened||!PATHS[a.path]||a.unitType==='marionette'||a.status!=='active'||a.sequence<=0)return null;const next=tierFor(a.path,a.sequence-1),mat=pathOf(a.path).material,materialCost=next.cost.material,fundsCost=next.cost.funds;return {next,mat,materialCost,fundsCost,ready:(a.digest||0)>=100,affordable:state.funds>=fundsCost&&(state.materials[mat]||0)>=materialCost,successChance:advancementChance(a.sequence-1)};}
function healCost(a){return {funds:Math.max(35,Math.round(70+(a.injuries||0)*1.5)),material:Math.max(1,Math.ceil((a.injuries||0)/25))};}
function digestGain(quest,individual,agent){
  if(!agent?.awakened||agent.sequence<1||agent.sequence>9)return 0;
  const rules=G9D.system.digestion,base=rules.base_by_sequence[agent.sequence]||0;
  const gap=Number(quest.difficultySequence)-agent.sequence;
  const challenge=gap>=0?rules.easier_rank_multipliers[Math.min(gap,rules.easier_rank_multipliers.length-1)]:Math.min(rules.harder_rank_cap,1-gap*rules.harder_rank_bonus);
  const dispatch=quest.kind==='wanted'?rules.boss_multiplier:individual?rules.individual_multiplier:1;
  return Math.min(100,Math.max(1,Math.round(base*challenge*dispatch)));
}

