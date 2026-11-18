import { checkClubCommitments, validTradePackage } from "./transactionRules.js";
import { getMinimumSalary } from "./salaryCap.js";
import { getCareerClub } from "./contractEngine.js";
import { createPlayer } from "./playerFactory.js";
import { calculateAssetPackageValue, calculatePickValue } from "./playerValuationEngine.js";
import { getClubBestTeam } from "./clubStrengthEngine.js";
import { DRAFT_FIRST_NAMES, DRAFT_LAST_NAMES } from "../data/draftNamePool.js";
import {
  assignProspectConnections,
  decideAIMatch,
  draftPickMetaFields,
  getPickMeta,
  isBiddingActive,
  reorderForMatchedBid,
  validateMatchPlan,
} from "./draftBiddingEngine.js";
import { mergeAcademyProspects } from "./academyEngine.js";
import { leagueClubsForYear, draftClubsForYear, tasmaniaDevils } from "../data/clubs.js";

// Zero Hanger's 2026 power rankings seed the first intake. The list is kept in
// source order so draft position follows the published ranking.
export const INITIAL_2026_PROSPECTS = [
  ["Dougie Cochrane", "Central District", "Midfielder", "Forward", 196],
  ["Heath Mellody", "Claremont", "Midfielder", 184],
  ["Ethan Drever", "GWV Rebels", "Midfielder", 188],
  ["Arki Butler", "Sandringham Dragons", "Forward", 180],
  ["Cody Walker", "Bendigo Pioneers", "Midfielder", 184],
  ["Harry Van Hattum", "Northern Knights", "Ruck", 205],
  ["Gus Teixeira", "Sandringham Dragons", "Midfielder", 181],
  ["Ethan Matthews", "GWS Academy", "Midfielder", 185],
  ["Mitch Harris", "Woodville-West Torrens", "Defender", 196],
  ["Leo Steed", "Swan Districts", "Midfielder", 176],
  ["Caylen Murray", "Brisbane Academy", "Defender", 183],
  ["Wil Malady", "Gippsland Power", "Forward", 190],
  ["Sam Gayfer", "Northern Knights", "Forward", 194],
  ["Tyson Bradley", "Sandringham Dragons", "Defender", 196],
  ["Jake Eime", "Central District", "Defender", 182],
  ["George Gale", "Claremont", "Midfielder", 190],
  ["George Dimer", "Sandringham Dragons", "Forward", 173],
  ["Toby Krasna", "Northern Knights", "Midfielder", 181],
  ["Kodah Edwards", "South Adelaide", "Midfielder", 183],
  ["Jack Pickett", "Geelong Falcons", "Forward", 194],
  ["Clancy Snell", "Gippsland Power", "Defender", 196],
  ["Lochie Burrows", "Sandringham Dragons", "Defender", 181],
  ["Khaled El Souki", "Western Jets", "Forward", 175],
  ["Albert MacGowan", "Sandringham Dragons", "Midfielder", 187],
  ["Harry Chapman", "Eastern Ranges", "Midfielder", 189],
  ["Xavier Ladbrook", "Gippsland Power", "Defender", 200],
  ["Noah Williams", "Geelong Falcons", "Midfielder", 177],
  ["Harvey Spawton-Guy", "West Perth", "Forward", 196],
  ["Keenan Boi", "Gippsland Power", "Forward", 182],
  ["Koby LeCras", "West Perth", "Forward", 193],
  ["Gus Kennedy", "Dandenong Stingrays", "Defender", 187],
  ["Marlon Neocleous", "Gippsland Power", "Forward", 168],
  ["Billy Wigmore", "Western Jets", "Defender", 189],
  ["Wil Antrobus", "Dandenong Stingrays", "Defender", 182],
  ["Ethan Herbert", "North Adelaide", "Ruck", 200],
  ["Gabe Patterson", "Glenelg", "Forward", 184],
  ["Jackson Phillips", "Dandenong Stingrays", "Midfielder", 182],
  ["Brady Wright", "Werribee", "Forward", 195],
  ["Cody Templeton", "Gippsland Power", "Midfielder", 180],
  ["Jack Slattery", "Woodville-West Torrens", "Forward", 192],
  ["Marcus Prasad", "Dandenong Stingrays", "Forward", 167],
  ["Jordan Knapp", "Eastern Ranges", "Midfielder", 178],
  ["Archie Elliott", "GWV Rebels", "Forward", 182],
  ["Blake Justice", "Calder Cannons", "Midfielder", 190],
  ["Jake Soutar", "East Perth", "Defender", 190],
  ["Harvie Cooke", "Northern Knights", "Forward", 176],
  ["Memphis Webb", "North Adelaide", "Midfielder", 183],
  ["Darcy Szerszyn", "Dandenong Stingrays", "Defender", 187],
  ["Sam Tassone", "North Adelaide", "Defender", 180],
  ["Zac Antonellos", "Eastern Ranges", "Forward", 181],
].map(([name, juniorClub, role, height], index) => ({
  id: `2026-ranked-${String(index + 1).padStart(2, "0")}`,
  name,
  juniorClub,
  role,
  height,
  rank: index + 1,
}));

