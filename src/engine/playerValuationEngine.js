import { validTradePackage } from "./transactionRules.js";
// Player Valuation Engine — shared trade points for players and draft picks.
// Player values typically range from low hundreds to around 1,200 points,
// influenced by overall rating, age, potential, position scarcity, contract length,
// salary, leadership, recent performance, injury history, and club role/importance.

import { getClubAttraction } from "../data/clubAttraction.js";
import { calculateMarketValue } from "./contractValueEngine.js";
import { getPlayerPotentialDescriptor, getPotentialDescriptorRank } from "./potentialScouting.js";

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const num = (value, fallback) => (value === null || value === undefined || !Number.isFinite(Number(value)) ? fallback : Number(value));

// Position scarcity weights — rarer positions are more valuable.
const POSITION_SCARCITY = {
  RUC: 1.25,
  KPD: 1.15,
  KPF: 1.15,
  MID: 1.05,
  WING: 0.95,
  HF: 0.92,
  FF: 0.92,
  HB: 0.88,
  BP: 0.85,
};

function getPrimaryPosition(player) {
  return player?.positions?.[0] ?? "MID";
}

function getPositionScarcity(player) {
  const positions = Array.isArray(player?.positions) ? player.positions : [getPrimaryPosition(player)];
  const maxScarcity = Math.max(...positions.map((p) => POSITION_SCARCITY[p] ?? 1.0));
  return maxScarcity;
}

function getAgeValueCurve(age) {
  if (age <= 19) return 0.88;
  if (age <= 23) return 1.08;
  if (age <= 27) return 1.0;
  if (age <= 30) return 0.82;
  if (age <= 32) return 0.62;
  return 0.4;
}

function getContractValueModifier(yearsRemaining) {
  if (yearsRemaining === null || yearsRemaining === undefined) return 0.92;
  const years = num(yearsRemaining, 0);
  if (years <= 0) return 0.65;
  if (years === 1) return 0.82;
  if (years === 2) return 0.95;
  if (years === 3) return 1.05;
  if (years >= 4) return 1.12;
  return 1.0;
}

function getLeadershipBonus(player) {
  const stats = player?.careerStats ?? {};
  let bonus = 0;
  bonus += num(stats.premierships, 0) * 10;
  bonus += num(stats.allAustralians, 0) * 7;
  bonus += num(stats.bestAndFairests, 0) * 5;
  return clamp(bonus, 0, 60);
}

function getRecentPerformanceBonus(player) {
  const formRating = num(player?.formRating, 50);
  if (formRating >= 85) return 35;
  if (formRating >= 70) return 18;
  if (formRating >= 55) return 5;
  if (formRating >= 40) return -15;
  return -30;
}

function getInjuryPenalty(player) {
  const fitness = player?.fitness;
  if (!fitness) return 0;
  const injuryCount = num(fitness.injuryHistory?.length, 0);
  const currentlyInjured = fitness.currentlyInjured === true || num(fitness.injuryWeeksRemaining, 0) > 0;
  let penalty = injuryCount * 10;
  if (currentlyInjured) penalty += 55;
  return clamp(penalty, 0, 120);
}

function getPotentialBonus(player) {
  const overall = num(player?.overall, 60);
  const potential = num(player?.development?.potential ?? player?.potential, overall);
  const upside = Math.max(0, potential - overall);
  const descriptorRank = getPotentialDescriptorRank(potential, overall);
  // Higher descriptor rank = more upside = more value
  return clamp(upside * 5 + descriptorRank * 5, 0, 130);
}

function getSalaryEfficiency(player, context = {}) {
  const { marketValue } = calculateMarketValue(player, { seasonYear: context.seasonYear });
  const salary = num(player?.contract?.salary, num(player?.salary, 300000));
  if (marketValue <= 0) return 0;
  const ratio = salary / marketValue;
  // Underpaid players are more valuable (club-friendly contract)
  if (ratio <= 0.6) return 30;
  if (ratio <= 0.8) return 16;
  if (ratio <= 1.0) return 0;
  if (ratio <= 1.2) return -15;
  if (ratio <= 1.5) return -30;
  return -50;
}

// Core value in trade points. The nonlinear overall curve makes elite players
// scarce, while age and upside allow young prospects to carry premium value.
export function calculatePlayerValue(player, context = {}) {
  const overall = num(player?.overall, 60);
  const age = num(player?.age, 25);

  const normalizedOverall = clamp((overall - 40) / 60, 0, 1);
  // Overall is the largest single input. The steeper curve makes elite players
  // substantially harder to acquire than depth players.
  const baseScore = Math.round((normalizedOverall ** 1.65) * 1200);

  // Age curve multiplier
  const ageMultiplier = getAgeValueCurve(age);
  let value = baseScore * ageMultiplier;

  // Position scarcity
  const scarcity = getPositionScarcity(player);
  value *= scarcity;

  // Potential upside
  value += getPotentialBonus(player);

  // Contract length modifier
  const contractMod = getContractValueModifier(player?.contract?.yearsRemaining);
  value *= contractMod;

  // Salary efficiency (under/over paid relative to market)
  value += getSalaryEfficiency(player, context);

  // Leadership and reputation
  value += getLeadershipBonus(player);

  // Recent performance
  value += getRecentPerformanceBonus(player);

  // Injury history penalty
  value -= getInjuryPenalty(player);

  return clamp(Math.round(value), 20, 1500);
}

