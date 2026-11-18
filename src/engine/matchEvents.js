// The resolved match event record. One event is one thing that happened on the
// ground. Animation, commentary, statistics, the box score and the final result
// all derive from this log, and nothing downstream may roll its own outcome.
//
// This module is deliberately free of React and of any random source. It
// defines the record, validates it, folds a log back into a score and stats, and
// audits a log for internal consistency. It also adapts the legacy `actions[]`
// records produced by MatchCentre so the schema can be adopted before the
// engine itself is extracted.
import { distanceToGoal, METRES_PER_X, METRES_PER_Y } from "./matchPresentation.js";

export const MATCH_EVENT_SCHEMA_VERSION = 1;
export const QUARTER_SECONDS = 20 * 60;

const asSet = (list) => Object.freeze(Object.fromEntries(list.map((value) => [value, value])));

export const EVENT_TYPES = asSet([
  // Restarts
  "CENTRE_BOUNCE", "BALL_UP", "THROW_IN", "KICK_IN",
  // Possession
  "GATHER", "CLEARANCE", "CARRY", "HANDBALL", "KICK", "MARK", "SPOIL", "INTERCEPT", "TACKLE", "TURNOVER",
  "FREE_KICK",
  // Scoring
  "SHOT",
  // Match flow and coaching (no on-field actor required)
  "QUARTER_START", "QUARTER_END", "FULL_TIME", "SUBSTITUTION", "TACTIC_CHANGE", "INSTRUCTION_CHANGE",
]);

export const FLOW_TYPES = Object.freeze(new Set([
  "QUARTER_START", "QUARTER_END", "FULL_TIME", "SUBSTITUTION", "TACTIC_CHANGE", "INSTRUCTION_CHANGE",
]));

// RUSHED_BEHIND is a point conceded by the defending side, so see scoringSide().
export const OUTCOMES = asSet([
  "RETAINED", "TURNOVER", "GOAL", "BEHIND", "RUSHED_BEHIND", "MISS", "SHORT", "OUT_OF_BOUNDS", "STOPPAGE",
]);
export const SCORING_OUTCOMES = Object.freeze({ GOAL: 6, BEHIND: 1, RUSHED_BEHIND: 1 });

// A controlled vocabulary lets commentary, badges and filters rely on the tags.
export const EVENT_TAGS = asSet([
  "CONTESTED", "UNCONTESTED", "INTERCEPT", "PACK", "INSIDE_50", "REBOUND_50",
  "CENTRE_CLEARANCE", "STOPPAGE_CLEARANCE", "SET_SHOT", "SNAP", "ON_THE_RUN", "HIT_POST",
  "HOLDING_THE_BALL", "BOUNDARY", "ON_THE_LEAD", "FROM_MARK",
]);

export const SHOT_KINDS = asSet(["SET", "SNAP", "RUN"]);

// 0 appears only in "every touch"; >=1 is a key play; 2 is bold; 3 is a scoring row.
export const IMPORTANCE = Object.freeze({ TOUCH: 0, KEY: 1, HIGHLIGHT: 2, SCORE: 3 });

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const isPoint = (value) => Array.isArray(value) && value.length === 2 && value.every((n) => Number.isFinite(n));
const emptyScore = () => ({ goals: 0, behinds: 0, total: 0 });

/** The ground direction rule shared by MatchCentre and LiveMatchOval. */
export function attacksLeft(side, quarter) {
  const reversed = Number(quarter) % 2 === 0;
  return side === "home" ? reversed : !reversed;
}

/** Distance (metres) and angle (radians off the goal's centre line) from a field point. */
export function shotGeometry(point, left) {
  const goalDistance = Math.round(distanceToGoal(point, left));
  const angle = Math.atan2(
    Math.abs((point[1] - 50) * METRES_PER_Y),
    Math.max(0.1, Math.abs(point[0] - (left ? 5 : 95)) * METRES_PER_X),
  );
  return { goalDistance, angle: Number(angle.toFixed(3)) };
}

/** Where on the ground a point sits for a side attacking in the given direction. */
export function fieldZone(point, left) {
  const metres = distanceToGoal(point, left);
  return metres <= 50 ? "F50" : metres <= 80 ? "FM" : metres <= 110 ? "DM" : "D50";
}

/** The side credited with a score. A rushed behind is conceded by the side that acts. */
export function scoringSide(event) {
  if (!SCORING_OUTCOMES[event?.outcome]) return null;
  if (event.outcome === "RUSHED_BEHIND") return event.side === "home" ? "away" : "home";
  return event.side;
}

export function applyScore(score, event) {
  const points = SCORING_OUTCOMES[event?.outcome];
  const side = scoringSide(event);
  if (!points || !side) return score;
  const current = score[side];
  return {
    ...score,
    [side]: {
      goals: current.goals + (event.outcome === "GOAL" ? 1 : 0),
      behinds: current.behinds + (event.outcome === "GOAL" ? 0 : 1),
      total: current.total + points,
    },
  };
}

export function scoreFromEvents(events) {
  return events.reduce(applyScore, { home: emptyScore(), away: emptyScore() });
}

