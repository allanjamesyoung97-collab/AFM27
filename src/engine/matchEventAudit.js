// Full-time consistency audit for a played match. It rebuilds the event log
// from the match's recorded actions and checks that the final score, the
// goals/behinds, and every counting stat in the box score agree with it.
// Pure and read-only: it never changes the match.
import { eventsFromLegacyActions, scoreFromEvents, statsFromEvents, verifyEventLog } from "./matchEvents.js";
import { LIVE_MATCH_STAT_KEYS } from "./liveMatchActionStats.js";

const sideScore = (match, side) => ({
  goals: Number(match?.[`${side}Goals`] ?? 0),
  behinds: Number(match?.[`${side}Behinds`] ?? 0),
  total: Number(match?.[`${side}Score`] ?? 0),
});

export function auditPlayedMatch(match, { maxProblems = 25 } = {}) {
  let events;
  try {
    events = eventsFromLegacyActions(match?.actions ?? []);
  } catch (error) {
    return { ok: false, eventCount: 0, problemCount: 1, problems: [`could not read match actions: ${error.message}`] };
  }
  if (!events.length) return { ok: false, eventCount: 0, problemCount: 1, problems: ["match has no recorded actions"] };

  const final = { home: sideScore(match, "home"), away: sideScore(match, "away") };
  const problems = verifyEventLog(events, { finalScore: final });

  const folded = scoreFromEvents(events);
  for (const side of ["home", "away"]) {
    if (folded[side].goals !== final[side].goals || folded[side].behinds !== final[side].behinds) {
      problems.push(`${side} final ${final[side].goals}.${final[side].behinds} but the event log gives ${folded[side].goals}.${folded[side].behinds}`);
    }
  }

  const totals = statsFromEvents(events);
  const seen = new Set();
  for (const side of ["home", "away"]) {
    const rows = match?.playerStats?.[side] ?? [];
    let goals = 0;
    let behinds = 0;
    for (const row of rows) {
      const key = `${side}:${row.playerId}`;
      seen.add(key);
      const expected = totals.get(key) ?? {};
      goals += Number(row.goals) || 0;
      behinds += Number(row.behinds) || 0;
      for (const stat of LIVE_MATCH_STAT_KEYS) {
        const actual = Number(row[stat]) || 0;
        if (actual !== (expected[stat] ?? 0)) {
          problems.push(`${side} ${row.playerName ?? row.playerId} ${stat}: box score ${actual}, event log ${expected[stat] ?? 0}`);
        }
      }
    }
    if (rows.length && (goals !== final[side].goals || behinds !== final[side].behinds)) {
      problems.push(`${side} players total ${goals}.${behinds} but the team score is ${final[side].goals}.${final[side].behinds}`);
    }
  }
  for (const key of totals.keys()) {
    if (!seen.has(key)) problems.push(`${key} has stats in the event log but no box score row`);
  }

  return { ok: problems.length === 0, eventCount: events.length, problemCount: problems.length, problems: problems.slice(0, maxProblems) };
}