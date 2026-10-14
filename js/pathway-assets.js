// Permanent collections belong to characters; combat vessels and activations do not.
const PATHWAY_COLLECTIONS=Object.freeze({
 fool:{kind:'marionette',name:'Marionette Collection',unlock:5},
 door:{kind:'record',name:'Record Archive',unlock:6},
 hanged_man:{kind:'soul',name:'Grazed Souls',unlock:5},
 death:{kind:'spirit',name:'Bound Spirits',unlock:7},
 hermit:{kind:'formula',name:'Mystic Formulae',unlock:6},
 white_tower:{kind:'doctrine',name:'Tactical Research',unlock:9},
 paragon:{kind:'device',name:'Devices',unlock:6},
 moon:{kind:'beast',name:'Beast Stable',unlock:8},
 visionary:{kind:'conditioning',name:'Mental Conditioning',unlock:6}
});
const PATHWAY_ASSET_DEFINITIONS=Object.freeze({
 copper_turret:{kind:'device',tier:'normal',name:'Copper Turret',atk:1,int:1,hp:1,def:1,description:'A balanced clockwork attacker.',drawback:'Limited vessel HP; no special effect.'},
 glass_lens_turret:{kind:'device',tier:'rare',name:'Glass-Lens Turret',atk:1.25,int:1.25,hp:.7,def:.85,description:'25% stronger attack and intellect than the ordinary device profile.',drawback:'30% less HP and 15% less DEF.'},
 mirror_battery:{kind:'device',tier:'epic',name:'Mirror Battery',atk:.9,int:.9,hp:.65,def:.9,description:'Stores part of actual magical HP damage its owner takes to strengthen its next successful ordinary shot.',drawback:'Fragile vessel; discharge replaces an ordinary shot and cannot charge from reflection.'},
 chronometric_regulator:{kind:'device',tier:'legendary',name:'Chronometric Regulator',atk:1.4,int:1.4,hp:1.1,def:1.05,description:'40% stronger ATK and INT than a Normal vessel. Once per encounter, overclock a native damaging skill on cooldown for 25% more damage using a normal action.',drawback:'Overclock costs 50% more SP and adds one turn to the native skill cooldown. The vessel retains limited HP.'},
 grey_hound:{kind:'beast',tier:'normal',name:'Grey Hound',atk:1,int:1,hp:1,def:1,description:'A balanced beast with ordinary melee attacks.',drawback:'No special effect.'},
 nightfang_wolf:{kind:'beast',tier:'rare',name:'Nightfang Wolf',atk:1.25,int:1.1,hp:.75,def:.9,description:'25% stronger attack than the ordinary beast profile.',drawback:'25% less HP and 10% less DEF.'},
 gravehound:{kind:'beast',tier:'epic',name:'Gravehound',atk:.9,int:.9,hp:.9,def:.8,description:'A successful ordinary attack consumes one enemy Curse for a stronger strike.',drawback:'Sacrifices the remaining Curse ticks; lower ordinary stats.'},
 eclipse_serpent:{kind:'beast',tier:'legendary',name:'Eclipse Serpent',atk:1.4,int:1.3,hp:1.1,def:1.05,description:'40% stronger ATK and 30% stronger INT than a Normal vessel. While deployed, two native damaging spells or Beast Commands can pay HP instead of SP for 25% more spell damage or a 25% stronger commanded strike.',drawback:'Blood-powered casts spend owner HP, cannot make a lethal payment, and keep normal charge, action and cooldown costs. The vessel retains limited HP.'},
 graveguard:{kind:'spirit',name:'Graveguard',atk:.7,int:.6,hp:1.2,def:1.2,description:'Its vessel can take a small portion of one hit for its owner.',drawback:'Weak ordinary attacks.'},
 wailing_shade:{kind:'spirit',name:'Wailing Shade',atk:.8,int:1,hp:.7,def:.7,description:'Its first successful attack weakens enemy damage briefly.',drawback:'Fragile vessel and higher invocation cost.'},
 soul_reaper:{kind:'spirit',name:'Soul Reaper',atk:1.1,int:.8,hp:.8,def:.7,description:'Its ordinary attacks are stronger against an injured enemy.',drawback:'Weak defenses; no protective or healing role.'},
 lantern_spirit:{kind:'spirit',name:'Lantern Spirit',atk:.5,int:.5,hp:1,def:.8,description:'Spends some of its own HP to restore a small amount of owner SP.',drawback:'Low damage; each restoration consumes vessel HP.'},
 warding_constellation:{kind:'formula',name:'Warding Constellation',description:'A native damaging spell sacrifices part of its output to create a personal shield.',drawback:'Less spell damage and a higher SP cost.'},
 blood_inscription:{kind:'formula',name:'Blood Inscription',description:'Up to two native damaging spells may exchange their SP payment for HP.',drawback:'HP payment cannot be lethal; action, cooldown and charge remain.'},
 thorn_tale:{kind:'formula',name:'Thorn Tale',description:'A native damaging spell converts part of its direct damage into a short Curse.',drawback:'Lower immediate damage; ordinary resistance and cleansing apply.'},
 fairy_tale_escape:{kind:'formula',name:'Fairy-Tale Escape',sequence:4,description:'One paid native defensive spell can remove a Curse.',drawback:'The next offensive spell costs more SP; no resurrection or extra action.'},
 barrier_thesis:{kind:'doctrine',name:'Barrier Thesis',description:'The first paid damaging spell partly penetrates an existing shield.',drawback:'That opening spell deals less damage if the target has no shield.'},
 channeling_thesis:{kind:'doctrine',name:'Channeling Thesis',description:'After observing an enemy paid spell, the next ordinary attack partly bypasses DEF.',drawback:'Lower prepared speed.'},
 vitality_thesis:{kind:'doctrine',name:'Vitality Thesis',description:'One qualifying paid attack briefly reduces the target\'s incoming healing.',drawback:'The researcher also receives less healing while prepared.'},
 feint_thesis:{kind:'doctrine',name:'Feint Thesis',description:'After witnessing an enemy control attempt, gain resistance to later control.',drawback:'Lower offensive accuracy; no immunity or longer control duration.'},
 aggression_pattern:{kind:'conditioning',name:'Aggression Pattern',description:'A paid, charged hypnosis makes an enemy favor attacks over support for one turn.',drawback:'Higher hypnosis SP cost; replaces its commanded or skipped action.'}
});
const PATHWAY_LOOT_TIERS=Object.freeze([{tier:'normal',weight:74},{tier:'rare',weight:20},{tier:'epic',weight:5},{tier:'legendary',weight:1}]);
function pathwayCollection(agent){const a=getCombatAgent(agent);return a?.awakened&&a.unitType!=='marionette'?PATHWAY_COLLECTIONS[a.path]||null:null;}
function pathwayAssetCapacity(agent){const a=getCombatAgent(agent),c=pathwayCollection(a);if(!c)return 0;if(c.kind==='soul')return 5;if(c.kind==='record')return a.sequence>6?0:a.sequence===6?1:4;if(c.kind==='conditioning')return 1;if(['formula','doctrine'].includes(c.kind))return 4;return 20;}
function pathwayPreparationLimit(agent){const a=getCombatAgent(agent),c=pathwayCollection(a);return !c?0:c.kind==='marionette'?threadSlots(a.sequence):['record','soul'].includes(c.kind)?pathwayAssetCapacity(a):1;}
function pathwayAssetSpec(asset){const p=PATHS[asset?.sourcePath];if(!p||!asset?.abilityId)return null;for(const tier of p.sequences)for(const spec of tier.abilities||[])if((spec.effectId||spec.id)===asset.abilityId)return {...cloneE(spec),_signatureSourceSequence:tier.sequence};return null;}
function pathwayAssetDefinition(asset){return PATHWAY_ASSET_DEFINITIONS[asset?.definitionId]||null;}
function pathwayAssetName(asset){const d=pathwayAssetDefinition(asset),spec=pathwayAssetSpec(asset);return d?.name||spec?.name||asset?.sourceName||'Unknown asset';}
function pathwayAssetUsable(agent,asset){const a=getCombatAgent(agent),c=pathwayCollection(a);return !!c&&a.sequence<=c.unlock&&asset?.kind===c.kind&&asset.condition==='ready'&&a.sequence<=Number(asset.sequence??9);}
function ensurePathwayInventory(agent){
 const a=getCombatAgent(agent),c=pathwayCollection(a);if(!c)return null;
 const old=a.pathwayInventory&&typeof a.pathwayInventory==='object'&&!Array.isArray(a.pathwayInventory)?a.pathwayInventory:{};
 const seen=new Set(),assets=[];
 for(const raw of Array.isArray(old.assets)?old.assets:[]){
  if(assets.length>=pathwayAssetCapacity(a))break;
  if(!raw||raw.condition==='lost'||typeof raw!=='object'||typeof raw.id!=='string'||!raw.id||raw.id.length>160||seen.has(raw.id)||raw.kind!==c.kind||!Number.isInteger(raw.sequence)||raw.sequence<0||raw.sequence>9)continue;
  const asset=cloneE(raw),d=pathwayAssetDefinition(asset);
  if(['record','soul'].includes(c.kind)&&!pathwayAssetSpec(asset))continue;
  if(['spirit','device','beast','formula','doctrine','conditioning'].includes(c.kind)&&d?.kind!==c.kind)continue;
  if(c.kind==='marionette'&&(!PATHS[asset.profile?.path]||!asset.profile?.stats||!['hp','atk','def','int'].every(k=>Number.isFinite(asset.profile.stats[k])&&asset.profile.stats[k]>0)))continue;
  asset.ownerId=a.id;asset.condition=['ready','wounded','wrecked'].includes(asset.condition)?asset.condition:'ready';
  if(d?.tier)asset.tier=d.tier;seen.add(asset.id);assets.push(asset);
  if(assets.length>=pathwayAssetCapacity(a))break;
 }
 const prepared=[...new Set(Array.isArray(old.prepared)?old.prepared:[])].filter(id=>assets.some(x=>x.id===id)).slice(0,pathwayPreparationLimit(a));
 const progress=old.progress&&typeof old.progress==='object'&&!Array.isArray(old.progress)?old.progress:{};
 a.pathwayInventory={version:1,assets,prepared,policy:['auto','wanted','hold'].includes(old.policy)?old.policy:c.kind==='record'?'wanted':'auto',progress:{contracts:Number.isFinite(Number(progress.contracts))?Math.max(0,Math.min(999999,Math.floor(Number(progress.contracts)))):0,hypnosis:Number.isFinite(Number(progress.hypnosis))?Math.max(0,Math.min(999999,Math.floor(Number(progress.hypnosis)))):0}};
 return a.pathwayInventory;
}
function preparedPathwayAssets(agent){const a=getCombatAgent(agent),inv=a?.pathwayInventory;if(!inv)return [];return (inv.prepared||[]).map(id=>(inv.assets||[]).find(x=>x.id===id)).filter(x=>pathwayAssetUsable(a,x));}
function rollPathwayLootTier(r){let roll=r()*100;for(const item of PATHWAY_LOOT_TIERS){roll-=item.weight;if(roll<0)return item.tier;}return 'legendary';}
function pathwayLootDefinition(kind,tier){return Object.entries(PATHWAY_ASSET_DEFINITIONS).find(([id,d])=>d.kind===kind&&d.tier===tier)?.[0]||null;}
function maintainPathwayInventories(state){for(const a of state.roster||[]){const inv=ensurePathwayInventory(a);if(!inv)continue;for(const asset of inv.assets)if(asset.condition==='wounded'&&Number.isFinite(asset.readyDay)&&state.day>=asset.readyDay){asset.condition='ready';asset.hpRatio=1;delete asset.readyDay;}}}
function changePathwayPreparation(state,agentId,assetId){
 if(state.pendingContract||state.campaign?.pending)return {ok:false,reason:'Record the saved battle result before changing your collection.'};
 const a=(state.roster||[]).find(x=>x.id===agentId&&x.status==='active'),inv=a&&ensurePathwayInventory(a),asset=inv?.assets.find(x=>x.id===assetId);
 if(!asset)return {ok:false,reason:'This asset is no longer in the character\'s collection.'};
 if(inv.prepared.includes(assetId)){inv.prepared=inv.prepared.filter(id=>id!==assetId);return {ok:true};}
 if(!pathwayAssetUsable(a,asset))return {ok:false,reason:'This asset is sealed, damaged or not unlocked at this Sequence.'};
 if(pathwayPreparationLimit(a)===1)inv.prepared=[];if(inv.prepared.length>=pathwayPreparationLimit(a))return {ok:false,reason:'The prepared collection is full.'};inv.prepared.push(assetId);
 return {ok:true};
}
function releasePathwayAsset(state,agentId,assetId){
 if(state.pendingContract||state.campaign?.pending)return {ok:false,reason:'Record the saved battle result before changing your collection.'};
 const a=(state.roster||[]).find(x=>x.id===agentId&&x.status==='active'),inv=a&&ensurePathwayInventory(a);
 if(!inv?.assets.some(x=>x.id===assetId))return {ok:false,reason:'This asset is no longer in the collection.'};
 if(['formula','doctrine','conditioning'].includes(pathwayCollection(a).kind))return {ok:false,reason:'Learned knowledge is retained; unprepare it to change your loadout.'};
 inv.assets=inv.assets.filter(x=>x.id!==assetId);inv.prepared=inv.prepared.filter(id=>id!==assetId);return {ok:true};
}
const PATHWAY_ASSET_RULES=Object.freeze({regularDrop:.5,wantedDrop:1,repairCost:50,recoveryDays:3,learningContracts:3,passiveSP:20,passiveCooldown:3,passiveTurns:2});
const PATHWAY_LEARNING_ORDER=Object.freeze({formula:['warding_constellation','blood_inscription','thorn_tale','fairy_tale_escape'],doctrine:['barrier_thesis','channeling_thesis','vitality_thesis','feint_thesis'],conditioning:['aggression_pattern']});
function pathwayAssetNote(owner,state,lines,text){lines.push({text,kind:'quirk'});emitCombatEvent(state,{type:'status',subtype:'pathway_asset',actorId:owner.id,actorName:owner.name,actorTeam:teamOf(owner,state),text});}
function initializePathwayBattle(state,quest,seed,decisions={}){
 state.assetContext={enabled:['contract','wanted'].includes(quest.kind)&&!decisions.disablePermanentAssets,questKind:quest.kind,questId:quest.id||'encounter',questName:quest.name||'Encounter',day:Number(decisions.day)||1,seed,serial:0};
 state.assetOffers=[];state.assetGains=[];
 for(const u of signatureUnits(state)){
  ensurePathwayInventory(u.agent);
  u._assetHadPreparedCollection=preparedPathwayAssets(u.agent).length>0&&pathwayPolicyAllows(u.agent,state);
  const stats={...u.stats};for(const k of ['hp','atk','def','int']){const factor=(k==='hp'?(GLOBAL_COMBAT.hp||1):1)*Number(GLOBAL_COMBAT.stats?.[u.path]?.[u.sequence]?.[k]??GLOBAL_COMBAT.stats?.[u.path]?.[k]??1);stats[k]=Math.max(1,Math.round(stats[k]/Math.max(.001,factor)));}
  u._assetCaptureStats=stats;
  if(u.path==='door'&&u.sequence<=6)u.agent._signatureRecords=preparedPathwayAssets(u.agent).filter(x=>x.kind==='record').map(x=>({spec:pathwayAssetSpec(x),sourceId:x.sourceId,sequence:x.sequence,assetId:x.id}));
 }
}
function newPathwayAsset(owner,state,fields){const a=getCombatAgent(owner),ctx=state.assetContext||{seed:0,serial:0,questId:'encounter',day:1};ctx.serial=(ctx.serial||0)+1;return {id:`asset_${a.id}_${ctx.seed}_${ctx.serial}`,ownerId:a.id,condition:'ready',sourceContract:ctx.questName||'Encounter',sourceContractId:ctx.questId,acquiredDay:ctx.day,...fields};}
function addPathwayAsset(owner,state,asset,lines=[]){
 const a=getCombatAgent(owner),inv=ensurePathwayInventory(a);if(!inv||inv.assets.some(x=>x.id===asset.id))return false;
 if(inv.assets.length>=pathwayAssetCapacity(a)){if(state.assetContext?.enabled&&teamOf(owner,state)==='ally'){state.assetOffers.push({id:asset.id,ownerId:a.id,asset,choice:null});pathwayAssetNote(owner,state,lines,`${owner.name} finds ${pathwayAssetName(asset)}; choose a replacement when recording the outcome.`);}return false;}
 inv.assets.push(asset);if(pathwayAssetUsable(a,asset)&&inv.prepared.length<pathwayPreparationLimit(a))inv.prepared.push(asset.id);
 if(state.assetContext?.enabled&&teamOf(owner,state)==='ally')state.assetGains.push({ownerId:a.id,asset:cloneE(asset)});
 pathwayAssetNote(owner,state,lines,`${owner.name} acquires ${pathwayAssetName(asset)}.`);return true;
}
function soulAbilityEligible(spec){
 if(!spec||spec._signatureOwned||spec._signatureCopied||spec._assetOwned||!['active','passive'].includes(spec.type))return false;
 const effects=abilityEffects(spec),blocked=['copy_ability','copy_highest','revive','extra_turn','form','reset_state','combat_rule','targeting'];
 if(effects.some(e=>blocked.includes(e.type)||(e.type==='signature'&&e.rule!=='moon_medicine')))return false;
 if(spec.type==='active')return true;
 const allowed=['stat_modifier','damageTaken','damage_taken','crit','critDamage','initiative','counter','dodge','lifesteal','defPen','defense_penetration','hitChance','resistance','immunity','spell_penetration','status_resistance'];
 return effects.length>0&&effects.every(e=>allowed.includes(e.type)&&(e.type!=='stat_modifier'||['atk','def','int','hp'].includes(e.stat)));
}
function pathwayKillOwner(source,state){if(!source)return null;const id=source._assetOwnerId||source._signatureOwnerId||source.ownerId||source.id;return signatureUnits(state).find(u=>u.id===id&&u.alive&&!u.summoned)||null;}
function capturePathwayKill(owner,victim,state,lines=[],r=state.rng){
 const a=getCombatAgent(owner);if(!owner?.alive||owner.summoned||victim.alive||victim.summoned||!victim.path||teamOf(owner,state)===teamOf(victim,state))return false;
 if(a.path==='hanged_man'&&a.sequence<=5){const pool=unlockedAbilities(getCombatAgent(victim)).filter(soulAbilityEligible);if(!pool.length)return false;const spec=pool[Math.min(pool.length-1,Math.floor(r()*pool.length))],sequence=signatureSourceRank(spec,victim),asset=newPathwayAsset(owner,state,{kind:'soul',sourcePath:victim.path,sequence,abilityId:spec.effectId||spec.id,sourceId:victim.id,sourceName:victim.name});
  a._signatureSoul={spec:cloneE(spec),sourceId:victim.id,sequence,assetId:asset.id};if(state.assetContext?.enabled)addPathwayAsset(owner,state,asset,lines);signatureBonus(owner,state);return true;}
 if(a.path==='death'){const archetype=archetypeOf(victim.path),definitionId=['mother','moon','sun'].includes(victim.path)?'lantern_spirit':archetype==='Caster'?'wailing_shade':['Warrior','Physical'].includes(archetype)?'graveguard':'soul_reaper',asset=newPathwayAsset(owner,state,{kind:'spirit',definitionId,sequence:victim.sequence,sourcePath:victim.path,sourceId:victim.id,sourceName:victim.name});if(state.assetContext?.enabled)addPathwayAsset(owner,state,asset,lines);signatureBonus(owner,state);return true;}
 return false;
}
function capturePermanentMarionette(owner,target,unit,state,lines=[]){
 if(!state.assetContext?.enabled||owner.summoned||target.bossDefinition||target.summoned||!owner.alive)return;
 const a=getCombatAgent(target),stats=Object.fromEntries(Object.entries(target._assetCaptureStats||target._originalStats||a.stats).filter(([k])=>['hp','atk','def','int'].includes(k)).map(([k,v])=>[k,Math.max(1,Math.round(v*THREAD_RULES.marionetteStats))]));
 const profile={path:a.path,sequence:a.sequence,name:target.name,stats,trait:a.trait,traitId:a.traitId,traitTier:a.traitTier,traitSource:a.traitSource,statVariance:cloneE(a.statVariance||{}),speedVariance:a.speedVariance||1};
 const asset=newPathwayAsset(owner,state,{kind:'marionette',sourceName:target.name,sourcePath:a.path,sequence:a.sequence,profile,hpRatio:1,sp:unit.sp});
 const kept=addPathwayAsset(owner,state,asset,lines);if(kept||state.assetOffers.some(o=>o.id===asset.id)){unit._assetId=asset.id;unit._assetOwnerId=owner.id;}else unit._assetUnretained=true;
}
function recordPermanentDoorAbility(owner,entry,state,lines=[]){
 if(!state.assetContext?.enabled||owner.summoned)return;
 const a=getCombatAgent(owner),inv=ensurePathwayInventory(a),spec=entry.spec,id=spec.effectId||spec.id;
 if(!PATHS[entry.sourcePath]||inv.assets.some(x=>x.abilityId===id))return;
 const asset=newPathwayAsset(owner,state,{kind:'record',sourcePath:entry.sourcePath,sequence:entry.sequence,abilityId:id,sourceId:entry.sourceId,sourceName:entry.sourceName});
 if(pathwayAssetSpec(asset)&&addPathwayAsset(owner,state,asset,lines))entry.assetId=asset.id;
}
function pathwayVesselAsset(unit,state){const owner=signatureUnits(state).find(u=>u.id===(unit._assetOwnerId||unit._signatureOwnerId||unit.ownerId));return {owner,asset:(owner&&getCombatAgent(owner).pathwayInventory?.assets.find(x=>x.id===unit._assetId))||state.assetOffers?.find(o=>o.id===unit._assetId)?.asset};}
function pathwayVesselDestroyed(unit,state){
 if(!unit._assetId||unit._assetRecalled)return;
 const {asset}=pathwayVesselAsset(unit,state);if(!asset)return;
 asset.hpRatio=0;
 if(asset.kind==='marionette')asset.condition='lost';
 else if(asset.kind==='device')asset.condition='wrecked';
 else {asset.condition='wounded';asset.readyDay=(state.assetContext?.day||1)+PATHWAY_ASSET_RULES.recoveryDays;}
}
function recallPathwayVessel(unit,state){const {asset}=pathwayVesselAsset(unit,state);if(asset&&unit.alive){asset.hpRatio=Math.max(0,Math.min(1,unit.hp/unit.maxHp));if(asset.kind==='marionette')asset.sp=unit.sp;}unit._assetRecalled=true;}
function dismissPathwayOwnedUnits(owner,state){for(const u of signatureUnits(state))if(u!==owner&&(u._assetOwnerId===owner.id||u._signatureOwnerId===owner.id||u.ownerId===owner.id)){if(u.alive)recallPathwayVessel(u,state);u.alive=false;u.inCombat=false;u._assetRecalled=true;}}
function finalizePathwayBattle(state,quest,success,lines=[]){
 for(const u of signatureUnits(state).filter(x=>x._assetId&&x.alive))recallPathwayVessel(u,state);
 for(const owner of state.allies.filter(x=>!x.summoned&&(x.alive||state.retreatedOwners?.has(x.id)))){const inv=owner.agent.pathwayInventory;if(!inv)continue;inv.assets=inv.assets.filter(x=>x.condition!=='lost');inv.prepared=inv.prepared.filter(id=>inv.assets.some(x=>x.id===id));}
 if(state.assetContext?.enabled){
  if(success)for(const kind of ['device','beast']){const owners=state.allies.filter(u=>!u.summoned&&u.alive&&pathwayCollection(u)?.kind===kind&&Math.max(0,(u.agent.madness||0)+(success?-3:12))<100);if(!owners.length)continue;const chance=quest.kind==='wanted'?PATHWAY_ASSET_RULES.wantedDrop:PATHWAY_ASSET_RULES.regularDrop;if(state.rng()>=chance)continue;owners.sort((a,b)=>(a.agent.pathwayInventory.assets.length-b.agent.pathwayInventory.assets.length)||a.id.localeCompare(b.id));const owner=owners[0],tier=rollPathwayLootTier(state.rng),definitionId=pathwayLootDefinition(kind,tier);addPathwayAsset(owner,state,newPathwayAsset(owner,state,{kind,tier,definitionId,sequence:quest.difficultySequence,sourcePath:owner.path,hpRatio:1}),lines);}
  for(const owner of state.allies.filter(u=>!u.summoned&&(u.alive||state.retreatedOwners?.has(u.id))&&Math.max(0,(u.agent.madness||0)+(success?-3:12))<100)){const a=owner.agent,c=pathwayCollection(a),inv=a.pathwayInventory;if(!c||!PATHWAY_LEARNING_ORDER[c.kind]||a.sequence>c.unlock)continue;
   if(c.kind==='conditioning'){if(!a._assetHypnosisSucceeded)continue;inv.progress.hypnosis++;}
   else {if(!success||![a.sequence,Math.min(9,a.sequence+1)].includes(quest.difficultySequence))continue;inv.progress.contracts++;}
   const count=c.kind==='conditioning'?inv.progress.hypnosis:inv.progress.contracts,order=PATHWAY_LEARNING_ORDER[c.kind],earned=Math.min(order.length,Math.floor(count/PATHWAY_ASSET_RULES.learningContracts));
   for(const id of order.slice(0,earned))if(!inv.assets.some(x=>x.definitionId===id))addPathwayAsset(owner,state,newPathwayAsset(owner,state,{kind:c.kind,definitionId:id,sequence:PATHWAY_ASSET_DEFINITIONS[id].sequence??c.unlock,sourcePath:a.path}),lines);
  }
 }
 const survivors=new Set(state.allies.filter(u=>!u.summoned&&(u.alive||state.retreatedOwners?.has(u.id))&&Math.max(0,(u.agent.madness||0)+(success?-3:12))<100).map(u=>u.id));
 state.assetOffers=state.assetOffers.filter(o=>survivors.has(o.ownerId)&&o.asset.condition!=='lost');state.assetGains=state.assetGains.filter(o=>survivors.has(o.ownerId)&&state.allies.find(u=>u.id===o.ownerId)?.agent.pathwayInventory.assets.some(x=>x.id===o.asset.id));
}
function choosePathwayAssetOffer(state,offerId,replaceId=null){
 const pending=state.pendingContract,offer=pending?.result?.assetOffers?.find(o=>o.id===offerId);if(!offer||offer.choice!==null)return {ok:false,reason:'This saved acquisition has already been resolved.'};
 if(replaceId==='decline'){offer.choice='declined';return {ok:true};}
 const consequence=pending.result.consequences?.find(c=>c.type==='syncAgent'&&c.agentId===offer.ownerId),a=consequence?.agent,inv=a&&ensurePathwayInventory(a);if(!inv)return {ok:false,reason:'The owner did not return alive.'};
 if(inv.assets.length>=pathwayAssetCapacity(a)&&!inv.assets.some(x=>x.id===replaceId))return {ok:false,reason:'Choose an existing asset to replace.'};
 if(replaceId){inv.assets=inv.assets.filter(x=>x.id!==replaceId);inv.prepared=inv.prepared.filter(id=>id!==replaceId);}
 inv.assets.push(cloneE(offer.asset));if(pathwayAssetUsable(a,offer.asset)&&inv.prepared.length<pathwayPreparationLimit(a))inv.prepared.push(offer.asset.id);offer.choice='accepted';return {ok:true};
}
function restorePathwayAsset(state,agentId,assetId){
 if(state.pendingContract||state.campaign?.pending)return {ok:false,reason:'Record the saved battle result first.'};
 const a=state.roster.find(x=>x.id===agentId&&x.status==='active'),inv=a&&ensurePathwayInventory(a),asset=inv?.assets.find(x=>x.id===assetId);if(!asset)return {ok:false,reason:'This asset is no longer in the collection.'};
 if(['device','marionette'].includes(asset.kind)){if(asset.condition==='ready'&&(asset.hpRatio??1)>=1)return {ok:false,reason:'This vessel is already restored.'};if(state.funds<PATHWAY_ASSET_RULES.repairCost)return {ok:false,reason:'Restoration requires £50.'};state.funds-=PATHWAY_ASSET_RULES.repairCost;asset.condition='ready';asset.hpRatio=1;delete asset.readyDay;}
 else if(['beast','spirit'].includes(asset.kind)){if(asset.condition==='wounded')return {ok:false,reason:`Recovery completes on day ${asset.readyDay}.`};if((asset.hpRatio??1)>=1)return {ok:false,reason:'This vessel is already healthy.'};asset.condition='wounded';asset.readyDay=state.day+PATHWAY_ASSET_RULES.recoveryDays;}
 else return {ok:false,reason:'This collection does not use vessel recovery.'};
 return {ok:true};
}
function setPathwayAssetPolicy(state,agentId,policy){if(state.pendingContract||state.campaign?.pending)return {ok:false,reason:'Record the saved battle result first.'};const a=state.roster.find(x=>x.id===agentId&&x.status==='active'),inv=a&&ensurePathwayInventory(a);if(!inv||!['auto','wanted','hold'].includes(policy))return {ok:false,reason:'Invalid collection policy.'};inv.policy=policy;return {ok:true};}
function pathwayPolicyAllows(agent,state){const inv=getCombatAgent(agent).pathwayInventory;return !inv||inv.policy==='auto'||inv.policy==='wanted'&&state?.assetContext?.questKind==='wanted';}
function preparedPathwayDefinition(agent,kind){return preparedPathwayAssets(agent).map(pathwayAssetDefinition).filter(Boolean).find(d=>!kind||d.kind===kind)||null;}
function nativePathwayDamage(spec){return spec?.type==='active'&&!spec._signatureOwned&&!spec._signatureCopied&&!spec._assetOwned&&Number(spec.costSP)>0&&((spec.damage?.multiplier||0)>0||abilityEffects(spec).some(e=>e.type==='damage_component'));}
function pathwayResourceEligible(spec){const command=spec?.type==='active'&&!spec._signatureOwned&&!spec._assetOwned&&Number(spec.costSP)>0&&signatureEffects(spec).some(e=>e.rule==='moon_beast');return (nativePathwayDamage(spec)||command)&&!signatureSupportTypes(spec).includes('heal')&&!abilityEffects(spec).some(e=>['revive','form','extra_turn','copy_ability','copy_highest','reset_state'].includes(e.type));}
function pathwayCompanion(owner,state){return signatureUnits(state||{}).find(u=>u.id===owner?._signatureCompanionId&&u.alive&&u.inCombat!==false)||null;}
function pathwayCommandCompanion(owner,state,kind){const unit=pathwayCompanion(owner,state);return unit?._assetId&&unit._signatureCompanionKind===kind&&pathwayPolicyAllows(owner,state)?unit:null;}
function returnRecalledPathwayDevice(owner,state,lines=[]){
 const id=owner._assetReturningDeviceId;delete owner._assetReturningDeviceId;if(!id||!owner.alive||!pathwayPolicyAllows(owner,state))return;
 const old=signatureUnits(state).find(u=>u.id===id),asset=preparedPathwayAssets(owner).find(a=>a.id===old?._assetId);if(!old||!asset||old.hp<=0)return;
 delete old._assetRecalled;old.alive=true;old.inCombat=true;owner._signatureCompanionId=old.id;pathwayAssetNote(owner,state,lines,`${old.name} returns after the historical machine, with its remaining HP.`);
}
function deployPreparedPathwayCompanions(state,lines=[]){
 // Stable across side swaps; only original owners can deploy their collections.
 const owners=signatureUnits(state).filter(u=>u.alive&&!u.summoned&&getCombatAgent(u).unitType!=='marionette').sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
 for(const owner of owners){const a=getCombatAgent(owner);if(owner._assetEntryApplied)continue;owner._assetEntryApplied=true;if(!pathwayPolicyAllows(a,state))continue;
  if(a.path==='fool')for(const asset of preparedPathwayAssets(a).filter(x=>x.kind==='marionette')){if(threadUsage(state,a)>=threadSlots(a.sequence))break;if(!signatureUnits(state).some(u=>u._assetId===asset.id&&u.alive))deployPermanentMarionette(owner,asset,state,lines);}
  else if(a.path==='moon'||a.path==='paragon')createOwnedPathwayCompanion(owner,state,lines,a.path==='moon'?'beast':'device',null,.5);
  if(a.path==='fool'){owner._assetStartingMarionettes=signatureUnits(state).filter(u=>u.alive&&u._assetOwnerId===owner.id&&getCombatAgent(u).unitType==='marionette').length;const profile=pathwayIncomingDamageScale(owner);if(profile!==1)pathwayAssetNote(owner,state,lines,`${owner.name}'s prepared army occupies ${owner._assetStartingMarionettes} control slots; the controller takes ×${profile.toFixed(2)} HP damage after shields this battle.`);}
 }
}
function pathwayAssetAbilities(agent,actor=null,state=null){
 const a=getCombatAgent(agent),result=[];if(!a.pathwayInventory)return result;
 if(a.path==='hanged_man'&&a.sequence<=5&&getMeterValue(a,a.path)>=100){for(const asset of preparedPathwayAssets(a)){const original=pathwayAssetSpec(asset);if(!original||!soulAbilityEligible(original))continue;const passive=original.type==='passive',spec={...cloneE(original),type:'active',id:`asset_soul:${asset.abilityId}`,effectId:`asset_soul:${asset.abilityId}`,name:`Grazed ${original.name}`,text:`Grazed ${original.name} — ${passive?'Manifest this soul for two turns.':original.text}`,costSP:passive?PATHWAY_ASSET_RULES.passiveSP:original.costSP,cooldown:passive?PATHWAY_ASSET_RULES.passiveCooldown:original.cooldown,damage:passive?null:cloneE(original.damage),effects:passive?[{type:'pathway_asset',action:'manifest_soul',assetId:asset.id}]:cloneE(original.effects),_assetOwned:true,_assetId:asset.id,_assetOwnerId:a.id,_signatureOwned:'soul',_signatureOwnerId:a.id,_signatureSourceId:asset.sourceId,_signatureSourceSequence:asset.sequence,_signatureCopied:true,_signatureChargeCost:100};result.push(spec);}}
 if(a.path==='paragon'&&actor){const device=pathwayCompanion(actor,state);if(device?._assetDefinitionId==='chronometric_regulator'&&!a._assetChronoSpent){const locked=a._assetLockedSkills||[],pool=unlockedAbilities(a).filter(s=>nativePathwayDamage(s)&&Number(a.cooldowns?.[s.effectId||s.id])>0&&!locked.includes(s.effectId||s.id)&&!abilityEffects(s).some(e=>['revive','form','extra_turn','copy_ability','copy_highest','reset_state'].includes(e.type))).sort((x,y)=>(y.damage?.multiplier||0)-(x.damage?.multiplier||0));if(pool.length){const original=pool[0],id=original.effectId||original.id;result.push({...cloneE(original),id:`asset_chrono:${id}`,effectId:`asset_chrono:${id}`,name:`Regulated ${original.name}`,text:`Regulated ${original.name} — Overclock once: 25% more damage, 50% more SP, then one extra turn of native cooldown.`,_assetOwned:true,_assetChrono:true,_assetSourceAbilityId:id,_assetId:device._assetId,_assetOwnerId:a.id});}}}
 return result;
}
function pathwayAbilityReady(agent,spec,actor,enemy,state){
 const a=getCombatAgent(agent);if((a._assetLockedSkills||[]).includes(spec.effectId||spec.id))return false;
 if(!spec._assetOwned)return true;
 if(spec._assetOwnerId!==a.id||!pathwayPolicyAllows(a,state))return false;
 const asset=preparedPathwayAssets(a).find(x=>x.id===spec._assetId);if(!asset)return false;
 if(asset.kind==='soul'){if(getMeterValue(a,a.path)<100)return false;if(pathwayAssetSpec(asset)?.type==='passive'&&a._assetManifestation?.assetId===asset.id)return false;}
 if(asset.kind==='marionette'&&(threadUsage(state,a)>=threadSlots(a.sequence)||signatureUnits(state).some(u=>u._assetId===asset.id&&u.alive)))return false;
 if(spec._assetChrono){const device=pathwayCompanion(actor,state);if(device?._assetId!==asset.id||a._assetChronoSpent||!(a.cooldowns?.[spec._assetSourceAbilityId]>0))return false;}
 return true;
}
function pathwayCostMultiplier(agent,spec){
 const a=getCombatAgent(agent);if(spec._assetChrono)return 1.5;if(spec._signatureOwned||spec._assetOwned)return 1;
 const formula=preparedPathwayDefinition(a,'formula');let mult=formula?.name==='Warding Constellation'&&nativePathwayDamage(spec)?1.2:1;
 if(formula?.name==='Fairy-Tale Escape'&&a._assetFairySurcharge&&nativePathwayDamage(spec))mult*=1.25;
 if(preparedPathwayDefinition(a,'conditioning')&&signatureEffects(spec).some(e=>e.rule==='visionary_hypnosis'))mult*=1.25;
 if(preparedPathwayDefinition(a,'spirit')?.name==='Wailing Shade'&&signatureEffects(spec).some(e=>e.rule==='death_summon'))mult*=1.2;
 return mult;
}
function pathwayAbilityQuote(agent,spec,actor,quote){
 const a=getCombatAgent(agent),state=typeof ACTIVE_BATTLE!=='undefined'?ACTIVE_BATTLE?.state:null;
 if((a._assetLockedSkills||[]).includes(spec.effectId||spec.id))return {...quote,ready:false,cooldownReady:false};
 if(quote.resource!=='sp'||!actor||!pathwayResourceEligible(spec)||(a._assetHPConversions||0)>=2)return quote;
 const formula=preparedPathwayDefinition(a,'formula'),companion=pathwayCompanion(actor,state),eligible=formula?.name==='Blood Inscription'||companion?._assetDefinitionId==='eclipse_serpent';if(!eligible)return quote;
 const amount=Math.max(1,Math.ceil(actor.maxHp*.2*quote.normalSP/Math.max(1,maxSPFor(a)))),affordable=actor.hp>amount;
 if(!affordable&&companion?._assetDefinitionId==='eclipse_serpent')return quote;
 return {...quote,amount,resource:'hp',affordable,ready:quote.cooldownReady&&affordable,assetHPConversion:true,assetEclipseBoost:companion?._assetDefinitionId==='eclipse_serpent'};
}
function pathwayAfterPayment(agent,actor,spec,quote,state,lines){
 const a=getCombatAgent(agent);if(a._assetFairySurcharge&&nativePathwayDamage(spec))delete a._assetFairySurcharge;if(quote.assetHPConversion){a._assetHPConversions=(a._assetHPConversions||0)+1;if(quote.assetEclipseBoost){if(spec.damage)spec.damage.multiplier*=1.25;spec._assetEclipseBoost=true;}pathwayAssetNote(actor,state,lines,`${actor.name} converts this spell's SP payment into ${quote.amount} HP (${a._assetHPConversions}/2 uses)${quote.assetEclipseBoost?(spec.damage?'; Eclipse Serpent grants 25% more spell damage':'; Eclipse Serpent grants a 25% stronger commanded strike'):''}.`);}
 if(spec._assetChrono){const companion=pathwayCompanion(actor,state);if(companion)companion._assetChronoSpent=true;a._assetChronoSpent=true;a.cooldowns[spec._assetSourceAbilityId]=(spec.cooldown||0)+2;pathwayAssetNote(actor,state,lines,`${spec.name} bypasses its cooldown with 25% more damage and 50% more SP cost; the native cooldown is extended by one turn.`);}
}
function preparePathwayCast(agent,actor,enemy,state,spec){
 const a=getCombatAgent(agent),owned=cloneE(spec);if(owned._assetChrono&&owned.damage)owned.damage.multiplier*=1.25;if(!nativePathwayDamage(owned))return owned;
 const formula=preparedPathwayDefinition(a,'formula');
 if(formula){owned._assetOriginalSpec=cloneE(spec);owned._assetFormula=formula.name;if(formula.name==='Warding Constellation')owned.damage={...owned.damage,multiplier:owned.damage.multiplier*.8};if(formula.name==='Thorn Tale'){owned.damage={...owned.damage,multiplier:owned.damage.multiplier*.8};owned.effects=[...abilityEffects(owned),{type:'status',status:'curse',duration:1}];}}
 if(preparedPathwayDefinition(a,'doctrine')?.name==='Barrier Thesis'&&!a._assetDoctrineUsed)owned._assetBarrierOpening=true;
 return owned;
}
function pathwayPassiveEffects(agent){const a=getCombatAgent(agent),effects=cloneE(a._assetManifestation?.effects||[]),doctrine=preparedPathwayDefinition(a,'doctrine');
 if(doctrine?.name==='Feint Thesis'){effects.push({type:'hitChance',amount:-.08});if(a._assetObservedControl)for(const status of ['stunned','freeze','frozen','sleep','bound','banished','polymorphed','unconscious','silenced','confused'])effects.push({type:'status_resistance',status,amount:.2});}return effects;
}
function pathwaySpeedMultiplier(agent){return preparedPathwayDefinition(agent,'doctrine')?.name==='Channeling Thesis' ? .92 : 1;}
function pathwayHealingMultiplier(unit){const own=preparedPathwayDefinition(getCombatAgent(unit),'doctrine')?.name==='Vitality Thesis' ? .8 : 1;return own*(unit._signatureAssetHealing?.amount!=null?1-unit._signatureAssetHealing.amount:1);}
function applyPathwayAbilityEffect(effect,agent,actor,state,lines=[]){
 const a=getCombatAgent(agent),asset=a.pathwayInventory?.assets.find(x=>x.id===effect.assetId);if(!asset)return;
 if(effect.action==='manifest_soul'){const spec=pathwayAssetSpec(asset),before=passiveCombatModifier(a).hp||1;a._assetManifestation={assetId:asset.id,effects:cloneE(spec.effects),turns:PATHWAY_ASSET_RULES.passiveTurns,grace:!!actor._acting};const after=passiveCombatModifier(a).hp||1;actor.maxHp=Math.max(1,Math.round(actor.maxHp*after/before));actor.hp=Math.min(actor.hp,actor.maxHp);a.resistances=combatResistances(a);pathwayAssetNote(actor,state,lines,`${actor.name} manifests ${spec.name} for two turns; no other soul passive stacks with it.`);}
 if(effect.action==='deploy_marionette')deployPermanentMarionette(actor,asset,state,lines);
}
function deployPermanentMarionette(owner,asset,state,lines=[]){
 const p=asset.profile,a=getCombatAgent(owner),stats=balancedStats(p.stats,p.path,p.sequence),source={...cloneE(p),id:`vessel_${asset.id}`,name:`${p.name} — ${owner.name}'s Marionette`,stats,baseStats:cloneE(p.stats),awakened:true,unitType:'marionette',ownerId:owner.id,weaponId:'none',weaponMastery:{},injuries:0,madness:0,cooldowns:{},sp:Number.isFinite(asset.sp)?asset.sp:maxSPFor(p),maxSP:maxSPFor(p),status:[],statusMeta:{},_combatPrepared:true,_originalStats:cloneE(p.stats),_originalStatus:'active'};
 const maxHp=Math.max(1,Math.round(stats.hp*(passiveCombatModifier(source).hp||1))),u=makeCombatUnit({...source,maxHp,hp:Math.max(1,Math.round(maxHp*(asset.hpRatio??1))),alive:true});u.summoned=true;u._assetId=asset.id;u._assetOwnerId=owner.id;u._revived=true;u._formUsed=u.agent._formUsed=true;u.agent._teamDamageMultiplier=a._teamDamageMultiplier||1;sameSideOf(owner,state).push(u);state.battleMarionettes.push({ownerId:owner.id,unit:u,side:teamOf(owner,state)});pathwayAssetNote(owner,state,lines,`${owner.name} deploys ${u.name}; it occupies one control slot.`);return u;
}
function createOwnedPathwayCompanion(owner,state,lines,kind,duration,strength){
 const a=getCombatAgent(owner),asset=preparedPathwayAssets(a).find(x=>x.kind===kind);if(!asset||!pathwayPolicyAllows(a,state))return null;
 const old=pathwayCompanion(owner,state);if(old){if(old._assetId===asset.id&&getMeterValue(a,a.path)>=100&&old._signatureLifetime<duration){changeMeter(a,a.path,-100);old._signatureLifetime=duration;signatureHeal(owner,old,old.maxHp*.25,state,lines);}return old;}
 const d=pathwayAssetDefinition(asset),budget=balancedStats(tableStats(a.path,asset.sequence),a.path,asset.sequence),stats={hp:Math.max(1,Math.round(Math.min(owner.maxHp,budget.hp)*.25*d.hp)),atk:Math.max(1,Math.round(Math.min(a.stats.atk,budget.atk)*strength*d.atk)),def:Math.max(1,Math.round(Math.min(a.stats.def,budget.def)*.5*d.def)),int:Math.max(1,Math.round(Math.min(a.stats.int,budget.int)*strength*d.int))};
 state._signatureSummonSerial=(state._signatureSummonSerial||0)+1;const source={id:`vessel_${asset.id}_${state._signatureSummonSerial}`,name:`${d.name} — ${owner.name}`,path:a.path,sequence:asset.sequence,stats,awakened:false,trait:'Stout Vitality',weaponId:'none',weaponMastery:{},cooldowns:{},sp:0,maxSP:0,status:[],statusMeta:{},_combatPrepared:true,_originalStats:{...stats},_originalStatus:'active',maxHp:stats.hp,hp:Math.max(1,Math.round(stats.hp*(asset.hpRatio??1))),alive:true};
 const u=makeCombatUnit(source);u.summoned=true;u._assetId=asset.id;u._assetOwnerId=owner.id;u._assetDefinitionId=asset.definitionId;u._signatureOwnerId=owner.id;u._signatureCompanionKind=kind==='spirit'?'undead':kind;if(duration!=null)u._signatureLifetime=duration;else u._assetAutomatic=true;u._formUsed=u.agent._formUsed=true;u._revived=true;u.agent._teamDamageMultiplier=a._teamDamageMultiplier||1;owner._signatureCompanionId=u.id;sameSideOf(owner,state).push(u);pathwayAssetNote(owner,state,lines,`${owner.name} deploys ${d.name}${duration==null?' at battle entry, without SP or an action':` for ${duration} turns`}.`);return u;
}
function pathwayBeforeBasicAttack(actor,target,state,lines=[]){
 const a=getCombatAgent(actor),result={defPen:0,bonus:0,multiplier:1};
 if(preparedPathwayDefinition(a,'doctrine')?.name==='Channeling Thesis'&&a._assetObservedPaidSpell&&!a._assetChannelUsed){result.defPen=.25;a._assetChannelUsed=true;pathwayAssetNote(actor,state,lines,`${actor.name} applies Channeling Thesis to this attack.`);}
 if(actor._assetDefinitionId==='mirror_battery'&&actor._assetMirrorCharge>0){result.bonus=actor._assetMirrorCharge;actor._assetMirrorCharge=0;}
 if(actor._assetDefinitionId==='gravehound'&&hasStatus(target,'curse')){removeStatus(target,'curse');result.multiplier=1.5;pathwayAssetNote(actor,state,lines,`${actor.name} consumes the Curse for its strike, sacrificing the remaining ticks.`);}
 if(actor._assetDefinitionId==='soul_reaper'&&target.hp<target.maxHp*.5)result.multiplier=1.25;
 if(actor._assetBeastCommand){result.multiplier*=1+actor._assetBeastCommand;delete actor._assetBeastCommand;pathwayAssetNote(actor,state,lines,`${actor.name} uses its empowered beast strike.`);}
 if(actor._assetFireCommand?.targetId===target.id){result.defPen+=actor._assetFireCommand.penetration;delete actor._assetFireCommand;pathwayAssetNote(actor,state,lines,`${actor.name} fires through the alchemical mark, ignoring 20% DEF.`);}
 return result;
}
function pathwayBeforeIncoming(attacker,defender,rem,state,lines,r,opt={}){
 if(opt.assetRedirect||opt.reflect||opt.indirect)return rem;
 const guardian=pathwayCompanion(defender,state);if(guardian?._assetDefinitionId==='graveguard'&&!guardian._assetGuardSpent){guardian._assetGuardSpent=true;const redirected=Math.round(rem*.15);if(redirected>0){const pacing=Number(GLOBAL_COMBAT.damage||1)*(1+Math.max(0,(state.currentRound||1)-(GLOBAL_COMBAT.rampStarts||5))*Number(GLOBAL_COMBAT.roundRamp||0));const hit=resolveIncoming(attacker,guardian,redirected/Math.max(1,pacing),state,lines,r,{...opt,assetRedirect:true,indirect:true});emitCombatEvent(state,{type:'damage',actorId:attacker?.id,actorName:attacker?.name,actorTeam:attacker?teamOf(attacker,state):undefined,targetId:guardian.id,targetName:guardian.name,targetTeam:teamOf(guardian,state),amount:hit.hpLoss+hit.absorbed,hpLoss:hit.hpLoss,absorbed:hit.absorbed,damageType:opt.damageType||'physical',hpAfter:guardian.hp,maxHp:guardian.maxHp});rem-=redirected;}}
 return rem;
}
function pathwayAfterDamage(attacker,defender,result,state,lines=[],r,opt={}){
 if(!state)return;
 const battery=pathwayCompanion(defender,state),element=canonicalResistanceElement(opt.trueDamage?'true':opt.damageType||'physical');
 if(battery?._assetDefinitionId==='mirror_battery'&&!opt.reflect&&!opt.assetRedirect&&result.hpLoss>0&&!['physical','true'].includes(element))battery._assetMirrorCharge=Math.min(battery.agent.stats.int*.5,(battery._assetMirrorCharge||0)+result.hpLoss*.25/Math.max(1,result.globalMultiplier||1));
 if(attacker?._assetDefinitionId==='wailing_shade'&&!attacker._assetWailSpent&&result.hpLoss>0&&defender.alive){attacker._assetWailSpent=true;if(r()>=statusResistChance(defender,'weakened')&&addStatus(defender,'weakened',1,attacker.id))pathwayAssetNote(attacker,state,lines,`${attacker.name} weakens ${defender.name} for one turn.`);}
}
function pathwayAfterCast(agent,actor,enemy,state,lines,r,spec,targets=[]){
 const a=getCombatAgent(agent),damaging=nativePathwayDamage(spec);
 for(const observer of foesOf(actor,state).filter(u=>u.alive&&!u.summoned)){const oa=getCombatAgent(observer);if(oa?.path==='white_tower'){if(Number(spec._signaturePaidSP)>0)oa._assetObservedPaidSpell=true;const control=abilityEffects(spec).some(e=>['status','status_chance','skip','banish','silence','mind_control'].includes(e.type))||signatureEffects(spec).some(e=>['visionary_hypnosis','darkness_nightmare'].includes(e.rule));if(control)oa._assetObservedControl=true;}}
 if(spec._assetBarrierOpening)a._assetDoctrineUsed=true;
 if(spec._signatureMisfired||spec._signatureCancelled)return;
 if(spec._assetFormula==='Warding Constellation')signatureHealOrShieldFromFormula(actor,state,lines);
 if(spec._assetFormula==='Fairy-Tale Escape'&&a._assetFairySurcharge&&damaging)delete a._assetFairySurcharge;
 const formula=preparedPathwayDefinition(a,'formula');if(formula?.name==='Fairy-Tale Escape'&&!a._assetFairyUsed&&!spec._signatureOwned&&!damaging&&Number(spec._signaturePaidSP)>0&&signatureSupportTypes(spec).some(t=>['shield','buff'].includes(t))&&hasStatus(actor,'curse')){removeStatus(actor,'curse');a._assetFairyUsed=true;a._assetFairySurcharge=true;pathwayAssetNote(actor,state,lines,`${actor.name} uses Fairy-Tale Escape to cleanse Curse; the next offensive spell costs 25% more SP.`);}
 if(damaging&&preparedPathwayDefinition(a,'doctrine')?.name==='Vitality Thesis'&&!a._assetVitalityUsed&&targets.some(t=>t.alive)){a._assetVitalityUsed=true;for(const t of targets.filter(t=>t.alive))signatureTimed(t,'_signatureAssetHealing',{turns:1,amount:.2});pathwayAssetNote(actor,state,lines,`${actor.name} applies Vitality Thesis: target healing is reduced by 20% for one turn.`);}
}
function signatureHealOrShieldFromFormula(actor,state,lines){const amount=grantShield(actor,actor.maxHp*.05);if(amount>0){pathwayAssetNote(actor,state,lines,`${actor.name}'s Warding Constellation grants ${amount} shield.`);emitCombatEvent(state,{type:'shield',actorId:actor.id,actorName:actor.name,actorTeam:teamOf(actor,state),targetId:actor.id,targetName:actor.name,targetTeam:teamOf(actor,state),amount,shieldAfter:actor.shield});}}
function pathwayTurnStart(unit,state,lines=[]){
 if(unit._assetReturningDeviceId&&!pathwayCompanion(unit,state))returnRecalledPathwayDevice(unit,state,lines);
 if(unit._assetDefinitionId==='lantern_spirit'){const {owner}=pathwayVesselAsset(unit,state);if(owner?.alive&&owner.sp<owner.maxSP&&unit.hp>Math.ceil(unit.maxHp*.1)){unit.hp-=Math.ceil(unit.maxHp*.1);owner.sp=Math.min(owner.maxSP,owner.sp+5);pathwayAssetNote(unit,state,lines,`${unit.name} pays vessel HP to restore 5 SP to ${owner.name}.`);}}
}
function pathwayTurnEnd(unit,state,lines=[]){
 const a=getCombatAgent(unit),manifest=a._assetManifestation;if(manifest){if(manifest.grace)manifest.grace=false;else if(--manifest.turns<=0){const before=passiveCombatModifier(a).hp||1;delete a._assetManifestation;const after=passiveCombatModifier(a).hp||1;unit.maxHp=Math.max(1,Math.round(unit.maxHp*after/before));unit.hp=Math.min(unit.hp,unit.maxHp);a.resistances=combatResistances(a);pathwayAssetNote(unit,state,lines,`${unit.name}'s soul manifestation ends.`);}}
}
