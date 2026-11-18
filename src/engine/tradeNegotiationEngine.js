// Trade Negotiation Engine — handles the two-phase trade process.
// Phase 1: Club-to-club negotiation (owning club evaluates offer)
// Phase 2: Player contract negotiation (acquiring club negotiates with player)
// A trade is not complete until both the club AND player agree.

import { evaluateOffer, generateCounterOffer, defaultRoleForPlayer } from "./negotiationEngine.js";
import { conditionalTermFields } from "./contractComponents.js";
import { getClubSpecificValuation, calculateOfferValue, evaluateTradeOffer, getValuationTier } from "./playerValuationEngine.js";

// Evaluate a trade offer from the user to an AI club for a target player.
// Returns: { phase, clubResponse, offerValue, targetValue, ... }
export function evaluateClubTradeResponse(targetPlayer, offerPackage, owningClubName, context = {}) {
const result = evaluateTradeOffer(targetPlayer, offerPackage, owningClubName, context);

return {
phase: "CLUB_NEGOTIATION",
accepted: result.accepted,
reason: result.reason,
offerValue: result.offerValue,
targetValue: result.targetValue,
surplusValue: result.surplusValue,
confidence: result.confidence,
};
}

// Generate a counter-offer from the AI club (what they'd want in return).
export function generateClubCounterOffer(targetPlayer, offerPackage, owningClubName, allPlayers, context = {}) {
const targetValue = getClubSpecificValuation(targetPlayer, owningClubName, context);
const offerValue = calculateOfferValue(offerPackage, owningClubName, context);
const requiredSurplus = Math.round(targetValue * getValuationTier(targetValue).requiredSurplusRate);

// The AI club wants the offer value to reach targetValue + requiredSurplus
const targetOfferValue = targetValue + requiredSurplus;

return {
phase: "CLUB_NEGOTIATION",
targetValue,
currentOfferValue: offerValue,
requiredOfferValue: targetOfferValue,
deficit: targetOfferValue - offerValue,
message: `${owningClubName} is looking for an offer worth approximately ${targetOfferValue} value points. The current offer is worth ${offerValue}.`,
};
}

// Evaluate a player contract offer during the second phase of a trade.
export function evaluatePlayerContractResponse(player, contractOffer, context = {}) {
const evaluation = evaluateOffer(player, contractOffer, context);
return {
phase: "PLAYER_NEGOTIATION",
score: evaluation.score,
outcome: evaluation.outcome,
breakdown: evaluation.breakdown,
marketValue: evaluation.marketValue,
isCurrentClub: evaluation.isCurrentClub,
};
}

// Generate a player counter-offer for contract negotiation.
export function generatePlayerContractCounter(player, originalOffer, context = {}) {
return generateCounterOffer(player, originalOffer, context);
}

// Check if a trade is fully complete (both club and player agreed)
export function isTradeComplete(clubAccepted, playerAccepted) {
return clubAccepted === true && playerAccepted === true;
}

// Determine the trade status string
export function getTradeStatus({ clubAccepted, playerAccepted, clubResponded, playerResponded }) {
if (isTradeComplete(clubAccepted, playerAccepted)) return { label: "Completed", color: "#22c55e", phase: "DONE" };
if (clubAccepted && !playerResponded) return { label: "Club Agreed — Awaiting Player", color: "#3b82f6", phase: "PLAYER_NEGOTIATION" };
if (clubAccepted && playerResponded && !playerAccepted) return { label: "Player Negotiation In Progress", color: "#f59e0b", phase: "PLAYER_NEGOTIATION" };
if (!clubResponded) return { label: "Awaiting Club Response", color: "#94a3b8", phase: "CLUB_NEGOTIATION" };
if (clubResponded && !clubAccepted) return { label: "Club Rejected", color: "#ef4444", phase: "CLUB_NEGOTIATION" };
return { label: "In Progress", color: "#f59e0b", phase: "CLUB_NEGOTIATION" };
}

// Complete a trade: move player to new club via contract record, set new contract.
export function executeTrade(targetPlayer, newClubName, contractTerms, allPlayers, contractsByPlayer = {}) {
const updatedContracts = {
...contractsByPlayer,
[String(targetPlayer.id)]: {
...contractsByPlayer[String(targetPlayer.id)],
club: newClubName,
salary: contractTerms.salary,
yearsRemaining: contractTerms.years,
yearlySalaries: contractTerms.yearlySalaries ?? Array.from({ length: contractTerms.years }, () => contractTerms.salary),
role: contractTerms.role ?? "BEST_22",
promises: contractTerms.promises ?? [],
...conditionalTermFields(contractTerms),
signedSeason: contractTerms.signedSeason ?? null,
clubJoinedSeason: contractTerms.signedSeason ?? null,
},
};

return { players: allPlayers, contracts: updatedContracts };
}

// Free Agency: sign a free agent directly (no club trade needed).
export function evaluateFreeAgentOffer(player, contractOffer, context = {}) {
const evaluation = evaluateOffer(player, contractOffer, context);
return {
score: evaluation.score,
outcome: evaluation.outcome,
breakdown: evaluation.breakdown,
marketValue: evaluation.marketValue,
};
}

// AI free agency: competing clubs make offers for a free agent.
export function generateAIFreeAgentOffers(player, userClubName, seasonYear, context = {}) {
const clubs = Array.isArray(context.clubs) ? context.clubs : [];
if (!clubs || !clubs.length) return [];

const allClubs = clubs.filter((c) => c.name !== userClubName && c.name !== player.club);
const { marketValue } = evaluateOffer(player, { clubName: userClubName, salary: 400000, years: 2 }, context);

// Select 2-4 interested AI clubs based on player value and club needs
const interested = allClubs
.map((club) => ({
club,
interest: Math.random(),
}))
.filter((item) => item.interest > 0.6)
.sort((a, b) => b.interest - a.interest)
.slice(0, 4);

return interested.map(({ club }) => {
const salaryVariation = 0.9 + Math.random() * 0.3;
const years = 2 + Math.floor(Math.random() * 2);
return {
clubName: club.name,
salary: Math.round((marketValue * salaryVariation) / 5000) * 5000,
years,
role: defaultRoleForPlayer(player),
promises: [],
};
});
}
