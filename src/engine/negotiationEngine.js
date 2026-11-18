// Negotiation Engine — the master contract evaluation system.
// Every offer generates a satisfaction score from 0-100.
//
// OfferScore = SalaryRating*SalaryWeight + RoleRating*RoleWeight
// + SuccessRating*SuccessWeight + LocationRating*LocationWeight
// + RelationshipRating*RelationshipWeight + SecurityRating*SecurityWeight
// + RandomVariance
//
// Score thresholds:
// 0-39 Reject
// 40-59 Counter Offer
// 60-79 Consider
// 80+ Accept

import { calculateMarketValue, estimateSalaryDemand } from "./contractValueEngine.js";
import { getClubAttraction, getClubLocationAppeal, getClubSuccessBonus } from "../data/clubAttraction.js";
import { getRoleById, careerStages, getCareerStage, getCurrentCareerPersonality, promiseTypes } from "../data/playerPersonalities.js";
import { CAP_GROWTH_RATE, getMaximumSalary } from "./salaryCap.js";
import { earnedMatchPayments, normalizeContractComponents } from "./contractComponents.js";
import {
 buildSalarySchedule,
 describeStructure,
 getPresentValueAverage,
 getScheduleAverage,
 getScheduleShape,
 getShapeWeights,
 STRUCTURE_PRESETS,
} from "./contractStructure.js";

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
// Number with a fallback for undefined / null / NaN (Number(null) is 0, so check it too).
const num = (value, fallback) => (value === null || value === undefined || value === "" || !Number.isFinite(Number(value)) ? fallback : Number(value));

// --- Position / role helpers ---

const POSITION_GROUPS = { MID: "MID", WING: "MID", RUC: "MID", KPF: "FWD", FF: "FWD", HF: "FWD", KPD: "DEF", HB: "DEF", BP: "DEF" };
const ROLE_BY_GROUP = { MID: "CORE_MIDFIELDER", FWD: "KEY_FORWARD", DEF: "KEY_DEFENDER" };

export function getPositionGroup(player) {
 return POSITION_GROUPS[player?.positions?.[0]] ?? "MID";
}

// The role a club would sensibly offer for a player's ability and position.
export function defaultRoleForPlayer(player) {
 const ability = num(player?.overall, 60);
 if (ability >= 88) return ROLE_BY_GROUP[getPositionGroup(player)];
 if (ability >= 70) return "BEST_22";
 if (ability >= 60) return "ROTATION";
 return "DEPTH";
}

export function inferCareerStageKey(age) {
 const stage = getCareerStage(num(age, 25));
 return Object.keys(careerStages).find((key) => careerStages[key] === stage) ?? "PRIME";
}

// --- Club context ---
//
// The negotiation engine stays free of app state. Callers describe the club that is
// making the offer with a plain object (see buildClubNegotiationContext in
// clubAdministrationEngine.js):
// { clubName, coachRelationshipModifier, ladderRank, roundsPlayed, reputation, facilityLevel }
// Pass it as context.clubContext (one club) or context.clubContexts[clubName] (many,
// e.g. free agency). Clubs without a context fall back to the static attraction data.

function resolveClubContext(clubName, context = {}) {
 if (context.clubContexts?.[clubName]) return context.clubContexts[clubName];
 if (context.clubContext && (!context.clubContext.clubName || context.clubContext.clubName === clubName)) {
 return context.clubContext;
 }
 return null;
}

// Blends the static premiership-window bonus with the live ladder as the season goes on.
export function resolveClubSuccessBonus(clubName, clubContext) {
 const base = getClubSuccessBonus(clubName, { clubContext });
 const rank = num(clubContext?.ladderRank, 0);
 if (!rank) return base;
 const live = clamp((9.5 - rank) * 2.2, -12, 20);
 const liveWeight = clamp(num(clubContext?.roundsPlayed, 0) / 10, 0, 0.6);
 return base * (1 - liveWeight) + live * liveWeight;
}

// Reputation and facilities shift how attractive a club is, around a neutral 70 / 75.
// Facility level 2 (where every club starts) is neutral; level 5 is worth about +10 rating points.
function clubAppealShift(clubName, clubContext) {
 const attraction = getClubAttraction(clubName, { clubContext });
 const reputation = num(clubContext?.reputation, attraction.reputation ?? 70);
 const facilityLevel = num(clubContext?.facilityLevel, null);
 const facilities = facilityLevel === null ? (attraction.facilities ?? 75) : clamp(75 + (facilityLevel - 2) * 8, 0, 100);
 return (reputation - 70) * 0.4 + (facilities - 75) * 0.4;
}

// --- Sub-scores (each returns 0-100) ---

// Anchors: 100% of market value = 70, 120% = 90, 80% = 45, 60% = 20. Paying well
// above market keeps adding score up to ~150%, so salary can compensate for weak
// role, location or club appeal.
const SALARY_CURVE = [[0.4, 0], [0.6, 20], [0.8, 45], [1.0, 70], [1.2, 90], [1.5, 100]];