// The first 54 selections seed the opening three rounds of the 2026 draft. These are
// the AFL's post-trade owners, so the game starts with the same pick order.
const INITIAL_2026_PICK_OWNERS = [
  "Essendon", "Richmond", "West Coast", "Melbourne", "Richmond", "Sydney",
  "Port Adelaide", "Gold Coast", "GWS", "St Kilda", "Collingwood", "Port Adelaide",
  "Carlton", "Melbourne", "Adelaide", "St Kilda", "Essendon", "Carlton",
  "Fremantle", "GWS", "Brisbane", "Port Adelaide", "West Coast", "Port Adelaide",
  "Essendon", "GWS", "Brisbane", "Brisbane", "Hawthorn", "Collingwood",
  "Carlton", "Adelaide", "North Melbourne", "Port Adelaide", "Adelaide", "Geelong",
  "Hawthorn", "Sydney", "Sydney", "Fremantle", "St Kilda", "Western Bulldogs",
  "Adelaide", "Richmond", "Brisbane", "Port Adelaide", "Sydney", "Melbourne",
  "North Melbourne", "Carlton", "St Kilda", "Melbourne", "Western Bulldogs", "Sydney",
];
const INITIAL_2026_PICK_ORIGINS = {
  4: "Port Adelaide",
  5: "Port Adelaide",
  6: "North Melbourne",
  7: "Melbourne",
  12: "Melbourne",
  14: "Western Bulldogs",
  16: "Geelong",
  17: "Hawthorn",
  18: "Sydney",
  20: "Brisbane",
  21: "Essendon",
  22: "Richmond",
  25: "Hawthorn",
  26: "Carlton",
  27: "Hawthorn",
  28: "GWS",
  31: "GWS",
  32: "Port Adelaide",
  33: "Melbourne",
  34: "Adelaide",
  39: "Sydney",
  41: "Brisbane",
  42: "Brisbane",
  43: "Essendon",
  45: "West Coast",
  48: "Port Adelaide",
  49: "Melbourne",
  50: "GWS",
  52: "Sydney",
  53: "Brisbane",
  54: "Carlton",
};

// Round-one to round-three future selections transferred during the 2026
// trade period. Keys identify the club the pick is tied to; labels therefore
// retain the original club after a trade.
const FUTURE_PICK_OWNERS = {
  "2027-R1-Geelong": "Essendon",
  "2027-R1-Sydney": "Carlton",
  "2027-R1-St Kilda": "Brisbane",
  "2027-R1-Melbourne": "Port Adelaide",
  "2027-R1-Richmond": "Port Adelaide",
  "2027-R2-Melbourne": "Brisbane",
  "2027-R2-Western Bulldogs": "Brisbane",
  "2027-R2-Brisbane": "Melbourne",
  "2027-R2-Carlton": "Sydney",
  "2027-R2-North Melbourne": "Sydney",
  "2027-R2-Richmond": "Port Adelaide",
  "2027-R2-Port Adelaide": "Western Bulldogs",
  "2027-R2-Gold Coast": "Hawthorn",
  "2027-R2-West Coast": "Melbourne",
  "2027-R3-Hawthorn": "West Coast",
  "2027-R3-Port Adelaide": "North Melbourne",
  "2027-R3-West Coast": "St Kilda",
  "2027-R3-Melbourne": "St Kilda",
  "2028-R1-Gold Coast": "Hawthorn",
  "2028-R1-Hawthorn": "Gold Coast",
  "2028-R1-Western Bulldogs": "Port Adelaide",
  "2028-R2-Geelong": "Essendon",
  "2028-R2-Hawthorn": "Essendon",
  "2028-R2-Gold Coast": "Hawthorn",
  "2028-R2-West Coast": "Melbourne",
  "2028-R2-Melbourne": "West Coast",
  "2028-R2-North Melbourne": "Sydney",
  "2028-R2-Sydney": "North Melbourne",
  "2028-R2-Port Adelaide": "Western Bulldogs",
  "2028-R3-Collingwood": "Carlton",
  "2028-R3-Carlton": "GWS",
  "2028-R3-St Kilda": "Geelong",
  "2028-R3-Hawthorn": "Western Bulldogs",
  "2028-R3-Port Adelaide": "Western Bulldogs",
};

export function createInitial2026DraftPicks(clubs = []) {
  const clubNames = clubs.map((club) => typeof club === "string" ? club : club.name).filter(Boolean);
  const owners = [...INITIAL_2026_PICK_OWNERS];
  while (clubNames.length && owners.length < clubNames.length * 5) owners.push(clubNames[owners.length % clubNames.length]);
  return owners.map((owner, index) => ({
    id: `2026-pick-${index + 1}`,
    year: 2026,
    round: Math.floor(index / 18) + 1,
    originalClub: INITIAL_2026_PICK_ORIGINS[index + 1] ?? owner,
    currentOwner: owner,
    number: index + 1,
    resolved: true,
  }));
}

