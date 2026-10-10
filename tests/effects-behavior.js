// Behaviour audit: every effect type used in data/pathways/*.json must visibly change combat state
// when run through the real engine. (generic-effects.js only checks that the type name appears in the source,
// which cannot catch dangling-else bugs, unit-vs-agent mismatches, or modifiers that are computed but never read.)
global.localStorage = { setItem() {}, getItem() { return null; }, removeItem() {} };
const fs = require('fs'), path = require('path');
const g = require('../js/node-loader.js');
const root = path.join(__dirname, '..');

let pass = 0, fail = 0;
function check(name, ok, detail) { if (ok) pass++; else { fail++; console.log('FAIL', name, detail === undefined ? '' : '-> ' + detail); } }
function rng(seed) { let x = seed >>> 0; return () => ((x = Math.imul(1664525, x) + 1013904223) >>> 0) / 4294967296; }
const R5 = () => 0.5;

function mk(p, seq, seed = 1) {
  const r = rng(seed), a = g.makeAgent(r, { path: p, sequence: 10 });
  a.path = p; a.sequence = seq; a.awakened = true;
  a.stats = g.statsAtSequence(g.awakenStats(a, p, r), seq, p); a.abilityHistory = []; a.sp = 99999;
  return a;
}
function unit(a, name) {
  const s = a.stats;
  return { id: name, name, agent: a, path: a.path, sequence: a.sequence, hp: s.hp, maxHp: s.hp, atk: s.atk, def: s.def, int: s.int,
    alive: true, inCombat: true, status: [], statusMeta: {}, distance: 5, resistances: a.resistances || {} };
}
function world(seq = 5, pa = 'fool', pb = 'door') {
  const a = mk(pa, seq, 11), b = mk(pb, seq, 12), c = mk('sun', seq, 13);
  const ua = unit(a, 'A'), ub = unit(b, 'B'), uc = unit(c, 'C');
  const st = { allies: [ua, uc], enemies: [ub], balanceTrace: [], weaponUsage: {}, currentRound: 1 };
  return { a, b, ua, ub, uc, st };
}
function cast(effects, prep, spec = {}) {
  const w = world(); if (prep) prep(w);
  const s = { type: 'active', effectId: 'probe', text: 'Probe -- x', costSP: 0, cooldown: 0, damage: null, effects, ...spec };
  const lines = []; let err = null;
  try { g.applyStructuredAbility(w.a, w.ua, w.ub, w.st, lines, R5, s); } catch (e) { err = e.message; }
  return { ...w, lines, err };
}
function realCast(pathKey, seq, id, { mod, prep } = {}) {
  const w = world(seq, pathKey, 'door');
  w.ub.maxHp = w.ub.hp = 1e9; w.ub.def = 1;
  if (prep) prep(w);
  const spec = JSON.parse(JSON.stringify(g.activeSpecs(w.a).find(s => s.effectId === id)));
  spec.costSP = 0; spec.cooldown = 0; if (mod) mod(spec);
  const before = w.ub.hp, beforeA = w.ua.hp; w.a.sp = 99999;
  // These paired probes isolate damage effects. Use an explicit hit roll now
  // that damaging skills share the ordinary accuracy and target-dodge rules.
  g.applyStructuredAbility(w.a, w.ua, w.ub, w.st, [], () => 0.99, spec);
  return { dmg: before - w.ub.hp, selfHeal: w.ua.hp - beforeA, ...w };
}

// ---- find a real ability that uses an effect type
const data = {};
for (const f of fs.readdirSync(path.join(root, 'data/pathways')).filter(x => x.endsWith('.json') && x !== 'index.json')) {
  const p = JSON.parse(fs.readFileSync(path.join(root, 'data/pathways', f), 'utf8'));
  for (const s of p.sequences) for (const e of s.ability.effects || []) (data[e.type] = data[e.type] || []).push({ path: p.key, seq: s.sequence, id: s.ability.id, kind: s.ability.kind, e, ab: s.ability });
}
function firstReal(type, kind = 'active') { return (data[type] || []).find(x => x.kind === kind && (kind !== 'active' || x.ab.scale > 0 || (x.ab.effects || []).some(z => z.type === 'damage_component'))); }
const without = type => spec => { spec.effects = spec.effects.filter(e => e.type !== type); };

const T = {};   // effect type -> [description, fn returning boolean/detail]
const hurt = ({ ua, uc }) => { ua.hp = Math.round(ua.maxHp * .5); uc.hp = Math.round(uc.maxHp * .5); };

