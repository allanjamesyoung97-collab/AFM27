import { positionGroups } from "../data/positionGroups.js";
import { getSlotSuitability } from "./positionSuitability.js";

const opposingSlot = {
  FP1: "BP2", FF: "FB", FP2: "BP1", HF1: "HB2", CHF: "CHB", HF2: "HB1",
  W1: "W2", C: "C", W2: "W1", RR: "ROV", R: "R", ROV: "RR",
  HB1: "HF2", CHB: "CHF", HB2: "HF1", BP1: "FP2", FB: "FF", BP2: "FP1",
};
const keySlots = new Set(["FF", "CHF", "FB", "CHB", "R"]);
const attributesByLine = {
  forward: ["goalSense", "marking", "kicking", "positioning", "speed"],
  defence: ["spoiling", "marking", "positioning", "strength", "speed"],
  midfield: ["groundBallGet", "contestedBall", "kicking", "handball", "endurance"],
  ruck: ["ruckCraft", "verticalLeap", "strength", "positioning", "endurance"],
};
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const playerKey = (player) => String(player?.id ?? player?.name ?? "");
const fitnessOf = (player, fitness) => clamp(Number(fitness?.[player.id]?.fitness ?? 100) || 0, 0, 100);
const workloadOf = (player, fitness) => clamp(Number(fitness?.[player.id]?.workload ?? 0) || 0, 0, 100);
const available = (player, fitness) => Number(fitness?.[player.id]?.injury?.weeksRemaining ?? 0) <= 0
  && Number(fitness?.[player.id]?.suspension?.matchesRemaining ?? 0) <= 0;

function lineFor(slot) {
  if (["R"].includes(slot)) return "ruck";
  if (/^(FP|FF|HF|CHF)/.test(slot)) return "forward";
  if (/^(BP|FB|HB|CHB)/.test(slot)) return "defence";
  return "midfield";
}

function averageAttributes(player, keys) {
  const ratings = keys.map((key) => Number(player?.attributes?.[key]))
    .filter((rating) => Number.isFinite(rating) && rating > 1);
  return ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
    : Number(player?.overall ?? 60);
}

function opponentEdge(player, slot, opponent) {
  if (!opponent || !opposingSlot[slot]) return 0;
  const family = lineFor(slot);
  const opposedFamily = lineFor(opposingSlot[slot]);
  const own = averageAttributes(player, attributesByLine[family]);
  const their = averageAttributes(opponent, attributesByLine[opposedFamily]);
  const ownHeight = Number(player?.heightCm ?? player?.height);
  const theirHeight = Number(opponent?.heightCm ?? opponent?.height);
  const heightEdge = keySlots.has(slot) && ownHeight > 140 && theirHeight > 140
    ? clamp((ownHeight - theirHeight) * 0.18, -3, 3) : 0;
  return clamp((own - their) * 0.38 + heightEdge, -8, 8);
}

function score(player, slot, strategy, fitness, opponent) {
  const fit = getSlotSuitability(player, slot).overall;
  const base = Number(player.overall ?? fit);
  const health = fitnessOf(player, fitness);
  const load = workloadOf(player, fitness);
  // Positional quality stays central. Preset effects are large enough to change
  // a close selection, without naming a badly unsuited player by default.
  let result = fit * 0.82 + base * 0.18 + (health - 90) * 0.20;
  if (slot.startsWith("INT")) result += base * 0.03;
  if (strategy === "REST_PLAYERS") {
    result += (health - 80) * 0.55 - load * 0.12;
  } else if (strategy === "PRIORITISE_YOUTH") {
    const upside = Math.max(0, Number(player.potential ?? player.development?.potential ?? base) - base);
    result += clamp(upside * 0.55, 0, 9) + (Number(player.age ?? 26) <= 23 ? 5 : Number(player.age ?? 26) <= 25 ? 2 : -2);
  } else if (strategy === "PROTECT_STARS") {
    if (base >= 85) result -= Math.max(0, 92 - health) * 0.95 + Math.max(0, load - 55) * 0.22;
    else result -= Math.max(0, 78 - health) * 0.20;
  } else if (strategy === "MATCH_OPPONENT") {
    result += opponentEdge(player, slot, opponent);
  }
  return result;
}

