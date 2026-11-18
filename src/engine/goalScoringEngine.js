const ROLE_WEIGHT = Object.freeze({
  KPF: 3.4, FF: 2.7, HF: 1.8, FP: 2.1,
  MID: 0.9, WING: 0.7, RUC: 0.55,
  BP: 0.25, HB: 0.32, KPD: 0.22,
});

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

/** The same scoring opportunity model is used by live and simulated matches. */
export function getGoalScoringWeight(player, { role, participation = 1, scoringRate = 0 } = {}) {
  const position = String(role ?? player?.matchPosition ?? player?.positions?.[0] ?? '').toUpperCase();
  const overall = Number(player?.overall ?? 65);
  const attributes = player?.attributes ?? {};
  const goalSense = Number(attributes.goalSense ?? overall);
  const marking = Number(attributes.marking ?? overall);
  const positioning = Number(attributes.positioning ?? overall);
  const quality = clamp(1 + (overall - 75) * 0.008 + (goalSense - 75) * 0.009
    + (marking - 75) * 0.004 + (positioning - 75) * 0.003, 0.72, 1.35);
  const trait = clamp(1 + Number(scoringRate || 0) * 0.65, 0.8, 1.3);
  return (ROLE_WEIGHT[position] ?? 0.35) * quality * trait * clamp(Number(participation), 0, 1);
}

/** Assign each actual team goal to one player, preserving the match score. */
export function distributePlayerGoals(total, players, weightForPlayer, random = Math.random) {
  const result = Array(players.length).fill(0);
  const weights = players.map((player, index) => Math.max(0, Number(weightForPlayer(player, index)) || 0));
  const sum = weights.reduce((value, weight) => value + weight, 0);
  if (!sum) return result;
  for (let goal = 0; goal < Math.max(0, Math.floor(total)); goal += 1) {
    let draw = random() * sum;
    for (let index = 0; index < weights.length; index += 1) {
      draw -= weights[index];
      if (draw < 0 || index === weights.length - 1) {
        result[index] += 1;
        break;
      }
    }
  }
  return result;
}
