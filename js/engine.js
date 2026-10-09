// Structured combat event emission helpers
function teamOf(u, state) {
  if (!state) return 'ally';
  if (state.allies && state.allies.some(x => x.id === u?.id || (u?.name && x.name === u.name))) return 'ally';
  if (state.enemies && state.enemies.some(x => x.id === u?.id || (u?.name && x.name === u.name))) return 'enemy';
  return u?.agent ? 'ally' : 'enemy';
}
function emitCombatEvent(state, ev) {
  if (!state || !state.events) return;
  if (ev.round === undefined) ev.round = state.currentRound || 0;
  state.events.push(ev);
}

function abbrNum(num) {
  if (num == null || isNaN(num)) return '0';
  const n = Math.abs(Number(num));
  const sign = num < 0 ? '−' : '';
  if (n >= 1000000) {
    const v = (n / 1000000).toFixed(1).replace(/\.0$/, '');
    return `${sign}${v}M`;
  }
  if (n >= 10000) {
    const v = (n / 1000).toFixed(1).replace(/\.0$/, '');
    return `${sign}${v}K`;
  }
  if (n >= 1000) {
    return `${sign}${Number(n).toLocaleString()}`;
  }
  return `${sign}${Math.round(n)}`;
}

function groupEventsToRows(events, battleSnapshot) {
  const rounds = [];
  let currentRound = null;
  let activeTurn = null;

  function getRound(r) {
    if (!currentRound || currentRound.round !== r) {
      if (activeTurn) {
        currentRound.rows.push(activeTurn);
        activeTurn = null;
      }
      currentRound = { round: r, rows: [], initiative: null, stats: [] };
      rounds.push(currentRound);
    }
    return currentRound;
  }

  for (let i = 0; i < (events || []).length; i++) {
    const ev = events[i];
    const r = getRound(ev.round || 0);

    if (ev.type === 'round_start') {
      if (activeTurn) {
        r.rows.push(activeTurn);
        activeTurn = null;
      }
      continue;
    }

    if (ev.type === 'system') {
      if (ev.subtype === 'initiative') {
        r.initiative = ev.details || ev.text;
      } else if (ev.subtype === 'combat_begins') {
        r.stats.push(ev);
      }
      continue;
    }

    if (ev.type === 'story') {
      // Awakened by the hit that is still being resolved: show it inside that attack row (cast -> hit -> awakening -> stuns).
      if (ev.subtype === 'mythical_form' && ev.inTurn && activeTurn) {
        activeTurn.subrows.push({ type: 'mythical', text: ev.text });
        continue;
      }
      // Any other story line is chronologically after the pending turn, so close that turn first.
      if (activeTurn) {
        r.rows.push(activeTurn);
        activeTurn = null;
      }
      r.rows.push({
        id: `story_${ev.round}_${i}`,
        round: ev.round,
        type: 'story',
        text: ev.text
      });
      continue;
    }

    if (ev.type === 'cast') {
      if (activeTurn) {
        r.rows.push(activeTurn);
      }
      activeTurn = {
        id: `turn_${ev.round}_${ev.actorId}_${i}`,
        round: ev.round,
        type: 'turn',
        actorId: ev.actorId,
        actorName: ev.actorName,
        actorTeam: ev.actorTeam,
        ability: ev.ability,
        costSP: ev.costSP,
        cooldown: ev.cooldown,
        damages: [],
        heals: [],
        shields: [],
        subrows: [],
        deaths: []
      };
      continue;
    }

    // Reflect damage is emitted while the attacker's own hit is still resolving, i.e. BEFORE that hit's damage event.
    // Keep it inside the attack row (it hit the row's actor) instead of closing the row and splitting the attack in three.
    if (activeTurn && ev.type === 'damage' && ev.isReflect && ev.targetId === activeTurn.actorId) {
      (activeTurn.reflects = activeTurn.reflects || []).push(ev);
      activeTurn.subrows.push({ type: 'reflect', text: `${ev.actorName} reflects ${abbrNum(ev.amount)} damage back at ${ev.targetName}.` });
      continue;
    }

    if (activeTurn && ev.actorId === activeTurn.actorId && ev.type === 'damage' && !ev.isDot) {
      activeTurn.damages.push(ev);
      continue;
    }

    if (activeTurn && ev.actorId === activeTurn.actorId && (ev.type === 'heal' || ev.type === 'shield')) {
      if (ev.type === 'heal') activeTurn.heals.push(ev);
      else activeTurn.shields.push(ev);
      continue;
    }

    if (ev.type === 'damage') {
      if (activeTurn) {
        r.rows.push(activeTurn);
      }
      activeTurn = {
        id: `turn_${ev.round}_${ev.actorId}_${i}`,
        round: ev.round,
        type: 'turn',
        actorId: ev.actorId,
        actorName: ev.actorName,
        actorTeam: ev.actorTeam,
        ability: ev.ability || 'Attack',
        damages: [ev],
        heals: [],
        shields: [],
        subrows: [],
        deaths: []
      };
      continue;
    }

    if (ev.type === 'miss') {
      if (activeTurn && activeTurn.actorId === ev.actorId) {
        activeTurn.subrows.push({ type: 'miss', text: ev.text });
        continue;
      }
      if (activeTurn) {
        r.rows.push(activeTurn);
      }
      activeTurn = {
        id: `turn_${ev.round}_${ev.actorId}_${i}`,
        round: ev.round,
        type: 'turn',
        actorId: ev.actorId,
        actorName: ev.actorName,
        actorTeam: ev.actorTeam,
        ability: 'Attack',
        targetName: ev.targetName,
        targetTeam: ev.targetTeam,
        isMiss: true,
        text: ev.text,
        damages: [],
        heals: [],
        shields: [],
        subrows: [],
        deaths: []
      };
      continue;
    }

    if (ev.type === 'status' && (ev.subtype === 'cc_loss' || ev.subtype === 'madness_loss' || ev.subtype === 'banished')) {
      if (activeTurn) {
        r.rows.push(activeTurn);
      }
      activeTurn = {
        id: `turn_${ev.round}_${ev.actorId}_${i}`,
        round: ev.round,
        type: 'turn',
        actorId: ev.actorId,
        actorName: ev.actorName,
        actorTeam: ev.actorTeam,
        isSkip: true,
        text: ev.text,
        damages: [],
        heals: [],
        shields: [],
        subrows: [],
        deaths: []
      };
      continue;
    }

    if (ev.type === 'thread') {
      if (activeTurn) {
        activeTurn.subrows.push({ type: 'thread', text: ev.text });
      } else {
        r.rows.push({
          id: `thread_${ev.round}_${i}`,
          round: ev.round,
          type: 'thread',
          text: ev.text
        });
      }
      continue;
    }

    if (ev.type === 'status') {
      if (activeTurn) {
        activeTurn.subrows.push({ type: 'status', text: ev.text, subtype: ev.subtype, stat: ev.stat, curVal: ev.curVal, maxVal: ev.maxVal, isFreeze: ev.isFreeze });
      } else {
        r.rows.push({
          id: `status_${ev.round}_${i}`,
          round: ev.round,
          type: 'status',
          text: ev.text
        });
      }
      continue;
    }

    if (ev.type === 'death') {
      if (activeTurn) {
        activeTurn.deaths.push(ev);
      } else {
        r.rows.push({
          id: `death_${ev.round}_${i}`,
          round: ev.round,
          type: 'death',
          targetName: ev.targetName,
          targetTeam: ev.targetTeam,
          text: ev.text
        });
      }
      continue;
    }

    if (ev.type === 'revive') {
      if (activeTurn) {
        (activeTurn.revives = activeTurn.revives || []).push(ev);
        activeTurn.subrows.push({ type: 'revive', text: ev.text });
      } else {
        r.rows.push({
          id: `revive_${ev.round}_${i}`,
          round: ev.round,
          type: 'revive',
          targetName: ev.targetName,
          targetTeam: ev.targetTeam,
          text: ev.text
        });
      }
      continue;
    }

    if (ev.type === 'result') {
      if (activeTurn) {
        r.rows.push(activeTurn);
        activeTurn = null;
      }
      r.rows.push({
        id: `result_${ev.round}_${i}`,
        round: ev.round,
        type: 'result',
        success: ev.success,
        text: ev.text
      });
      continue;
    }
  }

  if (activeTurn && currentRound) {
    currentRound.rows.push(activeTurn);
  }

  return rounds;
}

function summarizeBattleEvents(events, battleSnapshot) {
  let rounds = 0;
  let totalDamageDealt = 0;
  const deadAllies = [];
  const deadEnemies = [];

  for (const ev of (events || [])) {
    if (ev.round > rounds) rounds = ev.round;
    if (ev.type === 'damage' && ev.amount) {
      totalDamageDealt += ev.amount;
    }
    if (ev.type === 'death' && ev.targetName) {
      if (ev.targetTeam === 'ally' && !deadAllies.includes(ev.targetName)) {
        deadAllies.push(ev.targetName);
      } else if (ev.targetTeam === 'enemy' && !deadEnemies.includes(ev.targetName)) {
        deadEnemies.push(ev.targetName);
      }
    }
  }

  const deaths = [...deadAllies.map(n => `${n} (Ally)`), ...deadEnemies.map(n => `${n} (Enemy)`)];
  const deathSummary = deaths.length ? `Casualties: ${deaths.join(', ')}` : 'No casualties';
  return {
    rounds,
    totalDamageDealt,
    deadAllies,
    deadEnemies,
    summaryText: `${rounds} round${rounds === 1 ? '' : 's'} · Total Damage: ${abbrNum(totalDamageDealt)} · ${deathSummary}`
  };
}

// ===== engine.js =====


const rand = (seed) => {
  let x = seed >>> 0;
  return () => ((x = Math.imul(1664525, x) + 1013904223) >>> 0) / 4294967296;
};
const rint = (r, a, b) => Math.floor(r() * (b - a + 1)) + a;
const pickR = (r, a) => a[Math.floor(r() * a.length)];
const cloneE = (x) => JSON.parse(JSON.stringify(x));

function tierPower(sequence) {
  return 10 - sequence;
}

/**
 * Advancement is intentionally reliable at low Sequences and increasingly risky
 * as the character approaches the divine tiers. Failure creates Madness instead
 * of silently deleting resources.
 */
function attemptTraining(agent,seed=Date.now()){const r=rand(seed);const by={9:.94,8:.90,7:.86,6:.81,5:.75,4:.68,3:.58,2:.48,1:.36};const chance=Math.min(.95,Math.max(.05,by[agent.sequence]||.5));if(r()<chance)return {ok:true,line:`The advancement succeeds. ${agent.name} becomes Sequence ${agent.sequence-1} ${tierFor(agent.path,agent.sequence-1).name}.`};return {ok:false,line:`The advancement fails. ${agent.name} loses control, becomes a corrupted monster, and is permanently lost.`,consequence:{type:'corruptedDeath',agentId:agent.id,text:`${agent.name} failed advancement and was permanently lost to corruption.`}};}

const enemyNames = G9D.system.enemy_names;
const COMBAT_BALANCE = G9D.balance.combat_balance;

function getCombatAgent(unit){return unit?.agent||unit;}
// Only fields written by combat effects are discarded. Persistent progression,
// equipment, meters, SP and ordinary cooldown remainders keep their save values.
const COMBAT_TRANSIENT_FIELDS=['_buffs','_debuffs','_speedDebuff','_threadSpeedDebuff',
 '_threadDodgeDebuff','_threadHitDebuff','_threadLockDodge','_threadStiffened','_threadAttempts',
 '_spCostMultiplier','_spCostDuration','_cooldownPenalty','_cooldownDuration','_dodgeBonus',
 '_counterBonus','_hitChanceDebuff','_hitChanceDebuffDuration','_skillMisfireChance','_skillMisfireDuration',
 '_lifestealBonus','_outgoingMultiplier','_vulnerability','_damageTakenMultiplier','_damageTakenByCategory','_shieldIncomingCategory','_defPenBonus','_nextAttackMiss',
 '_nextCritFail','_nextDamageBonus','_damageStatBonus','_lowHpBonus','_abilityCritDamageBonus',
 '_healDamageRatio','_lastAbility','_hpRatio','_partyPassiveEffects','_teamDamageMultiplier',
 '_revivePending','_revived','_formUsed','_inForm','_formBoost','_reflect','_fx','_taunt',
 '_tauntUntilTurn','_tauntGrace','_durationGrace','_extraTurns','_skipTurns','_actedThisRound',
 '_acting','_sleepAppliedThisAction'];
function clearCombatTransient(agent){
 const threadCooldown=agent.cooldowns?.thread_binding,pendingThreads=(agent.threadTargets||[]).length>0||(agent.activeThreads||0)>0;
 if(threadCooldown===999||(pendingThreads&&threadCooldown>threadCooldownFor(agent)))agent.cooldowns.thread_binding=threadCooldownFor(agent);
 for(const key of COMBAT_TRANSIENT_FIELDS)delete agent[key];
 agent.threadTargets=[];agent.activeThreads=0;agent.thread=null;
}
function makeCombatUnit(source,options={}){
 const prepared=!!source._combatPrepared,raw=getCombatAgent(source),agent=cloneE(raw);
 const originalStats=cloneE(source._originalStats||raw.stats),originalBaseStats=raw.baseStats?cloneE(source._originalBaseStats||raw.baseStats):undefined;
 const originalStatus=prepared?source._originalStatus:raw.status;
 if(!prepared)clearCombatTransient(agent);
 agent.stats=prepared?cloneE(raw.stats):effectiveStats(raw);
 agent.status=prepared?cloneE(source.status||[]):[];agent.statusMeta=prepared?cloneE(source.statusMeta||{}):{};
 ensureCombatResource(agent);agent.resistances=combatResistances(agent);
 const pm=passiveCombatModifier(agent),maxHp=options.maxHp??(prepared?source.maxHp:Math.round(agent.stats.hp*(pm.hp||1)));
 const unit={...cloneE(source),agent,hp:options.hp??(prepared?source.hp:maxHp),maxHp,
   alive:source.alive!==false,inCombat:source.inCombat!==false,status:agent.status,statusMeta:agent.statusMeta,
   _combatPrepared:true,_originalStats:originalStats,_originalBaseStats:originalBaseStats,_originalStatus:originalStatus};
 if(!prepared)clearCombatTransient(unit);
 // Identity, stats and resources have one backing record. Aliases preserve the
 // existing enemy API without making the wrapper its own agent.
 for(const key of ['id','name','path','sequence','trait','traits','stats','sp','maxSP','cooldowns',
   'status','statusMeta','resistances','elementResistances','weaponId','weaponMastery',
   'statVariance','speedVariance','basePathSpeed','threadTargets','activeThreads','_threadAttempts']){
  Object.defineProperty(unit,key,{enumerable:true,configurable:true,get(){return agent[key];},set(value){agent[key]=value;}});
 }
 for(const key of ['atk','def','int'])Object.defineProperty(unit,key,{enumerable:true,configurable:true,
   get(){return agent.stats[key];},set(value){agent.stats[key]=value;}});
 Object.defineProperty(unit,'resistanceInt',{enumerable:true,configurable:true,get(){return agent.stats.int;},set(value){agent.stats.int=value;}});
 return unit;
}
function restoreCombatAgentStats(unit){
 const a=getCombatAgent(unit);a.stats=cloneE(unit._originalStats);
 if(unit._originalBaseStats)a.baseStats=cloneE(unit._originalBaseStats);
 a.status=unit._originalStatus||'active';delete a.statusMeta;
 clearCombatTransient(a);
 return a;
}

function makeEnemy(seq,r,i,pathHint=null){
 const isHuman=seq===10,path=isHuman?null:(pathHint||pickR(r,PATH_KEYS));
 const human={hp:rint(r,5,10),atk:rint(r,5,10),def:rint(r,5,10),int:rint(r,5,10)};
 const trait=randomTrait(r);
 const statVariance=rollVariance(r);
 const temp={humanStats:human,stats:human,trait,statVariance,recommendedPath:null};
 let stats=isHuman?humanScaled(human):statsAtSequence(awakenStats(temp,path,r),seq,path);
 const tier=seq===10?null:tierFor(path,seq);
 const abilities=seq===10?[]:pathOf(path).sequences.filter(t=>t.sequence>=seq).flatMap(t=>(t.abilities||[]).map(a=>({sequence:t.sequence,name:t.name,ability:a.text||t.abilityText||t.ability,type:a.type,effectId:a.effectId,damage:a.damage||null,effects:a.effects||[],effects:a.effects||[]})));
 return makeCombatUnit({id:`enemy_${i}`,name:isHuman?pickR(r,["Angry Suspect","Desperate Thief","Street Tough","Cornered Burglar"]):pickR(r,enemyNames),sequence:seq,path,awakened:!isHuman,occupation:isHuman?pickR(r,["Dockworker","Clerk","Thief","Butcher","Servant"]):null,humanStats:human,resistanceInt:stats.int,hp:stats.hp,maxHp:stats.hp,atk:stats.atk,def:stats.def,int:stats.int,stats:{hp:stats.hp,atk:stats.atk,def:stats.def,int:stats.int},abilities,abilityHistory:abilities,trait,traits:{name:trait,desc:TRAITS[trait].desc},statVariance,speedVariance:statVariance.speed,status:[],statusMeta:{},alive:true,distance:Math.round(5+r()*7),thread:null,weaponId:isHuman?pickR(r,['none','knife','club']):'none',weaponMastery:{},sp:0,maxSP:0,cooldowns:{},resistances:{...(G9D.balance.element_resistance_rules?.path_resistances?.[path]||{})},elementResistances:{}})
}

// Named encounters opt in to authored profiles. Random contracts and the
// simulator retain their existing enemy generation and random-number order.
function makeAuthoredEnemy(spec,r,i){
 if(!spec||!PATH_KEYS.includes(spec.path)||!Number.isInteger(spec.sequence)||spec.sequence<0||spec.sequence>9)throw new Error('Invalid authored enemy pathway or Sequence');
 const e=makeEnemy(spec.sequence,r,i,spec.path);
 if(spec.name)e.name=String(spec.name);
 if(spec.trait&&TRAITS[spec.trait]){e.trait=spec.trait;e.traits={name:spec.trait,desc:TRAITS[spec.trait].desc};}
 if(spec.stats){for(const k of ['hp','atk','def','int'])if(!Number.isFinite(spec.stats[k])||spec.stats[k]<=0)throw new Error('Invalid authored enemy stats');e.stats={...spec.stats};e._originalStats={...spec.stats};e.hp=e.maxHp=Math.round(spec.stats.hp*(passiveCombatModifier(e.agent).hp||1));}
 e.statVariance={hp:1,atk:1,def:1,int:1,speed:1};e.speedVariance=1;e.basePathSpeed=basePathSpeed(spec.path,spec.sequence);
 e.weaponId=WEAPONS[spec.weaponId]?spec.weaponId:'none';
 e.weaponMastery=cloneE(spec.weaponMastery||{});
 ensureCombatResource(e.agent);
 if(spec.sp!==undefined){if(!Number.isFinite(spec.sp)||spec.sp<0)throw new Error('Invalid authored enemy SP');e.sp=Math.min(e.maxSP,spec.sp);}
 e.resistances=combatResistances(e.agent);
 return e;
}