function interpolateCurve(x, curve) {
 if (x <= curve[0][0]) return curve[0][1];
 for (let i = 1; i < curve.length; i += 1) {
 const [x1, y1] = curve[i];
 const [x0, y0] = curve[i - 1];
 if (x <= x1) return y0 + (y1 - y0) * ((x - x0) / (x1 - x0));
 }
 return curve[curve.length - 1][1];
}

function scoreSalary(schedule, marketValue, greed, discountRate) {
 if (marketValue <= 0) return 50;
 // Judge the deal in today's dollars (the market grows every season, so a flat
 // multi-year deal is worth less each year), then weight earlier seasons more.
 const real = schedule.map((value, index) => value / (1 + CAP_GROWTH_RATE) ** index);
 const effective = getPresentValueAverage(real, discountRate);
 const baseScore = interpolateCurve(effective / marketValue, SALARY_CURVE);
 // Greedy players are harder to satisfy.
 const greedPenalty = (greed - 50) * 0.15;
 return clamp(baseScore - greedPenalty, 0, 100);
}

// A player's schedule for an offer: offer.yearlySalaries when present, otherwise a flat
// deal at offer.salary (the average annual value).
export function getOfferSchedule(offer = {}) {
 const years = clamp(Math.round(num(offer.years, 2)), 1, 6);
 const given = Array.isArray(offer.yearlySalaries) ? offer.yearlySalaries.map(Number).filter(Number.isFinite) : [];
 if (given.length) return Array.from({ length: years }, (_, index) => given[Math.min(index, given.length - 1)]);
 return Array.from({ length: years }, () => num(offer.salary, 0));
}

// How strongly a player prefers money now. Veterans and greedy players want it sooner
// (they may not be around, or paid, in the final years); young players are more patient.
function getDiscountRate(personality, careerStageKey) {
 const stage = careerStageKey === "VETERAN" ? 0.06 : careerStageKey === "YOUNG_PROSPECT" ? -0.03 : careerStageKey === "DEVELOPING" ? -0.01 : 0;
 return clamp(0.08 + stage + (num(personality.greed, 50) - 50) * 0.001, 0.02, 0.2);
}

// How far above market value a counter can climb before the player's agent gives up:
// 20% for a relaxed player up to 40% for the greediest.
const COUNTER_BASE_PREMIUM = 0.2;
const COUNTER_GREED_PREMIUM = 0.2;

// Average of (1 + growth)^year over a deal: what a flat deal must be marked up by to keep pace with the market.
function averageGrowth(years) {
 return Array.from({ length: years }, (_, index) => (1 + CAP_GROWTH_RATE) ** index).reduce((sum, value) => sum + value, 0) / years;
}

function scoreRole(offeredRoleId, playerOverall, careerStageKey) {
 const role = getRoleById(offeredRoleId);
 const ability = playerOverall ?? 60;

 // gap > 0 means the role is bigger than the player's ability suggests.
 const gap = role.tierValue - ability;
 let score;
 if (gap <= 0) {
 // Role too low: 1.5 points lost per tier point.
 score = 90 + gap * 1.5;
 } else if (gap <= 8) {
 // Slightly bigger role than expected: small bonus.
 score = 90 + gap * 0.6;
 } else {
 // A much bigger role than ability justifies reads as unrealistic.
 score = 90 + 8 * 0.6 - (gap - 8) * 0.8;
 }

 // Young players care enormously about role — penalize low roles extra.
 if (["YOUNG_PROSPECT", "DEVELOPING"].includes(careerStageKey) && role.tierValue < 65) {
 score -= 20;
 }

 // Veterans don't want "development" roles.
 if (careerStageKey === "VETERAN" && offeredRoleId === "DEVELOPMENT") {
 score -= 30;
 }

 return clamp(score, 0, 100);
}

// Promises are extra role assurances. Each one only helps if it suits the player.
export function scorePromises(player, promiseIds = [], { offeredRoleId = "BEST_22", careerStageKey = "PRIME" } = {}) {
 const personality = player.personality ?? {};
 const group = getPositionGroup(player);
 const ambition = num(personality.ambition, 50);
 const overall = num(player.overall, 60);
 const applied = [];

 [...new Set(promiseIds)].forEach((id) => {
 let bonus = 0;
 if (id === "MIDFIELD_ROLE") bonus = group === "MID" ? 10 : 2;
 else if (id === "FORWARD_LINE_ROLE") bonus = group === "FWD" ? 10 : 2;
 else if (id === "KEY_DEFENDER_DEV") bonus = group === "DEF" ? 10 : 2;
 else if (id === "BEST_22_GUARANTEE") bonus = 8 + (getRoleById(offeredRoleId).tierValue < getRoleById("BEST_22").tierValue ? 6 : 0);
 else if (id === "LEADERSHIP_ROLE") bonus = 4 + (ambition >= 60 ? 4 : 0) + (careerStageKey === "VETERAN" ? 3 : 0);
 else if (id === "CAPTAINCY_PATHWAY") bonus = ambition >= 60 && overall >= 75 ? 9 : 2;
 if (bonus > 0) applied.push({ id, bonus });
 });

 const bonus = Math.min(20, applied.reduce((sum, item) => sum + item.bonus, 0));
 return { bonus, applied };
}

