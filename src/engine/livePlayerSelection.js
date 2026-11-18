// A live event can only involve a player currently on the ground. If the
// preferred line has no candidate, select from the other fielded players.
export function weightedPlayer(rows, predicate = () => true, extraWeight = () => 1, random = Math.random) {
  const fielded = rows.filter((row) => row.onField);
  const preferred = fielded.filter(predicate);
  const candidates = preferred.length ? preferred : fielded;
  if (!candidates.length) return null;
  const weights = candidates.map((row) => {
    const value = Number(row.player?.overall ?? 60) * Number(extraWeight(row));
    return Number.isFinite(value) ? Math.max(0.01, value) : 0.01;
  });
  const total = weights.reduce((sum, value) => sum + value, 0);
  let roll = random() * total;
  for (let index = 0; index < candidates.length; index += 1) {
    roll -= weights[index];
    if (roll <= 0) return candidates[index];
  }
  return candidates.at(-1);
}
