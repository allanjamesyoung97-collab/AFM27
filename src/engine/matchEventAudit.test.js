import test from "node:test";
import assert from "node:assert/strict";
import { auditPlayedMatch } from "./matchEventAudit.js";

const change = (side, playerId, stats) => ({ side, playerId, stats });
const actions = [
  { id: 8, quarter: 1, second: 8, side: "home", actorId: "h1", receiverId: "h2", defenderId: "a1", kind: "kick", freeKick: false,
    from: [50, 50], to: [82, 40], distance: 60, score: null, statChanges: [change("home", "h1", { disposals: 1, kicks: 1, inside50s: 1 })] },
  { id: 18, quarter: 1, second: 18, side: "home", actorId: "h2", receiverId: null, defenderId: "a1", kind: "shot", freeKick: false,
    from: [88, 46], to: [88, 46], distance: 0, score: "Goal", statChanges: [change("home", "h2", { goals: 1, disposals: 1, kicks: 1 })] },
  { id: 24, quarter: 1, second: 24, side: "away", actorId: "a1", receiverId: null, defenderId: "h3", kind: "shot", freeKick: false,
    from: [10, 50], to: [12, 55], distance: 0, score: "Behind", statChanges: [change("away", "a1", { behinds: 1, disposals: 1, kicks: 1 })] },
];
const row = (playerId, stats) => ({ playerId, playerName: playerId, ...stats });
const goodMatch = () => ({
  actions, homeGoals: 1, homeBehinds: 0, homeScore: 6, awayGoals: 0, awayBehinds: 1, awayScore: 1,
  playerStats: {
    home: [row("h1", { disposals: 1, kicks: 1, inside50s: 1 }), row("h2", { goals: 1, disposals: 1, kicks: 1 })],
    away: [row("a1", { behinds: 1, disposals: 1, kicks: 1 })],
  },
});

test("a consistent match passes", () => {
  const result = auditPlayedMatch(goodMatch());
  assert.deepEqual(result.problems, []);
  assert.equal(result.ok, true);
  assert.equal(result.eventCount, 3);
});

test("a final score that disagrees with the event log is reported", () => {
  const match = { ...goodMatch(), homeGoals: 2, homeScore: 12 };
  const text = auditPlayedMatch(match).problems.join("\n");
  assert.match(text, /final home total 12/);
  assert.match(text, /home final 2\.0 but the event log gives 1\.0/);
});

test("a box score stat that disagrees with the event log is reported", () => {
  const match = goodMatch();
  match.playerStats.home[0] = row("h1", { disposals: 3, kicks: 1, inside50s: 1 });
  assert.match(auditPlayedMatch(match).problems.join("\n"), /h1 disposals: box score 3, event log 1/);
});

test("player goals that do not add up to the team score are reported", () => {
  const match = goodMatch();
  match.playerStats.home[1] = row("h2", { disposals: 1, kicks: 1 });
  assert.match(auditPlayedMatch(match).problems.join("\n"), /home players total 0\.0 but the team score is 1\.0/);
});

test("a match with no actions or unreadable actions fails safely", () => {
  assert.equal(auditPlayedMatch({}).ok, false);
  assert.match(auditPlayedMatch({ actions: [{ kind: "wat", quarter: 1 }] }).problems[0], /could not read match actions/);
});