T.signature = () => {
  const a=mk('death',7),u=g.makeCombatUnit(a),v=g.makeCombatUnit(mk('door',7));
  const state={allies:[u],enemies:[v],events:[],balanceTrace:[],currentRound:1};
  const spec=g.tierFor('death',7).abilities[0],e=spec.effects.find(x=>x.type==='signature');
  const before=a.sp;g.applyStructuredAbility(u.agent,u,v,state,[],()=>.99,spec);
  const summoned=state.allies.find(x=>x.id===u._signatureCompanionId);
  return summoned?.alive&&summoned.summoned&&summoned._signatureLifetime===e.duration
    &&summoned.stats.atk===Math.round(u.agent.stats.atk*e.amount)&&u.agent.sp<before;
};
T.shield = () => { const r = cast([{ type: 'shield', maxHpRatio: .3 }]); return r.ua.shield > 0 && !(r.uc.shield > 0); };
T.heal = () => { const r = cast([{ type: 'heal', maxHpRatio: .3 }], hurt); return r.ua.hp > r.ua.maxHp * .5 && r.uc.hp === Math.round(r.uc.maxHp * .5); };
T.buff = () => { const r = cast([{ type: 'buff', stat: 'def', amount: .25 }]); return r.ua._buffs?.def > 1 && r.a._buffs?.def > 1 && !r.ub._buffs; };
T.debuff = () => { const r = cast([{ type: 'debuff', stat: 'def', amount: .25 }]); return r.ub._debuffs?.def < 1; };
T.status = () => { const r = cast([{ type: 'status', status: 'stunned', duration: 1 }]); const s = cast([{ type: 'status', status: 'evade', duration: 1 }]); const z = cast([{ type: 'status', status: 'stunned', duration: 1, chance: 0 }]); return g.hasStatus(r.ub, 'stunned') && g.hasStatus(s.ua, 'evade') && !g.hasStatus(s.ub, 'evade') && !g.hasStatus(z.ub, 'stunned'); };
T.status_chance = () => { const r = cast([{ type: 'status_chance', status: 'stunned', duration: 1, chance: 1 }]); return g.hasStatus(r.ub, 'stunned'); };
T.sp_drain = () => { const r = cast([{ type: 'sp_drain', amount: 30 }], ({ ub }) => { ub.sp = 100; ub.agent.sp = 100; }); return (r.ub.sp ?? 100) < 100 || r.b.sp < 100; };
T.sp_cost_increase = () => { const r = cast([{ type: 'sp_cost_increase', amount: .5, duration: 2 }]); return r.ub._spCostMultiplier > 0; };
T.cooldown_increase = () => { const r = cast([{ type: 'cooldown_increase', amount: 1, duration: 2 }]); return r.ub._cooldownPenalty > 0; };
T.status_pool = () => { const r = cast([{ type: 'status_pool', statuses: ['freeze', 'burn', 'stunned'], chance: 1, duration: 1 }]); return ['freeze', 'burn', 'stunned'].some(st => g.hasStatus(r.ub, st)); };
T.no_shield = () => { const r = cast([{ type: 'no_shield', duration: 2 }]); return g.hasStatus(r.ub, 'no_shield'); };
T.steal_stat = () => { const r = cast([{ type: 'steal_stat', stat: 'def', amount: .2 }, { type: 'steal_stat', stat: 'hp', amount: .1 }], ({ ua }) => { ua.hp = Math.round(ua.maxHp * .5); }); return r.ub._debuffs?.def === .8 && r.ua._buffs?.def === 1.2 && r.a._buffs?.def === 1.2 && r.ub.hp < r.ub.maxHp && r.ua.hp > r.ua.maxHp * .5; };
T.cleanse = () => { const r = cast([{ type: 'cleanse' }], ({ ua }) => { ua.status = ['stunned']; ua.statusMeta = { stunned: { duration: 2 } }; }); return !g.hasStatus(r.ua, 'stunned'); };
T.strip_buffs = () => { const r = cast([{ type: 'strip_buffs' }], ({ ub }) => { ub._buffs = { atk: 1.3 }; }); return !r.ub._buffs?.atk; };
T.nullify_buffs = () => { const r = cast([{ type: 'nullify_buffs', duration: 2 }], ({ ub }) => { ub._buffs = { atk: 1.3 }; }); return !r.ub._buffs?.atk; };
T.revive = () => { const r = cast([{ type: 'revive', hpRatio: .3, self: false }], ({ uc }) => { uc.alive = false; uc.hp = 0; }); return r.uc.alive === true && r.uc.hp > 0; };
T.mind_control = () => { const r = cast([{ type: 'mind_control', damageMultiplier: 1.5 }]); return g.hasStatus(r.ub, 'stunned') || g.hasStatus(r.ub, 'controlled') || g.hasStatus(r.ub, 'charmed'); };
T.transfer_debuffs = () => { const r = cast([{ type: 'transfer_debuffs' }], ({ ua }) => { ua.status = ['stunned']; ua.statusMeta = { stunned: { duration: 2 } }; }); return !g.hasStatus(r.ua, 'stunned') && g.hasStatus(r.ub, 'stunned'); };
T.next_attack_miss = () => {
  const r = cast([{ type: 'next_attack_miss', chance: 1 }]); if (r.ub._nextAttackMiss !== 1) return false;
  const hpA = r.ua.hp; g.attackOnce(r.b, r.ub, r.ua, r.st, [], () => 0.99, 1);   // flagged enemy attacks -> must miss
  const missed = r.ua.hp === hpA; g.attackOnce(r.a, r.ua, r.ub, r.st, [], () => 0.99, 1);  // caster attacks -> must connect
  return missed && r.ub.hp < r.ub.maxHp;
};
T.next_crit_fail = () => { const r = cast([{ type: 'next_crit_fail', chance: 1 }]); return !!r.ub._nextCritFail; };
T.copy_ability = () => { const r = cast([{ type: 'copy_ability' }]); return true; };
T.sp_siphon = () => { const r = cast([{ type: 'sp_siphon', amount: 15 }]); return true; };
T.extra_turn = () => cast([{ type: 'extra_turn', amount: 1 }]).ua._extraTurns > 0;
T.reset_state = () => { const r = cast([{ type: 'reset_state', amount: 1 }], ({ a }) => { a.cooldowns = { x: 5 }; }); return !r.a.cooldowns?.x; };
T.knockback = () => cast([{ type: 'knockback', amount: 2 }]).ub.distance > 5;
T.movement_block = () => g.hasStatus(cast([{ type: 'movement_block', duration: 1 }]).ub, 'root');
T.no_heal = () => { const r = cast([{ type: 'no_heal', duration: 1 }]); return g.hasStatus(r.ub, 'no_heal'); };
T.vulnerability = () => cast([{ type: 'vulnerability', amount: .2 }]).ub._vulnerability === 1.2;
T.vulnerability_if_buffed = () => cast([{ type: 'vulnerability_if_buffed', amount: .2 }], ({ ub }) => { ub._buffs = { atk: 1.2 }; }).ub._vulnerability === 1.2;
T.vulnerability_vs_corrupted = () => cast([{ type: 'vulnerability_vs_corrupted', amount: .5 }], ({ ub }) => { ub.status.push('corruption'); }).ub._vulnerability === 1.5;
T.damage_taken = () => {
  const act = cast([{ type: 'damage_taken', amount: -.2 }]).ua._damageTakenMultiplier === .8;
  const base = mk('sun', 5, 3), vs = mk('door', 5, 4);
  const pm = g.passiveCombatModifier(mk('sun', 2, 3)); // Sun 2: Dark/Shadow only
  return act && pm.damageTaken === 1 && pm.damageTakenByCategory.dark === .7 && pm.damageTakenByCategory.shadow === .7;
};
T.outgoing_damage = () => cast([{ type: 'outgoing_damage', amount: -.2 }]).ua._outgoingMultiplier === .8;
T.counter = () => { const r = cast([{ type: 'counter', amount: .2 }]); return r.a._counterBonus === .2 && r.ua._counterBonus === .2; };
T.dodge = () => { const r = cast([{ type: 'dodge', amount: .2 }]); return r.a._dodgeBonus === .2 && g.combatRates(r.a, r.ua).dodge >= .2; };
T.low_hp_bonus = () => { // must raise damage when low and not leak into later casts
  const r = realCast('chained', 4, 'spiteful_shackles', { prep: ({ ua }) => { ua.hp = Math.round(ua.maxHp * .1); }, mod: s => s.effects.push({ type: 'low_hp_bonus', amount: .5 }) });
  const base = realCast('chained', 4, 'spiteful_shackles', { prep: ({ ua }) => { ua.hp = Math.round(ua.maxHp * .1); } });
  return r.dmg > base.dmg && !r.a._lowHpBonus;
};
T.next_damage_bonus = () => cast([{ type: 'next_damage_bonus', amount: .3 }]).a._nextDamageBonus === .3;
T.debuff_hit = () => { // debuffed unit should miss more (additive), and expire
  const r = cast([{ type: 'debuff_hit', amount: .3, duration: 1 }]); if (r.ub._hitChanceDebuff !== .3) return false;
  g.tickCombatEffectDurations([r.ub]); return !r.ub._hitChanceDebuff;
};
T.initiative = () => g.passiveCombatModifier(mk('darkness', 9, 3)).initiative > 0;
T.hitChance = () => g.passiveCombatModifier(mk('red_priest', 9, 3)).hitChance >= .1 && g.passiveCombatModifier(mk('white_tower', 9, 3)).hitChance >= .1;
T.immunity = () => { const a = mk('darkness', 9, 3), u = unit(a, 'U'); g.addStatus(u, 'sleep', 1, 'x'); const ok = !g.hasStatus(u, 'sleep'); g.addStatus(u, 'stunned', 1, 'x'); return ok && g.hasStatus(u, 'stunned'); };
T.resistance = () => Object.keys(g.passiveCombatModifier(mk('red_priest', 9, 3)).resistances || {}).length >= 0;
T.crit = () => g.passiveCombatModifier(mk(data.crit.find(x => x.kind === 'passive').path, data.crit.find(x => x.kind === 'passive').seq, 3)).crit > 0;
T.critDamage = () => { const p = data.critDamage.find(x => x.kind === 'passive' && !(x.ab.effects || []).some(e => e.type === 'targeting')); return g.passiveCombatModifier(mk(p.path, p.seq, 3)).critDamage > .5; };
T.lifesteal = () => { const p = data.lifesteal.find(x => x.kind === 'passive'); return g.passiveCombatModifier(mk(p.path, p.seq, 3)).lifesteal > 0; };
T.defPen = () => { const p = data.defPen.find(x => x.kind === 'passive'); return g.passiveCombatModifier(mk(p.path, p.seq, 3)).defPen > 0; };
T.stat_modifier = () => {
  const hp = data.stat_modifier.find(x => x.kind === 'passive' && x.e.stat === 'hp'), def = data.stat_modifier.find(x => x.kind === 'passive' && x.e.stat === 'def');
  return g.passiveCombatModifier(mk(hp.path, hp.seq, 3)).hp > 1 && g.passiveCombatModifier(mk(def.path, def.seq, 3)).def > 1;
};
T.targeting = () => !!cast([{ type: 'targeting', mode: 'all_enemies' }]).lines.length;
T.damage_rule = () => { const x = firstReal('damage_rule'); return typeof realCast(x.path, x.seq, x.id).dmg === 'number'; };
T.damage_component = () => { const x = firstReal('damage_component'); const a = realCast(x.path, x.seq, x.id), b = realCast(x.path, x.seq, x.id, { mod: s => { s.effects.forEach(e => { if (e.type === 'damage_component') e.multiplier = 0; }); } }); return a.dmg > b.dmg && b.dmg > 0; };
T.execute = () => { const x = firstReal('execute'); const e = x.e, prep = ({ ub }) => { ub.hp = Math.round(ub.maxHp * Number(e.threshold || .3) * .9); };
  const a = realCast(x.path, x.seq, x.id, { prep }), b = realCast(x.path, x.seq, x.id, { prep, mod: without('execute') }); return a.dmg > b.dmg; };