function normalisePromiseIds(promises = []) {
 return (Array.isArray(promises) ? promises : []).map((item) => (typeof item === "string" ? item : item?.id)).filter(Boolean);
}

function scoreClubSuccess(clubName, premiershipDesire, ambition, clubContext = null) {
 const successBonus = resolveClubSuccessBonus(clubName, clubContext);
 // Base of 50, shifted by club success, then by reputation and facilities.
 let score = 50 + successBonus * 1.8 + clubAppealShift(clubName, clubContext);

 // Ambitious players weight success more — bigger swings.
 const ambitionMultiplier = (ambition - 50) * 0.3;
 score += ambitionMultiplier;

 // Premiership-driven players react strongly to contenders vs rebuilders.
 const desireMultiplier = (premiershipDesire - 50) * 0.25;
 score += successBonus > 0 ? desireMultiplier : -desireMultiplier * 0.5;

 return clamp(score, 0, 100);
}

// Stable pseudo-random number in [0, 1) from a key.
function hashUnit(key) {
 let hash = 2166136261;
 const text = String(key);
 for (let i = 0; i < text.length; i += 1) {
 hash ^= text.charCodeAt(i);
 hash = Math.imul(hash, 16777619);
 }
 return (hash >>> 0) / 4294967296;
}

// How content a player is with living in a club's location (0-100). It combines how
// appealing the city is, the player's own taste (stable for each player and club) and,
// at his current club, how settled he already is. Birthplace is deliberately not used.
export function getLocationContentment(player, clubName) {
 const personality = player.personality ?? {};
 const appeal = getClubLocationAppeal(clubName);
 const taste = (hashUnit(`${player.id}:${clubName}:location`) - 0.5) * 40;
 const isCurrentClub = clubName === player.club;
 // Roots and routine at his own club; a house move and a new city anywhere else.
 const settled = isCurrentClub ? 6 + (num(personality.loyalty, 50) - 50) * 0.2 : -4;
 return clamp(Math.round(appeal + taste + settled), 0, 100);
}

export function getLocationLabel(score) {
 if (score >= 75) return "Very content";
 if (score >= 60) return "Content";
 if (score >= 45) return "Neutral";
 return "Unsettled";
}

function scoreLocation(player, clubName) {
 return getLocationContentment(player, clubName);
}

function scoreRelationships(playerPersonality, clubName, isCurrentClub, clubContext = null) {
 const rels = playerPersonality.relationships ?? {};
 // A better senior coach improves the relationship wherever he coaches. For a rival
 // club the player starts neutral with that club's coach.
 const coachModifier = num(clubContext?.coachRelationshipModifier, 0);
 const coachBase = isCurrentClub ? num(rels.seniorCoach, 50) : 50;
 const coach = clamp(coachBase + coachModifier, 0, 100);
 const club = rels.club ?? 50;
 const fanbase = rels.fanbase ?? 50;
 const leadership = clamp(Number(rels.leadershipGroup ?? 50) + (num(clubContext?.leadershipGroupQuality, 50) - 50) * 0.3, 0, 100);

 // Coach relationship is the biggest factor.
 let score = coach * 0.4 + club * 0.25 + fanbase * 0.15 + leadership * 0.2;

 // Non-current clubs start at a neutral baseline.
 if (!isCurrentClub) {
 score = 50 * 0.6 + score * 0.4;
 }

 return clamp(score, 0, 100);
}

function scoreSecurity(offerYears, careerStageKey, age) {
 // Years beyond a player's expected career add no security: a 34-year-old values
 // a 2-year deal about as much as a 5-year one.
 const careerYearsLeft = Math.max(2, 36 - num(age, 25));
 const effectiveYears = Math.min(offerYears, careerYearsLeft);

 // Longer contracts = more security. Veterans value security more.
 let score = 40 + effectiveYears * 12;

 if (careerStageKey === "VETERAN") {
 score += (effectiveYears - 1) * 10;
 }
 if (["YOUNG_PROSPECT", "DEVELOPING"].includes(careerStageKey)) {
 // Young players want 2-3 year deals — too long can mean underpaid.
 if (effectiveYears <= 3) score += 10;
 else score -= (effectiveYears - 3) * 5;
 }

 return clamp(score, 0, 100);
}

// --- Master evaluation ---

export const negotiationOutcomes = {
 REJECT: "REJECT",
 COUNTER: "COUNTER",
 CONSIDER: "CONSIDER",
 ACCEPT: "ACCEPT",
};