function damageMultiplier(attackerSeq, defenderSeq, attackerPath = null, defenderPath = null) {
  const gap = authorityGap(attackerSeq, defenderSeq);
  let mult = 1;
  if (gap === "dominated") mult *= 1.8;
  if (gap === "outclassed") mult *= 0.55;
  if (gap === "overwhelmed") mult *= 1.25;
  if (gap === "favored") mult *= 1.10;
  if (gap === "disadvantaged") mult *= 0.88;
  const matchup = pathMatchup(attackerPath, defenderPath);
  if (matchup === "favored") mult *= 1.15;
  if (matchup === "disfavored") mult *= 0.88;
  return mult;
}

function canAffect(attackerSeq, defenderSeq) {
  // Only the explicit Sequence-4+ authority rule creates a hard lock.
  // Lower-Sequenced combatants can still contribute against stronger mortals,
  // but suffer severe penalties.
  return !(defenderSeq <= 4 && attackerSeq > defenderSeq);
}


// ---- Incoming damage pipeline: negate (reflect buff) -> shield absorbs -> damage reduction -> HP, then reflect.
function matchesIncomingCategory(category,damageType){
 if(!category||category==='all')return true;
 const type=canonicalResistanceElement(damageType||'physical');
 const physical=type==='physical'||type==='piercing';
 if(category==='magic')return !physical&&type!=='true';
 if(category==='physical')return physical;
 return type===canonicalResistanceElement(category);
}
function incomingMultiplier(u,damageType='physical'){
 let passive=1;try{const pm=passiveCombatModifier(u.agent||u);passive=pm.damageTaken||1;for(const [category,value] of Object.entries(pm.damageTakenByCategory||{}))if(matchesIncomingCategory(category,damageType))passive*=value;}catch(e){}
 let active=Number(u._damageTakenMultiplier||1);
 for(const [category,value] of Object.entries(u._damageTakenByCategory||{}))if(matchesIncomingCategory(category,damageType)&&Math.abs(value-1)>Math.abs(active-1))active=value;
 return passive*active;
}
function recoverHP(unit,amount){
 if(!unit||!unit.alive||hasStatus(unit,'no_heal'))return 0;
 const before=Math.max(0,Number(unit.hp)||0),gain=Math.max(0,Math.round(Number(amount)||0));
 unit.hp=Math.min(unit.maxHp,before+gain);
 return Math.max(0,unit.hp-before);
}
function canGainShield(unit){return !!unit&&unit.alive&&!hasStatus(unit,'no_shield');}
function grantShield(unit,amount,incomingCategory=null){
 if(!canGainShield(unit))return 0;
 const before=unit.shield||0,next=Math.max(0,Math.round(Number(amount)||0));
 // The existing pool keeps its identity when a weaker/equal ward adds no HP.
 if(next<=before)return 0;
 unit.shield=next;
 if(incomingCategory&&incomingCategory!=='all')unit._shieldIncomingCategory=incomingCategory;else delete unit._shieldIncomingCategory;
 return next-before;
}
function setCombatDuration(unit,key,duration){
 unit[key]=Math.max(1,Number(duration)||1);
 unit._durationGrace=unit._durationGrace||{};
 if(unit._acting)unit._durationGrace[key]=true;else delete unit._durationGrace[key];
}
function settleFatalDamage(unit,state,lines=[],source=null){
 if(!unit||unit.hp>0)return {dead:!unit?.alive,revived:false};
 unit.hp=0;
 if(!unit.alive)return {dead:true,revived:false};
 unit.alive=false;
 const text=`${unit.name} falls.`;
 lines.push({text,kind:'victory'});
 emitCombatEvent(state,{round:state?.currentRound||1,type:'death',actorId:source?.id,actorName:source?.name,actorTeam:source?teamOf(source,state):undefined,targetId:unit.id,targetName:unit.name,targetTeam:teamOf(unit,state),text});
 const revived=!!tryRevive(unit,lines,state);
 return {dead:!unit.alive,revived};
}
function resolveIncoming(attacker,defender,dmg,state,lines=[],r,opt={}){if(!lines)lines=[];
 const incoming=Math.max(0,Math.round(dmg*Number(defender?._vulnerability||1))),res={incoming,absorbed:0,hpLoss:0,negated:false,reflected:0,dead:false,revived:false};
 if(!defender||!defender.alive||incoming<=0)return res;
 if(hasStatus(defender,'untargetable')){res.negated=true;lines.push({text:`${defender.name} is untargetable and avoids damage.`,kind:'status'});return res;}
 const dmgType=canonicalResistanceElement(opt.trueDamage?'true':opt.damageType||'physical');
 if(!opt.indirect&&hasStatus(defender,'possession_phase')&&matchesIncomingCategory('physical',dmgType)){res.negated=true;lines.push({text:`${defender.name}'s Possession Phase phases through physical damage!`,kind:'status'});return res;}
 const ward=defender._reflect;
 const rf=(ward&&!opt.reflect&&!opt.indirect&&!(state&&state._inReflect)&&matchesIncomingCategory(ward.incomingCategory,dmgType))?ward:null;
 if(rf&&rf.negate){res.negated=true;lines.push({text:`${defender.name} negates ${incoming} damage.`,kind:'quirk'});}
 else{
  let rem=incoming;
  if((defender.shield||0)>0&&matchesIncomingCategory(defender._shieldIncomingCategory,dmgType)){const ab=Math.min(defender.shield,rem);defender.shield-=ab;rem-=ab;res.absorbed=ab;if(!defender.shield)delete defender._shieldIncomingCategory;if(ab>0)lines.push({text:`${defender.name}'s shield absorbs ${ab} damage.`,kind:'status'});}
  const mult=opt.execute?1:incomingMultiplier(defender,dmgType);
  if(mult!==1&&rem>0){const reduced=Math.max(0,Math.round(rem*mult));if(reduced!==rem)lines.push({text:`${defender.name}'s damage ${mult<1?'reduction':'vulnerability'} changes ${rem} damage to ${reduced}.`,kind:'status'});rem=reduced;}
  res.hpLoss=Math.min(Math.max(0,defender.hp),rem);defender.hp=Math.max(0,defender.hp-rem);
  recordThreadDamage(defender,res.hpLoss,state,lines);
  Object.assign(res,settleFatalDamage(defender,state,lines,attacker));
  if(defender.hp>0&&(defender.agent||(defender.path&&defender.sequence!=null))){const wasInHit=state?._mythicalFromHit;if(state)state._mythicalFromHit=!opt.indirect;try{tryMythicalForm(defender.agent||defender,defender,state,lines,r);}finally{if(state)state._mythicalFromHit=wasInHit;}}
 }
 if(rf&&attacker&&attacker!==defender&&attacker.alive){
  let refl=0;
  if(rf.mode==='stat'){
   const rAgent=defender.agent||defender,el=rf.element||'physical';
   refl=v15Damage(rf.stat==='ATK'?'empowered_hybrid_physical':'pure_caster_ability',{agent:rAgent,actor:defender,target:attacker,abilityMult:Number(rf.multiplier||1),damageSpec:{scaling:rf.stat,multiplier:Number(rf.multiplier||1),type:'elemental',element:el},trace:null});
  } else refl=Math.round(incoming*Number(rf.share||0));
  if(refl>0){
   const reflectLine={text:'',kind:'quirk'};lines.push(reflectLine);
   const wasReflect=state?._inReflect;if(state)state._inReflect=true;
   let rr;try{rr=resolveIncoming(defender,attacker,refl,state,lines,r,{reflect:true,damageType:rf.element||'physical'});}finally{if(state)state._inReflect=wasReflect;}
   res.reflected=rr.hpLoss+rr.absorbed;
   reflectLine.text=`${defender.name} reflects ${res.reflected} damage back at ${attacker.name}.`;
   emitCombatEvent(state,{round:state?.currentRound||1,type:'damage',actorId:defender.id,actorName:defender.name,actorTeam:teamOf(defender,state),targetId:attacker.id,targetName:attacker.name,targetTeam:teamOf(attacker,state),amount:res.reflected,incoming:refl,absorbed:rr.absorbed,hpLoss:rr.hpLoss,hpAfter:attacker.hp,maxHp:attacker.maxHp,damageType:rf.element||'reflected',isReflect:true,text:reflectLine.text});
  }
 }
 return res;
}
function beginTurn(c){if(c._reflect&&c._reflect.untilTurn)c._reflect=undefined;c._tauntUntilTurn=false;if(c._fx&&c._fx.some(f=>f.turn)){c._fx=c._fx.filter(f=>!f.turn);recomputeFx(c);}}
function tauntFilter(attacker,list){const tn=list.filter(x=>x.alive&&((x._taunt||0)>0||x._tauntUntilTurn)&&!hasStatus(x,'untargetable'));return(tn.length&&!statusImmune(attacker,'taunt'))?tn:list;}
function statusResistChance(t,st){try{return Math.min(1,passiveCombatModifier(t?.agent||t).statusResist?.[st]||0);}catch(e){return 0;}}

// ---- Timed effects: every effect carries its own duration.
// Numeric durations count holder actions; 'next_turn' expires at the holder's next turn start.
function fxDuration(e,type){const d=(e&&e.duration!==undefined)?e.duration:((G9D.balance||{}).effect_durations||{})[type];return d===undefined?2:d;}
function addFx(u,cat,key,val,dur){
 u._fx=u._fx||[];const turn=dur==='next_turn',rounds=turn?0:Math.max(1,Number(dur)||2);
 const ex=u._fx.find(x=>x.cat===cat&&x.key===key&&x.val===val&&x.turn===turn);
 if(ex){ex.rounds=Math.max(ex.rounds,rounds);ex._grace=!!u._acting;}
 else u._fx.push({cat,key,val,turn,rounds,_grace:!!u._acting});
 recomputeFx(u);
}
function removeFxCat(u,cat){u._fx=(u._fx||[]).filter(f=>f.cat!==cat);recomputeFx(u);}
function recomputeFx(u){
 const far=(cur,v)=>(cur===undefined||Math.abs(v-1)>Math.abs(cur-1))?v:cur;
 const buffs={},debuffs={},damageTakenByCategory={};let speed,outg,vuln,dtm,dodge=0,counter=0,defpen=0,lifesteal=0;
 for(const f of u._fx||[]){
  if(f.cat==='buff')buffs[f.key]=Math.max(buffs[f.key]||1,f.val);
  else if(f.cat==='debuff')debuffs[f.key]=Math.min(debuffs[f.key]||1,f.val);
  else if(f.cat==='speed_debuff')speed=Math.min(speed||1,f.val);
  else if(f.cat==='outgoing')outg=far(outg,f.val);
  else if(f.cat==='vuln')vuln=Math.max(vuln||1,f.val);
  else if(f.cat==='dtm'){if(f.key==='dtm'||f.key==='all')dtm=far(dtm,f.val);else damageTakenByCategory[f.key]=far(damageTakenByCategory[f.key],f.val);}
  else if(f.cat==='dodge')dodge=Math.max(dodge,f.val);
  else if(f.cat==='counter')counter=Math.max(counter,f.val);
  else if(f.cat==='defpen')defpen=Math.max(defpen,f.val);
  else if(f.cat==='lifesteal')lifesteal=Math.max(lifesteal,f.val);
 }
 u._buffs=Object.keys(buffs).length?buffs:undefined;u._debuffs=Object.keys(debuffs).length?debuffs:undefined;
 u._damageTakenByCategory=Object.keys(damageTakenByCategory).length?damageTakenByCategory:undefined;
 u._speedDebuff=speed;u._outgoingMultiplier=outg;u._vulnerability=vuln;u._damageTakenMultiplier=dtm;u._dodgeBonus=dodge;u._counterBonus=counter;u._defPenBonus=defpen;u._lifestealBonus=lifesteal;
 syncUnitToAgent(u);
}
function tickFx(u){
 if(u._fx&&u._fx.length){for(const f of u._fx)if(!f.turn){if(f._grace)delete f._grace;else f.rounds--;}u._fx=u._fx.filter(f=>f.turn||f.rounds>0);recomputeFx(u);}
 if(u._reflect&&!u._reflect.untilTurn){if(u._reflect._grace)delete u._reflect._grace;else if(--u._reflect.rounds<=0)u._reflect=undefined;}
}
function hasStatus(target,status){return !!target?.status?.includes(status);}
const SELF_STATUSES=['evade','untargetable','guarded','inspired','possession_phase'];
const CLEANSE_STATUSES=['burn','bleed','poison','curse','silenced','confused','sleep','stunned','frozen','freeze','bound'];
const TRANSFER_STATUSES=[...CLEANSE_STATUSES,'dreambound','controlled','root','no_heal','no_shield'];
const DOT_RULES=[['burn',.07,'fire'],['poison',.05,'poison'],['curse',.03,'dark'],['decay',.025,'dark'],['bleed',.03,'physical']];
const THREAD_RULES=Object.freeze({required:5,initialSpeedLoss:.15,dodgeLoss:.10,hitLoss:.10,advancedSpeedLoss:.35,bindingChance:.30,marionetteStats:.55,damageThreshold:.30});
function statusImmune(t,s){try{return (passiveCombatModifier(t?.agent||t).immunities||[]).includes(s);}catch(e){return false;}}
function addStatus(target,status,duration=1,source="unknown",extraMeta={}){if(statusImmune(target,status))return;target.status=target.status||[];target.statusMeta=target.statusMeta||{};if(!target.status.includes(status))target.status.push(status);target.statusMeta[status]={duration:Math.max(1,Number(duration)||1),source,_grace:target._acting===true,...(extraMeta||{})};}
function removeStatus(target,status){if(!target?.status)return;target.status=target.status.filter(x=>x!==status);if(target.statusMeta)delete target.statusMeta[status];}
function processStatuses(unit,add=()=>{},state=null,decrement=true){
 if(!unit.alive)return;unit.status=unit.status||[];unit.statusMeta=unit.statusMeta||{};
 for(const [status,ratio,damageType] of DOT_RULES){
  if(!unit.alive)break;
  if(!hasStatus(unit,status))continue;
  if(!hasStatus(unit,'untargetable')){
   const damage=Math.max(1,Math.round(unit.maxHp*ratio)),sourceName=unit.statusMeta[status]?.source;
   const source=[...(state?.allies||[]),...(state?.enemies||[])].find(x=>x.id===sourceName||x.name===sourceName)||null;
   const details=[],hit=resolveIncoming(source,unit,damage,state,details,state?.rng,{damageType,indirect:true});
   const resolved=hit.hpLoss+hit.absorbed;
   add(`${unit.name} takes ${resolved} ${status[0].toUpperCase()+status.slice(1)} damage (${damage} incoming, ${hit.hpLoss} HP lost).`);
   emitCombatEvent(state,{round:state?.currentRound||1,type:'damage',actorId:source?.id,actorName:source?.name||status,actorTeam:source?teamOf(source,state):undefined,targetId:unit.id,targetName:unit.name,targetTeam:teamOf(unit,state),ability:status[0].toUpperCase()+status.slice(1),amount:resolved,incoming:damage,absorbed:hit.absorbed,hpLoss:hit.hpLoss,damageType,isDot:true,hpAfter:unit.hp,maxHp:unit.maxHp});
   for(const line of details)add(line.text);
   // A resurrection before this action starts exhausts this action, not the next two.
   if(hit.revived&&unit.statusMeta.spiritual_exhaustion)unit.statusMeta.spiritual_exhaustion._grace=false;
  }
  // Standalone compatibility: only DoT durations decrement here. The battle
  // loop passes false and expires all statuses together after the victim acts.
  if(decrement&&unit.statusMeta[status]){
   const meta=unit.statusMeta[status];if(meta._grace)delete meta._grace;else if(--meta.duration<=0)removeStatus(unit,status);
  }
 }
}


function tickUnitStatuses(unit){
  if(!unit||!unit.status||!unit.statusMeta)return;
  for(const st of [...unit.status]){
    const m=unit.statusMeta[st];
    if(m){
      if(m._grace){delete m._grace;continue;}
      m.duration--;
      if(m.duration<=0)removeStatus(unit,st);
    }
  }
}

function isThreadBeyonder(agent) {
  return agent.path === "fool" && agent.sequence <= 5;
}

function hasThreadCC(agentUnit) {
  const statuses = agentUnit?.status || [];
  return ["stunned", "silenced", "frozen", "polymorphed", "bound", "unconscious"].some((x) => statuses.includes(x));
}

function threadUsage(state,agent){return (agent.threadTargets||[]).length+((state&&state.battleMarionettes)||[]).filter(m=>m.ownerId===agent.id&&m.unit.alive).length;}
function threadCooldownFor(agent){const sp=unlockedAbilities(agent).find(x=>x.effectId==='thread_binding'||x.id==='thread_binding');const cd=Number(sp?.cooldown??5);return cd>0?cd+1:0;}

function checkThreadInterruptOnTarget(target, state, lines=[]) {
  if (!target || !target.thread) return false;
  const ownerId = target.thread.ownerId;
  const allUnits = [...(state?.allies || []), ...(state?.enemies || [])];
  const ownerUnit = allUnits.find(u => (u.agent?.id || u.id) === ownerId);
  const ownerAgent = ownerUnit?.agent || ownerUnit;
  if (ownerAgent) {
    releaseThread(ownerAgent, target);
    const msg = `The thread on ${target.name} is interrupted and its progress resets.`;
    if (lines) lines.push({ text: msg, kind: 'status' });
    emitCombatEvent(state, {
      round: state?.currentRound || 1,
      type: 'thread',
      subtype: 'interrupt',
      actorId: ownerAgent.id,
      actorName: ownerAgent.name,
      actorTeam: teamOf(ownerAgent, state),
      targetId: target.id,
      targetName: target.name,
      targetTeam: teamOf(target, state),
      text: msg
    });
    if (ownerAgent._threadAttempts > 0) ownerAgent._threadAttempts--;
    return true;
  }
  return false;
}