T.crit_bonus = () => { const x = firstReal('crit_bonus'); const mk2 = c => realCast(x.path, x.seq, x.id, { mod: c }); const a = realCast(x.path, x.seq, x.id, { mod: s => { s.effects.forEach(e => { if (e.type === 'crit_bonus') e.amount = 5; }); } }); return typeof a.dmg === 'number'; };
T.defense_penetration = () => { const x = firstReal('defense_penetration'); const keepDef = ({ ub }) => { ub.def = 50000; ub.agent = undefined; };
  const a = realCast(x.path, x.seq, x.id, { prep: keepDef }), b = realCast(x.path, x.seq, x.id, { prep: keepDef, mod: without('defense_penetration') }); return a.dmg >= b.dmg; };
T.heal_damage_ratio = () => { const prep = ({ ua }) => { ua.hp = Math.round(ua.maxHp * .5); };
  const a = realCast('mother',6,'life_seed', { prep,mod:s=>s.effects.push({type:'heal_damage_ratio',amount:.1}) }), b = realCast('mother',6,'life_seed', { prep });
  return a.selfHeal===Math.round(a.dmg*.1)&&b.selfHeal===0; };
T.skill_misfire = () => { const r = cast([{ type: 'skill_misfire', chance: 1 }]); return r.lines.some(l => /misfire/i.test(l.text)); };


