// Morale rules shared by the daily world simulation, training and match results.
//
// Player morale (world.fitness[id].morale) is a short-term 0-100 mood that:
//   - drifts back to a neutral 50 every day (so it never saturates),
//   - moves with team results, personal selection and broken/kept promises,
//   - feeds long-term happiness (see worldSimulationEngine) and match readiness
//     (see selectedSideStrength).
// Club morale (seasonState.clubMorale[club]) is the squad-wide mood.

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const round2 = (value) => Math.round(value * 100) / 100;

export const NEUTRAL_MORALE = 50;
export const PLAYER_MORALE_DAILY_DECAY = 0.03;
export const CLUB_MORALE_DAILY_DECAY = 0.01;
export const TRAINING_MORALE_SCALE = 0.08;

/** Pull a morale value towards neutral. Values within 0.05 of neutral settle on it. */
export function decayMorale(value, rate = PLAYER_MORALE_DAILY_DECAY) {
  const current = Number(value ?? NEUTRAL_MORALE);
  const next = current + (NEUTRAL_MORALE - current) * rate;
  return Math.abs(next - NEUTRAL_MORALE) < 0.05 ? NEUTRAL_MORALE : round2(clamp(next));
}

/** Morale gained or lost from one training session. Kept unrounded so small effects accumulate. */
export function trainingMoraleChange(currentMorale, categoryMoraleEffect) {
  return round2(clamp(Number(currentMorale ?? NEUTRAL_MORALE) + Number(categoryMoraleEffect ?? 0) * TRAINING_MORALE_SCALE));
}

/**
 * Leaders soften the damage of a loss and help a side bounce back.
 * quality is the 0-100 leadership group quality; 50 is neutral.
 */
function leadershipBuffer(quality) {
  return clamp((Number(quality ?? 50) - 50) / 50, -1, 1);
}

/**
 * Morale change for one player after a match.
 *  outcome:   "WIN" | "LOSS" | "DRAW"
 *  margin:    absolute final margin in points
 *  role:      "SELECTED" (named in the 23), "DROPPED" (top-23 player left out) or "OTHER"
 *  leadershipQuality: 0-100
 */
export function matchMoraleDelta({ outcome, margin = 0, role = "OTHER", leadershipQuality = 50 } = {}) {
  const size = clamp(Number(margin) / 60, 0, 1);
  const buffer = leadershipBuffer(leadershipQuality);
  let team = 0;
  if (outcome === "WIN") team = 2.5 + size * 2 + Math.max(0, buffer) * 0.6;
  else if (outcome === "LOSS") team = -(2.5 + size * 2.5) * (1 - buffer * 0.3);
  const weight = role === "SELECTED" ? 1 : role === "DROPPED" ? 0.6 : 0.3;
  const selection = role === "SELECTED" ? 0.8 : role === "DROPPED" ? -2.5 : 0;
  return round2(team * weight + selection);
}

/** Club (squad-wide) morale after a result, with a small regression to neutral each match. */
export function nextClubMorale(current, { outcome, margin = 0, leadershipQuality = 50 } = {}) {
  const value = Number(current ?? NEUTRAL_MORALE);
  const delta = matchMoraleDelta({ outcome, margin, role: "SELECTED", leadershipQuality }) - 0.8;
  const regress = (NEUTRAL_MORALE - value) * 0.04;
  return round2(clamp(value + (outcome === "DRAW" ? 0 : delta) + regress));
}

/** Happiness takes a share of the morale swing, so results reach long-term mood and contract unrest. */
export const HAPPINESS_SHARE_OF_MORALE_DELTA = 0.3;

/** Human-readable band shared by the squad and training screens. */
export function moraleLabel(value) {
  const morale = Number(value ?? NEUTRAL_MORALE);
  if (morale < 20) return "Extremely upset";
  if (morale < 40) return "Upset";
  if (morale < 60) return "Content";
  if (morale < 80) return "Happy";
  return "Buoyant";
}

/** Rating points a player's morale adds to (or removes from) their side in a match. Bounded to +/-1.2. */
export function moraleMatchRating(morale) {
  return clamp((Number(morale ?? NEUTRAL_MORALE) - NEUTRAL_MORALE) * 0.024, -1.2, 1.2);
}

/** Incumbent reaction to a new teammate competing for the same position. */
export function recruitmentMoraleDelta(incumbent, recruit) {
  const gap = Number(recruit?.overall ?? 0) - Number(incumbent?.overall ?? 0);
  if (gap >= 8) return -round2(Math.min(2.5, 0.5 + (gap - 8) * 0.08));
  if (gap <= -8) return 0.35;
  return 0.1;
}

/** Small weekly nudge for the club's current standing relative to expectations. */
export function ladderMoraleDelta(actualRank, expectedRank) {
  const actual = Number(actualRank), expected = Number(expectedRank);
  if (!Number.isFinite(actual) || !Number.isFinite(expected)) return 0;
  return round2(clamp((expected - actual) * 0.12, -0.6, 0.6));
}