/** Sum the per-player stat deltas recorded on events. Keyed `${side}:${playerId}`. */
export function statsFromEvents(events) {
  const totals = new Map();
  for (const event of events) {
    for (const change of event.statChanges ?? []) {
      const key = `${change.side}:${change.playerId}`;
      const row = totals.get(key) ?? {};
      for (const [stat, delta] of Object.entries(change.stats ?? {})) row[stat] = (row[stat] ?? 0) + delta;
      totals.set(key, row);
    }
  }
  return totals;
}

export function defaultImportance(event) {
  const tags = new Set(event.tags ?? []);
  if (event.type === "SHOT") return event.outcome === "GOAL" ? 3 : event.outcome === "BEHIND" ? 2 : 1;
  if (event.outcome === "RUSHED_BEHIND") return 2;
  // A clearance or intercept is a key play whatever the disposal type that carried it.
  const tagged = tags.has("CENTRE_CLEARANCE") || tags.has("STOPPAGE_CLEARANCE") || tags.has("INTERCEPT") ? 1 : 0;
  switch (event.type) {
    case "QUARTER_END": case "FULL_TIME": return 2;
    case "QUARTER_START": case "SUBSTITUTION": case "TACTIC_CHANGE": case "INSTRUCTION_CHANGE": return 1;
    case "MARK": return tags.has("CONTESTED") || tags.has("INSIDE_50") || tags.has("PACK") ? 2 : 1;
    case "FREE_KICK": return tags.has("INSIDE_50") ? 2 : 1;
    case "CLEARANCE": case "INTERCEPT": return 1;
    case "TURNOVER": return tags.has("INSIDE_50") || tags.has("REBOUND_50") ? 1 : 0;
    case "KICK": return tags.has("INSIDE_50") ? 1 : tagged;
    default: return tagged;
  }
}

export const isKeyPlay = (event) => Number(event?.importance ?? 0) >= IMPORTANCE.KEY;

/** Problems with a single event, as readable strings. Empty means valid. */
export function validateMatchEvent(event) {
  const problems = [];
  const bad = (message) => problems.push(`event ${event?.seq ?? "?"}: ${message}`);
  if (!event || typeof event !== "object") return ["event is not an object"];
  if (!EVENT_TYPES[event.type]) bad(`unknown type ${event.type}`);
  if (!Number.isInteger(event.seq) || event.seq < 0) bad("seq must be a non-negative integer");
  if (!Number.isInteger(event.quarter) || event.quarter < 1 || event.quarter > 4) bad("quarter must be 1-4");
  if (!Number.isFinite(event.t) || event.t < 0 || event.t > 4 * QUARTER_SECONDS) bad("t is outside the match");
  if (!Number.isFinite(event.clock) || event.clock < 0 || event.clock > QUARTER_SECONDS) bad("clock is outside the quarter");
  if (!FLOW_TYPES.has(event.type)) {
    if (event.side !== "home" && event.side !== "away") bad("side must be home or away");
    if (event.actorId === undefined || event.actorId === null) bad("actorId is required");
  }
  for (const key of ["from", "to"]) {
    if (event[key] != null && !isPoint(event[key])) bad(`${key} must be an [x, y] point`);
  }
  if (event.outcome != null && !OUTCOMES[event.outcome]) bad(`unknown outcome ${event.outcome}`);
  if (event.type === "SHOT") {
    if (!["GOAL", "BEHIND", "MISS", "SHORT"].includes(event.outcome)) bad("a shot needs a GOAL, BEHIND, MISS or SHORT outcome");
    if (!event.shot || !Number.isFinite(event.shot.goalDistance)) bad("a shot needs shot.goalDistance");
    if (event.shot?.kind != null && !SHOT_KINDS[event.shot.kind]) bad(`unknown shot kind ${event.shot.kind}`);
  } else if (event.outcome && SCORING_OUTCOMES[event.outcome] && event.outcome !== "RUSHED_BEHIND") {
    bad(`only a SHOT can score ${event.outcome}`);
  }
  for (const tag of event.tags ?? []) if (!EVENT_TAGS[tag]) bad(`unknown tag ${tag}`);
  if (!Number.isInteger(event.importance) || event.importance < 0 || event.importance > 3) bad("importance must be 0-3");
  const score = event.score;
  if (!score || !["home", "away"].every((side) => Number.isFinite(score[side]?.total))) bad("score snapshot is missing");
  return problems;
}

/**
 * Build a normalised, frozen event. Pass `score` as the snapshot AFTER the event,
 * or pass `previousScore` and it is derived by applying the event to it.
 */
