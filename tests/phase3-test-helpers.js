'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(process.env.PHASE3_GAME_ROOT || path.join(__dirname, '..'));
const g = require(path.join(root, 'js/node-loader.js'));
const read = file => JSON.parse(fs.readFileSync(path.join(root, 'data', file), 'utf8'));
const balance = read('balance.json'), formulas = read('formulas.json');
const counters = read('pathways/index.json').counters;
const shipped = Object.fromEntries(g.PATH_KEYS.map(key => [key, read(`pathways/${key}.json`)]));
const BASE = { hp: 10000, atk: 123, def: 97, int: 149 };
const aliases = balance.element_resistance_rules.aliases || {};
function element(key) {
  key = String(key).toLowerCase();
  const seen = new Set();
  while (aliases[key] && !seen.has(key)) { seen.add(key); key = aliases[key]; }
  return key;
}
function resistanceMap(values) {
  const result = {};
  for (const [key, value] of Object.entries(values || {})) {
    const name = element(key);
    result[name] = name in result ? Math.max(result[name], value) : value;
  }
  return result;
}
function passiveEffects(agent) {
  if (!agent?.awakened || !shipped[agent.path]) return [];
  return shipped[agent.path].sequences.filter(t => t.sequence >= agent.sequence && t.ability.kind === 'passive')
    .filter(t => !t.ability.effects.some(e => (e.type === 'combat_rule' && e.rule === 'party') || (e.type === 'targeting' && e.mode === 'all_allies')))
    .flatMap(t => t.ability.effects);
}
function independentModifiers(agent) {
  const m = { atk: 1, def: 1, int: 1, hp: 1, damageTaken: 1, damageTakenByCategory: {}, crit: 0,
    critDamage: .5, initiative: 0, counter: .03, dodge: 0, lifesteal: 0, defPen: 0, spellPen: 0,
    hitChance: 0, resistances: {}, immunities: [], statusResist: {} };
  for (const e of [...passiveEffects(agent), ...(agent?._partyPassiveEffects || [])]) {
    const n = Number(e.amount || 0);
    if (e.type === 'stat_modifier' && e.stat in m) m[e.stat] *= 1 + n;
    else if (e.type === 'damage_taken' || e.type === 'damageTaken') {
      if (e.incomingCategory) m.damageTakenByCategory[e.incomingCategory] = (m.damageTakenByCategory[e.incomingCategory] || 1) * (1 + n);
      else m.damageTaken *= 1 + n;
    } else if (['crit', 'critDamage', 'initiative', 'counter', 'dodge', 'hitChance'].includes(e.type)) m[e.type] += n;
    else if (e.type === 'lifesteal') m.lifesteal += Number(e.ratio ?? n);
    else if (['defPen', 'defense_penetration'].includes(e.type)) m.defPen += n;
    else if (e.type === 'spell_penetration') m.spellPen += n;
    else if (e.type === 'resistance') for (const [key, value] of Object.entries(resistanceMap(e.values || { [e.element]: e.amount }))) m.resistances[key] = (m.resistances[key] || 0) + value;
    else if (e.type === 'immunity') m.immunities.push(e.status);
    else if (e.type === 'status_resistance') m.statusResist[e.status] = (m.statusResist[e.status] || 0) + n;
  }
  for (const key of ['atk', 'def', 'int']) m[key] *= agent?._buffs?.[key] || 1;
  return m;
}
function record(key, rank, id = key || 'victim') {
  const a = g.makeAgent(() => .4, { path: key || 'door', sequence: rank, trait: 'Stout Vitality' });
  Object.assign(a, { id, name: id, path: key, awakened: !!key, stats: { ...BASE }, baseStats: { ...BASE },
    humanStats: { ...BASE }, statVariance: { hp: 1, atk: 1, def: 1, int: 1, speed: 1 }, speedVariance: 1,
    weaponId: 'none', weaponMastery: {}, resistanceBonuses: {}, resistances: {}, injuries: 0,
    sp: 1000, maxSP: 1000, status: [], cooldowns: {}, _teamDamageMultiplier: 1 });
  const u = g.makeCombatUnit(a);
  const agent = u.agent;
  Object.assign(agent, { stats: { ...BASE }, sp: 1000, maxSP: 1000, weaponMastery: {}, resistanceBonuses: {}, _teamDamageMultiplier: 1 });
  u.hp = u.maxHp;
  u.sp = u.maxSP = g.maxSPFor(agent); agent.sp = agent.maxSP = u.maxSP;
  u._formUsed = true; agent._formUsed = true;
  return u;
}
function world(key, rank, team = 'allies') {
  const u = record(key, rank, 'caster'), v = record(null, rank, 'victim'),
    ally = record(null, rank, 'ally'), other = record(null, rank, 'other');
  const state = { allies: team === 'allies' ? [u, ally] : [v, other], enemies: team === 'allies' ? [v, other] : [u, ally],
    events: [], balanceTrace: [], weaponUsage: {}, currentRound: 1, rng: () => .99, battleMarionettes: [], createdMarionettes: [] };
  g.applyPartyPassiveEffects(state.allies); g.applyPartyPassiveEffects(state.enemies);
  return { u, v, ally, other, a: u.agent, b: v.agent, state };
}
function statusMods(unit) {
  const m = { atk: 1, int: 1, def: 1 };
  for (const st of unit?.status || []) {
    if (st === 'inspired') { m.atk *= 1.08; m.int *= 1.05; }
    if (st === 'guarded') m.def *= 1.1;
    if (st === 'weakened') m.atk *= .9;
    if (st === 'freeze' || st === 'curse') m.def *= .9;
  }
  return m;
}
function authorityMultiplier(a, b) {
  let result = 1;
  if (a.sequence !== b.sequence) {
    const gap = b.sequence - a.sequence;
    result = a.sequence <= 4 && b.sequence > a.sequence ? 1.8 : gap >= 3 ? 1.25 : gap >= 1 ? 1.1 : gap <= -3 ? .55 : .88;
  }
  if (a.path && b.path && a.path !== b.path) {
    if (counters[a.path] === b.path) result *= 1.15;
    else if (counters[b.path] === a.path) result *= .88;
  }
  return result;
}
function expectedResistance(target, el) {
  let map;
  if (target.resistances) map = resistanceMap(target.resistances);
  else {
    const agent = target.agent || target; map = resistanceMap(balance.element_resistance_rules.path_resistances[agent.path]);
    for (const source of [independentModifiers(agent).resistances, resistanceMap(agent.resistanceBonuses)])
      for (const [key, value] of Object.entries(source)) map[key] = (map[key] || 0) + value;
  }
  return Math.max(balance.element_resistance_rules.min_resistance, Math.min(balance.element_resistance_rules.max_positive_resistance, map[element(el)] || 0));
}
function expectedDamage(agent, actor, target, spec, { abilityMult, defPen, trueDamage = false, critical = false, critBonus = 0, weaponBonus = 0, strikeMult = 1 } = {}) {
  const d = spec.damage || spec, effects = spec.effects || [], pm = independentModifiers(agent), sm = statusMods(actor), deb = actor?._debuffs || {};
  const ATK = (agent.stats.atk + (agent._stolenAtk || 0)) * pm.atk * sm.atk * (deb.atk || 1);
  const INT = agent.stats.int * pm.int * sm.int * (deb.int || 1), cfg = formulas.hybrid_coefficients;
  const formula = d.formula || spec.formula || 'pure_caster_ability', multi = abilityMult ?? d.multiplier ?? spec.scale ?? 1;
  const components = effects.some(e => e.type === 'damage_component') ? effects.filter(e => e.type === 'damage_component') : d.components;
  let raw, bypass;
  if (formula === 'basic_physical_attack') { raw = (ATK + weaponBonus) * strikeMult; bypass = 0; }
  else if (components?.length) {
    const stats = { ATK, INT, DEF: agent.stats.def, HP: agent.stats.hp };
    raw = stats[String(d.scaling || 'ATK').toUpperCase()] * multi + components.reduce((sum, c) => sum + stats[c.stat] * c.multiplier, 0);
    bypass = cfg.empowered_hybrid_physical.base_def_bypass;
  } else if (formula === 'empowered_hybrid_physical' || formula === 'empowered_hybrid_agility') {
    raw = (ATK * cfg[formula].atk_mult + INT * cfg[formula].int_mult) * multi; bypass = cfg[formula].base_def_bypass;
  } else { raw = INT * multi; bypass = cfg.pure_caster_ability.base_def_bypass; }
  raw *= authorityMultiplier(agent, target.agent || target) * (actor?._formBoost || 1)
    * (actor?._outgoingMultiplier ?? agent._outgoingMultiplier ?? 1) * (agent._teamDamageMultiplier ?? 1) * (1 + (actor?._weaknessBonus || 0));
  const explicitPen = defPen ?? effects.filter(e => ['defPen', 'defense_penetration'].includes(e.type)).reduce((sum, e) => sum + e.amount, 0);
  bypass = Math.min(1, bypass + explicitPen + pm.defPen + (actor?._defPenBonus || 0)
    + ((formula === 'pure_caster_ability' || d.scaling === 'INT') ? pm.spellPen : 0));
  const isTrue = trueDamage || d.type === 'true' || effects.some(e => e.type === 'damage_rule' && ['true', 'psychic_true'].includes(e.rule));
  let final;
  if (isTrue) final = Math.max(1, Math.round(raw));
  else {
    const els = d.elements?.length ? d.elements : d.type === 'elemental' && (!d.element || d.element === 'physical') ? ['fire', 'water', 'lightning', 'frost'] : [d.element || 'physical'];
    const resistance = els.reduce((sum, el) => sum + expectedResistance(target, el), 0) / els.length;
    const ta = target.agent || target, tm = independentModifiers(ta);
    const defense = (ta.stats?.def || target.def || 10) * tm.def * statusMods(target).def * (target._debuffs?.def || 1);
    final = Math.max(1, Math.round(raw * (1 - resistance / 100) - defense * (1 - bypass) * cfg.def_armor_mitigation.factor));
  }
  if (critical) final = Math.round(final * (1 + pm.critDamage + (formula === 'basic_physical_attack' ? 0 :
    Number(agent._abilityCritDamageBonus || 0) + critBonus + effects.filter(e => e.type === 'critDamage').reduce((sum, e) => sum + e.amount, 0))));
  if (target._vulnerability) final = Math.round(final * target._vulnerability);
  return final;
}
module.exports = { g, assert, record, world, independentModifiers, expectedDamage, exercisePassive };