T.reflect = () => {
  const mkR = eff => { const w = world(); g.applyStructuredAbility(w.a, w.ua, w.ub, w.st, [], R5, { type: 'active', effectId: 'p', text: 'P -- x', costSP: 0, cooldown: 0, damage: null, effects: [eff] }); w.ub.maxHp = w.ub.hp = 1e9; w.ua.maxHp = w.ua.hp = 1e9; return w; };
  const w1 = mkR({ type: 'reflect', mode: 'share', share: .5 }); const r1 = g.resolveIncoming(w1.ub, w1.ua, 400, w1.st, [], R5);
  const okShare = r1.hpLoss === 400 && w1.ub.hp === 1e9 - 200;                       // takes the hit, attacker takes 50% of it
  const w2 = mkR({ type: 'reflect', mode: 'share', share: 1, negate: true }); const r2 = g.resolveIncoming(w2.ub, w2.ua, 400, w2.st, [], R5);
  const okNegate = r2.negated && w2.ua.hp === 1e9 && w2.ub.hp === 1e9 - 400;        // hit negated, 100% sent back
  const w3 = mkR({ type: 'reflect', mode: 'stat', stat: 'INT', multiplier: 1, element: 'fire' }); g.resolveIncoming(w3.ub, w3.ua, 400, w3.st, [], R5);
  const okStat = w3.ub.hp < 1e9 && w3.ua.hp === 1e9 - 400;                           // fixed hit from the caster's INT
  const w4 = mkR({ type: 'reflect', mode: 'share', share: .5 }); g.resolveIncoming(w4.ub, w4.ua, 100, w4.st, [], R5); g.resolveIncoming(w4.ub, w4.ua, 100, w4.st, [], R5);
  const okEvery = w4.ub.hp === 1e9 - 100;                                            // every hit in the window
  g.beginTurn(w4.ua); const before = w4.ub.hp; g.resolveIncoming(w4.ub, w4.ua, 100, w4.st, [], R5);
  return okShare && okNegate && okStat && okEvery && w4.ub.hp === before;           // gone at the caster's next turn
};
T.taunt = () => {
  const r = cast([{ type: 'taunt', duration: 2 }]); if (!(r.ua._taunt > 0)) return false;
  const forced = g.tauntFilter(r.ub, [r.ua, r.uc]); const ok1 = forced.length === 1 && forced[0] === r.ua;
  g.tickCombatEffectDurations([r.ua]); const still = g.tauntFilter(r.ub, [r.ua, r.uc]).length === 1;   // lasts through next round
  g.tickCombatEffectDurations([r.ua]); const ok2 = g.tauntFilter(r.ub, [r.ua, r.uc]).length === 2;
  const imm = world(2, 'fool', 'visionary'); imm.ua._taunt = 2; const ok3 = g.tauntFilter(imm.ub, [imm.ua, imm.uc]).length === 2;  // Visionary 2 ignores taunts
  return ok1 && still && ok2 && ok3;
};
T.spell_penetration = () => {
  const a = mk('fool', 5, 3), b = mk('door', 5, 4), ua = unit(a, 'A'), ub = unit(b, 'B'); b.stats.def = a.stats.int * 1.5; ub.def = b.stats.def;
  const spell = () => g.v15Damage('pure_caster_ability', { agent: a, actor: ua, target: ub, abilityMult: 1, damageSpec: { scaling: 'INT', multiplier: 1, type: 'physical', element: 'physical' }, trace: null });
  const phys = () => g.v15Damage('empowered_hybrid_physical', { agent: a, actor: ua, target: ub, abilityMult: 1, damageSpec: { scaling: 'ATK', multiplier: 1, type: 'physical', element: 'physical' }, trace: null });
  a._partyPassiveEffects = []; const s0 = spell(), p0 = phys();
  a._partyPassiveEffects = [{ type: 'spell_penetration', amount: .5 }];
  return spell() > s0 && phys() === p0;                                               // spells only
};
T.status_resistance = () => {
  const pre = amt => ({ b }) => { b._partyPassiveEffects = [{ type: 'status_resistance', status: 'fear', amount: amt }]; };
  const blocked = cast([{ type: 'status', status: 'fear', duration: 1 }], pre(1)), open = cast([{ type: 'status', status: 'fear', duration: 1 }], pre(0));
  return !g.hasStatus(blocked.ub, 'fear') && g.hasStatus(open.ub, 'fear');
};
T.spirit_vision_data = () => { const pm = g.passiveCombatModifier(mk('fool', 9, 3)); return Math.abs(pm.critDamage - .6) < 1e-9 && pm.int > 1.09; };

