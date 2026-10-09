// Every shipped rank is exercised in an isolated battle on both teams.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const gameRoot = process.env.PHASE3_GAME_ROOT || path.join(__dirname, '..');
const g = require(path.join(gameRoot, 'js/node-loader.js'));
assert.equal(typeof g.abilityDescription, 'function', 'Phase3 requires the live abilityDescription API');
assert.equal(typeof g.abilityDamageText, 'function', 'Phase3 requires the live abilityDamageText API');
const {world, expectedDamage, independentModifiers, exercisePassive} = require('./phase3-test-helpers.js');
const balance = JSON.parse(fs.readFileSync(path.join(gameRoot, 'data/balance.json'), 'utf8'));
const formulas = JSON.parse(fs.readFileSync(path.join(gameRoot, 'data/formulas.json'), 'utf8'));
const authored = Object.fromEntries(g.PATH_KEYS.map(key => [key, JSON.parse(fs.readFileSync(path.join(gameRoot, `data/pathways/${key}.json`), 'utf8'))]));
const high = () => .99;
const deferred = new Set(['logic_distortion', 'parasitic_contagion']);
const coverage = [];
let current, failures = 0, diagnosticFailures = 0;
function check(value, message) { current.assertions++; assert(value, message); }
function equal(actual, expected, message) { current.assertions++; assert.equal(actual, expected, message); }
function near(actual, expected, message) { check(Math.abs(actual - expected) < 1e-8, `${message}: ${actual} vs ${expected}`); }
const percent = n => `${Number((Number(n) * 100).toFixed(8))}%`;
function tooltipNumber(text, value, label) {
  const points=value.endsWith('%') && text.includes(`${value.slice(0,-1)} percentage points`);
  const resource=value.endsWith(' SP') && text.includes(value.replace(' SP',' target SP'));
  check(text.includes(value)||points||resource, `tooltip must disclose ${label}: ${value}; ${text}`);
}
function duration(e) { return e.duration ?? balance.effect_durations?.[e.type] ?? 2; }
function tooltipDuration(text, d) {
  check(d === 'next_turn' ? /next (?:\w+ )?turn/i.test(text) : new RegExp(`\\b${d} (?:\\w+ )?(?:turn|action)`).test(text), `tooltip duration ${d}: ${text}`);
}
function expiry(unit, d, read, wanted, baseline, label) {
  near(read(unit), wanted, label);
  const copy = structuredClone(unit);
  if (d === 'next_turn') {
    g.tickCombatEffectDurations([copy]); near(read(copy), wanted, `${label} survives round-end`);
    g.beginTurn(copy); near(read(copy), baseline, `${label} expires at next turn start`);
  } else {
    for (let i = 1; i < d; i++) { g.tickCombatEffectDurations([copy]); near(read(copy), wanted, `${label} survives action ${i}`); }
    g.tickCombatEffectDurations([copy]); near(read(copy), baseline, `${label} expires after ${d} actions`);
  }
}
function statusExpiry(unit, status, d) {
  check(g.hasStatus(unit, status), `${status} applied`);
  equal(unit.statusMeta[status].duration, d, `${status} remaining actions`);
  const copy = structuredClone(unit);
  for (let i = 1; i < d; i++) { g.tickUnitStatuses(copy); check(g.hasStatus(copy, status), `${status} survives action ${i}`); }
  g.tickUnitStatuses(copy); check(!g.hasStatus(copy, status), `${status} expires after ${d} actions`);
}
function cast(w, spec, rng = high, actor = w.u, victim = w.v) {
  return g.applyStructuredAbility(actor.agent, actor, victim, w.state, [], rng, spec);
}
const shipped = (key, rank) => g.tierFor(key, rank).abilities[0];
function targets(w, spec) { return spec.effects.some(e => e.type === 'targeting' && e.mode === 'all_enemies') ? [w.v, w.other] : [w.v]; }
function temporaryBuff(w, unit) { cast(w, shipped('abyss', 3), high, unit, w.u); }
function prepare(w, spec) {
  w.u.hp = Math.round(w.u.maxHp * (spec.effects.some(e => e.type === 'low_hp_bonus') ? .4 : .6));
  w.ally.hp = Math.round(w.ally.maxHp * .6);
  for (const e of spec.effects) {
    if (['strip_buffs', 'nullify_buffs', 'vulnerability_if_buffed'].includes(e.type)) for (const t of targets(w, spec)) {
      temporaryBuff(w, t); g.addStatus(t, 'guarded', 2); g.addStatus(t, 'evade', 2, 'fixture', {dodgeRate:0});
      cast(w, shipped('fool', 3), high, t, w.u);
    }
    if (e.type === 'vulnerability_vs_corrupted') for (const t of targets(w, spec)) t.agent.corruption = 10;
    if (e.type === 'cleanse' || e.type === 'transfer_debuffs') {
      for (const t of e.type === 'transfer_debuffs' ? [w.u, w.ally] : [w.u]) {
        g.addStatus(t, 'burn', 3, 'fixture');
        cast(w, shipped('black_emperor', 7), high, w.v, t);
      }
    }
    if (e.type === 'reset_state') { temporaryBuff(w, w.u); w.a.cooldowns.old_skill = 3; }
    if (e.type === 'knockback') w.v.distance = 5;
  }
  if (spec.effects.some(e => e.type === 'copy_ability')) {
    // The source is witnessed through the real cast path, never injected history.
    check(cast(w, shipped('fool', 8), high, w.v, w.ally), 'enemy casts the copied skill');
  }
  w.state.events = []; w.state.balanceTrace = [];
}
function damageChecks(w, effectiveSpec, victimList, mult, critical = false) {
  const traces = w.state.balanceTrace.filter(t => t.abilityId === (effectiveSpec.id || effectiveSpec.effectId));
  equal(traces.length, victimList.length, 'one damage calculation per hit target');
  for (const [i, victim] of victimList.entries()) {
    const expected = expectedDamage(w.a, w.u, victim, effectiveSpec, {abilityMult:mult, critical});
    const formulaTarget={...victim,_vulnerability:undefined};
    equal(traces[i].final, expectedDamage(w.a,w.u,formulaTarget,effectiveSpec,{abilityMult:mult,critical}), 'independent stat/resistance/DEF calculation before incoming vulnerability');
    const event = w.state.events.filter(e => e.type === 'damage' && e.actorId === w.u.id && e.targetId === victim.id).at(-1);
    check(event, 'cast produces a damage event');
    equal(event.amount, expected, 'HP damage agrees with calculation');
    equal(event.actorTeam, current.team === 'allies' ? 'ally' : 'enemy', 'cast event belongs to caster team');
  }
}
function exerciseThread(w, spec, text) {
  const before = w.a.sp;
  check(g.powerEffect(w.a, w.u, w.v, w.state, [], high), 'Thread Binding uses shipped special powerEffect route');
  equal(before - w.a.sp, spec.costSP, 'actual thread SP cost');
  equal(w.a.cooldowns.thread_binding, 999, 'thread cooldown is locked while attached');
  equal(w.v.thread.required, 5, 'five progression ticks to conversion');
  tooltipNumber(text, '5', 'thread conversion stages');
  for (let stage = 1; stage <= 5; stage++) {
    g.processSpiritThreads(w.state, []);
    if (stage < 5) equal(w.v.thread.progress, stage, 'actual thread stage');
    if (stage === 1) near(w.v._threadSpeedDebuff, .15, 'first-stage speed loss');
    if (stage === 2) { near(w.v._threadDodgeDebuff, -.1, 'second-stage dodge loss'); near(w.v._threadHitDebuff, .1, 'second-stage miss chance'); }
  }
  check(!w.v.alive && w.v.hp === 0, 'fifth stage kills its victim');
  const puppet = w.state[current.team].find(u => u.summoned);
  check(puppet?.alive, 'Marionette joins the caster team');
  for (const stat of ['atk', 'def', 'int']) equal(puppet.stats[stat], Math.round(w.v.stats[stat] * .55), `Marionette ${stat} is 55% of victim`);
  equal(puppet.maxHp, Math.round(w.v.maxHp * .55), 'Marionette HP is 55% of victim');
  equal(w.a.cooldowns.thread_binding, spec.cooldown + 1, 'real cooldown begins at conversion');
  equal(w.state.createdMarionettes.length, 0, 'Marionette is battle-only');
}
function exerciseDeferred(key,rank,team) {
  const spec=shipped(key,rank),w=world(key,rank,team);w.u.hp=Math.round(w.u.maxHp*.6);
  const before={sp:w.a.sp,hp:w.u.hp,victimSP:w.v.sp,victimHP:w.v.hp,otherHP:w.other.hp};
  check(cast(w,spec),'Phase4 diagnostic executes the unchanged shipped ability');
  equal(before.sp-w.a.sp,spec.costSP,'diagnostic actual SP cost');
  if(spec.effectId==='logic_distortion') {
    const effect=spec.effects.find(e=>e.type==='mind_control');
    equal(before.otherHP-w.other.hp,Math.round(w.v.stats.atk*effect.damageMultiplier),'diagnostic compelled teammate strike');
    equal(w.v.hp,before.victimHP,'diagnostic selected victim is not struck');statusExpiry(w.v,'stunned',1);
    current.phase4Findings.push('Primary-skill redirection is absent; current cast strikes an enemy teammate at 150% base ATK and stuns the selected target for one action.');
  } else {
    const heal=spec.effects.find(e=>e.type==='heal'),drain=spec.effects.find(e=>e.type==='sp_drain');
    equal(w.u.hp-before.hp,Math.round(w.u.maxHp*heal.maxHpRatio),'diagnostic immediate healing');
    equal(before.victimSP-w.v.sp,drain.amount,'diagnostic immediate SP drain');
    const resource=w.v.sp;for(let i=0;i<2;i++){g.processStatuses(w.v,()=>{},w.state,false);g.tickUnitStatuses(w.v);g.tickCombatEffectDurations([w.v]);}
    equal(w.v.sp,resource,'diagnostic drain does not repeat over two actions');
    current.phase4Findings.push('The authored periodic drain remains absent; current cast immediately drains 20 SP once and heals 10% caster Max HP.');
  }
}
function exerciseActive(key, rank, team, text) {
  const spec = shipped(key, rank), w = world(key, rank, team);
  if (spec.effectId === 'thread_binding') { exerciseThread(w, spec, text); return; }
  prepare(w, spec);
  const foes = targets(w, spec), supports = spec.effects.some(e => e.type === 'targeting' && e.mode === 'all_allies') ? [w.u, w.ally] : [w.u];
  const before = {sp:w.a.sp, hp:w.u.hp, targetSP:foes.map(t=>t.sp), targetHP:foes.map(t=>t.hp), allyHP:w.ally.hp};
  const copied = spec.effects.some(e => e.type === 'copy_ability');
  const effectiveSpec = copied ? shipped('fool', 8) : spec;
  let mult = effectiveSpec.damage?.multiplier || 0;
  if (spec.effects.some(e => e.type === 'low_hp_bonus')) mult *= 1 + spec.effects.find(e => e.type === 'low_hp_bonus').amount;
  const untouched = JSON.stringify(spec);
  check(cast(w, spec), 'actual shipped cast succeeds');
  equal(JSON.stringify(spec), untouched, 'cast never mutates shared normalized spec');
  const drain = spec.effects.find(e => e.type === 'sp_siphon');
  equal(w.a.sp, Math.min(w.a.maxSP, before.sp - spec.costSP + (drain ? foes.length * drain.amount : 0)), 'actual SP spend and siphon');
  equal(w.a.cooldowns[spec.effectId], spec.cooldown > 0 ? spec.cooldown + 1 : 0, 'advertised cooldown survives its own effects');
  const castEvent = w.state.events.find(e => e.type === 'cast' && e.actorId === w.u.id);
  check(castEvent, 'real cast event recorded'); equal(castEvent.costSP, spec.costSP, 'cast event SP agrees with tooltip');
  equal(castEvent.cooldown, spec.cooldown, 'cast event cooldown agrees with tooltip');
  tooltipNumber(text, `${spec.costSP} SP`, 'SP cost');
  if (spec.cooldown) tooltipNumber(text, `${spec.cooldown}`, 'cooldown');
  if (mult || effectiveSpec.effects.some(e => e.type === 'damage_component')) {
    const damageText = g.abilityDamageText(effectiveSpec);
    check(damageText.length > 0, 'damaging cast has generated damage formula');
    tooltipNumber(damageText, percent(effectiveSpec.damage.multiplier), 'configured damage multiplier');
    damageChecks(w, effectiveSpec, foes, mult);
  }
  for (const e of spec.effects) {
    const d = duration(e);
    switch (e.type) {
      case 'buff':
        tooltipNumber(text, percent(e.amount), `${e.stat} buff`); tooltipDuration(text,d);
        for (const t of supports) for (const stat of e.stat === 'all' ? ['atk','def','int'] : [e.stat]) {
          expiry(t,d,u=>u._buffs?.[stat]||1,1+e.amount,1,`${stat} buff`);
          if (stat === 'speed') near(g.speedFor(t.agent), g.speedFor({...t.agent,_buffs:{...t.agent._buffs,speed:1}})*(1+e.amount), 'speed affects action scheduling');
        } break;
      case 'debuff':
        tooltipNumber(text,percent(e.amount),`${e.stat} debuff`); tooltipDuration(text,d);
        for (const t of foes) expiry(t,d,u=>e.stat==='speed'?u._speedDebuff||1:e.stat==='outgoing'?u._outgoingMultiplier||1:u._debuffs?.[e.stat]||1,1-e.amount,1,`${e.stat} debuff`); break;
      case 'steal_stat':
        tooltipNumber(text,percent(e.amount),`${e.stat} independent steal modifiers`);
        if (e.stat !== 'hp') { tooltipDuration(text,d); expiry(w.u,d,u=>u._buffs?.[e.stat]||1,1+e.amount,1,'self theft modifier'); for (const t of foes) expiry(t,d,u=>u._debuffs?.[e.stat]||1,1-e.amount,1,'victim theft modifier'); }
        else equal(before.targetHP[0]-w.v.hp,Math.round(w.v.maxHp*e.amount)+w.state.balanceTrace[0].final,'nonlethal Max HP siphon precedes hit'); break;
      case 'heal': {
        if(e.maxHpRatio)tooltipNumber(text,percent(e.maxHpRatio),'Max HP healing');
        if(e.multiplier)tooltipNumber(text,percent(e.multiplier),'base INT healing');
        for(const t of supports){const amount=Math.round(t.maxHp*(e.maxHpRatio||0)+(e.scaling==='INT'?w.a.stats.int*(e.multiplier||0):0));const old=t===w.u?before.hp:before.allyHP;equal(t.hp,Math.min(t.maxHp,old+amount),'healing HP amount');} break;
      }
      case 'shield':
        tooltipNumber(text,percent(e.fullHp?1:e.maxHpRatio),'shield Max HP ratio');
        for(const t of supports){const wanted=Math.round(t.maxHp*(e.fullHp?1:e.maxHpRatio));equal(t.shield,wanted,'shield amount');const old=t.hp;const received=g.resolveIncoming(w.v,t,100,w.state,[],high,{damageType:e.incomingCategory==='magic'?'fire':'physical'});equal(received.absorbed,100,'shield absorbs incoming damage');equal(t.hp,old,'shield protects HP');equal(t.shield,wanted-100,'shield pool is consumed');}break;
      case 'status': {
        const self=['evade','untargetable','guarded','inspired','possession_phase'].includes(e.status), status=e.status==='banished'?'banished':e.status;
        for(const t of self?[w.u]:foes)statusExpiry(t,status,e.duration||1);
        tooltipDuration(text,e.duration||1);
        if(e.dodgeRate!==undefined)tooltipNumber(text,percent(e.dodgeRate),'Evasion rate');
        if(e.status==='banished'){equal(w.v._skipTurns,e.duration,'banishment actions skipped');check(g.hasStatus(w.v,'untargetable'),'banishment makes victim untargetable');}
        if(['untargetable','possession_phase'].includes(e.status)){const old=w.u.hp;g.resolveIncoming(w.v,w.u,100,w.state,[],high,{damageType:'physical'});equal(w.u.hp,old,'self phase avoids applicable hit');}break;
      }
      case 'status_pool': case 'status_chance': {
        tooltipNumber(text,percent(e.chance),'base status chance');tooltipDuration(text,e.duration||1);
        for(const t of foes)check(!(e.statuses||[e.status]).some(st=>g.hasStatus(t,st)), 'high RNG does not proc chance status');
        const low=world(key,rank,team);let n=0;const hitCalls=(spec.damage?.multiplier?targets(low,spec).length*2:0);
        const rng=()=>n++<hitCalls?.99:0;
        check(cast(low,spec,rng),'actual low-RNG cast');
        for(const t of targets(low,spec))statusExpiry(t,e.status||e.statuses[0],e.duration||1);break;
      }
      case 'cleanse':check(!g.hasStatus(w.u,'burn'),'cleanses pre-existing periodic status');near(w.u._debuffs?.atk,.8,'numeric ATK debuff remains outside listed status cleanse');break;
      case 'strip_buffs':case 'nullify_buffs':
        for(const t of foes){equal(Object.keys(t._buffs||{}).length,0,'dispels temporary stat buffs');equal(t.shield||0,0,'dispels shield');check(!g.hasStatus(t,'guarded')&&!g.hasStatus(t,'evade'),'dispels Guard and Evasion');}break;
      case 'damage_taken':case 'damageTaken': {
        tooltipNumber(text,percent(Math.abs(e.amount)),'incoming reduction');tooltipDuration(text,d);
        expiry(w.u,d,u=>e.incomingCategory?u._damageTakenByCategory?.[e.incomingCategory]||1:u._damageTakenMultiplier||1,1+e.amount,1,'incoming multiplier');
        const t=structuredClone(w.u);t.shield=0;t._reflect=undefined;const old=t.hp;const type=e.incomingCategory==='magic'?'fire':'physical';const pm=independentModifiers(t.agent);let base=pm.damageTaken||1;const categories=pm.damageTakenByCategory||{};base*=categories[type]||categories.all||1;
        g.resolveIncoming(w.v,t,100,w.state,[],high,{damageType:type,indirect:true});equal(old-t.hp,Math.round(100*base*(1+e.amount)),'reduction applies to actual periodic HP loss');break;
      }
      case 'reflect': {
        tooltipNumber(text,percent(e.mode==='stat'?e.multiplier:e.share),'reflection coefficient');tooltipDuration(text,d);
        const old=w.v.hp,holderHP=w.u.hp;
        const reflectSpec={damage:{scaling:e.stat||'INT',multiplier:e.multiplier,type:'elemental',element:e.element||'physical',formula:e.stat==='ATK'?'empowered_hybrid_physical':'pure_caster_ability'},effects:[]};
        const wanted=e.mode==='stat'?expectedDamage(w.a,w.u,w.v,reflectSpec):Math.round(100*e.share);
        const result=g.resolveIncoming(w.v,w.u,100,w.state,[],high,{damageType:e.incomingCategory==='magic'?'fire':'physical'});
        equal(old-w.v.hp,wanted,'actual direct hit reflects independent amount');equal(result.reflected,wanted,'reflection outcome');if(e.negate)equal(w.u.hp,holderHP,'direct ward negates HP damage');
        const copy=structuredClone(w.u);g.beginTurn(copy);check(!copy._reflect,'ward expires at next turn');break;
      }
      case 'defense_penetration':case 'defPen':
        tooltipNumber(text,percent(e.amount),'additional DEF bypass');
        if(!mult){tooltipDuration(text,d);expiry(w.u,d,u=>u._defPenBonus||0,e.amount,0,'timed DEF penetration');}break;
      case 'damage_component':tooltipNumber(g.abilityDamageText(spec),percent(e.multiplier),'independent component coefficient');break;
      case 'vulnerability':case 'vulnerability_if_buffed':case 'vulnerability_vs_corrupted':
        tooltipNumber(text,percent(e.amount),'vulnerability');tooltipDuration(text,d);
        for(const t of foes)expiry(t,d,u=>u._vulnerability||1,1+e.amount,1,'vulnerability multiplier');
        if(!mult){const old=w.v.hp,basic={damage:{formula:'basic_physical_attack',scaling:'ATK',type:'physical',multiplier:1},effects:[]};const wanted=expectedDamage(w.a,w.u,w.v,basic);check(g.attackOnce(w.a,w.u,w.v,w.state,[],high,1),'marked target receives actual follow-up basic strike');equal(old-w.v.hp,wanted,'basic strike shares configured vulnerability');}break;
      case 'lifesteal': {
        const ratio=e.ratio??e.amount;tooltipNumber(text,percent(ratio),'Lifesteal');
        if(mult){const dealt=w.state.events.filter(x=>x.type==='damage'&&x.actorId===w.u.id).reduce((n,x)=>n+x.amount,0);equal(w.u.hp-before.hp,Math.round(dealt*ratio),'actual skill Lifesteal amount');}
        else {const old=w.u.hp,victimHP=w.v.hp;check(g.attackOnce(w.a,w.u,w.v,w.state,[],high,1),'timed Lifesteal follow-up attack');equal(w.u.hp-old,Math.round((victimHP-w.v.hp)*ratio),'timed Lifesteal on real basic strike');const copy=structuredClone(w.u);for(let i=0;i<d;i++)g.tickCombatEffectDurations([copy]);const hp=copy.hp,target=structuredClone(w.v);g.attackOnce(copy.agent,copy,target,{...w.state,allies:[copy],enemies:[target]},[],high,1);equal(copy.hp,hp,'Lifesteal expires after configured actions');}break;
      }
      case 'sp_drain':case 'sp_siphon':tooltipNumber(text,`${e.amount} SP`,'resource drain');foes.forEach((t,i)=>equal(t.sp,before.targetSP[i]-Math.min(before.targetSP[i],e.amount),'victim SP drained'));break;
      case 'sp_cost_increase':case 'cooldown_increase':case 'debuff_hit':case 'skill_misfire': {
        const config={sp_cost_increase:['_spCostMultiplier','_spCostDuration'],cooldown_increase:['_cooldownPenalty','_cooldownDuration'],debuff_hit:['_hitChanceDebuff','_hitChanceDebuffDuration'],skill_misfire:['_skillMisfireChance','_skillMisfireDuration']}[e.type];
        tooltipNumber(text,e.type==='cooldown_increase'?`${e.amount}`:percent(e.chance??e.amount),e.type);tooltipDuration(text,e.duration||1);
        for(const t of foes)expiry(t,e.duration||1,u=>u[config[0]]||0,e.chance??e.amount,0,e.type);
        if(e.type==='sp_cost_increase'){const next=shipped('abyss',6),old=w.v.sp;check(cast(w,next,high,w.v,w.u),'surcharged target really casts');equal(old-w.v.sp,Math.round(next.costSP*(1+e.amount)),'surcharge changes actual cost');}
        if(e.type==='cooldown_increase'){const next=shipped('abyss',6);check(cast(w,next,high,w.v,w.u),'target assigns increased cooldown');equal(w.v.cooldowns[next.effectId],next.cooldown+1+e.amount,'cooldown penalty assigned to actual cast');}
        if(e.type==='skill_misfire'){const next=shipped('fool',8),old=w.u.hp,sp=w.v.sp;check(cast(w,next,()=>0,w.v,w.u),'misfiring target spends its cast');equal(w.u.hp,old,'misfire produces no damage');equal(sp-w.v.sp,next.costSP,'misfire still spends SP');}break;
      }
      case 'next_attack_miss': {
        const old=w.u.hp;equal(w.v._nextAttackMiss,e.chance,'forced miss token');check(!g.attackOnce(w.b,w.v,w.u,w.state,[],high),'target next attack misses');equal(w.u.hp,old,'forced miss deals no HP damage');equal(w.v._nextAttackMiss,0,'forced miss token consumed once');break;
      }
      case 'next_crit_fail': {
        equal(w.v._nextCritFail,e.chance,'critical failure token');let n=0;g.attackOnce(w.b,w.v,w.u,w.state,[],()=>n++<2?.99:0);check(!w.state.balanceTrace.at(-1).critical,'next actual attack cannot critically hit');equal(w.v._nextCritFail,0,'critical failure consumed once');break;
      }
      case 'next_damage_bonus': {
        tooltipNumber(text,percent(e.amount),'saved next damaging skill bonus');equal(w.a._nextDamageBonus,e.amount,'next damage token retained by support activation');
        const next=shipped('fool',8),wanted=expectedDamage(w.a,w.u,w.v,next,{abilityMult:next.damage.multiplier*(1+e.amount)});w.state.balanceTrace=[];
        check(cast(w,next),'next actual damaging skill');equal(w.state.balanceTrace[0].final,wanted,'next landed skill receives configured bonus');equal(w.a._nextDamageBonus,0,'saved bonus consumed');break;
      }
      case 'outgoing_damage': {
        tooltipNumber(text,percent(e.amount),'outgoing bonus');tooltipDuration(text,d);expiry(w.u,d,u=>u._outgoingMultiplier||1,1+e.amount,1,'outgoing bonus');
        const old=w.v.hp,basic={damage:{formula:'basic_physical_attack',scaling:'ATK',type:'physical',multiplier:1},effects:[]};const wanted=expectedDamage(w.a,w.u,w.v,basic);
        check(g.attackOnce(w.a,w.u,w.v,w.state,[],high,1),'outgoing bonus affects an actual follow-up basic strike');equal(old-w.v.hp,wanted,'outgoing bonus applies the independent coefficient');break;
      }
      case 'heal_damage_ratio': {
        tooltipNumber(text,percent(e.amount),'damage converted to healing');const dealt=w.state.events.filter(x=>x.type==='damage'&&x.actorId===w.u.id).reduce((n,x)=>n+x.amount,0);equal(w.u.hp-before.hp,Math.round(dealt*e.amount),'real damage conversion healing');break;
      }
      case 'low_hp_bonus':tooltipNumber(text,percent(e.amount),'low HP damage bonus');equal(w.a._lowHpBonus,0,'low HP effect is scoped to this cast');break;
      case 'extra_turn':equal(w.u._extraTurns,e.amount,'extra action granted');tooltipNumber(text,`${e.amount}`,'extra action count');break;
      case 'taunt': {
        tooltipDuration(text,d);equal(w.u._taunt,Number(d),'taunt duration');
        const copy=structuredClone(w.u);for(let i=1;i<=d;i++){g.tickCombatEffectDurations([copy]);equal(copy._taunt,d-i,'taunt remaining actions');}
        equal(g.tauntFilter(w.v,[w.u,w.ally])[0].id,w.u.id,'hostile targeting selects actual taunt');break;
      }
      case 'dodge':tooltipNumber(text,percent(e.amount),'Dodge bonus');tooltipDuration(text,d);expiry(w.u,d,u=>u._dodgeBonus||0,e.amount,0,'timed Dodge');break;
      case 'knockback':equal(w.v.distance,8,'knockback moves three distance units');break;
      case 'movement_block':statusExpiry(w.v,'root',e.duration);tooltipDuration(text,e.duration);{const old=w.v.sp;equal(cast(w,shipped('demoness',6),high,w.v,w.u),false,'Root blocks a real Escape-tagged cast');equal(w.v.sp,old,'blocked Escape spends no SP');}break;
      case 'no_heal':statusExpiry(w.v,'no_heal',e.duration);tooltipDuration(text,e.duration);{const old=w.v.hp;equal(g.recoverHP(w.v,100),0,'healing prohibition blocks actual recovery');equal(w.v.hp,old,'no healing HP gain');}break;
      case 'no_shield':statusExpiry(w.v,'no_shield',e.duration);tooltipDuration(text,e.duration);cast(w,shipped('fool',3),high,w.v,w.u);equal(w.v.shield||0,0,'shield prohibition blocks actual ward');break;
      case 'reset_state':equal(w.a.cooldowns.old_skill,undefined,'current reset clears prior cooldown');equal(Object.keys(w.u._buffs||{}).length,0,'current reset clears own stat buffs');equal(w.u.hp,before.hp,'current reset does not rewind HP');break;
      case 'transfer_debuffs':check(!g.hasStatus(w.u,'burn')&&!g.hasStatus(w.ally,'burn'),'source statuses transferred');check(g.hasStatus(w.v,'burn'),'target receives transferred periodic status');near(w.v._debuffs?.atk,.8,'transferred ATK debuff');break;
      case 'copy_ability':check(w.state.events.some(x=>/reproduces/i.test(x.text||'')),'witnessed ability reproduced');break;
      case 'execute': {
        // The shipped thread entry has its separate route; damage executes use pre-hit strict thresholds.
        tooltipNumber(text,percent(e.threshold),'execute threshold');
        const below=world(key,rank,team);for(const t of targets(below,spec))t.hp=Math.floor(t.maxHp*e.threshold)-1;
        check(cast(below,spec),'actual execute cast');for(const t of targets(below,spec)){check(!t.alive,'target below threshold executes');}
        const boundary=world(key,rank,team);boundary.v.hp=Math.round(boundary.v.maxHp*e.threshold);check(cast(boundary,spec),'threshold boundary cast');check(boundary.v.alive,'exact threshold does not execute');break;
      }
      case 'crit':case 'critDamage':case 'crit_bonus': {
        tooltipNumber(text,percent(e.amount),'critical rate/damage bonus');const criticalWorld=world(key,rank,team);let n=0;
        const baseChance=formulas.combat_rates.crit.base_rate+independentModifiers(criticalWorld.a).crit,roll=e.type==='crit'?baseChance+e.amount/2:0;
        check(cast(criticalWorld,spec,()=>n++<targets(criticalWorld,spec).length*2?.99:roll),'actual critical cast');
        const trace=criticalWorld.state.balanceTrace[0];check(trace.critical,'critical scenario really crits');
        const wanted=expectedDamage(criticalWorld.a,criticalWorld.u,criticalWorld.v,spec,{critical:true,critBonus:e.type==='crit_bonus'?e.amount:0});equal(trace.final,wanted,'critical damage matches independent coefficients');break;
      }
      case 'damage_rule':case 'targeting':break;
      // These schema entries have no Phase3 activation hook; generated rules omit them.
      case 'revive':case 'stat_modifier':current.phase4Effects.push(e.type);break;
      default:throw new Error(`Unhandled quantitative assertion for ${e.type}`);
    }
  }
}
for(const key of g.PATH_KEYS)for(let rank=9;rank>=0;rank--){
  const spec=shipped(key,rank),id=spec.effectId||spec.id;
  const dataAbility=authored[key].sequences.find(t=>t.sequence===rank).ability;
  assert.equal(dataAbility.id,id,`shipped data identity ${key}/${rank}`);
  const row={pathway:key,sequence:rank,ability:id,blocking:!deferred.has(id),assertions:0,teams:[],phase4Effects:[],phase4Findings:[],errors:[]};
  current=row;
  try { const text=g.abilityDescription(spec,key,rank);equal(spec.text,text,'live runtime tooltip');check(text.length>10&&!/undefined|NaN/.test(text),'finite generated tooltip'); }
  catch(error){row.errors.push(error.message);}
  for(const team of ['allies','enemies']){
    current.team=team;
    try {if(!row.blocking)exerciseDeferred(key,rank,team);else if(spec.type==='passive')row.assertions+=exercisePassive(key,rank,team);else exerciseActive(key,rank,team,g.abilityDescription(spec,key,rank));row.teams.push(team);}
    catch(error){row.errors.push(`${team}: ${error.message}`);}
  }
  row.phase4Effects=[...new Set(row.phase4Effects)];row.phase4Findings=[...new Set(row.phase4Findings)];delete row.team;
  row.result=!row.blocking?'DEFERRED_PHASE4':row.errors.length?'FAIL':'PASS';
  if(row.errors.length)row.blocking?failures++:diagnosticFailures++;
  coverage.push(row);console.log(`${row.blocking?row.result:'PHASE4 DIAGNOSTIC'} ${key}/${rank} ${id}: ${row.assertions} assertions, ${row.teams.length}/2 teams${row.errors.length?' — '+row.errors.join('; '):''}`);
}
assert.equal(coverage.length,220,'all 220 rank abilities have a coverage record');
assert.equal(coverage.filter(r=>r.blocking).length,218,'218 blocking Phase3 abilities');
assert.equal(coverage.filter(r=>!r.blocking).length,2,'two deferred Error diagnostics');
const report={abilities:coverage.length,blockingAbilities:218,diagnosticAbilities:2,blockingFailures:failures,diagnosticFailures,assertions:coverage.reduce((n,r)=>n+r.assertions,0),coverage};
if(process.env.PHASE3_COVERAGE_PATH)fs.writeFileSync(process.env.PHASE3_COVERAGE_PATH,JSON.stringify(report,null,2)+'\n');
console.log(`Phase3 actual casts: ${218-failures}/218 blocking abilities passed; 2 Phase4 diagnostics; ${report.assertions} quantitative assertions.`);
if(failures)process.exitCode=1;
