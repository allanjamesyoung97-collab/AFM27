// Contested Ball and Run & Carry: two attributes that separate inside midfielders from outside midfielders.
//
//   contestedBall  winning the ball under pressure: hard-ball gets, body position, clearances
//   runCarry       taking the ball forward at speed: metres gained, link-up running, rebounding
//
// Existing players have neither attribute stored, so both are derived deterministically from the
// attributes they already have (see deriveMidfieldAttributes). Stored values always win, which means
// a hand-edited or trained value is never overwritten.

export const MIDFIELD_ATTRIBUTE_KEYS = Object.freeze(["contestedBall", "runCarry"]);

const INSIDE_WEIGHTS = { groundBallGet: 0.4, strength: 0.2, tackling: 0.2, determination: 0.1, competitiveness: 0.1 };
const OUTSIDE_WEIGHTS = { speed: 0.3, endurance: 0.25, kicking: 0.2, acceleration: 0.1, decisionMaking: 0.15 };
// The squad-wide average of (inside profile - outside profile), so the average player lands in the middle.
const POPULATION_MEAN_GAP = -1.1;
// How strongly a player's lean is stretched. Existing ratings differ little between mids, so without
// stretching the two new attributes would be near-copies of each other.
const SEPARATION = 2.5;
const WING_BIAS = 3;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function composite(attributes, weights) {
  let total = 0;
  let weight = 0;
  for (const [key, share] of Object.entries(weights)) {
    const value = Number(attributes?.[key]);
    if (Number.isFinite(value)) { total += value * share; weight += share; }
  }
  return weight > 0 ? total / weight : null;
}

function seededUnit(seed) {
  let hash = 2166136261;
  for (const char of String(seed ?? "0")) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return ((hash >>> 0) % 10000) / 10000;
}

/** { contestedBall, runCarry } derived from the other attributes. Empty if there is nothing to derive from. */
export function deriveMidfieldAttributes(attributes, positions = [], seed = 0) {
  const inside = composite(attributes, INSIDE_WEIGHTS);
  const outside = composite(attributes, OUTSIDE_WEIGHTS);
  if (inside === null || outside === null) return {};
  const base = (inside + outside) / 2;
  const lean = (inside - outside) - POPULATION_MEAN_GAP;
  const bias = String(positions?.[0] ?? "").toUpperCase() === "WING" ? WING_BIAS : 0;
  const jitter = (seededUnit(seed) - 0.5) * 4; // +/-2 so equal players do not tie exactly
  return {
    contestedBall: clamp(Math.round(base + SEPARATION * lean - bias + jitter), 30, 99),
    runCarry: clamp(Math.round(base - SEPARATION * lean + bias - jitter), 30, 99),
  };
}

/** The attributes with any missing midfield attribute filled in. Stored values are kept. */
export function withMidfieldAttributes(attributes, positions = [], seed = 0) {
  if (!attributes) return attributes;
  const missing = MIDFIELD_ATTRIBUTE_KEYS.filter((key) => !Number.isFinite(Number(attributes[key])));
  if (!missing.length) return attributes;
  const derived = deriveMidfieldAttributes(attributes, positions, seed);
  return { ...attributes, ...Object.fromEntries(missing.filter((key) => key in derived).map((key) => [key, derived[key]])) };
}

/** Read any attribute from a player, deriving the midfield ones on the fly for players that predate them. */
export function readAttribute(player, key) {
  const stored = Number(player?.attributes?.[key]);
  if (Number.isFinite(stored)) return stored;
  if (!MIDFIELD_ATTRIBUTE_KEYS.includes(key)) return NaN;
  const derived = deriveMidfieldAttributes(player?.attributes, player?.positions, player?.id);
  return derived[key] ?? NaN;
}

// Slots where the role leans inside (contested) or outside (run and carry).
export const INSIDE_MIDFIELD_SLOTS = Object.freeze(["C", "RR", "ROV"]);
export const OUTSIDE_MIDFIELD_SLOTS = Object.freeze(["W1", "W2"]);