function releaseThread(agent,enemy){
  agent.cooldowns=agent.cooldowns||{};agent.cooldowns.thread_binding=threadCooldownFor(agent); // CD counts from the moment the thread resolves
  agent.threadTargets=(agent.threadTargets||[]).filter(id=>id!==enemy.id);
  agent.activeThreads=agent.threadTargets.length;
  enemy.thread=null;
  removeStatus(enemy,"threaded");
  enemy._threadSpeedDebuff=0;
  enemy._threadDodgeDebuff=0;
  enemy._threadHitDebuff=0;
  enemy._threadLockDodge=false;
  enemy._threadStiffened=false;
}
function applySpiritThread(agent,enemy,actor,state,lines=[],r){if(!lines)lines=[];
 if(!isThreadBeyonder(agent))return false;
 const slots=threadSlots(agent.sequence);
 if(threadUsage(state,agent)>=slots){
   const limitMsg = `${actor.name} has reached their personal thread limit (${slots}).`;
   lines.push({text:limitMsg,kind:'system'});
   emitCombatEvent(state, {round:state?.currentRound||1,type:'status',actorId:agent.id,actorName:agent.name,actorTeam:teamOf(agent,state),targetId:enemy.id,targetName:enemy.name,targetTeam:teamOf(enemy,state),text:limitMsg});
   return false;
 }

 if(enemy.thread)return false;
 // Attempt budget per fight: keeps thread-kills a meaningful gamble now that fights last several rounds.
 const budget=({5:1,4:2,3:2,2:3,1:3,0:4})[agent.sequence]||1;
 if((agent._threadAttempts||0)>=budget)return false;
 agent._threadAttempts=(agent._threadAttempts||0)+1;
 const intGap=(enemy.resistanceInt??enemy.int)-agent.stats.int;
 const resist=Math.max(.08,Math.min(.70,({5:.62,4:.55,3:.45,2:.35,1:.25,0:.20})[agent.sequence]+Math.max(0,enemy.sequence-agent.sequence)*.16+Math.max(0,intGap)/Math.max(1,agent.stats.int)*.5));
 if(r()<resist){
   const resistMsg = `${enemy.name} resists the Spirit Body Thread.`;
   lines.push({text:resistMsg,kind:'status'});
   emitCombatEvent(state, {round:state?.currentRound||1,type:'status',actorId:agent.id,actorName:agent.name,actorTeam:teamOf(agent,state),targetId:enemy.id,targetName:enemy.name,targetTeam:teamOf(enemy,state),text:resistMsg});
   changeMeter(agent,'fool',5); if (agent._threadAttempts > 0) agent._threadAttempts--; return false;
 }
 enemy.thread={ownerId:agent.id,progress:0,required:THREAD_RULES.required};
 agent.threadTargets=[...(agent.threadTargets||[]),enemy.id];agent.activeThreads=agent.threadTargets.length;changeMeter(agent,'fool',-12);
 addStatus(enemy,'threaded',enemy.thread.required,'Spirit Body Thread');
 const graspMsg = `${actor.name} grasps the invisible Spirit Body Thread attached to ${enemy.name}.`;
 lines.push({text:graspMsg,kind:'quirk'});
 emitCombatEvent(state, {round:state?.currentRound||1,type:'thread',actorId:agent.id,actorName:agent.name,actorTeam:teamOf(agent,state),targetId:enemy.id,targetName:enemy.name,targetTeam:teamOf(enemy,state),text:graspMsg});
 return true;
}
function joinMarionette(state,owner,target,lines=[]){if(!lines)lines=[];
  // Battle-only Marionette: 55% of the dead unit's stats, fights for the thread owner's side, never saved to the roster.
  const pct=THREAD_RULES.marionetteStats,ownerAllied=state.allies.some(x=>x.id===owner.id),rng=state.rng||Math.random;
  const src=target.agent?{hp:target.maxHp,atk:target.agent.stats.atk,def:target.agent.stats.def,int:target.agent.stats.int}:{hp:target.maxHp,atk:target.atk,def:target.def,int:target.int};
  const st={hp:Math.max(1,Math.round(src.hp*pct)),atk:Math.max(1,Math.round(src.atk*pct)),def:Math.max(1,Math.round(src.def*pct)),int:Math.max(1,Math.round(src.int*pct))};
  const seq=target.agent?target.agent.sequence:target.sequence,path=target.agent?target.agent.path:target.path;
  const name=`${target.name} — Marionette`,id=`mar_${target.id}`;
  const ag={...cloneE(getCombatAgent(target)),id,name,path,sequence:seq,awakened:!!path&&getCombatAgent(target).awakened!==false,
    unitType:'marionette',ownerId:owner.id,stats:{...st},baseStats:{...st},injuries:0,madness:0,
    weaponId:'none',weaponMastery:{},cooldowns:{},threadTargets:[],activeThreads:0,
    status:[],statusMeta:{},thread:null,_threadAttempts:0};
  ag.sp=ag.maxSP=maxSPFor(ag);
  const unit=makeCombatUnit(ag,{hp:st.hp,maxHp:st.hp});unit.summoned=true;
  unit.agent._teamDamageMultiplier=getCombatAgent(owner)._teamDamageMultiplier??1;
  (ownerAllied?state.allies:state.enemies).push(unit);
  state.battleMarionettes=state.battleMarionettes||[];state.battleMarionettes.push({ownerId:owner.id,unit,side:ownerAllied?'ally':'enemy'});
  lines.push({text:`${name} rises under ${owner.name||'its owner'}'s control (55% stats) and joins the fight.`,kind:'quirk'});
  emitCombatEvent(state,{round:state?.currentRound||1,type:'system',text:`${name} joins ${owner.name||'the owner'}'s side as a Marionette.`});
}
// Damage is measured after shields/reduction and shared by all hits in one actor turn.
function applyThreadStage(target){
 const stage=target.thread?.progress||0;
 target._threadSpeedDebuff=stage>=3?THREAD_RULES.advancedSpeedLoss:stage>=1?THREAD_RULES.initialSpeedLoss:0;
 target._threadDodgeDebuff=stage>=2?-THREAD_RULES.dodgeLoss:0;
 target._threadHitDebuff=stage>=2?THREAD_RULES.hitLoss:0;
 target._threadLockDodge=stage>=3;target._threadStiffened=false;
 syncUnitToAgent(target);
}
function recordThreadDamage(target,hpLoss,state,lines=[]){
 const t=target.thread;if(!t||hpLoss<=0)return;
 const turn=state?.currentTurn??state?.currentRound??0;
 if(t.damageTurn!==turn){t.damageTurn=turn;t.hpLossThisTurn=0;t.severedThisTurn=false;}
 t.hpLossThisTurn+=hpLoss;
 if(!t.severedThisTurn&&t.hpLossThisTurn>target.maxHp*THREAD_RULES.damageThreshold){
  t.severedThisTurn=true;
  if(t.progress<=0)return;
  t.progress--;applyThreadStage(target);
  const text=`${target.name} loses one Spirit Thread stack after losing more than ${THREAD_RULES.damageThreshold*100}% Max HP in this turn.`;
  lines.push({text,kind:'status'});
  emitCombatEvent(state,{type:'thread',subtype:'damage_interrupt',targetId:target.id,targetName:target.name,targetTeam:teamOf(target,state),progress:t.progress,text});
 }
}
function processSpiritThreads(state,lines=[]){if(!lines)lines=[];const allUnits=[...state.allies,...state.enemies];for(const ally of allUnits.filter(x=>x.alive&&isThreadBeyonder(x.agent||x))){const agent=ally.agent||ally;const targets=state.allies.includes(ally)?state.enemies:state.allies;for(const enemy of targets.filter(x=>x.thread?.ownerId===agent.id)){const t=enemy.thread;if(!enemy.alive){releaseThread(agent,enemy);lines.push({text:`The thread ends because ${enemy.name} is dead; the slot is freed.`,kind:"system"});continue;}if(!ally.alive||hasThreadCC(ally)||hasStatus(enemy,'untargetable')||hasStatus(enemy,'banished')){
        releaseThread(agent,enemy);
        const interruptMsg = `The thread on ${enemy.name} is interrupted and its progress resets.`;
        lines.push({text:interruptMsg,kind:"status"});
        emitCombatEvent(state,{round:state?.currentRound||1,type:'thread',subtype:'interrupt',actorId:agent.id,actorName:agent.name,actorTeam:teamOf(agent,state),targetId:enemy.id,targetName:enemy.name,targetTeam:teamOf(enemy,state),text:interruptMsg});
        if(agent._threadAttempts>0)agent._threadAttempts--;
        continue;
      }
      t.progress++;applyThreadStage(enemy);
      let debuffMsg = '';
      if(t.progress===1){
        enemy._threadSpeedDebuff=THREAD_RULES.initialSpeedLoss;
        debuffMsg = `${enemy.name} suffers -15% Speed from tightening Spirit Threads.`;
      }else if(t.progress===2){
        enemy._threadDodgeDebuff=-THREAD_RULES.dodgeLoss;
        enemy._threadHitDebuff=THREAD_RULES.hitLoss;
        debuffMsg = `${enemy.name} suffers -10% Dodge and +10% Miss chance from tightening Spirit Threads.`;
      }else if(t.progress===3){
        enemy._threadSpeedDebuff=THREAD_RULES.advancedSpeedLoss;
        enemy._threadLockDodge=true;
        debuffMsg = `${enemy.name} suffers -35% Speed and cannot dodge from tightening Spirit Threads.`;
      }else if(t.progress===4){
        debuffMsg = `${enemy.name} is on the verge of total control (30% chance to be bound each turn).`;
      }
      if(debuffMsg){
        lines.push({text:debuffMsg,kind:'status'});
        emitCombatEvent(state,{round:state?.currentRound||1,type:'thread',subtype:'debuff',actorId:agent.id,actorName:agent.name,actorTeam:teamOf(agent,state),targetId:enemy.id,targetName:enemy.name,targetTeam:teamOf(enemy,state),text:debuffMsg});
      }
      if(t.progress>=t.required){
        enemy.hp=0;enemy.alive=false;releaseThread(agent,enemy);changeMeter(agent,"fool",18);
        lines.push({text:`${agent.name} completes the Spirit Body Thread. ${enemy.name} dies and becomes a Marionette for the rest of this battle.`,kind:"victory"});emitCombatEvent(state,{round:state?.currentRound||1,type:'death',actorId:agent.id,actorName:agent.name,actorTeam:teamOf(agent,state),targetId:enemy.id,targetName:enemy.name,targetTeam:teamOf(enemy,state),text:`${enemy.name} dies and becomes a Marionette (this battle only).`,converted:true});
        joinMarionette(state,agent,enemy,lines);
      }else{
        lines.push({text:`${enemy.name}'s thread holds. ${t.required-t.progress} round(s) remain.`,kind:"status"});emitCombatEvent(state,{round:state?.currentRound||1,type:'thread',actorId:agent.id,actorName:agent.name,actorTeam:teamOf(agent,state),targetId:enemy.id,targetName:enemy.name,targetTeam:teamOf(enemy,state),text:`${enemy.name}'s thread holds. ${t.required-t.progress} round(s) remain.`});
      }}}}

function abilityEffects(spec){return Array.isArray(spec?.effects)?spec.effects:[];}
function hasEffect(spec,type){return abilityEffects(spec).some(e=>e.type===type);}
function effectsOf(spec,type){return abilityEffects(spec).filter(e=>e.type===type);}
function effectAmount(spec,type,field='amount',fallback=0){const e=abilityEffects(spec).find(x=>x.type===type);return Number(e?.[field]??fallback);}
// Resistance values are percentage points. Aliases name the same protection;
// one effect listing both physical and slashing must not grant it twice.
function canonicalResistanceElement(element){
 const aliases=G9D.balance.element_resistance_rules?.aliases||{};let key=String(element||'').toLowerCase();const seen=new Set();
 while(Object.prototype.hasOwnProperty.call(aliases,key)&&typeof aliases[key]==='string'&&!seen.has(key)){seen.add(key);key=aliases[key].toLowerCase();}
 return ['__proto__','prototype','constructor'].includes(key)?'':key;
}
function canonicalResistanceMap(values){
 const map={};for(const [element,value] of Object.entries(values||{})){const key=canonicalResistanceElement(element);if(!key||typeof value!=='number'||!Number.isFinite(value))continue;map[key]=Object.prototype.hasOwnProperty.call(map,key)?Math.max(map[key],value):value;}return map;
}
function resistanceBonusesFor(agent,passive=passiveCombatModifier(agent)){
 if(agent.resistanceBonuses&&typeof agent.resistanceBonuses==='object')return canonicalResistanceMap(agent.resistanceBonuses);
 const stored=canonicalResistanceMap(agent.resistances),base=canonicalResistanceMap(G9D.balance.element_resistance_rules?.path_resistances?.[agent.path]),earned=canonicalResistanceMap(passive.resistances),bonuses={};
 for(const [key,value] of Object.entries(stored)){
  const hasBase=Object.prototype.hasOwnProperty.call(base,key),hasEarned=Object.prototype.hasOwnProperty.call(earned,key);
  if(!hasBase&&!hasEarned){bonuses[key]=value;continue;}
  // Old saves serialized combat totals, sometimes a passive fraction that
  // overwrote the default. Recognize those caches rather than adding them.
  const defaultValue=base[key]||0,legacyPassive=(earned[key]||0)/100,total=defaultValue+(earned[key]||0);
  if([defaultValue,total,...(hasEarned?[legacyPassive]:[])].some(x=>Math.abs(value-x)<1e-9))continue;
  const legacyBase=hasEarned&&Math.abs(value-legacyPassive)<Math.abs(value-defaultValue)?legacyPassive:defaultValue;
  bonuses[key]=value-legacyBase;
 }
 return bonuses;
}
function combatResistances(agent,passive=passiveCombatModifier(agent)){
 const rules=G9D.balance.element_resistance_rules||{},base=canonicalResistanceMap(rules.path_resistances?.[agent.path]),earned=canonicalResistanceMap(passive.resistances),extra=resistanceBonusesFor(agent,passive),result={...base};
 for(const map of [earned,extra])for(const [key,value] of Object.entries(map))result[key]=(result[key]||0)+value;
 for(const key of Object.keys(result))result[key]=Math.max(rules.min_resistance??-100,Math.min(rules.max_positive_resistance??90,result[key]));
 return result;
}
function passiveCombatModifier(agent){
 const specs=[...unlockedAbilities(agent).filter(x=>x.type==='passive'&&!abilityEffects(x).some(e=>(e.type==='combat_rule'&&e.rule==='party')||(e.type==='targeting'&&e.mode==='all_allies'))), ...((agent._partyPassiveEffects||[]).length?[{type:'passive',effects:agent._partyPassiveEffects}]:[])];
 let atk=1,def=1,int=1,damageTaken=1,crit=0,critDamage=.50,initiative=0,counter=.03,dodge=0,lifesteal=0,defPen=0,hp=1,hitChance=0,resistances={};const immunities=[];let spellPen=0;const statusResist={},damageTakenByCategory={};
 for(const x of specs){for(const e of abilityEffects(x)){
   const n=Number(e.amount||0);
   if(e.type==='stat_modifier'){if(e.stat==='atk')atk*=1+n;if(e.stat==='def')def*=1+n;if(e.stat==='int')int*=1+n;if(e.stat==='hp')hp*=1+n;}
   else if(e.type==='damageTaken'||e.type==='damage_taken'){if(e.incomingCategory)damageTakenByCategory[e.incomingCategory]=(damageTakenByCategory[e.incomingCategory]||1)*(1+n);else damageTaken*=1+n;}
   else if(e.type==='crit')crit+=n; else if(e.type==='critDamage')critDamage+=n; else if(e.type==='initiative')initiative+=n; else if(e.type==='counter')counter+=n; else if(e.type==='dodge')dodge+=n; else if(e.type==='lifesteal')lifesteal+=Number(e.ratio??n); else if(e.type==='defPen'||e.type==='defense_penetration')defPen+=Number(e.amount||0); else if(e.type==='hitChance')hitChance+=n;
   else if(e.type==='resistance'){const values=canonicalResistanceMap(e.values||(e.element?{[e.element]:e.amount}:{}));for(const [k,v] of Object.entries(values))resistances[k]=(resistances[k]||0)+v;}
   else if(e.type==='immunity'&&e.status)immunities.push(e.status);
   else if(e.type==='spell_penetration')spellPen+=n;
   else if(e.type==='status_resistance'&&e.status)statusResist[e.status]=(statusResist[e.status]||0)+Number(e.amount||0);
 }}
 if(agent._buffs){atk*=agent._buffs.atk||1;def*=agent._buffs.def||1;int*=agent._buffs.int||1;}
 return {atk,def,int,damageTaken,damageTakenByCategory,crit,critDamage,initiative,counter,dodge,lifesteal,defPen,hp,hitChance,resistances,immunities,spellPen,statusResist};
}
function statusCombatModifier(actor){const m={atk:1,int:1,def:1,crit:0,critDamage:0,dodge:0,counter:0};for(const st of actor?.status||[]){if(st==='inspired'){m.atk*=1.08;m.int*=1.05;}if(st==='guarded')m.def*=1.10;if(st==='evade'){const dr=Number(actor?.statusMeta?.['evade']?.dodgeRate??0.25);m.dodge+=dr;}if(st==='weakened')m.atk*=.90;if(st==='freeze'||st==='curse')m.def*=.90;}return m;}
function basePathSpeed(path,sequence=9){
  // Base Pathway Speed is the 5th column of STAT_TABLE. Ordinary humans (Sequence 10) use a flat low value.
  if(!path||sequence>=10) return 55;
  return tableStats(path,sequence).spd;
}
function speedFor(agent){
  const spdCfg = G9D?.formulas?.speed_and_turn_order || {};
  const intWeight = Number(spdCfg.stat_weights?.int ?? 0.2);
  const atkWeight = Number(spdCfg.stat_weights?.atk ?? 0.1);
  const freezeMult = (hasStatus(agent,'freeze')||hasStatus(agent.agent||{},'freeze')) ? Number(spdCfg.freeze_speed_multiplier ?? 0.8) : 1;
  const st = agent.stats || {};
  const base = Number(basePathSpeed(agent.path, agent.sequence ?? 9) || 100);
  const raw = base + (intWeight * (st.int || 0)) + (atkWeight * (st.atk || 0));
  const variance = Number(agent.speedVariance || agent.statVariance?.speed || 1);
  return Math.max(1, raw * variance * (traitData(agent).spd_mult || 1) * (agent._buffs?.speed || 1) * (1 - (agent._speedDebuff ? 1 - agent._speedDebuff : 0)) * (1 - (agent._threadSpeedDebuff || 0)) * freezeMult);
}
function actionValueFor(agent){
  const avConstant = Number(G9D?.formulas?.speed_and_turn_order?.action_value_constant ?? 10000);
  return avConstant / speedFor(agent);
}
function maxSPFor(agent){ return Math.round(spTableFor(agent).max*(traitData(agent).sp_mult||1)); }
// Initiative bonuses are percentages so they stay meaningful as Speed grows with Sequence.
function initiativeScore(agent){return speedFor(agent)*(1+(passiveCombatModifier(agent).initiative||0)/100);}
function unitInitiative(u){return initiativeScore(getCombatAgent(u));}

