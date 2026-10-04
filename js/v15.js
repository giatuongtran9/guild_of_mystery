// ===== v15.js =====
// Builds combat-ready ability specs from JSON definitions loaded at startup.
const v15Key = n => n.toLowerCase().replace(/[^a-z]+/g,'_').replace(/^_|_$/g,'');
const V15_SEQ_NAMES = G9D.pathways.sequence_names;
const V15_EXTRA = G9D.pathways.extras;
const SP_TABLE = {};
for (const [arch, rows] of Object.entries(V15_DATA.archetype_stat_progression)) {
  for (const [label, s] of Object.entries(rows)) {
    const n = Number(label.replace(/\D/g,''));
    STAT_TABLE[n] = STAT_TABLE[n] || {};
    STAT_TABLE[n][arch] = [s.hp, s.atk, s.def, s.int, s.spd];
    (SP_TABLE[n] = SP_TABLE[n] || {})[arch] = { max: s.max_sp, regen: s.sp_regen };
  }
}
function spTableFor(agent){ const seq=Math.max(0,Math.min(9,agent?.sequence??9)); return (SP_TABLE[seq]||SP_TABLE[9])[archetypeOf(agent?.path)] || {max:100,regen:10}; }
function parseV15Ability(ab, archetype, pathKey) {
  const d = ab.description || ab.text || '';
  const num = re => { const x = d.match(re); return x ? Number(x[1]) / 100 : 0; };
  const passive = /^passive/i.test(ab.type||'');
  const effects = Array.isArray(ab.effects) ? ab.effects : [];
  let damage = ab.damage || null;
  if(!damage && !passive){
    const scale = num(/(\d+(?:\.\d+)?)%\s*(?:ATK|INT)/i);
    if(scale) damage={scaling:/ATK/i.test(d)?'ATK':'INT',multiplier:scale,type:'physical',element:null,formula:'pure_caster_ability'};
  }
  return { type:ab.type||'passive', id:ab.id||ab.effectId||`${pathKey}_${ab.sequence||0}`, text:d, sp:Number(ab.costSP||0), cd:Number(ab.cooldown||0), damage, effects, scale:damage?.multiplier||0, stat:damage?.scaling||'INT', damageType:damage?.type==='elemental'?(damage.element||'elemental'):(damage?.type||'Physical'), formula:damage?.formula||'pure_caster_ability', tag:ab.tag||null };
}

// Pathway abilities are authoritative in data/pathways.json; no JS ability table is generated here.
normalizeAbilities();

