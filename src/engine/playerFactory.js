import {
  calculateOverall,
  fitAttributesToOverall,
  generatePlayerRatings,
  isRuckEligible,
} from "./playerRatingGenerator.js";
import {
  generatePersonality
} from "../data/playerPersonalities.js";
import playerAttributeOverrides from "../data/playerAttributeOverrides.json" with { type: "json" };
import { getPlayerHeightCm } from "../data/playerHeights.js";
import { getPlayerTraitIds } from "../data/footballData.js";
import { capOverallAtPotential, getPlayerPotential } from "./potentialRules.js";

const ATTRIBUTE_REPAIR_PROFILES = {
  contestedBall: {
    drivers: {
      groundBallGet: 0.30,
      tackling: 0.20,
      strength: 0.15,
      competitiveness: 0.15,
      verticalLeap: 0.10,
      workRate: 0.05,
      gameAwareness: 0.05,
    },
    positionBonus: ["MID", "RUC", "RUCK", "HF"],
  },
  runAndCarry: {
    drivers: {
      speed: 0.28,
      acceleration: 0.22,
      agility: 0.15,
      endurance: 0.12,
      groundBallGet: 0.08,
      kicking: 0.08,
      decisionMaking: 0.04,
      vision: 0.03,
    },
    positionBonus: ["MID", "WING", "HF", "HB", "BP"],
  },
};

/** Fill newly introduced attributes from existing football skills for old data and saves. */
function repairNewAttributes(attributes = {}, player = {}) {
  const repaired = { ...attributes };
  const positions = (player.positions ?? []).map((position) => String(position).toUpperCase());

  for (const [attribute, profile] of Object.entries(ATTRIBUTE_REPAIR_PROFILES)) {
    const current = Number(repaired[attribute]);
    if (Number.isFinite(current) && current > 1 && current <= 99) continue;

    let total = 0;
    let weight = 0;
    for (const [driver, driverWeight] of Object.entries(profile.drivers)) {
      const value = Number(repaired[driver]);
      if (!Number.isFinite(value) || value <= 1) continue;
      total += value * driverWeight;
      weight += driverWeight;
    }
    const derived = weight > 0 ? total / weight : 60;
    const roleBonus = positions.some((position) => profile.positionBonus.includes(position)) ? 3 : 0;
    repaired[attribute] = Math.max(25, Math.min(99, Math.round(derived + roleBonus)));
  }

  return repaired;
}

export function createPlayer({
  id,
  name,
  club,
  age,
  positions,
  overall: startingOverall,

  tier = "Depth",

  potential = 80,

  salary = 250000,

  yearsRemaining = 2,

  traits
}) {
  const ratings =
    generatePlayerRatings({
      id,
      positions,
      ratingsSeed: {
        tier
      }
    });

  const overallLimit =
    name === "Nick Daicos" || name === "Marcus Bontempelli"
      ? 96
      : 93;
  const generatedOverall =
    startingOverall ?? ratings?.overall ?? 60;
  const safePotential = getPlayerPotential({ potential });
  const primaryPosition = positions?.[0] ?? "MID";
  const playerOverride = playerAttributeOverrides[String(id)];
  const startingRating = capOverallAtPotential({ potential: safePotential }, Math.min(overallLimit, generatedOverall));
  const fittedAttributes = fitAttributesToOverall(
    ratings?.attributes ?? {},
    primaryPosition,
    startingRating,
  );
  let attributes = {
    ...fittedAttributes,
    ...(playerOverride?.attributes ?? {}),
  };
  attributes = repairNewAttributes(attributes, { positions });
  if (!isRuckEligible(positions)) delete attributes.ruckCraft;
  let overall = playerOverride?.overall ?? (playerOverride?.attributes
    ? calculateOverall(attributes, primaryPosition)
    : startingRating);
  overall = capOverallAtPotential({ potential: safePotential }, overall);
  if (playerOverride?.attributes && calculateOverall(attributes, primaryPosition) > safePotential) {
    attributes = fitAttributesToOverall(attributes, primaryPosition, safePotential);
  }
  attributes = repairNewAttributes(attributes, { positions });

  return {
    id,
    name,
    heightCm: getPlayerHeightCm(name),
    club,
    age,
    positions,

    ratingsSeed: {
      tier
    },

    overall,

    development: {
      potential: safePotential,
      growthThisSeason: 0,
      trainingFocus:
        "Balanced"
    },

    careerStats: {
      games: 0,
      goals: 0,
      disposals: 0,
      marks: 0,
      tackles: 0,
      hitOuts: 0,
      brownlowVotes: 0,
      premierships: 0,
      allAustralians: 0,
      bestAndFairests: 0
    },

    contract: {
      salary,
      yearsRemaining
    },

    attributes,

    traits: getPlayerTraitIds({ positions, attributes, traits }),

    personality:
      generatePersonality({
        id,
        club,
        age,
        positions
      })
  };
}

