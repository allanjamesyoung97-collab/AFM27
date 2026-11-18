// Hidden personality attributes that drive contract negotiations.
// Each value is 0-100. Generated deterministically from player ID.

const STATE_MAP = {
  Adelaide: "SA",
  "Port Adelaide": "SA",
  Fremantle: "WA",
  "West Coast": "WA",
  Sydney: "NSW",
  GWS: "NSW",
  Brisbane: "QLD",
  "Gold Coast": "QLD",
  Geelong: "VIC",
  Carlton: "VIC",
  Collingwood: "VIC",
  Essendon: "VIC",
  Hawthorn: "VIC",
  Melbourne: "VIC",
  "North Melbourne": "VIC",
  Richmond: "VIC",
  "St Kilda": "VIC",
  "Western Bulldogs": "VIC",
};

export const clubStateMap = STATE_MAP;

export function getStateForClub(clubName) {
  return STATE_MAP[clubName] ?? "VIC";
}

// Seeded pseudo-random from a numeric ID — deterministic so a player's
// personality is stable across reloads.
function seededValue(seed, offset = 0) {
  const x = Math.sin(seed * 9301 + offset * 49297) * 233280;
  return x - Math.floor(x);
}

function seededInt(seed, min, max, offset = 0) {
  return Math.round(min + seededValue(seed, offset) * (max - min));
}

// Career stage thresholds — priorities shift as players age.
export const careerStages = {
  YOUNG_PROSPECT: {
    maxAge: 21,
    label: "Young Prospect",
    weights: { development: 40, role: 35, money: 25 },
  },
  DEVELOPING: {
    maxAge: 24,
    label: "Developing Player",
    weights: { development: 30, role: 35, money: 35 },
  },
  PRIME: {
    maxAge: 29,
    label: "Prime Player",
    weights: { money: 50, success: 25, role: 25 },
  },
  VETERAN: {
    maxAge: 99,
    label: "Veteran",
    weights: { success: 45, money: 20, security: 35 },
  },
};

export function getCareerStage(age) {
  if (age <= 21) return careerStages.YOUNG_PROSPECT;
  if (age <= 24) return careerStages.DEVELOPING;
  if (age <= 29) return careerStages.PRIME;
  return careerStages.VETERAN;
}

export function getCurrentCareerPersonality(player) {
  const personality = player?.personality ?? {};
  const stage = getCareerStage(Number(player?.age ?? 25));
  return {
    ...personality,
    careerStage: stage.label,
    careerStageKey: Object.keys(careerStages).find((key) => careerStages[key] === stage),
    negotiationWeights: generateNegotiationWeights(personality, stage),
  };
}

// Playing roles a club can promise in a contract.
export const playingRoles = [
  { id: "CLUB_SUPERSTAR", label: "Club Superstar", tierValue: 95 },
  { id: "CORE_MIDFIELDER", label: "Core Midfielder", tierValue: 85 },
  { id: "KEY_FORWARD", label: "Key Forward", tierValue: 82 },
  { id: "KEY_DEFENDER", label: "Key Defender", tierValue: 82 },
  { id: "BEST_22", label: "Best 22", tierValue: 75 },
  { id: "ROTATION", label: "Rotation", tierValue: 65 },
  { id: "DEPTH", label: "Depth", tierValue: 55 },
  { id: "DEVELOPMENT", label: "Development", tierValue: 45 },
];

export function getRoleById(roleId) {
  return playingRoles.find((r) => r.id === roleId) ?? playingRoles[4];
}

// Promise types — contracts can include these, breaking them damages trust.
export const promiseTypes = [
  { id: "MIDFIELD_ROLE", label: "Guaranteed midfield role" },
  { id: "LEADERSHIP_ROLE", label: "Leadership group opportunity" },
  { id: "KEY_DEFENDER_DEV", label: "Develop as key defender" },
  { id: "BEST_22_GUARANTEE", label: "Best 22 guaranteed" },
  { id: "CAPTAINCY_PATHWAY", label: "Captaincy pathway" },
  { id: "FORWARD_LINE_ROLE", label: "Preferred forward line role" },
];

// Agent personality archetypes.
export const agentArchetypes = {
  EASY: {
    label: "Easy",
    aggression: 30,
    flexibility: 80,
    greed: 30,
    description: "Straightforward negotiations, quick to accept fair offers.",
  },
  PROFESSIONAL: {
    label: "Professional",
    aggression: 50,
    flexibility: 60,
    greed: 50,
    description: "Predictable, reasonable demands. Business-like.",
  },
  AGGRESSIVE: {
    label: "Aggressive",
    aggression: 84,
    flexibility: 31,
    greed: 70,
    description: "Constant counters, pushes for every last dollar.",
  },
  SHARK: {
    label: "Shark",
    aggression: 95,
    flexibility: 15,
    greed: 90,
    description: "Maximum money. Will walk away from anything below top dollar.",
  },
  INFLUENCER: {
    label: "Influencer",
    aggression: 75,
    flexibility: 40,
    greed: 65,
    description: "Pushes free agency, leverages rival interest aggressively.",
  },
};

