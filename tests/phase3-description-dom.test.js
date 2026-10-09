// Actual shipped description surfaces. Uses the existing external jsdom installation.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM} = require('jsdom');
const g = require('../js/node-loader');
const root = path.resolve(__dirname, '..');
const deferred = new Set(['error:logic_distortion', 'error:parasitic_contagion']);
const saveKey = 'guild-rpg-browser-v9';
let passed = 0, failed = 0;

function agent(key = 'white_tower', sequence = 5) {
  const a = g.makeAgent(() => .5, {path:key, sequence, trait:'Stout Vitality'});
  a.id = `description_${key}`;
  a.name = 'Mara Vale';
  a.digest = 63;
  a.injuries = 31;
  a.abilityHistory = g.pathOf(key).sequences.filter(t => t.sequence >= sequence).map(t => {
    const spec = t.abilities[0];
    return {sequence:t.sequence, name:t.name, ability:`STALE SAVED ${key} ${t.sequence}: wins immediately`,
      type:spec.type, effectId:spec.effectId, damage:spec.damage, effects:spec.effects};
  });
  return a;
}

async function fixture(agents = [agent()], saved = null) {
  const dom = new JSDOM('<div id="app"></div>', {url:'https://example.test/guild_of_mystery/', runScripts:'dangerously'});
  const w = dom.window;
  w.fetch = async url => ({ok:true, json:async () => JSON.parse(fs.readFileSync(path.join(root, new URL(url).pathname.replace('/guild_of_mystery/', '')), 'utf8'))});
  w.eval(fs.readFileSync(path.join(root, 'js/data-loader.js'), 'utf8'));
  w.G9_DATA = await w.G9DataLoader.load();
  w.scrollTo = () => {};
  w.setTimeout = () => 1;
  w.clearTimeout = () => {};
  w.confirm = () => false;
  const state = g.newGame();
  state.roster = agents;
  state.funds = 10000;
  w.localStorage.setItem(saveKey, saved || JSON.stringify(state));
  w.eval(['paths','v15','generate','engine','state','campaign','ui'].map(n => fs.readFileSync(path.join(root, `js/${n}.js`), 'utf8')).join('\n'));
  // Inspect the same lexical definitions used by the UI, without replacing its renderer.
  w.eval(`window.G9_PHASE3 = {
    tier: tierFor,
    describe: (spec, key, rank) => typeof abilityDescription === 'function' ? abilityDescription(spec, key, rank) : null,
    damage: spec => typeof abilityDamageText === 'function' ? abilityDamageText(spec) : null
  };`);
  w.G9.tab('preview');
  return {dom, w, read:() => JSON.parse(w.localStorage.getItem(saveKey)), raw:() => w.localStorage.getItem(saveKey)};
}

function panel(w) { return w.document.getElementById('dossier-skill-panel'); }
function selectRank(w, type, rank) {
  if (w.document.getElementById(`dossier-tab-${type}`).getAttribute('aria-selected') !== 'true') {
    w.document.getElementById(`dossier-tab-${type}`).click();
  }
  const picker = w.document.querySelector('.dossier-rank-picker select');
  assert(picker, `No ${type} rank picker`);
  picker.value = String(rank);
  picker.dispatchEvent(new w.Event('change', {bubbles:true}));
  assert.equal(picker.value, String(rank));
}
async function test(label, fn) {
  try { await fn(); passed++; console.log(`PASS ${label}`); }
  catch (error) { failed++; console.log(`FAIL ${label}: ${error.message}`); }
}

