// Shared, bounded match inputs for the fast simulation and the played match.
import { getSlotSuitability } from "./positionSuitability.js";
import { leadershipMatchEffect, resolveLeadershipGroup } from "./leadershipGroupEngine.js";
import { moraleMatchRating } from "./moraleEngine.js";
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

/**
 * Side strength from the players actually named, their condition, morale and leadership.
 * options (all optional):
 *   leadershipGroup  the club's chosen group (user club); others use their best available leaders
 *   squadPlayers     the full list, so a captain who is not selected can still be recognised
 *   contracts        contracts by player id, used to rank leaders
 */
export function selectedSideStrength(baseStrength, lineup = [], fitnessByPlayer = {}, options = {}) {
  const starters = lineup.filter((entry) => entry?.player && entry.onField !== false
    && (!String(entry.position ?? "").startsWith("INT") || entry.onField === true));
  if (starters.length < 12) return Number(clamp(70 + Number(baseStrength ?? 0), 40, 100).toFixed(2));
  const rating = starters.reduce((sum, entry) => {
    const player = entry.player;
    const condition = fitnessByPlayer[player.id] ?? {};
    const fitness = clamp(Number(condition.fitness ?? 90), 0, 100);
    const sharpness = clamp(Number(condition.matchSharpness ?? 75), 0, 100);
    const readiness = clamp((fitness - 75) * .055 + (sharpness - 65) * .035, -5, 2.5);
    const morale = moraleMatchRating(condition.morale);
    return sum + getSlotSuitability(player, entry.position).overall + readiness + morale;
  }, 0) / starters.length;
  // The selected players are the rating: no club-wide preset anchors the result.
  // baseStrength remains an optional situational adjustment for finals seeding.
  return Number(clamp(rating + Number(baseStrength ?? 0) + sideLeadershipEffect(lineup, options), 40, 100).toFixed(2));
}

function sideLeadershipEffect(lineup, options = {}) {
  const lineupPlayers = lineup.map((entry) => entry?.player).filter(Boolean);
  if (!lineupPlayers.length) return 0;
  const squad = options.squadPlayers?.length ? options.squadPlayers : lineupPlayers;
  const contracts = options.contracts ?? {};
  const group = options.leadershipGroup
    ? options.leadershipGroup
    : resolveLeadershipGroup(null, squad, contracts);
  const selectedIds = new Set(lineupPlayers.map((player) => String(player.id)));
  return leadershipMatchEffect(group, squad, contracts, selectedIds);
}

export function lineMatchEffects(model) {
  const edges = model?.lineEdges ?? {};
  const forward = clamp(Number(edges.forward ?? 0), -18, 18);
  const midfield = clamp(Number(edges.midfield ?? 0), -18, 18);
  const defence = clamp(Number(edges.defence ?? 0), -18, 18);
  return {
    forward,
    midfield,
    defence,
    stoppage: clamp(1 + midfield * .006, .9, 1.1),
    transition: clamp(1 + midfield * .004 + defence * .003, .88, 1.12),
    entries: clamp(1 + midfield * .003 + forward * .004, .88, 1.12),
    scoring: clamp(1 + forward * .006, .9, 1.1),
    containment: clamp(1 + defence * .006, .9, 1.1),
  };
}