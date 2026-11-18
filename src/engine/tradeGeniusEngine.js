// Trade Genius — finds trades clubs will accept. Acceptance uses the Shop Your
// Assets exchange rules plus the fair-trade protections in playerValuationEngine
// (best-23 premiums, the headline-player rule and the market-value guard), so
// clubs do not give up stars for role players.
//
// Two modes:
//  - generateTargetSuggestions: the manager names the positions/types they want
//    (up to three). Wants can be filled by one club or by several clubs; when
//    several clubs are involved the manager's assets are split between them so
//    that every club accepts its own leg.
//  - generateShopSuggestions: the manager picks assets to shop and Trade Genius
//    finds the best return each club will agree to.
//
// All functions are pure. Eligibility and salary-cap checks come in as callbacks
// so the engine stays independent of save/season state.

import {
  calculateAssetPackageValue,
  calculateOfferValue,
  calculatePickValue,
  calculatePlayerValue,
  evaluateFairPackageExchange,
  fairGuardsPass,
  getClubSpecificValuation,
  getFairExchangeRequirement,
  getNeutralMarketValue,
} from "./playerValuationEngine.js";
import { normalizePositionCode } from "../data/positionGroups.js";

export const POSITION_CODES = ["KPD", "HB", "BP", "MID", "WING", "HF", "FF", "KPF", "RUC"];
export const POSITION_TYPES = {
  Midfield: ["MID", "WING"],
  Defender: ["KPD", "HB", "BP"],
  Forward: ["KPF", "FF", "HF"],
  "Key position": ["KPD", "KPF"],
  Ruck: ["RUC"],
};

const MAX_POOL_PLAYERS = 30;
const MAX_POOL_PICKS = 12;
const FEASIBLE_PER_LEG = 40;
const TARGETS_PER_WANT = 6;
const MAX_WANTS = 3;

export const assetKey = (kind, id) => `${kind}:${id}`;
const positionsOf = (player) => (Array.isArray(player?.positions) && player.positions.length ? player.positions : player?.position ? [player.position] : [])
  .map(normalizePositionCode);

export function wantPositions(want) {
  if (!want) return [];
  return want.kind === "type" ? POSITION_TYPES[want.value] ?? [] : [normalizePositionCode(want.value)];
}

export function describeWant(want) {
  return want?.kind === "type" ? want.value : String(want?.value ?? "").toUpperCase();
}

export function playerMatchesWant(player, want) {
  const wanted = wantPositions(want);
  return positionsOf(player).some((position) => wanted.includes(position));
}

const pickLabelDefault = (pick) => `${pick.year ?? ""} round ${pick.round ?? "?"} pick`;

// ---------------------------------------------------------------------------
// Asset pool (the manager's tradeable assets)
// ---------------------------------------------------------------------------
function buildPool({ userClubName, players, draftPickAssets, excludedKeys, context, canTrade, onlyKeys = null }) {
  const excluded = new Set(excludedKeys ?? []);
  const own = players.filter((player) => player.club === userClubName);
  const best23 = new Set([...own].sort((a, b) => Number(b.overall ?? 0) - Number(a.overall ?? 0)).slice(0, 23).map((player) => String(player.id)));
  const playerAssets = own
    .filter((player) => canTrade(player))
    .map((player) => {
      const marketValue = calculatePlayerValue(player, context);
      const inBest23 = best23.has(String(player.id));
      return { key: assetKey("player", player.id), kind: "player", player, marketValue, inBest23, cost: marketValue * (inBest23 ? 1.25 : 0.9) };
    });
  const pickAssets = (draftPickAssets ?? [])
    .filter((pick) => pick.currentOwner === userClubName)
    .map((pick) => {
      const marketValue = calculatePickValue(pick, context);
      return { key: assetKey("pick", pick.id), kind: "pick", pick, marketValue, inBest23: false, cost: marketValue };
    });
  const allowed = (asset) => onlyKeys ? onlyKeys.includes(asset.key) : !excluded.has(asset.key);
  const byValue = (a, b) => b.marketValue - a.marketValue;
  const players_ = playerAssets.filter(allowed).sort(byValue).slice(0, onlyKeys ? 99 : MAX_POOL_PLAYERS);
  const picks_ = pickAssets.filter(allowed).sort(byValue).slice(0, onlyKeys ? 99 : MAX_POOL_PICKS);
  return [...players_, ...picks_];
}