// ---- v15 damage formulas ---------------------------------------------------
const V15_FORMULAS = V15_DATA.damage_formulas;
const MYTHIC = V15_DATA.mythical_creature_form_rules;
function v15Mods(agent, actor) {
  const pm = passiveCombatModifier(agent), sm = statusCombatModifier(actor), deb = actor?._debuffs || {};
  return { atk: pm.atk * sm.atk * (deb.atk || 1), int: pm.int * sm.int * (deb.int || 1) };
}
// Returns final damage after DEF mitigation (Defender_DEF * 0.5, reduced by the formula's bypass).
function v15Damage(kind, { agent, actor, target, abilityMult = 1, weaponBonus = 0, strikeMult = 1, defPen = 0, trueDamage = false, psychicTrue = false, damageSpec = null, trace = null }) {
  const st=agent.stats, mod=v15Mods(agent,actor);
  if (mod.defPen) defPen += mod.defPen;
  if (actor && actor._defPenBonus) defPen += actor._defPenBonus;
  if (kind==='pure_caster_ability'||String(damageSpec?.scaling||'').toUpperCase()==='INT') { const sp=passiveCombatModifier(agent).spellPen; if (sp) defPen += sp; }
  const ATK=(st.atk||0)+(agent._stolenAtk||0), INT=st.int||0;
  const seqMult=damageMultiplier(agent.sequence,target.sequence,agent.path,target.path);
  const spec=damageSpec||{};
  const tpm=passiveCombatModifier(target.agent||target);
  const formula=spec.formula||kind;
  let raw=0,bypass=0;
  const components=Array.isArray(spec.components)?spec.components:[];

  const hybridCfg = G9D?.formulas?.hybrid_coefficients || {};
  const physCfg = hybridCfg.empowered_hybrid_physical || { atk_mult: 1.05, int_mult: 0.30, base_def_bypass: 0.22 };
  const agiCfg = hybridCfg.empowered_hybrid_agility || { atk_mult: 0.85, int_mult: 0.55, base_def_bypass: 0.22 };
  const casterBypass = Number(hybridCfg.pure_caster_ability?.base_def_bypass ?? 0.25);
  const defFactor = Number(hybridCfg.def_armor_mitigation?.factor ?? 0.5);

  if(formula==='basic_physical_attack') raw=(ATK*mod.atk+weaponBonus)*strikeMult*seqMult;
  else if(components.length){ const primary=String(spec.scaling||'ATK').toUpperCase(); const primaryTerm=primary==='INT'?INT*mod.int:ATK*mod.atk; raw=primaryTerm*abilityMult*seqMult+components.reduce((sum,c)=>sum+(c.stat==='ATK'?ATK*mod.atk:(c.stat==='DEF'?(st.def||0):(c.stat==='HP'?(st.hp||0):INT*mod.int)))*Number(c.multiplier||0),0)*abilityMult*seqMult; bypass=physCfg.base_def_bypass; }
  else if(formula==='empowered_hybrid_physical') { raw=(ATK*mod.atk*physCfg.atk_mult+INT*physCfg.int_mult*mod.int)*abilityMult*seqMult; bypass=physCfg.base_def_bypass; }
  else if(formula==='empowered_hybrid_agility') { raw=(ATK*mod.atk*agiCfg.atk_mult+INT*agiCfg.int_mult*mod.int)*abilityMult*seqMult; bypass=agiCfg.base_def_bypass; }
  else { raw=INT*abilityMult*mod.int*seqMult; bypass=casterBypass; }
  raw*=(actor?._formBoost||1)*(agent._outgoingMultiplier||1)*((actor&&actor!==agent)?(actor._outgoingMultiplier||1):1);
  if(actor?._weaknessBonus) raw*=1+actor._weaknessBonus;
  if(trueDamage||psychicTrue||spec.type==='true') bypass=1;
  bypass=Math.min(1,bypass+defPen);
  if(spec.type==='true') {
    const finalTrue=Math.max(1,Math.round(raw));
    if(trace){ trace.raw=raw; trace.resistance=0; trace.afterResistance=raw; trace.defense=0; trace.defenseReduction=0; trace.finalBeforeEffects=finalTrue; trace.final=finalTrue; trace.isTrue=true; }
    return finalTrue;
  }
  const aliasMap=(G9D.balance.element_resistance_rules||{}).aliases||{};
  const rawElements=spec.elements?.length?spec.elements:((spec.type==='elemental'&&(!spec.element||spec.element==='physical'))?['fire','water','lightning','frost']:[spec.element||'physical']);
  const elements=rawElements.map(x=>{x=String(x).toLowerCase();return aliasMap[x]||x;});
  const resist=elements.reduce((sum,el)=>sum+elementResistance(target,el),0)/Math.max(1,elements.length);
  const resisted=raw*(1-resist/100);
  const def=(target.agent?.stats?.def||target.def||10)*(tpm.def||1)*(statusCombatModifier(target).def||1)*(target._debuffs?.def||1);
  const defenseReduction=def*(1-bypass)*defFactor;
  const final=Math.max(1,Math.round(resisted-defenseReduction));
  if(trace){ trace.raw=raw; trace.resistance=resist; trace.afterResistance=resisted; trace.defense=def; trace.defenseReduction=defenseReduction; trace.finalBeforeEffects=final; trace.final=final; trace.isTrue=false; trace.defPen=bypass; trace.elements=elements; }
  return final;
}
function elementResistance(target,element){
  const base=Number(target.resistances?.[element]??0);
  const max=G9D.balance.element_resistance_rules?.max_positive_resistance??90;
  const min=G9D.balance.element_resistance_rules?.min_resistance??-100;
  return Math.max(min,Math.min(max,base));
}
function applyPathResistances(unit,path){
  const defaults=G9D.balance.element_resistance_rules?.path_resistances?.[path]||{};
  unit.resistances={...(unit.resistances||{}),...defaults};
  return unit.resistances;
}
function tryRevive(t, lines, state) {
  if (t.alive || !t.agent) return;
  const spec = unlockedAbilities(t.agent).find(x => (x.effects||[]).some(e => e.type==='revive'));
  if (!spec || t._revived) return;
  const revRules = G9D?.formulas?.revive_rules || {};
  const defaultHpRatio = Number(revRules.default_hp_ratio ?? 0.25);
  const spFloor = Number(revRules.sp_floor ?? 20);
  const spRatio = Number(revRules.sp_retention_ratio ?? 0.5);
  const rev = (spec.effects||[]).find(e => e.type==='revive' && e.self) || (spec.effects||[]).find(e => e.type==='revive');
  t._revived = true; t.alive = true; t.hp = Math.max(1, Math.round(t.maxHp * Number(rev?.hpRatio || defaultHpRatio)));
  if (t.agent) t.agent.sp = Math.max(spFloor, Math.round((t.agent.sp || 0) * spRatio));
  let msg = rev?.reviveText
    ? rev.reviveText.replace('{name}', t.name).replace('{hp}', t.hp)
    : `${t.name} is revived by ${spec.text.split(' — ')[0]} with ${t.hp} HP.`;
  lines.push({ text: msg, kind: 'quirk' });
  if (state && typeof emitCombatEvent === 'function') {
    emitCombatEvent(state, {
      round: state.currentRound || 1,
      type: 'heal',
      actorId: t.id,
      actorName: t.name,
      actorTeam: teamOf(t, state),
      targetId: t.id,
      targetName: t.name,
      targetTeam: teamOf(t, state),
      amount: t.hp,
      hpAfter: t.hp,
      text: msg
    });
  }
}
// Mythical Creature Form: Seq 4+, once per battle, 50 SP; +30% Max HP shield, +20% all damage,
// and every turn each enemy has a 20% chance to lose its turn. Abilities remain castable.
function tryMythicalForm(agent, actor, state, lines, r) {
  const unit = actor || agent;
  const ag = agent || unit?.agent || unit;
  if (!unit || !ag || unit._formUsed) return;

  const spCost = Number(MYTHIC?.sp_cost ?? 0);
  const unlockedSeq = Number(MYTHIC?.unlocked_at_sequence ?? 4);
  const hpThreshold = Number(MYTHIC?.hp_threshold ?? 0.50);
  const shieldRatio = Number(MYTHIC?.shield_ratio ?? 0.30);
  const damageBonus = Number(MYTHIC?.damage_bonus ?? 0.20);
  const pollutionChance = Number(MYTHIC?.mental_pollution_chance ?? 0.20);

  if (spCost > 0 && Number(ag.sp || 0) < spCost) return;

  const unlocked = Number(ag.sequence) <= unlockedSeq;
  const hpRatio = unit.hp / Math.max(1, unit.maxHp);
  if (!unlocked || hpRatio > hpThreshold) return;

  if (spCost > 0) ag.sp -= spCost;
  unit._formUsed = true;
  unit._inForm = true;
  unit._formBoost = Math.max(unit._formBoost || 1, 1 + damageBonus);
  const sh = Math.round(unit.maxHp * shieldRatio);
  unit.shield = Math.max(unit.shield || 0, sh);
  const formName = (typeof pathOf === 'function' ? pathOf(ag.path)?.mythicalForm : null) || 'a mythical creature';
  const bonusPct = Math.round(damageBonus * 100);
  const desc = `MYTHICAL FORM: ${unit.name} awakens ${formName} (+${sh} HP shield, +${bonusPct}% damage).`;
  lines.push({ text: desc, kind: 'action' });

  if (state && typeof emitCombatEvent === 'function') {
    emitCombatEvent(state, {
      round: state.currentRound || 1,
      type: 'story',
      subtype: 'mythical_form',
      inTurn: !!state._mythicalFromHit,
      actorId: unit.id,
      actorName: unit.name,
      actorTeam: teamOf(unit, state),
      text: desc
    });
    emitCombatEvent(state, {
      round: state.currentRound || 1,
      type: 'shield',
      actorId: unit.id,
      actorName: unit.name,
      actorTeam: teamOf(unit, state),
      targetId: unit.id,
      targetName: unit.name,
      targetTeam: teamOf(unit, state),
      amount: sh,
      shieldAfter: unit.shield,
      text: desc
    });
  }

  if (r && r() < pollutionChance) {
    for (const f of foesOf(unit, state)) {
      if (f.alive) {
        addStatus(f, 'stunned', 1, unit.name);
        const stunTxt = `${f.name} is overwhelmed by mental pollution and loses a turn.`;
        lines.push({ text: stunTxt, kind: 'status' });
        if (state && typeof emitCombatEvent === 'function') {
          emitCombatEvent(state, {
            round: state.currentRound || 1,
            type: 'status',
            actorId: unit.id,
            actorName: unit.name,
            actorTeam: teamOf(unit, state),
            targetId: f.id,
            targetName: f.name,
            targetTeam: teamOf(f, state),
            text: stunTxt
          });
        }
      }
    }
  }
}