export function createMatchEvent(input) {
  const tags = [...new Set(input.tags ?? [])];
  const base = {
    v: MATCH_EVENT_SCHEMA_VERSION,
    seq: input.seq,
    quarter: input.quarter,
    t: input.t,
    clock: input.clock ?? clamp(input.quarter * QUARTER_SECONDS - input.t, 0, QUARTER_SECONDS),
    duration: Math.max(0, Number(input.duration ?? 0)),
    type: input.type,
    side: input.side ?? null,
    actorId: input.actorId ?? null,
    receiverId: input.receiverId ?? null,
    opponentId: input.opponentId ?? null,
    from: input.from ? [...input.from] : null,
    to: input.to ? [...input.to] : null,
    distance: Number.isFinite(input.distance) ? input.distance : null,
    shot: input.shot ? { kind: null, missSide: null, ...input.shot } : null,
    outcome: input.outcome ?? null,
    tags,
    statChanges: input.statChanges ?? [],
    text: input.text ?? null,
  };
  const score = input.score ?? applyScore(input.previousScore ?? { home: emptyScore(), away: emptyScore() }, base);
  const event = { ...base, score };
  event.importance = Number.isInteger(input.importance) ? input.importance : defaultImportance(event);
  const problems = validateMatchEvent(event);
  if (problems.length) throw new Error(problems.join("; "));
  return Object.freeze({ ...event, tags: Object.freeze(tags) });
}

/**
 * Audit a whole log: sequence, clocks, schema, and that every embedded score
 * snapshot equals the running fold of the scoring events. Returns [] when sound.
 */
export function verifyEventLog(events, { finalScore = null } = {}) {
  const problems = [];
  let running = { home: emptyScore(), away: emptyScore() };
  events.forEach((event, index) => {
    problems.push(...validateMatchEvent(event));
    if (event.seq !== index) problems.push(`event ${event.seq}: expected seq ${index}`);
    const previous = events[index - 1];
    if (previous && event.t < previous.t) problems.push(`event ${event.seq}: t runs backwards`);
    if (previous && event.quarter < previous.quarter) problems.push(`event ${event.seq}: quarter runs backwards`);
    running = applyScore(running, event);
    for (const side of ["home", "away"]) {
      const snap = event.score?.[side];
      if (snap && (snap.goals !== running[side].goals || snap.behinds !== running[side].behinds || snap.total !== running[side].total)) {
        problems.push(`event ${event.seq}: ${side} score snapshot ${snap.goals}.${snap.behinds} (${snap.total}) does not match the log ${running[side].goals}.${running[side].behinds} (${running[side].total})`);
      }
    }
  });
  if (finalScore) {
    for (const side of ["home", "away"]) {
      if (finalScore[side]?.total !== running[side].total) {
        problems.push(`final ${side} total ${finalScore[side]?.total} does not match the log total ${running[side].total}`);
      }
    }
  }
  return problems;
}

const LEGACY_TYPE = {
  gather: "GATHER", carry: "CARRY", kick: "KICK", handball: "HANDBALL", mark: "MARK", turnover: "TURNOVER", shot: "SHOT",
};
const LEGACY_SCORE_OUTCOME = { Goal: "GOAL", Behind: "BEHIND", Miss: "MISS", Short: "SHORT" };

/**
 * Adapt MatchCentre's legacy `match.actions[]` into schema events. The score on
 * each event is folded from the log, so a mismatch with `match.homeScore` /
 * `match.awayScore` shows up in verifyEventLog() instead of staying hidden.
 */
export function eventsFromLegacyActions(actions = []) {
  const events = [];
  let score = { home: emptyScore(), away: emptyScore() };
  let previousT = 0;
  actions.forEach((action, seq) => {
    const type = action.freeKick ? "FREE_KICK" : LEGACY_TYPE[action.kind];
    if (!type) throw new Error(`action ${seq}: unknown legacy kind ${action.kind}`);
    const left = attacksLeft(action.side, action.quarter);
    const delta = (stat) => (action.statChanges ?? []).reduce((sum, change) => sum + (change.stats?.[stat] ?? 0), 0);
    const tags = [];
    if (delta("contestedMarks") > 0 || delta("contestedPossessions") > 0) tags.push("CONTESTED");
    if (delta("inside50s") > 0) tags.push("INSIDE_50");
    if (delta("rebound50s") > 0) tags.push("REBOUND_50");
    if (delta("intercepts") > 0) tags.push("INTERCEPT");
    if (delta("centreClearances") > 0) tags.push("CENTRE_CLEARANCE");
    else if (delta("clearances") > 0) tags.push("STOPPAGE_CLEARANCE");
    if (type === "FREE_KICK" && action.to && fieldZone(action.to, left) === "F50") tags.push("INSIDE_50");
    // Legacy records do not say whether a shot was a set shot, so kind stays unknown.
    const shot = type === "SHOT" && action.to ? shotGeometry(action.to, left) : null;
    const outcome = type === "SHOT" ? LEGACY_SCORE_OUTCOME[action.score] ?? "MISS"
      : type === "TURNOVER" ? "TURNOVER" : "RETAINED";
    const t = Number(action.second ?? action.id ?? 0);
    const event = createMatchEvent({
      seq, quarter: action.quarter, t, duration: Math.max(0, t - previousT),
      type, side: action.side, actorId: action.actorId, receiverId: action.receiverId,
      opponentId: action.defenderId, from: action.from, to: action.to, distance: action.distance,
      shot, outcome, tags, statChanges: action.statChanges, text: action.text,
      previousScore: score,
    });
    score = event.score;
    previousT = t;
    events.push(event);
  });
  return events;
}