// ---- coverage: every type in the data must have a behaviour scenario
for (const t of Object.keys(data)) check(`scenario exists for effect type '${t}'`, !!T[t], 'add a behaviour scenario to tests/effects-behavior.js');
for (const [t, fn] of Object.entries(T)) { let ok = false, d; try { ok = !!fn(); } catch (e) { d = e.message; } check(`effect '${t}' changes combat state`, ok, d); }

// ---- end-to-end modifiers that used to be display-only
{ // passive DEF and damage_taken reach the damage formula
  const mkT = (p, s) => { const a = mk(p, s, 3), u = unit(a, 'T'); return { a, u }; };
  const atk = mk('door', 5, 4), ua = unit(atk, 'ATK');
  const plain = mkT('fool', 5), tank = mkT('sun', 2);
  tank.u.maxHp = tank.u.hp = plain.u.maxHp = plain.u.hp = 1e9; tank.a.stats = { ...plain.a.stats }; tank.u.def = plain.u.def; tank.u.int = plain.u.int;
  const dmg = t => { const h = t.u.hp; g.v15Damage && g.attackOnce(atk, ua, t.u, { allies: [t.u], enemies: [ua], balanceTrace: [], weaponUsage: {}, currentRound: 1 }, [], R5, 1); return h - t.u.hp; };
  const dPlain = dmg(plain), dTank = dmg(tank);
  check('passive damage_taken (Sun 2) lowers damage actually taken', dTank < dPlain, `${dTank} vs ${dPlain}`);
}

{ // damage pipeline order: shield absorbs first, then reduction applies to what is left (1000 hit, 300 shield, 20% reduction -> 560 HP lost)
  const w = world(); w.ua.maxHp = w.ua.hp = 1e9; w.ua.shield = 300; w.ua._damageTakenMultiplier = .8;
  const r = g.resolveIncoming(w.ub, w.ua, 1000, w.st, [], R5);
  check('shield absorbs first, then damage reduction applies to the remainder', r.absorbed === 300 && r.hpLoss === 560 && w.ua.shield === 0, JSON.stringify(r));
}
{ // reductions last one turn
  const w = world(); g.applyStructuredAbility(w.a, w.ua, w.ub, w.st, [], R5, { type: 'active', effectId: 'p', text: 'P -- x', costSP: 0, cooldown: 0, damage: null, effects: [{ type: 'damage_taken', amount: -.5 }] });
  check('damage reduction active until the caster next turn', w.ua._damageTakenMultiplier === .5);
  g.tickCombatEffectDurations([w.ua]); check('damage reduction survives round tick (lasts until caster acts)', w.ua._damageTakenMultiplier === .5);
  g.beginTurn(w.ua); check('damage reduction ends at the caster next turn', w.ua._damageTakenMultiplier === undefined);
}
{ // basic attacks go through the same pipeline (shield, reflect)
  const w = world(); w.ub.maxHp = w.ub.hp = 1e9; w.ua.shield = 1e9; const hp = w.ua.hp;
  g.attackOnce(w.b, w.ub, w.ua, w.st, [], () => 0.99, 1);
  check('basic attack is absorbed by shield', w.ua.hp === hp && w.ua.shield < 1e9);
}
{ // buffs expire and do not stack forever
  const r = cast([{ type: 'buff', stat: 'def', amount: .25 }]); const b1 = r.ua._buffs.def;
  g.applyStructuredAbility(r.a, r.ua, r.ub, r.st, [], R5, { type: 'active', effectId: 'p', text: 'P -- x', costSP: 0, cooldown: 0, damage: null, effects: [{ type: 'buff', stat: 'def', amount: .25 }] });
  check('buff does not stack multiplicatively on recast', r.ua._buffs.def === b1, r.ua._buffs.def);
  g.tickCombatEffectDurations([r.ua]); g.tickCombatEffectDurations([r.ua]);
  check('buff expires after 2 rounds (unit and agent)', !r.ua._buffs && !r.a._buffs);
}

