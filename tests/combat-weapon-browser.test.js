// Actual Chromium checks of weapon effects and the replay's animation clock.
// node tests/combat-weapon-browser.test.js
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const output = process.env.WEAPON_BROWSER_OUTPUT || '/workspace/guild_assessment/weapon-clarity';
const source = fs.readFileSync(path.join(root, 'js/ui.js'), 'utf8').split('// ===== Browser UI =====')[0];
const styles = [...fs.readFileSync(path.join(root, 'index.html'), 'utf8').matchAll(/href="(css\/[^"?]+\.css)/g)]
  .map(match => fs.readFileSync(path.join(root, match[1]), 'utf8')).join('\n');
const data = Object.fromEntries(['contracts', 'fx', 'balance'].map(name => [name, JSON.parse(fs.readFileSync(path.join(root, `data/${name}.json`), 'utf8'))]));
const edgeArt = '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><path fill="#c79c58" d="M0 0h128v128H0z"/><path fill="#435d87" d="M4 4h120v120H4z"/></svg>';
let passed = 0, failed = 0;
const observations = [];

async function fixture(browser, width, { reduced = false, realArt = false } = {}) {
  const page = await browser.newPage({ viewport: { width, height: 1200 }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://weapon-review.test/**', async route => {
    const relative = new URL(route.request().url()).pathname.slice(1);
    if (!realArt && /data\/assets\/(?:characters|revisions)\//.test(relative)) return route.fulfill({ body: edgeArt, contentType: 'image/svg+xml' });
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep)) return route.abort();
    try { return route.fulfill({ body: fs.readFileSync(file), contentType: file.endsWith('.png') ? 'image/png' : 'application/octet-stream' }); }
    catch { return route.fulfill({ status: 404, body: 'Missing fixture asset' }); }
  });
  await page.setContent(`<base href="https://weapon-review.test/"><style>${styles}</style><main id="fixture"></main>`);
  await page.evaluate(value => {
    window.G9D = value; window.G9_DATA = { ...value, runtimeAssets: { entries: {} } };
    window.abbrNum = amount => String(Math.round(amount || 0));
  }, data);
  await page.addScriptTag({ content: source });
  await page.evaluate(() => {
    const make = (id, team) => ({ id, name: team === 'ally' ? 'Guild Duelist' : 'Target Adept', team,
      path: 'red_priest', sequence: 9, hp: 100, maxHp: 100, sp: 20, maxSP: 20, alive: true });
    window.units = [make('attacker', 'ally'), make('target', 'enemy')];
    window.fixtureProps = { allies: [units[0]], enemies: [units[1]], flattenedRows: [], shownCount: 0, isDone: false,
      showDetails: false, speed: 1, isSim: false, summaryText: '', battlefieldImage: 'data/assets/battlefields/abandoned_market.png' };
    document.getElementById('fixture').innerHTML = renderBattleLogComponent(fixtureProps);
    layoutBattlefields(document);
    window.wrap = document.querySelector('.battle-log-wrap');
    window.fx = createBattleEffects(wrap);
    fx.sync(Object.fromEntries(units.map(unit => [unit.id, unit])));
    window.box = node => { const r = node.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
    window.capture = () => ({ cards: [...wrap.querySelectorAll('.gm-arena-unit')].map(box),
      gauges: [...wrap.querySelectorAll('.gm-float-track')].map(box),
      anchor: box(wrap.querySelector('[data-unit-id="attacker"] .gm-unit-sprite-anchor')),
      sprite: box(wrap.querySelector('[data-unit-id="attacker"] .gm-unit-sprite')),
      art: box(wrap.querySelector('[data-unit-id="attacker"] .combat-sprite-img')) });
    window.begin = ({ kind = 'gun', speed = 1, critical = false, abilityId = 'basic_attack', sourcePath = 'red_priest', eventType = 'damage', notes = false } = {}) => {
      fx.clear(); window.fx = createBattleEffects(wrap); fx.sync(Object.fromEntries(units.map(unit => [unit.id, unit])));
      const event = { type: eventType, actorId: 'attacker', actorName: 'Guild Duelist', actorTeam: 'ally', targetId: 'target',
        targetName: 'Target Adept', targetTeam: 'enemy', amount: 40, hpLoss: 40, hpAfter: 60, shieldAfter: 0,
        damageType: 'physical', critical, ...(eventType === 'status' ? { status: 'bound' } : {}),
        ...(eventType === 'miss' ? { amount: 0, hpLoss: 0, hpAfter: 100, abilityId, attackKind: kind } : {}) };
      const hit = { type: ['status', 'miss'].includes(eventType) ? 'note' : eventType, event };
      window.row = { type: 'turn', actorId: 'attacker', actorName: 'Guild Duelist', actorTeam: 'ally',
        abilityId, ability: abilityId === 'basic_attack' ? 'Attack' : abilityId.replaceAll('_', ' '), sourcePath,
        ...(abilityId === 'basic_attack' ? { attackKind: kind } : {}),
        ...(eventType === 'miss' ? { isMiss: true, targetId: 'target', targetName: 'Target Adept', targetTeam: 'enemy', text: 'Missed' } : {}),
        timeline: notes ? [{ type: 'note', event: { type: 'story', text: 'Pre-impact note' } }, hit] : [hit] };
      window.playing = { turnRows: [row], currentTurn: 0, eventCount: null };
      window.rate = speed;
      const cue = advanceBattlePresentation(playing);
      fx.show(cue, speed, battlePresentationDelay(playing));
      return { delay: battlePresentationDelay(playing, speed), baseline: capture() };
    };
    window.impact = () => { const cue = advanceBattlePresentation(playing); fx.show(cue, rate, battlePresentationDelay(playing)); return cue.type; };
    window.freeze = time => { fx.pause(); for (const animation of wrap.querySelector('.gm-dungeon-arena').getAnimations({ subtree: true })) animation.currentTime = time; };
  });
  await page.waitForFunction(() => [...document.images].every(image => image.complete));
  await page.evaluate(() => { layoutBattlefields(document); wrap.querySelector('.gm-dungeon-arena').scrollIntoView({ block: 'start' }); });
  return { page, errors };
}

