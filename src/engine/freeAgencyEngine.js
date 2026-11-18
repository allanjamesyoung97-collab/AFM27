// Free Agency Engine — handles free agent identification, recruitment, and AI competition.
// Players whose contracts expire and aren't re-signed become free agents.

import { evaluateOffer, evaluateFreeAgency, defaultRoleForPlayer } from "./negotiationEngine.js";
import { conditionalTermFields } from "./contractComponents.js";
import { calculateMarketValue, estimateSalaryDemand } from "./contractValueEngine.js";
import { getClubAttraction, getClubSuccessBonus } from "../data/clubAttraction.js";
import { getCareerClub } from "./contractEngine.js";
import { getTopPositionNeeds } from "./squadAnalysisEngine.js";
import { getMinimumSalary, getConfiguredEffectiveSalaryCap, isSalaryCapEnforced } from "./salaryCap.js";
import { getSalaryInSeason } from "./contractStructure.js";
import { projectedContractExtras } from "./contractComponents.js";
import { clubs as allClubsData } from "../data/clubs.js";

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

// The initial database has no club-service field. Estimate it from age until a
// player moves in-game; from that point clubJoinedSeason provides exact tenure.
export function getClubServiceYears(player, record = {}, seasonYear = 2027) {
 if (record.clubJoinedSeason != null && Number.isFinite(Number(record.clubJoinedSeason))) return Math.max(0, seasonYear - Number(record.clubJoinedSeason));
 if (record.clubServiceSeasons != null && Number.isFinite(Number(record.clubServiceSeasons))) return Math.max(0, Number(record.clubServiceSeasons));
 if (player.clubServiceSeasons != null && Number.isFinite(Number(player.clubServiceSeasons))) return Math.max(0, Number(player.clubServiceSeasons));
 const ageEstimate = Math.max(0, num(player.age, 18) - 18 + Math.max(0, seasonYear - 2027));
 // The existing roster files record an eligibility category for the original
 // contract. Use it at that expiry to avoid treating recent real-world moves
 // as long-serving members of their new clubs.
 if (Number(player.contract?.finalYear) === seasonYear
 && record.lastExtendedYear == null && record.signedSeason == null) {
 const status = String(player.contract?.status ?? '').toLowerCase();
 if (status.includes('non-free')) return Math.min(7, ageEstimate);
 if (status.includes('restricted') && !status.includes('unrestricted')) return Math.max(8, Math.min(9, ageEstimate));
 if (status.includes('unrestricted')) return Math.max(8, ageEstimate);
 }
 return ageEstimate;
}

