// A played match keeps its statistics in the same record as the action that
// produced them. This also lets saved matches be audited without replaying RNG.
export const LIVE_MATCH_STAT_KEYS = [
  "disposals", "kicks", "handballs", "marks", "tackles", "goals", "behinds",
  "hitouts", "clearances", "centreClearances", "stoppageClearances",
  "contestedPossessions", "inside50s", "rebound50s", "intercepts",
  "marksInside50", "contestedMarks", "tacklesInside50", "turnovers",
  "freeKicksFor", "freeKicksAgainst", "bounces", "onePercenters",
  "effectiveDisposals",
];

export function captureActionStatChanges(before, after) {
  const changes = [];
  for (const side of ["home", "away"]) {
    const previous = new Map((before?.[side] ?? []).map((row) => [String(row.playerId), row]));
    for (const row of after?.[side] ?? []) {
      const old = previous.get(String(row.playerId));
      const stats = Object.fromEntries(LIVE_MATCH_STAT_KEYS.map((key) => [
        key, (Number(row[key]) || 0) - (Number(old?.[key]) || 0),
      ]).filter(([, delta]) => delta !== 0));
      if (Object.keys(stats).length) changes.push({ side, playerId: row.playerId, stats });
    }
  }
  return changes;
}

export function applyActionStatChanges(before, action, matchRows) {
  const byPlayer = new Map((action?.statChanges ?? []).map((change) => [
    `${change.side}:${change.playerId}`, change.stats,
  ]));
  return Object.fromEntries(["home", "away"].map((side) => [side,
    (before?.[side] ?? []).map((row, index) => {
      const current = matchRows?.[side]?.[index] ?? row;
      const changes = byPlayer.get(`${side}:${row.playerId}`) ?? {};
      const stats = Object.fromEntries(LIVE_MATCH_STAT_KEYS.map((key) => [
        key, (Number(row[key]) || 0) + (Number(changes[key]) || 0),
      ]));
      return { ...current, ...stats };
    }),
  ]));
}
