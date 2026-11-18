const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const ratio = (part, total) => total > 0 ? Math.round(part / total * 100) : 0;
const difference = (current, baseline) => number(current) - number(baseline);

function totals(rows = []) {
  const keys = ["disposals", "effectiveDisposals", "turnovers", "goals", "behinds", "inside50s", "marksInside50", "clearances", "marks", "intercepts", "contestedPossessions", "score"];
  const result = Object.fromEntries(keys.map((key) => [key, 0]));
  for (const row of rows) {
    for (const key of keys) result[key] += number(row[key]);
  }
  result.score = result.goals * 6 + result.behinds;
  return result;
}

function snapshot(match, managerSide, playerId) {
  const ownRows = match.playerStats?.[managerSide] ?? [];
  const opponentRows = match.playerStats?.[managerSide === "home" ? "away" : "home"] ?? [];
  const player = ownRows.find((row) => String(row.playerId) === String(playerId));
  return {
    own: totals(ownRows),
    opponent: totals(opponentRows),
    player: totals(player ? [player] : []),
    traitActivations: { ...(match.traitActivations ?? {}) },
  };
}

export function captureMatchAdvice(match, managerSide, advice, matchupModel) {
  const action = advice.action ?? {};
  const first = matchupModel?.matchups?.find((pair) => pair.ownSlot === action.firstSlot);
  const second = matchupModel?.matchups?.find((pair) => pair.ownSlot === action.secondSlot);
  return {
    id: `${Date.now()}:${advice.key}`,
    key: advice.key,
    title: advice.title,
    actionLabel: advice.actionLabel,
    action,
    metric: advice.metric,
    playerId: advice.playerId ?? action.playerId ?? null,
    traitId: advice.traitId ?? null,
    managerSide,
    appliedAtSeconds: number(match.elapsedSeconds),
    baseline: snapshot(match, managerSide, advice.playerId ?? action.playerId),
    matchup: first && second ? {
      firstSlot: first.ownSlot,
      secondSlot: second.ownSlot,
      firstPlayerId: first.ownPlayerId,
      secondPlayerId: second.ownPlayerId,
      beforeEdge: first.edge + second.edge,
      projectedImprovement: number(advice.improvement),
    } : null,
  };
}

function classify(current, prior, direction, tolerance) {
  const delta = (current - prior) * direction;
  return delta >= tolerance ? "improved" : delta <= -tolerance ? "worsened" : "mixed";
}

