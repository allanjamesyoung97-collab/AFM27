// @ts-nocheck
import { createClock, dayKey, localDate, formatDay, addDays, CONTINUE_COMMANDS } from "./engine/simulationClock.js";
import { advanceWorld, initializeWorld, calendarEventsForWorld, getWorldBlocker, nextUserFixture, hasResult, commitCalendarMatchResult, pendingDecisions, resolveCalendarDecision } from "./engine/worldSimulationEngine.js";
import { runCalendarSimulation } from "./engine/calendarRunner.js";
import { assignScoutingPlayer } from "./engine/scoutingAssignmentEngine.js";
import { resolveTribunalCase } from "./engine/tribunalEngine.js";
import { tradeEligibility } from "./engine/playerMovementRules.js";
import { isMovementWindow, rulesForDate } from "./engine/seasonRules.js";
import CalendarProgressPanel from "./components/CalendarProgressPanel.jsx";
import { checkClubCommitments, getClubPlayerPayments, validTradePackage } from "./engine/transactionRules.js";
import { evaluatePackageExchange } from "./engine/playerValuationEngine.js";
import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";

const MODULE_RELOAD_GUARD_KEY = "afm-module-load-reload-at";
const MODULE_RELOAD_GUARD_MS = 30_000;

function isModuleLoadError(error: unknown) {
const message = error instanceof Error ? error.message : String(error ?? "");
return /not a valid JavaScript MIME type|failed to fetch dynamically imported module|importing a module script failed|error loading dynamically imported module/i.test(message);
}

function recoverFromModuleLoadError() {
if (typeof window === "undefined") return false;
try {
const lastReloadAt = Number(window.sessionStorage.getItem(MODULE_RELOAD_GUARD_KEY) ?? 0);
if (lastReloadAt && Date.now() - lastReloadAt < MODULE_RELOAD_GUARD_MS) return false;
window.sessionStorage.setItem(MODULE_RELOAD_GUARD_KEY, String(Date.now()));
} catch {
// If storage is unavailable, avoid an automatic reload that could loop.
return false;
}
window.location.reload();
return true;
}

if (typeof window !== "undefined") {
window.addEventListener("vite:preloadError", (event) => {
event.preventDefault();
recoverFromModuleLoadError();
});
}

const Dashboard = lazy(() => import("./components/Dashboard.jsx"));
const SquadScreen = lazy(() => import("./components/SquadScreen.jsx"));
const RecruitmentScreen = lazy(() => import("./components/RecruitmentScreen.jsx"));
const SeasonScreen = lazy(() => import("./components/SeasonScreen.jsx"));
const ClubAdministrationScreen = lazy(() => import("./components/ClubAdministrationScreen.jsx"));
const JobMarketTab = lazy(() => import("./components/JobMarketTab.jsx"));
const TrainingScreen = lazy(() => import("./components/TrainingScreen.jsx"));
const TacticsScreen = lazy(() => import("./components/TacticsScreen.jsx"));
const MatchCentre = lazy(() => import("./components/MatchCentre.jsx"));
const StatisticsScreen = lazy(() => import('./components/StatisticsScreen.jsx'));
import InboxScreen, { createInboxChats, createInboxMail } from "./components/InboxScreen.jsx";
const ClubSelectionScreen = lazy(() => import('./components/ClubSelectionScreen.jsx'));
const ClubProfile = lazy(() => import('./components/ClubProfile.jsx'));
const PlayerProfile = lazy(() => import('./components/PlayerProfile.jsx'));
const GameModeSelectionScreen = lazy(() => import('./components/GameModeSelectionScreen.jsx'));
import { clubs, leagueClubsForYear, draftClubsForYear, tasmaniaDevils } from "./data/clubs.js";
import { DEFAULT_TACTICS, normalizeTactics } from "./engine/tacticsEngine.js";
import { simulateSeasonRound } from "./engine/seasonEngine.js";
import { generateFixture } from "./engine/fixtureGenerator.js";
const CalendarScreen = lazy(() => import('./components/CalendarScreen.jsx'));
import PersistentHeader from "./components/PersistentHeader.jsx";
import { generateAllCalendarEvents, getNextEvent, getNextProgressEvent, isMandatoryStop, getScreenForEvent, parseFixtureDate, datesEqual } from "./engine/calendarEngine.js";
import { defaultDelegationSettings } from "./data/trainingCategories.js";
import { DIFFICULTY_MODES, normalizeDifficulty } from "./engine/difficultyEngine.js";
import { players as basePlayers, tradePeriodPlayerMoves2026 } from "./data/players.js";
import { initializeFitnessState, applyMatchToPlayers, applyRecoveryCycle, advanceInjuries, getDefaultTOGForSquad, getAvailablePlayers } from "./engine/fitnessEngine.js";
import { assistantSetTrainingPrograms, applyTrainingSession } from "./engine/trainingEngine.js";
const InjuryListTab = lazy(() => import('./components/InjuryListTab.jsx'));
import { createTeamSelectionState } from "./state/createTeamSelectionState.js";
import { appendTeamSheetHistory, createAssistantTeamSelection, createTeamSheetHistoryEntry, getTeamSelectionStatus, getTeamSheetRoundKey } from "./engine/teamSelectionEngine.js";
import {
advanceClubAdministrationSeason,
buildClubNegotiationContext,
calculateBoardReview,
calculateClubFinances,
createClubAdministrationState,
applyLeagueStaffRatings,
completeFacilityProjects,
createInitialLeaguePlayerContracts,
getFacilityBonuses,
refreshAvailableStaffPool,
rebaseGeneratedContracts,
settleClubSalaryCap,
} from "./engine/clubAdministrationEngine.js";
import { runContractRollover, getCareerClub } from "./engine/contractEngine.js";
import { advanceAIStaffContracts } from "./engine/staffContractEngine.js";
import { executeTrade } from "./engine/tradeNegotiationEngine.js";
import { evaluateTradeOffer } from "./engine/playerValuationEngine.js";
import { reSignPlayer, signFreeAgent, recruitAIClubFreeAgents, delistUnretainedAIExpiredPlayers, enforceAIClubListLimits } from "./engine/freeAgencyEngine.js";
import { estimateSalaryDemand } from "./engine/contractValueEngine.js";
import { generateAITradeActivity, generateAIRetentionOffers } from "./engine/aiTradeEngine.js";
import { decideSeasonRetirements } from "./engine/retirementEngine.js";
import { getMinimumSalary, getConfiguredEffectiveSalaryCap, isSalaryCapEnforced } from "./engine/salaryCap.js";
import { getSalaryInSeason, getYearlySalaries } from "./engine/contractStructure.js";
import { projectedContractExtras } from "./engine/contractComponents.js";
import { applySeasonDevelopment, getTeamFormRate } from "./engine/developmentEngine.js";
import { attachMatchStatistics, getPlayingPosition } from "./engine/statisticsEngine.js";
import { getFinalsMatchups, getWildcardMatchups } from "./engine/finalsEngine.js";
import { createDraftState, createCurrentYearDraftProspects, createFutureDraftPicks, createInitial2026DraftPicks, formatDraftPick, passDraftPick, placeDraftBid, processAIDraftPicks, resolveDraftPickNumbers, resolvePendingBid, selectDraftProspect } from "./engine/draftEngine.js";
import { applyDraftDeficits, draftPickMetaFields, validateMatchPlan } from "./engine/draftBiddingEngine.js";
import { repairPlayerAttributes } from "./engine/playerFactory.js";
import { capOverallAtPotential, getPlayerPotential } from "./engine/potentialRules.js";
import { academyDraftClass, applyAcademyAction, createAcademy } from "./engine/academyEngine.js";
const DeveloperPlayerAttributes = lazy(() => import('./components/DeveloperPlayerAttributes.jsx'));
const DeveloperScreen = lazy(() => import('./components/DeveloperScreen.jsx'));
const ClubResetDraftScreen = lazy(() => import('./components/ClubResetDraftScreen.jsx'));
const FantasyToolsScreen = lazy(() => import('./components/FantasyToolsScreen.jsx'));
import { createInitialSeasonState } from "./engine/seasonState.js";
import { completedOpeningDraftState, createCareerStartState, createTasmaniaCareerStartState, TASMANIA_CAREER } from "./engine/careerStartEngine.js";
import { recordTasmaniaConcessionSigning } from "./engine/tasmaniaExpansionEngine.js";
import { scoutingCandidateForProspect } from "./engine/scoutingFitEngine.js";
import { scheduleFixtureAcrossWeekend } from "./engine/fixtureScheduler.js";
import { createClubResetDraft, advanceClubResetDraftToUser, autofillClubResetDraft, selectClubResetPlayer } from "./engine/clubResetDraftEngine.js";
import { applyForCoachingJob, getJobMarket, reviewCoachingJobs } from "./engine/jobMarketEngine.js";
import { cloudSavesAvailable, subscribeToCloudAuth, listCloudCareers, putCloudCareer, removeCloudCareer, signInToCloud, signOutOfCloud, signUpForCloud, sendPasswordReset, updateCloudPassword, sendCloudErrorReport } from "./lib/cloudCareers.js";

type AutoSaveMode = "OFF" | "ON_CHANGE" | "5_MIN" | "15_MIN";
type TextSize = "STANDARD" | "LARGE" | "EXTRA_LARGE";
type TeamTrainingPlan = "BALANCED" | "SKILLS" | "FITNESS" | "DEFENCE" | "ATTACK" | "RECOVERY";
type TacticsPlan = typeof DEFAULT_TACTICS;
type ProgressionMode = "OPTIMIZED" | "BALANCED" | "DAILY";
type DifficultyMode = "BEGINNER" | "EXPERIENCED" | "PRO";
const defaultTactics: TacticsPlan = DEFAULT_TACTICS;
const defaultTrainingPlan: TeamTrainingPlan = "BALANCED";
const validTrainingPlans: TeamTrainingPlan[] = ["BALANCED", "SKILLS", "FITNESS", "DEFENCE", "ATTACK", "RECOVERY"];

