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

for (const pathway of ['door', 'fool', 'visionary', 'sun']) {
  for (let sequence = 0; sequence <= 9; sequence++) {
    const file = imageSource(render({ path: pathway, sequence, name: 'Test' }));
    assert.equal(file, `data/assets/characters/${pathway}/${pathway}_seq${sequence}.png`);
    const bytes = fs.readFileSync(path.join(root, file));
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${file} must be a real PNG`);
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
assert.equal(imageSource(render({ path: 'error', sequence: 5 })), 'data/assets/characters/fool/fool_seq5.png');

for (const pathway of ['door', 'fool', 'visionary', 'sun']) {
  const html = render({ path: pathway, sequence: 4, name: '<Mage>' });
  assert.ok(html.includes('&lt;M'), 'Fallback initials must be HTML escaped');
  const fallback = { style: { display: 'none' } };
  const image = { style: {}, parentElement: { querySelector: () => fallback } };
  const onError = html.match(/onerror="([^"]+)"/)[1];
  new Function(onError).call(image);
  assert.equal(image.src, `data/assets/characters/${pathway}/seq4.png`);
  image.onerror();
  assert.equal(image.style.display, 'none');
  assert.equal(fallback.style.display, 'flex');
}

console.log('Combat sprite checks passed: all Door/Fool/Visionary/Sun assets, roster snapshots, sequence resolution, and image fallback.');
