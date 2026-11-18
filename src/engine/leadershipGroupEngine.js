const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));

export function leadershipSeason(seasonState = {}) {
  const year = Number(seasonState.seasonYear ?? 2027);
  return seasonState.phase === "OFFSEASON" && seasonState.seasonHasStarted ? year + 1 : year;
}

export function activeLeadershipGroup(seasonState = {}) {
  const group = seasonState.leadershipGroup ?? {};
  return Number(group.seasonYear) === leadershipSeason(seasonState)
    ? group : { seasonYear: leadershipSeason(seasonState), captains: [], viceCaptains: [] };
}

function attribute(player, key) {
  return Number(player.attributes?.[key] ?? player[key] ?? 50);
}

export function rankLeadershipCandidates(players = [], contracts = {}) {
  return players.map((player) => {
    const age = Number(player.age ?? 24);
    const contract = contracts[String(player.id)] ?? player.contract ?? {};
    const promises = (contract.promises ?? []).filter((promise) => promise.status === "ACTIVE").map((promise) => promise.id);
    const maturity = age < 22 ? -10 : age < 25 ? -3 : age <= 31 ? 6 : age <= 34 ? 3 : -4;
    const security = Number(contract.yearsRemaining ?? contract.years ?? 0) >= 2 ? 4 : -3;
    const promiseBonus = promises.includes("LEADERSHIP_ROLE") ? 7 : promises.includes("CAPTAINCY_PATHWAY") ? 5 : 0;
    const score = Math.round(clamp(
      attribute(player, "leadership") * .46 + attribute(player, "professionalism") * .27
      + attribute(player, "teamwork") * .17 + attribute(player, "composure") * .10
      + maturity + security + promiseBonus,
    ));
    const reasons = [
      `Leadership ${Math.round(attribute(player, "leadership"))}`,
      `professionalism ${Math.round(attribute(player, "professionalism"))}`,
      age < 23 ? "still developing" : age > 34 ? "late career" : "experienced age profile",
      promiseBonus ? "leadership promise" : null,
      security < 0 ? "short contract" : null,
    ].filter(Boolean);
    return { player, score, reasons };
  }).sort((a, b) => b.score - a.score || a.player.name.localeCompare(b.player.name));
}

const MAX_CAPTAINS = 1;
const MAX_VICE_CAPTAINS = 2;
export const LEADERSHIP_LIMITS = Object.freeze({ captains: MAX_CAPTAINS, viceCaptains: MAX_VICE_CAPTAINS });

/** Best-suited leaders for a squad. Used for AI clubs and for the user's "assistant picks". */
export function autoLeadershipGroup(players = [], contracts = {}, seasonYear = null) {
  const ranked = rankLeadershipCandidates(players, contracts);
  return {
    seasonYear,
    captains: ranked.slice(0, MAX_CAPTAINS).map(({ player }) => player.id),
    viceCaptains: ranked.slice(MAX_CAPTAINS, MAX_CAPTAINS + MAX_VICE_CAPTAINS).map(({ player }) => player.id),
  };
}

/** True when at least one named leader is still on the supplied list. */
export function leadershipGroupIsUsable(group, players = []) {
  const ids = new Set(players.map((player) => String(player.id)));
  return [...(group?.captains ?? []), ...(group?.viceCaptains ?? [])].some((id) => ids.has(String(id)));
}

/** The group a club actually plays under: the chosen one if it is still valid, otherwise the best available. */
export function resolveLeadershipGroup(group, players = [], contracts = {}) {
  return leadershipGroupIsUsable(group, players) ? group : autoLeadershipGroup(players, contracts, group?.seasonYear ?? null);
}

export function leadershipGroupQuality(group, players = [], contracts = {}) {
  const rankings = new Map(rankLeadershipCandidates(players, contracts).map((entry) => [String(entry.player.id), entry.score]));
  const scoresFor = (ids) => (ids ?? []).map((id) => rankings.get(String(id))).filter(Number.isFinite);
  const captainScores = scoresFor(group?.captains);
  const viceScores = scoresFor(group?.viceCaptains);
  if (!captainScores.length && !viceScores.length) return 50;
  const mean = (values) => values.reduce((sum, score) => sum + score, 0) / values.length;
  // With no captain, the vice-captains carry the group at a discount.
  if (!captainScores.length) return Math.round(clamp(mean(viceScores) - 8));
  const captain = mean(captainScores);
  const vice = viceScores.length ? mean(viceScores) : captain - 6;
  return Math.round(clamp(captain * .7 + vice * .3));
}

/**
 * Rating points the leadership group adds to a side on match day (about -1.2 to +1.4).
 * An empty group costs a little; a group with nobody in the selected side costs more.
 * Returns 0 when the leaders cannot be found in `players` (nothing to evaluate).
 */
export function leadershipMatchEffect(group, players = [], contracts = {}, selectedIds = new Set()) {
  const leaders = [...(group?.captains ?? []), ...(group?.viceCaptains ?? [])].map(String);
  if (!leaders.length) return -0.4;
  const known = new Set(players.map((player) => String(player.id)));
  const present = leaders.filter((id) => known.has(id) && selectedIds.has(id)).length;
  if (!leaders.some((id) => known.has(id))) return 0;
  if (!present) return -0.8;
  const quality = leadershipGroupQuality(group, players, contracts);
  return Math.round(clamp((quality - 62) / 22 + Math.min(.4, present * .12), -1.2, 1.4) * 10) / 10;
}

/**
 * Quality (0-100) of the leadership group a club negotiates and plays under.
 * `group` is the chosen group (user clubs); AI clubs, or groups that no longer match the list, use the best available.
 */
export function clubLeadershipQuality(group, players = [], contracts = {}) {
  if (!players.length) return null;
  return leadershipGroupQuality(resolveLeadershipGroup(group, players, contracts), players, contracts);
}