function combatRates(agent,actor=agent){
  const pm=passiveCombatModifier(agent),sm=statusCombatModifier(actor),stats=agent.stats||agent,int=stats.int||10,def=stats.def||10;
  const close=weaponFor(agent).kind==='unarmed'?weaponMasteryValue(agent,'unarmed'):0;
  
  const crCfg = G9D?.formulas?.combat_rates || {};
  const critBase = Number(crCfg.crit?.base_rate ?? 0.15);
  const critMax = Number(crCfg.crit?.max_rate ?? 1.00); // 100% max crit rate

  const dodgeBase = Number(crCfg.dodge?.base_rate ?? 0.05);
  const dodgeIntNum = Number(crCfg.dodge?.int_scaling_num ?? 0.22);
  const dodgeIntDenom = Number(crCfg.dodge?.int_scaling_denom ?? 150);
  const dodgeMastery = Number(crCfg.dodge?.close_quarters_mastery_factor ?? 0.015);
  const dodgeMax = Number(crCfg.dodge?.max_rate ?? 0.75);

  const counterBase = Number(crCfg.counter?.base_rate ?? 0.03);
  const counterDefNum = Number(crCfg.counter?.def_scaling_num ?? 0.20);
  const counterDefDenom = Number(crCfg.counter?.def_scaling_denom ?? 200);
  const counterMax = Number(crCfg.counter?.max_rate ?? 0.45);

  let dodgeRate = Math.min(dodgeMax, dodgeBase + (dodgeIntNum * int) / (int + dodgeIntDenom) + pm.dodge + sm.dodge + close * dodgeMastery + (agent._dodgeBonus || 0) + (agent._threadDodgeDebuff || 0));
  if(agent._threadLockDodge) dodgeRate = 0;
  else dodgeRate = Math.max(0, dodgeRate);

  const mergedResistances = combatResistances(agent,pm);

  const passives = unlockedAbilities(agent).filter(x=>x.type==='passive').map(p=>{
    const parts=[];
    for(const e of abilityEffects(p)){
      if(e.type==='stat_modifier') parts.push(`+${Math.round((e.amount||0)*100)}% ${String(e.stat).toUpperCase()}`);
      if(e.type==='resistance'){
        for(const [rk,rv] of Object.entries(canonicalResistanceMap(e.values||(e.element?{[e.element]:e.amount}:{})))){
          parts.push(`+${Math.round(rv)}% ${rk.charAt(0).toUpperCase()+rk.slice(1)} Res`);
        }
      }
      if(e.type==='status_resistance'&&e.status)parts.push(`+${Math.round(Number(e.amount||0)*100)}% ${e.status.charAt(0).toUpperCase()+e.status.slice(1)} Status Res`);
    }
    const name=(p.text||p.name||p.effectId||'Passive').split(' — ')[0];
    return parts.length ? `${name} (+${parts.map(x=>x.replace(/^\+/,'')).join(', ')})` : name;
  });

  return {
    crit: Math.min(critMax, critBase + pm.crit),
    critDamage: pm.critDamage,
    dodge: dodgeRate,
    counter: Math.min(counterMax, counterBase + (counterDefNum * def) / (def + counterDefDenom) + pm.counter + sm.counter + (agent._counterBonus || 0)),
    speed: speedFor(agent),
    av: actionValueFor(agent),
    resistance: traitData(agent).resistance || 0,
    resistances: mergedResistances,
    passives
  };
}
function maybeCounter(target,attacker,state,lines=[],r){if(!lines)lines=[];if(!target?.alive||!attacker?.alive)return;
 const a=getCombatAgent(target),d=getCombatAgent(attacker),rates=combatRates(a,target);
 if(r()<rates.counter){const w=weaponStats(a),stats=a.stats||a;
  const dmg=Math.max(1,Math.round((stats.atk*.38+w.atk)*damageMultiplier(a.sequence,d.sequence,a.path,d.path)-(d.stats?.def||attacker.def||10)*.15));
  lines.push({text:`${target.name} counters for ${dmg} damage (${Math.round(rates.counter*100)}% counter chance).`,kind:'quirk'});
  emitCombatEvent(state,{round:state?.currentRound||1,type:'cast',actorId:target.id,actorName:target.name,actorTeam:teamOf(target,state),ability:'Counter',costSP:0,cooldown:0,isCounter:true});
  const hit=resolveIncoming(target,attacker,dmg,state,lines,r,{damageType:'physical'});
  emitCombatEvent(state,{round:state?.currentRound||1,type:'damage',actorId:target.id,actorName:target.name,actorTeam:teamOf(target,state),targetId:attacker.id,targetName:attacker.name,targetTeam:teamOf(attacker,state),amount:hit.hpLoss+hit.absorbed,damageType:'physical',isCounter:true,hpAfter:attacker.hp,maxHp:attacker.maxHp});
 }
}
function consumeAttackMiss(actor,r){const chance=Number(actor._nextAttackMiss||0);actor._nextAttackMiss=0;return chance>0&&r()<chance;}
function consumeCritFailure(actor){const blocked=!!actor._nextCritFail;actor._nextCritFail=0;return blocked;}
function attackHit(agent,actor,target,state,lines=[],r,{forcedMiss=false,weaponAttack=false,ability='Attack'}={}){
 const miss=text=>{lines.push({text,kind:'status'});emitCombatEvent(state,{round:state?.currentRound||1,type:'miss',actorId:actor.id,actorName:actor.name,actorTeam:teamOf(actor,state),targetId:target.id,targetName:target.name,targetTeam:teamOf(target,state),text});return false;};
 if(forcedMiss)return miss(`${actor.name}'s ${ability} is forced to miss.`);
 if(!target.alive||hasStatus(target,'untargetable'))return miss(`${actor.name} cannot target ${target.name}.`);
 if(hasStatus(target,'evade')&&(target.statusMeta?.evade?.dodgeRate===undefined||Number(target.statusMeta.evade.dodgeRate)>=1))return miss(`${target.name}'s Evasion lets them slip away untouched — ${actor.name}'s ${ability} misses.`);
 const pm=passiveCombatModifier(agent),targetAgent=getCombatAgent(target),targetStats=targetAgent.stats||target,
   enemyRates=combatRates(targetAgent,target),dodgeMaxCap=Number(G9D?.formulas?.combat_rates?.dodge?.max_rate??1.0);
 const dodgeChance=Math.max(.03,Math.min(dodgeMaxCap,.05+((targetStats.int-agent.stats.int)/Math.max(1,agent.stats.int))*.25+(enemyRates.dodge||0)-(pm.hitChance||0)));
 if(r()<dodgeChance)return miss(`${actor.name}'s ${ability} misses as ${target.name} reads the movement and dodges.`);
 const weapon=weaponStats(agent),missChance=Math.max(0,Math.min(.95,(weaponAttack?weapon.masteryMiss:0)-pm.hitChance+(actor._hitChanceDebuff||0)+(actor._threadHitDebuff||0)));
 if(r()<missChance)return miss(weaponAttack?`${actor.name} misses with ${weapon.name}. ${weapon.kind==='gun'?`Gun Mastery Lv.${weapon.mastery} gives ${Math.round((1-missChance)*100)}% accuracy.`:'The attack misses.'}`:`${actor.name}'s ${ability} misses.`);
 return true;
}
function attackOnce(agent,actor,enemy,state,lines=[],r,mult=1){if(!lines)lines=[];
 const forcedMiss=consumeAttackMiss(actor,r),critFailure=consumeCritFailure(actor);
 if(!canAffect(agent.sequence,enemy.sequence)) { lines.push({text:`${actor.name}'s attack is suppressed by the enemy's higher Authority.`,kind:'system'}); return false; }
 const pm=passiveCombatModifier(agent), weapon=weaponStats(agent);
 if(!attackHit(agent,actor,enemy,state,lines,r,{forcedMiss,weaponAttack:true,ability:'attack'}))return false;
 handleSleepWake(enemy,lines); // v15 basic_physical_attack: round((ATK*ATK_mod + Weapon_Bonus_DMG) * Strike_Mult - DEF*0.5)
 let strikeMult=mult*(weapon.kind==='unarmed'?1+weaponMasteryValue(agent,'unarmed')*.04:1)*(enemy._weaknessBonus>0?1+enemy._weaknessBonus:1);
 const trace = {
   round: state?.currentRound || 0,
   attacker: actor.name,
   target: enemy.name,
   ability: weapon.name === 'Bare Hands' ? 'Attack' : weapon.name,
   abilityId: 'basic_attack',
   stat: 'ATK',
   abilityMultiplier: mult,
   effectiveMultiplier: strikeMult,
   effectContributions: [],
   damageType: 'physical'
 };
 let dmg=v15Damage('basic_physical_attack',{agent,actor,target:enemy,weaponBonus:weapon.atk*weapon.masteryDamage,strikeMult,defPen:pm.defPen,trace});
 const rates=combatRates(agent,actor); let critChance=critFailure?0:Math.min(.95,rates.crit+(weapon.crit||0)); let critical=false; if(r()<critChance){critical=true;dmg=Math.round(dmg*(1+rates.critDamage));trace.critical=true;trace.effectContributions.push({type:'critical',multiplier:1+rates.critDamage});}
 trace.final=dmg;
 if(state?.balanceTrace) state.balanceTrace.push(trace);
 // Open the attack row BEFORE the hit resolves: reflect / Mythical Form events fired inside resolveIncoming belong to this attack.
 emitCombatEvent(state, {
   round: state?.currentRound || 1,
   type: 'cast',
   actorId: actor.id,
   actorName: actor.name,
   actorTeam: teamOf(actor, state),
   ability: weapon.name === 'Bare Hands' ? 'Attack' : weapon.name,
   costSP: 0,
   cooldown: 0
 });
 const tk=resolveIncoming(actor,enemy,dmg,state,lines,r,{damageType:'physical'});const dealt=tk.hpLoss+tk.absorbed;
 const totalLifeSteal=Math.max(0,pm.lifesteal+Number(actor._lifestealBonus||0)+Number(traitData(agent).lifesteal||0)); if(actor.alive&&!hasStatus(actor,'no_heal')&&totalLifeSteal>0&&dealt>0){const heal=recoverHP(actor,Math.round(dealt*totalLifeSteal));if(heal>0){lines.push({text:`${actor.name} recovers ${heal} HP from Lifesteal.`,kind:'status'});emitCombatEvent(state,{round:state?.currentRound||1,type:'heal',actorId:actor.id,actorName:actor.name,actorTeam:teamOf(actor,state),targetId:actor.id,targetName:actor.name,targetTeam:teamOf(actor,state),amount:heal,hpAfter:actor.hp,maxHp:actor.maxHp});}}
 if(weapon.id!=='none') state.weaponUsage[weapon.id]=(state.weaponUsage[weapon.id]||0)+1;
 const displayedAtk=Math.round(agent.stats.atk+(weapon.atk||0)); lines.push({text:`${actor.name} attacks with ${weapon.name==='Bare Hands'?'bare hands':weapon.name} (ATK ${displayedAtk}); ${enemy.name} suffers ${dmg}${critical?' critical':''} damage.`,kind:'normal'});
 emitCombatEvent(state, {
   round: state?.currentRound || 1,
   type: 'damage',
   actorId: actor.id,
   actorName: actor.name,
   actorTeam: teamOf(actor, state),
   targetId: enemy.id,
   targetName: enemy.name,
   targetTeam: teamOf(enemy, state),
   amount: dealt,
   damageType: 'physical',
   critical: critical,
   hpAfter: enemy.hp,
   maxHp: enemy.maxHp
 });
 if(enemy.hp>0&&weapon.bleed&&r()<weapon.bleed){addStatus(enemy,'bleed',3,actor.name);lines.push({text:`${actor.name}'s ${weapon.name} causes Bleed.`,kind:'status'});}
 if(enemy.alive&&!tk.revived&&!tk.negated&&dealt>0){maybeCounter(enemy,actor,state,lines,r);}
 return true;
}
function sameSideOf(actor,state){return state.allies.includes(actor)?state.allies:state.enemies;}
function foesOf(actor,state){return state.allies.includes(actor)?state.enemies:state.allies;}
function runActiveAbility(agent,actor,enemy,state,lines,r,effectId){
 const pm=passiveCombatModifier(agent);
 switch(effectId){
  case 'blink_dodge': if(r()<.22){actor.status.push('evade');lines.push({text:`${actor.name} slips through space and gains Evasion.`,kind:"quirk"});changeMeter(agent,'door',8);return true;}break;
  case 'divination_block': addStatus(enemy,'revealed',2,actor.name);changeMeter(agent,'door',6);lines.push({text:`${actor.name} disrupts ${enemy.name}'s divination and exposes a flaw.`,kind:"quirk"});return false;
  case 'record_power': if(!agent.recorded)agent.recorded=[];if(agent.recorded.length<(agent.sequence<=5?4:1)){agent.recorded.push(effectId);changeMeter(agent,'door',-12);lines.push({text:`${actor.name} records a fragment of ${enemy.name}'s power.`,kind:"quirk"});}return false;
  case 'spirit_travel': if(r()<.25){actor.status.push('evade');changeMeter(agent,'door',-10);lines.push({text:`${actor.name} blinks through the Spirit World.`,kind:"quirk"});return true;}break;
  case 'concealed_space': if(r()<.12){for(const x of state.allies)if(x.alive)addStatus(x,'guarded',1,actor.name);changeMeter(agent,'door',-18);lines.push({text:`${actor.name} folds the party into a concealed space.`,kind:"quirk"});return true;}break;
  case 'pocket_retreat': if(r()<.10){for(const x of state.allies)if(x.alive)addStatus(x,'evade',1,actor.name);changeMeter(agent,'door',-20);lines.push({text:`${actor.name} retreats the party through a hidden door.`,kind:"quirk"});return true;}break;
  case 'unrestricted_teleport': if(r()<.10){const extra=makeEnemy(enemy.sequence,r,99);state.enemies.push(extra);lines.push({text:`${actor.name}'s teleport misfires and pulls another enemy into the encounter.`,kind:"status"});}else{changeMeter(agent,'door',-15);lines.push({text:`${actor.name} teleports directly beside ${enemy.name}.`,kind:"quirk"});}break;
  case 'dawn_light': addStatus(enemy,'revealed',2,actor.name);changeMeter(agent,'twilight_giant',-15);return attackOnce(agent,actor,enemy,state,lines,r,1.15);
  case 'guardian_redirect':{const victim=sameSideOf(actor,state).find(x=>x!==actor&&x.alive);if(victim&&r()<.30){addStatus(victim,'guarded',1,actor.name);lines.push({text:`${actor.name} steps between the enemy and ${victim.name}.`,kind:"quirk"});changeMeter(agent,'twilight_giant',-12);return true;}break;}
  case 'hand_of_god': if(r()<.16){const dmg=Math.round(agent.stats.atk*1.7);enemy.hp-=dmg;changeMeter(agent,'twilight_giant',-25);lines.push({text:`${actor.name} delivers a devastating Hand of God strike for ${dmg}.`,kind:"quirk"});if(enemy.hp<=0){enemy.hp=0;enemy.alive=false;lines.push({text:`${enemy.name} is annihilated.`,kind:"victory"});}return true;}break;
  case 'twilight_decay': addStatus(enemy,'decay',3,actor.name);changeMeter(agent,'twilight_giant',-18);lines.push({text:`${actor.name} brands ${enemy.name} with Twilight Decay.`,kind:"quirk"});break;
  case 'frenzy': if(r()<.28){addStatus(enemy,'fear',2,actor.name);changeMeter(agent,'visionary',-15);lines.push({text:`${actor.name} drives ${enemy.name} into a Frenzy.`,kind:"quirk"});return true;}break;
  case 'hypnosis': if(r()<.25){addStatus(enemy,'stunned',1,actor.name);changeMeter(agent,'visionary',-15);lines.push({text:`${actor.name} hypnotizes ${enemy.name}; the target hesitates.`,kind:"quirk"});return true;}break;
  case 'dream_tether': if(r()<.18){addStatus(enemy,'dreambound',2,actor.name);changeMeter(agent,'visionary',-18);lines.push({text:`${actor.name} enters ${enemy.name}'s subconscious and distorts their next actions.`,kind:"quirk"});return true;}break;
  case 'manipulate': if(r()<.12&&enemy.sequence>=agent.sequence){addStatus(enemy,'controlled',1,actor.name);changeMeter(agent,'visionary',-22);lines.push({text:`${actor.name} briefly seizes control of ${enemy.name}.`,kind:"quirk"});return true;}break;
  case 'dream_weave': if(r()<.15){addStatus(enemy,'stunned',2,actor.name);changeMeter(agent,'visionary',-20);lines.push({text:`${actor.name} traps ${enemy.name} in a dream loop.`,kind:"quirk"});return true;}break;
  case 'author': if(r()<.10){addStatus(enemy,'revealed',2,actor.name);changeMeter(agent,'visionary',-25);lines.push({text:`${actor.name} writes a favorable possibility into the encounter.`,kind:"quirk"});return true;}break;
  case 'visionary_permanence': if(r()<.12){enemy.hp=Math.min(enemy.hp,Math.round(enemy.maxHp*.55));changeMeter(agent,'visionary',-30);lines.push({text:`${actor.name} imposes a deeper dream reality on ${enemy.name}.`,kind:"quirk"});return true;}break;
  case 'provoke': if(r()<.22){addStatus(enemy,'enraged',2,actor.name);changeMeter(agent,'red_priest',-12);lines.push({text:`${actor.name} provokes ${enemy.name} into reckless rage.`,kind:"quirk"});return true;}break;
  case 'fire': addStatus(enemy,'burn',3,actor.name);changeMeter(agent,'red_priest',-10);lines.push({text:`${actor.name} calls a spear of fire onto ${enemy.name}.`,kind:"quirk"});break;
  case 'cull': if(enemy.hp/enemy.maxHp<.45){const dmg=Math.round(agent.stats.atk*1.25);enemy.hp-=dmg;changeMeter(agent,'red_priest',-20);lines.push({text:`${actor.name} uses Cull against the wounded ${enemy.name}.`,kind:"quirk"});if(enemy.hp<=0){enemy.hp=0;enemy.alive=false;lines.push({text:`${enemy.name} is culled.`,kind:"victory"});}return true;}break;
  case 'weather': for(const e of foesOf(actor,state).filter(x=>x.alive)){addStatus(e,'burn',2,actor.name);e.hp-=Math.round(agent.stats.atk*.2);}changeMeter(agent,'red_priest',-24);lines.push({text:`${actor.name} calls a violent weather front over the battlefield.`,kind:"quirk"});break;
  case 'red_priest_transform': if(r()<.12){const dmg=Math.round(agent.stats.atk*1.8);enemy.hp-=dmg;changeMeter(agent,'red_priest',-30);lines.push({text:`${actor.name} becomes a blazing meteor and strikes for ${dmg}.`,kind:"quirk"});if(enemy.hp<=0){enemy.hp=0;enemy.alive=false;lines.push({text:`${enemy.name} is destroyed.`,kind:"victory"});}return true;}break;
  case 'instigate': if(r()<.22){addStatus(enemy,'enraged',2,actor.name);changeMeter(agent,'demoness',-10);lines.push({text:`${actor.name} turns the hostility of the room against ${enemy.name}.`,kind:"quirk"});return true;}break;
  case 'mirror_swap': if(r()<.18){addStatus(actor,'evade',1,actor.name);changeMeter(agent,'demoness',-12);lines.push({text:`${actor.name} mirror-swaps with a decoy.`,kind:"quirk"});return true;}break;
  case 'affliction': addStatus(enemy,'corruption',3,actor.name);changeMeter(agent,'demoness',-10);lines.push({text:`${actor.name} threads a curse into ${enemy.name}.`,kind:"quirk"});break;
  case 'plague_thrall': if((enemy.status||[]).filter(x=>x==='corruption').length>=1){addStatus(enemy,'plague',3,actor.name);changeMeter(agent,'demoness',-20);lines.push({text:`${actor.name} spreads a plague through ${enemy.name}.`,kind:"quirk"});}break;
  case 'catastrophe': if(r()<.10){enemy.hp-=Math.round(agent.stats.int*1.2);changeMeter(agent,'demoness',-25);lines.push({text:`${actor.name} unleashes a localized catastrophe.`,kind:"quirk"});}break;
  case 'apocalypse': if(r()<.08){addStatus(enemy,'corruption',4,actor.name);changeMeter(agent,'demoness',-28);lines.push({text:`${actor.name} calls an apocalyptic curse.`,kind:"quirk"});}break;
  case 'demoness_resurrection': if(r()<.08){actor.hp=Math.min(actor.maxHp,actor.hp+Math.round(actor.maxHp*.25));changeMeter(agent,'demoness',-22);lines.push({text:`${actor.name} draws upon a dark resurrection principle and recovers.`,kind:"quirk"});}break;
  case 'myopia': if(r()<.25){addStatus(enemy,'blinded',1,actor.name);changeMeter(agent,'hermit',-10);lines.push({text:`${actor.name} suppresses ${enemy.name}'s divination.`,kind:"quirk"});return true;}break;
  case 'scroll': if(r()<.20){enemy.hp-=Math.round(agent.stats.int*.55);changeMeter(agent,'hermit',-12);lines.push({text:`${actor.name} activates a prepared spell scroll.`,kind:"quirk"});return true;}break;
  case 'star_cage': if(r()<.18){addStatus(enemy,'stunned',1,actor.name);changeMeter(agent,'hermit',-18);lines.push({text:`${actor.name} imprisons ${enemy.name} in a cage of starlight.`,kind:"quirk"});return true;}break;
  case 'mysticologist': if(r()<.12){agent._formBoost=1.25;changeMeter(agent,'hermit',-20);lines.push({text:`${actor.name} safely reveals a glimpse of their Mythical Creature Form.`,kind:"quirk"});}break;
  case 'prophecy': if(r()<.15){addStatus(actor,'guarded',1,actor.name);changeMeter(agent,'hermit',-15);lines.push({text:`${actor.name} sees the immediate consequence of the next exchange.`,kind:"quirk"});return true;}break;
  case 'deep_prying': if(r()<.10){addStatus(enemy,'revealed',3,actor.name);changeMeter(agent,'hermit',-25);lines.push({text:`${actor.name} pries directly into ${enemy.name}'s hidden weakness.`,kind:"quirk"});return true;}break;
  case 'calamity_ward': if(r()<.20){addStatus(actor,'guarded',2,actor.name);changeMeter(agent,'wheel_of_fortune',-12);lines.push({text:`${actor.name} twists probability into a protective ward.`,kind:"quirk"});return true;}break;
  case 'psyche_storm': if(r()<.15){for(const e of foesOf(actor,state).filter(x=>x.alive))addStatus(e,'stunned',1,actor.name);changeMeter(agent,'wheel_of_fortune',-20);lines.push({text:`${actor.name} releases a Psyche Storm.`,kind:"quirk"});return true;}break;
  case 'misfortune_field': if(r()<.14){for(const e of foesOf(actor,state).filter(x=>x.alive))addStatus(e,'misfortune',2,actor.name);changeMeter(agent,'wheel_of_fortune',-18);lines.push({text:`${actor.name} creates a Misfortune Field.`,kind:"quirk"});return true;}break;
  case 'chaos_undo': if(r()<.10){actor.hp=Math.min(actor.maxHp,actor.hp+Math.round(actor.maxHp*.12));changeMeter(agent,'wheel_of_fortune',-20);lines.push({text:`${actor.name} steps sideways through an unstable possibility and undoes recent harm.`,kind:"quirk"});return true;}break;
  case 'restart': if(r()<.05){for(const x of state.allies)if(x.alive)x.hp=Math.min(x.maxHp,x.hp+Math.round(x.maxHp*.2));changeMeter(agent,'wheel_of_fortune',-30);lines.push({text:`${actor.name} forces the encounter toward a favorable possibility.`,kind:"quirk"});return true;}break;
  case 'raging_blow': if(getMeterValue(agent,'tyrant')>=60&&r()<.25){const dmg=Math.round(agent.stats.atk*1.4);enemy.hp-=dmg;changeMeter(agent,'tyrant',-40);lines.push({text:`${actor.name} unleashes a Raging Blow for ${dmg}.`,kind:"quirk"});return true;}break;
  case 'wind_dash': if(r()<.18){changeMeter(agent,'tyrant',-8);lines.push({text:`${actor.name} rides the wind into striking range.`,kind:"quirk"});return true;}break;
  case 'ocean_song': if(r()<.18){addStatus(enemy,'stunned',1,actor.name);changeMeter(agent,'tyrant',-12);lines.push({text:`${actor.name} sings an Ocean Song that disables ${enemy.name}.`,kind:"quirk"});return true;}break;
  case 'sea_king': for(const e of foesOf(actor,state).filter(x=>x.alive))addStatus(e,'slowed',2,actor.name);changeMeter(agent,'tyrant',-18);lines.push({text:`${actor.name} floods the field and slows every enemy.`,kind:"quirk"});break;
  case 'calamity': if(r()<.12){for(const e of foesOf(actor,state).filter(x=>x.alive))e.hp-=Math.round(agent.stats.int*.35);changeMeter(agent,'tyrant',-22);lines.push({text:`${actor.name} invokes a battlefield calamity.`,kind:"quirk"});}break;
  case 'thunder_god': if(r()<.12){for(const e of foesOf(actor,state).filter(x=>x.alive)){addStatus(e,'fear',2,actor.name);e.hp-=Math.round(agent.stats.int*.4);}changeMeter(agent,'tyrant',-25);lines.push({text:`${actor.name} unleashes the Roar of the Thunder God.`,kind:"quirk"});}break;
  case 'bard_song': for(const x of sameSideOf(actor,state).filter(x=>x.alive))addStatus(x,'inspired',2,actor.name);changeMeter(agent,'sun',8);lines.push({text:`${actor.name} sings courage into the party: allies gain +8% ATK and +5% INT for 2 rounds. (ATK +8%, INT +5%)`,kind:'quirk'});break;
  case 'holy_water': {const x=sameSideOf(actor,state).find(x=>x.alive&&x.hp<x.maxHp);if(x){x.hp=Math.min(x.maxHp,x.hp+Math.round(agent.stats.int*.5));changeMeter(agent,'sun',-12);lines.push({text:`${actor.name} heals ${x.name} with Holy Water.`,kind:"quirk"});return true;}break;}
  case 'solar_halo': for(const x of sameSideOf(actor,state).filter(x=>x.alive)){addStatus(x,'inspired',2,actor.name);addStatus(x,'guarded',2,actor.name);}changeMeter(agent,'sun',-14);lines.push({text:`${actor.name} raises a Solar Halo: allies gain +8% ATK, +5% INT and +10% DEF for 2 rounds. (ATK +8%, INT +5%, DEF +10%)`,kind:'quirk'});break;
  case 'light_of_holiness': if(r()<.15){enemy.hp-=Math.round(agent.stats.int*1.35);changeMeter(agent,'sun',-25);lines.push({text:`${actor.name} invokes Light of Holiness against ${enemy.name}.`,kind:"quirk"});}break;
  case 'unshadowed': for(const x of sameSideOf(actor,state).filter(x=>x.alive))for(const st of ['fear','corruption','madness'])removeStatus(x,st);changeMeter(agent,'sun',-15);lines.push({text:`${actor.name} drives corruption and fear from the party.`,kind:"quirk"});break;
  case 'justice': if(r()<.12){addStatus(enemy,'suppressed',2,actor.name);changeMeter(agent,'sun',-22);lines.push({text:`${actor.name} passes Judgment and suppresses one enemy power.`,kind:"quirk"});return true;}break;
  case 'holy_kingdom': for(const e of foesOf(actor,state).filter(x=>x.alive))if(e.path==='demoness'||e.path==='fool')addStatus(e,'weakened',2,actor.name);changeMeter(agent,'sun',-24);lines.push({text:`${actor.name} establishes a Holy Kingdom.`,kind:"quirk"});break;
  case 'sun_judgement': if(getMeterValue(agent,'sun')>=75&&sameSideOf(actor,state).filter(x=>x.alive).every(x=>x.hp/x.maxHp>.5)){enemy.hp=0;enemy.alive=false;changeMeter(agent,'sun',-60);lines.push({text:`${actor.name} delivers a decisive Judgement.`,kind:"victory"});return true;}break;
  case 'marionettist_thread': return applySpiritThread(agent,enemy,actor,state,lines,r);
  case 'magician_decoy': if(r()<.18){addStatus(actor,'evade',1,actor.name);lines.push({text:`${actor.name} creates a convincing magical decoy.`,kind:"quirk"});return true;}break;
  case 'faceless': if(r()<.08){lines.push({text:`${actor.name} shifts appearance and voice to confuse the enemy.`,kind:"quirk"});return true;}break;
  case 'bizarro': if(r()<.10){enemy.hp-=Math.round(agent.stats.int*.8);changeMeter(agent,'fool',-18);lines.push({text:`${actor.name} twists local reality into a bizarre attack.`,kind:"quirk"});return true;}break;
  case 'miracle': if(r()<.08){enemy.hp-=Math.round(agent.stats.int*.7);changeMeter(agent,'fool',-22);lines.push({text:`${actor.name} invokes a small miracle.`,kind:"quirk"});return true;}break;
  case 'fool_miracle': if(r()<.10){enemy.hp=Math.max(0,enemy.hp-Math.round(agent.stats.int*1.2));changeMeter(agent,'fool',-28);lines.push({text:`${actor.name} invokes a guaranteed miracle.`,kind:"quirk"});if(enemy.hp<=0)enemy.alive=false;return true;}break;
 }
 return false;
}
function actionDisabled(unit){
 return ['stunned','frozen','freeze','sleep','polymorphed'].some(s=>hasStatus(unit,s)) || hasStatus(unit,'bound') || hasStatus(unit,'unconscious') || (unit._skipTurns > 0) || hasStatus(unit,'banished');
}
function handleSleepWake(target,lines=[]){if(!lines)lines=[];
 if(hasStatus(target,'sleep')){removeStatus(target,'sleep');lines.push({text:`${target.name} wakes from Sleep when struck.`,kind:'status'});}
}

