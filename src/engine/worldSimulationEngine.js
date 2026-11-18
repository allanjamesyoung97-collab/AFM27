import { resolveMatchStory } from "./playerConversationEngine.js";
import { decayMorale, matchMoraleDelta, nextClubMorale, recruitmentMoraleDelta, ladderMoraleDelta, HAPPINESS_SHARE_OF_MORALE_DELTA } from "./moraleEngine.js";
import { clubLeadershipQuality } from "./leadershipGroupEngine.js";
import { worldClubs } from "./competitionRegistry.js";
import { createAcademy, advanceAcademyMonth, rolloverAcademy } from "./academyEngine.js";
import { DAY_SLOTS, dayKey, localDate, addDays, addMonth, daysBetween, seededRandom, normalizeClock, nextCheckpoint, formatDay } from './simulationClock.js';
import { annualEvents, rulesForDate, isMovementWindow } from './seasonRules.js';
import { getCareerClub, advancePlayerContracts, resolveContractPromises, updateContractRecord } from './contractEngine.js';
import { getCareerPlayer, getPlayerDevelopmentForecast, getAttributeSeasonForecast, getAvailableIndividualTrainingFocuses, getIndividualTrainingAttributes } from './developmentEngine.js';
import { applyRecoveryCycle, applyMatchToPlayers, generateInjury, initializeFitnessState } from './fitnessEngine.js';
import { applyTrainingSession, assistantSetTrainingPrograms } from './trainingEngine.js';
import { advancePositionTraining } from './positionDevelopmentEngine.js';
import { simulateSeasonRound } from './seasonEngine.js';
import { resolveKnockoutTie } from './finalsResultEngine.js';
import { getWildcardMatchups, getFinalsMatchups, FINALS_WEEK_LABELS, getFinalsPrizeAwards } from './finalsEngine.js';
import { createAssistantTeamSelection, getTeamSelectionStatus, getTeamSheetRoundKey } from './teamSelectionEngine.js';
import { getFacilityBonuses, createClubAdministrationState, applyLeagueStaffRatings, calculateClubFinances, calculateBoardReview, refreshAvailableStaffPool, settleClubSalaryCap } from './clubAdministrationEngine.js';
import { advanceJobMarketDay, reviewCoachingJobsDuringSeason } from './jobMarketEngine.js';
import { generateAITradeActivity, generateAIOffersToUser } from './aiTradeEngine.js';
import { buildAIClubPlan, chooseAIClubTactics, negotiateAIExtension } from './aiClubStrategyEngine.js';
import { recruitAIClubFreeAgents, delistUnretainedAIExpiredPlayers, enforceAIClubListLimits, calculateFreeAgencyCompensation } from './freeAgencyEngine.js';
import { checkClubCommitments, getClubPlayerPayments } from './transactionRules.js';
import { getMinimumSalary } from './salaryCap.js';
import { formatDraftPick, createDraftState, createFutureDraftPicks, resolveDraftPickNumbers, processAIDraftPicks } from './draftEngine.js';
import { applyDraftDeficits } from './draftBiddingEngine.js';
import { getPlayingPosition } from './statisticsEngine.js';
import { getDifficultySettings } from './difficultyEngine.js';
import { playReservesRound } from './reservesEngine.js';
import { createMatchIncidents, resolveTribunalCase, tribunalDecision } from './tribunalEngine.js';
import { tradeEligibility, canRequestTrade } from './playerMovementRules.js';
import { capOverallAtPotential, getPlayerPotential } from './potentialRules.js';
import { getPlayersSeekingMoves } from './playersSeekingMovesEngine.js';
import { brownlowCount } from './brownlowEngine.js';
import { processListManagerExtensions } from './listManagerContractEngine.js';
import { getYearlySalaries } from './contractStructure.js';
import { assessRecruitmentFit, estimateRecruitmentFit, buildScoutingDossier, getScoutingSquad, scoutingCandidateForProspect } from './scoutingFitEngine.js';
import { nextScoutingAccuracy } from './scoutingAssignmentEngine.js';
import { signStaff, staffSigningCost, resolveStaffPoach } from './staffContractEngine.js';
import { leagueClubsForYear, tasmaniaDevils } from '../data/clubs.js';
import { createTasmaniaEntryPlayers, emptyTasmaniaLadderRow } from './tasmaniaExpansionEngine.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// Fixtures and committed reports are immutable. Reuse them between checkpoints;
// cloning every historical player-stat row on every simulated morning is quadratic.
function snapshotWorld(world) {
 const { fixture, roundHistory, finalsHistory, wildcardResults, communityResults, calendarResults, ...mutable } = world.season;
 const snapshot = structuredClone({ season: mutable, fitness: world.fitness });
 Object.assign(snapshot.season, { fixture, roundHistory, finalsHistory, wildcardResults, communityResults, calendarResults });
 return snapshot;
}

const roster = (players, season, club) => {
 const registered = Object.values(season.competitions ?? {}).find(c => c.rosters?.[club])?.rosters?.[club];
 return registered ? players.filter(p => registered.map(String).includes(String(p.id))) : players.filter(p => getCareerClub(p, season.playerContracts) === club);
};
const allPlayers = (season, context) => [...context.players, ...(season.generatedPlayers ?? []).filter(p => !context.players.some(base => String(base.id) === String(p.id)))];
function activateTasmaniaExpansion(world, context, year) {
 const season = world.season;
 const existingPlayers = allPlayers(season, context);
 const userManaged = context.userClub === tasmaniaDevils.name;
 const entry = createTasmaniaEntryPlayers(existingPlayers, season.playerContracts ?? {}, year, {
 userManaged, concessionSignings: season.expansionCareer?.concessionSignings?.length ?? 0,
 });
 const playerContracts = { ...(season.playerContracts ?? {}), ...entry.contracts };
 const compensationPicks = [];
 for (const move of entry.playerMoves) {
 const player = existingPlayers.find((candidate) => String(candidate.id) === String(move.playerId));
 if (!player) continue;
 const currentSalary = Number(playerContracts[move.playerId]?.salary ?? player.contract?.salary ?? 0);
 playerContracts[move.playerId] = {
 ...(playerContracts[move.playerId] ?? {}),
 club: tasmaniaDevils.name,
 yearsRemaining: 2,
 salary: currentSalary > 0 ? currentSalary : 250_000 + Number(player.overall ?? 60) * 8_000,
 signedSeason: year,
 expansionSigning: true,
 signingBonusOutsideCap: true,
 };
 const compensationCount = Number(player.age ?? 30) <= 27 && Number(player.overall ?? 60) >= 80 ? 2 : 1;
 for (let index = 0; index < compensationCount; index += 1) compensationPicks.push({
 id: `TAS-COMP-${year}-${move.fromClub}-${move.playerId}-${index + 1}`,
 year: 2028, round: 1, originalClub: move.fromClub, currentOwner: move.fromClub,
 number: null, resolved: false, compensation: true, afterClub: move.fromClub,
 afterRound: 1, compensationReason: `Tasmania expansion signing: ${move.playerName}`,
 });
 }
 season.generatedPlayers = [...(season.generatedPlayers ?? []), ...entry.newPlayers];
 season.playerContracts = playerContracts;
 season.tasmaniaExpansion = {
 ...entry.expansionState,
 signingBonusAllocation: { 2028: 2_500_000, 2029: 2_500_000 },
 compensationPickPolicy: "Flexible age, value and market standing; allocated to each club losing an eligible out-of-contract signing.",
 fatherSonEligibility: { tasmanianBornAFLMatches: 100, stateLeagueMatches: 200, firstNationalDrafts: 10, maximumSeasons: 30 },
 };
 if (!(season.ladder ?? []).some((row) => row.club === tasmaniaDevils.name)) season.ladder = [...(season.ladder ?? []), emptyTasmaniaLadderRow()];
 season.clubMorale = { ...(season.clubMorale ?? {}), [tasmaniaDevils.name]: 62 };
 const tasmaniaRoster = [...existingPlayers, ...entry.newPlayers]
 .filter((player) => getCareerClub(player, playerContracts) === tasmaniaDevils.name);
 // A managed Tasmania keeps the administration built for the manager (staff, sponsors, facilities).
 const administration = userManaged && season.clubAdministration ? season.clubAdministration : applyLeagueStaffRatings(
 createClubAdministrationState(tasmaniaDevils, tasmaniaRoster, year, playerContracts), tasmaniaDevils.name,
 );
 season.leagueAdministration = { ...(season.leagueAdministration ?? {}), [tasmaniaDevils.name]: administration };
 season.draftPickAssets = [...(season.draftPickAssets ?? []), ...compensationPicks];
 season.academies ??= {};
 season.academies[tasmaniaDevils.name] ??= createAcademy({ clubName: tasmaniaDevils.name, seed: `academy:Tasmania:${year}`, firstDraftYear: year, seasonYear: year, administration });
 if (season.expansionCareer) season.expansionCareer = { ...season.expansionCareer, stage: 'ENTERED', enteredSeason: year };
 Object.assign(world.fitness, initializeFitnessState(entry.newPlayers));
 // Concession signings made by a managed Tasmania need fitness records like any other squad member.
 for (const rosterPlayer of tasmaniaRoster) world.fitness[String(rosterPlayer.id)] ??= initializeFitnessState([rosterPlayer])[String(rosterPlayer.id)];
 for (const move of entry.playerMoves) world.fitness[move.playerId] ??= { fitness: 100, workload: 0, injury: null, morale: 50 };
}
function completeScoutingAssignment(season, context, pool, assignment, date) {
 const player = pool.find(item => String(item.id) === String(assignment.playerId))
 ?? (season.draftState?.availableProspects ?? []).filter(item => String(item.id) === String(assignment.playerId)).map(scoutingCandidateForProspect)[0];
 if (player) {
 const prior = season.scoutingReports?.[player.id];
 const listManager = season.clubAdministration?.staff?.find(person => person.role === 'List Manager');
 const baseAccuracy = bonusesFor(season, context.userClub, context).scoutingAccuracy;
 const accuracy = Number(assignment.targetAccuracy) || nextScoutingAccuracy(baseAccuracy, prior, listManager?.rating);
 const careerPlayer = getCareerPlayer(player, season.playerDevelopment, season.seasonYear, season.playerContracts);
 const estimatedOverall = Math.round(careerPlayer.overall + (seededRandom(`${season.calendarClock.seed}:${assignment.id}`)() - 0.5) * 12 * (1 - accuracy));
 const squad = getScoutingSquad(pool, season.playerContracts, context.userClub).map(item => getCareerPlayer(item, season.playerDevelopment, season.seasonYear, season.playerContracts));
 const fit = estimateRecruitmentFit(assessRecruitmentFit(careerPlayer, squad), accuracy, assignment.id);
 const dossier = buildScoutingDossier(careerPlayer, squad, accuracy, assignment.id, season.seasonYear, season.playerDevelopment?.[player.id]);
 const scoutingPasses = Number(assignment.scoutingPass) || Math.max(0, Number(prior?.scoutingPasses) || (prior ? 1 : 0)) + 1;
 season.scoutingReports = { ...season.scoutingReports, [player.id]: { estimatedOverall, accuracy, assessedOn: date, positions: player.positions, fit, dossier, scoutingPasses } };
 mail(season, `scout:${assignment.id}`, `Scout report · ${player.name}`, `Estimated overall ${estimatedOverall}. Positions: ${player.positions?.join('/')}. Assessment confidence: ${Math.round(accuracy * 100)}%. Tactical ratings carry an approximate ±${fit?.margin ?? 0} point margin.\n${fit?.summary ?? ''}`);
 }
 assignment.completed = true;
 assignment.completedOn = date;
}
export function fixtureId(match, season) {
 return match.id ?? `${season.seasonYear}:${match.stage ?? 'LEAGUE'}:${match.code ?? match.round}:${match.homeTeam ?? match.home}:${match.awayTeam ?? match.away}`;
}
export function seasonFixtures(season) {
 const additional = Object.values(season.competitions ?? {}).filter(c => !c.completed).flatMap(c => (c.fixture ?? []).flatMap(r => (r.matches ?? []).map(m => ({ ...m, stage: 'STATE_LEAGUE', competitionId: c.id, round: r.round }))));
 if (['OFFSEASON', 'POST_SEASON'].includes(season.phase)) return additional.map(m => ({ ...m, date: dayKey(m.date) })).sort((a, b) => a.date.localeCompare(b.date));
 const regular = (season.fixture ?? []).flatMap(round => (round.matches ?? []).map(match => ({ ...match, round: round.round, stage: 'LEAGUE' })));
 const finals = season.phase === 'WILDCARD' ? getWildcardMatchups(season.ladder, season.fixture)
 : season.phase === 'FINALS' ? getFinalsMatchups(season) : [];
 const community = season.phase === 'PRESEASON' ? season.communityFixtures ?? [] : [];
 return [...regular, ...finals, ...community, ...additional].map(match => ({ ...match, id: fixtureId(match, season), date: dayKey(match.date) }))
 .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}
