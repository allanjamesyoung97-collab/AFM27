import { tasmaniaDevils, clubs as existingClubs } from "../data/clubs.js";
import { DRAFT_FIRST_NAMES, DRAFT_LAST_NAMES } from "../data/draftNamePool.js";
import { createPlayer } from "./playerFactory.js";

export const TASMANIA_EXPANSION_RULES = {
 entrySeason: 2028,
 flexibleListSizes: { 2028: [36, 46], 2029: [36, 48], 2030: [36, 48], 2031: [36, 48], 2032: [36, 46] },
 primaryList: [36, 40],
 preselectedUnder18Maximum: 12,
 preselectedUnder18PerYearMaximum: 8,
 uncontractedPlayerMaximum: 18,
 uncontractedPlayerMaximumPerExistingClub: 1,
 signOnBonusPool: 5_000_000,
 signOnBonusAnnualRange: [2_000_000, 3_000_000],
 signOnBonusSeasons: [2028, 2029],
 concessionPicks: {
 2027: { rounds: [1, 2, 3, 4, 5], firstRound: [1, 3, 5, 7, 9, 11, 13], extraRounds: [2, 3, 4, 5], mustTradeFirstRound: [5, 7, 11, 13] },
 2028: { firstRound: [5, 9], extraRounds: [2, 3, 4, 5], mustTradeFirstRound: [5] },
 2029: { firstRound: [5, 9], mustTradeFirstRound: [5] },
 },
 miniDrafts: { 2027: 2, 2028: 2 },
};

const POSITIONS = ["MID", "MID", "HB", "KPD", "HF", "KPF", "RUC", "WING", "BP", "FF"];
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

function uniqueName(index, used) {
 for (let attempt = 0; attempt < DRAFT_FIRST_NAMES.length * DRAFT_LAST_NAMES.length; attempt += 1) {
 const pair = index + attempt;
 const name = `${DRAFT_FIRST_NAMES[pair % DRAFT_FIRST_NAMES.length]} ${DRAFT_LAST_NAMES[Math.floor(pair / DRAFT_FIRST_NAMES.length) % DRAFT_LAST_NAMES.length]}`;
 if (!used.has(name)) { used.add(name); return name; }
 }
 const name = `Tasmania Prospect ${index + 1}`;
 used.add(name);
 return name;
}

function createExpansionPlayer({ index, group, used }) {
 const seed = (Math.imul(index + 1, 2654435761) >>> 0);
 const position = POSITIONS[index % POSITIONS.length];
 const positions = position === "MID" && index % 3 === 0 ? ["MID", "WING"] : [position];
 const young = group === "TASMANIAN_PRESELECTION";
 const age = young ? 18 : 20 + (index % 9);
 const overall = young ? 53 + (index % 10) : 59 + (index % 12);
 const potential = young ? 75 + (index % 17) : 65 + (index % 17);
 return createPlayer({
 id: `tas-expansion-${group.toLowerCase()}-${index + 1}`,
 name: uniqueName(seed, used),
 club: tasmaniaDevils.name,
 age,
 positions,
 overall,
 tier: overall >= 66 ? "Rotation" : "Depth",
 potential,
 salary: young ? 130_000 : 200_000 + (index % 7) * 25_000,
 yearsRemaining: young ? 2 : 2 + (index % 3),
 });
}

