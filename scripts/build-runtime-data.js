#!/usr/bin/env node
// Generate immutable browser data; authored JSON remains the source of truth.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const SCRIPTS = ['paths', 'v15', 'generate', 'signatures', 'mythical', 'engine', 'state', 'campaign', 'ui'].map(name => `js/${name}.js`);
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 16);

function compactRuntimeAssets(assets) {
  if (assets?.schemaVersion !== 1 || typeof assets.version !== 'string' || !/^[a-f0-9]{16}$/.test(assets.version) || !assets.entries || typeof assets.entries !== 'object' || Array.isArray(assets.entries)) throw new Error('Invalid runtime portrait manifest');
  const entries = Object.fromEntries(Object.entries(assets.entries).map(([source, entry]) => {
    if (!/^data\/assets\/characters\/[a-z][a-z0-9_]*\/[a-z][a-z0-9_]*_(?:seq[0-9]|mythical)\.png$/.test(source)) throw new Error('Invalid original portrait path');
    const stem = source.replace('data/assets/characters/', 'data/assets/runtime/characters/').replace(/\.png$/, '');
    const versions = Object.fromEntries([['portrait', 192], ['dossier', 384]].map(([name, size]) => {
      const image = entry[name];
      if (!image || image.width !== size || image.height !== size || typeof image.src !== 'string' || !image.src.startsWith(`${stem}.${size}.`) || !/^[a-f0-9]{16}\.(?:webp|png)$/.test(image.src.slice(stem.length + String(size).length + 2))) throw new Error('Invalid versioned runtime portrait');
      return [name, { src: image.src, width: image.width, height: image.height }];
    }));
    if (entry.full !== undefined) {
      const image = entry.full, original = entry.source;
      if (!original || original.src !== source || !/^[a-f0-9]{64}$/.test(original.sha256 || '')
        || !Number.isSafeInteger(original.bytes) || original.bytes <= 0
        || !Number.isSafeInteger(original.width) || original.width <= 0 || !Number.isSafeInteger(original.height) || original.height <= 0
        || image?.src !== `${source}?v=${original.sha256.slice(0, 16)}` || image.width !== original.width || image.height !== original.height
        || image.bytes !== original.bytes || image.sha256 !== original.sha256) throw new Error('Invalid full-resolution original portrait');
      versions.full = { src: image.src, width: image.width, height: image.height };
    }
    return [source, versions];
  }));
  return { schemaVersion: assets.schemaVersion, version: assets.version, entries };
}

function buildRuntimeData({ root = path.resolve(__dirname, '..'), check = false } = {}) {
  root = path.resolve(root);
  const inside = relative => {
    const file = path.resolve(root, relative);
    const rel = path.relative(root, file);
    if (rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) throw new Error('Runtime data paths must stay inside the repository');
    let current = root;
    for (const part of ['', ...rel.split(path.sep)]) {
      current = path.join(current, part);
      try {
        if (fs.lstatSync(current).isSymbolicLink()) throw new Error('Runtime data paths cannot use symlinks outside the repository');
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        break;
      }
    }
    return file;
  };
  const read = relative => JSON.parse(fs.readFileSync(inside(relative), 'utf8'));
  const manifest = read('data/pathways/index.json');
  if (manifest.schema !== 'pathways.index.v1' || !Array.isArray(manifest.order) || manifest.order.length !== 22 || new Set(manifest.order).size !== 22 || manifest.order.some(key => typeof key !== 'string' || !/^[a-z][a-z0-9_]*$/.test(key) || ['constructor', 'prototype'].includes(key))) throw new Error('Invalid authored pathway manifest');
  const pathwayFiles = Object.fromEntries(manifest.order.map(key => {
    const p = read(`data/pathways/${key}.json`);
    const sequences = p.sequences?.map(tier => Number(tier.sequence)).sort((a, b) => b - a);
    if (p.schema !== 'pathway.v1' || p.key !== key || sequences?.length !== 10 || sequences.some((value, i) => value !== 9 - i) || p.sequences.some(tier => !tier.ability?.id)) throw new Error(`Invalid authored pathway ${key}`);
    return [key, p];
  }));
  if (!manifest.counters || Object.keys(manifest.counters).length !== 22 || manifest.order.some(key => !Object.hasOwn(manifest.counters, key) || !manifest.order.includes(manifest.counters[key]))) throw new Error('Invalid authored pathway counters');
  const other = Object.fromEntries(['items', 'enemies', 'contracts', 'formulas', 'balance', 'campaign'].map(name => [name, read(`data/${name}.json`)]));
  if (other.campaign.schema !== 'campaign.chapter.v1' || !Array.isArray(other.campaign.missions) || other.campaign.missions.length !== 5) throw new Error('Invalid authored opening chapter');
  const bundle = { schema: 'guild.runtime-data.v1', manifest, pathwayFiles, other };
  const assetManifest = inside('data/assets/runtime/characters/manifest.json');
  if (fs.existsSync(assetManifest)) bundle.runtimeAssets = compactRuntimeAssets(JSON.parse(fs.readFileSync(assetManifest, 'utf8')));
  const bytes = JSON.stringify(bundle);
  const version = hash(bytes);
  const release = {
    schema: 'guild.runtime-manifest.v1', version,
    bundle: `data/runtime/data.${version}.json`,
    scriptVersions: Object.fromEntries(SCRIPTS.map(src => [src, hash(fs.readFileSync(inside(src)))]))
  };
  if (fs.existsSync(inside('sw.js'))) release.serviceWorkerVersion = hash(fs.readFileSync(inside('sw.js')));
  const releaseBytes = `${JSON.stringify(release, null, 2)}\n`;
  const releaseFile = inside('data/runtime/manifest.json');
  const bundleFile = inside(release.bundle);
  const indexFile = inside('index.html');
  const originalHTML = fs.readFileSync(indexFile, 'utf8');
  const html = originalHTML.replace(/((?:href|src)=")((?:css\/[a-z0-9_/-]+\.css|js\/(?:data-loader|boot)\.js))(?:\?v=[a-f0-9]{16})?(")/g, (_, before, src, after) => `${before}${src}?v=${hash(fs.readFileSync(inside(src)))}${after}`);
  if (check) {
    if (!fs.existsSync(releaseFile) || !fs.existsSync(bundleFile) || fs.readFileSync(releaseFile, 'utf8') !== releaseBytes || fs.readFileSync(bundleFile, 'utf8') !== bytes || html !== originalHTML) throw new Error('Runtime data is stale; rebuild with node scripts/build-runtime-data.js');
  } else {
    fs.mkdirSync(path.dirname(releaseFile), { recursive: true });
    fs.writeFileSync(bundleFile, bytes);
    fs.writeFileSync(releaseFile, releaseBytes);
    if (html !== originalHTML) fs.writeFileSync(indexFile, html);
  }
  return release;
}

module.exports = { buildRuntimeData };
if (require.main === module) {
  try {
    if (process.argv.slice(2).some(arg => arg !== '--check')) throw new Error('Usage: node scripts/build-runtime-data.js [--check]');
    const check = process.argv.includes('--check');
    const release = buildRuntimeData({ check });
    console.log(`${check ? 'Verified' : 'Built'} ${release.bundle}: 22 pathways, 220 ranks and six shared datasets.`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
