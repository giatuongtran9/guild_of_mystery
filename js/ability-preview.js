// Disposable animation demonstrations use the same casts and event stream as combat.
// Nothing in this module reads or settles a guild save.
function abilityPreviewCatalog(){
 return PATH_KEYS.flatMap(path=>pathOf(path).sequences.flatMap(tier=>(tier.abilities||[])
  .filter(ability=>ability.type==='active').map(ability=>({path,sequence:tier.sequence,ability:cloneE(ability)}))));
}
function buildAbilityPreview({path,sequence,seed=1007}={}){
 const entry=abilityPreviewCatalog().find(item=>item.path===path&&item.sequence===Number(sequence));
 if(!entry)throw new Error('Choose an active ability from a valid Pathway and Sequence.');
 const ability=cloneE(entry.ability),effects=abilityEffects(ability),id=ability.effectId||ability.id;
 const notes=[],lines=[],r=rand(seed),previousBattle=ACTIVE_BATTLE;
 // Construct local records directly: recruitment's shared ID counter is untouched.
 const make=(unitId,name,unitPath=path,awakened=true)=>{
  const stats=Object.fromEntries(Object.entries(tableStats(path,entry.sequence)).filter(([key])=>key!=='spd'));
  const raw={id:unitId,name,path:unitPath,sequence:entry.sequence,awakened,status:'active',unitType:'agent',
   trait:'Stout Vitality',stats,baseStats:{...stats},humanStats:{...stats},statVariance:{hp:1,atk:1,def:1,int:1,speed:1},
   speedVariance:1,weaponId:'none',weaponMastery:{},resistanceBonuses:{},injuries:0,madness:0,corruption:0,
   cooldowns:{},recorded:[],permanentTraits:[],threadTargets:[],activeThreads:0};
  raw.sp=raw.maxSP=maxSPFor(raw);
  return makeCombatUnit(raw);
 };
 const caster=make('preview_caster',`${pathOf(path).name} · Sequence ${entry.sequence}`);
 const ally=make('preview_ally','Training Ally','moon',false);
 const area=effects.some(effect=>effect.type==='targeting'&&['all_enemies','up_to_3_enemies'].includes(effect.mode));
 const enemies=Array.from({length:area?3:1},(_,index)=>make(`preview_target_${index}`,index?'Training Target '+(index+1):'Training Target','tyrant',false));
 const target=enemies[0];
 // Training partners have no awakened powers. Their bodies can survive demonstrations.
 for(const unit of [ally,...enemies]){
  unit._formUsed=unit.agent._formUsed=true;
  unit.maxHp=Math.max(unit.maxHp,caster.maxHp*4);unit.hp=unit.maxHp;
 }
 const state={allies:[caster,ally],enemies,events:[],balanceTrace:[],weaponUsage:{},currentRound:3,currentTurn:1,
  rng:r,createdMarionettes:[],battleMarionettes:[]};
 const snapshot=unit=>({...combatResourceSnapshot(unit,state),stats:cloneE(unit.stats),initiative:unitInitiative(unit)});
 const addPrepared=(kind,fields)=>{
  const inventory=ensurePathwayInventory(caster.agent);
  const asset={id:'preview_asset_'+kind,ownerId:caster.id,kind,sequence:entry.sequence,condition:'ready',hpRatio:1,...fields};
  inventory.assets.push(asset);inventory.prepared.push(asset.id);inventory.policy='auto';
 };
 try{
  bindBattle(state,lines);
  initializePathwayBattle(state,{kind:'preview',id:'ability-preview',name:'Ability demonstration'},seed,{disablePermanentAssets:true});
  setMeterValue(caster.agent,path,100);
  applyPartyPassiveEffects(state.allies);applyPartyPassiveEffects(state.enemies);
  notes.push('Full SP and pathway charge are provided for this demonstration.');
  const rules=effects.filter(effect=>effect.type==='signature').map(effect=>effect.rule);
  const healing=effects.some(effect=>['heal','lifesteal','heal_damage_ratio','steal_stat'].includes(effect.type))
   ||rules.some(rule=>['moon_medicine','moon_blood','mother_seed','fortune_rewind'].includes(rule));
  if(healing){caster.hp=Math.ceil(caster.maxHp*.65);ally.hp=Math.ceil(ally.maxHp*.55);notes.push('The caster and ally begin injured so recovery can be seen.');}
  if(effects.some(effect=>['cleanse','transfer_debuffs'].includes(effect.type))){
   addStatus(caster,'poison',2,'Training setup');addStatus(ally,'poison',2,'Training setup');
   notes.push('A removable Poison is prepared for cleansing or transfer.');
  }
  if(effects.some(effect=>['strip_buffs','vulnerability_if_buffed'].includes(effect.type))){
   addFx(target,'buff','atk',1.2,2);notes.push('The target begins with a removable ATK buff.');
  }
  if(effects.some(effect=>effect.type==='vulnerability_vs_corrupted')){target.agent.corruption=20;notes.push('The target has Corruption for this ability’s conditional effect.');}
  if(effects.some(effect=>effect.type==='execute')){target.hp=Math.ceil(target.maxHp*.1);notes.push('The target begins below the execution threshold.');}
  if(area)notes.push('Three targets are present to demonstrate the area effect.');
  const borrowed=cloneE(tierFor('tyrant',8).abilities[0]);
  if(rules.some(rule=>['door_record','error_theft','tower_imitation'].includes(rule))){
   if(rules.includes('door_record')){
    addPrepared('record',{sourcePath:'tyrant',sequence:8,abilityId:borrowed.effectId,sourceId:target.id,sourceName:'Training Target'});
    initializePathwayBattle(state,{kind:'preview',id:'ability-preview'},seed,{disablePermanentAssets:true});
    notes.push('A stored Raging Blow record is prepared; the replay uses the recorded ability’s effect.');
   }else{
    const count=rules.includes('tower_imitation')?2:1;
    state._abilityHistoryByUnit=Object.create(null);
    state._abilityHistoryByUnit[target.id]=Array.from({length:count},()=>({spec:cloneE(borrowed),sequence:8,round:2}));
    notes.push(count===2?'The target has demonstrated Raging Blow twice for imitation.':'A previously observed Raging Blow is available to steal.');
   }
  }
  if(rules.includes('death_summon')){addPrepared('spirit',{definitionId:'graveguard'});notes.push('A captured, prepared Graveguard spirit is available to summon.');}
  if(rules.includes('moon_beast')){addPrepared('beast',{definitionId:'grey_hound'});deployPreparedPathwayCompanions(state,lines);notes.push('A prepared Grey Hound is deployed before Beast Command.');}
  if(rules.includes('paragon_device')){addPrepared('device',{definitionId:'copper_turret'});deployPreparedPathwayCompanions(state,lines);notes.push('A prepared Copper Turret is deployed for the alchemical mark.');}
  if(rules.includes('fortune_rewind')){
   caster._signatureHistory=[{round:1,hp:caster.maxHp,fx:[]}];notes.push('A healthier snapshot from two rounds earlier is prepared for the rewind.');
  }
  // Setup events are represented by initial snapshots, never played as fictitious actions.
  state.events.length=0;lines.length=0;
  const initialAllies=state.allies.map(snapshot),initialEnemies=state.enemies.map(snapshot);
  const succeeded=id==='thread_binding'?castThreadBinding(caster.agent,caster,target,state,lines,r)
   :applyStructuredAbility(caster.agent,caster,target,state,lines,r,cloneE(ability));
  if(!succeeded)throw new Error('This ability could not be prepared for its demonstration.');
  emitCombatResources(state);
  // Only the minimum real trigger needed to exhibit a delayed mechanic is added.
  if(id==='paper_figurine_rebound'&&target.alive&&caster.alive){
   notes.push('One controlled incoming basic attack triggers the paper guard and its fire reflection.');
   attackOnce(target.agent,target,caster,state,lines,r);emitCombatResources(state);
  }
  if(rules.includes('mother_seed')){
   notes.push('The seeded ally’s next turn is shown to demonstrate regeneration.');
   const seeded=signatureUnits(state).find(unit=>unit._signatureSeed?.ownerId===caster.id);
   if(seeded){state.currentRound++;emitCombatEvent(state,{type:'round_start'});signatureTurnStart(seeded,state,lines,r);emitCombatResources(state);}
  }
  if(rules.includes('error_parasite')&&target.alive){
   notes.push('The host’s next turn is shown to demonstrate the parasite’s resource drain.');
   state.currentRound++;emitCombatEvent(state,{type:'round_start'});signatureTurnStart(target,state,lines,r);emitCombatResources(state);
  }
  return {path,sequence:entry.sequence,ability,initialAllies,initialEnemies,events:cloneE(state.events),lines:cloneE(lines),
   groupedRounds:groupEventsToRows(cloneE(state.events)),notes,finalUnits:signatureUnits(state).map(snapshot),balanceTrace:cloneE(state.balanceTrace)};
 }finally{bindBattle(previousBattle?.state,previousBattle?.lines);}
}
