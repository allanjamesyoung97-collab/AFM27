// Players Seeking Moves Engine — identifies players actively looking for a move.
// Uses the leave desire and negotiation logic from negotiationEngine.js.

import { resolveLeaveDesire, getLeaveDesireLevel, getLocationContentment } from "./negotiationEngine.js";
import { calculateMarketValue, estimateSalaryDemand } from "./contractValueEngine.js";
import { getClubAttraction, getClubSuccessBonus } from "../data/clubAttraction.js";
import { inferCareerStageKey } from "../engine/negotiationEngine.js";
import { getCareerClub } from "./contractEngine.js";
import { canRequestTrade } from "./playerMovementRules.js";

const num = (value, fallback) => (value === null || value === undefined || !Number.isFinite(Number(value)) ? fallback : Number(value));

// Reasons a player may want a move
const MOVE_REASONS = {
  MONEY: "Seeking a more lucrative contract",
  SECURITY: "Wants longer contract security",
  ROLE: "Desires a greater role opportunity",
  SUCCESS: "Wants to play for a contender",
  HOME: "Seeking a move closer to home",
  RELATIONSHIP: "Poor relationship with club",
  REBUILD: "Club is rebuilding — wants clarity",
  OPPORTUNITY: "Lack of senior opportunities",
  UNCERTAINTY: "End-of-contract uncertainty",
};

// Determine the primary reason a player wants to move
function determineMoveReason(player, contractRecord = {}, context = {}) {
  const personality = player.personality ?? {};
  const contract = player.contract ?? {};
  const playerClub = getCareerClub(player, context.contractsByPlayer ?? {});
  const { marketValue } = calculateMarketValue(player, { seasonYear: context.seasonYear });
  const currentSalary = num(contractRecord.salary ?? contract.salary, 300000);
  const salaryRatio = marketValue > 0 ? currentSalary / marketValue : 1;

  const reasons = [];

  // Money: salary well below market value
  if (marketValue > 0 && salaryRatio < 0.75 && num(player.age, 25) >= 24) {
    reasons.push({ reason: MOVE_REASONS.MONEY, weight: 30 });
  }

  // Contract security: in final year or out of contract
  const yearsRemaining = num(contractRecord.yearsRemaining ?? contract.yearsRemaining, 2);
  const opportunity = context.moveFactors?.[String(player.id)]?.opportunity ?? 0;
  const contention = context.moveFactors?.[String(player.id)]?.contention ?? 0;
  if (opportunity >= 10) {
    reasons.push({ reason: MOVE_REASONS.OPPORTUNITY, weight: 45 + opportunity });
  }
  if (contention >= 8 && (num(personality.ambition, 50) >= 55 || num(personality.premiershipDesire, 50) >= 60)) {
    reasons.push({ reason: MOVE_REASONS.SUCCESS, weight: 35 + contention });
  }
  if (yearsRemaining <= 0) {
    reasons.push({ reason: MOVE_REASONS.UNCERTAINTY, weight: 25 });
  } else if (yearsRemaining === 1) {
    reasons.push({ reason: MOVE_REASONS.SECURITY, weight: 15 });
  }

  // Club success: rebuilding club
  const successBonus = getClubSuccessBonus(playerClub ?? "", { ...context, allPlayers: context.allPlayers, playerContracts: context.contractsByPlayer });
  if (successBonus < -5) {
    reasons.push({ reason: MOVE_REASONS.REBUILD, weight: 20 });
    if (num(personality.ambition, 50) > 60) {
      reasons.push({ reason: MOVE_REASONS.SUCCESS, weight: 25 });
    }
  }

  // Location: unhappy at current location
  const locationContentment = getLocationContentment(player, playerClub ?? "");
  if (locationContentment < 40 && num(personality.locationImportance, 50) > 60) {
    reasons.push({ reason: MOVE_REASONS.HOME, weight: 20 });
  }

  // Relationship: poor coach relationship
  const coachRel = num(personality.relationships?.seniorCoach, 50);
  if (coachRel < 35) {
    reasons.push({ reason: MOVE_REASONS.RELATIONSHIP, weight: 25 });
  }

  // Role: high overall but low tier
  if (num(player.overall, 60) >= 78 && context.currentRoleTier && num(player.overall, 60) - context.currentRoleTier > 10) {
    reasons.push({ reason: MOVE_REASONS.ROLE, weight: 20 });
  }

  // Sort by weight and return top reason
  reasons.sort((a, b) => b.weight - a.weight);
  return reasons[0]?.reason ?? MOVE_REASONS.UNCERTAINTY;
}

