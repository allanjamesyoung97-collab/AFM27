// Salary is guaranteed base pay. These optional terms are standard player payments.
const amount = (value) => Number.isFinite(Number(value)) ? Math.max(0, Math.min(50_000_000, Math.round(Number(value)))) : 0;
export function normalizeContractComponents(contract = {}) {
 const match = contract.matchPayments ?? {};
 const incentives = contract.performanceIncentives ?? {};
 const trigger = contract.triggerClause ?? {};
 return {
 matchPayments: {
 perMatch: amount(match.perMatch),
 startsAfter: Math.max(0, Math.min(23, Math.floor(Number(match.startsAfter) || 0))),
 maxPaidMatches: Math.max(0, Math.min(28, Math.floor(Number(match.maxPaidMatches ?? 23) || 0))),
 },
 performanceIncentives: {
 bestAndFairestTop3: amount(incentives.bestAndFairestTop3),
 bestAndFairestTop5: amount(incentives.bestAndFairestTop5),
 bestAndFairestTop10: amount(incentives.bestAndFairestTop10),
 brownlow: amount(incentives.brownlow),
 coleman: amount(incentives.coleman),
 },
 triggerClause: {
 gamesAcrossTwoSeasons: Math.max(0, Math.min(56, Math.floor(Number(trigger.gamesAcrossTwoSeasons) || 0))),
 extraYears: trigger.gamesAcrossTwoSeasons ? 1 : 0,
 },
 };
}

export function earnedMatchPayments(contract, games) {
 const { perMatch, startsAfter, maxPaidMatches } = normalizeContractComponents(contract).matchPayments;
 return Math.max(0, Math.min(Math.floor(Number(games) || 0), maxPaidMatches) - startsAfter) * perMatch;
}

export function projectedContractExtras(contract) {
 const { matchPayments, performanceIncentives } = normalizeContractComponents(contract);
 return Math.max(0, matchPayments.maxPaidMatches - matchPayments.startsAfter) * matchPayments.perMatch
 + Math.max(performanceIncentives.bestAndFairestTop3, performanceIncentives.bestAndFairestTop5, performanceIncentives.bestAndFairestTop10)
 + performanceIncentives.brownlow + performanceIncentives.coleman;
}

export function seasonMatches(seasonState, year = seasonState?.seasonYear) {
 const matches = [
 ...(seasonState?.roundHistory ?? []).flatMap((round) => round.results ?? []),
 ...(seasonState?.wildcardResults ?? []),
 ...(seasonState?.finalsHistory ?? []).flatMap((week) => week.results ?? []),
 ];
 const seen = new Map();
 for (const match of matches) {
 if (match.seasonYear != null && Number(match.seasonYear) !== Number(year)) continue;
 const key = String(match.fixtureId ?? match.id ?? `${match.round}:${match.homeTeam}:${match.awayTeam}`);
 if (!seen.has(key) || (!seen.get(key).playerStats && match.playerStats)) seen.set(key, match);
 }
 return [...seen.values()];
}

export function gamesForPlayerInSeason(seasonState, playerId, year = seasonState?.seasonYear) {
 let games = 0;
 for (const match of seasonMatches(seasonState, year)) {
 if ([...(match.playerStats?.home ?? []), ...(match.playerStats?.away ?? [])]
 .some((row) => String(row.playerId) === String(playerId) && Number(row.timeOnGround ?? 1) > 0)) games += 1;
 }
 return games;
}

/**
 * The conditional-pay fields stored on a contract when a new deal is signed. The baselines make
 * sure games already played this season (and the season just finished, during the offseason)
 * do not count towards the new deal's match payments, incentives or trigger.
 */
