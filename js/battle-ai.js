// Deterministic pathway policies select actions; the engine still pays and resolves them.
// Previews never cast, consume a command/charge, or draw from the battle RNG.
const PATHWAY_BATTLE_POLICIES = Object.freeze({
 fool:(c,x)=>x.kind==='thread'?1.12:1,
 door:(c,x)=>x.copy?0.9:(x.id==='spatial_exile'&&c.foes.length===1?0.5:1),
 error:(c,x)=>c.extra&&x.damage>0?1.3:(x.id==='logic_distortion'&&!c.observedDamage?0.4:1),
 visionary:(c,x)=>x.control>0&&!c.enemy._actedThisRound?1.15:(x.id==='dream_tether'&&c.enemy.hp<c.basic*2?0.65:1),
 sun:(c,x)=>x.id==='purification_halo'&&x.heal+x.cleanse+x.strip===0?0.45:1,
 tyrant:(c,x)=>x.id==='ocean_calling'?((c.lightningReady&&!c.enemy._signatureSoaked&&c.foes.length>1)?1.15:0.8):1,
 white_tower:(c,x)=>x.copy?0.92:(x.id==='analysis_weakness'&&c.enemy.shield>0?1.08:1),
 hanged_man:(c,x)=>x.copy?0.92:(x.id==='depravity_mark'&&c.enemy.hp<c.basic*2?0.5:1),
 darkness:(c,x)=>x.id==='dream_slumber'&&hasStatus(c.enemy,'sleep')&&c.charge>=100?1.15:1,
 death:(c,x)=>x.summon>0&&!pathwayCompanion(c.actor,c.state)?1.12:1,
 twilight_giant:(c,x)=>x.id==='guardian_stance'&&c.allies.length>1&&c.urgent?1.15:(x.defense>0&&!c.urgent?0.85:1),
 red_priest:(c,x)=>x.id==='war_command'&&c.allies.length>1?1.12:(x.id==='provocation'&&!c.urgent?0.8:1),
 demoness:(c,x)=>x.id==='witch_s_curse'&&hasStatus(c.enemy,'curse')?0.85:(x.dot>0?1.08:1),
 hermit:(c,x)=>x.copy?0.95:(x.id==='mystic_domain'&&c.enemy.hp<c.basic*2?0.5:1),
 paragon:(c,x)=>x.id==='alchemical_fire'&&pathwayCommandCompanion(c.actor,c.state,'device')?1.08:1,
 wheel_of_fortune:(c,x)=>x.id==='reincarnation_loop'&&x.heal+x.cleanse+x.setup<=0?0:1,
 mother:(c,x)=>x.heal>0&&c.urgent?1.1:(x.id==='life_seed'&&x.heal===0&&x.damage===0?0:1),
 moon:(c,x)=>x.id==='beast_command'&&x.command>0?1.08:1,
 abyss:(c,x)=>x.id==='corrupted_flesh'&&c.enemy._signatureDesire?.ownerId===c.actor.id&&c.charge>=100?1.08:1,
 chained:(c,x)=>x.id==='madness_curse'&&hasStatus(c.actor,'curse')&&c.charge>=100?1.15:1,
 black_emperor:(c,x)=>x.id==='bribe_weakening'&&c.observedSupport?1.08:1,
 justiciar:(c,x)=>x.id==='interdiction_zone'&&!c.observedSupport?0.4:(x.id==='executioner_stance'&&c.enemy.hp<c.basic*2?0.5:1)
});