(async () => {
  await test('all 220 browser ranks match Node metadata; 218 generated descriptions have parity', async () => {
    assert.equal(typeof g.abilityDescription, 'function', 'Shared generated description API is required');
    assert.equal(typeof g.abilityDamageText, 'function', 'Shared generated damage API is required');
    const {dom, w} = await fixture();
    try {
      let count = 0, generated = 0;
      for (const key of g.PATH_KEYS) for (let rank = 9; rank >= 0; rank--) {
        const nodeTier = g.tierFor(key, rank), browserTier = w.G9_PHASE3.tier(key, rank);
        const nodeSpec = nodeTier.abilities[0], browserSpec = browserTier.abilities[0];
        assert.deepEqual(JSON.parse(JSON.stringify(browserSpec)), JSON.parse(JSON.stringify(nodeSpec)), `${key} Seq${rank} runtime parity`);
        count++;
        if (deferred.has(`${key}:${nodeSpec.effectId}`)) {
          console.log(`DEFERRED ${key} Seq${rank} ${nodeSpec.effectId}: shipped prose/mechanics preserved; generated parity excluded`);
          continue;
        }
        const expected = g.abilityDescription(nodeSpec, key, rank);
        assert.equal(w.G9_PHASE3.describe(browserSpec, key, rank), expected, `${key} Seq${rank} browser generator`);
        assert.equal(browserSpec.text, expected, `${key} Seq${rank} live description`);
        assert.equal(browserTier.abilityText, expected, `${key} Seq${rank} tier description`);
        assert.equal(w.G9_PHASE3.damage(browserSpec), g.abilityDamageText(nodeSpec), `${key} Seq${rank} damage summary`);
        generated++;
      }
      assert.equal(count, 220);
      assert.equal(generated, 218);
    } finally { dom.window.close(); }
  });

  await test('actual active and passive tabs ignore stale saved descriptions without rewriting history', async () => {
    const a = agent(), {dom, w, read} = await fixture([a]);
    try {
      const before = read();
      w.G9.dossier(a.id);
      for (const [type, rank] of [['active', 6], ['passive', 7], ['passive', 9]]) {
        selectRank(w, type, rank);
        const tier = w.G9_PHASE3.tier(a.path, rank);
        assert.equal(panel(w).querySelector('p').textContent, tier.abilities[0].text, `${type} Seq${rank} must use live rules`);
        assert.equal(panel(w).getAttribute('aria-labelledby'), `dossier-tab-${type}`);
        assert.equal(w.document.getElementById(`dossier-tab-${type}`).getAttribute('aria-selected'), 'true');
        assert(!panel(w).textContent.includes('STALE SAVED'));
      }
      assert.deepEqual(read().roster[0].abilityHistory, before.roster[0].abilityHistory);
      assert.equal(read().roster[0].digest, 63);
      assert.equal(read().roster[0].sequence, 5);
    } finally { dom.window.close(); }
  });

  await test('reopening a saved stale-history game still renders live rules and preserves snapshots', async () => {
    const a = agent('door', 5), first = await fixture([a]);
    let saved, history;
    try { saved = first.raw(); history = first.read().roster[0].abilityHistory; }
    finally { first.dom.window.close(); }
    const {dom, w, read} = await fixture([], saved);
    try {
      w.G9.dossier(a.id);
      selectRank(w, 'active', 5);
      assert.equal(panel(w).querySelector('p').textContent, w.G9_PHASE3.tier('door', 5).abilities[0].text);
      assert.deepEqual(read().roster[0].abilityHistory, history);
      assert(!panel(w).textContent.includes('wins immediately'));
    } finally { dom.window.close(); }
  });

  await test('every unlocked rank renders its live description in the actual dossier', async () => {
    const agents = g.PATH_KEYS.map(key => agent(key, 0)), {dom, w} = await fixture(agents);
    try {
      let checked = 0;
      for (const a of agents) {
        w.G9.dossier(a.id);
        for (let rank = 9; rank >= 0; rank--) {
          const tier = w.G9_PHASE3.tier(a.path, rank), spec = tier.abilities[0];
          selectRank(w, spec.type, rank);
          assert.equal(panel(w).querySelector('h3').textContent, `Sequence ${rank} — ${tier.name}`);
          assert.equal(panel(w).querySelector('p').textContent, spec.text, `${a.path} Seq${rank} visible description`);
          assert(!/undefined|NaN|STALE SAVED/.test(panel(w).textContent), `${a.path} Seq${rank}`);
          checked++;
        }
        w.G9.closeDossier();
      }
      assert.equal(checked, 220);
    } finally { dom.window.close(); }
  });

  await test('dossier and preview use the shared hybrid damage summary', async () => {
    assert.equal(typeof g.abilityDamageText, 'function');
    const a = agent('chained', 1), {dom, w} = await fixture([a]);
    try {
      const spec = g.tierFor(a.path, 1).abilities[0], summary = g.abilityDamageText(spec);
      assert(summary.includes('105% ATK') && summary.includes('30% INT'), summary);
      w.G9.dossier(a.id);
      selectRank(w, 'active', 1);
      assert.equal(panel(w).querySelector('small').textContent, `SP ${spec.costSP} · Cooldown ${spec.cooldown} turns · ${summary}`);
      w.G9.closeDossier();
      w.G9.previewPath(a.path);
      const row = Array.from(w.document.querySelectorAll('.preview-ability')).find(x => x.querySelector('.preview-seq').textContent === 'SEQ 1');
      assert.equal(row.querySelector('.multiplier').textContent, summary);
    } finally { dom.window.close(); }
  });

  await test('pathway preview shows current live text for all 220 ranks', async () => {
    const {dom, w} = await fixture();
    try {
      let checked = 0;
      for (const key of g.PATH_KEYS) {
        w.G9.previewPath(key);
        const rows = w.document.querySelectorAll('.preview-ability');
        assert.equal(rows.length, 10);
        for (const row of rows) {
          const rank = Number(row.querySelector('.preview-seq').textContent.replace('SEQ ', ''));
          const tier = w.G9_PHASE3.tier(key, rank), spec = tier.abilities[0];
          assert.equal(row.querySelector('p').textContent, spec.text, `${key} Seq${rank} preview`);
          if (!deferred.has(`${key}:${spec.effectId}`)) {
            assert.equal(row.querySelector('.multiplier').textContent, w.G9_PHASE3.damage(spec), `${key} Seq${rank} summary`);
          }
          checked++;
        }
      }
      assert.equal(checked, 220);
    } finally { dom.window.close(); }
  });

  await test('live generated names are escaped in dossier tabs, rank options and preview', async () => {
    const a = agent('door', 8), {dom, w} = await fixture([a]);
    try {
      const spec = w.G9_PHASE3.tier(a.path, 8).abilities[0];
      const unsafe = '<img src=x onerror="window.descriptionInjected=true"> & "ability"';
      spec.name = unsafe;
      const expected = w.G9_PHASE3.describe(spec, a.path, 8);
      assert(expected && expected.includes(unsafe), 'Explicit live ability name must be generated');
      w.G9.dossier(a.id);
      assert.equal(panel(w).querySelector('p').textContent, expected);
      assert(w.document.getElementById('dossier-tab-active').textContent.includes(unsafe));
      assert(panel(w).querySelector('option').textContent.includes(unsafe));
      assert.equal(panel(w).querySelector('img'), null);
      w.G9.closeDossier();
      w.G9.previewPath(a.path);
      const row = Array.from(w.document.querySelectorAll('.preview-ability')).find(x => x.querySelector('.preview-seq').textContent === 'SEQ 8');
      assert.equal(row.querySelector('p').textContent, expected);
      assert.equal(row.querySelector('img'), null);
      assert.equal(w.descriptionInjected, undefined);
    } finally { dom.window.close(); }
  });

  await test('normal contract launch starts the HP bar at actual passive-enhanced battle maximum', async () => {
    const a = agent('red_priest', 5);
    a.injuries = 0;
    a.stats.hp = 10000;
    const state = g.newGame();
    state.roster = [a];
    state.quests = [{id:'vigor-contract', name:'Vigor Contract', encounter:true, objective:'combat', difficultySequence:9,
      rewards:{funds:0, reputation:0, materials:{}}}];
    const {dom, w, read} = await fixture([], JSON.stringify(state));
    try {
      const resolve = w.resolveQuest;
      let result;
      w.resolveQuest = (...args) => { result = resolve(...args); return result; };
      w.G9.plan('vigor-contract');
      w.G9.toggleAssign(a.id);
      w.G9.launch();
      const snapshot = result.battleSnapshot.allies.find(unit => unit.id === a.id);
      assert.equal(snapshot.maxHp, 11500, 'Iron Blood Vigor is present in the actual battle');
      const unit = w.document.querySelector('.gm-rank-allies .gm-arena-unit');
      assert(unit, 'Actual launch must render the allied unit');
      assert.equal(unit.querySelector('.gm-float-gauge.hp .gm-float-num').textContent,
        `${g.abbrNum(snapshot.maxHp)}/${g.abbrNum(snapshot.maxHp)}`, 'Playback must begin at full actual Max HP');
      assert.equal(unit.querySelector('.gm-float-fill.hp').style.width, '100%');
      assert.equal(read().roster[0].name, a.name);
    } finally { dom.window.close(); }
  });

  console.log(`\nPhase 3 description DOM: ${passed} passed, ${failed} failed.`);
  process.exitCode = failed ? 1 : 0;
})().catch(error => { console.error(error); process.exitCode = 1; });
