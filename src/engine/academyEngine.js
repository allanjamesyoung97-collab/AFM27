// Club academy: a junior pathway whose draft-year players become father-son /
// academy ("NGA" or Northern Academy) prospects tied to the club in the national
// draft. Other clubs can bid on them and the club can match with its own picks
// (see draftBiddingEngine.js).
//
// Pure functions. The academy lives on seasonState.academy:
//   { clubName, academyType, level, emphasis, coach, coachMarket, nextDraftYear,
//     players: [...], history: [...], rolledOverYear }
//
// Talent and growth follow the club's facilities and staff:
//  - the quality of each new group of juniors comes from recruiting facilities,
//    the List Manager's rating, the academy's own level and the academy coach;
//  - growth follows training facilities and development staff (through
//    getFacilityBonuses), the academy level and the academy coach.
// With an average setup roughly 27% of juniors are good enough to be drafted and
// about 10% become quality players (a ceiling of 78 or more).
//
// The manager sees a read of each player's ceiling (a range). The true ceiling is
// hidden; a higher academy level, a better coach, focus time and months in the
// academy all narrow the range around the truth.

import { DRAFT_FIRST_NAMES, DRAFT_LAST_NAMES } from "../data/draftNamePool.js";
import { getFacilityBonuses } from "./clubAdministrationEngine.js";

export const ACADEMY_MAX_LEVEL = 5;
export const NORTHERN_ACADEMY_CLUBS = ["Brisbane", "Gold Coast", "Sydney", "GWS"];
export const DRAFT_BOUND_POTENTIAL = 64; // true ceiling needed to enter the draft
export const STATE_LEAGUE_CEILING = 62; // read centre below this is a state-league ceiling
const MAX_DRAFTEES_PER_YEAR = 6;
const COACH_CONTRACT_SEASONS = 2;
const UPGRADE_COSTS = { 1: 200_000, 2: 300_000, 3: 450_000, 4: 650_000 };

export const EMPHASES = {
  BALANCED: { label: "Balanced", note: "Small, steady development across all four categories." },
  FOOTBALL_IQ: { label: "Football IQ", note: "Focused football IQ development, with very small gains elsewhere." },
  TECHNICAL: { label: "Technical", note: "Focused technical development, with very small gains elsewhere." },
  ATHLETICISM: { label: "Athleticism", note: "Focused athletic development, with very small gains elsewhere." },
  MENTAL: { label: "Mental", note: "Focused mental development, with very small gains elsewhere." },
};

export const POSITION_LABELS = {
  KPD: "Key Defender", HB: "Half-Back", BP: "General Defender", MID: "Midfielder", WING: "Wingman",
  HF: "Half-Forward", FF: "Small Forward", KPF: "Key Forward", RUC: "Ruck",
};

const POSITION_WEIGHTS = [["MID", 3], ["WING", 1], ["HB", 1.2], ["BP", 1], ["KPD", 1], ["HF", 1.2], ["FF", 1], ["KPF", 1], ["RUC", 0.5]];
const JUNIOR_CLUBS = [
  "Northern Knights", "Oakleigh Chargers", "Murray Bushrangers", "Geelong Falcons", "Greater Western Victoria Rebels",
  "Dandenong Stingrays", "Sandringham Dragons", "Eastern Ranges", "Gippsland Power", "Western Jets", "Bendigo Pioneers", "Calder Cannons",
];
const COACH_SPECIALTIES = ["Football IQ", "Technical", "Athleticism", "Player development", "Talent identification"];
const CLUB_JUNIOR_PATHWAYS = {
  Adelaide: ["South Australian talent pathway"], Brisbane: ["Queensland talent pathway", "Northern Territory talent pathway"],
  Carlton: ["Northern Knights", "Murray Bushrangers"], Collingwood: ["Oakleigh Chargers", "Eastern Ranges"],
  Essendon: ["Calder Cannons", "Western Jets"], Fremantle: ["Western Australian talent pathway"],
  Geelong: ["Geelong Falcons", "Greater Western Victoria Rebels"], "Gold Coast": ["Queensland talent pathway", "Northern Territory talent pathway"],
  Hawthorn: ["Eastern Ranges", "Gippsland Power"], Melbourne: ["Sandringham Dragons", "Dandenong Stingrays"],
  "North Melbourne": ["Northern Knights", "Murray Bushrangers"], "Port Adelaide": ["South Australian talent pathway"],
  Richmond: ["Bendigo Pioneers", "Eastern Ranges"], "St Kilda": ["Sandringham Dragons", "Dandenong Stingrays"],
  Sydney: ["NSW talent pathway", "Northern Territory talent pathway"], "West Coast": ["Western Australian talent pathway"],
  "Western Bulldogs": ["Western Jets", "Greater Western Victoria Rebels"], GWS: ["NSW talent pathway", "Northern Territory talent pathway"],
  Tasmania: ["Tasmanian talent pathway"],
};
const juniorPathway = (clubName) => CLUB_JUNIOR_PATHWAYS[clubName] ?? JUNIOR_CLUBS;

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const coachScale20 = (coach) => Number(coach?.rating ?? 30) > 20 ? Number(coach.rating) / 5 : Number(coach?.rating ?? 6);

