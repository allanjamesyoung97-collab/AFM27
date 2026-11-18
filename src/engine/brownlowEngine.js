// One shared umpire ballot per home-and-away match. Keep it on the match report
// so a saved game never rerolls votes while the count remains sealed.
export function awardBrownlowVotes(match) {
  if (!match?.playerStats || ['FINALS', 'WILDCARD', 'COMMUNITY', 'STATE_LEAGUE'].includes(match.stage)) return null;
  const candidates = [...(match.playerStats.home ?? []), ...(match.playerStats.away ?? [])]
    .filter(row => row.playerId != null && Number(row.timeOnGround ?? 80) > 0)
    .map(row => {
      const d = Number(row.disposals ?? 0), g = Number(row.goals ?? 0);
      // Match influence is the first judgment; the recorded statistics then
      // refine it. The fixed match/player variation prevents automatic votes
      // for the same statistical profile without changing on save/load.
      const seed = `${match.fixtureId ?? match.id ?? `${match.homeTeam}:${match.awayTeam}:${match.round}`}:${row.playerId}`;
      let hash = 2166136261;
      for (const char of seed) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
      const variation = ((hash >>> 0) % 1000) / 1000;
      const influence = d * .72 + g * 4.8 + Number(row.behinds ?? 0) * .6
        + Number(row.clearances ?? 0) * 1.25 + Number(row.contestedPossessions ?? 0) * .42
        + Number(row.tackles ?? 0) * 1.05 + Number(row.marks ?? 0) * .38
        + Number(row.intercepts ?? 0) * .6 + Number(row.hitouts ?? 0) * .14
        - Number(row.turnovers ?? 0) * .6;
      return { playerId: String(row.playerId), playerName: row.playerName, club: row.club,
        influence: influence + variation * 5 + (row.club === (match.winner ?? (match.homeScore > match.awayScore ? match.homeTeam : match.awayScore > match.homeScore ? match.awayTeam : null)) ? 1.8 : 0) };
    })
    .sort((a, b) => b.influence - a.influence || a.playerId.localeCompare(b.playerId));
  if (candidates.length < 3) return null;
  return candidates.slice(0, 3).map(({ influence, ...player }, index) => ({ ...player, votes: 3 - index }));
}

export function brownlowCount(roundHistory = [], tribunalCases = []) {
  const rounds = [...roundHistory].sort((a, b) => Number(a.round) - Number(b.round)).map(entry => ({
    round: Number(entry.round), matches: (entry.results ?? []).map(match => ({
      fixtureId: match.fixtureId ?? match.id, homeTeam: match.homeTeam, awayTeam: match.awayTeam,
      homeScore: match.homeScore, awayScore: match.awayScore,
      votes: match.brownlowVotes ?? awardBrownlowVotes(match) ?? [],
    })),
  }));
  const ineligible = new Set(tribunalCases.filter(item => Number(item.matches ?? 0) >= 1
    && ['ACCEPTED', 'UPHELD'].includes(item.status)
    && (String(item.fixtureId ?? '').includes(':LEAGUE:') || rounds.some(round => round.matches.some(match => match.fixtureId === item.fixtureId))))
    .map(item => String(item.playerId)));
  const totals = new Map();
  for (const round of rounds) for (const match of round.matches) for (const vote of match.votes) {
    const id = String(vote.playerId), current = totals.get(id) ?? { ...vote, votes: 0, byRound: {} };
    current.votes += vote.votes;
    current.byRound[round.round] = (current.byRound[round.round] ?? 0) + vote.votes;
    current.club = vote.club;
    current.ineligible = ineligible.has(id);
    totals.set(id, current);
  }
  const leaderboard = [...totals.values()].sort((a, b) => b.votes - a.votes || a.playerName.localeCompare(b.playerName));
  const eligible = leaderboard.filter(player => !player.ineligible);
  const winningVotes = eligible[0]?.votes ?? 0;
  return { rounds, leaderboard, winners: winningVotes ? eligible.filter(player => player.votes === winningVotes) : [] };
}