export function getFreeAgencyStatus(player, contractsByPlayer = {}, allPlayers = [], options = {}) {
 const record = contractsByPlayer[String(player.id)] ?? {};
 if (record.retired || record.freeAgentResolved === true) return { type: "UNAVAILABLE" };
 const years = num(record.yearsRemaining ?? player.contract?.yearsRemaining, 2);
 const club = record.formerClub ?? getCareerClub(player, contractsByPlayer);
 const delisted = record.delistedFreeAgent === true || record.delisted === true;
 if (delisted) return { type: "DFA", club, reason: "Delisted free agent" };
 // Tasmania's expansion concession: any player who is out of contract for next season can be
 // approached directly, one per existing club. Only the Tasmania manager's screens pass this
 // option, so AI clubs never see these players as free agents.
 const concession = options.tasmaniaConcession;
 if (concession && club && club !== concession.clubName && years <= 1 && num(player.age, 18) >= 18
 && (concession.clubNames ?? []).includes(club) && !(concession.usedClubs ?? []).includes(club)
 && num(concession.remaining, 0) > 0) {
 return { type: "TAS_CONCESSION", club, reason: "Tasmania concession: out of contract after this season (one player per club)" };
 }
 if (years > 0 && !(options.includeExpiring && years === 1)) return { type: "CONTRACTED", club };
 const eligibilityYear = Number(options.eligibilityYear ?? options.seasonYear ?? 2027);
 const serviceYears = getClubServiceYears(player, record, eligibilityYear);
 // The starting lists contain the real status at each player's original
 // contract expiry. An age-based tenure estimate must not override it.
 // Extensions and club changes use the tracked tenure and wage rules below.
 const initialStatus = String(player.contract?.status ?? "").toLowerCase();
 const originalExpiry = Number(player.contract?.finalYear) === eligibilityYear
 && record.clubJoinedSeason == null && record.lastExtendedYear == null
 && record.signedSeason == null;
 if (originalExpiry) {
 if (initialStatus.includes("delisted"))
 return { type: "DFA", club, reason: "Original contract eligibility" };
 if (initialStatus.includes("non-free") || initialStatus === "unknown")
 return { type: "NON_FREE_AGENT", club, serviceYears, reason: "Original contract eligibility" };
 if (initialStatus.includes("unrestricted"))
 return { type: "UFA", club, serviceYears, reason: "Original contract eligibility" };
 if (initialStatus.includes("restricted"))
 return { type: "RFA", club, serviceYears, reason: "Original contract eligibility" };
 }
 if (serviceYears < 8) return { type: "NON_FREE_AGENT", club, serviceYears };
 if (serviceYears >= 10) return { type: "UFA", club, serviceYears, reason: "Ten or more seasons at this club" };
 const roster = allPlayers.filter(candidate => getCareerClub(candidate, contractsByPlayer) === club && candidate.id !== player.id);
 const salaries = [...roster, player].map(candidate => ({
 id: String(candidate.id),
 salary: num(contractsByPlayer[String(candidate.id)]?.salary ?? candidate.contract?.salary, 0),
 })).sort((a, b) => b.salary - a.salary || a.id.localeCompare(b.id));
 const wageRank = salaries.findIndex(candidate => candidate.id === String(player.id)) + 1;
 // AFL rules use the top nine guaranteed-pay players, not a quarter of a
 // potentially expanded list with rookies and delisted players included.
 const restricted = roster.length > 0 && wageRank > 0 && wageRank <= 9;
 return { type: restricted ? "RFA" : "UFA", club, serviceYears, wageRank,
 reason: restricted ? "Top-nine club wage earner; current club can match" : "Outside the club's top nine wage earners" };
}

// Only unrestricted, restricted and delisted free agents can sign directly.
export function getFreeAgents(allPlayers, contractsByPlayer = {}, options = {}) {
 return allPlayers
 .filter((player) => {
 const type = getFreeAgencyStatus(player, contractsByPlayer, allPlayers, options).type;
 return (options.allowedTypes ?? ["UFA", "RFA", "DFA"]).includes(type);
 })
 .map((player) => {
 const record = contractsByPlayer[String(player.id)] ?? {};
 const status = getFreeAgencyStatus(player, contractsByPlayer, allPlayers, options);
 return {
 ...player,
 club: status.type === "DFA" ? "-" : status.club,
 originalClub: status.club,
 freeAgencyStatus: status,
 contract: {
 ...player.contract,
 yearsRemaining: 0,
 salary: record.salary ?? player.contract?.salary,
 },
 };
 });
}

// An expired contract releases its player into free agency for every club.
// Keep the former club for the movement record, but remove the player from its list.
export function delistUnretainedAIExpiredPlayers(allPlayers, contractsByPlayer = {}, clubs = allClubsData, userClubName = null, seasonYear = null) {
 const contracts = { ...contractsByPlayer };
 const delisted = [];
 for (const player of allPlayers) {
 const key = String(player.id);
 const record = contracts[key] ?? {};
 const clubName = getCareerClub(player, contracts);
 const years = record.yearsRemaining ?? player.contract?.yearsRemaining;
 if (!clubName || !clubs.some((club) => club.name === clubName)) continue;
 if (record.delisted || record.retired || num(years, 2) > 0) continue;
 contracts[key] = {
 ...record,
 club: "-",
 formerClub: clubName,
 salary: 0,
 yearsRemaining: 0,
 freeAgentResolved: false,
 delistedFreeAgent: true,
 };
 delisted.push({ playerId: key, playerName: player.name, club: clubName, reason: "FREE_AGENT" });
 }
 return { contracts, delisted };
}