export const agentArchetypeKeys = Object.keys(agentArchetypes);

function pickArchetype(seed) {
  const roll = seededValue(seed, 7777);
  if (roll < 0.3) return "EASY";
  if (roll < 0.55) return "PROFESSIONAL";
  if (roll < 0.78) return "AGGRESSIVE";
  if (roll < 0.92) return "SHARK";
  return "INFLUENCER";
}

// Negotiation issue weights — how much each factor matters to a player.
// Total = 100. These shift based on career stage and personality.
export function generateNegotiationWeights(personality, careerStage) {
  const { loyalty = 50, ambition = 50, greed = 50, premiershipDesire = 50, locationImportance = 50, coachRelationship = 50 } = personality;
  const stage = careerStage;

  let salary, roleSecurity, clubSuccess, location, coachingStaff, contractLength;

  if (stage === careerStages.YOUNG_PROSPECT) {
    salary = 20;
    roleSecurity = 35;
    clubSuccess = 15;
    location = 12;
    coachingStaff = 13;
    contractLength = 5;
  } else if (stage === careerStages.DEVELOPING) {
    salary = 28;
    roleSecurity = 30;
    clubSuccess = 17;
    location = 11;
    coachingStaff = 10;
    contractLength = 4;
  } else if (stage === careerStages.PRIME) {
    salary = 35;
    roleSecurity = 20;
    clubSuccess = 20;
    location = 10;
    coachingStaff = 10;
    contractLength = 5;
  } else {
    salary = 20;
    roleSecurity = 25;
    clubSuccess = 30;
    location = 13;
    coachingStaff = 8;
    contractLength = 4;
  }

  // Personality adjustments — redistribute, keep total at 100.
  const ambitionShift = (ambition - 50) * 0.1;
  const greedShift = (greed - 50) * 0.12;
  const successShift = (premiershipDesire - 50) * 0.1;
  const locationShift = (locationImportance - 50) * 0.08;
  const coachShift = (coachRelationship - 50) * 0.06;
  const loyaltyShift = (loyalty - 50) * 0.06;

  salary = salary + greedShift - loyaltyShift;
  clubSuccess = clubSuccess + ambitionShift + successShift;
  location = location + locationShift;
  coachingStaff = coachingStaff + coachShift;
  roleSecurity = roleSecurity - ambitionShift;

  // Clamp and normalize to 100.
  const raw = { salary, contractLength, roleSecurity, clubSuccess, location, coachingStaff };
  const total = Object.values(raw).reduce((s, v) => s + Math.max(0, v), 0);

  const normalized = {};
  for (const [key, value] of Object.entries(raw)) {
    normalized[key] = Math.round((Math.max(0, value) / total) * 100);
  }

  // Fix rounding remainder.
  const normTotal = Object.values(normalized).reduce((s, v) => s + v, 0);
  if (normTotal !== 100) {
    normalized.salary += 100 - normTotal;
  }

  return normalized;
}

// Main entry: generates the full personality object for a player.
export function generatePersonality(player) {
  const seed = player.id ?? Math.floor(Math.random() * 100000);
  const age = player.age ?? 25;
  const careerStage = getCareerStage(age);

  const loyalty = seededInt(seed, 35, 95, 1);
  const ambition = seededInt(seed, 30, 95, 2);
  const professionalism = seededInt(seed, 50, 98, 3);
  const greed = seededInt(seed, 20, 95, 4);
  const premiershipDesire = seededInt(seed, 40, 98, 5);
  // How much a player cares about where he lives (not where he was born).
  const locationImportance = seededInt(seed, 30, 95, 6);
  const coachRelationship = seededInt(seed, 30, 85, 7);
  const mediaInfluence = seededInt(seed, 15, 75, 8);
  const riskTolerance = seededInt(seed, 25, 90, 9);

  const personality = {
    loyalty,
    ambition,
    professionalism,
    greed,
    premiershipDesire,
    locationImportance,
    coachRelationship,
    mediaInfluence,
    riskTolerance,
  };

  const archetypeKey = pickArchetype(seed);
  const agentBase = agentArchetypes[archetypeKey];
  const agent = {
    archetype: archetypeKey,
    label: agentBase.label,
    description: agentBase.description,
    aggression: agentBase.aggression + seededInt(seed, -5, 5, 10),
    flexibility: agentBase.flexibility + seededInt(seed, -5, 5, 11),
    greed: agentBase.greed + seededInt(seed, -5, 5, 12),
  };

  const negotiationWeights = generateNegotiationWeights(personality, careerStage);

  return {
    ...personality,
    careerStage: careerStage.label,
    careerStageKey: Object.keys(careerStages).find((k) => careerStages[k] === careerStage),
    negotiationWeights,
    agent,
    leaveDesire: 0,
    relationships: {
      seniorCoach: coachRelationship,
      club: loyalty,
      fanbase: 50 + seededInt(seed, -15, 30, 13),
      leadershipGroup: 50 + seededInt(seed, -10, 20, 14),
    },
    promises: [],
    promiseHistory: [],
  };
}