/** Build the local pre-selections and top-up recruits that join the inaugural 2028 list. */
export function createTasmaniaEntryPlayers(existingPlayers = [], existingContracts = {}, year = 2028, { userManaged = false, concessionSignings = 0 } = {}) {
 const used = new Set(existingPlayers.map((player) => player.name));
 const preselected = Array.from({ length: 12 }, (_, index) => createExpansionPlayer({ index, group: "TASMANIAN_PRESELECTION", used }));
 const availableByClub = existingClubs.map((club) => {
 const candidate = existingPlayers
 .filter((player) => (existingContracts[String(player.id)]?.club ?? player.club) === club.name && Number(player.age ?? 0) >= 18)
 .filter((player) => Number(existingContracts[String(player.id)]?.yearsRemaining ?? player.contract?.yearsRemaining ?? 0) <= 0)
 .sort((a, b) => Number(b.overall ?? 0) - Number(a.overall ?? 0))[0];
 return candidate ? { club: club.name, player: candidate } : null;
 }).filter(Boolean);
 // A managed Tasmania chooses its own uncontracted signings during the concession window,
 // so only the remaining places are topped up with generated recruits.
 const signings = userManaged ? [] : availableByClub.slice(0, TASMANIA_EXPANSION_RULES.uncontractedPlayerMaximum);
 const topUps = Array.from({ length: Math.max(0, 18 - (userManaged ? Number(concessionSignings) : signings.length)) }, (_, index) => createExpansionPlayer({
 index: index + 20,
 group: "EXPANSION_SIGNING",
 used,
 }));
 const newPlayers = [...preselected, ...topUps];
 const contracts = Object.fromEntries(newPlayers.map((player) => [String(player.id), {
 club: tasmaniaDevils.name,
 yearsRemaining: Number(player.contract?.yearsRemaining ?? 2),
 salary: Number(player.contract?.salary ?? 200_000),
 signedSeason: year,
 expansionSigning: true,
 }]));
 return {
 newPlayers,
 playerMoves: signings.map(({ club, player }) => ({ playerId: String(player.id), playerName: player.name, fromClub: club, toClub: tasmaniaDevils.name })),
 contracts,
 expansionState: {
 activated: true,
 activatedSeason: year,
 listRules: TASMANIA_EXPANSION_RULES,
 signingBonusPool: TASMANIA_EXPANSION_RULES.signOnBonusPool,
 signingBonusSpent: 0,
 uncontractedSignings: signings.map(({ player }) => String(player.id)),
 uncontractedSigningClubs: signings.map(({ club }) => club),
 preselectedUnder18Ids: preselected.map((player) => String(player.id)),
 tradeableMiniDrafts: { 2027: 2, 2028: 2 },
 },
 };
}

export function emptyTasmaniaLadderRow() {
 return {
 club: tasmaniaDevils.name, wins: 0, losses: 0, draws: 0, points: 0,
 pointsFor: 0, pointsAgainst: 0, percentage: 100, form: [],
 previousPosition: null, movement: "-",
 };
}

// ---------------------------------------------------------------------------
// Tasmania career (managing the expansion club from its first season)
// ---------------------------------------------------------------------------

/**
 * Options for getFreeAgencyStatus / getFreeAgents on the Tasmania manager's screens. Returns null
 * unless the manager is Tasmania and the career has not yet entered the competition.
 */
export function tasmaniaConcessionOptions(season, userClubName, leagueClubNames = []) {
 const career = season?.expansionCareer;
 if (!career || userClubName !== tasmaniaDevils.name || career.stage === "ENTERED") return null;
 const signed = career.concessionSignings ?? [];
 return {
 clubName: tasmaniaDevils.name,
 clubNames: leagueClubNames,
 usedClubs: signed.map((signing) => signing.fromClub),
 remaining: Math.max(0, TASMANIA_EXPANSION_RULES.uncontractedPlayerMaximum - signed.length),
 };
}

/** Compensation picks for a club that loses an out-of-contract player to Tasmania. */
export function createTasmaniaCompensationPicks({ player, fromClub, signingYear = 2027 }) {
 const count = Number(player?.age ?? 30) <= 27 && Number(player?.overall ?? 60) >= 80 ? 2 : 1;
 return Array.from({ length: count }, (_, index) => ({
 id: `TAS-COMP-${signingYear}-${fromClub}-${player.id}-${index + 1}`,
 year: Number(signingYear) + 1, round: 1, originalClub: fromClub, currentOwner: fromClub,
 number: null, resolved: false, compensation: true, afterClub: fromClub,
 afterRound: 1, compensationReason: `Tasmania expansion signing: ${player.name}`,
 }));
}

/** Season-state changes for one completed concession signing (the contract itself is saved by signFreeAgent). */
export function recordTasmaniaConcessionSigning(season, { player, fromClub, date }) {
 const career = season.expansionCareer ?? { clubName: tasmaniaDevils.name, stage: "CONCESSION", concessionSignings: [] };
 const signingYear = Number(String(date).slice(0, 4)) || 2027;
 return {
 expansionCareer: {
 ...career,
 concessionSignings: [...(career.concessionSignings ?? []), {
 playerId: String(player.id), playerName: player.name, fromClub, date: String(date).slice(0, 10),
 }],
 },
 draftPickAssets: [...(season.draftPickAssets ?? []), ...createTasmaniaCompensationPicks({ player, fromClub, signingYear })],
 };
}
