'use strict';
const assert = require('node:assert/strict');

function seeded(seed) {
  let state = seed >>> 0;
  return () => ((state = (Math.imul(1664525, state) + 1013904223) >>> 0) / 4294967296);
}

function options(args = process.argv.slice(2)) {
  return Object.fromEntries(args.map(arg => arg.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
}

function sequences(value = '9,8,7,6,5,4,3,2,1,0') {
  const result = [...new Set(String(value).split(',').map(Number))];
  assert(result.length && result.every(s => Number.isInteger(s) && s >= 0 && s <= 9), 'Sequences must be integers from 9 to 0.');
  return result;
}

function preparedHero(g, pathway, sequence, id, opts = {}) {
  const agent = g.makeAgent(() => .5, { sequence: 10, trait: 'Stout Vitality' });
  Object.assign(agent, {
    id, name: id, path: pathway, sequence, awakened: true, injuries: 0, madness: 0,
    weaponId: opts.weapon || 'rare_sword', weaponMastery: {}, cooldowns: {},
    statVariance: { hp: 1, atk: 1, def: 1, int: 1, speed: 1 }, speedVariance: 1
  });
  assert(g.WEAPONS[agent.weaponId], 'Unknown benchmark weapon: ' + agent.weaponId);
  g.restatAgent(agent);
  agent.sp = g.maxSPFor(agent);
  g.setMeterValue(agent, pathway, Number(opts.charge || 0));
  if (opts.assets && opts.assets !== 'empty') require('./permanent-asset-loadouts')(g, agent, opts.assets, {
    fixture: opts.collectionFixture || 'balanced', assetAge: Number(opts.assetAge || 0)
  });
  return agent;
}

function authoredProfile(agent, charge = 0) {
  return {
    id: agent.id, name: agent.name, path: agent.path, sequence: agent.sequence, trait: agent.trait,
    traitId: agent.traitId, traitTier: agent.traitTier, traitSource: agent.traitSource,
    stats: { ...agent.stats }, sp: agent.sp, weaponId: agent.weaponId,
    weaponMastery: { ...agent.weaponMastery }, meter: charge,
    pathwayInventory: agent.pathwayInventory ? JSON.parse(JSON.stringify(agent.pathwayInventory)) : null
  };
}

function battleRecord(result, a, b, sequence, seed, sample, reversed) {
  const own = reversed ? result.battleSnapshot.enemies : result.battleSnapshot.allies;
  const foes = reversed ? result.battleSnapshot.allies : result.battleSnapshot.enemies;
  const aAlive = own.some(unit => unit.alive), bAlive = foes.some(unit => unit.alive);
  const units = [...result.battleSnapshot.allies, ...result.battleSnapshot.enemies];
  for (const unit of units) for (const key of ['hp', 'maxHp', 'sp', 'maxSP'])
    assert(Number.isFinite(unit[key]) && unit[key] >= 0, `Invalid ${key} on ${unit.id}`);
  const winner = aAlive && !bAlive ? 'a' : bAlive && !aAlive ? 'b' : null;
  const rounds = Math.max(0, ...result.events.map(event => event.round || 0));
  return {
    sequence, a: a.path, b: b.path, seed, sample, reversed, rounds, winner,
    winnerPathway: winner === 'a' ? a.path : winner === 'b' ? b.path : null,
    winnerId: winner === 'a' ? a.id : winner === 'b' ? b.id : null,
    winnerTeam: winner ? ((winner === 'a') !== reversed ? 'allies' : 'enemies') : null,
    outcome: result.battleOutcome, timeout: result.battleOutcome === 'timeout',
    mutual: result.battleOutcome === 'mutual_defeat',
    final: units.map(unit => [unit.id, unit.alive, unit.hp, unit.maxHp, unit.sp])
      .sort((left, right) => left[0].localeCompare(right[0]))
  };
}

function emptyCohort(pathway, sequence) {
  return { pathway, sequence, battles: 0, wins: 0, losses: 0, draws: 0, timeouts: 0, mutualDefeats: 0, rounds: 0 };
}

function finishCohort(cohort) {
  return Object.assign(cohort, {
    winRate: cohort.wins / cohort.battles,
    decisiveWinRate: cohort.wins / Math.max(1, cohort.wins + cohort.losses),
    scoreRate: (cohort.wins + .5 * cohort.draws) / cohort.battles,
    drawRate: cohort.draws / cohort.battles,
    meanObservedRounds: cohort.rounds / cohort.battles
  });
}

function summarize(records, pathways, seqs, focus = pathways) {
  const cohorts = new Map(focus.flatMap(p => seqs.map(s => [p + ':' + s, emptyCohort(p, s)])));
  const matchups = new Map();
  for (const record of records) {
    if (record.a === record.b) continue;
    for (const [side, p, opponent] of [['a', record.a, record.b], ['b', record.b, record.a]]) {
      if (!focus.includes(p)) continue;
      const matchupKey = `${p}:${opponent}:${record.sequence}`;
      if (!matchups.has(matchupKey)) matchups.set(matchupKey, { ...emptyCohort(p, record.sequence), opponent });
      for (const cohort of [cohorts.get(p + ':' + record.sequence), matchups.get(matchupKey)]) {
        cohort.battles++;
        cohort.rounds += record.rounds;
        cohort.timeouts += Number(record.timeout);
        cohort.mutualDefeats += Number(record.mutual);
        if (!record.winner) cohort.draws++;
        else if (record.winner === side) cohort.wins++;
        else cohort.losses++;
      }
    }
  }
  const rows = [...cohorts.values()].filter(c => c.battles).map(finishCohort);
  const aggregates = focus.map(p => {
    const own = rows.filter(row => row.pathway === p), combined = emptyCohort(p, null);
    for (const row of own) for (const key of ['battles', 'wins', 'losses', 'draws', 'timeouts', 'mutualDefeats', 'rounds']) combined[key] += row[key];
    return { ...finishCohort(combined), minSequenceWin: Math.min(...own.map(row => row.winRate)), maxSequenceWin: Math.max(...own.map(row => row.winRate)) };
  }).sort((a, b) => b.winRate - a.winRate);
  const completed = records.filter(record => !record.timeout).map(record => record.rounds).sort((a, b) => a - b);
  const percentile = fraction => completed.length ? completed[Math.min(completed.length - 1, Math.floor(completed.length * fraction))] : null;
  const histogram = {};
  for (const record of records) histogram[record.rounds] = (histogram[record.rounds] || 0) + 1;
  const nonMirror = records.filter(record => record.a !== record.b);
  const decisive = nonMirror.filter(record => record.winner);
  const assigned = team => nonMirror.filter(record => record.reversed ? team === 'b' : team === 'a');
  const summary = {
    battles: records.length, nonMirrorBattles: nonMirror.length,
    draws: records.filter(record => !record.winner).length,
    drawRate: records.filter(record => !record.winner).length / records.length,
    timeouts: records.filter(record => record.timeout).length,
    mutualDefeats: records.filter(record => record.mutual).length,
    meanObservedRounds: records.reduce((sum, record) => sum + record.rounds, 0) / records.length,
    meanCompletedRounds: completed.length ? completed.reduce((sum, rounds) => sum + rounds, 0) / completed.length : null,
    medianCompletedRounds: percentile(.5), p90CompletedRounds: percentile(.9), p99CompletedRounds: percentile(.99),
    maxCompletedRounds: completed.length ? completed[completed.length - 1] : null,
    completedBy12: records.filter(record => record.winner && record.rounds <= 12).length / records.length,
    completedBy50: records.filter(record => record.winner && record.rounds <= 50).length / records.length,
    alliesWinRate: nonMirror.filter(record => record.winnerTeam === 'allies').length / nonMirror.length,
    alliesDecisiveWinRate: decisive.filter(record => record.winnerTeam === 'allies').length / Math.max(1, decisive.length),
    alphaDecisiveWinRate: decisive.filter(record => record.winnerId === 'Alpha0').length / Math.max(1, decisive.length),
    identityAssignments: { aAllied: assigned('a').length, bAllied: assigned('b').length },
    cohortsWithinTarget: rows.filter(row => row.winRate >= .45 && row.winRate <= .55).length,
    cohorts: rows.length, histogram
  };
  return { summary, aggregates, rows, matchups: [...matchups.values()].map(finishCohort) };
}

module.exports = { seeded, options, sequences, preparedHero, authoredProfile, battleRecord, summarize };