function inside(inner, outer, label) {
  for (const side of ['left', 'top']) assert(inner[side] >= outer[side] - .15, `${label} ${side} stays inside anchor`);
  for (const side of ['right', 'bottom']) assert(inner[side] <= outer[side] + .15, `${label} ${side} stays inside anchor`);
}
async function test(name, fn) {
  try { await fn(); passed++; console.log(`PASS ${name}`); }
  catch (error) { failed++; console.error(`FAIL ${name}: ${error.stack}`); }
}
async function screenshot(page, name) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.locator('.gm-dungeon-arena').screenshot({ path: path.join(output, name), animations: 'allow' });
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium' });
  try {
    for (const width of [320, 390, 1440]) for (const speed of [1, 2]) {
      await test(`${width}px ${speed}× pistol tracer and directional barrel flash`, async () => {
        const { page, errors } = await fixture(browser, width);
        try {
          const result = await page.evaluate(speed => {
            const before = capture(); begin({ kind: 'gun', speed }); fx.pause();
            const tracer = wrap.querySelector('.gm-combat-gun-tracer'), flash = wrap.querySelector('.gm-combat-gun-muzzle');
            const flashAnimation = flash.getAnimations()[0], flashTiming = flashAnimation.effect.getTiming();
            const flashTime = Number(flashTiming.delay) + Number(flashTiming.duration) * .25;
            freeze(flashTime);
            const frame = box(wrap.querySelector('.gm-battlefield-canvas')), anchor = before.anchor;
            const actor = { x: anchor.left - frame.left + anchor.width / 2, y: anchor.top - frame.top + anchor.height / 2 };
            const targetAnchor = box(wrap.querySelector('[data-unit-id="target"] .gm-unit-sprite-anchor'));
            const target = { x: targetAnchor.left - frame.left + targetAnchor.width / 2, y: targetAnchor.top - frame.top + targetAnchor.height / 2 };
            const origin = { x: Number(flash.dataset.startX), y: Number(flash.dataset.startY) };
            const angle = Number(flash.dataset.angleDeg), expectedAngle = Math.atan2(target.y - origin.y, target.x - origin.x) * 180 / Math.PI;
            const flashBox = flash.getBBox(), tracerBox = tracer.getBBox(), flashOpacity = Number(getComputedStyle(flash).opacity);
            const tracerAnimation = tracer.getAnimations()[0], tracerTiming = tracerAnimation.effect.getTiming();
            const travelSamples = [.25, .5, .75].map(progress => {
              freeze(Number(tracerTiming.duration) * progress);
              return { opacity: Number(getComputedStyle(tracer).opacity), box: box(tracer) };
            });
            return { tracer: { children: [...tracer.children].map(node => node.tagName), shape: tracer.dataset.shape,
              rects: [...tracer.querySelectorAll('rect')].map(node => ({ width: Number(node.getAttribute('width')), height: Number(node.getAttribute('height')), rx: Number(node.getAttribute('rx')) })),
              x: Number(tracer.dataset.startX), y: Number(tracer.dataset.startY), width: tracerBox.width, height: tracerBox.height,
              duration: Number(tracerTiming.duration), delay: Number(tracerTiming.delay), rate: tracerAnimation.playbackRate, samples: travelSamples },
              flash: { origin, paths: flash.querySelectorAll('path').length, imageCount: flash.querySelectorAll('image').length,
                opacity: flashOpacity, width: flashBox.width, height: flashBox.height,
                angle, expectedAngle, animationRate: flashAnimation.playbackRate,
                duration: Number(flashTiming.duration), delay: Number(flashTiming.delay) },
              hand: { relativeX: (origin.x - (anchor.left - frame.left)) / anchor.width,
                relativeY: (origin.y - (anchor.top - frame.top)) / anchor.height },
              before, during: capture(), documentWidth: document.documentElement.scrollWidth };
          }, speed);
          assert.equal(result.tracer.shape, 'bullet');
          assert.equal(result.tracer.width, result.before.anchor.height * 2, 'main tracer matches the sword effect extent');
          assert.equal(result.tracer.height, result.tracer.width * .09375, 'sword-sized gunfire retains a narrow profile');
          assert.equal(result.tracer.duration, 600); assert.equal(result.tracer.delay, 0); assert.equal(result.tracer.rate, speed);
          assert.equal(result.tracer.duration / result.tracer.rate, 600 / speed);
          assert(result.tracer.samples.every(sample => sample.opacity > .7), 'tracer remains visible throughout the cast');
          assert.notEqual(result.tracer.samples[0].box.top, result.tracer.samples[2].box.top, 'tracer visibly crosses the battlefield');
          assert(result.tracer.children.every(tag => tag.toLowerCase() === 'rect'), 'gunfire contains only rounded rectangles, without arrowhead paths');
          assert(result.tracer.rects.every(rect => rect.width > rect.height && rect.rx > 0), 'tracer reads as a narrow rounded bullet');
          assert.equal(result.flash.paths, 2, 'directional outer flame and bright core replace the blocky bitmap');
          assert.equal(result.flash.imageCount, 0, 'flash never reuses the old blocky PNG');
          assert.equal(result.flash.width, 24); assert.equal(result.flash.height, 14);
          assert(result.flash.opacity > .7, 'actual rendered flash is visible during its firing frame');
          assert(Math.abs(result.flash.angle - result.flash.expectedAngle) < .02, 'flash points from the source toward its target');
          assert(Math.abs(result.hand.relativeX - .68) < .01 && Math.abs(result.hand.relativeY - .55) < .01,
            'flash starts at the confirmed body-middle hand fallback, rather than the head or center');
          assert.equal(result.tracer.x, result.flash.origin.x); assert.equal(result.tracer.y, result.flash.origin.y);
          assert.equal(result.flash.animationRate, speed); assert(result.flash.duration / speed >= 70, 'flash remains visible for at least 70ms at 2×');
          assert.deepEqual(result.during.cards, result.before.cards); assert.deepEqual(result.during.gauges, result.before.gauges);
          inside(result.during.art, result.during.anchor, 'recoiling artwork');
          assert(result.documentWidth <= width, 'effects do not introduce horizontal page overflow');
          assert.deepEqual(errors, []); observations.push({ width, speed, pistol: result.flash });
        } finally { await page.close(); }
      });
      await test(`${width}px ${speed}× unarmed jab, contained lunge and target punch impact`, async () => {
        const { page, errors } = await fixture(browser, width);
        try {
          const result = await page.evaluate(speed => {
            const before = capture(); begin({ kind: 'unarmed', speed }); fx.pause();
            const jab = wrap.querySelector('.gm-combat-punch-jab');
            const motion = wrap.querySelector('[data-unit-id="attacker"] .gm-unit-sprite').getAnimations()[0];
            const duration = Number(motion.effect.getTiming().duration);
            const jabLength = Number(jab.dataset.length), jabAnimation = jab.getAnimations()[0],
              jabDuration = Number(jabAnimation.effect.getTiming().duration), jabRate = jabAnimation.playbackRate,
              projectileCount = wrap.querySelectorAll('.gm-combat-projectile, .gm-combat-sword-slash-travel').length;
            const poses = [.1, .18, .4, .7, 1].map(progress => { freeze(duration * progress); return capture(); });
            impact(); fx.pause(); const punch = wrap.querySelector('.gm-combat-punch-impact');
            const punchAnimation = punch.getAnimations()[0], punchDuration = Number(punchAnimation.effect.getTiming().duration);
            const punchSamples = [.25, .5, .75].map(progress => {
              punchAnimation.currentTime = punchDuration * progress; return Number(getComputedStyle(punch).opacity);
            });
            const sourceSprite = wrap.querySelector('[data-unit-id="attacker"] .gm-unit-sprite');
            const returnMotion = sourceSprite.getAnimations()[0];
            if (returnMotion) returnMotion.currentTime = Number(returnMotion.effect.getTiming().duration);
            return { before, poses, jabLength, jabDuration, jabRate, projectileCount, punch: { owner: punch.dataset.ownerId, target: punch.dataset.targetId,
              source: punch.querySelector('image').getAttribute('href'), size: Number(punch.dataset.effectHeight),
              duration: punchDuration, rate: punchAnimation.playbackRate, samples: punchSamples },
              targetCue: wrap.querySelector('[data-unit-id="target"] .gm-unit-sprite-anchor').classList.contains('gm-cue-damage'),
              number: wrap.querySelector('.gm-battle-fx-number')?.textContent, returned: capture() };
          }, speed);
          assert(result.jabLength > 0 && result.jabLength <= result.before.anchor.height * .4 + .01, 'jab stays near the fist instead of crossing the battlefield');
          assert.equal(result.jabDuration, 600); assert.equal(result.jabRate, speed);
          assert.equal(result.punch.duration / result.punch.rate, 600 / speed, 'punch uses the sword phase duration at both speeds');
          assert(result.punch.samples.every(opacity => opacity > .9), 'punch stays readable through the middle of the impact phase');
          assert.equal(result.projectileCount, 0, 'unarmed attacks do not launch ranged projectiles');
          for (const pose of result.poses) { inside(pose.art, pose.anchor, 'punching artwork'); assert.deepEqual(pose.cards, result.before.cards); assert.deepEqual(pose.gauges, result.before.gauges); }
          assert.notDeepEqual(result.poses[2].sprite, result.before.sprite, 'strike includes a visible source lunge');
          assert.equal(result.punch.target, 'target'); assert(result.punch.source.endsWith('/unarmed-punch-impact.png'));
          assert.equal(result.punch.size, result.before.anchor.height * 2, 'punch uses the established sword-effect scale');
          assert(result.targetCue && result.number, 'target hit and damage remain visible');
          assert.deepEqual(result.returned.sprite, result.before.sprite, 'attacker returns to its original position');
          assert.deepEqual(errors, []);
        } finally { await page.close(); }
      });
    }
    for (const speed of [1, 2]) await test(`missed pistol attempt animates before Miss at ${speed}× without a false impact`, async () => {
      const { page, errors } = await fixture(browser, 390);
      try {
        const result = await page.evaluate(speed => {
          begin({ kind: 'gun', speed, eventType: 'miss' }); freeze(300);
          const castDelay = battlePresentationDelay(playing, speed);
          const castHtml = renderTurnRowHtml(battlePresentationRows([row], 0, playing.eventCount)[0], false);
          const attemptVisible = Number(getComputedStyle(wrap.querySelector('.gm-combat-gun-tracer')).opacity) > .7;
          impact(); fx.pause();
          const outcomeHtml = renderTurnRowHtml(battlePresentationRows([row], 0, playing.eventCount)[0], false);
          const total = castDelay + battlePresentationDelay(playing, speed);
          const outcome = { attemptVisible, castHtml, outcomeHtml, total,
            impacts: wrap.querySelectorAll('.gm-combat-impact, .gm-combat-punch-impact').length,
            numbers: [...wrap.querySelectorAll('.gm-battle-fx-number')].map(node => node.textContent),
            targetHit: wrap.querySelector('[data-unit-id="target"] .gm-unit-sprite-anchor').classList.contains('gm-cue-damage') };
          const settled = advanceBattlePresentation(playing); fx.show(settled, speed, 0);
          return { ...outcome, settledType: settled.type, settledNumbers: wrap.querySelectorAll('.gm-battle-fx-number').length,
            settledMissCue: wrap.querySelector('[data-unit-id="target"] .gm-unit-sprite-anchor').classList.contains('gm-cue-miss') };
        }, speed);
        assert(result.attemptVisible, 'a missed shot still shows the main firing animation');
        assert(!result.castHtml.includes('b-outcome miss'), 'Miss remains hidden during the weapon attempt');
        assert(result.outcomeHtml.includes('b-outcome miss'), 'Miss appears when the recorded outcome is revealed');
        assert.equal(result.total, 2000 / speed); assert.equal(result.impacts, 0); assert.equal(result.targetHit, false);
        assert.deepEqual(result.numbers, ['Miss']); assert.deepEqual(errors, []);
        assert.equal(result.settledType, 'settle'); assert.equal(result.settledNumbers, 0); assert.equal(result.settledMissCue, false,
          'settling a completed miss cannot replay the miss cue or create a second number');
      } finally { await page.close(); }
    });
    await test('knife and sword share the same melee presentation', async () => {
      const { page, errors } = await fixture(browser, 390);
      try {
        const result = await page.evaluate(() => {
          const captureWeapon = weaponId => {
            begin({ kind: 'weapon' }); row.weaponId = weaponId; fx.pause();
            const node = wrap.querySelector('.gm-combat-sword-slash-travel');
            return { source: node.querySelector('image').getAttribute('href'), family: node.dataset.family,
              size: node.dataset.effectHeight, duration: node.dataset.travelMs,
              keyframes: wrap.querySelector('[data-unit-id="attacker"] .gm-unit-sprite').getAnimations()[0].effect.getKeyframes() };
          };
          return { sword: captureWeapon('sword'), knife: captureWeapon('knife') };
        });
        assert.deepEqual(result.knife, result.sword); assert(result.sword.source.endsWith('/sword-slash.png'));
        assert.deepEqual(errors, []);
      } finally { await page.close(); }
    });
    for (const speed of [1, 2]) await test(`critical number and impact are larger/orange without playback delay at ${speed}×`, async () => {
      const { page, errors } = await fixture(browser, 390);
      try {
        const result = await page.evaluate(speed => {
          const read = critical => {
            begin({ kind: 'gun', speed, critical });
            let total = battlePresentationDelay(playing, speed); impact(); total += battlePresentationDelay(playing, speed); fx.pause();
            const number = wrap.querySelector('.gm-battle-fx-number'), burst = wrap.querySelector('.gm-combat-impact');
            const numberStyle = getComputedStyle(number), frames = [...burst.querySelectorAll('.gm-combat-impact-frame')];
            const frameAnimations = frames.map(frame => frame.getAnimations()[0]);
            const samples = [20, 60, 100, 140].map(time => { for (const animation of frameAnimations) animation.currentTime = time;
              return frames.map(frame => Number(getComputedStyle(frame).opacity)); });
            return { total, numberColor: numberStyle.color, fontSize: parseFloat(numberStyle.fontSize),
              burstColor: getComputedStyle(burst).color, impactScale: Number(burst.dataset.impactScale), samples,
              impactDuration: frameAnimations[0].effect.getTiming().duration, rate: frameAnimations[0].playbackRate };
          };
          return { normal: read(false), critical: read(true) };
        }, speed);
        assert.equal(result.critical.total, result.normal.total, 'critical flag adds no playback hold or hit-stop');
        assert.equal(result.critical.total, 2000 / speed);
        assert.equal(result.critical.numberColor, 'rgb(255, 166, 77)'); assert.equal(result.critical.burstColor, 'rgb(255, 166, 77)');
        assert(result.critical.fontSize > result.normal.fontSize); assert(result.critical.fontSize < 24, 'critical text stays readable without becoming character-sized');
        assert(result.critical.impactScale > result.normal.impactScale); assert.equal(result.critical.impactDuration, result.normal.impactDuration);
        assert.equal(result.critical.rate, speed);
        assert.deepEqual(result.critical.samples, [[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]], 'browser displays all four stepped impact frames');
        assert.deepEqual(errors, []); observations.push({ speed, critical: result });
      } finally { await page.close(); }
    });
    await test('direct ability art is preserved; support and passive cues never fire equipped-weapon effects', async () => {
      const { page, errors } = await fixture(browser, 390);
      try {
        const result = await page.evaluate(() => {
          begin({ abilityId: 'brutal_strike', kind: 'gun' }); fx.pause();
          const strike = wrap.querySelector('.gm-combat-sword-slash-travel');
          const direct = { source: strike?.querySelector('image')?.getAttribute('href'), accidentalGun: wrap.querySelectorAll('.gm-combat-gun-muzzle, .gm-combat-gun-tracer, .gm-combat-punch-jab').length };
          const support = ['heal', 'shield', 'status'].map(eventType => {
            begin({ abilityId: eventType === 'heal' ? 'healing_touch' : 'support_fixture', eventType }); impact(); fx.pause();
            return { eventType, weaponEffects: wrap.querySelectorAll('.gm-combat-gun-muzzle, .gm-combat-gun-tracer, .gm-combat-punch-jab, .gm-combat-sword-slash-travel, .gm-combat-punch-impact').length,
              supportEffects: wrap.querySelectorAll(`.gm-combat-${eventType === 'status' ? 'status' : eventType}`).length };
          });
          fx.show({ type: 'note', row: { type: 'passive', actorId: 'attacker', abilityId: 'passive_fixture' }, event: { type: 'story', actorId: 'attacker' } });
          return { direct, support, passiveAttacks: wrap.querySelectorAll('.gm-combat-projectile, .gm-combat-gun-muzzle, .gm-combat-punch-jab').length };
        });
        assert(result.direct.source.endsWith('/sword-slash.png')); assert.equal(result.direct.accidentalGun, 0);
        for (const support of result.support) { assert.equal(support.weaponEffects, 0); assert(support.supportEffects > 0); }
        assert.equal(result.passiveAttacks, 0); assert.deepEqual(errors, []);
      } finally { await page.close(); }
    });
    await test('finished held attack pose survives a pause and intervening note, then clear removes all motion', async () => {
      const { page, errors } = await fixture(browser, 390);
      try {
        const result = await page.evaluate(async () => {
          begin({ kind: 'unarmed', notes: true });
          const animation = wrap.querySelector('[data-unit-id="attacker"] .gm-unit-sprite').getAnimations()[0];
          animation.finish(); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          fx.pause(); const held = capture(); impact(); fx.pause(); const afterNote = capture();
          impact(); fx.pause(); const returning = wrap.querySelector('[data-unit-id="attacker"] .gm-unit-sprite').getAnimations().length;
          fx.clear(); return { held, afterNote, returning, final: capture(), animations: wrap.querySelector('.gm-dungeon-arena').getAnimations({ subtree: true }).length,
            effects: wrap.querySelectorAll('.gm-combat-fx-layer, .gm-battle-fx-layer, [class*="gm-cue-"]').length };
        });
        assert.deepEqual(result.afterNote.sprite, result.held.sprite, 'a note cannot reset a finished filled anticipation/strike pose');
        assert(result.returning > 0, 'recorded hit starts the return'); assert.equal(result.animations, 0); assert.equal(result.effects, 0);
        assert.deepEqual(result.final.sprite, result.final.anchor); assert.deepEqual(errors, []);
      } finally { await page.close(); }
    });
    for (const mode of ['reduced', 'compact']) await test(`${mode} playback keeps readable cues without orphan motion`, async () => {
      const { page, errors } = await fixture(browser, 390, { reduced: mode === 'reduced' });
      try {
        const result = await page.evaluate(speed => {
          begin({ kind: 'gun', speed });
          const castAnimations = wrap.querySelector('.gm-dungeon-arena').getAnimations({ subtree: true }).length;
          impact();
          const visible = !!wrap.querySelector('.gm-battle-fx-number') && wrap.querySelector('[data-unit-id="target"] .gm-unit-sprite-anchor').classList.contains('gm-cue-damage');
          const impactAnimations = wrap.querySelector('.gm-dungeon-arena').getAnimations({ subtree: true }).length;
          fx.clear(); return { castAnimations, impactAnimations, visible, leftovers: wrap.querySelectorAll('.gm-combat-fx-layer, .gm-battle-fx-layer, [class*="gm-cue-"]').length };
        }, mode === 'compact' ? 4 : 1);
        assert.equal(result.castAnimations, 0); assert.equal(result.impactAnimations, 0); assert(result.visible); assert.equal(result.leftovers, 0);
        assert.deepEqual(errors, []);
      } finally { await page.close(); }
    });
    await test('real-art phone and desktop snapshots at normal and 2× show separate source, hit and number cues', async () => {
      for (const width of [390, 1440]) for (const speed of [1, 2]) {
        const { page, errors } = await fixture(browser, width, { realArt: true });
        try {
          await page.evaluate(speed => { begin({ kind: 'gun', speed }); fx.pause(); const flash = wrap.querySelector('.gm-combat-gun-muzzle');
            const timing = flash.getAnimations()[0].effect.getTiming(); freeze(Number(timing.delay) + 35); }, speed);
          await screenshot(page, `pistol-${width}-${speed}x-cast.png`);
          await page.evaluate(() => { impact(); freeze(60); }); await screenshot(page, `pistol-${width}-${speed}x-impact.png`);
          if (width === 390) {
            await page.evaluate(speed => { begin({ kind: 'unarmed', speed }); freeze(535); }, speed);
            await screenshot(page, `unarmed-${width}-${speed}x-cast.png`);
            await page.evaluate(() => { impact(); freeze(60); }); await screenshot(page, `unarmed-${width}-${speed}x-impact.png`);
            await page.evaluate(speed => { begin({ kind: 'gun', speed, critical: true }); impact(); freeze(60); }, speed);
            await screenshot(page, `critical-${width}-${speed}x-impact.png`);
          }
          assert.deepEqual(errors, []);
        } finally { await page.close(); }
      }
    });
  } finally { await browser.close(); }
  fs.writeFileSync(path.join(output, 'browser-observations.json'), JSON.stringify({ passed, failed, observations }, null, 2) + '\n');
  console.log(`${passed} passed, ${failed} failed`);
  if (failed) process.exitCode = 1;
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