export function hasResult(season, match) {
 const id = fixtureId(match, season);
 if (season.calendarResults?.[id]) return true;
 const results = [...(season.roundHistory ?? []).flatMap(r => r.results ?? []), ...(season.wildcardResults ?? []), ...(season.finalsHistory ?? []).flatMap(w => w.results ?? []), ...(season.communityResults ?? []), ...Object.values(season.competitions ?? {}).flatMap(c => c.results ?? [])];
 return results.some(r => (r.fixtureId ?? r.id) === id || ((r.homeTeam ?? r.home) === (match.homeTeam ?? match.home)
 && (r.awayTeam ?? r.away) === (match.awayTeam ?? match.away) && r.date && dayKey(r.date) === dayKey(match.date)));
}
export function nextUserFixture(season, club) {
 return seasonFixtures(season).find(m => !hasResult(season, m) && [m.homeTeam ?? m.home, m.awayTeam ?? m.away].includes(club));
}
function mail(season, id, title, detail, type = 'CALENDAR_EVENT', extra = {}) {
 if ((season.mailMessages ?? []).some(item => item.id === id)) return;
 season.mailMessages = [...(season.mailMessages ?? []), { id, type, subject: title, summary: detail.split('\n')[0], detail, date: formatDay(season.calendarClock.date), receivedAt: `${season.calendarClock.date}T12:00:00`, ...extra }];
}
function decision(season, event) {
 const events = season.calendarDecisions ?? [];
 if (!events.some(e => e.id === event.id)) season.calendarDecisions = [...events, { status: 'PENDING', created: season.calendarClock.date, ...event }];
}
function delegated(event, context) {
 const key = { CONTRACT_RESPONSE: 'contractRenewals', TRADE_RESPONSE: 'tradeNegotiations', INJURY: 'injuryManagement', STAFF_APPROVAL: 'administrativeDuties' }[event.type];
 return Boolean(context.delegation?.[key] || context.delegation?.[event.type.toLowerCase()]);
}
export function pendingDecisions(season, context) {
 const date = season.calendarClock?.date;
 return (season.calendarDecisions ?? []).filter(event => {
 // Staff appointments are now negotiated directly from Administration → Staff.
 // Hide legacy approval prompts retained in existing saves.
 if (event.type === 'STAFF_APPROVAL') return false;
 if (event.created > date) return false;
 if (event.status !== 'PENDING' || (event.deferUntil && event.deferUntil > date)) return false;
 if (event.type === 'TRADE_RESPONSE' && season.aiTradeOfferResponses?.[event.offerId]) return false;
 if (['INJURY', 'CONTRACT_RESPONSE'].includes(event.type) && (season.playerContracts?.[event.playerId]?.retired || season.playerContracts?.[event.playerId]?.delisted)) return false;
 if (event.type === 'INJURY' && !context.fitness?.[event.playerId]?.injury?.weeksRemaining) return false;
 if (event.type === 'CONTRACT_RESPONSE') {
 const decisionYear = Number(String(event.created ?? '').slice(0, 4));
 const contract = season.playerContracts?.[event.playerId] ?? {};
 const yearsRemaining = Number(contract.yearsRemaining ?? event.contractYearsRemaining);
 // Contract talks may open during the final season, but an offseason date
 // in the prior year is still roughly twelve months before expiry.
 if (decisionYear !== Number(season.seasonYear) || !Number.isFinite(yearsRemaining) || yearsRemaining > 1) return false;
 if (JSON.stringify(contract) !== event.contractVersion) return false;
 }
 return !delegated(event, context);
 }).sort((a, b) => a.deadline.localeCompare(b.deadline) || a.id.localeCompare(b.id));
}
export function resolveCalendarDecision(season, id, action = 'ACKNOWLEDGE') {
 const date = season.calendarClock.date;
 let clubAdministration = season.clubAdministration;
 const event = (season.calendarDecisions ?? []).find(e => e.id === id);
 if (event?.type === 'RFA_MATCH' && action !== 'DEFER') {
 if (action !== 'DECLINE' && event.canMatch === false) return season;
 const record = season.playerContracts?.[event.playerId] ?? {};
 const matching = action !== 'DECLINE';
 const nextRecord = { ...record, club: matching ? event.originalClub : event.bidderClub,
 salary: event.salary, yearsRemaining: event.years,
 yearlySalaries: Array.from({ length: event.years }, () => event.salary),
 role: event.role, signedSeason: Number(date.slice(0, 4)) + 1,
 ...(matching ? {} : { clubJoinedSeason: Number(date.slice(0, 4)) + 1 }),
 freeAgentResolved: true };
 return { ...season, playerContracts: { ...season.playerContracts, [event.playerId]: nextRecord },
 calendarDecisions: (season.calendarDecisions ?? []).map(item => item.id === id ? { ...item, status: 'RESOLVED', resolvedOn: date, outcome: matching ? 'MATCHED' : 'DECLINED' } : item),
 tradePeriodTransactions: matching ? season.tradePeriodTransactions : [...(season.tradePeriodTransactions ?? []), {
 id: `fa:${date}:${event.playerId}`, tradePeriodYear: Number(date.slice(0, 4)), date, week: 2,
 kind: 'FREE_AGENT', playerMoves: [{ playerId: event.playerId, playerName: event.playerName,
 fromClub: event.originalClub, toClub: event.bidderClub, freeAgent: true, freeAgencyType: 'RFA', salary: event.salary }], pickMoves: [] }] };
 }
 if (event?.type === 'STAFF_APPROVAL' && action === 'ACKNOWLEDGE') {
 const replacement = clubAdministration?.staff?.find(p => p.id === event.replaceId);
 if (!clubAdministration || Number(clubAdministration.cashBalance ?? 0) < Number(event.candidate.salary ?? 0) * 3) return season;
 const signed = signStaff(event.candidate, Number(event.candidate.salary ?? 0), 2, date);
 const payout = replacement ? Number(replacement.salary ?? 0) * 0.5 : 0;
 clubAdministration = { ...clubAdministration,
 staff: replacement ? clubAdministration.staff.map(person => person.id === event.replaceId ? signed : person) : [...(clubAdministration.staff ?? []), signed],
 staffPool: [...(clubAdministration.staffPool ?? clubAdministration.availableStaff ?? []).filter(person => person.id !== signed.id), ...(replacement ? [{ ...replacement, contractYearsRemaining: 0, marketOrigin: 'released' }] : [])],
 availableStaff: (clubAdministration.staffPool ?? clubAdministration.availableStaff ?? []).filter(person => person.id !== signed.id),
 cashBalance: Number(clubAdministration.cashBalance ?? 0) - payout - staffSigningCost(signed),
 };
 }
 return { ...season, clubAdministration,
 ...(event?.type === 'STAFF_APPROVAL' && action === 'ACKNOWLEDGE' && clubAdministration
 ? { leagueAdministration: { ...(season.leagueAdministration ?? {}), [season.managerClubName]: clubAdministration } }
 : {}),
 calendarDecisions: (season.calendarDecisions ?? []).map(event => event.id !== id ? event : {
 ...event, ...(action === 'DEFER' && date < event.deadline ? { deferUntil: addDays(date, Math.min(7, daysBetween(date, event.deadline))) } : { status: action === 'DECLINE' ? 'DECLINED' : 'RESOLVED', resolvedOn: date }),
 }), aiTradeOfferResponses: action === 'DECLINE' ? { ...(season.aiTradeOfferResponses ?? {}), ...Object.fromEntries((season.calendarDecisions ?? []).filter(e => e.id === id && e.offerId).map(e => [e.offerId, 'DECLINED'])) } : season.aiTradeOfferResponses };
}
export function calendarEventsForWorld(season, context) {
 const date = season.calendarClock?.date ?? context.date;
 const club = context.userClub;
 const fixtures = seasonFixtures(season);
 const events = fixtures.filter(match => [match.homeTeam ?? match.home, match.awayTeam ?? match.away].includes(club)).map(match => ({
 id: match.id, type: 'MATCH', date: localDate(match.date), title: `${match.homeTeam ?? match.home} vs ${match.awayTeam ?? match.away}`,
 description: `${match.label ?? `Round ${match.round}`} · ${match.venue ?? 'Venue TBC'}`, mandatory: true, resolved: hasResult(season, match), data: { match }, round: match.round,
 }));
 if (season.brownlowCountReady) events.push({
 id: `brownlow-count:${season.seasonYear}`, type: 'BROWNLOW_COUNT', date: localDate(season.brownlowCountDate ?? date),
 title: `Brownlow Medal count · ${season.seasonYear}`, description: 'Reveal the home-and-away umpire votes before the Grand Final.',
 mandatory: !season.brownlowCountCompleted, resolved: Boolean(season.brownlowCountCompleted), screen: 'STATISTICS', tab: 'BROWNLOW',
 });
 const year = Number(date.slice(0, 4));
 for (const y of [year, year + 1]) for (const event of annualEvents(season, `${y}-01-01`)) {
 events.push({ ...event, date: localDate(event.date), description: event.title, resolved: event.resolved || (season.resolvedCalendarEventIds ?? []).includes(event.id) });
 }
 for (let offset = 0; offset < 35; offset++) {
 const key = addDays(date, offset);
 const category = trainingForDate(season, fixtures, club, key, context);
 if (category) events.push({ id: `training:${club}:${key}`, type: 'TRAINING', date: localDate(key), title: category.replaceAll('_', ' '), description: 'Scheduled around fixtures and recovery', delegated: context.assistantTraining, data: { category: { id: category } } });
 }
 for (const event of pendingDecisions(season, context)) events.push({ ...event, date: localDate(event.created), mandatory: event.type !== 'STAFF_APPROVAL', resolved: false, description: event.reason });
 return events.sort((a, b) => a.date - b.date || a.id.localeCompare(b.id));
}
export function resolveContinueTarget(season, command, context) {
 const date = season.calendarClock.date;
 if (command instanceof Date || /^\d{4}-\d{2}-\d{2}$/.test(String(command))) return dayKey(command);
 if (command === 'WEEK') return addDays(date, 7);
 if (command === 'MONTH') return addMonth(date);
 const events = calendarEventsForWorld(season, context).filter(e => !e.resolved && dayKey(e.date) > date && e.type !== 'TRAINING');
 if (command === 'MATCH') return nextUserFixture(season, context.userClub)?.date ?? addDays(date, 1);
 if (command === 'TRADE') return events.find(e => e.id.startsWith('trade-open')) ? dayKey(events.find(e => e.id.startsWith('trade-open')).date) : addDays(date, 1);
 if (command === 'DRAFT') {
 const years = [Number(date.slice(0, 4)), Number(date.slice(0, 4)) + 1];
 return years.map(year => rulesForDate(season, `${year}-01-01`).nationalDraft).find(day => day > date) ?? addDays(date, 1);
 }
 if (command === 'SEASON_END') return addDays((season.fixture ?? []).flatMap(r => r.matches ?? []).map(m => dayKey(m.date)).sort().at(-1) ?? date, 42);
 if (command === 'EVENT' || (command === 'CONTINUE' && context.mode !== 'DAILY')) return events[0] ? dayKey(events[0].date) : addDays(date, 1);
 return addDays(date, 1);
}
function trainingForDate(season, fixtures, club, date, context) {
 if (context.userClub === club && !context.assistantTraining) return context.trainingSchedule?.find(s => dayKey(s.date) === date)?.categoryId ?? null;
 const own = fixtures.filter(m => [m.homeTeam ?? m.home, m.awayTeam ?? m.away].includes(club));
 const previous = own.filter(m => m.date < date).at(-1);
 const next = own.find(m => m.date >= date);
 if (next?.date === date) return null;
 if (previous && daysBetween(previous.date, date) <= 2) return daysBetween(previous.date, date) === 1 ? 'RECOVERY' : 'MATCH_REVIEW';
 const daysToMatch = next ? daysBetween(date, next.date) : 99;
 const likelyPlayers = (context.players ?? []).filter(p => p.club === club && !context.fitness?.[p.id]?.injury?.weeksRemaining)
 .sort((a, b) => Number(b.overall ?? 0) - Number(a.overall ?? 0)).slice(0, 23);
 const atRisk = likelyPlayers.filter(p => Number(context.fitness?.[p.id]?.fitness ?? 100) + Math.max(0, daysToMatch - 1) * 2 < 80).length;
 if (daysToMatch <= 3 && likelyPlayers.length && atRisk >= Math.max(3, Math.ceil(likelyPlayers.length * 0.2))) return 'RECOVERY';
 if (daysToMatch === 1) return 'SET_PLAYS';
 if (daysToMatch === 2) return 'CAPTAINS_RUN';
 if (season.phase === 'OFFSEASON' && date < rulesForDate(season, date).preseasonReturn) return null;
 const dow = localDate(date).getDay();
 if (daysToMatch <= 5 && dow === 2) return atRisk ? 'MATCH_REVIEW' : 'SKILLS';
 return ({ 1: 'SKILLS', 2: 'FITNESS', 3: 'DEFENSIVE_STRUCTURE', 4: 'BALL_MOVEMENT', 5: 'RECOVERY' })[dow] ?? null;
}
export function initializeWorld(season, fitness, context) {
 const result = structuredClone({ season, fitness });
 result.season.calendarClock = normalizeClock(season.calendarClock, context.date ?? '2026-10-01');
 result.season.calendarResults ??= {};
 result.season.calendarDecisions ??= [];
 result.season.leagueAdministration ??= {};
 result.season.calendarJobs ??= {};
 result.season.calendarUsage ??= {};
 result.season.academies ??= {};
 if (Number(result.season.seasonYear ?? 2027) >= 2028 && !result.season.tasmaniaExpansion?.activated) {
 const year = Number(result.season.seasonYear);
 const hasTasmania = (result.season.fixture ?? []).some(round => (round.matches ?? []).some(match =>
 [match.homeTeam ?? match.home, match.awayTeam ?? match.away].includes(tasmaniaDevils.name)));
 if (!hasTasmania && !(result.season.roundHistory ?? []).length && context.makeFixture) {
 result.season.fixture = context.makeFixture(year);
 result.season.communityFixtures = [];
 result.season.communityResults = [];
 }
 activateTasmaniaExpansion(result, context, year);
 }
 for (const club of context.leagueClubs ?? context.clubs) {
 result.season.academies[club.name] ??= createAcademy({
 clubName: club.name,
 seed: `academy:${club.name}:${result.season.seasonYear ?? 2027}`,
 firstDraftYear: Number(result.season.seasonYear ?? 2027),
 seasonYear: Number(result.season.seasonYear ?? 2027),
 administration: club.name === context.userClub ? result.season.clubAdministration : result.season.leagueAdministration[club.name],
 });
 }
 result.season.moraleRosterSnapshot ??= moralePlayerSnapshot(allPlayers(result.season, context), result.season);
 for (const club of context.clubs) result.season.leagueAdministration[club.name] ??= club.name === context.userClub
 ? structuredClone(season.clubAdministration ?? createClubAdministrationState(club, roster(context.players, season, club.name), season.seasonYear))
 : applyLeagueStaffRatings(createClubAdministrationState(club, roster(context.players, season, club.name), season.seasonYear), club.name);
 return result;
}
function administrationFor(season, club, context) {
 return club === context.userClub ? season.clubAdministration ?? season.leagueAdministration[club] : season.leagueAdministration[club];
}
function bonusesFor(season, club, context) {
 const admin = administrationFor(season, club, context);
 return getFacilityBonuses(admin?.facilities, admin?.staff);
}
function setAdministration(season, club, admin, context) {
 season.leagueAdministration[club] = admin;
 if (club === context.userClub) season.clubAdministration = admin;
}
function changePlayerMorale(season, fitness, playerId, delta, reason, date) {
 const id = String(playerId);
 const current = Number(fitness[id]?.morale ?? 50);
 const next = clamp(current + Number(delta ?? 0), 0, 100);
 fitness[id] = { ...(fitness[id] ?? {}), morale: next };
 const prior = season.playerDevelopment?.[id] ?? {};
 const happiness = clamp(Number(prior.happiness ?? 50) + (next - current) * HAPPINESS_SHARE_OF_MORALE_DELTA, 0, 100);
 season.playerDevelopment = { ...(season.playerDevelopment ?? {}), [id]: {
 ...prior, happiness,
 moraleEvents: [...(prior.moraleEvents ?? []), { date, reason, delta: Number((next - current).toFixed(2)), morale: Number(next.toFixed(2)) }].slice(-12),
 } };
}
function moralePlayerSnapshot(players, season) {
 return players.map(player => ({
 id: String(player.id),
 name: player.name,
 club: getCareerClub(player, season.playerContracts),
 overall: Number(season.playerDevelopment?.[String(player.id)]?.overall ?? player.overall ?? 50),
 positions: player.positions ?? (player.position ? [player.position] : []),
 }));
}
function applyRecruitmentMorale(season, fitness, players, date) {
 const previous = new Map((season.moraleRosterSnapshot ?? []).map(player => [String(player.id), player]));
 const current = moralePlayerSnapshot(players, season);
 const recruitsByClub = new Map();
 for (const player of current) {
 if (!player.club) continue;
 const before = previous.get(player.id);
 if (before?.club === player.club) continue;
 recruitsByClub.set(player.club, [...(recruitsByClub.get(player.club) ?? []), player]);
 }
 for (const [club, recruits] of recruitsByClub) {
 const rosterNow = current.filter(player => player.club === club);
 for (const recruit of recruits) {
 const overlapping = rosterNow.filter(player => player.id !== recruit.id
 && player.positions.some(position => recruit.positions.includes(position)));
 let strongestReaction = null;
 for (const incumbent of overlapping) {
 const delta = recruitmentMoraleDelta(incumbent, recruit);
 if (delta) changePlayerMorale(season, fitness, incumbent.id, delta, `New ${recruit.positions[0] ?? 'position'} recruit: ${players.find(p => String(p.id) === recruit.id)?.name ?? 'teammate'}`, date);
 if (!strongestReaction || delta < strongestReaction.delta) strongestReaction = { incumbent, delta };
 }
 const top23 = [...rosterNow].sort((a, b) => b.overall - a.overall).slice(0, 23);
 const strengthensSide = top23.some(player => player.id === recruit.id);
 changePlayerMorale(season, fitness, recruit.id, strengthensSide ? 1 : 0.25, strengthensSide ? 'Joined as a senior-list upgrade' : 'Joined the club', date);
 if (strengthensSide) season.clubMorale = { ...(season.clubMorale ?? {}), [club]: clamp(Number(season.clubMorale?.[club] ?? 50) + 0.35, 0, 100) };
 if (club === season.managerClubName && strongestReaction) {
 const recruitName = players.find(player => String(player.id) === recruit.id)?.name ?? 'the new signing';
 const id = `recruitment-reaction:${date}:${recruit.id}:${strongestReaction.incumbent.id}`;
 season.chatMessages ??= [];
 if (!season.chatMessages.some(message => message.id === id)) season.chatMessages.push({
 id, type: 'PLAYER_REQUEST', requestKind: 'RECRUITMENT_REACTION', status: 'PENDING',
 playerId: strongestReaction.incumbent.id, sender: players.find(player => String(player.id) === strongestReaction.incumbent.id)?.name ?? 'A teammate',
 date, subject: 'Reaction to a new teammate',
 body: `${recruitName} has joined the club and plays ${recruit.positions.join('/')} too. How would you like to respond to ${strongestReaction.incumbent.name ?? 'the player'}'s concerns about competition for a place?`,
 responseOptions: [{ value: 'WELCOME_RECRUIT', label: 'Welcome the competition' }, { value: 'DISMISS_RECRUITMENT_CONCERN', label: 'Dismiss their concern' }],
 });
 }
 }
 }
 season.moraleRosterSnapshot = current;
}
function reviewLadderMorale(season, fitness, date) {
 if (localDate(date).getDay() !== 1 || Number(season.round ?? 0) < 3 || season.moraleLadderReviewDate === date) return;
 const clubs = season.ladder ?? [];
 for (const [index, row] of clubs.entries()) {
 const rank = index + 1;
 const expected = Number(season.clubRecruitmentPlans?.[row.club]?.expectedRank ?? (clubs.length + 1) / 2);
 const delta = ladderMoraleDelta(rank, expected);
 if (!delta) continue;
 season.clubMorale = { ...(season.clubMorale ?? {}), [row.club]: clamp(Number(season.clubMorale?.[row.club] ?? 50) + delta, 0, 100) };
 for (const player of season.moraleRosterSnapshot ?? []) if (player.club === row.club) {
 changePlayerMorale(season, fitness, player.id, delta * 0.4, `Ladder standing ${rank}${rank === 1 ? 'st' : rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th'} vs expected ${expected}`, date);
 }
 }
 season.moraleLadderReviewDate = date;
}
function morning(world, context) {
 const s = world.season, date = s.calendarClock.date;
 // Dismiss staff approval prompts created by older versions so they do not
 // reappear in a later save or get handled as legacy calendar decisions.
 s.calendarDecisions = (s.calendarDecisions ?? []).map(event => event.type === 'STAFF_APPROVAL' && event.status === 'PENDING'
 ? { ...event, status: 'DISMISSED', resolvedOn: date }
 : event);
 const pool = allPlayers(s, context);
 s.playerDevelopment = { ...(s.playerDevelopment ?? {}) };
 const fixtures = seasonFixtures(s);
 const rules = rulesForDate(s, date);
 s.clubMorale = Object.fromEntries((context.leagueClubs ?? context.clubs).map(club => [club.name,
 decayMorale(s.clubMorale?.[club.name] ?? 50, 0.01)]));
 applyRecruitmentMorale(s, world.fitness, pool, date);
 reviewLadderMorale(s, world.fitness, date);
 if (date.endsWith('-01-01')) {
 s.academies = Object.fromEntries(Object.entries(s.academies ?? {}).map(([clubName, academy]) => [clubName,
 rolloverAcademy(academy, { year: Number(date.slice(0, 4)), seed: `${s.calendarClock.seed}:${clubName}`, administration: administrationFor(s, clubName, context) })]));
 }
 const nextDate = addDays(date, 1);
 if (date.slice(0, 7) !== nextDate.slice(0, 7) && !s.calendarJobs[`academies:${date}`]) {
 s.academies = Object.fromEntries(Object.entries(s.academies ?? {}).map(([clubName, academy]) => [clubName,
 advanceAcademyMonth(academy, { date, seed: s.calendarClock.seed, administration: administrationFor(s, clubName, context) })]));
 s.calendarJobs[`academies:${date}`] = true;
 }
 const supplementary = date === rules.rookieDraft && s.draftState?.completed ? 'ROOKIE'
 : date === rules.midSeasonDraft && s.seasonHasStarted && s.draftState?.completed ? 'MID_SEASON' : null;
 if (supplementary && !s.calendarJobs[`intake:${supplementary}:${date}`]) {
 const draftYear = Number(date.slice(0, 4));
 const draft = createDraftState({ draftYear, ladder: s.ladder, clubs: context.leagueClubs ?? context.clubs, existingNames: pool.map(p => p.name), playerPool: pool });
 const priorityCount = supplementary === "ROOKIE" && draftYear === 2027 ? 3 : supplementary === "MID_SEASON" && draftYear === 2028 ? 1 : 0;
 const ordinaryClubs = (context.leagueClubs ?? context.clubs).filter((club) => club.name !== tasmaniaDevils.name);
 const priorityOwners = Array(priorityCount).fill(tasmaniaDevils.name);
 const pickOwners = [...priorityOwners, ...draft.draftOrder.filter((clubName) => clubName !== tasmaniaDevils.name).slice(0, ordinaryClubs.length)];
 s.previousDraftState = s.draftState;
 s.draftState = { ...draft, kind: supplementary, totalPicks: pickOwners.length, pickOwners,
 pickMeta: pickOwners.map((owner, index) => ({ id: `${supplementary}-${draftYear}-${index + 1}`, owner, originalClub: owner, round: 1, traded: false, expansionConcession: owner === tasmaniaDevils.name })),
 availableProspects: draft.availableProspects.map(p => ({ ...p, connection: null, id: `${supplementary}:${p.id}`, overall: Math.min(68, p.overall), potential: Math.min(84, p.potential) })) };
 s.calendarJobs[`intake:${supplementary}:${date}`] = true;
 }
 if ((date === addDays(rules.nationalDraft, -7) || supplementary) && !s.calendarJobs[`draft-lists:${date}`]) {
 // Vacancies follow owned selections and list needs. Salary obligations survive contracted releases.
 let contracts = delistUnretainedAIExpiredPlayers(pool, s.playerContracts, context.clubs, context.userClub, s.seasonYear).contracts;
 for (const club of context.clubs.filter(c => c.name !== context.userClub)) {
 const owned = (s.draftPickAssets ?? []).filter(p => p.currentOwner === club.name && Number(p.year) === Number(s.draftState?.draftYear) && p.round <= 3).length;
 const vacancies = supplementary ? 0 : Math.min(3, owned);
 contracts = enforceAIClubListLimits(pool, contracts, [club], context.userClub, s.seasonYear, rules.listLimit - vacancies).contracts;
 }
 s.playerContracts = contracts; s.calendarJobs[`draft-lists:${date}`] = true;
 }
 s.calendarSelectionFixtureId = nextUserFixture(s, context.userClub)?.id ?? null;
 const recovered = new Set();
 for (const club of context.clubs) {
 const players = roster(pool, s, club.name).filter(p => !recovered.has(String(p.id)));
 players.forEach(p => recovered.add(String(p.id)));
 const bonuses = bonusesFor(s, club.name, context);
 // Recovery belongs to the elapsed overnight interval, never to a screen handoff.
 if (s.calendarClock.daysProcessed > 0 || s.calendarClock.revision > 0) world.fitness = applyRecoveryCycle(players, world.fitness, 1, 0, { ...bonuses, postMatchFitnessRestoration: 0 });
 for (const player of players) {
 const id = String(player.id), fitness = world.fitness[id] ?? { fitness: 100, workload: 0, trainingProgram: 'FULL_TRAINING' };
 world.fitness[id] = { ...fitness, morale: decayMorale(fitness.morale) };
 const injury = world.fitness[id].injury;
 if (club.name === context.userClub && injury?.weeksRemaining > 0 && !injury.calendarNotified) {
 world.fitness[id] = { ...world.fitness[id], injury: { ...injury, calendarNotified: true } };
 mail(s, `medical:${id}:${date}`, `Medical update · ${player.name}`, `${injury.name}: approximately ${injury.weeksRemaining} weeks. The player is unavailable until medically cleared.`, 'INJURY_UPDATE');
 if (injury.weeksRemaining >= 4) decision(s, { id: `treatment:${id}:${date}`, type: 'INJURY', playerId: id, title: `Review treatment · ${player.name}`, reason: `${injury.name}. Approve a rehabilitation program.`, deadline: addDays(date, 2), screen: 'INJURY_LIST' });
 }
 const record = s.playerContracts?.[id] ?? {};
 if (club.name === context.userClub && date.endsWith('10-24')
 && Number(date.slice(0, 4)) === Number(s.seasonYear)
 && Number(record.yearsRemaining ?? player.contract?.yearsRemaining) <= 1) {
 decision(s, { id: `contract:${id}:${date}`, type: 'CONTRACT_RESPONSE', playerId: id, contractVersion: JSON.stringify(record), contractYearsRemaining: Number(record.yearsRemaining ?? player.contract?.yearsRemaining), title: `Contract decision · ${player.name}`, reason: 'Review retention before contract expiry and draft list lodgement.', deadline: rulesForDate(s, date).contractExpiry, screen: 'SQUAD' });
 }
 }
 const match = fixtures.find(m => m.date >= date && [m.homeTeam ?? m.home, m.awayTeam ?? m.away].includes(club.name) && !hasResult(s, m));
 if (club.name === context.userClub && match) {
 const gap = daysBetween(date, match.date);
 if ([7, 5, 3, 1].includes(gap)) {
 const available = players.filter(p => !world.fitness[p.id]?.injury?.weeksRemaining);
 const tired = available.filter(p => Number(world.fitness[p.id]?.fitness ?? 100) < 80);
 mail(s, `preparation:${match.id}:${gap}`, `${gap} day${gap === 1 ? '' : 's'} to match · ${match.homeTeam ?? match.home} v ${match.awayTeam ?? match.away}`,
 `${available.length} available, ${players.length - available.length} injured; ${tired.length} players below 80% fitness.\n${gap === 1 ? 'Final medical checks and team confirmation are due before the first bounce.' : 'Training and recovery have been scheduled around this fixture.'}\n${tired.length ? `Consider managed minutes for ${tired.slice(0, 3).map(p => p.name).join(', ')}.` : 'No player has crossed the low-fitness threshold.'}`);
 }
 }
 }
 // Negotiations advance on the world clock, including when Recruitment is closed.
 s.calendarDecisions = s.calendarDecisions.map(e => e.status === 'PENDING' && date > e.deadline ? { ...e, status: 'EXPIRED' } : e);
 for (const offer of s.pendingAITradeOffers ?? []) if (offer.deadline < date && !s.aiTradeOfferResponses?.[offer.id]) s.aiTradeOfferResponses = { ...s.aiTradeOfferResponses, [offer.id]: 'EXPIRED' };
}
function preparation(world, context) {
 const s = world.season, date = s.calendarClock.date, pool = allPlayers(s, context), fixtures = seasonFixtures(s);
 s.playerDevelopment = { ...(s.playerDevelopment ?? {}) };
 const trained = new Set();
 for (const club of context.clubs) {
 const players = roster(pool, s, club.name).filter(p => !trained.has(String(p.id))).map(p => getCareerPlayer(p, s.playerDevelopment, s.seasonYear, s.playerContracts));
 players.forEach(p => trained.add(String(p.id)));
 const bonuses = bonusesFor(s, club.name, context);
 const nextMatch = fixtures.find(m => m.date >= date && [m.homeTeam ?? m.home, m.awayTeam ?? m.away].includes(club.name));
 const daysToMatch = nextMatch ? daysBetween(date, nextMatch.date) : 99;
 const delegated = club.name !== context.userClub || context.assistantTraining;
 if (delegated) {
 const topPlayerIds = players.slice().sort((a, b) => Number(b.overall ?? 0) - Number(a.overall ?? 0)).slice(0, 23).map(p => String(p.id));
 const matchSquadNames = club.name === context.userClub ? Object.values(context.selection?.selectedSide ?? {}).filter(Boolean) : [];
 world.fitness = assistantSetTrainingPrograms(players, world.fitness, { daysToMatch, matchSquadNames, topPlayerIds });
 }
 const category = trainingForDate(s, fixtures, club.name, date, { ...context, players, fitness: world.fitness });
 if (category) world.fitness = applyTrainingSession(players, world.fitness, category, { facilityBonuses: bonuses, playerDevelopment: s.playerDevelopment });
 if (club.name === context.userClub && category) s.trainingHistory = [...(s.trainingHistory ?? []).slice(-730), { id: `training:${club.name}:${date}`, date, categoryId: category }];
 for (const p of players) {
 const id = String(p.id), fitness = world.fitness[id] ?? {}, prior = s.playerDevelopment[id] ?? {};
 const random = seededRandom(`${s.calendarClock.seed}:${date}:training-injury:${id}`);
 if (category && !['RECOVERY', 'MATCH_REVIEW', 'SET_PLAYS'].includes(category) && !fitness.injury?.weeksRemaining && random() < 0.00045 * (1 + Number(fitness.workload ?? 0) / 80) * (1.4 - Number(p.attributes?.durability ?? 65) / 150)) {
 const injury = generateInjury(p, { ...fitness, workload: 100 }, 100, bonuses, () => 0.01);
 if (injury) world.fitness[id] = { ...fitness, injury, fitness: Math.min(70, fitness.fitness ?? 100),
 injuryHistory: Number(fitness.injuryHistory ?? 0) + 1,
 careerInjuryWeeks: Number(fitness.careerInjuryWeeks ?? 0) + Number(injury.weeksRemaining ?? 0),
 injuryEvents: [...(fitness.injuryEvents ?? []), { id: `training:${date}:${id}`, date, club: club.name, name: injury.name, category: injury.category, weeks: injury.weeksRemaining }] };
 }
 const usage = s.calendarUsage?.[`${s.seasonYear}:${id}`] ?? { minutes: 0, games: 0 };
 const developmentMinutes = Number(usage.minutes ?? 0) + Number(usage.reserveMinutes ?? 0) * 0.55;
 const teamPlan = context.trainingPlanByClub?.[club.name] ?? 'BALANCED';
 const forecast = getPlayerDevelopmentForecast(p, prior, { seasonYear: s.seasonYear, clubMorale: s.clubMorale, playerMinutesPlayedById: { [id]: developmentMinutes }, trainingPlanByClub: { [club.name]: teamPlan }, facilityBonuses: bonuses });
 const response = 0.65 + seededRandom(`${s.calendarClock.seed}:${s.seasonYear}:growth:${id}`)() * 0.9;
 const health = fitness.injury?.weeksRemaining ? 0.2 : 1;
 const delta = forecast.change / 365 * response * health;
 const attributes = { ...(prior.attributeRatings ?? p.attributes) };
 const attrForecast = getAttributeSeasonForecast(p, { age: p.age, focus: prior.trainingFocus, teamPlan, overallChange: forecast.change * response, minutesPlayed: developmentMinutes, matchesPlayed: usage.games + Number(usage.reservesGames ?? 0), coachingMultiplier: bonuses.trainingDevelopmentMultiplier, trainingProgress: fitness.attributeTrainingProgress, staffAttributeBonuses: bonuses.staffAttributeBonuses });
 for (const [key, attr] of Object.entries(attrForecast.attributes)) attributes[key] = clamp(Number(attributes[key] ?? attr.current) + Number(attr.growth ?? 0) / 365 * health, 1, 99);
 const potential = getPlayerPotential({ ...p, development: { ...p.development, potential: prior.potential ?? p.development?.potential } }, p.overall);
 // Preserve fractional OVR between daily ticks; display helpers round it later.
 // Rounding on every morning discarded gains smaller than one rating point.
 const savedOverall = Number(prior.overall ?? p.overall);
 const currentOverall = clamp(Number.isFinite(savedOverall) ? savedOverall : 40, 40, potential);
 const nextOverall = clamp(currentOverall + delta, 40, potential);
 s.playerDevelopment[id] = { ...advancePositionTraining(p, prior, fitness, category), overall: nextOverall,
 attributeRatings: attributes, happiness: clamp(Number(prior.happiness ?? 50) + (Number(fitness.morale ?? 50) - Number(prior.happiness ?? 50)) * 0.02, 0, 100),
 dailyDevelopmentSeason: s.seasonYear, growthThisSeason: Number(prior.growthThisSeason ?? 0) + (nextOverall - currentOverall), potential };
 }
 }
}
function worldAvailability(player, season, fitness, match) {
 const last = fitness[player.id]?.lastPlayedDate;
 return Number(fitness[player.id]?.suspension?.matchesRemaining ?? 0) <= 0 && (!last || daysBetween(last, match.date) >= 2);
}
function getRecordedMatchTimeOnGround(result) {
 const minutes = new Map();
 for (const [playerId, value] of Object.entries(result?.matchTimeOnGround ?? {})) {
 const numeric = Number(value);
 if (Number.isFinite(numeric)) minutes.set(String(playerId), clamp(numeric, 0, 100));
 }
 for (const rows of Object.values(result?.playerStats ?? {})) {
 if (!Array.isArray(rows)) continue;
 for (const row of rows) {
 const numeric = Number(row?.timeOnGround);
 if (row?.playerId != null && Number.isFinite(numeric) && !minutes.has(String(row.playerId))) {
 minutes.set(String(row.playerId), clamp(numeric, 0, 100));
 }
 }
 }
 return minutes;
}
function lineups(season, fitness, match, context, recordedTimeOnGround = new Map()) {
 const pool = allPlayers(season, context), result = {};
 for (const club of [match.homeTeam ?? match.home, match.awayTeam ?? match.away]) {
 const players = roster(pool, season, club).filter(p => worldAvailability(p, season, fitness, match)).map(p => getCareerPlayer(p, season.playerDevelopment, season.seasonYear, season.playerContracts));
 let selected = club === context.userClub ? context.selection : null;
 if (!selected || !getTeamSelectionStatus(selected, players, fitness).complete) selected = createAssistantTeamSelection(players.filter(p => !fitness[p.id]?.injury?.weeksRemaining && !fitness[p.id]?.suspension?.matchesRemaining));
 result[club] = Object.entries(selected.selectedSide ?? {}).flatMap(([position, name]) => {
 const player = players.find(p => p.name === name);
 const recorded = recordedTimeOnGround.get(String(player?.id));
 return player ? [{ player: { ...player,
 overall: capOverallAtPotential(player, Number(player.overall ?? 65) + (Number(fitness[player.id]?.matchSharpness ?? 65) - 70) * 0.08),
 matchTimeOnGround: recorded ?? (position.startsWith("INT") ? 54 : 85) }, position, matchPosition: getPlayingPosition(player, position) }] : [];
 });
 }
 return result;
}
// A match must always finish with a real scoreline. If a rating or lineup problem ever leaves a
// result without one, a knockout round could never produce a winner and the finals would stall, so
// fall back to a neutral, seeded scoreline instead.
const isUsableScore = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0;
// Only results with no usable scoreline are changed; a normal drawn knockout is still settled by the extra-time rule.
export function ensureValidScoreline(result, random = Math.random, { knockout = false } = {}) {
 if (isUsableScore(result.homeScore) && isUsableScore(result.awayScore)) return result;
 const side = () => { const goals = 7 + Math.floor(random() * 9); const behinds = 3 + Math.floor(random() * 10); return { goals, behinds, score: goals * 6 + behinds }; };
 const home = side(), away = side();
 if (knockout && home.goals * 6 + home.behinds === away.goals * 6 + away.behinds) (random() < 0.5 ? home : away).goals += 1;
 const homeScore = home.goals * 6 + home.behinds, awayScore = away.goals * 6 + away.behinds;
 return { ...result, homeGoals: home.goals, homeBehinds: home.behinds, homeScore, awayGoals: away.goals, awayBehinds: away.behinds, awayScore,
 scoreRepaired: true, playerStats: undefined, teamStats: undefined };
}
// Repairs a knockout result already stored on a save: no usable scoreline, a level score, or no winner.
function repairStoredKnockoutResult(season, result) {
 if (isUsableScore(result?.homeScore) && isUsableScore(result?.awayScore) && result.homeScore !== result.awayScore && result.winner) return result;
 const random = seededRandom(`${season.calendarClock?.seed ?? 'repair'}:repair:${result?.fixtureId ?? result?.code}`);
 let fixed = ensureValidScoreline({ ...result }, random, { knockout: true });
 if (fixed.homeScore === fixed.awayScore) {
 const side = random() < 0.5 ? 'home' : 'away';
 fixed = { ...fixed, [`${side}Goals`]: Number(fixed[`${side}Goals`] ?? 0) + 1, [`${side}Score`]: fixed[`${side}Score`] + 6, extraTime: true, scoreRepaired: true };
 }
 return { ...fixed, winner: fixed.homeScore > fixed.awayScore ? fixed.homeTeam : fixed.awayTeam };
}

