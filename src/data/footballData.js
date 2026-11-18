// Canonical attribute keys and position roles for profiles, analytics and future matchups.
import { getPlayerHeightCm } from "./playerHeights.js";
export const CORE_ATTRIBUTES_BY_POSITION = {
  MID: [
    "kicking",
    "handball",
    "vision",
    "decisionMaking",
    "composure",
    "workRate",
    "determination",
    "endurance",
    "groundBallGet",
    "contestedBall",
    "runAndCarry",
    "gameAwareness",
    "discipline"
  ],

  WING: [
    "speed",
    "acceleration",
    "agility",
    "endurance",
    "groundBallGet",
    "runAndCarry",
    "vision",
    "kicking",
    "gameAwareness",
    "durability"
  ],

  KPF: [
    "marking",
    "goalSense",
    "kicking",
    "strength",
    "verticalLeap",
    "positioning",
    "gameAwareness",
    "durability",
    "discipline"
  ],

  KPD: [
    "marking",
    "spoiling",
    "strength",
    "positioning",
    "competitiveness",
    "gameAwareness",
    "durability",
    "discipline",
    "tackling"
  ],

  HF: [
    "goalSense",
    "kicking",
    "vision",
    "creativity",
    "speed",
    "groundBallGet",
    "contestedBall",
    "runAndCarry",
    "gameAwareness",
    "discipline"
  ],

  FF: [
    "goalSense",
    "marking",
    "kicking",
    "speed",
    "gameAwareness",
    "discipline",
    "durability"
  ],

  HB: [
    "kicking",
    "vision",
    "decisionMaking",
    "speed",
    "positioning",
    "groundBallGet",
    "runAndCarry",
    "gameAwareness",
    "discipline"
  ],

  BP: [
    "spoiling",
    "tackling",
    "positioning",
    "strength",
    "marking",
    "gameAwareness",
    "discipline",
    "durability"
  ],

  RUC: [
    "strength",
    "verticalLeap",
    "endurance",
    "competitiveness",
    "contestedBall",
    "ruckCraft",
    "positioning",
    "gameAwareness",
    "durability",
    "discipline"
  ]
};

export const TECHNICAL_ATTRIBUTES = [
  "kicking",
  "handball",
  "marking",
  "goalSense",
  "tackling",
  "spoiling",
  "groundBallGet",
  "contestedBall",
  "ruckCraft"
];

export const PHYSICAL_ATTRIBUTES = [
  "speed",
  "acceleration",
  "agility",
  "endurance",
  "strength",
  "verticalLeap",
  "durability",
  "runAndCarry"
];

export const FOOTBALL_IQ_ATTRIBUTES = [
  "vision",
  "decisionMaking",
  "positioning",
  "composure",
  "leadership",
  "creativity",
  "gameAwareness"
];

export const MENTAL_ATTRIBUTES = [
  "workRate",
  "professionalism",
  "determination",
  "teamwork",
  "competitiveness",
  "discipline"
];

/** Shared player data vocabulary. IDs match existing save data and rating keys. */
export const ATTRIBUTE_GROUPS = {
  technical: TECHNICAL_ATTRIBUTES,
  physical: PHYSICAL_ATTRIBUTES,
  footballIQ: FOOTBALL_IQ_ATTRIBUTES,
  mental: MENTAL_ATTRIBUTES,
};

/** Position families are used by future matchup and line comparison systems. */
export const POSITION_FAMILIES = {
  forward: ["KPF", "FF", "HF", "FP", "FWD"],
  midfield: ["MID", "WING", "C", "RR", "ROV"],
  defence: ["KPD", "KPB", "HB", "BP", "CHB", "FB", "DEF"],
  ruck: ["RUC", "RUCK", "R"],
};

export const MATCH_PHASES = [
  "stoppage", "contest", "transition", "forwardEntry", "scoring",
  "defensiveExit", "defensiveContest", "aerialContest", "groundBall",
];

export function getPositionFamily(position) {
  const code = String(position ?? "").toUpperCase();
  return Object.entries(POSITION_FAMILIES).find(([, positions]) => positions.includes(code))?.[0] ?? null;
}

