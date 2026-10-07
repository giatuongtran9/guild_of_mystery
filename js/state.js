// ===== state.js =====
const SAVE_VERSION=9;
const KEY="guild-rpg-browser-v9";
const cloneS=x=>JSON.parse(JSON.stringify(x));
function ensureAgentSchema(a){
 if(!a.trait || !TRAITS[a.trait]){
   const old=a.traits||{};
   const map={coward:'Ironclad',cruelty:'Glass Cannon',calm:'Stoic Mind',loyalty:'Stout Vitality',curiosity:'Fervent Spirit',greed:'Glass Cannon',madnessTolerance:'Stoic Mind'};
   const oldKeys=Object.keys(old).filter(k=>k!=='name'&&Number(old[k])>0);
   a.trait=map[oldKeys.sort((x,y)=>(Number(old[y])||0)-(Number(old[x])||0))[0]]||'Stout Vitality';
 }
 a.traits={name:a.trait,desc:TRAITS[a.trait].desc};
 if(!a.statVariance)a.statVariance=rollVariance();
 a.speedVariance=a.speedVariance||a.statVariance.speed;
 a.status=a.status||'active';a.unitType=a.unitType||'agent';a.weaponId=a.weaponId||'none';a.weaponMastery=a.weaponMastery||{};a.madness=Math.max(0,Math.min(100,a.madness||0));a.corruption=Math.max(0,Math.min(100,a.corruption||0));a.injuries=Math.max(0,Math.min(100,a.injuries||0));a.digest=Math.max(0,Math.min(100,a.digest||0));a.history=a.history||[];a.abilities=a.abilities||[];a.abilityHistory=a.abilityHistory||[];a.recorded=a.recorded||[];a.threadTargets=a.threadTargets||[];a.activeThreads=a.activeThreads||0;a.statusEffects=a.statusEffects||{};for(const p of PATH_KEYS){const cfg=PATH_METERS[p];if(a[cfg.key]==null)a[cfg.key]=0;}return a;
}
function newGame(){const materials={};Object.values(PATHS).forEach(p=>materials[p.material]=2);const s={schema:SAVE_VERSION,day:1,funds:1000,reputation:0,materials,weapons:{revolver:2,pistol:2,sword:2,knife:2,club:2,none:99},roster:[],recruitPool:makeRecruitPool(4,Date.now(),0),quests:makeQuestBoard(null,Date.now(),0,[]),wanted:makeQuestBoard(1,Date.now()+99,0,[]).map(q=>({...q,name:'Wanted: '+q.name,objective:'combat',encounter:true,mundane:false,difficultySequence:9})),teams:{},recruitRefreshDay:8,chronicle:[{day:1,text:"The guild opens its doors with an empty roster, £1,000, and enough basic materials to awaken one Sequence 9 candidate from every Pathway."}]};campaignEnsure(s);return s;}
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
function migrateSave(x){if(!x||typeof x!=='object')return null;const _origSchema=x.schema||1;x.schema=_origSchema;x.funds=Number.isFinite(x.funds)?x.funds:1000;x.reputation=Number.isFinite(x.reputation)?x.reputation:0;x.day=Number.isFinite(x.day)?x.day:1;x.materials=x.materials||{};for(const p of Object.values(PATHS))if(x.materials[p.material]==null)x.materials[p.material]=2;x.weapons=x.weapons||{revolver:2,pistol:2,sword:2,knife:2,club:2,none:99};x.roster=(Array.isArray(x.roster)?x.roster:[]).map(ensureAgentSchema);x.recruitPool=Array.isArray(x.recruitPool)?x.recruitPool:makeRecruitPool(4,Date.now(),x.reputation);x.quests=Array.isArray(x.quests)?x.quests:makeQuestBoard(null,Date.now(),x.reputation,x.roster.filter(a=>a.awakened).map(a=>a.path));x.wanted=Array.isArray(x.wanted)?x.wanted:[];x.teams=x.teams||{};x.recruitRefreshDay=x.recruitRefreshDay||x.day+7;x.chronicle=x.chronicle||[];for(const a of x.roster){a.maxSP=maxSPFor(a);if(!Number.isFinite(a.sp))a.sp=a.maxSP;a.cooldowns=a.cooldowns||{};a.weaponMastery=a.weaponMastery||{};if(a.awakened&&a.path&&(!a.abilityHistory?.length||a.abilityHistory.length!==10-a.sequence)){a.abilityHistory=pathOf(a.path).sequences.filter(t=>t.sequence>=a.sequence).flatMap(t=>(t.abilities||[]).map(ab=>({sequence:t.sequence,name:t.name,ability:ab.text||t.abilityText||t.ability,type:ab.type,effectId:ab.effectId,damage:ab.damage||null,effects:ab.effects||[],effects:ab.effects||[]})));a.abilities=a.abilityHistory.map(t=>t);}a.introduction=a.introduction||`An ordinary ${a.occupation||'person'} whose life has begun to intersect with the hidden world.`;}if(_origSchema<9){for(const a of x.roster)restatAgent(a);x.chronicle=[{day:x.day,text:'Stat scale updated: characters now use the Sequence stat table (HP, ATK, DEF, INT and base Speed by archetype).'},...x.chronicle].slice(0,200);}x.schema=SAVE_VERSION;campaignEnsure(x);return x;}
function loadGame(){try{const keys=[KEY,'guild-rpg-browser-v8','guild-rpg-browser-v6','guild-rpg-browser-v5','guild-rpg-browser-v4','guild-rpg-browser-v3','guild-rpg-browser-v2'];let raw=null;for(const k of keys){raw=localStorage.getItem(k);if(raw)break;}if(!raw)return null;const x=migrateSave(JSON.parse(raw));if(!x)return null;saveGame(x);return x;}catch{return null;}}
function saveGame(s){try{localStorage.setItem(KEY,JSON.stringify(s));return true;}catch{return false;}}
function clearSave(){try{localStorage.removeItem(KEY)}catch{}}
function chronicle(s,text){s.chronicle=[{day:s.day,text},...(s.chronicle||[])].slice(0,200);}
function noteAgent(a,day,text){a.history=[...(a.history||[]),{day,text}];}
function effectiveStats(a){const injuryFactor=1-Math.min(.30,(a.injuries||0)/100*.30);return {hp:Math.max(1,Math.round(a.stats.hp*injuryFactor)),atk:Math.max(1,Math.round(a.stats.atk*injuryFactor)),def:Math.max(1,Math.round(a.stats.def*injuryFactor)),int:Math.max(1,Math.round(a.stats.int*injuryFactor))};}
function applyConsequences(state,cs){for(const c of cs||[]){if(c.type==='newUnit'){state.roster.push(c.unit);chronicle(state,c.text);continue;}const a=state.roster.find(x=>x.id===c.agentId);if(!a)continue;ensureAgentSchema(a);if(c.type==='syncAgent'&&c.agent){Object.assign(a,cloneS(c.agent));a.status='active';continue;}if(c.type==='death'||c.type==='corruptedDeath'){a.status='dead';if(c.type==='corruptedDeath'){a.madness=100;a.corruption=100;}}if(c.type==='madness')a.madness=Math.min(100,a.madness+c.amount);if(c.type==='injury')a.injuries=Math.min(100,a.injuries+c.amount);if(c.type==='digest')a.digest=Math.min(100,a.digest+c.amount);if(c.type==='statGain')a.stats[c.stat]+=c.amount;noteAgent(a,state.day,c.text||'A consequence changed this character.');chronicle(state,`${a.name} — ${c.text||c.type}`);}state.roster=state.roster.filter(a=>a.status==='active');}
function addMarionettes(state,result){for(const m of result.marionettes||[]){const source=m.source,owner=state.roster.find(x=>x.id===m.ownerId&&x.status==='active');if(!owner||!source)continue;const pct=.55;state.roster.push({id:`mar_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`,name:`${source.name} — Marionette`,occupation:"Marionette",traits:{...owner.traits},stats:{hp:Math.max(1,Math.round(source.maxHp*pct)),atk:Math.max(1,Math.round(source.atk*pct)),def:Math.max(1,Math.round(source.def*pct)),int:Math.max(1,Math.round(source.int*pct))},baseStats:{...source},humanStats:{...source},path:source.path,sequence:source.sequence,awakened:true,status:'active',unitType:'marionette',ownerId:owner.id,digest:100,madness:0,corruption:0,injuries:0,threadTargets:[],activeThreads:0,abilities:[],abilityHistory:[],permanentTraits:['Marionette','Cannot advance','Permanent death'],history:[{day:state.day,text:`Converted into a Marionette by ${owner.name}.`}]});chronicle(state,`${source.name} becomes a Marionette under ${owner.name}.`);}}
function canTrain(state,a){if(!a||a.unitType==='marionette'||a.status!=='active'||a.sequence<=0)return null;const next=tierFor(a.path,a.sequence-1),mat=pathOf(a.path).material,materialCost=next.cost.material,fundsCost=next.cost.funds;const extraDigest=Math.max(0,(a.digest||0)-100);const chance=Math.min(.95,Math.max(.05,(0.94-(9-a.sequence)*.065)+extraDigest*.0008));return {next,mat,materialCost,fundsCost,ready:(a.digest||0)>=100,affordable:state.funds>=fundsCost&&(state.materials[mat]||0)>=materialCost,successChance:chance};}
function healCost(a){return {funds:Math.max(35,Math.round(70+(a.injuries||0)*1.5)),material:Math.max(1,Math.ceil((a.injuries||0)/25))};}
function digestGain(quest,individual,agent){
  const base=quest.difficultySequence>=8?12:quest.difficultySequence>=6?16:20;
  const seq=Math.max(0,Math.min(9,agent?.sequence??9));
  const lowerSequenceBonus=1+(9-seq)*(G9D.system.digestion.lower_sequence_bonus_per_step||0);
  return Math.min(100,Math.round(base*lowerSequenceBonus*(individual?G9D.system.digestion.individual_multiplier:1)));
}