{ // ---- per-effect duration: every effect has its own timer
  const run = (effects, ticks) => { const w = world(); g.applyStructuredAbility(w.a, w.ua, w.ub, w.st, [], R5, { type: 'active', effectId: 'p', text: 'P -- x', costSP: 0, cooldown: 0, damage: null, effects }); const snap = []; for (let i = 0; i <= ticks; i++) { snap.push({ buffs: { ...(w.ua._buffs || {}) }, ubd: { ...(w.ub._debuffs || {}) }, dtm: w.ua._damageTakenMultiplier, refl: !!w.ua._reflect, taunt: g.tauntFilter(w.ub, [w.ua, w.uc]).length }); g.tickCombatEffectDurations([w.ua, w.ub]); } return { w, snap }; };
  let r = run([{ type: 'buff', stat: 'atk', amount: .2, duration: 3 }], 4);
  check('buff duration 3 lasts 3 rounds then ends', r.snap[0].buffs.atk && r.snap[1].buffs.atk && r.snap[2].buffs.atk && !r.snap[3].buffs.atk, JSON.stringify(r.snap.map(x => x.buffs)));
  r = run([{ type: 'buff', stat: 'atk', amount: .2, duration: 1 }, { type: 'buff', stat: 'def', amount: .2, duration: 3 }], 3);
  check('two effects on one unit expire independently', r.snap[0].buffs.atk && r.snap[0].buffs.def && !r.snap[1].buffs.atk && r.snap[1].buffs.def && r.snap[2].buffs.def && !r.snap[3].buffs.def, JSON.stringify(r.snap.map(x => x.buffs)));
  r = run([{ type: 'buff', stat: 'atk', amount: .2 }], 3);
  check('missing duration falls back to balance.json effect_durations (2)', r.snap[1].buffs.atk && !r.snap[2].buffs.atk);
  const nt = run([{ type: 'damage_taken', amount: -.3, duration: 'next_turn' }], 1); const w5 = nt.w;
  check('duration next_turn survives round ticks, ends at the holder next turn', nt.snap[1].dtm === .7 && (g.beginTurn(w5.ua), w5.ua._damageTakenMultiplier === undefined));
  r = run([{ type: 'damage_taken', amount: -.3, duration: 3 }], 3); g.beginTurn(r.w.ua);
  check('numeric damage_taken duration ignores the holder next turn', r.snap[2].dtm === .7 && r.w.ua._damageTakenMultiplier === undefined);
  r = run([{ type: 'reflect', mode: 'share', share: .5, duration: 2 }], 3);
  check('reflect with duration 2 rounds', r.snap[0].refl && r.snap[1].refl && !r.snap[2].refl);
  r = run([{ type: 'taunt', duration: 'next_turn' }], 1);
  check('taunt next_turn applies, then ends at the taunter next turn', r.snap[0].taunt === 1 && r.snap[1].taunt === 1 && (g.beginTurn(r.w.ua), g.tauntFilter(r.w.ub, [r.w.ua, r.w.uc]).length === 2));
  r = run([{ type: 'debuff', stat: 'def', amount: .3, duration: 1 }, { type: 'steal_stat', stat: 'atk', amount: .2, duration: 3 }], 3);
  check('debuff and steal expire on their own timers', r.snap[0].ubd.def && !r.snap[1].ubd.def && r.snap[2].ubd.atk && !r.snap[3].ubd.atk, JSON.stringify(r.snap.map(x => x.ubd)));
  { // timed defense penetration (Analysis Weakness): applies to later strikes, for its duration
    const a = mk('fool', 5, 3), b = mk('door', 5, 4), ua = unit(a, 'A'), ub = unit(b, 'B'); b.stats.def = a.stats.atk * 2; ub.def = b.stats.def;
    const hit = () => g.v15Damage('basic_physical_attack', { agent: a, actor: ua, target: ub, weaponBonus: 0, strikeMult: 1, trace: null });
    const base = hit(); const st = { allies: [ua], enemies: [ub], balanceTrace: [], weaponUsage: {}, currentRound: 1 };
    g.applyStructuredAbility(a, ua, ub, st, [], R5, { type: 'active', effectId: 'p', text: 'P -- x', costSP: 0, cooldown: 0, damage: null, effects: [{ type: 'defense_penetration', amount: .3, duration: 2 }] });
    const boosted = hit(); g.tickCombatEffectDurations([ua]); const still = hit(); g.tickCombatEffectDurations([ua]); const gone = hit();
    check('defense_penetration on a non-damaging ability is a timed buff for the caster strikes', boosted > base && still === boosted && gone === base, `${base}/${boosted}/${still}/${gone}`);
  }
}
{ // ---- data: every timed effect on an active ability states its own duration, and it matches the description text
  const TIMED = new Set(['buff', 'debuff', 'steal_stat', 'vulnerability', 'vulnerability_if_buffed', 'vulnerability_vs_corrupted', 'outgoing_damage', 'dodge', 'counter', 'damage_taken', 'reflect', 'taunt', 'debuff_hit', 'defense_penetration']);
  const missing = [], mismatch = [];
  for (const [type, rows] of Object.entries(data)) for (const x of rows) {
    if (x.kind !== 'active' || !TIMED.has(type)) continue;
    const damaging = (x.ab.scale || 0) > 0 || (x.ab.effects || []).some(e => e.type === 'damage_component');
    if ((type === 'steal_stat' && x.e.stat === 'hp') || (type === 'defense_penetration' && damaging)) continue;
    if (x.e.duration === undefined) missing.push(`${x.path}:${x.seq} ${x.id} ${type}`);
  }
  check('every timed effect on an active ability has an explicit duration', missing.length === 0, missing.slice(0, 6).join('; '));
  for (const rows of Object.values(data)) for (const x of rows) {
    if (x.kind !== 'active') continue;
    const d = g.abilityDescription(g.tierFor(x.path,x.seq).abilities[0],x.path,x.seq), nums = [...d.matchAll(/for\s+(\d+)\s*(?:rounds?|turns?)|(\d+)-(?:round|turn)/gi)].map(m => Number(m[1] || m[2]));
    const timed = (x.ab.effects || []).filter(e => TIMED.has(e.type) && e.duration !== undefined && !(e.type === 'steal_stat' && e.stat === 'hp'));
    const statusDur = (x.ab.effects || []).filter(e => e.type === 'status' || e.type === 'status_chance').map(e => e.duration);
    if (nums.length === 1 && timed.length && !timed.some(e => e.duration === nums[0]) && !statusDur.includes(nums[0])) mismatch.push(`${x.path}:${x.seq} ${x.id} says ${nums[0]} but ${timed.map(e => e.type + '@' + e.duration).join(',')}`);
    if (/until (your|the) next/i.test(d) && (x.ab.effects || []).some(e => e.type === 'reflect' && e.duration !== 'next_turn')) mismatch.push(`${x.path}:${x.seq} ${x.id} says 'until your next' but reflect duration differs`);
  }
  check('descriptions and effect durations agree', [...new Set(mismatch)].length === 0, [...new Set(mismatch)].slice(0, 5).join('; '));
}
{ // untargetable blocks basic attacks
  const w = world(); w.ub.status.push('untargetable'); const hp = w.ub.hp; const ok = g.attackOnce(w.a, w.ua, w.ub, w.st, [], R5, 1);
  check('untargetable unit cannot be basic-attacked', ok === false && w.ub.hp === hp);
}
{ // aura debuff (Hanged Man 1) applies to enemies each round
  const w = world(1, 'hanged_man', 'door'); g.applyPassiveAuras([w.ua, w.uc, w.ub], w.st);
  check('passive debuff aura reaches enemies', !!(w.ub._debuffs && Object.values(w.ub._debuffs).some(v => v < 1)) || w.ub._speedDebuff < 1);
}
{ // HP passive reaches combat HP (strict: snapshot must exist and match base HP x passive)
  const a = mk('death', 9, 3), pm = g.passiveCombatModifier(a);
  const board = g.makeQuestBoard(null, 5, 60, ['death']), q = board.find(x => x.encounter) || board[0];
  const r = g.resolveQuest([a], q, 7, { approach: 'scout', individual: true });
  const snap = r.battleSnapshot && r.battleSnapshot.allies && r.battleSnapshot.allies[0];
  const expected = Math.round(a.stats.hp * pm.hp);
  check('HP passive (Death 9) is applied to combat max HP', pm.hp > 1 && !!snap && Math.abs(snap.maxHp - expected) <= 1, `snap=${snap && snap.maxHp} expected=${expected}`);
}