// Enforce the 44-player limit for AI lists after offseason signings and draft
// selections. Expired contracts are released first, followed by the lowest-rated
// and oldest remaining players. Contracted releases keep their salary obligation.
export function enforceAIClubListLimits(allPlayers, contractsByPlayer = {}, clubs = allClubsData, userClubName = null, seasonYear = null, limit = 44) {
 const contracts = { ...contractsByPlayer };
 const delisted = [];
 for (const club of clubs) {
 if (club.name === userClubName) continue;
 const roster = allPlayers.filter((player) => getCareerClub(player, contracts) === club.name);
 const year = Number(seasonYear ?? 2027);
 const tasmaniaLimit = club.name === "Tasmania"
 ? year === 2028 ? 46 : year >= 2029 && year <= 2031 ? 48 : year === 2032 ? 46 : limit
 : limit;
 const excess = roster.length - tasmaniaLimit;
 if (excess <= 0) continue;
 const candidates = [...roster].sort((a, b) => {
 const aRecord = contracts[String(a.id)] ?? {};
 const bRecord = contracts[String(b.id)] ?? {};
 const aYears = num(aRecord.yearsRemaining ?? a.contract?.yearsRemaining, 2);
 const bYears = num(bRecord.yearsRemaining ?? b.contract?.yearsRemaining, 2);
 const aOut = aYears <= 0 ? 0 : 1;
 const bOut = bYears <= 0 ? 0 : 1;
 return aOut - bOut
 || num(a.overall, 0) - num(b.overall, 0)
 || num(b.age, 25) - num(a.age, 25)
 || String(a.name).localeCompare(String(b.name));
 });
 candidates.slice(0, excess).forEach((player) => {
 const key = String(player.id);
 const record = contracts[key] ?? {};
 const years = num(record.yearsRemaining ?? player.contract?.yearsRemaining, 2);
 const outOfContract = years <= 0;
 contracts[key] = outOfContract ? {
 ...record,
 club: "-",
 formerClub: club.name,
 salary: 0,
 yearsRemaining: 0,
 freeAgentResolved: false,
 delistedFreeAgent: true,
 } : {
 ...record,
 delisted: true,
 delistedFreeAgent: true,
 formerClub: club.name,
 delistedSeason: seasonYear,
 delistedReason: limit < 44 ? "AI list prepared for draft recruitment" : "AI list reduced to the 44-player limit",
 club: club.name,
 salary: record.salary ?? player.contract?.salary ?? 0,
 yearsRemaining: years,
 };
 delisted.push({ playerId: key, playerName: player.name, club: club.name, reason: outOfContract ? "OUT_OF_CONTRACT" : "LIST_LIMIT" });
 });
 }
 return { contracts, delisted };
}

// Check if a player is a free agent
export function isFreeAgent(player, contractsByPlayer = {}, allPlayers = [], options = {}) {
 return ["UFA", "RFA", "DFA"].includes(getFreeAgencyStatus(player, contractsByPlayer, allPlayers, options).type);
}