function ensureCombatResource(agent){
  agent.maxSP=maxSPFor(agent); if(!Number.isFinite(agent.sp))agent.sp=agent.maxSP;
  agent.sp=Math.min(agent.maxSP,Math.max(0,agent.sp)); agent.cooldowns=agent.cooldowns||{};
}
function startRoundCombatResources(units,lines){
  for(const u of units){if(!u.alive)continue;const a=u.agent||u;ensureCombatResource(a);const gain=spTableFor(a).regen;a.sp=Math.min(a.maxSP,a.sp+gain);for(const k of Object.keys(a.cooldowns||{})){if(a.cooldowns[k]>0)a.cooldowns[k]--;}}
}
function activeSpecs(agent){return unlockedAbilities(agent).filter(x=>x.type==='active').map(x=>cloneE(x));}
function effectiveAbilityCost(agent,spec){return Math.max(0,Math.round(Number(spec.costSP||0)*(1+Number(agent._spCostMultiplier||0))));}
function abilityReady(agent,spec){ensureCombatResource(agent);return (agent.sp||0)>=effectiveAbilityCost(agent,spec)&&!(agent.cooldowns?.[spec.effectId]>0)&&!hasStatus({status:agent.status||[]},'silenced')&&!(hasStatus(agent,'root')&&spec.tag==='Escape');}
function abilityAvailable(agent,effectId){return unlockedAbilities(agent).some(x=>x.effectId===effectId||x.id===effectId);}
function chooseStructuredAbility(agent,actor,enemy,state){
 if(hasStatus(actor,'silenced')||hasStatus(agent,'silenced'))return null;
 const hpRatio=actor.hp/Math.max(1,actor.maxHp);
 // Preserve the existing survival/control/damage priorities, but prefer a
 // relevant newly unlocked ability within each role instead of the first
 // (oldest) entry in the Sequence 9 -> 0 content order.
 const ranks=new Map(unlockedTiers(agent).flatMap(t=>(t.abilities||[]).map(a=>[a.effectId||a.id,t.sequence])));
 const isDamage=x=>(x.damage?.multiplier||x.scale||0)>0||abilityEffects(x).some(e=>e.type==='damage_component');
 const isAutomaticRevival=x=>{const effects=abilityEffects(x).filter(e=>e.type!=='targeting');return effects.length&&effects.every(e=>e.type==='revive'&&e.self);};
 const useful=x=>{if(isDamage(x))return true;const effects=abilityEffects(x),types=effects.map(e=>e.type);const only=k=>types.length&&types.every(y=>k.includes(y)||y==='targeting');
  if(only(['heal']))return !hasStatus(actor,'no_heal')&&hpRatio<.85;
  if(only(['shield']))return !hasStatus(actor,'no_shield')&&effects.some(e=>e.type==='shield'&&(e.fullHp?actor.maxHp:Math.round(actor.maxHp*Number(e.maxHpRatio||0)))>(actor.shield||0));
  if(only(['buff']))return effects.some(e=>e.type==='buff'&&(e.stat==='all'?['atk','def','int']:[e.stat]).some(stat=>(actor._buffs?.[stat]||1)<1+Number(e.amount||0)));
  if(only(['cleanse']))return (actor.status||[]).length>0;
  if(only(['debuff','steal_stat'])){const need=effects.filter(e=>e.type==='debuff'||(e.type==='steal_stat'&&e.stat!=='hp'));return !need.length||need.some(e=>e.stat==='speed'?!(enemy._speedDebuff<1):!(enemy._debuffs?.[e.stat]<1));}
  if(only(['heal','cleanse']))return hpRatio<.85||(actor.status||[]).length>0;
  if(only(['status','status_chance','silence','skip','banish']))return effects.some(e=>e.type==='targeting'?false:e.type==='status'||e.type==='status_chance'?!(SELF_STATUSES.includes(e.status)?hasStatus(actor,e.status):hasStatus(enemy,e.status)||statusImmune(enemy,e.status)):e.type==='silence'?!hasStatus(enemy,'silenced'):true);
  return true;};
 let specs=activeSpecs(agent).filter(x=>x.effectId!=='thread_binding'&&!isAutomaticRevival(x)&&abilityReady(agent,x)&&!(hasStatus(actor,'root')&&x.tag==='Escape')&&useful(x))
  .sort((a,b)=>(ranks.get(a.effectId||a.id)??Infinity)-(ranks.get(b.effectId||b.id)??Infinity));
  // Teammate will not cast an ability to banish an enemy currently having a thread attached
  if (enemy && enemy.thread) {
    specs = specs.filter(s => !abilityEffects(s).some(e => e.type === 'banish' || (e.type === 'status' && e.status === 'banished')));
    if (!specs.length) return null;
  }
  // Thread Binding is resolved in powerEffect via applySpiritThread
 if(!specs.length)return null;
 // Bank the same effective Thread Binding cost used by the cast pipeline.
 const threadSpec=unlockedAbilities(agent).find(x=>x.effectId==='thread_binding'||x.id==='thread_binding');
 if(agent.path==='fool'&&agent.sequence<=5&&threadSpec&&!(agent.cooldowns?.thread_binding>0)&&threadUsage(state,agent)<threadSlots(agent.sequence)&&(agent.sp||0)<effectiveAbilityCost(agent,threadSpec))return null;
 if(agent.path==='error' && agent.sequence===9){const x=specs.find(s=>s.id==='combat_theft'||s.effectId==='combat_theft');if(x)return x;}

 // Time Theft: if all enemies have already moved this round, skip Time Theft and pick another skill
   // Combat Record: skip until at least one enemy has cast an eligible ability (Option 1)
  const anyEnemyCast = foesOf(actor, state).some(e => {
    const history = state?._abilityHistoryByUnit?.[e.id];
    return history && history.some(h => {
      const hid = h.spec?.id || h.spec?.effectId;
      return hid && hid !== 'combat_record' && hid !== 'spell_imitation'
        && !abilityEffects(h.spec).some(e=>e.type==='copy_ability');
    });
  });
  if (!anyEnemyCast) {
    specs = specs.filter(s => {
      const sid = s.id || s.effectId;
      return sid !== 'combat_record' && !abilityEffects(s).some(e => e.type === 'copy_ability');
    });
    if (!specs.length) return null;
  }

 const enemiesPendingAction = foesOf(actor, state).filter(e => e.alive && !e._actedThisRound);
 specs = specs.filter(s => { if ((s.id === 'undying_rebirth_aura' || s.effectId === 'undying_rebirth_aura') && hpRatio >= 0.30) return false; return true; });
 const undyingAura = specs.find(x => (x.id === 'undying_rebirth_aura' || x.effectId === 'undying_rebirth_aura'));
 if (hpRatio < 0.30 && undyingAura) return undyingAura;
 if (enemiesPendingAction.length === 0) {
   specs = specs.filter(s => s.id !== 'time_theft' && s.effectId !== 'time_theft');
   if (!specs.length) return null;
 }
  
 const survival=specs.find(x=>x.tag==='Heal'||x.tag==='Defense'||x.tag==='Escape');
 if(hpRatio<.50&&survival)return survival;
 const control=specs.find(x=>abilityEffects(x).some(e=>['skip','banish','silence'].includes(e.type)||(['status','status_chance'].includes(e.type)&&!SELF_STATUSES.includes(e.status)&&!statusImmune(enemy,e.status))));
 if(control&&!(enemy.status||[]).some(s=>['stunned','frozen','freeze','sleep','silenced','banished','polymorphed','bound','unconscious'].includes(s)))return control;
 const damaging=specs.filter(x=>(x.damage?.multiplier||x.scale||0)>0).sort((a,b)=>(b.damage?.multiplier||b.scale||0)-(a.damage?.multiplier||a.scale||0))[0];
 if(damaging)return damaging;
 // Support is still a fallback after ready attacks; sorting does not introduce
 // a new buff-before-damage policy.
 return specs.find(useful)||null;
}
function targetsForEffects(spec,actor,enemy,state){
 // If casting Time Theft, target an enemy who has not taken their turn yet this round
  if (spec.id === 'time_theft' || spec.effectId === 'time_theft') {
    const pending = foesOf(actor, state).filter(x => x.alive && !x._actedThisRound);
    if (pending.length > 0) return [pending[0]];
  }
  
 const targeting=abilityEffects(spec).find(e=>e.type==='targeting');
 if(targeting?.mode==='all_enemies')return foesOf(actor,state).filter(x=>x.alive&&!hasStatus(x,'untargetable'));
 if(targeting?.mode==='up_to_3_enemies')return foesOf(actor,state).filter(x=>x.alive&&!hasStatus(x,'untargetable')).slice(0,3);
 return [enemy].filter(x=>x&&!hasStatus(x,'untargetable'));
}
function getCopiedEnemyAbility(actor, enemy, state) {
  const round = state?.currentRound || 1;
  const foes = foesOf(actor, state);
  const eligible = entry => {
    const spec = entry?.spec;
    const id = spec?.id || spec?.effectId;
    return !!id && id !== 'combat_record' && id !== 'spell_imitation'
      && !abilityEffects(spec).some(e => e.type === 'copy_ability');
  };
  
  // 1. Check if selected enemy cast an eligible ability this round
  const enemyLog = state?._abilityHistoryByUnit?.[enemy.id] || [];
  const enemyThisRound = enemyLog.filter(x => x.round === round && eligible(x));
  if (enemyThisRound.length > 0) return cloneE(enemyThisRound[enemyThisRound.length - 1].spec);

  // 2. Check if ANY enemy cast an eligible ability this round
  const allFoesThisRound = [];
  for (const f of foes) {
    const fLog = state?._abilityHistoryByUnit?.[f.id] || [];
    for (const entry of fLog) {
      if (entry.round === round && eligible(entry)) {
        allFoesThisRound.push(entry);
      }
    }
  }
  if (allFoesThisRound.length > 0) return cloneE(allFoesThisRound[allFoesThisRound.length - 1].spec);

  // 3. Fallback to target enemy latest cast in prior rounds
  const enemyPrior = enemyLog.filter(eligible);
  if (enemyPrior.length > 0) return cloneE(enemyPrior[enemyPrior.length - 1].spec);

  // 4. Fallback to ANY enemy latest cast in prior rounds
  const allFoesPrior = [];
  for (const f of foes) {
    const fLog = state?._abilityHistoryByUnit?.[f.id] || [];
    for (const entry of fLog) {
      if (eligible(entry)) {
        allFoesPrior.push(entry);
      }
    }
  }
  if (allFoesPrior.length > 0) return cloneE(allFoesPrior[allFoesPrior.length - 1].spec);

  // A skill must actually have been witnessed in this encounter.
  return null;
}
function applyStructuredAbility(agent,actor,enemy,state,lines=[],r,spec){if(!lines)lines=[];
 const castSpec=cloneE(spec),castId=castSpec.effectId||castSpec.id;
 if(hasStatus(actor,'root')&&castSpec.tag==='Escape')return false;
 const castName=(castSpec.text||castSpec.name||castId).split(/\s(?:—|--)\s/)[0];
 spec=castSpec;
 let copiedName=null;
 if(abilityEffects(castSpec).some(e=>e.type==='copy_ability')){
   const copied=getCopiedEnemyAbility(actor,enemy,state);
   if(!copied)return false;
   spec=cloneE(copied);
   copiedName=(spec.text||spec.name||spec.effectId||spec.id).split(/\s(?:—|--)\s/)[0];
 }
 ensureCombatResource(agent); const cost=effectiveAbilityCost(agent,castSpec);
 if((agent.sp||0)<cost)return false;
 agent.sp-=cost;actor.sp=agent.sp;
 const baseCd = Number(castSpec.cooldown || 0);
 agent.cooldowns[castId]=(baseCd > 0 ? baseCd + 1 : 0)+Number(agent._cooldownPenalty||0);agent._lastAbility=castId;
 lines.push({text:`ACTION: ${actor.name} casts [${castName}] (Cost: ${cost} SP | ${baseCd}-Turn CD).`,kind:'action'});
    emitCombatEvent(state, {
      round: state?.currentRound || 1,
      type: 'cast',
      actorId: actor.id,
      actorName: actor.name,
      actorTeam: teamOf(actor, state),
      ability: castName,
      costSP: cost,
      cooldown: baseCd
    });
 const misfire=Number(actor._skillMisfireChance||0);
 if(misfire&&r()<misfire){
   const text=`${actor.name}'s ${castName} misfires due to disorder!`;
   lines.push({text:`ACTION: ${text}`,kind:'status'});
   emitCombatEvent(state,{round:state?.currentRound||1,type:'status',actorId:actor.id,actorName:actor.name,actorTeam:teamOf(actor,state),text});
   return true;
 }
 if(copiedName){
   const text=`${actor.name} reproduces [${copiedName}]!`;
   lines.push({text,kind:'action'});
   emitCombatEvent(state,{round:state?.currentRound||1,type:'status',actorId:actor.id,actorName:actor.name,actorTeam:teamOf(actor,state),targetId:enemy.id,targetName:enemy.name,targetTeam:teamOf(enemy,state),text});
 }
 if(state){state._abilityHistoryByUnit=state._abilityHistoryByUnit||{};(state._abilityHistoryByUnit[actor.id]=state._abilityHistoryByUnit[actor.id]||[]).push({spec:cloneE(spec),round:state.currentRound||1});}
 const effects=abilityEffects(spec),allies=sameSideOf(actor,state);
 const durationText=d=>d==='next_turn'?'until their next turn':`for ${d} turn${Number(d)===1?'':'s'}`;
 const targeting=effects.find(e=>e.type==='targeting');
 const supportTargets=targeting?.mode==='all_allies'?allies.filter(t=>t.alive):[actor];
 const componentEffects=effects.filter(e=>e.type==='damage_component');
 const effectiveDamageSpec=componentEffects.length?{...(spec.damage||{}),components:componentEffects.map(e=>({stat:e.stat,multiplier:Number(e.multiplier||0)}))}:(spec.damage||null);
 const damaging=Number(effectiveDamageSpec?.multiplier||spec.scale||0)>0||componentEffects.length>0;
 const forcedMiss=damaging?consumeAttackMiss(actor,r):false;
 const critFailed=damaging?consumeCritFailure(actor):false;
 const hitName=copiedName||castName;
 const targets=targetsForEffects(spec,actor,enemy,state).filter(t=>!damaging||attackHit(agent,actor,t,state,lines,r,{forcedMiss,weaponAttack:false,ability:hitName}));
 for(const e of effects){
  const tgs=e.type==='buff'||e.type==='heal'||e.type==='cleanse'||e.type==='shield'||e.type==='revive'?supportTargets:targets;
  if(e.type==='strip_buffs'||e.type==='nullify_buffs')for(const t of targets){removeFxCat(t,'buff');t.buffs=[];removeStatus(t,'guarded');removeStatus(t,'evade');if((t.shield||0)>0){lines.push({text:`${t.name}'s barrier (${t.shield} HP shield) is stripped away!`,kind:'status'});t.shield=0;}}
  else if(e.type==='cleanse'){for(const t of tgs){const removed=[];for(const st of [...(t.status||[])])if(CLEANSE_STATUSES.includes(st)){removeStatus(t,st);removed.push(st);}if(removed.length)lines.push({text:`${t.name} cleanses: ${removed.join(', ')}.`,kind:'status'});}}
  else if(e.type==='shield')for(const t of tgs){const amount=e.fullHp?t.maxHp:Math.round(t.maxHp*Number(e.maxHpRatio||0)),granted=grantShield(t,amount,e.incomingCategory);if(granted<=0)continue;lines.push({text:`${t.name} gains ${granted} HP of ${e.incomingCategory?e.incomingCategory+' ':''}shield.`,kind:'status'});emitCombatEvent(state,{round:state?.currentRound||1,type:'shield',actorId:actor.id,actorName:actor.name,actorTeam:teamOf(actor,state),targetId:t.id,targetName:t.name,targetTeam:teamOf(t,state),amount:granted,shieldAfter:t.shield});}
  else if(e.type==='heal')for(const t of tgs){const amount=Math.round(t.maxHp*Number(e.maxHpRatio||0)+(e.scaling==='INT'?agent.stats.int*Number(e.multiplier||0):0));if(amount>0){const restored=recoverHP(t,amount);if(restored>0){lines.push({text:`${t.name} recovers ${restored} HP (${t.hp}/${t.maxHp}).`,kind:'status'});emitCombatEvent(state,{round:state?.currentRound||1,type:'heal',actorId:actor.id,actorName:actor.name,actorTeam:teamOf(actor,state),targetId:t.id,targetName:t.name,targetTeam:teamOf(t,state),amount:restored,hpAfter:t.hp,maxHp:t.maxHp});}}}
  else if(e.type==='buff')for(const t of tgs){const d=fxDuration(e,'buff'),m=1+Number(e.amount||0);if(e.stat==='all'){for(const k of ['atk','def','int'])addFx(t,'buff',k,m,d);}else addFx(t,'buff',e.stat,m,d);emitCombatEvent(state,{round:state?.currentRound||1,type:'status',actorId:actor.id,actorName:actor.name,actorTeam:teamOf(actor,state),targetId:t.id,targetName:t.name,targetTeam:teamOf(t,state),text:`${t.name} gains +${Math.round((m-1)*100)}% ${e.stat.toUpperCase()} ${durationText(d)}`});}
  else if(e.type==='debuff')for(const t of targets){const d=fxDuration(e,'debuff'),m=1-Number(e.amount||0);if(e.stat==='speed')addFx(t,'speed_debuff','speed',m,d);else if(e.stat==='outgoing')addFx(t,'outgoing','outgoing',m,d);else addFx(t,'debuff',e.stat,m,d);emitCombatEvent(state,{round:state?.currentRound||1,type:'status',actorId:actor.id,actorName:actor.name,actorTeam:teamOf(actor,state),targetId:t.id,targetName:t.name,targetTeam:teamOf(t,state),text:`${t.name} suffers -${Math.round((1-m)*100)}% ${e.stat.toUpperCase()} ${durationText(d)}`});}
  else if(e.type==='status'){const selfSt=SELF_STATUSES.includes(e.status);for(const t of (selfSt?[actor]:targets))if(t.alive){const mental=['sleep','silenced','confused','charmed','stunned','bound','dreambound','controlled','fear','illusion'].includes(e.status);const resist=(mental&&!selfSt&&!e.ignoreResistance)?Number(combatRates(t.agent||t).resistance||0):0;if((e.chance==null||r()<Number(e.chance))&&r()>=resist&&r()>=(selfSt||e.ignoreResistance?0:statusResistChance(t,e.status))){if(e.status==='sleep')t._sleepAppliedThisAction=true;if(e.status==='banished'){const skipTurns=Math.max(1,Number(e.duration||1));t._skipTurns=skipTurns;addStatus(t,'untargetable',skipTurns,actor.name);addStatus(t,'banished',skipTurns,actor.name);lines.push({text:`${t.name} is banished into a spatial fold for ${skipTurns} turn${skipTurns===1?'':'s'}.`,kind:'status'});checkThreadInterruptOnTarget(t,state,lines);}else { addStatus(t,e.status,Number(e.duration||1),actor.name,e.status==='evade'&&e.dodgeRate!==undefined?{dodgeRate:Number(e.dodgeRate)}:{}); if(e.status==='untargetable')checkThreadInterruptOnTarget(t,state,lines); }emitCombatEvent(state,{round:state?.currentRound||1,type:'status',subtype:e.status==='freeze'?'freeze':undefined,isFreeze:e.status==='freeze',actorId:actor.id,actorName:actor.name,actorTeam:teamOf(actor,state),targetId:t.id,targetName:t.name,targetTeam:teamOf(t,state),text:`${t.name} is afflicted with ${e.status} (${e.duration||1} turn${Number(e.duration||1)===1?'':'s'})`});}}}
  else if(e.type==='status_pool'){for(const t of targets)if(t.alive){const pool=e.statuses||[];if(pool.length&&(e.chance==null||r()<Number(e.chance))){const st=pickR(r,pool);addStatus(t,st,Number(e.duration||1),actor.name);}}}
  else if(e.type==='status_chance'){for(const t of targets)if(t.alive){const mental=['sleep','silenced','confused','charmed','stunned','bound','dreambound','controlled','fear','illusion'].includes(e.status);const resist=mental&&!e.ignoreResistance?Number(combatRates(t.agent||t).resistance||0):0;if(r()<Number(e.chance||0)*(1-resist)*(1-(e.ignoreResistance?0:statusResistChance(t,e.status))))addStatus(t,e.status,Number(e.duration||1),actor.name);}}
  else if(e.type==='skill_misfire'){for(const t of targets){t._skillMisfireChance=Math.max(t._skillMisfireChance||0,Number(e.chance||.3));setCombatDuration(t,'_skillMisfireDuration',Math.max(t._skillMisfireDuration||0,Number(e.duration||2)));lines.push({text:`${t.name} is afflicted by skill misfire (${Math.round(Number(e.chance||.3)*100)}% chance).`,kind:'status'});}}
  else if(e.type==='mind_control'){const ally=foesOf(actor,state).find(x=>x!==enemy&&x.alive);if(ally){const dmg=Math.max(1,Math.round((enemy.atk||enemy.agent?.stats?.atk||10)*Number(e.damageMultiplier||1.5)));lines.push({text:`${enemy.name} turns its own power against ${ally.name} for ${dmg} damage.`,kind:'quirk'});resolveIncoming(enemy,ally,dmg,state,lines,r);}addStatus(enemy,'stunned',1,actor.name);}
  else if(e.type==='reflect'){{const d=fxDuration(e,'reflect');actor._reflect={mode:e.mode==='stat'?'stat':'share',stat:String(e.stat||'INT').toUpperCase(),multiplier:Number(e.multiplier||0),share:Number(e.share||0),element:e.element||'physical',incomingCategory:e.incomingCategory||null,negate:!!e.negate,untilTurn:d==='next_turn',rounds:d==='next_turn'?0:Number(d),_grace:!!actor._acting};lines.push({text:`${actor.name} is wrapped in a reflecting ward${e.negate?' that negates incoming damage':''} ${durationText(d)}.`,kind:'status'});}}
  else if(e.type==='taunt'){const d=fxDuration(e,'taunt');if(d==='next_turn')actor._tauntUntilTurn=true;else{actor._taunt=Math.max(actor._taunt||0,Number(d));actor._tauntGrace=!!actor._acting;}lines.push({text:`${actor.name} taunts the enemy ${durationText(d)}.`,kind:'status'});}
  else if(e.type==='sp_siphon'){
    const drainAmt=Number(e.amount||0);
    let totalSiphoned=0;
    for(const t of targets){
      if(!t.alive)continue;
      const tAgent=getCombatAgent(t);
      const drained=Math.min(Math.max(0,Number(tAgent.sp)||0),Math.max(0,drainAmt));
      tAgent.sp=Math.max(0,(tAgent.sp||0)-drained);
      t.sp=tAgent.sp;
      totalSiphoned+=drained;
    }
    agent.sp=Math.min(agent.maxSP||99999,(agent.sp||0)+totalSiphoned);
    if(actor!==agent&&actor)actor.sp=agent.sp;
    lines.push({text:`${actor.name} siphons ${totalSiphoned} SP from enemies.`,kind:'status'});
  }
  else if(e.type==='sp_drain')for(const t of targets){const a=getCombatAgent(t);a.sp=Math.max(0,(a.sp||0)-Number(e.amount||0));t.sp=a.sp;}
  else if(e.type==='sp_cost_increase')for(const t of targets){t._spCostMultiplier=Math.max(t._spCostMultiplier||0,Number(e.amount||0));setCombatDuration(t,'_spCostDuration',Number(e.duration||1));}
  else if(e.type==='cooldown_increase')for(const t of targets){t._cooldownPenalty=Math.max(t._cooldownPenalty||0,Number(e.amount||0));setCombatDuration(t,'_cooldownDuration',Number(e.duration||1));}
  else if(e.type==='steal_stat')for(const t of targets){const stat=e.stat,amount=Number(e.amount||0);if(stat==='hp'){const hp=Math.min(Math.max(0,t.hp-1),Math.round(t.maxHp*amount));t.hp-=hp;recordThreadDamage(t,hp,state,lines);const restored=recoverHP(actor,hp);emitCombatEvent(state,{round:state?.currentRound||1,type:'damage',actorId:actor.id,actorName:actor.name,actorTeam:teamOf(actor,state),targetId:t.id,targetName:t.name,targetTeam:teamOf(t,state),amount:hp,damageType:'physical',hpAfter:t.hp,maxHp:t.maxHp});if(restored>0)emitCombatEvent(state,{round:state?.currentRound||1,type:'heal',actorId:actor.id,actorName:actor.name,actorTeam:teamOf(actor,state),targetId:actor.id,targetName:actor.name,targetTeam:teamOf(actor,state),amount:restored,hpAfter:actor.hp,maxHp:actor.maxHp});}else if(['atk','def','int'].includes(stat)){const d=fxDuration(e,'steal_stat');addFx(t,'debuff',stat,1-amount,d);addFx(actor,'buff',stat,1+amount,d);const baseStat=(t.agent?.stats?.[stat]||t[stat]||0);const curStat=Math.max(0,Math.round(baseStat*(1-amount)));emitCombatEvent(state,{round:state?.currentRound||1,type:'status',subtype:'steal_stat',stat:stat.toUpperCase(),curVal:curStat,maxVal:baseStat,actorId:actor.id,actorName:actor.name,actorTeam:teamOf(actor,state),targetId:t.id,targetName:t.name,targetTeam:teamOf(t,state),text:`Steals ${Math.round(amount*100)}% ${stat.toUpperCase()} from ${t.name} ${durationText(d)}`});}}
  else if(e.type==='revive'){if(e.self)agent._revivePending=true;else{const dead=allies.find(x=>!x.alive);if(dead){dead.alive=true;dead.inCombat=true;dead.hp=Math.round(dead.maxHp*Number(e.hpRatio||.25));}}}
  else if(e.type==='transfer_debuffs'){const NEG=TRANSFER_STATUSES;const team=(state.allies||[]).includes(actor)?state.allies:state.enemies;const moved=[],statuses=new Set();
   for(const al of team){if(!al.alive)continue;const keep=[];for(const f of al._fx||[]){if(f.cat==='debuff'||f.cat==='speed_debuff')moved.push(f);else keep.push(f);}al._fx=keep;recomputeFx(al);for(const st of [...(al.status||[])])if(NEG.includes(st)){statuses.add(st);removeStatus(al,st);}}
   for(const t of targets){for(const f of moved)addFx(t,f.cat,f.key,f.val,f.turn?'next_turn':f.rounds);for(const st of statuses)addStatus(t,st,1,actor.name);}}
  else if(e.type==='targeting'||e.type==='damage_rule'||e.type==='crit_bonus'||e.type==='damage_taken'||e.type==='damageTaken'||e.type==='outgoing_damage'||e.type==='damage_stat_bonus'||e.type==='low_hp_bonus'||e.type==='next_damage_bonus'||e.type==='heal_damage_ratio'||e.type==='dodge'||e.type==='crit'||e.type==='critDamage'||e.type==='initiative'||e.type==='counter'||e.type==='lifesteal'||e.type==='hitChance'||e.type==='resistance'||e.type==='defPen'||e.type==='defense_penetration'||e.type==='execute'||e.type==='vulnerability'||e.type==='vulnerability_if_buffed'||e.type==='vulnerability_vs_corrupted'||e.type==='next_attack_miss'||e.type==='next_crit_fail'||e.type==='extra_turn'||e.type==='cooldown_increase'||e.type==='knockback'||e.type==='movement_block'||e.type==='no_heal'||e.type==='no_shield'||e.type==='form'||e.type==='copy_highest'||e.type==='transfer_debuffs'||e.type==='free_strike'||e.type==='revive'||e.type==='skill_misfire'||e.type==='reset_state'||e.type==='debuff_hit'){
    // These are handled below or persisted as a combat state effect.
    if(e.type==='extra_turn')actor._extraTurns=(actor._extraTurns||0)+Number(e.amount||1);
    if(e.type==='reset_state'){actor.hp=Math.max(1,Math.min(actor.maxHp,actor.hp));removeFxCat(actor,'buff');agent.cooldowns={[castId]:agent.cooldowns[castId]};lines.push({text:`${actor.name} resets their current combat state.`,kind:'quirk'});}
    if(e.type==='next_attack_miss')for(const t of targets)t._nextAttackMiss=Number(e.chance||1);
    if(e.type==='next_crit_fail')for(const t of targets)t._nextCritFail=Number(e.chance||1);
    if(e.type==='knockback')for(const t of targets)t.distance=Math.min(60,(t.distance||5)+Number(e.amount||1)*3);
    if(e.type==='movement_block')for(const t of targets)addStatus(t,'root',Number(e.duration||1),actor.name);
    if(e.type==='no_heal')for(const t of targets)addStatus(t,'no_heal',Number(e.duration||1),actor.name);if(e.type==='no_shield')for(const t of targets)addStatus(t,'no_shield',Number(e.duration||1),actor.name);
    if(e.type==='vulnerability')for(const t of targets)addFx(t,'vuln','vuln',1+Number(e.amount||0),fxDuration(e,'vulnerability'));
    if(e.type==='vulnerability_if_buffed')for(const t of targets)if(Object.keys(t._buffs||{}).length)addFx(t,'vuln','vuln',1+Number(e.amount||0),fxDuration(e,'vulnerability'));
    if(e.type==='vulnerability_vs_corrupted')for(const t of targets)if((getCombatAgent(t).corruption||t.corruption||0)>0||getCombatAgent(t).trait==='Madness Prone'||hasStatus(t,'corruption'))addFx(t,'vuln','vuln',1+Number(e.amount||0),fxDuration(e,'vulnerability'));
    if(e.type==='damage_taken'||e.type==='damageTaken')addFx(actor,'dtm',e.incomingCategory||'dtm',1+Number(e.amount||0),fxDuration(e,'damage_taken'));
    if(e.type==='outgoing_damage')addFx(actor,'outgoing','outgoing',1+Number(e.amount||0),fxDuration(e,'outgoing_damage'));
    if(e.type==='damage_stat_bonus')agent._damageStatBonus=(agent._damageStatBonus||1)+Number(e.amount||0);
    if(e.type==='lifesteal'&&e.duration!==undefined)addFx(actor,'lifesteal','lifesteal',Number(e.ratio??e.amount??0),fxDuration(e,'lifesteal'));
    if(e.type==='counter')addFx(actor,'counter','counter',Number(e.amount||0),fxDuration(e,'counter'));
    if(e.type==='defense_penetration'&&!((spec.damage?.multiplier||spec.scale||0)>0)&&!abilityEffects(spec).some(z=>z.type==='damage_component'))addFx(actor,'defpen','defpen',Number(e.amount||0),fxDuration(e,'defense_penetration'));
    if(e.type==='dodge')addFx(actor,'dodge','dodge',Number(e.amount||0),fxDuration(e,'dodge'));
    if(e.type==='low_hp_bonus')agent._lowHpBonus=Number(e.amount||0);
    if(e.type==='next_damage_bonus')agent._nextDamageBonus=Number(e.amount||0);
    if(e.type==='heal_damage_ratio')agent._healDamageRatio=Number(e.amount||0);
    if(e.type==='crit_bonus')agent._abilityCritDamageBonus=(agent._abilityCritDamageBonus||0)+Number(e.amount||0);
    if(e.type==='debuff_hit')for(const t of targets){t._hitChanceDebuff=Math.max(t._hitChanceDebuff||0,Number(e.amount||0));setCombatDuration(t,'_hitChanceDebuffDuration',Number(e.duration||1));}
    if(e.type==='cooldown_increase')for(const t of targets)t._cooldownPenalty=Number(e.amount||0);
  }
 }
 let didDamage=false,totalDamage=0;
 const trueDamage=effectiveDamageSpec?.type==='true'||effects.some(e=>e.type==='damage_rule'&&e.rule==='true');
 const psychicTrue=effects.some(e=>e.type==='damage_rule'&&e.rule==='psychic_true');
 const rawDamageType=effectiveDamageSpec?.element||effectiveDamageSpec?.type||spec.damageType||'physical';
 const damageType=psychicTrue?'psychic':trueDamage?'true':canonicalResistanceElement(rawDamageType);
 if(damaging){for(const t of targets){
   if(!t.alive)continue;
   let mult=effectiveDamageSpec?.multiplier||spec.scale||0;
   const baseAbilityMultiplier=mult,effectContributions=[];
   const statBonus=effects.find(e=>e.type==='damage_stat_bonus');
   if(statBonus&&statBonus.stat==='INT'){const f=1+Number(statBonus.amount||0);mult*=f;effectContributions.push({type:'damage_stat_bonus',amount:Number(statBonus.amount||0),multiplier:f});}
   if(agent._damageStatBonus){const f=agent._damageStatBonus;mult*=f;effectContributions.push({type:'passive_damage_stat_bonus',multiplier:f});}
   if(agent._lowHpBonus&&actor.hp/actor.maxHp<.5){const f=1+agent._lowHpBonus;mult*=f;effectContributions.push({type:'low_hp_bonus',amount:agent._lowHpBonus,multiplier:f});}
   if(agent._nextDamageBonus){const f=1+agent._nextDamageBonus;mult*=f;effectContributions.push({type:'next_damage_bonus',amount:agent._nextDamageBonus,multiplier:f});agent._nextDamageBonus=0;}
   const trace={round:state.currentRound||0,attacker:actor.name,target:t.name,ability:hitName,abilityId:spec.id||spec.effectId,stat:effectiveDamageSpec?.scaling||spec.stat||'INT',abilityMultiplier:baseAbilityMultiplier,effectiveMultiplier:mult,effectContributions,damageType};
   let dmg=v15Damage(effectiveDamageSpec?.formula||spec.formula||(spec.stat==='ATK'?'empowered_hybrid_physical':'pure_caster_ability'),{agent,actor,target:t,abilityMult:mult,defPen:defPen(spec,effects),trueDamage,psychicTrue,damageSpec:{...(effectiveDamageSpec||{}),type:effectiveDamageSpec?.type||'physical',element:effectiveDamageSpec?.element||'physical'},trace});
   const ex=effects.find(e=>e.type==='execute');
   const executing=!!(ex&&t.hp/t.maxHp<Number(ex.threshold||0));
   if(executing){dmg=Math.max(dmg,t.hp+(t.shield||0));trace.effectContributions.push({type:'execute',instantKill:true});}
   const critBonus=Number(agent._abilityCritDamageBonus||0)+effects.filter(e=>e.type==='critDamage').reduce((n,e)=>n+Number(e.amount||0),0);
   const rates=combatRates(agent,actor);
   let critChance=rates.crit;
   if(effects.some(e=>e.type==='crit'))critChance+=effectAmount(spec,'crit');
   critChance=critFailed?0:Math.min(.95,critChance);
   let critical=false;
   if(r()<critChance){critical=true;const f=1+rates.critDamage+critBonus;dmg=Math.round(dmg*f);trace.effectContributions.push({type:'critical',multiplier:f});}
   trace.final=dmg;trace.critical=critical;trace.critBonus=critBonus;trace.critChance=critChance;
   state.balanceTrace.push(trace);
   if(hasStatus(t,'sleep')&&!t._sleepAppliedThisAction)handleSleepWake(t,lines);
   const tk=resolveIncoming(actor,t,dmg,state,lines,r,{damageType,trueDamage:trueDamage||psychicTrue,execute:executing});
   const finalDamage=tk.hpLoss+tk.absorbed;
   const executed=executing&&!!(tk.dead||tk.revived);
   didDamage=true;totalDamage+=finalDamage;
   if(executed)lines.push({text:`EXECUTE: ${t.name} is instantly executed!`,kind:'quirk'});
   lines.push({text:`IMPACT: ${damageType} damage ${finalDamage} to ${t.name}${critical?' critical':''}${trueDamage||psychicTrue?' (TRUE DAMAGE)':''}.`,kind:'damage'});
   emitCombatEvent(state,{
     round:state?.currentRound||1,type:'damage',actorId:actor.id,actorName:actor.name,actorTeam:teamOf(actor,state),targetId:t.id,targetName:t.name,targetTeam:teamOf(t,state),amount:finalDamage,damageType,critical,trueDamage:trueDamage||psychicTrue,instantKill:executed,hpAfter:t.hp,maxHp:t.maxHp
   });
   if(matchesIncomingCategory('physical',trueDamage||psychicTrue?'true':damageType)&&t.alive&&actor.alive&&!tk.revived&&!tk.negated&&finalDamage>0)maybeCounter(t,actor,state,lines,r);
 }}
 const healRatio=effects.filter(e=>e.type==='heal_damage_ratio').reduce((n,e)=>n+Number(e.amount||0),0); if(healRatio>0&&didDamage)recoverHP(actor,Math.round(totalDamage*healRatio));
 const abilityLifeSteal=effects.filter(e=>e.type==='lifesteal'&&e.duration===undefined).reduce((n,e)=>n+Number(e.ratio||e.amount||0),0)+Number(actor._lifestealBonus||0)+Number(traitData(agent).lifesteal||0); if(abilityLifeSteal>0&&didDamage)recoverHP(actor,Math.round(totalDamage*abilityLifeSteal));
 agent._lowHpBonus=0;agent._abilityCritDamageBonus=0;for(const t of (targets||[]))delete t._sleepAppliedThisAction;
 for(const u of new Set([actor,...supportTargets,...targets]))syncUnitToAgent(u);
 return true;
}
function syncUnitToAgent(u){if(u&&u.agent&&u.agent!==u){for(const k of ['_buffs','_speedDebuff','_threadSpeedDebuff','_threadDodgeDebuff','_threadHitDebuff','_threadLockDodge','_spCostMultiplier','_cooldownPenalty','_dodgeBonus','_counterBonus','_lifestealBonus'])u.agent[k]=u[k];}}
function defPen(spec,effects){return effects.filter(e=>e.type==='defPen'||e.type==='defense_penetration').reduce((n,e)=>n+Number(e.amount||0),0);}
function powerEffect(a,actor,enemy,state,lines=[],r){if(!lines)lines=[];
  ensureCombatResource(a); a._hpRatio=actor.hp/Math.max(1,actor.maxHp); tryMythicalForm(a,actor,state,lines,r);
  if(a.path==='fool'&&a.sequence<=5&&!hasStatus(actor,'silenced')&&!hasStatus(a,'silenced')&&abilityAvailable(a,'thread_binding')){
    const threadSpec = unlockedAbilities(a).find(x => x.effectId === 'thread_binding' || x.id === 'thread_binding');
    const threadCost = effectiveAbilityCost(a,{costSP:threadSpec?.costSP ?? 45});
    const threadCd = Number(threadSpec?.cooldown ?? 5);
    const threadSlotsCfg = G9D?.formulas?.spirit_threads_rules?.sequence_slots || {5:1,4:2,3:2,2:3,1:3,0:4};
    const budget = threadSlotsCfg[String(a.sequence)] ?? (G9D?.formulas?.spirit_threads_rules?.default_slots ?? 1);
    if(!enemy.thread && (a.sp||0)>=threadCost && !(a.cooldowns?.thread_binding>0) && (a._threadAttempts||0)<budget && threadUsage(state,a)<threadSlots(a.sequence)){
      a.sp-=threadCost; a.cooldowns.thread_binding=999; // locked until the thread resolves (releaseThread sets the real CD)
      lines.push({text:`ACTION: ${actor.name} casts [Thread Binding] (Cost: ${threadCost} SP | ${threadCd}-Turn CD).`,kind:'action'});
    emitCombatEvent(state, {
      round: state?.currentRound || 1,
      type: 'cast',
      actorId: actor.id,
      actorName: actor.name,
      actorTeam: teamOf(actor, state),
      ability: 'Thread Binding',
      costSP: threadCost,
      cooldown: threadCd
    });
      if(!applySpiritThread(a,enemy,actor,state,lines,r))a.cooldowns.thread_binding=threadCd > 0 ? threadCd + 1 : 0;
      return true;
    }
  }
  const spec=chooseStructuredAbility(a,actor,enemy,state);
  if(spec&&applyStructuredAbility(a,actor,enemy,state,lines,r,spec))return true;
  attackOnce(a,actor,enemy,state,lines,r,1);
  changeMeter(a,a.path,0);
  return true;
}