export function getAttributeLabel(attribute) {
  const labels = {
    contestedBall: "Contested ball",
    runAndCarry: "Run & carry",
  };
  if (labels[attribute]) return labels[attribute];
  return String(attribute ?? "")
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (letter) => letter.toUpperCase());
}

export const POSITIVE_TRAIT_MINIMUM = 82;
export const TRAIT_PLUS_MINIMUM = 88;

/** Trait identity and eligibility. Match effects are evaluated separately per phase. */
const trait = (id, label, category, families, phases, minimums, description, effects, extra = {}) => ({
  id, label, category, eligiblePositionFamilies: families, phases,
  attributeDrivers: Object.keys(minimums),
  // Positive traits require every driving attribute to meet the shared floor;
  // drawbacks retain their own low-stat or attribute-cap rules.
  assignmentMinimums: category === "drawback"
    ? minimums
    : Object.fromEntries(Object.entries(minimums).map(([attribute, minimum]) => [attribute, Math.max(POSITIVE_TRAIT_MINIMUM, Number(minimum) || 0)])),
  description, effects, ...extra,
});

const traitList = [
  trait("CLUTCH_PERFORMER", "Clutch Performer", "general", ["forward", "midfield", "defence", "ruck"], ["scoring", "transition", "stoppage"], { composure: 82, decisionMaking: 82, determination: 82, endurance: 82 }, "In the last five minutes of a close match, improves execution if endurance and fitness hold up.", { effectiveDisposal: .025, scoringRate: .035, clearance: .018 }),
  trait("X_FACTOR", "X Factor", "general", ["forward", "midfield"], ["transition", "forwardEntry", "scoring"], { speed: 82, creativity: 80, agility: 78 }, "Creates chances in space when pace or creativity troubles the direct opponent.", { effectiveDisposal: .026, inside50: .032, scoringRate: .035 }),
  trait("FIELD_GENERAL", "Field General", "general", ["midfield", "defence"], ["transition", "defensiveContest", "stoppage"], { leadership: 79, vision: 77, gameAwareness: 79, composure: 76 }, "Organises nearby play under pressure and improves disposal decisions.", { effectiveDisposal: .028, intercept: .015 }),
  trait("DURABLE_PROFESSIONAL", "Durable Professional", "general", ["forward", "midfield", "defence", "ruck"], ["stoppage", "transition", "defensiveContest"], { durability: 81, professionalism: 77, workRate: 76 }, "Handles workload better and reduces minor injury risk.", { injuryRisk: -.25, fatigue: -.04 }),
  trait("HOT_HEAD", "Hot Head", "drawback", ["forward", "midfield", "defence", "ruck"], ["contest", "stoppage", "defensiveContest"], { competitiveness: 76, determination: 73 }, "Brings extra contest intensity but concedes more free kicks and risks tribunal attention when discipline is poor.", { contested: .018, tackle: .018, freeKickAgainst: .025 }, { assignmentMaximums: { discipline: 59, composure: 66 } }),
  trait("RISKY_CREATOR", "Risky Creator", "tradeoff", ["forward", "midfield", "defence"], ["transition", "forwardEntry"], { creativity: 80, vision: 76, kicking: 73, decisionMaking: 68 }, "Attempts line-breaking passes; can create entries but carries turnover risk when decisions or kicking falter.", { inside50: .03, effectiveDisposal: -.012 }),
  trait("INJURY_PRONE", "Injury Prone", "drawback", ["forward", "midfield", "defence", "ruck"], ["aerialContest", "contest", "stoppage"], {}, "Repeated injuries across seasons increase the chance of another injury. This is earned through injury history, not player attributes.", { injuryRisk: .7 }, { automatic: true, historyBased: true }),
  trait("HIGH_FLYER", "High Flyer", "forward", ["forward", "defence", "ruck"], ["aerialContest", "forwardEntry", "defensiveContest"], { marking: 82, verticalLeap: 82, durability: 70 }, "Attacks high balls against tall targets; more aerial contests increase landing and contact injury risk.", { mark: .055, intercept: .038, injuryRisk: .45 }),
  trait("CRUMBING_INSTINCT", "Crumbing Instinct", "forward", ["forward"], ["groundBall", "scoring", "forwardEntry"], { groundBallGet: 79, speed: 77, agility: 76, goalSense: 76 }, "Reads spills inside 50 and creates shots from loose balls.", { scoringRate: .027, inside50: .018 }, { eligiblePositions: ["FF", "HF", "FP", "KPF"], maxHeightCm: 191 }),
  trait("SET_SHOT_SPECIALIST", "Set Shot Specialist", "forward", ["forward"], ["scoring"], { goalSense: 81, composure: 78, kicking: 79 }, "Improves set-shot conversion when the player is balanced and fit.", { scoringRate: .036 }),
  trait("DEFENSIVE_FORWARD", "Defensive Forward", "forward", ["forward"], ["defensiveContest", "groundBall"], { tackling: 78, workRate: 78, speed: 73, discipline: 70 }, "Pressures defenders and forces hurried disposal without conceding unnecessary free kicks.", { tackle: .04, contested: .012 }),
  trait("LEADING_TARGET", "Leading Target", "forward", ["forward"], ["forwardEntry", "aerialContest"], { acceleration: 78, positioning: 79, marking: 77 }, "Times leads into space to receive cleaner forward entries.", { mark: .038, inside50: .02 }, { eligiblePositions: ["KPF", "FF", "HF"] }),
  trait("CONTESTED_BULL", "Contested Bull", "midfield", ["midfield", "ruck"], ["stoppage", "contest", "groundBall"], { groundBallGet: 82, strength: 78, contestedBall: 78 }, "Wins hard balls and clearances when contested-ball skill, strength and ground-ball ability hold up.", { contested: .05, clearance: .035, tackle: .025, fatigue: .025 }),
  trait("CLEARANCE_READER", "Clearance Reader", "midfield", ["midfield"], ["stoppage", "groundBall"], { gameAwareness: 80, positioning: 78, vision: 75, decisionMaking: 75 }, "Anticipates the tap and gets first use when teammates create a stoppage contest.", { clearance: .043, effectiveDisposal: .014 }),
  trait("OUTSIDE_RUNNER", "Outside Runner", "midfield", ["midfield"], ["transition", "forwardEntry"], { speed: 79, endurance: 81, workRate: 78, kicking: 73 }, "Creates repeat uncontested outlets and carries the ball through transition.", { inside50: .034, effectiveDisposal: .018 }, { eligiblePositions: ["MID", "WING"] }),
  trait("TAGGING_SPECIALIST", "Tagging Specialist", "midfield", ["midfield"], ["stoppage", "defensiveContest"], { endurance: 79, tackling: 80, discipline: 76, gameAwareness: 76 }, "Restricts a direct midfield opponent at stoppages, with less offensive involvement.", { tackle: .04, opponentEffectiveDisposal: -.025, inside50: -.012 }),
  trait("UNDERSIZED_MID", "Undersized Mid", "drawback", ["midfield"], ["stoppage"], {}, "At 187 cm or shorter with strength below 83, gives up leverage at stoppages against a stronger, non-undersized midfielder and wins fewer clearances.", { clearance: -.045 }, { maxHeightCm: 187, assignmentMaximums: { strength: 82 }, attributeDrivers: ["strength"], automatic: true }),
  trait("ONE_PACE_MIDFIELDER", "One-Pace Midfielder", "drawback", ["midfield"], ["transition", "defensiveContest"], { endurance: 69 }, "Maintains work rate but struggles to accelerate into space or recover after repeat sprints.", { inside50: -.025, intercept: -.018 }, { assignmentMaximums: { speed: 65, acceleration: 65 }, attributeDrivers: ["endurance", "speed", "acceleration"] }),
  trait("INTERCEPT_DEFENDER", "Intercept Defender", "defence", ["defence"], ["aerialContest", "defensiveContest"], { marking: 79, positioning: 81, gameAwareness: 79, decisionMaking: 74 }, "Reads opposition entries to mark or intercept; loses value when isolated against a superior aerial opponent.", { intercept: .048, mark: .02 }),
  trait("LOCKDOWN_DEFENDER", "Lockdown Defender", "defence", ["defence"], ["defensiveContest", "aerialContest"], { positioning: 79, strength: 76, spoiling: 79, discipline: 75 }, "Limits a direct forward's marking and scoring without excessive free kicks.", { opponentMark: -.04, opponentScoringRate: -.025, intercept: .01 }),
  trait("SPOILING_SPECIALIST", "Spoiling Specialist", "defence", ["defence"], ["aerialContest", "defensiveContest"], { spoiling: 82, verticalLeap: 77, strength: 76, gameAwareness: 73 }, "Disrupts high entries against tall forwards, often leaving a ground-ball contest.", { opponentMark: -.05, intercept: .012 }),
  trait("REBOUND_LAUNCHER", "Rebound Launcher", "defence", ["defence"], ["transition", "defensiveContest"], { kicking: 81, speed: 77, vision: 78, decisionMaking: 74 }, "Turns defensive wins into fast attacks; ambitious exits carry turnover risk.", { inside50: .03, effectiveDisposal: -.008 }, { eligiblePositions: ["HB", "BP", "KPD"] }),
  trait("BALL_WATCHER", "Ball Watcher", "drawback", ["defence"], ["defensiveContest", "aerialContest"], {}, "Gets drawn to the ball and can leave a direct opponent free.", { intercept: -.025, opponentMark: .035 }, { assignmentMaximums: { gameAwareness: 62, positioning: 64, workRate: 70 }, attributeDrivers: ["gameAwareness", "positioning", "workRate"] }),
  trait("TAP_SPECIALIST", "Tap Specialist", "ruck", ["ruck"], ["stoppage"], { ruckCraft: 82, verticalLeap: 79, positioning: 76, strength: 74 }, "Directs hit-outs toward midfielders when craft and reach beat the opposing ruckman.", { hitout: .055, clearance: .014 }),
  trait("FOLLOW_UP_RUCK", "Follow-Up Ruck", "ruck", ["ruck"], ["stoppage", "groundBall"], { groundBallGet: 77, endurance: 76, agility: 72, workRate: 75 }, "Wins ground balls or tackles after the tap, at some fatigue cost.", { contested: .034, tackle: .034, fatigue: .02 }),
  trait("RUCK_LIABILITY", "Ruck Liability", "drawback", ["ruck"], ["stoppage"], {}, "Weak positioning or craft lets an opposing ruckman direct cleaner hit-outs.", { hitout: -.055, opponentClearance: .02 }, { assignmentMaximums: { ruckCraft: 62, strength: 69, positioning: 68 }, attributeDrivers: ["ruckCraft", "strength", "positioning"] }),
];