// A restricted player's club matches only when the guaranteed payments fit
// its cap and the player is valuable enough to justify the commitment.
export function shouldMatchRestrictedOffer(player, offer, allPlayers, contractsByPlayer = {}, seasonYear = 2027, administration = {}) {
 const status = getFreeAgencyStatus(player, contractsByPlayer, allPlayers, { seasonYear, includeExpiring: true });
 if (status.type !== "RFA" || num(offer.years, 0) < 2) return false;
 const roster = allPlayers.filter(candidate => candidate.id !== player.id && getCareerClub(candidate, contractsByPlayer) === status.club);
 const payroll = roster.reduce((sum, candidate) => {
 const terms = { ...candidate.contract, ...(contractsByPlayer[String(candidate.id)] ?? {}) };
 return sum + getSalaryInSeason(terms, 0) + projectedContractExtras(terms);
 }, 0);
 const cap = getConfiguredEffectiveSalaryCap(seasonYear + 1, administration?.salaryCapBank, administration);
 if (isSalaryCapEnforced(administration) && payroll + num(offer.salary, 0) > cap) return false;
 const positionalPeers = roster.filter(candidate => (candidate.positions ?? [candidate.position]).some(position => (player.positions ?? [player.position]).includes(position)));
 const betterPeers = positionalPeers.filter(candidate => num(candidate.overall, 0) >= num(player.overall, 0)).length;
 const market = estimateSalaryDemand(player, status.club, 1, seasonYear + 1);
 return num(player.overall, 0) >= 78 && betterPeers < 2 && num(offer.salary, 0) <= market * 1.2;
}

// Compensation is based on a club's net eligible free-agent losses. Delisted
// free agents never generate a pick. The pick joins the national draft after
// the original club's selection in the relevant round.
export function calculateFreeAgencyCompensation(transactions = [], year, clubs = [], salaryCap = getConfiguredEffectiveSalaryCap(year + 1)) {
 const moves = transactions.filter(item => item.kind === 'FREE_AGENT' && Number(item.tradePeriodYear) === Number(year))
 .flatMap(item => item.playerMoves ?? [])
 .filter(move => ['UFA', 'RFA'].includes(move.freeAgencyType) && move.fromClub && move.toClub && move.fromClub !== move.toClub);
 const awards = [];
 for (const club of clubs) {
 const losses = moves.filter(move => move.fromClub === club.name).sort((a, b) => num(b.salary, 0) - num(a.salary, 0));
 const netLosses = Math.max(0, losses.length - moves.filter(move => move.toClub === club.name).length);
 losses.slice(0, netLosses).forEach((move, index) => {
 const capShare = num(move.salary, 0) / Math.max(1, salaryCap);
 const round = capShare >= 0.055 && num(move.age, 27) <= 29 ? 1 : capShare >= 0.035 ? 2 : 3;
 awards.push({ id: `${year}-COMP-${club.id ?? club.name}-${index + 1}`, year: Number(year), round,
 afterRound: round, afterClub: club.name, originalClub: club.name, currentOwner: club.name,
 compensation: true, number: null, resolved: false, playerName: move.playerName });
 });
 }
 return awards;
}

// Evaluate a free agent contract offer from the user's club.
export function evaluateFreeAgentOffer(player, offer, context = {}) {
 const evaluation = evaluateOffer(player, offer, context);
 return {
 score: evaluation.score,
 outcome: evaluation.outcome,
 breakdown: evaluation.breakdown,
 marketValue: evaluation.marketValue,
 };
}

// Generate AI competing offers for a free agent.
export function generateAIFreeAgentCompetitors(player, userClubName, seasonYear, context = {}) {
 const clubsList = context.clubs ?? allClubsData;
 const otherClubs = clubsList.filter((c) => c.name !== userClubName);

 const { marketValue } = calculateMarketValue(player, { seasonYear });
 const age = num(player.age, 25);

 // Determine how many AI clubs are interested (2-5 based on player quality)
 const playerValue = num(player.overall, 60);
 const baseInterest = playerValue >= 85 ? 5 : playerValue >= 78 ? 4 : playerValue >= 70 ? 3 : 2;

 const interested = otherClubs
 .map((club) => ({
 club,
 roll: hashUnit(`${player.id}:${club.name}:${seasonYear}:fa`),
 }))
 .filter((item) => item.roll > 0.35)
 .sort((a, b) => b.roll - a.roll)
 .slice(0, baseInterest);

 return interested.map(({ club }) => {
 const attraction = getClubAttraction(club.name, { allPlayers: context.allPlayers ?? [], playerContracts: context.playerContracts ?? {}, roundsPlayed: context.roundsPlayed });
 const successBonus = getClubSuccessBonus(club.name, { allPlayers: context.allPlayers ?? [], playerContracts: context.playerContracts ?? {}, roundsPlayed: context.roundsPlayed });

 // AI offer: salary varies around market value, adjusted for club appeal
 const appealMod = ((attraction?.premiershipWindow ?? 60) - 60) * 0.0015 + Number(successBonus ?? 0) * 0.002;
 const salaryMod = Math.max(0.85, Math.min(1.35, 0.9 + hashUnit(`${player.id}:${club.name}:${seasonYear}:faPay`) * 0.25 + appealMod));
 const years = age >= 30 ? 2 : 2 + Math.floor(hashUnit(`${player.id}:${club.name}:${seasonYear}:faYears`) * 2);

 return {
 clubName: club.name,
 salary: Math.round((marketValue * salaryMod) / 5000) * 5000,
 years,
 role: defaultRoleForPlayer(player),
 promises: [],
 };
 });
}