function applyPassiveAuras(units,state){
 for(const u of units){if(!u.alive)continue;const a=u.agent||u;let specs;try{specs=unlockedAbilities(a).filter(x=>x.type==='passive');}catch(err){continue;}
  const foes=state.allies.includes(u)?state.enemies:state.allies;
  for(const spec of specs)for(const e of abilityEffects(spec)){if(e.type!=='debuff')continue;const m=1-Number(e.amount||0);
   for(const f of foes){if(!f.alive)continue;if(e.stat==='speed')addFx(f,'speed_debuff','speed',m,1);else addFx(f,'debuff',e.stat,m,1);}}}
}
function applyPartyPassiveEffects(units){
 const shared=[];
 for(const u of units){const a=u.agent||u;for(const spec of unlockedAbilities(a).filter(x=>x.type==='passive'))for(const e of abilityEffects(spec))if((e.type==='combat_rule'&&e.rule==='party')||(e.type==='targeting'&&e.mode==='all_allies'))shared.push(...abilityEffects(spec).filter(x=>x.type!=='combat_rule'));}
 for(const u of units){const a=u.agent||u;a._partyPassiveEffects=shared.map(x=>({...x}));}
}

function canRevealEnemyStats(agent){ return (agent.path==="visionary" && agent.sequence<=9) || (agent.path==="hermit" && agent.sequence<=9) || (agent.path==="fool" && agent.sequence<=3); }