function hashSeed(text) {
  let h = 2166136261;
  const s = String(text);
  for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function random(seed) {
  let value = hashSeed(seed) || 1;
  return () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296; };
}
const slug = (text) => String(text).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const academySlots = (level) => 1 + (level >= 3 ? 1 : 0) + (level >= 5 ? 1 : 0);
export const academyUpgradeCost = (level) => UPGRADE_COSTS[level] ?? null;
export const ceilingLabel = (centre) => centre >= 84 ? "Top of a draft" : centre >= 78 ? "First round" : centre >= 66 ? "Later picks" : centre >= STATE_LEAGUE_CEILING ? "A rookie" : "Below League Standard";
const roleFor = (positions) => positions.includes("RUC") ? "Ruck" : positions.some((p) => ["KPD", "HB", "BP"].includes(p)) ? "Defender" : positions.some((p) => ["KPF", "FF", "HF"].includes(p)) ? "Forward" : "Midfielder";

function uniqueName(rand, used) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const name = `${DRAFT_FIRST_NAMES[Math.floor(rand() * DRAFT_FIRST_NAMES.length)]} ${DRAFT_LAST_NAMES[Math.floor(rand() * DRAFT_LAST_NAMES.length)]}`;
    if (!used.has(name)) { used.add(name); return name; }
  }
  const name = `${DRAFT_FIRST_NAMES[0]} ${DRAFT_LAST_NAMES[used.size % DRAFT_LAST_NAMES.length]}`;
  used.add(name);
  return name;
}

function pickPosition(rand) {
  const total = POSITION_WEIGHTS.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = rand() * total;
  for (const [position, weight] of POSITION_WEIGHTS) { roll -= weight; if (roll <= 0) return position; }
  return "MID";
}

const to01 = (value, low, high) => clamp((Number(value) - low) / (high - low), 0, 1);

// How the club's wider facilities and staff shape the academy.
export function academyInfluence(administration = {}) {
  const facilities = administration?.facilities ?? {};
  const staff = administration?.staff ?? [];
  const bonuses = getFacilityBonuses(facilities, staff);
  return {
    recruitingLevel: clamp(Number(facilities.recruiting ?? 1), 1, 5),
    trainingLevel: clamp(Number(facilities.training ?? 1), 1, 5),
    listManager: Number(staff.find((person) => person.role === "List Manager")?.rating ?? 65),
    scoutingAccuracy: bonuses.scoutingAccuracy,
    developmentMultiplier: clamp(bonuses.trainingDevelopmentMultiplier, 0.85, 1.5),
  };
}

// 0 to 1 score for the quality of juniors the academy attracts.
export function intakeQuality(academy, influence) {
  return 0.25 * to01(influence.recruitingLevel, 1, 5)
    + 0.25 * to01(influence.listManager, 55, 85)
    + 0.30 * to01(academy?.level ?? 3, 1, ACADEMY_MAX_LEVEL)
    + 0.20 * to01(coachScale20(academy?.coach), 1, 20);
}
const NEUTRAL_QUALITY = 0.44; // the score of a typical club (level 2 recruiting facility, List Manager about 68, academy level 3)

export function intakeLabel(quality) {
  return quality < 0.3 ? "Poor" : quality < 0.5 ? "Average" : quality < 0.68 ? "Good" : "Excellent";
}

