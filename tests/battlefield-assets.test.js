'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const battlefields = JSON.parse(fs.readFileSync(path.join(root, 'data/contracts.json'), 'utf8')).battlefields;
const filenames = [
  'abandoned_market.png',
  'clockmaker_alley.png',
  'foggy_town.png',
  'gothic_cathedral.png',
  'river_dock.png',
  'ruined_temple.png',
  'sewer_vault.png'
];
const references = [
  ['defaultImage', battlefields.defaultImage],
  ['simulatorImage', battlefields.simulatorImage],
  ...Object.entries(battlefields.encounters).map(([name, src]) => ['encounters.' + name, src]),
  ...Object.entries(battlefields.environments).map(([name, src]) => ['environments.' + name, src])
];

assert.deepEqual(Object.keys(battlefields.scenes || {}).sort(), filenames.slice().sort(),
  'every portrait scene needs its own reviewed safe ground rectangle');

const referencedFiles = new Set();
for (const [label, src] of references) {
  assert.equal(typeof src, 'string', label + ' must name a local background');
  const match = src.match(/^data\/assets\/battlefields\/([a-z_]+\.png)\?v=([a-f0-9]{16})$/);
  assert(match, label + ' must use a content-versioned local PNG URL');
  const [, filename, version] = match;
  assert(filenames.includes(filename), label + ' names an unknown battlefield');
  const bytes = fs.readFileSync(path.join(root, 'data/assets/battlefields', filename));
  assert.equal(version, crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 16),
    label + ' must invalidate cached artwork when its bytes change');
  referencedFiles.add(filename);
}
assert.deepEqual([...referencedFiles].sort(), filenames.slice().sort(),
  'all seven locations must remain reachable through the battlefield configuration');

for (const filename of filenames) {
  const bytes = fs.readFileSync(path.join(root, 'data/assets/battlefields', filename));
  assert(bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    filename + ' must contain a PNG, not another image format with a PNG extension');
  assert.equal(bytes.toString('ascii', 12, 16), 'IHDR', filename + ' is missing its PNG dimensions');
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  assert(width > 0 && height > 0, filename + ' must have positive dimensions');
  assert(Math.abs(width / height - 9 / 16) <= 0.001,
    filename + ' must preserve the portrait 9:16 composition (got ' + width + '×' + height + ')');

  const ground = battlefields.scenes[filename].ground;
  assert(Array.isArray(ground) && ground.length === 4 && ground.every(Number.isFinite),
    filename + ' needs four finite normalized ground coordinates');
  const [left, top, right, bottom] = ground;
  assert(0 <= left && left < right && right <= 1 && 0 <= top && top < bottom && bottom <= 1,
    filename + ' safe ground must stay inside the complete artwork');
}

console.log('PASS seven portrait battlefields: reachable locations, content-versioned URLs, 9:16 PNGs and normalized safe ground.');