// Full valuation profile with breakdown for AI decision-making.
export function getPlayerValuation(player, context = {}) {
  const value = calculatePlayerValue(player, context);
  const overall = num(player?.overall, 60);
  const age = num(player?.age, 25);
  const potential = num(player?.development?.potential ?? player?.potential, overall);

  const tier = getValuationTier(value);
  const potentialDescriptor = getPlayerPotentialDescriptor(player);

  return {
    value,
    tier,
    breakdown: {
      base: Math.round((clamp((overall - 40) / 60, 0, 1) ** 1.65) * 1200),
      ageMultiplier: getAgeValueCurve(age),
      positionScarcity: getPositionScarcity(player),
      potentialBonus: getPotentialBonus(player),
      contractModifier: getContractValueModifier(player?.contract?.yearsRemaining),
      salaryEfficiency: getSalaryEfficiency(player, context),
      leadershipBonus: getLeadershipBonus(player),
      performanceBonus: getRecentPerformanceBonus(player),
      injuryPenalty: getInjuryPenalty(player),
    },
    potentialDescriptor,
    overall,
    age,
    potential,
  };
}

export function getValuationTier(value) {
  if (value >= 950) return { label: "Franchise", color: "#ef4444", requiredSurplusRate: 0.2 };
  if (value >= 700) return { label: "Star", color: "#f97316", requiredSurplusRate: 0.14 };
  if (value >= 500) return { label: "Premium", color: "#f59e0b", requiredSurplusRate: 0.1 };
  if (value >= 325) return { label: "Solid", color: "#22c55e", requiredSurplusRate: 0.07 };
  if (value >= 180) return { label: "Depth", color: "#3b82f6", requiredSurplusRate: 0.04 };
  return { label: "Fringe", color: "#64748b", requiredSurplusRate: 0.02 };
}

// Whether a player is effectively untouchable for trade purposes.
export function isPlayerUntouchable(player, valuation, context = {}) {
  const overall = num(player?.overall, 60);
  const age = num(player?.age, 25);
  const potential = num(player?.development?.potential ?? player?.potential, overall);
  const tier = valuation?.tier ?? getValuationTier(calculatePlayerValue(player, context));

  // Franchise-tier young stars are untouchable
  if (tier.label === "Franchise" && age <= 26) return true;
  // Elite young players with high potential are untouchable
  if (overall >= 88 && age <= 24 && potential >= 92) return true;
  // Top-5 overall players in the league are untouchable
  if (overall >= 92) return true;

  return false;
}

const POSITION_LABELS = {
  RUC: "ruck depth", KPD: "key-defender stocks", KPB: "key-defender stocks",
  KPF: "key-forward stocks", MID: "midfield", WING: "wing depth",
  HF: "half-forward depth", FF: "full-forward depth", HB: "half-back depth", BP: "small-defender depth",
};

function getClubWindow(clubName, attraction, context) {
  const ladder = context.ladder ?? [];
  const rank = ladder.findIndex((entry) => entry.club === clubName) + 1;
  if (!rank) return Number(attraction.premiershipWindow ?? 60);
  if (rank <= 6) return 82;
  if (rank <= 10) return 68;
  if (rank >= 14) return 42;
  return 55;
}

