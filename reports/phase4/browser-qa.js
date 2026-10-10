// Optional real-browser UI check. Requires an existing Playwright installation.
// NODE_PATH=/path/to/node_modules node reports/phase4/browser-qa.js
// Uses a fresh browser context and a controlled combat UI fixture; no guild save is changed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const g = require('../../js/node-loader');
const root = path.resolve(__dirname, '../..');
const base = process.env.GUILD_PREVIEW_URL || 'http://127.0.0.1:9010/';
const url = new URL(base);
if (!['http:', 'https:'].includes(url.protocol) || !['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('Browser QA requires a local HTTP preview.');

async function main() {
  const server = process.env.GUILD_PREVIEW_URL ? null : spawn('python3', ['-m', 'http.server', '9010', '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
  let browser;
  try {
    let ready = false;
    for (let i = 0; i < 40; i++) {
      try { ready = (await fetch(base)).ok; } catch {}
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert(ready, 'Local preview server did not start.');
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    const evidence = [];
    for (const [name, viewport] of [['mobile', { width: 390, height: 844 }], ['desktop', { width: 1366, height: 900 }]]) {
      const context = await browser.newContext({ viewport });
      const save = g.newGame(), agent = g.makeAgent(() => .4, { path: 'fool', sequence: 2, trait: 'Stout Vitality' });
      agent.id = 'qa-fool'; agent.name = 'Fool'; g.restatAgent(agent); save.roster = [agent];
      save.quests = [{ id: 'qa-fight', name: 'Combat UI preview', encounter: true, objective: 'combat', difficultySequence: 4, requiredPath: 'error', enemyCount: 1, rewards: { funds: 0, reputation: 0, materials: {} } }];
      await context.addInitScript(value => localStorage.setItem('guild-rpg-browser-v9', JSON.stringify(value)), save);
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base);
      await page.waitForFunction(() => window.G9?.plan && window.G9?.stepTicker, null, { timeout: 20000 });
      await page.evaluate(({ hp, maxSP }) => {
        const ally = { id: 'qa-fool', name: 'Fool', team: 'ally', path: 'fool', sequence: 2, hp: Math.round(hp * .45), maxHp: hp, shield: Math.round(hp * .3), sp: 22, maxSP, inForm: true, meter: { name: 'Thread Control', value: 100, max: 100 }, threadSlots: { used: 1, max: 2 } };
        const enemy = { id: 'enemy_0', name: 'Error', team: 'enemy', path: 'error', sequence: 4, hp: Math.round(hp * .7), maxHp: hp, shield: 0, sp: 18, maxSP: 80, meter: { name: 'Glitch', value: 60, max: 100 }, threadProgress: { value: 3, max: 5 }, statuses: [{ name: 'bound', turns: 1 }] };
        window.groupEventsToRows = () => [{ round: 3, rows: [
          { type: 'turn', actorId: 'enemy_0', actorName: 'Error', actorTeam: 'enemy', ability: 'Rust Siphon', damages: [{ targetId: ally.id, targetName: 'Fool', amount: 50, hpLoss: 10, absorbed: 40, damageType: 'physical' }], resources: [ally, enemy] },
          { type: 'turn', actorId: ally.id, actorName: 'Fool', actorTeam: 'ally', ability: 'Thread Binding', damages: [], resources: [ally, enemy] },
          { type: 'story', text: 'The controlled UI preview ends here.' }
        ] }];
        window.G9.plan('qa-fight'); window.G9.toggleAssign(ally.id); window.G9.launch();
        window.__qaUnit = document.querySelector('.gm-arena-unit.ally');
        window.__qaImage = window.__qaUnit.querySelector('.combat-sprite-img');
      }, { hp: agent.stats.hp, maxSP: g.maxSPFor(agent) });
      await page.locator('[data-pause]').click();
      assert.equal(await page.locator('[data-pause]').textContent(), 'Resume');
      const before = await page.locator('.b-turn-header').count();
      await page.waitForTimeout(650);
      assert.equal(await page.locator('.b-turn-header').count(), before, 'Pause must stop playback.');
      await page.locator('[data-step]').click();
      const result = await page.evaluate(() => ({
        unitStable: window.__qaUnit === document.querySelector('.gm-arena-unit.ally'),
        imageStable: window.__qaImage === document.querySelector('.gm-arena-unit.ally .combat-sprite-img'),
        image: window.__qaImage.getAttribute('src'),
        resourceText: window.__qaUnit.textContent,
        resourcesVisible: ['hp', 'shield', 'mp'].every(kind => { const box = window.__qaUnit.querySelector(`.gm-float-gauge.${kind} .gm-float-num`).getBoundingClientRect(); return box.top >= 0 && box.bottom <= innerHeight; }),
        fontSize: parseFloat(getComputedStyle(window.__qaUnit.querySelector('.gm-float-num')).fontSize),
        buttonHeight: document.querySelector('[data-pause]').getBoundingClientRect().height,
        viewportFits: document.documentElement.scrollWidth <= innerWidth,
        resourcesVisible: [...window.__qaUnit.querySelectorAll('.gm-float-num')].every(node => {
          const box = node.getBoundingClientRect(), modal = node.closest('.modal').getBoundingClientRect();
          return box.top >= Math.max(0, modal.top) && box.bottom <= Math.min(innerHeight, modal.bottom);
        })
      }));
      assert(result.unitStable && result.imageStable);
      assert(result.image.includes('fool_mythical.192.'));
      assert(result.resourceText.includes('Shield') && result.resourceText.includes(' SP') && result.resourceText.includes('100/100') && result.resourceText.includes('Slots 1/2'));
      assert(result.fontSize >= 12 && result.buttonHeight >= 44 && result.viewportFits);
      assert(result.resourcesVisible, `${name}: allied HP, shield and SP must fit in the initial paused viewport`);
      assert(result.resourcesVisible, 'Ally HP, shield and SP must be visible together in the paused viewport.');
      await page.screenshot({ path: path.join(__dirname, `preview-${name}.png`) });
      await page.locator('[data-pause]').click();
      assert.equal(await page.locator('[data-pause]').textContent(), 'Pause');
      await page.locator('[data-pause]').click();
      assert.deepEqual(errors, []);
      evidence.push({ viewport: name, ...result, browserErrors: errors });
      await context.close();
    }
    fs.writeFileSync(path.join(__dirname, 'browser-qa-results.json'), JSON.stringify({ controlledUiFixture: true, evidence }, null, 2) + '\n');
    console.log('Browser QA passed on mobile and desktop; screenshots and results are in reports/phase4.');
  } finally {
    await browser?.close();
    server?.kill();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
