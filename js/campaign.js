// The opening case is additive to the contract board. Battle outcomes are saved
// at dispatch and settled once; combat copies never replace persistent agents.
const CAMPAIGN = G9D.campaign;
function campaignEnsure(s){
 const old=s.campaign&&s.campaign.chapterId===CAMPAIGN.id?s.campaign:{};
 const ids=CAMPAIGN.missions.map(m=>m.id),completed=[];
 for(const id of ids){if(!Array.isArray(old.completed)||!old.completed.includes(id))break;completed.push(id);}
 const choices={};for(const m of CAMPAIGN.missions)if(m.choices.some(c=>c.id===old.choices?.[m.id]))choices[m.id]=old.choices[m.id];
 const current=CAMPAIGN.missions[completed.length];
 const pending=old.pending&&current&&old.pending.missionId===current.id&&old.pending.result&&typeof old.pending.result.success==='boolean'&&Array.isArray(old.pending.agentIds)?old.pending:null;
 s.campaign={...old,chapterId:CAMPAIGN.id,completed,choices,clues:Array.isArray(old.clues)?old.clues.filter(c=>c&&typeof c.id==='string'):[],preparation:['ward','supplies'].includes(old.preparation)?old.preparation:null,pending,attempts:old.attempts&&typeof old.attempts==='object'?old.attempts:{},caseFile:completed.length===ids.length?(old.caseFile||{id:CAMPAIGN.id,title:CAMPAIGN.title,badge:'Case Closed',completedDay:s.day}):null};
 return s.campaign;
}
function campaignAgents(s){return (s.roster||[]).filter(a=>a.status==='active'&&a.awakened&&a.unitType!=='marionette'&&PATH_KEYS.includes(a.path)&&Number.isInteger(a.sequence)&&a.sequence>=0&&a.sequence<=9);}
function campaignStatus(s){
 const c=campaignEnsure(s),agents=campaignAgents(s),roster=(s.roster||[]).filter(a=>a.status==='active'&&a.unitType!=='marionette');
 const requirements=[{id:'recruit',label:'Recruit an active agent',done:roster.length>0},{id:'awaken',label:'Awaken an agent to Sequence 9 or higher',done:agents.length>0},{id:'equip',label:'Equip an awakened agent with a weapon',done:agents.some(a=>a.weaponId!=='none'&&!!WEAPONS[a.weaponId])}];
 const current=CAMPAIGN.missions[c.completed.length]||null;
 return {chapter:CAMPAIGN,missions:CAMPAIGN.missions.map(m=>({...m,completed:c.completed.includes(m.id),current:m.id===current?.id,locked:m.number>c.completed.length+1})),current,completedCount:c.completed.length,complete:!current,ready:!!current&&!c.pending&&requirements.every(r=>r.done),requirements,pending:c.pending,eligibleAgents:agents,caseFile:c.caseFile};
}
function campaignEligibility(s,missionId,agentIds=[],choice=null){
 const st=campaignStatus(s),m=st.current;
 const fail=reason=>({ok:false,reason,agents:[],choice:null});
 if(st.pending)return fail('Finish the saved chapter result before starting another mission.');
 if(!m)return fail('This chapter is already complete. Normal contracts remain available.');
 if(m.id!==missionId)return fail('Complete the current chapter mission first.');
 if(!st.requirements.every(r=>r.done))return fail('Recruit, awaken and equip one active agent before accepting the case.');
 if(!Array.isArray(agentIds)||new Set(agentIds).size!==agentIds.length||agentIds.length>3)return fail('Assign one to three different agents.');
 if(m.kind==='combat'&&!agentIds.length)return fail('Assign one to three equipped agents before confronting Vale.');
 const ids=agentIds.length?agentIds:[(st.eligibleAgents.find(a=>a.weaponId!=='none'&&WEAPONS[a.weaponId])||st.eligibleAgents[0]).id];
 const agents=ids.map(id=>st.eligibleAgents.find(a=>a.id===id));
 if(agents.some(a=>!a))return fail('Choose active, awakened guild agents. Marionettes do not take part in this opening case.');
 if(m.kind==='combat'&&agents.some(a=>a.weaponId==='none'||!WEAPONS[a.weaponId]))return fail('Equip each deployed agent before confronting Vale.');
 const selected=m.choices.find(c=>c.id===choice)||null;
 if(m.choices.length&&!selected)return fail('Choose an approach before continuing.');
 return {ok:true,reason:'',agents,choice:selected};
}
function campaignRewards(m,agents){
 const materials={};for(const path of new Set(agents.map(a=>a.path))){const mat=pathOf(path).material;if(m.rewards.materialPerPath)materials[mat]=(materials[mat]||0)+m.rewards.materialPerPath;}
 return {funds:m.rewards.funds,reputation:m.rewards.reputation,materials,digestion:m.rewards.digestion};
}
function campaignCombatCopy(a,preparation){
 const copy=cloneS(a);for(const key of Object.keys(copy))if(key.startsWith('_'))delete copy[key];
 copy.status='active';copy.injuries=0;copy.madness=0;copy.corruption=0;copy.cooldowns={};copy.statusEffects={};copy.threadTargets=[];copy.activeThreads=0;copy.maxSP=maxSPFor(copy);copy.sp=copy.maxSP;
 if(preparation==='supplies'){copy.stats.hp=Math.round(copy.stats.hp*1.25);copy.stats.atk=Math.round(copy.stats.atk*1.15);copy.stats.int=Math.round(copy.stats.int*1.15);}
 return copy;
}
function campaignStart(s,missionId,agentIds=[],choice=null,seed=Date.now()){
 const eligible=campaignEligibility(s,missionId,agentIds,choice);if(!eligible.ok)return eligible;
 const c=s.campaign,m=CAMPAIGN.missions.find(x=>x.id===missionId),agents=eligible.agents,rewards=campaignRewards(m,agents),attempt=(Number(c.attempts[m.id])||0)+1;
 const fixedSeed=Number.isFinite(seed)?Math.trunc(seed):Date.now();
 const quest={id:`campaign_${m.id}`,name:m.title,brief:m.brief,story:m.story,objective:m.kind==='combat'?'combat':'investigation',difficultySequence:9,encounter:m.kind==='combat',mundane:false,enemyCount:1,requiredPath:'darkness',rewards:{funds:0,reputation:0,materials:{}},dayCost:m.kind==='combat'?1:0,campaign:true};
 let result,initialAllies=[],initialEnemies=[];
 if(m.kind==='combat'){
  const members=agents.map(a=>campaignCombatCopy(a,c.preparation)),enemy=cloneS(m.enemy);
  if(c.clues.some(x=>x.id==='counter_chant')){enemy.stats.atk=Math.round(enemy.stats.atk*.85);enemy.stats.int=Math.round(enemy.stats.int*.85);}
  if(c.clues.some(x=>x.id==='hidden_anchor'))enemy.stats.hp=Math.round(enemy.stats.hp*.85);
  if(c.preparation==='ward'){enemy.stats.atk=Math.round(enemy.stats.atk*.75);enemy.stats.int=Math.round(enemy.stats.int*.75);}
  initialAllies=members.map(a=>{const hp=Math.round(effectiveStats(a).hp*(passiveCombatModifier(a).hp||1));return {id:a.id,name:a.name,team:'ally',path:a.path,sequence:a.sequence,unitType:a.unitType,maxHp:hp,hp};});
  result=resolveQuest(members,quest,fixedSeed,{individual:members.length===1,authoredOpponents:[enemy]});
  initialEnemies=[{id:'enemy_0',name:enemy.name,team:'enemy',path:enemy.path,sequence:enemy.sequence,campaignEnemy:true,maxHp:enemy.stats.hp,hp:enemy.stats.hp}];
  // Engine consequences can contain death, stat buffs and battle cooldowns.
  // This protected chapter deliberately settles its own experience only.
  result.consequences=[];result.marionettes=[];result.rewards=result.success?rewards:{funds:0,reputation:0,materials:{},digestion:0};
  result.lines.push({text:result.success?m.successText:m.failureText,kind:result.success?'victory':'story'});
 }else{
  result={success:true,lines:[{text:m.story,kind:'story'},...(eligible.choice?[{text:eligible.choice.outcome,kind:'story'}]:[]),{text:m.successText,kind:'victory'}],events:[],consequences:[],marionettes:[],rewards,dayCost:0,battleSnapshot:{allies:[],enemies:[]}};
 }
 const pending={id:`${CAMPAIGN.id}_${m.id}_${attempt}`,missionId:m.id,missionTitle:m.title,kind:m.kind,choice:eligible.choice?.id||null,agentIds:agents.map(a=>a.id),seed:fixedSeed,result,quest,initialAllies,initialEnemies};
 c.attempts[m.id]=attempt;c.pending=pending;
 return {ok:true,reason:'',pending};
}
function campaignSettle(s){
 const c=campaignEnsure(s),pending=c.pending,m=CAMPAIGN.missions[c.completed.length];
 if(!pending||!m||pending.missionId!==m.id)return {ok:false,reason:'There is no unsettled chapter result.'};
 const success=pending.result.success,rewards=success?pending.result.rewards:{funds:0,reputation:0,materials:{},digestion:0};
 if(success){
  s.funds+=rewards.funds;s.reputation+=rewards.reputation;
  for(const [mat,amount] of Object.entries(rewards.materials||{}))s.materials[mat]=(s.materials[mat]||0)+amount;
  for(const id of pending.agentIds){const a=(s.roster||[]).find(x=>x.id===id&&x.status==='active');if(!a)continue;a.digest=Math.min(100,(a.digest||0)+rewards.digestion);if(m.kind==='combat')gainWeaponMastery(a,weaponFor(a).kind,G9D.system.weapon_mastery.per_completed_contract||2);noteAgent(a,s.day,`${m.title}: +${rewards.digestion}% potion digestion.`);}
  if(pending.choice){c.choices[m.id]=pending.choice;const selected=m.choices.find(x=>x.id===pending.choice);if(selected?.clue&&!c.clues.some(x=>x.id===selected.clue))c.clues.push({id:selected.clue,title:selected.clueTitle,description:selected.benefit});if(m.kind==='preparation')c.preparation=pending.choice;}
  c.completed.push(m.id);
  if(c.completed.length===CAMPAIGN.missions.length)c.caseFile={id:CAMPAIGN.id,title:CAMPAIGN.title,badge:'Case Closed',completedDay:s.day+(pending.result.dayCost||0),clues:cloneS(c.clues)};
 }
 s.day+=pending.result.dayCost||0;
 c.lastAttempt={missionId:m.id,success,attempt:c.attempts[m.id],day:s.day};c.pending=null;
 chronicle(s,success?`${m.title}: ${m.successText}`:`${m.title}: agents recovered safely; the case remains open.`);
 return {ok:true,reason:'',success,missionId:m.id,complete:c.completed.length===CAMPAIGN.missions.length,rewards};
}
