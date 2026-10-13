const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../..');
const output = path.join(root, 'reports/art-consistency-corrections');
const g = require(path.join(root, 'js/node-loader'));
const save = g.newGame();
const designs = [['fool',0],['moon',9],['mother',9],['visionary',5],['tyrant',8],['red_priest',6]];
save.roster = designs.map(([pathway,sequence],i) => {
  const a = g.makeAgent(() => .4,{path:pathway,sequence,trait:'Stout Vitality'});
  a.id = `art-review-${i}`; a.name = `${g.pathOf(pathway).name} ${sequence}`; a.weaponId = 'knife'; g.restatAgent(a); return a;
});

(async () => {
  const browser = await chromium.launch({headless:true, executablePath:'/usr/bin/chromium'});
  const results = {errors:[],viewports:[],gallery:[]};
  try {
    for (const width of [390,1440]) {
      const page = await browser.newPage({viewport:{width,height:900}});
      page.on('pageerror',error=>results.errors.push(error.message));
      await page.addInitScript(data=>localStorage.setItem('guild-rpg-browser-v9',JSON.stringify(data)),save);
      await page.goto('http://127.0.0.1:8111/index.html');
      await page.waitForFunction(()=>window.G9 && document.querySelector('nav.tabs'));
      await page.evaluate(()=>{window.G9.tab('hall');window.G9.dossier('art-review-0');});
      await page.waitForFunction(()=>{const im=document.querySelector('.dossier-portrait img');return im?.complete&&im.naturalWidth===1254;});
      const dossier = await page.locator('.dossier-portrait img').getAttribute('src');
      assert.match(dossier,/data\/assets\/revisions\/fool\/fool_seq0\.[a-f0-9]{16}\.png\?v=[a-f0-9]{16}$/);
      await page.screenshot({path:path.join(output,`dossier-${width}.png`)});
      await page.locator('.dossier-portrait-zoom').click();
      await page.waitForFunction(()=>document.querySelector('.portrait-viewer img')?.naturalWidth===1254);
      assert.equal(await page.locator('.portrait-viewer img').getAttribute('src'),new URL(dossier,page.url()).href);
      if(width===390) await page.screenshot({path:path.join(output,'full-art-390.png')});
      await page.evaluate(()=>window.G9.closePortrait());
      await page.evaluate(()=>window.G9.closeDossier());
      await page.evaluate(({designs})=>{
        const allies=designs.map(([path,sequence],i)=>({id:'show-'+i,name:path.replace(/_/g,' '),path,sequence,maxHp:200,hp:160,shield:40,sp:80,maxSP:100}));
        const enemies=[{id:'show-enemy-0',name:'Red Priest',path:'red_priest',sequence:0,inForm:true,maxHp:300,hp:300,sp:100,maxSP:100},{id:'show-enemy-1',name:'Moon',path:'moon',sequence:0,inForm:true,maxHp:300,hp:300,sp:100,maxSP:100}];
        document.getElementById('app').innerHTML='<main><h2>Artwork preview · six-unit formation</h2><p>Visual fixture using the existing battle renderer.</p>'+renderHpStrip(calculateCurrentHp(allies,enemies,[]),allies,enemies)+'</main>';
        prioritizeVisiblePartyPortraits();
      },{designs});
      await page.waitForFunction(()=>[...document.querySelectorAll('.gm-arena-unit img')].filter(im=>im.getBoundingClientRect().right>0&&im.getBoundingClientRect().left<innerWidth).every(im=>im.complete&&im.naturalWidth));
      await page.evaluate(async()=>{
        const images=[...document.querySelectorAll('.gm-arena-unit img')].filter(im=>im.getBoundingClientRect().right>0&&im.getBoundingClientRect().left<innerWidth);
        await Promise.all(images.map(im=>im.decode()));
      });
      const metrics = await page.evaluate(()=>{
        const row=document.querySelector('.gm-rank-allies');
        const images=[...row.querySelectorAll('img')].map(im=>({src:im.dataset.src||im.getAttribute('src'),width:im.getBoundingClientRect().width,height:im.getBoundingClientRect().height}));
        const enemies=[...document.querySelectorAll('.gm-rank-enemies img')].map(im=>({src:im.getAttribute('src'),naturalWidth:im.naturalWidth,width:im.getBoundingClientRect().width,height:im.getBoundingClientRect().height}));
        return {width:innerWidth,documentWidth:document.documentElement.scrollWidth,images,enemies,scrollable:row.scrollWidth>row.clientWidth};
      });
      assert.equal(metrics.images.length,6);assert(metrics.images.every(im=>im.width===64&&im.height===64));
      assert(metrics.images.every(im=>im.src.includes('/revisions/')));assert(metrics.documentWidth<=width);
      assert(metrics.enemies.every(im=>im.src.includes('/revisions/')&&/_mythical(?:\.[a-f0-9]{16})?\.png/.test(im.src)&&im.naturalWidth===1254&&im.width===64&&im.height===64));
      if(width===390)assert(metrics.scrollable);
      await page.screenshot({path:path.join(output,`battle-${width}.png`)});
      if(width===390){await page.locator('.gm-rank-allies').evaluate(row=>row.scrollLeft=row.scrollWidth);await page.waitForFunction(()=>{const images=[...document.querySelectorAll('.gm-rank-allies img')];return images.slice(-2).every(im=>im.complete&&im.naturalWidth);});await page.evaluate(async()=>Promise.all([...document.querySelectorAll('.gm-rank-allies img')].slice(-2).map(im=>im.decode())));await page.screenshot({path:path.join(output,'battle-390-scrolled.png')});}
      results.viewports.push(metrics);
      await page.goto('http://127.0.0.1:8111/reports/art-consistency-corrections/preview.html');
      await page.selectOption('#pathway','tyrant');
      await page.waitForFunction(()=>[...document.querySelectorAll('article:first-child img')].every(im=>im.complete&&im.naturalWidth));
      assert.equal(await page.locator('article').count(),10);
      await page.screenshot({path:path.join(output,`comparison-${width}.png`)});
      await page.check('#retained');await page.selectOption('#pathway','all');assert.equal(await page.locator('article').count(),242);
      results.gallery.push({width,allDesigns:242,tyrantCorrections:10});
      await page.close();
    }
    assert.deepEqual(results.errors,[]);
    fs.writeFileSync(path.join(output,'browser-check.json'),JSON.stringify(results,null,2)+'\n');
    console.log(JSON.stringify({screenshots:8,viewports:results.viewports.map(r=>({width:r.width,portraits:r.images.length,portraitPx:r.images[0].width,scrollable:r.scrollable})),allDesigns:242,errors:results.errors}));
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
