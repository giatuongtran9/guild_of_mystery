'use strict';
const assert=require('node:assert/strict'),g=require('../js/node-loader');
const clone=x=>JSON.parse(JSON.stringify(x));
process.env.TZ='America/Toronto';
const s=g.newGame();s.day=42;s.calendar={version:1,originDate:'2026-03-07',originDay:42,currentDate:'2026-03-07'};s.market.lastRefreshDay=42;s.contractPool.lastRefreshDay=42;s.recruitRefreshDay=49;
const offers=clone(s.market.offers);g.advanceGuildDay(s,99,new Date('2026-03-07T23:59:59').valueOf());assert.equal(s.day,42,'actions cannot skip real days');assert.deepEqual(s.market.offers,offers);
g.advanceGuildDay(s,0,new Date('2026-03-08T00:00:00').valueOf());assert.equal(s.day,43);assert.notDeepEqual(s.market.offers,offers);const counter=s.market.rollCounter;
g.advanceGuildDay(s,0,new Date('2026-03-08T23:59:59').valueOf());assert.equal(s.day,43);assert.equal(s.market.rollCounter,counter);
g.advanceGuildDay(s,0,new Date('2026-03-09T00:00:00').valueOf());assert.equal(s.day,44,'the 23-hour daylight-saving day still counts as one calendar day');
g.advanceGuildDay(s,0,new Date('2026-03-06T00:00:00').valueOf());assert.equal(s.day,44,'clock reversal does not remove earned game days');
assert.deepEqual(g.marketWeaponOdds(0),{normal:80,rare:20,epic:0,legendary:0});assert.deepEqual(g.marketWeaponOdds(80),{normal:75,rare:20,epic:5,legendary:0});assert.deepEqual(g.marketWeaponOdds(300),{normal:74,rare:20,epic:5,legendary:1});
const market=g.newGame();market.funds=100000;const original=clone(market.market.offers),before=market.funds;
for(const offer of original){const w=g.WEAPONS[offer.weaponId],count=market.weapons[w.id]||0;assert(g.buyMarketWeapon(market,offer.id).ok);assert.equal(market.weapons[w.id],count+1);assert(!g.buyMarketWeapon(market,offer.id).ok,'an offer cannot be bought twice');}
assert.equal(market.market.offers.length,4);assert.equal(market.funds,before-original.reduce((n,o)=>n+g.WEAPONS[o.weaponId].price,0));
const beforeRefresh=market.funds;assert(g.refreshWeaponMarket(market).ok);assert.equal(market.funds,beforeRefresh-50);
for(const [rep,forbidden]of [[0,['epic','legendary']],[80,['legendary']],[300,[]]]){market.reputation=rep;for(let i=0;i<100;i++){assert(g.refreshWeaponMarket(market).ok);assert(market.market.offers.every(o=>!forbidden.includes(g.WEAPONS[o.weaponId].tier)));}}
market.funds=1000;const material=Object.keys(g.MARKET.materialPrices)[0],owned=market.materials[material];assert(g.buyMarketMaterial(market,material,2).ok);assert.equal(market.materials[material],owned+2);assert.equal(market.funds,500);
for(const bad of [-1,0,.5,101,'1',NaN]){const before=clone(market);assert(!g.buyMarketMaterial(market,material,bad).ok);assert.deepEqual(market,before);}
const unchanged=clone(market);assert(!g.buyMarketMaterial(market,'__proto__',1).ok);assert.deepEqual(market,unchanged);
market.pendingContract={quest:{id:'saved'},result:{success:false}};assert(!g.buyMarketMaterial(market,material,1).ok);assert(!g.buyMarketWeapon(market,market.market.offers[0].id).ok);assert(!g.refreshWeaponMarket(market).ok);
const legacy=g.newGame();delete legacy.calendar;delete legacy.market;legacy.schema=15;legacy.day=37;const snapshot=clone(legacy.roster),weapons=clone(legacy.weapons);const migrated=g.migrateSave(legacy);assert.equal(migrated.day,37);assert.equal(migrated.calendar.originDay,37);assert.equal(migrated.schema,16);assert.deepEqual(migrated.roster,snapshot);assert.deepEqual(migrated.weapons,weapons);
const due=g.newGame();due.calendar.originDate=g.dayjs().subtract(2,'day').format('YYYY-MM-DD');due.calendar.originDay=1;due.calendar.currentDate=due.calendar.originDate;let raw=JSON.stringify(due),deny=true;
global.localStorage={getItem:()=>raw,setItem:(k,v)=>{if(deny)throw Error('denied');raw=v;}};assert.equal(g.loadGame().day,1);assert.equal(raw,JSON.stringify(due));deny=false;assert.equal(g.loadGame().day,3);assert.equal(JSON.parse(raw).day,3);
console.log('Market and calendar passed: local midnight, daylight saving, daily offers, gates, atomic chosen purchases, unlimited materials, pending guards, migration and failed-save rollover.');