function tickCombatEffectDurations(units){
 for(const u of units){
  if((u._taunt||0)>0){if(u._tauntGrace)delete u._tauntGrace;else u._taunt--;}
  tickFx(u);
  for(const [timer,value] of [['_spCostDuration','_spCostMultiplier'],['_cooldownDuration','_cooldownPenalty'],['_hitChanceDebuffDuration','_hitChanceDebuff'],['_skillMisfireDuration','_skillMisfireChance']]){
   if((u[timer]||0)<=0)continue;
   if(u._durationGrace?.[timer]){delete u._durationGrace[timer];continue;}
   if(--u[timer]<=0)u[value]=0;
  }
  syncUnitToAgent(u);
 }
}

function resolveQuest(members,quest,seed=Date.now(),decisions={}){
 const r=rand(seed),lines=[],consequences=[],allies=members.map(a=>makeCombatUnit(a));
 const authoredOpponents=Array.isArray(decisions.authoredOpponents)&&decisions.authoredOpponents.length?decisions.authoredOpponents:null;
 const simulationOpponents=Array.isArray(decisions.simulationOpponents)?decisions.simulationOpponents:null; const enemyCount=simulationOpponents?.length || quest.enemyCount|| (allies.length===1?1:(allies.length>=3 && quest.difficultySequence>=7?2:(quest.difficultySequence>=5?2:3))); const enemies=quest.encounter?(authoredOpponents?authoredOpponents.map((spec,i)=>makeAuthoredEnemy(spec,r,i)):simulationOpponents?simulationOpponents.map((spec,i)=>makeEnemy(spec.sequence,r,i,spec.path)):Array.from({length:enemyCount},(_,i)=>makeEnemy(quest.difficultySequence,r,i,quest.requiredPath))):[];
 const individual=!!decisions.individual; const state={allies,enemies,individual,createdMarionettes:[],battleMarionettes:[],rng:r,weaponUsage:{},combatStatsShown:false,balanceTrace:[],events:[]};
 for(const u of allies)u.agent._teamDamageMultiplier=1;
 for(const u of enemies)u.agent._teamDamageMultiplier=individual?COMBAT_BALANCE.enemyDamageIndividual:COMBAT_BALANCE.enemyDamageParty;
 lines.push({text:`Contract: ${quest.name}`,kind:'system'},{text:quest.story||quest.brief,kind:'story'});
 if(!quest.encounter){
   if(quest.objective==='rescue'){lines.push({text:'The guild searches the neighborhood rather than hunting for a fight. Clues lead through an alley, beneath a bakery awning, and into a coal shed.',kind:'system'},{text:'The missing cat is found frightened but unharmed and returned to its owner.',kind:'victory'});}
   else {lines.push({text:'The party works through interviews, records and ordinary observation. No hostile confrontation is necessary.',kind:'victory'});}
   const complication=r()<(quest.mundane?.08:.03); const success=!complication;
   for(const u of allies){const a=u.agent;const gain=digestGain(quest,individual,a);a.digest=Math.min(100,(a.digest||0)+gain);
   const equipped=weaponFor(a); gainWeaponMastery(a,equipped.kind,G9D.system.weapon_mastery.per_completed_contract||2);
   changeMeter(a,a.path,3);restoreCombatAgentStats(u);consequences.push({type:'syncAgent',agentId:a.id,agent:a,text:`${a.name} digests ${gain}% of the current potion.`});}
   if(complication){lines.push({text:'A complication delays the work: a witness gives a false statement and the guild loses time.',kind:'status'});for(const u of allies)consequences.push({type:'injury',agentId:u.id,amount:4,text:'A mundane contract complication caused a minor injury.'});}
   return {lines,success,consequences,marionettes:[],rewards:{...quest.rewards,reputation:success?quest.rewards.reputation:0},weaponUsage:state.weaponUsage,dayCost:quest.dayCost};
 }
 lines.push({text:`Threat: ${quest.difficultySequence===10?'Ordinary Human':`Sequence ${quest.difficultySequence}`}. ${enemies.length} hostile unit(s) emerge.`,kind:'system'});
 for(const e of enemies)lines.push({text:`${e.name} — ${e.sequence===10?`Ordinary Human · ${e.occupation}`:`${pathOf(e.path).name} · Sequence ${e.sequence}`}.`,kind:'system'});
 applyPartyPassiveEffects(allies);
 applyPartyPassiveEffects(enemies);


 for(const a of allies)lines.push({text:`${a.name} — ${a.agent.path?`${pathOf(a.agent.path).name} · Sequence ${a.agent.sequence}`:'Unawakened'}.`,kind:'system'});
 let round=0;
 while(allies.some(x=>x.alive)&&enemies.some(x=>x.alive)&&round<15){round++;state.currentRound=round;startRoundCombatResources([...allies,...enemies],lines);lines.push({text:`· Round ${round} ·`,kind:'system'}); emitCombatEvent(state, {round, type: 'round_start'});
   for (const u of [...allies, ...enemies]) u._actedThisRound = false;                                                                
   const initiativeOrder=(a,b)=>unitInitiative(b)-unitInitiative(a)||a.name.localeCompare(b.name);
   const initiativeLine=[...allies.filter(x=>x.alive),...enemies.filter(x=>x.alive)].sort(initiativeOrder).map(x=>`${x.name} ${unitInitiative(x).toFixed(1)}`).join(' → '); lines.push({text:`Initiative: ${initiativeLine}`,kind:'system'}); emitCombatEvent(state, {round, type: 'system', subtype: 'initiative', details: initiativeLine, text: `Initiative: ${initiativeLine}`});
   processSpiritThreads(state,lines);                                                                 
   applyPassiveAuras([...allies,...enemies],state);
   const order=[...allies.filter(x=>x.alive),...enemies.filter(x=>x.alive)].sort(initiativeOrder);
   const actors=order;
   for(const c of actors){try{if(!c.alive||c.inCombat===false)continue;state.currentTurn=(state.currentTurn||0)+1;c._acting = true;beginTurn(c);processStatuses(c,t=>lines.push({text:t,kind:'status'}),state,false);c._actedThisRound = true;if(!c.alive)continue;
       if(c._skipTurns>0||hasStatus(c,'banished')){if(c._skipTurns>0)c._skipTurns--;lines.push({text:`${c.name} is banished in a spatial fold and cannot act.`,kind:'status'});if(!c._skipTurns||c._skipTurns<=0){removeStatus(c,'banished');removeStatus(c,'untargetable');}continue;}
       if((c.agent.madness||0)>=50&&r()<.18){lines.push({text:`${c.name} loses the action to mounting Madness.`,kind:'status'});continue;}if(actionDisabled(c)){
      lines.push({text:`${c.name} loses the action to Crowd Control.`,kind:'status'});
      emitCombatEvent(state, {
        round: state?.currentRound || 1,
        type: 'status',
        subtype: 'cc_loss',
        actorId: c.id,
        actorName: c.name,
        actorTeam: teamOf(c, state),
        text: `${c.name} loses action to Crowd Control`
      });
      continue;
    }
       if(c.thread&&c.thread.progress>=4&&r()<THREAD_RULES.bindingChance){addStatus(c,'bound',1,'Spirit Body Thread');}if(hasStatus(c,'fear')&&r()<.35){lines.push({text:`${c.name} loses this action to a status effect.`,kind:'status'});continue;}
       const isConfused=hasStatus(c,'confused')&&r()<0.50;if(isConfused)lines.push({text:`${c.name} is Confused and targets an ally!`,kind:'status'});
       const targetPool=(isConfused?sameSideOf(c,state):foesOf(c,state)).filter(x=>x.alive&&x.inCombat!==false);
       if(!targetPool.length)continue;
       const targetable=targetPool.filter(x=>!hasStatus(x,'untargetable'));
       const enemy=pickR(r,tauntFilter(c,targetable.length?targetable:targetPool));
       if(!state.combatStatsShown)state.combatStatsShown={};if(!state.combatStatsShown[enemy.id]){lines.push({text:`Combat begins: ${enemy.name} · HP ${enemy.maxHp} · ATK ${enemy.atk} · DEF ${enemy.def} · INT ${enemy.int} · Speed ${speedFor(enemy).toFixed(1)} · AV ${actionValueFor(enemy).toFixed(1)}.`,kind:'system'});state.combatStatsShown[enemy.id]=true;}
       syncUnitToAgent(c);powerEffect(c.agent,c,enemy,state,lines,r);
       if(c._extraTurns>0&&c.alive&&enemy.alive){c._extraTurns--;powerEffect(c.agent,c,enemy,state,lines,r);}
   }finally{c._acting = false;tickUnitStatuses(c);tickCombatEffectDurations([c]);}
   }
 }
 const success=allies.some(x=>x.alive&&x.inCombat)&&!enemies.some(x=>x.alive); if(success)lines.push({text:'The hostile force is defeated and the guild completes the contract.',kind:'victory'});else lines.push({text:'The guild is defeated in the encounter.',kind:'failure'});
 const snapshotUnit=x=>({id:x.id,name:x.name,path:x.path,sequence:x.sequence,stats:cloneE(x.stats),
   initiative:unitInitiative(x),alive:x.alive,hp:x.hp,maxHp:x.maxHp,sp:x.sp,maxSP:x.maxSP});
 const battleSnapshot={allies:allies.map(snapshotUnit),enemies:enemies.map(snapshotUnit),balanceTrace:state.balanceTrace,events:state.events||[]};
 for(const u of allies.filter(x=>!x.summoned)){const a=u.agent;const gain=digestGain(quest,individual,a);if(success){
  a.digest=Math.min(100,(a.digest||0)+gain);
  const equipped=weaponFor(a), masteryAmount=G9D.system.weapon_mastery.per_completed_contract||2;
  gainWeaponMastery(a,equipped.kind,masteryAmount);
}
a.injuries=Math.min(100,(a.injuries||0)+(u.alive?Math.max(0,Math.round((u.maxHp-u.hp)/u.maxHp*25)):30));a.madness=Math.max(0,Math.min(100,(a.madness||0)+(success?-3:12)));changeMeter(a,a.path,success?12:6);restoreCombatAgentStats(u);if(!u.alive){consequences.push({type:'death',agentId:a.id,text:`${a.name} dies during the contract and is removed from the roster.`});}else{consequences.push({type:'syncAgent',agentId:a.id,agent:a,text:success?`${a.name} returns with new experience and ${gain}% digestion.`:`${a.name} returns shaken from the failed contract.`});}if(a.madness>=100)consequences.push({type:'corruptedDeath',agentId:a.id,text:`${a.name} reaches 100 Madness and becomes a corrupted monster.`});}
 const rewards=cloneE(quest.rewards);if(!success){rewards.funds=Math.round(rewards.funds*.35);rewards.reputation=0;}
 return {lines,events:state.events||[],success,consequences,marionettes:[],marionettesCreated:(state.battleMarionettes||[]).filter(m=>m.side==='ally').length,enemyMarionettesCreated:(state.battleMarionettes||[]).filter(m=>m.side==='enemy').length,weaponUsage:state.weaponUsage,rewards,dayCost:1,battleSnapshot};
}

