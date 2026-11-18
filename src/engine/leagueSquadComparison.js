// Compare the best available players for each position group across the league.
// Missing starters count as replacement-level players so a single star cannot
// make a depleted group look elite.
export const POSITION_GROUPS = {
  keyDefenders: { label: 'Key Defenders', positions: ['KPD'], starters: 2 },
  keyForwards: { label: 'Key Forwards', positions: ['KPF'], starters: 2 },
  midfielders: { label: 'Midfielders', positions: ['MID', 'WING'], starters: 6 },
  rucks: { label: 'Rucks', positions: ['RUC'], starters: 1 },
  smallDefenders: { label: 'Small Defenders', positions: ['HB', 'BP'], starters: 4 },
  smallForwards: { label: 'Small Forwards', positions: ['HF', 'FF'], starters: 4 },
};

const replacementOverall = 55;
const numeric = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export function evaluatePositionGroup(players, group) {
  const eligible = players.filter(player => {
    const positions = Array.isArray(player.positions) ? player.positions : [player.position];
    return positions.some(position => group.positions.includes(position));
  }).sort((a, b) => numeric(b.overall, 60) - numeric(a.overall, 60));
  const starters = eligible.slice(0, group.starters);
  const missing = group.starters - starters.length;
  const score = Math.round((starters.reduce((sum, player) => sum + numeric(player.overall, 60), 0)
    + missing * replacementOverall) / group.starters * 10) / 10;
  return { players: eligible, count: eligible.length, score, missing, starters: group.starters };
}

export function compareLeagueSquads(playersByClub, clubName) {
  const clubs = Object.keys(playersByClub);
  const result = {};
  for (const [key, group] of Object.entries(POSITION_GROUPS)) {
    const scores = clubs.map(name => ({ club: name, ...evaluatePositionGroup(playersByClub[name], group) }))
      .sort((a, b) => b.score - a.score || a.club.localeCompare(b.club));
    const own = scores.find(entry => entry.club === clubName) ?? { ...evaluatePositionGroup([], group), club: clubName };
    const rank = scores.length ? 1 + scores.filter(entry => entry.score > own.score).length : null;
    const leagueAverage = scores.length
      ? Math.round(scores.reduce((sum, entry) => sum + entry.score, 0) / scores.length * 10) / 10 : 0;
    const rankFraction = rank == null ? 1 : (rank - 1) / Math.max(1, scores.length - 1);
    const gap = Math.round((own.score - leagueAverage) * 10) / 10;
    const label = own.missing > 0 ? 'Shortage'
      : rankFraction <= 0.17 && gap >= 2 ? 'Elite'
      : rankFraction <= 0.39 && gap >= 0.5 ? 'Strong'
      : rankFraction >= 0.83 && gap <= -2 ? 'Weak'
      : rankFraction >= 0.67 && gap <= -1.5 ? 'Below average' : 'Competitive';
    const colors = { Elite: '#22c55e', Strong: '#4ade80', Competitive: '#38bdf8', 'Below average': '#f59e0b', Weak: '#f97316', Shortage: '#ef4444' };
    result[key] = {
      ...own, label: group.label, rank, leagueSize: scores.length, leagueAverage,
      gap,
      depth: { rating: scores.length > 1 ? Math.round((1 - rankFraction) * 100) : 50, label, color: colors[label] },
    };
  }
  return result;
}