// Determine preferred destination types for a player seeking a move
function getPreferredDestinations(player, context = {}) {
  const personality = player.personality ?? {};
  const preferences = [];
  const playerClub = getCareerClub(player, context.contractsByPlayer ?? {});
  const successBonus = getClubSuccessBonus(playerClub ?? "", { ...context, allPlayers: context.allPlayers, playerContracts: context.contractsByPlayer });
  const ambition = num(personality.ambition, 50);
  const premDesire = num(personality.premiershipDesire, 50);
  const locationImportance = num(personality.locationImportance, 50);

  if (ambition > 60 || premDesire > 65) {
    preferences.push("Contender with premiership aspirations");
  }
  if (successBonus < 0 && premDesire > 55) {
    preferences.push("Stable, well-run club");
  }
  if (locationImportance > 65) {
    preferences.push("Club closer to home state");
  }
  const age = num(player.age, 25);
  if (age <= 23) {
    preferences.push("Club offering guaranteed opportunities");
  }
  if (num(personality.greed, 50) > 65) {
    preferences.push("Club offering strong financial terms");
  }
  if (age >= 30) {
    preferences.push("Contender for final career years");
  }

  return preferences.length ? preferences : ["Any club offering a fair deal"];
}

// Determine interest level in the user's club (0-100)
function getUserClubInterest(player, userClubName, context = {}) {
  const attraction = getClubAttraction(userClubName, { ...context, allPlayers: context.allPlayers, playerContracts: context.contractsByPlayer });
  const personality = player.personality ?? {};
  const premWindow = attraction.premiershipWindow ?? 60;
  const successBonus = getClubSuccessBonus(userClubName, { ...context, allPlayers: context.allPlayers, playerContracts: context.contractsByPlayer });
  const locationContentment = getLocationContentment(player, userClubName);

  let interest = 50;
  interest += successBonus * 1.2;
  interest += (locationContentment - 50) * 0.3;
  interest += (attraction.reputation - 70) * 0.3;

  // Ambitious players more interested in contenders
  if (num(personality.ambition, 50) > 60 && premWindow >= 75) interest += 10;
  // Players with high location importance care more about location
  if (num(personality.locationImportance, 50) > 65) interest += (locationContentment - 50) * 0.3;

  return Math.max(0, Math.min(100, Math.round(interest)));
}

function getInterestLabel(interest) {
  if (interest >= 75) return { label: "Very Interested", color: "#22c55e" };
  if (interest >= 60) return { label: "Interested", color: "#4ade80" };
  if (interest >= 45) return { label: "Neutral", color: "#f59e0b" };
  if (interest >= 30) return { label: "Reluctant", color: "#f97316" };
  return { label: "Not Interested", color: "#ef4444" };
}

