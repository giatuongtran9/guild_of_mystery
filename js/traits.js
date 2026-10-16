// Persistent trait definitions; combat budgets live on the battle unit only.
const TRAIT_DATA = G9D.traits || {entries:{},weights:{normal:74,rare:20,epic:5,legendary:1},activationSequence:9,refreshCost:50,hireCost:150,poolSize:4};
const TRAIT_TIERS = ['normal','rare','epic','legendary'];
const TRAIT_EFFECT_IDS = new Set(['hardy','strong','resilient','keen_mind','quick','glass_cannon','ironclad','swiftfoot','fervent_spirit','wardbreaker','vengeful_echo','runic_carapace','cinder_touch','nerve_pin','merciful_touch','spiteful_shell','break_the_chain','hunters_opening','fractured_moment','fates_debt','martyrs_mantle','blood_script','hollow_saint','unbroken_will','lone_sovereign','unbound_canticle','spell_eater','chronal_engine','spirit_bastion']);
function validateTraitCatalog(data){
 if(data.schema!=='guild.traits.v1'||!data.entries||!data.weights)throw new Error('Invalid trait catalog');
 if(TRAIT_TIERS.reduce((n,t)=>n+Number(data.weights[t]),0)!==100||TRAIT_TIERS.some(t=>!Number.isFinite(data.weights[t])||data.weights[t]<0))throw new Error('Trait generation weights must total 100');
 for(const [id,d] of Object.entries(data.entries)){
  if(!/^[a-z][a-z0-9_]*$/.test(id)||!TRAIT_EFFECT_IDS.has(d.effect)||d.effect!==id||!TRAIT_TIERS.includes(d.tier)||typeof d.name!=='string')throw new Error(`Unsupported trait: ${id}`);
  if(!d.modifiers||!d.params||Object.values(d.params).some(n=>!Number.isFinite(n)||n<0))throw new Error(`Invalid trait parameters: ${id}`);
 }
 for(const t of TRAIT_TIERS)if(data.weights[t]>0&&!Object.values(data.entries).some(d=>d.tier===t))throw new Error(`Empty trait pool: ${t}`);
 return data;
}
if(G9D.traits)validateTraitCatalog(TRAIT_DATA);
function traitAgent(u){return u?.agent||u||{};}
function traitDefinition(u){const a=traitAgent(u);return a.traitSource==='catalog_v1'?TRAIT_DATA.entries[a.traitId]||null:null;}
function traitActive(u){const a=traitAgent(u);return !!traitDefinition(a)&&a.awakened!==false&&Number(a.sequence??10)<=TRAIT_DATA.activationSequence;}
function hasTrait(u,id){return traitActive(u)&&traitAgent(u).traitId===id;}
function resolvedTraitModifiers(u){
 const a=traitAgent(u);
 if(a.traitSource==='catalog_v1')return traitActive(a)?traitDefinition(a).modifiers:{};
 return TRAITS[a.trait]||TRAITS['Stout Vitality'];
}
function traitRarity(u){
 const a=traitAgent(u),d=traitDefinition(a);
 if(d)return d.tier;
 return ['Glass Cannon','Ironclad','Swiftfoot','Fervent Spirit'].includes(a.trait)?'rare':'legacy';
}
function traitBadge(a){const tier=traitRarity(a),label=tier==='legacy'?'Original':tier[0].toUpperCase()+tier.slice(1);return `<span class="trait-badge trait-${tier}">${label}</span>`;}
function traitName(u){return traitDefinition(u)?.name||traitAgent(u).trait||'Stout Vitality';}
function traitFormat(text,d){return String(text||'').replace(/\{(\w+)\}/g,(_,k)=>String(d.params[k]??'?'));}
function traitDescription(u){
 const a=traitAgent(u),d=traitDefinition(a);
 if(!d)return a.traitSource==='catalog_v1'?'This trait requires a newer game version.':(TRAITS[a.trait]||TRAITS['Stout Vitality']).desc;
 const labels={hp_mult:'Max HP',atk_mult:'ATK',def_mult:'DEF',int_mult:'INT',spd_mult:'Speed',sp_mult:'Max SP'};
 const parts=[];
 for(const [k,label] of Object.entries(labels))if(d.modifiers[k]!=null){const n=Math.round((d.modifiers[k]-1)*100);parts.push(`${n>=0?'+':''}${n}% ${label}`);}
 if(d.benefit)parts.unshift(traitFormat(d.benefit,d));
 const m=d.modifiers;
 if(m.healingReceived!=null)parts.push(`Receive ${Math.round((1-m.healingReceived)*100)}% less healing`);
 if(m.healingOutput!=null)parts.push(`Healing output −${Math.round((1-m.healingOutput)*100)}%`);
 if(m.shieldReceived!=null)parts.push(`Incoming shield size −${Math.round((1-m.shieldReceived)*100)}%`);
 if(m.spSurcharge)parts.push(`Paid skills cost +${Math.round(m.spSurcharge*100)}% SP`);
 if(m.spRegen!=null)parts.push(`SP regeneration −${Math.round((1-m.spRegen)*100)}%`);
 if(m.noShield)parts.push('Cannot gain shields');
 if(m.noHealing)parts.push('Cannot receive living-unit healing');
 if(d.drawback)parts.push(traitFormat(d.drawback,d));
 return parts.map(part=>part.replace(/[.;]+$/,'')).join('; ')+'.';
}
function normalizeTrait(a){
 if(a.traitSource==='catalog_v1'){
  const d=TRAIT_DATA.entries[a.traitId];
  if(d){a.trait=d.name;a.traitTier=d.tier;}
  a.traits={name:traitName(a),desc:traitDescription(a)};return true;
 }
 return false;
}
function rollCatalogTrait(rng=Math.random){
 const n=Math.min(.999999999999,Math.max(0,Number(rng())||0))*100;
 let cumulative=0,tier='legendary';
 for(const t of TRAIT_TIERS){cumulative+=TRAIT_DATA.weights[t];if(n<cumulative){tier=t;break;}}
 const ids=Object.keys(TRAIT_DATA.entries).filter(id=>TRAIT_DATA.entries[id].tier===tier);
 const id=ids[Math.min(ids.length-1,Math.floor(Math.max(0,Number(rng())||0)*ids.length))];
 return {traitId:id,traitTier:tier,traitSource:'catalog_v1',trait:TRAIT_DATA.entries[id].name};
}
function traitRuntime(u){return u._traitState||(u._traitState={once:{},roundBudgets:{},openingTargets:{},turns:0});}
function traitOnce(u,key,state){const rt=traitRuntime(u),round=state?.currentRound??1;if(rt.once[key]===round)return false;rt.once[key]=round;return true;}
function traitBudget(u,key,state){const rt=traitRuntime(u),round=state?.currentRound??1;if(rt.budgetRound!==round){rt.budgetRound=round;rt.roundBudgets={};}return {value:rt.roundBudgets[key]||0,spend:n=>rt.roundBudgets[key]=(rt.roundBudgets[key]||0)+n};}
function traitContext(state,lines){const active=typeof ACTIVE_BATTLE!=='undefined'?ACTIVE_BATTLE:null;return {state:state||active?.state,lines:lines||active?.lines||[]};}
function traitNote(u,state,lines,text,extra={}){
 const ctx=traitContext(state,lines),full=`${traitName(u)}: ${text}`;
 ctx.lines.push({text:full,kind:'status'});
 emitCombatEvent(ctx.state,{type:'status',subtype:'trait',actorId:u.id,actorName:u.name,actorTeam:teamOf(u,ctx.state),traitId:traitAgent(u).traitId,text:full,...extra});
}
function traitEnemyHit(attacker,defender,state,opt={}){
 if(!attacker||attacker===defender||opt.indirect||opt.reflect||opt.execute||opt.traitGenerated)return false;
 return !state||teamOf(attacker,state)!==teamOf(defender,state);
}
function traitSkillEligibleForCooldown(spec){
 const effects=abilityEffects(spec),damage=(spec.damage?.multiplier||spec.scale||0)>0||effects.some(e=>e.type==='damage_component');
 const blocked=new Set(['signature','execute','extra_turn','revive','copy_ability','copy_highest','reset_state','skip','banish','silence','mind_control']);
 const cc=new Set(['stunned','frozen','freeze','sleep','bound','polymorphed','banished','unconscious','controlled','silenced']);
 return damage&&Number(spec.costSP)>0&&!spec._signatureOwned&&!effects.some(e=>blocked.has(e.type)||(['status','status_chance'].includes(e.type)&&cc.has(e.status)));
}
function traitAreaSkill(u,spec){return hasTrait(u,'unbound_canticle')&&!spec._signatureOwned&&Number(spec.costSP)>0&&((spec.damage?.multiplier||spec.scale||0)>0||abilityEffects(spec).some(e=>e.type==='damage_component'))&&!abilityEffects(spec).some(e=>e.type==='targeting'&&e.mode!=='single_enemy');}
function traitAbilityQuote(agent,spec,actor=null,baseCost=null){
 const a=traitAgent(agent),id=spec.effectId||spec.id,normalSP=baseCost??effectiveAbilityCost(a,spec),m=resolvedTraitModifiers(a),d=traitDefinition(a);
 let amount=normalSP,resource='sp',remaining=Math.max(0,Number(a.cooldowns?.[id]||0)),cooldownReady=remaining===0;
 if(hasTrait(a,'spell_eater'))return {amount,resource,normalSP,ready:false,affordable:false,cooldownReady:false};
 if(hasTrait(a,'chronal_engine')&&remaining>0&&traitSkillEligibleForCooldown(spec)){amount=Math.ceil(amount*(1+d.params.surcharge/100*remaining));cooldownReady=true;}
 if(traitAreaSkill(a,spec))amount=Math.ceil(amount*(1+d.params.surcharge/100));
 const maxHP=actor?.maxHp??Math.max(1,Math.round(Number(a.stats?.hp||1)*(typeof passiveCombatModifier==='function'?passiveCombatModifier(a).hp||1:1))),hp=actor?.hp??maxHP;
 if(hasTrait(a,'blood_script')&&normalSP>0){resource='hp';amount=Math.max(1,Math.ceil(maxHP*d.params.hpCost/100*normalSP/Math.max(1,maxSPFor(a))));}
 const funds=resource==='hp'?hp:Number(a.sp||0);
 const affordable=resource==='hp'?funds>amount:funds>=amount;
 return pathwayAbilityQuote(a,spec,actor,{amount,resource,normalSP,cooldownReady,affordable,ready:cooldownReady&&affordable});
}
function traitAbilityDescription(agent,spec,path,sequence){
 const base=abilityDescription(spec,path,sequence);
 if(spec.type!=='active'||(!traitActive(agent)&&Number(weaponFor(agent).skillCostMultiplier||1)===1))return base;
 if(hasTrait(agent,'spell_eater'))return base+' Disabled by Spell Eater.';
 const effective={...traitAgent(agent),stats:effectiveStats(traitAgent(agent))};
 const maxHp=Math.round(effective.stats.hp*(passiveCombatModifier(effective).hp||1));
 const q=traitAbilityQuote(effective,spec,{maxHp,hp:maxHp});
 return base.replace(/\d+(?:\.\d+)? SP · Cooldown/,`${q.amount} ${q.resource.toUpperCase()} · Cooldown`);
}
function traitPayAbility(agent,actor,spec,quote,state,lines){
 // Legacy direct-cast callers already perform their own readiness checks.
 // Catalog casts require the same cooldown eligibility used by selection.
 if(!quote.affordable||(traitActive(agent)&&!quote.cooldownReady))return false;
 const a=traitAgent(agent);
 if(quote.resource==='hp'){if(actor.hp<=quote.amount)return false;actor.hp-=quote.amount;traitNote(actor,state,lines,`pays ${quote.amount} HP to cast.`,{hpPayment:quote.amount});}
 else {if(a.sp<quote.amount)return false;a.sp-=quote.amount;}
 const rt=traitActive(actor)?traitRuntime(actor):null;if(rt)rt.actionPaid=quote.normalSP>0;
 return true;
}
function traitBeginAction(u,state,bonus=false){
 if(!traitActive(u))return;
 const rt=traitRuntime(u);rt.actionOpen=true;rt.actionBonus=bonus;rt.actionDamage=false;rt.actionPaid=false;rt.actionBoost=rt.pendingBoost||0;rt.pendingBoost=0;
}
function traitFinishAction(u,state,lines){
 if(!traitActive(u))return;
 const rt=traitRuntime(u);
 if(!rt.actionDamage&&rt.actionBoost)rt.pendingBoost=Math.max(rt.pendingBoost||0,rt.actionBoost);
 if(hasTrait(u,'fractured_moment')&&rt.actionDamage&&!rt.actionBonus&&!rt.fractureUsed){rt.fractureUsed=true;rt.fractureQueued=true;traitNote(u,state,lines,'grants one bonus action.');}
 if(hasTrait(u,'runic_carapace')&&rt.actionPaid&&!rt.actionMisfire&&u.alive&&traitOnce(u,'carapace',state)){
  const gain=grantShield(u,u.maxHp*traitDefinition(u).params.shieldHP/100);
  if(gain)traitNote(u,state,lines,`grants ${gain} shield.`,{shieldGain:gain});
 }
 rt.actionOpen=false;rt.actionBoost=0;rt.actionPaid=false;rt.actionMisfire=false;
}
function traitDamageMultiplier(u){return traitActive(u)?1+(traitRuntime(u).actionBoost||0)/100:1;}
function traitOpeningCritical(u,target,failed=false){
 if(!hasTrait(u,'hunters_opening'))return false;
 const rt=traitRuntime(u);if(rt.openingTargets[target.id])return false;rt.openingTargets[target.id]=true;
 return !failed&&target.hp===target.maxHp;
}
function traitAfterHit(u,target,result,state,lines,r,info={}){
 if(!traitActive(u)||!traitEnemyHit(u,target,state,info)||!canAffect(u.sequence,target.sequence))return;
 const rt=traitRuntime(u),d=traitDefinition(u);
 if(result.hpLoss+result.absorbed>0)rt.actionDamage=true;
 if(!target.alive)return;
 if(d.effect==='cinder_touch'&&info.basic&&result.hpLoss>0&&traitOnce(u,'cinder',state)&&r()<d.params.chance/100&&r()>=statusResistChance(target,'burn')&&!statusImmune(target,'burn')){addStatus(target,'burn',d.params.turns,u.id);traitNote(u,state,lines,`${target.name} gains Burn.`);}
 if(d.effect==='nerve_pin'&&info.critical&&info.primary!==false&&result.hpLoss+result.absorbed>0&&traitOnce(u,'pin',state)){
  const tr=traitRuntime(target);tr.nerveSlow={amount:d.params.slow/100,turns:d.params.turns,grace:!!target._acting};traitNote(u,state,lines,`${target.name} loses ${d.params.slow}% Speed for ${d.params.turns} turns.`);
 }
 if(d.effect==='spell_eater'&&info.basic&&result.hpLoss+result.absorbed>0){
  const a=traitAgent(target),budget=traitBudget(u,'drain:'+target.id,state),max=Number(a.maxSP||maxSPFor(a)),drain=Math.max(0,Math.min(Number(a.sp||0),Math.round(max*d.params.drain/100),Math.round(max*d.params.drainCap/100)-budget.value));
  if(drain){a.sp-=drain;budget.spend(drain);const healBudget=traitBudget(u,'drainHeal',state),heal=Math.min(drain,Math.round(u.maxHp*d.params.healCap/100)-healBudget.value);const restored=recoverHP(u,heal,{source:u,state,lines,kind:'lifesteal'});healBudget.spend(restored);traitNote(u,state,lines,`burns ${drain} SP from ${target.name} and restores ${restored} HP.`);}
 }
}
function traitAfterIncoming(attacker,defender,result,state,lines,r,opt={}){
 if(!traitEnemyHit(attacker,defender,state,opt))return;
 if(result.hpLoss+result.absorbed>0&&traitActive(attacker))traitRuntime(attacker).actionDamage=true;
 if(hasTrait(attacker,'wardbreaker')&&attacker.alive&&result.absorbed>0&&result.shieldBefore>0&&(defender.shield||0)===0&&traitOnce(attacker,'wardbreak',state)){
  const a=traitAgent(attacker),old=a.sp||0;a.sp=Math.min(a.maxSP,old+Math.round(a.maxSP*traitDefinition(a).params.refundSP/100));traitNote(attacker,state,lines,`restores ${a.sp-old} SP.`);
 }
 if(hasTrait(defender,'vengeful_echo')&&defender.alive&&result.hpLoss>0&&traitOnce(defender,'echo',state)){traitRuntime(defender).pendingBoost=traitDefinition(defender).params.damageBonus;traitNote(defender,state,lines,'empowers the next damaging action.');}
 if(hasTrait(defender,'spiteful_shell')&&defender.alive&&attacker.alive&&result.absorbed>0&&result.shieldBefore>0&&!defender.shield&&traitOnce(defender,'spite',state)&&canAffect(defender.sequence,attacker.sequence)){
  const raw=Math.round(defender.maxHp*traitDefinition(defender).params.retaliationHP/100),pm=passiveCombatModifier(traitAgent(attacker)),physical=Math.max(0,Math.round(raw*(1-elementResistance(attacker,'physical')/100)-Number(attacker.def||0)*(pm.def||1)*.5));
  const hit=resolveIncoming(defender,attacker,physical,state,lines,r,{damageType:'physical',indirect:true,traitGenerated:true});
  emitResolvedDamage(state,hit,{type:'damage',actorId:defender.id,actorName:defender.name,actorTeam:teamOf(defender,state),targetId:attacker.id,targetName:attacker.name,targetTeam:teamOf(attacker,state),amount:hit.hpLoss+hit.absorbed,hpLoss:hit.hpLoss,absorbed:hit.absorbed,hpAfter:attacker.hp,maxHp:attacker.maxHp,damageType:'physical'});
  traitNote(defender,state,lines,`retaliates against ${attacker.name}.`);
 }
}
function traitIncomingHP(attacker,defender,amount,state,lines,res,opt={}){
 if(!traitEnemyHit(attacker,defender,state,opt))return amount;
 let rem=amount;
 if(hasTrait(defender,'spirit_bastion')&&rem>0){
  const a=traitAgent(defender),ratio=traitDefinition(defender).params.absorption/100,capacity=defender.maxHp*ratio,absorb=Math.min(rem,Math.floor(capacity*Math.max(0,a.sp||0)/Math.max(1,a.maxSP)));
  if(absorb>0){const paid=Math.min(a.sp,Math.ceil(absorb/capacity*a.maxSP));a.sp-=paid;rem-=absorb;res.spAbsorbed=absorb;traitNote(defender,state,lines,`spends ${paid} SP to absorb ${absorb} HP damage.`,{spPayment:paid,spAbsorbed:absorb});}
 }
 if(rem>0&&state&&!defender.summoned){
  const eligible=Math.min(rem,defender.hp),protectors=sameSideOf(defender,state).filter(u=>u!==defender&&u.alive&&!u.summoned&&hasTrait(u,'martyrs_mantle')).sort((a,b)=>b.hp/b.maxHp-a.hp/a.maxHp||sameSideOf(defender,state).indexOf(a)-sameSideOf(defender,state).indexOf(b));
  const protector=protectors.find(u=>traitBudget(u,'transfer',state).value<Math.floor(u.maxHp*traitDefinition(u).params.roundCap/100));
  if(protector){const d=traitDefinition(protector),budget=traitBudget(protector,'transfer',state),transfer=Math.max(0,Math.min(Math.floor(eligible*d.params.share/100),Math.floor(protector.maxHp*d.params.roundCap/100)-budget.value,protector.hp));
   if(transfer){const before=protector.hp;protector.hp-=transfer;budget.spend(transfer);rem-=transfer;res.transferred=transfer;
    emitCombatEvent(state,{type:'damage',actorId:attacker.id,actorName:attacker.name,actorTeam:teamOf(attacker,state),targetId:protector.id,targetName:protector.name,targetTeam:teamOf(protector,state),amount:transfer,hpLoss:Math.min(before,transfer),absorbed:0,hpAfter:protector.hp,maxHp:protector.maxHp,damageType:'transferred'});
    settleFatalDamage(protector,state,lines,attacker,{indirect:true,transferred:true});traitNote(protector,state,lines,`takes ${transfer} damage for ${defender.name}.`);
   }
  }
 }
 return rem;
}
function traitBeforeFatal(u,source,state,lines,opt={}){
 if(!hasTrait(u,'fates_debt')||traitRuntime(u).fateUsed||!traitEnemyHit(source,u,state,opt))return false;
 const rt=traitRuntime(u);rt.fateUsed=true;rt.healBlockedUntil=rt.turns+(u._acting?2:1);u.hp=1;traitAgent(u).sp=0;traitNote(u,state,lines,'survives at 1 HP, loses all SP and cannot receive healing through the next turn.');return true;
}
function traitHealingBlocked(u){return !!resolvedTraitModifiers(u).noHealing||(hasTrait(u,'fates_debt')&&Number(traitRuntime(u).healBlockedUntil)>Number(traitRuntime(u).turns));}
function traitConvertHealing(source,target,amount,context={}){
 const ctx=traitContext(context.state,context.lines),d=traitDefinition(source);
 if(context.kind==='revive'||!hasTrait(source,'hollow_saint'))return false;
 if(!target?.alive)return true;
 const budget=traitBudget(source,'ward:'+target.id,ctx.state),limit=Math.floor(target.maxHp*d.params.roundCap/100)-budget.value;
 const shieldScale=Number(resolvedTraitModifiers(target).shieldReceived??1)*Number(GLOBAL_COMBAT.shield??1);
 const recoveryCeiling=Number.isFinite(context.maxRecovery)?Math.floor(((target.shield||0)+Math.max(0,context.maxRecovery))/Math.max(.00001,shieldScale)):Infinity;
 const desired=Math.max(0,Math.min(Math.floor(amount*d.params.conversion/100),Math.max(0,limit)+(target.shield||0),recoveryCeiling));
 const gain=desired>0?grantShield(target,desired):0;budget.spend(gain);
 if(gain){traitNote(source,ctx.state,ctx.lines,`converts healing into ${gain} shield for ${target.name}.`);emitCombatEvent(ctx.state,{type:'shield',actorId:source.id,actorName:source.name,actorTeam:teamOf(source,ctx.state),targetId:target.id,targetName:target.name,targetTeam:teamOf(target,ctx.state),amount:gain,shieldAfter:target.shield});}
 return true;
}
function traitAfterHealing(source,target,amount,context={}){
 if(!hasTrait(source,'merciful_touch')||source===target||amount<=0||context.kind==='lifesteal'||context.kind==='revive')return;
 const ctx=traitContext(context.state,context.lines);
 const statuses=['burn','poison','curse','decay','bleed'].filter(st=>hasStatus(target,st)).sort((a,b)=>(target.statusMeta?.[b]?.duration||0)-(target.statusMeta?.[a]?.duration||0));
 if(statuses.length&&traitOnce(source,'mercy',ctx.state)){removeStatus(target,statuses[0]);traitNote(source,ctx.state,ctx.lines,`cleanses ${statuses[0]} from ${target.name}.`);}
}
function traitCanActThroughControl(u,state,lines){
 if(!hasTrait(u,'unbroken_will'))return false;
 if(!['stunned','frozen','freeze','bound','sleep','polymorphed'].some(st=>hasStatus(u,st)))return false;
 if(hasStatus(u,'unconscious')||hasStatus(u,'banished')||u._skipTurns>0)return false;
 const rt=traitRuntime(u),turn=state?.currentTurn??rt.turns;if(rt.controlTurn===turn)return !!rt.controlAllowed;rt.controlTurn=turn;rt.controlAllowed=false;
 const a=traitAgent(u),cost=Math.max(1,Math.ceil(a.maxSP*traitDefinition(u).params.controlCost/100));if(a.sp<cost)return false;
 rt.controlAllowed=true;a.sp-=cost;traitNote(u,state,lines,`pays ${cost} SP to act through control.`);return true;
}
function traitTurnEnd(u,state,lines,lostControl=false){
 if(u._traitState?.nerveSlow){const slow=u._traitState.nerveSlow;if(slow.grace)slow.grace=false;else if(--slow.turns<=0)delete u._traitState.nerveSlow;}
 if(!traitActive(u))return;
 const rt=traitRuntime(u);rt.turns++;
 if(lostControl&&hasTrait(u,'break_the_chain')){const eligible=['stunned','frozen','freeze','bound','sleep','polymorphed'].filter(st=>hasStatus(u,st)).sort((a,b)=>(u.statusMeta?.[b]?.duration||0)-(u.statusMeta?.[a]?.duration||0));if(eligible.length&&traitOnce(u,'chain',state)){removeStatus(u,eligible[0]);traitNote(u,state,lines,`cleanses ${eligible[0]} after losing an action.`);}}
}
function traitScheduledActions(u,state){return hasTrait(u,'lone_sovereign')&&state?.traitDeployment?.[teamOf(u,state)]===1?2:1;}
function traitHasBonus(u){if(!hasTrait(u,'fractured_moment'))return false;const rt=traitRuntime(u);if(!rt.fractureQueued)return false;rt.fractureQueued=false;return true;}
function refreshRecruitmentOffice(state,seed=Date.now()){
 const cost=TRAIT_DATA.refreshCost;if(state.funds<cost)return {ok:false,reason:`Refreshing requires £${cost}.`};
 const counter=(state.recruitmentRollCounter||0)+1,pool=makeRecruitPool(TRAIT_DATA.poolSize,(seed^Math.imul(counter,2654435761))>>>0,state.reputation);
 state.funds-=cost;state.recruitPool=pool;state.recruitmentRollCounter=counter;state.recruitRefreshDay=state.day+7;chronicle(state,`Recruitment Office refreshed for £${cost}.`);return {ok:true,cost};
}
function hireRecruitmentCandidate(state,id){
 const candidate=state.recruitPool.find(a=>a.id===id),cost=TRAIT_DATA.hireCost;
 if(!candidate)return {ok:false,reason:'This candidate is no longer available.'};if(state.funds<cost)return {ok:false,reason:`Hiring requires £${cost}.`};
 const hired=cloneS(candidate);hired.history=[{day:state.day,text:`Hired from the Recruitment Office as an ordinary ${(hired.occupation||'person').toLowerCase()}.`}];state.funds-=cost;state.recruitPool=state.recruitPool.filter(a=>a.id!==id);state.roster.push(hired);chronicle(state,`${hired.name} joins the guild.`);
 if(!state.recruitPool.length){state.recruitmentRollCounter=(state.recruitmentRollCounter||0)+1;state.recruitPool=makeRecruitPool(TRAIT_DATA.poolSize,(Date.now()^state.recruitmentRollCounter)>>>0,state.reputation);state.recruitRefreshDay=state.day+7;}
 return {ok:true,agentId:hired.id};
}