// Maximum-score assignment of distinct players to slots. This avoids a greedy
// early back-pocket choice using the only available ruck or key forward.
function assign(slots, players, strategy, fitness, opponents) {
  const rows = slots.length;
  if (!rows) return {};
  const columns = Math.max(rows, players.length);
  const cost = slots.map((slot) => Array.from({ length: columns }, (_, column) =>
    column < players.length ? -score(players[column], slot, strategy, fitness, opponents?.[opposingSlot[slot]])
      : slot.startsWith("INT") ? 100000 : 1000000));
  const u = Array(rows + 1).fill(0);
  const v = Array(columns + 1).fill(0);
  const p = Array(columns + 1).fill(0);
  const way = Array(columns + 1).fill(0);
  for (let row = 1; row <= rows; row += 1) {
    p[0] = row;
    let column = 0;
    const minv = Array(columns + 1).fill(Infinity);
    const used = Array(columns + 1).fill(false);
    do {
      used[column] = true;
      const currentRow = p[column];
      let delta = Infinity;
      let next = 0;
      for (let candidate = 1; candidate <= columns; candidate += 1) {
        if (used[candidate]) continue;
        const value = cost[currentRow - 1][candidate - 1] - u[currentRow] - v[candidate];
        if (value < minv[candidate]) { minv[candidate] = value; way[candidate] = column; }
        if (minv[candidate] < delta) { delta = minv[candidate]; next = candidate; }
      }
      for (let candidate = 0; candidate <= columns; candidate += 1) {
        if (used[candidate]) { u[p[candidate]] += delta; v[candidate] -= delta; }
        else minv[candidate] -= delta;
      }
      column = next;
    } while (p[column]);
    do {
      const previous = way[column];
      p[column] = p[previous];
      column = previous;
    } while (column);
  }
  const selected = {};
  for (let column = 1; column <= columns; column += 1) {
    if (p[column]) selected[slots[p[column] - 1]] = players[column - 1]?.name ?? null;
  }
  return selected;
}

export function selectTeamPreset({ players = [], strategy = "BEST_AVAILABLE", playerFitness = {}, opponentPlayers = [], lockedSide = {} } = {}) {
  const eligible = players.filter((player) => player?.name && available(player, playerFitness));
  const byName = new Map(eligible.map((player) => [player.name, player]));
  const slots = Object.keys(positionGroups);
  const saved = {};
  const used = new Set();
  for (const slot of slots) {
    const player = byName.get(lockedSide?.[slot]);
    if (player && !used.has(playerKey(player))) {
      saved[slot] = player.name;
      used.add(playerKey(player));
    }
  }
  const opponentSide = strategy === "MATCH_OPPONENT" && opponentPlayers.length
    ? selectTeamPreset({ players: opponentPlayers, strategy: "BEST_AVAILABLE", playerFitness }).selectedSide
    : null;
  const opponentBySlot = opponentSide && Object.fromEntries(Object.entries(opponentSide)
    .map(([slot, name]) => [slot, opponentPlayers.find((player) => player.name === name)]));
  const remaining = eligible.filter((player) => !used.has(playerKey(player)))
    .sort((a, b) => playerKey(a).localeCompare(playerKey(b)));
  const freeSlots = slots.filter((slot) => !saved[slot]);
  const chosen = assign(freeSlots, remaining, strategy, playerFitness, opponentBySlot);
  return { selectedSide: Object.fromEntries(slots.map((slot) => [slot, saved[slot] ?? chosen[slot] ?? null])) };
}