// Get all players seeking moves across the league
export function getPlayersSeekingMoves(allPlayers, contractsByPlayer = {}, userClubName, context = {}) {
  const seasonYear = context.seasonYear ?? 2027;
  const ctxWithContracts = { ...context, contractsByPlayer, allPlayers };
  const ladder = context.ladder ?? [];
  const rankByClub = new Map(ladder.map((entry, index) => [entry.club, entry.position ?? index + 1]));
  const playersByClub = new Map();
  for (const player of allPlayers) {
    const club = getCareerClub(player, contractsByPlayer);
    if (!club) continue;
    const group = playersByClub.get(club) ?? [];
    group.push(player);
    playersByClub.set(club, group);
  }

  return allPlayers
    .map((player) => {
      const record = contractsByPlayer[String(player.id)] ?? {};
      const currentClub = getCareerClub(player, contractsByPlayer);
      if (!currentClub || record.delisted) return null;
      if (!canRequestTrade(player, { ...(context.seasonState ?? {}), playerContracts: contractsByPlayer }, seasonYear)) return null;
      const yearsRemaining = num(record.yearsRemaining ?? player.contract?.yearsRemaining, 2);
      const age = num(player.age, 25);
      const currentRound = Math.max(0, Number(context.roundsPlayed ?? 0));
      const appearances = Number(context.appearancesByPlayer?.[String(player.id)] ?? 0);
      const overall = num(player.overall, 60);
      const positions = Array.isArray(player.positions) ? player.positions : player.position ? [player.position] : [];
      const peers = (playersByClub.get(currentClub) ?? []).filter((peer) =>
        String(peer.id) !== String(player.id) && positions.some((position) => (peer.positions ?? [peer.position]).includes(position))
      );
      const depthRanks = positions.map((position) => ({
        position,
        rank: 1 + peers.filter((peer) => (peer.positions ?? [peer.position]).includes(position) && num(peer.overall, 0) > overall).length,
      })).sort((a, b) => a.rank - b.rank);
      const depthRank = depthRanks[0]?.rank ?? 1;
      const depthPosition = depthRanks[0]?.position ?? "position";
      // Use projected positional depth in preseason and the first three rounds.
      // After four matches, actual selection history becomes the reliable signal.
      const projectedOpportunityRate = depthRank <= 3 ? 0.85 : depthRank <= 5 ? 0.6 : depthRank <= 7 ? 0.3 : 0.1;
      const hasActualOpportunitySample = currentRound >= 4;
      const opportunityRate = hasActualOpportunitySample ? appearances / currentRound : projectedOpportunityRate;
      let opportunity = 0;
      if (opportunityRate < 0.35 && age <= 23 && overall >= 65) opportunity += 20;
      else if (opportunityRate < 0.5 && age <= 25 && overall >= 72) opportunity += 12;
      else if (opportunityRate < 0.5 && overall >= 82) opportunity += 10;
      const depthConcern = opportunity > 0;

      const liveRank = Number(rankByClub.get(currentClub) ?? 0);
      const staticWindow = Number(getClubAttraction(currentClub, { allPlayers, playerContracts: contractsByPlayer, roundsPlayed: currentRound }).premiershipWindow ?? 60);
      let contention = staticWindow >= 82 ? -6 : staticWindow <= 55 ? 6 : 0;
      if (liveRank > 0 && currentRound >= 5) {
        if (liveRank <= 4) contention -= 8;
        else if (liveRank <= 8) contention -= 4;
        else if (liveRank >= 15) contention += 12;
        else if (liveRank >= 11) contention += 6;
      }
      if (age >= 29 && liveRank >= 9) contention += 5;
      if (age <= 23 && opportunity >= 12) contention += 2;

      const baseDesire = resolveLeaveDesire(player, record, ctxWithContracts);
      let contractFactor = 0;
      if (yearsRemaining <= 0) contractFactor = 16;
      else if (yearsRemaining === 1) contractFactor = 9;
      else if (yearsRemaining >= 3) contractFactor = -12;
      const ambition = num(player.personality?.ambition, 50);
      const premiershipDesire = num(player.personality?.premiershipDesire, 50);
      const clubIsRebuilding = staticWindow <= 55 || (liveRank >= 15 && currentRound >= 5);
      const contenderMismatch = clubIsRebuilding && (ambition >= 65 || premiershipDesire >= 65);
      const veteranFlagChase = age >= 29 && (staticWindow < 70 || (liveRank >= 9 && currentRound >= 5)) && premiershipDesire >= 60;
      const salary = num(record.salary ?? player.contract?.salary, 300000);
      const { marketValue } = calculateMarketValue(player, { seasonYear });
      const salaryGap = marketValue > 0 && salary / marketValue < 0.75 && age >= 24;
      const personalDistress = baseDesire >= 25;
      const moveSignals = [
        yearsRemaining <= 1 && baseDesire >= 15,
        depthConcern,
        contenderMismatch || veteranFlagChase,
        salaryGap,
        personalDistress,
      ].filter(Boolean).length;
      const ageFactor = veteranFlagChase ? 6 : age <= 23 && opportunity >= 12 ? 4 : 0;
      const leaveDesire = Math.max(0, Math.min(100, Math.round(baseDesire + contractFactor + opportunity + contention + ageFactor)));
      // A low rookie salary alone is not enough to put a player on the list.
      // Require a meaningful role, contract, direction, pay or morale signal.
      if (moveSignals === 0 || leaveDesire < 26) return null;

      const level = getLeaveDesireLevel(leaveDesire);
      const reasonContext = {
        ...ctxWithContracts,
        seasonYear,
        moveFactors: { [String(player.id)]: { opportunity, contention } },
      };
      let reason = determineMoveReason(player, record, reasonContext);
      if (depthConcern && opportunity >= 10 && (hasActualOpportunitySample || depthRank >= 5)) {
        reason = hasActualOpportunitySample
          ? `Limited senior opportunities (${appearances} appearances from ${currentRound} matches)`
          : `Crowded ${depthPosition} depth (${depthRank}${depthRank === 1 ? "st" : depthRank === 2 ? "nd" : depthRank === 3 ? "rd" : "th"} in the projected pecking order)`;
      } else if (veteranFlagChase) {
        reason = "Veteran seeking a stronger premiership opportunity";
      } else if (contenderMismatch) {
        reason = "Ambitious player unsettled by the club's rebuilding direction";
      } else if (yearsRemaining <= 1 && reason === MOVE_REASONS.UNCERTAINTY) {
        reason = yearsRemaining <= 0 ? MOVE_REASONS.UNCERTAINTY : MOVE_REASONS.SECURITY;
      }
      const demand = estimateSalaryDemand(player, userClubName, 1, seasonYear);

      const careerStageKey = inferCareerStageKey(num(player.age, 25));
      const preferredDestinations = getPreferredDestinations(player, ctxWithContracts);
      const userInterest = getUserClubInterest(player, userClubName, ctxWithContracts);
      const interestLabel = getInterestLabel(userInterest);

      const desiredYears = careerStageKey === "VETERAN" ? 2 : ["YOUNG_PROSPECT", "DEVELOPING"].includes(careerStageKey) ? 3 : 4;

      return {
        player,
        leaveDesire,
        level,
        reason,
        desiredSalaryRange: {
          min: Math.round(demand * 0.9 / 5000) * 5000,
          max: Math.round(demand * 1.2 / 5000) * 5000,
        },
        desiredContractLength: desiredYears,
        preferredDestinations,
        userClubInterest: userInterest,
        userClubInterestLabel: interestLabel,
        yearsRemaining,
        marketValue,
        appearances,
        opportunityRate,
        opportunityBasis: hasActualOpportunitySample ? "actual" : "projected",
        projectedDepthRank: depthRank,
        projectedDepthPosition: depthPosition,
        moveSignalCount: moveSignals,
        currentClub,
        ladderRank: liveRank || null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.leaveDesire - a.leaveDesire);
}

// Get players from a specific club seeking moves
export function getClubPlayersSeekingMoves(allPlayers, contractsByPlayer, clubName, context = {}) {
  const all = getPlayersSeekingMoves(allPlayers, contractsByPlayer, clubName, context);
  return all.filter((item) => getCareerClub(item.player, contractsByPlayer) === clubName);
}
