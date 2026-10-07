const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/ui.js'), 'utf8');
const context = { state: { roster: [] } };
vm.createContext(context);
// Load the rendering helpers without starting the browser application.
vm.runInContext(source.slice(0, source.indexOf('function battlefieldImageFor')), context);
const render = unit => context.getCombatSprite(unit);
const imageSource = html => html.match(/src="([^"]+)"/)[1];
const designedPathways = [
  ['door', 'door'], ['fool', 'fool'], ['visionary', 'visionary'],
  ['sun', 'sun'], ['tyrant', 'tyrant'], ['demoness', 'demoness'], ['hermit', 'hermit'],
  ['wheel_of_fortune', 'wheel_of_fortune'],
  ['black_emperor', 'black_emperor'],
  ['abyss', 'abyss'],
  ['chained', 'chained'],
  ['justiciar', 'justiciar'],
  ['moon', 'moon'],
  ['mother', 'mother'],
  ['hanged_man', 'hangedman'], ['darkness', 'darkness'], ['death', 'death'],
  ['twilight_giant', 'giant'], ['red_priest', 'redpriest']
];
const artworkFolders = fs.readdirSync(path.join(root, 'data/assets/characters'), { withFileTypes: true })
  .filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
assert.deepEqual(designedPathways.map(([, folder]) => folder).sort(), artworkFolders,
  'Every existing artwork folder must have a pathway rendering check');

for (const [pathway, folder] of designedPathways) {
  for (let sequence = 0; sequence <= 9; sequence++) {
    const file = imageSource(render({ path: pathway, sequence, name: 'Test' }));
    assert.equal(file, `data/assets/characters/${folder}/${folder}_seq${sequence}.png`);
    const bytes = fs.readFileSync(path.join(root, file));
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${file} must be a real PNG`);
    if (pathway === 'demoness') {
      assert.equal(bytes.readUInt32BE(16), 1254, `${file} width`);
      assert.equal(bytes.readUInt32BE(20), 1254, `${file} height`);
    }
  }
}

context.state.roster = [{ id: 'door-agent', name: 'Apprentice', path: 'door', sequence: 7 }];
assert.equal(imageSource(render({ id: 'door-agent', name: 'Apprentice' })), 'data/assets/characters/door/door_seq7.png');
assert.equal(imageSource(render({ id: 'door-agent', name: 'Apprentice', sequence: 3 })), 'data/assets/characters/door/door_seq3.png');
assert.equal(imageSource(render({ path: 'door', name: 'Door Seq 2' })), 'data/assets/characters/door/door_seq2.png');
assert.equal(imageSource(render({ path: 'door', name: 'Missing sequence' })), 'data/assets/characters/door/door_seq9.png');
assert.equal(imageSource(render({ path: 'door', sequence: 10 })), 'data/assets/characters/door/door_seq9.png');
assert.equal(imageSource(render({ path: 'door', sequence: '0' })), 'data/assets/characters/door/door_seq0.png');
context.state.roster = [{ id: 'visionary-agent', name: 'Spectator', path: 'visionary', sequence: 9 }];
assert.equal(imageSource(render({ id: 'visionary-agent', name: 'Spectator' })), 'data/assets/characters/visionary/visionary_seq9.png');
assert.equal(imageSource(render({ id: 'visionary-agent', path: 'door', sequence: 2 })), 'data/assets/characters/door/door_seq2.png');
context.state.roster = [{ id: 'sun-agent', name: 'Bard', path: 'sun', sequence: 9 }];
assert.equal(imageSource(render({ id: 'sun-agent', name: 'Bard' })), 'data/assets/characters/sun/sun_seq9.png');
assert.equal(imageSource(render({ id: 'sun-agent', name: 'Bard', sequence: 0 })), 'data/assets/characters/sun/sun_seq0.png');
context.state.roster = [{ id: 'tyrant-agent', name: 'Sailor', path: 'tyrant', sequence: 9 }];
assert.equal(imageSource(render({ id: 'tyrant-agent', name: 'Sailor' })), 'data/assets/characters/tyrant/tyrant_seq9.png');
assert.equal(imageSource(render({ id: 'tyrant-agent', name: 'Sailor', sequence: 0 })), 'data/assets/characters/tyrant/tyrant_seq0.png');
assert.equal(imageSource(render({ path: 'error', sequence: 5 })), 'data/assets/characters/fool/fool_seq5.png');
context.state.roster = [{ id: 'demoness-agent', name: 'Witch', path: 'demoness', sequence: 7 }];
assert.equal(imageSource(render({ id: 'demoness-agent', name: 'Witch' })), 'data/assets/characters/demoness/demoness_seq7.png');
assert.equal(imageSource(render({ id: 'demoness-agent', sequence: 0 })), 'data/assets/characters/demoness/demoness_seq0.png');

for (const [pathway, folder] of designedPathways) {
  context.state.roster = [{ id: `${pathway}-agent`, name: 'Roster character', path: pathway, sequence: 9 }];
  assert.equal(imageSource(render({ id: `${pathway}-agent`, name: 'Battle snapshot' })),
    `data/assets/characters/${folder}/${folder}_seq9.png`);
  assert.equal(imageSource(render({ id: `${pathway}-agent`, sequence: 0 })),
    `data/assets/characters/${folder}/${folder}_seq0.png`);

  const html = render({ path: pathway, sequence: 4, name: '<Mage>' });
  assert.ok(html.includes('&lt;M'), 'Fallback initials must be HTML escaped');
  const fallback = { style: { display: 'none' } };
  const image = { style: {}, parentElement: { querySelector: () => fallback } };
  const onError = html.match(/onerror="([^"]+)"/)[1];
  new Function(onError).call(image);
  assert.equal(image.src, `data/assets/characters/${folder}/seq4.png`);
  image.onerror();
  assert.equal(image.style.display, 'none');
  assert.equal(fallback.style.display, 'flex');
}

context.state.roster = [];
const pathwayKeys = JSON.parse(fs.readFileSync(path.join(root, 'data/pathways/index.json'), 'utf8')).order;
for (const pathway of pathwayKeys.filter(key => !designedPathways.some(([designed]) => designed === key))) {
  assert.equal(imageSource(render({ path: pathway, sequence: 5 })), 'data/assets/characters/fool/fool_seq5.png',
    `${pathway} must retain the Fool placeholder until artwork exists`);
}

console.log(`Combat sprite checks passed: all ${designedPathways.length} designed pathways and ${designedPathways.length * 10} sequence assets, roster snapshots, sequence resolution, and placeholders for pathways without artwork.`);