export const TRAIT_DEFINITIONS = Object.freeze(Object.fromEntries(traitList.map((item) => [item.id, item])));

const legacyTraitIds = Object.fromEntries(
  Object.values(TRAIT_DEFINITIONS).flatMap((trait) => [
    [trait.id, trait.id],
    [trait.label.toUpperCase().replace(/[^A-Z0-9]+/g, "_"), trait.id],
  ]),
);

const removedTraitIds = new Set(["FRAGILE", "FRAGILE_TRAIT"]);

// Historical injury records documented for this starting player pool. These
// seed the trait immediately; future seasons can earn it from in-game records.
const injuryPronePlayerNames = new Set([
  "Luke Pedlar", "Wayne Milera", "Isaac Cumming", "Izak Rankine", "Jordon Butts",
  "Lincoln McCarthy", "Tom Doedee", "Darcy Gardiner", "Keidean Coleman", "Oscar Allen", "Eric Hipwood", "Hugh McCluggage", "Jack Payne",
  "Adam Cerra", "Mitch McGovern", "Zac Williams", "Sam Walsh",
  "Jordan De Goey", "Darcy Moore", "Dan McStay", "Daniel McStay", "Jamie Elliott", "Jeremy Howe",
  "Darcy Parish", "Jordan Ridley", "Zach Reid", "Matt Guelfi", "Harrison Jones", "Nik Cox", "Lewis Hayes", "Nic Martin",
  "Sean Darcy", "Hayden Young", "Brennan Cox", "Sam Sturt", "Alex Pearce", "Heath Chapman",
  "Toby Conway", "Jack Martin", "Jake Kolodjashnij",
  "Lachie Weller", "Will Graham", "Wil Powell",
  "Josh Kelly", "Stephen Coniglio", "Brent Daniels", "Sam Taylor",
  "Will Day", "Mitch Lewis", "James Blanck",
  "Changkuoth Jiath", "Christian Salem", "Jai Culley", "Andy Moniz-Wakefield", "Jake Lever", "Jack Viney",
  "George Wardlaw", "Callum Coleman-Jones", "Brayden George", "Charlie Comben", "Griffin Logue",
  "Connor Rozee", "Sam Powell-Pepper", "Josh Sinn", "Ivan Soldo",
  "Dion Prestia", "Tom Lynch", "Josh Gibcus", "Jacob Hopper", "Josh Smillie",
  "Max King", "Hunter Clark", "Liam Henry",
  "Callum Mills", "Joel Amartey", "Lewis Melican", "Taylor Adams", "Logan McDonald",
  "Elliot Yeo", "Elijah Hewett", "Noah Long", "Matt Flynn",
  "Adam Treloar", "Riley Garcia", "Nick Coffield", "Cody Weightman", "Laitham Vandermeer",
]);