function buildCombos(poolSize) {
  const combos = [];
  for (let a = 0; a < poolSize; a += 1) {
    combos.push([a, -1, -1]);
    for (let b = a + 1; b < poolSize; b += 1) {
      combos.push([a, b, -1]);
      for (let c = b + 1; c < poolSize; c += 1) combos.push([a, b, c]);
    }
  }
  return combos;
}

// Package value uses the same weighting as calculateAssetPackageValue:
// strongest asset 100%, second 70%, third 49%.
function packageValue(values) {
  const sorted = values.slice().sort((a, b) => b - a);
  return Math.round(sorted.reduce((total, value, index) => total + value * (0.7 ** index), 0));
}

const toPackage = (assets) => ({
  players: assets.filter((asset) => asset.kind === "player").map((asset) => asset.player),
  picks: assets.filter((asset) => asset.kind === "pick").map((asset) => asset.pick),
});

// Salary-cap checks are comparatively slow, so they run on the best candidates
// first and stop once enough suggestions have passed.
function applyCapCheck(sortedCandidates, capCheck, wanted) {
  const accepted = [];
  for (const suggestion of sortedCandidates) {
    const cap = capCheck(suggestion);
    if (cap && cap.ok === false) continue;
    if (cap?.warning) suggestion.warning = cap.warning;
    accepted.push(suggestion);
    if (accepted.length >= wanted) break;
  }
  return accepted;
}

// ---------------------------------------------------------------------------
// Target mode (single-club and multi-club)
// ---------------------------------------------------------------------------
function autoFloor(userPlayers, want) {
  const atRole = userPlayers.filter((player) => playerMatchesWant(player, want)).sort((a, b) => Number(b.overall) - Number(a.overall));
  if (!atRole.length) return 55;
  const reference = atRole[Math.min(2, atRole.length - 1)];
  return Math.max(55, Number(reference.overall) - 2);
}

function findCandidates({ players, userClubName, want, userPlayers, canTrade, usedIds = new Set() }) {
  const floor = Number.isFinite(Number(want.minOverall)) && want.minOverall !== "" && want.minOverall != null ? Number(want.minOverall) : autoFloor(userPlayers, want);
  const maxAge = Number.isFinite(Number(want.maxAge)) && want.maxAge !== "" && want.maxAge != null ? Number(want.maxAge) : null;
  return players
    .filter((player) => player.club && player.club !== userClubName && !usedIds.has(String(player.id)))
    .filter((player) => canTrade(player))
    .filter((player) => playerMatchesWant(player, want))
    .filter((player) => Number(player.overall) >= floor)
    .filter((player) => maxAge == null || Number(player.age) <= maxAge)
    .sort((a, b) => Number(b.overall) - Number(a.overall) || Number(a.age) - Number(b.age))
    .slice(0, TARGETS_PER_WANT);
}

function cartesian(lists) {
  return lists.reduce((rows, list) => rows.flatMap((row) => list.map((item) => [...row, item])), [[]]);
}

