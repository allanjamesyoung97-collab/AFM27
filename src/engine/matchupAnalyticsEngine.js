import { getAttributeLabel } from "../data/footballData.js";
import { MATCHUP_LINES, getMatchupSlotFamily } from "./matchupEngine.js";
import { describeTraitOpportunities } from "./traitEngine.js";

export const MATCHUP_ANALYTICS_ATTRIBUTES = Object.freeze([
  "speed", "endurance", "goalSense", "kicking", "marking", "groundBallGet",
  "strength", "spoiling", "tackling", "gameAwareness", "verticalLeap", "ruckCraft", "contestedBall", "runAndCarry",
]);

const validAttribute = (player, key, slot) => {
  if (key === "ruckCraft" && slot !== "R") return null;
  const value = Number(player?.attributes?.[key]);
  return Number.isFinite(value) && value > 0 ? value : null;
};

/** Aggregate the exact on-field pairs used by the match engine. No list-only players enter these averages. */
export function buildMatchupAnalytics(model, { tactics, opponentTactics, playerFitness = {} } = {}) {
  const matchups = model?.matchups ?? [];
  const traitOpportunitiesByPlayer = Object.fromEntries(matchups.map((pair) => {
    const own = model.ownSlots.get(pair.ownSlot)?.player;
    const opponent = model.opponentSlots.get(pair.opponentSlot)?.player;
    return [pair.ownPlayerId, describeTraitOpportunities(own, opponent, {
      roleFamily: pair.line,
      opponentRoleFamily: getMatchupSlotFamily(pair.opponentSlot),
      tactics,
      opponentTactics,
      fitness: playerFitness?.[pair.ownPlayerId]?.fitness,
      matchSharpness: playerFitness?.[pair.ownPlayerId]?.matchSharpness,
      opponentFitness: playerFitness?.[pair.opponentPlayerId]?.fitness,
      opponentMatchSharpness: playerFitness?.[pair.opponentPlayerId]?.matchSharpness,
    })];
  }));

  const lines = Object.fromEntries(Object.entries(MATCHUP_LINES).map(([line, slots]) => {
    const pairs = matchups.filter((pair) => slots.includes(pair.ownSlot));
    const attributes = MATCHUP_ANALYTICS_ATTRIBUTES.map((key) => {
      const values = pairs.flatMap((pair) => {
        const own = validAttribute(model.ownSlots.get(pair.ownSlot)?.player, key, pair.ownSlot);
        const opponent = validAttribute(model.opponentSlots.get(pair.opponentSlot)?.player, key, pair.opponentSlot);
        return own === null || opponent === null ? [] : [{ own, opponent }];
      });
      if (!values.length) return { key, label: getAttributeLabel(key), own: null, opponent: null, gap: null, count: 0 };
      const own = values.reduce((sum, item) => sum + item.own, 0) / values.length;
      const opponent = values.reduce((sum, item) => sum + item.opponent, 0) / values.length;
      return { key, label: getAttributeLabel(key), own, opponent, gap: own - opponent, count: values.length };
    });
    return [line, {
      line, pairs,
      edge: model.lineEdges?.[line] ?? 0,
      attributes,
      traitCount: pairs.reduce((sum, pair) => sum + (traitOpportunitiesByPlayer[pair.ownPlayerId] ?? [])
        .filter((trait) => trait.matchupFactor >= .8).length, 0),
    }];
  }));

  return { lines, traitOpportunitiesByPlayer, matchups };
}