// Full free agency evaluation: user offer vs AI competitors.
// Returns the full ranking so the UI can show if the user won or lost.
export function evaluateFreeAgencyCompetition(player, userOffer, aiOffers, context = {}) {
 const allOffers = [userOffer, ...aiOffers];
 const result = evaluateFreeAgency(player, allOffers, context);

 const userRanking = result.rankings.find((r) => r.clubName === userOffer.clubName);
 const userWon = result.choice?.clubName === userOffer.clubName;

 return {
 rankings: result.rankings,
 userRank: result.rankings.findIndex((r) => r.clubName === userOffer.clubName) + 1,
 userScore: userRanking?.score ?? 0,
 userWon,
 winner: result.choice,
 };
}

// During rollover, AI clubs can recruit an out-of-contract player when the squad
// analysis shows a real positional shortage and there is room under the salary cap.
export function recruitAIClubFreeAgents(allPlayers, contractsByPlayer = {}, clubs = allClubsData, seasonYear = 2027, userClubName = null, administrationByClub = {}, options = {}) {
 let contracts = { ...contractsByPlayer };
 const eligibilityYear = Number(String(options.date ?? '').slice(0, 4)) || Number(seasonYear);
 const signingYear = eligibilityYear + 1;
 const signings = [];
 const matches = [];
 const pendingMatches = [];
 const positionsByNeed = {
 keyDefenders: ['KPD'], keyForwards: ['KPF'], midfielders: ['MID', 'WING'],
 rucks: ['RUC'], smallDefenders: ['HB', 'BP'], smallForwards: ['HF', 'FF'],
 };
 const bids = [];
 const available = getFreeAgents(allPlayers, contracts, { seasonYear, eligibilityYear, includeExpiring: eligibilityYear === Number(seasonYear), allowedTypes: options.allowedTypes });
 for (const club of clubs) {
 if (club.name === userClubName) continue;
 const activeRoster = allPlayers.filter(player => getCareerClub(player, contracts) === club.name);
 if (activeRoster.length >= 44) continue;
 const assessedNeeds = getTopPositionNeeds(allPlayers, club.name, contracts).filter(need => need.priority !== 'Low');
 const needs = assessedNeeds.length ? assessedNeeds : (options.recruitmentPlans?.[club.name]?.needs ?? []);
 if (!needs.length) continue;
 const payroll = activeRoster.reduce((total, player) => {
 const terms = { ...player.contract, ...(contracts[String(player.id)] ?? {}) };
 return total + getSalaryInSeason(terms, 1) + (Number(terms.yearsRemaining ?? 0) > 1 ? projectedContractExtras(terms) : 0);
 }, 0);
 const administration = administrationByClub[club.name] ?? {};
 const capRoom = isSalaryCapEnforced(administration)
 ? getConfiguredEffectiveSalaryCap(signingYear, administration.salaryCapBank, administration) - payroll
 : Number.POSITIVE_INFINITY;
 if (capRoom < getMinimumSalary(signingYear)) continue;
 const plan = options.recruitmentPlans?.[club.name];
 for (const player of available) {
 if (player.originalClub === club.name) continue;
 const positions = Array.isArray(player.positions) ? player.positions : [player.position];
 const need = needs.find(item => positions.some(position => positionsByNeed[item.category]?.includes(position)));
 if (!need) continue;
 const age = num(player.age, 25);
 const years = bidMinimumYears(player.freeAgencyStatus?.type, age <= 24 && num(player.overall, 60) >= 78 ? 3 : age >= 31 ? 1 : 2);
 const demand = estimateSalaryDemand(player, club.name, 1, signingYear);
 const planned = plan?.targets?.find(target => String(target.playerId) === String(player.id));
 const salary = Math.floor(Math.min(demand * (planned ? 1.07 : 0.98), capRoom) / 5000) * 5000;
 if (salary < getMinimumSalary(signingYear)) continue;
 const role = defaultRoleForPlayer(player);
 const verdict = evaluateOffer(player, { clubName: club.name, salary, years, role }, {
 seasonYear: signingYear, deterministic: true, allPlayers, playerContracts: contracts,
 });
 if (verdict.score < 65) continue;
 const window = getClubAttraction(club.name, { allPlayers, playerContracts: contracts }).premiershipWindow ?? 60;
 const ageFit = window < 50 ? Math.max(-10, 25 - age) : window >= 75 ? -Math.abs(age - 27) : 0;
 const clubScore = (need.priority === 'High' ? 22 : 10) + num(player.overall, 60) * 0.35 + ageFit + (planned ? 22 : 0);
 bids.push({ club: club.name, player, salary, years, role, playerScore: verdict.score, clubScore });
 }
 }
 // Players choose the best offer available; clubs sign only targets they value.
 const won = new Set();
 const filled = new Set();
 bids.sort((a, b) => b.playerScore - a.playerScore || b.clubScore - a.clubScore || hashUnit(`${options.date}:${a.club}:${a.player.id}`) - hashUnit(`${options.date}:${b.club}:${b.player.id}`));
 for (const bid of bids) {
 if (signings.length >= Number(options.maxSignings ?? 4)) break;
 if (won.has(String(bid.player.id)) || filled.has(bid.club)) continue;
 if (bid.player.freeAgencyStatus?.type === "RFA" && bid.player.originalClub === userClubName) {
 if (!(options.pendingRfaPlayerIds ?? []).includes(String(bid.player.id))) {
 pendingMatches.push({ playerId: String(bid.player.id), playerName: bid.player.name,
 originalClub: userClubName, bidderClub: bid.club, salary: bid.salary, years: bid.years, role: bid.role });
 won.add(String(bid.player.id));
 }
 continue;
 }
 if (bid.player.freeAgencyStatus?.type === "RFA" && shouldMatchRestrictedOffer(bid.player, { salary: bid.salary, years: bid.years }, allPlayers, contracts, eligibilityYear, administrationByClub[bid.player.originalClub])) {
 if (bid.player.originalClub !== userClubName) {
 const retained = reSignPlayer(bid.player, { salary: bid.salary, years: bid.years, role: bid.role,
 signedSeason: signingYear }, allPlayers, contracts);
 contracts = retained.contracts;
 matches.push({ club: bid.player.originalClub, player: bid.player.name, salary: bid.salary, years: bid.years });
 won.add(String(bid.player.id));
 }
 continue;
 }
 const signed = signFreeAgent(bid.player, bid.club, {
 salary: bid.salary, years: bid.years, role: bid.role, signedSeason: signingYear,
 }, allPlayers, contracts);
 contracts = signed.contracts;
 won.add(String(bid.player.id));
 filled.add(bid.club);
 signings.push({ club: bid.club, player: bid.player.name, playerId: bid.player.id,
 previousClub: bid.player.originalClub, freeAgencyType: bid.player.freeAgencyStatus?.type,
 age: bid.player.age, positionNeed: bid.player.positions?.[0] ?? bid.player.position, salary: bid.salary });
 }
 return { contracts, signings, matches, pendingMatches };
}