export function generateTargetSuggestions({
  userClubName,
  userClub = null,
  players = [],
  draftPickAssets = [],
  wants = [],
  excludedKeys = [],
  context = {},
  canTrade = () => true,
  capCheck = () => ({ ok: true }),
  limit = 8,
} = {}) {
  const activeWants = wants.filter((want) => want?.value).slice(0, MAX_WANTS);
  if (!activeWants.length) return { suggestions: [], diagnostics: { reason: "Choose at least one position or type." } };

  const userPlayers = players.filter((player) => player.club === userClubName);
  const pool = buildPool({ userClubName, players, draftPickAssets, excludedKeys, context, canTrade });
  if (!pool.length) return { suggestions: [], diagnostics: { reason: "No assets are available to trade — check your exclusions." } };

  const combos = buildCombos(pool.length);
  const comboCost = combos.map((combo) => combo.reduce((sum, index) => sum + (index >= 0 ? pool[index].cost : 0), 0));
  const order = combos.map((_, index) => index).sort((a, b) => comboCost[a] - comboCost[b]);
  const comboMeta = combos.map((combo) => {
    const assets = combo.filter((i) => i >= 0).map((i) => pool[i]);
    return {
      bestOverall: Math.max(0, ...assets.filter((asset) => asset.kind === "player").map((asset) => Number(asset.player.overall) || 0)),
      bestPickValue: Math.max(0, ...assets.filter((asset) => asset.kind === "pick").map((asset) => asset.marketValue)),
      market: packageValue(assets.map((asset) => asset.marketValue)),
    };
  });

  const clubValueCache = new Map();
  const comboValuesFor = (clubName) => {
    if (clubValueCache.has(clubName)) return clubValueCache.get(clubName);
    const assetValues = pool.map((asset) => calculateOfferValue(toPackage([asset]), clubName, context));
    const values = new Float64Array(combos.length);
    combos.forEach((combo, index) => { values[index] = packageValue(combo.filter((i) => i >= 0).map((i) => assetValues[i])); });
    clubValueCache.set(clubName, values);
    return values;
  };
  const requirementCache = new Map();
  const requirementFor = (clubName, receivers) => {
    const key = `${clubName}|${receivers.map((player) => player.id).sort().join(",")}`;
    if (!requirementCache.has(key)) requirementCache.set(key, getFairExchangeRequirement({ players: receivers, picks: [] }, clubName, context));
    return requirementCache.get(key);
  };

  const candidateLists = [];
  const usedIds = new Set();
  for (const want of activeWants) {
    const list = findCandidates({ players, userClubName, want, userPlayers, canTrade, usedIds });
    if (!list.length) return { suggestions: [], diagnostics: { reason: `No tradeable ${describeWant(want)} met the minimum overall — try lowering it.` } };
    candidateLists.push(list);
  }

  const suggestions = [];
  const seen = new Set();
  for (const targets of cartesian(candidateLists)) {
    const ids = targets.map((player) => String(player.id));
    if (new Set(ids).size !== ids.length) continue;
    // Group targets by club: wants filled by one club share a single leg.
    const byClub = new Map();
    targets.forEach((player) => byClub.set(player.club, [...(byClub.get(player.club) ?? []), player]));
    const legsSpec = [...byClub.entries()].map(([clubName, receivers]) => ({ clubName, receivers, requirement: requirementFor(clubName, receivers) }));
    // Each club may only give up three assets (they are all players here).
    if (legsSpec.some((leg) => leg.receivers.length > 3)) continue;

    const feasible = legsSpec.map((leg) => {
      const values = comboValuesFor(leg.clubName);
      const list = [];
      for (const comboIndex of order) {
        if (values[comboIndex] >= Math.ceil(leg.requirement.requiredValue * 1.01) && fairGuardsPass(leg.requirement, comboMeta[comboIndex]).ok) {
          list.push(comboIndex);
          if (list.length >= FEASIBLE_PER_LEG) break;
        }
      }
      return list;
    });
    if (feasible.some((list) => !list.length)) continue;

    let best = null;
    const used = new Uint8Array(pool.length);
    const chosen = [];
    const search = (legIndex, cost) => {
      if (best && cost >= best.cost) return;
      if (legIndex === legsSpec.length) { best = { cost, chosen: chosen.slice() }; return; }
      for (const comboIndex of feasible[legIndex]) {
        const combo = combos[comboIndex];
        if (combo.some((i) => i >= 0 && used[i])) continue;
        const nextCost = cost + comboCost[comboIndex];
        if (best && nextCost >= best.cost) break;
        combo.forEach((i) => { if (i >= 0) used[i] = 1; });
        chosen.push(comboIndex);
        search(legIndex + 1, nextCost);
        chosen.pop();
        combo.forEach((i) => { if (i >= 0) used[i] = 0; });
      }
    };
    search(0, 0);
    if (!best) continue;

    const legs = legsSpec.map((leg, index) => {
      const giveAssets = combos[best.chosen[index]].filter((i) => i >= 0).map((i) => pool[i]);
      const give = toPackage(giveAssets);
      const receive = { players: leg.receivers, picks: [] };
      const exchange = evaluateFairPackageExchange(give, receive, leg.clubName, context);
      return { club: leg.clubName, give, receive, giveAssets, exchange };
    });
    if (legs.some((leg) => !leg.exchange.accepted)) continue;

    const signature = legs.map((leg) => `${leg.club}:${leg.give.players.map((p) => p.id).sort().join(",")}|${leg.give.picks.map((p) => p.id).sort().join(",")}>${leg.receive.players.map((p) => p.id).sort().join(",")}`).sort().join(";");
    if (seen.has(signature)) continue;
    seen.add(signature);

    const incoming = legs.flatMap((leg) => leg.receive.players);
    const outgoingAssets = legs.flatMap((leg) => leg.giveAssets);
    const marketOut = legs.reduce((sum, leg) => sum + getNeutralMarketValue(leg.give, context), 0);
    const marketIn = legs.reduce((sum, leg) => sum + getNeutralMarketValue(leg.receive, context), 0);
    const userReceiveValue = incoming.reduce((sum, player) => sum + getClubSpecificValuation(player, userClubName, context), 0);
    const outgoingCost = Math.round(best.cost);
    const suggestion = {
      id: signature,
      mode: "TARGET",
      multiClub: legs.length > 1,
      legs: legs.map(({ giveAssets, exchange, ...leg }) => ({
        ...leg,
        offeredValue: exchange.offeredValue,
        requiredValue: exchange.requiredValue,
        requestedValue: exchange.requestedValue,
      })),
      incomingPlayers: incoming,
      outgoingCount: outgoingAssets.length,
      bestPlayersLost: outgoingAssets.filter((asset) => asset.inBest23).length,
      userReceiveValue: Math.round(userReceiveValue),
      outgoingCost,
      marketOut,
      marketIn,
      netValue: Math.round(userReceiveValue - outgoingCost),
      averageOverall: incoming.reduce((sum, player) => sum + Number(player.overall), 0) / incoming.length,
    };
    suggestions.push(suggestion);
  }

  const accepted = applyCapCheck(suggestions.sort((a, b) => b.netValue - a.netValue), capCheck, Math.max(limit, 1) * 3);
  const diagnostics = accepted.length ? {} : { reason: suggestions.length ? "Every trade found would push a club over the salary cap." : activeWants.length > 1
    ? "No combination of clubs would accept a trade built from your available assets. Try excluding fewer assets, lowering the minimum overall, or choosing fewer targets."
    : "No club would accept a trade for these targets with your available assets. Try excluding fewer assets or lowering the minimum overall." };
  return { suggestions: accepted, diagnostics };
}

