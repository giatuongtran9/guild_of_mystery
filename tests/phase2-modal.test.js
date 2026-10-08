// Render the shipped dossier with real game data; navigation state is local UI state.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const g = require('../js/node-loader');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/ui.js'), 'utf8');
const pathSource = fs.readFileSync(path.join(root, 'js/paths.js'), 'utf8');
const weaponHelpers = ['masteryKey', 'weaponMasteryValue', 'weaponStats', 'weaponFor'].map(name => pathSource.match(new RegExp('^function ' + name + '\\(.*$', 'm'))[0]).join('\n');
const weaponUI = new Function('env', `with (env) { ${weaponHelpers} return {weaponStats, weaponFor}; }`)(g);
const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
let passed = 0, failed = 0;
function test(label, fn) { try { fn(); passed++; console.log(`PASS ${label}`); } catch (e) { failed++; console.log(`FAIL ${label}: ${e.message}`); } }
function agent(p = 'white_tower', seq = 5) {
  const a = g.makeAgent(() => .5, {path: p, sequence: seq, trait: 'Stout Vitality'});
  a.id = 'modal_agent'; a.name = 'Mara Vale'; a.recommendedPath = p;
  a.weaponId = 'knife'; a.weaponMastery = {weapon: 3}; a.injuries = 31; a.digest = 63;
  a.abilityHistory = Array.from({length: 10 - seq}, (_, i) => {
    const n = 9 - i, tier = g.tierFor(p, n), ab = tier.abilities[0];
    return {sequence: n, name: tier.name, ability: ab.text, type: ab.type, effectId: ab.effectId, damage: ab.damage, effects: ab.effects};
  });
  g.restatAgent(a); return a;
}
function ui(a, type = 'active', rank = null) {
  const state = g.newGame(); state.roster = [a]; state.funds = 10000;
  const displayStart = source.indexOf('function combatDisplayStats(a)'), displayEnd = source.indexOf('function statPair(', displayStart);
  const start = source.indexOf('function dossier()'), end = source.indexOf('function assignmentModal()', start);
  const env = {...g, state, selected: a.id, dossierSkillType: type, dossierSkillSequence: rank,
    TRAITS: JSON.parse(fs.readFileSync(path.join(root, 'data/enemies.json'))).TRAITS,
    pathName: p => g.pathOf(p).name, esc,
    getCombatSprite: (unit, options) => `<img data-sprite-path="${esc(unit.path)}" data-sprite-variant="${options.variant}" width="${options.width || 384}" height="${options.height || 384}" alt="${esc(unit.name)}">`,
    statusBar: (label, value) => `<div data-meter="${label}">${Math.round(value || 0)}/100</div>`,
    equipmentPicker: a => `<label>Equip Weapon<select onchange="window.G9.setWeapon(${esc(JSON.stringify(a.id))},this.value)"><option>${weaponUI.weaponFor(a).name}</option></select></label>`};
  return new Function('env', `with(env) { ${weaponHelpers} ${source.slice(displayStart, displayEnd)} ${source.slice(start, end)} return dossier(); }`)(env);
}
test('compact dialog has a labeled identity portrait and preserved digestion progression', () => {
  const html = ui(agent());
  assert(html.includes('role="dialog"') && html.includes('aria-modal="true"'));
  assert(html.includes('aria-labelledby="dossier-title"'));
  assert(html.includes('data-sprite-variant="dossier"'));
  assert(html.includes('Mara Vale') && html.includes('63/100'));
});
test('Active and Passive tabs expose exactly one selected skill panel', () => {
  const html = ui(agent());
  assert(html.includes('role="tablist"'));
  assert(html.includes('id="dossier-tab-active"') && html.includes('id="dossier-tab-passive"'));
  assert(html.includes('role="tabpanel"') && html.includes('aria-labelledby="dossier-tab-active"'));
  assert.strictEqual((html.match(/aria-selected="true"/g) || []).length, 1);
});
test('chosen active rank description is shown and other ranks remain selectable', () => {
  const a = agent('white_tower', 4), html = ui(a, 'active', 6);
  const chosen = g.tierFor(a.path, 6), another = g.tierFor(a.path, 8);
  assert(html.includes('<h3>Sequence 6 — ' + esc(chosen.name) + '</h3>'));
  assert(html.includes(esc(chosen.abilities[0].text)));
  assert(html.includes(esc(another.name)) && html.includes('dossierSkillSequence'));
});
test('passive tab uses authored types even when legacy ability history lacks type fields', () => {
  const a = agent('white_tower', 5); a.abilityHistory.forEach(x => delete x.type);
  const html = ui(a, 'passive', 7);
  assert(html.includes('aria-labelledby="dossier-tab-passive"'));
  assert(html.includes('<h3>Sequence 7 — Detective</h3>'));
  assert(html.includes(esc(g.tierFor(a.path, 7).abilities[0].text)));
});
test('equipment, advancement, treatment, conditions and complete history remain reachable', () => {
  const a = agent(); a.history = [{day: 1, text: 'Old chapter'}, {day: 2, text: 'Newest chapter'}];
  const html = ui(a);
  assert(html.includes("window.G9.setWeapon(&quot;modal_agent&quot;,this.value)"));
  assert(html.includes("window.G9.advance(&quot;modal_agent&quot;)"));
  assert(html.includes("window.G9.heal(&quot;modal_agent&quot;)"));
  for (const label of ['Madness', 'Corruption', 'Injuries', 'Combat Trait', 'Individual Variance', 'Old chapter', 'Newest chapter', 'Requirements']) assert(html.includes(label), label);
});
test('injured effective stats and combat rates remain identical to actual combat without mutating save data', () => {
  const a = agent('abyss', 7), before = JSON.stringify(a), unit = g.makeCombatUnit(a), pm = g.passiveCombatModifier(unit.agent);
  const html = ui(a), expected = {HP: unit.maxHp, ATK: Math.round(unit.stats.atk * pm.atk + weaponUI.weaponStats(unit.agent).atk), DEF: Math.round(unit.stats.def * pm.def), INT: Math.round(unit.stats.int * pm.int)};
  for (const [key, val] of Object.entries(expected)) assert(html.includes(`<span>${key}</span><b>${val}</b>`), key);
  const cr = g.combatRates(unit.agent, unit);
  assert(html.includes(`Speed ${cr.speed.toFixed(1)} · AV ${cr.av.toFixed(1)}`));
  assert.strictEqual(JSON.stringify(a), before);
});
test('ordinary recruits retain every awakening choice and have no fake pathway portrait', () => {
  const a = g.makeAgent(() => .5, {awakened: false}); a.id = 'human'; a.awakened = false;
  const html = ui(a);
  assert(!html.includes('data-sprite-variant'));
  for (const p of g.PATH_KEYS) assert(html.includes(`window.G9.choosePath(&quot;human&quot;,'${p}')`));
  assert(html.includes('No active abilities yet.'));
});
test('marionettes show owner and restrictions without an advancement action', () => {
  const a = agent('fool', 4); a.unitType = 'marionette'; a.ownerId = 'owner'; a.permanentTraits = ['Marionette', 'Cannot advance', 'Permanent death'];
  const html = ui(a);
  assert(html.includes('Cannot advance') && html.includes('Permanent death') && html.includes('Owner'));
  assert(!html.includes("window.G9.advance(&quot;modal_agent&quot;)"));
});
test('Sequence 0 preserves deity message and all inherited ranks remain accessible', () => {
  const a = agent('fool', 0), html = ui(a, 'active', 0);
  assert(html.includes('Sequence 0 — Deity. No further advancement.'));
  for (const x of a.abilityHistory.filter(x => x.type === 'active')) assert(html.includes(esc(x.name)), x.name);
});
test('all 220 ranks render with no undefined values, raw markup injection or lost abilities', () => {
  for (const p of g.PATH_KEYS) for (let seq = 9; seq >= 0; seq--) {
    const a = agent(p, seq); a.name = '<img src=x onerror=alert(1)>'; a.introduction = '<script>bad</script>';
    for (const type of ['active', 'passive']) {
      const html = ui(a, type, seq);
      assert(!html.includes('undefined'), `${p} Seq${seq} ${type}`);
      assert(!html.includes(a.name) && html.includes(esc(a.name)), 'Name must be escaped');
      assert(!html.includes(a.introduction) && html.includes(esc(a.introduction)), 'Biography must be escaped');
      for (const x of a.abilityHistory.filter(x => x.type === type)) assert(html.includes(esc(x.name)), `${p} Seq${x.sequence} inaccessible`);
    }
  }
});
console.log(`\nPhase 2 modal: ${passed} passed, ${failed} failed.`);
process.exitCode = failed ? 1 : 0;
