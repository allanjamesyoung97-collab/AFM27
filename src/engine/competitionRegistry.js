import { dayKey } from './simulationClock.js';
// State leagues can be registered without sharing AFL rounds or season boundaries.
// Clubs require distinct names. Rosters may reference AFL player IDs for dual registration.
export function registerCompetition(season, definition) {
  if (!definition?.id || !definition?.name || !Array.isArray(definition.clubs)) throw new Error('Competition identity and clubs are required.');
  const names = new Set(definition.clubs.map(club => club.name));
  const fixture = (definition.fixture ?? []).map((round, index) => ({ ...round, round: round.round ?? index + 1, matches: (round.matches ?? []).map((match, i) => {
    if (!names.has(match.homeTeam) || !names.has(match.awayTeam) || match.homeTeam === match.awayTeam) throw new Error('Registered competition fixtures must reference two different registered clubs.');
    return { ...match, id: match.id ?? `${definition.id}:${definition.year}:${index}:${i}`, date: dayKey(match.date) };
  }) }));
  const ladder = definition.ladder ?? definition.clubs.map(club => ({ club: club.name, wins: 0, losses: 0, draws: 0, points: 0, percentage: 0, pointsFor: 0, pointsAgainst: 0, form: [] }));
  const record = { ...definition, fixture, ladder, results: definition.results ?? [], completed: false };
  return { ...season, competitions: { ...(season.competitions ?? {}), [definition.id]: record } };
}
export function worldClubs(season, clubs) {
  const unique = new Map(clubs.map(club => [club.name, club]));
  for (const competition of Object.values(season.competitions ?? {})) for (const club of competition.clubs ?? []) {
    if (!unique.has(club.name)) unique.set(club.name, { ...club, competitionId: competition.id });
  }
  return [...unique.values()];
}
