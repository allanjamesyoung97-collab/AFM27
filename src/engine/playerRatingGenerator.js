const tiers = {
  Elite: {
    min: 88,
    max: 99
  },

  Star: {
    min: 82,
    max: 90
  },

  Best22: {
    min: 73,
    max: 84
  },

  Depth: {
    min: 62,
    max: 76
  },

  Rookie: {
    min: 55,
    max: 72
  }
};

const archetypes = {
  MID: {
    strengths: [
      "kicking",
      "handball",
      "vision",
      "decisionMaking",
      "composure",
      "workRate",
      "endurance",
      "groundBallGet",
      "contestedBall",
      "runAndCarry",
      "gameAwareness",
      "discipline"
    ]
  },

  WING: {
    strengths: [
      "speed",
      "acceleration",
      "agility",
      "endurance",
      "groundBallGet",
      "runAndCarry",
      "kicking",
      "vision",
      "gameAwareness",
      "durability"
    ]
  },

  KPF: {
    strengths: [
      "marking",
      "goalSense",
      "strength",
      "verticalLeap",
      "positioning",
      "kicking",
      "gameAwareness",
      "durability",
      "discipline"
    ]
  },

  KPD: {
    strengths: [
      "marking",
      "spoiling",
      "strength",
      "positioning",
      "competitiveness",
      "gameAwareness",
      "durability",
      "discipline",
      "tackling"
    ]
  },

  HF: {
    strengths: [
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
    ]
  },

  FF: {
    strengths: [
      "goalSense",
      "marking",
      "kicking",
      "speed",
      "gameAwareness",
      "discipline",
      "durability"
    ]
  },

  HB: {
    strengths: [
      "kicking",
      "vision",
      "decisionMaking",
      "speed",
      "positioning",
      "groundBallGet",
      "runAndCarry",
      "gameAwareness",
      "discipline"
    ]
  },

  BP: {
    strengths: [
      "spoiling",
      "tackling",
      "positioning",
      "strength",
      "marking",
      "gameAwareness",
      "discipline",
      "durability"
    ]
  },

  RUC: {
    strengths: [
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
  }
};

const allAttributes = [
  "kicking",
  "handball",
  "marking",
  "goalSense",
  "tackling",
  "spoiling",

  "speed",
  "acceleration",
  "agility",
  "endurance",
  "strength",
  "verticalLeap",

  "vision",
  "decisionMaking",
  "positioning",
  "composure",
  "leadership",
  "creativity",

  "workRate",
  "professionalism",
  "determination",
  "teamwork",
  "competitiveness",
  "gameAwareness",
  "durability",
  "ruckCraft",
  "groundBallGet",
  "discipline",
  "contestedBall",
  "runAndCarry"
];

export const isRuckEligible = (playerOrPositions) => {
  const positions = Array.isArray(playerOrPositions)
    ? playerOrPositions
    : playerOrPositions?.positions ?? [];
  return positions.some((position) => ["RUC", "RUCK"].includes(String(position).toUpperCase()));
};

function seededRandom(seed) {
  // Numeric IDs keep their existing deterministic ratings. Draft prospects use
  // readable string IDs, so hash those into a stable numeric seed first.
  let numericSeed = Number(seed);
  if (!Number.isFinite(numericSeed)) {
    const text = String(seed);
    numericSeed = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      numericSeed ^= text.charCodeAt(index);
      numericSeed = Math.imul(numericSeed, 16777619);
    }
  }
  const x = Math.sin(numericSeed) * 10000;

  return x - Math.floor(x);
}

function generateValue(
  seed,
  min,
  max
) {
  return Math.round(
    min +
      seededRandom(seed) *
        (max - min)
  );
}

export function generateAttributes(
  player
) {
  const tier =
    tiers[
      player.ratingsSeed?.tier
    ] || tiers.Depth;

  const position =
    player.positions?.[0] ||
    "MID";

  const archetype =
    archetypes[position] ||
    archetypes.MID;

  const attributes = {};

  allAttributes.forEach(
    (attribute, index) => {
      if (attribute === "ruckCraft" && !isRuckEligible(player)) return;
      let min = tier.min;
      let max = tier.max;

      if (
        archetype.strengths.includes(
          attribute
        )
      ) {
        min += 4;
        max += 6;
      } else {
        max -= 3;
      }

      min = Math.min(min, 99);
      max = Math.min(max, 99);

      attributes[attribute] =
        generateValue(
          player.id + index,
          min,
          max
        );
    }
  );

  return attributes;
}

const roleWeights = {
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

export function calculateOverall(
  attributes,
  position
) {
  const weights =
    roleWeights[position];

  if (!weights) {
    const values =
      Object.values(
        attributes || {}
      );

    if (!values.length) {
      return 60;
    }

    return Math.round(
      values.reduce(
        (sum, value) =>
          sum + value,
        0
      ) / values.length
    );
  }

  const total =
    weights.reduce(
      (sum, attribute) =>
        sum +
        (attributes?.[
          attribute
        ] || 0),
      0
    );

  const overall =
    Math.round(
      total / weights.length
    );

  return overall || 60;
}

/** Shift a player's generated attribute profile so their position-weighted
 * starting rating matches the overall supplied in the club list. */
export function fitAttributesToOverall(attributes, position, targetOverall) {
  const source = attributes ?? {};
  const target = Math.max(1, Math.min(99, Math.round(Number(targetOverall) || 60)));
  const weightedAttributes = roleWeights[position] ?? Object.keys(source);
  if (!weightedAttributes.length) return source;

  const averageAtOffset = (offset) => weightedAttributes.reduce((sum, attribute) => {
    const original = Number(source[attribute] ?? 0);
    return sum + Math.max(1, Math.min(99, Math.round(original + offset)));
  }, 0) / weightedAttributes.length;

  let low = -100;
  let high = 100;
  for (let iteration = 0; iteration < 48; iteration += 1) {
    const offset = (low + high) / 2;
    if (averageAtOffset(offset) < target) low = offset;
    else high = offset;
  }

  const offset = (low + high) / 2;
  const fitted = Object.fromEntries(Object.entries(source).map(([attribute, value]) => [
    attribute,
    Math.max(1, Math.min(99, Math.round(Number(value ?? 0) + offset))),
  ]));

  // Integer ratings can leave the weighted mean just across a rounding edge.
  // Correct that edge without changing the relative profile more than needed.
  let calculated = calculateOverall(fitted, position);
  for (let attempt = 0; calculated !== target && attempt < weightedAttributes.length * 2; attempt += 1) {
    const direction = calculated < target ? 1 : -1;
    const attribute = weightedAttributes[attempt % weightedAttributes.length];
    const next = fitted[attribute] + direction;
    if (next < 1 || next > 99) continue;
    fitted[attribute] = next;
    calculated = calculateOverall(fitted, position);
  }
  return fitted;
}

export function generatePlayerRatings(
  player
) {
  const attributes =
    generateAttributes(
      player
    );

  const primaryPosition =
    player.positions?.[0] ||
    "MID";

  const overall =
    calculateOverall(
      attributes,
      primaryPosition
    );

  return {
    attributes,
    overall: overall || 60
  };
}
