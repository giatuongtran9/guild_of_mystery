// NODE_PATH=<Playwright node_modules> CHROMIUM_PATH=/usr/bin/chromium node tests/fullres-layout.test.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const sheets = Array.from(fs.readFileSync(path.join(root, 'index.html'), 'utf8').matchAll(/href="(css\/[^"?]+\.css)/g), match => match[1]);
const styles = sheets.map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
const image = '<img class="combat-sprite-img" width="1254" height="1254" alt="Full character" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=">';
const ui = fs.readFileSync(path.join(root, 'js/ui.js'), 'utf8').split('// ===== Browser UI =====')[0];
const renderer = { abbrNum: number => String(number), G9D: { contracts: { battlefields: {} } } };
vm.createContext(renderer); vm.runInContext(ui, renderer);
const units = team => Array.from({ length: 7 }, (_, i) => ({ id: `${team}_${i}`, name: `Mystery Pryer ${i}`, path: 'fool', sequence: 9, summoned: i >= 3, hp: 150, maxHp: 150, sp: 20, maxSP: 20 }));
const fixtures = {
  dossier: `<div class="overlay dossier-overlay"><section class="modal character-dossier"><h2>Character</h2><div class="dossier-identity"><div class="dossier-portrait"><button class="dossier-portrait-zoom" aria-label="Enlarge portrait">${image}</button></div><div class="dossier-progression"><p>White Tower · Sequence 9</p><p>Digesting 40%</p></div></div><div class="big-stats dossier-stats"><div><span>HP</span><b>150</b></div><div><span>Attack</span><b>20</b></div></div></section></div>`,
  campaign: `<main><section class="campaign-page"><aside class="campaign-assignment"><div class="campaign-party"><button class="campaign-agent"><span class="campaign-agent-img">${image}</span><span class="campaign-agent-copy"><b>Mara Vale</b><small>White Tower · Seq 9</small><small>Knife · Digest 40%</small></span><span class="campaign-agent-check">✓</span></button></div></aside></section></main>`,
  battle: `<main>${renderer.renderHpStrip({}, units('ally'), units('enemy'))}</main>`
};

(async () => {
  const browser = await chromium.launch({headless:true, executablePath:process.env.CHROMIUM_PATH || undefined});
  let passed = 0, failed = 0;
  try {
    for (const width of [320, 390, 560, 1440]) {
      const page = await browser.newPage({viewport:{width,height:1000}});
      await page.route('https://guild-layout.test/**', route => route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64') }));
      for (const [fixture, html] of Object.entries(fixtures)) {
        try {
          await page.setContent(`<base href="https://guild-layout.test/"><style>${styles}</style>${html}`);
          if (fixture === 'battle') {
            await page.addScriptTag({content:`window.abbrNum = number => String(number); window.G9D = {contracts:{battlefields:{}}};\n${ui}`});
            await page.evaluate(() => layoutBattlefields(document));
          }
          const result = await page.evaluate(fixture => {
            const box = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}; };
            const portrait = fixture === 'dossier' ? '.dossier-portrait img' : fixture === 'campaign' ? '.campaign-agent-img img' : '.gm-arena-unit.ally img';
            const result = {image:box(portrait),documentWidth:document.documentElement.scrollWidth};
            if (fixture === 'dossier') {
              result.progression = box('.dossier-progression'); result.stats = box('.dossier-stats'); result.objectFit = getComputedStyle(document.querySelector(portrait)).objectFit;
            } else if (fixture === 'campaign') {
              result.card = box('.campaign-agent'); result.copy = box('.campaign-agent-copy');
            } else {
              result.arena = box('.gm-dungeon-arena'); result.enemy = box('.gm-arena-unit.enemy img');
              const row = document.querySelector('.gm-rank-allies');
              result.companion = box('.gm-arena-unit.companion img');
              result.unitCount = document.querySelectorAll('.gm-arena-unit').length;
              result.allVisible = Array.from(document.querySelectorAll('.gm-arena-unit'), node => {
                const r = node.getBoundingClientRect();
                return r.width > 0 && r.height > 0 && r.left >= result.arena.left - 1 && r.right <= result.arena.right + 1 && r.top >= result.arena.top - 1 && r.bottom <= result.arena.bottom + 1;
              }).every(Boolean);
              result.rowScrollable = row.scrollWidth > row.clientWidth + 1;
            }
            return result;
          }, fixture);
          assert(result.documentWidth <= width, `${fixture} must not widen the page`);
          if (fixture === 'dossier') {
            assert(result.image.width >= 240 && result.image.width <= 300, 'dossier artwork must be 240–300px');
            assert(Math.abs(result.image.width - result.image.height) < 1, 'dossier image must retain its square canvas');
            assert.equal(result.objectFit, 'contain');
            assert(result.progression.top >= result.image.bottom - 1, 'progression must sit below the enlarged image');
            assert(result.stats.top >= result.image.bottom - 1, 'stats must sit below the enlarged image');
          } else if (fixture === 'campaign' && width <= 560) {
            assert(result.image.width >= 140 && result.image.width <= 180, 'phone party artwork must be 140–180px');
            assert(result.image.left >= result.card.left && result.image.right <= result.card.right, 'party artwork must stay inside its card');
            assert(result.copy.left >= result.card.left && result.copy.right <= result.card.right, 'party text must stay inside its card');
          } else if (fixture === 'battle') {
            const mainSize = width <= 560 ? 64 : 96;
            assert.equal(result.image.width, mainSize, 'battle party artwork uses the responsive principal size');
            assert.equal(result.image.height, mainSize, 'battle party canvas must be square');
            assert.equal(result.enemy.width, mainSize, 'enemy artwork uses the same principal size');
            assert.equal(result.companion.width, width <= 560 ? 32 : 40, 'companions remain smaller than principals');
            assert.equal(result.unitCount, 14, 'all principals and companions remain rendered');
            assert(result.image.bottom <= result.arena.bottom, 'battle artwork must not be cropped by arena bounds');
            assert(result.allVisible, 'every principal and companion must fit without scrolling');
            assert(!result.rowScrollable, 'formation must not require hidden horizontal scrolling');
          }
          passed++; console.log(`PASS ${fixture} layout at ${width}px`);
        } catch (error) { failed++; console.log(`FAIL ${fixture} layout at ${width}px: ${error.message}`); }
      }
      await page.close();
    }
  } finally { await browser.close(); }
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exitCode = failed ? 1 : 0;
})().catch(error => { console.error(error); process.exitCode = 1; });
