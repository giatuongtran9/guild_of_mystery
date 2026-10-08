// Authored JSON is bundled for GitHub Pages; the release manifest stays fresh.
(() => {
  'use strict';

  const RETRIES = 3;
  const TIMEOUT_MS = 10000;
  const cacheBust = () => `cb=${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const withCacheBust = url => `${url}${url.includes('?') ? '&' : '?'}${cacheBust()}`;

  async function fetchJson(url, label, cache = 'no-cache') {
    let lastError = null;
    for (let attempt = 1; attempt <= RETRIES; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const requestUrl = attempt === 1 ? url : withCacheBust(url);
        const response = await fetch(requestUrl, {
          cache,
          signal: controller.signal,
          headers: { Accept: 'application/json' }
        });
        if (!response.ok) throw new Error(`${label} returned HTTP ${response.status}`);
        return await response.json();
      } catch (error) {
        lastError = error.name === 'AbortError'
          ? new Error(`${label} timed out after ${TIMEOUT_MS}ms`)
          : error;
        if (attempt < RETRIES) await new Promise(resolve => setTimeout(resolve, 250 * attempt));
      } finally {
        clearTimeout(timer);
      }
    }
    throw new Error(`${label}: ${lastError?.message || 'failed to load'}`);
  }

  function validateManifest(manifest) {
    if (!manifest || manifest.schema !== 'pathways.index.v1') throw new Error('data/pathways/index.json has an invalid schema');
    if (!Array.isArray(manifest.order) || manifest.order.length !== 22) throw new Error('data/pathways/index.json must list exactly 22 pathways');
    if (new Set(manifest.order).size !== 22) throw new Error('data/pathways/index.json contains duplicate pathway keys');
    if (!manifest.counters || typeof manifest.counters !== 'object') throw new Error('data/pathways/index.json is missing counters');
    const keys = new Set(manifest.order);
    for (const key of manifest.order) {
      if (typeof key !== 'string' || !/^[a-z][a-z0-9_]*$/.test(key) || ['constructor', 'prototype'].includes(key)) throw new Error('Invalid pathway key in manifest');
      if (!Object.prototype.hasOwnProperty.call(manifest.counters, key)) throw new Error(`Counter missing for pathway ${key}`);
      if (!keys.has(manifest.counters[key])) throw new Error(`Counter target ${manifest.counters[key]} is not a listed pathway`);
    }
    if (Object.keys(manifest.counters).length !== 22) throw new Error('Pathway counters must contain all 22 keys');
  }

  function validateRuntimeManifest(manifest) {
    if (!manifest || manifest.schema !== 'guild.runtime-manifest.v1') throw new Error('Runtime manifest has an invalid schema');
    if (typeof manifest.version !== 'string' || !/^[a-f0-9]{16}$/.test(manifest.version) || manifest.bundle !== `data/runtime/data.${manifest.version}.json`) throw new Error('Runtime manifest has an invalid versioned bundle path');
    const scripts = ['paths', 'v15', 'generate', 'engine', 'state', 'campaign', 'ui'];
    if (!manifest.scriptVersions || typeof manifest.scriptVersions !== 'object' || Object.keys(manifest.scriptVersions).length !== scripts.length || scripts.some(name => typeof manifest.scriptVersions[`js/${name}.js`] !== 'string' || !/^[a-f0-9]{16}$/.test(manifest.scriptVersions[`js/${name}.js`]))) throw new Error('Runtime manifest has invalid script versions');
    if (manifest.serviceWorkerVersion !== undefined && !/^[a-f0-9]{16}$/.test(manifest.serviceWorkerVersion)) throw new Error('Runtime manifest has an invalid service worker version');
  }

  function validateBundle(bundle) {
    if (!bundle || bundle.schema !== 'guild.runtime-data.v1') throw new Error('Runtime data bundle has an invalid schema');
    validateManifest(bundle.manifest);
    if (!bundle.pathwayFiles || Object.keys(bundle.pathwayFiles).length !== 22) throw new Error('Runtime data bundle must contain all 22 pathways');
    for (const key of bundle.manifest.order) validatePathway(bundle.pathwayFiles[key], key);
    for (const name of ['items', 'enemies', 'contracts', 'formulas', 'balance', 'campaign']) {
      if (!bundle.other?.[name] || typeof bundle.other[name] !== 'object') throw new Error(`Runtime data bundle is missing ${name}`);
    }
    if (bundle.other.campaign.schema !== 'campaign.chapter.v1' || !Array.isArray(bundle.other.campaign.missions) || bundle.other.campaign.missions.length !== 5) throw new Error('data/campaign.json must contain a five-mission opening chapter');
    if (bundle.runtimeAssets !== undefined && (bundle.runtimeAssets?.schemaVersion !== 1 || !/^[a-f0-9]{16}$/.test(bundle.runtimeAssets.version) || !bundle.runtimeAssets.entries || typeof bundle.runtimeAssets.entries !== 'object')) throw new Error('Runtime portrait manifest has an invalid schema');
    return bundle;
  }

  async function loadBundle(url, base) {
    let cache;
    try {
      cache = await window.caches?.open(`guild-of-mystery:data-v1:${new URL(base).pathname}`);
      const cached = await cache?.match(url);
      if (cached) {
        try { return validateBundle(await cached.json()); }
        catch { await cache.delete(url); }
      }
    } catch { cache = undefined; }
    const bundle = validateBundle(await fetchJson(url, 'Runtime data bundle', 'force-cache'));
    try { await cache?.put(url, new Response(JSON.stringify(bundle), { headers: { 'Content-Type': 'application/json' } })); }
    catch { /* Storage restrictions cannot prevent startup. */ }
    return bundle;
  }

  function validatePathway(pathway, expectedKey) {
    if (!pathway || pathway.schema !== 'pathway.v1') throw new Error(`data/pathways/${expectedKey}.json has an invalid schema`);
    if (pathway.key !== expectedKey) throw new Error(`data/pathways/${expectedKey}.json declares key ${pathway.key}`);
    if (!Array.isArray(pathway.sequences)) throw new Error(`data/pathways/${expectedKey}.json is missing sequences`);
    const sequences = pathway.sequences.map(x => Number(x.sequence)).sort((a, b) => b - a);
    if (sequences.length !== 10 || sequences.some((x, i) => x !== 9 - i)) {
      throw new Error(`data/pathways/${expectedKey}.json must contain exactly Sequences 9 through 0`);
    }
    for (const tier of pathway.sequences) {
      if (!tier.ability || typeof tier.ability !== 'object') throw new Error(`data/pathways/${expectedKey}.json Sequence ${tier.sequence} is missing its ability`);
      if (!tier.ability.id) throw new Error(`data/pathways/${expectedKey}.json Sequence ${tier.sequence} is missing ability.id`);
    }
  }

  function runtimeAbility(a) {
    const effects = Array.isArray(a.effects) ? a.effects.filter(e => e && typeof e === 'object' && e.type) : [];
    const damage = Number(a.scale || 0) > 0 ? {
      scaling: a.stat || 'INT',
      multiplier: Number(a.scale) || 0,
      type: a.damageType === 'true' ? 'true' : (['physical', 'elemental'].includes(a.damageType) ? a.damageType : 'elemental'),
      element: a.damageType && !['physical', 'elemental', 'true'].includes(a.damageType) ? a.damageType : null,
      formula: a.formula || 'pure_caster_ability',
      components: effects.filter(e => e.type === 'damage_component').map(e => ({ stat: e.stat, multiplier: Number(e.multiplier) || 0 })),
      elements: a.damageType && !['physical', 'elemental', 'true'].includes(a.damageType) ? [a.damageType] : []
    } : null;
    return {
      type: a.kind || 'passive', id: a.id, effectId: a.id, text: a.description || '',
      costSP: Number(a.spCost) || 0, cooldown: a.cooldown ?? 0, tag: a.tag ?? null,
      damage, effects
    };
  }

  function assemblePathways(manifest, pathwayFiles, balance) {
    const paths = {};
    const meters = {};
    const definitions = {};
    const introductions = {};
    const archetype = {};
    const sequenceNames = {};
    const costs = balance.pathway_advancement_costs || {};

    for (const key of manifest.order) {
      const p = pathwayFiles[key];
      const sequences = p.sequences.map(tier => {
        const a = runtimeAbility(tier.ability);
        const cost = costs[key]?.[String(tier.sequence)] || { funds: 0, material: 0 };
        return {
          sequence: tier.sequence,
          name: tier.name,
          ability: a.text,
          abilityText: a.text,
          type: a.type,
          effectId: a.effectId,
          abilities: [a],
          cost,
          abilityType: tier.ability.label || a.type
        };
      });
      const runtimePath = {
        name: p.name,
        material: p.material,
        special: p.meter?.special || p.meter?.name || 'Special',
        specialMax: p.meter?.max ?? 100,
        characteristic: p.meter?.characteristic || p.archetype,
        role: p.role,
        quirkName: p.meter?.name || 'Special',
        quirkText: p.intro,
        sequences,
        group: p.group,
        archetype: p.archetype,
        mythicalForm: p.mythicalForm,
        survival: p.survival
      };
      paths[key] = runtimePath;
      meters[key] = p.meter || {};
      archetype[key] = p.archetype;
      introductions[key] = p.intro;
      sequenceNames[key] = Object.fromEntries(sequences.map(t => [String(t.sequence), t.name]));
      definitions[p.name] = {
        group: p.group,
        archetype: p.archetype,
        mythical_creature_form: p.mythicalForm,
        survival_mechanics: p.survival,
        abilities: sequences.map(t => ({ sequence: t.sequence, name: t.name, type: t.abilityType, sp_cost: t.abilities[0].costSP, cooldown: t.abilities[0].cooldown, description: t.abilityText }))
      };
    }
    return { version: 'v17.0', paths, path_keys: manifest.order.slice(), counters: manifest.counters, meters, archetype, sequence_names: sequenceNames, extras: {}, definitions, introductions };
  }

  async function load(onProgress = () => {}) {
    const base = new URL('./', document.baseURI).href;
    const url = rel => new URL(rel, base).href;

    onProgress({ phase: 'manifest', current: 0, total: 1, label: 'Checking the current data release' });
    const runtimeManifest = await fetchJson(url('data/runtime/manifest.json'), 'data/runtime/manifest.json', 'no-cache');
    validateRuntimeManifest(runtimeManifest);
    onProgress({ phase: 'data', current: 0, total: 1, label: 'Loading the guild data' });
    const { manifest, pathwayFiles, other, runtimeAssets } = await loadBundle(url(runtimeManifest.bundle), base);
    onProgress({ phase: 'data', current: 1, total: 1, label: 'Guild data ready' });
    const pathways = assemblePathways(manifest, pathwayFiles, other.balance);

    const enemyData = other.enemies;
    const system = {
      ...(other.balance.system || {}),
      contracts: other.contracts.system || {},
      enemy_names: enemyData.enemy_names || [],
      combat: other.balance.system?.combat || 'json-driven-elemental-pipeline'
    };
    const characters = {
      FIRST: enemyData.FIRST || enemyData.human_enemy_names?.first || [],
      LAST: enemyData.LAST || enemyData.human_enemy_names?.last || [],
      TRAITS: enemyData.TRAITS || {},
      TRAIT_NAMES: enemyData.TRAIT_NAMES || [],
      OCCUPATIONS: enemyData.OCCUPATIONS || enemyData.human_enemy_occupations || []
    };

    return { pathways, items: other.items, enemies: enemyData, contracts: other.contracts, campaign: other.campaign, formulas: other.formulas, balance: other.balance, system, characters, runtimeAssets, runtimeManifest };
  }

  window.G9DataLoader = { load };
})();
