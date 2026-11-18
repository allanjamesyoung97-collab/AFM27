import test from "node:test";
import assert from "node:assert/strict";
import {
  createMatchEvent, eventsFromLegacyActions, verifyEventLog, scoreFromEvents, statsFromEvents,
  isKeyPlay, attacksLeft, scoringSide, validateMatchEvent,
} from "./matchEvents.js";

const stat = (side, playerId, stats) => ({ side, playerId, stats });
// Shaped like MatchCentre's actionRecord. Q1 home attack goes right; shots sit near x=95.
const legacy = [
  { id: 4, quarter: 1, second: 4, side: "home", actorId: "h1", receiverId: null, defenderId: "a1", kind: "gather", freeKick: false,
    from: [50, 50], to: [50, 50], distance: 0, score: null, statChanges: [stat("home", "h1", { contestedPossessions: 1, centreClearances: 1, clearances: 1 })], text: "h1 gets first hands." },
  { id: 8, quarter: 1, second: 8, side: "home", actorId: "h1", receiverId: "h2", defenderId: "a2", kind: "kick", freeKick: false,
    from: [50, 50], to: [82, 40], distance: 60, score: null, statChanges: [stat("home", "h1", { disposals: 1, kicks: 1, inside50s: 1 })], text: "h1 kicks inside 50." },
  { id: 12, quarter: 1, second: 12, side: "home", actorId: "h2", receiverId: "h2", defenderId: "a3", kind: "mark", freeKick: false,
    from: [82, 40], to: [88, 46], distance: 12, score: null, statChanges: [stat("home", "h2", { marks: 1, contestedMarks: 1 })], text: "h2 marks." },
  { id: 18, quarter: 1, second: 18, side: "home", actorId: "h2", receiverId: null, defenderId: "a3", kind: "shot", freeKick: false,
    from: [88, 46], to: [88, 46], distance: 0, score: "Goal", statChanges: [stat("home", "h2", { goals: 1, disposals: 1, kicks: 1 })], text: "Goal." },
  { id: 24, quarter: 1, second: 24, side: "away", actorId: "a1", receiverId: null, defenderId: "h3", kind: "shot", freeKick: false,
    from: [10, 50], to: [12, 55], distance: 0, score: "Behind", statChanges: [stat("away", "a1", { behinds: 1 })], text: "Behind." },
  { id: 30, quarter: 1, second: 30, side: "away", actorId: "a2", receiverId: null, defenderId: "h3", kind: "turnover", freeKick: false,
    from: [30, 50], to: [30, 50], distance: 0, score: null, statChanges: [], text: "Turnover." },
];

test("legacy actions adapt to a log that verifies and folds to the right score", () => {
  const events = eventsFromLegacyActions(legacy);
  assert.deepEqual(verifyEventLog(events), []);
  const score = scoreFromEvents(events);
  assert.deepEqual(score.home, { goals: 1, behinds: 0, total: 6 });
  assert.deepEqual(score.away, { goals: 0, behinds: 1, total: 1 });
  assert.equal(events.at(-1).score.home.total, 6);
  assert.deepEqual(verifyEventLog(events, { finalScore: score }), []);
});

test("adapter derives tags, shot geometry, clock and importance from the record", () => {
  const events = eventsFromLegacyActions(legacy);
  assert.ok(events[0].tags.includes("CENTRE_CLEARANCE"));
  assert.ok(events[1].tags.includes("INSIDE_50"));
  assert.ok(events[2].tags.includes("CONTESTED"));
  assert.equal(events[3].shot.goalDistance, Math.round(events[3].shot.goalDistance));
  assert.ok(events[3].shot.goalDistance < 25, "a shot at x=88 is close to the right-hand goal");
  assert.equal(events[3].clock, 1200 - 18);
  assert.equal(events[3].importance, 3);
  assert.equal(events[5].importance, 0);
  assert.equal(events.filter(isKeyPlay).length, 5);
});

test("verifyEventLog catches a tampered score snapshot and a wrong final score", () => {
  const events = eventsFromLegacyActions(legacy).map((event) => ({ ...event }));
  events[4] = { ...events[4], score: { ...events[4].score, away: { goals: 1, behinds: 0, total: 6 } } };
  assert.match(verifyEventLog(events).join("\n"), /away score snapshot/);
  const honest = eventsFromLegacyActions(legacy);
  assert.match(verifyEventLog(honest, { finalScore: { home: { total: 12 }, away: { total: 1 } } }).join("\n"), /final home total 12/);
});

test("per-event stat deltas sum to player totals", () => {
  const totals = statsFromEvents(eventsFromLegacyActions(legacy));
  assert.equal(totals.get("home:h2").marks, 1);
  assert.equal(totals.get("home:h2").goals, 1);
  assert.equal(totals.get("away:a1").behinds, 1);
});

test("createMatchEvent rejects malformed events", () => {
  const ok = { seq: 0, quarter: 1, t: 5, type: "KICK", side: "home", actorId: "h1", previousScore: undefined };
  assert.doesNotThrow(() => createMatchEvent(ok));
  assert.throws(() => createMatchEvent({ ...ok, type: "NOPE" }), /unknown type/);
  assert.throws(() => createMatchEvent({ ...ok, quarter: 5 }), /quarter/);
  assert.throws(() => createMatchEvent({ ...ok, tags: ["MADE_UP"] }), /unknown tag/);
  assert.throws(() => createMatchEvent({ ...ok, outcome: "GOAL" }), /only a SHOT can score/);
  assert.throws(() => createMatchEvent({ ...ok, type: "SHOT", outcome: "GOAL" }), /shot.goalDistance/);
  assert.throws(() => createMatchEvent({ ...ok, side: undefined }), /side must be/);
  assert.ok(Object.isFrozen(createMatchEvent(ok)));
});

test("a rushed behind is credited to the opposition and flow events need no actor", () => {
  const rushed = createMatchEvent({ seq: 0, quarter: 2, t: 1300, type: "SPOIL", side: "home", actorId: "h9", outcome: "RUSHED_BEHIND" });
  assert.equal(scoringSide(rushed), "away");
  assert.equal(rushed.score.away.total, 1);
  const flow = createMatchEvent({ seq: 1, quarter: 2, t: 1400, type: "QUARTER_END", previousScore: rushed.score });
  assert.deepEqual(validateMatchEvent(flow), []);
});

test("attack direction matches the oval's rule and flips each quarter", () => {
  assert.equal(attacksLeft("home", 1), false);
  assert.equal(attacksLeft("away", 1), true);
  assert.equal(attacksLeft("home", 2), true);
  assert.equal(attacksLeft("away", 2), false);
});