// A junior's true ceiling. At neutral quality 27% reach the draft bar (64) and
// 10% become quality players (78+). Better facilities and staff move both shares
// up (to about 35% and 15%); weak ones move them down (to about 22% and 7%).
function drawPotential(rand, quality) {
  const shift = clamp((quality - NEUTRAL_QUALITY) * 0.25, -0.06, 0.09);
  const qualityCut = 0.10 + shift * 0.55;
  const draftCut = 0.27 + shift;
  const u = rand();
  if (u < qualityCut) return Math.round(clamp(78 + 15 * ((u / qualityCut) ** 1.8), 78, 94));
  if (u < draftCut) return Math.floor(64 + 14 * ((u - qualityCut) / (draftCut - qualityCut)));
  return Math.round(clamp(63 - 22 * ((u - draftCut) / (1 - draftCut)), 40, 63));
}

function makePlayer({ clubName, draftYear, age, quality, seed, used, index }) {
  const rand = random(`${seed}:${draftYear}:${index}`);
  const potential = drawPotential(rand, quality);
  const main = pickPosition(rand);
  const positions = main === "MID" && rand() > 0.55 ? ["MID", "WING"] : [main];
  const tall = ["KPD", "KPF", "RUC"].includes(main);
  return {
    id: `acad-${slug(clubName)}-${draftYear}-${index}-${hashSeed(`${seed}:${draftYear}:${index}`) % 9973}`,
    name: uniqueName(rand, used),
    positions,
    role: roleFor(positions),
    height: Math.round((tall ? 192 : 176) + rand() * (tall ? 14 : 14)),
    juniorClub: juniorPathway(clubName)[Math.floor(rand() * juniorPathway(clubName).length)],
    draftYear,
    ability: Math.round(potential * (0.55 + 0.1 * (age - 15)) + (rand() - 0.5) * 4),
    attributes: { footballIQ: Math.round(45 + rand() * 25), technical: Math.round(45 + rand() * 25), athleticism: Math.round(45 + rand() * 25), mental: Math.round(45 + rand() * 25) },
    truePotential: potential,
    bias: Math.round((rand() - 0.5) * 14), // the scouts' error before the read sharpens
    monthsIn: 0,
    focus: false,
    trainingCategory: "BALANCED",
    firstTeamSessions: 0,
    bigYear: false,
    path: "NONE",
  };
}

function makeCoach(seed, used, { rating = null, seasons = COACH_CONTRACT_SEASONS } = {}) {
  const rand = random(seed);
  const value = rating ?? Math.round(6 + rand() * 12);
  return {
    id: `coach-${hashSeed(seed) % 99991}`,
    name: uniqueName(rand, used),
    rating: Math.round(value * 5),
    specialty: COACH_SPECIALTIES[Math.floor(rand() * COACH_SPECIALTIES.length)],
    salary: Math.round((60_000 + value * 9_000) / 5_000) * 5_000,
    seasonsLeft: seasons,
  };
}

function makeCoachMarket(seed, used, ratingFloor = 5) {
  return [0, 1, 2].map((index) => makeCoach(`${seed}:market:${index}`, used, { rating: clamp(ratingFloor + Math.round(random(`${seed}:r:${index}`)() * 13), 5, 18) }));
}

function intakeSize(level, rand) { return clamp(2 + level + Math.floor(rand() * 3) - 1, 3, 8); }

// A new academy starts with only 15- and 16-year-olds: nobody is draft ready in
// the first year, and the first draft class arrives the year after.
export function createAcademy({ clubName, seed = clubName, firstDraftYear = 2027, seasonYear = firstDraftYear - 1, administration = null } = {}) {
  const used = new Set();
  const level = 3;
  const coach = makeCoach(`${seed}:coach:${firstDraftYear}`, used, { seasons: 1 + Math.floor(random(`${seed}:seasons`)() * 2) });
  const academy = {
    clubName,
    academyType: clubName === "Tasmania" ? "TASMANIAN" : NORTHERN_ACADEMY_CLUBS.includes(clubName) ? "NORTHERN" : "NGA",
    level,
    emphasis: "BALANCED",
    coach,
    coachMarket: makeCoachMarket(`${seed}:${firstDraftYear}`, used),
    nextDraftYear: firstDraftYear,
    rolledOverYear: seasonYear,
    players: [],
    history: [{ year: seasonYear, text: `${clubName} academy set up, ${coach.name} appointed as coach` }],
  };
  const quality = intakeQuality(academy, academyInfluence(administration));
  [1, 2].forEach((band) => {
    const draftYear = firstDraftYear + band;
    const count = intakeSize(level, random(`${seed}:size:${draftYear}`));
    for (let index = 0; index < count; index += 1) {
      academy.players.push(makePlayer({ clubName, draftYear, age: 17 - band, quality, seed, used, index }));
    }
  });
  return academy;
}