/** Observed change after an accepted call; the labels never claim causation. */
export function evaluateMatchAdvice(record, match, matchupModel) {
  const now = snapshot(match, record.managerSide, record.playerId);
  const before = record.baseline;
  const own = Object.fromEntries(Object.keys(now.own).map((key) => [key, difference(now.own[key], before.own[key])]));
  const opponent = Object.fromEntries(Object.keys(now.opponent).map((key) => [key, difference(now.opponent[key], before.opponent[key])]));
  const player = Object.fromEntries(Object.keys(now.player).map((key) => [key, difference(now.player[key], before.player[key])]));
  const minutes = Math.max(0, Math.floor((number(match.elapsedSeconds) - record.appliedAtSeconds) / 60));
  const complete = match.status === "FULL_TIME";
  const result = (status, detail) => ({ status, detail, minutes, scoreSince: `${own.score}–${opponent.score}` });
  const waiting = (detail) => result(complete ? "limited" : "tracking", detail);
  const measured = (status, detail) => result(minutes < 5 && !complete ? "tracking" : status, detail);

  if (record.metric === "matchup") {
    if (!record.matchup) return waiting("The selected pair is no longer available for comparison.");
    const first = matchupModel?.matchups?.find((pair) => pair.ownSlot === record.matchup?.firstSlot);
    const second = matchupModel?.matchups?.find((pair) => pair.ownSlot === record.matchup?.secondSlot);
    const stillMatched = first?.ownPlayerId === record.matchup?.secondPlayerId
      && second?.ownPlayerId === record.matchup?.firstPlayerId;
    const edge = stillMatched ? first.edge + second.edge : null;
    const observed = edge === null
      ? `The switched pair is no longer on the field together. Projected edge at the call: ${record.matchup?.projectedImprovement >= 0 ? "+" : ""}${record.matchup?.projectedImprovement ?? 0}.`
      : `Combined matchup rating ${record.matchup.beforeEdge >= 0 ? "+" : ""}${record.matchup.beforeEdge} → ${edge >= 0 ? "+" : ""}${edge}.`;
    return measured(edge === null ? "limited" : edge > record.matchup.beforeEdge ? "improved" : "mixed", `${observed} Score since the call: ${own.score}–${opponent.score}.`);
  }

  if (record.metric === "trait") {
    const key = `${record.playerId}:${record.traitId}`;
    const activations = difference(now.traitActivations[key], before.traitActivations[key]);
    if (minutes < 5 && !complete) return waiting("Waiting for a relevant match phase.");
    if (!activations) return waiting("No relevant trait activation has occurred since the instruction.");
    const detail = record.traitId === "X_FACTOR"
      ? `${activations} X Factor opportunities; ${player.inside50s} inside 50s and ${player.effectiveDisposals} effective disposals.`
      : record.traitId === "HIGH_FLYER"
        ? `${activations} High Flyer opportunities; ${player.marks} marks and ${player.intercepts} intercepts.`
        : `${activations} Contested Bull opportunities; ${player.contestedPossessions} contested possessions and ${player.clearances} clearances.`;
    return result("observed", `${detail} Score since the call: ${own.score}–${opponent.score}.`);
  }

  if (record.metric === "disposalEfficiency" || record.metric === "turnoverRate") {
    if (own.disposals < 12) return waiting("Waiting for 12 new team disposals.");
    const turnover = record.metric === "turnoverRate";
    const prior = ratio(turnover ? before.own.turnovers : before.own.effectiveDisposals, before.own.disposals);
    const current = ratio(turnover ? own.turnovers : own.effectiveDisposals, own.disposals);
    return measured(classify(current, prior, turnover ? -1 : 1, 4), `${turnover ? "Turnovers" : "Effective disposals"} on new possessions: ${current}% (before call ${prior}%; ${own.disposals} disposals).`);
  }

  if (record.metric === "playerTurnovers") {
    if (player.disposals < 5) return waiting("Waiting for five new disposals from this player.");
    const prior = ratio(before.player.turnovers, before.player.disposals);
    const current = ratio(player.turnovers, player.disposals);
    return measured(classify(current, prior, -1, 8), `Player turnover rate: ${current}% on ${player.disposals} new disposals (before call ${prior}%).`);
  }

  if (record.metric === "goalConversion") {
    const shots = own.goals + own.behinds;
    if (shots < 3) return waiting("Waiting for three new scoring shots.");
    const prior = ratio(before.own.goals, before.own.goals + before.own.behinds);
    const current = ratio(own.goals, shots);
    return measured(classify(current, prior, 1, 8), `Goals from new shots: ${own.goals}/${shots} (${current}%; before call ${prior}%). Marks inside 50: ${own.marksInside50}.`);
  }

  const ownValue = record.metric === "clearanceShare" ? own.clearances : own.inside50s;
  const opponentValue = record.metric === "clearanceShare" ? opponent.clearances : opponent.inside50s;
  if (ownValue + opponentValue < 6) return waiting(`Waiting for six new ${record.metric === "clearanceShare" ? "clearances" : "inside 50s"}.`);
  const priorOwn = record.metric === "clearanceShare" ? before.own.clearances : before.own.inside50s;
  const priorOpponent = record.metric === "clearanceShare" ? before.opponent.clearances : before.opponent.inside50s;
  const prior = ratio(priorOwn, priorOwn + priorOpponent);
  const current = ratio(ownValue, ownValue + opponentValue);
  const label = record.metric === "clearanceShare" ? "Clearance share" : "Inside-50 share";
  return measured(classify(current, prior, 1, 7), `${label} since the call: ${current}% (${ownValue}–${opponentValue}; before call ${prior}%).`);
}