// Club-specific valuation and its plain-language rationale. Adjustments are
// deliberately capped: context should distinguish buyers without replacing
// the player's shared market value unless the roster gives a clear reason.
export function getClubValuationDetails(player, clubName, context = {}) {
  const baseValue = calculatePlayerValue(player, context);
  const attraction = getClubAttraction(clubName, context);
  const age = num(player?.age, 25);
  const overall = num(player?.overall, 60);
  const potential = num(player?.development?.potential ?? player?.potential, overall);
  const playerPositions = Array.isArray(player?.positions) && player.positions.length
    ? player.positions
    : [getPrimaryPosition(player)];
  const clubPlayers = (context.allPlayers ?? []).filter((candidate) => candidate.club === clubName);
  const positionNeeds = context.positionNeeds?.[clubName] ?? [];
  const positionComparisons = playerPositions.map((position) => {
    const rolePlayers = clubPlayers
      .filter((candidate) => (candidate.positions ?? [candidate.position]).includes(position))
      .sort((a, b) => num(b.overall, 60) - num(a.overall, 60));
    const count = rolePlayers.length;
    const bestOverall = count ? num(rolePlayers[0].overall, 60) : 0;
    const topThreeAverage = count
      ? rolePlayers.slice(0, 3).reduce((sum, candidate) => sum + num(candidate.overall, 60), 0) / Math.min(3, count)
      : 0;
    let need = 0;
    let needReason = "";
    if (positionNeeds.includes(position)) {
      need = 0.12;
      needReason = `the club has flagged ${POSITION_LABELS[position] ?? position} as a need`;
    } else if (count <= 1) {
      need = 0.12;
      needReason = count === 0
        ? `they have no listed option at ${POSITION_LABELS[position] ?? position}`
        : `they have only one listed option for ${POSITION_LABELS[position] ?? position}`;
    } else if (count <= 3) {
      need = 0.07;
      needReason = `they are short on ${POSITION_LABELS[position] ?? position} with ${count} listed options`;
    }
    if (count > 0 && topThreeAverage < 68 && need < 0.1) {
      need = 0.1;
      needReason = `their ${POSITION_LABELS[position] ?? position} group is below the league-standard quality band`;
    }
    const upgradeGap = count ? overall - bestOverall : 0;
    const upgrade = count && upgradeGap >= 3 ? Math.min(0.09, (upgradeGap - 2) * 0.015) : 0;
    return { position, count, bestOverall, upgradeGap, need, needReason, upgrade };
  });
  const positionalNeed = Math.max(0, ...positionComparisons.map((item) => item.need));
  const upgradeFit = Math.max(0, ...positionComparisons.map((item) => item.upgrade));
  const bestNeed = positionComparisons.find((item) => item.need === positionalNeed && item.need > 0);
  const bestUpgrade = positionComparisons.find((item) => item.upgrade === upgradeFit && item.upgrade > 0);

  const clubAverageAge = clubPlayers.length
    ? clubPlayers.reduce((sum, candidate) => sum + num(candidate.age, 25), 0) / clubPlayers.length
    : 25;
  const clubAverageOverall = clubPlayers.length
    ? clubPlayers.reduce((sum, candidate) => sum + num(candidate.overall, 60), 0) / clubPlayers.length
    : 70;
  const addsExperience = age >= 25 && age <= 31 && age >= clubAverageAge + 1.5 && overall >= clubAverageOverall;
  const window = getClubWindow(clubName, attraction, context);
  const pushesForFlag = window >= 75 && age >= 24 && age <= 30 && overall >= Math.max(75, clubAverageOverall);
  const rebuildUpside = window <= 48 && age <= 23 && potential - overall >= 6;

  let rosterStageAdjustment = 0;
  if (pushesForFlag) rosterStageAdjustment = 0.16;
  else if (window <= 48 && age <= 23) rosterStageAdjustment = 0.22;
  else if (window <= 48 && age >= 28) rosterStageAdjustment = -0.20;
  const experienceAdjustment = addsExperience ? 0.035 : 0;
  const adjustment = clamp(positionalNeed + upgradeFit + experienceAdjustment + rosterStageAdjustment, -0.25, 0.35);
  const value = Math.max(25, Math.round(baseValue * (1 + adjustment)));

  let reason;
  if (bestNeed?.need >= 0.1) reason = `They have ${bestNeed.needReason}.`;
  else if (bestUpgrade) reason = `He would upgrade their best ${POSITION_LABELS[bestUpgrade.position] ?? bestUpgrade.position} option by ${Math.round(bestUpgrade.upgradeGap)} OVR.`;
  else if (addsExperience) reason = `He would add an experienced ${age}-year-old to a younger list (average age ${clubAverageAge.toFixed(1)}).`;
  else if (pushesForFlag) reason = `They are pushing for a flag and he is a prime-age, best-22 level fit.`;
  else if (rebuildUpside) reason = `They are rebuilding and his age and development upside fit their timeline.`;
  else if (bestNeed) reason = `They are a little short on ${POSITION_LABELS[bestNeed.position] ?? bestNeed.position}.`;
  else reason = "No standout list need or timeline fit; their value stays close to the market estimate.";

  return { value, baseValue, adjustment, reason, positionComparisons, clubAverageAge: Number(clubAverageAge.toFixed(1)), window };
}

// Number-returning wrapper retained for existing trade and negotiation callers.
export function getClubSpecificValuation(player, clubName, context = {}) {
  return getClubValuationDetails(player, clubName, context).value;
}