export class ScreenErrorBoundary extends Component<{ children: ReactNode; screen?: string }, { error: Error | null; reference: string; reportStatus: string }> {
state = { error: null as Error | null, reference: "", reportStatus: "" };
componentStack = "";

static getDerivedStateFromError(error: Error) {
return { error, reference: `AFM-${new Date().toISOString().slice(0, 10)}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`, reportStatus: "" };
}

componentDidCatch(error: Error, info: any) {
this.componentStack = info?.componentStack ?? "";
console.error(`Screen rendering failed (${this.state.reference})`, error, info?.componentStack);
if (isModuleLoadError(error)) recoverFromModuleLoadError();
}

reportIssue = async () => {
try {
await sendCloudErrorReport(this.state.reference, this.props.screen ?? window.location.pathname, this.state.error, this.componentStack);
this.setState({ reportStatus: "Issue report sent. Thank you." });
} catch {
this.setState({ reportStatus: "Could not send the report. Copy the issue details instead." });
}
};

render() {
if (this.state.error) {
return (
<section role="alert" style={{ margin: 20, padding: 20, border: "1px solid #ef4444", borderRadius: 14, background: "#1e293b", color: "#f8fafc" }}>
<h2 style={{ marginTop: 0 }}>Something went wrong on this screen</h2>
<p>Your last saved career is safe. Try reopening this screen. If the problem continues, reload the game and resume your save.</p>
<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
<button type="button" onClick={() => this.setState({ error: null, reference: "" })} style={{ padding: "10px 16px", border: 0, borderRadius: 8, background: "#ea580c", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Try again</button>
<button type="button" onClick={() => navigator.clipboard?.writeText([
`AFL Manager issue ${this.state.reference}`,
`Screen: ${this.props.screen ?? window.location.pathname}`,
`Error: ${this.state.error?.name ?? "Error"}: ${this.state.error?.message ?? "Unknown error"}`,
`Time: ${new Date().toISOString()}`,
"What I was doing: ",
"Component stack:",
this.componentStack,
].join("\n"))} style={{ padding: "10px 16px", border: "1px solid #64748b", borderRadius: 8, background: "transparent", color: "#f8fafc", cursor: "pointer" }}>Copy issue details</button>
{cloudSavesAvailable() && <button type="button" onClick={this.reportIssue} style={{ padding: "10px 16px", border: "1px solid #64748b", borderRadius: 8, background: "transparent", color: "#f8fafc", cursor: "pointer" }}>Send issue report</button>}
</div>
{this.state.reportStatus && <p role="status">{this.state.reportStatus}</p>}
<p style={{ fontSize: 12, color: "#94a3b8" }}>Issue reference {this.state.reference}. Include what you were doing when you report it.</p>
</section>
);
}
return this.props.children;
}
}

function AppLoading() {
return <main role="status" aria-live="polite" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#020617", color: "#f8fafc", fontFamily: "Arial, sans-serif" }}>
<div style={{ textAlign: "center" }}><div style={{ color: "#fb923c", fontSize: 12, fontWeight: 800, letterSpacing: 3 }}>AFL MANAGER 27</div><div style={{ marginTop: 12, fontSize: 18, fontWeight: 700 }}>Loading your club…</div><div style={{ marginTop: 8, color: "#94a3b8", fontSize: 14 }}>Preparing the league and match data</div></div>
</main>;
}

const GAME_MODES = ["CLASSIC", "CLUB_RESET", "FANTASY"] as const;
type GameMode = (typeof GAME_MODES)[number];

type CareerSave = {
id: string;
version: 1;
mode: GameMode;
clubId: (typeof clubs)[number]["id"];
activeScreen: string;
seasonState: ReturnType<typeof createInitialSeasonState>;
tactics: TacticsPlan;
trainingPlan: TeamTrainingPlan;
userTrainingSchedule?: any[];
readInboxMessageIds: string[];
calendarDate: string;
savedAt: string;
savedAutomatically?: boolean;
playerFitness?: Record<string, any>;
timeOnGround?: Record<string, number>;
teamSelection?: any;
matchContext?: any;
matchProgress?: any;
playedMatchRound?: number | null;
};

const SAVED_GAMES_KEY = "afl-manager-saves-v1";
const LEGACY_SAVE_KEY = "afl-manager-save-v1";
const MAX_SAVED_GAMES = 5;
const CAREER_SAVE_DB = "afl-manager-careers";
const CAREER_SAVE_STORE = "saves";
const CLOUD_CACHE_PREFIX = "afl-manager-account-cache-v1:";

function readAccountCacheRecord(userId: string): { saves: CareerSave[]; pendingIds: string[] } {
try {
const value = JSON.parse(window.localStorage.getItem(`${CLOUD_CACHE_PREFIX}${userId}`) ?? "[]");
const rawSaves = Array.isArray(value) ? value : value?.saves;
return {
saves: Array.isArray(rawSaves) ? rawSaves.map((save: any, index: number) => safeNormalizeCareerSave(save, `account-${index}`)).filter(Boolean) : [],
pendingIds: Array.isArray(value?.pendingIds) ? value.pendingIds.filter((id: any) => typeof id === "string") : [],
};
} catch { return { saves: [], pendingIds: [] }; }
}

function readAccountCache(userId: string): CareerSave[] {
return readAccountCacheRecord(userId).saves;
}

function writeAccountCache(userId: string, saves: CareerSave[], pendingIds: string[] = []) {
try {
window.localStorage.setItem(`${CLOUD_CACHE_PREFIX}${userId}`, JSON.stringify({ saves, pendingIds }));
return true;
} catch { return false; }
}
const DEVELOPER_PLAYER_OVERRIDES_KEY = "afl-manager-developer-player-attributes-v1";

function openCareerSaveDatabase(): Promise<IDBDatabase> {
return new Promise((resolve, reject) => {
if (!("indexedDB" in window)) {
reject(new Error("IndexedDB is unavailable"));
return;
}
const request = window.indexedDB.open(CAREER_SAVE_DB, 1);
request.onupgradeneeded = () => {
const database = request.result;
if (!database.objectStoreNames.contains(CAREER_SAVE_STORE)) {
database.createObjectStore(CAREER_SAVE_STORE, { keyPath: "id" });
}
};
request.onsuccess = () => resolve(request.result);
request.onerror = () => reject(request.error ?? new Error("Could not open career storage"));
});
}

async function readCareerSavesFromDatabase(): Promise<CareerSave[]> {
const database = await openCareerSaveDatabase();
return new Promise((resolve, reject) => {
const transaction = database.transaction(CAREER_SAVE_STORE, "readonly");
const request = transaction.objectStore(CAREER_SAVE_STORE).getAll();
request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
request.onerror = () => reject(request.error ?? new Error("Could not read career storage"));
transaction.oncomplete = () => database.close();
transaction.onerror = () => database.close();
transaction.onabort = () => {
database.close();
reject(transaction.error ?? new Error("Career storage read was aborted"));
};
});
}

async function writeCareerSavesToDatabase(saves: CareerSave[]): Promise<void> {
const database = await openCareerSaveDatabase();
return new Promise((resolve, reject) => {
const transaction = database.transaction(CAREER_SAVE_STORE, "readwrite");
const store = transaction.objectStore(CAREER_SAVE_STORE);
store.clear();
saves.forEach((save) => store.put(save));
transaction.oncomplete = () => { database.close(); resolve(); };
transaction.onerror = () => { database.close(); reject(transaction.error ?? new Error("Could not write career storage")); };
transaction.onabort = () => { database.close(); reject(transaction.error ?? new Error("Career storage write was aborted")); };
});
}

function calendarDaysBetween(startValue: any, endValue: any) {
const start = parseFixtureDate(startValue);
const end = parseFixtureDate(endValue);
if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
return Math.max(0, Math.round((endDay - startDay) / 86400000));
}

function simulateSeasonRoundInWorker(input: any) {
return new Promise((resolve, reject) => {
const worker = new Worker(new URL("./workers/seasonRoundWorker.js", import.meta.url), { type: "module" });
worker.onmessage = (event) => {
worker.terminate();
if (event.data?.ok) resolve(event.data.roundData);
else reject(new Error(event.data?.error ?? "Round simulation failed"));
};
worker.onerror = (event) => {
worker.terminate();
reject(event.error ?? new Error(event.message ?? "Round simulation worker failed"));
};
worker.postMessage(input);
});
}

const validScreens = [
"DASHBOARD",
"CALENDAR",
"MATCH_DAY",
"SQUAD",
"TACTICS",
"RECRUITMENT",
"SEASON",
"INBOX",
"STATISTICS",
"TRAINING",
"INJURY_LIST",
"FINANCES",
"SETTINGS",
"FANTASY_TOOLS",
...(import.meta.env.DEV ? ["DEVELOPER_ATTRIBUTES"] : []),
];

function normalizeCareerSave(parsed: any, fallbackId: string): CareerSave | null {
if (Number(parsed?.version ?? 1) > 1) return null;
const savedClubExists = clubs.some((club) => club.id === parsed?.clubId)
|| (tasmaniaDevils.id === parsed?.clubId && (Number(parsed?.seasonState?.seasonYear ?? 2027) >= 2028 || Boolean(parsed?.seasonState?.expansionCareer)));
if (!savedClubExists || !GAME_MODES.includes(parsed?.mode)) return null;
const hasSeasonState = parsed.seasonState &&
Array.isArray(parsed.seasonState.fixture) &&
Array.isArray(parsed.seasonState.ladder) &&
Array.isArray(parsed.seasonState.roundHistory);
if (parsed.seasonState && !hasSeasonState) return null;
const sourceSeason = hasSeasonState ? parsed.seasonState : createInitialSeasonState();
const seasonYear = Number(sourceSeason.seasonYear ?? 2027);
const savedDraftPickAssets = Array.isArray(sourceSeason.draftPickAssets)
? sourceSeason.draftPickAssets
: [];
// Older saves may contain an empty or partial pick list. Reconcile the two
// active draft years on load while preserving every traded pick's owner.
const initialDraftPending = Boolean(sourceSeason.draftState?.initial && !sourceSeason.draftState?.completed);
const firstActiveDraftYear = initialDraftPending
? Number(sourceSeason.draftState.draftYear ?? 2026)
: sourceSeason.draftState?.completed
? Math.max(seasonYear, Number(sourceSeason.draftState.draftYear ?? seasonYear) + 1)
: seasonYear;
const hasOfficial2026Assets = savedDraftPickAssets.some((pick: any) => pick.year === 2026 && String(pick.id).startsWith("2026-pick-"));
const generatedPickAssets = initialDraftPending && Number(sourceSeason.draftState.draftYear ?? 2026) === 2026 && hasOfficial2026Assets
? [
...createInitial2026DraftPicks(clubs).map((pick) => savedDraftPickAssets.find((saved: any) => saved.id === pick.id) ?? pick),
...createFutureDraftPicks(2027, clubs, savedDraftPickAssets),
]
: createFutureDraftPicks(firstActiveDraftYear, clubs, savedDraftPickAssets);
const extraSavedPickAssets = savedDraftPickAssets.filter((pick: any) => !generatedPickAssets.some((asset) => asset.id === pick.id));
const reconciledPickAssets = initialDraftPending && !hasOfficial2026Assets
? resolveDraftPickNumbers([...generatedPickAssets, ...extraSavedPickAssets], Number(sourceSeason.draftState.draftYear ?? 2026), sourceSeason.ladder ?? [], clubs, [...basePlayers, ...(sourceSeason.generatedPlayers ?? [])])
: [...generatedPickAssets, ...extraSavedPickAssets];
// A previous setup could append the 2027 picks from both draft windows.
// Deduplicate by stable asset ID while retaining the latest saved owner/state.
const normalizedPickAssets = [...new Map(reconciledPickAssets.map((pick) => [pick.id, pick])).values()];
const savedDraftState = initialDraftPending
? (() => {
const savedDraftYear = Number(sourceSeason.draftState.draftYear ?? 2026);
const currentYearPicks = normalizedPickAssets
.filter((pick) => pick.year === savedDraftYear && pick.resolved)
.sort((a, b) => a.number - b.number);
if (currentYearPicks.length <= Number(sourceSeason.draftState.totalPicks ?? 0)) {
return currentYearPicks.length === sourceSeason.draftState.totalPicks
? { ...sourceSeason.draftState, ...draftPickMetaFields(currentYearPicks) }
: sourceSeason.draftState;
}
const expanded = createDraftState({
draftYear: savedDraftYear,
ladder: sourceSeason.ladder ?? [],
clubs,
initial: Boolean(sourceSeason.draftState.initial),
existingNames: [...basePlayers, ...(sourceSeason.generatedPlayers ?? [])].map((player: any) => player.name),
draftPickAssets: normalizedPickAssets,
playerPool: [...basePlayers, ...(sourceSeason.generatedPlayers ?? [])],
academyClass: Object.values(sourceSeason.academies ?? {}).flatMap((academy: any) => academyDraftClass(academy, savedDraftYear)),
});
const alreadySelected = new Set((sourceSeason.draftState.picks ?? []).map((pick: any) => String(pick.playerId)).filter(Boolean));
return {
...expanded,
...sourceSeason.draftState,
totalPicks: expanded.totalPicks,
...draftPickMetaFields(currentYearPicks),
availableProspects: expanded.availableProspects.filter((prospect) => !alreadySelected.has(String(prospect.id))),
completed: false,
};
})()
: sourceSeason.draftState;
const migratedPlayerContracts = { ...(sourceSeason.playerContracts ?? {}) };
if (initialDraftPending && Number(sourceSeason.draftState.draftYear ?? 2026) === 2026) {
tradePeriodPlayerMoves2026.forEach((move) => {
const contract = migratedPlayerContracts[String(move.playerId)];
// Apply the official roster update to an untouched pre-period save, but
// keep any club change already made by the player during this career.
if (contract?.club === move.fromClub) {
migratedPlayerContracts[String(move.playerId)] = { ...contract, club: move.toClub };
}
});
}
const normalizedGeneratedPlayers = (sourceSeason.generatedPlayers ?? []).map((player: any) => repairPlayerAttributes(player));
const normalizedPlayerDevelopment = { ...(sourceSeason.playerDevelopment ?? {}) };
for (const player of [...basePlayers, ...normalizedGeneratedPlayers]) {
const id = String(player.id);
const saved = normalizedPlayerDevelopment[id];
if (!saved) continue;
const potential = getPlayerPotential({ ...player, development: { ...player.development, potential: saved.potential ?? player.development?.potential } }, player.overall);
normalizedPlayerDevelopment[id] = { ...saved, potential,
...(saved.overall == null ? {} : { overall: capOverallAtPotential({ potential }, saved.overall, potential) }) };
}
const seasonState = {
...sourceSeason,
difficulty: normalizeDifficulty(sourceSeason.difficulty),
managerClubName: sourceSeason.managerClubName ?? [...clubs, tasmaniaDevils].find((club) => club.id === parsed.clubId)?.name ?? null,
playerDevelopment: normalizedPlayerDevelopment,
playerContracts: migratedPlayerContracts,
tradePeriodTransactions: Array.isArray(sourceSeason.tradePeriodTransactions) ? sourceSeason.tradePeriodTransactions : [],
generatedPlayers: normalizedGeneratedPlayers,
draftState: savedDraftState,
draftPickAssets: normalizedPickAssets,
roundHistory: (sourceSeason.roundHistory ?? []).map((entry: any) => ({
...entry,
results: (entry.results ?? []).map((result: any) => attachMatchStatistics(result)),
})),
wildcardResults: (sourceSeason.wildcardResults ?? []).map((result: any) => attachMatchStatistics(result, { awardCoachesVotes: false })),
finalsHistory: (sourceSeason.finalsHistory ?? []).map((week: any) => ({
...week,
results: (week.results ?? []).map((result: any) => attachMatchStatistics(result, { awardCoachesVotes: false })),
})),
seasonArchive: (sourceSeason.seasonArchive ?? []).map((archive: any) => ({
...archive,
roundHistory: (archive.roundHistory ?? []).map((entry: any) => ({
...entry,
results: (entry.results ?? []).map((result: any) => attachMatchStatistics(result)),
})),
wildcardResults: (archive.wildcardResults ?? []).map((result: any) => attachMatchStatistics(result, { awardCoachesVotes: false })),
finalsHistory: (archive.finalsHistory ?? []).map((week: any) => ({
...week,
results: (week.results ?? []).map((result: any) => attachMatchStatistics(result, { awardCoachesVotes: false })),
})),
})),
};
return {
id: typeof parsed.id === "string" ? parsed.id : fallbackId,
version: 1,
mode: parsed.mode,
clubId: parsed.clubId,
activeScreen: validScreens.includes(parsed.activeScreen)
? parsed.activeScreen
: "DASHBOARD",
seasonState,
tactics: normalizeTactics(parsed.tactics),
trainingPlan: validTrainingPlans.includes(parsed.trainingPlan) ? parsed.trainingPlan : defaultTrainingPlan,
userTrainingSchedule: Array.isArray(parsed.userTrainingSchedule) ? parsed.userTrainingSchedule : [],
readInboxMessageIds: Array.isArray(parsed.readInboxMessageIds)
? parsed.readInboxMessageIds.filter((id: unknown): id is string => typeof id === "string")
: [],
calendarDate: typeof parsed.calendarDate === "string" ? parsed.calendarDate : "",
savedAt: parsed.savedAt ?? "",
savedAutomatically: Boolean(parsed.savedAutomatically),
teamSelection: parsed.teamSelection?.selectedSide
? {
...createTeamSelectionState(),
...parsed.teamSelection,
selectedSide: { ...createTeamSelectionState().selectedSide, ...parsed.teamSelection.selectedSide },
customSelections: Array.isArray(parsed.teamSelection.customSelections)
? [parsed.teamSelection.customSelections[0] ?? null, parsed.teamSelection.customSelections[1] ?? null]
: [null, null],
selectionResponsibility: parsed.teamSelection.selectionResponsibility === "ASSISTANT" ? "ASSISTANT" : "COACH",
confirmedForRound: typeof parsed.teamSelection.confirmedForRound === "string" ? parsed.teamSelection.confirmedForRound : null,
selectionHistory: Array.isArray(parsed.teamSelection.selectionHistory) ? parsed.teamSelection.selectionHistory : [],
}
: createTeamSelectionState(),
matchContext: parsed.matchContext ?? null,
matchProgress: parsed.matchProgress ?? null,
playedMatchRound: Number.isFinite(parsed.playedMatchRound) ? parsed.playedMatchRound : null,
};
}

function safeNormalizeCareerSave(parsed: any, fallbackId: string): CareerSave | null {
try { return normalizeCareerSave(parsed, fallbackId); }
catch (error) {
console.warn("A damaged career save was skipped", fallbackId, error);
return null;
}
}

function addTradeOutcome(state: any, outcome: any) {
const timestamp = Date.now();
return {
...state,
tradeOutcomes: [
...(state.tradeOutcomes ?? []),
{
id: `trade-outcome-${timestamp}-${Math.random().toString(36).slice(2, 8)}`,
timestamp,
seasonYear: state.seasonYear,
date: outcome.date ?? "",
...outcome,
},
],
};
}

function createTradePeriodTransaction({ tradePeriodYear, week, date, kind = "TRADE", playerMoves = [], pickMoves = [] }: any) {
const transactionDate = date instanceof Date ? new Date(date) : new Date(date ?? Date.now());
return {
id: `trade-period-transaction-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
tradePeriodYear: Number(tradePeriodYear ?? transactionDate.getFullYear()),
week: Number(week ?? (transactionDate.getDate() <= 11 ? 1 : 2)),
date: transactionDate.toISOString(),
kind,
playerMoves: playerMoves.filter((move: any) => move?.playerName && move?.toClub),
pickMoves: pickMoves.filter((move: any) => move?.pickName && move?.toClub),
};
}

function addTradePeriodTransaction(state: any, transaction: any) {
const recorded = createTradePeriodTransaction(transaction);
const playerContracts = { ...(state.playerContracts ?? {}) };
if (recorded.kind === "TRADE") {
const byName = new Map([...basePlayers, ...(state.generatedPlayers ?? [])].map((player: any) => [player.name, player]));
for (const move of recorded.playerMoves) {
const player = move.playerId ? [...basePlayers, ...(state.generatedPlayers ?? [])].find((item: any) => String(item.id) === String(move.playerId)) : byName.get(move.playerName);
if (player) playerContracts[String(player.id)] = { ...(playerContracts[String(player.id)] ?? {}), lastTradedYear: recorded.tradePeriodYear };
}
}
return {
...state,
playerContracts,
tradePeriodTransactions: [
...(state.tradePeriodTransactions ?? []),
recorded,
],
};
}

function addDueTradePeriodRoundups(state: any, targetDate: Date, fromDate: Date) {
if (state.phase !== "OFFSEASON") return state;
const target = new Date(targetDate);
target.setHours(0, 0, 0, 0);
const start = new Date(fromDate);
start.setHours(0, 0, 0, 0);
const existingIds = new Set((state.mailMessages ?? []).map((message: any) => message.id));
const mailMessages = [...(state.mailMessages ?? [])];

for (let year = start.getFullYear(); year <= target.getFullYear(); year += 1) {
for (const week of [1, 2]) {
const endDay = week === 1 ? 11 : 18;
const availableDate = new Date(year, 9, endDay + 1);
availableDate.setHours(0, 0, 0, 0);
const messageId = `trade-period-roundup-${year}-week-${week}`;
if (target < availableDate) continue;

const transactions = (state.tradePeriodTransactions ?? [])
.filter((entry: any) => Number(entry.tradePeriodYear) === year && Number(entry.week) === week)
.map((entry: any) => ({
kind: entry.kind ?? "TRADE",
playerMoves: entry.playerMoves ?? [],
pickMoves: entry.pickMoves ?? [],
}));
const playerMoves = transactions.flatMap((entry: any) => entry.playerMoves);
const pickMoves = transactions.flatMap((entry: any) => entry.pickMoves);
const freeAgentCount = playerMoves.filter((move: any) => move.freeAgent).length;
const tradePlayerCount = playerMoves.length - freeAgentCount;
const summaryParts = [
tradePlayerCount ? `${tradePlayerCount} player ${tradePlayerCount === 1 ? "move" : "moves"}` : null,
pickMoves.length ? `${pickMoves.length} draft ${pickMoves.length === 1 ? "pick" : "picks"} transferred` : null,
freeAgentCount ? `${freeAgentCount} free-agent ${freeAgentCount === 1 ? "signing" : "signings"}` : null,
].filter(Boolean);

const existing = mailMessages.find((message: any) => message.id === messageId);
if (existing && JSON.stringify(existing.tradeRoundup?.transactions) === JSON.stringify(transactions)) continue;
if (existing) mailMessages.splice(mailMessages.indexOf(existing), 1);
mailMessages.push({
...existing,
id: messageId,
type: "TRADE_PERIOD_ROUNDUP",
heading: "Trade period",
subject: `Trades Completed (Week ${week})`,
date: `Week ending ${endDay} October ${year}`,
receivedAt: availableDate.getTime(),
summary: summaryParts.length ? summaryParts.join(" · ") : "No completed trades or free-agent signings were recorded this week.",
tradeRoundup: { year, week, transactions },
});
existingIds.add(messageId);
}
}

return JSON.stringify(mailMessages) === JSON.stringify(state.mailMessages ?? []) ? state : { ...state, mailMessages };
}

function readCareerSaves(): CareerSave[] {
try {
const rawGames = window.localStorage.getItem(SAVED_GAMES_KEY);
if (rawGames) {
let parsedGames: any;
try { parsedGames = JSON.parse(rawGames); }
catch { parsedGames = null; }
if (Array.isArray(parsedGames)) {
const valid = parsedGames
.slice(0, MAX_SAVED_GAMES)
.map((save, index) => safeNormalizeCareerSave(save, `career-${index}-${save?.clubId}`))
.filter((save): save is CareerSave => Boolean(save))
.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
if (valid.length) return valid;
}
}

const legacyRaw = window.localStorage.getItem(LEGACY_SAVE_KEY);
if (!legacyRaw) return [];
const legacySave = safeNormalizeCareerSave(JSON.parse(legacyRaw), "legacy-career");
return legacySave ? [legacySave] : [];
} catch {
return [];
}
}

function HomeIcon() {
return (
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
<path d="M3 10L12 3L21 10" />
<path d="M5 10V21H19V10" />
</svg>
);
}

function SquadIcon() {
return (
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
<circle cx="9" cy="8" r="3" />
<circle cx="17" cy="8" r="3" />
<path d="M4 20c0-3 3-5 5-5s5 2 5 5" />
<path d="M12 20c0-3 3-5 5-5s5 2 5 5" />
</svg>
);
}

function MedicalIcon() {
return (
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
<path d="M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
<path d="M12 8v8M8 12h8" />
</svg>
);
}

function StatisticsIcon() {
return (
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
<path d="M4 20V11M10 20V5M16 20v-7M22 20H2" />
<path d="m3 8 6-4 6 7 6-6" />
</svg>
);
}

function RecruitmentIcon() {
return (
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
<circle cx="12" cy="12" r="8" />
<circle cx="12" cy="12" r="4" />
<circle cx="12" cy="12" r="1.5" />
</svg>
);
}

function SeasonIcon() {
return (
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
<rect x="3" y="4" width="18" height="17" rx="2" />
<path d="M8 2v4M16 2v4M3 10h18" />
</svg>
);
}

function InboxIcon() {
return (
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
<path d="M4 5h16v14H4z" />
<path d="m4 7 8 6 8-6" />
</svg>
);
}

function TacticsIcon() {
return (
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
<path d="M4 4h16v16H4z" />
<circle cx="8" cy="8" r="1.5" />
<circle cx="16" cy="8" r="1.5" />
<circle cx="12" cy="15" r="1.5" />
<path d="m9.5 9.5 1.5 4m3.5-4-2 4" />
</svg>
);
}

function TrainingIcon() {
return (
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
<path d="M2 10h4l4-4v12l-4-4H2z" />
<path d="M22 10h-4l-4-4v12l4-4h4z" />
</svg>
);
}

function FinanceIcon() {
return (
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
<circle cx="12" cy="12" r="8" />
<path d="M12 8v8" />
<path d="M9 10c0-1 1-2 3-2s3 1 3 2-1 2-3 2-3 1-3 2 1 2 3 2 3-1 3-2" />
</svg>
);
}

function ClubIcon() {
return (
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
<path d="M4 20V8L12 3L20 8V20" />
<path d="M9 20V14H15V20" />
</svg>
);
}

function StadiumIcon() {
return (
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
<ellipse cx="12" cy="12" rx="9" ry="5" />
<ellipse cx="12" cy="12" rx="5" ry="2.5" />
<path d="M3 12V8M21 12V8M3 8c0-2 4-3 9-3s9 1 9 3M21 8c0 2-4 3-9 3s-9-1-9-3" />
</svg>
);
}

function SearchIcon() {
return (
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
<circle cx="10.8" cy="10.8" r="6.8" />
<path d="m16 16 5 5" />
</svg>
);
}

const navigationDestinations: Array<{ label: string; screen: string; tab?: string; parent?: string; keywords: string }> = [
{ label: "Dashboard", screen: "DASHBOARD", keywords: "home overview" },
{ label: "Calendar", screen: "CALENDAR", keywords: "week fixture schedule events" },
{ label: "Daily Calendar", parent: "Calendar", screen: "CALENDAR", tab: "DAY", keywords: "day view" },
{ label: "Weekly Calendar", parent: "Calendar", screen: "CALENDAR", tab: "WEEK", keywords: "week view" },
{ label: "Monthly Calendar", parent: "Calendar", screen: "CALENDAR", tab: "MONTH", keywords: "month view" },
{ label: "Fixtures", parent: "Calendar", screen: "CALENDAR", tab: "FIXTURES", keywords: "match schedule" },
{ label: "Squad", screen: "SQUAD", keywords: "team list players selection contracts negotiations" },
{ label: "Players", parent: "Squad", screen: "SQUAD", tab: "LIST", keywords: "player list roster" },
{ label: "Traits", parent: "Squad · Players", screen: "SQUAD", tab: "LIST_TRAITS", keywords: "player traits" },
{ label: "Leadership Group", parent: "Squad", screen: "SQUAD", tab: "LEADERSHIP", keywords: "captain vice captain club culture morale" },
{ label: "Team Selection", parent: "Squad", screen: "SQUAD", tab: "SELECTION", keywords: "team sheet lineup best 23" },
{ label: "Contracts", parent: "Squad", screen: "SQUAD", tab: "CONTRACTS", keywords: "renew negotiate salary" },
{ label: "Team Selection History", parent: "Squad", screen: "SQUAD", tab: "HISTORY", keywords: "previous rounds team sheets" },
{ label: "Tactics", screen: "TACTICS", keywords: "game plan analytics opposition" },
{ label: "Game Plan", parent: "Tactics", screen: "TACTICS", tab: "GAME_PLAN", keywords: "style sliders instructions" },
{ label: "Analytics · Team view", parent: "Tactics", screen: "TACTICS", tab: "ANALYTICS_TEAM", keywords: "team attributes matchups" },
{ label: "Analytics · Player view", parent: "Tactics", screen: "TACTICS", tab: "ANALYTICS_PLAYER", keywords: "player attributes graph matrix" },
{ label: "Opposition", parent: "Tactics", screen: "TACTICS", tab: "OPPOSITION", keywords: "scout report opponent" },
{ label: "Training", screen: "TRAINING", keywords: "development training centre" },
{ label: "Training Overview", parent: "Training", screen: "TRAINING", tab: "OVERVIEW", keywords: "summary" },
{ label: "Squad Training", parent: "Training", screen: "TRAINING", tab: "SQUAD_TRAINING", keywords: "team program sessions" },
{ label: "Development", parent: "Training", screen: "TRAINING", tab: "DEVELOPMENT", keywords: "growth forecast attributes" },
{ label: "Team Plan", parent: "Training", screen: "TRAINING", tab: "PLAN", keywords: "training schedule" },
{ label: "Medical Room", screen: "INJURY_LIST", keywords: "injuries fitness recovery" },
{ label: "Current Injuries", parent: "Medical Room", screen: "INJURY_LIST", tab: "CURRENT", keywords: "injured unavailable players" },
{ label: "Suspensions", parent: "Medical Room", screen: "INJURY_LIST", tab: "SUSPENSIONS", keywords: "tribunal ban suspended unavailable" },
{ label: "History", parent: "Medical Room", screen: "INJURY_LIST", tab: "HISTORY", keywords: "past injuries suspensions rounds" },
{ label: "Recruitment", screen: "RECRUITMENT", keywords: "trade draft transfer market free agents" },
{ label: "Trade Lab", parent: "Recruitment", screen: "RECRUITMENT", tab: "TRADE", keywords: "shop assets incoming offers player database" },
{ label: "Draft Board", parent: "Recruitment", screen: "RECRUITMENT", tab: "DRAFT", keywords: "national draft picks" },
{ label: "Scouting", parent: "Recruitment", screen: "RECRUITMENT", tab: "SCOUTING", keywords: "scouting assignments reports tactical fit trade draft" },
{ label: "Inbox", screen: "INBOX", keywords: "mail chat messages" },
{ label: "Mail", parent: "Inbox", screen: "INBOX", tab: "MAIL", keywords: "email letters" },
{ label: "Chat", parent: "Inbox", screen: "INBOX", tab: "CHAT", keywords: "player conversations messages" },
{ label: "Statistics", screen: "STATISTICS", keywords: "stats leaders aflca votes" },
{ label: "Player Stats", parent: "Statistics", screen: "STATISTICS", tab: "PLAYER", keywords: "player leaders" },
{ label: "Team Stats", parent: "Statistics", screen: "STATISTICS", tab: "TEAM", keywords: "club rankings" },
{ label: "Match Reports", parent: "Statistics", screen: "STATISTICS", tab: "MATCH", keywords: "match stats results" },
{ label: "AFLCA Votes", parent: "Statistics", screen: "STATISTICS", tab: "AFLCA", keywords: "coaches votes" },
{ label: "Brownlow Medal", parent: "Statistics", screen: "STATISTICS", tab: "BROWNLOW", keywords: "fairest best umpire votes medal count" },
{ label: "Season Hub", screen: "SEASON", keywords: "season results ladder finals match" },
{ label: "Next Round", parent: "Season Hub", screen: "SEASON", tab: "NEXT_ROUND", keywords: "fixture upcoming" },
{ label: "Ladder", parent: "Season Hub", screen: "SEASON", tab: "LADDER", keywords: "standings table" },
{ label: "Results", parent: "Season Hub", screen: "SEASON", tab: "RESULTS", keywords: "completed games match report" },
{ label: "Finals", parent: "Season Hub", screen: "SEASON", tab: "FINALS", keywords: "playoffs" },
{ label: "Administration", screen: "FINANCES", keywords: "club finances board sponsorship facilities" },
{ label: "Finances", parent: "Administration", screen: "FINANCES", tab: "OVERVIEW", keywords: "budget salary cap" },
{ label: "Staff", parent: "Administration", screen: "FINANCES", tab: "STAFF", keywords: "coaches roles" },
{ label: "Facilities", parent: "Administration", screen: "FINANCES", tab: "FACILITIES", keywords: "upgrade training ground" },
{ label: "Commercial", parent: "Administration", screen: "FINANCES", tab: "COMMERCIAL", keywords: "sponsorship memberships" },
{ label: "Board", parent: "Administration", screen: "FINANCES", tab: "BOARD", keywords: "objectives confidence" },
{ label: "Job Market", parent: "Administration", screen: "FINANCES", tab: "JOB_MARKET", keywords: "coach vacancy application manager career clubs" },
{ label: "Club", screen: "CLUBS", keywords: "clubs teams profiles" },
{ label: "Clubs", parent: "Club", screen: "CLUBS", tab: "CLUBS", keywords: "club list profile" },
{ label: "Team Strength", parent: "Club", screen: "CLUBS", tab: "STRENGTH", keywords: "best team ratings comparison" },
{ label: "Settings", screen: "SETTINGS", keywords: "appearance autosave preferences" },
{ label: "Developer", screen: "DEVELOPER_ATTRIBUTES", keywords: "player attribute editor skip to developer ratings" },
{ label: "Player Attribute Editor", parent: "Developer", screen: "DEVELOPER_ATTRIBUTES", tab: "EDITOR", keywords: "edit player ratings" },
{ label: "Skip to", parent: "Developer", screen: "DEVELOPER_ATTRIBUTES", tab: "SKIP", keywords: "first game finals draft brownlow count grand final trade period" },
];

export default function App() {
const [setupStage, setSetupStage] =
useState<"GAME_MODE" | "CLUB_SELECTION" | "CLUB_RESET_DRAFT" | "CAREER">("GAME_MODE");
const [gameMode, setGameMode] = useState<GameMode>("CLASSIC");
const [clubResetDraft, setClubResetDraft] = useState<any>(null);
const [clubResetCareerStart, setClubResetCareerStart] = useState("AFTER_GF");
const [clubResetAutofillBusy, setClubResetAutofillBusy] = useState(false);
const [clubResetDraftError, setClubResetDraftError] = useState("");

const [activeScreen, setActiveScreen] =
useState("CALENDAR");
const [clubProfileClubName, setClubProfileClubName] = useState<string | null>(null);
const [clubProfileReturnScreen, setClubProfileReturnScreen] = useState("SEASON");
const [playerProfileId, setPlayerProfileId] = useState<string | null>(null);
const [playerProfileReturnScreen, setPlayerProfileReturnScreen] = useState("SQUAD");
const [settingsTipsOpen, setSettingsTipsOpen] = useState(false);
const [navigationSearchOpen, setNavigationSearchOpen] = useState(false);
const [navigationSearch, setNavigationSearch] = useState("");
const [navigationRoute, setNavigationRoute] = useState<{ screen: string | null; tab: string | null; sequence: number }>({ screen: null, tab: null, sequence: 0 });

const [delegationSettings, setDelegationSettings] = useState(defaultDelegationSettings);

const [assistantManagedTraining, setAssistantManagedTraining] = useState(true);

const [userTrainingSchedule, setUserTrainingSchedule] = useState([]);

const [managerClub, setManagerClub] =
useState<(typeof clubs)[number] | null>(null);

const [seasonState, setSeasonState] = useState(() => ({ ...createInitialSeasonState(), calendarClock: createClock("2026-10-01", `career-${Date.now()}`) }));
const clubs = leagueClubsForYear(setupStage === "CAREER" ? Number(seasonState.seasonYear ?? 2027) : 2027);
const calendarDate = useMemo(() => localDate(seasonState.calendarClock?.date ?? "2026-10-01"), [seasonState.calendarClock?.date]);
// Only new-career and save-import paths may reset the authoritative clock.
function setCalendarDate(value) {
const date = dayKey(value);
setSeasonState(previous => ({ ...previous, calendarClock: previous.calendarClock?.date === date ? previous.calendarClock : createClock(date, previous.calendarClock?.seed) }));
}
const [calendarProcessing, setCalendarProcessing] = useState(null);
const [calendarError, setCalendarError] = useState("");
const calendarBusy = useRef(false);
const calendarCancel = useRef(false);
const calendarAbort = useRef(null);

const [developerPlayerOverrides, setDeveloperPlayerOverrides] = useState<Record<string, any>>(() => {
if (!import.meta.env.DEV) return {};
try {
const saved = window.localStorage.getItem(DEVELOPER_PLAYER_OVERRIDES_KEY);
return saved ? JSON.parse(saved) : {};
} catch {
return {};
}
});
const allPlayers = useMemo(
() => {
// The game-mode landing page does not need a hydrated league roster.
// Defer repairing/merging every player's career attributes until the
// user enters club selection or resumes a career.
if (setupStage === "GAME_MODE") return [];
const removedIds = new Set((seasonState.fantasyRemovedPlayerIds ?? []).map(String));
return [...basePlayers, ...(seasonState.generatedPlayers ?? [])]
.filter((sourcePlayer) => !removedIds.has(String(sourcePlayer.id)))
.map((sourcePlayer) => {
const player = repairPlayerAttributes(sourcePlayer);
const learned = seasonState.playerDevelopment?.[String(player.id)];
const careerPositions = [...new Set([...(player.positions ?? []), ...(learned?.learnedPositions ?? []), ...(learned?.positionTraining?.complete && learned.positionTraining.target ? [learned.positionTraining.target] : [])])];
const developerOverride = developerPlayerOverrides[String(player.id)];
const fantasyEdit = seasonState.fantasyPlayerEdits?.[String(player.id)];
const override = (developerOverride || fantasyEdit) ? { ...(developerOverride ?? {}), ...(fantasyEdit ?? {}) } : null;
return override
? { ...player, ...override, positions: [...new Set([...(override.positions ?? careerPositions), ...careerPositions])], attributes: { ...player.attributes, ...(override.attributes ?? {}) } }
: { ...player, positions: careerPositions };
});
},
[setupStage, seasonState.generatedPlayers, seasonState.fantasyPlayerEdits, seasonState.fantasyRemovedPlayerIds, seasonState.playerDevelopment, developerPlayerOverrides],
);

// Search covers screens and tabs, clubs and players.
type SearchItem = { kind: "screen" | "club" | "player"; key: string; label: string; sub?: string; screen?: string; tab?: string; clubName?: string; playerId?: string };
const navigationSearchResults = useMemo<SearchItem[]>(() => {
const query = navigationSearch.trim().toLowerCase();
if (!query) return [];
const screens: SearchItem[] = navigationDestinations
.filter((destination) => destination.screen !== "DEVELOPER_ATTRIBUTES" || import.meta.env.DEV)
.filter((destination) => `${destination.label} ${destination.parent ?? ""} ${destination.keywords}`.toLowerCase().includes(query))
.slice(0, 4)
.map((destination) => ({ kind: "screen", key: `screen-${destination.screen}-${destination.tab ?? "ROOT"}`, label: destination.label, sub: destination.parent, screen: destination.screen, tab: destination.tab }));
const clubResults: SearchItem[] = clubs
.filter((club) => `${club.name} ${club.abbreviation ?? ""}`.toLowerCase().includes(query))
.slice(0, 3)
.map((club) => ({ kind: "club", key: `club-${club.id}`, label: club.name, sub: "Club", clubName: club.name }));
const rankPerson = (name: string) => {
const lower = name.toLowerCase();
return lower.startsWith(query) || lower.split(" ").some((part) => part.startsWith(query)) ? 0 : 1;
};
const rosterIds = new Set(allPlayers.map((player) => String(player.id)));
const people: Array<SearchItem & { rank: number; overall: number }> = query.length < 2 ? [] : [
...allPlayers
.filter((player) => String(player.name ?? "").toLowerCase().includes(query))
.map((player) => ({ kind: "player" as const, key: `player-${player.id}`, label: player.name, rank: rankPerson(String(player.name)), overall: player.overall ?? 0,
sub: `Player · ${getCareerClub(player, seasonState.playerContracts ?? {}) || "Unsigned"} · ${(player.positions ?? []).join("/")} · ${player.overall ?? "?"} OVR`, playerId: String(player.id) })),
// The current draft class and the academy / father-son players of future drafts.
...(seasonState.draftState?.availableProspects ?? [])
.filter((prospect: any) => !rosterIds.has(String(prospect.id)) && String(prospect.name ?? "").toLowerCase().includes(query))
.map((prospect: any) => ({ kind: "player" as const, key: `prospect-${prospect.id}`, label: prospect.name, rank: rankPerson(String(prospect.name)), overall: prospect.overall ?? 0,
sub: `Draft prospect · ${seasonState.draftState?.draftYear ?? ""} draft · ${(prospect.positions ?? []).join("/")}${prospect.juniorClub ? ` · ${prospect.juniorClub}` : ""}`, playerId: String(prospect.id) })),
...Object.values(seasonState.academies ?? {}).flatMap((academy: any) => (academy?.players ?? [])
.filter((prospect: any) => !rosterIds.has(String(prospect.id)) && String(prospect.name ?? "").toLowerCase().includes(query))
.map((prospect: any) => ({ kind: "player" as const, key: `academy-${prospect.id}`, label: prospect.name, rank: rankPerson(String(prospect.name)), overall: prospect.ability ?? 0,
sub: `Academy prospect · ${academy.clubName} · ${prospect.draftYear} draft · ${(prospect.positions ?? []).join("/")}`, playerId: String(prospect.id) }))),
];
const playerResults: SearchItem[] = people
.sort((a, b) => a.rank - b.rank || b.overall - a.overall)
.slice(0, 8)
.map(({ rank, overall, ...item }) => item);
return [...screens, ...clubResults, ...playerResults];
}, [navigationSearch, allPlayers, clubs, seasonState.playerContracts, seasonState.draftState, seasonState.academies]);

useEffect(() => {
if (!import.meta.env.DEV) return;
try {
window.localStorage.setItem(DEVELOPER_PLAYER_OVERRIDES_KEY, JSON.stringify(developerPlayerOverrides));
} catch {
// Developer edits remain in memory if browser storage is unavailable.
}
}, [developerPlayerOverrides]);
const facilityBonuses = useMemo(
() => getFacilityBonuses(seasonState.clubAdministration?.facilities, seasonState.clubAdministration?.staff),
[seasonState.clubAdministration?.facilities, seasonState.clubAdministration?.staff],
);

const [tactics, setTactics] = useState<TacticsPlan>(() => normalizeTactics(defaultTactics));

const [trainingPlan, setTrainingPlan] = useState<TeamTrainingPlan>(defaultTrainingPlan);

const [readInboxMessageIds, setReadInboxMessageIds] = useState<string[]>([]);
const [matchContext, setMatchContext] = useState<any>(null);
const [matchProgress, setMatchProgress] = useState<any>(null);
const matchProgressRef = useRef(matchProgress);
const lastMatchProgressPublishRef = useRef(0);
const handleMatchStateChange = useCallback((nextMatch: any) => {
matchProgressRef.current = nextMatch;
const now = Date.now();
if (nextMatch?.status !== "LIVE" || now - lastMatchProgressPublishRef.current >= 5000) {
lastMatchProgressPublishRef.current = now;
setMatchProgress(nextMatch);
}
}, []);
const [playedMatchRound, setPlayedMatchRound] = useState<number | null>(null);
const [teamSelection, setTeamSelection] = useState(() => createTeamSelectionState());
const [focusTeamSelection, setFocusTeamSelection] = useState(false);
// Where the Administration screen should open (set by dashboard shortcuts).
const [financeNav, setFinanceNav] = useState<{ tab: string; playerId: any }>({ tab: "OVERVIEW", playerId: null });
const [squadInitialTab, setSquadInitialTab] = useState("LIST");
const [playerFitness, setPlayerFitness] = useState<Record<string, any>>({});
const [timeOnGround, setTimeOnGround] = useState<Record<string, number>>({});

const [collapsed, setCollapsed] =
useState(false);

const [saveStatus, setSaveStatus] =
useState("");
const lastSaveErrorRef = useRef("");

const [showExitPrompt, setShowExitPrompt] = useState(false);

const [savedGames, setSavedGames] = useState<CareerSave[]>(() => readCareerSaves());
const savedGamesRef = useRef(savedGames);
const activeSaveIdRef = useRef<string | null>(null);
const [cloudUser, setCloudUser] = useState<any>(null);
const cloudUserRef = useRef<any>(null);
const [cloudBusy, setCloudBusy] = useState(() => cloudSavesAvailable());
const [cloudMessage, setCloudMessage] = useState("");
const [passwordRecovery, setPasswordRecovery] = useState(false);
const [localCareersAvailable, setLocalCareersAvailable] = useState(0);

useEffect(() => {
if (!cloudSavesAvailable()) return;
let cancelled = false;
let requestId = 0;
const applySession = async (session: any) => {
if (cancelled) return;
if ((session?.user?.id ?? null) === (cloudUserRef.current?.id ?? null)) {
setCloudBusy(false);
return;
}
const thisRequest = ++requestId;
const user = session?.user ?? null;
cloudUserRef.current = user;
setCloudUser(user);
activeSaveIdRef.current = null;
if (!user) {
const databaseLocal = await readCareerSavesFromDatabase().catch(() => []);
const local = (databaseLocal.length ? databaseLocal : readCareerSaves())
.map((save: any, index: number) => safeNormalizeCareerSave(save, `guest-${index}`)).filter(Boolean);
if (cancelled || thisRequest !== requestId) return;
savedGamesRef.current = local;
setSavedGames(local);
setCloudMessage("");
return;
}
setCloudBusy(true);
try {
const databaseLocal = await readCareerSavesFromDatabase().catch(() => []);
const local = databaseLocal.length ? databaseLocal : readCareerSaves();
const guestSaves = local.map((save: any, index: number) => safeNormalizeCareerSave(save, `local-${index}`)).filter(Boolean);
setLocalCareersAvailable(guestSaves.length);
const rows = await listCloudCareers(user.id);
const cloudSaves = rows.saves.map((save: any, index: number) => safeNormalizeCareerSave(save, `cloud-${index}`)).filter(Boolean);
const cachedRecord = readAccountCacheRecord(user.id);
const cached = cachedRecord.saves;
const combined = [...cloudSaves];
const stillPending: string[] = [];
for (const save of cached.filter((item) => cachedRecord.pendingIds.includes(item.id))) {
const existing = combined.findIndex((item) => item.id === save.id);
if (existing < 0 || save.savedAt > combined[existing].savedAt) {
try { await putCloudCareer(user.id, save); }
catch { stillPending.push(save.id); }
if (existing < 0) combined.push(save); else combined[existing] = save;
}
}
combined.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
if (cancelled || thisRequest !== requestId) return;
savedGamesRef.current = combined.slice(0, MAX_SAVED_GAMES);
setSavedGames(savedGamesRef.current);
writeAccountCache(user.id, savedGamesRef.current, stillPending);
setCloudMessage(rows.damagedCount ? `${rows.damagedCount} damaged cloud ${rows.damagedCount === 1 ? "career was" : "careers were"} skipped. Contact support before deleting any saves.` : stillPending.length ? "Cloud careers loaded. Some device saves still need to sync; reconnect and sign in again." : "Cloud careers loaded.");
} catch (error) {
if (!cancelled && thisRequest === requestId) {
const cached = readAccountCache(user.id);
savedGamesRef.current = cached;
setSavedGames(cached);
setCloudMessage("Could not load cloud careers. Check your connection and try again. Your browser saves are untouched.");
}
} finally {
if (!cancelled && thisRequest === requestId) setCloudBusy(false);
}
};
const unsubscribe = subscribeToCloudAuth((session: any, event: string) => {
if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
applySession(session);
});
return () => { cancelled = true; unsubscribe(); };
}, []);

useEffect(() => {
let cancelled = false;
const initialSaves = savedGamesRef.current;
readCareerSavesFromDatabase().then(async (databaseSaves) => {
if (savedGamesRef.current !== initialSaves) return;
const localSaves = savedGamesRef.current;
if (!databaseSaves.length && localSaves.length) {
await writeCareerSavesToDatabase(localSaves);
}
const availableSaves = databaseSaves.length ? databaseSaves : localSaves;
const normalized = availableSaves
.map((save, index) => safeNormalizeCareerSave(save, `career-${index}-${save?.clubId}`))
.filter((save): save is CareerSave => Boolean(save))
.sort((a, b) => b.savedAt.localeCompare(a.savedAt))
.slice(0, MAX_SAVED_GAMES);
if (cancelled || cloudUserRef.current) return;
savedGamesRef.current = normalized;
setSavedGames(normalized);
}).catch(() => {
// Existing localStorage saves remain usable if IndexedDB is unavailable.
});
return () => { cancelled = true; };
}, []);

const [autoSaveMode, setAutoSaveMode] = useState<AutoSaveMode>(() => {
try {
const savedMode = window.localStorage.getItem("afl-manager-autosave-mode");
if (savedMode === "OFF" || savedMode === "ON_CHANGE" || savedMode === "5_MIN" || savedMode === "15_MIN") {
return savedMode;
}
return window.localStorage.getItem("afl-manager-autosave") === "true" ? "ON_CHANGE" : "OFF";
} catch {
return "OFF";
}
});

const [appearanceMode, setAppearanceMode] = useState<"dark" | "light">(() => {
try {
return window.localStorage.getItem("afl-manager-appearance") === "light"
? "light"
: "dark";
} catch {
return "dark";
}
});

const [textSize, setTextSize] = useState<TextSize>(() => {
try {
const savedSize = window.localStorage.getItem("afl-manager-text-size");
return savedSize === "LARGE" || savedSize === "EXTRA_LARGE" ? savedSize : "STANDARD";
} catch {
return "STANDARD";
}
});

const [progressionMode, setProgressionMode] = useState<ProgressionMode>(() => {
try {
const savedMode = window.localStorage.getItem("afl-manager-progression-mode");
return savedMode === "OPTIMIZED" || savedMode === "DAILY" ? savedMode : "BALANCED";
} catch {
return "BALANCED";
}
});

const [difficultyMode, setDifficultyMode] = useState<DifficultyMode>(() => {
try {
return normalizeDifficulty(window.localStorage.getItem("afl-manager-difficulty")) as DifficultyMode;
} catch {
return "EXPERIENCED";
}
});

const lightMode = appearanceMode === "light";
const finalsSeriesTheme = ["WILDCARD", "FINALS"].includes(seasonState?.phase);
const finalsGold = "#d6b44a";
const inboxUnreadCount = useMemo(() =>
[...createInboxMail(managerClub ?? clubs[0], seasonState), ...createInboxChats(managerClub ?? clubs[0], seasonState)]
.filter((message) => !readInboxMessageIds.includes(message.id)).length,
[managerClub?.id, seasonState, readInboxMessageIds],
);

useEffect(() => {
document.documentElement.dataset.appearance = appearanceMode;
document.documentElement.style.colorScheme = appearanceMode;
return () => {
delete document.documentElement.dataset.appearance;
document.documentElement.style.colorScheme = "";
};
}, [appearanceMode]);

// Finish facility upgrades once their completion date arrives on the calendar.
useEffect(() => {
const projects = seasonState?.clubAdministration?.facilityProjects;
const today = seasonState?.calendarClock?.date;
if (!projects || !Object.keys(projects).length || !today) return;
setSeasonState((previous: any) => {
const admin = previous?.clubAdministration;
if (!admin) return previous;
const completed = completeFacilityProjects(admin, previous.calendarClock?.date ?? today);
if (completed === admin) return previous;
return {
...previous,
clubAdministration: completed,
...(completed.facilities?.academy ? { academies: Object.fromEntries(Object.entries(previous.academies ?? {}).map(([name, academy]: any) => [name, { ...academy, level: Math.max(Number(academy.level ?? 1), Number(completed.facilities.academy)) }])) } : {}),
leagueAdministration: previous.managerClubName
? { ...(previous.leagueAdministration ?? {}), [previous.managerClubName]: completed }
: previous.leagueAdministration,
};
});
}, [seasonState?.calendarClock?.date, seasonState?.clubAdministration?.facilityProjects]);

// New games and older saves only hold the manager's club administration until the calendar sim starts.
// Fill in every other club's staff so the staff market's "Other clubs" tab has people to approach.
useEffect(() => {
if (!seasonState?.managerClubName || !seasonState?.clubAdministration) return;
const existing = seasonState.leagueAdministration ?? {};
const needsFill = clubs.some((item) => item.name !== seasonState.managerClubName && (!(existing[item.name]?.staff?.length) || !existing[item.name]?.staffRatingsSeeded));
const managerEntryStale = existing[seasonState.managerClubName] !== seasonState.clubAdministration;
if (!needsFill && !managerEntryStale) return;
setSeasonState((previous: any) => {
if (!previous?.managerClubName || !previous?.clubAdministration) return previous;
const current = previous.leagueAdministration ?? {};
const allCareerPlayers = [...basePlayers, ...(previous.generatedPlayers ?? [])];
const filled: Record<string, any> = { ...current };
for (const item of clubs) {
if (item.name === previous.managerClubName) continue;
if (filled[item.name]?.staff?.length && filled[item.name]?.staffRatingsSeeded) continue;
if (filled[item.name]?.staff?.length) { filled[item.name] = applyLeagueStaffRatings(filled[item.name], item.name); continue; }
const clubRoster = allCareerPlayers.filter((player) => getCareerClub(player, previous.playerContracts ?? {}) === item.name);
const created = createClubAdministrationState(item, clubRoster, previous.seasonYear ?? 2027, previous.playerContracts);
filled[item.name] = applyLeagueStaffRatings({ ...created, ...(filled[item.name] ?? {}), staff: created.staff, staffPool: filled[item.name]?.staffPool ?? created.staffPool }, item.name);
}
filled[previous.managerClubName] = previous.clubAdministration;
return { ...previous, leagueAdministration: filled };
});
}, [seasonState?.managerClubName, seasonState?.clubAdministration, seasonState?.leagueAdministration]);

// Tasmania career: simulate the first season, then hand control to the manager.
const tasmaniaSimulationStarted = useRef(false);
useEffect(() => {
if (setupStage !== "CAREER" || !managerClub || seasonState.expansionCareer?.stage !== "SIMULATING" || tasmaniaSimulationStarted.current) return;
tasmaniaSimulationStarted.current = true;
void runTasmaniaFirstSeason().finally(() => { tasmaniaSimulationStarted.current = false; });
}, [setupStage, managerClub, seasonState.expansionCareer?.stage]);

const handleModeSelect = (mode: string) => {
if (!GAME_MODES.includes(mode as GameMode)) return;
setGameMode(mode);
setSetupStage("CLUB_SELECTION");
};

const handleClubSelect = (club: (typeof clubs)[number], careerStart = "AFTER_GF") => {
if (gameMode === "CLUB_RESET") {
const listedPlayers = basePlayers.filter(player => player.club && player.club !== "-" && player.rosterStatus !== "DELISTED");
const openingContracts = createInitialLeaguePlayerContracts(listedPlayers, clubs, 2027);
const prospects = createCurrentYearDraftProspects({ draftYear: 2026, existingNames: listedPlayers.map(player => player.name) });
const resetDraft = createClubResetDraft({ players: listedPlayers, prospects, clubs, userClub: club.name, contracts: openingContracts, seasonYear: 2027 });
activeSaveIdRef.current = null;
setManagerClub(club);
setClubResetCareerStart(careerStart);
setClubResetDraft(resetDraft);
setClubResetDraftError("");
setSetupStage("CLUB_RESET_DRAFT");
return;
}
if (club.id === tasmaniaDevils.id && careerStart === TASMANIA_CAREER.id) {
// Tasmania has no list and no fixture in 2027. The first season is simulated for the 18 existing
// clubs by runTasmaniaFirstSeason, which hands control to the manager when the concession window opens.
activeSaveIdRef.current = null;
const tasmania: any = club;
setManagerClub(tasmania);
const tasInitialSeason = createTasmaniaCareerStartState(createInitialSeasonState());
// The 2026 draft is pending, as in an "After the GF" start. It is auto-drafted for every club while the
// first season is simulated, so draftees join their clubs before Tasmania takes over.
const tasPickAssets = [...new Map([...createInitial2026DraftPicks(clubs), ...createFutureDraftPicks(2027, clubs)].map((pick: any) => [pick.id, pick])).values()];
const tasDraftState = createDraftState({ draftYear: 2026, ladder: tasInitialSeason.ladder, clubs, initial: true, existingNames: basePlayers.map((player) => player.name), draftPickAssets: tasPickAssets, playerPool: basePlayers });
const tasContracts = createInitialLeaguePlayerContracts(basePlayers, clubs, 2027);
const tasAdministration = createClubAdministrationState(tasmania, [], 2027, tasContracts);
setSeasonState({
...tasInitialSeason,
difficulty: difficultyMode,
managerClubName: tasmania.name,
generatedPlayers: [],
draftState: tasDraftState,
draftPickAssets: tasPickAssets,
draftHistory: [],
playerContracts: tasContracts,
clubAdministration: tasAdministration,
academies: { [tasmania.name]: createAcademy({ clubName: tasmania.name, seed: `academy:${tasmania.name}:2027`, firstDraftYear: 2027, seasonYear: 2027, administration: tasAdministration }) },
});
setTactics({ ...defaultTactics });
setTrainingPlan(defaultTrainingPlan);
setReadInboxMessageIds([]);
setMatchContext(null);
setDelegationSettings(defaultDelegationSettings);
setAssistantManagedTraining(true);
setUserTrainingSchedule([]);
setActiveScreen("SEASON");
setSetupStage("CAREER");
setPlayerFitness({});
setTimeOnGround({});
setTeamSelection(createTeamSelectionState());
matchProgressRef.current = null;
setMatchProgress(null);
setPlayedMatchRound(null);
return;
}
activeSaveIdRef.current = null;
setManagerClub(club);
const initialSeason = createCareerStartState(createInitialSeasonState(), careerStart);
const initialDraftPickAssets = careerStart === "PRESEASON" ? [] : createInitial2026DraftPicks(clubs);
const combinedDraftPickAssets = [
...initialDraftPickAssets,
...createFutureDraftPicks(2027, clubs),
];
const draftPickAssets = [...new Map(combinedDraftPickAssets.map((pick) => [pick.id, pick])).values()];
const draftState = careerStart === "PRESEASON" ? completedOpeningDraftState() : createDraftState({
draftYear: 2026,
ladder: initialSeason.ladder,
clubs,
initial: true,
existingNames: basePlayers.map((player) => player.name),
draftPickAssets,
playerPool: basePlayers,
});
const clubPlayers = basePlayers.filter((p) => p.club === club.name);
const generatedContracts = createInitialLeaguePlayerContracts(basePlayers, clubs, 2027);
const playerContracts = generatedContracts;
const clubAdministration = createClubAdministrationState(club, clubPlayers, 2027, playerContracts);
setSeasonState({
...initialSeason,
difficulty: difficultyMode,
managerClubName: club.name,
generatedPlayers: [],
draftState,
draftPickAssets,
draftHistory: [],
playerContracts,
clubAdministration,
academies: { [club.name]: createAcademy({ clubName: club.name, seed: `academy:${club.name}:2027`, firstDraftYear: 2027, seasonYear: 2027, administration: clubAdministration }) },
});
setTactics({ ...defaultTactics });
setTrainingPlan(defaultTrainingPlan);
setReadInboxMessageIds([]);
setMatchContext(null);
setDelegationSettings(defaultDelegationSettings);
setAssistantManagedTraining(true);
setUserTrainingSchedule([]);
setActiveScreen("SEASON");
setSetupStage("CAREER");
setPlayerFitness(initializeFitnessState(clubPlayers));
setTimeOnGround(getDefaultTOGForSquad(clubPlayers));
setTeamSelection(createTeamSelectionState());
matchProgressRef.current = null;
setMatchProgress(null);
setPlayedMatchRound(null);
};

function completeClubResetDraft(draft) {
const club = managerClub ?? clubs.find(item => item.name === draft.userClub) ?? clubs[0];
const initialSeason = createCareerStartState(createInitialSeasonState(), clubResetCareerStart);
const rosterFor = clubName => draft.players.filter(player => draft.playerContracts[String(player.id)]?.club === clubName);
const userRoster = rosterFor(club.name);
const leagueAdministration = Object.fromEntries(clubs.map(item => [item.name, createClubAdministrationState(item, rosterFor(item.name), 2027, draft.playerContracts)]));
const resetDraftRecord = { draftYear: 2026, draftOrder: draft.pickOwners.slice(0, draft.clubs.length), picks: draft.picks, initial: true, kind: "CLUB_RESET" };
const seasonDraftState = completedOpeningDraftState();
const draftPickAssets = createFutureDraftPicks(2027, clubs);
setSeasonState({
...initialSeason,
difficulty: difficultyMode,
managerClubName: club.name,
gameMode: "CLUB_RESET",
generatedPlayers: draft.players.filter(player => player.isDraftProspect),
playerContracts: draft.playerContracts,
draftState: seasonDraftState,
draftPickAssets,
draftHistory: [resetDraftRecord],
clubAdministration: leagueAdministration[club.name],
leagueAdministration,
clubResetDraftResults: draft.picks,
});
setTactics({ ...defaultTactics });
setTrainingPlan(defaultTrainingPlan);
setReadInboxMessageIds([]);
setMatchContext(null);
setDelegationSettings(defaultDelegationSettings);
setAssistantManagedTraining(true);
setUserTrainingSchedule([]);
setActiveScreen("SEASON");
setPlayerFitness(initializeFitnessState(userRoster));
setTimeOnGround(getDefaultTOGForSquad(userRoster));
setTeamSelection(createTeamSelectionState());
matchProgressRef.current = null;
setMatchProgress(null);
setPlayedMatchRound(null);
setClubResetDraft(null);
setSetupStage("CAREER");
}

function handleClubResetDraftPick(playerId: string) {
if (clubResetAutofillBusy) return;
const selection = selectClubResetPlayer(clubResetDraft, playerId);
if (selection.error) { setClubResetDraftError(selection.error); return; }
setClubResetDraftError("");
const nextDraft = advanceClubResetDraftToUser(selection.state);
if (nextDraft.completed) completeClubResetDraft(nextDraft);
else setClubResetDraft(nextDraft);
}

async function handleClubResetAutofill() {
if (!clubResetDraft || clubResetAutofillBusy) return;
setClubResetAutofillBusy(true);
setClubResetDraftError("");
let current = clubResetDraft;
try {
while (!current.completed) {
const result = autofillClubResetDraft(current, 2);
current = result.state;
if (result.error) {
setClubResetDraft(current);
setClubResetDraftError(result.error);
return;
}
setClubResetDraft(current);
// Yield between batches so the pick ledger and available pool can update.
await new Promise(resolve => setTimeout(resolve, 0));
}
completeClubResetDraft(current);
} catch (error) {
setClubResetDraft(current);
setClubResetDraftError(error instanceof Error ? error.message : "Autofill could not finish the draft.");
} finally {
setClubResetAutofillBusy(false);
}
}

function prepareTeamSheet(seasonSnapshot = seasonState) {
if (["OFFSEASON", "POST_SEASON"].includes(seasonSnapshot.phase)) return false;
const currentClub = managerClub ?? clubs[0];
const clubPlayers = allPlayers.filter((player) => getCareerClub(player, seasonSnapshot.playerContracts) === currentClub.name);
const currentRound = getTeamSheetRoundKey(seasonSnapshot);
const selectionStatus = getTeamSelectionStatus(teamSelection, clubPlayers, playerFitness);
if (selectionStatus.complete && teamSelection.confirmedForRound === currentRound) return true;

if (teamSelection.selectionResponsibility === "ASSISTANT") {
const assistantSelection = selectionStatus.complete
? teamSelection
: createAssistantTeamSelection(getAvailablePlayers(clubPlayers, playerFitness), teamSelection);
const confirmedSelection = { ...assistantSelection, confirmedForRound: currentRound };
const nextSelection = appendTeamSheetHistory(confirmedSelection, createTeamSheetHistoryEntry(confirmedSelection, seasonSnapshot, currentClub.name));
setTeamSelection(nextSelection);
const assistantSelectionComplete = getTeamSelectionStatus(nextSelection, clubPlayers, playerFitness).complete;
if (!assistantSelectionComplete) {
setFocusTeamSelection(true);
setActiveScreen("SQUAD");
}
return assistantSelectionComplete;
}

setFocusTeamSelection(true);
setActiveScreen("SQUAD");
return false;
}

function isCurrentTeamSheetConfirmed(seasonSnapshot = seasonState) {
const currentClub = managerClub ?? clubs[0];
const clubPlayers = allPlayers.filter((player) => getCareerClub(player, seasonSnapshot.playerContracts) === currentClub.name);
return getTeamSelectionStatus(teamSelection, clubPlayers, playerFitness).complete
&& teamSelection.confirmedForRound === getTeamSheetRoundKey(seasonSnapshot);
}

function launchMatch(match) {
if (hasResult(seasonState, match)) return;
if (dayKey(match.date) > dayKey(calendarDate) || (seasonState.calendarClock?.slot ?? 0) < 2) {
runCalendar(dayKey(match.date)); return;
}
if (!prepareTeamSheet()) return;
const homeTeam = match.homeTeam ?? match.home;
const awayTeam = match.awayTeam ?? match.away;
const managerName = (managerClub ?? clubs[0]).name;
const opponentName = homeTeam === managerName ? awayTeam : homeTeam;
const opponent = clubs.find((item) => item.name === opponentName) ?? clubs[0];
const previousFixture = matchContext?.fixture;
const isResumingSameFixture = previousFixture &&
(previousFixture.homeTeam ?? previousFixture.home) === homeTeam &&
(previousFixture.awayTeam ?? previousFixture.away) === awayTeam &&
previousFixture.round === match.round;
setPlayedMatchRound(match.round ?? seasonState.round);
if (!isResumingSameFixture) {
matchProgressRef.current = null;
setMatchProgress(null);
}
setMatchContext({ fixture: match, opponent });
setActiveScreen("MATCH_DAY");
}

// Go to a screen. Shortcuts to Administration can pick a tab and a player to negotiate with.
function navigateTo(screen: string, options: { tab?: string; playerId?: any } = {}) {
setNavigationRoute((previous) => ({ screen, tab: options.tab ?? null, sequence: previous.sequence + 1 }));
if (screen === "FINANCES" && ["CONTRACTS", "NEGOTIATION"].includes(options.tab ?? "")) {
setSquadInitialTab(options.tab!);
setActiveScreen("SQUAD");
return;
}
if (screen === "FINANCES") setFinanceNav({ tab: options.tab ?? "OVERVIEW", playerId: options.playerId ?? null });
setActiveScreen(screen);
}

function openClubProfile(clubName: string) {
if (!clubs.some((club) => club.name === clubName)) return;
setClubProfileReturnScreen(activeScreen);
setClubProfileClubName(clubName);
setActiveScreen("CLUB_PROFILE");
}

// Rostered players, the current draft class and academy / father-son prospects of future drafts.
function findProfilePlayer(playerId: string | null): any {
if (playerId == null) return null;
const id = String(playerId);
const rostered = allPlayers.find((player) => String(player.id) === id);
if (rostered) return { ...rostered, club: getCareerClub(rostered, seasonState.playerContracts ?? {}) };
const draftProspect = (seasonState.draftState?.availableProspects ?? []).find((prospect: any) => String(prospect.id) === id);
if (draftProspect) return { ...scoutingCandidateForProspect(draftProspect), club: "", juniorClub: draftProspect.juniorClub, draftProspect: true };
for (const academy of Object.values(seasonState.academies ?? {}) as any[]) {
const academyPlayer = (academy?.players ?? []).find((prospect: any) => String(prospect.id) === id);
if (academyPlayer) {
// Scouts only see an estimate of potential, never the hidden true value.
const estimate = Math.max(academyPlayer.ability, Math.round(academyPlayer.truePotential + (academyPlayer.bias ?? 0)));
return { ...scoutingCandidateForProspect({ ...academyPlayer, overall: academyPlayer.ability, potential: estimate }), club: "", juniorClub: academyPlayer.juniorClub, draftProspect: true };
}
}
return null;
}

function openPlayerProfile(playerId: string) {
if (!findProfilePlayer(playerId)) return;
setPlayerProfileReturnScreen(activeScreen === "PLAYER_PROFILE" ? playerProfileReturnScreen : activeScreen);
setPlayerProfileId(String(playerId));
setActiveScreen("PLAYER_PROFILE");
}

function openSearchResult(item: { kind: string; screen?: string; tab?: string; clubName?: string; playerId?: string }) {
if (item.kind === "club" && item.clubName) openClubProfile(item.clubName);
else if (item.kind === "player" && item.playerId) openPlayerProfile(item.playerId);
else if (item.screen) navigateTo(item.screen, { tab: item.tab });
setNavigationSearchOpen(false);
setNavigationSearch("");
}

function closeClubProfile() {
setActiveScreen(clubProfileReturnScreen);
setClubProfileClubName(null);
}

function handleApplyForJob(clubName: string) {
const destination = clubs.find(item => item.name === clubName);
if (!destination) return { accepted: false, error: "That club is unavailable." };
const market = getJobMarket(seasonState.jobMarket, clubs, managerClub?.name, seasonState.seasonYear);
const result = applyForCoachingJob(market, clubName, managerClub?.name, seasonState.seasonYear, dayKey(calendarDate));
if (!result.accepted) {
if (result.market !== market) setSeasonState(previous => ({ ...previous, jobMarket: result.market }));
return result;
}
const nextRoster = allPlayers.filter(player => getCareerClub(player, seasonState.playerContracts) === destination.name);
setSeasonState(previous => {
const leagueAdministration = { ...(previous.leagueAdministration ?? {}) };
if (managerClub?.name && previous.clubAdministration) leagueAdministration[managerClub.name] = previous.clubAdministration;
const incomingAdministration = leagueAdministration[destination.name]
?? createClubAdministrationState(destination, nextRoster, previous.seasonYear, previous.playerContracts);
leagueAdministration[destination.name] = incomingAdministration;
return {
...previous,
managerClubName: destination.name,
clubAdministration: incomingAdministration,
leagueAdministration,
jobMarket: result.market,
calendarSelectionFixtureId: null,
calendarDecisions: (previous.calendarDecisions ?? []).filter(event => event.status !== "PENDING"),
pendingAITradeOffers: [],
};
});
setManagerClub(destination);
setPlayerFitness(previous => ({ ...initializeFitnessState(nextRoster), ...previous }));
setTimeOnGround(getDefaultTOGForSquad(nextRoster));
setTeamSelection(createTeamSelectionState());
setTactics({ ...defaultTactics });
setTrainingPlan(defaultTrainingPlan);
setUserTrainingSchedule([]);
setReadInboxMessageIds([]);
setMatchContext(null);
matchProgressRef.current = null;
setMatchProgress(null);
setPlayedMatchRound(null);
setFinanceNav({ tab: "JOB_MARKET", playerId: null });
setNavigationRoute(previous => ({ screen: "FINANCES", tab: "JOB_MARKET", sequence: previous.sequence + 1 }));
setActiveScreen("FINANCES");
return { accepted: true, message: `${destination.name} has appointed you as coach.` };
}

function respondToPlayerRequest(chatId: string, response: string) {
const request = (seasonState.chatMessages ?? []).find((message: any) => message.id === chatId && message.type === "PLAYER_REQUEST");
if (!request || request.status !== "PENDING") return;
const id = String(request.playerId);
if (response === "APPROVE_REST") setPlayerFitness((previous) => ({ ...previous, [id]: { ...previous[id], trainingProgram: "REST", workload: Math.max(0, Number(previous[id]?.workload ?? 0) - 10) } }));
if (["WELCOME_RECRUIT", "DISMISS_RECRUITMENT_CONCERN"].includes(response)) {
const moraleDelta = response === "WELCOME_RECRUIT" ? 3 : -4;
setPlayerFitness((previous) => ({ ...previous, [id]: { ...previous[id], morale: Math.max(0, Math.min(100, Number(previous[id]?.morale ?? 50) + moraleDelta)) } }));
}
if (response === "START_CONTRACT_TALKS") navigateTo("FINANCES", { tab: "CONTRACTS", playerId: id });
setSeasonState((previous) => {
const playerState = previous.playerDevelopment?.[id] ?? {};
const promise = response === "PROMISE_MINUTES" ? {
type: "PLAYING_TIME",
status: "OPEN",
dueRound: Number(previous.round ?? 1),
madeRound: Math.max(0, Number(previous.round ?? 1) - 1),
} : playerState.playingTimePromise;
const effects: Record<string, number> = { PROMISE_MINUTES: 9, DEVELOPMENT_PLAN: 5, APPROVE_REST: 8, DECLINE_REST: -7, START_CONTRACT_TALKS: 8, DEFER_CONTRACT_TALKS: -4, RETAIN_PLAYER: 7, ALLOW_MOVE: 3, WELCOME_RECRUIT: 6, DISMISS_RECRUITMENT_CONCERN: -8 };
const happiness = Math.max(0, Math.min(100, Number(playerState.happiness ?? 50) + (effects[response] ?? 0)));
const responses: Record<string, string> = {
PROMISE_MINUTES: `You promised ${request.sender} a place in the next matchday rotation.`,
DEVELOPMENT_PLAN: `You agreed with ${request.sender} on a development plan and explained the selection decision.`,
APPROVE_REST: `You approved a recovery week for ${request.sender}; their workload has been reduced.`,
DECLINE_REST: `You kept ${request.sender} available. They are disappointed that their request was declined.`,
START_CONTRACT_TALKS: `You agreed to open contract discussions with ${request.sender}.`,
DEFER_CONTRACT_TALKS: `You deferred contract discussions with ${request.sender}.`,
RETAIN_PLAYER: `You committed to discussing a role and future with ${request.sender}.`,
ALLOW_MOVE: `You agreed to hear options for ${request.sender}. They feel listened to, though their future is unsettled.`,
WELCOME_RECRUIT: `You welcomed the new signing and framed the competition as a chance for the group to improve. ${request.sender} appreciated the response.`,
DISMISS_RECRUITMENT_CONCERN: `You told ${request.sender} that competition for a place is part of football. They felt their concern was brushed aside.`,
};
const responseText = responses[response] ?? "You discussed the request with the player.";
const moraleDelta = response === "DECLINE_REST" || response === "DEFER_CONTRACT_TALKS" ? -1 : 1;
const contractState = previous.playerContracts?.[id] ?? {};
const leaveDesireDelta = Math.max(-100, Math.min(100, Number(contractState.mood?.leaveDesireDelta ?? 0) - Math.round((effects[response] ?? 0) / 2)));
return {
...previous,
playerContracts: { ...(previous.playerContracts ?? {}), [id]: { ...contractState, mood: { ...(contractState.mood ?? {}), leaveDesireDelta } } },
clubMorale: { ...(previous.clubMorale ?? {}), [managerClub?.name ?? clubs[0].name]: Math.max(0, Math.min(100, Number(previous.clubMorale?.[managerClub?.name ?? clubs[0].name] ?? 50) + moraleDelta)) },
playerDevelopment: {
...(previous.playerDevelopment ?? {}),
[id]: { ...playerState, happiness, ...(response === "PROMISE_MINUTES" ? { playingTimePromise: promise } : {}) },
},
chatMessages: (previous.chatMessages ?? []).map((message: any) => message.id === chatId
? { ...message, status: "RESOLVED", response, responseText }
: message),
};
});
}

function resumeMatch() {
if (matchContext) setActiveScreen("MATCH_DAY");
}

const persistSavedGames = async (nextGames: CareerSave[], changedSave?: CareerSave, deletedSaveId?: string) => {
const sortedGames = [...nextGames]
.sort((a, b) => b.savedAt.localeCompare(a.savedAt))
.slice(0, MAX_SAVED_GAMES);
try {
lastSaveErrorRef.current = "";
const account = cloudUserRef.current;
if (account) {
const earlierPending = readAccountCacheRecord(account.id).pendingIds;
if (deletedSaveId) await removeCloudCareer(account.id, deletedSaveId);
let cached = false;
if (changedSave) {
cached = writeAccountCache(account.id, sortedGames, [...new Set([...earlierPending, changedSave.id])]);
try {
await putCloudCareer(account.id, changedSave);
} catch {
if (!cached) throw new Error("The cloud is unavailable and this browser has no space for a backup.");
lastSaveErrorRef.current = "Saved on this device. Cloud sync is pending; reconnect and sign in again to retry.";
}
}
if (!lastSaveErrorRef.current) writeAccountCache(account.id, sortedGames, earlierPending.filter((id) => id !== changedSave?.id && id !== deletedSaveId));
savedGamesRef.current = sortedGames;
setSavedGames(sortedGames);
return true;
}
try {
await writeCareerSavesToDatabase(sortedGames);
// Remove older full-size copies after the durable save has succeeded.
try {
window.localStorage.removeItem(SAVED_GAMES_KEY);
window.localStorage.removeItem(LEGACY_SAVE_KEY);
} catch {
// IndexedDB is already the primary copy; a blocked cleanup is harmless.
}
} catch (databaseError) {
// Preserve a fallback for browsers or private modes where IndexedDB is blocked.
const serialized = JSON.stringify(sortedGames);
try {
window.localStorage.setItem(SAVED_GAMES_KEY, serialized);
} catch (storageError) {
const legacyCopy = window.localStorage.getItem(LEGACY_SAVE_KEY);
if (!legacyCopy) throw storageError;
window.localStorage.removeItem(LEGACY_SAVE_KEY);
window.localStorage.setItem(SAVED_GAMES_KEY, serialized);
}
if (databaseError instanceof Error) lastSaveErrorRef.current = "Saved using browser storage; IndexedDB is unavailable.";
}
savedGamesRef.current = sortedGames;
setSavedGames(sortedGames);
return true;
} catch (error) {
const isQuotaError = error instanceof DOMException &&
(error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED");
lastSaveErrorRef.current = isQuotaError
? "Browser storage is full. Delete an older saved career in Game Mode, then save again."
: error instanceof Error
? `Save failed: ${error.message}`
: "Save failed because browser storage is unavailable.";
setSaveStatus(lastSaveErrorRef.current);
return false;
}
};

const saveCareerSnapshot = async (savedAutomatically = false) => {
if (!managerClub) return false;
const currentGames = savedGamesRef.current;
const activeId = activeSaveIdRef.current;
const activeSlotExists = activeId && currentGames.some((game) => game.id === activeId);
if (!activeSlotExists && currentGames.length >= MAX_SAVED_GAMES) return false;

const saveId = activeSlotExists && activeId
? activeId
: `career-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const saveData: CareerSave = {
id: saveId,
version: 1,
mode: gameMode,
clubId: managerClub.id,
activeScreen,
seasonState: {
...seasonState,
generatedPlayers: (seasonState.generatedPlayers ?? []).map((player: any) => repairPlayerAttributes(player)),
},
tactics,
trainingPlan,
userTrainingSchedule,
readInboxMessageIds,
calendarDate: calendarDate.toISOString(),
savedAt: new Date().toISOString(),
savedAutomatically,
playerFitness,
timeOnGround,
teamSelection,
matchContext,
matchProgress: matchProgressRef.current,
playedMatchRound,
};
const nextGames = [saveData, ...currentGames.filter((game) => game.id !== saveId)];
if (!await persistSavedGames(nextGames, saveData)) return false;
activeSaveIdRef.current = saveId;
return true;
};

const resumeSavedCareer = (saveId?: string) => {
const saveToResume = savedGamesRef.current.find((game) => game.id === saveId) ?? savedGamesRef.current[0];
if (!saveToResume) return;
const savedClub = [...clubs, tasmaniaDevils].find((club) => club.id === saveToResume.clubId);
if (!savedClub) return;
activeSaveIdRef.current = saveToResume.id;
setGameMode(saveToResume.mode ?? "CLASSIC");
setManagerClub(savedClub);
const restoredSeason = saveToResume.seasonState ?? createInitialSeasonState();
const restoredDifficulty = normalizeDifficulty(restoredSeason.difficulty) as DifficultyMode;
setDifficultyMode(restoredDifficulty);
try { window.localStorage.setItem("afl-manager-difficulty", restoredDifficulty); } catch { /* saved career remains authoritative */ }
const restoredPlayers = [...basePlayers, ...(restoredSeason.generatedPlayers ?? [])];
const savedClubPlayers = restoredPlayers.filter((player) => getCareerClub(player, restoredSeason.playerContracts ?? {}) === savedClub.name);
const generatedLeagueContracts = createInitialLeaguePlayerContracts(restoredPlayers, clubs, restoredSeason.seasonYear ?? 2027);
// Older saves hold opening contracts generated on a lower salary scale; bring the untouched ones up to date.
const savedPlayerContracts = {
...generatedLeagueContracts,
...rebaseGeneratedContracts(restoredSeason.playerContracts ?? {}, generatedLeagueContracts),
};
setSeasonState({
...restoredSeason,
managerClubName: restoredSeason.managerClubName ?? savedClub.name,
playerContracts: savedPlayerContracts,
clubAdministration: restoredSeason.clubAdministration ?? createClubAdministrationState(
savedClub,
savedClubPlayers,
restoredSeason.seasonYear ?? 2027,
savedPlayerContracts,
),
});
setTactics(saveToResume.tactics ?? { ...defaultTactics });
setTrainingPlan(saveToResume.trainingPlan ?? defaultTrainingPlan);
setUserTrainingSchedule(saveToResume.userTrainingSchedule ?? []);
setReadInboxMessageIds(saveToResume.readInboxMessageIds ?? []);
setPlayerFitness(saveToResume.playerFitness ?? {});
setTimeOnGround(saveToResume.timeOnGround ?? {});
setTeamSelection(saveToResume.teamSelection ?? createTeamSelectionState());
setMatchContext(saveToResume.matchContext ?? null);
matchProgressRef.current = saveToResume.matchProgress ?? null;
setMatchProgress(matchProgressRef.current);
setPlayedMatchRound(saveToResume.playedMatchRound ?? null);
const savedCalendarDate = parseFixtureDate(saveToResume.calendarDate);
const currentFixtureRound = (saveToResume.seasonState ?? createInitialSeasonState()).fixture
.find((round) => round.round === (saveToResume.seasonState?.round ?? 1));
const nextClubMatch = currentFixtureRound?.matches?.find((match) =>
match.home === savedClub.name || match.away === savedClub.name ||
match.homeTeam === savedClub.name || match.awayTeam === savedClub.name
);
setCalendarDate(saveToResume.seasonState?.calendarClock?.date ?? savedCalendarDate ?? parseFixtureDate(nextClubMatch?.date) ?? new Date((saveToResume.seasonState?.seasonYear ?? 2027), 9, 1));
setActiveScreen(saveToResume.activeScreen === "MATCH_DAY" ? "SEASON" : saveToResume.activeScreen);
setSetupStage("CAREER");
};

const deleteSavedGame = async (saveId: string) => {
const nextGames = savedGamesRef.current.filter((game) => game.id !== saveId);
if (!await persistSavedGames(nextGames, undefined, saveId)) return;
if (activeSaveIdRef.current === saveId) activeSaveIdRef.current = null;
};

const importLocalCareersToAccount = async () => {
const account = cloudUserRef.current;
if (!account) return;
setCloudBusy(true);
try {
const databaseBrowserSaves = await readCareerSavesFromDatabase().catch(() => []);
const browserSaves = databaseBrowserSaves.length ? databaseBrowserSaves : readCareerSaves();
const normalized = browserSaves.map((save: any, index: number) => safeNormalizeCareerSave(save, `import-${index}`)).filter(Boolean);
const current = savedGamesRef.current;
const imports = normalized.filter((save) => !current.some((existing) => existing.id === save.id));
const room = MAX_SAVED_GAMES - current.length;
if (imports.length > room) throw new Error(`Only ${room} cloud save slots are free. Delete an older cloud save first.`);
for (const save of imports) await putCloudCareer(account.id, save);
const combined = [...current, ...imports].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
savedGamesRef.current = combined;
setSavedGames(combined);
writeAccountCache(account.id, combined);
setCloudMessage(`${imports.length} browser ${imports.length === 1 ? "career" : "careers"} added to your account.`);
} catch (error) {
setCloudMessage(error instanceof Error ? error.message : "Could not import browser careers.");
} finally { setCloudBusy(false); }
};

const refreshCloudCareers = async () => {
const account = cloudUserRef.current;
if (!account) return;
setCloudBusy(true);
try {
const rows = await listCloudCareers(account.id);
const cloudSaves = rows.saves.map((save: any, index: number) => safeNormalizeCareerSave(save, `cloud-${index}`)).filter(Boolean);
const cache = readAccountCacheRecord(account.id);
const combined = [...cloudSaves];
const stillPending: string[] = [];
for (const save of cache.saves.filter((item) => cache.pendingIds.includes(item.id))) {
const existing = combined.findIndex((item) => item.id === save.id);
if (existing >= 0 && save.savedAt <= combined[existing].savedAt) continue;
try { await putCloudCareer(account.id, save); }
catch { stillPending.push(save.id); }
if (existing < 0) combined.push(save); else combined[existing] = save;
}
combined.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
savedGamesRef.current = combined.slice(0, MAX_SAVED_GAMES);
setSavedGames(savedGamesRef.current);
writeAccountCache(account.id, savedGamesRef.current, stillPending);
setCloudMessage(rows.damagedCount ? `${rows.damagedCount} damaged cloud ${rows.damagedCount === 1 ? "career was" : "careers were"} skipped. Contact support before deleting any saves.` : stillPending.length ? "Cloud careers refreshed. Some device saves still need to sync." : "Cloud careers are up to date.");
} catch (error) {
setCloudMessage(error instanceof Error ? `Could not refresh cloud saves: ${error.message}` : "Could not refresh cloud saves. Try again.");
} finally { setCloudBusy(false); }
};

const handleCloudAuth = async (action: string, email: string, password: string) => {
setCloudBusy(true);
setCloudMessage("");
try {
if (action === "SIGN_UP") {
const result = await signUpForCloud(email, password);
setCloudMessage(result.session ? "Account created. Your cloud saves are ready." : "Check your email to confirm your account, then sign in.");
} else if (action === "SIGN_IN") {
await signInToCloud(email, password);
} else if (action === "SIGN_OUT") {
await signOutOfCloud();
} else if (action === "RESET_PASSWORD") {
await sendPasswordReset(email);
setCloudMessage("Password reset email sent. Check your inbox.");
} else if (action === "UPDATE_PASSWORD") {
await updateCloudPassword(password);
setPasswordRecovery(false);
setCloudMessage("Your password has been updated.");
}
} catch (error) {
setCloudMessage(error instanceof Error ? error.message : "Account action failed. Try again.");
} finally { setCloudBusy(false); }
};

const exitGameMode = () => {
setShowExitPrompt(false);
setManagerClub(null);
setGameMode("CLASSIC");
setClubResetDraft(null);
setActiveScreen("CALENDAR");
setSetupStage("GAME_MODE");
};

const hasUnsavedCareerChanges = () => {
if (!managerClub) return false;
const activeSave = savedGamesRef.current.find((game) => game.id === activeSaveIdRef.current);
if (!activeSave || activeSave.clubId !== managerClub.id) return true;
const currentSnapshot = {
clubId: managerClub.id,
activeScreen,
seasonState,
tactics,
trainingPlan,
userTrainingSchedule,
readInboxMessageIds,
calendarDate: calendarDate.toISOString(),
playerFitness,
timeOnGround,
teamSelection,
matchContext,
matchProgress: matchProgressRef.current,
playedMatchRound,
};
const savedSnapshot = {
clubId: activeSave.clubId,
activeScreen: activeSave.activeScreen,
seasonState: activeSave.seasonState,
tactics: activeSave.tactics,
trainingPlan: activeSave.trainingPlan ?? defaultTrainingPlan,
userTrainingSchedule: activeSave.userTrainingSchedule ?? [],
readInboxMessageIds: activeSave.readInboxMessageIds,
calendarDate: activeSave.calendarDate,
playerFitness: activeSave.playerFitness ?? {},
timeOnGround: activeSave.timeOnGround ?? {},
teamSelection: activeSave.teamSelection ?? createTeamSelectionState(),
matchContext: activeSave.matchContext ?? null,
matchProgress: activeSave.matchProgress ?? null,
playedMatchRound: activeSave.playedMatchRound ?? null,
};
return JSON.stringify(currentSnapshot) !== JSON.stringify(savedSnapshot);
};

const requestExitGameMode = () => {
if (hasUnsavedCareerChanges()) {
setShowExitPrompt(true);
return;
}
exitGameMode();
};

const saveCurrentGame = async () => {
lastSaveErrorRef.current = "";
const saved = await saveCareerSnapshot(false);
setSaveStatus(saved ? (lastSaveErrorRef.current || "Saved") : savedGamesRef.current.length >= MAX_SAVED_GAMES && !savedGamesRef.current.some((game) => game.id === activeSaveIdRef.current)
? "All 5 save slots are full. Delete a save to continue."
: lastSaveErrorRef.current || "Save failed. Check that browser storage is available and try again.");
window.setTimeout(() => setSaveStatus(""), saved ? 2500 : 8000);
return saved;
};

const saveAndExitGameMode = async () => {
if (await saveCurrentGame()) exitGameMode();
};

const savePreferences = (nextPreferences: {
autoSaveMode?: AutoSaveMode;
appearanceMode?: "dark" | "light";
textSize?: TextSize;
progressionMode?: ProgressionMode;
difficultyMode?: DifficultyMode;
}) => {
try {
if (nextPreferences.autoSaveMode !== undefined) {
window.localStorage.setItem(
"afl-manager-autosave-mode",
nextPreferences.autoSaveMode
);
}
if (nextPreferences.appearanceMode !== undefined) {
window.localStorage.setItem(
"afl-manager-appearance",
nextPreferences.appearanceMode
);
}
if (nextPreferences.textSize !== undefined) {
window.localStorage.setItem("afl-manager-text-size", nextPreferences.textSize);
}
if (nextPreferences.progressionMode !== undefined) {
window.localStorage.setItem("afl-manager-progression-mode", nextPreferences.progressionMode);
}
if (nextPreferences.difficultyMode !== undefined) {
window.localStorage.setItem("afl-manager-difficulty", nextPreferences.difficultyMode);
}
} catch {
// Preferences still apply for this session if browser storage is unavailable.
}
};

useEffect(() => {
if (autoSaveMode === "OFF" || setupStage !== "CAREER" || !managerClub) return;

let statusTimer: number | undefined;
const writeAutosave = async () => {
lastSaveErrorRef.current = "";
const saved = await saveCareerSnapshot(true);
setSaveStatus(saved
? (lastSaveErrorRef.current || "Autosaved")
: savedGamesRef.current.length >= MAX_SAVED_GAMES && !savedGamesRef.current.some((game) => game.id === activeSaveIdRef.current)
? "All 5 save slots are full. Delete a save to continue."
: lastSaveErrorRef.current || "Autosave failed. Check that browser storage is available.");
if (statusTimer) window.clearTimeout(statusTimer);
statusTimer = window.setTimeout(() => setSaveStatus(""), 2500);
};

if (autoSaveMode === "ON_CHANGE") {
void writeAutosave();
return () => {
if (statusTimer) window.clearTimeout(statusTimer);
};
}

const intervalMs = autoSaveMode === "5_MIN" ? 5 * 60 * 1000 : 15 * 60 * 1000;
const intervalId = window.setInterval(() => { void writeAutosave(); }, intervalMs);
return () => {
window.clearInterval(intervalId);
if (statusTimer) window.clearTimeout(statusTimer);
};
}, [autoSaveMode, setupStage, managerClub, activeScreen, seasonState, tactics, trainingPlan, userTrainingSchedule, readInboxMessageIds, calendarDate, playerFitness, timeOnGround, teamSelection]);

useEffect(() => {
const previousFontSize = document.documentElement.style.fontSize;
const rootFontSize = textSize === "LARGE" ? "18px" : textSize === "EXTRA_LARGE" ? "20px" : "16px";
document.documentElement.style.fontSize = rootFontSize;
return () => {
document.documentElement.style.fontSize = previousFontSize;
};
}, [textSize]);

const renderScreen = () => {
switch (activeScreen) {
case "DASHBOARD":
return <Dashboard
club={managerClub ?? clubs[0]}
players={allPlayers}
appearance={appearanceMode}
seasonState={seasonState}
playerFitness={playerFitness}
teamSelection={teamSelection}
calendarEvents={calendarEvents}
currentDate={calendarDate}
delegationSettings={delegationSettings}
onDelegationChange={setDelegationSettings}
selectionResponsibility={teamSelection.selectionResponsibility}
onSelectionResponsibilityChange={(selectionResponsibility) => setTeamSelection((previous) => ({ ...previous, selectionResponsibility }))}
assistantManagedTraining={assistantManagedTraining}
onTrainingModeChange={setAssistantManagedTraining}
readMessageIds={readInboxMessageIds}
onNavigate={navigateTo}
onPlayMatch={launchMatch}
onOpenClub={openClubProfile}
/>;

case "CALENDAR":
return <CalendarScreen
club={managerClub ?? clubs[0]}
appearance={appearanceMode}
seasonState={seasonState}
events={calendarEvents}
currentDate={calendarDate}
navigationTab={navigationRoute.screen === "CALENDAR" ? navigationRoute.tab : null}
navigationSequence={navigationRoute.sequence}
delegationSettings={delegationSettings}
nextEvent={nextCalendarEvent}
assistantManagedTraining={assistantManagedTraining}
userTrainingSchedule={userTrainingSchedule}
onScheduleTraining={(session) => setUserTrainingSchedule((prev) => [...prev.filter((item) => new Date(item.date).toDateString() !== new Date(session.date).toDateString()), session])}
onEventClick={(event) => {
if (event.type === "MATCH") setActiveScreen("SEASON");
else if (event.type === "BROWNLOW_COUNT") { setActiveScreen("STATISTICS"); setNavigationRoute(previous => ({ screen: "STATISTICS", tab: "BROWNLOW", sequence: previous.sequence + 1 })); }
else if (event.screen) setActiveScreen(event.screen);
else if (event.type === "TRAINING") setActiveScreen("TRAINING");
else if (["TRADE", "DRAFT"].includes(event.type)) setActiveScreen("RECRUITMENT");
}}
onContinue={handleGameProgress}
/>;

case "MATCH_DAY":
return matchContext ? <MatchCentre
club={managerClub ?? clubs[0]}
players={allPlayers}
opponent={matchContext.opponent}
fixture={matchContext.fixture}
playerDevelopment={seasonState.playerDevelopment}
playerContracts={seasonState.playerContracts}
seasonYear={seasonState.seasonYear}
teamSelection={teamSelection}
teamSheetConfirmed={getTeamSelectionStatus(teamSelection, allPlayers.filter((player) => getCareerClub(player, seasonState.playerContracts) === (managerClub ?? clubs[0]).name), playerFitness).complete && teamSelection.confirmedForRound === getTeamSheetRoundKey(seasonState)}
initialMatchState={matchProgress}
onMatchStateChange={handleMatchStateChange}
appearance={appearanceMode}
finalsSeries={["WILDCARD", "FINALS"].includes(seasonState.phase)}
tactics={tactics}
onTacticsChange={setTactics}
onBack={() => {
setMatchProgress(matchProgressRef.current);
setActiveScreen("SEASON");
}}
playerFitness={playerFitness}
timeOnGround={timeOnGround}
onTimeOnGroundChange={setTimeOnGround}
onComplete={(result) => {
try {
const context = calendarContext();
const before = initializeWorld(seasonState, playerFitness, context);
const match = matchContext.fixture;
const committed = commitCalendarMatchResult(before, match, result, context);
const userClubName = context.userClub;
const clubPlayers = allPlayers.filter(p => getCareerClub(p, committed.season.playerContracts) === userClubName);
setSeasonState(committed.season);
setPlayerFitness(committed.fitness);
setMatchContext(null); matchProgressRef.current = null; setMatchProgress(null); setPlayedMatchRound(null); setActiveScreen("SEASON");
} catch (error) { setCalendarError(error instanceof Error ? error.message : "The match could not be committed. It remains in memory."); }
}}
/> : <CalendarScreen
club={managerClub ?? clubs[0]}
appearance={appearanceMode}
seasonState={seasonState}
events={calendarEvents}
currentDate={calendarDate}
delegationSettings={delegationSettings}
nextEvent={nextCalendarEvent}
assistantManagedTraining={assistantManagedTraining}
userTrainingSchedule={userTrainingSchedule}
onScheduleTraining={(session) => setUserTrainingSchedule((prev) => [...prev.filter((item) => new Date(item.date).toDateString() !== new Date(session.date).toDateString()), session])}
onEventClick={() => {}}
onContinue={() => {}}
/>;

case "SQUAD":
return <SquadScreen
club={managerClub ?? clubs[0]}
players={allPlayers}
appearance={appearanceMode}
seasonState={seasonState}
currentDate={calendarDate}
playerFitness={playerFitness}
teamSelection={teamSelection}
onTeamSelectionChange={setTeamSelection}
onSeasonStateChange={setSeasonState}
focusTeamSelection={focusTeamSelection}
initialTab={navigationRoute.screen === "SQUAD" && navigationRoute.tab ? navigationRoute.tab : squadInitialTab}
navigationSequence={navigationRoute.sequence}
onTeamSelectionFocused={() => setFocusTeamSelection(false)}
onPlayerContractsChange={(nextContracts: any) => setSeasonState((previous) => ({
...previous,
playerContracts: typeof nextContracts === "function" ? nextContracts(previous.playerContracts ?? {}) : nextContracts,
}))}
onPlayerDevelopmentChange={(playerId: string, activeTraits: string[]) => setSeasonState((previous) => ({
...previous,
playerDevelopment: {
...(previous.playerDevelopment ?? {}),
[playerId]: { ...(previous.playerDevelopment?.[playerId] ?? {}), activeTraits },
},
}))}
onAdministrationStateChange={(nextState: any) => setSeasonState((previous) => ({
...previous,
clubAdministration: typeof nextState === "function" ? nextState(previous.clubAdministration) : nextState,
}))}
/>;

case "CLUB_PROFILE":
return <ClubProfile
club={clubs.find((item) => item.name === clubProfileClubName)}
players={allPlayers.map((player) => ({ ...player, club: getCareerClub(player, seasonState.playerContracts ?? {}) }))}
seasonState={seasonState}
appearance={appearanceMode}
onBack={closeClubProfile}
/>;

case "PLAYER_PROFILE": {
const profilePlayer = findProfilePlayer(playerProfileId);
if (!profilePlayer) return null;
return <PlayerProfile
player={profilePlayer}
playerFitness={playerFitness}
appearance={appearanceMode}
seasonState={seasonState}
currentDate={calendarDate}
onBack={() => { setActiveScreen(playerProfileReturnScreen); setPlayerProfileId(null); }}
/>;
}

case "FANTASY_TOOLS":
if (gameMode !== "FANTASY") {
return <Dashboard club={managerClub ?? clubs[0]} players={allPlayers} appearance={appearanceMode} seasonState={seasonState} onOpenClub={openClubProfile} />;
}
return <FantasyToolsScreen
players={allPlayers}
clubs={clubs}
seasonState={seasonState}
onSeasonStateChange={setSeasonState}
appearance={appearanceMode}
/>;

case "DEVELOPER_ATTRIBUTES":
if (!import.meta.env.DEV) {
return <Dashboard club={managerClub ?? clubs[0]} players={allPlayers} appearance={appearanceMode} seasonState={seasonState} onOpenClub={openClubProfile} />;
}
return <DeveloperScreen
initialTab={navigationRoute.screen === "DEVELOPER_ATTRIBUTES" ? navigationRoute.tab : null}
navigationSequence={navigationRoute.sequence}
seasonState={seasonState}
appearance={appearanceMode}
onSkip={async (target: string) => {
if (!import.meta.env.DEV) return;
return skipCalendarTo(target);
}}
editor={<DeveloperPlayerAttributes
players={allPlayers}
appearance={appearanceMode}
overrides={developerPlayerOverrides}
onSaveOverrides={async (nextOverrides) => {
if (!import.meta.env.DEV) {
return { ok: false, error: "Developer tools are only available in the development environment." };
}
try {
const response = await fetch("/__dev/player-attributes", {
method: "PUT",
headers: { "Content-Type": "application/json" },
body: JSON.stringify(nextOverrides),
});
const result = await response.json().catch(() => ({}));
if (!response.ok) {
const error = response.status === 404
? "The developer file writer is disabled. In a private development workspace, set AFM_ENABLE_PLAYER_ATTRIBUTE_WRITER=true and restart the server."
: result.error ?? "Could not save player attributes.";
return { ok: false, error };
}
window.localStorage.setItem(DEVELOPER_PLAYER_OVERRIDES_KEY, JSON.stringify(nextOverrides));
setDeveloperPlayerOverrides(nextOverrides);
return { ok: true, savedPlayers: result.savedPlayers };
} catch (error) {
return {
ok: false,
error: error instanceof Error ? error.message : "Could not save player attributes.",
};
}
}}
/>}
/>;

case "TACTICS":
return <TacticsScreen club={managerClub ?? clubs[0]} appearance={appearanceMode} tactics={tactics} onTacticsChange={setTactics} players={allPlayers} teamSelection={teamSelection} seasonState={seasonState} playerFitness={playerFitness} navigationTab={navigationRoute.screen === "TACTICS" ? navigationRoute.tab : null} navigationSequence={navigationRoute.sequence} />;

case "RECRUITMENT":
return <RecruitmentScreen
appearance={appearanceMode}
players={allPlayers}
playerDevelopment={seasonState.playerDevelopment}
playerContracts={seasonState.playerContracts}
seasonYear={seasonState.seasonYear}
currentDate={calendarDate}
seasonState={seasonState}
aiTradeOfferResponses={seasonState.aiTradeOfferResponses ?? {}}
onAcademyAction={(action: any) => {
const academyClub = managerClub ?? clubs[0];
const existingAcademy = seasonState.academies?.[academyClub.name] ?? null;
const year = Number(seasonState.seasonYear ?? 2027);
if (action?.type === "INIT") {
if (existingAcademy) return null;
const academy = createAcademy({
clubName: academyClub.name,
seed: `academy:${academyClub.name}:${year}`,
firstDraftYear: year + 1,
seasonYear: year,
administration: seasonState.clubAdministration,
});
setSeasonState((previous) => ({
...previous,
academies: { ...(previous.academies ?? {}), [academyClub.name]: academy },
}));
return null;
}

const cash = Number(seasonState.clubAdministration?.cashBalance ?? 0);
const result = applyAcademyAction(existingAcademy, action, { cash, year });
if (result.error) return result.error;
setSeasonState((previous) => {
const currentAcademy = previous.academies?.[academyClub.name] ?? existingAcademy;
const currentCash = Number(previous.clubAdministration?.cashBalance ?? 0);
const updated = applyAcademyAction(currentAcademy, action, { cash: currentCash, year: Number(previous.seasonYear ?? year) });
if (updated.error) return previous;
return {
...previous,
academies: { ...(previous.academies ?? {}), [academyClub.name]: updated.academy },
clubAdministration: previous.clubAdministration
? { ...previous.clubAdministration, cashBalance: currentCash - Number(updated.cost ?? 0) }
: previous.clubAdministration,
};
});
return null;
}}
onOpenClub={openClubProfile}
onRespondToAITradeOffer={(offer: any, action: "ACCEPT" | "DECLINE" | "COUNTER", counterOffer: any = null) => {
setSeasonState((previous) => {
if (previous.phase !== "OFFSEASON" || !isTradeWindowDate(calendarDate) || ![0, 1].includes(previous.offseasonStep ?? 0)) return previous;
const userClubName = (managerClub ?? clubs[0]).name;
const responses = { ...(previous.aiTradeOfferResponses ?? {}) };
if (action === "DECLINE") return addTradeOutcome(
{ ...previous, aiTradeOfferResponses: { ...responses, [offer.id]: "DECLINED" } },
{ status: "UNSUCCESSFUL", source: "Incoming Offer", otherClub: offer.fromClub, summary: `${userClubName} declined ${offer.fromClub}'s offer for ${offer.targetPlayer?.name ?? (offer.targetPick ? formatDraftPick(offer.targetPick) : "a club asset")}.`, offeredAssets: [...(offer.offer?.players ?? []).map((player: any) => player.name), ...(offer.offer?.picks ?? []).map(formatDraftPick)].filter(Boolean), requestedAssets: [offer.targetPlayer?.name, offer.targetPick ? formatDraftPick(offer.targetPick) : null].filter(Boolean) },
);
if (action === "COUNTER" && !counterOffer) return previous;
const packageToProcess = action === "COUNTER" ? counterOffer : offer.offer;
const aiReturnPackage = { players: packageToProcess?.players ?? [], picks: packageToProcess?.picks ?? [] };
const userOutgoingPlayers = action === "COUNTER" ? packageToProcess?.userPlayers ?? [] : [];
const userOutgoingPicks = action === "COUNTER" ? packageToProcess?.userPicks ?? [] : [];
const userSendPackage = { players: [...(offer.targetPlayer ? [offer.targetPlayer] : []), ...userOutgoingPlayers], picks: [...(offer.targetPick ? [offer.targetPick] : []), ...userOutgoingPicks] };
if (!validTradePackage(aiReturnPackage) || !validTradePackage(userSendPackage)) return previous;
if ([...(offer.targetPlayer ? [offer.targetPlayer] : []), ...userOutgoingPlayers, ...(packageToProcess?.players ?? [])].some((player: any) => !tradeEligibility(player, previous, previous.seasonYear).eligible)) return previous;
if (action === "COUNTER") {
const valuationPlayers = allPlayers.map((player: any) => ({
...player,
club: getCareerClub(player, previous.playerContracts ?? {}),
}));
const evaluation = evaluatePackageExchange(userSendPackage, aiReturnPackage, offer.fromClub, {
seasonYear: previous.seasonYear,
allPlayers: valuationPlayers,
ladder: previous.ladder ?? [],
clubCount: clubs.length,
});
if (!evaluation.accepted) {
const message = { id: `ai-trade-counter-rejected-${offer.id}`, type: "AI_TRADE_NEWS", subject: `${offer.fromClub} rejected your counter-offer`, date: `Season ${previous.seasonYear}`, summary: `${offer.fromClub} would not meet your terms for ${offer.targetPlayer?.name ?? (offer.targetPick ? formatDraftPick(offer.targetPick) : "the requested asset")}.`, detail: evaluation.reason };
return addTradeOutcome(
{ ...previous, aiTradeOfferResponses: { ...responses, [offer.id]: "COUNTER_REJECTED" }, mailMessages: [...(previous.mailMessages ?? []), message] },
{ status: "UNSUCCESSFUL", source: "Incoming Offer · Counter rejected", otherClub: offer.fromClub, summary: `${offer.fromClub} rejected ${userClubName}'s counter-offer for ${offer.targetPlayer?.name ?? (offer.targetPick ? formatDraftPick(offer.targetPick) : "a club asset")}.`, offeredAssets: [...(offer.targetPlayer ? [offer.targetPlayer.name] : []), ...userOutgoingPlayers.map((player: any) => player.name), ...(offer.targetPick ? [formatDraftPick(offer.targetPick)] : []), ...userOutgoingPicks.map((pick: any) => formatDraftPick(pick))].filter(Boolean), requestedAssets: [...(packageToProcess?.players ?? []).map((player: any) => player.name), ...(packageToProcess?.picks ?? []).map(formatDraftPick)].filter(Boolean) },
);
}
}
if (offer.targetPlayer && getCareerClub(offer.targetPlayer, previous.playerContracts ?? {}) !== userClubName) return { ...previous, aiTradeOfferResponses: { ...responses, [offer.id]: "INVALID" } };
if (offer.targetPick && !(previous.draftPickAssets ?? []).some((asset: any) => String(asset.id) === String(offer.targetPick.id) && asset.currentOwner === userClubName)) return { ...previous, aiTradeOfferResponses: { ...responses, [offer.id]: "INVALID" } };
const incomingPlayers = packageToProcess?.players ?? [];
const incomingPicks = packageToProcess?.picks ?? [];
if (incomingPlayers.some((player: any) => !counterOffer?.contracts?.[String(player.id)])) return previous;
const validPlayers = incomingPlayers.every((player: any) => getCareerClub(player, previous.playerContracts ?? {}) === offer.fromClub);
const validPicks = incomingPicks.every((pick: any) => (previous.draftPickAssets ?? []).some((asset: any) => String(asset.id) === String(pick.id) && asset.currentOwner === offer.fromClub));
const validOutgoingPlayers = userOutgoingPlayers.every((player: any) => (!offer.targetPlayer || String(player.id) !== String(offer.targetPlayer.id)) && getCareerClub(player, previous.playerContracts ?? {}) === userClubName);
const validOutgoingPicks = userOutgoingPicks.every((pick: any) => (!offer.targetPick || String(pick.id) !== String(offer.targetPick.id)) && (previous.draftPickAssets ?? []).some((asset: any) => String(asset.id) === String(pick.id) && asset.currentOwner === userClubName));
if (!validPlayers || !validPicks || !validOutgoingPlayers || !validOutgoingPicks) return { ...previous, aiTradeOfferResponses: { ...responses, [offer.id]: "INVALID" } };
const playerContracts = { ...(previous.playerContracts ?? {}) };
if (offer.targetPlayer) playerContracts[String(offer.targetPlayer.id)] = {
...(playerContracts[String(offer.targetPlayer.id)] ?? {}),
club: offer.fromClub,
clubJoinedSeason: Number(calendarDate.getFullYear()) + 1,
};
for (const player of userOutgoingPlayers) {
playerContracts[String(player.id)] = {
...(playerContracts[String(player.id)] ?? player.contract ?? {}),
club: offer.fromClub,
clubJoinedSeason: Number(calendarDate.getFullYear()) + 1,
};
}
let valid = true;
for (const [index, player] of incomingPlayers.entries()) {
if (getCareerClub(player, previous.playerContracts ?? {}) !== offer.fromClub) { valid = false; break; }
playerContracts[String(player.id)] = {
...(playerContracts[String(player.id)] ?? {}),
club: userClubName,
clubJoinedSeason: Number(calendarDate.getFullYear()) + 1,
...(counterOffer?.contracts?.[String(player.id)] ? {
salary: counterOffer.contracts[String(player.id)].salary,
yearsRemaining: counterOffer.contracts[String(player.id)].years,
yearlySalaries: counterOffer.contracts[String(player.id)].yearlySalaries,
role: counterOffer.contracts[String(player.id)].role ?? "BEST_22",
promises: counterOffer.contracts[String(player.id)].promises ?? [],
signedSeason: previous.seasonYear,
} : {}),
};
}
if (!valid) return { ...previous, aiTradeOfferResponses: { ...responses, [offer.id]: "INVALID" } };
if (![userClubName, offer.fromClub].every(club => checkClubCommitments(allPlayers, playerContracts, club, previous.seasonYear, 0, club === userClubName ? previous.clubAdministration : previous.leagueAdministration?.[club]).ok)) return previous;
const incomingPickIds = new Set(incomingPicks.map((pick: any) => String(pick.id)));
const outgoingPickIds = new Set([...(offer.targetPick ? [offer.targetPick] : []), ...userOutgoingPicks].map((pick: any) => String(pick.id)));
const draftPickAssets = (previous.draftPickAssets ?? []).map((pick: any) =>
incomingPickIds.has(String(pick.id)) && pick.currentOwner === offer.fromClub
? { ...pick, currentOwner: userClubName }
: outgoingPickIds.has(String(pick.id)) && pick.currentOwner === userClubName
? { ...pick, currentOwner: offer.fromClub }
: pick,
);
const message = {
id: `ai-trade-accepted-${offer.id}`,
type: "AI_TRADE_NEWS",
subject: action === "COUNTER" ? `Counter-offer accepted by ${offer.fromClub}` : `Trade completed with ${offer.fromClub}`,
date: `Season ${previous.seasonYear}`,
summary: offer.targetPlayer ? `${offer.targetPlayer.name} has been traded to ${offer.fromClub}.` : `Draft-pick exchange completed with ${offer.fromClub}.`,
detail: `${userClubName} send ${[...(offer.targetPlayer ? [offer.targetPlayer] : []), ...userOutgoingPlayers].map((player: any) => player.name).join(", ") || "no players"}${[...(offer.targetPick ? [offer.targetPick] : []), ...userOutgoingPicks].length ? ` and ${[...(offer.targetPick ? [offer.targetPick] : []), ...userOutgoingPicks].map(formatDraftPick).join(", ")}` : ""}. They receive ${incomingPlayers.map((player: any) => player.name).join(", ") || "no players"}${incomingPicks.length ? ` and ${incomingPicks.map(formatDraftPick).join(", ")}` : ""}.`,
};
const transactionDate = new Date(calendarDate);
const tradeState = addTradePeriodTransaction(
{ ...previous, playerContracts, draftPickAssets, aiTradeOfferResponses: { ...responses, [offer.id]: action === "COUNTER" ? "COUNTER_ACCEPTED" : "ACCEPTED" }, mailMessages: [...(previous.mailMessages ?? []), message] },
{
tradePeriodYear: transactionDate.getFullYear(),
week: transactionDate.getDate() <= 11 ? 1 : 2,
date: transactionDate,
playerMoves: [
...(offer.targetPlayer ? [{ playerName: offer.targetPlayer.name, fromClub: userClubName, toClub: offer.fromClub }] : []),
...userOutgoingPlayers.map((player: any) => ({ playerName: player.name, fromClub: userClubName, toClub: offer.fromClub })),
...incomingPlayers.map((player: any) => ({ playerName: player.name, fromClub: offer.fromClub, toClub: userClubName })),
],
pickMoves: [
...(offer.targetPick ? [{ pickName: formatDraftPick(offer.targetPick), fromClub: userClubName, toClub: offer.fromClub }] : []),
...userOutgoingPicks.map((pick: any) => ({ pickName: formatDraftPick(pick), fromClub: userClubName, toClub: offer.fromClub })),
...incomingPicks.map((pick: any) => ({ pickName: formatDraftPick(pick), fromClub: offer.fromClub, toClub: userClubName })),
],
},
);
return addTradeOutcome(
tradeState,
{ status: "SUCCESSFUL", source: action === "COUNTER" ? "Incoming Offer · Counter accepted" : "Incoming Offer", otherClub: offer.fromClub, summary: offer.targetPlayer ? `Trade completed with ${offer.fromClub}.` : `Pick exchange completed with ${offer.fromClub}.`, offeredAssets: [...(offer.targetPlayer ? [offer.targetPlayer.name] : []), ...userOutgoingPlayers.map((player: any) => player.name), ...(offer.targetPick ? [formatDraftPick(offer.targetPick)] : []), ...userOutgoingPicks.map((pick: any) => formatDraftPick(pick))].filter(Boolean), requestedAssets: [...incomingPlayers.map((player: any) => player.name), ...incomingPicks.map((pick: any) => formatDraftPick(pick))].filter(Boolean) },
);
});
}}
onDraftPick={handleDraftPick}
onDraftBid={handleDraftBid}
onResolveDraftBid={handleResolveDraftBid}
onDraftPass={handleDraftPass}
onAdvanceDraftAI={handleAdvanceDraftAI}
onDraftPickTrade={handleDraftPickTrade}
onScout={(playerId: string) => setSeasonState(previous => assignScoutingPlayer(previous, playerId, facilityBonuses.scoutingAccuracy,
previous.clubAdministration?.staff?.find(person => person.role === 'List Manager')?.rating))}
onToggleShortlist={(playerId: string) => setSeasonState(previous => {
const id = String(playerId);
const shortlist = (previous.scoutingShortlist ?? []).map(String);
return { ...previous, scoutingShortlist: shortlist.includes(id) ? shortlist.filter(item => item !== id) : [...shortlist, id] };
})}
navigationTab={navigationRoute.screen === "RECRUITMENT" ? navigationRoute.tab : null}
navigationSequence={navigationRoute.sequence}
onShopTradeComplete={handleShopTradeComplete}
onTradeGeniusComplete={handleTradeGeniusComplete}
onTradeOutcome={(outcome: any) => setSeasonState((previous) => addTradeOutcome(previous, { ...outcome, date: calendarDate }))}
facilityBonuses={facilityBonuses}
userClub={managerClub ?? clubs[0]}
onTradeComplete={(result: any) => {
const isConcessionSigning = result.isFreeAgent && result.freeAgencyType === "TAS_CONCESSION";
const windowKind = isConcessionSigning ? "tasmaniaConcession" : result.isFreeAgent && result.freeAgencyType === "DFA" && isMovementWindow(seasonState, calendarDate, "delistedFreeAgency") ? "delistedFreeAgency" : result.isFreeAgent ? "freeAgency" : "trade";
if (!isMovementWindow(seasonState, calendarDate, windowKind)) return;
setSeasonState((previous) => {
if (!isMovementWindow(previous, calendarDate, windowKind)) return previous;
if (isConcessionSigning) {
const signings = previous.expansionCareer?.concessionSignings ?? [];
if (signings.length >= 18 || signings.some((signing: any) => signing.fromClub === result.previousClub)) return previous;
}
if (!result.isFreeAgent && (!validTradePackage({ players: result.outgoingPlayers ?? [], picks: (result.draftPickIds ?? []).map(id => ({ id })) }) || !validTradePackage({ players: [result.player], picks: (result.incomingDraftPickIds ?? []).map(id => ({ id })) }))) return previous;
if ([result.player, ...(result.outgoingPlayers ?? [])].some((player: any) => !tradeEligibility(player, previous, previous.seasonYear).eligible)) return previous;
const userClubName = (managerClub ?? clubs[0]).name;
const terms = {
...result.contract,
signedSeason: calendarDate.getMonth() >= 9 ? calendarDate.getFullYear() + 1 : previous.seasonYear,
yearlySalaries: result.contract.yearlySalaries,
promises: result.contract.promises ?? [],
};
const completed = result.isFreeAgent
? signFreeAgent(result.player, result.newClub, terms, allPlayers, previous.playerContracts ?? {})
: executeTrade(result.player, result.newClub, terms, allPlayers, previous.playerContracts ?? {});
const playerContracts = { ...completed.contracts };
if (!result.isFreeAgent && result.previousClub) {
for (const outgoing of result.outgoingPlayers ?? []) {
const key = String(outgoing.id);
playerContracts[key] = {
...(playerContracts[key] ?? {}),
club: result.previousClub,
clubJoinedSeason: terms.signedSeason,
};
}
}
if (![result.newClub, result.previousClub].filter(Boolean).every(club => checkClubCommitments(allPlayers, playerContracts, club, previous.seasonYear, 0, club === userClubName ? previous.clubAdministration : previous.leagueAdministration?.[club]).ok)) return previous;
const offeredPickIds = new Set((result.draftPickIds ?? []).map(String));
const receivedPickIds = new Set((result.incomingDraftPickIds ?? []).map(String));
const draftPickAssets = (previous.draftPickAssets ?? []).map((pick) => {
if (offeredPickIds.has(String(pick.id)) && pick.currentOwner === result.newClub) {
return { ...pick, currentOwner: result.previousClub };
}
if (receivedPickIds.has(String(pick.id)) && pick.currentOwner === result.previousClub) {
return { ...pick, currentOwner: result.newClub };
}
return pick;
});
const currentDraftPicks = draftPickAssets
.filter((pick) => pick.year === previous.draftState?.draftYear && pick.resolved)
.sort((a, b) => a.number - b.number);
const draftState = currentDraftPicks.length === previous.draftState?.totalPicks
? { ...previous.draftState, ...draftPickMetaFields(currentDraftPicks) }
: previous.draftState;
const transactionDate = new Date(calendarDate);
const playerById = new Map(allPlayers.map((player: any) => [String(player.id), player]));
const pickById = new Map((previous.draftPickAssets ?? []).map((pick: any) => [String(pick.id), pick]));
const playerMoves = [
{ playerId: result.player?.id, playerName: result.player?.name, fromClub: result.previousClub, toClub: result.newClub,
freeAgent: Boolean(result.isFreeAgent), freeAgencyType: result.isFreeAgent ? result.freeAgencyType : undefined,
salary: result.contract?.salary ?? 0, age: result.player?.age },
...(!result.isFreeAgent ? (result.outgoingPlayers ?? []).map((outgoing: any) => ({
playerId: outgoing.id, playerName: outgoing.name ?? playerById.get(String(outgoing.id))?.name,
fromClub: result.newClub,
toClub: result.previousClub,
})) : []),
];
const pickMoves = [
...(result.draftPickIds ?? []).flatMap((id: any) => {
const pick = pickById.get(String(id));
return pick ? [{ pickName: formatDraftPick(pick), fromClub: result.newClub, toClub: result.previousClub }] : [];
}),
...(result.incomingDraftPickIds ?? []).flatMap((id: any) => {
const pick = pickById.get(String(id));
return pick ? [{ pickName: formatDraftPick(pick), fromClub: result.previousClub, toClub: result.newClub }] : [];
}),
];
const concessionChanges = isConcessionSigning
? recordTasmaniaConcessionSigning({ ...previous, draftPickAssets }, { player: result.player, fromClub: result.previousClub, date: dayKey(transactionDate) })
: {};
return addTradePeriodTransaction(
{ ...previous, playerContracts, draftPickAssets, draftState, ...concessionChanges },
{
tradePeriodYear: transactionDate.getFullYear(),
week: transactionDate.getDate() <= 11 ? 1 : 2,
date: transactionDate,
kind: result.isFreeAgent ? "FREE_AGENT" : "TRADE",
playerMoves,
pickMoves,
},
);
});
}}
/>;

case "SEASON":
return <SeasonScreen
club={managerClub ?? clubs[0]}
players={allPlayers}
appearance={appearanceMode}
seasonState={seasonState}
navigationTab={navigationRoute.screen === "SEASON" ? navigationRoute.tab : null}
navigationSequence={navigationRoute.sequence}
onSeasonStateChange={setSeasonState}
onAdvanceToNextSeason={runSeasonRollover}
onCalendarProgress={handleGameProgress}
onCalendarProgressToDate={advanceCalendarToDate}
currentDate={calendarDate}
onOpenDraftBoard={handleOpenDraftBoard}
onOpenClub={openClubProfile}
onOpenBoard={() => navigateTo("FINANCES", { tab: "BOARD" })}
playedMatchRound={playedMatchRound}
teamSelection={teamSelection}
teamSheetConfirmed={getTeamSelectionStatus(teamSelection, allPlayers.filter((player) => getCareerClub(player, seasonState.playerContracts) === (managerClub ?? clubs[0]).name), playerFitness).complete && teamSelection.confirmedForRound === getTeamSheetRoundKey(seasonState)}
selectionResponsibility={teamSelection.selectionResponsibility}
onPrepareTeamSheet={prepareTeamSheet}
onResumeMatch={resumeMatch}
trainingPlan={trainingPlan}
playerFitness={playerFitness}
onSimulateCalendarStage={simulateCalendarStage}
tactics={tactics}
onPlayMatch={(match: any) => {
launchMatch(match);
}}
/>;

case "INBOX":
return <InboxScreen
club={managerClub ?? clubs[0]}
appearance={appearanceMode}
seasonState={seasonState}
readMessageIds={readInboxMessageIds}
onMarkRead={(messageId: string) => { setReadInboxMessageIds((ids) => ids.includes(messageId) ? ids : [...ids, messageId]); setSeasonState(previous => ({ ...previous, resolvedCalendarEventIds: [...new Set([...(previous.resolvedCalendarEventIds ?? []), `notice:${messageId}`])] })); }}
onMarkAllRead={(messageIds: string[]) => setReadInboxMessageIds((ids) => [...new Set([...ids, ...messageIds])])}
onResolveChat={respondToPlayerRequest}
onDeleteMessages={(messageIds: string[]) => setSeasonState((previous) => ({
...previous,
deletedInboxMessageIds: [...new Set([...(previous.deletedInboxMessageIds ?? []), ...messageIds])],
}))}
navigationTab={navigationRoute.screen === "INBOX" ? navigationRoute.tab : null}
navigationSequence={navigationRoute.sequence}
/>;

case "STATISTICS":
return <StatisticsScreen appearance={appearanceMode} seasonState={seasonState} clubName={managerClub?.name} onOpenClub={openClubProfile} onBrownlowComplete={(winners: any[]) => setSeasonState(previous => previous.brownlowCountReady && !previous.brownlowCountCompleted
? { ...previous, brownlowCountCompleted: true, brownlowWinners: winners }
: previous)} navigationTab={navigationRoute.screen === "STATISTICS" ? navigationRoute.tab : null} navigationSequence={navigationRoute.sequence} />;

case "TRAINING":
return <TrainingScreen
players={allPlayers}
appearance={appearanceMode}
club={managerClub ?? clubs[0]}
seasonState={seasonState}
trainingPlan={trainingPlan}
onTrainingPlanChange={setTrainingPlan}
onPlayerTrainingFocusChange={(playerId: any, focus: string) => {
setSeasonState((prev) => ({
...prev,
playerDevelopment: {
...prev.playerDevelopment,
[playerId]: { ...prev.playerDevelopment?.[playerId], trainingFocus: focus,
positionTraining: prev.playerDevelopment?.[playerId]?.positionTraining?.complete ? prev.playerDevelopment[playerId].positionTraining : null },
},
}));
}}
onPlayerPositionTrainingChange={(playerId: any, target: string, requiredDays: number) => setSeasonState((prev) => ({
...prev,
playerDevelopment: { ...prev.playerDevelopment, [playerId]: {
...prev.playerDevelopment?.[playerId],
learnedPositions: [...new Set([...(prev.playerDevelopment?.[playerId]?.learnedPositions ?? []), ...(prev.playerDevelopment?.[playerId]?.positionTraining?.complete ? [prev.playerDevelopment[playerId].positionTraining.target] : [])])],
trainingFocus: target ? "Position Training" : "Balanced",
positionTraining: target ? { target, requiredDays, progress: 0, complete: false } : null,
} },
}))}
playerFitness={playerFitness}
onPlayerProgramChange={(playerId: any, program: string) => {
setPlayerFitness((prev) => ({
...prev,
[playerId]: { ...prev[playerId], trainingProgram: program },
}));
}}
teamSelection={teamSelection}
onReserveAssignmentChange={(playerId: any, assignment: string) => setPlayerFitness((previous) => ({
...previous, [playerId]: { ...previous[playerId], reservesAssignment: assignment },
}))}
assistantManagedTraining={assistantManagedTraining}
onTrainingModeChange={setAssistantManagedTraining}
facilityBonuses={facilityBonuses}
trainingEvents={calendarEvents}
currentDate={calendarDate}
navigationTab={navigationRoute.screen === "TRAINING" ? navigationRoute.tab : null}
navigationSequence={navigationRoute.sequence}
/>;

case "FINANCES":
return (
<ClubAdministrationScreen
players={allPlayers}
club={managerClub ?? clubs[0]}
leagueClubs={clubs}
appearance={appearanceMode}
seasonState={seasonState}
currentDate={calendarDate}
playerContracts={seasonState.playerContracts ?? {}}
clubAdministration={seasonState.clubAdministration}
initialTab={navigationRoute.screen === "FINANCES" && navigationRoute.tab ? navigationRoute.tab : financeNav.tab}
key={`administration-${navigationRoute.sequence}`}
initialPlayerId={financeNav.playerId}
availableTabs={["OVERVIEW", "STAFF", "FACILITIES", "COMMERCIAL", "BOARD", "JOB_MARKET"]}
onApplyForJob={handleApplyForJob}
onAcademyAction={handleAcademyAction}
onPlayerContractsChange={(nextContracts: any) => setSeasonState((previous) => ({
...previous,
playerContracts: typeof nextContracts === "function"
? nextContracts(previous.playerContracts ?? {})
: nextContracts,
}))}
onAdministrationStateChange={(nextState: any) => setSeasonState((previous) => {
const updated = typeof nextState === "function"
? nextState(previous.clubAdministration)
: nextState;
return {
...previous,
clubAdministration: updated,
leagueAdministration: {
...(previous.leagueAdministration ?? {}),
[managerClub.name]: updated,
},
};
})}
onStaffMarketChange={(updater: any) => setSeasonState((previous) => typeof updater === "function" ? updater(previous) : updater)}
/>
);

case "INJURY_LIST":
return <InjuryListTab team={(managerClub ?? clubs[0]).name} players={allPlayers} appearance={appearanceMode} playerFitness={playerFitness} seasonState={seasonState} navigationTab={navigationRoute.screen === "INJURY_LIST" ? navigationRoute.tab : null} navigationSequence={navigationRoute.sequence} />;

case "SETTINGS":
return (
<section
style={{
maxWidth: 760,
padding: 24,
border: `1px solid ${lightMode ? "#cbd5e1" : "#334155"}`,
borderRadius: 16,
background: lightMode ? "#ffffff" : "#0f172a",
color: lightMode ? "#0f172a" : "#f8fafc"
}}
>
<div style={{ color: lightMode ? "#64748b" : "#94a3b8", fontSize: 12, letterSpacing: 2, fontWeight: 700 }}>
CLASSIC MODE
</div>
<h1 style={{ margin: "8px 0 10px" }}>Settings</h1>
<p style={{ color: lightMode ? "#475569" : "#cbd5e1", lineHeight: 1.6 }}>
Your current club is {managerClub?.name ?? "not selected"}. Manage your career preferences here.
</p>

<button
type="button"
aria-expanded={settingsTipsOpen}
onClick={() => setSettingsTipsOpen((open) => !open)}
style={{ padding: "10px 16px", border: "1px solid #f97316", borderRadius: 10, background: lightMode ? "#fff7ed" : "#2a1b1a", color: lightMode ? "#9a3412" : "#fdba74", fontWeight: 800, cursor: "pointer" }}
>
{settingsTipsOpen ? "Hide system tips" : "Tips · How to navigate the game"}
</button>

{settingsTipsOpen && (
<div style={{ marginTop: 14, padding: 18, border: `1px solid ${lightMode ? "#fed7aa" : "#7c2d12"}`, borderRadius: 12, background: lightMode ? "#fffaf5" : "#1c1720" }}>
<h2 style={{ margin: "0 0 6px", fontSize: 18 }}>A quick guide to your club</h2>
<p style={{ margin: "0 0 14px", color: lightMode ? "#64748b" : "#cbd5e1", fontSize: 13, lineHeight: 1.5 }}>Choose a section below to open it. Your calendar advances the whole league, so check upcoming decisions before moving time forward.</p>
<div style={{ display: "grid", gap: 9 }}>
{[
["Dashboard", "Your daily overview, club priorities and assistant delegation."],
["Calendar", "Advance time, inspect upcoming events and manage progression stops."],
["Squad", "Review player profiles, contracts, traits, selection history and team sheets."],
["Tactics", "Set your game plan, inspect matchups and compare team and player attributes."],
["Training", "Set team programs and individual focuses, then review fitness and predicted development."],
["Medical Room", "Monitor current injuries, recovery and each player's injury history."],
["Recruitment", "Scout the player pool, manage incoming offers, shop assets and follow trade outcomes."],
["Inbox", "Respond to club messages and player chats; conversations can affect morale."],
["Statistics", "Review season and league performance, leaders and awards."],
["Season Hub", "Follow fixtures, results, match reports, ladder and finals."],
["Administration", "Manage contracts, cap room, staff, facilities, commercial income and board goals."],
].map(([label, description]) => {
const destination = navigationDestinations.find((item) => item.label === label);
return <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 12px", borderRadius: 9, background: lightMode ? "#ffffff" : "#0f172a", border: `1px solid ${lightMode ? "#e2e8f0" : "#334155"}` }}>
<div><strong>{label}</strong><div style={{ marginTop: 3, color: lightMode ? "#64748b" : "#94a3b8", fontSize: 12, lineHeight: 1.4 }}>{description}</div></div>
{destination && <button type="button" onClick={() => { setActiveScreen(destination.screen); setSettingsTipsOpen(false); }} style={{ flexShrink: 0, padding: "7px 10px", border: "1px solid #f97316", borderRadius: 8, background: "transparent", color: lightMode ? "#c2410c" : "#fdba74", fontWeight: 700, cursor: "pointer" }}>Open</button>}
</div>;
})}
</div>
<p style={{ margin: "14px 0 0", color: lightMode ? "#64748b" : "#94a3b8", fontSize: 12 }}>Tip: use the magnifying glass above the navigation pane to search for a screen by name.</p>
</div>
)}

<div
style={{
display: "grid",
gap: 12,
marginTop: 24
}}
>
<div
style={{
padding: 16,
border: `1px solid ${lightMode ? "#e2e8f0" : "#334155"}`,
borderRadius: 12,
background: lightMode ? "#f8fafc" : "#111c30"
}}
>
<strong>Difficulty</strong>
<div style={{ marginTop: 4, color: lightMode ? "#64748b" : "#94a3b8", fontSize: 13, lineHeight: 1.5 }}>
Choose how much financial and board pressure your career faces. This setting applies to your club and is saved with the career.
</div>
<div role="group" aria-label="Career difficulty" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, marginTop: 14 }}>
{Object.values(DIFFICULTY_MODES).map((mode: any) => {
const selected = difficultyMode === mode.id;
return (
<button
key={mode.id}
type="button"
aria-pressed={selected}
onClick={() => {
const nextMode = mode.id as DifficultyMode;
setDifficultyMode(nextMode);
savePreferences({ difficultyMode: nextMode });
if (managerClub) setSeasonState((previous: any) => ({ ...previous, difficulty: nextMode, managerClubName: managerClub.name }));
}}
style={{
textAlign: "left",
padding: "12px 14px",
border: `1px solid ${selected ? "#f97316" : lightMode ? "#cbd5e1" : "#334155"}`,
borderRadius: 10,
background: selected ? (lightMode ? "#fff7ed" : "#2a1b1a") : (lightMode ? "#ffffff" : "#0f172a"),
color: lightMode ? "#0f172a" : "#f8fafc",
cursor: "pointer"
}}
>
<span style={{ display: "block", fontWeight: 800 }}>{mode.label}{selected ? " · Selected" : ""}</span>
<span style={{ display: "block", marginTop: 6, color: lightMode ? "#64748b" : "#94a3b8", fontSize: 12, lineHeight: 1.45 }}>{mode.description}</span>
</button>
);
})}
</div>
</div>

<div
style={{
display: "flex",
justifyContent: "space-between",
alignItems: "center",
gap: 16,
padding: 16,
border: `1px solid ${lightMode ? "#e2e8f0" : "#334155"}`,
borderRadius: 12,
background: lightMode ? "#f8fafc" : "#111c30"
}}
>
<div>
<strong>Autosave</strong>
<div style={{ marginTop: 4, color: lightMode ? "#64748b" : "#94a3b8", fontSize: 13 }}>
{autoSaveMode === "OFF"
? "Automatic saving is off."
: autoSaveMode === "ON_CHANGE"
? "Save when you change app sections or clubs."
: `Save your club and current page every ${autoSaveMode === "5_MIN" ? "5" : "15"} minutes.`}
</div>
</div>
<select
aria-label="Autosave frequency"
value={autoSaveMode}
onChange={(event) => {
const nextMode = event.target.value as AutoSaveMode;
setAutoSaveMode(nextMode);
savePreferences({ autoSaveMode: nextMode });
}}
style={{
flexShrink: 0,
minWidth: 150,
padding: "9px 12px",
border: `1px solid ${lightMode ? "#cbd5e1" : "#475569"}`,
borderRadius: 10,
background: lightMode ? "#ffffff" : "#1e293b",
color: lightMode ? "#0f172a" : "#f8fafc",
fontWeight: 700
}}
>
<option value="OFF">Off</option>
<option value="ON_CHANGE">On changes</option>
<option value="5_MIN">Every 5 minutes</option>
<option value="15_MIN">Every 15 minutes</option>
</select>
</div>

<div
style={{
display: "flex",
justifyContent: "space-between",
alignItems: "center",
gap: 16,
padding: 16,
border: `1px solid ${lightMode ? "#e2e8f0" : "#334155"}`,
borderRadius: 12,
background: lightMode ? "#f8fafc" : "#111c30"
}}
>
<div>
<strong>Appearance</strong>
<div style={{ marginTop: 4, color: lightMode ? "#64748b" : "#94a3b8", fontSize: 13 }}>
Choose a light or dark appearance.
</div>
</div>
<button
type="button"
aria-label={`Switch to ${lightMode ? "dark" : "light"} mode`}
aria-pressed={lightMode}
onClick={() => {
const nextMode = lightMode ? "dark" : "light";
setAppearanceMode(nextMode);
savePreferences({ appearanceMode: nextMode });
}}
style={{
flexShrink: 0,
minWidth: 96,
padding: "9px 12px",
border: `1px solid ${lightMode ? "#cbd5e1" : "#475569"}`,
borderRadius: 10,
background: lightMode ? "#e2e8f0" : "#1e293b",
color: lightMode ? "#0f172a" : "#f8fafc",
fontWeight: 700,
cursor: "pointer"
}}
>
{lightMode ? "Light mode" : "Dark mode"}
</button>
</div>

<div
style={{
display: "flex",
justifyContent: "space-between",
alignItems: "center",
gap: 16,
padding: 16,
border: `1px solid ${lightMode ? "#e2e8f0" : "#334155"}`,
borderRadius: 12,
background: lightMode ? "#f8fafc" : "#111c30"
}}
>
<div>
<strong>Calendar progression</strong>
<div style={{ marginTop: 4, color: lightMode ? "#64748b" : "#94a3b8", fontSize: 13 }}>
Choose whether time advances day by day or pauses at key events.
</div>
</div>
<select
aria-label="Calendar progression"
value={progressionMode}
onChange={(event) => {
const nextMode = event.target.value as ProgressionMode;
setProgressionMode(nextMode);
savePreferences({ progressionMode: nextMode });
}}
style={{
flexShrink: 0,
minWidth: 170,
padding: "9px 12px",
border: `1px solid ${lightMode ? "#cbd5e1" : "#475569"}`,
borderRadius: 10,
background: lightMode ? "#ffffff" : "#1e293b",
color: lightMode ? "#0f172a" : "#f8fafc",
fontWeight: 700
}}
>
<option value="OPTIMIZED">Key events</option>
<option value="BALANCED">Balanced</option>
<option value="DAILY">Day by day</option>
</select>
</div>

<div
style={{
display: "flex",
justifyContent: "space-between",
alignItems: "center",
gap: 16,
padding: 16,
border: `1px solid ${lightMode ? "#e2e8f0" : "#334155"}`,
borderRadius: 12,
background: lightMode ? "#f8fafc" : "#111c30"
}}
>
<div>
<strong>Text size</strong>
<div style={{ marginTop: 4, color: lightMode ? "#64748b" : "#94a3b8", fontSize: 13 }}>
Adjust the size of rem-based text throughout the app.
</div>
</div>
<select
aria-label="Text size"
value={textSize}
onChange={(event) => {
const nextSize = event.target.value as TextSize;
setTextSize(nextSize);
savePreferences({ textSize: nextSize });
}}
style={{
flexShrink: 0,
minWidth: 150,
padding: "9px 12px",
border: `1px solid ${lightMode ? "#cbd5e1" : "#475569"}`,
borderRadius: 10,
background: lightMode ? "#ffffff" : "#1e293b",
color: lightMode ? "#0f172a" : "#f8fafc",
fontWeight: 700
}}
>
<option value="STANDARD">Standard</option>
<option value="LARGE">Large</option>
<option value="EXTRA_LARGE">Extra large</option>
</select>
</div>
</div>
</section>
);

default:
return <CalendarScreen
club={managerClub ?? clubs[0]}
appearance={appearanceMode}
seasonState={seasonState}
events={calendarEvents}
currentDate={calendarDate}
delegationSettings={delegationSettings}
nextEvent={nextCalendarEvent}
assistantManagedTraining={assistantManagedTraining}
userTrainingSchedule={userTrainingSchedule}
onScheduleTraining={(session) => setUserTrainingSchedule((prev) => [...prev.filter((item) => new Date(item.date).toDateString() !== new Date(session.date).toDateString()), session])}
onEventClick={() => {}}
onContinue={() => {}}
/>;
}
};

function isTradeWindowDate(value) { return isMovementWindow(seasonState, value); }
function calendarContext(overrides = {}) {
return { players: allPlayers, clubs, userClub: (managerClub ?? clubs[0]).name, date: seasonState.calendarClock?.date ?? "2026-10-01",
selection: teamSelection, tactics, delegation: delegationSettings, assistantTraining: assistantManagedTraining, trainingSchedule: userTrainingSchedule, fitness: playerFitness,
trainingPlanByClub: { [(managerClub ?? clubs[0]).name]: trainingPlan },
mode: progressionMode, makeFixture: year => scheduleFixtureAcrossWeekend(generateFixture(year)), ...overrides };
}
const calendarEvents = useMemo(() => managerClub ? calendarEventsForWorld(seasonState, calendarContext()) : [],
[managerClub, seasonState, teamSelection, allPlayers, playerFitness, assistantManagedTraining, userTrainingSchedule, delegationSettings]);
const nextCalendarEvent = getNextEvent(calendarEvents, calendarDate);
const currentDayEvents = calendarEvents.filter(event => !event.resolved && dayKey(event.date) <= dayKey(calendarDate) && (event.type !== "MATCH" || dayKey(event.date) === dayKey(calendarDate)));

function handleCalendarStop(event, seasonSnapshot = seasonState) {
if (!event) return;
if (event.type === "SEASON_REVIEW") {
// Keep the completed season on screen so its Grand Final presentation
// and award review can be read before the manager enters the offseason.
setActiveScreen("SEASON");
} else if (event.type === "MATCH") {
setActiveScreen("SEASON");
if (!isCurrentTeamSheetConfirmed(seasonSnapshot)) prepareTeamSheet(seasonSnapshot);
} else if (event.type === "BROWNLOW_COUNT") {
setActiveScreen("STATISTICS");
setNavigationRoute(previous => ({ screen: "STATISTICS", tab: "BROWNLOW", sequence: previous.sequence + 1 }));
} else if (event.type === "DRAFT") {
handleOpenDraftBoard();
} else if (event.type === "NOTICE") {
setSeasonState(previous => ({ ...previous, resolvedCalendarEventIds: [...(previous.resolvedCalendarEventIds ?? []), event.id] }));
setActiveScreen("INBOX");
} else if (event.screen) {
if (event.screen === "SQUAD") setSquadInitialTab("CONTRACTS");
setActiveScreen(event.screen);
}
}
async function runCalendar(command = "CONTINUE", options = {}) {
if (calendarBusy.current || activeScreen === "MATCH_DAY") return;
if (command === "TRADE" && isMovementWindow(seasonState, calendarDate)) { setActiveScreen("RECRUITMENT"); return; }
calendarBusy.current = true; calendarCancel.current = false; calendarAbort.current = new AbortController(); setCalendarError("");
setCalendarProcessing({ date: dayKey(calendarDate), target: String(command), slot: "Starting" });
try {
const context = calendarContext({ ...options, cancelled: () => calendarCancel.current, onProgress: setCalendarProcessing });
const result = await runCalendarSimulation({ season: seasonState, fitness: playerFitness }, command, context, { onProgress: setCalendarProcessing, signal: calendarAbort.current.signal });
setSeasonState(result.world.season);
setPlayerFitness(result.world.fitness);
// A completed checkpoint is published atomically. Navigation occurs after React sees that snapshot.
if (result.stop?.type === "MATCH") {
handleCalendarStop(result.stop, result.world.season);
} else if (result.stop && result.stop.type !== "PAUSED") {
setActiveScreen(result.stop.screen ?? (result.stop.type === "DRAFT" ? "RECRUITMENT" : "SEASON"));
if (result.stop.type === "BROWNLOW_COUNT") setNavigationRoute(previous => ({ screen: "STATISTICS", tab: "BROWNLOW", sequence: previous.sequence + 1 }));
}
if (result.stop?.type === "SEASON_REVIEW") setActiveScreen("SEASON");
return result;
} catch (error) {
setCalendarError(error instanceof Error ? error.message : "Calendar processing failed. The last committed state is preserved.");
} finally { calendarBusy.current = false; setCalendarProcessing(null); }
}
function handleGameProgress() {
const world = { season: { ...seasonState, calendarClock: seasonState.calendarClock ?? createClock(calendarDate) }, fitness: playerFitness };
const blocker = getWorldBlocker(world, calendarContext());
if (blocker) { handleCalendarStop(blocker); return; }
return runCalendar("CONTINUE");
}
function advanceCalendarToDate(date) { return runCalendar(dayKey(date)); }
function advanceCalendarOneDay() { return runCalendar("DAY"); }
function simulateCalendarStage(date) {
// A stage whose date has already passed (for example after a developer skip) would ask the calendar for a
// date in the past, which does nothing and leaves the round stuck. Step forward a day instead, so any match
// that is due is played and the competition can move on.
const target = date ? dayKey(date) : "DAY";
const today = dayKey(calendarDate);
const slot = Number(seasonState.calendarClock?.slot ?? 0);
const stageIsPast = target !== "DAY" && (target < today || (target === today && slot > 2));
return runCalendar(stageIsPast ? "DAY" : target, { simulateUserMatches: true, finishTargetDay: true });
}
async function skipCalendarTo(target) {
if (!import.meta.env.DEV) return { ok: false, error: "Developer shortcuts are only available in development." };
const today = dayKey(seasonState.calendarClock?.date ?? calendarDate);
if (target === "BROWNLOW" && seasonState.brownlowCountReady && !seasonState.brownlowCountCompleted) {
setActiveScreen("STATISTICS");
setNavigationRoute(previous => ({ screen: "STATISTICS", tab: "BROWNLOW", sequence: previous.sequence + 1 }));
return { ok: true, date: today };
}
let fixtureForTarget = seasonState.fixture ?? [];
let regularDates = fixtureForTarget.flatMap(round => (round.matches ?? []).map(match => dayKey(match.date))).sort();
if (!regularDates.length || regularDates.at(-1) <= today) {
const nextYear = Number(seasonState.seasonYear) + (seasonState.seasonHasStarted ? 1 : 0);
fixtureForTarget = scheduleFixtureAcrossWeekend(generateFixture(nextYear));
regularDates = fixtureForTarget.flatMap(round => (round.matches ?? []).map(match => dayKey(match.date))).sort();
}
const lastRegularDay = regularDates.at(-1) ?? today;
let firstUserGame = fixtureForTarget
.flatMap(round => round.matches ?? [])
.filter(match => [match.homeTeam ?? match.home, match.awayTeam ?? match.away].includes((managerClub ?? clubs[0]).name))
.sort((a, b) => dayKey(a.date).localeCompare(dayKey(b.date)))[0];
if (target === "FIRST_GAME" && (!firstUserGame || dayKey(firstUserGame.date) <= today)) {
const nextYear = Number(seasonState.seasonYear) + (seasonState.seasonHasStarted ? 1 : 0);
fixtureForTarget = scheduleFixtureAcrossWeekend(generateFixture(nextYear));
firstUserGame = fixtureForTarget
.flatMap(round => round.matches ?? [])
.filter(match => [match.homeTeam ?? match.home, match.awayTeam ?? match.away].includes((managerClub ?? clubs[0]).name))
.sort((a, b) => dayKey(a.date).localeCompare(dayKey(b.date)))[0];
}
const phaseDates = {
FINALS: addDays(lastRegularDay, 14),
BROWNLOW: addDays(lastRegularDay, 29),
GRAND_FINAL: addDays(lastRegularDay, 35),
};
let destination = phaseDates[target];
if (target === "FIRST_GAME") destination = firstUserGame ? dayKey(firstUserGame.date) : null;
if (target === "DRAFT") {
const thisDraft = rulesForDate(seasonState, today).nationalDraft;
destination = thisDraft > today ? thisDraft : rulesForDate(seasonState, `${Number(today.slice(0, 4)) + 1}-01-01`).nationalDraft;
}
if (target === "TRADE") {
const thisTrade = rulesForDate(seasonState, today).tradeOpen;
destination = thisTrade > today ? thisTrade : rulesForDate(seasonState, `${Number(today.slice(0, 4)) + 1}-01-01`).tradeOpen;
}
if (!destination) return { ok: false, error: "Choose a valid calendar destination." };
if (calendarBusy.current) return { ok: false, error: "The calendar is already advancing." };
calendarBusy.current = true;
calendarCancel.current = false;
calendarAbort.current = new AbortController();
setCalendarError("");
setCalendarProcessing({ date: today, target: destination, slot: "Starting" });
const context = calendarContext({
simulateUserMatches: target !== "FIRST_GAME",
finishTargetDay: false,
developerFastForward: target,
developerSkipTargetDate: destination,
// Developer skips delegate decisions that would otherwise require the
// manager to stop, while preserving every daily simulation checkpoint.
delegation: { ...delegationSettings, draft: true, injuryManagement: true, contractRenewals: true,
tradeNegotiations: true, staff_approval: true, playerDevelopment: true },
});
let result;
try {
result = await runCalendarSimulation({ season: seasonState, fitness: playerFitness }, destination, context,
{ onProgress: setCalendarProcessing, signal: calendarAbort.current.signal });
let rolloverCount = 0;
while (result.stop?.type === "SEASON_REVIEW" && rolloverCount < 3) {
rolloverCount += 1;
const reviewed = calculateSeasonRollover(result.world.season, result.world.fitness, localDate(result.world.season.calendarClock.date));
const offseason = { ...reviewed, phase: "OFFSEASON", offseasonStep: 0 };
const nextFitness = Object.fromEntries(Object.entries(result.world.fitness ?? {}).map(([id, state]: [string, any]) =>
[id, { ...state, developmentContribution: 0 }]));
result = await runCalendarSimulation({ season: offseason, fitness: nextFitness }, destination, context,
{ onProgress: setCalendarProcessing, signal: calendarAbort.current.signal });
}
if (["FINALS", "BROWNLOW", "GRAND_FINAL"].includes(target) || rolloverCount > 0) {
const scheduledMatches = (result.world.season.fixture ?? []).reduce((total, round) => total + (round.matches?.length ?? 0), 0);
const recordedMatches = (result.world.season.roundHistory ?? []).reduce((total, round) => total + (round.results?.length ?? 0), 0);
if (scheduledMatches && recordedMatches < scheduledMatches) {
throw new Error(`Simulation stopped with ${recordedMatches} of ${scheduledMatches} regular-season matches recorded. The skip was not applied.`);
}
}
setSeasonState(result.world.season);
setPlayerFitness(result.world.fitness);
const reachedTarget = result.stop?.type === "BROWNLOW_COUNT" && target === "BROWNLOW"
|| result.stop?.type === "MATCH" && target === "FIRST_GAME"
|| !result.stop && result.world.season.calendarClock.date >= destination;
if (!reachedTarget) {
setActiveScreen(result.stop?.screen ?? "SEASON");
return { ok: false, error: result.stop?.title ?? "The calendar stopped before the selected event.", date: result.world.season.calendarClock.date };
}
if (target === "BROWNLOW") {
setActiveScreen("STATISTICS");
setNavigationRoute(previous => ({ screen: "STATISTICS", tab: "BROWNLOW", sequence: previous.sequence + 1 }));
} else if (target === "FIRST_GAME" && result.stop?.type === "MATCH") {
handleCalendarStop(result.stop, result.world.season);
} else if (target === "DRAFT" || target === "TRADE") {
setActiveScreen("RECRUITMENT");
setNavigationRoute(previous => ({ screen: "RECRUITMENT", tab: target === "DRAFT" ? "DRAFT" : "TRADE", sequence: previous.sequence + 1 }));
} else setActiveScreen("SEASON");
return { ok: true, date: result.world.season.calendarClock.date, result };
} catch (error) {
const message = error instanceof Error ? error.message : "Calendar processing failed.";
setCalendarError(message);
return { ok: false, error: message };
} finally {
calendarBusy.current = false;
setCalendarProcessing(null);
}
}
async function runTasmaniaFirstSeason() {
if (calendarBusy.current) return;
const destination = TASMANIA_CAREER.handoverDate;
calendarBusy.current = true;
calendarCancel.current = false;
calendarAbort.current = new AbortController();
setCalendarError("");
setCalendarProcessing({ date: dayKey(seasonState.calendarClock?.date ?? TASMANIA_CAREER.startDate), target: destination, slot: "Starting" });
const context = calendarContext({
simulateUserMatches: true,
finishTargetDay: false,
developerFastForward: "TRADE",
developerSkipTargetDate: destination,
delegation: { ...delegationSettings, draft: true, injuryManagement: true, contractRenewals: true,
tradeNegotiations: true, staff_approval: true, playerDevelopment: true },
});
try {
let result = await runCalendarSimulation({ season: seasonState, fitness: playerFitness }, destination, context,
{ onProgress: setCalendarProcessing, signal: calendarAbort.current.signal });
let rolloverCount = 0;
while (result.stop?.type === "SEASON_REVIEW" && rolloverCount < 3) {
rolloverCount += 1;
const reviewed = calculateSeasonRollover(result.world.season, result.world.fitness, localDate(result.world.season.calendarClock.date));
const offseason = { ...reviewed, phase: "OFFSEASON", offseasonStep: 0 };
const nextFitness = Object.fromEntries(Object.entries(result.world.fitness ?? {}).map(([id, state]: [string, any]) =>
[id, { ...state, developmentContribution: 0 }]));
result = await runCalendarSimulation({ season: offseason, fitness: nextFitness }, destination, context,
{ onProgress: setCalendarProcessing, signal: calendarAbort.current.signal });
}
if (result.stop || result.world.season.calendarClock.date < destination) {
setCalendarError(result.stop?.type === "PAUSED" ? "Simulation paused. Resume to continue the simulation." : `The simulation stopped early (${result.stop?.title ?? "unknown reason"}). Resume to try again.`);
return;
}
const scheduled = (result.world.season.fixture ?? []).reduce((total: number, round: any) => total + (round.matches?.length ?? 0), 0);
const recorded = (result.world.season.roundHistory ?? []).reduce((total: number, round: any) => total + (round.results?.length ?? 0), 0);
if (scheduled && recorded < scheduled) throw new Error(`Simulation stopped with ${recorded} of ${scheduled} regular-season matches recorded.`);
setSeasonState({ ...result.world.season, expansionCareer: { ...result.world.season.expansionCareer, stage: "CONCESSION" } });
setPlayerFitness(result.world.fitness);
setActiveScreen("RECRUITMENT");
setNavigationRoute(previous => ({ screen: "RECRUITMENT", tab: "TRADE", sequence: previous.sequence + 1 }));
} catch (error) {
setCalendarError(error instanceof Error ? error.message : "Simulating the first season failed. Resume to try again.");
} finally {
calendarBusy.current = false;
setCalendarProcessing(null);
}
}
function changeCalendarDecision(id, action) {
const event = seasonState.calendarDecisions?.find(event => event.id === id);
if (event?.type === "INJURY" && action === "ACKNOWLEDGE") setPlayerFitness(previous => ({ ...previous, [event.playerId]: { ...previous[event.playerId], trainingProgram: "RECOVERY_TRAINING" } }));
setSeasonState(previous => resolveCalendarDecision(previous, id, action));
}
function handleTribunalDecision(caseId, action) {
const incident = (seasonState.tribunalCases ?? []).find(item => item.id === caseId);
if (!incident || incident.status !== "PENDING") return;
if (action === "CHALLENGE" && Number(seasonState.clubAdministration?.cashBalance ?? 0) < incident.legalFee) return;
const resolved = resolveTribunalCase(seasonState, playerFitness, caseId, action, (managerClub ?? clubs[0]).name);
setSeasonState(resolved.season);
setPlayerFitness(resolved.fitness);
}

function commitDraftOperation(previous, operation) {
if (!operation) return previous;
const wasComplete = Boolean(previous.draftState?.completed);
const draftState = operation.draftState;
const draftHistory = [...(previous.draftHistory ?? [])];
const existingPlayerIds = new Set([
...basePlayers,
...(previous.generatedPlayers ?? []),
].map((player) => String(player.id)));
const draftedPlayers = (operation.players ?? []).filter((player) => !existingPlayerIds.has(String(player.id)));
const draftContracts = { ...(operation.contracts ?? {}) };
draftedPlayers.forEach((player) => {
const key = String(player.id);
draftContracts[key] = {
...(draftContracts[key] ?? {}),
club: player.club,
salary: draftContracts[key]?.salary ?? player.contract?.salary ?? 150_000,
yearsRemaining: draftContracts[key]?.yearsRemaining ?? player.contract?.yearsRemaining ?? 2,
role: draftContracts[key]?.role ?? "Rookie",
rookie: true,
};
});
let draftPickAssets = previous.draftPickAssets ?? [];
if (!wasComplete && draftState?.completed) {
draftHistory.push({
draftYear: draftState.draftYear,
draftOrder: draftState.draftOrder,
picks: draftState.picks,
initial: Boolean(draftState.initial),
kind: draftState.kind ?? "NATIONAL",
bidLog: draftState.bidLog ?? [],
});
draftPickAssets = applyDraftDeficits(draftPickAssets, draftState);
if (!["ROOKIE", "MID_SEASON"].includes(draftState.kind)) draftPickAssets = createFutureDraftPicks(
Math.max(Number(previous.seasonYear ?? 2027), Number(draftState.draftYear) + 1),
clubs,
draftPickAssets.filter((pick) => pick.year >= Number(draftState.draftYear) + 1),
);
}
const combinedPlayers = [
...basePlayers,
...(previous.generatedPlayers ?? []),
...draftedPlayers,
];
const proposedContracts = { ...(previous.playerContracts ?? {}), ...draftContracts };
if ([...new Set(draftedPlayers.map(player => player.club))].some(club => !checkClubCommitments(combinedPlayers, proposedContracts, club, previous.seasonYear, 0, club === managerClub?.name ? previous.clubAdministration : previous.leagueAdministration?.[club]).ok)) return previous;
const listManaged = enforceAIClubListLimits(
combinedPlayers,
{ ...(previous.playerContracts ?? {}), ...draftContracts },
clubs,
(managerClub ?? clubs[0]).name,
Number(previous.seasonYear ?? 2027),
);
return {
...previous,
draftState,
draftHistory,
draftPickAssets,
generatedPlayers: [...(previous.generatedPlayers ?? []), ...draftedPlayers],
playerContracts: listManaged.contracts,
};
}

function prepareDraftLists(previous) {
const currentPlayers = [...basePlayers, ...(previous.generatedPlayers ?? [])];
const draftYear = `${previous.draftState?.draftYear}:${previous.draftState?.kind ?? "NATIONAL"}`;
if (previous.draftListsPreparedForYear !== draftYear) {
const retained = { ...(previous.playerContracts ?? {}) };
const released = delistUnretainedAIExpiredPlayers(currentPlayers, retained, clubs, managerClub?.name, previous.draftState?.draftYear);
const prepared = enforceAIClubListLimits(currentPlayers, released.contracts, clubs, managerClub?.name, previous.draftState?.draftYear, previous.draftState?.kind ? 44 : 41);
previous = { ...previous, playerContracts: prepared.contracts, draftListsPreparedForYear: draftYear };
}
return previous;
}

function handleDraftPick(prospectId) {
setSeasonState((previous) => {
previous = prepareDraftLists(previous);
const capCheck = checkClubCommitments([...basePlayers, ...(previous.generatedPlayers ?? [])], previous.playerContracts ?? {}, managerClub?.name, previous.seasonYear, 1, previous.clubAdministration);
if (!capCheck.ok) return { ...previous, mailMessages: [...(previous.mailMessages ?? []), { id: `draft-cap-${previous.draftState?.pickIndex}`, type: "AI_TRADE_NEWS", subject: "Draft selection blocked: salary cap", summary: capCheck.reason, detail: "You must pass if you cannot afford the rookie contract. Contracted delistings do not free salary cap space." }] };
const result = selectDraftProspect(
previous.draftState,
prospectId,
managerClub?.name,
previous.seasonYear,
);
return commitDraftOperation(previous, result && {
draftState: result.draftState,
players: [result.player],
contracts: { [String(result.player.id)]: result.contract },
});
});
}

// The manager bids on a rival's father-son / academy prospect at their pick.
function handleDraftBid(prospectId) {
setSeasonState((previous) => {
previous = prepareDraftLists(previous);
const currentPlayers = [...basePlayers, ...(previous.generatedPlayers ?? [])];
const capCheck = checkClubCommitments(currentPlayers, previous.playerContracts ?? {}, managerClub?.name, previous.seasonYear, 1, previous.clubAdministration);
if (!capCheck.ok) return { ...previous, mailMessages: [...(previous.mailMessages ?? []), { id: `draft-cap-${previous.draftState?.pickIndex}`, type: "AI_TRADE_NEWS", subject: "Draft bid blocked: salary cap", summary: capCheck.reason, date: calendarDate, read: false }] };
const result = placeDraftBid(previous.draftState, prospectId, managerClub?.name, {
players: currentPlayers,
contractsByPlayer: previous.playerContracts ?? {},
contractSeason: previous.seasonYear,
clubs: draftClubsForYear(previous.draftState?.draftYear ?? previous.seasonYear),
administrationByClub: previous.leagueAdministration ?? {},
});
return commitDraftOperation(previous, result);
});
}

// The manager answers a bid on one of their father-son / academy prospects.
// Returns an error message when the answer cannot be applied, otherwise null.
function handleResolveDraftBid({ match = false, pickIndices = [] } = {}) {
const pending = seasonState.draftState?.pendingBid;
if (!pending) return "There is no bid to answer.";
if (match) {
const check = validateMatchPlan(seasonState.draftState, pending.homeClub, pending.bidIndex, pickIndices);
if (!check.ok) return check.reason;
const capCheck = checkClubCommitments([...basePlayers, ...(seasonState.generatedPlayers ?? [])], seasonState.playerContracts ?? {}, managerClub?.name, seasonState.seasonYear, 1, seasonState.clubAdministration);
if (!capCheck.ok) return capCheck.reason;
}
setSeasonState((previous) => {
previous = prepareDraftLists(previous);
const result = resolvePendingBid(previous.draftState, { match, pickIndices }, { contractSeason: previous.seasonYear, clubs: draftClubsForYear(previous.draftState?.draftYear ?? previous.seasonYear) });
if (!result || result.error) return previous;
return commitDraftOperation(previous, result);
});
return null;
}

function handleDraftPass() {
setSeasonState((previous) => {
previous = prepareDraftLists(previous);
const result = passDraftPick(previous.draftState, managerClub?.name);
return commitDraftOperation(previous, result);
});
}

function handleAdvanceDraftAI() {
setSeasonState((previous) => {
const currentPlayers = [...basePlayers, ...(previous.generatedPlayers ?? [])];
previous = prepareDraftLists(previous);
const result = processAIDraftPicks(
previous.draftState,
managerClub?.name,
currentPlayers,
previous.playerContracts ?? {},
previous.seasonYear,
draftClubsForYear(previous.draftState?.draftYear ?? previous.seasonYear),
previous.leagueAdministration ?? {},
);
if (result.draftState === previous.draftState) return previous;
return commitDraftOperation(previous, result);
});
}

function handleShopTradeComplete({
targetClub,
outgoingPlayerIds = [],
outgoingPickIds = [],
incomingPlayerIds = [],
incomingPickIds = [],
incomingContracts = {},
}) {
const userClubName = (managerClub ?? clubs[0]).name;
const previous = seasonState;
if (!targetClub || targetClub === userClubName) return { ok: false, reason: "Choose another club for this trade." };
if (!isMovementWindow(previous, calendarDate, "trade")) return { ok: false, reason: "The trade period is not open." };

const outgoingPlayerSet = new Set(outgoingPlayerIds.map(String));
const outgoingPickSet = new Set(outgoingPickIds.map(String));
const incomingPlayerSet = new Set(incomingPlayerIds.map(String));
const incomingPickSet = new Set(incomingPickIds.map(String));
if (
outgoingPlayerSet.size + outgoingPickSet.size < 1
|| incomingPlayerSet.size + incomingPickSet.size < 1
|| outgoingPlayerSet.size + outgoingPickSet.size > 3
|| incomingPlayerSet.size + incomingPickSet.size > 3
) return { ok: false, reason: "Each side must include one to three unique assets." };

const allPlayerById = new Map(allPlayers.map((player) => [String(player.id), player]));
const outgoingPlayers = [...outgoingPlayerSet].map((id) => allPlayerById.get(id));
const incomingPlayers = [...incomingPlayerSet].map((id) => allPlayerById.get(id));
if (outgoingPlayers.some((player) => !player || getCareerClub(player, previous.playerContracts ?? {}) !== userClubName)) {
return { ok: false, reason: "One of your players is no longer available at your club." };
}
if (incomingPlayers.some((player) => !player || getCareerClub(player, previous.playerContracts ?? {}) !== targetClub)) {
return { ok: false, reason: "One of the selected players is no longer available at that club." };
}
if ([...outgoingPlayers, ...incomingPlayers].some((player) => !tradeEligibility(player, previous, previous.seasonYear).eligible)) {
return { ok: false, reason: "A selected player is no longer eligible to be traded." };
}

const assets = previous.draftPickAssets ?? [];
const outgoingPicksValid = [...outgoingPickSet].every((id) => assets.some((pick) => String(pick.id) === id && pick.currentOwner === userClubName));
const incomingPicksValid = [...incomingPickSet].every((id) => assets.some((pick) => String(pick.id) === id && pick.currentOwner === targetClub));
if (!outgoingPicksValid || !incomingPicksValid) {
return { ok: false, reason: "A selected draft pick has already moved or is no longer available." };
}

const transactionDate = new Date(calendarDate);
const signedSeason = transactionDate.getMonth() >= 9 ? transactionDate.getFullYear() + 1 : previous.seasonYear;
const playerContracts = { ...(previous.playerContracts ?? {}) };
for (const player of outgoingPlayers) {
const id = String(player.id);
playerContracts[id] = { ...(playerContracts[id] ?? player.contract ?? {}), club: targetClub };
}
for (const player of incomingPlayers) {
const id = String(player.id);
const terms = incomingContracts[id];
if (!terms) return { ok: false, reason: `Contract terms are missing for ${player.name}.` };
const years = Number(terms.yearsRemaining ?? terms.years);
const salary = Number(terms.salary ?? terms.yearlySalaries?.[0]);
if (!Number.isFinite(years) || years < 1 || !Number.isFinite(salary) || salary < 0) {
return { ok: false, reason: `The negotiated contract for ${player.name} is incomplete.` };
}
playerContracts[id] = {
...(playerContracts[id] ?? player.contract ?? {}),
...terms,
club: userClubName,
salary,
yearsRemaining: years,
yearlySalaries: Array.isArray(terms.yearlySalaries) && terms.yearlySalaries.length
? terms.yearlySalaries
: Array.from({ length: Math.ceil(years) }, () => salary),
promises: terms.promises ?? [],
signedSeason: terms.signedSeason ?? signedSeason,
};
}

for (const club of [userClubName, targetClub]) {
const capCheck = checkClubCommitments(
allPlayers,
playerContracts,
club,
previous.seasonYear,
0,
club === userClubName ? previous.clubAdministration : previous.leagueAdministration?.[club],
);
if (!capCheck.ok) return { ok: false, reason: capCheck.reason };
}

const draftPickAssets = assets.map((pick) => {
if (outgoingPickSet.has(String(pick.id)) && pick.currentOwner === userClubName) return { ...pick, currentOwner: targetClub };
if (incomingPickSet.has(String(pick.id)) && pick.currentOwner === targetClub) return { ...pick, currentOwner: userClubName };
return pick;
});
let draftState = previous.draftState;
if (draftState) {
const currentYearPicks = draftPickAssets
.filter((pick) => pick.year === draftState.draftYear && pick.resolved && Number.isFinite(pick.number))
.sort((a, b) => a.number - b.number);
if (currentYearPicks.length === draftState.totalPicks) {
draftState = { ...draftState, ...draftPickMetaFields(currentYearPicks) };
}
}

const pickById = new Map(assets.map((pick) => [String(pick.id), pick]));
const playerMoves = [
...outgoingPlayers.map((player) => ({ playerId: player.id, playerName: player.name, fromClub: userClubName, toClub: targetClub })),
...incomingPlayers.map((player) => ({ playerId: player.id, playerName: player.name, fromClub: targetClub, toClub: userClubName })),
];
const pickMoves = [
...[...outgoingPickSet].flatMap((id) => { const pick = pickById.get(id); return pick ? [{ pickName: formatDraftPick(pick), fromClub: userClubName, toClub: targetClub }] : []; }),
...[...incomingPickSet].flatMap((id) => { const pick = pickById.get(id); return pick ? [{ pickName: formatDraftPick(pick), fromClub: targetClub, toClub: userClubName }] : []; }),
];
const nextState = addTradePeriodTransaction(
{ ...previous, playerContracts, draftPickAssets, draftState },
{
tradePeriodYear: transactionDate.getFullYear(),
week: transactionDate.getDate() <= 11 ? 1 : 2,
date: transactionDate,
playerMoves,
pickMoves,
},
);
setSeasonState(nextState);
return { ok: true };
}

// Trade Genius: applies one or more club legs as a single atomic change. Every
// leg is validated against the same snapshot, so a multi-club trade either
// completes for all clubs or not at all.
function handleTradeGeniusComplete({
legs = [],
incomingContracts = {},
}) {
const userClubName = (managerClub ?? clubs[0]).name;
const previous = seasonState;
if (!Array.isArray(legs) || !legs.length) return { ok: false, reason: "There is no trade to complete." };
if (!isMovementWindow(previous, calendarDate, "trade")) return { ok: false, reason: "The trade period is not open." };
const partnerClubs = legs.map((leg) => leg.targetClub);
if (partnerClubs.some((club) => !club || club === userClubName) || new Set(partnerClubs).size !== partnerClubs.length) {
return { ok: false, reason: "Each leg must be with a different club." };
}

const allPlayerById = new Map(allPlayers.map((player) => [String(player.id), player]));
const assets = previous.draftPickAssets ?? [];
const outgoingPlayerIdsSeen = new Set<string>();
const incomingPlayerIdsSeen = new Set<string>();
const outgoingPickIdsSeen = new Set<string>();
const incomingPickIdsSeen = new Set<string>();
const outgoingPickDestination = new Map<string, string>();
const resolvedLegs = [];

for (const leg of legs) {
const outgoingPlayerIds = [...new Set((leg.outgoingPlayerIds ?? []).map(String))] as string[];
const outgoingPickIds = [...new Set((leg.outgoingPickIds ?? []).map(String))] as string[];
const incomingPlayerIds = [...new Set((leg.incomingPlayerIds ?? []).map(String))] as string[];
const incomingPickIds = [...new Set((leg.incomingPickIds ?? []).map(String))] as string[];
const outgoingCount = outgoingPlayerIds.length + outgoingPickIds.length;
const incomingCount = incomingPlayerIds.length + incomingPickIds.length;
if (outgoingCount < 1 || incomingCount < 1 || outgoingCount > 3 || incomingCount > 3) {
return { ok: false, reason: `${leg.targetClub}: each side must include one to three unique assets.` };
}
for (const id of outgoingPlayerIds) { if (outgoingPlayerIdsSeen.has(id)) return { ok: false, reason: "A player appears in more than one leg of this trade." }; outgoingPlayerIdsSeen.add(id); }
for (const id of incomingPlayerIds) { if (incomingPlayerIdsSeen.has(id)) return { ok: false, reason: "A player appears in more than one leg of this trade." }; incomingPlayerIdsSeen.add(id); }
for (const id of outgoingPickIds) { if (outgoingPickIdsSeen.has(id)) return { ok: false, reason: "A draft pick appears in more than one leg of this trade." }; outgoingPickIdsSeen.add(id); outgoingPickDestination.set(id, leg.targetClub); }
for (const id of incomingPickIds) { if (incomingPickIdsSeen.has(id)) return { ok: false, reason: "A draft pick appears in more than one leg of this trade." }; incomingPickIdsSeen.add(id); }

const outgoingPlayers = outgoingPlayerIds.map((id) => allPlayerById.get(id));
const incomingPlayers = incomingPlayerIds.map((id) => allPlayerById.get(id));
if (outgoingPlayers.some((player) => !player || getCareerClub(player, previous.playerContracts ?? {}) !== userClubName)) {
return { ok: false, reason: "One of your players is no longer available at your club." };
}
if (incomingPlayers.some((player) => !player || getCareerClub(player, previous.playerContracts ?? {}) !== leg.targetClub)) {
return { ok: false, reason: `One of the selected players is no longer available at ${leg.targetClub}.` };
}
if ([...outgoingPlayers, ...incomingPlayers].some((player) => !tradeEligibility(player, previous, previous.seasonYear).eligible)) {
return { ok: false, reason: "A selected player is no longer eligible to be traded." };
}
const outgoingPicksValid = outgoingPickIds.every((id) => assets.some((pick) => String(pick.id) === id && pick.currentOwner === userClubName));
const incomingPicksValid = incomingPickIds.every((id) => assets.some((pick) => String(pick.id) === id && pick.currentOwner === leg.targetClub));
if (!outgoingPicksValid || !incomingPicksValid) {
return { ok: false, reason: "A selected draft pick has already moved or is no longer available." };
}
resolvedLegs.push({ targetClub: leg.targetClub, outgoingPlayers, incomingPlayers, outgoingPickIds, incomingPickIds });
}

const transactionDate = new Date(calendarDate);
const signedSeason = transactionDate.getMonth() >= 9 ? transactionDate.getFullYear() + 1 : previous.seasonYear;
const playerContracts = { ...(previous.playerContracts ?? {}) };
for (const leg of resolvedLegs) {
for (const player of leg.outgoingPlayers) {
const id = String(player.id);
playerContracts[id] = { ...(playerContracts[id] ?? player.contract ?? {}), club: leg.targetClub };
}
for (const player of leg.incomingPlayers) {
const id = String(player.id);
const terms = incomingContracts[id];
if (!terms) return { ok: false, reason: `Contract terms are missing for ${player.name}.` };
const years = Number(terms.yearsRemaining ?? terms.years);
const salary = Number(terms.salary ?? terms.yearlySalaries?.[0]);
if (!Number.isFinite(years) || years < 1 || !Number.isFinite(salary) || salary < 0) {
return { ok: false, reason: `The negotiated contract for ${player.name} is incomplete.` };
}
playerContracts[id] = {
...(playerContracts[id] ?? player.contract ?? {}),
...terms,
club: userClubName,
salary,
yearsRemaining: years,
yearlySalaries: Array.isArray(terms.yearlySalaries) && terms.yearlySalaries.length
? terms.yearlySalaries
: Array.from({ length: Math.ceil(years) }, () => salary),
promises: terms.promises ?? [],
signedSeason: terms.signedSeason ?? signedSeason,
};
}
}

for (const club of [userClubName, ...partnerClubs]) {
const capCheck = checkClubCommitments(
allPlayers,
playerContracts,
club,
previous.seasonYear,
0,
club === userClubName ? previous.clubAdministration : previous.leagueAdministration?.[club],
);
if (!capCheck.ok) return { ok: false, reason: capCheck.reason };
}

const draftPickAssets = assets.map((pick) => {
const destination = outgoingPickDestination.get(String(pick.id));
if (destination && pick.currentOwner === userClubName) return { ...pick, currentOwner: destination };
if (incomingPickIdsSeen.has(String(pick.id))) return { ...pick, currentOwner: userClubName };
return pick;
});
let draftState = previous.draftState;
if (draftState) {
const currentYearPicks = draftPickAssets
.filter((pick) => pick.year === draftState.draftYear && pick.resolved && Number.isFinite(pick.number))
.sort((a, b) => a.number - b.number);
if (currentYearPicks.length === draftState.totalPicks) {
draftState = { ...draftState, ...draftPickMetaFields(currentYearPicks) };
}
}

const pickById = new Map(assets.map((pick) => [String(pick.id), pick]));
const playerMoves = resolvedLegs.flatMap((leg) => [
...leg.outgoingPlayers.map((player) => ({ playerId: player.id, playerName: player.name, fromClub: userClubName, toClub: leg.targetClub })),
...leg.incomingPlayers.map((player) => ({ playerId: player.id, playerName: player.name, fromClub: leg.targetClub, toClub: userClubName })),
]);
const pickMoves = resolvedLegs.flatMap((leg) => [
...leg.outgoingPickIds.flatMap((id) => { const pick = pickById.get(id); return pick ? [{ pickName: formatDraftPick(pick), fromClub: userClubName, toClub: leg.targetClub }] : []; }),
...leg.incomingPickIds.flatMap((id) => { const pick = pickById.get(id); return pick ? [{ pickName: formatDraftPick(pick), fromClub: leg.targetClub, toClub: userClubName }] : []; }),
]);
const nextState = addTradePeriodTransaction(
{ ...previous, playerContracts, draftPickAssets, draftState },
{
tradePeriodYear: transactionDate.getFullYear(),
week: transactionDate.getDate() <= 11 ? 1 : 2,
date: transactionDate,
playerMoves,
pickMoves,
},
);
setSeasonState(nextState);
return { ok: true };
}

function handleDraftPickTrade({ targetClub, outgoingPickIds = [], incomingPickIds = [] }) {
const userClubName = (managerClub ?? clubs[0]).name;
setSeasonState((previous) => {
if (previous.phase !== "OFFSEASON" || !isTradeWindowDate(calendarDate) || ![0, 1].includes(previous.offseasonStep ?? 0)) return previous;
if (previous.draftState?.picks?.length || (previous.draftState?.pickIndex ?? 0) > 0) return previous;
const assets = previous.draftPickAssets ?? [];
const outgoing = new Set(outgoingPickIds.map(String));
const incoming = new Set(incomingPickIds.map(String));
const outgoingValid = [...outgoing].every((id) => assets.some((pick) => String(pick.id) === id && pick.currentOwner === userClubName));
const incomingValid = [...incoming].every((id) => assets.some((pick) => String(pick.id) === id && pick.currentOwner === targetClub));
if (!outgoing.size || !incoming.size || outgoing.size > 3 || incoming.size > 3 || !outgoingValid || !incomingValid) return previous;
const draftPickAssets = assets.map((pick) => {
if (outgoing.has(String(pick.id))) return { ...pick, currentOwner: targetClub };
if (incoming.has(String(pick.id))) return { ...pick, currentOwner: userClubName };
return pick;
});
let draftState = previous.draftState;
if (draftState) {
const currentYearPicks = draftPickAssets
.filter((pick) => pick.year === draftState.draftYear && pick.resolved && Number.isFinite(pick.number))
.sort((a, b) => a.number - b.number);
if (currentYearPicks.length === draftState.totalPicks) {
draftState = { ...draftState, ...draftPickMetaFields(currentYearPicks) };
}
}
const pickName = (pick: any) => formatDraftPick(pick);
const offeredNames = assets.filter((pick) => outgoing.has(String(pick.id))).map(pickName);
const requestedNames = assets.filter((pick) => incoming.has(String(pick.id))).map(pickName);
const transactionDate = new Date(calendarDate);
const pickById = new Map(assets.map((pick: any) => [String(pick.id), pick]));
const transactionState = addTradePeriodTransaction(
{ ...previous, draftPickAssets, draftState },
{
tradePeriodYear: transactionDate.getFullYear(),
week: transactionDate.getDate() <= 11 ? 1 : 2,
date: transactionDate,
pickMoves: [
...[...outgoing].flatMap((id) => { const pick = pickById.get(id); return pick ? [{ pickName: formatDraftPick(pick), fromClub: userClubName, toClub: targetClub }] : []; }),
...[...incoming].flatMap((id) => { const pick = pickById.get(id); return pick ? [{ pickName: formatDraftPick(pick), fromClub: targetClub, toClub: userClubName }] : []; }),
],
},
);
return addTradeOutcome(
transactionState,
{
status: "SUCCESSFUL",
source: "Draft Board · Pick Trade",
otherClub: targetClub,
date: calendarDate,
summary: `Draft pick exchange completed with ${targetClub}.`,
offeredAssets: offeredNames,
requestedAssets: requestedNames,
},
);
});
}

function handleOpenDraftBoard() {
setSeasonState((previous) => {
if (previous.draftState) return previous;
const initial = !(previous.draftHistory ?? []).length;
return {
...previous,
draftState: createDraftState({
draftYear: initial ? 2026 : (previous.seasonYear ?? 2027),
ladder: previous.ladder ?? [],
clubs,
initial,
existingNames: [...basePlayers, ...(previous.generatedPlayers ?? [])].map((player) => player.name),
draftPickAssets: createFutureDraftPicks(previous.seasonYear ?? 2027, clubs, previous.draftPickAssets ?? []),
playerPool: [...basePlayers, ...(previous.generatedPlayers ?? [])],
academyClass: Object.values(previous.academies ?? {}).flatMap((academy: any) => academyDraftClass(academy, initial ? 2026 : (previous.seasonYear ?? 2027))),
}),
};
});
setActiveScreen("RECRUITMENT");
}

function calculateSeasonRollover(previous, fitnessSnapshot = playerFitness, reviewDate = calendarDate) {
const currentClub = managerClub ?? clubs[0];
const completedSeason = Number(previous.seasonYear ?? 2027);
if (Number(previous.rolloverCompletedForYear) === completedSeason) return previous;
const allCareerPlayers = [...basePlayers, ...(previous.generatedPlayers ?? [])];
const openingAdministration = previous.clubAdministration ?? createClubAdministrationState(currentClub, allCareerPlayers.filter((player) => getCareerClub(player, previous.playerContracts ?? {}) === currentClub.name), completedSeason);
const settledAdministration = previous.seasonHasStarted
? settleClubSalaryCap(openingAdministration, completedSeason, getClubPlayerPayments(allCareerPlayers, previous.playerContracts ?? {}, currentClub.name, 0, previous))
: openingAdministration;
let playerContracts = { ...(previous.playerContracts ?? {}) };
const retirementDecisions = decideSeasonRetirements(
allCareerPlayers,
playerContracts,
previous,
fitnessSnapshot,
completedSeason,
previous.playerDevelopment ?? {},
);
const retirementIds = new Set(retirementDecisions.map((decision) => String(decision.player.id)));
const retirementRecords = retirementDecisions.map(({ player, age, reason, risk, appearances }) => {
const id = String(player.id);
const clubName = getCareerClub(player, playerContracts) ?? player.club ?? "Unattached";
playerContracts[id] = {
...(playerContracts[id] ?? {}),
retired: true,
retirementSeason: completedSeason,
retirementReason: reason,
retiredAtAge: age,
yearsRemaining: 0,
};
return {
id: `retirement-${completedSeason}-${id}`,
playerId: id,
playerName: player.name,
club: clubName,
seasonYear: completedSeason,
age,
overall: Number(player.overall ?? 0),
appearances,
risk,
reason,
};
});
let currentPlayers = allCareerPlayers.filter((player) =>
!retirementIds.has(String(player.id)) && !playerContracts[String(player.id)]?.retired,
);
let draftPickAssets = [...(previous.draftPickAssets ?? [])];
const leaguePlayers = currentPlayers.map((player) => ({ ...player, club: getCareerClub(player, playerContracts) }));
const marketClubs = clubs.map((club) => ({
...club,
draftPicks: draftPickAssets.filter((pick) => pick.currentOwner === club.name && Number(pick.year) <= completedSeason + 2),
}));
// AI trades now execute on trade-period calendar days, not at season rollover.
const aiTradeEvents = [];
const completedAITrades: any[] = [];
for (const event of aiTradeEvents) {
if (event.result !== "ACCEPTED") continue;
const targetOwner = getCareerClub(event.target, playerContracts);
if (targetOwner !== event.seller) continue;
const incomingPlayers = (event.offer?.players ?? []).filter((player: any) => getCareerClub(player, playerContracts) === event.buyer);
if (incomingPlayers.length !== (event.offer?.players ?? []).length || !validTradePackage(event.offer)) continue;
if ((event.offer?.picks ?? []).some((offered: any) => !draftPickAssets.some((pick: any) => String(pick.id) === String(offered.id) && pick.currentOwner === event.buyer))) continue;
const candidateContracts = { ...playerContracts, [String(event.target.id)]: { ...(playerContracts[String(event.target.id)] ?? {}), club: event.buyer } };
incomingPlayers.forEach((player: any) => { candidateContracts[String(player.id)] = { ...(playerContracts[String(player.id)] ?? {}), club: event.seller }; });
if (![event.buyer, event.seller].every(club => checkClubCommitments(currentPlayers, candidateContracts, club, completedSeason, 3, club === currentClub.name ? previous.clubAdministration : previous.leagueAdministration?.[club]).ok)) continue;
playerContracts[String(event.target.id)] = { ...(playerContracts[String(event.target.id)] ?? {}), club: event.buyer };
incomingPlayers.forEach((player: any) => {
playerContracts[String(player.id)] = { ...(playerContracts[String(player.id)] ?? {}), club: event.seller };
});
const transferredPicks = (event.offer?.picks ?? []).filter((offeredPick: any) =>
draftPickAssets.some((pick: any) => String(pick.id) === String(offeredPick.id) && pick.currentOwner === event.buyer),
);
const offeredPickIds = new Set(transferredPicks.map((pick: any) => String(pick.id)));
draftPickAssets = draftPickAssets.map((pick) =>
offeredPickIds.has(String(pick.id)) && pick.currentOwner === event.buyer
? { ...pick, currentOwner: event.seller }
: pick,
);
completedAITrades.push({ ...event, transferredPlayers: incomingPlayers, transferredPicks });
}
currentPlayers = currentPlayers.map((player) => ({ ...player, club: getCareerClub(player, playerContracts) }));

// AI clubs make retention decisions before contracts roll over. Strong priorities
// are re-signed at a market rate if the deal fits under that club's cap.
const retentionEvents = generateAIRetentionOffers(currentPlayers, playerContracts, clubs, completedSeason);
const nextSeasonPayroll: Record<string, number> = {};
currentPlayers.forEach((player) => {
const owner = getCareerClub(player, playerContracts);
const terms = { ...player.contract, ...(playerContracts[String(player.id)] ?? {}) };
nextSeasonPayroll[owner] = (nextSeasonPayroll[owner] ?? 0) + getSalaryInSeason(terms, 1) + (Number(terms.yearsRemaining ?? 0) > 1 ? projectedContractExtras(terms) : 0);
});
for (const event of retentionEvents) {
if (event.club === currentClub.name) continue;
const player = currentPlayers.find((candidate) => String(candidate.id) === String(event.player.id));
if (!player || getCareerClub(player, playerContracts) !== event.club) continue;
const record = playerContracts[String(player.id)] ?? {};
const terms = { ...player.contract, ...record };
const currentSalary = getSalaryInSeason(terms, 1) + (Number(terms.yearsRemaining ?? 0) > 1 ? projectedContractExtras(terms) : 0);
const clubAdministration = event.club === currentClub.name ? previous.clubAdministration : previous.leagueAdministration?.[event.club];
const room = isSalaryCapEnforced(clubAdministration)
? getConfiguredEffectiveSalaryCap(completedSeason + 1, clubAdministration?.salaryCapBank, clubAdministration) - (nextSeasonPayroll[event.club] ?? 0) + currentSalary
: Number.POSITIVE_INFINITY;
const demand = estimateSalaryDemand(player, event.club, 1, completedSeason + 1);
const salary = Math.floor(Math.min(demand, room) / 5000) * 5000;
if (salary < getMinimumSalary(completedSeason + 1) || salary < demand * 0.9) continue;
const years = Number(player.age ?? 25) >= 32 ? 2 : 3;
const currentSchedule = getYearlySalaries({ ...player.contract, ...record });
const currentYears = Math.max(0, Number(record.yearsRemaining ?? player.contract?.yearsRemaining ?? 0));
const yearlySalaries = [...currentSchedule.slice(0, currentYears), ...Array(years).fill(salary)];
const retained = reSignPlayer(player, {
salary: yearlySalaries[0] ?? salary,
years: yearlySalaries.length,
yearlySalaries,
role: record.role ?? "BEST_22",
signedSeason: completedSeason,
}, currentPlayers, playerContracts);
if (!checkClubCommitments(currentPlayers, retained.contracts, event.club, completedSeason, 3, clubAdministration).ok) continue;
playerContracts = retained.contracts;
nextSeasonPayroll[event.club] = (nextSeasonPayroll[event.club] ?? 0) - currentSalary + salary;
}
const clubRoster = currentPlayers.filter((player) => getCareerClub(player, playerContracts) === currentClub.name);
const currentAdministration = settledAdministration;
const settledFinance = calculateClubFinances({
club: currentClub,
roster: clubRoster,
playerContracts,
administrationState: currentAdministration,
seasonState: { ...previous, round: 24 },
});
const boardReview = calculateBoardReview({
finance: settledFinance,
seasonState: previous,
club: currentClub,
administrationState: currentAdministration,
roster: clubRoster,
});
const jobMarket = previous.seasonHasStarted
? reviewCoachingJobs({
market: previous.jobMarket,
clubs,
players: currentPlayers,
contracts: playerContracts,
ladder: previous.ladder ?? [],
reviews: Object.fromEntries(clubs.map(item => {
if (item.name === currentClub.name) return [item.name, boardReview];
const roster = currentPlayers.filter(player => getCareerClub(player, playerContracts) === item.name);
const administration = previous.leagueAdministration?.[item.name]
?? createClubAdministrationState(item, roster, completedSeason, playerContracts);
const finance = calculateClubFinances({ club: item, roster, playerContracts, administrationState: administration, seasonState: previous });
return [item.name, calculateBoardReview({ finance, seasonState: previous, club: item, administrationState: administration, roster })];
})),
managerClubName: currentClub.name,
seasonYear: completedSeason,
date: dayKey(reviewDate),
})
: getJobMarket(previous.jobMarket, clubs, currentClub.name, completedSeason);
const facilityBonusesByClub = Object.fromEntries(clubs.map((item) => [
item.name,
item.id === currentClub.id ? getFacilityBonuses(currentAdministration.facilities, currentAdministration.staff) : getFacilityBonuses(),
]));
const recentSuccess = getTeamFormRate(currentClub.name, previous.roundHistory ?? []);
const seasonMatches = [
...(previous.roundHistory ?? []).flatMap((entry: any) => entry.results ?? []),
...(previous.wildcardResults ?? []),
...(previous.finalsHistory ?? []).flatMap((week: any) => week.results ?? []),
];
const playerPerformance = new Map();
const playerSeasonUsage = new Map();
for (const match of seasonMatches) {
for (const stat of [...(match.playerStats?.home ?? []), ...(match.playerStats?.away ?? [])]) {
if (!stat.playerId) continue;
const playerId = String(stat.playerId);
const usage = playerSeasonUsage.get(playerId) ?? { minutes: 0, games: 0 };
if (Number(stat.timeOnGround ?? 0) > 0) {
usage.minutes += Number(stat.timeOnGround) / 100 * 80;
usage.games += 1;
}
playerSeasonUsage.set(playerId, usage);
if (Number(stat.timeOnGround ?? 0) <= 0) continue;
const positionList = stat.positions ?? [];
const keyDefender = positionList.includes("KPD");
const impact = Number(stat.disposals ?? 0) * 0.55
+ Number(stat.goals ?? 0) * 5
+ Number(stat.clearances ?? 0) * 2.3
+ Number(stat.tackles ?? 0) * 1.25
+ Number(stat.marks ?? 0) * 0.8
+ Number(stat.inside50s ?? 0) * 0.8
+ Number(stat.intercepts ?? 0) * (keyDefender ? 3.6 : 1.2)
+ Number(stat.rebound50s ?? 0) * (keyDefender ? 2.4 : 0.8)
+ Number(stat.hitouts ?? 0) * (positionList.some((position: string) => ["RUC", "RUCK"].includes(position)) ? 0.5 : 0.03);
const current = playerPerformance.get(String(stat.playerId)) ?? { total: 0, games: 0 };
current.total += impact;
current.games += 1;
playerPerformance.set(String(stat.playerId), current);
}
}
for (const [key, reserveUsage] of Object.entries(previous.calendarUsage ?? {}) as [string, any][]) {
const [usageYear, playerId] = key.split(":");
if (Number(usageYear) !== completedSeason || !Number(reserveUsage?.reserveMinutes)) continue;
const usage = playerSeasonUsage.get(playerId) ?? { minutes: 0, games: 0 };
usage.minutes += Number(reserveUsage.reserveMinutes) * 0.55;
usage.games += Number(reserveUsage.reservesGames ?? 0);
playerSeasonUsage.set(playerId, usage);
}
const playerPerformanceById = Object.fromEntries([...playerPerformance].map(([playerId, record]) => [
playerId,
Math.max(0, Math.min(100, Math.round((record.total / Math.max(1, record.games) - 10) * 3))),
]));
const playerDevelopment = applySeasonDevelopment(currentPlayers, previous.playerDevelopment ?? {}, {
seasonYear: completedSeason,
trainingPlanByClub: { [currentClub.name]: trainingPlan },
teamFormByClub: { [currentClub.name]: recentSuccess },
clubMorale: previous.clubMorale ?? {},
facilityBonusesByClub,
playerPerformanceById,
playerMinutesPlayedById: Object.fromEntries([...playerSeasonUsage].map(([playerId, usage]) => [playerId, usage.minutes])),
playerGamesPlayedById: Object.fromEntries([...playerSeasonUsage].map(([playerId, usage]) => [playerId, usage.games])),
trainingContributionByPlayer: Object.fromEntries(currentPlayers.map((player) => [
player.id,
Number(fitnessSnapshot?.[player.id]?.developmentContribution ?? 0),
])),
attributeTrainingProgressByPlayer: Object.fromEntries(currentPlayers.map((player) => [
player.id,
fitnessSnapshot?.[player.id]?.attributeTrainingProgress ?? {},
])),
});
const rolloverFreeAgentSignings: any[] = [];
const contractRollover = { contracts: playerContracts, report: previous.contractReport ?? {} };
// Tasmania has no season to review before it joins the competition: start its books fresh for the
// next year rather than settling a season in which it earned and spent nothing.
const clubAdministration = previous.expansionCareer?.stage === "SIMULATING"
? createClubAdministrationState(currentClub, [], completedSeason + 1, playerContracts)
: advanceClubAdministrationSeason(
currentAdministration,
currentClub,
clubRoster,
completedSeason + 1,
settledFinance.cashBalance,
recentSuccess,
previous.ladder ?? [],
boardReview,
{ premier: previous.premier ?? null, finalsHistory: previous.finalsHistory ?? [], wildcardResults: previous.wildcardResults ?? [] },
);
const firstCareerDraft = !(previous.draftHistory ?? []).length;
const draftYear = firstCareerDraft ? 2026 : completedSeason;
draftPickAssets = resolveDraftPickNumbers(
createFutureDraftPicks(completedSeason, clubs, draftPickAssets),
completedSeason,
previous.ladder ?? [],
clubs,
currentPlayers,
);
const draftState = createDraftState({
draftYear,
ladder: previous.ladder ?? [],
clubs,
initial: firstCareerDraft,
existingNames: currentPlayers.map((player) => player.name),
draftPickAssets,
playerPool: currentPlayers,
academyClass: Object.values(previous.academies ?? {}).flatMap((academy: any) => academyDraftClass(academy, draftYear)),
});
const rolloverDealCount = completedAITrades.length + rolloverFreeAgentSignings.length;
const rolloverTradeTransactions = [
...completedAITrades.map((event, index) => ({
week: index < Math.ceil(rolloverDealCount / 2) ? 1 : 2,
buyer: event.buyer,
seller: event.seller,
target: event.target,
players: event.transferredPlayers ?? [],
picks: event.transferredPicks ?? [],
})),
...rolloverFreeAgentSignings.map((signing: any, index: number) => ({
week: completedAITrades.length + index < Math.ceil(rolloverDealCount / 2) ? 1 : 2,
signing,
})),
].map((deal: any, index: number) => {
const week = deal.week;
const day = (week === 1 ? 5 : 12) + (index % 7);
const date = new Date(completedSeason, 9, day);
return createTradePeriodTransaction({
tradePeriodYear: completedSeason,
week,
date,
kind: deal.signing ? "FREE_AGENT" : "TRADE",
playerMoves: deal.signing
? [{ ...deal.signing, fromClub: null }]
: [
{ playerName: deal.target?.name, fromClub: deal.seller, toClub: deal.buyer },
...(deal.players ?? []).map((player: any) => ({ playerName: player.name, fromClub: deal.buyer, toClub: deal.seller })),
],
pickMoves: deal.signing ? [] : (deal.picks ?? []).map((pick: any) => ({
pickName: formatDraftPick(pick),
fromClub: deal.buyer,
toClub: deal.seller,
})),
});
});
const retirementMail = retirementRecords.length ? [{
id: `retirement-roundup-${completedSeason}`,
type: "RETIREMENT_NEWS",
subject: `Retiring class of ${completedSeason}`,
date: `Season ${completedSeason}`,
summary: `${retirementRecords.length} player${retirementRecords.length === 1 ? " has" : "s have"} retired across the league.`,
retirements: retirementRecords.map(({ playerName, club }) => ({ playerName, club })),
}] : [];
return {
...previous,
playerDevelopment,
playerContracts,
contractReport: contractRollover.report,
clubAdministration,
leagueAdministration: Object.fromEntries(Object.entries(previous.leagueAdministration ?? {}).map(([clubName, clubState]) => [
clubName,
clubName === currentClub.name ? clubAdministration : advanceAIStaffContracts(clubState, completedSeason + 1),
])),
jobMarket,
draftState,
draftPickAssets,
aiTradeHistory: [...(previous.aiTradeHistory ?? []), ...completedAITrades],
tradePeriodTransactions: [...(previous.tradePeriodTransactions ?? []), ...rolloverTradeTransactions],
retirementHistory: [...(previous.retirementHistory ?? []), ...retirementRecords],
mailMessages: [...(previous.mailMessages ?? []), ...retirementMail],
rolloverCompletedForYear: completedSeason,
};
}

function runSeasonRollover() {
if (Number(seasonState.rolloverCompletedForYear) !== Number(seasonState.seasonYear ?? 2027)) {
setPlayerFitness((fitness) => Object.fromEntries(Object.entries(fitness).map(([id, state]) => [id, { ...state, developmentContribution: 0 }])));
}
setSeasonState((previous) => calculateSeasonRollover(previous, playerFitness, calendarDate));
}

const menuButtonStyle =
(screen: string): CSSProperties => ({
width: "100%",
position: "relative",

display: "flex",
alignItems: "center",
gap: "12px",

padding: "12px",

border: "none",
borderRadius: "14px",

cursor: "pointer",

textAlign: "left",

fontSize: "0.9rem",

transition:
"all 0.2s ease",

background:
activeScreen === screen
? finalsSeriesTheme ? finalsGold : "#ea580c"
: "transparent",

boxShadow:
activeScreen === screen
? finalsSeriesTheme ? "0 4px 16px rgba(214,180,74,0.38)" : "0 4px 12px rgba(234,88,12,0.35)"
: "none",

color:
activeScreen === screen
? finalsSeriesTheme ? "#211a08" : "#ffffff"
: lightMode ? "#334155" : "#cbd5e1"
});

function NavButton({
icon,
label,
screen,
badgeCount = 0,
}: {
icon: ReactNode;
label: string;
screen: string;
badgeCount?: number;
}) {
return (
<button
style={menuButtonStyle(
screen
)}
aria-label={screen === "INBOX" && badgeCount > 0 ? `${label}, ${badgeCount} unread mail` : label}
onClick={() => navigateTo(screen)}
>
<div
style={{
width: "20px",
height: "20px",

display: "flex",
alignItems: "center",
justifyContent:
"center",

color:
activeScreen ===
screen
? "#ffffff"
: "#94a3b8"
}}
>
{icon}
</div>

{screen === "INBOX" && badgeCount > 0 && (
<span
aria-hidden="true"
style={{
position: collapsed ? "absolute" : "static",
top: collapsed ? 2 : undefined,
left: collapsed ? 30 : undefined,
minWidth: collapsed ? 15 : 18,
height: collapsed ? 15 : 18,
boxSizing: "border-box",
padding: "0 5px",
display: "inline-flex",
alignItems: "center",
justifyContent: "center",
borderRadius: 999,
background: "#dc2626",
color: "#ffffff",
fontSize: collapsed ? 9 : 10,
lineHeight: 1,
fontWeight: 800,
boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
}}
>
{badgeCount > 9 ? "9+" : badgeCount}
</span>
)}

{!collapsed && (
<span>{label}</span>
)}
</button>
);
}

if (setupStage === "GAME_MODE") {
return (
<Suspense fallback={<AppLoading />}><GameModeSelectionScreen
onSelectMode={handleModeSelect}
onResume={() => resumeSavedCareer()}
onResumeSave={resumeSavedCareer}
savedGames={savedGames.map((game) => ({
id: game.id,
mode: game.mode,
seasonYear: game.seasonState.seasonYear,
round: game.seasonState.round,
totalRounds: game.seasonState.fixture.length,
phase: game.seasonState.phase,
savedAt: game.savedAt,
seasonState: game.seasonState,
clubName: clubs.find((club) => club.id === game.clubId)?.name ?? "Unknown club",
}))}
savedGame={savedGames[0] ? {
id: savedGames[0].id,
mode: savedGames[0].mode,
clubName: clubs.find((club) => club.id === savedGames[0].clubId)?.name ?? "Unknown club",
seasonYear: savedGames[0].seasonState.seasonYear,
round: savedGames[0].seasonState.round,
totalRounds: savedGames[0].seasonState.fixture.length,
phase: savedGames[0].seasonState.phase,
savedAt: savedGames[0].savedAt,
} : null}
onDeleteSavedGame={deleteSavedGame}
cloudAvailable={cloudSavesAvailable()}
cloudUser={cloudUser}
cloudBusy={cloudBusy}
cloudMessage={cloudMessage}
passwordRecovery={passwordRecovery}
localCareersAvailable={localCareersAvailable}
onCloudAuth={handleCloudAuth}
onImportLocalCareers={importLocalCareersToAccount}
onRefreshCloudCareers={refreshCloudCareers}
appearance={appearanceMode}
textSize={textSize}
/></Suspense>
);
}

if (setupStage === "CLUB_SELECTION") {
return (
<Suspense fallback={<AppLoading />}><ClubSelectionScreen
onSelect={handleClubSelect}
onBack={() => setSetupStage("GAME_MODE")}
appearance={appearanceMode}
textSize={textSize}
players={allPlayers}
gameMode={gameMode}
/></Suspense>
);
}

if (setupStage === "CLUB_RESET_DRAFT" && clubResetDraft) {
return <Suspense fallback={<AppLoading />}><ClubResetDraftScreen
draft={clubResetDraft}
onDraftPlayer={handleClubResetDraftPick}
onAutofill={handleClubResetAutofill}
autofillBusy={clubResetAutofillBusy}
error={clubResetDraftError}
onExit={() => { if (clubResetAutofillBusy) return; setClubResetDraft(null); setSetupStage("CLUB_SELECTION"); }}
/></Suspense>;
}

if (seasonState.jobMarket?.userStatus === "UNEMPLOYED") {
return <main style={{ minHeight: "100vh", padding: "clamp(20px, 4vw, 48px)", color: "#f8fafc", background: "#020617", fontFamily: "Arial, sans-serif" }}>
<div style={{ maxWidth: 1100, margin: "0 auto" }}>
<header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 26 }}>
<div><small style={{ color: "#fb923c", letterSpacing: 2, fontWeight: 800 }}>MANAGER CAREER · SEASON {seasonState.seasonYear}</small><h1 style={{ margin: "8px 0" }}>Find your next club</h1></div>
<div style={{ display: "flex", gap: 8 }}>
<button type="button" onClick={saveCurrentGame} style={{ padding: "9px 13px", border: "1px solid #475569", borderRadius: 8, background: "#1e293b", color: "white", cursor: "pointer" }}>Save</button>
<button type="button" onClick={saveAndExitGameMode} style={{ padding: "9px 13px", border: "1px solid #475569", borderRadius: 8, background: "#1e293b", color: "white", cursor: "pointer" }}>Save and exit</button>
</div>
</header>
{saveStatus && <p role="status">{saveStatus}</p>}
<Suspense fallback={<AppLoading />}><JobMarketTab market={seasonState.jobMarket} currentClubName={managerClub?.name} onApply={handleApplyForJob} standalone /></Suspense>
</div>
</main>;
}