/** Repair drafted players in career saves created before string IDs were seeded. */
export function repairPlayerAttributes(player) {
  const current = player?.attributes;
  const hasUsableRatings = current && Object.values(current).some((value) => Number.isFinite(Number(value)) && Number(value) > 0);
  const tier = player?.ratingsSeed?.tier ?? "Rookie";
  const position = player?.positions?.[0] ?? "MID";
  const ratings = generatePlayerRatings({ id: player?.id, positions: player?.positions, ratingsSeed: { tier } });
  const potential = getPlayerPotential(player, ratings.overall ?? 60);
  const targetOverall = capOverallAtPotential({ potential }, player?.overall ?? ratings.overall ?? 60);
  const generated = fitAttributesToOverall(ratings.attributes, position, targetOverall);
  const validCurrentRatings = hasUsableRatings && Object.keys(generated).every((attribute) => Number.isFinite(Number(current[attribute])) && Number(current[attribute]) > 0) && (isRuckEligible(player) || !Object.hasOwn(current, "ruckCraft"));
  let attributes = validCurrentRatings ? { ...current } : hasUsableRatings ? { ...generated, ...current } : generated;
  attributes = repairNewAttributes(attributes, player);
  if (!isRuckEligible(player)) delete attributes.ruckCraft;
  if (calculateOverall(attributes, position) > potential) attributes = fitAttributesToOverall(attributes, position, potential);
  attributes = repairNewAttributes(attributes, player);
  return {
    ...player,
    traits: getPlayerTraitIds({ ...player, attributes }),
    ratingsSeed: { ...(player?.ratingsSeed ?? {}), tier },
    attributes,
    overall: capOverallAtPotential({ potential }, Number.isFinite(targetOverall) ? targetOverall : calculateOverall(attributes, position)),
    potential,
    development: { ...player?.development, potential },
  };
}

export function createVeteranPlayer({
  id,
  name,
  club,
  age,
  positions,
  overall,

  tier = "Best22",

  salary = 500000,

  yearsRemaining = 1,

  traits
}) {
  return createPlayer({
    id,
    name,
    club,
    age,
    positions,
    overall,
    tier,
    potential: Math.max(75, age + 40, Number(overall ?? 60)),
    salary,
    yearsRemaining,
    traits
  });
}

export function createYoungPlayer({
  id,
  name,
  club,
  age,
  positions,
  overall,

  tier = "Depth",

  potential = 90,

  salary = 120000,

  yearsRemaining = 2,

  traits
}) {
  return createPlayer({
    id,
    name,
    club,
    age,
    positions,
    overall,
    tier,
    potential,
    salary,
    yearsRemaining,
    traits
  });
}

export function createStarPlayer({
  id,
  name,
  club,
  age,
  positions,
  overall,

  salary = 850000,

  yearsRemaining = 4,

  potential = 92,

  traits
}) {
  return createPlayer({
    id,
    name,
    club,
    age,
    positions,
    overall,
    tier: "Star",
    potential,
    salary,
    yearsRemaining,
    traits
  });
}

export function createElitePlayer({
  id,
  name,
  club,
  age,
  positions,
  overall,

  salary = 1100000,

  yearsRemaining = 5,

  potential = 99,

  traits
}) {
  return createPlayer({
    id,
    name,
    club,
    age,
    positions,
    overall,
    tier: "Elite",
    potential,
    salary,
    yearsRemaining,
    traits
  });
}
