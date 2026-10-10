// One bounded authority per mythical form. The common awakening lives in v15.js.
const MYTHICAL_AUTHORITIES=Object.freeze({
 fool:{name:'Worms of Spirit',turns:0},
 door:{name:'Spatial Dominion',turns:1,exileTurns:2},
 error:{name:'Worms of Time',turns:2},
 visionary:{name:'Dream Prison',turns:2,backlash:1},
 sun:{name:'Unshadowed Kingdom',turns:2},
 tyrant:{name:'Sea of Lightning',turns:2,multiplier:1},
 white_tower:{name:'Omniscient Decoding',turns:2},
 hanged_man:{name:'Soul Devourer',turns:0,healRatio:.5},
 darkness:{name:'Concealed World',turns:2},
 death:{name:'Return from the Underworld',turns:3,reviveRatio:.35},
 twilight_giant:{name:'Twilight Guardian',turns:2,intercept:.5},
 red_priest:{name:'Army of Fire',turns:2,cleave:.5},
 demoness:{name:'Petrifying Gaze',turns:2},
 hermit:{name:'Occult Revelation',turns:2,defPen:.5,resistanceMultiplier:.5},
 paragon:{name:'Civilisation Manifest',turns:3,strength:1},
 wheel_of_fortune:{name:'Cycle of Mercury',turns:0,dodge:.2},
 mother:{name:'Living Earth',turns:3,healRatio:.1},
 moon:{name:'Crimson Creation',turns:2,healingShare:.3,turnCap:.2},
 abyss:{name:'Personal Abyss',turns:2,backlash:1},
 chained:{name:'Aggregate of Curses',turns:2,echo:1},
 black_emperor:{name:'Shadow of Order',turns:2},
 justiciar:{name:'Court of Absolute Law',turns:2,judgment:1}
});
function mythicalUnits(state){return [...(state?.allies||[]),...(state?.enemies||[])];}
function mythicalAgent(unit){return unit?.agent||unit;}
function mythicalActive(unit,path){const authority=unit?._mythicalAuthority;return !!unit?.alive&&!!authority&&(!path||authority.path===path)&&!authority.expired;}
function mythicalOwners(unit,state,path){return sameSideOf(unit,state).filter(u=>mythicalActive(u,path));}
function mythicalNote(owner,target,state,lines,text,type='status',extra={}){
 lines?.push({text,kind:type==='damage'?'quirk':'status'});
 emitCombatEvent(state,{round:state?.currentRound||1,type,subtype:'mythical_authority',actorId:owner?.id,actorName:owner?.name,actorTeam:teamOf(owner,state),targetId:target?.id,targetName:target?.name,targetTeam:target?teamOf(target,state):undefined,text,...extra});
}
function mythicalHeal(owner,target,amount,state,lines){const restored=recoverHP(target,amount);if(restored>0)mythicalNote(owner,target,state,lines,`${owner.name}'s ${MYTHICAL_AUTHORITIES[mythicalAgent(owner).path].name} restores ${restored} HP to ${target.name}.`,'heal',{amount:restored,hpAfter:target.hp,maxHp:target.maxHp});return restored;}
function mythicalSpellDamage(owner,target,multiplier,element){return v15Damage('pure_caster_ability',{agent:mythicalAgent(owner),actor:owner,target,abilityMult:multiplier,damageSpec:{scaling:'INT',type:'elemental',element,multiplier}});}
function mythicalHit(owner,target,amount,state,lines,r,damageType='physical'){
 if(!target?.alive||amount<=0)return null;
 const hit=resolveIncoming(owner,target,amount,state,lines,r,{damageType,indirect:true,mythical:true});
 mythicalNote(owner,target,state,lines,`${owner.name}'s mythical authority deals ${hit.hpLoss+hit.absorbed} ${damageType} damage to ${target.name}.`,'damage',{amount:hit.hpLoss+hit.absorbed,incoming:hit.incoming,absorbed:hit.absorbed,hpLoss:hit.hpLoss,shieldAfter:target.shield||0,hpAfter:target.hp,maxHp:target.maxHp,damageType});
 return hit;
}
function mythicalControl(owner,state,lines,r,status,duration){
 r=r||state?.rng||(()=>.99);
 const possible=foesOf(owner,state).filter(u=>u.alive&&u.inCombat!==false&&!hasStatus(u,'untargetable')&&canAffect(owner.sequence,u.sequence)&&!statusImmune(u,status));
 if(!possible.length)return null;const target=pickR(r,possible);
 if(r()<Number(combatRates(mythicalAgent(target),target).resistance||0)||r()<statusResistChance(target,status)){mythicalNote(owner,target,state,lines,`${target.name} resists ${MYTHICAL_AUTHORITIES[owner.path].name}.`);return null;}
 addStatus(target,status,duration,owner.name);mythicalNote(owner,target,state,lines,`${owner.name}'s ${MYTHICAL_AUTHORITIES[owner.path].name} afflicts ${target.name} with ${status.replace(/_/g,' ')} for ${duration} turns.`);return target;
}
function mythicalRecall(owner,state,lines){
 const authority=owner._mythicalAuthority;if(authority.used)return;
 const fallen=sameSideOf(owner,state).find(u=>u!==owner&&!u.alive&&!u.summoned);
 if(!fallen)return;authority.used=true;fallen.alive=true;fallen.inCombat=true;fallen.hp=Math.max(1,Math.round(fallen.maxHp*MYTHICAL_AUTHORITIES.death.reviveRatio));
 mythicalNote(owner,fallen,state,lines,`${owner.name} recalls ${fallen.name} from the Underworld with ${fallen.hp} HP.`,'revive',{amount:fallen.hp,hpAfter:fallen.hp,maxHp:fallen.maxHp});
}
function mythicalAwaken(unit,state,lines=[],r=state?.rng){
 const path=mythicalAgent(unit)?.path,cfg=MYTHICAL_AUTHORITIES[path];if(!cfg||path==='fool'||!state)return;
 const authority=unit._mythicalAuthority={path,turns:cfg.turns,grace:!!unit._acting,used:false};
 mythicalNote(unit,unit,state,lines,`${unit.name} manifests ${cfg.name}. ${mythicalDescription(path,unit.sequence)}`);
 if(path==='door'){
  if(unit.sequence<=2){const target=mythicalControl(unit,state,lines,r,'banished',cfg.exileTurns);if(target){target._skipTurns=cfg.exileTurns;addStatus(target,'untargetable',cfg.exileTurns,unit.name);checkThreadInterruptOnTarget(target,state,lines);}authority.used=true;}
  else for(const ally of sameSideOf(unit,state).filter(u=>u.alive)){ally._mythicalShelterOwners=ally._mythicalShelterOwners||[];ally._mythicalShelterOwners.push(unit.id);}
 }else if(path==='visionary'){
  const target=mythicalControl(unit,state,lines,r,'sleep',cfg.turns);if(target)target._mythicalDream={ownerId:unit.id};authority.used=true;
 }else if(path==='sun'){
  for(const ally of sameSideOf(unit,state).filter(u=>u.alive)){
   for(const status of [...(ally.status||[])])if(CLEANSE_STATUSES.includes(status))removeStatus(ally,status);
   ally._mythicalProtectionOwners=ally._mythicalProtectionOwners||{};ally._mythicalStatusProtection=ally._mythicalStatusProtection||{};
   for(const status of ['poison','curse']){(ally._mythicalProtectionOwners[status]=ally._mythicalProtectionOwners[status]||[]).push(unit.id);ally._mythicalStatusProtection[status]=true;}
  }
 }else if(path==='darkness'){
  for(const ally of sameSideOf(unit,state).filter(u=>u.alive)){ally._mythicalConcealOwners=ally._mythicalConcealOwners||[];ally._mythicalConcealOwners.push(unit.id);}
 }else if(path==='death')mythicalRecall(unit,state,lines);
 else if(path==='demoness'){
  const target=mythicalControl(unit,state,lines,r,'frozen',cfg.turns);if(target)target._mythicalPetrified={ownerId:unit.id};authority.used=true;
 }else if(path==='paragon'){
  if(typeof signatureCreateCompanion==='function')signatureCreateCompanion(unit,state,lines,'historical_machine',cfg.turns,cfg.strength);
  authority.used=true;
 }else if(path==='wheel_of_fortune'){
  authority.snapshot=Math.max(1,unit.hp);
  if(unit.sequence>1){authority.turns=2;addFx(unit,'dodge','dodge',cfg.dodge,2);}
 }else if(path==='chained'){
  const target=mythicalControl(unit,state,lines,r,'curse_link',cfg.turns);if(target)target._mythicalCurseLink={ownerId:unit.id};authority.used=true;
 }
}
function mythicalTurnStart(unit,state,lines=[],r=state?.rng){
 if(!mythicalActive(unit))return;const authority=unit._mythicalAuthority,cfg=MYTHICAL_AUTHORITIES[authority.path];
 if(authority.path==='wheel_of_fortune'&&unit.sequence<=1&&!authority.used)authority.snapshot=Math.max(1,unit.hp);
 else if(authority.path==='mother')for(const ally of sameSideOf(unit,state).filter(u=>u.alive))mythicalHeal(unit,ally,Math.round(ally.maxHp*cfg.healRatio),state,lines);
 else if(authority.path==='tyrant')for(const foe of foesOf(unit,state).filter(u=>u.alive&&canAffect(unit.sequence,u.sequence))){const damage=v15Damage('pure_caster_ability',{agent:mythicalAgent(unit),actor:unit,target:foe,abilityMult:cfg.multiplier,damageSpec:{scaling:'INT',type:'elemental',element:'lightning',multiplier:cfg.multiplier}});mythicalHit(unit,foe,damage,state,lines,r,'lightning');}
 else if(authority.path==='death')mythicalRecall(unit,state,lines);
}
function mythicalExpire(unit,state,lines=[]){
 const authority=unit?._mythicalAuthority;if(!authority||authority.expired)return;authority.expired=true;
 for(const ally of mythicalUnits(state)){
  for(const key of ['_mythicalShelterOwners','_mythicalConcealOwners'])if(ally[key])ally[key]=ally[key].filter(id=>id!==unit.id);
  for(const status of ['poison','curse'])if(ally._mythicalProtectionOwners?.[status]){ally._mythicalProtectionOwners[status]=ally._mythicalProtectionOwners[status].filter(id=>id!==unit.id);ally._mythicalStatusProtection[status]=ally._mythicalProtectionOwners[status].length>0;}
  if(authority.path==='paragon'&&ally._signatureOwnerId===unit.id&&ally._signatureCompanionKind==='historical_machine'){ally.alive=false;ally.inCombat=false;}
 }
 mythicalNote(unit,unit,state,lines,`${unit.name}'s ${MYTHICAL_AUTHORITIES[authority.path].name} ends${unit.alive?'; the mythical form remains active':''}.`);
}
function mythicalTurnEnd(unit,state,lines=[]){
 const authority=unit?._mythicalAuthority;if(!authority||authority.expired||authority.turns<=0)return;
 if(authority.grace){authority.grace=false;return;}if(--authority.turns>0)return;mythicalExpire(unit,state,lines);
}
function mythicalBeforeDamage(attacker,defender,damage,state,lines=[],r=state?.rng,opt={}){
 defender._mythicalLastIncoming={damage,opt,beforeHp:defender.hp,beforeShield:defender.shield||0,shieldCategory:defender._shieldIncomingCategory};if(!state||opt.mythical)return damage;
 const direct=!opt.indirect&&!opt.reflect;
 if(direct&&!opt.area){
  for(const key of ['_mythicalShelterOwners','_mythicalConcealOwners'])if((defender[key]||[]).some(id=>mythicalUnits(state).some(owner=>owner.id===id&&mythicalActive(owner)))){mythicalNote(defender,defender,state,lines,`${defender.name} is sheltered from the targeted attack.`);return 0;}
 }
 if(direct&&mythicalActive(defender,'white_tower')&&!defender._mythicalAuthority.used&&matchesIncomingCategory('magic',opt.trueDamage?'true':opt.damageType)){
  defender._mythicalAuthority.used=true;const observed=opt.ability||state._castingSpec;
  if(observed&&typeof signatureEligible==='function'&&signatureEligible({spec:observed},mythicalAgent(defender),attacker))mythicalAgent(defender)._signatureImitation={spec:cloneE(observed),sourceId:attacker?.id,sequence:attacker?.sequence};
  mythicalNote(defender,attacker,state,lines,`${defender.name}'s Omniscient Eye decodes and cancels the spell.`);return 0;
 }
 if(direct&&!opt.area){
  const guardian=mythicalOwners(defender,state,'twilight_giant').find(u=>u!==defender);
  if(guardian){const intercepted=Math.round(damage*MYTHICAL_AUTHORITIES.twilight_giant.intercept);mythicalHit(guardian,guardian,intercepted,state,lines,r,opt.damageType||'physical');mythicalNote(guardian,defender,state,lines,`${guardian.name} intercepts ${intercepted} damage aimed at ${defender.name}.`);damage-=intercepted;}
 }
 return damage;
}
function mythicalAfterDamage(attacker,defender,result,state,lines=[],r=state?.rng,opt={}){
 if(!state||opt.mythical)return;const lost=Number(result?.hpLoss||0);
 if(attacker&&!opt.indirect&&!opt.reflect&&lost+Number(result?.absorbed||0)>0)attacker._mythicalConcealOwners=[];
 if(lost>0&&defender._mythicalDream){
  const owner=mythicalUnits(state).find(u=>u.id===defender._mythicalDream.ownerId),asleep=hasStatus(defender,'sleep');delete defender._mythicalDream;removeStatus(defender,'sleep');
  if(asleep&&mythicalActive(owner,'visionary')&&defender.alive)mythicalHit(owner,defender,mythicalSpellDamage(owner,defender,MYTHICAL_AUTHORITIES.visionary.backlash,'psychic'),state,lines,r,'psychic');
 }
 if(lost>0&&defender._mythicalPetrified){delete defender._mythicalPetrified;removeStatus(defender,'frozen');mythicalNote(defender,defender,state,lines,`${defender.name}'s petrification breaks under HP damage.`);}
 if(!attacker||lost<=0||opt.indirect||opt.reflect)return;
 for(const owner of mythicalOwners(attacker,state,'red_priest')){
  const foe=foesOf(attacker,state).find(u=>u!==defender&&u.alive&&canAffect(attacker.sequence,u.sequence));if(foe)mythicalHit(owner,foe,Math.round(lost*MYTHICAL_AUTHORITIES.red_priest.cleave),state,lines,r,'fire');
 }
 for(const owner of mythicalOwners(attacker,state,'moon')){
  const authority=owner._mythicalAuthority,cfg=MYTHICAL_AUTHORITIES.moon;
  if(authority.healingTurn!==state.currentTurn){authority.healingTurn=state.currentTurn;authority.healingSpent=0;}
  const target=sameSideOf(attacker,state).filter(u=>u.alive&&u.hp<u.maxHp&&!hasStatus(u,'no_heal')).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];if(!target)continue;
  const cap=Math.round(owner.maxHp*cfg.turnCap),amount=Math.min(Math.round(lost*cfg.healingShare),cap-(authority.healingSpent||0));if(amount>0)authority.healingSpent=(authority.healingSpent||0)+mythicalHeal(owner,target,amount,state,lines);
 }
 if(mythicalActive(defender,'chained'))for(const target of foesOf(defender,state).filter(u=>u.alive&&u._mythicalCurseLink?.ownerId===defender.id&&hasStatus(u,'curse_link')))mythicalHit(defender,target,Math.round(lost*MYTHICAL_AUTHORITIES.chained.echo),state,lines,r,'dark');
}
function mythicalBeforeFatal(unit,source,state,lines=[],r=state?.rng){
 if(!mythicalActive(unit)||unit.hp>0)return false;const authority=unit._mythicalAuthority;if(authority.used)return false;
 if(authority.path==='wheel_of_fortune'&&unit.sequence<=1){authority.used=true;unit.hp=Math.max(1,Math.min(unit.maxHp,authority.snapshot||1));mythicalNote(unit,unit,state,lines,`${unit.name} rewinds its own fatal HP state to ${unit.hp} HP.`,'heal',{amount:unit.hp,hpAfter:unit.hp,maxHp:unit.maxHp});return true;}
 if(authority.path==='error'&&unit.sequence>=2){
  const last=unit._mythicalLastIncoming;if(!last||last.opt.indirect||last.opt.reflect||last.opt.mythical)return false;
  const host=mythicalUnits(state).find(u=>u!==unit&&u.id!==unit.id&&u.id===unit._signatureParasite?.hostId&&u.alive);if(!host)return false;
  authority.used=true;unit.hp=Math.max(1,last.beforeHp||1);unit.shield=last.beforeShield||0;if(last.shieldCategory)unit._shieldIncomingCategory=last.shieldCategory;unit._mythicalFatalRedirected=true;mythicalHit(unit,host,last.damage,state,lines,r,last.opt.damageType||'physical');mythicalNote(unit,host,state,lines,`${unit.name} escapes the lethal hit through its parasite host ${host.name}.`);return true;
 }
 return false;
}
function mythicalFinalDeath(unit,source,state,lines=[],r=state?.rng){
 if(!state||unit.alive)return;
 mythicalExpire(unit,state,lines);
 if(unit.summoned)return;
 for(const owner of mythicalUnits(state).filter(u=>mythicalActive(u,'hanged_man')&&!u._mythicalAuthority.used&&!sameSideOf(u,state).includes(unit))){
  if(!unit.path||!Number.isInteger(unit.sequence)||unit.sequence>9)continue;
  owner._mythicalAuthority.used=true;mythicalHeal(owner,owner,Math.round(owner.maxHp*MYTHICAL_AUTHORITIES.hanged_man.healRatio),state,lines);
  if(typeof signatureCaptureSoul==='function')signatureCaptureSoul(owner,unit,state,lines);
 }
}
function mythicalBeforeCast(agent,actor,enemy,state,lines=[],r=state?.rng,spec){
 const effects=abilityEffects(spec),support=signatureSupportTypes(spec),result={};if(!state)return result;
 if(support.some(type=>['heal','shield'].includes(type))){const judge=foesOf(actor,state).find(u=>mythicalActive(u,'justiciar'));if(judge){result.blockedEffects=['heal','shield'];spec.effects=effects.filter(e=>!(e.type==='lifesteal'&&e.duration===undefined)&&e.type!=='heal_damage_ratio'&&!(e.type==='signature'&&signatureSupportTypes({effects:[e]}).some(type=>['heal','shield'].includes(type))));mythicalNote(judge,actor,state,lines,`${actor.name} violates Absolute Law: healing and shields are forbidden.`);mythicalHit(judge,actor,mythicalSpellDamage(judge,actor,MYTHICAL_AUTHORITIES.justiciar.judgment,'holy'),state,lines,r,'holy');}}
 if(support.length){const emperor=foesOf(actor,state).find(u=>mythicalActive(u,'black_emperor')&&!u._mythicalAuthority.used);if(emperor){emperor._mythicalAuthority.used=true;result.supportTargets=[emperor];spec._signatureRedirectTarget=emperor.id;mythicalNote(emperor,actor,state,lines,`${emperor.name} distorts the order and steals ${actor.name}'s beneficial spell.`);}}
 return result;
}
function mythicalAfterCast(actor,enemy,state,lines=[],r=state?.rng,spec){
 if(!state||!actor.alive||spec?.type!=='active')return;
 for(const owner of foesOf(actor,state).filter(u=>mythicalActive(u,'abyss'))){const authority=owner._mythicalAuthority;if(authority.backlashTurn?.[actor.id]===state.currentTurn)continue;authority.backlashTurn=authority.backlashTurn||Object.create(null);authority.backlashTurn[actor.id]=state.currentTurn;mythicalHit(owner,actor,mythicalSpellDamage(owner,actor,MYTHICAL_AUTHORITIES.abyss.backlash,'fire'),state,lines,r,'fire');}
}
function mythicalTryAction(unit,state,lines=[],r=state?.rng){
 r=r||state?.rng||(()=>.99);
 if(unit._mythicalStolenTurn){unit._mythicalStolenTurn=0;mythicalNote(unit,unit,state,lines,`${unit.name}'s scheduled action was stolen by the Worms of Time.`);return true;}
 if(mythicalActive(unit,'error')&&unit.sequence<=1&&!unit._mythicalAuthority.used){const choices=foesOf(unit,state).filter(u=>u.alive&&u.inCombat!==false&&canAffect(unit.sequence,u.sequence)&&!u._mythicalStolenTurn);if(choices.length){const target=pickR(r,choices);if(r()>=Number(combatRates(mythicalAgent(target),target).resistance||0)){unit._mythicalAuthority.used=true;target._mythicalStolenTurn=1;unit._extraTurns=(unit._extraTurns||0)+1;mythicalNote(unit,target,state,lines,`${unit.name} steals ${target.name}'s next scheduled action; its extra action still pays SP and cooldowns.`);}}}
 return false;
}
function mythicalDamageOptions(actor,target,spec){
 if(mythicalActive(actor,'hermit')&&matchesIncomingCategory('magic',spec?.type==='true'?'true':spec?.element||spec?.type)){const cfg=MYTHICAL_AUTHORITIES.hermit;return{defPen:cfg.defPen,resistanceMultiplier:cfg.resistanceMultiplier};}return{};
}
function mythicalDescription(path,sequence){
 const c=MYTHICAL_AUTHORITIES[path],turns=c?.turns;if(!c)return'';
 const descriptions={
  fool:'Keeps Spirit Body Threads and marionettes unchanged; the fog cloak is its mythical appearance.',
  door:sequence<=2?`Exiles one resistible enemy for ${c.exileTurns} turns.`:`Shelters living allies from targeted direct damage for ${turns} owner turn; area damage and damage over time still hit.`,
  error:sequence<=1?`Steals one resistible enemy's next action and grants one normally paid extra action within ${turns} owner turns.`:`Escapes one lethal direct hit through its living parasite host within ${turns} owner turns; the host takes the hit.`,
  visionary:`One resistible enemy sleeps for ${turns} turns; HP damage wakes it and triggers one ${c.backlash*100}% INT Psychic backlash.`,
  sun:`Cleanses living allies, then protects them against Poison and Curse for ${turns} owner turns.`,
  tyrant:`Deals ${c.multiplier*100}% INT Lightning damage to every eligible enemy at each of the next ${turns} owner turn starts.`,
  white_tower:`Within ${turns} owner turns, decodes and cancels one direct nonphysical, non-true hit and stores an eligible spell for one paid imitation.`,
  hanged_man:`Devours one final enemy Beyonder death: restores ${c.healRatio*100}% Max HP and replaces the existing soul slot. Summons and allies are excluded.`,
  darkness:`Conceals living allies against targeted direct damage for ${turns} owner turns; each ally is revealed when dealing direct damage. Area damage and damage over time still hit.`,
  death:`Within ${turns} owner turns, recalls one fallen nonsummoned ally at ${c.reviveRatio*100}% Max HP without resetting its survival counters.`,
  twilight_giant:`Intercepts ${c.intercept*100}% of direct single-target damage aimed at another ally for ${turns} owner turns.`,
  red_priest:`Party direct HP damage cleaves one additional eligible enemy for ${c.cleave*100}% of the HP damage as Fire for ${turns} owner turns; no copied statuses or recursive cleaves.`,
  demoness:`Petrifies one resistible enemy for ${turns} turns; actual HP damage breaks petrification.`,
  hermit:`For ${turns} owner turns, nonphysical, non-true spells gain ${c.defPen*100} percentage points of DEF penetration and ignore ${(1-c.resistanceMultiplier)*100}% of elemental resistance. Shields and damage reduction still apply.`,
  paragon:`Replaces the existing device with one historical machine at ${c.strength*100}% owner ATK and INT for ${turns} owner turns; it cannot summon, charge or awaken a form.`,
  wheel_of_fortune:sequence<=1?'Rewinds one fatal hit to HP recorded at its previous owner turn start; SP, cooldowns, survival uses and statuses remain unchanged.':`Adds ${c.dodge*100} percentage points of Dodge for 2 turns.`,
  mother:`At the next ${turns} owner turn starts, restores ${c.healRatio*100}% Max HP to each living ally; healing prohibition applies.`,
  moon:`For ${turns} owner turns, converts ${c.healingShare*100}% of party direct HP damage into healing for the lowest-HP eligible ally, capped at ${c.turnCap*100}% caster Max HP per combatant turn. Shield damage does not heal.`,
  abyss:`For ${turns} owner turns, an enemy active cast triggers ${c.backlash*100}% INT Fire backlash, at most once per enemy action.`,
  chained:`Links one resistible enemy with a cleansable curse for ${turns} turns; echoes ${c.echo*100}% of the caster's direct HP loss as Dark damage.`,
  black_emperor:`Within ${turns} owner turns, steals the next enemy active heal, shield or stat buff; its caster still pays the original SP cost. Offensive components keep their targets.`,
  justiciar:`For ${turns} owner turns, enemy active healing and shields fail; attempting either suffers one ${c.judgment*100}% INT Holy judgment while paying the original cost. Offensive components and resurrection remain allowed.`
 };
 return descriptions[path];
}