const normalizedPlayerName = (player) => String(player?.name ?? "").trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const seededInjuryProneNames = new Set([...injuryPronePlayerNames].map((name) => name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim()));

function isInjuryProneFromHistory(player, injuryHistory) {
  if (seededInjuryProneNames.has(normalizedPlayerName(player))) return true;
  const events = Array.isArray(injuryHistory?.injuryEvents) ? injuryHistory.injuryEvents : [];
  const dated = events.map((event) => {
    const date = event?.date instanceof Date ? event.date : new Date(event?.date);
    return Number.isNaN(date.getTime()) ? null : date.getFullYear();
  }).filter(Number.isFinite);
  if (dated.length < 3) return false;
  const latestYear = Math.max(...dated);
  const recent = dated.filter((year) => year >= latestYear - 2);
  return recent.length >= 3 && new Set(recent).size >= 2;
}

/** Keep unknown legacy traits intact so importing old saves never discards data. */
export function normalizeTraitIds(traits) {
  if (!Array.isArray(traits)) return [];
  return [...new Set(traits.map((trait) => {
    const raw = typeof trait === "string" ? trait : trait?.id;
    if (typeof raw !== "string" || !raw.trim()) return null;
    const key = raw.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_");
    if (removedTraitIds.has(key)) return null;
    return legacyTraitIds[key] ?? raw.trim();
  }).filter(Boolean))];
}

