export const MATCH_TIME_BUDGET = 18 * 100;

const validPercent = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 10 && number <= 100
    ? Math.round(number)
    : null;
};

export function getMatchTimeBudget(players = [], plan = {}) {
  const total = players.reduce((sum, player) => sum + (validPercent(plan[player.id]) ?? 0), 0);
  return { total, required: MATCH_TIME_BUDGET, remaining: MATCH_TIME_BUDGET - total };
}

export function createMatchTimePlan(players = [], saved = {}, getDefault) {
  const plan = {};
  const adjustable = [];
  for (const player of players) {
    const id = String(player.id);
    const savedPercent = validPercent(saved[id]);
    plan[id] = savedPercent ?? validPercent(getDefault(player)) ?? 80;
    if (savedPercent === null) adjustable.push(id);
  }

  // Balance new defaults only. Existing user choices are never changed silently.
  return balancePlan(plan, adjustable);
}

function balancePlan(plan, adjustable) {
  let remaining = MATCH_TIME_BUDGET - Object.values(plan).reduce((sum, value) => sum + value, 0);
  while (remaining !== 0) {
    const candidates = adjustable.filter((id) => remaining > 0 ? plan[id] < 100 : plan[id] > 10);
    if (!candidates.length) break;
    candidates.sort((a, b) => remaining > 0 ? plan[a] - plan[b] : plan[b] - plan[a]);
    plan[candidates[0]] += Math.sign(remaining);
    remaining -= Math.sign(remaining);
  }
  return plan;
}

export function balanceMatchTimePlan(players = [], current = {}, getDefault) {
  const plan = Object.fromEntries(players.map((player) => [
    String(player.id), validPercent(current[player.id]) ?? validPercent(getDefault(player)) ?? 80,
  ]));
  return balancePlan(plan, Object.keys(plan));
}