// The scouts' read of a player's ceiling: a range that tightens over time.
export function readCeiling(player, academy, influence = null) {
  const rating = coachScale20(academy.coach);
  // Recruiting facilities and the List Manager sharpen the read (neutral at 65%).
  const scouting = influence ? (influence.scoutingAccuracy - 0.65) * 0.4 : 0;
  const clarity = clamp(0.2 + scouting + academy.level * 0.09 + rating * 0.012 + (player.focus ? 0.2 : 0)
    + Math.min(0.25, player.monthsIn * 0.012) + (academy.emphasis === "SKILLS" ? 0.05 : academy.emphasis === "ATHLETICISM" ? -0.03 : 0), 0.15, 0.93);
  const width = Math.max(2, Math.round(11 * (1 - clarity)) + 1);
  const centre = player.truePotential + player.bias * (1 - clarity);
  const low = Math.round(centre - width / 2);
  const high = low + width;
  return { low, high, centre: (low + high) / 2, label: ceilingLabel((low + high) / 2) };
}

export function pathLabel(player) {
  if (player.path === "DRAFT") return "Draft bound";
  if (player.path === "STATE") return "Below League Standard";
  if (player.bigYear) return "A big year";
  return "No path yet";
}

export function academyView(academy, administration = null) {
  if (!academy) return { bands: [], focusUsed: 0, focusSlots: 0, outlook: null };
  const influence = academyInfluence(administration);
  const quality = intakeQuality(academy, influence);
  const focusUsed = academy.players.filter((player) => player.focus).length;
  const years = [...new Set(academy.players.map((player) => player.draftYear))].sort((a, b) => a - b);
  const bands = years.map((draftYear) => {
    const age = 17 - (draftYear - academy.nextDraftYear);
    const players = academy.players.filter((player) => player.draftYear === draftYear)
      .map((player) => ({ ...player, read: readCeiling(player, academy, influence) }))
      .sort((a, b) => b.read.centre - a.read.centre);
    const projected = players.filter((player) => player.read.centre >= STATE_LEAGUE_CEILING).length;
    return { draftYear, age, players, projected, goingOn: players.filter((player) => player.path === "DRAFT").length };
  });
  return {
    bands,
    focusUsed,
    focusSlots: academySlots(academy.level),
    outlook: { quality, label: intakeLabel(quality), ...influence },
  };
}

// Monthly development, run by the calendar on the last day of each month.
export function advanceAcademyMonth(academy, { date, seed = "academy", administration = null } = {}) {
  if (!academy) return academy;
  const influence = academyInfluence(administration);
  const year = Number(String(date).slice(0, 4)), month = Number(String(date).slice(5, 7));
  const levelMult = 0.85 + 0.075 * (academy.level - 1);
  const coachMult = 0.8 + coachScale20(academy.coach) * 0.025;
  const emphasisMult = academy.emphasis === "BALANCED" ? 0.92 : 1.04;
  const players = academy.players.map((player) => {
    const rand = random(`${seed}:${date}:${player.id}`);
    const yearsToDraft = Math.max(0, (player.draftYear - year) + (11 - month) / 12);
    // Training facilities and development staff speed growth and bring a player
    // closer to his ceiling by draft day.
    const readiness = clamp(0.82 + (influence.developmentMultiplier - 1) * 0.2, 0.78, 0.93);
    const target = player.truePotential * readiness;
    const rate = Math.min(0.12, 0.045 * levelMult * coachMult * influence.developmentMultiplier * emphasisMult * (player.focus ? 1.8 : 1) * (player.firstTeamSessions > 0 ? 1.35 : 1) * (yearsToDraft > 0 ? 1 : 0.2));
    let ability = player.ability + (target - player.ability) * rate + (rand() - 0.45) * 0.6;
    let truePotential = player.truePotential;
    let bigYear = player.bigYear;
    if (!bigYear && player.draftYear > year && rand() < 0.012) { bigYear = true; truePotential += 2 + Math.floor(rand() * 4); ability += 3; }
    const inDraftYear = player.draftYear === academy.nextDraftYear;
    let path = inDraftYear ? player.path : "NONE";
    if (inDraftYear && month >= 5 && truePotential >= DRAFT_BOUND_POTENTIAL) path = "DRAFT";
    if (inDraftYear && month >= 8 && truePotential < STATE_LEAGUE_CEILING) path = "STATE";
    if (player.firstTeamSessions > 0 && rand() < 0.04) ability -= 1;
    const selected = player.focus ? (player.trainingCategory ?? "BALANCED") : "BALANCED";
    const keys = { FOOTBALL_IQ: "footballIQ", TECHNICAL: "technical", ATHLETICISM: "athleticism", MENTAL: "mental" };
    const attributes = { ...(player.attributes ?? { footballIQ: 55, technical: 55, athleticism: 55, mental: 55 }) };
    for (const key of Object.keys(attributes)) {
      const chosen = selected === "BALANCED" || keys[selected] === key;
      const categoryRate = rate * (selected === "BALANCED" ? 0.35 : chosen ? 1.7 : 0.08);
      attributes[key] = clamp(attributes[key] + Math.max(0, (target - attributes[key]) * categoryRate), 25, 99);
    }
    return { ...player, attributes, ability: clamp(ability, 30, 95), truePotential: Math.min(96, truePotential), bigYear, path, monthsIn: player.monthsIn + 1, firstTeamSessions: Math.max(0, Number(player.firstTeamSessions ?? 0) - 1) };
  });
  return { ...academy, players };
}