export function evaluateOffer(player, offer, context = {}) {
 const personality = getCurrentCareerPersonality(player);
 const weights = personality.negotiationWeights ?? {
 salary: 35,
 contractLength: 15,
 roleSecurity: 20,
 clubSuccess: 15,
 location: 10,
 coachingStaff: 5,
 };

 const clubName = offer.clubName ?? player.club ?? context.clubName ?? "";
 const isCurrentClub = clubName === player.club;
 const clubContext = resolveClubContext(clubName, context);

 const { marketValue: baseMarketValue } = calculateMarketValue(player, {
 interestedClubs: context.interestedClubs ?? 1,
 seasonYear: context.seasonYear,
 });
 const marketValue = Math.round(baseMarketValue * (1 + Math.max(0, Number(context.demandIncrease ?? 0))));

 const age = player.age ?? 25;
 const careerStageKey = inferCareerStageKey(age);
 const offeredRoleId = offer.role ?? "BEST_22";

 const promiseResult = scorePromises(player, normalisePromiseIds(offer.promises), { offeredRoleId, careerStageKey });

 const schedule = getOfferSchedule(offer);
 const discountRate = getDiscountRate(personality, careerStageKey);
 // Conditional pay has some value to the player, but less than guaranteed
 // salary because selection and awards are uncertain.
 const incentives = normalizeContractComponents(offer).performanceIncentives;
 const expectedExtras = earnedMatchPayments(offer, 18) * 0.75
 + Object.values(incentives).reduce((sum, value) => sum + value, 0) * 0.1;
 const salaryRating = scoreSalary(schedule.map((base) => base + expectedExtras), marketValue, personality.greed ?? 50, discountRate);
 const roleRating = clamp(scoreRole(offeredRoleId, player.overall ?? 60, careerStageKey) + promiseResult.bonus, 0, 100);
 const successRating = scoreClubSuccess(clubName, personality.premiershipDesire ?? 50, personality.ambition ?? 50, clubContext);
 const locationRating = scoreLocation(player, clubName);
 const relationshipRating = scoreRelationships(personality, clubName, isCurrentClub, clubContext);
 const securityRating = scoreSecurity(offer.years ?? 2, careerStageKey, age);

 // Weighted sum, divided by the weights' actual total so custom weights that do
 // not add up to exactly 100 still produce a 0-100 score.
 const weightedSum =
 salaryRating * weights.salary +
 roleRating * weights.roleSecurity +
 successRating * weights.clubSuccess +
 locationRating * weights.location +
 relationshipRating * weights.coachingStaff +
 securityRating * weights.contractLength;
 const weightTotal =
 weights.salary + weights.roleSecurity + weights.clubSuccess +
 weights.location + weights.coachingStaff + weights.contractLength;

 const rawScore = weightedSum / (weightTotal > 0 ? weightTotal : 100);

 // Random variance: -5 to +5 to avoid robotic outcomes.
 const variance = context.deterministic ? 0 : (Math.random() - 0.5) * 10;
 const finalScore = clamp(rawScore + variance, 0, 100);

 let outcome;
 if (finalScore >= 80) outcome = negotiationOutcomes.ACCEPT;
 else if (finalScore >= 60) outcome = negotiationOutcomes.CONSIDER;
 else if (finalScore >= 40) outcome = negotiationOutcomes.COUNTER;
 else outcome = negotiationOutcomes.REJECT;

 // Aggression can turn a borderline CONSIDER into a COUNTER. With aggression
 // scored 0-100, agentPush ranges from -4 to +4, so a threshold above 5 could
 // never trigger. Keep deterministic evaluations free of random escalation.
 const agent = personality.agent;
 if (agent && !context.deterministic && outcome === negotiationOutcomes.CONSIDER) {
 const agentPush = (num(agent.aggression, 50) - 50) * 0.08;
 if (agentPush > 1.5 && finalScore < 75 && Math.random() < agentPush / 20) {
 outcome = negotiationOutcomes.COUNTER;
 }
 }

 return {
 score: Math.round(finalScore * 10) / 10,
 outcome,
 breakdown: {
 salary: {
 rating: Math.round(salaryRating),
 weight: weights.salary,
 averageAnnual: Math.round(getScheduleAverage(schedule)),
 structure: describeStructure(schedule),
 },
 role: { rating: Math.round(roleRating), weight: weights.roleSecurity, promiseBonus: promiseResult.bonus },
 success: { rating: Math.round(successRating), weight: weights.clubSuccess },
 location: { rating: Math.round(locationRating), weight: weights.location },
 relationships: { rating: Math.round(relationshipRating), weight: weights.coachingStaff },
 security: { rating: Math.round(securityRating), weight: weights.contractLength },
 },
 promises: promiseResult,
 marketValue,
 isCurrentClub,
 };
}

// --- Counter-offer generation ---