// ---------------------------------------------------------------------------
// Shop mode: best return for the assets the manager has chosen to shop.
// With allowMultiClub the chosen assets can be split between clubs (for example
// one player to Club A and a pick to Club B) when that returns more in total.
// ---------------------------------------------------------------------------
function setPartitions(items) {
  if (!items.length) return [[]];
  const [first, ...rest] = items;
  const result = [];
  for (const partition of setPartitions(rest)) {
    result.push([[first], ...partition]);
    partition.forEach((group, index) => result.push([...partition.slice(0, index), [first, ...group], ...partition.slice(index + 1)]));
  }
  return result;
}

export function generateShopSuggestions({
  userClubName,
  players = [],
  draftPickAssets = [],
  outgoingKeys = [],
  context = {},
  canTrade = () => true,
  capCheck = () => ({ ok: true }),
  clubNames = [],
  allowMultiClub = true,
  maxClubs = 3,
  limit = 8,
} = {}) {
  const outgoing = buildPool({ userClubName, players, draftPickAssets, excludedKeys: [], context, canTrade: () => true, onlyKeys: outgoingKeys });
  if (!outgoing.length) return { suggestions: [], diagnostics: { reason: "Select at least one asset to shop." } };
  const fullMask = (1 << outgoing.length) - 1;
  const assetsForMask = (mask) => outgoing.filter((_, index) => mask & (1 << index));
  const partnerClubs = clubNames.filter((clubName) => clubName !== userClubName);

  // What each club could hand back, valued by the club and by the manager.
  const rosterCache = new Map();
  const rosterFor = (clubName) => {
    if (rosterCache.has(clubName)) return rosterCache.get(clubName);
    const roster = [
      ...players.filter((player) => player.club === clubName && canTrade(player)).map((player) => ({ kind: "player", player, key: assetKey("player", player.id) })),
      ...draftPickAssets.filter((pick) => pick.currentOwner === clubName).map((pick) => ({ kind: "pick", pick, key: assetKey("pick", pick.id) })),
    ].map((asset) => {
      const requirement = getFairExchangeRequirement(toPackage([asset]), clubName, context);
      const userValue = asset.kind === "player" ? getClubSpecificValuation(asset.player, userClubName, context) : calculatePickValue(asset.pick, context);
      const market = asset.kind === "player" ? calculatePlayerValue(asset.player, context) : calculatePickValue(asset.pick, context);
      return { ...asset, clubValue: requirement.requestedValue, premium: requirement.premium, headlineOverall: requirement.headlineOverall, market, userValue };
    }).filter((asset) => asset.clubValue > 0);
    rosterCache.set(clubName, roster);
    return roster;
  };

  const bestCache = new Map();
  const bestReturn = (clubName, mask) => {
    const cacheKey = `${clubName}:${mask}`;
    if (bestCache.has(cacheKey)) return bestCache.get(cacheKey);
    const giveAssets = assetsForMask(mask);
    const give = toPackage(giveAssets);
    const offeredValue = calculateOfferValue(give, clubName, context);
    const received = {
      bestOverall: Math.max(0, ...giveAssets.filter((asset) => asset.kind === "player").map((asset) => Number(asset.player.overall) || 0)),
      bestPickValue: Math.max(0, ...giveAssets.filter((asset) => asset.kind === "pick").map((asset) => asset.marketValue)),
      market: packageValue(giveAssets.map((asset) => asset.marketValue)),
    };
    const candidates = rosterFor(clubName)
      .filter((asset) => asset.clubValue * (1 + asset.premium) <= offeredValue)
      .sort((a, b) => b.userValue - a.userValue)
      .slice(0, 30);
    let best = null;
    const consider = (assets) => {
      const requested = packageValue(assets.map((asset) => asset.clubValue));
      const premium = Math.max(...assets.map((asset) => asset.premium));
      const required = Math.round(requested * (1 + premium));
      if (required > offeredValue) return;
      const requirement = {
        headlineOverall: assets.reduce((max, asset) => asset.headlineOverall == null ? max : Math.max(max ?? 0, asset.headlineOverall), null),
        marketGiven: packageValue(assets.map((asset) => asset.market)),
      };
      if (!fairGuardsPass(requirement, received).ok) return;
      const userValue = packageValue(assets.map((asset) => asset.userValue));
      const score = 2 * userValue - requested;
      if (!best || score > best.score) best = { assets, requested, required, userValue, score };
    };
    const n = candidates.length;
    for (let a = 0; a < n; a += 1) {
      consider([candidates[a]]);
      for (let b = a + 1; b < n; b += 1) {
        consider([candidates[a], candidates[b]]);
        for (let c = b + 1; c < n; c += 1) consider([candidates[a], candidates[b], candidates[c]]);
      }
    }
    bestCache.set(cacheKey, best);
    return best;
  };

  const buildSuggestion = (parts) => {
    // parts: [{ clubName, mask, best }]
    const legs = [];
    for (const part of parts) {
      const give = toPackage(assetsForMask(part.mask));
      const receive = toPackage(part.best.assets);
      const exchange = evaluateFairPackageExchange(give, receive, part.clubName, context);
      if (!exchange.accepted) return null;
      legs.push({ club: part.clubName, give, receive, offeredValue: exchange.offeredValue, requiredValue: exchange.requiredValue, requestedValue: exchange.requestedValue });
    }
    const incoming = legs.flatMap((leg) => leg.receive.players);
    const userValue = parts.reduce((sum, part) => sum + part.best.userValue, 0);
    const marketOut = legs.reduce((sum, leg) => sum + getNeutralMarketValue(leg.give, context), 0);
    const marketIn = legs.reduce((sum, leg) => sum + getNeutralMarketValue(leg.receive, context), 0);
    const outgoingCost = Math.round(assetsForMask(fullMask).reduce((sum, asset) => sum + asset.cost, 0));
    return {
      id: `shop:${legs.map((leg) => `${leg.club}:${leg.give.players.map((p) => p.id).join(",")}|${leg.give.picks.map((p) => p.id).join(",")}>${leg.receive.players.map((p) => p.id).join(",")}|${leg.receive.picks.map((p) => p.id).join(",")}`).join(";")}`,
      mode: "SHOP",
      multiClub: legs.length > 1,
      legs,
      incomingPlayers: incoming,
      outgoingCount: outgoing.length,
      bestPlayersLost: outgoing.filter((asset) => asset.inBest23).length,
      userReceiveValue: Math.round(userValue),
      outgoingCost,
      marketOut,
      marketIn,
      netValue: Math.round(userValue - outgoingCost),
      averageOverall: incoming.length ? incoming.reduce((sum, player) => sum + Number(player.overall), 0) / incoming.length : null,
      score: parts.reduce((sum, part) => sum + part.best.score, 0),
    };
  };

  const suggestions = [];
  for (const clubName of partnerClubs) {
    const best = bestReturn(clubName, fullMask);
    if (!best) continue;
    const suggestion = buildSuggestion([{ clubName, mask: fullMask, best }]);
    if (suggestion) suggestions.push(suggestion);
  }

  if (allowMultiClub && outgoing.length >= 2) {
    const indices = outgoing.map((_, index) => index);
    for (const partition of setPartitions(indices)) {
      if (partition.length < 2 || partition.length > Math.min(maxClubs, partnerClubs.length)) continue;
      const masks = partition.map((group) => group.reduce((mask, index) => mask | (1 << index), 0));
      const assignments = [];
      const walk = (groupIndex, used, parts, total) => {
        if (groupIndex === masks.length) { assignments.push({ parts: parts.slice(), total }); return; }
        for (const clubName of partnerClubs) {
          if (used.has(clubName)) continue;
          const best = bestReturn(clubName, masks[groupIndex]);
          if (!best) continue;
          used.add(clubName);
          parts.push({ clubName, mask: masks[groupIndex], best });
          walk(groupIndex + 1, used, parts, total + best.score);
          parts.pop();
          used.delete(clubName);
        }
      };
      walk(0, new Set(), [], 0);
      assignments.sort((a, b) => b.total - a.total);
      for (const assignment of assignments.slice(0, 2)) {
        const suggestion = buildSuggestion(assignment.parts);
        if (suggestion) suggestions.push(suggestion);
      }
    }
  }

  const unique = [...new Map(suggestions.map((suggestion) => [suggestion.id, suggestion])).values()].sort((a, b) => b.score - a.score);
  const accepted = applyCapCheck(unique, capCheck, limit);
  const diagnostics = accepted.length ? {} : { reason: unique.length ? "Every trade found would push a club over the salary cap." : "No club has assets it would swap for this package. Try adding another asset to the shop list." };
  return { suggestions: accepted, diagnostics };
}

export { pickLabelDefault, calculateAssetPackageValue };