export function getTraitDefinition(traitId) {
  return TRAIT_DEFINITIONS[traitId] ?? null;
}

const traitEligible = (player, trait) => {
  const positions = Array.isArray(player?.positions) ? player.positions : [];
  const families = new Set(positions.map(getPositionFamily).filter(Boolean));
  if (!trait.eligiblePositionFamilies.some((family) => families.has(family))) return false;
  if (trait.eligiblePositions && !positions.some((position) => trait.eligiblePositions.includes(position))) return false;
  if (trait.maxHeightCm) {
    const height = Number(getPlayerHeightCm(player));
    if (!Number.isFinite(height) || height <= 0 || height > trait.maxHeightCm) return false;
  }
  return Object.entries(trait.assignmentMinimums).every(([key, minimum]) => Number(player?.attributes?.[key]) >= minimum)
    && Object.entries(trait.assignmentMaximums ?? {}).every(([key, maximum]) => Number(player?.attributes?.[key]) <= maximum);
};

export function getEligiblePlayerTraits(player, injuryHistory = null) {
  return traitList.filter((definition) => traitEligible(player, definition)
    && (!definition.historyBased || isInjuryProneFromHistory(player, injuryHistory)));
}

/** Trait+ requires at least 88 in every positive assignment attribute. */
export function getPlayerTraitTier(player, traitId) {
  const definition = TRAIT_DEFINITIONS[traitId];
  if (!definition || !traitEligible(player, definition)) return "normal";
  const required = Object.keys(definition.assignmentMinimums);
  return definition.category !== "drawback" && required.length > 0
    && required.every((key) => Number(player?.attributes?.[key]) >= TRAIT_PLUS_MINIMUM) ? "plus" : "normal";
}