function bidMinimumYears(status, years) {
 return status === "RFA" ? Math.max(2, years) : years;
}

// Club retention: evaluate whether a club should re-sign a player before free agency.
export function shouldClubRetain(player, contractsByPlayer, clubName, context = {}) {
 const record = contractsByPlayer[String(player.id)] ?? {};
 const yearsRemaining = num(record.yearsRemaining ?? player.contract?.yearsRemaining, 2);

 if (yearsRemaining > 1) return { shouldRetain: false, reason: "Player is not in a contract year." };

 const overall = num(player.overall, 60);
 const age = num(player.age, 25);
 const attraction = getClubAttraction(clubName, context);
 const premWindow = attraction.premiershipWindow ?? 60;

 // Important players should be retained
 let importance = 0;
 if (overall >= 85) importance = 90;
 else if (overall >= 78) importance = 70;
 else if (overall >= 70) importance = 50;
 else importance = 25;

 // Rebuilding clubs prioritize young talent
 if (premWindow < 50 && age <= 23) importance += 20;
 // Contenders prioritize proven performers
 if (premWindow >= 75 && age >= 24 && age <= 30) importance += 15;
 // Veterans on rebuilding clubs are less critical
 if (premWindow < 50 && age >= 30) importance -= 20;

 const shouldRetain = importance >= 50;
 return {
 shouldRetain,
 importance: Math.max(0, Math.min(100, importance)),
 reason: shouldRetain
 ? `${clubName} should prioritise re-signing ${player.name} before free agency.`
 : `${player.name} is not a retention priority for ${clubName}.`,
 };
}

