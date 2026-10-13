// Chosen purchases from a finite daily weapon display; materials are unlimited.
const MARKET=G9D.items.market;
function marketWeaponOdds(reputation=0){
 const odds={...MARKET.weights};
 for(const tier of ['epic','legendary'])if(reputation<MARKET.unlockReputation[tier]){odds.normal+=odds[tier];odds[tier]=0;}
 return odds;
}
function maintainMarket(s){
 if(s.market?.version!==MARKET.version)s.market={version:MARKET.version,offers:[],rollCounter:0,lastRefreshDay:s.day};
 const market=s.market;market.offers=(market.offers||[]).filter(o=>o&&typeof o.id==='string'&&WEAPONS[o.weaponId]&&o.weaponId!=='none');
 if(!Number.isInteger(market.rollCounter))market.rollCounter=0;
 if(market.offers.length&&market.lastRefreshDay>=s.day)return false;
 market.rollCounter++;let seed=Number(s.worldSeed)||1;for(const ch of `market:${s.day}:${market.rollCounter}`)seed=Math.imul(seed^ch.charCodeAt(0),16777619)>>>0;
 const r=rand(seed),odds=marketWeaponOdds(s.reputation);market.offers=[];
 for(let i=0;i<MARKET.offerCount;i++){
  let roll=r()*100,tier='normal';for(const [key,weight] of Object.entries(odds)){roll-=weight;if(roll<0){tier=key;break;}}
  const catalog=Object.values(WEAPONS).filter(w=>w.id!=='none'&&(w.tier||'normal')===tier),weapon=pick(r,catalog);
  market.offers.push({id:`market_${seed}_${market.rollCounter}_${i}`,weaponId:weapon.id});
 }
 market.lastRefreshDay=s.day;return true;
}
function refreshWeaponMarket(s){
 if(s.pendingContract||s.campaign?.pending)return {ok:false,reason:'Record the saved result before buying or refreshing.'};
 if(s.funds<MARKET.refreshCost)return {ok:false,reason:`Refreshing weapons requires £${MARKET.refreshCost}.`};
 maintainMarket(s);s.market.offers=[];maintainMarket(s);s.funds-=MARKET.refreshCost;chronicle(s,`Refreshed the weapon market for £${MARKET.refreshCost}.`);return {ok:true};
}
function buyMarketWeapon(s,offerId){
 if(s.pendingContract||s.campaign?.pending)return {ok:false,reason:'Record the saved result before buying.'};
 maintainMarket(s);const offer=s.market.offers.find(o=>o.id===offerId),weapon=offer&&WEAPONS[offer.weaponId];
 if(!weapon)return {ok:false,reason:'That weapon offer is no longer available.'};
 if(s.reputation<MARKET.unlockReputation[weapon.tier||'normal'])return {ok:false,reason:'This weapon tier is not yet unlocked.'};
 if(s.funds<weapon.price)return {ok:false,reason:`Buying ${weapon.name} requires £${weapon.price}.`};
 s.funds-=weapon.price;s.weapons[weapon.id]=(s.weapons[weapon.id]||0)+1;s.market.offers=s.market.offers.filter(o=>o.id!==offerId);
 chronicle(s,`Purchased ${weapon.name} for £${weapon.price}.`);maintainMarket(s);return {ok:true,weaponId:weapon.id};
}
function buyMarketMaterial(s,material,quantity=1){
 if(s.pendingContract||s.campaign?.pending)return {ok:false,reason:'Record the saved result before buying.'};
 const unitPrice=MARKET.materialPrices[material];
 if(!Object.hasOwn(MARKET.materialPrices,material)||!Number.isSafeInteger(quantity)||quantity<1||quantity>100)return {ok:false,reason:'Choose a valid material quantity from 1 to 100.'};
 const cost=unitPrice*quantity;if(s.funds<cost)return {ok:false,reason:`Buying ${quantity} ${material} requires £${cost}.`};
 s.funds-=cost;s.materials[material]=(s.materials[material]||0)+quantity;chronicle(s,`Purchased ${quantity} ${material} for £${cost}.`);return {ok:true,cost};
}
function weaponBattleState(agent){const a=getCombatAgent(agent);return a._weaponState||(a._weaponState={});}
function weaponOpeningStrike(actor,target,state,lines=[]){
 const a=getCombatAgent(actor),w=weaponFor(a),runtime=weaponBattleState(a),result={multiplier:1,defPen:0,critical:false,critDamage:0};
 if(runtime.openingSpent)return result;
 runtime.openingSpent=true;
 if(w.rule==='armor_piercer')result.defPen=.25;
 if(w.rule==='last_witness'){result.defPen=.3;result.multiplier=1.35;}
 if(w.rule==='opening_crit'){result.critical=true;result.critDamage=w.tier==='legendary'?.25:0;}
 if(w.rule==='verdict'&&target.shield>0)target.shield=Math.max(0,target.shield-Math.round(target.maxHp*.2));
 if(w.rule==='armor_piercer'||w.rule==='last_witness'){
  const payment=Math.min(Math.max(0,actor.hp-1),Math.ceil(actor.maxHp*(w.rule==='last_witness'?.05:.02)));actor.hp-=payment;
  weaponNote(actor,state,lines,`${w.name} opens with armor penetration; recoil costs ${payment} HP.`);
 }
 if(w.rule==='opening_crit')weaponNote(actor,state,lines,`${w.name} guarantees a critical hit on this landed opening strike.`);
 return result;
}
function weaponAfterBasic(actor,target,state,lines=[],r=Math.random){
 const w=weaponFor(getCombatAgent(actor)),runtime=weaponBattleState(actor);
 if(w.rule==='venom'&&target.alive&&r()<.2&&addStatus(target,'poison',2,actor.id))weaponNote(actor,state,lines,`${w.name} applies Poison for 2 turns.`);
 if(runtime.afterOpeningSpent)return;runtime.afterOpeningSpent=true;
 if(w.rule==='armor_crack'&&target.alive){addFx(target,'debuff','def',.85,2);weaponNote(actor,state,lines,`${w.name} lowers enemy DEF by 15% for 2 turns.`);}
 if(w.rule==='blood_tithe'&&target.alive&&addStatus(target,'curse',1,actor.id))weaponNote(actor,state,lines,`${w.name} applies a one-turn Curse.`);
 if(w.rule==='verdict'&&target.alive){addFx(target,'vuln','vuln',1.15,2);weaponNote(actor,state,lines,`${w.name} exposes the enemy to 15% more damage for 2 turns.`);}
}
function weaponBeforeIncoming(defender,state,lines=[],options={}){
 if(options.indirect||options.reflect||!defender?.alive)return;
 const w=weaponFor(getCombatAgent(defender)),runtime=weaponBattleState(defender);
 if(runtime.wardSpent||!['opening_ward','last_ward'].includes(w.rule)||w.rule==='last_ward'&&defender.hp>defender.maxHp*.35)return;
 runtime.wardSpent=true;const gained=grantShield(defender,defender.maxHp*(w.rule==='last_ward'?.2:.08));
 if(gained)weaponNote(defender,state,lines,`${w.name} grants ${gained} shield.`);
}
function weaponNote(actor,state,lines,text){
 lines.push({text,kind:'status'});emitCombatEvent(state,{round:state?.currentRound||1,type:'status',subtype:'weapon',actorId:actor.id,actorName:actor.name,actorTeam:teamOf(actor,state),text});
}
