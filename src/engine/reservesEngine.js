import { applyMatchToPlayers } from './fitnessEngine.js';
import { seededRandom } from './simulationClock.js';

// The reserves play on the same fixture day as the senior side. Only players
// omitted from the senior match can appear here.
export function playReservesRound(players, seniorIds, fitness, { club, date, matchId, facilityBonuses = {} } = {}) {
  const selected = new Set([...seniorIds].map(String));
  const participants = players.filter(player => {
    const state = fitness[String(player.id)] ?? {};
    if (selected.has(String(player.id)) || state.lastReserveMatchId === matchId) return false;
    if (Number(state.injury?.weeksRemaining ?? 0) > 0 || Number(state.suspension?.matchesRemaining ?? 0) > 0) return false;
    const assignment = state.reservesAssignment ?? (Number(state.fitness ?? 100) < 72 ? 'REST' : 'RESERVES');
    return assignment === 'RESERVES' && Number(state.fitness ?? 100) >= 65;
  });
  const minutes = Object.fromEntries(participants.map(player => {
    const random = seededRandom(`${matchId}:reserves-minutes:${player.id}`);
    return [String(player.id), 55 + Math.round(random() * 25)];
  }));
  const next = applyMatchToPlayers(participants, minutes, fitness, {
    playedPlayerIds: participants.map(player => player.id), facilityBonuses,
    random: seededRandom(`${matchId}:reserves-injuries:${club}`), date,
    matchId: `${matchId}:RESERVES`, club,
  });
  for (const player of participants) {
    const id = String(player.id);
    next[id] = { ...next[id], lastReserveMatchId: matchId, lastReserveDate: date,
      reservesGames: Number(next[id].reservesGames ?? 0) + 1 };
  }
  return { fitness: next, minutes, participants };
}
