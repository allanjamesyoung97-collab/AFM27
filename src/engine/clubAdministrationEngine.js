import { calculateMarketValue } from "./contractValueEngine.js";
import { actualContractExtras, projectedContractExtras } from "./contractComponents.js";
import { BASE_SALARY_CAP, getEconomyFactor, getMinimumSalary, getMinimumSpend, getSalaryCap, getCapAllowance, getEffectiveSalaryCap, getActiveCapBank, settleSalaryCapSeason, getConfiguredSalaryCap, getConfiguredMinimumSpend, getConfiguredCapAllowance, getConfiguredEffectiveSalaryCap, isSalaryCapEnforced } from "./salaryCap.js";
import { clubProfiles } from "../data/clubProfiles.js";
import { getDifficultySettings } from "./difficultyEngine.js";
import { advanceStaffContracts } from "./staffContractEngine.js";

// The cap grows 5% a season (see salaryCap.js). Use getSalaryCap(seasonYear) and
// getMinimumSpend(seasonYear) for anything tied to a season; these two constants are
// the first season's values and are kept for existing imports.
export { getEconomyFactor, getMinimumSpend, getSalaryCap };
export const AFL_SALARY_CAP = BASE_SALARY_CAP;
export const AFL_MINIMUM_SPEND = getMinimumSpend();
export const HOME_AND_AWAY_ROUNDS = 23;
export const MAX_FACILITY_LEVEL = 5;
export const FOOTBALL_DEPARTMENT_BASE_SPEND = 3_700_000;

// A negative season-end balance carries into the next season (with a board
// consequence) instead of being reset to $0.
export const CARRY_CASH_DEBT = true;

// AFL distribution: the competition tops up clubs whose own member-driven income is
// small, the way broadcast money does in the real league. It is based on the membership
// base at the standard ticket price, so neither ticket pricing nor sponsor choices can
// be used to inflate it.
export const AFL_DISTRIBUTION_FLOOR_INCOME = 33_000_000;
export const AFL_DISTRIBUTION_SHARE = 0.85;
const MEMBERSHIP_FEE = 220;
const STANDARD_TICKET_PRICE = 48;
const HOME_MATCHES = 11;
const GATE_ATTENDANCE_RATE = 0.3;