// The role an agent asks for: the best-scoring role the player's ability can justify.
// Ties go to the smaller role, so a role is only requested when it actually helps.
function pickCounterRole(player, offeredRoleId, careerStageKey) {
 const ability = num(player.overall, 60);
 const offeredTier = getRoleById(offeredRoleId).tierValue;
 const candidates = ["CLUB_SUPERSTAR", ROLE_BY_GROUP[getPositionGroup(player)], "BEST_22", "ROTATION", "DEPTH"]
 .map(getRoleById)
 .filter((role) => role.tierValue >= offeredTier && role.tierValue <= ability + 3);
 let best = getRoleById(offeredRoleId);
 let bestScore = scoreRole(best.id, ability, careerStageKey);
 for (const role of [...candidates].sort((a, b) => a.tierValue - b.tierValue)) {
 const score = scoreRole(role.id, ability, careerStageKey);
 if (score > bestScore + 0.01) { best = role; bestScore = score; }
 }
 return best.id;
}


export function generateCounterOffer(player, originalOffer, context = {}) {
 const personality = getCurrentCareerPersonality(player);
 // Default every agent field on its own: a partly filled agent must not produce NaN.
 const agent = {
 aggression: num(personality.agent?.aggression, 50),
 flexibility: num(personality.agent?.flexibility, 50),
 greed: num(personality.agent?.greed, 50),
 };

 const { marketValue } = calculateMarketValue(player, {
 interestedClubs: context.interestedClubs ?? 1,
 seasonYear: context.seasonYear,
 });

 const demand = estimateSalaryDemand(player, originalOffer.clubName ?? player.club, context.interestedClubs ?? 1, context.seasonYear);

 // Counter years: move the offer toward what suits the player's career stage.
 // Flexible agents settle closer to what was offered.
 const offeredSchedule = getOfferSchedule(originalOffer);
 const offeredYears = offeredSchedule.length;
 const age = num(player.age, 25);
 const stageKey = inferCareerStageKey(age);
 let targetYears = ["YOUNG_PROSPECT", "DEVELOPING"].includes(stageKey) ? 3 : stageKey === "VETERAN" ? 3 : 4;
 if (age >= 33) targetYears = 2; // near retirement: short deals
 const flexibility = clamp(agent.flexibility / 100, 0, 1);
 const counterYears = clamp(
 Math.round(offeredYears + (targetYears - offeredYears) * (1 - flexibility * 0.7)),
 1,
 6
 );

 // Counter salary (average per year): between market value and demand, pushed by agent
 // aggression, and marked up so a longer deal keeps pace with the growing market.
 // A counter never asks for less than the club already offered.
 const offeredAverage = getScheduleAverage(offeredSchedule);
 const agentPush = (agent.aggression - 50) / 100;
 // Salary demands the player has raised after earlier knock-backs (the same uplift evaluateOffer applies).
 const demandScale = 1 + Math.max(0, num(context.demandIncrease, 0));
 const askedSalary = Math.round(
 ((marketValue + (demand - marketValue) * (0.5 + agentPush)) * demandScale * averageGrowth(counterYears)) / 5000
 ) * 5000;
 let counterSalary = Math.max(askedSalary, Math.round(offeredAverage / 5000) * 5000);

 // Counter structure: keep the shape the club offered, nudged toward what the player
 // prefers (veterans want money sooner; everyone else is happy with an even deal).
 const preferredPreset = stageKey === "VETERAN" || age >= 30 ? STRUCTURE_PRESETS.FRONT_LOADED : STRUCTURE_PRESETS.EVEN;
 const offeredShape = getShapeWeights(getScheduleShape(offeredSchedule), counterYears);
 const preferredShape = getShapeWeights(preferredPreset, counterYears);
 const blendedShape = offeredShape.map((weight, index) => (weight + preferredShape[index]) / 2);
 let yearlySalaries = buildSalarySchedule(counterSalary, counterYears, blendedShape, { seasonYear: context.seasonYear });
 const counterStructure = describeStructure(yearlySalaries);

 // Counter role: players want the role that best fits their ability and position. Never
 // downgrade a role the club already offered, and never ask for one far above their level.
 const ability = num(player.overall, 60);
 const offeredRole = originalOffer.role ?? "BEST_22";
 const counterRole = pickCounterRole(player, offeredRole, stageKey);

 // What the player wants in the counter.
 const issues = [];
 if (offeredAverage < marketValue * 0.9) {
 issues.push(`Salary below market value (seeking ~$${demand.toLocaleString()} a year)`);
 }
 const roleObj = getRoleById(counterRole);
 if (counterRole !== offeredRole) {
 issues.push(`Wants a ${roleObj.label} role`);
 }
 if (counterYears > offeredYears) {
 issues.push(`Seeks ${counterYears}-year deal for security`);
 } else if (counterYears < offeredYears) {
 issues.push(`Prefers a shorter ${counterYears}-year deal`);
 }
 if (counterStructure === "FRONT_LOADED" && describeStructure(offeredSchedule) !== "FRONT_LOADED") {
 issues.push("Wants more of the money up front");
 }

 // A counter is the player's proposed acceptable package, so it is checked by the same
 // scoring model used for submitted offers. Salary is raised only as far as it can still
 // help, and never past a believable ceiling: money stops improving the salary rating
 // once an offer is far above market, so chasing a score with ever-bigger numbers only
 // produced absurd asks. If the player still is not satisfied at the ceiling, the counter
 // is flagged unacceptable and says what else needs to change (role, club appeal, length).
 const counterOffer = () => ({
 ...originalOffer,
 salary: counterSalary,
 yearlySalaries,
 years: counterYears,
 role: counterRole,
 });
 const ACCEPT_TARGET = 82; // just above the 80 acceptance threshold, so the player is not asking for more than needed
 let acceptance = evaluateOffer(player, counterOffer(), { ...context, deterministic: true });
 const greedFactor = clamp(num(personality.greed, 50), 0, 100) / 100;
 const ceilingPremium = COUNTER_BASE_PREMIUM + greedFactor * COUNTER_GREED_PREMIUM;
 const salaryCeiling = Math.ceil((Math.max(demand, marketValue) * demandScale * (1 + ceilingPremium) * averageGrowth(counterYears)) / 5000) * 5000;
 const maxCounterSalary = Math.max(counterSalary, Math.min(getMaximumSalary(context.seasonYear), salaryCeiling));
 let stalledSteps = 0;
 while (acceptance.score < ACCEPT_TARGET && counterSalary < maxCounterSalary && stalledSteps < 4) {
 const previousScore = acceptance.score;
 counterSalary = Math.min(maxCounterSalary, counterSalary + 5000);
 yearlySalaries = buildSalarySchedule(counterSalary, counterYears, blendedShape, { seasonYear: context.seasonYear });
 acceptance = evaluateOffer(player, counterOffer(), { ...context, deterministic: true });
 stalledSteps = acceptance.score > previousScore ? 0 : stalledSteps + 1;
 }

 // Money alone could not close the gap: the player asks for the assurances that suit them
 // (a promise or two), then the salary comes back down to the least that still works.
 const offeredPromiseIds = normalisePromiseIds(originalOffer.promises);
 let counterPromiseIds = offeredPromiseIds;
 const withPromises = (ids) => ({ ...counterOffer(), promises: ids });
 if (acceptance.score < ACCEPT_TARGET) {
 const wanted = promiseTypes
 .filter((promise) => !offeredPromiseIds.includes(promise.id))
 .map((promise) => ({ id: promise.id, bonus: scorePromises(player, [promise.id], { offeredRoleId: counterRole, careerStageKey: stageKey }).bonus }))
 .filter((promise) => promise.bonus >= 4)
 .sort((a, b) => b.bonus - a.bonus)
 .slice(0, 2);
 let trialIds = offeredPromiseIds;
 let trial = acceptance;
 for (const promise of wanted) {
 trialIds = [...trialIds, promise.id];
 trial = evaluateOffer(player, withPromises(trialIds), { ...context, deterministic: true });
 if (trial.score >= ACCEPT_TARGET) break;
 }
 if (trial.outcome === negotiationOutcomes.ACCEPT) {
 counterPromiseIds = trialIds;
 acceptance = trial;
 // With the assurances in place the player no longer needs the top-of-range salary.
 const salaryFloor = Math.max(Math.round(offeredAverage / 5000) * 5000, 5000);
 while (counterSalary - 5000 >= salaryFloor) {
 const lowerSalary = counterSalary - 5000;
 const lowerSchedule = buildSalarySchedule(lowerSalary, counterYears, blendedShape, { seasonYear: context.seasonYear });
 const lower = evaluateOffer(player, { ...withPromises(counterPromiseIds), salary: lowerSalary, yearlySalaries: lowerSchedule }, { ...context, deterministic: true });
 if (lower.score < ACCEPT_TARGET) break;
 counterSalary = lowerSalary;
 yearlySalaries = lowerSchedule;
 acceptance = lower;
 }
 }
 }
 const requestedPromises = counterPromiseIds.filter((id) => !offeredPromiseIds.includes(id));
 for (const id of requestedPromises) {
 issues.push(`Wants the promise: ${promiseTypes.find((promise) => promise.id === id)?.label ?? id}`);
 }

 const acceptable = acceptance.outcome === negotiationOutcomes.ACCEPT;
 const shortfalls = acceptable ? [] : describeCounterShortfalls(acceptance, counterSalary, maxCounterSalary);

 return {
 salary: counterSalary,
 yearlySalaries,
 years: counterYears,
 role: counterRole,
 promises: counterPromiseIds,
 issues,
 demand,
 evaluationScore: acceptance.score,
 acceptable,
 shortfalls,
 salaryCeiling: maxCounterSalary,
 };
}