/** Infer at most three strengths and one drawback from current attributes. */
export function derivePlayerTraitIds(player) {
  const candidates = traitList.filter((item) => traitEligible(player, item)).map((item) => {
    const limits = [...Object.entries(item.assignmentMinimums).map(([key, min]) => Number(player.attributes[key]) - min),
      ...Object.entries(item.assignmentMaximums ?? {}).map(([key, max]) => max - Number(player.attributes[key]))];
    return { id: item.id, kind: item.category, margin: limits.reduce((sum, value) => sum + value, 0) / Math.max(1, limits.length) };
  });
  const ranked = (list) => list.sort((a, b) => b.margin - a.margin || a.id.localeCompare(b.id));
  const automatic = candidates.filter((item) => TRAIT_DEFINITIONS[item.id]?.automatic && !TRAIT_DEFINITIONS[item.id]?.historyBased);
  return [...ranked(candidates.filter((item) => item.kind !== "drawback" && !TRAIT_DEFINITIONS[item.id]?.automatic)).slice(0, 3),
    ...ranked(candidates.filter((item) => item.kind === "drawback" && !TRAIT_DEFINITIONS[item.id]?.automatic)).slice(0, 1),
    ...automatic].map((item) => item.id);
}

export function getPlayerTraitIds(player, injuryHistory = null) {
  const hasHistoryTrait = isInjuryProneFromHistory(player, injuryHistory);
  if (Array.isArray(player?.activeTraits)) {
    const selected = [...new Set(normalizeTraitIds(player.activeTraits))]
      .filter((id) => TRAIT_DEFINITIONS[id] && traitEligible(player, TRAIT_DEFINITIONS[id]));
    const automatic = traitList.filter((trait) => trait.automatic && traitEligible(player, trait)
      && (!trait.historyBased || hasHistoryTrait)).map((trait) => trait.id);
    return [
      ...selected.filter((id) => TRAIT_DEFINITIONS[id].category !== "drawback" && !TRAIT_DEFINITIONS[id].automatic).slice(0, 3),
      ...selected.filter((id) => TRAIT_DEFINITIONS[id].category === "drawback" && !TRAIT_DEFINITIONS[id].automatic).slice(0, 1),
      ...automatic,
    ];
  }
  // Existing saves contain only the original small trait set. Merge those
  // identities with current attribute-derived traits so they can gain new ones.
  const saved = normalizeTraitIds(player?.traits);
  const known = saved.filter((id) => TRAIT_DEFINITIONS[id] && traitEligible(player, TRAIT_DEFINITIONS[id]));
  const derived = derivePlayerTraitIds(player);
  const automatic = traitList.filter((trait) => trait.automatic && traitEligible(player, trait)
    && (!trait.historyBased || hasHistoryTrait)).map((trait) => trait.id);
  const strengths = [...new Set([...known, ...derived])].filter((id) => TRAIT_DEFINITIONS[id]?.category !== "drawback" && !TRAIT_DEFINITIONS[id]?.automatic).slice(0, 3);
  const drawbacks = [...new Set([...known, ...derived])].filter((id) => TRAIT_DEFINITIONS[id]?.category === "drawback" && !TRAIT_DEFINITIONS[id]?.automatic).slice(0, 1);
  return [...strengths, ...drawbacks, ...automatic, ...saved.filter((id) => !TRAIT_DEFINITIONS[id])];
}

/** Consistent read model for player analysis; does not mutate player or simulate effects. */
export function getPlayerFootballData(player, injuryHistory = null) {
  const positions = Array.isArray(player?.positions) ? player.positions : [];
  const height = getPlayerHeightCm(player);
  return {
    id: player?.id ?? null,
    name: player?.name ?? "",
    club: player?.club ?? null,
    positions,
    positionFamilies: [...new Set(positions.map(getPositionFamily).filter(Boolean))],
    heightCm: Number.isFinite(Number(height)) && Number(height) > 0 ? Number(height) : null,
    attributes: player?.attributes ?? {},
    traitIds: getPlayerTraitIds(player, injuryHistory),
  };
}
