// A knockout match cannot finish level. Keep the goal and point totals in
// sync so match reports and season records describe the same result.
export function resolveKnockoutTie(result, random = Math.random) {
  if (Number(result.homeScore) !== Number(result.awayScore)) return result;
  const side = random() < 0.5 ? "home" : "away";
  return {
    ...result,
    [`${side}Goals`]: Number(result[`${side}Goals`] ?? 0) + 1,
    [`${side}Score`]: Number(result[`${side}Score`] ?? 0) + 6,
    extraTime: true,
    playerStats: undefined,
    teamStats: undefined,
  };
}