// Sign a free agent: update player's club and contract.
export function signFreeAgent(player, newClubName, contractTerms, allPlayers, contractsByPlayer = {}) {
 const prior = contractsByPlayer[String(player.id)] ?? {};
 const liability = prior.delisted && num(prior.yearsRemaining, 0) > 0 && prior.club && prior.club !== newClubName
 ? { club: prior.club, yearlySalaries: Array.from({ length: Math.ceil(prior.yearsRemaining) }, (_, offset) => getSalaryInSeason({ ...player.contract, ...prior }, offset)) }
 : prior.formerClubLiability;
 const updatedContracts = {
 ...contractsByPlayer,
 [String(player.id)]: {
 ...contractsByPlayer[String(player.id)],
 club: newClubName,
 salary: contractTerms.salary,
 yearsRemaining: contractTerms.years,
 yearlySalaries: contractTerms.yearlySalaries ?? Array.from({ length: contractTerms.years }, () => contractTerms.salary),
 role: contractTerms.role ?? "BEST_22",
 promises: contractTerms.promises ?? [],
 ...conditionalTermFields(contractTerms),
 freeAgentResolved: true,
 delisted: false,
 delistedFreeAgent: false,
 clubJoinedSeason: contractTerms.signedSeason ?? null,
 formerClubLiability: liability,
 signedSeason: contractTerms.signedSeason ?? null,
 },
 };

 return { players: allPlayers, contracts: updatedContracts };
}

// Re-sign a player with their current club before contract expiry.
export function reSignPlayer(player, contractTerms, allPlayers, contractsByPlayer = {}) {
 const updatedContracts = {
 ...contractsByPlayer,
 [String(player.id)]: {
 ...contractsByPlayer[String(player.id)],
 salary: contractTerms.salary,
 yearsRemaining: contractTerms.years,
 yearlySalaries: contractTerms.yearlySalaries ?? Array.from({ length: contractTerms.years }, () => contractTerms.salary),
 role: contractTerms.role ?? "BEST_22",
 promises: contractTerms.promises ?? [],
 freeAgentResolved: true,
 signedSeason: contractTerms.signedSeason ?? null,
 lastExtendedYear: contractTerms.signedSeason ?? null,
 },
 };

 return { players: allPlayers, contracts: updatedContracts };
}