function rng(values = []) { let i = 0; return () => values[i++] ?? .99; }
function incomingFactor(target, damageType) {
  const m = independentModifiers(target.agent || target), type = element(damageType), physical = ['physical', 'piercing'].includes(type);
  let factor = m.damageTaken;
  for (const [category, value] of Object.entries(m.damageTakenByCategory)) {
    if (category === 'all' || (category === 'physical' && physical) || (category === 'magic' && !physical && type !== 'true') || element(category) === type) factor *= value;
  }
  return factor;
}
function oracleTarget(target) {
  const agent = target.agent || target, values = resistanceMap(balance.element_resistance_rules.path_resistances[agent.path]);
  for (const map of [independentModifiers(agent).resistances, resistanceMap(agent.resistanceBonuses)])
    for (const [el, value] of Object.entries(map)) values[el] = (values[el] || 0) + value;
  return { ...target, agent, resistances: values };
}
const basicSpec = { damage: { formula: 'basic_physical_attack', scaling: 'ATK', type: 'physical', multiplier: 1 }, effects: [] };
const liveSpec = (key, rank) => g.tierFor(key, rank).abilities[0];
function hitThreshold(attacker, target) {
  const a = attacker.agent, t = target.agent, pm = independentModifiers(a), tm = independentModifiers(t), rates = formulas.combat_rates;
  const dodge = Math.min(rates.dodge.max_rate, rates.dodge.base_rate + rates.dodge.int_scaling_num * t.stats.int / (t.stats.int + rates.dodge.int_scaling_denom) + tm.dodge);
  return Math.max(.03, Math.min(rates.dodge.max_rate, .05 + (t.stats.int - a.stats.int) / a.stats.int * .25 + dodge - pm.hitChance));
}
function exercisePassive(key, rank, team = 'allies') {
  const spec = liveSpec(key, rank), authored = shipped[key].sequences.find(t => t.sequence === rank).ability;
  assert.equal(spec.type, 'passive', `${key} ${rank} is a passive fixture`);
  let count = 1;
  const eq = (actual, expected, message) => { count++; assert.equal(actual, expected, `${key} ${rank} ${team}: ${message}`); };
  const ok = (condition, message) => { count++; assert(condition, `${key} ${rank} ${team}: ${message}`); };
  const fresh = () => world(key, rank, team);
  const party = authored.effects.some(e => e.type === 'targeting' && e.mode === 'all_allies');
  const withPartyOracle = unit => {
    if (!party) return unit.agent;
    return { ...unit.agent, _partyPassiveEffects: authored.effects.filter(e => e.type !== 'combat_rule') };
  };
  const basic = (w, actor = w.u, victim = w.v, draws = []) => {
    const before = victim.hp, agent = withPartyOracle(actor);
    const landed = g.attackOnce(actor.agent, actor, victim, w.state, [], rng(draws));
    if (landed) {
      const critical = w.state.balanceTrace.at(-1).critical === true;
      const expected = expectedDamage(agent, actor, oracleTarget(victim), basicSpec, { critical });
      eq(before - victim.hp, Math.round(expected * incomingFactor(victim, 'physical')), 'basic attack HP loss matches independent inherited passive totals');
    }
    return landed;
  };
  const cast = (w, actor, victim, spell, draws = []) => {
    const before = victim.hp;
    ok(g.applyStructuredAbility(actor.agent, actor, victim, w.state, [], rng(draws), spell), `casts shipped ${spell.effectId}`);
    const trace = w.state.balanceTrace.findLast(t => t.target === victim.name);
    ok(!!trace, 'cast reached the damage pipeline');
    const expected = expectedDamage(withPartyOracle(actor), actor, oracleTarget(victim), spell, { critical: !!trace.critical });
    const type = spell.effects.some(e => e.type === 'damage_rule' && ['true', 'psychic_true'].includes(e.rule)) ? 'true' : spell.damage.element || spell.damage.type;
    eq(before - victim.hp, Math.round(expected * incomingFactor(victim, type)), 'shipped spell HP loss matches independent passive totals');
  };
  const inherited = fresh(), inheritedMods = independentModifiers(withPartyOracle(inherited.u));
  eq(inherited.u.maxHp, Math.round(BASE.hp * inheritedMods.hp), 'combat creation includes the complete inherited Max HP total');
  inherited.u.hp -= 2000;
  const healthBefore = inherited.u.hp;
  ok(basic(inherited), 'inherited ATK and penetration affect a real attack');
  const dealt = inherited.state.events.find(ev => ev.type === 'damage' && ev.actorId === inherited.u.id).amount;
  eq(inherited.u.hp - healthBefore, Math.round(dealt * inheritedMods.lifesteal), 'inherited lifesteal heals from the real attack');
  const outgoing = fresh(); cast(outgoing, outgoing.u, outgoing.v, liveSpec('fool', 8));
  const incoming = fresh(); cast(incoming, incoming.v, incoming.u, liveSpec('paragon', 6));
  if (inheritedMods.dodge > 0 && !authored.effects.some(e => e.type === 'dodge')) {
    for (const dodge of [true, false]) {
      const w = fresh(), draw = hitThreshold(w.v, w.u) + (dodge ? -1e-6 : 1e-6);
      eq(basic(w, w.v, w.u, [draw]), !dodge, 'inherited Dodge changes a real attack at its independent threshold');
    }
  }
  if ((inheritedMods.crit > 0 || inheritedMods.critDamage !== .5) && !authored.effects.some(e => ['crit', 'critDamage'].includes(e.type))) {
    const threshold = Math.min(.95, formulas.combat_rates.crit.base_rate + inheritedMods.crit);
    for (const [draw, critical] of [[threshold - 1e-6, true], [threshold + 1e-6, false]]) {
      const w = fresh(); ok(basic(w, w.u, w.v, [.99, .99, draw]), 'inherited critical threshold probe lands');
      eq(!!w.state.balanceTrace.at(-1).critical, critical, 'inherited critical chance and damage affect a real attack');
    }
  }
  for (const e of authored.effects) {
    const number = e.type === 'initiative' ? e.amount : e.type === 'resistance' ? null : e.hpRatio ?? e.ratio ?? e.amount;
    if (number != null) {
      const value = Math.round(Math.abs(number) * (e.type === 'initiative' ? 1 : 100));
      ok(spec.text.includes(`${value}%`) || spec.text.includes(`${value} percentage points`), `${e.type} generated text discloses its live number`);
    }
    if (e.type === 'stat_modifier') {
      const w = fresh();
      if (e.stat === 'hp') eq(w.u.maxHp, Math.round(BASE.hp * independentModifiers(w.a).hp), 'combat creation applies inherited Max HP passives');
      else if (e.stat === 'atk') ok(basic(w), 'ATK passive affects a real basic attack');
      else if (e.stat === 'def') ok(basic(w, w.v, w.u), 'DEF passive mitigates a real incoming basic attack');
      else if (e.stat === 'int') cast(w, w.u, w.v, liveSpec('fool', 8));
    } else if (e.type === 'crit' || e.type === 'critDamage') {
      const threshold = Math.min(.95, formulas.combat_rates.crit.base_rate + independentModifiers(withPartyOracle(fresh().u)).crit);
      for (const [draw, critical] of [[threshold - 1e-6, true], [threshold + 1e-6, false]]) {
        const w = fresh(); ok(basic(w, w.u, w.v, [.99, .99, draw]), 'critical threshold probe lands');
        eq(!!w.state.balanceTrace.at(-1).critical, critical, 'real basic critical roll uses inherited chance');
      }
      if (party) {
        const w = fresh(); ok(basic(w, w.ally, w.v, [.99, .99, threshold - 1e-6]), 'shared critical passive affects a teammate');
        eq(!!w.state.balanceTrace.at(-1).critical, true, 'teammate rolls against the shared critical chance');
      }
    } else if (e.type === 'dodge' || e.type === 'hitChance') {
      for (const dodge of [true, false]) {
        const w = fresh(), actor = e.type === 'dodge' ? w.v : w.u, victim = e.type === 'dodge' ? w.u : w.v;
        const draw = hitThreshold(actor, victim) + (dodge ? -1e-6 : 1e-6), before = victim.hp;
        eq(basic(w, actor, victim, [draw]), !dodge, 'real hit/dodge roll changes at the independently calculated threshold');
        if (dodge) eq(victim.hp, before, 'dodged attack preserves HP');
      }
      if (party) {
        const w = fresh(), oracleActor = { ...w.ally, agent: withPartyOracle(w.ally) }, draw = hitThreshold(oracleActor, w.v) + 1e-6;
        ok(basic(w, w.ally, w.v, [draw]), 'shared hit bonus lets the teammate land the boundary attack');
      }
    } else if (e.type === 'defPen' || e.type === 'defense_penetration') {
      const w = fresh(); ok(basic(w), 'passive penetration affects a real basic attack');
      const spellWorld = fresh(); cast(spellWorld, spellWorld.u, spellWorld.v, liveSpec('fool', 8));
    } else if (e.type === 'spell_penetration') {
      const w = fresh(); cast(w, w.u, w.v, liveSpec('fool', 8));
    } else if (e.type === 'resistance') {
      const values = resistanceMap(e.values || { [e.element]: e.amount });
      for (const [el, value] of Object.entries(values)) {
        ok(spec.text.includes(`${Math.round(value)}%`), 'resistance description links to its percentage points');
        const w = fresh();
        if (el === 'physical') ok(basic(w, w.v, w.u), 'canonical physical resistance mitigates a real attack');
        else {
          const probes = { water: ['tyrant', 8], lightning: ['tyrant', 6], frost: ['demoness', 4], decay: ['twilight_giant', 2],
            poison: ['demoness', 7], piercing: ['paragon', 8], corrosion: ['error', 6], fire: ['paragon', 6] };
          ok(!!probes[el], `a shipped active probes ${el} resistance`);
          if(el==='corrosion') {
            // Rust Siphon requires its actual Sequence 6 theft prerequisites.
            const attacker=record('error',6,'corrosion caster'),witness=record('fool',8,'witness');
            for(const side of ['allies','enemies'])w.state[side]=w.state[side].map(unit=>unit===w.v?attacker:unit===w.ally?witness:unit);
            w.v=attacker;w.b=attacker.agent;
            ok(g.applyStructuredAbility(witness.agent,witness,attacker,w.state,[],()=>.99,liveSpec('fool',8)),'Corrosion caster witnesses a real eligible source');
            g.setMeterValue(attacker.agent,'error',100);
          }
          cast(w, w.v, w.u, liveSpec(...probes[el]));
        }
      }
    } else if (e.type === 'damage_taken' || e.type === 'damageTaken') {
      for (const type of ['physical', 'shadow', 'fire', 'true']) {
        const w = fresh(), before = w.u.hp, damage = 333;
        g.resolveIncoming(w.v, w.u, damage, w.state, [], () => .99, { damageType: type, trueDamage: type === 'true' });
        eq(before - w.u.hp, Math.round(damage * incomingFactor(w.u, type)), `incoming ${type} HP loss honors passive damage category`);
      }
    } else if (e.type === 'immunity') {
      const w = fresh();
      g.addStatus(w.u, e.status, 2, w.v.name); eq(g.hasStatus(w.u, e.status), false, `incoming ${e.status} cannot afflict the unit`);
      g.addStatus(w.v, e.status, 2, w.u.name); eq(g.hasStatus(w.v, e.status), true, `ordinary victim remains susceptible to ${e.status}`);
      if (e.status === 'taunt') {
        w.v._taunt = 2;
        eq(g.tauntFilter(w.u, [w.v, w.other]).length, 2, 'taunt immunity preserves both legal attack targets');
      }
    } else if (e.type === 'status_resistance') {
      const threshold = Math.min(1, independentModifiers(fresh().a).statusResist[e.status]);
      for (const resisted of [true, false]) {
        const w = fresh(), prototype = structuredClone(liveSpec('demoness', 7));
        // No shipped active inflicts Fear; use its status in the real spell status pipeline.
        prototype.effects = [{ type: 'status', status: e.status, duration: 2 }];
        const draw = threshold + (resisted ? -1e-6 : 1e-6);
        ok(g.applyStructuredAbility(w.b, w.v, w.u, w.state, [], rng([.99, .99, .99, draw]), prototype), 'casts a real spell through the status-resistance pipeline');
        eq(g.hasStatus(w.u, e.status), !resisted, 'actual status changes at the independent passive-resistance threshold');
      }
    } else if (e.type === 'lifesteal') {
      const w = fresh(); w.u.hp -= 2000; const before = w.u.hp;
      ok(basic(w), 'lifesteal basic attack lands');
      const dealt = w.state.events.find(ev => ev.type === 'damage' && ev.actorId === w.u.id).amount;
      eq(w.u.hp - before, Math.round(dealt * independentModifiers(w.a).lifesteal), 'real basic lifesteal heals from actual damage');
    } else if (e.type === 'revive' && e.self) {
      const w = fresh(); w.a.sp = 100;
      g.resolveIncoming(w.v, w.u, w.u.hp + 1, w.state, [], () => .99, { execute: true, damageType: 'true' });
      eq(w.u.alive, true, 'fatal incoming damage triggers the passive revive');
      eq(w.u.hp, Math.round(w.u.maxHp * e.hpRatio), 'revive restores the disclosed Max HP fraction');
      eq(w.a.sp, e.consumeAllSP ? 0 : Math.max(formulas.revive_rules.sp_floor, Math.round(100 * formulas.revive_rules.sp_retention_ratio)), 'revive applies its resource rule');
      if (e.exhaustionDuration) {
        eq(g.hasStatus(w.u, 'spiritual_exhaustion'), true, 'revive inflicts Spiritual Exhaustion');
        eq(w.u.statusMeta.spiritual_exhaustion.duration, e.exhaustionDuration, 'exhaustion lasts the disclosed duration');
      }
      g.resolveIncoming(w.v, w.u, w.u.hp + 1, w.state, [], () => .99, { execute: true, damageType: 'true' });
      eq(w.u.alive, false, 'the passive cannot revive a second time');
      eq(w.state.events.filter(ev => ev.type === 'revive').length, 1, 'only one passive revive event occurs');
    } else if (e.type === 'debuff') {
      const w = fresh(); g.applyPassiveAuras([w.u], w.state);
      ok(basic(w, w.v, w.u), 'aura lowers enemy real attack damage');
      ok(basic(w, w.u, w.other), 'aura lowers second enemy armor on a real attack');
      eq(w.v._debuffs[e.stat], 1 - e.amount, `aura applies ${e.stat} to the first enemy`);
      eq(w.other._debuffs[e.stat], 1 - e.amount, `aura applies ${e.stat} to the second enemy`);
    } else if (e.type === 'initiative') {
      const w = fresh(), competitor = record(key, rank, 'competitor').agent;
      competitor.awakened = false; competitor.speedVariance = 1.05;
      const q = { name: 'Passive initiative probe', difficultySequence: rank, enemyCount: 1, encounter: true,
        rewards: { funds: 0, reputation: 0, materials: {} }, dayCost: 1 };
      const opponent = { path: key, sequence: rank, name: 'enemy caster', trait: 'Stout Vitality', weaponId: 'none', stats: { ...BASE, int: team === 'allies' ? 1 : BASE.int } };
      const result = g.resolveQuest(team === 'allies' ? [w.a, competitor] : [competitor], q, 731,
        { authoredOpponents: [opponent], individual: true });
      const first = result.events.find(ev => ev.type === 'cast');
      eq(first.actorId, team === 'allies' ? 'caster' : 'enemy_0', 'initiative passive gives the first real action over a 5% faster competitor');
      const baseSpeed = balance.archetype_stat_progression[shipped[key].archetype][`Seq ${rank}`].spd;
      const speed = baseSpeed + BASE.int * formulas.speed_and_turn_order.stat_weights.int + BASE.atk * formulas.speed_and_turn_order.stat_weights.atk;
      const expected = speed * (1 + independentModifiers(w.a).initiative / 100);
      ok(result.events.find(ev => ev.subtype === 'initiative').details.includes(expected.toFixed(1)), 'turn-order event discloses independent initiative total');
    } else if (e.type !== 'targeting' && e.type !== 'combat_rule') throw new Error(`Uncovered passive effect ${e.type}`);
  }
  return count;
}