// The weakest parts of an offer the player could not be talked round on, in plain words.
function describeCounterShortfalls(evaluation, salary, ceiling) {
 const b = evaluation.breakdown ?? {};
 const factors = [
 { key: "role", text: "wants a bigger or more secure playing role" },
 { key: "success", text: "is not convinced by the club's results, reputation or facilities" },
 { key: "location", text: "is unhappy with the move to this club's location" },
 { key: "relationships", text: "does not have a strong enough relationship with the coach and club" },
 { key: "security", text: "wants a different contract length" },
 ];
 const weakest = factors
 .map(({ key, text }) => ({ text, gap: Math.max(0, 70 - num(b[key]?.rating, 70)) * num(b[key]?.weight, 0) }))
 .filter((item) => item.gap > 0)
 .sort((a, b2) => b2.gap - a.gap)
 .slice(0, 2)
 .map((item) => item.text);
 if (num(b.salary?.rating, 100) < 70 && salary >= ceiling) weakest.unshift("expects more money than the club could reasonably pay");
 return weakest;
}

// --- Leave Desire system ---

export function calculateLeaveDesire(player, context = {}) {
 const personality = player.personality ?? {};
 const contract = player.contract ?? {};
 const rels = personality.relationships ?? {};

 let desire = 0;

 // Contract dissatisfaction: low salary relative to market.
 const { marketValue } = calculateMarketValue(player, { interestedClubs: context.interestedClubs ?? 1, seasonYear: context.seasonYear });
 const currentSalary = contract.salary ?? 300000;
 if (marketValue > 0) {
 const ratio = currentSalary / marketValue;
 if (ratio < 0.7) desire += 20;
 else if (ratio < 0.85) desire += 10;
 else if (ratio < 1.0) desire += 5;
 }

 // Role frustration: if being played below ability.
 if (context.currentRoleTier && player.overall) {
 const roleGap = player.overall - context.currentRoleTier;
 if (roleGap > 15) desire += 20;
 else if (roleGap > 8) desire += 10;
 }

 // Club success: players at rebuilding clubs get restless.
 const successBonus = resolveClubSuccessBonus(player.club ?? "", context.clubContext);
 if (successBonus < -5) desire += 15;
 else if (successBonus < 5) desire += 5;

 // Location: players who are unhappy living where the club is want out, in proportion
 // to how much location matters to them.
 const locationContentment = getLocationContentment(player, player.club ?? "");
 desire += (50 - locationContentment) * 0.25 * (num(personality.locationImportance, 50) / 50);

 // Coach relationship: poor relationship = higher desire to leave.
 const coachRel = clamp(num(rels.seniorCoach, 50) + num(context.clubContext?.coachRelationshipModifier, 0), 0, 100);
 desire += (50 - coachRel) * 0.3;

 // Ambition: ambitious players at weak clubs want out.
 const ambition = personality.ambition ?? 50;
 if (ambition > 60 && successBonus < 5) {
 desire += (ambition - 60) * 0.2;
 }

 // Loyalty reduces leave desire.
 const loyalty = personality.loyalty ?? 50;
 desire -= (loyalty - 50) * 0.25;

 // Broken promises.
 const brokenPromises = (context.promiseHistory ?? personality.promiseHistory ?? []).filter((p) => p.status === "BROKEN");
 desire += brokenPromises.length * 25;

 return clamp(Math.round(desire), 0, 100);
}