function seededRandom(seed) {
  let value = (Number(seed) >>> 0) || 1;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function positionsForRole(role, random) {
  if (role === "Ruck") return ["RUC"];
  if (role === "Defender") return random() > 0.45 ? ["KPD"] : ["HB", "BP"];
  if (role === "Forward") return random() > 0.42 ? ["KPF"] : ["HF", "FF"];
  return random() > 0.45 ? ["MID", "WING"] : ["MID"];
}

function generatedProspect(year, index, random, existingNames) {
  const roles = ["Midfielder", "Midfielder", "Forward", "Defender", "Ruck"];
  const combinations = DRAFT_FIRST_NAMES.length * DRAFT_LAST_NAMES.length;
  const start = Math.floor(random() * combinations);
  let name = "";
  for (let offset = 0; offset < combinations; offset += 1) {
    const pairIndex = (start + offset) % combinations;
    const candidate = `${DRAFT_FIRST_NAMES[Math.floor(pairIndex / DRAFT_LAST_NAMES.length)]} ${DRAFT_LAST_NAMES[pairIndex % DRAFT_LAST_NAMES.length]}`;
    if (!existingNames.has(candidate)) {
      name = candidate;
      break;
    }
  }
  // The 150,000-name pool should not be exhausted in a normal career. Keep a
  // deterministic unique fallback for exceptionally long generated saves.
  if (!name) name = `${DRAFT_FIRST_NAMES[index % DRAFT_FIRST_NAMES.length]} ${DRAFT_LAST_NAMES[Math.floor(index / DRAFT_FIRST_NAMES.length) % DRAFT_LAST_NAMES.length]} ${year}`;
  existingNames.add(name);
  return {
    id: `draft-${year}-${String(index + 1).padStart(3, "0")}`,
    name,
    juniorClub: "AFL Talent Pathway",
    role: roles[Math.floor(random() * roles.length)],
    height: 176 + Math.floor(random() * 30),
    rank: index + 1,
  };
}

export function generateProspect(id, year = 2028, index = Number(id) || 0) {
  const prospect = generatedProspect(year, index, seededRandom(`${year}${id}`), new Set());
  return { ...prospect, id: `draft-${year}-${String(index + 1).padStart(3, "0")}` };
}

export function generateDraftClass(count = 90, year = 2028, existingNames = []) {
  const random = seededRandom(year * 9973 + count);
  const names = new Set(existingNames);
  return Array.from({ length: count }, (_, index) => generatedProspect(year, index, random, names));
}

export function getDraftOrder(ladder = [], clubs = [], playerPool = []) {
  const ladderPositions = new Map(ladder.map((entry, index) => [entry.club, index]));
  const hasResults = ladder.some((entry) => Number(entry.wins ?? 0) + Number(entry.losses ?? 0) + Number(entry.draws ?? 0) > 0);
  const ratingFor = (club) => getClubBestTeam((playerPool ?? []).filter((player) => getCareerClub(player, {}) === club.name)).bestTeamOverall ?? 65;
  return [...clubs].sort((a, b) => {
    const aPos = ladderPositions.get(a.name);
    const bPos = ladderPositions.get(b.name);
    if (!hasResults) return ratingFor(a) - ratingFor(b) || a.name.localeCompare(b.name);
    // After games have been played, the final ladder determines subsequent
    // draft order: last place picks first, regardless of current squad strength.
    if (aPos !== undefined && bPos !== undefined && aPos !== bPos) return bPos - aPos;
    if (aPos !== undefined) return -1;
    if (bPos !== undefined) return 1;
    return ratingFor(a) - ratingFor(b) || a.name.localeCompare(b.name);
  }).map((club) => club.name);
}

export function createFutureDraftPicks(firstYear, clubs = [], previousPicks = []) {
  const existing = new Map((previousPicks ?? []).map((pick) => [pick.id, pick]));
  const regular = [firstYear, firstYear + 1].flatMap((year) => leagueClubsForYear(year).flatMap((club) =>
    [1, 2, 3, 4, 5].map((round) => {
      const id = `${year}-R${round}-${club.id}`;
      return existing.get(id) ?? {
        id,
        year,
        round,
        originalClub: club.name,
        currentOwner: FUTURE_PICK_OWNERS[`${year}-R${round}-${club.name}`] ?? club.name,
        number: null,
        resolved: false,
      };
    }),
  ));
  const expansion = [firstYear, firstYear + 1].flatMap((year) => createTasmaniaConcessionPicks(year, existing));
  return [...regular, ...expansion, ...(previousPicks ?? []).filter(pick => pick.compensation && Number(pick.year) >= firstYear && Number(pick.year) <= firstYear + 1)];
}

function createTasmaniaConcessionPicks(year, existing = new Map()) {
  const yearRules = {
    2027: { firstRound: [1, 3, 5, 7, 9, 11, 13], extraRounds: [2, 3, 4, 5], mustTrade: [5, 7, 11, 13], roundOneSlots: 25 },
    2028: { firstRound: [5, 9], extraRounds: [2, 3, 4, 5], mustTrade: [5], roundOneSlots: 21 },
    2029: { firstRound: [5, 9], extraRounds: [], mustTrade: [5], roundOneSlots: 21 },
  }[Number(year)];
  if (!yearRules) return [];
  let offset = 0;
  const firstRound = yearRules.firstRound.map((selection) => ({
    id: `TAS-${year}-R1-P${selection}`,
    year: Number(year), round: 1, originalClub: tasmaniaDevils.name, currentOwner: tasmaniaDevils.name,
    number: null, resolved: false, expansionConcession: true, concessionNumber: selection,
    mandatoryTrade: yearRules.mustTrade.includes(selection), rollForwardYears: 2,
  }));
  const laterRounds = yearRules.extraRounds.map((round) => {
    const preceding = yearRules.firstRound.length + yearRules.extraRounds.filter((item) => item < round).length;
    const roundOne = yearRules.roundOneSlots;
    const slotsBeforeThis = roundOne + Math.max(0, round - 2) * (leagueClubsForYear(year).length + (yearRules.extraRounds.includes(round) ? 1 : 0));
    const pick = {
      id: `TAS-${year}-R${round}-CONCESSION`, year: Number(year), round,
      originalClub: tasmaniaDevils.name, currentOwner: tasmaniaDevils.name,
      number: null, resolved: false, expansionConcession: true,
      concessionNumber: slotsBeforeThis + 1,
      mandatoryTrade: false, rollForwardYears: round === 2 ? 0 : 0,
      concessionOrdinal: preceding + 1,
    };
    offset += 1;
    return pick;
  });
  return [...firstRound, ...laterRounds].map((pick) => existing.get(pick.id) ?? pick);
}

export function resolveDraftPickNumbers(picks = [], draftYear, ladder = [], clubs = [], playerPool = []) {
  const draftClubs = Number(draftYear) >= 2027 && clubs.length >= 18 ? draftClubsForYear(draftYear) : clubs;
  const order = getDraftOrder(ladder, draftClubs, playerPool);
  const ladderPosition = new Map(order.map((clubName, index) => [clubName, index]));
  const yearPicks = picks.filter(pick => Number(pick.year) === Number(draftYear));
  const regular = yearPicks.filter(pick => !pick.compensation).sort((a, b) => {
    const aOrder = a.resolved && Number.isFinite(Number(a.number)) ? Number(a.number) : (a.round - 1) * clubs.length + (ladderPosition.get(a.originalClub) ?? clubs.length);
    const bOrder = b.resolved && Number.isFinite(Number(b.number)) ? Number(b.number) : (b.round - 1) * clubs.length + (ladderPosition.get(b.originalClub) ?? clubs.length);
    return aOrder - bOrder;
  });
  const extras = yearPicks.filter(pick => pick.compensation).sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const ordered = [];
  const fixed = regular.filter((pick) => Number.isFinite(Number(pick.concessionNumber)) && pick.expansionConcession);
  if (!fixed.length) {
    for (const pick of regular) {
      ordered.push(pick);
      for (const extra of extras) if (extra.afterClub === pick.originalClub && Number(extra.afterRound) === Number(pick.round) && !ordered.includes(extra)) ordered.push(extra);
    }
    for (const extra of extras) if (!ordered.includes(extra)) ordered.push(extra);
  } else {
    const standard = regular.filter((pick) => !fixed.includes(pick));
    ordered.length = regular.length;
    fixed.forEach((pick) => { const slot = Math.max(0, Math.min(regular.length - 1, Number(pick.concessionNumber) - 1)); if (!ordered[slot]) ordered[slot] = pick; });
    let standardIndex = 0;
    for (let slot = 0; slot < regular.length; slot += 1) if (!ordered[slot] && standardIndex < standard.length) ordered[slot] = standard[standardIndex++];
    ordered.push(...extras);
  }
  const numbered = new Map(ordered.map((pick, index) => [pick.id, { ...pick, number: index + 1, resolved: true }]));
  return picks.map(pick => numbered.get(pick.id) ?? pick);
}

export function formatDraftPick(pick) {
  if (!pick) return "Draft pick";
  const base = Number.isFinite(Number(pick.number)) && Number(pick.number) > 0
    ? `Pick ${pick.number}`
    : `R${pick.round} ${pick.year} Pick`;
  const traded = (pick.currentOwner ?? pick.owner) !== pick.originalClub ? ` - ${pick.originalClub}` : "";
  const tradeRule = pick.mandatoryTrade && (pick.currentOwner ?? pick.owner) === tasmaniaDevils.name ? " · Tasmania must trade" : "";
  return `${base}${traded}${tradeRule}`;
}

export function evaluateDraftPickExchange({ offeredPicks = [], requestedPicks = [], seasonYear = 2027 } = {}) {
  const offeredValue = calculateAssetPackageValue(offeredPicks.map((pick) => calculatePickValue(pick, { seasonYear })));
  const requestedValue = calculateAssetPackageValue(requestedPicks.map((pick) => calculatePickValue(pick, { seasonYear })));
  if (!validTradePackage({ picks: offeredPicks }) || !validTradePackage({ picks: requestedPicks })) {
    return { accepted: false, offeredValue, requestedValue, reason: "Offer at least one pick each way." };
  }
  const requiredValue = Math.ceil(requestedValue * 1.1);
  const accepted = offeredValue >= requiredValue;
  return {
    accepted,
    offeredValue,
    requestedValue,
    requiredValue,
    reason: accepted
      ? "The club accepts the pick exchange based on its total draft value."
      : `The club rejects the offer. They value the requested picks at ${requestedValue} and want at least ${requiredValue} in return.`,
  };
}

function prepareProspects({ draftYear, count, initial, existingNames, clubNames = [] }) {
  const knownNames = new Set(existingNames);
  const rawProspects = initial
    ? [...INITIAL_2026_PROSPECTS, ...generateDraftClass(Math.max(0, count - INITIAL_2026_PROSPECTS.length), draftYear, [...knownNames, ...INITIAL_2026_PROSPECTS.map((prospect) => prospect.name)])]
    : generateDraftClass(count, draftYear, knownNames);
  const prepared = rawProspects.slice(0, count).map((prospect, index) => {
    const positions = positionsForRole(prospect.role, seededRandom(`${prospect.id}:position`));
    const rank = index + 1;
    const eliteCount = Math.max(1, Math.round(count * 0.03));
    const highCount = Math.max(1, Math.round(count * 0.07));
    const establishedCount = Math.round(count * 0.6);
    const potentialRandom = seededRandom((draftYear * 1009) + rank * 7919)();
    const potential = rank <= eliteCount
      ? 90 + Math.floor(potentialRandom * 5)
      : rank <= eliteCount + highCount
        ? 86 + Math.floor(potentialRandom * 4)
        : rank <= eliteCount + highCount + establishedCount
          ? 78 + Math.floor(potentialRandom * 7)
          : 72 + Math.floor(potentialRandom * 6);
    return {
      ...prospect,
      rank,
      positions,
      overall: Math.max(55, Math.min(70, 70 - Math.floor((rank - 1) / 5))),
      potential,
    };
  });
  // Father-son and academy (NGA / Northern Academy) connections.
  return assignProspectConnections(prepared, { draftYear, clubNames, initial, fatherFirstNames: DRAFT_FIRST_NAMES.slice(0, 40) });
}

/** Create a fully rated prospect pool for fantasy-style league drafts. */
export function createFormattedDraftProspects({ draftYear = 2027, count = 50, existingNames = [] } = {}) {
  return prepareProspects({ draftYear, count, initial: false, existingNames });
}

/** Return only the real prospects recorded for the 2026 AFL draft intake. */
export function createCurrentYearDraftProspects({ draftYear = 2026, existingNames = [] } = {}) {
  return prepareProspects({
    draftYear,
    count: INITIAL_2026_PROSPECTS.length,
    initial: true,
    existingNames,
  });
}

/** Start an interactive draft, ordered from the bottom of the final ladder up. */
export function createDraftState({ draftYear, ladder = [], clubs = [], initial = false, existingNames = [], draftPickAssets = [], playerPool = [], academyClass = [] }) {
  const draftClubs = Number(draftYear) >= 2027 && clubs.length >= 18 ? draftClubsForYear(draftYear) : clubs;
  const draftOrder = getDraftOrder(ladder, draftClubs, playerPool);
  const baseCount = draftOrder.length * 5;
  const yearPicks = draftPickAssets.filter((pick) => pick.year === draftYear && pick.resolved && Number.isFinite(pick.number));
  const count = Math.max(baseCount, yearPicks.length);
  const fromAssets = yearPicks.length === count ? draftPickMetaFields(yearPicks) : null;
  const pickOwners = fromAssets?.pickOwners
    ?? Array.from({ length: count }, (_, index) => draftOrder[index % draftOrder.length]);
  const pickMeta = fromAssets?.pickMeta
    ?? pickOwners.map((owner, index) => ({ id: `slot-${index}`, owner, originalClub: draftOrder[index % draftOrder.length], round: Math.floor(index / draftOrder.length) + 1, traded: false }));
  const clubNames = (draftClubs ?? []).map((club) => typeof club === "string" ? club : club?.name).filter(Boolean);
  return {
    draftYear,
    initial,
    draftOrder,
    pickOwners,
    pickMeta,
    bidLog: [],
    deficits: {},
    compensatedClubs: [],
    pendingBid: null,
    // A club's academy graduates replace generated prospects of similar quality.
    availableProspects: mergeAcademyProspects(prepareProspects({ draftYear, count, initial, existingNames, clubNames: clubNames.length ? clubNames : draftOrder }), academyClass),
    picks: [],
    pickIndex: 0,
    totalPicks: count,
    completed: count === 0,
  };
}

export function getCurrentDraftClub(draftState) {
  if (!draftState || draftState.completed) return null;
  return draftState.pickOwners?.[draftState.pickIndex] ?? draftState.draftOrder[draftState.pickIndex % draftState.draftOrder.length] ?? null;
}

export function getEligibleDraftProspects(draftState) {
  if (!draftState || draftState.completed) return [];
  return draftState.availableProspects ?? [];
}

function prospectNeedGroup(prospect) {
  if (prospect.role === "Ruck") return "ruck";
  if (prospect.role === "Defender") return "defence";
  if (prospect.role === "Forward") return "forward";
  return "midfield";
}

function rosterNeed(clubName, prospect, players, contractsByPlayer) {
  const target = { midfield: 13, defence: 12, forward: 12, ruck: 3 };
  const counts = { midfield: 0, defence: 0, forward: 0, ruck: 0 };
  players.filter((player) => getCareerClub(player, contractsByPlayer) === clubName)
    .forEach((player) => {
      const positions = player.positions ?? [];
      if (positions.includes("RUC")) counts.ruck += 1;
      else if (positions.some((position) => ["KPD", "HB", "BP", "FB"].includes(position))) counts.defence += 1;
      else if (positions.some((position) => ["KPF", "FF", "HF", "FP"].includes(position))) counts.forward += 1;
      else counts.midfield += 1;
    });
  const group = prospectNeedGroup(prospect);
  return Math.max(-2, Math.min(6, target[group] - counts[group]));
}

// Clubs prefer their own father-son/academy prospects (no matching cost) and are
// slightly less keen to bid on a rival's, since the bid can be matched.
function tiedProspectAdjustment(draftState, prospect, clubName) {
  if (!prospect.connection || !isBiddingActive(draftState)) return 0;
  return prospect.connection.club === clubName ? 1.5 : -0.7;
}

export function chooseAIDraftProspect(draftState, clubName, players = [], contractsByPlayer = {}, plan = null) {
  const candidates = getEligibleDraftProspects(draftState);
  const pickNumber = draftState.pickIndex + 1;
  return [...candidates].sort((a, b) => {
    const score = (prospect) => rosterNeed(clubName, prospect, players, contractsByPlayer) * 1.7
      + (plan?.needs?.some(need => ({ ruck: ['rucks'], defence: ['keyDefenders', 'smallDefenders'], forward: ['keyForwards', 'smallForwards'], midfield: ['midfielders'] })[prospectNeedGroup(prospect)]?.includes(need.category)) ? 4 : 0)
      - Math.abs(prospect.rank - pickNumber) * 0.12
      + tiedProspectAdjustment(draftState, prospect, clubName);
    return score(b) - score(a) || a.rank - b.rank;
  })[0] ?? null;
}

export function passDraftPick(draftState, clubName) {
  if (!draftState || draftState.completed || getCurrentDraftClub(draftState) !== clubName) return null;
  const pickNumber = draftState.pickIndex + 1;
  const round = getPickMeta(draftState)[draftState.pickIndex]?.round ?? Math.floor(draftState.pickIndex / draftState.draftOrder.length) + 1;
  const pickIndex = draftState.pickIndex + 1;
  const pass = { year: draftState.draftYear, pick: pickNumber, round, club: clubName, passed: true };
  return {
    draftState: {
      ...draftState,
      picks: [...draftState.picks, pass],
      pickIndex,
      completed: pickIndex >= draftState.totalPicks,
    },
    players: [],
    contracts: {},
  };
}

export function selectDraftProspect(draftState, prospectId, clubName, contractSeason = draftState?.draftYear, clubs = [], selectionDetails = {}) {
  if (!draftState || draftState.completed || getCurrentDraftClub(draftState) !== clubName) return null;
  const prospect = getEligibleDraftProspects(draftState).find((candidate) => String(candidate.id) === String(prospectId));
  if (!prospect) return null;
  const pickNumber = draftState.pickIndex + 1;
  const round = getPickMeta(draftState)[draftState.pickIndex]?.round ?? Math.floor(draftState.pickIndex / draftState.draftOrder.length) + 1;
  const player = createPlayer({
    id: prospect.id,
    name: prospect.name,
    club: clubName,
    age: 18,
    positions: prospect.positions,
    overall: prospect.overall,
    tier: "Rookie",
    potential: prospect.potential,
    salary: Math.max(150_000, getMinimumSalary(contractSeason)),
    yearsRemaining: 2,
  });
  // National and rookie draftees enter the following playing season at 18.
  player.ageYear = Number(draftState.draftYear) + (draftState.kind === 'MID_SEASON' ? 0 : 1);
  player.draft = { year: draftState.draftYear, kind: draftState.kind ?? 'NATIONAL', pick: pickNumber, round, rank: prospect.rank, juniorClub: prospect.juniorClub };
  const pick = {
    year: draftState.draftYear,
    pick: pickNumber,
    round,
    club: clubName,
    playerId: player.id,
    playerName: player.name,
    positions: prospect.positions,
    overall: prospect.overall,
    potential: prospect.potential,
    rank: prospect.rank,
    juniorClub: prospect.juniorClub,
    rankOffset: prospect.rank - pickNumber,
    connection: prospect.connection ?? null,
    ...selectionDetails,
  };
  const pickIndex = draftState.pickIndex + 1;
  const nextDraftState = {
    ...draftState,
    picks: [...draftState.picks, pick],
    availableProspects: draftState.availableProspects.filter((candidate) => candidate.id !== prospect.id),
    pickIndex,
    completed: pickIndex >= draftState.totalPicks,
  };
  return {
    draftState: nextDraftState,
    player,
    contract: {
      club: clubName,
      salary: player.contract.salary,
      yearsRemaining: player.contract.yearsRemaining,
      signedSeason: contractSeason,
      role: "Rookie",
      rookie: true,
    },
  };
}

// ---------------------------------------------------------------------------
// Father-son / academy bidding
// ---------------------------------------------------------------------------
function clubCanTakeDraftee(clubName, { players, contracts, contractSeason, administrationByClub }, { ignoreListSize = false } = {}) {
  const clubList = players.filter((player) => getCareerClub(player, contracts) === clubName);
  // A club matching a bid is not blocked by a full list; AI lists are trimmed after the draft.
  return (ignoreListSize || clubList.length < 44) && checkClubCommitments(players, contracts, clubName, contractSeason, 1, administrationByClub?.[clubName] ?? {}).ok;
}

export function isBidProspect(draftState, prospect, clubName) {
  return isBiddingActive(draftState) && Boolean(prospect?.connection) && prospect.connection.club !== clubName;
}

export function getTiedProspects(draftState) {
  return (draftState?.availableProspects ?? []).filter((prospect) => prospect.connection);
}

// Drafts the prospect for the home club at the bid slot after reordering the draft.
function draftMatchedProspect(draftState, prospect, { homeClub, bidClub, bidIndex, plan, options }, contractSeason, clubs) {
  const reorder = reorderForMatchedBid(draftState, { homeClub, bidIndex, plan, prospectId: prospect.id });
  const pickNumber = bidIndex + 1;
  const entry = {
    id: `bid-${draftState.draftYear}-${pickNumber}-${prospect.id}`,
    pickNumber,
    bidClub,
    homeClub,
    prospectId: prospect.id,
    prospectName: prospect.name,
    connection: prospect.connection,
    matched: true,
    baseValue: options.baseValue,
    adjustment: options.adjustment,
    requiredPoints: plan.requiredPoints,
    pointsUsed: plan.points,
    picksUsed: plan.pickNumbers,
    deficit: plan.deficit,
    compensationTo: reorder.compensation?.owner ?? null,
  };
  const reordered = {
    ...draftState,
    pickOwners: reorder.pickOwners,
    pickMeta: reorder.pickMeta,
    totalPicks: reorder.totalPicks,
    pickIndex: bidIndex,
    compensatedClubs: reorder.compensatedClubs,
    deficits: reorder.deficits,
    pendingBid: null,
  };
  const result = selectDraftProspect(reordered, prospect.id, homeClub, contractSeason, clubs, {
    matchedBid: { bidClub, bidPick: pickNumber, requiredPoints: plan.requiredPoints, pointsUsed: plan.points, picksUsed: plan.pickNumbers, deficit: plan.deficit },
  });
  if (!result) return null;
  return {
    draftState: { ...result.draftState, bidLog: [...(draftState.bidLog ?? []), entry] },
    player: result.player,
    contract: result.contract,
    bid: entry,
  };
}

function logUnmatchedBid(draftState, prospect, bidClub, decision, homeClub) {
  const bidIndex = draftState.pickIndex;
  const entry = {
    id: `bid-${draftState.draftYear}-${bidIndex + 1}-${prospect.id}`,
    pickNumber: bidIndex + 1,
    bidClub,
    homeClub,
    prospectId: prospect.id,
    prospectName: prospect.name,
    connection: prospect.connection,
    matched: false,
    baseValue: decision?.options?.baseValue ?? null,
    adjustment: decision?.options?.adjustment ?? 0,
    requiredPoints: decision?.options?.requiredPoints ?? null,
    reason: decision?.reason ?? "Bid not matched",
  };
  return { draftState: { ...draftState, bidLog: [...(draftState.bidLog ?? []), entry] }, bid: entry };
}

// A bid by `bidClub` on a rival's prospect, with the home club's AI deciding
// whether to match. Returns { draftState, matched, player?, contract?, bid }.
function resolveAIBid(draftState, prospect, bidClub, ctx) {
  const homeClub = prospect.connection.club;
  const bidIndex = draftState.pickIndex;
  const canTake = clubCanTakeDraftee(homeClub, ctx, { ignoreListSize: true });
  const decision = canTake
    ? decideAIMatch(draftState, prospect, homeClub, bidIndex)
    : { match: false, reason: "Home club cannot take another player", options: null, plan: null };
  if (decision.match) {
    const matched = draftMatchedProspect(draftState, prospect, { homeClub, bidClub, bidIndex, plan: decision.plan, options: decision.options }, ctx.contractSeason, ctx.clubs);
    if (matched) return { ...matched, matched: true };
  }
  return { ...logUnmatchedBid(draftState, prospect, bidClub, decision, homeClub), matched: false };
}

// The manager (on the clock) bids on a rival's father-son / academy prospect.
// If the home club does not match, the manager drafts the player at this pick.
export function placeDraftBid(draftState, prospectId, userClubName, { players = [], contractsByPlayer = {}, contractSeason = draftState?.draftYear, clubs = [], administrationByClub = {} } = {}) {
  if (!isBiddingActive(draftState) || getCurrentDraftClub(draftState) !== userClubName || draftState.pendingBid) return null;
  const prospect = getEligibleDraftProspects(draftState).find((candidate) => String(candidate.id) === String(prospectId));
  if (!isBidProspect(draftState, prospect, userClubName)) return null;
  const outcome = resolveAIBid(draftState, prospect, userClubName, { players, contracts: contractsByPlayer, contractSeason, clubs, administrationByClub });
  if (outcome.matched) {
    return { draftState: outcome.draftState, players: [outcome.player], contracts: { [String(outcome.player.id)]: outcome.contract }, bid: outcome.bid };
  }
  const selected = selectDraftProspect(outcome.draftState, prospect.id, userClubName, contractSeason, clubs, { viaBid: true });
  if (!selected) return null;
  return { draftState: selected.draftState, players: [selected.player], contracts: { [String(selected.player.id)]: selected.contract }, bid: outcome.bid };
}

// The manager answers a bid placed on one of their father-son / academy prospects.
export function resolvePendingBid(draftState, { match = false, pickIndices = [] } = {}, { contractSeason = draftState?.draftYear, clubs = [] } = {}) {
  const pending = draftState?.pendingBid;
  if (!pending) return null;
  const prospect = getEligibleDraftProspects(draftState).find((candidate) => String(candidate.id) === String(pending.prospectId));
  if (!prospect) return { draftState: { ...draftState, pendingBid: null }, players: [], contracts: {} };
  const base = { ...draftState, pendingBid: null };
  if (match) {
    const check = validateMatchPlan(base, pending.homeClub, pending.bidIndex, pickIndices);
    if (!check.ok) return { error: check.reason };
    const matched = draftMatchedProspect(base, prospect, { homeClub: pending.homeClub, bidClub: pending.bidClub, bidIndex: pending.bidIndex, plan: check.plan, options: check.options }, contractSeason, clubs);
    if (!matched) return null;
    return { draftState: matched.draftState, players: [matched.player], contracts: { [String(matched.player.id)]: matched.contract }, bid: matched.bid };
  }
  // Declined: the bidding club takes the prospect at its pick.
  const logged = logUnmatchedBid(base, prospect, pending.bidClub, { options: null, reason: "Declined by the home club" }, pending.homeClub);
  const selected = selectDraftProspect(logged.draftState, prospect.id, pending.bidClub, contractSeason, clubs, { viaBid: true });
  if (!selected) return null;
  return { draftState: selected.draftState, players: [selected.player], contracts: { [String(selected.player.id)]: selected.contract }, bid: logged.bid };
}

export function processAIDraftPicks(draftState, userClubName, players = [], contractsByPlayer = {}, contractSeason = draftState?.draftYear, clubs = [], administrationByClub = {}, recruitmentPlans = {}) {
  let nextState = draftState;
  const draftedPlayers = [];
  const contracts = {};
  while (nextState && !nextState.completed && !nextState.pendingBid && getCurrentDraftClub(nextState) !== userClubName) {
    const clubName = getCurrentDraftClub(nextState);
    const context = { players: [...players, ...draftedPlayers], contracts: { ...contractsByPlayer, ...contracts }, contractSeason, administrationByClub };
    if (!clubCanTakeDraftee(clubName, context)) {
      const passed = passDraftPick(nextState, clubName);
      if (!passed) break;
      nextState = passed.draftState;
      continue;
    }
    let prospect = chooseAIDraftProspect(nextState, clubName, context.players, context.contracts, recruitmentPlans[clubName]);
    if (!prospect) break;
    // A club bids on a rival's father-son/academy prospect when he is rated at
    // least as highly as this pick and better than the player it would otherwise take.
    const bidTarget = isBiddingActive(nextState)
      ? getTiedProspects(nextState)
        .filter((candidate) => candidate.connection.club !== clubName && candidate.rank <= nextState.pickIndex + 2 && candidate.rank < prospect.rank)
        .sort((a, b) => a.rank - b.rank)[0]
      : null;
    if (bidTarget) prospect = bidTarget;
    let viaBid = false;
    if (isBidProspect(nextState, prospect, clubName)) {
      const homeClub = prospect.connection.club;
      if (userClubName && homeClub === userClubName) {
        // The manager decides whether to match; pause the draft until they answer.
        nextState = { ...nextState, pendingBid: { prospectId: prospect.id, prospectName: prospect.name, bidClub: clubName, homeClub, bidIndex: nextState.pickIndex, bidPickNumber: nextState.pickIndex + 1 } };
        break;
      }
      const outcome = resolveAIBid(nextState, prospect, clubName, { ...context, clubs });
      nextState = outcome.draftState;
      if (outcome.matched) {
        draftedPlayers.push(outcome.player);
        contracts[String(outcome.player.id)] = outcome.contract;
        continue;
      }
      viaBid = true;
    }
    const result = selectDraftProspect(nextState, prospect.id, clubName, contractSeason, clubs, viaBid ? { viaBid: true } : {});
    if (!result) break;
    nextState = result.draftState;
    draftedPlayers.push(result.player);
    contracts[String(result.player.id)] = result.contract;
  }
  return { draftState: nextState, players: draftedPlayers, contracts };
}

export function estimateScoutedOverall(prospect, scoutingAccuracy = 0.65) {
  const accuracy = Math.max(0.5, Math.min(0.95, Number(scoutingAccuracy) || 0.65));
  const uncertainty = Math.max(1, Math.round((1 - accuracy) * 12));
  const stableSeed = [...String(prospect?.name ?? prospect?.id ?? "prospect")]
    .reduce((total, character) => total + character.charCodeAt(0), 0);
  const estimatedError = (stableSeed % (uncertainty * 2 + 1)) - uncertainty;
  const rating = Number(prospect?.rating ?? prospect?.currentAbility ?? prospect?.overall ?? 60);
  return {
    overall: Math.max(40, Math.min(99, rating + estimatedError)),
    confidence: Math.round(accuracy * 100),
    uncertainty,
  };
}