// 2025 club membership totals published by the AFL. Used as career starting
// points, then grown or reduced by in-game performance and supporter sentiment.
export const AFL_MEMBERSHIP_BASELINES = {
 Collingwood: 112_491, "West Coast": 107_079, Carlton: 100_743,
 Richmond: 92_531, Geelong: 92_379, Hawthorn: 87_204, Essendon: 85_568,
 Adelaide: 81_067, Sydney: 76_674, Brisbane: 75_115, "Port Adelaide": 72_656,
 Fremantle: 66_179, "Western Bulldogs": 65_584, "St Kilda": 65_509,
 Melbourne: 58_563, "North Melbourne": 56_283, GWS: 37_705, "Gold Coast": 30_107,
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function calculateAflDistribution(memberships = 0, seasonYear) {
 const factor = getEconomyFactor(seasonYear);
 const memberIncomeAtStandardPrice = Number(memberships) * (MEMBERSHIP_FEE + GATE_ATTENDANCE_RATE * STANDARD_TICKET_PRICE * HOME_MATCHES) * factor;
 const shortfall = Math.max(0, AFL_DISTRIBUTION_FLOOR_INCOME * factor - memberIncomeAtStandardPrice);
 return Math.round((shortfall * AFL_DISTRIBUTION_SHARE) / 10_000) * 10_000;
}

// Higher prices cost attendance: 1.0 at the standard price, falling about 0.8 for every
// doubling and capped by stadium capacity when prices are cut. Gate revenue peaks a
// little above the standard price, so the maximum price is no longer the best price.
export function calculateTicketAttendanceFactor(ticketPrice = STANDARD_TICKET_PRICE) {
 return clamp(1 - 0.8 * (Number(ticketPrice) / STANDARD_TICKET_PRICE - 1), 0.1, 1.15);
}

// Deterministic shuffle so offers differ by club and year but reload identically.
function seededOrder(length, seed) {
 const order = Array.from({ length }, (_, index) => index);
 let state = (Math.abs(Math.round(seed)) % 2147483646) + 1;
 for (let i = length - 1; i > 0; i -= 1) {
 state = (state * 48271) % 2147483647;
 const j = state % (i + 1);
 [order[i], order[j]] = [order[j], order[i]];
 }
 return order;
}

const STAFF_FIRST_NAMES = ["Aaron", "Adam", "Adrian", "Alan", "Alex", "Andrew", "Angus", "Anthony", "Ashley", "Barry", "Ben", "Blake", "Brad", "Bradley", "Brendan", "Brett", "Brian", "Callum", "Cameron", "Campbell", "Chad", "Chris", "Clint", "Colin", "Corey", "Craig", "Damien", "Dan", "Daniel", "Darcy", "Darren", "David", "Dean", "Declan", "Dennis", "Derek", "Dylan", "Ed", "Elliot", "Eric", "Evan", "Finn", "Frank", "Gareth", "Gary", "Glenn", "Gordon", "Graeme", "Grant", "Greg", "Hamish", "Harry", "Hayden", "Henry", "Hugh", "Ian", "Jack", "Jake", "James", "Jamie", "Jason", "Jeff", "Jeremy", "Jesse", "Joel", "John", "Jonathan", "Jordan", "Josh", "Julian", "Justin", "Keith", "Kevin", "Kieran", "Kyle", "Lachlan", "Lance", "Lee", "Leigh", "Leo", "Liam", "Luke", "Mal", "Marcus", "Mark", "Martin", "Matt", "Max", "Michael", "Mitch", "Murray", "Nathan", "Neil", "Nick", "Noel", "Oliver", "Owen", "Patrick", "Paul", "Peter", "Phil", "Quinn", "Ray", "Reece", "Rhys", "Richard", "Rob", "Rod", "Ron", "Ross", "Rowan", "Russell", "Ryan", "Sam", "Scott", "Sean", "Seth", "Shane", "Simon", "Stephen", "Steve", "Stuart", "Terry", "Tim", "Todd", "Tom", "Tony", "Trent", "Trevor", "Troy", "Vince", "Wade", "Warren", "Will", "Zac"];
const STAFF_LAST_NAMES = ["Abbott", "Adams", "Allen", "Anderson", "Armstrong", "Ashby", "Atkins", "Bailey", "Baker", "Barnes", "Barrett", "Bates", "Baxter", "Beckett", "Bennett", "Black", "Booth", "Bowman", "Boyd", "Bradshaw", "Brennan", "Briggs", "Brooks", "Brown", "Bryant", "Burke", "Burns", "Butler", "Byrne", "Cahill", "Cameron", "Campbell", "Carey", "Carr", "Carter", "Chambers", "Chapman", "Clark", "Clarke", "Coleman", "Collins", "Connolly", "Cook", "Cooper", "Cox", "Craig", "Crawford", "Cross", "Cummins", "Cunningham", "Curtis", "Daly", "Davey", "Davidson", "Davies", "Dawson", "Day", "Dean", "Dixon", "Dodds", "Donnelly", "Douglas", "Doyle", "Duffy", "Duncan", "Dunn", "Edwards", "Elliott", "Ellis", "Evans", "Farrell", "Ferguson", "Finch", "Fisher", "Fitzgerald", "Fleming", "Fletcher", "Flynn", "Ford", "Foster", "Fowler", "Fox", "Francis", "Franklin", "Fraser", "Freeman", "Gallagher", "Gardner", "Garrett", "Gibson", "Gilbert", "Gill", "Glover", "Goodwin", "Gordon", "Graham", "Grant", "Gray", "Green", "Griffin", "Griffiths", "Hale", "Hall", "Hamilton", "Hammond", "Hansen", "Harding", "Hargreaves", "Harper", "Harris", "Harrison", "Hart", "Hartley", "Harvey", "Hayes", "Henderson", "Hennessy", "Hicks", "Hill", "Hogan", "Holland", "Holmes", "Hooper", "Hopkins", "Howard", "Howell", "Hudson", "Hughes", "Hunt", "Hunter", "Hutchinson", "Irwin", "Jackson", "Jenkins", "Jennings", "Johns", "Johnson", "Johnston", "Jones", "Jordan", "Kane", "Keane", "Kearney", "Kelly", "Kennedy", "Kerr", "King", "Knight", "Lambert", "Lane", "Lawrence", "Lawson", "Leach", "Lee", "Lewis", "Lindsay", "Lloyd", "Long", "Lowe", "Lucas", "Lynch", "Macdonald", "Mackay", "Mahoney", "Marshall", "Martin", "Mason", "Matthews", "Maxwell", "McBride", "McCarthy", "McDonald", "McGrath", "McIntosh", "McKenzie", "McLean", "McMahon", "Meyer", "Miller", "Mills", "Mitchell", "Monaghan", "Moore", "Moran", "Morgan", "Morris", "Morrison", "Morton", "Moss", "Murphy", "Murray", "Nash", "Nelson", "Newman", "Nicholls", "Nolan", "Norris", "Nunn", "O'Brien", "O'Connor", "O'Donnell", "O'Neill", "Oliver", "Osborne", "Owens", "Palmer", "Parker", "Parsons", "Paterson", "Patterson", "Payne", "Pearce", "Pearson", "Perry", "Phillips", "Pike", "Pollard", "Porter", "Powell", "Pratt", "Price", "Quinn", "Ramsay", "Reed", "Reid", "Reynolds", "Rhodes", "Richards", "Richardson", "Riley", "Roberts", "Robertson", "Robinson", "Rogers", "Ross", "Rowe", "Russell", "Ryan", "Sanders", "Saunders", "Scott", "Sharp", "Shaw", "Simmons", "Simpson", "Sinclair", "Slater", "Smith", "Spencer", "Stanley", "Stevens", "Stewart", "Stone", "Sullivan", "Sutton", "Swan", "Sweeney", "Tait", "Taylor", "Thomas", "Thompson", "Thornton", "Todd", "Tucker", "Turner", "Tyler", "Vaughan", "Wade", "Walker", "Wallace", "Walsh", "Ward", "Warren", "Watkins", "Watson", "Watts", "Webb", "Webster", "Wells", "West", "Wheeler", "Whitaker", "White", "Wilkinson", "Williams", "Willis", "Wilson", "Wood", "Woods", "Wright", "Yates", "Young"];

function staffNameHash(text) {
 let h = 2166136261;
 for (const char of String(text)) { h ^= char.charCodeAt(0); h = Math.imul(h, 16777619); }
 h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
 return h >>> 0;
}

/** A deterministic full name for a seed. Roughly 135 x 292 combinations, so repeats are rare; `attempt` re-rolls. */
export function generateStaffName(seedText, attempt = 0) {
 const first = STAFF_FIRST_NAMES[staffNameHash(`${seedText}|first|${attempt}`) % STAFF_FIRST_NAMES.length];
 const last = STAFF_LAST_NAMES[staffNameHash(`${seedText}|last|${attempt}`) % STAFF_LAST_NAMES.length];
 return `${first} ${last}`;
}

/**
 * Takes groups of staff in priority order (e.g. your staff, rival staff, market) and returns the same groups
 * with any repeated full name re-rolled, so nobody in the league shares a name. The earlier group keeps its name.
 * Pure and deterministic: the same input always gives the same names.
 */
export function uniqueStaffNames(groups) {
 const used = new Set();
 const key = (name) => String(name ?? "").trim().toLowerCase();
 return groups.map((group) => (group ?? []).map((person) => {
 let name = person.name;
 let attempt = 0;
 while (used.has(key(name)) && attempt < 40) {
 attempt += 1;
 name = generateStaffName(`${person.id}`, attempt);
 }
 used.add(key(name));
 return name === person.name ? person : { ...person, name };
 }));
}

const staffRoles = [
 { role: "Head of Football Strategy and Coaching", salaryBase: 850_000, names: ["Mick Hargreaves", "Daniel Foster", "Chris Nolan", "Liam O'Keefe", "Aaron Bell", "Scott Brennan", "Sam Whitaker", "Ben Collins", "Jordan Price", "Matt Ellis", "Luke Hart", "Tom Reid"] },
 { role: "Assistant Coach (Midfield)", salaryBase: 360_000, names: ["Adam Fraser", "Nick Wallace", "Chris Turner", "James Doyle", "Ryan Cole", "Peter Grant"] },
 { role: "Assistant Coach (Backs)", salaryBase: 340_000, names: ["Michael Webb", "Alex Murphy", "Daniel King", "Liam Brooks", "Sam Kelly", "Ben Martin"] },
 { role: "Assistant Coach (Forwards)", salaryBase: 340_000, names: ["Jack Miller", "Nathan Clarke", "Luke Bennett", "Tom Walsh", "Cameron Lee", "Patrick Hall"] },
 { role: "Ruck Coach", salaryBase: 300_000, names: ["David McKay", "Andrew Reid", "Mark Sullivan", "Jordan Bell", "Matthew Cross", "Ryan James"] },
 { role: "VFL Senior Coach & Development Coach", salaryBase: 420_000, names: ["Lachlan Moore", "Ben Foster", "Daniel Walsh", "Scott Murray", "Chris Ward", "Michael Fraser"] },
 { role: "Development Coach", salaryBase: 260_000, names: ["Tom Kavanagh", "Luke O'Brien", "James Porter", "Alex Bennett", "Matt Doyle", "Sam Clarke"] },
 { role: "Head of Development", salaryBase: 480_000, names: ["James Kavanagh", "Luke Murray", "Ben Wallace", "Matt Sullivan", "Tom Fraser", "Nick Hall"] },
 { role: "Head of Performance", salaryBase: 440_000, names: ["Sam Mitchell", "Adam Reid", "Peter Lawson", "Nathan Cole", "Elliot James", "Ryan Webb"] },
 { role: "List Manager", salaryBase: 420_000, names: ["Jordan Miles", "Patrick Doyle", "Cameron Price", "Alex Ward", "Ben Carmichael", "David Ryan"] },
];

/** League-wide staff rating curve: quantile (0-1) to rating. Median ~66, elite (88+) is rare, ceiling 95. */
const STAFF_RATING_CURVE = [[0, 55], [0.5, 66], [0.8, 73], [0.93, 80], [0.985, 88], [1, 95]];
export function staffRatingForQuantile(quantile) {
 const q = Math.max(0, Math.min(1, Number(quantile) || 0));
 for (let i = 1; i < STAFF_RATING_CURVE.length; i += 1) {
 const [q1, r1] = STAFF_RATING_CURVE[i];
 if (q <= q1) {
 const [q0, r0] = STAFF_RATING_CURVE[i - 1];
 return Math.round(r0 + ((q - q0) / (q1 - q0)) * (r1 - r0));
 }
 }
 return 95;
}

function hashUnit(text) {
 let h = 2166136261;
 for (const char of String(text)) { h ^= char.charCodeAt(0); h = Math.imul(h, 16777619); }
 h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
 return ((h >>> 0) % 1_000_003) / 1_000_003;
}

/**
 * Gives an AI club's staff a spread of ratings (55-95, few elites per role) instead of the flat
 * defaults, and scales their salaries to match. Runs once per club; the flag stops repeat runs.
 */
export function applyLeagueStaffRatings(administration, clubName, careerSeed = clubName) {
 if (!administration || administration.staffRatingsSeeded) return administration;
 const staff = (administration.staff ?? []).map((person) => {
 const previousRating = Number(person.rating);
 if (!Number.isFinite(previousRating)) return person;
 const rating = staffRatingForQuantile(hashUnit(`${careerSeed}|${clubName}|${person.id}|staff-rating`));
 const salary = Math.max(150_000, Math.round((Number(person.salary ?? 0) * rating / Math.max(1, previousRating)) / 10_000) * 10_000);
 return { ...person, rating, salary };
 });
 return { ...administration, staff, staffRatingsSeeded: true };
}

const STARTING_STAFF_BASE_SALARIES = {
 "football-strategy-coach": 850_000, "head-development": 450_000, "head-performance": 420_000,
 "list-manager": 400_000, "assistant-midfield": 350_000, "assistant-backs": 330_000,
 "assistant-forwards": 330_000, "ruck-coach": 290_000, "vfl-development-coach": 410_000,
 "development-coach-1": 250_000, "development-coach-2": 250_000, "development-coach-3": 250_000,
};

/** Give each career distinct starting quality and price untouched opening contracts accordingly. */
export function seedManagerStaffRatings(administration, clubName, careerSeed = clubName) {
 if (!administration || administration.managerStaffSalariesSeeded) return administration;
 const seed = administration.managerStaffSeed ?? careerSeed;
 // A club inherited through a coaching move already has rating-based AI salaries.
 if (administration.staffRatingsSeeded && !administration.managerStaffRatingsSeeded) {
 return { ...administration, managerStaffSeed: seed, managerStaffRatingsSeeded: true, managerStaffSalariesSeeded: true };
 }
 const staff = (administration.staff ?? []).map((person) => {
 const baseSalary = STARTING_STAFF_BASE_SALARIES[String(person.id)];
 if (!baseSalary) return person; // Preserve staff hired from the market.
 const rating = administration.managerStaffRatingsSeeded
 ? Number(person.rating ?? 65)
 : staffRatingForQuantile(hashUnit(`${seed}|${clubName}|${person.id}|manager-staff-rating`));
 // Existing saves may contain renewed opening staff; only reprice an untouched base contract.
 const salary = Number(person.salary) === baseSalary
 ? Math.max(150_000, Math.round(baseSalary * clamp(1 + (rating - 68) * 0.016, 0.72, 1.45) / 5_000) * 5_000)
 : person.salary;
 return { ...person, rating, salary };
 });
 return { ...administration, staff, managerStaffSeed: seed, managerStaffRatingsSeeded: true, managerStaffSalariesSeeded: true };
}

const STAFF_REFRESH_DAYS = 28;

export const STAFF_ROLE_ATTRIBUTE_IMPACTS = {
 "Head of Football Strategy and Coaching": ["vision", "decisionMaking", "positioning", "composure", "leadership", "creativity", "gameAwareness"],
 "Assistant Coach (Midfield)": ["vision", "decisionMaking", "groundBallGet", "endurance", "teamwork", "tackling"],
 "Assistant Coach (Backs)": ["marking", "tackling", "spoiling", "positioning", "gameAwareness", "discipline"],
 "Assistant Coach (Forwards)": ["goalSense", "marking", "composure", "creativity", "decisionMaking"],
 "Ruck Coach": ["ruckCraft", "verticalLeap", "strength", "groundBallGet"],
 "VFL Senior Coach & Development Coach": ["workRate", "teamwork", "gameAwareness", "professionalism", "determination", "decisionMaking"],
 "Development Coach": ["kicking", "handball", "marking", "goalSense", "tackling", "spoiling", "vision", "decisionMaking", "positioning", "groundBallGet", "gameAwareness", "professionalism", "determination", "workRate", "discipline"],
 "Head of Development": ["professionalism", "determination", "workRate", "teamwork", "discipline", "gameAwareness"],
 "Head of Performance": ["speed", "acceleration", "agility", "endurance", "strength", "verticalLeap", "durability"],
};

const STAFF_ATTRIBUTE_LABELS = {
 kicking: "Kicking", handball: "Handball", marking: "Marking", goalSense: "Goal Sense", tackling: "Tackling", spoiling: "Spoiling",
 speed: "Speed", acceleration: "Acceleration", agility: "Agility", endurance: "Endurance", strength: "Strength", verticalLeap: "Vertical Leap", durability: "Durability",
 vision: "Vision", decisionMaking: "Decision Making", positioning: "Positioning", composure: "Composure", leadership: "Leadership", creativity: "Creativity", gameAwareness: "Game Awareness",
 workRate: "Work Rate", professionalism: "Professionalism", determination: "Determination", teamwork: "Teamwork", competitiveness: "Competitiveness", discipline: "Discipline", ruckCraft: "Ruck Craft", groundBallGet: "Ground Ball Get",
};

export function getStaffRoleImpactLabel(role) {
 const attributes = STAFF_ROLE_ATTRIBUTE_IMPACTS[role] ?? [];
 if (attributes.length) {
 const systems = role === "Head of Football Strategy and Coaching" ? ["Overall player growth", "Coach relationships"]
 : ["Head of Development", "VFL Senior Coach & Development Coach", "Development Coach"].includes(role) ? ["Overall player growth"]
 : role === "Head of Performance" ? ["Fitness and injury recovery"] : [];
 return [...systems, ...attributes.map((attribute) => STAFF_ATTRIBUTE_LABELS[attribute] ?? attribute)].join(" · ");
 }
 return role === "List Manager" ? "Player scouting, role assessment and delegated contract extensions; higher rating improves the terms they can secure" : "No direct player-attribute focus";
}

function createStaffDisplayName(person, clubName = "") {
 const genericName = !person.name || /coach|specialist|strategist|manager|director|program|performance/i.test(person.name);
 if (!genericName) return person.name;
 return generateStaffName(`${clubName}-${person.role}-${person.id}`);
}

function staffMarketLimit(role) {
 return role === "Development Coach" ? 4 : 2;
}

/** Keep old saves within current market limits and fill any missing role options. */
export function normalizeStaffPool(pool = [], clubName = "", refreshDate = "2027-01-01", fillMissing = true, excludedIds = []) {
 const generated = generateStaffPool(clubName, refreshDate);
 const normalized = [];
 const counts = new Map();
 for (const raw of pool ?? []) {
 const person = raw.role === "Senior Coach"
 ? { ...raw, role: "Head of Football Strategy and Coaching" }
 : raw.role === "Development Coach (3)" ? { ...raw, role: "Development Coach" } : raw;
 if (!staffRoles.some((entry) => entry.role === person.role)) continue;
 const count = counts.get(person.role) ?? 0;
 if (count >= staffMarketLimit(person.role) && person.marketOrigin !== 'released') continue;
 normalized.push({ ...person, name: createStaffDisplayName(person, clubName) });
 if (person.marketOrigin !== 'released') counts.set(person.role, count + 1);
 }
 if (fillMissing) for (const candidate of generated) {
 const count = counts.get(candidate.role) ?? 0;
 if (count >= staffMarketLimit(candidate.role)) continue;
 if (excludedIds.includes(candidate.id)) continue;
 if (normalized.some((person) => person.id === candidate.id)) continue;
 normalized.push(candidate);
 counts.set(candidate.role, count + 1);
 }
 return normalized;
}

/** Adds newly introduced staff positions to existing saves while preserving hired staff. */
export function upgradeStaffRoster(existing = [], defaults = [], clubName = "") {
 const roster = existing.map((raw) => {
 const person = raw.role === "Senior Coach"
 ? { ...raw, role: "Head of Football Strategy and Coaching" }
 : raw.role === "Development Coach (3)"
 ? { ...raw, role: "Development Coach" }
 : raw;
 return { ...person, name: createStaffDisplayName(person, clubName) };
 });
 for (const person of defaults) {
 const roleMembers = roster.filter((member) => member.role === person.role);
 if (person.role === "Development Coach" || person.role === "Development Coach (3)" ? roleMembers.length < 3 : roleMembers.length === 0) {
 roster.push(person);
 }
 }
 return roster;
}

function generateStaffPool(clubName, refreshDate) {
 const clubSeed = [...String(clubName ?? "").toLowerCase()].reduce((sum, char) => sum + char.charCodeAt(0), 0);
 const dateSeed = Number(String(refreshDate).replace(/\D/g, "").slice(0, 8)) || 20270101;
 const seed = dateSeed + clubSeed;
 let state = (seed % 2147483646) + 1;
 const random = (max) => {
 state = (state * 48271) % 2147483647;
 return state % max;
 };

 return staffRoles.flatMap(({ role, salaryBase }, roleIndex) =>
 Array.from({ length: role === "Development Coach" ? 4 : 2 }, (_, candidateIndex) => {
 // Skewed so elite free agents are rare; the same curve spreads ratings across rival clubs.
 const rating = staffRatingForQuantile(Math.pow(random(10_000) / 10_000, 1.5));
 const salary = Math.round((salaryBase * rating / 70) / 10_000) * 10_000;
 const id = `staff-market-${dateSeed}-${roleIndex}-${candidateIndex}-${clubSeed}`;
 return {
 id,
 role,
 name: generateStaffName(id),
 rating,
 salary,
 };
 }),
 );
}

/** Refresh the available staff market every 28 in-game days; the same date is deterministic per club/save. */
export function refreshAvailableStaffPool(administrationState, clubName, currentDate) {
 if (!administrationState || !currentDate) return administrationState;
 const now = new Date(currentDate);
 if (Number.isNaN(now.getTime())) return administrationState;
 now.setHours(0, 0, 0, 0);

 const lastRefreshed = administrationState.staffPoolLastRefreshedAt
 ? new Date(administrationState.staffPoolLastRefreshedAt)
 : new Date(`${Number(administrationState.seasonYear ?? 2027) - 1}-10-01T00:00:00`);
 if (Number.isNaN(lastRefreshed.getTime())) return administrationState;
 lastRefreshed.setHours(0, 0, 0, 0);
 const daysElapsed = Math.floor((now.getTime() - lastRefreshed.getTime()) / 86_400_000);
 if (daysElapsed < STAFF_REFRESH_DAYS) return administrationState;

 const refreshCount = Math.floor(daysElapsed / STAFF_REFRESH_DAYS);
 const refreshedAt = new Date(lastRefreshed.getTime() + refreshCount * STAFF_REFRESH_DAYS * 86_400_000);
 const refreshDate = refreshedAt.toISOString().slice(0, 10);
 return {
 ...administrationState,
 staffPool: [...(administrationState.staffPool ?? []).filter((person) => person.marketOrigin === 'released'), ...generateStaffPool(clubName, refreshDate)],
 staffPoolLastRefreshedAt: refreshDate,
 };
}

/** Check the salary cap while allowing a temporary dip below minimum spend. */
export function checkPayrollChange({ playerPayments = 0, currentSalary = 0, newSalary = 0, seasonYear, administrationState = {} } = {}) {
 const delta = Number(newSalary) - Number(currentSalary);
 const projected = Number(playerPayments) + delta;
 const capEnforced = isSalaryCapEnforced(administrationState);
 const salaryCap = getConfiguredEffectiveSalaryCap(seasonYear, administrationState.salaryCapBank, administrationState);
 const minimumSpend = getConfiguredMinimumSpend(seasonYear, administrationState);
 return {
 ok: !capEnforced || projected <= salaryCap,
 projected,
 delta,
 salaryCap,
 minimumSpend,
 overCap: capEnforced && projected > salaryCap,
 belowMinimum: capEnforced && projected < minimumSpend,
 capEnforced,
 };
}

export function settleClubSalaryCap(administrationState = {}, seasonYear, playerPayments = 0) {
 if (Number(administrationState.lastCapSettledSeason) >= Number(seasonYear)) return administrationState;
 if (!isSalaryCapEnforced(administrationState)) return {
 ...administrationState,
 lastCapSettledSeason: Number(seasonYear),
 lastCapSettlement: { seasonYear: Number(seasonYear), spend: playerPayments, shortfall: 0, banked: 0, breach: 0 },
 };
 const result = settleSalaryCapSeason({
 seasonYear,
 playerPayments,
 bank: administrationState.salaryCapBank,
 administration: administrationState,
 });
 // Existing saves can carry an over-cap roster. Keep the breach visible and do
 // not manufacture an allowance; the next list decisions must correct it.
 return {
 ...administrationState,
 salaryCapBank: result.bank,
 lastCapSettledSeason: Number(seasonYear),
 lastCapSettlement: { seasonYear: Number(seasonYear), spend: result.spend, shortfall: result.shortfall, banked: result.bankedThisSeason ?? 0, breach: result.ok ? 0 : Math.max(0, result.spend - result.cap - result.allowance) },
 cashBalance: Number(administrationState.cashBalance ?? 0) - result.shortfall,
 };
}

const sponsorCatalog = [
 { id: "global-auto", name: "Global car brand", base: 3_800_000, type: "prestige", effect: "Premium annual partnership; improves club reputation.", reputation: 3 },
 { id: "international-bank", name: "International bank", base: 3_500_000, type: "standard", effect: "Stable multi-year financial partner." },
 { id: "mining-company", name: "Mining company", base: 4_600_000, type: "controversial", effect: "High-value deal; slower membership growth and lower supporter sentiment.", growth: -0.025, sentiment: -7 },
 { id: "gambling-company", name: "Gambling company", base: 4_800_000, type: "controversial", effect: "Highest-value deal; slower membership growth and lower supporter sentiment.", growth: -0.035, sentiment: -10 },
 { id: "pharmaceutical-company", name: "Pharmaceutical company", base: 3_300_000, type: "standard", effect: "Reliable national partnership." },
 { id: "technology-company", name: "Technology company", base: 3_700_000, type: "prestige", effect: "Innovation partnership; improves club reputation.", reputation: 2 },
 { id: "retail-chain", name: "Retail chain", base: 3_100_000, type: "family", effect: "Family-friendly brand; supports membership growth.", growth: 0.04, sentiment: 2 },
 { id: "airline", name: "Airline", base: 3_600_000, type: "prestige", effect: "High-profile travel partner; improves club reputation.", reputation: 2 },
 { id: "telecommunications-company", name: "Telecommunications company", base: 3_400_000, type: "community", effect: "Community connectivity program; improves supporter satisfaction.", sentiment: 6 },
 { id: "energy-company", name: "Energy company", base: 3_300_000, type: "community", effect: "Local community investment and supporter programs.", sentiment: 4 },
];

function clubQuality(club, roster = []) {
 const averageOverall = roster.length
 ? roster.reduce((sum, player) => sum + Number(player.overall ?? 65), 0) / roster.length
 : 65;
 const financialHealth = Number(clubProfileFor(club).financialHealth ?? 70);
 return clamp(
 0.78 + (financialHealth - 60) * 0.001 + (averageOverall - 65) * 0.006,
 0.75,
 1.2,
 );
}

// Stable pseudo-random number in [0, 1) so generated contracts are the same every time.
function unitFromKey(key) {
 let hash = 2166136261;
 const text = String(key);
 for (let i = 0; i < text.length; i += 1) {
 hash ^= text.charCodeAt(i);
 hash = Math.imul(hash, 16777619);
 }
 return (hash >>> 0) / 4294967296;
}

// Splits `target` across weights, never paying anyone below `minimum`.
function distributePayroll(weights, target, minimum) {
 const amounts = weights.map(() => null);
 let free = weights.map((_, index) => index);
 let budget = target;
 for (let pass = 0; pass < 8 && free.length; pass += 1) {
 const totalWeight = free.reduce((sum, index) => sum + weights[index], 0) || 1;
 const below = free.filter((index) => (budget * weights[index]) / totalWeight < minimum);
 if (!below.length) {
 free.forEach((index) => { amounts[index] = (budget * weights[index]) / totalWeight; });
 free = [];
 break;
 }
 below.forEach((index) => { amounts[index] = minimum; budget -= minimum; });
 free = free.filter((index) => !below.includes(index));
 }
 free.forEach((index) => { amounts[index] = minimum; });
 return amounts;
}

// Bumped when the salary scale changes. Saves older than this hold opening contracts that
// were generated at about half of today's market values (see rebaseGeneratedContracts).
export const SALARY_SCALE_VERSION = 2;

// Brings contracts from an older save onto the current salary scale. Only opening contracts
// the manager never touched are rebased: anything negotiated, re-signed or settled in free
// agency keeps its salary. Terms, mood and negotiation history are kept; only the salary
// changes (and a structured deal's schedule is cleared, since there is none on such records).
export function rebaseGeneratedContracts(saved = {}, generated = {}) {
 const rebased = {};
 Object.entries(saved).forEach(([key, record]) => {
 const untouched = record?.generatedFromOverall
 && record.salaryScaleVersion === undefined
 && record.signedSeason === undefined
 && record.expiryResolvedSeason === undefined
 && !record.yearlySalaries;
 if (untouched && generated[key]) {
 rebased[key] = { ...record, salary: generated[key].salary, salaryScaleVersion: SALARY_SCALE_VERSION };
 } else {
 rebased[key] = record;
 }
 });
 return rebased;
}

// A club's opening contracts: payroll sits just under the cap (95-99.5% of it) and each
// player is paid in proportion to his market value, give or take 8%, so players are
// paid close to what they are worth.
export function createInitialPlayerContracts(roster = [], club = {}, seasonYear) {
 const averageOverall = roster.length ? roster.reduce((sum, player) => sum + Number(player.overall ?? 65), 0) / roster.length : 65;
 const spendRatio = clamp(0.95 + Math.max(0, averageOverall - 60) * 0.0015, 0.95, 0.995);
 const payrollTarget = Math.round(getSalaryCap(seasonYear) * spendRatio);
 const minimum = getMinimumSalary(seasonYear);
 const weights = roster.map((player) => calculateMarketValue(player, { seasonYear }).marketValue * (0.92 + 0.16 * unitFromKey(`${player.id}:salary`)));
 const amounts = distributePayroll(weights, payrollTarget, minimum);
 const contracts = {};

 roster.forEach((player, index) => {
 contracts[String(player.id)] = {
 salary: Math.round(amounts[index] / 1000) * 1000,
 yearsRemaining: player.contract?.yearsRemaining ?? 2,
 generatedFromOverall: true,
 salaryScaleVersion: SALARY_SCALE_VERSION,
 };
 });

 // Rounding drift goes on the best-paid player.
 const difference = payrollTarget - Object.values(contracts).reduce((sum, contract) => sum + contract.salary, 0);
 if (roster.length && difference) {
 const top = roster.reduce((best, player, index) => (amounts[index] > amounts[best] ? index : best), 0);
 contracts[String(roster[top].id)].salary += difference;
 }
 return contracts;
}

export function createInitialLeaguePlayerContracts(players = [], clubs = [], seasonYear) {
 return clubs.reduce((contracts, club) => {
 const roster = players.filter((player) => player.club === club.name);
 return { ...contracts, ...createInitialPlayerContracts(roster, club, seasonYear) };
 }, {});
}

function getOfferQualityMultiplier(club, roster, context = {}) {
 const finances = Number(context.cashBalance ?? 2_000_000) / 2_000_000;
 const profile = clubProfileFor(club);
 const reputation = Number(context.reputation ?? profile.footballPrestige ?? 70) / 70;
 const recentSuccess = Number(context.recentSuccess ?? 50) / 100;
 const rosterOverall = roster.length ? roster.reduce((sum, player) => sum + Number(player.overall ?? 65), 0) / roster.length : 65;
 const premiershipWindow = Number(context.premiershipWindow ?? rosterOverall) / 100;
 const membership = Number(context.memberships ?? AFL_MEMBERSHIP_BASELINES[club?.name] ?? 60_000) / 70_000;
 return clamp(
 0.42 + clamp(finances, 0.4, 2) * 0.05 + clamp(reputation, 0.5, 1.5) * 0.20 + recentSuccess * 0.08 + premiershipWindow * 0.05 + clamp(membership, 0.35, 1.7) * 0.22 + clubQuality(club, roster) * 0.08,
 0.65,
 1.45,
 );
}

// ---------------------------------------------------------------------------
// Sponsorship packages
//
// Every offer is built from three parts: an up-front payment made on signing, a
// guaranteed annual fee, and (for some deals) incentives paid at the end of each season
// for on-field and club success. Sponsors differ in how they package a deal as well as
// how much they pay, so the best offer depends on how confident you are in your club.
// ---------------------------------------------------------------------------
export const SPONSOR_PACKAGES = {
 GUARANTEED: { label: "Guaranteed", blurb: "Fixed annual payments with no conditions." },
 FRONT_LOADED: { label: "Up-front payment", blurb: "A large payment on signing, then a lower annual fee." },
 INCENTIVE: { label: "Performance-linked", blurb: "A lower guaranteed fee, with bonuses for on-field and club success." },
 COMBO: { label: "Up-front + performance", blurb: "A signing payment and annual fee, plus success bonuses." },
};

// How each kind of sponsor likes to structure a deal, and what it is willing to pay bonuses for.
const SPONSOR_STYLES = {
 prestige: { packages: { GUARANTEED: 1, FRONT_LOADED: 0.6, INCENTIVE: 2, COMBO: 2 }, incentives: ["finals", "ladder", "wins"] },
 standard: { packages: { GUARANTEED: 2, FRONT_LOADED: 1, INCENTIVE: 1, COMBO: 1.5 }, incentives: ["ladder", "wins", "membership"] },
 controversial: { packages: { GUARANTEED: 1, FRONT_LOADED: 2, INCENTIVE: 1, COMBO: 1.5 }, incentives: ["wins", "finals", "ladder"] },
 family: { packages: { GUARANTEED: 1.5, FRONT_LOADED: 1, INCENTIVE: 1, COMBO: 1.5 }, incentives: ["membership", "wins", "satisfaction"] },
 community: { packages: { GUARANTEED: 1.5, FRONT_LOADED: 1, INCENTIVE: 1.5, COMBO: 1.5 }, incentives: ["satisfaction", "membership", "ladder"] },
};

// Each package pays out this share of the offer's headline annual value in guaranteed money
// (a sponsor that pays early or ties pay to results expects the discount to be earned back).
const PACKAGE_TERMS = {
 GUARANTEED: { guaranteed: 1, upfrontShare: 0, pool: 0, incentiveCount: 0 },
 FRONT_LOADED: { guaranteed: 0.96, upfrontShare: 0.3, pool: 0, incentiveCount: 0 },
 INCENTIVE: { guaranteed: 0.75, upfrontShare: 0, pool: 0.65, incentiveCount: 3 },
 COMBO: { guaranteed: 0.85, upfrontShare: 0.2, pool: 0.4, incentiveCount: 2 },
};

export const FINALS_STAGES = [
 { id: "MADE_FINALS", label: "Make finals", share: 0.15 },
 { id: "WON_FINAL", label: "Win a final", share: 0.3 },
 { id: "PRELIM", label: "Reach a preliminary final", share: 0.5 },
 { id: "GRAND_FINAL", label: "Reach the Grand Final", share: 0.75 },
 { id: "PREMIERS", label: "Win the premiership", share: 1 },
];

const roundTo = (value, step) => Math.round(value / step) * step;

function buildIncentive(kind, budget) {
 const amount = (share) => Math.max(5_000, roundTo(budget * share, 5_000));
 if (kind === "wins") {
 const maxWins = 20;
 return { id: "wins", kind: "PER_WIN", label: "Win bonus", perWin: Math.max(2_500, roundTo(budget / maxWins, 2_500)), maxWins };
 }
 if (kind === "ladder") {
 return { id: "ladder", kind: "LADDER_TIERS", label: "Ladder finish", tiers: [
 { maxPosition: 8, amount: amount(0.25) }, { maxPosition: 4, amount: amount(0.55) }, { maxPosition: 1, amount: amount(1) },
 ] };
 }
 if (kind === "finals") {
 return { id: "finals", kind: "FINALS_TIERS", label: "Finals success", tiers: FINALS_STAGES.map((stage) => ({ stage: stage.id, amount: amount(stage.share) })) };
 }
 if (kind === "membership") {
 return { id: "membership", kind: "MEMBERSHIP_GROWTH", label: "Membership growth", tiers: [
 { minGrowth: 0.03, amount: amount(0.5) }, { minGrowth: 0.06, amount: amount(1) },
 ] };
 }
 return { id: "satisfaction", kind: "SATISFACTION", label: "Supporter satisfaction", tiers: [
 { minSatisfaction: 72, amount: amount(0.5) }, { minSatisfaction: 82, amount: amount(1) },
 ] };
}

export function incentiveMaxValue(incentive) {
 if (incentive.kind === "PER_WIN") return Number(incentive.perWin ?? 0) * Number(incentive.maxWins ?? 0);
 return Math.max(0, ...(incentive.tiers ?? []).map((tier) => Number(tier.amount ?? 0)));
}

// Plain-English terms for display, one line per tier.
export function describeSponsorIncentive(incentive) {
 const money = (value) => `$${Math.round(value).toLocaleString()}`;
 const ordinal = (n) => (n === 1 ? "Minor premiers" : `Top ${n}`);
 if (incentive.kind === "PER_WIN") return { label: incentive.label, detail: `${money(incentive.perWin)} per win, up to ${incentive.maxWins} wins` };
 if (incentive.kind === "LADDER_TIERS") return { label: incentive.label, detail: incentive.tiers.map((tier) => `${ordinal(tier.maxPosition)} ${money(tier.amount)}`).join(" · ") };
 if (incentive.kind === "FINALS_TIERS") return { label: incentive.label, detail: incentive.tiers.map((tier) => `${FINALS_STAGES.find((stage) => stage.id === tier.stage)?.label ?? tier.stage} ${money(tier.amount)}`).join(" · ") };
 if (incentive.kind === "MEMBERSHIP_GROWTH") return { label: incentive.label, detail: incentive.tiers.map((tier) => `+${Math.round(tier.minGrowth * 100)}% ${money(tier.amount)}`).join(" · ") };
 return { label: incentive.label, detail: incentive.tiers.map((tier) => `${tier.minSatisfaction}+ ${money(tier.amount)}`).join(" · ") };
}

// Rough chance of reaching each tier for a club of the given strength (0 to 1); used for the
// "typical" value shown on offers and for the board's view of how good a deal is.
function achievementChances(incentive, strength) {
 const s = strength;
 if (incentive.kind === "LADDER_TIERS") {
 return incentive.tiers.map((tier) => (tier.maxPosition >= 8 ? clamp(0.06 + 0.85 * s, 0.03, 0.97) : tier.maxPosition >= 4 ? clamp(0.62 * s - 0.04, 0.01, 0.8) : clamp(0.3 * s - 0.04, 0.005, 0.35)));
 }
 if (incentive.kind === "FINALS_TIERS") {
 const made = clamp(0.1 + 0.85 * s, 0.05, 0.98);
 const won = made * (0.35 + 0.45 * s);
 const prelim = won * (0.45 + 0.35 * s);
 const grandFinal = prelim * (0.45 + 0.35 * s);
 const chances = { MADE_FINALS: made, WON_FINAL: won, PRELIM: prelim, GRAND_FINAL: grandFinal, PREMIERS: grandFinal * (0.4 + 0.3 * s) };
 return incentive.tiers.map((tier) => chances[tier.stage] ?? 0);
 }
 if (incentive.kind === "MEMBERSHIP_GROWTH") return incentive.tiers.map((tier) => (tier.minGrowth <= 0.03 ? clamp(0.1 + 0.6 * s, 0.05, 0.8) : clamp(0.45 * s * s, 0.02, 0.45)));
 return incentive.tiers.map((tier) => (tier.minSatisfaction <= 72 ? clamp(0.25 + 0.4 * s, 0.1, 0.75) : clamp(0.05 + 0.3 * s * s, 0.03, 0.4)));
}

export function expectedIncentiveValue(incentive, strength) {
 if (incentive.kind === "PER_WIN") return Number(incentive.perWin ?? 0) * Math.min(Number(incentive.maxWins ?? 0), clamp(3 + 16 * strength, 2, 19));
 const chances = achievementChances(incentive, strength);
 return (incentive.tiers ?? []).reduce((sum, tier, index) => sum + Number(tier.amount ?? 0) * (chances[index] - (chances[index + 1] ?? 0)), 0);
}

// How well the club is likely to do, from squad quality and recent results (0 to 1).
function sponsorStrength(club, roster, context = {}) {
 const recent = clamp(Number(context.recentSuccess ?? 50) / 100, 0, 1);
 const quality = clamp((clubQuality(club, roster) - 0.75) / 0.45, 0, 1);
 return clamp(recent * 0.5 + quality * 0.5, 0.05, 0.95);
}

// Totals shown to the manager. "Guaranteed" is certain; "typical" weights the incentives by how
// likely this club is to earn them; "maximum" assumes every incentive pays in full every season.
function deriveSponsorTotals(offer) {
 const years = Number(offer.years ?? 1);
 const incentives = offer.incentives ?? [];
 const strength = Number(offer.strength ?? 0.5);
 const guaranteedTotal = Number(offer.upfrontPayment ?? 0) + Number(offer.annualValue ?? 0) * years;
 const maxAnnualIncentives = incentives.reduce((sum, incentive) => sum + incentiveMaxValue(incentive), 0);
 const expectedAnnualIncentives = Math.round(incentives.reduce((sum, incentive) => sum + expectedIncentiveValue(incentive, strength), 0));
 return {
 totalValue: guaranteedTotal,
 guaranteedTotal,
 maxAnnualIncentives,
 expectedAnnualIncentives,
 expectedTotalValue: guaranteedTotal + expectedAnnualIncentives * years,
 maxTotalValue: guaranteedTotal + maxAnnualIncentives * years,
 };
}

// Matches the package types to the sponsors that favour them, keeping the set varied: every
// board always sees a plain guaranteed offer, an up-front offer and at least one performance deal.
function assignPackageTypes(sponsors, seed, midSeason) {
 const extras = midSeason ? ["GUARANTEED", "FRONT_LOADED", "GUARANTEED"] : ["GUARANTEED", "COMBO", "INCENTIVE"];
 const wanted = midSeason
 ? ["GUARANTEED", "FRONT_LOADED", "GUARANTEED", "FRONT_LOADED", extras[seed % extras.length]]
 : ["GUARANTEED", "FRONT_LOADED", "INCENTIVE", "COMBO", extras[seed % extras.length]];
 const typeOrder = seededOrder(wanted.length, seed + 17);
 const free = new Set(sponsors.map((_, index) => index));
 const assigned = [];
 typeOrder.forEach((typeIndex) => {
 const type = wanted[typeIndex];
 let best = null;
 free.forEach((sponsorIndex) => {
 const preference = (SPONSOR_STYLES[sponsors[sponsorIndex].type] ?? SPONSOR_STYLES.standard).packages[type] ?? 1;
 const score = preference + unitFromKey(`${seed}-${type}-${sponsorIndex}`) * 0.6;
 if (!best || score > best.score) best = { sponsorIndex, score };
 });
 free.delete(best.sponsorIndex);
 assigned[best.sponsorIndex] = type;
 });
 return assigned;
}

function buildSponsorPackage({ packageType, packageValue, years, incentiveFocus, seed }) {
 const terms = PACKAGE_TERMS[packageType];
 const guaranteedTotal = packageValue * years * terms.guaranteed;
 const upfrontPayment = terms.upfrontShare ? roundTo(guaranteedTotal * terms.upfrontShare, 10_000) : 0;
 const annualValue = roundTo((guaranteedTotal - upfrontPayment) / years, 10_000);
 const shares = terms.incentiveCount === 3 ? [0.4, 0.35, 0.25] : [0.55, 0.45];
 const kinds = terms.incentiveCount
 ? seededOrder(incentiveFocus.length, seed + 31).slice(0, terms.incentiveCount).map((index) => incentiveFocus[index])
 : [];
 const incentives = kinds.map((kind, index) => buildIncentive(kind, packageValue * terms.pool * shares[index]));
 return { upfrontPayment, annualValue, incentives };
}

export function generateSponsorshipOffers(club, roster = [], year = 2027, context = {}) {
 const numericClubId = Number.isFinite(Number(club?.id)) ? Number(club.id) : [...String(club?.id ?? club?.name ?? 1)].reduce((value, character) => (Math.imul(value, 31) + character.charCodeAt(0)) >>> 0, 0);
 const quality = getOfferQualityMultiplier(club, roster, context);
 const strength = sponsorStrength(club, roster, context);
 const midSeason = Boolean(context.midSeason);
 // Five distinct sponsors drawn from the whole catalogue.
 const seed = numericClubId * 7919 + Number(year) * 104729;
 const sponsors = seededOrder(sponsorCatalog.length, seed).slice(0, 5).map((catalogIndex) => sponsorCatalog[catalogIndex]);
 const packageTypes = assignPackageTypes(sponsors, seed, midSeason);
 return sponsors.map((sponsor, index) => {
 const variation = 0.9 + (((numericClubId * (index + 3) + Number(year)) % 19) / 100);
 const packageType = packageTypes[index];
 const baseYears = 1 + ((numericClubId + index) % 3);
 // Up-front money only makes sense for a deal that runs for more than a season.
 const years = ["FRONT_LOADED", "COMBO"].includes(packageType) ? Math.max(2, baseYears) : baseYears;
 const packageValue = Math.round((sponsor.base * quality * variation * getEconomyFactor(year)) / 10_000) * 10_000;
 const incentiveFocus = (SPONSOR_STYLES[sponsor.type] ?? SPONSOR_STYLES.standard).incentives;
 const offer = {
 ...sponsor,
 offerId: `${year}-${club?.id ?? "club"}-${sponsor.id}`,
 seasonYear: Number(year),
 years,
 packageType,
 packageValue,
 incentiveFocus,
 incentivesAllowed: !midSeason,
 strength,
 ...buildSponsorPackage({ packageType, packageValue, years, incentiveFocus, seed: seed + index * 101 }),
 };
 return { ...offer, ...deriveSponsorTotals(offer) };
 });
}

// ---------------------------------------------------------------------------
// Counter-offers: rather than simply paying more, a sponsor re-packages the deal.
// ---------------------------------------------------------------------------
export const SPONSOR_COUNTER_REQUESTS = {
 UPFRONT: { label: "Ask for more up front", short: "More up front" },
 GUARANTEE: { label: "Ask for more guaranteed pay", short: "More guaranteed" },
 UPSIDE: { label: "Ask for performance bonuses", short: "Add bonuses" },
};

export function getSponsorCounterAvailability(offer, request) {
 if (request === "UPFRONT") return Number(offer.years ?? 1) >= 2 ? { available: true } : { available: false, reason: "Needs a deal of two or more years" };
 if (request === "GUARANTEE") return (offer.incentives ?? []).length ? { available: true } : { available: false, reason: "No bonuses to convert" };
 if (request === "UPSIDE") {
 return offer.incentivesAllowed === false ? { available: false, reason: "Bonuses start next season" } : { available: true };
 }
 return { available: false, reason: "Unknown request" };
}

export function buildSponsorCounter(offer, request, { reputation = 65 } = {}) {
 const availability = getSponsorCounterAvailability(offer, request);
 if (!availability.available) return null;
 // Sponsors concede more to a prestigious club; a smaller club gives up a little value.
 const haircut = reputation >= 80 ? 0 : reputation >= 65 ? 0.02 : 0.04;
 const keep = 1 - haircut;
 const years = Number(offer.years ?? 1);
 const money = (value) => `$${Math.round(value).toLocaleString()}`;
 let next = { ...offer };
 let note = "";

 if (request === "UPFRONT") {
 const shifted = Number(offer.annualValue) * years * 0.25;
 next.upfrontPayment = roundTo((Number(offer.upfrontPayment ?? 0) + shifted) * keep, 10_000);
 next.annualValue = roundTo(Number(offer.annualValue) * 0.75 * keep, 10_000);
 note = `${offer.name} will pay ${money(next.upfrontPayment)} on signing in exchange for a lower annual fee of ${money(next.annualValue)}.`;
 } else if (request === "GUARANTEE") {
 // The sponsor pays out what it expects to owe, less a little for taking the risk off the club.
 const expectedAnnual = (offer.incentives ?? []).reduce((sum, incentive) => sum + expectedIncentiveValue(incentive, Number(offer.strength ?? 0.5)), 0);
 next.annualValue = roundTo((Number(offer.annualValue) + expectedAnnual * 0.85) * keep, 10_000);
 next.incentives = [];
 next.packageType = Number(next.upfrontPayment ?? 0) > 0 ? "FRONT_LOADED" : "GUARANTEED";
 note = `${offer.name} will drop the performance bonuses and guarantee ${money(next.annualValue)} a year instead.`;
 } else {
 const focus = offer.incentiveFocus ?? ["ladder", "wins"];
 if ((offer.incentives ?? []).length) {
 // Existing bonuses grow by a third; the guaranteed fee gives some of that back.
 next.incentives = offer.incentives.map((incentive) => scaleIncentive(incentive, 1.35));
 next.annualValue = roundTo(Number(offer.annualValue) * 0.92, 10_000);
 note = `${offer.name} will lift its performance bonuses by about a third, with a slightly lower guaranteed fee of ${money(next.annualValue)}.`;
 } else {
 const pool = Number(offer.packageValue ?? offer.annualValue) * 0.45;
 next.incentives = focus.slice(0, 2).map((kind, index) => buildIncentive(kind, pool * (index === 0 ? 0.55 : 0.45)));
 next.annualValue = roundTo(Number(offer.annualValue) * 0.88, 10_000);
 next.upfrontPayment = roundTo(Number(offer.upfrontPayment ?? 0) * 0.88, 10_000);
 next.packageType = Number(next.upfrontPayment) > 0 ? "COMBO" : "INCENTIVE";
 note = `${offer.name} will add performance bonuses worth up to ${money(next.incentives.reduce((sum, incentive) => sum + incentiveMaxValue(incentive), 0))} a season, with the guaranteed fee falling to ${money(next.annualValue)}.`;
 }
 }
 return { ...next, ...deriveSponsorTotals(next), negotiated: true, counterRequest: request, counterNote: note };
}

function scaleIncentive(incentive, factor) {
 if (incentive.kind === "PER_WIN") return { ...incentive, perWin: roundTo(Number(incentive.perWin) * factor, 2_500) };
 return { ...incentive, tiers: incentive.tiers.map((tier) => ({ ...tier, amount: roundTo(Number(tier.amount) * factor, 5_000) })) };
}

// Ending a deal early costs a share of the remaining fees, plus the unearned part of any signing payment.
export function sponsorTerminationFee(sponsor) {
 if (!sponsor) return 0;
 const remaining = Math.max(0, Number(sponsor.remainingYears ?? sponsor.years ?? 0));
 const years = Math.max(1, Number(sponsor.years ?? remaining ?? 1));
 return Math.round(Number(sponsor.annualValue ?? 0) * remaining * 0.35) + Math.round(Number(sponsor.upfrontPayment ?? 0) * Math.min(remaining, years) / years);
}

// ---------------------------------------------------------------------------
// Incentive settlement at the end of a season
// ---------------------------------------------------------------------------
const matchClubs = (match) => [match.homeTeam ?? match.home, match.awayTeam ?? match.away];
const matchWinner = (match) => match.winner ?? (Number(match.homeScore ?? match.homePoints) > Number(match.awayScore ?? match.awayPoints) ? matchClubs(match)[0] : Number(match.awayScore ?? match.awayPoints) > Number(match.homeScore ?? match.homePoints) ? matchClubs(match)[1] : null);

// The furthest stage a club reached in the finals series, or null if it missed finals.
export function finalsStageReached(clubName, seasonOutcome = {}) {
 const weeks = seasonOutcome.finalsHistory ?? [];
 const wildcard = seasonOutcome.wildcardResults ?? [];
 const all = [...wildcard, ...weeks.flatMap((week) => week.results ?? [])];
 const played = all.filter((match) => matchClubs(match).includes(clubName));
 if (seasonOutcome.premier === clubName) return "PREMIERS";
 const playedWeek = (number) => weeks.some((week) => Number(week.week) === number && (week.results ?? []).some((match) => matchClubs(match).includes(clubName)));
 if (playedWeek(4)) return "GRAND_FINAL";
 if (playedWeek(3)) return "PRELIM";
 if (played.some((match) => matchWinner(match) === clubName)) return "WON_FINAL";
 return played.length ? "MADE_FINALS" : null;
}

function evaluateIncentive(incentive, outcome) {
 const money = (value) => `$${Math.round(value).toLocaleString()}`;
 const best = (tiers, achieved) => tiers.filter(achieved).reduce((top, tier) => (Number(tier.amount) > Number(top?.amount ?? -1) ? tier : top), null);
 if (incentive.kind === "PER_WIN") {
 const wins = Math.min(Number(outcome.wins ?? 0), Number(incentive.maxWins ?? 0));
 return { id: incentive.id, label: incentive.label, amount: wins * Number(incentive.perWin ?? 0), detail: `${wins} win${wins === 1 ? "" : "s"} × ${money(incentive.perWin)}` };
 }
 if (incentive.kind === "LADDER_TIERS") {
 const tier = outcome.ladderPosition > 0 ? best(incentive.tiers, (item) => outcome.ladderPosition <= item.maxPosition) : null;
 return { id: incentive.id, label: incentive.label, amount: tier?.amount ?? 0, detail: outcome.ladderPosition > 0 ? `Finished position ${outcome.ladderPosition}` : "Ladder position unavailable" };
 }
 if (incentive.kind === "FINALS_TIERS") {
 const reached = FINALS_STAGES.findIndex((stage) => stage.id === outcome.finalsStage);
 const tier = reached >= 0 ? best(incentive.tiers, (item) => FINALS_STAGES.findIndex((stage) => stage.id === item.stage) <= reached) : null;
 return { id: incentive.id, label: incentive.label, amount: tier?.amount ?? 0, detail: reached >= 0 ? FINALS_STAGES[reached].label.replace(/^Make/, "Made").replace(/^Win a/, "Won a").replace(/^Reach/, "Reached").replace(/^Win the/, "Won the") : "Missed finals" };
 }
 if (incentive.kind === "MEMBERSHIP_GROWTH") {
 const growth = Number(outcome.membershipGrowth ?? 0);
 const tier = best(incentive.tiers, (item) => growth >= item.minGrowth);
 return { id: incentive.id, label: incentive.label, amount: tier?.amount ?? 0, detail: `Memberships ${growth >= 0 ? "grew" : "fell"} ${Math.abs(growth * 100).toFixed(1)}%` };
 }
 const satisfaction = Number(outcome.supporterSatisfaction ?? 0);
 const tier = best(incentive.tiers, (item) => satisfaction >= item.minSatisfaction);
 return { id: incentive.id, label: incentive.label, amount: tier?.amount ?? 0, detail: `Supporter satisfaction ${Math.round(satisfaction)}` };
}

// Pays out the sponsor's incentives for a completed season. Deals signed after the season began
// only start earning incentives the following season, so a result cannot be bought after the fact.
export function settleSponsorIncentives(sponsor, outcome = {}) {
 const incentives = sponsor?.incentives ?? [];
 if (!incentives.length || Number(outcome.seasonYear) < Number(sponsor.incentivesStartSeason ?? 0)) return { total: 0, lines: [] };
 const lines = incentives.map((incentive) => evaluateIncentive(incentive, outcome));
 return { total: lines.reduce((sum, line) => sum + line.amount, 0), lines };
}

export function calculateMembershipGrowth({ memberships = 0, sponsor = null, supporterSatisfaction = 68, ticketPrice = 48, ladder = [], clubName = "", fanExperienceLevel = 1 } = {}) {
 const ladderPosition = ladder.findIndex((entry) => entry.club === clubName) + 1;
 const ladderEffect = ladderPosition > 0 ? clamp((9.5 - ladderPosition) * 0.004, -0.034, 0.034) : 0;
 const satisfactionEffect = clamp((Number(supporterSatisfaction) - 65) * 0.001, -0.04, 0.04);
 const ticketEffect = clamp((48 - Number(ticketPrice)) * 0.0012, -0.035, 0.035);
 const sponsorEffect = Number(sponsor?.growth ?? 0);
 const fanExperienceEffect = (clamp(Number(fanExperienceLevel) || 1, 1, 5) - 1) * 0.003;
 const growth = clamp(ladderEffect + satisfactionEffect + ticketEffect + sponsorEffect + fanExperienceEffect, -0.12, 0.12);
 return { growth, memberships: Math.max(0, Math.round(Number(memberships) * (1 + growth))), ladderPosition };
}

export function getStaffBonuses(staff = []) {
 const rating = (role) => Number(staff.find((person) => person.role === role)?.rating ?? 65);
 const seniorCoach = rating("Head of Football Strategy and Coaching");
 const developmentRoles = new Set(["Head of Development", "VFL Senior Coach & Development Coach", "Development Coach"]);
 const developmentStaff = staff.filter((person) => developmentRoles.has(person.role));
 const developmentCoach = developmentStaff.length
 ? developmentStaff.reduce((sum, person) => sum + Number(person.rating ?? 65), 0) / developmentStaff.length
 : 65;
 const fitnessCoach = rating("Head of Performance");
 const recruiting = rating("List Manager");
 const staffAttributeBonuses = {};
 staff.forEach((person) => {
 const ratingBonus = clamp((Number(person.rating ?? 65) - 60) * 0.004, -0.04, 0.12);
 (STAFF_ROLE_ATTRIBUTE_IMPACTS[person.role] ?? []).forEach((attribute) => {
 staffAttributeBonuses[attribute] = clamp((staffAttributeBonuses[attribute] ?? 0) + ratingBonus, -0.08, 0.18);
 });
 });
 return {
 seniorCoachRating: seniorCoach,
 coachRelationshipModifier: Math.round((seniorCoach - 70) * 0.25),
 trainingDevelopmentMultiplier: clamp(1 + (developmentCoach - 65) * 0.01 + (seniorCoach - 65) * 0.003, 0.85, 1.25),
 medicalRecoveryMultiplier: clamp(1 + (fitnessCoach - 65) * 0.0015, 0.95, 1.1),
 scoutingAccuracy: clamp(0.55 + (recruiting - 60) * 0.012, 0.45, 0.9),
 staffAttributeBonuses,
 };
}

// AFL men's limits announced for 2025–27. Later game seasons use the game's
// 5% economy growth so career saves remain playable beyond the published years.
export function getFootballDepartmentSoftCap(year) {
 return Number(year) <= 2025 ? 7_675_000 : Number(year) === 2026 ? 8_425_000
 : Math.round(8_775_000 * getEconomyFactor(Math.max(2027, Number(year) || 2027)));
}

export function getCountedFootballDepartmentSpend(finance, administration) {
 const staff = administration?.staff ?? [];
 const seniorCoach = staff.find(person => ["Senior Coach", "Head of Football Strategy and Coaching"].includes(person.role));
 const seniorAssistant = staff.filter(person => person.role?.startsWith("Assistant Coach") || person.role === "Director of Coaching")
 .sort((a, b) => Number(b.salary ?? 0) - Number(a.salary ?? 0))[0];
 // Only an actual marketing agreement can exclude senior coach pay; do not
 // assume every coach has one. The senior assistant concession is automatic.
 const deduction = Math.min(100_000, Math.max(0, Number(seniorCoach?.salary ?? 0)), Math.max(0, Number(administration?.seniorCoachMarketingExclusion ?? 0)))
 + Number(seniorAssistant?.salary ?? 0) * 0.2;
 return Math.max(0, Number(finance?.expenses?.footballDepartment ?? 0) - deduction);
}

/** Reprice the staff portion of an existing annual finance projection. */
export function getStaffBudgetStatus(finance, administration, year, proposedStaff = administration?.staff ?? []) {
 const currentPayroll = (administration?.staff ?? []).reduce((sum, person) => sum + Math.max(0, Number(person.salary ?? 0)), 0);
 const proposedPayroll = proposedStaff.reduce((sum, person) => sum + Math.max(0, Number(person.salary ?? 0)), 0);
 const footballBase = Number(finance?.expenses?.footballDepartment ?? 0) - currentPayroll;
 const targetBase = Math.round(footballBase * getEconomyFactor(year) / getEconomyFactor(finance?.seasonYear ?? year));
 const projectedFinance = { expenses: { footballDepartment: targetBase + proposedPayroll } };
 const currentFinance = { expenses: { footballDepartment: targetBase + currentPayroll } };
 const cap = getFootballDepartmentSoftCap(year);
 const counted = getCountedFootballDepartmentSpend(projectedFinance, { ...administration, staff: proposedStaff });
 const currentCounted = getCountedFootballDepartmentSpend(currentFinance, administration);
 return { cap, counted, currentCounted, room: cap - counted, payroll: proposedPayroll,
 otherSpend: targetBase, concessions: Math.max(0, targetBase + proposedPayroll - counted),
 allowed: counted <= cap || (currentCounted > cap && counted <= currentCounted) };
}

const clubProfileFor = (club) => clubProfiles[String(club?.name ?? "").replace(/\s+/g, "_").toUpperCase()] ?? {};

export function createBoardObjectives(club, roster = [], seasonYear = 2027, { cashBalance = 0 } = {}) {
 const profile = clubProfileFor(club);
 const listAverage = roster.length ? roster.reduce((sum, player) => sum + Number(player.overall ?? 65), 0) / roster.length : 65;
 const ambition = listAverage * 0.75 + Number(profile.footballPrestige ?? 70) * 0.25;
 const ladderTarget = ambition >= 87 ? 4 : ambition >= 78 ? 8 : ambition >= 68 ? 12 : 14;
 const ladderLabel = ladderTarget === 14 ? "Finish above the bottom four" : `Finish in the top ${ladderTarget}`;
 const financialHealth = Number(profile.financialHealth ?? 75);
 const balance = Number(cashBalance ?? 0);
 let cashTarget;
 let cashLabel;
 if (balance < 0) {
 cashTarget = 0;
 cashLabel = "Bring the club back to break-even";
 } else if (financialHealth < 72 || balance < 1_250_000) {
 cashTarget = 1_000_000;
 cashLabel = "Keep the projected balance above $1m";
 } else if (financialHealth >= 88 && balance >= 2_000_000) {
 cashTarget = 3_500_000;
 cashLabel = "Grow club reserves to $3.5m";
 } else {
 cashTarget = 2_000_000;
 cashLabel = "Finish with at least $2m in reserves";
 }
 const ages = roster.map((player) => Number(player.age)).filter((age) => Number.isFinite(age) && age > 0);
 const averageAge = ages.length ? ages.reduce((sum, age) => sum + age, 0) / ages.length : 25;
 const baselinePlayerIds = roster.map((player) => String(player.id));
 let listObjective;
 if (averageAge < 24.5) {
 listObjective = { id: "youth-appearances", label: "Give under-23 players 40 senior appearances", type: "U23_APPEARANCES", target: 40 };
 } else if (averageAge > 27.5) {
 listObjective = { id: "recruit-youth", label: "Add two under-23 players to the list", type: "ADD_U23", target: 2, baselinePlayerIds };
 } else {
 listObjective = { id: "youth-pipeline", label: "Maintain at least eight players aged 23 or under", type: "U23_DEPTH", target: 8 };
 }
 return {
 seasonYear: Number(seasonYear),
 startingBalance: balance,
 objectives: [
 { id: "ladder-finish", label: ladderLabel, type: "LADDER", target: ladderTarget },
 { id: "financial-position", label: cashLabel, type: "CASH", target: cashTarget, startingBalance: balance },
 listObjective,
 { id: "supporters-70", label: "Keep supporter satisfaction at 70 or higher", type: "SUPPORTERS", target: 70 },
 ],
 };
}

// Choices are rebuilt from the current season's starting position. Saved
// objectives remain plain data, so older career saves continue to load.
export function boardObjectiveChoices(club, roster, seasonYear, administration = {}) {
 const defaults = createBoardObjectives(club, roster, seasonYear, { cashBalance: administration.cashBalance });
 const balance = Number(administration.cashBalance ?? 0);
 const staffPayroll = (administration.staff ?? []).reduce((sum, person) => sum + Number(person.salary ?? 0), 0);
 const staffBudget = (offset, difficulty) => ({ id: `staff-budget-${offset}`, label: `Keep annual staff payroll at or below $${((staffPayroll + offset) / 1_000_000).toFixed(2)}m`, type: "STAFF_BUDGET", target: Math.max(0, staffPayroll + offset), difficulty });
 const staffInvestment = (offset, difficulty) => ({ id: `staff-investment-${offset}`, label: `Invest at least $${((staffPayroll + offset) / 1_000_000).toFixed(2)}m annually in staff`, type: "STAFF_INVESTMENT", target: staffPayroll + offset, difficulty });
 const baselinePlayerIds = roster.map(player => String(player.id));
 const softCap = getFootballDepartmentSoftCap(seasonYear);
 const cash = (id, label, target, difficulty) => ({ id, label, type: "CASH", target, startingBalance: balance, difficulty });
 const floor = (target, difficulty) => balance < target ? null : ({ id: `cash-floor-${target}`, label: `Keep reserves at or above $${(target / 1_000_000).toFixed(1)}m all season`, type: "CASH_FLOOR", target, startingBalance: balance, difficulty });
 const facility = (key, name, difficulty = 4) => Number(administration.facilities?.[key] ?? 1) >= MAX_FACILITY_LEVEL ? null : ({ id: `facility-${key}`, label: `Upgrade ${name} facilities`, type: "FACILITY_UPGRADE", facility: key, target: Number(administration.facilities?.[key] ?? 1) + 1, difficulty });
 return [
 { id: "ON_FIELD", label: "On-field results", choices: [
 { id: "premiers", label: "Win the premiership", type: "PREMIERS", difficulty: 9 },
 { id: "grand-final", label: "Reach the Grand Final", type: "GRAND_FINAL", difficulty: 8 },
 ...[[4, 6], [6, 5], [8, 4], [10, 3]].map(([target, difficulty]) => ({ id: `top-${target}`, label: `Finish in the top ${target}`, type: "LADDER", target, difficulty })),
 { id: "make-finals", label: "Make the finals", type: "MAKE_FINALS", difficulty: 4 },
 { id: "any-position", label: "Any ladder position", type: "ANY_POSITION", difficulty: 0 },
 ] },
 { id: "FINANCE", label: "Finances and facilities", choices: [
 cash("break-even", "Finish at break-even or better", 0, 2),
 cash("reserves-1m", "Finish with $1m in reserves", 1_000_000, 3),
 cash("reserves-2m", "Finish with $2m in reserves", 2_000_000, 4),
 cash("reserves-3.5m", "Finish with $3.5m in reserves", 3_500_000, 5),
 cash("reserves-5m", "Finish with $5m in reserves", 5_000_000, 6),
 floor(0, 3), floor(1_000_000, 4), floor(2_000_000, 5),
 staffBudget(500_000, 2), staffBudget(0, 3), staffBudget(-500_000, 5),
 staffInvestment(250_000, 4), staffInvestment(750_000, 6),
 { id: "soft-cap", label: `Keep counted football department spending within the $${(softCap / 1_000_000).toFixed(3)}m soft cap`, type: "SOFT_CAP", target: softCap, difficulty: 3 },
 { id: "soft-cap-buffer", label: `Keep $250k of room under the football department soft cap`, type: "SOFT_CAP", target: softCap - 250_000, difficulty: 5 },
 facility("training", "training and development"), facility("sportsScience", "sports science"),
 facility("medical", "medical"), facility("recruiting", "recruiting"),
 ] },
 { id: "LIST", label: "List development", choices: [
 ...[[20, 2], [40, 3], [60, 4]].map(([target, difficulty]) => ({ id: `u23-appearances-${target}`, label: `Give under-23 players ${target} senior appearances`, type: "U23_APPEARANCES", target, difficulty })),
 ...[[1, 3], [2, 4], [3, 5]].map(([target, difficulty]) => ({ id: `add-u23-${target}`, label: `Add ${target} under-23 player${target === 1 ? "" : "s"} to the list`, type: "ADD_U23", target, baselinePlayerIds, difficulty })),
 ...[[6, 2], [8, 3], [10, 4]].map(([target, difficulty]) => ({ id: `u23-depth-${target}`, label: `Maintain ${target} players aged 23 or under`, type: "U23_DEPTH", target, difficulty })),
 { id: "staff-quality-70", label: "Raise average staff rating to 70", type: "STAFF_QUALITY", target: 70, difficulty: 3 },
 { id: "staff-quality-75", label: "Raise average staff rating to 75", type: "STAFF_QUALITY", target: 75, difficulty: 5 },
 ] },
 { id: "SUPPORTERS", label: "Supporters", choices: [[65, 2], [70, 3], [75, 4], [80, 5], [85, 6]].map(([target, difficulty]) => ({ id: `supporters-${target}`, label: `Keep supporter satisfaction at ${target} or higher`, type: "SUPPORTERS", target, difficulty })) },
 ].map(category => ({ ...category, choices: category.choices.filter(Boolean), defaultId: category.id === "ON_FIELD" ? `top-${Math.min(10, defaults.objectives[0].target)}` : category.id === "FINANCE" ? (defaults.objectives[1].target <= 0 ? "break-even" : defaults.objectives[1].target <= 1_000_000 ? "reserves-1m" : defaults.objectives[1].target <= 2_000_000 ? "reserves-2m" : "reserves-3.5m") : category.id === "LIST" ? (defaults.objectives[2].type === "U23_APPEARANCES" ? "u23-appearances-40" : defaults.objectives[2].type === "ADD_U23" ? "add-u23-2" : "u23-depth-8") : "supporters-70" }));
}

export function proposeBoardObjectives({ club, roster, seasonYear, administration, selections }) {
 const categories = boardObjectiveChoices(club, roster, seasonYear, administration);
 const chosen = categories.map(category => category.choices.find(choice => choice.id === selections[category.id]));
 if (chosen.some(choice => !choice)) return { accepted: false, message: "Choose one objective in each area." };
 const proposedDemand = chosen.reduce((sum, choice) => sum + choice.difficulty, 0);
 const boardDemand = categories.reduce((sum, category) => sum + (category.choices.find(choice => choice.id === category.defaultId)?.difficulty ?? 3), 0);
 if (proposedDemand < boardDemand - 1) return { accepted: false, message: "The board wants a stronger overall package. Offer a tougher target in another area to balance a lighter objective." };
 return { accepted: true, message: "The board accepted your objectives for this season.", boardObjectives: {
 seasonYear: Number(seasonYear), startingBalance: Number(administration.cashBalance ?? 0), lowestBalance: Number(administration.cashBalance ?? 0),
 negotiated: true, objectives: chosen,
 } };
}

function objectiveResult(objective, progress, met, finalized, current) {
 const roundedProgress = clamp(Math.round(Number(progress) || 0), 0, 100);
 const status = finalized ? (met ? "COMPLETE" : "FAILED") : "IN_PROGRESS";
 return {
 ...objective,
 ...(current === undefined ? {} : { current }),
 progress: finalized ? roundedProgress : Math.min(99, roundedProgress),
 complete: finalized && met,
 failed: finalized && !met,
 status,
 };
}

function evaluateBoardObjective(objective, { finance, seasonState, club, roster, administrationState, finalized }) {
 const target = Number(objective.target ?? 0);
 if (objective.type === "LADDER") {
 const ladder = seasonState.ladder ?? [];
 const rank = ladder.findIndex((entry) => entry.club === club?.name) + 1;
 const hasPlayed = (seasonState.roundHistory ?? []).length > 0;
 const progress = hasPlayed && rank
 ? clamp(Math.round(((ladder.length - rank) / Math.max(1, ladder.length - target)) * 100), 0, 100)
 : 0;
 return objectiveResult(objective, progress, hasPlayed && rank > 0 && rank <= target, finalized);
 }
 if (objective.type === "MAKE_FINALS") {
 const finalists = (seasonState.finalsHistory ?? []).flatMap(week => week.results ?? []);
 const reached = finalists.some(match => [match.homeTeam ?? match.home, match.awayTeam ?? match.away].includes(club?.name));
 return objectiveResult(objective, reached ? 100 : 0, reached, finalized);
 }
 if (objective.type === "PREMIERS" || objective.type === "GRAND_FINAL") {
 const final = (seasonState.finalsHistory ?? []).flatMap(week => week.results ?? []).find(match => match.code === "GF" || match.stage === "GRAND_FINAL");
 const reached = Boolean(final && [final.homeTeam ?? final.home, final.awayTeam ?? final.away].includes(club?.name));
 const won = reached && (final.winner === club?.name || (final.homeTeam ?? final.home) === club?.name && final.homeScore > final.awayScore || (final.awayTeam ?? final.away) === club?.name && final.awayScore > final.homeScore);
 return objectiveResult(objective, won ? 100 : reached ? 80 : 0, objective.type === "PREMIERS" ? won : reached, finalized);
 }
 if (objective.type === "ANY_POSITION") return objectiveResult(objective, 100, true, finalized);
 if (objective.type === "CASH_FLOOR") {
 const lowest = Math.min(Number(administrationState.boardObjectives?.lowestBalance ?? objective.startingBalance ?? administrationState.cashBalance ?? 0), Number(administrationState.cashBalance ?? 0));
 return objectiveResult(objective, lowest >= target ? 100 : 0, lowest >= target, finalized, lowest);
 }
 if (objective.type === "FACILITY_UPGRADE") {
 const level = Number(administrationState.facilities?.[objective.facility] ?? 1);
 return objectiveResult(objective, level >= target ? 100 : (level / Math.max(1, target)) * 100, level >= target, finalized, level);
 }
 if (objective.type === "SOFT_CAP") {
 const spending = getCountedFootballDepartmentSpend(finance, administrationState);
 return objectiveResult(objective, spending <= target ? 100 : target / Math.max(1, spending) * 100, spending <= target, finalized, spending);
 }
 if (objective.type === "STAFF_BUDGET" || objective.type === "STAFF_INVESTMENT") {
 const payroll = (administrationState.staff ?? []).reduce((sum, person) => sum + Number(person.salary ?? 0), 0);
 const met = objective.type === "STAFF_BUDGET" ? payroll <= target : payroll >= target;
 return objectiveResult(objective, met ? 100 : objective.type === "STAFF_BUDGET" ? target / Math.max(1, payroll) * 100 : payroll / Math.max(1, target) * 100, met, finalized, payroll);
 }
 if (objective.type === "SUPPORTERS") {
 const value = Number(administrationState.commercial?.supporterSatisfaction ?? 0);
 return objectiveResult(objective, value / Math.max(1, target) * 100, value >= target, finalized, value);
 }
 if (objective.type === "STAFF_QUALITY") {
 const staff = administrationState.staff ?? [];
 const rating = staff.length ? staff.reduce((sum, person) => sum + Number(person.rating ?? 0), 0) / staff.length : 0;
 return objectiveResult(objective, rating / Math.max(1, target) * 100, rating >= target, finalized, Math.round(rating));
 }
 if (objective.type === "CASH") {
 const projected = Number(finance?.projectedEndBalance ?? finance?.cashBalance ?? 0);
 const start = Number(objective.startingBalance ?? 0);
 const range = target - start;
 const progress = projected >= target ? 100 : Math.abs(range) < 1 ? (projected >= target ? 100 : 0) : clamp(Math.round(((projected - start) / range) * 100), 0, 99);
 return objectiveResult(objective, progress, projected >= target, finalized);
 }
 if (objective.type === "U23_APPEARANCES") {
 const youngIds = new Set(roster.filter((player) => Number(player.age) <= 23).map((player) => String(player.id)));
 const matches = [
 ...(seasonState.roundHistory ?? []).flatMap((entry) => entry.results ?? []),
 ...(seasonState.wildcardResults ?? []),
 ...(seasonState.finalsHistory ?? []).flatMap((entry) => entry.results ?? []),
 ];
 let appearances = 0;
 for (const match of matches) {
 const appearedThisMatch = new Set();
 for (const stat of [...(match.playerStats?.home ?? []), ...(match.playerStats?.away ?? [])]) {
 const id = String(stat.playerId ?? "");
 if (youngIds.has(id) && Number(stat.timeOnGround ?? 0) > 0) appearedThisMatch.add(id);
 }
 appearances += appearedThisMatch.size;
 }
 return objectiveResult(objective, (appearances / Math.max(1, target)) * 100, appearances >= target, finalized, appearances);
 }
 if (objective.type === "ADD_U23") {
 const baselineIds = new Set(objective.baselinePlayerIds ?? []);
 const additions = roster.filter((player) => Number(player.age) <= 23 && !baselineIds.has(String(player.id))).length;
 return objectiveResult(objective, (additions / Math.max(1, target)) * 100, additions >= target, finalized, additions);
 }
 if (objective.type === "U23_DEPTH") {
 const count = roster.filter((player) => Number(player.age) <= 23).length;
 return objectiveResult(objective, (count / Math.max(1, target)) * 100, count >= target, finalized, count);
 }
 return objectiveResult(objective, 0, false, finalized);
}

export function calculateBoardReview({ finance, seasonState = {}, club, administrationState = {}, roster = [] }) {
 const boardObjectives = administrationState.boardObjectives?.seasonYear === Number(seasonState.seasonYear ?? 2027)
 ? administrationState.boardObjectives
 : createBoardObjectives(club, roster, seasonState.seasonYear ?? 2027, { cashBalance: administrationState.cashBalance ?? finance?.cashBalance ?? 0 });
 // Keep objectives open throughout the active season. Resolve them only in
 // the post-season review for the same objective season; rollover creates
 // next season's objectives while the completed season is still displayed.
 const finalized = seasonState.phase === "POST_SEASON"
 && Number(boardObjectives.seasonYear) === Number(seasonState.seasonYear ?? 2027);
 const objectives = boardObjectives.objectives.map((objective) => evaluateBoardObjective(objective, { finance, seasonState, club, roster, administrationState, finalized }));
 const ladder = seasonState.ladder ?? [];
 const rank = ladder.findIndex((entry) => entry.club === club?.name) + 1;
 const listAverage = roster.length ? roster.reduce((sum, player) => sum + Number(player.overall ?? 65), 0) / roster.length : 65;
 const onField = rank ? clamp(105 - rank * 5, 20, 100) : clamp(listAverage, 35, 90);
 const debtPenalty = Number(finance?.cashBalance ?? 0) < 0 ? Math.min(20, Math.abs(Number(finance.cashBalance)) / 500_000) : 0;
 const softCapOverrun = Math.max(0, getCountedFootballDepartmentSpend(finance, administrationState) - getFootballDepartmentSoftCap(seasonState.seasonYear));
 const financial = clamp(65 + Number(finance?.netIncomePerRound ?? 0) / 60_000 - debtPenalty - Math.min(20, softCapOverrun / 100_000 * 2), 0, 100);
 const salaryCapNow = finance?.salaryCap ?? AFL_SALARY_CAP;
 const minimumSpendNow = finance?.minimumSpend ?? AFL_MINIMUM_SPEND;
 const payments = Number(finance?.playerPayments ?? 0);
 // Over the cap is a serious breach. Falling short of the minimum spend costs points in
 // proportion to the shortfall (the cap grows 5% a year, so a small gap is easy to open).
 const list = finance?.capEnforced === false ? 100 : payments > salaryCapNow ? 35 : payments >= minimumSpendNow ? 100 : clamp(Math.round(100 - ((minimumSpendNow - payments) / salaryCapNow) * 800), 0, 99);
 const supporters = Number(administrationState.commercial?.supporterSatisfaction ?? 68);
 const boardConfidence = Number(administrationState.commercial?.boardSatisfaction ?? 70);
 const staff = administrationState.staff?.length
 ? administrationState.staff.reduce((sum, person) => sum + Number(person.rating ?? 60), 0) / administrationState.staff.length
 : 60;
 const rawScore = financial * 0.22 + onField * 0.28 + list * 0.18 + supporters * 0.12 + staff * 0.08 + boardConfidence * 0.12;
 const difficultyAdjustment = club?.name === seasonState.managerClubName
 ? getDifficultySettings(seasonState.difficulty).boardReviewModifier
 : 0;
 // Easier promises carry more reputational risk when missed. Ambitious goals
 // earn credit when met and receive more tolerance when missed.
 const objectiveImpact = finalized && objectives.length ? objectives.reduce((sum, objective) => {
 const difficulty = clamp(Number(objective.difficulty ?? 3), 0, 9);
 return sum + (objective.complete ? 8 + difficulty * 1.2 : -(22 - difficulty * 2));
 }, 0) / objectives.length : 0;
 const score = clamp(Math.round(rawScore + objectiveImpact + difficultyAdjustment), 0, 100);
 const previousScore = Number(administrationState.previousBoardScore ?? score);
 return { score, financial: Math.round(financial), onField: Math.round(onField), list: Math.round(list), supporters: Math.round(supporters), boardConfidence: Math.round(boardConfidence), staff: Math.round(staff), trend: score - previousScore, objectiveImpact: Math.round(objectiveImpact), objectives };
}

export function advanceClubAdministrationSeason(state, club, roster, nextYear, settledCashBalance, recentSuccess = 0.5, ladder = [], boardReview = null, seasonOutcome = null) {
 const defaults = createClubAdministrationState(club, roster, nextYear);
 const current = state
 ? {
 ...defaults,
 ...state,
 facilities: { ...defaults.facilities, ...(state.facilities ?? {}) },
 staff: upgradeStaffRoster(state.staff ?? defaults.staff, state.staff ? [] : defaults.staff, club?.name),
 staffPool: normalizeStaffPool(state.staffPool ?? defaults.staffPool, club?.name, state.staffPoolLastRefreshedAt ?? defaults.staffPoolLastRefreshedAt, true, (state.staff ?? defaults.staff).map((person) => person.id)),
 commercial: {
 ...defaults.commercial,
 ...(state.commercial ?? {}),
 ...(!(state.commercial?.membershipBaselineYear)
 ? { memberships: AFL_MEMBERSHIP_BASELINES[club?.name] ?? state.commercial?.memberships ?? defaults.commercial.memberships, membershipBaselineYear: 2025 }
 : {}),
 },
 }
 : defaults;
 const previousSponsor = current.commercial?.activeSponsor;
 const remainingYears = previousSponsor
 ? Number(previousSponsor.remainingYears ?? previousSponsor.years ?? 1) - 1
 : 0;
 const activeSponsor = previousSponsor && remainingYears > 0
 ? { ...previousSponsor, remainingYears }
 : null;
 const { memberships, growth: membershipGrowth } = calculateMembershipGrowth({
 memberships: current.commercial?.memberships,
 // Use the sponsor held during the season that just finished, including a
 // deal that expired at rollover.
 sponsor: previousSponsor,
 supporterSatisfaction: current.commercial?.supporterSatisfaction,
 ticketPrice: current.commercial?.ticketPrice,
 ladder,
 clubName: club?.name,
 fanExperienceLevel: current.facilities?.matchdayFanExperience,
 });
 const reputation = clamp(Number(current.commercial?.reputation ?? clubProfileFor(club).footballPrestige ?? 70), 0, 100);
 const offers = generateSponsorshipOffers(club, roster, nextYear, {
 cashBalance: settledCashBalance,
 memberships,
 reputation,
 recentSuccess: recentSuccess * 100,
 premiershipWindow: Number(50 + recentSuccess * 50),
 });

 // Pay any sponsor incentives earned over the season that just finished.
 const completedSeason = Number(nextYear) - 1;
 const clubRow = ladder.findIndex((entry) => entry.club === club?.name);
 const incentiveSettlement = previousSponsor?.incentives?.length
 ? settleSponsorIncentives(previousSponsor, {
 seasonYear: completedSeason,
 ladderPosition: clubRow >= 0 ? clubRow + 1 : 0,
 wins: Number(ladder[clubRow]?.wins ?? 0),
 finalsStage: finalsStageReached(club?.name, { ...(seasonOutcome ?? {}), ladder }),
 membershipGrowth,
 supporterSatisfaction: current.commercial?.supporterSatisfaction,
 })
 : null;
 const incentivePayout = Math.round(incentiveSettlement?.total ?? 0);

 const roughBoardScore = Math.round(boardReview?.score ?? clamp(50 + (recentSuccess - 0.5) * 70 + (settledCashBalance > 0 ? 8 : -18), 0, 100));
 const missedObjectiveTrust = (boardReview?.objectives ?? []).filter(objective => objective.failed).reduce((sum, objective) => sum - Math.max(1, 7 - Math.round(Number(objective.difficulty ?? 3) * 0.7)), 0);
 const lowGradePenalty = roughBoardScore < 45 ? 750_000 : 0;
 const closingBalance = Math.round(settledCashBalance + incentivePayout - lowGradePenalty);
 const openingBalance = CARRY_CASH_DEBT ? closingBalance : Math.max(0, closingBalance);
 const inDebt = openingBalance < 0;
 return advanceStaffContracts({
 ...current,
 cashBalance: openingBalance,
 lastAccruedRound: 0,
 lastAccruedSeason: Number(nextYear),
 commercial: {
 ...current.commercial,
 seasonYear: Number(nextYear),
 memberships,
 reputation,
 activeSponsor,
 offers,
 counterOffers: {},
 lastSponsorSettlement: incentiveSettlement?.lines?.length
 ? { seasonYear: completedSeason, sponsorName: previousSponsor.name, total: incentivePayout, lines: incentiveSettlement.lines }
 : null,
 boardSatisfaction: clamp(Number(current.commercial?.boardSatisfaction ?? 70) + (roughBoardScore < 45 ? -10 : roughBoardScore >= 80 ? 3 : -1) + missedObjectiveTrust + (inDebt ? -5 : 0), 0, 100),
 },
 previousBoardScore: roughBoardScore,
 boardObjectives: createBoardObjectives(club, roster, nextYear, { cashBalance: openingBalance }),
 boardConsequence: [
 lowGradePenalty ? `Board intervention reduced the club's cash by $${lowGradePenalty.toLocaleString()}.` : null,
 inDebt ? `The club starts the season $${Math.abs(openingBalance).toLocaleString()} in debt and the board has lost confidence. Cash is needed before any facility spending.` : null,
 ].filter(Boolean).join(" ") || null,
 }, nextYear);
}

// The fourth parameter is unused; it is kept so existing callers keep compiling.
export function createClubAdministrationState(club, roster = [], year = 2027, _playerContracts = undefined) {
 const profile = clubProfileFor(club);
 const financialHealth = Number(profile.financialHealth ?? 70);
 const reputation = Number(profile.footballPrestige ?? 70);
 const memberships = AFL_MEMBERSHIP_BASELINES[club?.name] ?? 60_000;
 const cashBalance = Math.round(clamp(1_000_000 + (financialHealth - 60) * 40_000, 1_000_000, 3_000_000) / 100_000) * 100_000;
 const offers = generateSponsorshipOffers(club, roster, year, { cashBalance, memberships, reputation });
 return {
 clubId: club?.id ?? null,
 seasonYear: Number(year),
 salaryCapBank: [],
 cashBalance,
 boardObjectives: createBoardObjectives(club, roster, year, { cashBalance }),
 lastAccruedRound: 0,
 lastAccruedSeason: Number(year),
 facilities: {
 sportsScience: 2,
 medical: 2,
 training: 2,
 recovery: 2,
 recruiting: 2,
 academy: 3,
 matchdayFanExperience: 2,
 },
 facilityProjects: {},
 staff: upgradeStaffRoster([
 { id: "football-strategy-coach", role: "Head of Football Strategy and Coaching", name: "Football Strategy Coach", rating: 70 + Math.round((reputation - 70) * 0.15) },
 { id: "head-development", role: "Head of Development", name: "Development Coach", rating: 68 },
 { id: "head-performance", role: "Head of Performance", name: "Performance Coach", rating: 68 },
 { id: "list-manager", role: "List Manager", name: "List Manager", rating: 68 },
 { id: "assistant-midfield", role: "Assistant Coach (Midfield)", name: "Midfield Assistant Coach", rating: 67 },
 { id: "assistant-backs", role: "Assistant Coach (Backs)", name: "Backs Assistant Coach", rating: 67 },
 { id: "assistant-forwards", role: "Assistant Coach (Forwards)", name: "Forwards Assistant Coach", rating: 67 },
 { id: "ruck-coach", role: "Ruck Coach", name: "Ruck Coach", rating: 67 },
 { id: "vfl-development-coach", role: "VFL Senior Coach & Development Coach", name: "VFL Development Coach", rating: 67 },
 { id: "development-coach-1", role: "Development Coach", name: "Development Coach 1", rating: 66 },
 { id: "development-coach-2", role: "Development Coach", name: "Development Coach 2", rating: 66 },
 { id: "development-coach-3", role: "Development Coach", name: "Development Coach 3", rating: 66 },
 ].map((person) => ({ ...person, salary: STARTING_STAFF_BASE_SALARIES[person.id], contractYearsRemaining: 2, contractSignedAt: `${Number(year) - 1}-10-01` })), [], club?.name),
 staffPool: generateStaffPool(club?.name, `${Number(year) - 1}-10-01`),
 staffPoolLastRefreshedAt: `${Number(year) - 1}-10-01`,
 commercial: {
 seasonYear: Number(year),
 memberships,
 membershipBaselineYear: 2025,
 ticketPrice: 48,
 supporterSatisfaction: 68,
 reputation,
 activeSponsor: null,
 offers,
 counterOffers: {},
 boardSatisfaction: 70,
 },
 };
}

// Describes this club to the negotiation engine so coaching staff, the live ladder,
// reputation and facilities all influence what players think of the club.
export function buildClubNegotiationContext({ administrationState = {}, seasonState = {}, clubName, players = [] } = {}) {
 const staffBonuses = getStaffBonuses(administrationState.staff ?? []);
 const levels = Object.entries(administrationState.facilities ?? {}).filter(([key]) => key !== "matchdayFanExperience").map(([, value]) => Number(value)).filter(Number.isFinite);
 const ladderIndex = (seasonState.ladder ?? []).findIndex((entry) => entry.club === clubName);
 const reputation = Number(administrationState.commercial?.reputation);
 const leadershipGroup = seasonState.leadershipGroup ?? {};
 const leaderIds = [...(leadershipGroup.captains ?? []), ...(leadershipGroup.viceCaptains ?? [])];
 const clubPlayers = players.filter((player) => player.club === clubName);
 const leaderRatings = leaderIds.map((id) => clubPlayers.find((player) => String(player.id) === String(id)))
 .filter(Boolean).map((player) => (Number(player.attributes?.leadership ?? 50) + Number(player.attributes?.professionalism ?? 50)) / 2);
 return {
 clubName,
 coachRelationshipModifier: staffBonuses.coachRelationshipModifier,
 ladderRank: ladderIndex >= 0 ? ladderIndex + 1 : null,
 roundsPlayed: Math.max(0, Number(seasonState.round ?? 1) - 1),
 reputation: Number.isFinite(reputation) ? reputation : null,
 facilityLevel: levels.length ? levels.reduce((sum, level) => sum + level, 0) / levels.length : null,
 leadershipGroupQuality: leaderRatings.length ? leaderRatings.reduce((sum, value) => sum + value, 0) / leaderRatings.length : 50,
 };
}

export function getFacilityBonuses(facilities = {}, staff = []) {
 const staffBonuses = getStaffBonuses(staff);
 const level = (key) => clamp(Number(facilities[key] ?? 1), 1, 5);
 return {
 injuryRiskReduction: Math.min(0.18, level("sportsScience") * 0.035),
 medicalRecoveryMultiplier: (1 + level("medical") * 0.035) * staffBonuses.medicalRecoveryMultiplier,
 injuryRecoveryMultiplier: (1 + level("medical") * 0.06) * staffBonuses.medicalRecoveryMultiplier,
 trainingDevelopmentMultiplier: (1 + level("training") * 0.04) * staffBonuses.trainingDevelopmentMultiplier,
 postMatchFitnessRestoration: level("recovery") * 0.8,
 fatigueAccumulationMultiplier: Math.max(0.78, 1 - level("recovery") * 0.045),
 // The List Manager leads scouting. Facilities help, but cannot turn weak staff into elite scouts.
 scoutingAccuracy: clamp(staffBonuses.scoutingAccuracy * 0.82 + (0.55 + level("recruiting") * 0.07) * 0.18, 0.45, 0.92),
 seniorCoachRating: staffBonuses.seniorCoachRating,
 coachRelationshipModifier: staffBonuses.coachRelationshipModifier,
 staffAttributeBonuses: staffBonuses.staffAttributeBonuses,
 // Matchday Fan Experience: small, steady lifts to gate receipts and annual membership growth.
 gateReceiptsMultiplier: 1 + (level("matchdayFanExperience") - 1) * 0.02,
 membershipGrowthBonus: (level("matchdayFanExperience") - 1) * 0.003,
 };
}

/** Supporter satisfaction gained each time a Matchday Fan Experience upgrade is completed. */
export const FAN_EXPERIENCE_SATISFACTION_GAIN = 2;

const FACILITY_RUNNING_COST_BASE = {
 sportsScience: 150_000, medical: 150_000, training: 170_000, recovery: 150_000, recruiting: 130_000, matchdayFanExperience: 140_000, academy: 100_000,
};
export const FACILITY_KEYS = Object.keys(FACILITY_RUNNING_COST_BASE);

/** Yearly running cost of one facility at a level. Grows faster than linearly, so top-level facilities are expensive to run. */
export function getFacilityRunningCost(id, level) {
 const lvl = clamp(Number(level ?? 1), 1, MAX_FACILITY_LEVEL);
 return Math.round((FACILITY_RUNNING_COST_BASE[id] ?? 150_000) * lvl ** 1.3 / 5_000) * 5_000;
}

/** Building time in days: about 24 days for every $1m of the upgrade's cost, so bigger upgrades take longer. */
export function getFacilityUpgradeDays(facility) {
 return Math.max(28, Math.round(getFacilityUpgradeCost(facility) / 1_000_000 * 24));
}

export function toDayString(value) {
 if (typeof value === "string") return value.slice(0, 10);
 const date = value instanceof Date && !Number.isNaN(value.getTime()) ? value : new Date();
 const pad = (n) => String(n).padStart(2, "0");
 return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addDaysToKey(key, days) {
 const date = new Date(`${key}T12:00:00Z`);
 date.setUTCDate(date.getUTCDate() + Number(days));
 return date.toISOString().slice(0, 10);
}

export function daysBetweenKeys(fromKey, toKey) {
 return Math.round((new Date(`${toKey}T12:00:00Z`) - new Date(`${fromKey}T12:00:00Z`)) / 86_400_000);
}

/** Records an upgrade as a project that finishes after its build time. Cash is handled by the caller. */
export function startFacilityProject(administration, facility, currentDate) {
 const startedAt = toDayString(currentDate);
 const days = getFacilityUpgradeDays(facility);
 return {
 ...administration,
 facilityProjects: {
 ...(administration.facilityProjects ?? {}),
 [facility.id]: {
 fromLevel: facility.level,
 toLevel: facility.level + 1,
 startedAt,
 completesAt: addDaysToKey(startedAt, days),
 days,
 cost: getFacilityUpgradeCost(facility),
 },
 },
 };
}

/** Applies every project whose completion date has arrived. Returns the same object when nothing finished. */
export function completeFacilityProjects(administration, currentDate) {
 const projects = administration?.facilityProjects ?? {};
 const today = toDayString(currentDate);
 const finished = Object.entries(projects).filter(([, project]) => project?.completesAt && project.completesAt <= today);
 if (!finished.length) return administration;
 const facilities = { ...(administration.facilities ?? {}) };
 const remaining = { ...projects };
 let satisfactionGain = 0;
 for (const [id, project] of finished) {
 facilities[id] = Math.min(MAX_FACILITY_LEVEL, Math.max(Number(facilities[id] ?? 1), Number(project.toLevel)));
 delete remaining[id];
 if (id === "matchdayFanExperience") satisfactionGain += FAN_EXPERIENCE_SATISFACTION_GAIN;
 }
 const commercial = administration.commercial ?? {};
 return {
 ...administration,
 facilities,
 facilityProjects: remaining,
 commercial: satisfactionGain
 ? { ...commercial, supporterSatisfaction: clamp(Number(commercial.supporterSatisfaction ?? 68) + satisfactionGain, 0, 100) }
 : commercial,
 completedFacilityProjects: [...(administration.completedFacilityProjects ?? []), ...finished.map(([id, project]) => ({ id, level: project.toLevel, completedAt: project.completesAt }))].slice(-12),
 };
}

export function getFacilityUpgradeCost(facility) {
 return Math.round(facility.nextCost * facility.costGrowth ** (facility.level - 1));
}

export function getFacilityDefinitions(facilities = {}, context = {}) {
 const bonuses = getFacilityBonuses(facilities, context.staff ?? []);
 return [
 { id: "sportsScience", name: "Sports Science", level: facilities.sportsScience ?? 1, effect: `${Math.round(bonuses.injuryRiskReduction * 100)}% lower injury risk`, nextEffect: "Further reduces injury risk by 3.5 percentage points.", nextCost: 1_500_000, costGrowth: 1.45 },
 { id: "medical", name: "Medical Facilities", level: facilities.medical ?? 1, effect: `${Math.round((bonuses.medicalRecoveryMultiplier - 1) * 100)}% faster fitness recovery; ${Math.round((bonuses.injuryRecoveryMultiplier - 1) * 100)}% faster injury recovery`, nextEffect: "Improves fitness and injury recovery speed.", nextCost: 1_700_000, costGrowth: 1.45 },
 { id: "training", name: "Training Facilities", level: facilities.training ?? 1, effect: `${Math.round((bonuses.trainingDevelopmentMultiplier - 1) * 100)}% faster player development and attribute growth`, nextEffect: "Further increases player development and attribute growth.", nextCost: 2_000_000, costGrowth: 1.5 },
 { id: "recovery", name: "Recovery Facilities", level: facilities.recovery ?? 1, effect: `+${bonuses.postMatchFitnessRestoration.toFixed(1)} post-match fitness; ${Math.round((1 - bonuses.fatigueAccumulationMultiplier) * 100)}% less fatigue accumulation`, nextEffect: "Restores more post-match fitness and reduces fatigue build-up.", nextCost: 1_800_000, costGrowth: 1.5 },
 { id: "recruiting", name: "Recruiting Facilities", level: facilities.recruiting ?? 1, effect: `${Math.round(bonuses.scoutingAccuracy * 100)}% draft scouting accuracy and player assessment quality`, nextEffect: "Improves draft scouting accuracy and player assessments.", nextCost: 1_200_000, costGrowth: 1.4 },
 { id: "academy", name: "Academy", level: facilities.academy ?? 3, effect: `Academy level ${facilities.academy ?? 3} of 5`, nextEffect: "Adds academy capacity and improves intake quality, player development and talent assessment.", nextCost: 200_000, costGrowth: 1.5 },
 { id: "matchdayFanExperience", name: "Matchday Fan Experience", level: facilities.matchdayFanExperience ?? 1, effect: `+${((bonuses.gateReceiptsMultiplier - 1) * 100).toFixed(0)}% gate receipts; +${(bonuses.membershipGrowthBonus * 100).toFixed(1)}% annual membership growth`, nextEffect: `Slightly lifts gate receipts (+2%) and annual membership growth (+0.3%), and gives supporter satisfaction +${FAN_EXPERIENCE_SATISFACTION_GAIN} when complete.`, nextCost: 1_600_000, costGrowth: 1.45 },
 ];
}

export function calculateClubFinances({ club, roster = [], playerContracts = {}, administrationState = {}, seasonState = {} }) {
 const seasonNow = Number(seasonState.seasonYear ?? 2027);
 const economy = getEconomyFactor(seasonNow);
 const facilities = administrationState.facilities ?? {};
 const commercial = administrationState.commercial ?? {};
 const activeIds = new Set(roster.map((player) => String(player.id)));
 const activePlayerPayments = roster.reduce((sum, player) => {
 const contract = playerContracts[String(player.id)] ?? playerContracts[player.id] ?? {};
 const salary = contract.yearlySalaries?.[0] ?? contract.salary ?? player.contract?.yearlySalaries?.[0] ?? player.contract?.salary ?? 0;
 return sum + Math.max(0, Number(salary) || 0) + projectedContractExtras({ ...(player.contract ?? {}), ...contract });
 }, 0);
 const delistedCommitments = Object.entries(playerContracts).reduce((sum, [id, contract]) => {
 if (activeIds.has(String(id)) || !contract?.delisted || contract.club !== club?.name || contract.retired || Number(contract.yearsRemaining ?? 0) <= 0) return sum;
 return sum + Math.max(0, Number(contract.yearlySalaries?.[0] ?? contract.salary) || 0);
 }, 0);
 const playerPayments = activePlayerPayments + delistedCommitments;
 const actualConditionalPayments = roster.reduce((sum, player) => {
 const record = playerContracts[String(player.id)] ?? playerContracts[player.id] ?? {};
 return sum + (record.delisted ? 0 : actualContractExtras({ ...(player.contract ?? {}), ...record }, seasonState, player.id, club?.name));
 }, 0);
 const basePlayerPayments = playerPayments - roster.reduce((sum, player) => {
 const record = playerContracts[String(player.id)] ?? playerContracts[player.id] ?? {};
 return sum + projectedContractExtras({ ...(player.contract ?? {}), ...record });
 }, 0);
 const activeSponsor = commercial.activeSponsor;
 const memberships = Number(commercial.memberships ?? 0);
 const membershipForecast = calculateMembershipGrowth({
 memberships,
 sponsor: activeSponsor,
 supporterSatisfaction: commercial.supporterSatisfaction,
 ticketPrice: commercial.ticketPrice,
 ladder: seasonState.ladder,
 clubName: club?.name,
 fanExperienceLevel: facilities.matchdayFanExperience,
 });
 const projectedMembershipIncome = memberships * MEMBERSHIP_FEE * economy;
 const homeMatches = HOME_MATCHES;
 const ticketPrice = clamp(Number(commercial.ticketPrice ?? STANDARD_TICKET_PRICE), 25, 100);
 const satisfactionAttendance = clamp(0.85 + Number(commercial.supporterSatisfaction ?? 68) / 500, 0.85, 1.08);
 const gateReceipts = Math.round(memberships * GATE_ATTENDANCE_RATE * ticketPrice * homeMatches * satisfactionAttendance * calculateTicketAttendanceFactor(ticketPrice) * economy * getFacilityBonuses(facilities).gateReceiptsMultiplier);
 const ladder = seasonState.ladder ?? [];
 const rank = ladder.findIndex((entry) => entry.club === club?.name) + 1;
 const recentSuccess = rank > 0 ? clamp((19 - rank) / 18, 0.05, 0.95) : 0.5;
 const income = {
 sponsorship: Math.max(0, Number(activeSponsor?.annualValue ?? 0)),
 aflDistribution: calculateAflDistribution(memberships, seasonNow),
 memberships: Math.round(projectedMembershipIncome),
 gateReceipts,
 };
 const facilityRunningCosts = FACILITY_KEYS.reduce((sum, key) => sum + getFacilityRunningCost(key, facilities[key] ?? 1), 0);
 const staffPayroll = (administrationState.staff ?? []).reduce((sum, person) => sum + Math.max(0, Number(person.salary ?? 0)), 0);
 const expenses = {
 playerSalaries: playerPayments,
 footballDepartment: Math.round(FOOTBALL_DEPARTMENT_BASE_SPEND * economy) + staffPayroll,
 medical: Math.round(1_100_000 * economy * (1 + Math.max(0, Number(facilities.medical ?? 1) - 1) * 0.04)),
 facilities: Math.round((650_000 + facilityRunningCosts) * economy),
 travel: Math.round(1_350_000 * economy),
 administration: Math.round(2_650_000 * economy),
 };
 const annualIncome = Object.values(income).reduce((sum, value) => sum + value, 0);
 const annualExpenses = Object.values(expenses).reduce((sum, value) => sum + value, 0);
 const incomePerRound = Object.fromEntries(Object.entries(income).map(([key, value]) => [key, Math.round(value / HOME_AND_AWAY_ROUNDS)]));
 const expensesPerRound = Object.fromEntries(Object.entries(expenses).map(([key, value]) => [key, Math.round(value / HOME_AND_AWAY_ROUNDS)]));
 const incomeTotalPerRound = Object.values(incomePerRound).reduce((sum, value) => sum + value, 0);
 const expensesTotalPerRound = Object.values(expensesPerRound).reduce((sum, value) => sum + value, 0);
 const netIncomePerRound = incomeTotalPerRound - expensesTotalPerRound;
 const currentRound = clamp(Number(seasonState.round ?? 1), 1, HOME_AND_AWAY_ROUNDS + 1);
 const currentSeason = Number(seasonState.seasonYear ?? 2027);
 const accruedSeason = Number(administrationState.lastAccruedSeason ?? currentSeason);
 const elapsedRounds = currentSeason > accruedSeason
 ? Math.max(0, (currentSeason - accruedSeason - 1) * HOME_AND_AWAY_ROUNDS + (HOME_AND_AWAY_ROUNDS - Number(administrationState.lastAccruedRound ?? 0)) + currentRound - 1)
 : Math.max(0, currentRound - Number(administrationState.lastAccruedRound ?? 0) - 1);
 const cashBalance = Number(administrationState.cashBalance ?? 0) + (administrationState.accountingMode === "DAILY" ? 0 : netIncomePerRound * elapsedRounds);
 const roundsRemaining = Math.max(0, HOME_AND_AWAY_ROUNDS - currentRound + 1);
 const projectedEndBalance = cashBalance + netIncomePerRound * roundsRemaining;

 return {
 seasonYear: seasonNow,
 salaryCap: getConfiguredSalaryCap(seasonNow, administrationState),
 effectiveSalaryCap: getConfiguredEffectiveSalaryCap(seasonNow, administrationState.salaryCapBank, administrationState),
 capAllowance: getConfiguredCapAllowance(seasonNow, administrationState.salaryCapBank, administrationState),
 capEnforced: isSalaryCapEnforced(administrationState),
 salaryCapBank: getActiveCapBank(administrationState.salaryCapBank, seasonNow),
 combinedPayments: playerPayments,
 basePlayerPayments,
 actualConditionalPayments,
 minimumSpend: getConfiguredMinimumSpend(seasonNow, administrationState),
 playerPayments,
 remainingCap: getConfiguredEffectiveSalaryCap(seasonNow, administrationState.salaryCapBank, administrationState) - playerPayments,
 income,
 expenses,
 incomePerRound,
 expensesPerRound,
 incomeTotalPerRound,
 expensesTotalPerRound,
 netIncomePerRound,
 annualIncome,
 annualExpenses,
 cashBalance,
 projectedEndBalance,
 roundsRemaining,
 memberships,
 projectedMemberships: membershipForecast.memberships,
 recentSuccess,
 };
}

export function getAccruedCashState(administrationState, finance, seasonState = {}) {
 return {
 ...administrationState,
 cashBalance: Math.round(finance.cashBalance),
 lastAccruedRound: Math.max(0, Number(seasonState.round ?? 1) - 1),
 lastAccruedSeason: Number(seasonState.seasonYear ?? 2027),
 };
}