// Leave desire is the model's value (salary vs market, coach, club success, ...) plus
// a stored delta from events such as accepted deals, rejections and broken promises.
// Storing only the delta lets the number keep reacting to the model.
// `mood` is playerContracts[id].mood; legacy flat `leaveDesire` values are read as a
// delta against today's model value so existing saves keep their displayed number.
export function resolveLeaveDesire(player, record = {}, context = {}) {
 const base = calculateLeaveDesire(player, context);
 let delta = record.mood?.leaveDesireDelta ?? record.leaveDesireDelta;
 if (delta === undefined || delta === null) {
 delta = record.leaveDesire !== undefined && record.leaveDesire !== null ? Number(record.leaveDesire) - base : 0;
 }
 return clamp(Math.round(base + (Number(delta) || 0)), 0, 100);
}

// Returns the new mood object after changing the resolved leave desire by `change`.
export function adjustLeaveDesire(player, record = {}, change = 0, context = {}) {
 const base = calculateLeaveDesire(player, context);
 const next = clamp(resolveLeaveDesire(player, record, context) + change, 0, 100);
 return { ...(record.mood ?? {}), leaveDesireDelta: clamp(next - base, -100, 100) };
}

// Folds stored mood (relationship changes, promise history) into the player so the
// scoring functions see it. The static player data is never mutated.
export function applyMoodToPlayer(player, mood = {}) {
 const base = player.personality?.relationships ?? {};
 const relationships = { ...base };
 Object.entries(mood.relationshipDelta ?? {}).forEach(([key, value]) => {
 relationships[key] = clamp(num(base[key], 50) + num(value, 0), 0, 100);
 });
 const promiseHistory = [...(player.personality?.promiseHistory ?? []), ...(mood.promiseHistory ?? [])];
 return { ...player, personality: { ...player.personality, relationships, promiseHistory } };
}