// Compare an offer package against a player's value from the owning club's perspective.
// Returns { accepted, reason, surplusValue, confidence }
export function evaluateTradeOffer(targetPlayer, offerPackage, owningClubName, context = {}) {
  if (!validTradePackage(offerPackage)) return { accepted: false, reason: "Choose one to three unique assets per side.", offerValue: 0, targetValue: 0 };
  const targetValuation = getClubSpecificValuation(targetPlayer, owningClubName, context);
  const untouchable = isPlayerUntouchable(targetPlayer, null, context);
  const clubList = (context.allPlayers ?? []).filter(player => player.club === owningClubName)
    .sort((a, b) => num(b.overall, 0) - num(a.overall, 0));
  const best23 = clubList.slice(0, 23).some(player => String(player.id) === String(targetPlayer.id));
  const rebuilding = getClubWindow(owningClubName, getClubAttraction(owningClubName), context) <= 48;

  // Calculate total value of the offer
  const offerValue = calculateOfferValue(offerPackage, owningClubName, context);

  const surplus = offerValue - targetValuation;
  const tier = getValuationTier(targetValuation);
  const premiumRate = untouchable ? 0.4 : Math.max(0.02,
    tier.requiredSurplusRate + (best23 ? 0.18 : 0) - (rebuilding && num(targetPlayer.age, 25) >= 29 ? 0.14 : 0));
  const requiredSurplus = Math.round(targetValuation * premiumRate);
  const requiredValue = targetValuation + requiredSurplus;
  const headlineRequired = best23 && num(targetPlayer.overall, 60) >= 84 && num(targetPlayer.age, 25) <= 27;
  const hasHeadline = (offerPackage.players ?? []).some(player => num(player.overall, 0) >= num(targetPlayer.overall, 60) - 5)
    || (offerPackage.picks ?? []).some(pick => calculatePickValue(pick, context) >= 500);

  if (headlineRequired && !hasHeadline) return {
    accepted: false, reason: `${owningClubName} rates ${targetPlayer.name} as a young best-23 cornerstone. They need a comparable player or an early first-round pick, not a package of role players.`,
    surplusValue: surplus, confidence: 5, targetValue: targetValuation, offerValue,
    requiredValue, headlineRequired,
  };

  // Untouchable players still require a premium, without making a trade impossible.
  if (untouchable) {
    if (offerValue < requiredValue) {
      return {
        accepted: false,
        reason: `${targetPlayer.name} is considered untouchable. Only a massive offer would be considered.`,
        surplusValue: surplus,
        confidence: 5,
        targetValue: targetValuation,
        offerValue,
        requiredValue,
        headlineRequired,
      };
    }
    return {
      accepted: true,
      reason: `Reluctantly accepting a massive offer for ${targetPlayer.name}.`,
      surplusValue: surplus,
      confidence: 40,
      targetValue: targetValuation,
      offerValue,
      requiredValue,
      headlineRequired,
    };
  }

  // Clubs ask for a modest premium that rises with the player's value.
  if (surplus < requiredSurplus) {
    const reason = surplus < 0
      ? `This offer falls short of ${targetPlayer.name}'s value to ${owningClubName}.`
      : `Close, but ${owningClubName} would need more to part with ${targetPlayer.name}.`;
    return {
      accepted: false,
      reason,
      surplusValue: surplus,
      confidence: clamp(Math.round((offerValue / Math.max(1, targetValuation)) * 45), 0, 55),
      targetValue: targetValuation,
      offerValue,
      requiredValue,
      headlineRequired,
    };
  }

  // Fair or overs offer
  const confidence = clamp(Math.round(55 + (surplus / Math.max(1, targetValuation)) * 100), 55, 98);
  return {
    accepted: true,
    reason: surplus > requiredSurplus * 1.5
      ? `${owningClubName} accepts — this is a strong offer for ${targetPlayer.name}.`
      : `${owningClubName} accepts the offer for ${targetPlayer.name}.`,
    surplusValue: surplus,
    confidence,
    targetValue: targetValuation,
    offerValue,
    requiredValue,
  };
}

function getCounterPositionNeeds(clubName, context = {}) {
  const roster = (context.allPlayers ?? []).filter(player => player.club === clubName)
    .sort((a, b) => num(b.overall, 0) - num(a.overall, 0));
  const best23 = roster.slice(0, 23);
  const positions = [...new Set((context.allPlayers ?? []).flatMap(player =>
    Array.isArray(player.positions) && player.positions.length ? player.positions : [getPrimaryPosition(player)]
  ))];
  const explicitlyNeeded = new Set(context.positionNeeds?.[clubName] ?? []);
  return positions.map(position => {
    const clubRole = roster.filter(player => (player.positions?.length ? player.positions : [getPrimaryPosition(player)]).includes(position));
    const bestRole = best23.filter(player => (player.positions?.length ? player.positions : [getPrimaryPosition(player)]).includes(position));
    const roleAverage = bestRole.length
      ? bestRole.slice(0, 3).reduce((sum, player) => sum + num(player.overall, 60), 0) / Math.min(3, bestRole.length)
      : 0;
    const leagueRole = (context.allPlayers ?? []).filter(player => (player.positions?.length ? player.positions : [getPrimaryPosition(player)]).includes(position));
    const leagueAverage = leagueRole.length
      ? leagueRole.reduce((sum, player) => sum + num(player.overall, 60), 0) / leagueRole.length
      : 70;
    const selectionGap = Math.max(0, 3 - bestRole.length) * 1.25;
    const qualityGap = Math.max(0, (leagueAverage - roleAverage) / 8);
    const depthGap = clubRole.length < 4 ? (4 - clubRole.length) * 0.25 : 0;
    const explicitNeed = explicitlyNeeded.has(position) ? 2.5 : 0;
    return { position, best23Count: bestRole.length, listedCount: clubRole.length,
      average: roleAverage, leagueAverage, urgency: Math.max(explicitNeed, selectionGap + qualityGap + depthGap) };
  }).filter(need => need.urgency >= 0.8)
    .sort((a, b) => b.urgency - a.urgency || a.position.localeCompare(b.position));
}

