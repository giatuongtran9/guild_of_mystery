'use strict';
// A custom playback fixture still needs a real reserved pool definition.
module.exports=(g,s)=>{
 for(const q of s.quests||[]){
  const def=g.CONTRACT_POOL.definitions.find(d=>d.sequence===q.difficultySequence);
  if(!def)throw Error('Invalid fixture contract Sequence');
  q.poolDefinitionId=def.id;q.enemySeed=91337;
 }
 return s;
};