const handleAcademyAction = (action: any) => {
const academyClub = managerClub ?? clubs[0];
const existingAcademy = seasonState.academies?.[academyClub.name] ?? null;
const year = Number(seasonState.seasonYear ?? 2027);
if (action?.type === "INIT") {
if (existingAcademy) return null;
const academy = createAcademy({ clubName: academyClub.name, seed: `academy:${academyClub.name}:${year}`, firstDraftYear: year + 1, seasonYear: year, administration: seasonState.clubAdministration });
setSeasonState((previous) => ({ ...previous, academies: { ...(previous.academies ?? {}), [academyClub.name]: academy } }));
return null;
}
const cash = Number(seasonState.clubAdministration?.cashBalance ?? 0);
const result = applyAcademyAction(existingAcademy, action, { cash, year });
if (result.error) return result.error;
setSeasonState((previous) => {
const currentAcademy = previous.academies?.[academyClub.name] ?? existingAcademy;
const currentCash = Number(previous.clubAdministration?.cashBalance ?? 0);
const updated = applyAcademyAction(currentAcademy, action, { cash: currentCash, year: Number(previous.seasonYear ?? year) });
if (updated.error) return previous;
return { ...previous, academies: { ...(previous.academies ?? {}), [academyClub.name]: updated.academy }, clubAdministration: previous.clubAdministration ? { ...previous.clubAdministration, cashBalance: currentCash - Number(updated.cost ?? 0) } : previous.clubAdministration };
});
return null;
};