function battleAIId(spec){return spec?.effectId||spec?.id||'basic_attack';}
function battleAIAmount(e){return Number(e.amount??e.ratio??0);}
function battleAIDuration(e){return e.duration==='next_turn'?1:Math.max(1,Number(e.duration||2));}
function battleAIHistory(unit,state){return state?._abilityHistoryByUnit?.[unit.id]||[];}
function battleAIObserved(unit,state,type){return battleAIHistory(unit,state).some(h=>type==='damage'?Number(h.spec?.damage?.multiplier||h.spec?.scale)>0||abilityEffects(h.spec).some(e=>e.type==='damage_component'):signatureSupportTypes(h.spec).some(t=>['heal','shield','buff'].includes(t)));}
function battleAIStatFraction(agent,key,spec=null){
 const st=agent.stats||{},cfg=G9D.formulas.hybrid_coefficients||{},formula=spec?.damage?.formula||spec?.formula||(archetypeOf(agent.path)==='Physical'?'empowered_hybrid_physical':archetypeOf(agent.path)==='Agility'?'empowered_hybrid_agility':'pure_caster_ability');
 let atk=0,int=0;const components=spec?abilityEffects(spec).filter(e=>e.type==='damage_component'):[];
 if(components.length){const main=Number(spec.damage?.multiplier||spec.scale||0);if((spec.damage?.scaling||spec.stat)==='ATK')atk=main;else int=main;for(const e of components){if(e.stat==='ATK')atk+=Number(e.multiplier||0);if(e.stat==='INT')int+=Number(e.multiplier||0);}}
 else if(formula==='empowered_hybrid_physical'){atk=Number(cfg.empowered_hybrid_physical?.atk_mult??1.05);int=Number(cfg.empowered_hybrid_physical?.int_mult??.3);}
 else if(formula==='empowered_hybrid_agility'){atk=Number(cfg.empowered_hybrid_agility?.atk_mult??.85);int=Number(cfg.empowered_hybrid_agility?.int_mult??.55);}
 else int=1;
 const total=atk*Number(st.atk||0)+int*Number(st.int||0);return total>0?(key==='atk'?atk*Number(st.atk||0):key==='int'?int*Number(st.int||0):0)/total:0;
}
function battleAIOffenseFraction(c,key){
 if(c.offenseFractions?.[key]!==undefined)return c.offenseFractions[key];
 let weight=battleAIStatFraction(c.agent,key);
 for(const s of activeSpecs(c.agent,c.actor,c.state)){const source=signatureCopySource(c.agent,s,c.enemy,c.state);if((s._signatureOwned||source)&&battleAIReady(c.agent,c.actor,c.enemy,c.state,s))weight=Math.max(weight,battleAIStatFraction(c.agent,key,source?source.source.spec:s));}
 // Cache only inside this ephemeral preview context, never on a combat unit.
 // The same legal source collection serves every buff candidate this action.
 c.offenseFractions=c.offenseFractions||{};return c.offenseFractions[key]=weight;
}
function battleAIHealingBlocked(unit){const rt=getCombatAgent(unit)._traitState||{};return hasStatus(unit,'no_heal')||!!resolvedTraitModifiers(unit).noHealing||(hasTrait(unit,'fates_debt')&&Number(rt.healBlockedUntil)>Number(rt.turns||0));}
function battleAIHealableAllies(actor,state){return sameSideOf(actor,state).filter(u=>u.alive&&(hasTrait(actor,'hollow_saint')?canGainShield(u):!battleAIHealingBlocked(u)));}
function battleAIPacing(state){return Number(GLOBAL_COMBAT.damage||1)*(1+Math.max(0,(state.currentRound||1)-(GLOBAL_COMBAT.rampStarts||5))*Number(GLOBAL_COMBAT.roundRamp||0));}
function battleAIHitChance(agent,actor,target,weaponAttack=false){
 if(!target?.alive||hasStatus(target,'untargetable')||!canAffect(agent.sequence,target.sequence))return 0;
 const disabled=actionDisabled(target),forced=Math.max(0,Math.min(1,Number(actor._nextAttackMiss||0)));
 if(!disabled&&hasStatus(target,'evade')&&(target.statusMeta?.evade?.dodgeRate===undefined||Number(target.statusMeta.evade.dodgeRate)>=1))return 0;
 const pm=passiveCombatModifier(agent),ta=getCombatAgent(target),rates=combatRates(ta,target),cfg=G9D.formulas.combat_rates?.dodge||{};
 const dodge=disabled?0:Math.max(.03,Math.min(Number(cfg.max_rate??1),.05+((ta.stats.int-agent.stats.int)/Math.max(1,agent.stats.int))*Number(cfg.int_advantage_coefficient??.25)+Number(rates.dodge||0)-Number(pm.hitChance||0)));
 const miss=Math.max(0,Math.min(.95,(weaponAttack?Number(weaponStats(agent).masteryMiss||0):0)-Number(pm.hitChance||0)+Number(actor._hitChanceDebuff||0)+Number(actor._threadHitDebuff||0)));
 // A prepared retry retains the original contest chance, and cannot beat forced miss.
 const retry=actor.path==='wheel_of_fortune'&&actor._signatureRetry&&getMeterValue(agent,agent.path)>=Number(actor._signatureRetry.chargeCost??100);
 const chance=retry?(1-dodge)*(1-miss)+(dodge*(1-dodge)*(1-miss)+(1-dodge)*miss*(1-miss)):(1-dodge)*(1-miss);
 return (1-forced)*Math.max(0,Math.min(1,chance));
}
function battleAIIncoming(actor,target,raw,state,type='physical',options={}){
 if(raw<=0||!target.alive||hasStatus(target,'untargetable'))return 0;
 if(!options.indirect&&hasStatus(target,'possession_phase')&&matchesIncomingCategory('physical',type))return 0;
 if(!options.indirect&&target._reflect?.negate&&matchesIncomingCategory(target._reflect.incomingCategory,type))return 0;
 if(!options.indirect&&!options.area){for(const k of ['_mythicalShelterOwners','_mythicalConcealOwners'])if((target[k]||[]).some(id=>signatureUnits(state).some(u=>u.id===id&&mythicalActive(u))))return 0;}
 if(!options.indirect&&mythicalActive(target,'white_tower')&&!target._mythicalAuthority.used&&matchesIncomingCategory('magic',type))return 0;
 const incoming=Math.max(0,raw*battleAIPacing(state)*Number(target._vulnerability||1)*(options.dotStatus?Math.max(0,Number(target.bossDefinition?.periodicDamageTakenMultiplier??1)):1));
 const bypass=incoming*Math.min(1,Math.max(0,options.shieldBypass||0));
 const absorbed=matchesIncomingCategory(target._shieldIncomingCategory,type)?Math.min(target.shield||0,incoming-bypass):0;
 const hp=(incoming-absorbed)*(options.execute?1:incomingMultiplier(target,type));
 // Match impact: shield damage is useful and contributes to existing lifesteal.
 return absorbed+Math.min(target.hp,Math.max(0,hp));
}
function battleAIPreviewHeal(actor,target,amount,state){
 if(!target?.alive||amount<=0)return 0;
 if(actor._signatureProhibition||foesOf(actor,state).some(u=>mythicalActive(u,'justiciar')))return 0;
 if(foesOf(actor,state).some(u=>u._signatureRedirect||mythicalActive(u,'black_emperor')&&!u._mythicalAuthority.used))return 0;
 const intended=amount*Number(resolvedTraitModifiers(actor).healingOutput??1)*pathwayHealingMultiplier(target)*Number(GLOBAL_COMBAT.healing??1);
 if(hasTrait(actor,'hollow_saint')){
  const d=traitDefinition(actor),rt=getCombatAgent(actor)._traitState||{},used=rt.budgetRound===(state.currentRound||1)?Number(rt.roundBudgets?.['ward:'+target.id]||0):0;
  const limit=Math.max(0,Math.floor(target.maxHp*d.params.roundCap/100)-used);
  return battleAIPreviewShield(target,Math.min(Math.floor(intended*d.params.conversion/100),limit+(target.shield||0)));
 }
 if(battleAIHealingBlocked(target))return 0;
 return Math.min(target.maxHp-target.hp,Math.max(0,Math.round(intended*Number(resolvedTraitModifiers(target).healingReceived??1)*Number(weaponFor(getCombatAgent(target)).healingReceivedMultiplier||1))));
}
function battleAIPreviewShield(target,amount){if(!canGainShield(target))return 0;return Math.max(0,Math.round(amount*Number(resolvedTraitModifiers(target).shieldReceived??1)*Number(GLOBAL_COMBAT.shield??1))-(target.shield||0));}
function battleAIBasicDamage(agent,actor,target,state,mult=1){
 const pm=passiveCombatModifier(agent),w=weaponStats(agent),wf=weaponFor(agent),rates=combatRates(agent,actor);
 let pen=pm.defPen||0,bonus=0,critExtra=0,guaranteed=false;
 if(!agent._weaponState?.openingSpent){if(wf.rule==='armor_piercer')pen+=.25;if(wf.rule==='last_witness'){pen+=.3;mult*=1.35;}if(wf.rule==='opening_crit'){guaranteed=true;critExtra=wf.tier==='legendary'?.25:0;}}
 if(actor._assetBeastCommand)mult*=1+actor._assetBeastCommand;
 if(actor._assetFireCommand?.targetId===target.id)pen+=actor._assetFireCommand.penetration;
 if(actor._assetDefinitionId==='mirror_battery')bonus=Number(actor._assetMirrorCharge||0);
 if(actor._assetDefinitionId==='gravehound'&&hasStatus(target,'curse'))mult*=1.5;
 if(actor._assetDefinitionId==='soul_reaper'&&target.hp<target.maxHp*.5)mult*=1.25;
 if(preparedPathwayDefinition(agent,'doctrine')?.name==='Channeling Thesis'&&agent._assetObservedPaidSpell&&!agent._assetChannelUsed)pen+=.25;
 const strike=mult*(w.kind==='unarmed'?1+weaponMasteryValue(agent,'unarmed')*.04:1)*(target._weaknessBonus>0?1+target._weaknessBonus:1);
 let raw=v15Damage('basic_physical_attack',{agent,actor,target,weaponBonus:w.atk*w.masteryDamage,strikeMult:strike,defPen:pen})+Math.round(bonus);
 const crit=actor._nextCritFail?0:guaranteed?1:Math.min(.95,rates.crit+(w.crit||0));
 raw*=1+crit*(rates.critDamage+critExtra);
 raw*=traitActive(actor)?1+Number(getCombatAgent(actor)._traitState?.actionBoost||0)/100:1;
 return battleAIIncoming(actor,target,raw,state)*battleAIHitChance(agent,actor,target,true);
}
function battleAIDamage(agent,actor,target,state,spec){
 const effects=abilityEffects(spec),components=effects.filter(e=>e.type==='damage_component').map(e=>({stat:e.stat,multiplier:Number(e.multiplier||0)}));
 const ds={...(spec.damage||{}),...(components.length?{components}:{})};
 let mult=Number(ds.multiplier||spec.scale||0);if(mult<=0&&!components.length)return 0;
 for(const e of effects)if(e.type==='damage_stat_bonus'&&e.stat==='INT')mult*=1+Number(e.amount||0);
 if(agent._damageStatBonus)mult*=agent._damageStatBonus;
 const lowHp=effects.find(e=>e.type==='low_hp_bonus');
 if((agent._lowHpBonus||lowHp)&&actor.hp<actor.maxHp*.5)mult*=1+Number(lowHp?.amount??agent._lowHpBonus);
 if(agent._nextDamageBonus)mult*=1+agent._nextDamageBonus;
 if(spec._assetBarrierOpening&&!(target.shield>0))mult*=.85;
 const td=ds.type==='true'||effects.some(e=>e.type==='damage_rule'&&e.rule==='true'),pt=effects.some(e=>e.type==='damage_rule'&&e.rule==='psychic_true');
 const type=pt?'psychic':td?'true':canonicalResistanceElement(ds.element||ds.type||spec.damageType||'physical');
 let raw=v15Damage(ds.formula||spec.formula||(spec.stat==='ATK'?'empowered_hybrid_physical':'pure_caster_ability'),{agent,actor,target,abilityMult:mult,defPen:defPen(spec,effects),trueDamage:td,psychicTrue:pt,damageSpec:ds});
 raw*=nativeAbilityDamageMultiplier(agent,spec);
 const execute=effects.some(e=>e.type==='execute'&&target.hp/target.maxHp<Number(e.threshold||0));
 if(execute)raw=Math.max(raw,target.hp+(target.shield||0));
 const rates=combatRates(agent,actor),cc=actor._nextCritFail?0:Math.min(.95,rates.crit+effects.filter(e=>e.type==='crit').reduce((a,e)=>a+battleAIAmount(e),0));
 raw*=1+cc*(rates.critDamage+Number(agent._abilityCritDamageBonus||0)+effects.filter(e=>e.type==='critDamage'||e.type==='crit_bonus').reduce((a,e)=>a+battleAIAmount(e),0));
 raw*=traitActive(actor)?1+Number(getCombatAgent(actor)._traitState?.actionBoost||0)/100:1;
 return battleAIIncoming(actor,target,raw,state,td||pt?'true':type,{execute,area:effects.some(e=>e.type==='targeting'&&['all_enemies','up_to_3_enemies'].includes(e.mode)),shieldBypass:spec._assetBarrierOpening&&target.shield>0?.35:0})*battleAIHitChance(agent,actor,target);
}
function battleAIControlValue(c,target,status,chance=1,duration=1){
 if(!target?.alive||hasStatus(target,'untargetable')||!canAffect(c.agent.sequence,target.sequence)||statusImmune(target,status)||hasStatus(target,status))return 0;
 const resistance=Number(combatRates(getCombatAgent(target),target).resistance||0),success=Math.max(0,chance*(1-resistance)*(1-statusResistChance(target,status)));
 if(['stunned','frozen','freeze','sleep','bound','polymorphed','unconscious','banished'].includes(status))return c.threat*success*Number(duration||1)*(target._actedThisRound?.8:1);
 if(status==='silenced')return c.threat*success*(battleAIObserved(target,c.state,'damage')||battleAIObserved(target,c.state,'support')?.8:.25);
 if(['confused','fear','controlled','aggressive'].includes(status))return c.threat*success*.5;
 return 0;
}
function battleAIReady(agent,actor,enemy,state,spec){
 const id=battleAIId(spec),effects=abilityEffects(spec),only=effects.filter(e=>e.type!=='targeting');
 if(spec.type!=='active'||hasStatus(actor,'silenced')||hasStatus(agent,'silenced')||actor._signatureDeniedSkills?.[id]>0||(hasStatus(actor,'root')&&spec.tag==='Escape'))return false;
 if(only.length&&only.every(e=>e.type==='revive'&&e.self)&&!((spec.damage?.multiplier||spec.scale)>0||effects.some(e=>e.type==='damage_component')))return false;
 if(enemy.thread&&effects.some(e=>e.type==='banish'||e.type==='status'&&e.status==='banished'))return false;
 if(!traitAbilityQuote(agent,spec,actor,signatureCastCost(agent,spec,enemy,state)).ready||!signatureReady(agent,spec,enemy,state)||!pathwayAbilityReady(agent,spec,actor,enemy,state))return false;
 if(hasStatus(actor,'aggressive')&&!((spec.damage?.multiplier||spec.scale)>0||effects.some(e=>e.type==='damage_component')||signatureDamaging(spec,actor,enemy,state)))return false;
 if(id==='time_theft'&&!foesOf(actor,state).some(u=>u.alive&&!u._actedThisRound))return false;
 if(effects.some(e=>e.type==='copy_ability')&&!battleAIHistory(enemy,state).length)return false;
 return true;
}
function battleAIContext(agent,actor,enemy,state,actionContext){
 const allies=sameSideOf(actor,state).filter(u=>u.alive&&u.inCombat!==false),foes=foesOf(actor,state).filter(u=>u.alive&&u.inCombat!==false);
 const basic=battleAIBasicDamage(agent,actor,enemy,state),rawBasic=v15Damage('basic_physical_attack',{agent,actor,target:enemy});
 let threat=battleAIBasicDamage(getCombatAgent(enemy),enemy,actor,state);
 // Infer threats from spells actually witnessed, never from the next AI intent.
 const seen=new Set();for(const h of battleAIHistory(enemy,state).slice().reverse()){const id=battleAIId(h.spec);if(seen.has(id))continue;seen.add(id);threat=Math.max(threat,battleAIDamage(getCombatAgent(enemy),enemy,actor,state,h.spec));if(seen.size>=4)break;}
 const hpRatio=actor.hp/Math.max(1,actor.maxHp),danger=actor.hp+Number(actor.shield||0)<=threat*1.35;
 return {agent,actor,enemy,state,allies,foes,basic,unit:Math.max(1,rawBasic*battleAIPacing(state)),threat,hpRatio,urgent:danger||hpRatio<.3,charge:getMeterValue(agent,agent.path),extra:actionContext?.origin==='native_extra',observedDamage:battleAIObserved(enemy,state,'damage'),observedSupport:battleAIObserved(enemy,state,'support'),lightningReady:activeSpecs(agent,actor,state).some(s=>battleAIId(s)==='lightning_bolt'&&traitAbilityQuote(agent,s,actor).ready)};
}
function battleAIAddSignature(c,x,e){
 const {agent,actor,enemy,state}=c,rule=signatureRule(e),full=c.charge>=Number(rule.chargeCost??100),friend=battleAIHealableAllies(actor,state).slice().sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0]||actor;
 switch(e.rule){
 case 'error_theft':if(full&&signatureObserved(actor,enemy,state))x.setup+=c.unit*.3;break;
 case 'error_distortion':if(!enemy._signatureDistortion)x.control+=c.threat*(c.observedDamage?.7:.15)*(1-statusResistChance(enemy,'confused'));break;
 case 'error_parasite':if(!actor._signatureParasite||actor._signatureParasite.turns<=1){
  const hosts=full?c.foes:[enemy],boost=full&&hosts.length===1?1.5:1;
  const drain=hosts.reduce((n,h)=>{const ea=getCombatAgent(h);return n+Math.min(ea.sp||0,(Number(e.drain??e.amount??20)+Number(e.spRatio||0)*(ea.maxSP||0))*boost);},0);
  x.setup+=c.unit*Math.min(.7,drain/Math.max(1,hosts.reduce((n,h)=>n+spTableFor(getCombatAgent(h)).regen,0)));
  const feeding=hosts.filter(h=>Number(getCombatAgent(h).sp)>0).length;
  if(feeding){const cap=Number(e.healingRoundCap||0),budget=actor._signatureParasiteHealing?.round===(state.currentRound||1)?Number(actor._signatureParasiteHealing.used||0):0;
   const tick=actor.maxHp*Number(e.maxHpRatio||0)*feeding,limit=cap>0?Math.floor(actor.maxHp*cap):Infinity;
   const first=battleAIPreviewHeal(actor,actor,Math.min(tick,Math.max(0,limit-budget)),state),later=battleAIPreviewHeal(actor,actor,Math.min(tick,limit),state);
   x.heal+=Math.min(actor.maxHp-actor.hp,first+later*(Math.min(2,battleAIDuration(e))-1));
  }
 }break;
 case 'visionary_hypnosis':if(!enemy._signatureCommand)x.control+=battleAIControlValue(c,enemy,preparedPathwayDefinition(agent,'conditioning')&&full?'aggressive':'stunned',1,rule.duration);break;
 case 'darkness_nightmare':if(hasStatus(enemy,'sleep')&&full)x.damage+=battleAIIncoming(actor,enemy,v15Damage('pure_caster_ability',{agent,actor,target:enemy,abilityMult:rule.amount,damageSpec:{scaling:'INT',element:'psychic',type:'elemental'}}),state,'psychic',{indirect:true})*battleAIHitChance(agent,actor,enemy);break;
 case 'death_summon':{const asset=preparedPathwayAssets(agent).find(a=>a.kind==='spirit'),companion=pathwayCompanion(actor,state);if(asset&&pathwayPolicyAllows(agent,state)){if(!companion){const d=pathwayAssetDefinition(asset),budget=balancedStats(tableStats(agent.path,asset.sequence),agent.path,asset.sequence),st={hp:1,atk:Math.min(agent.stats.atk,budget.atk)*rule.amount*d.atk,int:Math.min(agent.stats.int,budget.int)*rule.amount*d.int,def:1},ua={...agent,stats:st,awakened:false,sp:0,weaponId:'none',pathwayInventory:null};const u={...actor,agent:ua,pathwayInventory:null,summoned:true,_assetBeastCommand:0,_assetFireCommand:null,_formBoost:1};x.summon+=battleAIBasicDamage(ua,u,enemy,state)*Math.min(2,battleAIDuration(e));}else if(full&&companion._signatureLifetime<rule.duration){x.summon+=battleAIBasicDamage(getCombatAgent(companion),companion,enemy,state)*Math.min(2,rule.duration-companion._signatureLifetime);x.heal+=battleAIPreviewHeal(actor,companion,companion.maxHp*.25,state);}}break;}
 case 'giant_guardian':if(full){for(const a of c.allies)x.defense+=battleAIPreviewShield(a,a.maxHp*rule.amount)*.8;x.setup+=c.unit*.3;}break;
 case 'red_war_command':if(full)for(const a of c.allies)if(!a._signatureWarFollow)x.setup+=c.unit*rule.amount*.6;break;
 case 'sun_purify':if(full){for(const a of c.allies)x.cleanse+=['poison','curse'].filter(s=>hasStatus(a,s)).length*c.unit*.35;if(['darkness','death','demoness','abyss','hanged_man'].includes(enemy.path))x.strip+=(enemy.shield||0)+((enemy._fx||[]).some(f=>f.cat==='dtm'||f.cat==='buff'&&f.key==='def')?c.unit*.4:0);}break;
 case 'tyrant_soaked':if(!enemy._signatureSoaked&&c.lightningReady&&c.foes.length>1&&full)x.setup+=c.unit*.35;break;
 case 'tyrant_lightning':if(enemy._signatureSoaked&&full&&c.foes.length>1)x.damage+=c.unit*Number(rule.amount||0);break;
 case 'demoness_affliction':if(full&&c.foes.some(u=>u!==enemy&&!hasStatus(u,'curse'))&&hasStatus(enemy,'curse'))x.dot+=c.unit*.5;break;
 case 'fortune_retry':if(!actor._signatureRetry&&full&&!actor._nextAttackMiss)x.setup+=c.unit*.4;break;
 case 'fortune_calamity':if(!enemy._signatureCalamity)x.setup+=c.unit*(1-battleAIHitChance(getCombatAgent(enemy),enemy,actor))*rule.amount;break;
 case 'fortune_rewind':{const past=(actor._signatureHistory||[]).findLast(h=>h.round<=(state.currentRound||1)-2);if(past){x.heal+=battleAIPreviewHeal(actor,actor,Math.max(0,past.hp-actor.hp),state);if(full)x.cleanse+=(actor.status||[]).filter(s=>CLEANSE_STATUSES.includes(s)).length*c.unit*.4;else if(past.hp<actor.hp)x.risk+=actor.hp-past.hp;x.setup+=(past.fx||[]).filter(f=>f.cat==='buff'&&!(actor._fx||[]).some(now=>now.cat===f.cat&&now.key===f.key&&now.val>=f.val)).length*c.unit*.15;}break;}
 case 'emperor_redirect':if(full&&!actor._signatureRedirect&&c.observedSupport)x.setup+=c.unit*.55;break;
 case 'justiciar_prohibition':if(!enemy._signatureProhibition&&c.observedSupport)x.control+=c.threat*.75;break;
 case 'mother_seed':{const seeded=signatureUnits(state).find(u=>u.id===actor._signatureSeedTargetId),pending=seeded?._signatureSeed,amount=rule.amount*(full?Number(rule.chargedMultiplier??2):1);if(!pending||pending.turns<=1||seeded!==friend||full&&pending.amount<amount)x.heal+=Math.min(friend.maxHp-friend.hp,battleAIPreviewHeal(actor,friend,friend.maxHp*amount,state)*Math.min(2,battleAIDuration(e)));break;}
 case 'moon_medicine':if((actor._signatureMedicine??2)>0||full)x.heal+=battleAIPreviewHeal(actor,friend,friend.maxHp*(Number(e.maxHpRatio??.12)+(full?rule.amount:0)),state);break;
 case 'moon_beast':{const beast=pathwayCommandCompanion(actor,state,'beast');if(beast){if(!beast._assetBeastCommand)x.command+=battleAIBasicDamage(getCombatAgent(beast),beast,enemy,state)*rule.commandBonus;if(full)x.heal+=battleAIPreviewHeal(actor,beast,beast.maxHp*rule.healRatio,state);}else x.damage+=battleAIBasicDamage(agent,actor,enemy,state,rule.fallbackMultiplier);break;}
 case 'moon_blood':if(full)x.heal+=battleAIPreviewHeal(actor,friend,friend.maxHp*rule.amount,state);break;
 case 'paragon_device':{const device=pathwayCommandCompanion(actor,state,'device');if(device){if(!device._assetFireCommand)x.command+=Math.max(0,battleAIBasicDamage(getCombatAgent(device),{...device,_assetFireCommand:{targetId:enemy.id,penetration:rule.penetration}},enemy,state)-battleAIBasicDamage(getCombatAgent(device),device,enemy,state));if(full)x.defense+=battleAIPreviewShield(actor,actor.maxHp*rule.shieldRatio);}break;}
 case 'abyss_desire':if(full&&enemy._signatureDesire?.ownerId===actor.id)x.damage+=battleAIIncoming(actor,enemy,agent.stats.int*rule.amount+Number(enemy._signatureDesire.paidSP||0),state,'fire',{indirect:true})*battleAIHitChance(agent,actor,enemy);else if(!enemy._signatureDesire&&c.observedDamage)x.setup+=c.unit*.25;break;
 case 'chained_release':if(hasStatus(actor,'curse')&&full){x.damage+=battleAIIncoming(actor,enemy,actor.maxHp*rule.amount,state,'dark',{indirect:true});x.cleanse+=c.unit*.15;}else if(!hasStatus(actor,'curse')){
  const delay=Math.max(1,Number(x.spec.cooldown||0)+1),meter=PATH_METERS.chained;
  const projected=c.charge+delay*(Number(meter.gainAction??20)+Number(meter.gainSignature??10));
  const curse=DOT_RULES.find(d=>d[0]==='curse'),cost=actor.maxHp*curse[1]*battleAIPacing(state)*Math.min(delay,Number(rule.duration||1)-1);
  x.risk+=cost;
  if(projected>=Number(rule.chargeCost??100)&&actor.hp>cost+c.threat&&enemy.hp>c.basic*2)x.setup+=battleAIIncoming(actor,enemy,actor.maxHp*rule.amount,state,'dark',{indirect:true})*.55;
 }break;
 }
}
function battleAIEvaluate(c,original){
 const {agent,actor,enemy,state}=c,copy=signatureCopySource(agent,original,enemy,state),copied=copy?signatureOwned(copy.source,agent,copy.kind):original;
 const spec=preparePathwayCast(agent,actor,enemy,state,copied),effects=abilityEffects(spec);
 const x={kind:'ability',spec:original,targetId:enemy.id,id:battleAIId(original),copy:!!copy||!!original._signatureOwned,damage:0,heal:0,defense:0,cleanse:0,strip:0,control:0,setup:0,dot:0,command:0,summon:0,risk:0};
 const targeting=effects.find(e=>e.type==='targeting'),targets=(targeting?.mode==='all_enemies'?c.foes:targeting?.mode==='up_to_3_enemies'?c.foes.slice(0,3):[enemy]).filter(t=>!hasStatus(t,'untargetable')),support=targeting?.mode==='all_allies'?c.allies:[actor];
 for(const t of targets)x.damage+=battleAIDamage(agent,actor,t,state,spec);
 for(const e of effects){const n=battleAIAmount(e),duration=battleAIDuration(e);
  if(e.type==='signature'){battleAIAddSignature(c,x,e);continue;}
  if(e.type==='heal'&&!(e.oncePerBattle&&actor._signatureOnceHeals?.[e.oncePerBattle]))for(const a of support)x.heal+=battleAIPreviewHeal(actor,a,a.maxHp*Number(e.maxHpRatio||0)+(e.scaling==='INT'?agent.stats.int*Number(e.multiplier||0):0),state);
  if(e.type==='shield')for(const a of support)x.defense+=battleAIPreviewShield(a,e.fullHp?a.maxHp:a.maxHp*Number(e.maxHpRatio||0));
  if(e.type==='cleanse')for(const a of support)x.cleanse+=(a.status||[]).filter(s=>CLEANSE_STATUSES.includes(s)).reduce((v,s)=>v+c.unit*(['poison','curse'].includes(s)?.35:.65),0);
  if(['strip_buffs','nullify_buffs'].includes(e.type))for(const t of targets)x.strip+=(t.shield||0)+(t._fx||[]).filter(f=>f.cat==='buff').length*c.unit*.2+(hasStatus(t,'evade')?c.unit:0);
  if(['status','status_chance'].includes(e.type)){
   if(SELF_STATUSES.includes(e.status)){if(!hasStatus(actor,e.status)&&['evade','untargetable','possession_phase'].includes(e.status))x.defense+=c.threat*duration*(e.status==='evade'?Number(e.dodgeRate??1):1);}
   else for(const t of targets){x.control+=battleAIControlValue(c,t,e.status,Number(e.chance??1),duration);const dot=DOT_RULES.find(d=>d[0]===e.status);if(dot&&!hasStatus(t,e.status)&&!statusImmune(t,e.status))x.dot+=battleAIIncoming(actor,t,t.maxHp*dot[1],state,dot[2],{indirect:true,dotStatus:e.status})*Math.min(2,duration)*Number(e.chance??1)*battleAIHitChance(agent,actor,t);}
  }
  if(e.type==='silence')x.control+=battleAIControlValue(c,enemy,'silenced',1,duration);
  if(['skip','banish'].includes(e.type))x.control+=battleAIControlValue(c,enemy,'banished',1,duration);
  if(e.type==='buff'||e.type==='stat_modifier'&&spec.type==='active')for(const a of support){const keys=e.stat==='all'?['atk','def','int']:[e.stat];for(const key of keys)if(Number(a._buffs?.[key]||1)<1+n)x.setup+=c.unit*n*Math.min(2,duration)*(key==='def'?.5:key==='speed'?.4:['atk','int'].includes(key)?(a===actor?battleAIOffenseFraction(c,key):battleAIStatFraction(getCombatAgent(a),key)):0);}
  if(e.type==='debuff'||e.type==='steal_stat'&&e.stat!=='hp'){const current=e.stat==='speed'?enemy._speedDebuff:enemy._debuffs?.[e.stat];if(!(current<1)){let weight=e.stat==='speed'?.35:e.stat==='def'?1:battleAIStatFraction(getCombatAgent(enemy),e.stat);for(const h of battleAIHistory(enemy,state))weight=Math.max(weight,battleAIStatFraction(getCombatAgent(enemy),e.stat,h.spec));x.setup+=c.unit*n*Math.min(2,duration)*weight;if(e.type==='steal_stat'&&['atk','int'].includes(e.stat))x.setup+=c.unit*n*Math.min(2,duration)*battleAIOffenseFraction(c,e.stat);}}
  if(e.type==='steal_stat'&&e.stat==='hp'){x.damage+=Math.min(Math.max(0,enemy.hp-1),enemy.maxHp*n);x.heal+=battleAIPreviewHeal(actor,actor,Math.min(Math.max(0,enemy.hp-1),enemy.maxHp*n),state);}
  if(['damage_taken','damageTaken'].includes(e.type)&&n<0&&!(actor._damageTakenMultiplier<=1+n))x.defense+=c.threat*-n*Math.min(2,duration);
  if(e.type==='reflect'&&(!actor._reflect||actor._reflect.rounds<=1))x.defense+=c.threat*(e.negate?1:Number(e.share||.2))*Math.min(2,duration);
  if(e.type==='next_damage_bonus'&&!agent._nextDamageBonus)x.setup+=c.unit*n;
  if(e.type==='outgoing_damage')x.setup+=c.unit*n*Math.min(2,duration);
  if(e.type==='defense_penetration'&&!spec.damage)x.setup+=Math.min(c.unit,Number(getCombatAgent(enemy).stats.def||0)*.5*n)*Math.min(2,duration);
  if(e.type==='vulnerability'&&!(enemy._vulnerability>1))x.setup+=c.unit*n*Math.min(2,duration);
  if(e.type==='next_attack_miss'&&!enemy._nextAttackMiss)x.control+=c.threat*Number(e.chance??1);
  if(e.type==='next_crit_fail'&&!enemy._nextCritFail)x.control+=c.threat*Math.min(.95,combatRates(getCombatAgent(enemy),enemy).crit)*.5;
  if(e.type==='debuff_hit'&&!(enemy._hitChanceDebuff>0))x.control+=c.threat*n*Math.min(2,duration);
  if(e.type==='dodge'&&!(actor._dodgeBonus>=n))x.defense+=c.threat*n*Math.min(2,duration);
  if(e.type==='lifesteal'&&e.duration!==undefined){const gain=Math.max(0,Number(e.ratio??e.amount??0)-Number(actor._lifestealBonus||0));x.heal+=battleAIPreviewHeal(actor,actor,c.basic*gain*Math.min(2,duration),state);}
  if(e.type==='extra_turn')x.setup+=Math.max(c.basic,c.unit*.6)*Number(e.amount||1);
  if(e.type==='sp_drain'||e.type==='sp_siphon'){const ea=getCombatAgent(enemy),drain=Math.min(ea.sp||0,Number(e.amount||0));x.setup+=c.unit*Math.min(.4,drain/Math.max(1,ea.maxSP||maxSPFor(ea)));}
  if(['sp_cost_increase','cooldown_increase','skill_misfire'].includes(e.type)&&c.observedDamage)x.control+=c.threat*Number(e.amount??e.chance??.2)*Math.min(2,duration);
  if(e.type==='no_heal'&&!hasStatus(enemy,'no_heal')&&c.observedSupport)x.control+=c.unit*.5;
  if(e.type==='no_shield'&&!hasStatus(enemy,'no_shield')&&c.observedSupport)x.control+=c.unit*.4;
  if(e.type==='revive'&&e.self&&e.duration&&!actor._fateSkin)x.defense+=c.urgent?actor.maxHp*Number(e.hpRatio||.1):0;
  if(e.type==='pathway_asset'&&e.action==='manifest_soul'){const asset=preparedPathwayAssets(agent).find(a=>a.id===e.assetId),ps=pathwayAssetSpec(asset);for(const pe of abilityEffects(ps)){if(pe.type==='stat_modifier')x.setup+=c.unit*Math.max(0,Number(pe.amount||0))*(pe.stat==='def'?.6:['atk','int'].includes(pe.stat)?1.5*battleAIOffenseFraction(c,pe.stat):pe.stat==='hp'?.75:0);if(pe.type==='lifesteal')x.heal+=battleAIPreviewHeal(actor,actor,c.basic*Number(pe.ratio||pe.amount||0)*2,state);if(['resistance','status_resistance','immunity'].includes(pe.type))x.defense+=c.threat*.15;}}
 }
 if(spec.utilityStrike&&x.damage===0&&!effects.some(e=>e.type==='signature'&&['moon_beast','chained_release','abyss_desire','darkness_nightmare'].includes(e.rule)&&x.damage>0))x.damage+=battleAIBasicDamage(agent,actor,enemy,state,spec.utilityStrike);
 const lifesteal=effects.filter(e=>e.type==='heal_damage_ratio'||e.type==='lifesteal'&&e.duration===undefined).reduce((n,e)=>n+Number(e.ratio??e.amount??0),0)+Number(actor._lifestealBonus||0)+Number(traitData(agent).lifesteal||0);
 if(lifesteal>0)x.heal+=battleAIPreviewHeal(actor,actor,x.damage*lifesteal,state);
 const quote=traitAbilityQuote(agent,original,actor,signatureCastCost(agent,original,enemy,state));
 const spRatio=quote.resource==='sp'?quote.amount/Math.max(1,agent.maxSP||maxSPFor(agent)):0;
 x.risk+=quote.resource==='hp'?quote.amount:0;
 const policy=PATHWAY_BATTLE_POLICIES[agent.path]||((c,x)=>1);
 const protection=c.urgent?1.35:.42,healing=c.urgent?1.5:.65;
 x.score=(x.damage+x.heal*healing+x.defense*protection+x.cleanse+x.strip*.9+x.control*.8+x.setup*.75+x.dot*.8+x.command+x.summon*.8)*policy(c,x)-x.risk-c.unit*spRatio*.15;
 if(copy?.kind==='record')x.score-=c.unit*.12;
 if(x.damage>=enemy.hp+(enemy.shield||0)*.9)x.score+=c.unit*1.2;
 if(c.extra&&agent.path==='error'&&x.damage===0&&!c.urgent)x.score*=.5;
 x.reason=x.damage>0?'damage':x.heal>0?'recovery':x.control>0?'control':x.summon>0?'spirit':x.setup>0?'preparation':'protection';
 return x;
}
function battleAIThreadCandidate(c){
 const {agent,actor,enemy,state}=c;
 if(actor.summoned||agent.path!=='fool'||agent.sequence>5||hasTrait(actor,'spell_eater')||hasStatus(actor,'silenced')||hasStatus(agent,'silenced')||hasStatus(actor,'aggressive')||enemy.thread||!enemy.alive||hasStatus(enemy,'untargetable')||!canAffect(agent.sequence,enemy.sequence))return null;
 const spec=unlockedAbilities(agent).find(s=>battleAIId(s)==='thread_binding');if(!spec)return null;
 const slotCfg=G9D.formulas.spirit_threads_rules?.sequence_slots||{5:1,4:2,3:2,2:3,1:3,0:4},budget=slotCfg[String(agent.sequence)]??1;
 if(agent.cooldowns?.thread_binding>0||(agent._threadAttempts||0)>=budget||threadUsage(state,agent)>=threadSlots(agent.sequence)||Number(enemy.distance||5)>threadRange(agent.sequence)||actor._signatureDeniedSkills?.thread_binding>0||!traitAbilityQuote(agent,spec,actor).ready)return null;
 const aliveLong=enemy.hp>Math.max(c.basic*2,c.unit*1.5),resist=Number(combatRates(getCombatAgent(enemy),enemy).resistance||0);
 const control=c.threat*(aliveLong?1.5:.65)*(1-resist),capture=aliveLong?c.unit*.35:0;
 return {kind:'thread',spec,targetId:enemy.id,score:(control+capture)*PATHWAY_BATTLE_POLICIES.fool(c,{kind:'thread'}),reason:'thread progression'};
}
function choosePathwayBattleAction(agent,actor,enemy,state,actionContext={}){
 if(!actor?.alive||!enemy)return {kind:'basic',spec:null,targetId:enemy?.id,score:0,reason:'no legal ability'};
 const c=battleAIContext(agent,actor,enemy,state,actionContext),pm=passiveCombatModifier(agent);
 const basicHeal=battleAIPreviewHeal(actor,actor,c.basic*(Number(pm.lifesteal||0)+Number(actor._lifestealBonus||0)+Number(traitData(agent).lifesteal||0)),state);
 const candidates=[{kind:'basic',spec:null,targetId:enemy.id,score:c.basic+basicHeal*(c.urgent?1.5:.65),reason:'basic attack'}];
 for(const spec of activeSpecs(agent,actor,state))if(battleAIId(spec)!=='thread_binding'&&battleAIReady(agent,actor,enemy,state,spec))candidates.push(battleAIEvaluate(c,spec));
 const thread=battleAIThreadCandidate(c);if(thread)candidates.push(thread);
 candidates.sort((a,b)=>b.score-a.score||battleAIId(a.spec).localeCompare(battleAIId(b.spec)));
 return candidates[0];
}