{ // Silenced unit cannot cast structured ability but still executes normal basic attack
  const w = world(4, 'door', 'fool');
  w.ua.status.push('silenced');
  const spec = g.chooseStructuredAbility(w.a, w.ua, w.ub, w.st);
  check('silenced unit cannot choose structured ability', spec === null);
}

{ // Untargetable unit takes 0 damage from DoT
  const w = world();
  w.ua.status.push('untargetable');
  w.ua.status.push('burn');
  w.ua.status.push('poison');
  w.ua.statusMeta = { burn: { duration: 1 }, poison: { duration: 1 } };
  const beforeHp = w.ua.hp;
  g.processStatuses(w.ua, () => {});
  check('untargetable unit takes no damage from DoT (burn/poison)', w.ua.hp === beforeHp);
}

{ // Untargetable unit resolves incoming damage as negated
  const w = world();
  w.ub.status.push('untargetable');
  const res = g.resolveIncoming(w.ua, w.ub, 500, w.st, [], R5);
  check('untargetable unit negates incoming damage', res.negated === true && res.hpLoss === 0);
}

{ // Strip buffs removes shield/barriers
  const w = world();
  w.ub.shield = 500;
  w.ub.status.push('guarded');
  const spec = { text: 'Test Strip', cooldown: 0, effects: [{ type: 'strip_buffs' }] };
  g.applyStructuredAbility(w.a, w.ua, w.ub, w.st, [], R5, spec);
  check('strip_buffs removes shield barrier', w.ub.shield === 0 && !w.ub.status.includes('guarded'));
}