return (
<div
data-appearance={appearanceMode}
data-finals-series={finalsSeriesTheme ? "true" : "false"}
style={{
background: finalsSeriesTheme ? (lightMode ? "#f5f0df" : "#100e08") : lightMode ? "#f1f5f9" : "#020617",
minHeight: "100vh",
color: lightMode ? "#0f172a" : "white",
fontFamily:
"Arial, sans-serif"
}}
>
<div
style={{
display: "flex",
minHeight: "100vh",
background: finalsSeriesTheme ? (lightMode ? "#f5f0df" : "#100e08") : lightMode ? "#f1f5f9" : "#020617"
}}
>
<aside
style={{
display: "flex",
flexDirection: "column",
minHeight: "100vh",
boxSizing: "border-box",
width:
collapsed
? "70px"
: "180px",

background:
finalsSeriesTheme ? (lightMode ? "#eee5c7" : "#171307") : lightMode ? "#f8fafc" : "#020617",

borderRight:
`1px solid ${finalsSeriesTheme ? "#9b7b2b" : lightMode ? "#cbd5e1" : "#1e293b"}`,

padding: "16px",

transition:
"width 0.3s ease"
}}
>
<div
style={{
display: "flex",
flexDirection: collapsed ? "column" : "row",
justifyContent: collapsed ? "center" : "space-between",
alignItems: "center",
gap: 8,
marginBottom:
"16px"
}}
>
<button
type="button"
aria-label="Search screens and tabs"
title={collapsed ? "Search screens and tabs" : undefined}
onClick={() => {
if (collapsed) setCollapsed(false);
setNavigationSearchOpen((open) => !open);
setNavigationSearch("");
}}
style={{
display: "flex",
alignItems: "center",
justifyContent: "center",
order: collapsed ? 2 : 0,
width: collapsed ? 36 : undefined,
height: collapsed ? 36 : undefined,
boxSizing: "border-box",
flexShrink: 0,
background: finalsSeriesTheme ? (lightMode ? "#e0d4ad" : "#29220f") : lightMode ? "#e2e8f0" : "#0f172a",
border: "none",
color: finalsSeriesTheme ? (lightMode ? "#5b4610" : finalsGold) : lightMode ? "#0f172a" : "white",
cursor: "pointer",
borderRadius: "8px",
padding: collapsed ? 0 : "8px 12px",
}}
>
<SearchIcon />
</button>
<button
type="button"
aria-label={collapsed ? "Expand navigation pane" : "Collapse navigation pane"}
title={collapsed ? "Expand navigation pane" : undefined}
onClick={() =>
setCollapsed(
!collapsed
)
}
style={{
background:
lightMode ? "#e2e8f0" : "#0f172a",

border: "none",

color:
lightMode ? "#0f172a" : "white",

cursor:
"pointer",

borderRadius:
"8px",

padding: collapsed ? 0 : "8px 12px",
order: collapsed ? 1 : 0,
width: collapsed ? 36 : undefined,
height: collapsed ? 36 : undefined,
boxSizing: "border-box",
flexShrink: 0,
}}
>
☰
</button>
</div>

{navigationSearchOpen && !collapsed && (
<div style={{ position: "relative", marginBottom: 16 }}>
<input
autoFocus
type="search"
aria-label="Find a player, club, screen or tab"
placeholder="Search players, clubs, screens and tabs…"
value={navigationSearch}
onChange={(event) => setNavigationSearch(event.target.value)}
onKeyDown={(event) => {
if (event.key === "Escape") {
setNavigationSearchOpen(false);
setNavigationSearch("");
}
if (event.key === "Enter" && navigationSearchResults[0]) openSearchResult(navigationSearchResults[0]);
}}
style={{
width: "100%",
boxSizing: "border-box",
padding: "10px 12px",
border: `1px solid ${lightMode ? "#cbd5e1" : "#334155"}`,
borderRadius: 10,
outline: "none",
color: lightMode ? "#0f172a" : "#f8fafc",
background: lightMode ? "#ffffff" : "#0f172a",
fontSize: 13,
}}
/>
{navigationSearch.trim() && (
<div role="listbox" aria-label="Navigation search results" style={{ position: "absolute", zIndex: 50, top: "calc(100% + 5px)", left: 0, right: 0, padding: 5, border: `1px solid ${lightMode ? "#cbd5e1" : "#334155"}`, borderRadius: 10, background: lightMode ? "#ffffff" : "#0f172a", boxShadow: "0 12px 28px rgba(0,0,0,.32)" }}>
{navigationSearchResults.length ? navigationSearchResults.map((destination) => (
<button
key={destination.key}
type="button"
role="option"
aria-selected="false"
onClick={() => openSearchResult(destination)}
style={{ width: "100%", padding: "9px 10px", border: 0, borderRadius: 7, color: lightMode ? "#0f172a" : "#e2e8f0", background: "transparent", textAlign: "left", cursor: "pointer", fontSize: 13 }}
>
<span>{destination.label}</span>{destination.sub && <span style={{ display: "block", marginTop: 2, color: lightMode ? "#64748b" : "#94a3b8", fontSize: 11 }}>{destination.sub}</span>}
</button>
)) : <div style={{ padding: "9px 10px", color: lightMode ? "#64748b" : "#94a3b8", fontSize: 12 }}>No matching players, clubs, screens or tabs</div>}
</div>
)}
</div>
)}

{!collapsed && (
<div
style={{
background:
lightMode ? "#ffffff" : "#0f172a",

padding:
"12px",

borderRadius:
"16px",

marginBottom:
"20px",

border:
`1px solid ${lightMode ? "#cbd5e1" : "#1e293b"}`,
color: lightMode ? "#0f172a" : "#f8fafc"
}}
>
<div
style={{
fontWeight:
"bold",

fontSize:
"1rem"
}}
>
{managerClub.name}
</div>

<div
style={{
color:
lightMode ? "#64748b" : "#94a3b8",

fontSize:
"0.8rem",

marginTop:
"4px"
}}
>
{managerClub.abbreviation} · AFL Manager 27
</div>

<div
style={{
marginTop:
"12px",

paddingTop:
"12px",

borderTop:
`1px solid ${lightMode ? "#cbd5e1" : "#1e293b"}`
}}
>
<div
style={{
fontSize:
"0.75rem",

color:
lightMode ? "#64748b" : "#94a3b8"
}}
>
Season {seasonState.seasonYear}
</div>

<div
style={{
marginTop:
"4px",

fontWeight:
"bold",

fontSize:
"0.85rem"
}}
>
{seasonState.phase === "HOME_AND_AWAY"
? `Round ${Math.min(seasonState.round, seasonState.fixture.length)} of ${seasonState.fixture.length}`
: seasonState.phase === "POST_SEASON" ? "Post-season" : seasonState.phase === "WILDCARD" ? "Wildcard round" : seasonState.phase === "FINALS" ? "Finals" : seasonState.phase === "OFFSEASON" ? "Offseason" : seasonState.phase === "PRESEASON" ? "Preseason" : seasonState.phase}
</div>
</div>
</div>
)}

<div
style={{
display: "flex",
flexDirection:
"column",

gap: "6px"
}}
>
<NavButton
icon={<HomeIcon />}
label="Dashboard"
screen="DASHBOARD"
/>

<NavButton
icon={<SeasonIcon />}
label="Calendar"
screen="CALENDAR"
/>

<NavButton
icon={<SquadIcon />}
label="Squad"
screen="SQUAD"
/>

<NavButton
icon={<TacticsIcon />}
label="Tactics"
screen="TACTICS"
/>

<NavButton
icon={<TrainingIcon />}
label="Training"
screen="TRAINING"
/>

<NavButton
icon={<MedicalIcon />}
label="Medical Room"
screen="INJURY_LIST"
/>

<NavButton
icon={
<RecruitmentIcon />
}
label="Recruitment"
screen="RECRUITMENT"
/>

<div
style={{
height: "1px",
background: lightMode ? "#cbd5e1" : "#1e293b",

margin:
"10px 0"
}}
/>

<NavButton
icon={<InboxIcon />}
label="Inbox"
screen="INBOX"
badgeCount={inboxUnreadCount}
/>

<NavButton
icon={<StatisticsIcon />}
label="Statistics"
screen="STATISTICS"
/>

<NavButton
icon={<StadiumIcon />}
label="Season Hub"
screen="SEASON"
/>

<NavButton
icon={<FinanceIcon />}
label="Administration"
screen="FINANCES"
/>

{import.meta.env.DEV && <NavButton
icon={<span aria-hidden="true">🛠</span>}
label="Developer"
screen="DEVELOPER_ATTRIBUTES"
/>}

{gameMode === "FANTASY" && <NavButton
icon={<span aria-hidden="true">✨</span>}
label="Fantasy Tools"
screen="FANTASY_TOOLS"
/>}
</div>

<div
style={{
height: "1px",
background: lightMode ? "#cbd5e1" : "#1e293b",
margin: "auto 0 10px"
}}
/>
<button
type="button"
aria-label="Settings"
title={collapsed ? "Settings" : undefined}
onClick={() => setActiveScreen("SETTINGS")}
style={{
width: "100%",
display: "flex",
alignItems: "center",
justifyContent: collapsed ? "center" : "flex-start",
gap: 12,
marginBottom: 8,
padding: 12,
border: "1px solid #475569",
borderRadius: 14,
cursor: "pointer",
textAlign: "left",
fontSize: "0.9rem",
background: "#374151",
color: "#f3f4f6"
}}
>
<span aria-hidden="true" style={{ width: 20, textAlign: "center" }}>
⚙
</span>
{!collapsed && <span>Settings</span>}
</button>
<button
type="button"
aria-label="Save game"
title={collapsed ? "Save" : undefined}
onClick={saveCurrentGame}
style={{
width: "100%",
display: "flex",
alignItems: "center",
justifyContent: collapsed ? "center" : "flex-start",
gap: 12,
marginBottom: 8,
padding: 12,
border: "1px solid #047857",
borderRadius: 14,
cursor: "pointer",
textAlign: "left",
fontSize: "0.9rem",
background: "#047857",
color: "#ecfdf5"
}}
>
<span aria-hidden="true" style={{ width: 20, textAlign: "center" }}>
▣
</span>
{!collapsed && <span>Save</span>}
</button>
{saveStatus && (
<div
role="status"
style={{
marginBottom: 8,
color: ["Saved", "Saved locally", "Autosaved"].includes(saveStatus) ? "#6ee7b7" : "#fca5a5",
fontSize: 12,
textAlign: collapsed ? "center" : "left"
}}
>
{collapsed ? (["Saved", "Saved locally", "Autosaved"].includes(saveStatus) ? "✓" : "!") : saveStatus}
</div>
)}
<button
type="button"
aria-label="Exit game mode"
title={collapsed ? "Exit game mode" : undefined}
onClick={requestExitGameMode}
style={{
width: "100%",
display: "flex",
alignItems: "center",
justifyContent: collapsed ? "center" : "flex-start",
gap: 12,
padding: 12,
border: "1px solid #7f1d1d",
borderRadius: 14,
cursor: "pointer",
textAlign: "left",
fontSize: "0.9rem",
background: "#450a0a33",
color: "#fecaca"
}}
>
<span aria-hidden="true" style={{ width: 20, textAlign: "center" }}>
⏏
</span>
{!collapsed && <span>Exit game mode</span>}
</button>
</aside>

<div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: "100vh", background: lightMode ? "#f1f5f9" : "#020617" }}>
<PersistentHeader
club={managerClub}
seasonState={seasonState}
currentDate={calendarDate}
events={calendarEvents}
currentDayEvents={currentDayEvents}
teamSheetConfirmed={isCurrentTeamSheetConfirmed()}
onContinue={handleGameProgress}
onTeamSelectionRequired={() => navigateTo("SQUAD", { tab: "SELECTION" })}
onAdvanceDay={advanceCalendarOneDay}
onOpenClub={openClubProfile}
appearance={appearanceMode}
onContinueCommand={runCalendar}
processing={Boolean(calendarProcessing)}
/>
<CalendarProgressPanel processing={calendarProcessing} error={calendarError} season={seasonState} fitness={playerFitness}
onPause={() => { calendarCancel.current = true; calendarAbort.current?.abort(); }} onCommand={runCalendar} onDecision={changeCalendarDecision} onTribunalAction={handleTribunalDecision}
onOpen={handleCalendarStop}
onNotificationPolicyChange={policy => setSeasonState(previous => ({ ...previous, calendarNotificationPolicy: policy }))} delegation={delegationSettings} appearance={appearanceMode} />
<main
style={{
flex: 1,
padding: "24px",
background: finalsSeriesTheme ? (lightMode ? "#f5f0df" : "#100e08") : lightMode ? "#f1f5f9" : "#020617",
color: lightMode ? "#0f172a" : "#f8fafc",
overflowY: "auto"
}}
>
{seasonState.expansionCareer?.stage === "SIMULATING" ? (
<section role="status" style={{ maxWidth: 620, margin: "40px auto", padding: 24, borderRadius: 16, border: `1px solid ${lightMode ? "#cbd5e1" : "#334155"}`, background: lightMode ? "#fff" : "#0f172a" }}>
<h2 style={{ marginTop: 0 }}>Simulating the 2026 offseason and 2027 season</h2>
<p style={{ color: lightMode ? "#475569" : "#94a3b8" }}>Tasmania has no list yet, so the 18 existing clubs run the 2026 trade period and draft and then play the 2027 season without you. Control passes to you on 1 October 2027, when Tasmania&apos;s concession signing window opens.</p>
{!calendarProcessing && <button type="button" onClick={() => void runTasmaniaFirstSeason()} style={{ padding: "10px 16px", border: 0, borderRadius: 10, background: "#ea580c", color: "#fff", fontWeight: 800, cursor: "pointer" }}>Resume simulation</button>}
</section>
) : (
<div style={{ pointerEvents: calendarProcessing ? "none" : "auto", opacity: calendarProcessing ? 0.65 : 1 }}><ScreenErrorBoundary key={activeScreen} screen={activeScreen}><Suspense fallback={<AppLoading />}>{renderScreen()}</Suspense></ScreenErrorBoundary></div>
)}
</main>
</div>
</div>
{showExitPrompt && (
<div
role="presentation"
onMouseDown={(event) => {
if (event.target === event.currentTarget) setShowExitPrompt(false);
}}
style={{
position: "fixed",
zIndex: 200,
inset: 0,
display: "grid",
placeItems: "center",
padding: 20,
background: "rgba(2, 6, 23, 0.72)",
backdropFilter: "blur(5px)",
}}
>
<section
role="dialog"
aria-modal="true"
aria-labelledby="unsaved-exit-title"
style={{
width: "min(100%, 440px)",
boxSizing: "border-box",
padding: 24,
border: `1px solid ${lightMode ? "#cbd5e1" : "#334155"}`,
borderRadius: 18,
color: lightMode ? "#0f172a" : "#f8fafc",
background: lightMode ? "#ffffff" : "#0f172a",
boxShadow: "0 24px 80px rgba(0,0,0,0.35)",
}}
>
<h2 id="unsaved-exit-title" style={{ margin: "0 0 8px" }}>Save before exiting?</h2>
<p style={{ margin: "0 0 20px", color: lightMode ? "#475569" : "#cbd5e1", lineHeight: 1.5 }}>
This career has changes that aren’t in a saved game yet.
</p>
{saveStatus && !["Saved locally", "Autosaved"].includes(saveStatus) && (
<p role="alert" style={{ margin: "-8px 0 14px", color: "#f87171", fontSize: 13 }}>{saveStatus}</p>
)}
<div style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: 8 }}>
<button
type="button"
onClick={() => setShowExitPrompt(false)}
style={{ padding: "10px 13px", border: `1px solid ${lightMode ? "#cbd5e1" : "#475569"}`, borderRadius: 9, color: lightMode ? "#334155" : "#e2e8f0", background: "transparent", fontWeight: 700, cursor: "pointer" }}
>
Stay in game
</button>
<button
type="button"
onClick={exitGameMode}
style={{ padding: "10px 13px", border: "1px solid #991b1b", borderRadius: 9, color: "#fecaca", background: "#450a0a", fontWeight: 700, cursor: "pointer" }}
>
Exit without saving
</button>
<button
type="button"
onClick={saveAndExitGameMode}
style={{ padding: "10px 13px", border: 0, borderRadius: 9, color: "#ecfdf5", background: "#047857", fontWeight: 800, cursor: "pointer" }}
>
Save and exit
</button>
</div>
</section>
</div>
)}
</div>
);
}