export function getLeaveDesireLevel(leaveDesire) {
 if (leaveDesire <= 25) return { label: "Happy", color: "#22c55e" };
 if (leaveDesire <= 50) return { label: "Monitoring", color: "#f59e0b" };
 if (leaveDesire <= 75) return { label: "Open to Offers", color: "#f97316" };
 return { label: "Wants Out", color: "#ef4444" };
}

// --- Free Agency decision model ---

export function evaluateFreeAgency(player, clubOffers, context = {}) {
 if (!clubOffers || clubOffers.length === 0) return null;

 const scores = clubOffers.map((offer) => {
 const result = evaluateOffer(player, offer, {
 ...context,
 clubName: offer.clubName,
 });
 return {
 clubName: offer.clubName,
 score: result.score,
 outcome: result.outcome,
 breakdown: result.breakdown,
 offer,
 };
 });

 scores.sort((a, b) => b.score - a.score);

 return {
 rankings: scores,
 choice: scores[0] ?? null,
 };
}

// --- Promise system ---
//
// Promises live on the contract record (playerContracts[id].promises) so they persist
// with the deal. All timestamps are game time ({ seasonYear, round }), never Date.now().
// breakPromise / fulfillPromise return the CHANGES (relationship deltas, a history
// entry, leave-desire impact) to store in playerContracts[id].mood; they do not
// mutate the player.

const promiseSource = (player) => player.contract?.promises ?? player.personality?.promises ?? [];

export function createPromises(promiseIds = [], { seasonYear = null, round = null, years = 1 } = {}) {
 return normalisePromiseIds(promiseIds).map((id) => ({
 id,
 status: "ACTIVE",
 madeSeason: seasonYear,
 madeRound: round,
 dueSeason: seasonYear === null ? null : Number(seasonYear) + clamp(Math.round(years), 1, 2) - 1,
 }));
}

export function makePromise(player, promiseId, gameTime = {}) {
 const existing = promiseSource(player).filter((p) => p.id !== promiseId || p.status !== "ACTIVE");
 return { promises: [...existing, ...createPromises([promiseId], gameTime)] };
}

function closePromise(player, promiseId, status, gameTime, relationshipDelta, impacts) {
 const promises = promiseSource(player).map((p) => (p.id === promiseId && p.status === "ACTIVE" ? { ...p, status } : p));
 return {
 promises,
 promiseHistory: [{ id: promiseId, status, season: gameTime.seasonYear ?? null, round: gameTime.round ?? null }],
 relationshipDelta,
 ...impacts,
 };
}

export function breakPromise(player, promiseId, gameTime = {}) {
 // Breaking promises damages trust.
 return closePromise(player, promiseId, "BROKEN", gameTime, { seniorCoach: -20, club: -15 }, { moraleImpact: -15, leaveDesireImpact: +25 });
}

export function fulfillPromise(player, promiseId, gameTime = {}) {
 return closePromise(player, promiseId, "FULFILLED", gameTime, { seniorCoach: 10, club: 8 }, { moraleImpact: +10, leaveDesireImpact: -10 });
}

// --- Human-readable summary for the UI ---

export function summarizeEvaluation(evaluation) {
 const b = evaluation.breakdown;
 const parts = [];

 const structureNote = b.salary.structure === "FRONT_LOADED" ? " — front-loaded" : b.salary.structure === "BACK_LOADED" ? " — back-loaded" : "";
 parts.push(`Salary: ${b.salary.rating}/100 (weight ${b.salary.weight}%)${structureNote}`);
 parts.push(`Role: ${b.role.rating}/100 (weight ${b.role.weight}%)${b.role.promiseBonus ? ` incl. +${b.role.promiseBonus} from promises` : ""}`);
 parts.push(`Club Appeal: ${b.success.rating}/100 (weight ${b.success.weight}%)`);
 parts.push(`Location: ${b.location.rating}/100 (weight ${b.location.weight}%)`);
 parts.push(`Relationships: ${b.relationships.rating}/100 (weight ${b.relationships.weight}%)`);
 parts.push(`Security: ${b.security.rating}/100 (weight ${b.security.weight}%)`);

 return {
 overallScore: evaluation.score,
 outcome: evaluation.outcome,
 details: parts,
 marketValue: evaluation.marketValue,
 };
}

export function getOutcomeLabel(outcome) {
 switch (outcome) {
 case negotiationOutcomes.ACCEPT:
 return { label: "Accept", color: "#22c55e", message: "accepted the offer" };
 case negotiationOutcomes.CONSIDER:
 return { label: "Consider", color: "#3b82f6", message: "is considering the offer" };
 case negotiationOutcomes.COUNTER:
 return { label: "Counter Offer", color: "#f59e0b", message: "wants to counter-offer" };
 case negotiationOutcomes.REJECT:
 return { label: "Reject", color: "#ef4444", message: "rejected the offer" };
 default:
 return { label: "Unknown", color: "#64748b", message: "" };
 }
}