export function contractSigningFields(seasonState, playerId, seasonYear = seasonState?.seasonYear) {
 const signingYear = Number(seasonYear);
 const startSeason = ["POST_SEASON", "OFFSEASON"].includes(seasonState?.phase) ? signingYear + 1 : signingYear;
 return {
 conditionalBaselineSeason: signingYear,
 conditionalBaselineGames: seasonState ? gamesForPlayerInSeason(seasonState, playerId, signingYear) : 0,
 conditionalBonusStartSeason: startSeason,
 triggerActivated: false,
 triggerSeasonsCount: 0,
 triggerGamesPreviousSeason: 0,
 triggerStartSeason: startSeason,
 };
}

const CONDITIONAL_BASELINE_KEYS = [
 "conditionalBaselineSeason", "conditionalBaselineGames", "conditionalBonusStartSeason",
 "triggerActivated", "triggerSeasonsCount", "triggerGamesPreviousSeason", "triggerStartSeason",
];

// Fields a signing or trade writes to the contract record: a new contract replaces the previous
// club's match payments, incentives and trigger outright.
export function conditionalTermFields(terms = {}) {
 const fields = { ...normalizeContractComponents(terms) };
 for (const key of CONDITIONAL_BASELINE_KEYS) fields[key] = terms[key];
 return fields;
}

export function earnedPerformanceIncentives(contract, seasonState, playerId, clubName) {
 const bonuses = normalizeContractComponents(contract).performanceIncentives;
 const homeAndAway = seasonMatches({ ...seasonState, wildcardResults: [], finalsHistory: [] });
 const totals = new Map();
 const votesByClub = new Map();
 for (const match of homeAndAway) {
 for (const row of [...(match.playerStats?.home ?? []), ...(match.playerStats?.away ?? [])]) {
 const id = String(row.playerId);
 const item = totals.get(id) ?? { goals: 0, club: row.club };
 item.goals += Number(row.goals) || 0;
 totals.set(id, item);
 }
 for (const vote of match.coachesVotes?.totals ?? []) {
 const id = String(vote.playerId);
 votesByClub.set(id, (votesByClub.get(id) ?? 0) + (Number(vote.votes) || 0));
 }
 }
 const player = totals.get(String(playerId));
 const topGoals = Math.max(0, ...[...totals.values()].map((item) => item.goals));
 const clubRanking = [...totals].filter(([, item]) => item.club === clubName)
 .filter(([id]) => (votesByClub.get(id) ?? 0) > 0)
 .sort((a, b) => (votesByClub.get(b[0]) ?? 0) - (votesByClub.get(a[0]) ?? 0))
 .map(([id]) => id);
 const clubRank = clubRanking.indexOf(String(playerId)) + 1;
 const clubBonus = clubRank > 0
 ? Math.max(
 clubRank <= 3 ? bonuses.bestAndFairestTop3 : 0,
 clubRank <= 5 ? bonuses.bestAndFairestTop5 : 0,
 clubRank <= 10 ? bonuses.bestAndFairestTop10 : 0,
 ) : 0;
 const brownlowIds = new Set((seasonState?.brownlowWinners ?? []).map((winner) => String(winner.playerId)));
 return (player && topGoals > 0 && player.goals === topGoals ? bonuses.coleman : 0)
 + clubBonus
 + (brownlowIds.has(String(playerId)) ? bonuses.brownlow : 0);
}

export function actualContractExtras(contract, seasonState, playerId, clubName) {
 const games = gamesForPlayerInSeason(seasonState, playerId);
 const baseline = Number(contract.conditionalBaselineSeason) === Number(seasonState?.seasonYear)
 ? Math.max(0, Number(contract.conditionalBaselineGames) || 0) : 0;
 // Award bonuses are settled after the season, never for a temporary lead.
 // A deal signed after the awards were decided takes effect next season.
 const awardsSettled = ["POST_SEASON", "OFFSEASON"].includes(seasonState?.phase)
 && Number(seasonState?.seasonYear) >= Number(contract.conditionalBonusStartSeason ?? 0);
 return Math.max(0, earnedMatchPayments(contract, games) - earnedMatchPayments(contract, baseline))
 + (awardsSettled ? earnedPerformanceIncentives(contract, seasonState, playerId, clubName) : 0);
}