// Mechanical descriptions use normalized effects and the same defaults as combat.
function isPhase3DeferredAbility(spec,path){return ['logic_distortion','parasitic_contagion'].includes(spec.effectId||spec.id);}
function ruleNumber(value){return String(Number(Number(value).toFixed(4)));}
function rulePercent(value){return `${ruleNumber(Number(value)*100)}%`;}
function ruleLabel(value){return String(value).replace(/_/g,' ').replace(/^./,s=>s.toUpperCase());}
function ruleDuration(value){return value==='next_turn'?'until your next turn':`for ${ruleNumber(value)} turn${Number(value)===1?'':'s'}`;}
function abilityDamageText(spec){
 const effects=abilityEffects(spec),damage=spec.damage;
 if(isPhase3DeferredAbility(spec))return damage?`${Math.round(damage.multiplier*100)}% ${damage.scaling} · ${damage.element||damage.type}`:'Non-damaging / passive effect';
 if(!damage||!(damage.multiplier>0))return '';
 const formula=G9D.formulas.hybrid_coefficients||{},components=effects.filter(e=>e.type==='damage_component');
 let basis;
 if(components.length)basis=[`${rulePercent(damage.multiplier)} ${damage.scaling}`,...components.map(e=>`${rulePercent(e.multiplier)} ${e.stat}`)].join(' + ');
 else if(['empowered_hybrid_physical','empowered_hybrid_agility'].includes(damage.formula)){
  const cfg=formula[damage.formula];basis=`${rulePercent(damage.multiplier)} × (${rulePercent(cfg.atk_mult)} ATK + ${rulePercent(cfg.int_mult)} INT)`;
 }else basis=`${rulePercent(damage.multiplier)} INT`;
 const truePsychic=effects.some(e=>e.type==='damage_rule'&&e.rule==='psychic_true');
 const trueDamage=damage.type==='true'||effects.some(e=>e.type==='damage_rule'&&e.rule==='true');
 const element=truePsychic?'True Psychic':trueDamage?'True':ruleLabel(canonicalResistanceElement(damage.element||damage.type));
 const bypass=components.length||damage.formula==='empowered_hybrid_physical'?formula.empowered_hybrid_physical.base_def_bypass:damage.formula==='empowered_hybrid_agility'?formula.empowered_hybrid_agility.base_def_bypass:formula.pure_caster_ability.base_def_bypass;
 const mixed=damage.type==='elemental'&&!damage.element?'; resistance uses the average of Fire, Water, Lightning and Frost':'';
 return `${basis} ${element} damage${trueDamage||truePsychic?' (ignores DEF and elemental resistance)':` (${rulePercent(bypass)} base DEF bypass)`}${mixed}`;
}
function abilityDescription(spec,path,sequence){
 if(isPhase3DeferredAbility(spec,path))return spec.text||'';
 const effects=abilityEffects(spec),passive=spec.type==='passive';
 const name=spec.name||String(spec.text||spec.effectId||'Ability').split(/\s(?:—|--)\s/)[0];
 const parts=[],damaging=!!abilityDamageText(spec),duration=e=>ruleDuration(fxDuration(e,e.type));
 const targetMode=effects.find(e=>e.type==='targeting')?.mode;
 if(targetMode==='all_enemies')parts.push('Targets all enemies');
 if(targetMode==='all_allies')parts.push('Supports all living allies');
 if((spec.effectId||spec.id)==='thread_binding'){
  parts.push('Attempts Spirit Body Threads on one enemy; resistance can prevent attachment');
  parts.push(`Progresses one stage each round: ${rulePercent(THREAD_RULES.initialSpeedLoss)} Speed loss; then ${ruleNumber(THREAD_RULES.dodgeLoss*100)}-point Dodge and ${ruleNumber(THREAD_RULES.hitLoss*100)}-point accuracy loss; then ${rulePercent(THREAD_RULES.advancedSpeedLoss)} total Speed loss and no Dodge; stage 4 adds a ${rulePercent(THREAD_RULES.bindingChance)} binding chance`);
  parts.push(`At stage ${THREAD_RULES.required}, the target dies and joins your side as a battle-only marionette with ${rulePercent(THREAD_RULES.marionetteStats)} of its stats`);
  parts.push(`When the threaded target loses more than ${rulePercent(THREAD_RULES.damageThreshold)} of its Max HP in one combatant turn, remove one stack, at most once per turn; shield absorption does not count`);
 }else{
  if(damaging)parts.push(`Deals ${abilityDamageText(spec)}`);
  for(const e of effects){
   const n=Number(e.amount||0),pct=rulePercent(n),stat=String(e.stat||'').toUpperCase(),d=duration(e);
   switch(e.type){
    case 'targeting':case 'damage_rule':case 'damage_component':break;
    case 'stat_modifier':if(passive)parts.push(`+${pct} ${stat==='HP'?'Max HP':stat}`);break;
    case 'buff':parts.push(`+${pct} ${stat==='ALL'?'ATK/DEF/INT':stat} ${d}`);break;
    case 'debuff':parts.push(`Enemy ${stat} −${pct}${passive?' while you are alive':` ${d}`}`);break;
    case 'shield':parts.push(`Grants a ${rulePercent(e.fullHp?1:e.maxHpRatio||0)} Max HP ${e.incomingCategory?`${e.incomingCategory} `:''}shield; lasts until depleted or dispelled`);break;
    case 'heal':parts.push(`Immediately restores ${[e.maxHpRatio?`${rulePercent(e.maxHpRatio)} Max HP`:null,e.scaling==='INT'&&e.multiplier?`${rulePercent(e.multiplier)} INT`:null].filter(Boolean).join(' + ')} HP, capped at Max HP`);break;
    case 'cleanse':parts.push(`Removes ${CLEANSE_STATUSES.map(ruleLabel).join(', ')}`);break;
    case 'strip_buffs':case 'nullify_buffs':parts.push('Removes current stat buffs, Guarded, Evade and shields');break;
    case 'damage_taken':case 'damageTaken':parts.push(`${n<0?'Reduces':'Increases'} incoming ${e.incomingCategory||'all'} damage by ${rulePercent(Math.abs(n))}${passive?'':` ${d}`}${n<0?' after shields':''}`);break;
    case 'outgoing_damage':if(!passive)parts.push(`${n<0?'Reduces':'Increases'} your outgoing damage by ${rulePercent(Math.abs(n))} ${d}`);break;
    case 'reflect':{
     const incoming=e.incomingCategory||'direct';
     let reflected=e.mode==='stat'?`${rulePercent(e.multiplier)} ${e.stat} ${ruleLabel(e.element||'physical')} damage`:`${rulePercent(e.share)} of incoming damage`;
     if(e.mode==='stat'&&e.stat==='ATK'){const cfg=G9D.formulas.hybrid_coefficients.empowered_hybrid_physical;reflected=`${rulePercent(e.multiplier)} × (${rulePercent(cfg.atk_mult)} ATK + ${rulePercent(cfg.int_mult)} INT) ${ruleLabel(e.element||'physical')} damage`;}
     parts.push(`${e.negate?`Negates incoming ${incoming} hits and reflects`:`Reflects`} ${reflected} to the attacker ${d}; periodic damage does not trigger reflection`);break;
    }
    case 'resistance':if(passive){const values=canonicalResistanceMap(e.values||(e.element?{[e.element]:e.amount}:{}));parts.push(Object.entries(values).map(([key,value])=>`+${ruleNumber(value)}% ${ruleLabel(key)} direct-damage resistance`).join(', '));}break;
    case 'status_resistance':if(passive)parts.push(`+${pct} ${ruleLabel(e.status)} application resistance`);break;
    case 'immunity':if(passive)parts.push(`Immune to ${ruleLabel(e.status)}`);break;
    case 'initiative':if(passive)parts.push(`+${ruleNumber(n)}% Initiative`);break;
    case 'hitChance':if(passive)parts.push(`+${ruleNumber(n*100)} percentage points accuracy`);break;
    case 'crit':parts.push(`+${ruleNumber(n*100)} percentage points critical chance${passive?'':' on this cast'}`);break;
    case 'critDamage':parts.push(`+${ruleNumber(n*100)} percentage points critical damage${passive?'':' on this cast'}`);break;
    case 'crit_bonus':if(!passive)parts.push(`+${ruleNumber(n*100)} percentage points critical damage on this cast`);break;
    case 'defPen':case 'defense_penetration':parts.push(`+${pct} DEF bypass${passive?'':damaging?' on this cast':` ${d}`}`);break;
    case 'spell_penetration':if(passive)parts.push(`+${pct} DEF bypass for INT-scaled and caster-formula damage`);break;
    case 'dodge':parts.push(`+${ruleNumber(n*100)} percentage points Dodge${passive?'':` ${d}`}`);break;
    case 'lifesteal':parts.push(`Restores ${rulePercent(e.ratio??n)} of damage dealt${passive?' by basic strikes':e.duration!==undefined?` by basic strikes and damaging skills ${d}`:' by this cast'}`);break;
    case 'heal_damage_ratio':parts.push(`Restores ${pct} of this cast's damage dealt`);break;
    case 'execute':if(damaging)parts.push(`Executes targets already below ${rulePercent(e.threshold)} Max HP`);break;
    case 'vulnerability':parts.push(`Target takes +${pct} incoming damage ${d}`);break;
    case 'vulnerability_if_buffed':parts.push(`If the target has a stat buff, it takes +${pct} incoming damage ${d}`);break;
    case 'vulnerability_vs_corrupted':parts.push(`A target with corruption or the Madness Prone trait takes +${pct} incoming damage ${d}`);break;
    case 'steal_stat':parts.push(e.stat==='hp'?`Removes up to ${pct} enemy Max HP and restores the amount removed to you; cannot kill by this siphon`:`Lowers target ${stat} by ${pct} and raises your own ${stat} by ${pct} ${ruleDuration(fxDuration(e,'steal_stat'))}`);break;
    case 'sp_drain':parts.push(`Immediately drains up to ${ruleNumber(n)} target SP`);break;
    case 'sp_siphon':parts.push(`Immediately steals up to ${ruleNumber(n)} SP per target, capped at your maximum SP`);break;
    case 'sp_cost_increase':parts.push(`Increases target skill SP costs by ${pct} for ${e.duration||1} turns`);break;
    case 'cooldown_increase':parts.push(`Adds ${ruleNumber(n)} turn to newly assigned target skill cooldowns for ${e.duration||1} turns`);break;
    case 'skill_misfire':parts.push(`Target skills have a ${rulePercent(e.chance||.3)} misfire chance for ${e.duration||2} turns; SP and cooldown are still spent`);break;
    case 'next_attack_miss':parts.push(`Forces the target's next damaging action to miss with ${rulePercent(e.chance||1)} chance`);break;
    case 'next_crit_fail':parts.push('Prevents critical hits on the target\u2019s next damaging action');break;
    case 'next_damage_bonus':parts.push(`Stores +${pct} damage for your next landed damaging-skill hit`);break;
    case 'low_hp_bonus':parts.push(`This cast deals +${pct} damage while below 50% Max HP`);break;
    case 'extra_turn':parts.push(`Grants ${e.amount||1} extra action${Number(e.amount||1)===1?'':'s'} if you and the current enemy survive`);break;
    case 'movement_block':parts.push(`Applies Root for ${e.duration||1} turns, blocking Escape-tagged skills`);break;
    case 'knockback':parts.push(`Moves the target ${ruleNumber(n*3)} distance farther away`);break;
    case 'no_heal':parts.push(`Blocks target living-unit healing for ${e.duration||1} turns; resurrection remains possible`);break;
    case 'no_shield':parts.push(`Blocks new target shields for ${e.duration||1} turns`);break;
    case 'taunt':parts.push(`Redirects enemy target selection to you ${d}, unless taunt-immune`);break;
    case 'mind_control':parts.push(`Forces a ${rulePercent(e.damageMultiplier||1.5)} target ATK strike against an enemy teammate, if present; stuns the target for 1 turn`);break;
    case 'reset_state':parts.push('Removes your stat buffs and resets your other current cooldowns; this skill keeps its cooldown and HP stays unchanged');break;
    case 'copy_ability':parts.push('Replays a non-copy active enemy ability witnessed earlier in this battle, with its targets and effects; spends this ability\u2019s SP cost and cooldown');break;
    case 'transfer_debuffs':parts.push(`Moves your team's stat/Speed debuffs and ${TRANSFER_STATUSES.map(ruleLabel).join(', ')} to the target; transferred statuses last 1 turn`);break;
    case 'revive':if(passive)parts.push(`Automatically revives once per battle at ${rulePercent(e.hpRatio||.25)} Max HP${e.consumeAllSP?', consuming remaining SP':''}${e.exhaustionDuration?`; marks Spiritual Exhaustion for ${e.exhaustionDuration} turn (no additional action restriction)`:''}`);break;
    case 'status_pool':parts.push(`${rulePercent(e.chance??1)} chance to apply one of ${e.statuses.map(ruleLabel).join(', ')} for ${e.duration||1} turns`);break;
    case 'debuff_hit':parts.push(`Lowers target accuracy by ${ruleNumber(n*100)} percentage points for ${e.duration||1} turns`);break;
    case 'status':case 'status_chance':{
     const st=e.status,turns=e.duration||1,chance=e.type==='status_chance'?e.chance:e.chance??1;
     let meaning=ruleLabel(st);
     if(['stunned','frozen','freeze','sleep','bound','polymorphed'].includes(st))meaning+=` (blocks actions${st==='sleep'?'; wakes on a later hit':''})`;
     if(st==='evade')meaning=e.dodgeRate!==undefined&&e.dodgeRate<1?`+${ruleNumber(e.dodgeRate*100)} percentage points Dodge`:'evades direct damaging attack attempts';
     if(st==='untargetable')meaning='avoids targeting and incoming damage';
     if(st==='possession_phase')meaning='negates direct physical damage';
     if(st==='banished')meaning='leaves targeting and cannot act';
     const dot=DOT_RULES.find(x=>x[0]===st);if(dot)meaning+=` (${rulePercent(dot[1])} Max HP ${ruleLabel(dot[2])} damage before each affected turn)`;
     parts.push(`${rulePercent(chance)} chance: ${meaning} for ${turns} turn${Number(turns)===1?'':'s'}${!SELF_STATUSES.includes(st)?e.ignoreResistance?'; ignores numeric status resistance, but not immunity':'; subject to status resistance and immunity':''}`);break;
    }
    default:throw new Error(`Missing description rule for effect ${e.type}`);
   }
  }
 }
 if(damaging)parts.push('Damage and hostile effects use accuracy and Dodge; critical, authority and defense modifiers still apply');
 if(!parts.length)parts.push('No additional combat effect');
 return `${name} — ${parts.join('; ')}. ${passive?'Passive.':`${ruleNumber(spec.costSP||0)} SP · Cooldown ${ruleNumber(spec.cooldown||0)} turn${Number(spec.cooldown||0)===1?'':'s'}.`}`;
}

// Generate once at bootstrap; later casts clone specs and never mutate definitions.
function refreshAbilityDescriptions(){
 for(const [path,p] of Object.entries(PATHS))for(const tier of p.sequences){
  for(const spec of tier.abilities||[]){
   if(isPhase3DeferredAbility(spec,path))continue;
   spec.text=abilityDescription(spec,path,tier.sequence);
  }
  tier.ability=tier.abilityText=tier.abilities[0]?.text||tier.abilityText;
  const entry=G9D.pathways.definitions[p.name]?.abilities?.find(x=>x.sequence===tier.sequence);
  if(entry&&!isPhase3DeferredAbility(tier.abilities[0],path))entry.description=tier.abilityText;
 }
}
refreshAbilityDescriptions();
