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

    if (activeTurn && ev.actorId === activeTurn.actorId && ev.type === 'damage') {
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
        activeTurn.subrows.push({ type: 'status', text: ev.text });
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

function makeEnemy(seq,r,i,pathHint=null){
 const isHuman=seq===10,path=isHuman?null:(pathHint||pickR(r,PATH_KEYS));
 const human={hp:rint(r,5,10),atk:rint(r,5,10),def:rint(r,5,10),int:rint(r,5,10)};
 const trait=randomTrait(r);
 const statVariance=rollVariance(r);
 const temp={humanStats:human,stats:human,trait,statVariance,recommendedPath:null};
 let stats=isHuman?humanScaled(human):statsAtSequence(awakenStats(temp,path,r),seq,path);
 const tier=seq===10?null:tierFor(path,seq);
 const abilities=seq===10?[]:pathOf(path).sequences.filter(t=>t.sequence>=seq).flatMap(t=>(t.abilities||[]).map(a=>({sequence:t.sequence,name:t.name,ability:a.text||t.abilityText||t.ability,type:a.type,effectId:a.effectId,damage:a.damage||null,effects:a.effects||[],effects:a.effects||[]})));
 return {id:`enemy_${i}`,name:isHuman?pickR(r,["Angry Suspect","Desperate Thief","Street Tough","Cornered Burglar"]):pickR(r,enemyNames),sequence:seq,path,awakened:!isHuman,occupation:isHuman?pickR(r,["Dockworker","Clerk","Thief","Butcher","Servant"]):null,humanStats:human,resistanceInt:stats.int,hp:stats.hp,maxHp:stats.hp,atk:stats.atk,def:stats.def,int:stats.int,stats:{hp:stats.hp,atk:stats.atk,def:stats.def,int:stats.int},abilities,abilityHistory:abilities,trait,traits:{name:trait,desc:TRAITS[trait].desc},statVariance,speedVariance:statVariance.speed,status:[],statusMeta:{},alive:true,distance:Math.round(5+r()*7),thread:null,weaponId:isHuman?pickR(r,['none','knife','club']):'none',weaponMastery:{},sp:0,maxSP:0,cooldowns:{},resistances:{...(G9D.balance.element_resistance_rules?.path_resistances?.[path]||{})},elementResistances:{}}
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
function incomingMultiplier(u){let pm=1;try{pm=passiveCombatModifier(u.agent||u).damageTaken||1;}catch(e){}return pm*Number(u._damageTakenMultiplier||1);}
function resolveIncoming(attacker,defender,dmg,state,lines,r,opt={}){
 const incoming=Math.max(0,Math.round(dmg)),res={incoming,absorbed:0,hpLoss:0,negated:false,reflected:0};
 if(!defender||!defender.alive||incoming<=0)return res;
 if(hasStatus(defender,'untargetable')){res.negated=true;lines.push({text:`${defender.name} is untargetable and avoids damage.`,kind:'status'});return res;}
 const dmgType=opt.damageType||'physical';
 if(hasStatus(defender,'possession_phase')&&dmgType==='physical'){res.negated=true;lines.push({text:`${defender.name}'s Possession Phase phases through physical damage!`,kind:'status'});return res;}
 const rf=(defender._reflect&&!(state&&state._inReflect))?defender._reflect:null;
 if(rf&&rf.negate){res.negated=true;lines.push({text:`${defender.name} negates ${incoming} damage.`,kind:'quirk'});}
 else{
  let rem=incoming;
  if((defender.shield||0)>0){const ab=Math.min(defender.shield,rem);defender.shield-=ab;rem-=ab;res.absorbed=ab;if(ab>0)lines.push({text:`${defender.name}'s shield absorbs ${ab} damage.`,kind:'status'});}
  const mult=incomingMultiplier(defender);
  if(mult!==1&&rem>0){const reduced=Math.max(0,Math.round(rem*mult));if(reduced!==rem)lines.push({text:`${defender.name}'s damage ${mult<1?'reduction':'vulnerability'} changes ${rem} damage to ${reduced}.`,kind:'status'});rem=reduced;}
  defender.hp-=rem;res.hpLoss=rem;
  if(defender.hp>0&&(defender.agent||(defender.path&&defender.sequence!=null))){tryMythicalForm(defender.agent||defender,defender,state,lines,r);}
 }
 if(rf&&attacker&&attacker!==defender&&attacker.alive){
  let refl=0;
  if(rf.mode==='stat'){
   const rAgent=defender.agent||defender,el=rf.element||'physical';
   refl=v15Damage(rf.stat==='ATK'?'empowered_hybrid_physical':'pure_caster_ability',{agent:rAgent,actor:defender,target:attacker,abilityMult:Number(rf.multiplier||1),damageSpec:{scaling:rf.stat,multiplier:Number(rf.multiplier||1),type:'elemental',element:el},trace:null});
  } else refl=Math.round(incoming*Number(rf.share||0));
  if(refl>0){
   lines.push({text:`${defender.name} reflects ${refl} damage back at ${attacker.name}.`,kind:'quirk'});
   if(state)state._inReflect=true;
   const rr=resolveIncoming(defender,attacker,refl,state,lines,r,{reflect:true});
   if(state)state._inReflect=false;
   res.reflected=rr.hpLoss+rr.absorbed;
   emitCombatEvent(state,{round:state?.currentRound||1,type:'damage',actorId:defender.id,actorName:defender.name,actorTeam:teamOf(defender,state),targetId:attacker.id,targetName:attacker.name,targetTeam:teamOf(attacker,state),amount:refl,damageType:rf.element||'reflected',isReflect:true,text:`${defender.name} reflects ${refl} damage back at ${attacker.name}.`});
   if(attacker.hp<=0){attacker.hp=0;attacker.alive=false;lines.push({text:`${attacker.name} falls.`,kind:'victory'});emitCombatEvent(state,{round:state?.currentRound||1,type:'death',actorId:defender.id,actorName:defender.name,actorTeam:teamOf(defender,state),targetId:attacker.id,targetName:attacker.name,targetTeam:teamOf(attacker,state),text:`${attacker.name} falls.`});tryRevive(attacker,lines,state);}
  }
 }
 return res;
}
function beginTurn(c){if(c._reflect&&c._reflect.untilTurn)c._reflect=undefined;c._tauntUntilTurn=false;if(c._fx&&c._fx.some(f=>f.turn)){c._fx=c._fx.filter(f=>!f.turn);recomputeFx(c);}}
function tauntFilter(attacker,list){const tn=list.filter(x=>x.alive&&((x._taunt||0)>0||x._tauntUntilTurn)&&!hasStatus(x,'untargetable'));return(tn.length&&!statusImmune(attacker,'taunt'))?tn:list;}
function statusResistChance(t,st){try{return Math.min(1,passiveCombatModifier(t?.agent||t).statusResist?.[st]||0);}catch(e){return 0;}}

// ---- Timed effects: every effect carries its own duration.
// duration = number of rounds, or 'next_turn' (until the holder's next action). Missing duration -> balance.json effect_durations -> 2.
function fxDuration(e,type){const d=(e&&e.duration!==undefined)?e.duration:((G9D.balance||{}).effect_durations||{})[type];return d===undefined?2:d;}
function addFx(u,cat,key,val,dur){
 u._fx=u._fx||[];const turn=dur==='next_turn',rounds=turn?0:Math.max(1,Number(dur)||2);
 const ex=u._fx.find(x=>x.cat===cat&&x.key===key&&x.val===val&&x.turn===turn);
 if(ex)ex.rounds=Math.max(ex.rounds,rounds);else u._fx.push({cat,key,val,turn,rounds});
 recomputeFx(u);
}
function removeFxCat(u,cat){u._fx=(u._fx||[]).filter(f=>f.cat!==cat);recomputeFx(u);}
function recomputeFx(u){
 const far=(cur,v)=>(cur===undefined||Math.abs(v-1)>Math.abs(cur-1))?v:cur;
 const buffs={},debuffs={};let speed,outg,vuln,dtm,dodge=0,counter=0,defpen=0;
 for(const f of u._fx||[]){
  if(f.cat==='buff')buffs[f.key]=Math.max(buffs[f.key]||1,f.val);
  else if(f.cat==='debuff')debuffs[f.key]=Math.min(debuffs[f.key]||1,f.val);
  else if(f.cat==='speed_debuff')speed=Math.min(speed||1,f.val);
  else if(f.cat==='outgoing')outg=far(outg,f.val);
  else if(f.cat==='vuln')vuln=Math.max(vuln||1,f.val);
  else if(f.cat==='dtm')dtm=far(dtm,f.val);
  else if(f.cat==='dodge')dodge=Math.max(dodge,f.val);
  else if(f.cat==='counter')counter=Math.max(counter,f.val);
  else if(f.cat==='defpen')defpen=Math.max(defpen,f.val);
 }
 u._buffs=Object.keys(buffs).length?buffs:undefined;u._debuffs=Object.keys(debuffs).length?debuffs:undefined;
 u._speedDebuff=speed;u._outgoingMultiplier=outg;u._vulnerability=vuln;u._damageTakenMultiplier=dtm;u._dodgeBonus=dodge;u._counterBonus=counter;u._defPenBonus=defpen;
 syncUnitToAgent(u);
}
function tickFx(u){
 if(u._fx&&u._fx.length){for(const f of u._fx)if(!f.turn)f.rounds--;u._fx=u._fx.filter(f=>f.turn||f.rounds>0);recomputeFx(u);}
 if(u._reflect&&!u._reflect.untilTurn&&--u._reflect.rounds<=0)u._reflect=undefined;
}
function hasStatus(target,status){return !!target?.status?.includes(status);}
const SELF_STATUSES=['evade','untargetable','guarded','inspired','possession_phase'];
function statusImmune(t,s){try{return (passiveCombatModifier(t?.agent||t).immunities||[]).includes(s);}catch(e){return false;}}
function addStatus(target,status,duration=1,source="unknown",extraMeta={}){if(statusImmune(target,status))return;target.status=target.status||[];target.statusMeta=target.statusMeta||{};if(!target.status.includes(status))target.status.push(status);target.statusMeta[status]={duration,source,...(extraMeta||{})};}
function removeStatus(target,status){if(!target?.status)return;target.status=target.status.filter(x=>x!==status);if(target.statusMeta)delete target.statusMeta[status];}
function processStatuses(unit,add){if(!unit.alive)return;unit.status=unit.status||[];unit.statusMeta=unit.statusMeta||{};const isUntargetable=hasStatus(unit,"untargetable");if(!isUntargetable){if(hasStatus(unit,"burn")){const d=Math.max(1,Math.round(unit.maxHp*.07));unit.hp-=d;add(`${unit.name} suffers ${d} Burn damage (7% Max HP).`);} if(hasStatus(unit,"poison")){const d=Math.max(1,Math.round(unit.maxHp*.05));unit.hp-=d;add(`${unit.name} suffers ${d} Poison damage (5% Max HP).`);} if(hasStatus(unit,"curse")){const d=Math.max(1,Math.round(unit.maxHp*.03));unit.hp-=d;add(`${unit.name} suffers ${d} Curse damage (3% Max HP).`);} if(hasStatus(unit,"decay")){const d=Math.max(1,Math.round(unit.maxHp*.025));unit.hp-=d;add(`${unit.name} withers under Decay.`);} if(hasStatus(unit,'bleed')){const d=Math.max(1,Math.round(unit.maxHp*.03));unit.hp-=d;add(`${unit.name} loses ${d} HP to Bleed (3% Max HP).`);} }if(unit.hp<=0){unit.hp=0;unit.alive=false;}}


function tickUnitStatuses(unit){
  if(!unit||!unit.status||!unit.statusMeta)return;
  for(const st of [...unit.status]){
    const m=unit.statusMeta[st];
    if(m){
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
function applySpiritThread(agent,enemy,actor,state,lines,r){
 if(!isThreadBeyonder(agent))return false;
 const slots=threadSlots(agent.sequence);
 if(threadUsage(state,agent)>=slots){lines.push({text:`${actor.name} has reached their personal thread limit (${slots}).`,kind:'system'});return false;}

 if(enemy.thread)return false;
 // Attempt budget per fight: keeps thread-kills a meaningful gamble now that fights last several rounds.
 const budget=({5:1,4:2,3:2,2:3,1:3,0:4})[agent.sequence]||1;
 if((agent._threadAttempts||0)>=budget)return false;
 agent._threadAttempts=(agent._threadAttempts||0)+1;
 const intGap=(enemy.resistanceInt??enemy.int)-agent.stats.int;
 const resist=Math.max(.08,Math.min(.70,({5:.62,4:.55,3:.45,2:.35,1:.25,0:.20})[agent.sequence]+Math.max(0,enemy.sequence-agent.sequence)*.16+Math.max(0,intGap)/Math.max(1,agent.stats.int)*.5));
 if(r()<resist){lines.push({text:`${enemy.name} resists the Spirit Body Thread.`,kind:'status'});changeMeter(agent,'fool',5); if (agent._threadAttempts > 0) agent._threadAttempts--; return false;}
 enemy.thread={ownerId:agent.id,progress:0,required:5};
 agent.threadTargets=[...(agent.threadTargets||[]),enemy.id];agent.activeThreads=agent.threadTargets.length;changeMeter(agent,'fool',-12);
 addStatus(enemy,'threaded',enemy.thread.required,'Spirit Body Thread');
 lines.push({text:`${actor.name} grasps the invisible Spirit Body Thread attached to ${enemy.name}.`,kind:'quirk'});return true;
}
function joinMarionette(state,owner,target,lines){
  // Battle-only Marionette: 55% of the dead unit's stats, fights for the thread owner's side, never saved to the roster.
  const pct=.55,ownerAllied=state.allies.some(x=>x.id===owner.id),rng=state.rng||Math.random;
  const src=target.agent?{hp:target.maxHp,atk:target.agent.stats.atk,def:target.agent.stats.def,int:target.agent.stats.int}:{hp:target.maxHp,atk:target.atk,def:target.def,int:target.int};
  const st={hp:Math.max(1,Math.round(src.hp*pct)),atk:Math.max(1,Math.round(src.atk*pct)),def:Math.max(1,Math.round(src.def*pct)),int:Math.max(1,Math.round(src.int*pct))};
  const seq=target.agent?target.agent.sequence:target.sequence,path=target.agent?target.agent.path:target.path;
  const name=`${target.name} — Marionette`,id=`mar_${target.id}`;let unit;
  if(ownerAllied){
    const ag=makeAgent(rng,{sequence:seq,path,trait:target.trait||'Stout Vitality'});
    Object.assign(ag,{id,name,awakened:true,unitType:'marionette',ownerId:owner.id,stats:{...st},baseStats:{...st},injuries:0,madness:0,weaponId:'none',weaponMastery:{},cooldowns:{},threadTargets:[],activeThreads:0});
    ag.sp=maxSPFor(ag);ag.maxSP=ag.sp;
    unit={id,name,agent:ag,hp:st.hp,maxHp:st.hp,alive:true,inCombat:true,summoned:true,status:[],statusMeta:{},resistances:ag.resistances||{}};
    state.allies.push(unit);
  }else{
    unit=makeEnemy(seq,rng,state.enemies.length,path);
    Object.assign(unit,{id,name,unitType:'marionette',ownerId:owner.id,summoned:true,hp:st.hp,maxHp:st.hp,atk:st.atk,def:st.def,int:st.int,resistanceInt:st.int,stats:{...st},status:[],statusMeta:{},alive:true,thread:null,cooldowns:{},weaponId:'none'});
    state.enemies.push(unit);
  }
  state.battleMarionettes=state.battleMarionettes||[];state.battleMarionettes.push({ownerId:owner.id,unit,side:ownerAllied?'ally':'enemy'});
  lines.push({text:`${name} rises under ${owner.name||'its owner'}'s control (55% stats) and joins the fight.`,kind:'quirk'});
  emitCombatEvent(state,{round:state?.currentRound||1,type:'system',text:`${name} joins ${owner.name||'the owner'}'s side as a Marionette.`});
}
function processSpiritThreads(state,lines){const allUnits=[...state.allies,...state.enemies];for(const ally of allUnits.filter(x=>x.alive&&isThreadBeyonder(x.agent||x))){const agent=ally.agent||ally;const targets=state.allies.includes(ally)?state.enemies:state.allies;for(const enemy of targets.filter(x=>x.thread?.ownerId===agent.id)){const t=enemy.thread;if(!enemy.alive){releaseThread(agent,enemy);lines.push({text:`The thread ends because ${enemy.name} is dead; the slot is freed.`,kind:"system"});continue;}if(!ally.alive||hasThreadCC(ally)){releaseThread(agent,enemy);lines.push({text:`The thread on ${enemy.name} is interrupted and its progress resets.`,kind:"status"});if(agent._threadAttempts>0)agent._threadAttempts--;continue;}t.progress++;
      if(t.progress===1){
        enemy._threadSpeedDebuff=0.15;
      }else if(t.progress===2){
        enemy._threadDodgeDebuff=-0.10;
        enemy._threadHitDebuff=0.10;
      }else if(t.progress===3){
        enemy._threadSpeedDebuff=0.35;
        enemy._threadLockDodge=true;
      }else if(t.progress===4){
        // Stage 4: 30% chance to be bound each turn
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
function passiveCombatModifier(agent){
 const specs=[...unlockedAbilities(agent).filter(x=>x.type==='passive'&&!abilityEffects(x).some(e=>(e.type==='combat_rule'&&e.rule==='party')||(e.type==='targeting'&&e.mode==='all_allies'))), ...((agent._partyPassiveEffects||[]).length?[{type:'passive',effects:agent._partyPassiveEffects}]:[])];
 let atk=1,def=1,int=1,damageTaken=1,crit=0,critDamage=.50,initiative=0,counter=.03,dodge=0,lifesteal=0,defPen=0,hp=1,hitChance=0,resistances={};const immunities=[];let spellPen=0;const statusResist={};
 for(const x of specs){for(const e of abilityEffects(x)){
   const n=Number(e.amount||0);
   if(e.type==='stat_modifier'){if(e.stat==='atk')atk*=1+n;if(e.stat==='def')def*=1+n;if(e.stat==='int')int*=1+n;if(e.stat==='hp')hp*=1+n;}
   else if(e.type==='damageTaken'||e.type==='damage_taken')damageTaken*=1+n;
   else if(e.type==='crit')crit+=n; else if(e.type==='critDamage')critDamage+=n; else if(e.type==='initiative')initiative+=n; else if(e.type==='counter')counter+=n; else if(e.type==='dodge')dodge+=n; else if(e.type==='lifesteal')lifesteal+=Number(e.ratio??n); else if(e.type==='defPen'||e.type==='defense_penetration')defPen+=Number(e.amount||0); else if(e.type==='hitChance')hitChance+=n;
   else if(e.type==='resistance')for(const [k,v] of Object.entries(e.values||{}))resistances[k]=(resistances[k]||0)+Number(v||0);
   else if(e.type==='damage_taken')damageTaken*=1+n;
   else if(e.type==='immunity'&&e.status)immunities.push(e.status);
   else if(e.type==='spell_penetration')spellPen+=n;
   else if(e.type==='status_resistance'&&e.status)statusResist[e.status]=(statusResist[e.status]||0)+Number(e.amount||0);
 }}
 if(agent._buffs){atk*=agent._buffs.atk||1;def*=agent._buffs.def||1;int*=agent._buffs.int||1;}
 return {atk,def,int,damageTaken,crit,critDamage,initiative,counter,dodge,lifesteal,defPen,hp,hitChance,resistances,immunities,spellPen,statusResist};
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
  const base = Number(agent.basePathSpeed || tableStats(agent.path, agent.sequence || 9).spd || 100);
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
function unitInitiative(u){return u.agent?initiativeScore(u.agent):speedFor(u);}

function combatRates(agent,actor=agent){
  const pm=passiveCombatModifier(agent),sm=statusCombatModifier(actor),int=agent.stats.int||10,def=agent.stats.def||10;
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

  const mergedResistances = {
    ...(G9D?.balance?.element_resistance_rules?.path_resistances?.[agent.path]||{}),
    ...(pm.resistances||{}),
    ...(agent.resistances||{})
  };

  const passives = unlockedAbilities(agent).filter(x=>x.type==='passive').map(p=>{
    const parts=[];
    for(const e of abilityEffects(p)){
      if(e.type==='stat_modifier') parts.push(`+${Math.round((e.amount||0)*100)}% ${String(e.stat).toUpperCase()}`);
      if(e.type==='resistance'&&e.values){
        for(const [rk,rv] of Object.entries(e.values)){
          parts.push(`+${Math.round(rv*100)}% ${rk.charAt(0).toUpperCase()+rk.slice(1)} Res`);
        }
      }
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
function maybeCounter(target,attacker,state,lines,r){if(!target?.agent||!target.alive)return;const rates=combatRates(target.agent,target);if(r()<rates.counter){const w=weaponStats(target.agent);const dmg=Math.max(1,Math.round((target.agent.stats.atk*.38+w.atk)*damageMultiplier(target.agent.sequence,attacker.sequence,target.agent.path,attacker.path)-(attacker.def||attacker.agent?.stats?.def||10)*.15));lines.push({text:`${target.name} counters for ${dmg} damage (${Math.round(rates.counter*100)}% counter chance).`,kind:'quirk'});resolveIncoming(target,attacker,dmg,state,lines,r);if(attacker.hp<=0){attacker.hp=0;attacker.alive=false;lines.push({text:`${attacker.name} falls.`,kind:'victory'});}}}
function attackOnce(agent,actor,enemy,state,lines,r,mult=1){
 if(actor._nextAttackMiss){const forced=r()<Number(actor._nextAttackMiss);actor._nextAttackMiss=0;if(forced){lines.push({text:`${actor.name}'s next attack is forced to miss.`,kind:'status'});return false;}}
 if(hasStatus(enemy,'untargetable')){lines.push({text:`${actor.name} cannot target ${enemy.name}.`,kind:'status'});return false;}
 if(!canAffect(agent.sequence,enemy.sequence)) { lines.push({text:`${actor.name}'s attack is suppressed by the enemy's higher Authority.`,kind:'system'}); return false; }
 const pm=passiveCombatModifier(agent), weapon=weaponStats(agent);
 const targetStats=enemy.agent?.stats||enemy; const enemyRates=combatRates(enemy.agent||enemy,enemy); const dodgeChance=Math.max(.03,Math.min(.55,.05+((targetStats.int-agent.stats.int)/Math.max(1,agent.stats.int))*.25+(enemyRates.dodge||0)-(pm.hitChance||0)));
 if(r()<dodgeChance){lines.push({text:`${actor.name}'s attack misses as ${enemy.name} reads the movement and dodges.`,kind:'status'});emitCombatEvent(state,{round:state?.currentRound||1,type:'miss',actorId:actor.id,actorName:actor.name,actorTeam:teamOf(actor,state),targetId:enemy.id,targetName:enemy.name,targetTeam:teamOf(enemy,state),text:`${actor.name}'s attack misses as ${enemy.name} reads the movement and dodges.`});return false;}
 const missChance=Math.max(0,Math.min(.95,weapon.masteryMiss-pm.hitChance+(actor._hitChanceDebuff||0)+(actor._threadHitDebuff||0))); if(r()<missChance){const missMsg=`${actor.name} misses with ${weapon.name}. ${weapon.kind==='gun'?`Gun Mastery Lv.${weapon.mastery} gives ${Math.round((1-missChance)*100)}% accuracy.`:'The attack misses.'}`;lines.push({text:missMsg,kind:'status'});emitCombatEvent(state,{round:state?.currentRound||1,type:'miss',actorId:actor.id,actorName:actor.name,actorTeam:teamOf(actor,state),targetId:enemy.id,targetName:enemy.name,targetTeam:teamOf(enemy,state),text:missMsg});return false;}
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
 const rates=combatRates(agent,actor); let critChance=Math.min(.95,rates.crit+(weapon.crit||0)); if(actor._nextCritFail){critChance=0;actor._nextCritFail=0;} let critical=false; if(r()<critChance){critical=true;dmg=Math.round(dmg*(1+rates.critDamage));trace.critical=true;trace.effectContributions.push({type:'critical',multiplier:1+rates.critDamage});}
 trace.final=dmg;
 if(state?.balanceTrace) state.balanceTrace.push(trace);
 const tk=resolveIncoming(actor,enemy,dmg,state,lines,r,{damageType:'physical'});const dealt=tk.hpLoss+tk.absorbed;
 const totalLifeSteal=Math.max(0,pm.lifesteal+Number(traitData(agent).lifesteal||0)); if(totalLifeSteal>0&&dealt>0){const heal=Math.round(dealt*totalLifeSteal);actor.hp=Math.min(actor.maxHp,actor.hp+heal);lines.push({text:`${actor.name} recovers ${heal} HP from Lifesteal.`,kind:'status'});emitCombatEvent(state,{round:state?.currentRound||1,type:'heal',actorId:actor.id,actorName:actor.name,actorTeam:teamOf(actor,state),targetId:actor.id,targetName:actor.name,targetTeam:teamOf(actor,state),amount:heal,hpAfter:actor.hp,maxHp:actor.maxHp});}
 if(weapon.id!=='none') state.weaponUsage[weapon.id]=(state.weaponUsage[weapon.id]||0)+1;
 const displayedAtk=Math.round(agent.stats.atk+(weapon.atk||0)); lines.push({text:`${actor.name} attacks with ${weapon.name==='Bare Hands'?'bare hands':weapon.name} (ATK ${displayedAtk}); ${enemy.name} suffers ${dmg}${critical?' critical':''} damage.`,kind:'normal'});
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
 if(enemy.hp>0&&weapon.bleed&&r()<weapon.bleed){addStatus(enemy,'bleed',3,actor.name);enemy.statusMeta.bleed.sourceAgent=cloneE(agent);lines.push({text:`${actor.name}'s ${weapon.name} causes Bleed.`,kind:'status'});}
 if(enemy.hp<=0){enemy.hp=0;enemy.alive=false;lines.push({text:`${enemy.name} falls.`,kind:'victory'});emitCombatEvent(state,{round:state?.currentRound||1,type:'death',actorId:actor.id,actorName:actor.name,actorTeam:teamOf(actor,state),targetId:enemy.id,targetName:enemy.name,targetTeam:teamOf(enemy,state),text:`${enemy.name} falls.`});tryRevive(enemy,lines,state);} else if(enemy.agent){maybeCounter(enemy,actor,state,lines,r);}
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
 return ['stunned','frozen','sleep','polymorphed'].some(s=>hasStatus(unit,s)) || hasStatus(unit,'bound') || hasStatus(unit,'unconscious') || (unit._skipTurns > 0) || hasStatus(unit,'banished');
}
function handleSleepWake(target,lines){
 if(hasStatus(target,'sleep')){removeStatus(target,'sleep');lines.push({text:`${target.name} wakes from Sleep when struck.`,kind:'status'});}
}

function ensureCombatResource(agent){
  agent.maxSP=maxSPFor(agent); if(!Number.isFinite(agent.sp))agent.sp=agent.maxSP;
  agent.sp=Math.min(agent.maxSP,Math.max(0,agent.sp)); agent.cooldowns=agent.cooldowns||{};
}
function startRoundCombatResources(units,lines){
  for(const u of units){if(!u.alive)continue;const a=u.agent||u;ensureCombatResource(a);const gain=spTableFor(a).regen;a.sp=Math.min(a.maxSP,a.sp+gain);for(const k of Object.keys(a.cooldowns||{})){if(a.cooldowns[k]>0)a.cooldowns[k]--;}}
}
function activeSpecs(agent){return unlockedAbilities(agent).filter(x=>x.type==='active').map(x=>({...x}));}
function abilityReady(agent,spec){ensureCombatResource(agent);const cost=Math.round(Number(spec.costSP||0)*(1+Number(agent._spCostMultiplier||0))); return (agent.sp||0)>=cost&&!(agent.cooldowns?.[spec.effectId]>0)&&!hasStatus({status:agent.status||[]},'silenced');}
function abilityAvailable(agent,effectId){return unlockedAbilities(agent).some(x=>x.effectId===effectId||x.id===effectId);}
function chooseStructuredAbility(agent,actor,enemy,state){
 if(hasStatus(actor,'silenced')||hasStatus(agent,'silenced'))return null;
 const hpRatio=actor.hp/Math.max(1,actor.maxHp); let specs=activeSpecs(agent).filter(x=>x.effectId!=='thread_binding'&&abilityReady(agent,x));  // Thread Binding is resolved in powerEffect via applySpiritThread
 if(!specs.length)return null;
 // Fool: bank SP for Thread Binding (45 SP) instead of spending it on cheap casts every round.
 if(agent.path==='fool'&&agent.sequence<=5&&abilityAvailable(agent,'thread_binding')&&!(agent.cooldowns?.thread_binding>0)&&threadUsage(state,agent)<threadSlots(agent.sequence)&&(agent.sp||0)<45)return null;
 if(agent.path==='error' && agent.sequence===9){const x=specs.find(s=>s.id==='combat_theft'||s.effectId==='combat_theft');if(x)return x;}

 // Time Theft: if all enemies have already moved this round, skip Time Theft and pick another skill
   // Combat Record: skip until at least one enemy has cast an eligible ability (Option 1)
  const anyEnemyCast = foesOf(actor, state).some(e => {
    const history = state?._abilityHistoryByUnit?.[e.id];
    return history && history.some(h => {
      const hid = h.spec?.id || h.spec?.effectId;
      return hid && hid !== 'combat_record';
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
 const control=specs.find(x=>abilityEffects(x).some(e=>['status','status_chance','skip','banish','silence'].includes(e.type)));
 if(control&&!(enemy.status||[]).some(s=>['stunned','frozen','sleep','silenced','banished','polymorphed'].includes(s)))return control;
 const damaging=specs.filter(x=>(x.damage?.multiplier||x.scale||0)>0).sort((a,b)=>(b.damage?.multiplier||b.scale||0)-(a.damage?.multiplier||a.scale||0))[0];
 if(damaging)return damaging;
 // Support-only abilities are cast only when they would currently do something (no healing at full HP, no re-shielding, no re-buffing).
 const useful=x=>{const t=abilityEffects(x).map(e=>e.type);const only=k=>t.length&&t.every(y=>k.includes(y)||y==='targeting');
  if(only(['heal']))return hpRatio<.85;
  if(only(['shield']))return !(actor.shield>0);
  if(only(['buff']))return !Object.keys(actor._buffs||{}).length;
  if(only(['cleanse']))return (actor.status||[]).length>0;
  if(only(['debuff','steal_stat'])){const need=abilityEffects(x).filter(e=>e.type==='debuff'||(e.type==='steal_stat'&&e.stat!=='hp'));return !need.length||need.some(e=>e.stat==='speed'?!(enemy._speedDebuff<1):!(enemy._debuffs?.[e.stat]<1));}
  if(only(['heal','cleanse']))return hpRatio<.85||(actor.status||[]).length>0;
  return true;};
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
  
  // 1. Check if selected enemy cast an eligible ability this round
  const enemyLog = state?._abilityHistoryByUnit?.[enemy.id] || [];
  const enemyThisRound = enemyLog.filter(x => {
    const xid = x.spec?.id || x.spec?.effectId;
    return x.round === round && xid !== 'combat_record';
  });
  if (enemyThisRound.length > 0) return cloneE(enemyThisRound[enemyThisRound.length - 1].spec);

  // 2. Check if ANY enemy cast an eligible ability this round
  const allFoesThisRound = [];
  for (const f of foes) {
    const fLog = state?._abilityHistoryByUnit?.[f.id] || [];
    for (const entry of fLog) {
      const xid = entry.spec?.id || entry.spec?.effectId;
      if (entry.round === round && xid !== 'combat_record') {
        allFoesThisRound.push(entry);
      }
    }
  }
  if (allFoesThisRound.length > 0) return cloneE(allFoesThisRound[allFoesThisRound.length - 1].spec);

  // 3. Fallback to target enemy latest cast in prior rounds
  const enemyPrior = enemyLog.filter(x => {
    const xid = x.spec?.id || x.spec?.effectId;
    return xid !== 'combat_record';
  });
  if (enemyPrior.length > 0) return cloneE(enemyPrior[enemyPrior.length - 1].spec);

  // 4. Fallback to ANY enemy latest cast in prior rounds
  const allFoesPrior = [];
  for (const f of foes) {
    const fLog = state?._abilityHistoryByUnit?.[f.id] || [];
    for (const entry of fLog) {
      const xid = entry.spec?.id || entry.spec?.effectId;
      if (xid !== 'combat_record') {
        allFoesPrior.push(entry);
      }
    }
  }
  if (allFoesPrior.length > 0) return cloneE(allFoesPrior[allFoesPrior.length - 1].spec);

  // 5. Ultimate fallback to active ability pool
  const enemyAgent = enemy.agent || enemy;
  const enemySpecs = (typeof unlockedAbilities === 'function' ? unlockedAbilities(enemyAgent) : (enemy.abilities || []))
    .filter(x => (x.type === 'active' || x.kind === 'active') && (x.id || x.effectId) !== 'combat_record');
  return enemySpecs.length ? cloneE(enemySpecs[0]) : null;
}
function applyStructuredAbility(agent,actor,enemy,state,lines,r,spec){
 ensureCombatResource(agent); let cost=Number(spec.costSP||0);
 
 if((agent.sp||0)<cost)return false;
 const misfire=Number(actor._skillMisfireChance||0)||effectAmount(spec,'skill_misfire','chance',effectAmount(spec,'skill_misfire')); if(misfire&&r()<misfire){agent.sp-=cost;agent.cooldowns[spec.effectId]=Number(spec.cooldown||0);lines.push({text:`ACTION: ${actor.name}'s ${spec.text.split(' — ')[0]} misfires due to disorder!`,kind:'status'});return true;}
 agent.sp-=cost; 
 const baseCd = Number(spec.cooldown || 0); 
 agent.cooldowns[spec.effectId]=(baseCd > 0 ? baseCd + 1 : 0)+Number(agent._cooldownPenalty||0);agent._lastAbility=spec.effectId; if(state){state._abilityHistoryByUnit=state._abilityHistoryByUnit||{};(state._abilityHistoryByUnit[actor.id]=state._abilityHistoryByUnit[actor.id]||[]).push({spec:cloneE(spec),round:state.currentRound||1});}
 const effects=abilityEffects(spec), allies=sameSideOf(actor,state), targets=targetsForEffects(spec,actor,enemy,state);
 lines.push({text:`ACTION: ${actor.name} casts [${spec.text.split(' — ')[0]}] (Cost: ${cost} SP | ${spec.cooldown||0}-Turn CD).`,kind:'action'});
    emitCombatEvent(state, {
      round: state?.currentRound || 1,
      type: 'cast',
      actorId: actor.id,
      actorName: actor.name,
      actorTeam: teamOf(actor, state),
      ability: spec.text.split(' — ')[0],
      costSP: cost,
      cooldown: spec.cooldown || 0
    });
 for(const e of effects){
  const tgs=e.type==='buff'||e.type==='heal'||e.type==='cleanse'||e.type==='shield'||e.type==='revive'?[actor]:targets;
  if(e.type==='strip_buffs'||e.type==='nullify_buffs')for(const t of targets){removeFxCat(t,'buff');t.buffs=[];removeStatus(t,'guarded');removeStatus(t,'evade');if((t.shield||0)>0){lines.push({text:`${t.name}'s barrier (${t.shield} HP shield) is stripped away!`,kind:'status'});t.shield=0;}}
  else if(e.type==='cleanse'){for(const t of tgs){const removed=[];for(const st of [...(t.status||[])])if(['burn','bleed','poison','curse','silenced','confused','sleep','stunned','frozen','freeze','bound'].includes(st)){removeStatus(t,st);removed.push(st);}if(removed.length)lines.push({text:`${t.name} cleanses: ${removed.join(', ')}.`,kind:'status'});}}
  else if(e.type==='shield')for(const t of tgs){if(hasStatus(t,'no_shield')||hasStatus(t,'no_heal'))continue;const amount=e.fullHp?t.maxHp:Math.round(t.maxHp*Number(e.maxHpRatio||0));t.shield=Math.max(t.shield||0,amount);lines.push({text:`${t.name} gains a ${amount} HP shield.`,kind:'status'});emitCombatEvent(state,{round:state?.currentRound||1,type:'shield',actorId:actor.id,actorName:actor.name,actorTeam:teamOf(actor,state),targetId:t.id,targetName:t.name,targetTeam:teamOf(t,state),amount:amount});}
  else if(e.type==='heal')for(const t of tgs){if(hasStatus(t,'no_heal'))continue;const amount=Math.round(t.maxHp*Number(e.maxHpRatio||0)+(e.scaling==='INT'?agent.stats.int*Number(e.multiplier||0):0));if(amount>0){const beforeHp=t.hp;t.hp=Math.min(t.maxHp,t.hp+amount);const restored=t.hp-beforeHp;lines.push({text:`${t.name} recovers ${restored} HP (${t.hp}/${t.maxHp}).`,kind:'status'});emitCombatEvent(state,{round:state?.currentRound||1,type:'heal',actorId:actor.id,actorName:actor.name,actorTeam:teamOf(actor,state),targetId:t.id,targetName:t.name,targetTeam:teamOf(t,state),amount:restored,hpAfter:t.hp,maxHp:t.maxHp});}}
  else if(e.type==='buff')for(const t of tgs){const d=fxDuration(e,'buff'),m=1+Number(e.amount||0);if(e.stat==='all'){for(const k of ['atk','def','int'])addFx(t,'buff',k,m,d);}else addFx(t,'buff',e.stat,m,d);emitCombatEvent(state,{round:state?.currentRound||1,type:'status',actorId:actor.id,actorName:actor.name,actorTeam:teamOf(actor,state),targetId:t.id,targetName:t.name,targetTeam:teamOf(t,state),text:`${t.name} gains +${Math.round((m-1)*100)}% ${e.stat.toUpperCase()} for ${d} round(s)`});}
  else if(e.type==='debuff')for(const t of targets){const d=fxDuration(e,'debuff'),m=1-Number(e.amount||0);if(e.stat==='speed')addFx(t,'speed_debuff','speed',m,d);else if(e.stat==='outgoing')addFx(t,'outgoing','outgoing',m,d);else addFx(t,'debuff',e.stat,m,d);emitCombatEvent(state,{round:state?.currentRound||1,type:'status',actorId:actor.id,actorName:actor.name,actorTeam:teamOf(actor,state),targetId:t.id,targetName:t.name,targetTeam:teamOf(t,state),text:`${t.name} suffers -${Math.round((1-m)*100)}% ${e.stat.toUpperCase()} for ${d} round(s)`});}
  else if(e.type==='status'){const selfSt=SELF_STATUSES.includes(e.status);for(const t of (selfSt?[actor]:targets))if(t.alive){const mental=['sleep','silenced','confused','charmed','stunned','bound','dreambound','controlled','fear','illusion'].includes(e.status);const resist=(mental&&!selfSt)?Number(combatRates(t.agent||t).resistance||0):0;if((e.chance==null||r()<Number(e.chance))&&r()>=resist&&r()>=(selfSt?0:statusResistChance(t,e.status))){if(e.status==='sleep')t._sleepAppliedThisAction=true;if(e.status==='banished'){const skipTurns=(!t._actedThisRound)?2:1;t._skipTurns=skipTurns;addStatus(t,'untargetable',skipTurns,actor.name);addStatus(t,'banished',skipTurns,actor.name);lines.push({text:`${t.name} is banished into a spatial fold for ${skipTurns} turn(s).`,kind:'status'});}else addStatus(t,e.status,Number(e.duration||1),actor.name,e.status==='evade'&&e.dodgeRate!==undefined?{dodgeRate:Number(e.dodgeRate)}:{});emitCombatEvent(state,{round:state?.currentRound||1,type:'status',actorId:actor.id,actorName:actor.name,actorTeam:teamOf(actor,state),targetId:t.id,targetName:t.name,targetTeam:teamOf(t,state),text:`${t.name} is afflicted with ${e.status} (${e.duration||1} round${Number(e.duration||1)===1?'':'s'})`});}}}
  else if(e.type==='status_pool'){for(const t of targets)if(t.alive){const pool=e.statuses||[];if(pool.length&&(e.chance==null||r()<Number(e.chance))){const st=pickR(r,pool);addStatus(t,st,Number(e.duration||1),actor.name);}}}
  else if(e.type==='status_chance'){for(const t of targets)if(t.alive){const mental=['sleep','silenced','confused','charmed','stunned','bound','dreambound','controlled','fear','illusion'].includes(e.status);const resist=mental?Number(combatRates(t.agent||t).resistance||0):0;if(r()<Number(e.chance||0)*(1-resist)*(1-statusResistChance(t,e.status)))addStatus(t,e.status,Number(e.duration||1),actor.name);}}
  else if(e.type==='skill_misfire'){const mTargets=foesOf(actor,state).filter(x=>x.alive);for(const t of mTargets){t._skillMisfireChance=Math.max(t._skillMisfireChance||0,Number(e.chance||.3));t._skillMisfireDuration=Math.max(t._skillMisfireDuration||0,Number(e.duration||2));lines.push({text:`${t.name} is afflicted by skill misfire (${Math.round(Number(e.chance||.3)*100)}% chance).`,kind:'status'});}}
  else if(e.type==='copy_ability'||spec.id==='combat_record'||spec.effectId==='combat_record'||spec.id==='spell_imitation'||spec.effectId==='spell_imitation'){
    const copied=getCopiedEnemyAbility(actor,enemy,state);
    const selfId = spec.id || spec.effectId;
    const copiedId = copied ? (copied.id || copied.effectId) : null;
    if(copied && copiedId && copiedId !== selfId){
      const copiedName = copied.name || (copied.text ? copied.text.split(' — ')[0] : 'enemy ability');
      lines.push({text:`${actor.name} reproduces [${copiedName}]!`,kind:'action'});
      emitCombatEvent(state,{
        round: state?.currentRound || 1,
        type: 'status',
        actorId: actor.id,
        actorName: actor.name,
        actorTeam: teamOf(actor, state),
        targetId: enemy.id,
        targetName: enemy.name,
        targetTeam: teamOf(enemy, state),
        text: `${actor.name} reproduces [${copiedName}]!`
      });
      const cEffs=abilityEffects(copied);
      for(const ce of cEffs){
        if(ce.type!=='copy_ability'&&!effects.some(x=>x.type===ce.type&&x.stat===ce.stat&&x.status===ce.status))effects.push(ce);
      }
      if(copied.damage){
        spec.damage = cloneE(copied.damage);
      }
      if(!(spec.damage?.multiplier||spec.scale>0)&&(copied.scale||copied.damage?.multiplier)){
        spec.scale=copied.scale||copied.damage?.multiplier;
        if(!spec.stat)spec.stat=copied.stat||'INT';
        if(!spec.damageType)spec.damageType=copied.damageType||'magic';
      }
    }
  }
  else if(e.type==='mind_control'){const ally=foesOf(actor,state).find(x=>x!==enemy&&x.alive);if(ally){const dmg=Math.max(1,Math.round((enemy.atk||enemy.agent?.stats?.atk||10)*Number(e.damageMultiplier||1.5)));lines.push({text:`${enemy.name} turns its own power against ${ally.name} for ${dmg} damage.`,kind:'quirk'});resolveIncoming(enemy,ally,dmg,state,lines,r);if(ally.hp<=0){ally.hp=0;ally.alive=false;}}addStatus(enemy,'stunned',1,actor.name);}
  else if(e.type==='reflect'){{const d=fxDuration(e,'reflect');actor._reflect={mode:e.mode==='stat'?'stat':'share',stat:String(e.stat||'INT').toUpperCase(),multiplier:Number(e.multiplier||0),share:Number(e.share||0),element:e.element||'physical',negate:!!e.negate,untilTurn:d==='next_turn',rounds:d==='next_turn'?0:Number(d)};lines.push({text:`${actor.name} is wrapped in a reflecting ward${e.negate?' that negates incoming damage':''} ${d==='next_turn'?'until their next turn':'for '+Number(d)+' rounds'}.`,kind:'status'});}}
  else if(e.type==='taunt'){const d=fxDuration(e,'taunt');if(d==='next_turn')actor._tauntUntilTurn=true;else actor._taunt=Math.max(actor._taunt||0,Number(d));lines.push({text:`${actor.name} taunts the enemy ${d==='next_turn'?'until their next turn':'for '+Number(d)+' rounds'}.`,kind:'status'});}
  else if(e.type==='sp_siphon'){
    const drainAmt=Number(e.amount||0);
    let totalSiphoned=0;
    for(const t of targets){
      if(!t.alive)continue;
      const tAgent=t.agent||t;
      if(tAgent.sp!==undefined)tAgent.sp=Math.max(0,(tAgent.sp||0)-drainAmt);
      t.sp=Math.max(0,(t.sp||0)-drainAmt);
      totalSiphoned+=drainAmt;
    }
    agent.sp=Math.min(agent.maxSP||99999,(agent.sp||0)+totalSiphoned);
    if(actor!==agent&&actor)actor.sp=agent.sp;
    lines.push({text:`${actor.name} siphons ${totalSiphoned} SP from enemies.`,kind:'status'});
  }
  else if(e.type==='sp_drain')for(const t of targets)t.sp=Math.max(0,(t.sp||0)-Number(e.amount||0));
  else if(e.type==='sp_cost_increase')for(const t of targets){t._spCostMultiplier=Math.max(t._spCostMultiplier||0,Number(e.amount||0));t._spCostDuration=Number(e.duration||1);}
  else if(e.type==='cooldown_increase')for(const t of targets){t._cooldownPenalty=Math.max(t._cooldownPenalty||0,Number(e.amount||0));t._cooldownDuration=Number(e.duration||1);}
  else if(e.type==='steal_stat')for(const t of targets){const stat=e.stat,amount=Number(e.amount||0);if(stat==='hp'){const hp=Math.round(t.maxHp*amount);t.hp=Math.max(1,t.hp-hp);actor.hp=Math.min(actor.maxHp,actor.hp+hp);emitCombatEvent(state,{round:state?.currentRound||1,type:'damage',actorId:actor.id,actorName:actor.name,actorTeam:teamOf(actor,state),targetId:t.id,targetName:t.name,targetTeam:teamOf(t,state),amount:hp,damageType:'physical',hpAfter:t.hp,maxHp:t.maxHp});emitCombatEvent(state,{round:state?.currentRound||1,type:'heal',actorId:actor.id,actorName:actor.name,actorTeam:teamOf(actor,state),targetId:actor.id,targetName:actor.name,targetTeam:teamOf(actor,state),amount:hp,hpAfter:actor.hp,maxHp:actor.maxHp});}else if(['atk','def','int'].includes(stat)){const d=fxDuration(e,'steal_stat');addFx(t,'debuff',stat,1-amount,d);addFx(actor,'buff',stat,1+amount,d);emitCombatEvent(state,{round:state?.currentRound||1,type:'status',actorId:actor.id,actorName:actor.name,actorTeam:teamOf(actor,state),targetId:t.id,targetName:t.name,targetTeam:teamOf(t,state),text:`Steals ${Math.round(amount*100)}% ${stat.toUpperCase()} from ${t.name} for ${d} round(s)`});}}
  else if(e.type==='revive'){if(e.self)agent._revivePending=true;else{const dead=allies.find(x=>!x.alive);if(dead){dead.alive=true;dead.inCombat=true;dead.hp=Math.round(dead.maxHp*Number(e.hpRatio||.25));}}}
  else if(e.type==='transfer_debuffs'){const NEG=['burn','bleed','poison','curse','silenced','confused','sleep','stunned','frozen','freeze','bound','dreambound','controlled','root','no_heal','no_shield'];const team=(state.allies||[]).includes(actor)?state.allies:state.enemies;const moved=[],statuses=new Set();
   for(const al of team){if(!al.alive)continue;const keep=[];for(const f of al._fx||[]){if(f.cat==='debuff'||f.cat==='speed_debuff')moved.push(f);else keep.push(f);}al._fx=keep;recomputeFx(al);for(const st of [...(al.status||[])])if(NEG.includes(st)){statuses.add(st);removeStatus(al,st);}}
   for(const t of targets){for(const f of moved)addFx(t,f.cat,f.key,f.val,f.turn?'next_turn':f.rounds);for(const st of statuses)addStatus(t,st,1,actor.name);}}
  else if(e.type==='targeting'||e.type==='damage_rule'||e.type==='crit_bonus'||e.type==='damage_taken'||e.type==='damageTaken'||e.type==='outgoing_damage'||e.type==='damage_stat_bonus'||e.type==='low_hp_bonus'||e.type==='next_damage_bonus'||e.type==='heal_damage_ratio'||e.type==='dodge'||e.type==='crit'||e.type==='critDamage'||e.type==='initiative'||e.type==='counter'||e.type==='lifesteal'||e.type==='hitChance'||e.type==='resistance'||e.type==='defPen'||e.type==='defense_penetration'||e.type==='execute'||e.type==='vulnerability'||e.type==='vulnerability_if_buffed'||e.type==='vulnerability_vs_corrupted'||e.type==='next_attack_miss'||e.type==='next_crit_fail'||e.type==='extra_turn'||e.type==='cooldown_increase'||e.type==='knockback'||e.type==='movement_block'||e.type==='no_heal'||e.type==='no_shield'||e.type==='form'||e.type==='copy_highest'||e.type==='transfer_debuffs'||e.type==='free_strike'||e.type==='revive'||e.type==='skill_misfire'||e.type==='reset_state'||e.type==='debuff_hit'){
    // These are handled below or persisted as a combat state effect.
    if(e.type==='extra_turn')actor._extraTurns=(actor._extraTurns||0)+Number(e.amount||1);
    if(e.type==='reset_state'){actor.hp=Math.max(1,Math.min(actor.maxHp,actor.hp));removeFxCat(actor,'buff');agent.cooldowns={};lines.push({text:`${actor.name} resets their current combat state.`,kind:'quirk'});}
    if(e.type==='next_attack_miss')for(const t of targets)t._nextAttackMiss=Number(e.chance||1);
    if(e.type==='next_crit_fail')for(const t of targets)t._nextCritFail=Number(e.chance||1);
    if(e.type==='knockback')for(const t of targets)t.distance=Math.min(60,(t.distance||5)+Number(e.amount||1)*3);
    if(e.type==='movement_block')for(const t of targets)addStatus(t,'root',Number(e.duration||1),actor.name);
    if(e.type==='no_heal')for(const t of targets)addStatus(t,'no_heal',Number(e.duration||1),actor.name);if(e.type==='no_shield')for(const t of targets)addStatus(t,'no_shield',Number(e.duration||1),actor.name);
    if(e.type==='vulnerability')for(const t of targets)addFx(t,'vuln','vuln',1+Number(e.amount||0),fxDuration(e,'vulnerability'));
    if(e.type==='vulnerability_if_buffed')for(const t of targets)if(Object.keys(t._buffs||{}).length)addFx(t,'vuln','vuln',1+Number(e.amount||0),fxDuration(e,'vulnerability'));
    if(e.type==='vulnerability_vs_corrupted')for(const t of targets)if((t.corruption||0)>0||t.trait==='Madness Prone'||hasStatus(t,'corruption'))addFx(t,'vuln','vuln',1+Number(e.amount||0),fxDuration(e,'vulnerability'));
    if(e.type==='damage_taken'||e.type==='damageTaken')addFx(actor,'dtm','dtm',1+Number(e.amount||0),fxDuration(e,'damage_taken'));
    if(e.type==='outgoing_damage')addFx(actor,'outgoing','outgoing',1+Number(e.amount||0),fxDuration(e,'outgoing_damage'));
    if(e.type==='damage_stat_bonus')agent._damageStatBonus=(agent._damageStatBonus||1)+Number(e.amount||0);
    if(e.type==='counter')addFx(actor,'counter','counter',Number(e.amount||0),fxDuration(e,'counter'));
    if(e.type==='defense_penetration'&&!((spec.damage?.multiplier||spec.scale||0)>0)&&!abilityEffects(spec).some(z=>z.type==='damage_component'))addFx(actor,'defpen','defpen',Number(e.amount||0),fxDuration(e,'defense_penetration'));
    if(e.type==='dodge')addFx(actor,'dodge','dodge',Number(e.amount||0),fxDuration(e,'dodge'));
    if(e.type==='low_hp_bonus')agent._lowHpBonus=Number(e.amount||0);
    if(e.type==='next_damage_bonus')agent._nextDamageBonus=Number(e.amount||0);
    if(e.type==='heal_damage_ratio')agent._healDamageRatio=Number(e.amount||0);
    if(e.type==='crit_bonus')agent._abilityCritDamageBonus=(agent._abilityCritDamageBonus||0)+Number(e.amount||0);
    if(e.type==='debuff_hit')for(const t of targets){t._hitChanceDebuff=Math.max(t._hitChanceDebuff||0,Number(e.amount||0));t._hitChanceDebuffDuration=Number(e.duration||1);}
    if(e.type==='cooldown_increase')for(const t of targets)t._cooldownPenalty=Number(e.amount||0);
  }
 }
 let didDamage=false,totalDamage=0;
 const damageRule=effects.find(e=>e.type==='damage_rule');
 const trueDamage=damageRule?.rule==='true', psychicTrue=damageRule?.rule==='psychic_true';
 const componentEffects=effects.filter(e=>e.type==='damage_component');
 const effectiveDamageSpec=componentEffects.length?{...(spec.damage||{}),components:componentEffects.map(e=>({stat:e.stat,multiplier:Number(e.multiplier||0)}))}:(spec.damage||null);
 if((effectiveDamageSpec?.multiplier||spec.scale||0)>0 || componentEffects.length){for(const t of targets){if(!t.alive)continue;let mult=spec.damage?.multiplier||spec.scale||0;const baseAbilityMultiplier=mult;const effectContributions=[];const statBonus=effects.find(e=>e.type==='damage_stat_bonus');if(statBonus&&statBonus.stat==='INT'){const f=1+Number(statBonus.amount||0);mult*=f;effectContributions.push({type:'damage_stat_bonus',amount:Number(statBonus.amount||0),multiplier:f});}if(agent._damageStatBonus){const f=agent._damageStatBonus;mult*=f;effectContributions.push({type:'passive_damage_stat_bonus',multiplier:f});}if(agent._lowHpBonus&&actor.hp/actor.maxHp<.5){const f=1+agent._lowHpBonus;mult*=f;effectContributions.push({type:'low_hp_bonus',amount:agent._lowHpBonus,multiplier:f});}if(agent._nextDamageBonus){const f=1+agent._nextDamageBonus;mult*=f;effectContributions.push({type:'next_damage_bonus',amount:agent._nextDamageBonus,multiplier:f});agent._nextDamageBonus=0;}const trace={round:state.currentRound||0,attacker:actor.name,target:t.name,ability:spec.text?.split(' — ')[0]||spec.name||spec.id,abilityId:spec.id||spec.effectId,stat:spec.damage?.scaling||spec.stat||'INT',abilityMultiplier:baseAbilityMultiplier,effectiveMultiplier:mult,effectContributions,damageType:effectiveDamageSpec?.element||effectiveDamageSpec?.type||spec.damageType||'physical'};let dmg=v15Damage(effectiveDamageSpec?.formula||spec.formula||(spec.stat==='ATK'?'empowered_hybrid_physical':'pure_caster_ability'),{agent,actor,target:t,abilityMult:mult,defPen:defPen(spec,effects),trueDamage,psychicTrue,damageSpec:{...(effectiveDamageSpec||{}),type:(effectiveDamageSpec?.type||'physical'),element:(effectiveDamageSpec?.element||'physical')},trace});const prePostEffects=dmg;const vuln=t._vulnerability||1;if(vuln!==1){dmg=Math.round(dmg*vuln);trace.effectContributions.push({type:'vulnerability',multiplier:vuln});}const ex=effects.find(e=>e.type==='execute');if(ex&&t.hp/t.maxHp<Number(ex.threshold||0)){dmg=Math.max(dmg,t.hp+(t.shield||0));trace.effectContributions.push({type:'execute',instantKill:true});lines.push({text:`EXECUTE: ${t.name} is instantly executed!`,kind:'quirk'});}const critBonus=Number(agent._abilityCritDamageBonus||0)+effects.filter(e=>e.type==='critDamage').reduce((n,e)=>n+Number(e.amount||0),0);const rates=combatRates(agent,actor);let critChance=Math.min(.95,rates.crit);if(effects.some(e=>e.type==='crit'))critChance+=effectAmount(spec,'crit');if(t._nextCritFail){critChance=0;t._nextCritFail=0;}let critical=false;if(r()<Math.min(.95,critChance)){critical=true;const f=1+rates.critDamage+critBonus;dmg=Math.round(dmg*f);trace.effectContributions.push({type:'critical',multiplier:f});}trace.final=dmg;trace.critical=critical;trace.critBonus=critBonus;trace.critChance=Math.min(.95,critChance);state.balanceTrace.push(trace);if(hasStatus(t,'sleep')&&!t._sleepAppliedThisAction){handleSleepWake(t,lines);}const tk=resolveIncoming(actor,t,dmg,state,lines,r,{damageType:effectiveDamageSpec?.element||effectiveDamageSpec?.type||spec.damageType||'physical'});didDamage=true;totalDamage+=tk.hpLoss+tk.absorbed;const finalDamage=tk.hpLoss+tk.absorbed;lines.push({text:`IMPACT: ${spec.damage?.element||spec.damage?.type||'physical'} damage ${finalDamage} to ${t.name}${critical?' critical':''}${trueDamage?' (TRUE DAMAGE)':''}.`,kind:'damage'});
 emitCombatEvent(state, {
   round: state?.currentRound || 1,
   type: 'damage',
   actorId: actor.id,
   actorName: actor.name,
   actorTeam: teamOf(actor, state),
   targetId: t.id,
   targetName: t.name,
   targetTeam: teamOf(t, state),
   amount: finalDamage,
   damageType: spec.damage?.element || spec.damage?.type || spec.damageType || 'physical',
   critical: critical,
   trueDamage: trueDamage || psychicTrue,
   instantKill: !!(ex && t.hp <= 0),
   hpAfter: t.hp,
   maxHp: t.maxHp
 });
 if(t.hp<=0){
   t.hp=0;
   t.alive=false;
   lines.push({text:`${t.name} falls.`,kind:'victory'});
   emitCombatEvent(state, {
     round: state?.currentRound || 1,
     type: 'death',
     actorId: actor.id,
     actorName: actor.name,
     actorTeam: teamOf(actor, state),
     targetId: t.id,
     targetName: t.name,
     targetTeam: teamOf(t, state),
     text: `${t.name} falls.`
   });
   tryRevive(t,lines,state);
 }}}
 const healRatio=effects.filter(e=>e.type==='heal_damage_ratio').reduce((n,e)=>n+Number(e.amount||0),0); if(healRatio>0&&didDamage&&!hasStatus(actor,'no_heal'))actor.hp=Math.min(actor.maxHp,actor.hp+Math.round(totalDamage*healRatio));
 const abilityLifeSteal=effects.filter(e=>e.type==='lifesteal').reduce((n,e)=>n+Number(e.ratio||e.amount||0),0)+Number(traitData(agent).lifesteal||0); if(abilityLifeSteal>0&&didDamage&&!hasStatus(actor,'no_heal'))actor.hp=Math.min(actor.maxHp,actor.hp+Math.round(totalDamage*abilityLifeSteal));
 agent._lowHpBonus=0;agent._abilityCritDamageBonus=0;for(const t of (targets||[]))delete t._sleepAppliedThisAction;
 for(const u of new Set([actor,...(targets||[])]))syncUnitToAgent(u);
 return true;
}
function syncUnitToAgent(u){if(u&&u.agent&&u.agent!==u){for(const k of ['_buffs','_speedDebuff','_spCostMultiplier','_cooldownPenalty','_dodgeBonus','_counterBonus'])u.agent[k]=u[k];}}
function defPen(spec,effects){return effects.filter(e=>e.type==='defPen'||e.type==='defense_penetration').reduce((n,e)=>n+Number(e.amount||0),0);}
function powerEffect(a,actor,enemy,state,lines,r){
  ensureCombatResource(a); a._hpRatio=actor.hp/Math.max(1,actor.maxHp); tryMythicalForm(a,actor,state,lines,r);
  if(a.path==='fool'&&a.sequence<=5&&!hasStatus(actor,'silenced')&&!hasStatus(a,'silenced')&&abilityAvailable(a,'thread_binding')){
    const threadSpec = unlockedAbilities(a).find(x => x.effectId === 'thread_binding' || x.id === 'thread_binding');
    const threadCost = Number(threadSpec?.costSP ?? 45);
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
  attackOnce(a,actor,enemy,state,lines,r,(a._formBoost||1));
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

function tickCombatEffectDurations(units){for(const u of units){if((u._taunt||0)>0)u._taunt--;tickFx(u);if((u._spCostDuration||0)>0&&--u._spCostDuration<=0){u._spCostMultiplier=0;}if((u._cooldownDuration||0)>0&&--u._cooldownDuration<=0){u._cooldownPenalty=0;}if((u._hitChanceDebuffDuration||0)>0&&--u._hitChanceDebuffDuration<=0){u._hitChanceDebuff=0;}if((u._skillMisfireDuration||0)>0&&--u._skillMisfireDuration<=0){u._skillMisfireChance=0;}syncUnitToAgent(u);}}

function resolveQuest(members,quest,seed=Date.now(),decisions={}){
 const r=rand(seed),lines=[],consequences=[],allies=members.map(a=>{const es=effectiveStats(a);const ag=cloneE(a); const pm=passiveCombatModifier(ag); ag.resistances={...(G9D.balance.element_resistance_rules?.path_resistances?.[ag.path]||{}),...(pm.resistances||{}),...(ag.resistances||{})}; return {id:a.id,name:a.name,agent:ag,hp:Math.round(es.hp*(pm.hp||1)),maxHp:Math.round(es.hp*(pm.hp||1)),alive:true,inCombat:true,status:[],statusMeta:{},resistances:ag.resistances};});
 const simulationOpponents=Array.isArray(decisions.simulationOpponents)?decisions.simulationOpponents:null; const enemyCount=simulationOpponents?.length || quest.enemyCount|| (allies.length===1?1:(allies.length>=3 && quest.difficultySequence>=7?2:(quest.difficultySequence>=5?2:3))); const enemies=quest.encounter?(simulationOpponents?simulationOpponents.map((spec,i)=>makeEnemy(spec.sequence,r,i,spec.path)):Array.from({length:enemyCount},(_,i)=>makeEnemy(quest.difficultySequence,r,i,quest.requiredPath))):[];
 for(const e of enemies){try{const epm=passiveCombatModifier(e);if(epm.hp&&epm.hp!==1){e.maxHp=Math.round(e.maxHp*epm.hp);e.hp=e.maxHp;}}catch(err){}}
 const individual=!!decisions.individual; const state={allies,enemies,individual,createdMarionettes:[],battleMarionettes:[],rng:r,weaponUsage:{},combatStatsShown:false,balanceTrace:[],events:[]};
 lines.push({text:`Contract: ${quest.name}`,kind:'system'},{text:quest.story||quest.brief,kind:'story'});
 if(!quest.encounter){
   if(quest.objective==='rescue'){lines.push({text:'The guild searches the neighborhood rather than hunting for a fight. Clues lead through an alley, beneath a bakery awning, and into a coal shed.',kind:'system'},{text:'The missing cat is found frightened but unharmed and returned to its owner.',kind:'victory'});}
   else {lines.push({text:'The party works through interviews, records and ordinary observation. No hostile confrontation is necessary.',kind:'victory'});}
   const complication=r()<(quest.mundane?.08:.03); const success=!complication;
   for(const u of allies){const a=u.agent;const gain=digestGain(quest,individual,a);a.digest=Math.min(100,(a.digest||0)+gain);
   const equipped=weaponFor(a); gainWeaponMastery(a,equipped.kind,G9D.system.weapon_mastery.per_completed_contract||2);
   changeMeter(a,a.path,3);consequences.push({type:'syncAgent',agentId:a.id,agent:a,text:`${a.name} digests ${gain}% of the current potion.`});}
   if(complication){lines.push({text:'A complication delays the work: a witness gives a false statement and the guild loses time.',kind:'status'});for(const u of allies)consequences.push({type:'injury',agentId:u.id,amount:4,text:'A mundane contract complication caused a minor injury.'});}
   return {lines,success,consequences,marionettes:[],rewards:{...quest.rewards,reputation:success?quest.rewards.reputation:0},weaponUsage:state.weaponUsage,dayCost:quest.dayCost};
 }
 lines.push({text:`Threat: ${quest.difficultySequence===10?'Ordinary Human':`Sequence ${quest.difficultySequence}`}. ${enemies.length} hostile unit(s) emerge.`,kind:'system'});
 for(const e of enemies)lines.push({text:`${e.name} — ${e.sequence===10?`Ordinary Human · ${e.occupation}`:`${pathOf(e.path).name} · Sequence ${e.sequence}`}.`,kind:'system'});
 applyPartyPassiveEffects(allies);


 for(const a of allies)lines.push({text:`${a.name} — ${a.agent.path?`${pathOf(a.agent.path).name} · Sequence ${a.agent.sequence}`:'Unawakened'}.`,kind:'system'});
 let round=0;
 while(allies.some(x=>x.alive)&&enemies.some(x=>x.alive)&&round<15){round++;state.currentRound=round;startRoundCombatResources([...allies,...enemies],lines);lines.push({text:`· Round ${round} ·`,kind:'system'}); emitCombatEvent(state, {round, type: 'round_start'});
   for (const u of [...allies, ...enemies]) u._actedThisRound = false;                                                                
   const initiativeLine=[...allies.filter(x=>x.alive),...enemies.filter(x=>x.alive)].sort((a,b)=>{const sa=unitInitiative(a);const sb=unitInitiative(b);return sb-sa;}).map(x=>`${x.name} ${unitInitiative(x).toFixed(1)}`).join(' → '); lines.push({text:`Initiative: ${initiativeLine}`,kind:'system'}); emitCombatEvent(state, {round, type: 'system', subtype: 'initiative', details: initiativeLine, text: `Initiative: ${initiativeLine}`});
   processSpiritThreads(state,lines);                                                                 
   for(const unit of [...allies,...enemies]){processStatuses(unit,t=>lines.push({text:t,kind:'status'}));if(unit.alive)tryMythicalForm(unit.agent||unit,unit,state,lines,r);}
   tickCombatEffectDurations([...allies,...enemies]);applyPassiveAuras([...allies,...enemies],state);
   const order=[...allies.filter(x=>x.alive),...enemies.filter(x=>x.alive)].sort((a,b)=>unitInitiative(b)-unitInitiative(a));
   const actors=order;
   for(const c of actors){try{if(!c.alive||c.inCombat===false)continue;beginTurn(c);c._actedThisRound = true;
       if(c._skipTurns>0||hasStatus(c,'banished')){if(c._skipTurns>0)c._skipTurns--;lines.push({text:`${c.name} is banished in a spatial fold and cannot act.`,kind:'status'});if(!c._skipTurns||c._skipTurns<=0){removeStatus(c,'banished');removeStatus(c,'untargetable');}continue;}
       if(c.agent){const pressure=0;
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
       if(c.thread&&c.thread.progress>=4&&r()<0.30){addStatus(c,'bound',1,'Spirit Body Thread');}if(hasStatus(c,'fear')&&r()<.35){lines.push({text:`${c.name} loses this action to a status effect.`,kind:'status'});continue;}const isConfused=hasStatus(c,'confused')&&r()<0.50;if(isConfused)lines.push({text:`${c.name} is Confused and targets an ally!`,kind:'status'});const targetPool=isConfused?allies.filter(a=>a.alive):enemies.filter(e=>e.alive);if(!targetPool.length)break;const enemy=pickR(r,tauntFilter(c,(()=>{const ok=targetPool.filter(x=>!hasStatus(x,'untargetable'));return ok.length?ok:targetPool;})()));if(!state.combatStatsShown)state.combatStatsShown={};if(!state.combatStatsShown[enemy.id]){lines.push({text:`Combat begins: ${enemy.name} · HP ${enemy.maxHp} · ATK ${enemy.atk} · DEF ${enemy.def} · INT ${enemy.int} · Speed ${speedFor(enemy).toFixed(1)} · AV ${actionValueFor(enemy).toFixed(1)}.`,kind:'system'});state.combatStatsShown[enemy.id]=true;}powerEffect(c.agent,c,enemy,state,lines,r); if(c._extraTurns>0&&c.alive){c._extraTurns--;powerEffect(c.agent,c,enemy,state,lines,r);}}
     else {const isConfused=hasStatus(c,'confused')&&r()<0.50;if(isConfused)lines.push({text:`${c.name} is Confused and targets an ally!`,kind:'status'});const targets=(isConfused?enemies:allies).filter(x=>x.alive&&x.inCombat);if(!targets.length)break;if(actionDisabled(c)){
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
       if(c.thread&&c.thread.progress>=4&&r()<0.30){addStatus(c,'bound',1,'Spirit Body Thread');}
       const safer=targets.filter(x=>x.hp/x.maxHp>.25);const pool=(safer.length?safer:targets);const okp=pool.filter(x=>!hasStatus(x,'untargetable'));const t=pickR(r,tauntFilter(c,okp.length?okp:pool));
       const enemyAgent={...c,stats:{hp:c.maxHp,atk:c.atk,def:c.def,int:c.int},baseStats:{hp:c.maxHp,atk:c.atk,def:c.def,int:c.int},abilities:c.abilities||[],abilityHistory:c.abilityHistory||[],weaponId:c.weaponId||'none',weaponMastery:c.weaponMastery||{},cooldowns:c.cooldowns||{},resistances:{...(c.resistances||{}),...(passiveCombatModifier(c).resistances||{})},_outgoingMultiplier:(state.individual?COMBAT_BALANCE.enemyDamageIndividual:COMBAT_BALANCE.enemyDamageParty)};
       if(!state.combatStatsShown)state.combatStatsShown={};if(!state.combatStatsShown[c.id]){lines.push({text:`Combat begins: ${c.name} · HP ${c.maxHp} · ATK ${c.atk} · DEF ${c.def} · INT ${c.int} · Speed ${speedFor(c).toFixed(1)} · AV ${actionValueFor(c).toFixed(1)}.`,kind:'system'});state.combatStatsShown[c.id]=true;}const before=t.hp; powerEffect(enemyAgent,c,t,state,lines,r); if(c._extraTurns>0&&c.alive){c._extraTurns--;powerEffect(enemyAgent,c,t,state,lines,r);} c.atk=enemyAgent.stats.atk; c.def=enemyAgent.stats.def; c.int=enemyAgent.stats.int; c.cooldowns=enemyAgent.cooldowns||{}; c.resistances=enemyAgent.resistances||{}; if(isThreadBeyonder(enemyAgent)){c.threadTargets=enemyAgent.threadTargets||[];c.activeThreads=c.threadTargets.length;c._threadAttempts=enemyAgent._threadAttempts||0;c.sp=enemyAgent.sp;c.maxSP=enemyAgent.maxSP;}
       if(t.hp>0&&t.hp<before){}

   }
   }finally{tickUnitStatuses(c);}
   }
 }
 const success=allies.some(x=>x.alive&&x.inCombat)&&!enemies.some(x=>x.alive); if(success)lines.push({text:'The hostile force is defeated and the guild completes the contract.',kind:'victory'});else lines.push({text:'The guild is defeated in the encounter.',kind:'failure'});
 for(const u of allies.filter(x=>!x.summoned)){const a=u.agent;const gain=digestGain(quest,individual,a);if(success){
  a.digest=Math.min(100,(a.digest||0)+gain);
  const equipped=weaponFor(a), masteryAmount=G9D.system.weapon_mastery.per_completed_contract||2;
  gainWeaponMastery(a,equipped.kind,masteryAmount);
}
a.injuries=Math.min(100,(a.injuries||0)+(u.alive?Math.max(0,Math.round((u.maxHp-u.hp)/u.maxHp*25)):30));a.madness=Math.max(0,Math.min(100,(a.madness||0)+(success?-3:12)));changeMeter(a,a.path,success?12:6);if(!u.alive){consequences.push({type:'death',agentId:a.id,text:`${a.name} dies during the contract and is removed from the roster.`});}else{consequences.push({type:'syncAgent',agentId:a.id,agent:a,text:success?`${a.name} returns with new experience and ${gain}% digestion.`:`${a.name} returns shaken from the failed contract.`});}if(a.madness>=100)consequences.push({type:'corruptedDeath',agentId:a.id,text:`${a.name} reaches 100 Madness and becomes a corrupted monster.`});}
 const rewards=cloneE(quest.rewards);if(!success){rewards.funds=Math.round(rewards.funds*.35);rewards.reputation=0;}
 return {lines,events:state.events||[],success,consequences,marionettes:[],marionettesCreated:(state.battleMarionettes||[]).filter(m=>m.side==='ally').length,enemyMarionettesCreated:(state.battleMarionettes||[]).filter(m=>m.side==='enemy').length,weaponUsage:state.weaponUsage,rewards,dayCost:1,battleSnapshot:{allies:allies.map(x=>({name:x.name,alive:x.alive,hp:x.hp,maxHp:x.maxHp})),enemies:enemies.map(x=>({name:x.name,alive:x.alive,hp:x.hp,maxHp:x.maxHp})),balanceTrace:state.balanceTrace,events:state.events||[]}};
}
