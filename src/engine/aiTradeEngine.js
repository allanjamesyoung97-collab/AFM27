// AI Trade Activity Engine — generates realistic league-wide trade activity.
// AI clubs trade with each other, approach the user's club, and make offers.

import { getClubSpecificValuation, calculateOfferValue, calculatePickValue, evaluateTradeOffer, evaluatePackageExchange, isPlayerUntouchable } from "./playerValuationEngine.js";
import { getClubAttraction } from "../data/clubAttraction.js";

const num = (value, fallback) => (value === null || value === undefined || !Number.isFinite(Number(value)) ? fallback : Number(value));

// Stable pseudo-random
function hashUnit(key) {
  let hash = 2166136261;
  const text = String(key);
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

// Determine a club's list needs based on squad analysis
function getClubNeeds(clubName, allPlayers) {
  const squad = allPlayers.filter((p) => p.club === clubName);
  const positionCounts = {};
  const positionQuality = {};

  squad.forEach((p) => {
    const positions = Array.isArray(p.positions) ? p.positions : [p.position];
    positions.forEach((pos) => {
      positionCounts[pos] = (positionCounts[pos] ?? 0) + 1;
      positionQuality[pos] = (positionQuality[pos] ?? []).concat([num(p.overall, 60)]);
    });
  });

  const needs = [];
  Object.keys(positionCounts).forEach((pos) => {
    const avg = positionQuality[pos].reduce((a, b) => a + b, 0) / positionQuality[pos].length;
    if (positionCounts[pos] < 3 || avg < 72) {
      needs.push({ position: pos, urgency: positionCounts[pos] < 2 ? "high" : positionCounts[pos] < 4 ? "medium" : "low" });
    }
  });

  return needs;
}

// Find players that an AI club might want to target
function findTradeTargetsForClub(buyerClub, allPlayers, seasonYear, tradeRequests = [], plan = null) {
  const attraction = getClubAttraction(buyerClub.name, { allPlayers });
  const premWindow = attraction.premiershipWindow ?? 60;
  const needs = getClubNeeds(buyerClub.name, allPlayers);

  return allPlayers
    .filter((p) => p.club !== buyerClub.name)
    .filter((p) => !p.recentlyMoved)
    .filter((p) => !isPlayerUntouchable(p, null, {}))
    .map((p) => {
      const value = getClubSpecificValuation(p, buyerClub.name, { allPlayers, seasonYear, clubCount: 18 });
      const age = num(p.age, 25);

      // Score based on need match, age fit, and value
      let desirability = 0;
      const positions = Array.isArray(p.positions) ? p.positions : [p.position];
      const matchesNeed = positions.some((pos) => needs.some((n) => n.position === pos));
      if (matchesNeed) desirability += 30;
      const planned = plan?.targets?.find(target => String(target.playerId) === String(p.id));
      if (planned) desirability += 35 + planned.score * 0.25;

      // Contenders want proven players, rebuilders want youth
      if (premWindow >= 75 && age >= 24 && age <= 30) desirability += 15;
      if (premWindow < 50 && age <= 23) desirability += 20;
      if (tradeRequests.some(request => String(request.playerId) === String(p.id) && request.status === 'ACTIVE')) desirability += 28;

      desirability += value * 0.3;

      return { player: p, desirability, value };
    })
    .filter((item) => item.desirability > 25)
    .sort((a, b) => b.desirability - a.desirability)
    .slice(0, 8);
}

// Generate an AI-to-AI trade proposal
function generateAITradeProposal(buyerClub, sellerClub, targetPlayer, allPlayers, seasonYear) {
  const context = { allPlayers, seasonYear, clubCount: 18 };
  const targetValue = getClubSpecificValuation(targetPlayer, sellerClub.name, context);
  const buyerSquad = allPlayers.filter((p) => p.club === buyerClub.name);

  // AI offers players + picks that roughly match the target value
  const offerablePlayers = buyerSquad
    .filter((p) => !p.recentlyMoved)
    .filter((p) => !isPlayerUntouchable(p, null, {}))
    .filter((p) => num(p.overall, 60) < num(targetPlayer.overall, 60))
    .sort((a, b) => num(b.overall, 60) - num(a.overall, 60));

  const offerPlayers = [];
  const offerPicks = [];
  const window = getClubAttraction(buyerClub.name, { allPlayers, roundsPlayed: context.roundsPlayed }).premiershipWindow ?? 60;
  let accumulatedValue = 0;
  const requiredValue = Math.round(targetValue * 1.1); // 10% overs

  if (window >= 75) {
    for (const pick of buyerClub.draftPicks ?? []) {
      if (accumulatedValue >= requiredValue || offerPicks.length >= 2) break;
      if (offerPicks.some(existing => existing.id === pick.id)) continue;
      offerPicks.push(pick);
      accumulatedValue = calculateOfferValue({ players: offerPlayers, picks: offerPicks }, sellerClub.name, context);
    }
  }
  for (const p of offerablePlayers) {
    if (window < 50 && num(p.age, 25) <= 23) continue;
    if (accumulatedValue >= requiredValue || offerPlayers.length + offerPicks.length >= 3) break;
    const val = getClubSpecificValuation(p, sellerClub.name, context);
    if (val > 0 && val < targetValue * 1.5) {
      offerPlayers.push(p);
      accumulatedValue = calculateOfferValue({ players: offerPlayers, picks: offerPicks }, sellerClub.name, context);
    }
  }

  // Add picks if needed
  if (accumulatedValue < requiredValue) {
    const picks = buyerClub.draftPicks ?? [];
    for (const pick of picks) {
      if (accumulatedValue >= requiredValue || offerPlayers.length + offerPicks.length >= 3) break;
      if (offerPicks.some(existing => existing.id === pick.id)) continue;
      offerPicks.push(pick);
      accumulatedValue = calculateOfferValue({ players: offerPlayers, picks: offerPicks }, sellerClub.name, context);
    }
  }

  return {
    buyer: buyerClub.name,
    seller: sellerClub.name,
    target: targetPlayer,
    offer: { players: offerPlayers, picks: offerPicks },
    offerValue: accumulatedValue,
    targetValue,
  };
}

// Generate league-wide AI trade activity for a given period.
// Returns an array of trade events: { type, buyer, seller, target, offer, result }
export function generateAITradeActivity(allPlayers, clubs, seasonYear, userClubName, options = {}) {
  const events = [];
  const intensity = options.intensity ?? 0.85; // 0-1, how active the market is

  clubs.forEach((buyerClub) => {
    if (buyerClub.name === userClubName) return;

    // Each AI club has a chance to be active
    const activityRoll = hashUnit(`${buyerClub.name}:${options.windowKey ?? seasonYear}:activity`);
    if (activityRoll > intensity) return;

    const targets = findTradeTargetsForClub(buyerClub, allPlayers, seasonYear, options.tradeRequests, options.recruitmentPlans?.[buyerClub.name])
      .filter((item) => item.player.club !== userClubName);
    if (!targets.length) return;

    // Pick top target
    for (const { player: target } of targets.slice(0, 5)) {
    const sellerClub = clubs.find((c) => c.name === target.club);
    if (!sellerClub || sellerClub.name === buyerClub.name) continue;

    const proposal = generateAITradeProposal(buyerClub, sellerClub, target, allPlayers, seasonYear);
    const evaluation = evaluatePackageExchange(proposal.offer, { players: [target] }, sellerClub.name, {
      allPlayers,
      seasonYear,
      ladder: options.ladder ?? [],
      clubCount: clubs.length,
    });

    const buyerCost = calculateOfferValue(proposal.offer, buyerClub.name, { allPlayers, seasonYear, ladder: options.ladder ?? [] });
    const buyerGain = getClubSpecificValuation(target, buyerClub.name, { allPlayers, seasonYear, ladder: options.ladder ?? [] });
    if (buyerCost > buyerGain * 1.1) { evaluation.accepted = false; evaluation.reason = "The buying club will not overpay for this fit."; }
    const event = {
      id: `ai-trade-${buyerClub.name}-${sellerClub.name}-${target.id}-${seasonYear}`,
      type: "AI_TRADE",
      buyer: buyerClub.name,
      seller: sellerClub.name,
      target,
      offer: proposal.offer,
      offerValue: proposal.offerValue,
      targetValue: proposal.targetValue,
      result: evaluation.accepted ? "ACCEPTED" : "REJECTED",
      reason: evaluation.reason,
      seasonYear,
    };

    if (evaluation.accepted) {
      // Execute the trade
      event.executed = true;
    }

    events.push(event);
    if (evaluation.accepted) break;
    }
  });

  return events;
}

// Generate an AI offer to the user's club for one of their players.
export function generateAIOffersToUser(allPlayers, clubs, userClubName, seasonYear, options = {}) {
  const userPlayers = allPlayers.filter((p) => p.club === userClubName && !p.recentlyMoved);
  if (!userPlayers.length) return [];

  const intensity = options.intensity ?? 0.4;
  const windowKey = options.windowKey ?? seasonYear;
  const maxOffers = Math.max(1, Number(options.maxOffers) || 3);
  const usedTargetIds = new Set((options.excludedPlayerIds ?? []).map(String));
  const excludedClubNames = new Set((options.excludedClubNames ?? []).map(String));

  // AI clubs may target the user's players
  const interestedClubs = clubs.filter((c) => c.name !== userClubName);
  const offers = [];

  for (const aiClub of interestedClubs) {
    if (offers.length >= maxOffers) break;
    if (excludedClubNames.has(aiClub.name)) continue;
    const roll = hashUnit(`${aiClub.name}:${userClubName}:${windowKey}:offer`);
    if (roll > intensity) continue;

    // AI clubs choose between a player target and, particularly when rebuilding,
    // a draft-pick target. This keeps incoming offers from all looking alike.
    const attraction = getClubAttraction(aiClub.name, { allPlayers, ladder: options.ladder ?? [] });
    const window = Number(attraction.premiershipWindow ?? 60);
    const pickTargetChance = window < 50 ? 0.34 : window < 65 ? 0.14 : 0.04;
    const pickTargetRoll = hashUnit(`${aiClub.name}:${userClubName}:${windowKey}:pick-target`);
    const availableUserPicks = (options.userDraftPicks ?? [])
      .filter((pick) => pick.currentOwner === userClubName && !usedTargetIds.has(String(pick.id)));
    const targetPick = pickTargetRoll < pickTargetChance && availableUserPicks.length
      ? availableUserPicks
        .map((pick) => ({ pick, value: calculatePickValue(pick, { allPlayers, seasonYear, clubCount: clubs.length, ladder: options.ladder ?? [] }) }))
        .sort((a, b) => b.value - a.value)[Math.floor(hashUnit(`${aiClub.name}:${windowKey}:pick-choice`) * Math.min(availableUserPicks.length, 3))]
      : null;
    const targets = targetPick ? [] : userPlayers
      .filter((p) => !isPlayerUntouchable(p, null, {}))
      .filter((p) => !usedTargetIds.has(String(p.id)))
      .map((p) => {
        const value = getClubSpecificValuation(p, aiClub.name, { allPlayers, seasonYear, clubCount: clubs.length });
        const needs = getClubNeeds(aiClub.name, allPlayers);
        const positions = Array.isArray(p.positions) ? p.positions : [p.position];
        const matchesNeed = positions.some((pos) => needs.some((n) => n.position === pos));
        let desirability = value;
        if (matchesNeed) desirability += 20;
        if (options.tradeRequests?.some(request => String(request.playerId) === String(p.id) && request.status === 'ACTIVE')) desirability += 25;
        return { player: p, desirability, value };
      })
      .sort((a, b) => b.desirability - a.desirability)
      .slice(0, 3);

    if (!targetPick && !targets.length) continue;

    const chosen = targetPick ? null : targets.find(({ player }) => !usedTargetIds.has(String(player.id)));
    if (!targetPick && !chosen) continue;
    const target = chosen?.player ?? null;
    const targetValueForAI = chosen?.value ?? 0;
    const requestedPick = targetPick?.pick ?? null;
    const aiTargetValue = targetValueForAI;
    const aiSquad = allPlayers.filter((p) => p.club === aiClub.name);

    // Most clubs start below full market value. A smaller group stretch when the
    // target fills a major list gap or their premiership window makes it urgent.
    const offerRoll = hashUnit(`${aiClub.name}:${userClubName}:${windowKey}:offer-level`);
    let desiredReturnRate = offerRoll < 0.72
      ? 0.60 + hashUnit(`${aiClub.name}:${windowKey}:discount`) * 0.15
      : offerRoll < 0.93
        ? 0.76 + hashUnit(`${aiClub.name}:${windowKey}:fair`) * 0.14
        : 0.90 + hashUnit(`${aiClub.name}:${windowKey}:premium`) * 0.25;
    if (target && window >= 75) {
      const needs = getClubNeeds(aiClub.name, allPlayers);
      const targetPositions = target.positions ?? [target.position];
      const urgentFit = targetPositions.some((position) => needs.some((need) => need.position === position && need.urgency === "high"));
      if (urgentFit) desiredReturnRate = Math.min(1.22, desiredReturnRate + 0.12);
    }
    if (target && options.tradeRequests?.some((request) => String(request.playerId) === String(target.id) && request.status === "ACTIVE")) {
      desiredReturnRate = Math.min(1.2, desiredReturnRate + 0.08);
    }
    const requestedValue = target
      ? getClubSpecificValuation(target, userClubName, { allPlayers, seasonYear, clubCount: clubs.length, ladder: options.ladder ?? [] })
      : targetPick.value;

    // Candidate make-up reflects the buyer: rebuilders retain picks and offer
    // draft capital, while contenders are readier to part with useful players.
    const offerPlayers = aiSquad
      .filter((p) => !p.recentlyMoved)
      .filter((p) => !isPlayerUntouchable(p, null, {}))
      .filter((p) => !target || num(p.overall, 60) <= num(target.overall, 60) - 2)
      .map((player) => ({ type: "player", asset: player, value: getClubSpecificValuation(player, userClubName, { allPlayers, seasonYear, clubCount: clubs.length }) }));
    const offerPicks = (aiClub.draftPicks ?? [])
      .map((pick) => ({ type: "pick", asset: pick, value: calculatePickValue(pick, { allPlayers, seasonYear, clubCount: clubs.length, ladder: options.ladder ?? [] }) }));

    const context = { allPlayers, seasonYear, clubCount: clubs.length, ladder: options.ladder ?? [] };
    const targetValue = requestedValue;
    const targetAmount = targetValue * desiredReturnRate;
    const assets = [...offerPlayers, ...offerPicks]
      .filter((item) => item.value > 0 && item.value <= targetAmount * 1.15)
      .sort((a, b) => b.value - a.value)
      .slice(0, 18);
    let bestPackage = null;
    const considerPackage = (packageAssets) => {
      const players = packageAssets.filter((item) => item.type === "player").map((item) => item.asset);
      const picks = packageAssets.filter((item) => item.type === "pick").map((item) => item.asset);
      const value = calculateOfferValue({ players, picks }, userClubName, context);
      if (value <= 0 || value > targetValue * Math.min(1.28, desiredReturnRate + 0.14)) return;
      const distance = Math.abs(value / targetValue - desiredReturnRate);
      const hasPick = picks.length > 0;
      const wantsDraftAssets = window < 50;
      const stylePenalty = targetPick
        ? (hasPick ? (picks.length === 1 && !players.length ? 0 : 0.08) : 0.16)
        : wantsDraftAssets
          ? (hasPick ? 0 : 0.07)
          : (players.length ? 0 : 0.06);
      const score = distance + stylePenalty;
      if (!bestPackage || score < bestPackage.score) bestPackage = { players, picks, value, distance, score };
    };
    for (let first = 0; first < assets.length; first += 1) {
      considerPackage([assets[first]]);
      for (let second = first + 1; second < assets.length; second += 1) {
        considerPackage([assets[first], assets[second]]);
        for (let third = second + 1; third < assets.length; third += 1) {
          considerPackage([assets[first], assets[second], assets[third]]);
        }
      }
    }
    if (!bestPackage) continue;

    offers.push({
      id: `ai-offer-${aiClub.name}-${target?.id ?? `pick-${requestedPick.id}`}-${windowKey}`,
      type: "AI_OFFER_TO_USER",
      fromClub: aiClub.name,
      targetPlayer: target,
      targetPick: requestedPick,
      offer: { players: bestPackage.players, picks: bestPackage.picks },
      offerValue: bestPackage.value,
      targetValue,
      aiTargetValue,
      returnRate: Number((bestPackage.value / targetValue).toFixed(2)),
      message: target
        ? `${aiClub.name} has approached ${userClubName} about ${target.name}.`
        : `${aiClub.name} has proposed a draft-pick exchange with ${userClubName}.`,
      seasonYear,
    });
    usedTargetIds.add(String(target?.id ?? requestedPick.id));
  }

  return offers;
}

// Backwards-compatible helper for callers that only need one offer.
export function generateAIOfferToUser(allPlayers, clubs, userClubName, seasonYear, options = {}) {
  return generateAIOffersToUser(allPlayers, clubs, userClubName, seasonYear, { ...options, maxOffers: 1 })[0] ?? null;
}

// AI club retention: before contract expiry, clubs try to re-sign important players.
export function generateAIRetentionOffers(allPlayers, contractsByPlayer, clubs, seasonYear) {
  const retentionEvents = [];

  clubs.forEach((club) => {
    const squad = allPlayers.filter((p) => p.club === club.name);
    const attraction = getClubAttraction(club.name, { allPlayers, playerContracts: contractsByPlayer });
    const premWindow = attraction.premiershipWindow ?? 60;

    squad.forEach((player) => {
      const record = contractsByPlayer[String(player.id)] ?? {};
      const yearsRemaining = num(record.yearsRemaining ?? player.contract?.yearsRemaining, 2);
      if (yearsRemaining > 1) return; // Only approach players in final year

      const value = getClubSpecificValuation(player, club.name, {
        allPlayers,
        seasonYear,
        clubCount: clubs.length,
      });
      const age = num(player.age, 25);

      // Rebuilding clubs prioritize young talent; contenders prioritize stars
      let priority = 0;
      if (premWindow < 50 && age <= 23) priority = 80;
      else if (premWindow >= 75 && value >= 500) priority = 80;
      else if (value >= 325) priority = 50;
      else priority = 30;

      if (priority < 40) return; // Not important enough

      retentionEvents.push({
        id: `retention-${club.name}-${player.id}-${seasonYear}`,
        type: "AI_RETENTION",
        club: club.name,
        player,
        priority,
        value,
        seasonYear,
      });
    });
  });

  return retentionEvents;
}