function getCounterStrategy(clubName, targetPlayer, context = {}, needs = []) {
  const window = getClubWindow(clubName, getClubAttraction(clubName, context), context);
  const targetAge = num(targetPlayer.age, 25);
  // A rebuilding side cashing out an older player prefers draft capital. Other
  // clubs put roster balance first and ask for players at a specific weak role.
  const draftCapital = window <= 48 || (window < 57 && targetAge >= 29);
  const improvePosition = !draftCapital && needs.length > 0;
  return { window, draftCapital, improvePosition, needs,
    focusPosition: improvePosition ? needs[0]?.position ?? null : null };
}

// Build an actionable, club-specific counter from assets the manager owns.
// Rebuilders trading older players prefer draft capital; other clubs target a
// role that is weak in their best 23. The normal evaluator still judges value.
export function generateTradeCounterOffer(targetPlayer, offered, owningClubName, context = {}, available = {}) {
  const assessment = evaluateTradeOffer(targetPlayer, offered, owningClubName, context);
  if (assessment.accepted || !assessment.requiredValue) return null;
  const needs = getCounterPositionNeeds(owningClubName, context);
  const strategy = getCounterStrategy(owningClubName, targetPlayer, context, needs);
  const window = strategy.window;
  const focusPosition = strategy.focusPosition;
  const targetPositions = targetPlayer.positions?.length ? targetPlayer.positions : [getPrimaryPosition(targetPlayer)];
  const wantsPicks = strategy.draftCapital;
  const availablePlayers = [...(available.players ?? [])].sort((a, b) => num(b.overall, 0) - num(a.overall, 0));
  const candidates = [
    ...availablePlayers.map((player, index) => ({ kind: 'player', asset: player,
      value: getClubSpecificValuation(player, owningClubName, context),
      fit: (() => {
        const age = num(player.age, 25);
        const positions = player.positions?.length ? player.positions : [getPrimaryPosition(player)];
        const matchingNeed = needs.find(need => positions.includes(need.position));
        const roleFit = matchingNeed ? 1 + Math.min(0.8, matchingNeed.urgency * 0.18) : 0.78;
        const ageFit = window <= 48 ? age <= 23 ? 1.18 : age >= 29 ? 0.68 : 0.92
          : window >= 75 ? age >= 23 && age <= 29 ? 1.12 : 0.86
            : age >= 22 && age <= 29 ? 1.04 : 0.9;
        const specificFit = focusPosition && positions.includes(focusPosition) ? 2.2 : 1;
        // Don't ask for a like-for-like return unless the position is a real need.
        const sameRolePenalty = positions.some(position => targetPositions.includes(position)) && !matchingNeed ? 0.88 : 1;
        // The selling club assumes the manager will resist losing a best-23
        // player, so it asks for one only when the return clearly needs a headline.
        const best23Penalty = index < 23 ? 0.72 : 1;
        return roleFit * ageFit * specificFit * sameRolePenalty * best23Penalty;
      })() })),
    ...(available.picks ?? []).map(pick => ({ kind: 'pick', asset: pick,
      value: calculateOfferValue({ picks: [pick] }, owningClubName, context), fit: wantsPicks ? 1.55 : strategy.improvePosition ? 0.72 : window >= 75 ? 0.78 : 0.98 })),
  ];
  const strategyScore = candidate => {
    const assetKey = String(candidate.asset.id ?? candidate.asset.number ?? candidate.asset.name ?? "asset");
    // Stable variation breaks otherwise identical choices across clubs and targets.
    const tieBreak = 0.98 + hashTradeChoice(`${owningClubName}:${targetPlayer.id}:${assetKey}`) * 0.04;
    return candidate.value * candidate.fit * tieBreak;
  };
  candidates.sort((a, b) => {
    if (focusPosition && strategy.improvePosition) {
      const aMatches = a.kind === 'player' && (a.asset.positions?.length ? a.asset.positions : [getPrimaryPosition(a.asset)]).includes(focusPosition);
      const bMatches = b.kind === 'player' && (b.asset.positions?.length ? b.asset.positions : [getPrimaryPosition(b.asset)]).includes(focusPosition);
      if (aMatches !== bMatches) return aMatches ? -1 : 1;
    }
    return strategyScore(b) - strategyScore(a);
  });
  const selected = { players: [...(offered.players ?? [])], picks: [...(offered.picks ?? [])] };
  const contains = candidate => [...selected.players, ...selected.picks].some(asset => String(asset.id) === String(candidate.asset.id));
  // If already at the asset cap, replace the weakest offered asset first.
  const offerAssets = () => [...selected.players.map(asset => ({ kind: 'player', asset })), ...selected.picks.map(asset => ({ kind: 'pick', asset }))];
  const alreadyHasHeadline = selected.players.some(player => num(player.overall, 0) >= num(targetPlayer.overall, 60) - 5)
    || selected.picks.some(pick => calculatePickValue(pick, context) >= 500);
  if (assessment.headlineRequired && !alreadyHasHeadline) {
    const headline = candidates.find(candidate => !contains(candidate) && (candidate.kind === 'player'
      ? num(candidate.asset.overall, 0) >= num(targetPlayer.overall, 60) - 5
      : calculatePickValue(candidate.asset, context) >= 500));
    if (!headline) return { ...selected, requiredValue: assessment.requiredValue,
      offerValue: calculateOfferValue(selected, owningClubName, context), possible: false,
      reason: `${owningClubName} wants a comparable player or an early first-round pick. None is currently available in your offerable assets.` };
    if (offerAssets().length >= 3) {
      const weakest = offerAssets().sort((a, b) => calculateOfferValue({ [a.kind === 'pick' ? 'picks' : 'players']: [a.asset] }, owningClubName, context) - calculateOfferValue({ [b.kind === 'pick' ? 'picks' : 'players']: [b.asset] }, owningClubName, context))[0];
      selected[weakest.kind === 'pick' ? 'picks' : 'players'] = selected[weakest.kind === 'pick' ? 'picks' : 'players'].filter(asset => String(asset.id) !== String(weakest.asset.id));
    }
    selected[headline.kind === 'pick' ? 'picks' : 'players'].push(headline.asset);
  }
  for (const candidate of candidates) {
    if (calculateOfferValue(selected, owningClubName, context) >= assessment.requiredValue) break;
    if (contains(candidate)) continue;
    if (offerAssets().length >= 3) {
      const weakest = offerAssets().filter(item => !assessment.headlineRequired || !(item.kind === 'player'
        ? num(item.asset.overall, 0) >= num(targetPlayer.overall, 60) - 5
        : calculatePickValue(item.asset, context) >= 500)).sort((a, b) => calculateOfferValue({ [a.kind === 'pick' ? 'picks' : 'players']: [a.asset] }, owningClubName, context) - calculateOfferValue({ [b.kind === 'pick' ? 'picks' : 'players']: [b.asset] }, owningClubName, context))[0];
      if (!weakest) break;
      const key = weakest.kind === 'pick' ? 'picks' : 'players';
      selected[key] = selected[key].filter(asset => String(asset.id) !== String(weakest.asset.id));
    }
    selected[candidate.kind === 'pick' ? 'picks' : 'players'].push(candidate.asset);
    if (calculateOfferValue(selected, owningClubName, context) >= assessment.requiredValue) break;
  }
  return { ...selected, requiredValue: assessment.requiredValue, possible: true,
    offerValue: calculateOfferValue(selected, owningClubName, context),
    reason: wantsPicks ? `${owningClubName} is rebuilding and wants draft capital to reset its list around a younger core.`
      : focusPosition ? `${owningClubName} wants to improve its ${focusPosition} depth, one of the thinnest roles in its best 23.`
        : window >= 75 ? `${owningClubName} is pushing for a flag and wants a ready-to-play return.`
          : `${owningClubName} wants a return that improves its list balance and reflects ${targetPlayer.name}'s role.` };
}