export function commitCalendarMatchResult(input, match, rawResult, context) {
 // A match simulated inside the calendar loop is applied to that loop's private working copy; a result played
 // by the manager (or any other caller) still gets its own copy of the world.
 const world = context.workOnInput ? input : snapshotWorld(input), s = world.season;
 if (hasResult(s, match)) return world;
 const pool = allPlayers(s, context), recordedTimeOnGround = getRecordedMatchTimeOnGround(rawResult);
 const plans = lineups(s, world.fitness, match, context, recordedTimeOnGround);
 const random = seededRandom(`${s.calendarClock.seed}:match:${fixtureId(match, s)}`);
 const scheduled = { ...match, date: dayKey(match.date), homeTeam: match.homeTeam ?? match.home, awayTeam: match.awayTeam ?? match.away };
 const playedResult = rawResult ? {
 ...rawResult,
 homeTeam: rawResult.homeTeam ?? rawResult.home ?? scheduled.homeTeam,
 awayTeam: rawResult.awayTeam ?? rawResult.away ?? scheduled.awayTeam,
 } : null;
 const competitionLadder = match.competitionId ? s.competitions[match.competitionId].ladder : s.ladder;
 let data = simulateSeasonRound(competitionLadder, { round: match.round, matches: [scheduled] }, { playedResult, lineupsByClub: plans, contractsByPlayer: s.playerContracts, playerPool: pool, playerFitness: world.fitness, random, tacticsByClub: { ...(s.aiClubTactics ?? {}), ...(context.tactics ? { [context.userClub]: context.tactics } : {}) } });
 let result = { ...data.results[0], fixtureId: fixtureId(match, s), stage: match.stage, code: match.code, round: match.round, date: scheduled.date };
 const repaired = ensureValidScoreline(result, random, { knockout: ['FINALS', 'WILDCARD'].includes(match.stage) });
 if (repaired !== result) {
 // Replay with the repaired scoreline so the ladder and match statistics stay consistent with it.
 data = simulateSeasonRound(competitionLadder, { round: match.round, matches: [scheduled] }, { playedResult: repaired, lineupsByClub: plans, contractsByPlayer: s.playerContracts, playerPool: pool, playerFitness: world.fitness, random });
 result = { ...data.results[0], fixtureId: fixtureId(match, s), stage: match.stage, code: match.code, round: match.round, date: scheduled.date, scoreRepaired: true };
 }
 if (['FINALS', 'WILDCARD'].includes(match.stage) && result.homeScore === result.awayScore) {
 const adjusted = resolveKnockoutTie(result, random);
 data = simulateSeasonRound(s.ladder, { matches: [scheduled] }, { playedResult: adjusted, lineupsByClub: plans, contractsByPlayer: s.playerContracts, playerPool: pool, playerFitness: world.fitness, random });
 result = { ...data.results[0], fixtureId: fixtureId(match, s), stage: match.stage, code: match.code, round: match.round, date: scheduled.date, extraTime: true };
 }
 if (recordedTimeOnGround.size) {
 for (const side of ['home', 'away']) {
 result.playerStats[side] = (result.playerStats?.[side] ?? []).map(row => {
 const recorded = recordedTimeOnGround.get(String(row.playerId));
 return recorded == null ? row : { ...row, timeOnGround: recorded };
 });
 }
 }
 result.winner = result.homeScore > result.awayScore ? result.homeTeam : result.awayScore > result.homeScore ? result.awayTeam : null;
 if (match.stage !== 'LEAGUE') result.coachesVotes = null;
 s.calendarResults = { ...s.calendarResults, [result.fixtureId]: true };
 if (match.competitionId) {
 const competition = s.competitions[match.competitionId];
 s.competitions = { ...s.competitions, [match.competitionId]: { ...competition, ladder: data.ladder, results: [...competition.results, result] } };
 } else if (match.stage === 'FINALS') {
 const week = Number(s.finalsWeek ?? 0) + 1;
 const existing = (s.finalsHistory ?? []).find(w => w.week === week);
 s.finalsHistory = [...(s.finalsHistory ?? []).filter(w => w.week !== week), { week, label: FINALS_WEEK_LABELS[week - 1], results: [...(existing?.results ?? []), result] }].sort((a, b) => a.week - b.week);
 } else if (match.stage === 'WILDCARD') s.wildcardResults = [...(s.wildcardResults ?? []), result];
 else if (match.stage === 'COMMUNITY') s.communityResults = [...(s.communityResults ?? []), result];
 else {
 s.ladder = data.ladder;
 const existing = (s.roundHistory ?? []).find(r => r.round === match.round);
 s.roundHistory = [...(s.roundHistory ?? []).filter(r => r.round !== match.round), { round: match.round, results: [...(existing?.results ?? []), result] }].sort((a, b) => a.round - b.round);
 }
 for (const award of getFinalsPrizeAwards(match, result, s.seasonYear)) {
 const id = `${result.fixtureId}:finals-prize:${award.club}`;
 if ((s.finalsPrizePayments ?? []).some(payment => payment.id === id)) continue;
 const admin = administrationFor(s, award.club, context);
 if (!admin) continue;
 setAdministration(s, award.club, { ...admin, cashBalance: Number(admin.cashBalance ?? 0) + award.amount }, context);
 s.finalsPrizePayments = [...(s.finalsPrizePayments ?? []), { id, fixtureId: result.fixtureId, date: result.date, ...award }];
 }
 for (const side of ['home', 'away']) {
 const rows = result.playerStats?.[side] ?? [];
 const club = result[`${side}Team`];
 const used = rows.filter(row => Number(row.timeOnGround ?? 0) > 0);
 const bonuses = bonusesFor(s, club, context);
 world.fitness = applyMatchToPlayers(roster(pool, s, club), Object.fromEntries(used.map(row => [row.playerId, row.timeOnGround])), world.fitness, { playedPlayerIds: used.map(row => row.playerId), facilityBonuses: bonuses, random: seededRandom(`${s.calendarClock.seed}:medical:${result.fixtureId}:${side}`), date: result.date, matchId: result.fixtureId, club });
 // Import the live match's actual injury ledger, rather than rolling it again.
 for (const [id, injury] of Object.entries(rawResult?.playerInjuries ?? rawResult?.injuries ?? {})) if (world.fitness[id] && injury && typeof injury === 'object' && getCareerClub(pool.find(player => String(player.id) === String(id)) ?? { id, club: s.playerContracts?.[String(id)]?.club }, s.playerContracts) === club) {
 const state = world.fitness[id];
 if (!(state.injuryEvents ?? []).some(event => event.matchId === result.fixtureId)) world.fitness[id] = { ...state, injury, injuryHistory: Number(state.injuryHistory ?? 0) + 1, careerInjuryWeeks: Number(state.careerInjuryWeeks ?? 0) + Number(injury.weeksRemaining ?? injury.weeks ?? 0),
 injuryEvents: [...(state.injuryEvents ?? []), { id: `${result.fixtureId}:${id}`, date: result.date, matchId: result.fixtureId, club, name: injury.name ?? injury.injury ?? 'Match injury', category: injury.category ?? '—', weeks: injury.weeksRemaining ?? injury.weeks ?? 0 }] };
 else world.fitness[id] = { ...state, injury };
 }
 for (const row of used) {
 world.fitness[row.playerId] = { ...world.fitness[row.playerId], lastPlayedDate: result.date };
 const key = `${s.seasonYear}:${row.playerId}`, previous = s.calendarUsage[key] ?? { minutes: 0, games: 0 };
 s.calendarUsage[key] = { ...previous, minutes: previous.minutes + Number(row.timeOnGround) * 0.8, games: previous.games + 1 };
 }
 if (match.stage === 'LEAGUE' && !match.competitionId) {
 const seniorIds = new Set([...rows.map(row => row.playerId), ...(plans[club] ?? []).map(slot => slot.player?.id)]);
 const reserves = playReservesRound(roster(pool, s, club), seniorIds, world.fitness,
 { club, date: result.date, matchId: result.fixtureId, facilityBonuses: bonuses });
 world.fitness = reserves.fitness;
 for (const [id, minutes] of Object.entries(reserves.minutes)) {
 const key = `${s.seasonYear}:${id}`, previous = s.calendarUsage[key] ?? { minutes: 0, games: 0 };
 s.calendarUsage[key] = { ...previous, reserveMinutes: Number(previous.reserveMinutes ?? 0) + minutes * 0.8,
 reservesGames: Number(previous.reservesGames ?? 0) + 1 };
 }
 }
 for (const player of roster(pool, s, club)) {
 const state = world.fitness[player.id];
 if (Number(state?.suspension?.matchesRemaining ?? 0) > 0) world.fitness[player.id] = { ...state,
 suspension: { ...state.suspension, matchesRemaining: state.suspension.matchesRemaining - 1 } };
 }
 const clubPlayers = roster(pool, s, club).map(player => getCareerPlayer(player, s.playerDevelopment, s.seasonYear, s.playerContracts));
 const leadershipQuality = clubLeadershipQuality(club === context.userClub ? s.leadershipGroup : null, clubPlayers, s.playerContracts);
 const outcome = result.winner === club ? 'WIN' : result.winner ? 'LOSS' : 'DRAW';
 const scoreMargin = Math.abs(Number(result.homeScore ?? 0) - Number(result.awayScore ?? 0));
 s.clubMorale = { ...s.clubMorale, [club]: nextClubMorale(s.clubMorale?.[club], { outcome, margin: scoreMargin, leadershipQuality }) };
 const selectedIds = new Set((plans[club] ?? []).map(entry => String(entry.player.id)));
 const top23 = new Set(clubPlayers.filter(player => !world.fitness[player.id]?.injury?.weeksRemaining && !world.fitness[player.id]?.suspension?.matchesRemaining)
 .sort((a, b) => Number(b.overall ?? 0) - Number(a.overall ?? 0)).slice(0, 23).map(player => String(player.id)));
 for (const player of clubPlayers) {
 const id = String(player.id);
 const role = selectedIds.has(id) ? 'SELECTED' : top23.has(id) ? 'DROPPED' : 'OTHER';
 const delta = matchMoraleDelta({ outcome, margin: scoreMargin, role, leadershipQuality });
 if (delta) changePlayerMorale(s, world.fitness, id, delta, `${outcome.toLowerCase()} · ${result.homeScore}-${result.awayScore}`, result.date);
 }
 }
 // Gate and expected finals income are annual budget lines. They accrue evenly
 // with the rest of the club's annual income, rather than arriving only on
 // match days; this avoids artificial offseason cash shortages when the user
 // advances through long non-match periods.
 if ([result.homeTeam, result.awayTeam].includes(context.userClub)) {
 Object.assign(s, resolveMatchStory(s, result, context.userClub, Number(s.seasonYear), Number(match.round) || Number(s.round), roster(pool, s, context.userClub), world.fitness));
 mail(s, `report:${result.fixtureId}`, `Match report · ${result.homeTeam} ${result.homeScore} — ${result.awayScore} ${result.awayTeam}`, `The result and all player minutes have been recorded.\nOpen Season Hub → Results for the match report. Injuries and recovery use the same daily clock.`);
 s.selectedResultsRound = match.stage === 'LEAGUE' ? `ROUND_${match.round}` : match.stage === 'WILDCARD' ? 'WILDCARD' : ['QF', 'SF', 'PF', 'GF'][s.finalsWeek ?? 0];
 }
 if (match.stage !== 'COMMUNITY' && !match.competitionId) {
 const incidents = createMatchIncidents(result, pool, `${s.calendarClock.seed}:${result.fixtureId}`);
 result.matchReviewIncidents = incidents;
 for (const incident of incidents) {
 s.tribunalCases = [...(s.tribunalCases ?? []), incident];
 if (incident.club === context.userClub) {
 decision(s, tribunalDecision(incident));
 mail(s, `mro:${incident.id}`, `Match Review · ${incident.playerName}`, `${incident.conduct} conduct, ${incident.impact.toLowerCase()} impact, ${incident.contact.toLowerCase()} contact. Accept the proposed sanction or challenge it at the Tribunal.`, 'TRIBUNAL');
 } else {
 const resolved = resolveTribunalCase(s, world.fitness, incident.id, 'ACCEPT', context.userClub);
 Object.assign(s, resolved.season);
 world.fitness = resolved.fitness;
 }
 }
 }
 if (match.stage === 'FINALS' && (match.code === 'GF' || String(match.round).toUpperCase().includes('GF'))) {
 s.grandFinalPresentation = {
 seasonYear: Number(s.seasonYear),
 fixtureId: result.fixtureId,
 viewedFinal: false,
 viewedReview: false,
 };
 advanceCompetition(s);
 }
 return world;
}
function advanceCompetition(season) {
 if (['HOME_AND_AWAY', 'PRESEASON'].includes(season.phase)) {
 const pending = (season.fixture ?? []).find(r => (r.matches ?? []).some(m => !hasResult(season, { ...m, round: r.round, stage: 'LEAGUE' })));
 if (pending) { season.round = pending.round; return; }
 if (season.fixture?.length) { season.phase = 'WILDCARD'; season.round = season.fixture.length + 1; }
 }
 if (season.phase === 'WILDCARD') {
 // A stored wildcard result without a usable scoreline or winner would otherwise stall the finals for good.
 season.wildcardResults = (season.wildcardResults ?? []).map(result => repairStoredKnockoutResult(season, result));
 const matches = getWildcardMatchups(season.ladder, season.fixture);
 if (!matches.every(m => hasResult(season, m))) return;
 const winners = (season.wildcardResults ?? []).map(r => r.winner).filter(Boolean).sort((a, b) => season.ladder.findIndex(c => c.club === a) - season.ladder.findIndex(c => c.club === b));
 if (winners.length < 2) return;
 season.wildcardSeeds = { seven: winners[0], eight: winners[1] }; season.phase = 'FINALS'; season.finalsWeek = 0;
 }
 if (season.phase === 'FINALS') {
 season.finalsHistory = (season.finalsHistory ?? []).map(week => ({ ...week, results: (week.results ?? []).map(result => repairStoredKnockoutResult(season, result)) }));
 const matches = getFinalsMatchups(season);
 if (!matches.length || !matches.every(m => hasResult(season, m))) return;
 if (season.finalsWeek === 2) {
 season.brownlowCountReady = true;
 season.brownlowCountDate = addDays(dayKey(season.calendarClock?.date ?? new Date()), 1);
 mail(season, `brownlow-count:${season.seasonYear}`, `Brownlow Medal count · ${season.seasonYear}`,
 'The umpire votes are ready to be revealed. Open Statistics → Brownlow Medal to begin the count.', 'CALENDAR_EVENT',
 { date: formatDay(season.brownlowCountDate), receivedAt: `${season.brownlowCountDate}T12:00:00` });
 season.finalsWeek += 1;
 return;
 }
 if (season.finalsWeek === 3) {
 season.premier = season.finalsHistory.find(w => w.week === 4)?.results[0]?.winner;
 season.phase = 'POST_SEASON';
 }
 else season.finalsWeek += 1;
 }
}
function market(world, context) {
 const s = world.season, date = s.calendarClock.date, pool = allPlayers(s, context);
 const players = pool.map(p => ({ ...getCareerPlayer(p, s.playerDevelopment, s.seasonYear, s.playerContracts),
 recentlyMoved: !tradeEligibility(p, s, s.seasonYear).eligible })).filter(p => p.club);
 const marketClubs = (context.leagueClubs ?? context.clubs).map(c => ({ ...c, draftPicks: (s.draftPickAssets ?? []).filter(p => p.currentOwner === c.name && p.year >= Number(date.slice(0, 4)) && p.year <= Number(date.slice(0, 4)) + 2) }));
 s.playerContracts = { ...s.playerContracts };
 const dueDraft = annualEvents(s, date).find(e => e.type === 'DRAFT' && !e.resolved && e.date <= date);
 const testingThisDraft = context.developerFastForward === 'DRAFT' && date === context.developerSkipTargetDate;
 if (dueDraft && !testingThisDraft && (context.delegation?.draft || context.developerFastForward)) {
 const result = processAIDraftPicks(s.draftState, null, pool, s.playerContracts, s.seasonYear, context.leagueClubs ?? context.clubs, s.leagueAdministration ?? {}, s.clubRecruitmentPlans ?? {});
 s.draftState = result.draftState;
 s.generatedPlayers = [...(s.generatedPlayers ?? []), ...result.players];
 s.playerContracts = { ...s.playerContracts, ...result.contracts };
 if (s.draftState?.completed) {
 if (!['ROOKIE', 'MID_SEASON'].includes(s.draftState.kind)) s.draftPickAssets = createFutureDraftPicks(Math.max(Number(s.seasonYear), Number(s.draftState.draftYear) + 1), context.leagueClubs ?? context.clubs, applyDraftDeficits(s.draftPickAssets ?? [], s.draftState).filter(p => Number(p.year) > Number(s.draftState.draftYear)));
 s.draftHistory = [...(s.draftHistory ?? []), { draftYear: s.draftState.draftYear, kind: s.draftState.kind ?? 'NATIONAL', picks: s.draftState.picks, draftOrder: s.draftState.draftOrder, bidLog: s.draftState.bidLog ?? [] }]; }
 }
 if (isMovementWindow(s, date, 'trade')) {
 const events = generateAITradeActivity(players, marketClubs, s.seasonYear, context.userClub, { intensity: 0.16, windowKey: date, ladder: s.ladder, tradeRequests: s.tradeRequests ?? [], recruitmentPlans: s.clubRecruitmentPlans ?? {} });
 for (const event of events.filter(e => e.result === 'ACCEPTED').slice(0, 2)) {
 const moves = [{ player: event.target, from: event.seller, to: event.buyer }, ...(event.offer.players ?? []).map(p => ({ player: p, from: event.buyer, to: event.seller }))];
 if (moves.some(m => getCareerClub(m.player, s.playerContracts) !== m.from || !tradeEligibility(m.player, s, s.seasonYear).eligible)) continue;
 if ((event.offer.picks ?? []).some(p => !(s.draftPickAssets ?? []).some(a => a.id === p.id && a.currentOwner === event.buyer))) continue;
 const contracts = { ...s.playerContracts };
 for (const m of moves) contracts[m.player.id] = { ...(contracts[m.player.id] ?? m.player.contract), club: m.to, lastTradedYear: Number(date.slice(0, 4)) };
 if (![event.buyer, event.seller].every(c => checkClubCommitments(pool, contracts, c, s.seasonYear, 3, administrationFor(s, c, context)).ok)) continue;
 s.playerContracts = contracts;
 const ids = new Set(event.offer.picks.map(p => p.id));
 s.draftPickAssets = s.draftPickAssets.map(p => ids.has(p.id) ? { ...p, currentOwner: event.seller } : p);
 const transaction = { id: `trade:${event.id}:${date}`, tradePeriodYear: Number(date.slice(0, 4)), date, week: daysBetween(rulesForDate(s, date).tradeOpen, date) < 7 ? 1 : 2,
 playerMoves: moves.map(m => ({ playerName: m.player.name, fromClub: m.from, toClub: m.to })), pickMoves: event.offer.picks.map(p => ({ pickName: formatDraftPick(p), fromClub: event.buyer, toClub: event.seller })) };
 s.tradePeriodTransactions = [...(s.tradePeriodTransactions ?? []), transaction];
 s.aiTradeHistory = [...(s.aiTradeHistory ?? []), event];
 }
 const pending = (s.pendingAITradeOffers ?? []).filter(o => !s.aiTradeOfferResponses?.[o.id] && o.deadline >= date);
 const activeTargetIds = pending.map(o => o.targetPlayer?.id ?? o.targetPick?.id).filter(id => id != null).map(String);
 const activeClubNames = new Set(pending.map(o => o.fromClub));
 const slots = Math.max(0, 3 - pending.length);
 if (slots > 0) {
 const offers = generateAIOffersToUser(players, marketClubs, context.userClub, s.seasonYear, {
 windowKey: date,
 intensity: 0.08,
 ladder: s.ladder,
 maxOffers: slots,
 excludedPlayerIds: activeTargetIds,
 excludedClubNames: [...activeClubNames],
 userDraftPicks: (s.draftPickAssets ?? []).filter(pick => pick.currentOwner === context.userClub),
 tradeRequests: s.tradeRequests ?? [],
 recruitmentPlans: s.clubRecruitmentPlans ?? {},
 });
 for (const offer of offers) {
 offer.deadline = addDays(date, 3) < rulesForDate(s, date).tradeClose ? addDays(date, 3) : rulesForDate(s, date).tradeClose;
 s.pendingAITradeOffers = [...(s.pendingAITradeOffers ?? []), offer];
 activeClubNames.add(offer.fromClub);
 const targetLabel = offer.targetPlayer?.name ?? (offer.targetPick ? formatDraftPick(offer.targetPick) : 'a club asset');
 decision(s, { id: `reply:${offer.id}`, type: 'TRADE_RESPONSE', offerId: offer.id, title: `Respond to ${offer.fromClub}'s trade offer`, reason: `${offer.fromClub} is interested in ${targetLabel}.`, deadline: offer.deadline, screen: 'RECRUITMENT' });
 mail(s, `mail:${offer.id}`, `Trade offer · ${offer.fromClub}`, `${offer.fromClub} has made an offer for ${targetLabel}. Reply by ${formatDay(offer.deadline)}.`, 'TRADE_OFFER');
 }
 }
 }
 const activeAgentWindow = isMovementWindow(s, date, 'freeAgency') ? 'freeAgency' : isMovementWindow(s, date, 'delistedFreeAgency') ? 'delistedFreeAgency' : null;
 if (activeAgentWindow && daysBetween(rulesForDate(s, date)[`${activeAgentWindow}Open`], date) % 4 === 0) {
 const recruits = recruitAIClubFreeAgents(pool, s.playerContracts, context.leagueClubs ?? context.clubs, s.seasonYear, context.userClub, s.leagueAdministration, { date, maxSignings: 3, recruitmentPlans: s.clubRecruitmentPlans ?? {}, allowedTypes: activeAgentWindow === 'delistedFreeAgency' ? ['DFA'] : ['UFA', 'RFA', 'DFA'], pendingRfaPlayerIds: (s.calendarDecisions ?? []).filter(item => item.type === 'RFA_MATCH' && item.status === 'PENDING').map(item => String(item.playerId)) });
 for (const offer of recruits.pendingMatches ?? []) {
 const deadline = addDays(date, 3);
 const candidateRecord = { ...(s.playerContracts?.[offer.playerId] ?? {}), club: offer.originalClub,
 salary: offer.salary, yearsRemaining: offer.years,
 yearlySalaries: Array.from({ length: offer.years }, () => offer.salary), signedSeason: Number(date.slice(0, 4)) + 1 };
 const canMatch = checkClubCommitments(pool, { ...s.playerContracts, [offer.playerId]: candidateRecord }, offer.originalClub,
 s.seasonYear, 0, s.clubAdministration).ok;
 decision(s, { id: `rfa:${date}:${offer.playerId}`, type: 'RFA_MATCH', ...offer, title: `Match ${offer.bidderClub}'s offer for ${offer.playerName}?`,
 reason: `${offer.bidderClub} offered ${offer.years} years at $${offer.salary.toLocaleString()} per season. ${canMatch ? 'Match these terms or release the player.' : 'Your club cannot match within its salary cap.'}`,
 canMatch,
 deadline, screen: 'RECRUITMENT' });
 mail(s, `rfa-mail:${date}:${offer.playerId}`, `Restricted free agent offer · ${offer.playerName}`,
 `${offer.bidderClub} has made an offer. You have three days to decide whether to match its salary and length.`, 'TRADE_OFFER');
 }
 for (const match of recruits.matches ?? []) {
 const player = pool.find(candidate => candidate.name === match.player && getCareerClub(candidate, s.playerContracts) === match.club);
 if (!player) continue;
 const proposed = { ...s.playerContracts, [player.id]: recruits.contracts[player.id] };
 if (checkClubCommitments(pool, proposed, match.club, s.seasonYear, 3, administrationFor(s, match.club, context)).ok) s.playerContracts = proposed;
 }
 for (const signing of recruits.signings) {
 const player = pool.find(p => p.name === signing.player);
 if (!player) continue;
 const proposed = { ...s.playerContracts, [player.id]: recruits.contracts[player.id] };
 if (!checkClubCommitments(pool, proposed, signing.club, s.seasonYear, 3, administrationFor(s, signing.club, context)).ok) continue;
 s.playerContracts = proposed;
 s.tradePeriodTransactions = [...(s.tradePeriodTransactions ?? []), { id: `fa:${date}:${player.id}`, tradePeriodYear: Number(date.slice(0, 4)), date, week: daysBetween(rulesForDate(s, date).tradeOpen, date) < 7 ? 1 : 2, kind: 'FREE_AGENT', playerMoves: [{ playerId: player.id, playerName: player.name, toClub: signing.club, fromClub: signing.previousClub, freeAgent: true, freeAgencyType: signing.freeAgencyType, salary: signing.salary, age: signing.age }], pickMoves: [] }];
 }
 }
}
function evening(world, context) {
 const s = world.season, date = s.calendarClock.date, pool = allPlayers(s, context), r = rulesForDate(s, date);
 // An unanswered approach expires on its stated date. Resolve it through the
 // same transfer path as the player's "Let them go" choice.
 if (s.clubAdministration?.pendingStaffPoach?.expiresAt < date) {
 const offer = s.clubAdministration.pendingStaffPoach;
 const staffName = s.clubAdministration.staff?.find(person => String(person.id) === String(offer.staffId))?.name;
 Object.assign(s, resolveStaffPoach(s, context.userClub, false, date));
 if (staffName) mail(s, `staff-poach-expired:${offer.staffId}:${offer.expiresAt}`, `${staffName} joins ${offer.fromClub}`, 'The rival offer expired without a match, so the staff member has moved clubs.', 'STAFF_NEWS');
 }
 // Resolve offers that players took away to consider. A saved score determines
 // the chance of acceptance, and the seeded roll makes save/resume consistent.
 for (const [id, record] of Object.entries(s.playerContracts ?? {})) {
 const pending = record?.negotiation?.pendingOffer;
 if (!pending || pending.dueDate > date) continue;
 const player = pool.find(item => String(item.id) === String(id));
 const stillAtClub = player && getCareerClub(player, s.playerContracts) === pending.clubName;
 const chance = clamp(0.15 + (Number(pending.score ?? 60) - 60) * 0.025, 0.15, 0.65);
 const playerAgrees = stillAtClub && seededRandom(`${s.calendarClock.seed}:contract-consider:${id}:${pending.submittedOn}`)() < chance;
 const proposed = { ...s.playerContracts, [id]: updateContractRecord(record, { terms: pending.terms }) };
 const capAllows = playerAgrees && checkClubCommitments(pool, proposed, pending.clubName, s.seasonYear, 0, administrationFor(s, pending.clubName, context)).ok;
 const negotiation = { ...record.negotiation, pendingOffer: null };
 s.playerContracts = { ...s.playerContracts, [id]: capAllows
 ? updateContractRecord(record, { terms: { ...pending.terms, lastSignedAt: `${date}T12:00:00` }, negotiation: { ...negotiation, counterOffer: null, demandIncrease: 0, agentHostility: 0 } })
 : updateContractRecord(record, { negotiation }) };
 if (player) mail(s, `contract-consider:${id}:${pending.submittedOn}`, `Contract response · ${player.name}`,
 capAllows ? `${player.name} accepted the offer after considering it. Their new contract is now in effect.`
 : playerAgrees ? `${player.name} was willing to sign, but the club cannot fit the terms within its salary commitments.`
 : `${player.name} declined the offer after considering it. You can revise the terms if talks remain open.`, 'CONTRACT_NEWS');
 }
 const reviewCoaches = s.phase === 'HOME_AND_AWAY' && localDate(date).getDay() === 1;
 const coachingReviews = {};
 for (const club of context.clubs) {
 let admin = administrationFor(s, club.name, context);
 admin = refreshAvailableStaffPool(admin, club.name, localDate(date));
 const clubRoster = pool.filter(p => getCareerClub(p, s.playerContracts) === club.name);
 const finance = calculateClubFinances({ club, roster: clubRoster, playerContracts: s.playerContracts, administrationState: admin, seasonState: s });
 if (reviewCoaches) coachingReviews[club.name] = calculateBoardReview({ finance, seasonState: s, club, administrationState: admin, roster: clubRoster });
 const daysInYear = Number(date.slice(0, 4)) % 4 === 0 ? 366 : 365;
 const difficulty = club.name === (s.managerClubName ?? context.userClub)
 ? getDifficultySettings(s.difficulty)
 : getDifficultySettings('EXPERIENCED');
 const projectedExtras = finance.playerPayments - finance.basePlayerPayments;
 const dailyNet = Math.round((finance.annualIncome * difficulty.incomeMultiplier - (finance.annualExpenses - projectedExtras) * difficulty.expenseMultiplier) / daysInYear);
 const alreadyCharged = Number(admin.conditionalPaymentsAccruedSeason) === Number(s.seasonYear)
 ? Number(admin.conditionalPaymentsAccrued ?? 0) : 0;
 const earned = Number(finance.actualConditionalPayments ?? 0);
 const conditionalDue = Math.max(0, earned - alreadyCharged);
 setAdministration(s, club.name, { ...admin, accountingMode: 'DAILY', cashBalance: Number(admin.cashBalance ?? 0) + dailyNet - conditionalDue,
 conditionalPaymentsAccrued: Math.max(alreadyCharged, earned), conditionalPaymentsAccruedSeason: s.seasonYear,
 calendarAccruedThrough: date }, context);
 }
 for (const outcome of processListManagerExtensions(s, pool, context.userClub, date)) {
 if (outcome.status !== 'COUNTER') {
 mail(s, `list-manager-contract:${outcome.playerId}:${date}`, `Contract extension · ${outcome.playerName}`, outcome.message, 'CONTRACT_NEWS');
 }
 }
 if (s.jobMarket) s.jobMarket = advanceJobMarketDay(s.jobMarket, date, s.seasonYear);
 if (reviewCoaches) {
 const completedRounds = (s.fixture ?? []).filter(round => (round.matches ?? []).length
 && round.matches.every(match => hasResult(s, { ...match, round: round.round, stage: 'LEAGUE' })));
 const completedNumbers = new Set(completedRounds.map(round => Number(round.round)));
 s.jobMarket = reviewCoachingJobsDuringSeason({
 market: s.jobMarket, clubs: context.leagueClubs ?? context.clubs, players: pool,
 contracts: s.playerContracts, ladder: s.ladder ?? [],
 reviews: coachingReviews, roundHistory: (s.roundHistory ?? []).filter(entry => completedNumbers.has(Number(entry.round))),
 managerClubName: s.managerClubName ?? context.userClub, seasonYear: s.seasonYear, date,
 });
 }
 for (const assignment of (s.scoutingAssignments ?? []).filter(a => !a.completed && a.dueDate && a.dueDate <= date))
 completeScoutingAssignment(s, context, pool, assignment, date);
 if (localDate(date).getDay() === 1) {
 const unavailable = roster(pool, s, context.userClub).filter(p => world.fitness[p.id]?.injury?.weeksRemaining);
 mail(s, `weekly:${date}`, 'Weekly football briefing', `${unavailable.length} players unavailable. Training is aligned to the next fixture.\nReview your upcoming decisions, positional cover and player workloads in the calendar.`);
 const appearancesByPlayer = {};
 for (const round of s.roundHistory ?? []) for (const match of round.results ?? []) for (const side of ['home', 'away']) {
 for (const row of match.playerStats?.[side] ?? []) if (row.playerId != null && Number(row.timeOnGround ?? 0) > 0) {
 const id = String(row.playerId);
 appearancesByPlayer[id] = Number(appearancesByPlayer[id] ?? 0) + 1;
 }
 }
 const candidates = getPlayersSeekingMoves(pool.map(p => getCareerPlayer(p, s.playerDevelopment, s.seasonYear, s.playerContracts)),
 s.playerContracts, context.userClub, { seasonYear: s.seasonYear, seasonState: s,
 ladder: s.ladder, roundsPlayed: (s.roundHistory ?? []).length, appearancesByPlayer });
 s.tradeRequests = (s.tradeRequests ?? []).filter(request => {
 const player = pool.find(p => String(p.id) === String(request.playerId));
 return player && getCareerClub(player, s.playerContracts) === request.club && canRequestTrade(player, s, s.seasonYear);
 });
 for (const candidate of candidates.filter(item => item.leaveDesire >= 42)) {
 const id = String(candidate.player.id);
 if (s.tradeRequests.some(request => String(request.playerId) === id && Number(request.seasonYear) === Number(s.seasonYear))) continue;
 const request = { id: `trade-request:${s.seasonYear}:${id}`, playerId: id,
 playerName: candidate.player.name, club: candidate.currentClub, seasonYear: s.seasonYear,
 date, reason: candidate.reason, leaveDesire: candidate.leaveDesire, status: 'ACTIVE' };
 s.tradeRequests = [...s.tradeRequests, request];
 if (candidate.currentClub === context.userClub) s.chatMessages = [...(s.chatMessages ?? []), {
 id: request.id, type: 'PLAYER_REQUEST', requestKind: 'TRADE', status: 'PENDING',
 playerId: id, sender: candidate.player.name, date, subject: 'Request to explore a trade',
 body: `${candidate.reason}. I would like the club to consider a move in the next trade period.`,
 responseOptions: [{ value: 'RETAIN_PLAYER', label: 'Discuss role and future' }, { value: 'ALLOW_MOVE', label: 'Allow trade discussions' }],
 }];
 }
 const report = (s.scoutingAssignments ?? []).find(a => !a.completed && (!a.dueDate || dayKey(a.dueDate) <= date));
 if (report) completeScoutingAssignment(s, context, pool, report, date);
 for (const p of pool) {
 const owner = getCareerClub(p, s.playerContracts);
 if (!owner || (owner === context.userClub && !context.delegation?.playerDevelopment)) continue;
 const prior = s.playerDevelopment[p.id] ?? {};
 if (prior.calendarFocusMonth === date.slice(0, 7)) continue;
 const player = getCareerPlayer(p, s.playerDevelopment, s.seasonYear, s.playerContracts);
 const focuses = getAvailableIndividualTrainingFocuses(player).filter(f => !['Balanced', 'Recovery'].includes(f));
 const focus = focuses.map(f => ({ f, gap: getIndividualTrainingAttributes(f, player).reduce((sum, a) => sum + (90 - Number(player.attributes?.[a] ?? 65)), 0) / Math.max(1, getIndividualTrainingAttributes(f, player).length) })).sort((a, b) => b.gap - a.gap)[0]?.f ?? 'Balanced';
 s.playerDevelopment[p.id] = { ...prior, trainingFocus: world.fitness[p.id]?.injury?.weeksRemaining ? 'Recovery' : focus, calendarFocusMonth: date.slice(0, 7) };
 }
 s.clubRecruitmentPlans = { ...(s.clubRecruitmentPlans ?? {}) };
 const expectedOrder = [...context.clubs].map(club => ({ name: club.name, rating: roster(pool, s, club.name).map(player => Number(player.overall ?? 60)).sort((a, b) => b - a).slice(0, 23).reduce((sum, value) => sum + value, 0) / 23 })).sort((a, b) => b.rating - a.rating);
 const currentPlayers = pool.map(player => getCareerPlayer(player, s.playerDevelopment, s.seasonYear, s.playerContracts));
 for (const club of context.clubs) {
 let admin = administrationFor(s, club.name, context);
 const squad = currentPlayers.filter(player => player.club === club.name);
 const baseline = s.clubRecruitmentPlans[club.name] ?? { expectedRank: expectedOrder.findIndex(item => item.name === club.name) + 1 };
 const plan = buildAIClubPlan(club, currentPlayers, s.playerContracts, s, baseline);
 s.clubRecruitmentPlans[club.name] = plan;
 if (club.name !== context.userClub) {
 s.aiClubTactics = { ...(s.aiClubTactics ?? {}), [club.name]: chooseAIClubTactics(plan, squad, s.aiClubTactics?.[club.name]) };
 }
 const staff = admin.staff ?? [], poolStaff = admin.staffPool ?? admin.availableStaff ?? [];
 const current = [...staff].sort((a, b) => Number(a.rating ?? 65) - Number(b.rating ?? 65))[0];
 const priorityRole = plan.needs?.[0]?.category === 'midfielders' ? 'Assistant Coach (Midfield)' : plan.needs?.[0]?.category === 'rucks' ? 'Ruck Coach' : plan.needs?.[0]?.category?.includes('Defenders') ? 'Assistant Coach (Backs)' : plan.needs?.[0]?.category?.includes('Forwards') ? 'Assistant Coach (Forwards)' : null;
 const vacantRole = poolStaff.find(person => !staff.some(member => member.role === person.role))?.role;
 const replaceable = vacantRole ? null : plan.performanceGap >= 4 ? staff.filter(person => person.role === priorityRole || person.id === current?.id).sort((a, b) => Number(a.rating ?? 65) - Number(b.rating ?? 65))[0] : current;
 const candidate = poolStaff.filter(p => p.role === (vacantRole ?? replaceable?.role) && Number(p.rating) >= (replaceable ? Number(replaceable.rating ?? 65) + (plan.performanceGap >= 4 ? 5 : 10) : 68)).sort((a, b) => b.rating - a.rating)[0];
 if (candidate && Number(admin.cashBalance ?? 0) > Number(candidate.salary ?? 0) * 3 && !s.calendarJobs[`staff:${club.name}:${date.slice(0, 7)}`]) {
 s.calendarJobs[`staff:${club.name}:${date.slice(0, 7)}`] = true;
 if (club.name !== context.userClub) {
 const compensation = replaceable ? Number(replaceable.salary ?? 0) * 0.5 : 0;
 const signed = signStaff(candidate, Number(candidate.salary ?? 0), 2, date);
 admin = { ...admin, cashBalance: Number(admin.cashBalance ?? 0) - compensation - staffSigningCost(signed), staff: replaceable ? staff.map(person => person.id === replaceable.id ? signed : person) : [...staff, signed], staffPool: [...poolStaff.filter(person => person.id !== candidate.id), ...(replaceable ? [{ ...replaceable, contractYearsRemaining: 0, marketOrigin: 'released' }] : [])], availableStaff: poolStaff.filter(person => person.id !== candidate.id) };
 setAdministration(s, club.name, admin, context);
 }
 }
 }
 // Clubs pursue a clear upgrade, with one outstanding offer to the user's
 // football department at a time. A weekly seeded roll keeps save/resume
 // deterministic while making approaches occasional rather than constant.
 const userAdmin = administrationFor(s, context.userClub, context);
 if (!userAdmin?.pendingStaffPoach && !s.calendarJobs[`staff-poach:${date}`]) {
 const suitors = context.clubs.filter(club => club.name !== context.userClub);
 const possibilities = suitors.flatMap(club => {
 const rival = administrationFor(s, club.name, context);
 return (userAdmin?.staff ?? []).filter(person => {
 const incumbent = (rival?.staff ?? []).filter(item => item.role === person.role)
 .sort((a, b) => Number(b.rating ?? 0) - Number(a.rating ?? 0))[0];
 return Number(person.rating ?? 0) >= Number(incumbent?.rating ?? 60) + 7
 && Number(rival?.cashBalance ?? 0) >= Number(person.salary ?? 0) * 1.5;
 }).map(person => ({ club, rival, person }));
 });
 if (possibilities.length && seededRandom(`${s.calendarClock.seed}:staff-poach:${date}`)() < 0.065) {
 const index = Math.floor(seededRandom(`${s.calendarClock.seed}:staff-poach-choice:${date}`)() * possibilities.length);
 const { club, person } = possibilities[index];
 const salary = Math.ceil(Number(person.salary ?? 0) * 1.25 / 5000) * 5000;
 const offer = { staffId: person.id, fromClub: club.name, salary, years: 3, createdAt: date, expiresAt: addDays(date, 7) };
 setAdministration(s, context.userClub, { ...userAdmin, pendingStaffPoach: offer }, context);
 s.calendarJobs[`staff-poach:${date}`] = true;
 mail(s, `staff-poach:${date}:${person.id}`, `${club.name} approach ${person.name}`,
 `${club.name} have offered ${person.name} $${salary.toLocaleString()} a year for three years. Open Administration → Staff to match the terms or let them go by ${offer.expiresAt}.`, 'STAFF_NEWS');
 }
 }
 if (date.slice(5) >= '08-01') for (const player of pool) {
 const owner = getCareerClub(player, s.playerContracts);
 if (!owner || owner === context.userClub) continue;
 const currentPlayer = getCareerPlayer(player, s.playerDevelopment, s.seasonYear, s.playerContracts);
 const result = negotiateAIExtension(currentPlayer, owner, pool, s.playerContracts, administrationFor(s, owner, context), s.seasonYear, s.clubRecruitmentPlans?.[owner], date);
 if (result?.outcome === 'SIGNED') s.playerContracts = result.contracts;
 }
 }
 for (const event of (s.calendarDecisions ?? []).filter(event => event.status === 'PENDING' && delegated(event, context))) {
 if (event.type === 'INJURY') {
 world.fitness[event.playerId] = { ...world.fitness[event.playerId], trainingProgram: 'RECOVERY_TRAINING' };
 Object.assign(s, resolveCalendarDecision(s, event.id, 'ACKNOWLEDGE'));
 }
 if (event.type === 'CONTRACT_RESPONSE') {
 const p = pool.find(player => String(player.id) === String(event.playerId));
 if (p) {
 const record = s.playerContracts?.[p.id] ?? p.contract;
 const contracts = { ...s.playerContracts, [p.id]: { ...record, yearsRemaining: Math.max(0, Number(record.yearsRemaining ?? 0)) + (p.age >= 30 ? 1 : 2) } };
 if (checkClubCommitments(pool, contracts, context.userClub, s.seasonYear, 3, administrationFor(s, context.userClub, context)).ok) s.playerContracts = contracts;
 Object.assign(s, resolveCalendarDecision(s, event.id, 'ACKNOWLEDGE'));
 mail(s, `delegated:${event.id}`, `Assistant contract review · ${p.name}`, 'The retention proposal was checked against annual salary commitments. Review the contract list for the resulting term.');
 }
 }
 if (event.type === 'TRADE_RESPONSE') {
 // The assistant protects value: discounted unsolicited offers are declined, not silently accepted.
 Object.assign(s, resolveCalendarDecision(s, event.id, 'DECLINE'));
 mail(s, `delegated:${event.id}`, 'Assistant trade response', 'The incoming offer was declined under the delegated policy. No club assets or player contracts changed.');
 }
 }
 if (context.developerFastForward && context.developerFastForward !== 'BROWNLOW'
 && s.brownlowCountReady && !s.brownlowCountCompleted && date >= (s.brownlowCountDate ?? date)) {
 s.brownlowWinners = brownlowCount(s.roundHistory ?? [], s.tribunalCases ?? []).winners;
 s.brownlowCountCompleted = true;
 }
 const next = addDays(date, 1);
 if (date === addDays(r.freeAgencyClose, 4) && !s.calendarJobs?.[`fa-comp:${date}`]) {
 const draftYear = Number(date.slice(0, 4));
 const awards = calculateFreeAgencyCompensation(s.tradePeriodTransactions ?? [], draftYear, context.leagueClubs ?? context.clubs);
 if (awards.length) {
 s.draftPickAssets = resolveDraftPickNumbers([...(s.draftPickAssets ?? []), ...awards], draftYear,
 s.ladder ?? [], context.leagueClubs ?? context.clubs, pool);
 if (Number(s.draftState?.draftYear) === draftYear && Number(s.draftState?.pickIndex ?? 0) === 0) {
 s.draftState = { ...createDraftState({ draftYear, ladder: s.ladder ?? [], clubs: context.leagueClubs ?? context.clubs,
 initial: Boolean(s.draftState.initial), existingNames: pool.map(player => player.name),
 draftPickAssets: s.draftPickAssets, playerPool: pool }), kind: s.draftState.kind };
 }
 mail(s, `fa-comp:${date}`, 'Free agency compensation picks',
 awards.map(pick => `${pick.originalClub}: ${pick.playerName} departure → ${formatDraftPick(s.draftPickAssets.find(asset => asset.id === pick.id))}`).join('\n'), 'TRADE_NEWS');
 }
 s.calendarJobs = { ...(s.calendarJobs ?? {}), [`fa-comp:${date}`]: true };
 }
 if (next.slice(5, 7) !== date.slice(5, 7)) {
 const admin = s.clubAdministration;
 mail(s, `finance:${date.slice(0, 7)}`, 'Monthly club and development review', `Cash balance: $${Math.round(admin.cashBalance ?? 0).toLocaleString()}.\nDaily training, recovery and player growth have been recorded. Review annual salary commitments before recruitment.`);
 }
 if (date === r.contractExpiry && s.seasonHasStarted && Number(date.slice(0, 4)) === Number(s.seasonYear)) {
 for (const club of context.clubs) {
 const administration = administrationFor(s, club.name, context);
 setAdministration(s, club.name, settleClubSalaryCap(administration, s.seasonYear, getClubPlayerPayments(pool, s.playerContracts ?? {}, club.name, 0, s)), context);
 }
 const promiseResults = resolveContractPromises({ players: pool.map((player) => ({ ...player, club: getCareerClub(player, s.playerContracts) })),
 contractsByPlayer: s.playerContracts, seasonYear: s.seasonYear,
 leadershipGroup: Number(s.leadershipGroup?.seasonYear) === Number(s.seasonYear)
 ? s.leadershipGroup : s.leadershipGroupHistory?.[s.seasonYear] ?? null,
 userClubName: context.userClub });
 for (const promise of promiseResults.results ?? []) {
 if (!promise.moraleImpact) continue;
 changePlayerMorale(s, world.fitness, promise.playerId, promise.moraleImpact,
 `${promise.status === 'FULFILLED' ? 'Contract promise fulfilled' : 'Contract promise broken'}: ${promise.promiseId}`, date);
 }
 s.playerContracts = advancePlayerContracts(pool, promiseResults.contracts, s.seasonYear, s);
 s.playerContracts = delistUnretainedAIExpiredPlayers(pool, s.playerContracts, context.clubs, context.userClub, s.seasonYear).contracts;
 s.calendarJobs[`expiry:${s.seasonYear}`] = date;
 mail(s, `expiry-report:${date}`, 'Contract expiry completed', 'Expiring deals have been reviewed across the league. Contracted delistings retain their salary commitments.');
 }
 for (const event of annualEvents(s, date).filter(e => e.date === date && e.type !== 'DRAFT')) {
 if (event.type === 'MEDIA') {
 const week = event.id.includes('roundup-1') ? 1 : 2;
 const transactions = (s.tradePeriodTransactions ?? []).filter(t => Number(t.tradePeriodYear) === r.year && Number(t.week) === week);
 mail(s, `trade-period-roundup-${r.year}-week-${week}`, event.title, `${transactions.length} completed transactions recorded.`, 'TRADE_PERIOD_ROUNDUP', { tradeRoundup: { year: r.year, week, transactions } });
 } else mail(s, `annual:${event.id}`, event.title, 'Review the calendar and club plans for this league milestone.');
 }
 if (s.phase === 'OFFSEASON') s.offseasonStep = date <= addDays(r.tradeOpen, 6) ? 0 : date <= r.tradeClose ? 1 : s.draftState?.completed ? 3 : 2;
 if (date.endsWith('-01-01') && s.phase === 'OFFSEASON' && s.draftState?.completed) {
 const year = Number(s.seasonYear) + (s.seasonHasStarted ? 1 : 0);
 const medal = brownlowCount(s.roundHistory, s.tribunalCases);
 s.seasonArchive = [...(s.seasonArchive ?? []).filter(a => a.year !== s.seasonYear), ...(s.seasonHasStarted ? [{ year: s.seasonYear, premier: s.premier, roundHistory: s.roundHistory, wildcardResults: s.wildcardResults, finalsHistory: s.finalsHistory, finalsPrizePayments: s.finalsPrizePayments ?? [], ladder: s.ladder, finalLadder: s.ladder, tribunalCases: (s.tribunalCases ?? []).filter(item => String(item.fixtureId ?? '').startsWith(`${s.seasonYear}:`)), brownlowWinners: medal.winners }] : [])];
 Object.assign(s, { seasonYear: year, seasonHasStarted: true, fixture: context.makeFixture(year), round: 1, roundHistory: [], wildcardResults: [], wildcardSeeds: null, finalsHistory: [], finalsWeek: 0, phase: 'PRESEASON', premier: null, communityFixtures: [], communityResults: [], calendarSelectionFixtureId: null,
 brownlowCountReady: false, brownlowCountCompleted: false, brownlowCountDate: null, brownlowWinners: [], finalsPrizePayments: [] });
 s.ladder = s.ladder.map(c => ({ ...c, wins: 0, losses: 0, draws: 0, points: 0, percentage: 0, pointsFor: 0, pointsAgainst: 0, form: [] }));
 if (year >= 2028 && !s.tasmaniaExpansion?.activated) activateTasmaniaExpansion(world, context, year);
 }
 if (s.phase === 'PRESEASON' && date.endsWith('-02-15') && !s.communityFixtures?.length) {
 s.communityFixtures = (s.fixture?.[0]?.matches ?? []).map((m, i) => ({ ...m, id: `${s.seasonYear}:COMMUNITY:${i}`, round: 'COMMUNITY', stage: 'COMMUNITY', date: r.communitySeries, label: 'Community Series' }));
 }
}
export function getWorldBlocker(world, context) {
 const s = world.season, clock = s.calendarClock;
 if (s.jobMarket?.userStatus === 'UNEMPLOYED') return { id: `job-search:${s.seasonYear}`, type: 'JOB_MARKET', title: 'Find your next club', mandatory: true, screen: 'ADMINISTRATION' };
 if (context.developerFastForward) {
 if (s.phase === 'POST_SEASON' && clock.date < context.developerSkipTargetDate) {
 return { id: `season-review:${s.seasonYear}`, type: 'SEASON_REVIEW', title: 'Review the completed season', mandatory: true, screen: 'SEASON' };
 }
 if (context.developerFastForward === 'BROWNLOW' && s.brownlowCountReady && !s.brownlowCountCompleted && clock.date >= (s.brownlowCountDate ?? clock.date)) {
 return { id: `brownlow-count:${s.seasonYear}`, type: 'BROWNLOW_COUNT', title: `Brownlow Medal count · ${s.seasonYear}`, mandatory: true, screen: 'STATISTICS', tab: 'BROWNLOW' };
 }
 return null;
 }
 if (s.phase === 'POST_SEASON') return { id: `season-review:${s.seasonYear}`, type: 'SEASON_REVIEW', title: 'Review the completed season', mandatory: true, screen: 'SEASON' };
 const userRoster = roster(allPlayers(s, context), s, context.userClub);
 const draftDue = annualEvents(s, clock.date).some(e => e.type === 'DRAFT' && !e.resolved && e.date <= clock.date);
 if (draftDue && userRoster.length > rulesForDate(s, clock.date).listLimit) return { id: 'list-compliance', type: 'LIST_COMPLIANCE', screen: 'SQUAD', title: 'Resolve the 44-player list limit before drafting', mandatory: true };
 const pending = pendingDecisions(s, { ...context, fitness: world.fitness });
 const blockingDecision = pending.find(event => event.type !== 'STAFF_APPROVAL');
 if (blockingDecision) return blockingDecision;
 if (s.brownlowCountReady && !s.brownlowCountCompleted && clock.date >= (s.brownlowCountDate ?? clock.date)) return { id: `brownlow-count:${s.seasonYear}`, type: 'BROWNLOW_COUNT', title: `Brownlow Medal count · ${s.seasonYear}`, mandatory: true, screen: 'STATISTICS', tab: 'BROWNLOW' };
 const draft = annualEvents(s, clock.date).find(e => e.type === 'DRAFT' && !e.resolved && e.date <= clock.date);
 if (draft && !context.delegation?.draft) return draft;
 const optional = (s.mailMessages ?? []).find(message => {
 const kind = message.id?.startsWith('scout:') ? 'SCOUT' : message.type === 'CALENDAR_EVENT' ? 'MEDIA' : null;
 return kind && s.calendarNotificationPolicy?.[kind] === 'STOP' && !(s.resolvedCalendarEventIds ?? []).includes(`notice:${message.id}`);
 });
 if (optional) return { id: `notice:${optional.id}`, type: 'NOTICE', title: optional.subject, screen: 'INBOX' };
 if (clock.slot >= 2) {
 const match = nextUserFixture(s, context.userClub);
 if (match && match.date <= clock.date && !context.simulateUserMatches) return { id: match.id, type: 'MATCH', title: `${match.homeTeam ?? match.home} vs ${match.awayTeam ?? match.away}`, data: { match }, mandatory: true };
 }
 return null;
}
export async function advanceWorld(input, command, context) {
 const contextForSeason = (season) => {
 const league = leagueClubsForYear(Number(season.seasonYear ?? 2027));
 return { ...context, leagueClubs: league, clubs: worldClubs(season, league) };
 };
 context = contextForSeason(input.season);
 let world = initializeWorld(input.season, input.fitness, context);
 const target = resolveContinueTarget(world.season, command, context);
 if (daysBetween(world.season.calendarClock.date, target) > 400) throw new Error('Choose a target within the next 400 days.');
 if (target < world.season.calendarClock.date) return { world, stop: null, target };
 let lastYield = Date.now();
 while (world.season.calendarClock.date <= target) {
 context = contextForSeason(world.season);
 if (context.cancelled?.()) return { world, stop: { type: 'PAUSED', title: 'Processing paused' }, target };
 const blocker = getWorldBlocker(world, context);
 if (blocker) return { world, stop: blocker, target };
 const clock = world.season.calendarClock;
 if (clock.date === target && clock.slot >= 2 && !context.finishTargetDay) return { world, stop: null, target };
 // The day is calculated on a private working copy. A fresh copy is taken at the start of each day, and
 // for every slot on the target day (where a stop must leave the earlier slots exactly as committed); the
 // slots in between reuse the day's copy, because each slot finishes completely before the clock advances
 // and a failure discards the whole run. Copying the entire world four times a day was the largest cost.
 let candidate = clock.slot === 0 || clock.date >= target ? snapshotWorld(world) : world;
 if (clock.slot === 0) morning(candidate, context);
 if (clock.slot === 1) { preparation(candidate, context); market(candidate, context); }
 if (clock.slot === 2) {
 for (const match of seasonFixtures(candidate.season).filter(m => m.date <= clock.date && !hasResult(candidate.season, m))) {
 const user = [match.homeTeam ?? match.home, match.awayTeam ?? match.away].includes(context.userClub);
 if (user && !context.simulateUserMatches) {
 world = candidate;
 return { world, stop: { id: match.id, type: 'MATCH', title: `${match.homeTeam ?? match.home} vs ${match.awayTeam ?? match.away}`, data: { match }, mandatory: true }, target };
 }
 candidate = commitCalendarMatchResult(candidate, match, null, { ...context, workOnInput: true });
 }
 if (candidate.season.phase === 'PRESEASON' && (candidate.season.fixture ?? []).some(r => r.matches?.some(m => dayKey(m.date) <= clock.date))) candidate.season.phase = 'HOME_AND_AWAY';
 advanceCompetition(candidate.season);
 }
 if (clock.slot === 3) evening(candidate, context);
 candidate.season.calendarClock = nextCheckpoint(clock);
 candidate.season.calendarJobs[`${clock.date}:${DAY_SLOTS[clock.slot]}`] = true;
 // Bound diagnostic ledger size; the cursor remains the authoritative processed boundary.
 if (Object.keys(candidate.season.calendarJobs).length > 1600) candidate.season.calendarJobs = Object.fromEntries(Object.entries(candidate.season.calendarJobs).slice(-1200));
 world = candidate;
 if (Date.now() - lastYield > 25) {
 context.onProgress?.({ date: world.season.calendarClock.date, slot: DAY_SLOTS[world.season.calendarClock.slot], target });
 await new Promise(resolve => setTimeout(resolve, 0)); lastYield = Date.now();
 }
 }
 return { world, stop: null, target };
}