// Run on 1 January: the draft-year class has been through the draft, so those
// players leave (into the draft, or back to the state league), the rest move up
// a year and a new group of 15-year-olds joins.
export function rolloverAcademy(academy, { year, seed = "academy", administration = null } = {}) {
  if (!academy || Number(academy.rolledOverYear) >= Number(year)) return academy;
  const leaving = academy.players.filter((player) => player.draftYear < year);
  const remaining = academy.players.filter((player) => player.draftYear >= year).map((player) => ({ ...player, bigYear: false, path: "NONE" }));
  const history = [...academy.history];
  const draftYears = [...new Set(leaving.map((player) => player.draftYear))].sort((a, b) => b - a);
  for (const draftYear of draftYears) {
    const group = leaving.filter((player) => player.draftYear === draftYear);
    const into = Math.min(MAX_DRAFTEES_PER_YEAR, group.filter((player) => player.truePotential >= DRAFT_BOUND_POTENTIAL).length);
    history.unshift({ year: draftYear, text: `${into} into the draft, ${group.length - into} back to the state league` });
  }
  const used = new Set([...academy.players.map((player) => player.name), academy.coach?.name].filter(Boolean));
  const intakeYear = Number(year) + 2;
  // A freshly created academy already holds the group that would join this year.
  const alreadyHasGroup = remaining.some((player) => player.draftYear === intakeYear);
  const count = alreadyHasGroup ? 0 : intakeSize(academy.level, random(`${seed}:size:${intakeYear}`));
  const quality = intakeQuality(academy, academyInfluence(administration));
  const intake = Array.from({ length: count }, (_, index) => makePlayer({ clubName: academy.clubName, draftYear: intakeYear, age: 15, quality, seed: `${seed}:${academy.clubName}`, used, index }));
  let coach = academy.coach;
  if (coach && !coach.interim) {
    const seasonsLeft = Number(coach.seasonsLeft) - 1;
    if (seasonsLeft <= 0) {
      history.unshift({ year, text: `${coach.name}'s deal ran out` });
      coach = makeCoach(`${seed}:interim:${year}`, used, { rating: 6, seasons: 1 });
      coach = { ...coach, name: "Club staff (interim)", background: "stand-in cover until a coach is hired", salary: 0, interim: true, seasonsLeft: 0 };
    } else coach = { ...coach, seasonsLeft };
  }
  return {
    ...academy,
    coach,
    coachMarket: makeCoachMarket(`${seed}:${academy.clubName}:${year}`, used),
    nextDraftYear: Number(year),
    rolledOverYear: Number(year),
    players: [...remaining, ...intake],
    history: history.slice(0, 40),
  };
}

// Draft-year academy players as draft prospects tied to the club.
export function academyDraftClass(academy, draftYear) {
  if (!academy?.players?.length) return [];
  return academy.players
    .filter((player) => Number(player.draftYear) === Number(draftYear) && player.truePotential >= DRAFT_BOUND_POTENTIAL)
    .sort((a, b) => b.truePotential - a.truePotential)
    .slice(0, MAX_DRAFTEES_PER_YEAR)
    .map((player) => ({
      id: player.id,
      name: player.name,
      juniorClub: `${academy.clubName} Academy`,
      role: player.role,
      height: player.height,
      positions: player.positions,
      overall: clamp(Math.round(player.ability), 55, 70),
      potential: Math.round(clamp(72 + (player.truePotential - 55) * (22 / 35), 70, 95)),
      connection: { type: "ACADEMY", academyType: academy.academyType, club: academy.clubName },
      fromAcademy: true,
    }));
}