function hashTradeChoice(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

// Calculate the total value of an offer package (players + picks).
export function calculateOfferValue(offerPackage, owningClubName, context = {}) {
  const assetValues = [];
  const playerValues = [];
  const pickValues = [];

  (offerPackage?.players ?? []).forEach((player) => {
    const val = getClubSpecificValuation(player, owningClubName, context);
    assetValues.push(val);
    playerValues.push({ player, value: val });
  });

  (offerPackage?.picks ?? []).forEach((pick) => {
    const window = getClubWindow(owningClubName, getClubAttraction(owningClubName), context);
    const val = calculatePickValue(pick, context) * (window <= 48 ? 1.3 : window >= 75 ? 0.85 : 1);
    assetValues.push(val);
    pickValues.push({ pick, value: val });
  });

  return calculateAssetPackageValue(assetValues);
}

// The first asset in a package keeps full value. Each additional asset is worth
// 70% of the preceding weight: strongest asset 100%, second 70%, third 49%.
export function calculateAssetPackageValue(values = []) {
  return Math.round([...values].map(value => Math.max(0, num(value, 0))).sort((a, b) => b - a).reduce((total, value, index) =>
    total + value * (0.7 ** index), 0));
}

// Draft pick valuation — earlier picks are exponentially more valuable.
export function calculatePickValue(pick, context = {}) {
  const round = Number(pick?.round);
  const ladder = context.ladder ?? [];
  const rankIndex = ladder.findIndex((entry) => entry.club === pick?.originalClub);
  const projectedNumber = Number.isFinite(Number(pick?.projectedNumber))
    ? Number(pick.projectedNumber)
    : rankIndex >= 0
      ? Math.max(1, ((Number(context.clubCount) || 18) - rankIndex) + ((round - 1) * (Number(context.clubCount) || 18)))
      : ({ 1: 12, 2: 28, 3: 44, 4: 58, 5: 66 }[round] ?? 72);
  const pickNumber = typeof pick === "number" ? pick : num(pick?.number, projectedNumber);
  if (pickNumber <= 0) return 0;
  // Calibrated to common draft-trade estimates: picks 12/28/44 are ~430/176/104.
  const anchors = [[1, 1000], [4, 720], [8, 540], [12, 430], [18, 300], [28, 176], [36, 132], [44, 104], [54, 70]];
  let baseValue = anchors.at(-1)[1];
  for (let index = 1; index < anchors.length; index += 1) {
    const [upperPick, upperValue] = anchors[index];
    const [lowerPick, lowerValue] = anchors[index - 1];
    if (pickNumber <= upperPick) {
      const progress = (pickNumber - lowerPick) / (upperPick - lowerPick);
      baseValue = Math.round(lowerValue + (upperValue - lowerValue) * progress);
      break;
    }
  }
  const seasonYear = Number(context.seasonYear);
  const pickYear = Number(typeof pick === "object" ? pick?.year : NaN);
  // Current draft-year picks retain full value; each additional draft year
  // carries more uncertainty and receives a larger discount.
  const yearsAhead = Number.isFinite(seasonYear) && Number.isFinite(pickYear)
    ? Math.max(0, pickYear - seasonYear)
    : 0;
  const horizonMultiplier = yearsAhead <= 0 ? 1 : yearsAhead === 1 ? 0.8 : yearsAhead === 2 ? 0.62 : 0.62 ** (yearsAhead / 2);
  return Math.max(25, Math.round(baseValue * horizonMultiplier));
}

// Estimate how difficult a player is to acquire (for UI display).
export function getAcquisitionDifficulty(player, context = {}) {
  const value = calculatePlayerValue(player, context);
  const untouchable = isPlayerUntouchable(player, null, context);
  const tier = getValuationTier(value);

  if (untouchable) return { label: "Untouchable", color: "#ef4444", level: 5 };
  if (tier.label === "Franchise") return { label: "Extremely Hard", color: "#dc2626", level: 4 };
  if (tier.label === "Star") return { label: "Very Hard", color: "#f97316", level: 3 };
  if (tier.label === "Premium") return { label: "Hard", color: "#f59e0b", level: 2 };
  if (tier.label === "Solid") return { label: "Moderate", color: "#22c55e", level: 1 };
  return { label: "Achievable", color: "#3b82f6", level: 0 };
}

// What a club needs back (in its own valuation) before it will give up `gives`.
// Shared by trade evaluation and Trade Genius so both apply identical rules.
export function getExchangeRequirement(gives, clubName, context = {}) {
  const requestedValue = calculateOfferValue(gives, clubName, context);
  const window = getClubWindow(clubName, getClubAttraction(clubName), context);
  const protectsYouth = window <= 48 && (gives.players ?? []).some(p => Number(p.age) <= 23);
  const protectsPicks = window <= 48 && (gives.picks ?? []).length > 0;
  const untouchable = (gives.players ?? []).some(p => isPlayerUntouchable(p, null, context));
  const premium = untouchable ? 0.4 : protectsYouth || protectsPicks ? 0.25 : 0.08;
  return { requestedValue, premium, protectsYouth, protectsPicks, requiredValue: Math.round(requestedValue * (1 + premium)) };
}

// Evaluate what the AI receives against what it gives up, both from its perspective.
export function evaluatePackageExchange(receives, gives, clubName, context = {}) {
  if (!validTradePackage(receives) || !validTradePackage(gives)) return { accepted: false, reason: "Each side must contain one to three unique assets.", offeredValue: 0, requestedValue: 0 };
  const offeredValue = calculateOfferValue(receives, clubName, context);
  const { requestedValue, protectsYouth, protectsPicks, requiredValue } = getExchangeRequirement(gives, clubName, context);
  const accepted = offeredValue >= requiredValue;
  return { accepted, offeredValue, requestedValue, requiredValue, reason: accepted
    ? `${clubName} accepts the package on list value.`
    : `${clubName} ${protectsYouth || protectsPicks ? "is protecting its rebuilding assets and " : ""}needs approximately ${requiredValue.toLocaleString()} points in return; your package is worth ${offeredValue.toLocaleString()}. Revise the players or picks to close the gap.` };
}

// ---------------------------------------------------------------------------
// Fair-trade rules (used by Trade Genius)
//
// evaluatePackageExchange alone is lenient: a flat 8% premium and no protection
// for a club's best players. These helpers add the protections that
// evaluateTradeOffer applies when approaching a player directly:
//  - tiered premiums, +18% for best-23 players, a reduced premium for rebuilding
//    clubs moving on veterans;
//  - a "headline" rule: a club will not give up a best-23 player rated 80+
//    unless it receives a comparable player (within 7 OVR) or an early pick;
//  - a market guard: a club will not hand over more than about 25% more
//    neutral market value than it receives, however well the deal suits its list.
// ---------------------------------------------------------------------------
const FAIR_HEADLINE_MIN_OVERALL = 80;
const FAIR_HEADLINE_GAP = 7;
const FAIR_HEADLINE_PICK_VALUE = 450;
const FAIR_MARKET_TOLERANCE = 1.25;
const FAIR_MARKET_SLACK = 50;
export const FAIR_RULES = Object.freeze({
  headlineMinOverall: FAIR_HEADLINE_MIN_OVERALL,
  headlineGap: FAIR_HEADLINE_GAP,
  headlinePickValue: FAIR_HEADLINE_PICK_VALUE,
  marketTolerance: FAIR_MARKET_TOLERANCE,
  marketSlack: FAIR_MARKET_SLACK,
});

// Neutral (club-independent) value of a package, using the shared trade-point scale.
export function getNeutralMarketValue(pack, context = {}) {
  return calculateAssetPackageValue([
    ...(pack?.players ?? []).map((player) => calculatePlayerValue(player, context)),
    ...(pack?.picks ?? []).map((pick) => calculatePickValue(pick, context)),
  ]);
}

// What a club needs before giving up `gives`, including the fair-trade protections.
export function getFairExchangeRequirement(gives, clubName, context = {}) {
  const base = getExchangeRequirement(gives, clubName, context);
  const clubPlayers = (context.allPlayers ?? []).filter((player) => player.club === clubName);
  const best23 = new Set([...clubPlayers].sort((a, b) => num(b.overall, 0) - num(a.overall, 0)).slice(0, 23).map((player) => String(player.id)));
  const rebuilding = getClubWindow(clubName, getClubAttraction(clubName), context) <= 48;
  let premium = base.premium;
  let headlineOverall = null;
  for (const player of gives.players ?? []) {
    const tier = getValuationTier(getClubSpecificValuation(player, clubName, context));
    const inBest23 = best23.has(String(player.id));
    const rate = isPlayerUntouchable(player, null, context)
      ? 0.4
      : Math.max(0.02, tier.requiredSurplusRate + (inBest23 ? 0.18 : 0) - (rebuilding && num(player.age, 25) >= 29 ? 0.14 : 0));
    premium = Math.max(premium, rate);
    if (inBest23 && num(player.overall, 0) >= FAIR_HEADLINE_MIN_OVERALL) {
      headlineOverall = Math.max(headlineOverall ?? 0, num(player.overall, 0) - FAIR_HEADLINE_GAP);
    }
  }
  return {
    requestedValue: base.requestedValue,
    premium,
    requiredValue: Math.round(base.requestedValue * (1 + premium)),
    headlineOverall,
    marketGiven: getNeutralMarketValue(gives, context),
  };
}

// Headline and market guards for what the club receives. `received` summarises it:
// { bestOverall, bestPickValue, market }.
export function fairGuardsPass(requirement, received) {
  if (requirement.headlineOverall != null
    && received.bestOverall < requirement.headlineOverall
    && received.bestPickValue < FAIR_HEADLINE_PICK_VALUE) {
    return { ok: false, reason: "They need a comparable player or an early first-round pick for a best-23 player of that quality." };
  }
  if (requirement.marketGiven > received.market * FAIR_MARKET_TOLERANCE + FAIR_MARKET_SLACK) {
    return { ok: false, reason: "They would be giving up far more market value than they receive." };
  }
  return { ok: true };
}

export function summariseReceived(receives, context = {}) {
  return {
    bestOverall: Math.max(0, ...(receives.players ?? []).map((player) => num(player.overall, 0))),
    bestPickValue: Math.max(0, ...(receives.picks ?? []).map((pick) => calculatePickValue(pick, context))),
    market: getNeutralMarketValue(receives, context),
  };
}

// Stricter counterpart of evaluatePackageExchange.
export function evaluateFairPackageExchange(receives, gives, clubName, context = {}) {
  if (!validTradePackage(receives) || !validTradePackage(gives)) return { accepted: false, reason: "Each side must contain one to three unique assets.", offeredValue: 0, requestedValue: 0 };
  const offeredValue = calculateOfferValue(receives, clubName, context);
  const requirement = getFairExchangeRequirement(gives, clubName, context);
  const received = summariseReceived(receives, context);
  const guards = fairGuardsPass(requirement, received);
  const accepted = offeredValue >= requirement.requiredValue && guards.ok;
  return {
    accepted,
    reason: accepted ? "Accepted" : guards.ok ? "The package is below what they need." : guards.reason,
    offeredValue,
    requestedValue: requirement.requestedValue,
    requiredValue: requirement.requiredValue,
    premium: requirement.premium,
    marketGiven: requirement.marketGiven,
    marketReceived: received.market,
  };
}