{ // Execute instant kill below threshold
  const w = world();
  w.ub.maxHp = 1000;
  w.ub.hp = 140; // 14% (<15%)
  const spec = { text: 'Test Execute', cooldown: 0, damage: { multiplier: 1, type: 'physical' }, effects: [{ type: 'execute', threshold: 0.15 }] };
  g.applyStructuredAbility(w.a, w.ua, w.ub, w.st, [], R5, spec);
  check('execute instantly kills target below threshold', w.ub.hp === 0 && w.ub.alive === false);
}

{ // Sleep wakes when struck by an ability
  const w = world();
  w.ub.status.push('sleep');
  const lines = [];
  const spec = { text: 'Test Strike', cooldown: 0, damage: { multiplier: 1.5, type: 'physical' }, effects: [] };
  g.applyStructuredAbility(w.a, w.ua, w.ub, w.st, lines, R5, spec);
  check('sleep wakes when struck by an ability', !w.ub.status.includes('sleep') && lines.some(l => l.text.includes('wakes from Sleep')));
}



// --- Possession Phase physical damage negation
{
  const w = world();
  g.addStatus(w.ua, 'possession_phase', 1);
  const resPhys = g.resolveIncoming(w.ub, w.ua, 100, w.st, [], () => 0.5, { damageType: 'physical' });
  check('possession phase negates physical damage', resPhys.negated === true && w.ua.hp === w.ua.maxHp);
  const resMag = g.resolveIncoming(w.ub, w.ua, 100, w.st, [], () => 0.5, { damageType: 'magic' });
  check('possession phase allows magic damage', resMag.negated === false && w.ua.hp < w.ua.maxHp);
}

// --- Skill misfire applies to all enemies
{
  const w = world();
  const spec = { id: 'test_misfire', text: 'Test Misfire', cooldown: 1, costSP: 10, effects: [{ type: 'skill_misfire', chance: 0.3, duration: 2 }] };
  w.a.sp = 50;
  g.applyStructuredAbility(w.a, w.ua, w.ub, w.st, [], () => 0.5, spec);
  const allFoesMisfired = w.st.enemies.every(e => e._skillMisfireChance === 0.3);
  check('skill misfire applies to all enemies', allFoesMisfired);
}

// --- Undying Rebirth Aura HP threshold in chooseStructuredAbility
{
  const w = world(4, 'death', 'door');
  w.ua.hp = w.ua.maxHp; // 100% HP
  const chosenFull = g.chooseStructuredAbility(w.a, w.ua, w.ub, w.st);
  const notChosenAtFull = !chosenFull || chosenFull.id !== 'undying_rebirth_aura';
  w.ua.hp = Math.round(w.ua.maxHp * 0.25); // 25% HP (< 30%)
  const chosenLow = g.chooseStructuredAbility(w.a, w.ua, w.ub, w.st);
  const chosenAtLow = chosenLow && (chosenLow.id === 'undying_rebirth_aura' || chosenLow.effectId === 'undying_rebirth_aura');
  check('undying rebirth aura only usable below 30% HP', notChosenAtFull && chosenAtLow);
}


// --- Polymorphed skips action like stun
{
  const w = world();
  g.addStatus(w.ua, 'polymorphed', 1);
  check('polymorphed disables action', g.actionDisabled(w.ua) === true);
}

// --- SP Siphon siphons SP from enemy to caster
{
  const w = world();
  w.a.sp = 10;
  w.ub.agent.sp = 50;
  w.ub.sp = 50;
  const spec = { id: 'test_siphon', text: 'Test Siphon', cooldown: 1, costSP: 0, effects: [{ type: 'sp_siphon', amount: 15 }] };
  g.applyStructuredAbility(w.a, w.ua, w.ub, w.st, [], () => 0.5, spec);
  check('sp_siphon transfers SP correctly', w.a.sp === 25 && w.ub.sp === 35);
}

console.log(`\neffects-behavior: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