// Swap each academy prospect into the generated class at the slot with the
// closest potential, so the class size and ranking scale are unchanged.
export function mergeAcademyProspects(prospects, academyClass = []) {
  if (!academyClass.length) return prospects;
  const result = prospects.map((prospect) => ({ ...prospect }));
  const taken = new Set();
  for (const academyProspect of academyClass) {
    let bestIndex = -1, bestGap = Infinity;
    result.forEach((prospect, index) => {
      if (taken.has(index) || prospect.connection || prospect.fromAcademy) return;
      const gap = Math.abs(prospect.potential - academyProspect.potential);
      if (gap < bestGap) { bestGap = gap; bestIndex = index; }
    });
    if (bestIndex < 0) continue;
    taken.add(bestIndex);
    result[bestIndex] = { ...result[bestIndex], ...academyProspect, rank: result[bestIndex].rank };
  }
  return result;
}

// Manager actions. Returns { academy, cost } or { error }.
export function applyAcademyAction(academy, action, { cash = 0, year = new Date().getFullYear() } = {}) {
  if (!academy) return { error: "The academy has not been set up yet." };
  switch (action?.type) {
    case "SET_EMPHASIS": {
      if (!EMPHASES[action.emphasis]) return { error: "Unknown emphasis." };
      return { academy: { ...academy, emphasis: action.emphasis }, cost: 0 };
    }
    case "TOGGLE_FOCUS": {
      const player = academy.players.find((item) => item.id === action.playerId);
      if (!player) return { error: "That player is no longer in the academy." };
      const slots = academySlots(academy.level);
      if (!player.focus && academy.players.filter((item) => item.focus).length >= slots) {
        return { error: `All ${slots} focus places are in use. Remove one first${academy.level < ACADEMY_MAX_LEVEL ? " or upgrade the academy" : ""}.` };
      }
      return { academy: { ...academy, players: academy.players.map((item) => item.id === player.id ? { ...item, focus: !item.focus } : item) }, cost: 0 };
    }
    case "SET_PLAYER_PROGRAM": {
      if (!EMPHASES[action.category]) return { error: "Unknown training category." };
      if (!academy.players.some((item) => item.id === action.playerId && item.focus)) return { error: "Prioritise the player before assigning a program." };
      return { academy: { ...academy, players: academy.players.map((item) => item.id === action.playerId ? { ...item, trainingCategory: action.category } : item) }, cost: 0 };
    }
    case "FIRST_TEAM_BLOCK": {
      if (!academy.players.some((item) => item.id === action.playerId && item.focus)) return { error: "Prioritise the player before booking first-team training." };
      return { academy: { ...academy, players: academy.players.map((item) => item.id === action.playerId ? { ...item, firstTeamSessions: 6 } : item) }, cost: 0 };
    }
    case "UPGRADE": {
      const cost = academyUpgradeCost(academy.level);
      if (cost == null) return { error: "The academy is already at the top level." };
      if (cash < cost) return { error: `An upgrade costs $${cost.toLocaleString()}; the club has $${Math.round(cash).toLocaleString()}.` };
      const level = academy.level + 1;
      return { academy: { ...academy, level, history: [{ year, text: `academy upgraded to level ${level}` }, ...academy.history].slice(0, 40) }, cost };
    }
    case "HIRE_COACH": {
      const candidate = (academy.coachMarket ?? []).find((item) => item.id === action.coachId);
      if (!candidate) return { error: "That coach is no longer available." };
      const cost = candidate.salary * candidate.seasonsLeft;
      if (cash < cost) return { error: `${candidate.seasonsLeft} seasons of ${candidate.name} costs $${cost.toLocaleString()}; the club has $${Math.round(cash).toLocaleString()}.` };
      return {
        academy: {
          ...academy,
          coach: { ...candidate },
          coachMarket: academy.coachMarket.filter((item) => item.id !== candidate.id),
          history: [{ year, text: `${candidate.name} hired as academy coach` }, ...academy.history].slice(0, 40),
        },
        cost,
      };
    }
    default:
      return { error: "Unknown academy action." };
  }
}
