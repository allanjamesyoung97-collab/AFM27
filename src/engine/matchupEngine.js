import { getPlayerFootballData } from "../data/footballData.js";
import { getSlotSuitability } from "./positionSuitability.js";
import { evaluateTraitContext, getTraitMatchupInteractions } from "./traitEngine.js";
import { INSIDE_MIDFIELD_SLOTS, OUTSIDE_MIDFIELD_SLOTS, readAttribute } from "./midfieldAttributes.js";

// Each slot has one direct opponent. Mirroring the outside lanes preserves
// left/right matchups when the teams face opposite directions on the oval.
export const OPPOSING_SLOT = Object.freeze({
  FP1: "BP2", FF: "FB", FP2: "BP1",
  HF1: "HB2", CHF: "CHB", HF2: "HB1",
  W1: "W2", C: "C", W2: "W1",
  RR: "ROV", R: "R", ROV: "RR",
  HB1: "HF2", CHB: "CHF", HB2: "HF1",
  BP1: "FP2", FB: "FF", BP2: "FP1",
});

export const MATCHUP_LINES = Object.freeze({
  forward: ["FP1", "FF", "FP2", "HF1", "CHF", "HF2"],
  midfield: ["W1", "C", "W2", "RR", "R", "ROV"],
  defence: ["HB1", "CHB", "HB2", "BP1", "FB", "BP2"],
});

const SLOT_FAMILIES = Object.freeze({
  forward: new Set(MATCHUP_LINES.forward),
  midfield: new Set(["W1", "C", "W2", "RR", "ROV"]),
  ruck: new Set(["R"]),
  defence: new Set(MATCHUP_LINES.defence),
});
const KEY_SLOTS = new Set(["FF", "CHF", "CHB", "FB", "R"]);
const ATTACK_KEYS = ["goalSense", "marking", "kicking", "positioning", "speed", "verticalLeap"];
const DEFENCE_KEYS = ["spoiling", "marking", "positioning", "strength", "speed", "gameAwareness"];
const MID_KEYS = ["groundBallGet", "kicking", "handball", "vision", "decisionMaking", "endurance"];
// Inside mids are judged on winning the ball, outside mids on carrying it.
const INSIDE_MID_KEYS = ["contestedBall", "groundBallGet", "tackling", "strength", "handball", "decisionMaking"];
const OUTSIDE_MID_KEYS = ["runCarry", "speed", "endurance", "kicking", "vision", "decisionMaking"];
const midKeysFor = (slot) => (INSIDE_MIDFIELD_SLOTS.includes(slot) ? INSIDE_MID_KEYS : OUTSIDE_MIDFIELD_SLOTS.includes(slot) ? OUTSIDE_MID_KEYS : MID_KEYS);
const RUCK_KEYS = ["ruckCraft", "verticalLeap", "strength", "positioning", "endurance"];
const SHARED_KEYS = ["speed", "strength", "endurance", "marking", "groundBallGet", "gameAwareness"];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const idOf = (entry) => String(entry?.player?.id ?? entry?.id ?? "");
const slotFamily = (slot) => Object.entries(SLOT_FAMILIES).find(([, slots]) => slots.has(slot))?.[0] ?? null;
export const getMatchupSlotFamily = (slot) => slotFamily(slot);
const validRating = (value) => Number.isFinite(Number(value)) && Number(value) > 0;

function playerRating(player, keys) {
  const values = keys.map((key) => readAttribute(player, key)).filter(validRating);
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : Number(player?.overall ?? 65);
}

function rolePenalty(player, slot) {
  return Math.max(0, Number(player?.overall ?? 60) - getSlotSuitability(player, slot).overall) * 0.25;
}

/** Maximise the combined positional ratings across the 18 field slots. */
function assignPlayersToSlots(fieldSlots, entries, score) {
  const rowCount = fieldSlots.length;
  const columnCount = Math.max(rowCount, entries.length);
  const costs = fieldSlots.map((slot) => Array.from({ length: columnCount }, (_, index) =>
    index < entries.length ? -score(slot, entries[index]) : 10000));
  const rowPotential = Array(rowCount + 1).fill(0);
  const columnPotential = Array(columnCount + 1).fill(0);
  const columnRow = Array(columnCount + 1).fill(0);
  const previousColumn = Array(columnCount + 1).fill(0);

  for (let row = 1; row <= rowCount; row += 1) {
    columnRow[0] = row;
    let currentColumn = 0;
    const minimum = Array(columnCount + 1).fill(Infinity);
    const used = Array(columnCount + 1).fill(false);
    do {
      used[currentColumn] = true;
      const currentRow = columnRow[currentColumn];
      let delta = Infinity;
      let nextColumn = 0;
      for (let column = 1; column <= columnCount; column += 1) {
        if (used[column]) continue;
        const reduced = costs[currentRow - 1][column - 1] - rowPotential[currentRow] - columnPotential[column];
        if (reduced < minimum[column]) {
          minimum[column] = reduced;
          previousColumn[column] = currentColumn;
        }
        if (minimum[column] < delta) {
          delta = minimum[column];
          nextColumn = column;
        }
      }
      for (let column = 0; column <= columnCount; column += 1) {
        if (used[column]) {
          rowPotential[columnRow[column]] += delta;
          columnPotential[column] -= delta;
        } else {
          minimum[column] -= delta;
        }
      }
      currentColumn = nextColumn;
    } while (columnRow[currentColumn]);
    do {
      const previous = previousColumn[currentColumn];
      columnRow[currentColumn] = columnRow[previous];
      currentColumn = previous;
    } while (currentColumn);
  }

  const slots = new Map();
  for (let column = 1; column <= columnCount; column += 1) {
    const row = columnRow[column];
    if (row && entries[column - 1]) slots.set(fieldSlots[row - 1], entries[column - 1]);
  }
  return slots;
}

/** Resolve every available field position, rearranging the side if needed. */
export function resolveActiveSlots(lineup = [], substitutions = []) {
  const entries = [...new Map((Array.isArray(lineup) ? lineup : [])
    .filter((entry) => entry?.player && entry?.position && idOf(entry))
    .map((entry) => [idOf(entry), entry])).values()];
  if (!entries.length) return new Map();
  const preferredSubSlot = new Map();
  const recentlyOff = new Set();
  for (const substitution of Array.isArray(substitutions) ? substitutions : []) {
    if (OPPOSING_SLOT[substitution?.slot]) preferredSubSlot.set(String(substitution.incomingId), substitution.slot);
    recentlyOff.add(String(substitution?.outgoingId ?? ""));
  }
  // These are the 18 on-field positions. Keep the match's field count anchored
  // to the formation itself, so a missing position metadata entry cannot
  // silently reduce the number of players assigned during rotations.
  const fieldSlots = Object.keys(OPPOSING_SLOT);
  return assignPlayersToSlots(fieldSlots, entries, (slot, entry) => {
    const id = idOf(entry);
    const activeBonus = entry.onField === false ? 0 : 1000;
    const recentlyOffPenalty = entry.onField === false && recentlyOff.has(id) ? 100 : 0;
    const slotContinuity = entry.position === slot ? 7 : 0;
    const substitutionContinuity = preferredSubSlot.get(id) === slot ? 5 : 0;
    const manualPlacement = entry.lockedPosition === slot ? 80 : 0;
    return activeBonus + getSlotSuitability(entry.player, slot).overall
      + slotContinuity + substitutionContinuity + manualPlacement - recentlyOffPenalty;
  });
}

function comparePlayers(ownPlayer, opponentPlayer, ownSlot, options = {}) {
  const family = slotFamily(ownSlot);
  const opposingSlot = OPPOSING_SLOT[ownSlot];
  const ownKeys = family === "forward" ? ATTACK_KEYS : family === "defence" ? DEFENCE_KEYS : family === "ruck" ? RUCK_KEYS : midKeysFor(ownSlot);
  const opponentKeys = family === "forward" ? DEFENCE_KEYS : family === "defence" ? ATTACK_KEYS : family === "ruck" ? RUCK_KEYS : midKeysFor(opposingSlot);
  const ownRating = (playerRating(ownPlayer, ownKeys) + getSlotSuitability(ownPlayer, ownSlot).overall) / 2;
  const opponentRating = (playerRating(opponentPlayer, opponentKeys) + getSlotSuitability(opponentPlayer, opposingSlot).overall) / 2;
  const ownHeight = getPlayerFootballData(ownPlayer).heightCm;
  const opponentHeight = getPlayerFootballData(opponentPlayer).heightCm;
  const heightDiff = ownHeight && opponentHeight ? ownHeight - opponentHeight : null;
  const aerial = KEY_SLOTS.has(ownSlot) || KEY_SLOTS.has(opposingSlot);
  const heightEdge = heightDiff === null ? 0 : clamp(heightDiff * (aerial ? 0.22 : 0.08), -5, 5);
  const ownRolePenalty = rolePenalty(ownPlayer, ownSlot);
  const oppositionRolePenalty = rolePenalty(opponentPlayer, opposingSlot);
  const activeInteractions = (actor, defender, actorRole, defenderRole, tactics, opponentTactics) => getTraitMatchupInteractions(actor, defender, actorRole, defenderRole)
    .filter((rule) => evaluateTraitContext(actor, { phase: rule.phase, opponent: defender, roleFamily: actorRole, opponentRoleFamily: defenderRole,
        tactics, opponentTactics,
        fitness: options.playerFitness?.[actor.id]?.fitness,
        matchSharpness: options.playerFitness?.[actor.id]?.matchSharpness,
        opponentFitness: options.playerFitness?.[defender.id]?.fitness,
        opponentMatchSharpness: options.playerFitness?.[defender.id]?.matchSharpness })
        .interactions.some((item) => item.trait === rule.trait && item.against === rule.against));
  const ownInteractions = activeInteractions(ownPlayer, opponentPlayer, family, slotFamily(opposingSlot), options.tactics, options.opponentTactics);
  const opponentInteractions = activeInteractions(opponentPlayer, ownPlayer, slotFamily(opposingSlot), family, options.opponentTactics, options.tactics);
  const traitEdge = clamp(ownInteractions.reduce((sum, rule) => sum + rule.edge, 0)
    - opponentInteractions.reduce((sum, rule) => sum + rule.edge, 0), -5, 5);
  const edge = clamp(Math.round((ownRating - opponentRating) * 0.65 + heightEdge - ownRolePenalty + oppositionRolePenalty + traitEdge), -25, 25);
  const sharedGaps = SHARED_KEYS.map((key) => ({
    attribute: key,
    gap: Number(ownPlayer?.attributes?.[key]) - Number(opponentPlayer?.attributes?.[key]),
  })).filter(({ gap }) => Number.isFinite(gap)).sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
  const reasons = [];
  if (ownRolePenalty >= 4) reasons.push(`${ownPlayer.name} is outside a preferred role`);
  if (oppositionRolePenalty >= 4) reasons.push(`${opponentPlayer.name} is outside a preferred role`);
  if (heightDiff !== null && Math.abs(heightDiff) >= (aerial ? 5 : 9)) reasons.push(`${Math.abs(heightDiff)} cm ${heightDiff > 0 ? "taller" : "shorter"}`);
  if (sharedGaps[0] && Math.abs(sharedGaps[0].gap) >= 8) {
    const key = sharedGaps[0];
    const label = key.attribute.replace(/([A-Z])/g, " $1").toLowerCase();
    reasons.push(`${label} ${key.gap > 0 ? "+" : ""}${Math.round(key.gap)}`);
  }
  for (const rule of ownInteractions) reasons.push(`${rule.label}: ${rule.reason}`);
  for (const rule of opponentInteractions) reasons.push(`${rule.label}: ${rule.reason}`);
  if (!reasons.length) reasons.push("Similar physical and attribute profile");
  return {
    edge,
    label: edge >= 11 ? "Strong advantage" : edge >= 5 ? "Advantage" : edge <= -11 ? "Serious mismatch" : edge <= -5 ? "Disadvantage" : "Even",
    reasons,
    rating: { own: Math.round(ownRating), opponent: Math.round(opponentRating) },
    heightDiff,
    rolePenalty: { own: ownRolePenalty, opponent: oppositionRolePenalty },
    traitEdge,
    traitInteractions: { own: ownInteractions, opponent: opponentInteractions },
  };
}

/** A single current matchup model for display, advice and live match decisions. */
export function buildMatchupModel(ownLineup = [], opponentLineup = [], options = {}) {
  const ownSlots = resolveActiveSlots(ownLineup, options.ownSubstitutions);
  const opponentSlots = resolveActiveSlots(opponentLineup, options.opponentSubstitutions);
  const matchups = Object.entries(OPPOSING_SLOT).flatMap(([ownSlot, opponentSlot]) => {
    const own = ownSlots.get(ownSlot)?.player;
    const opponent = opponentSlots.get(opponentSlot)?.player;
    if (!own || !opponent) return [];
    const comparison = comparePlayers(own, opponent, ownSlot, options);
    return [{
      ownSlot, opponentSlot, line: slotFamily(ownSlot),
      ownPlayerId: String(own.id), opponentPlayerId: String(opponent.id),
      ownName: own.name, opponentName: opponent.name,
      ownTraits: getPlayerFootballData(own).traitIds,
      opponentTraits: getPlayerFootballData(opponent).traitIds,
      ...comparison,
    }];
  });
  const byPlayerId = Object.fromEntries(matchups.map((matchup) => [matchup.ownPlayerId, matchup]));
  const lineEdges = Object.fromEntries(Object.entries(MATCHUP_LINES).map(([line, slots]) => {
    const relevant = matchups.filter((matchup) => slots.includes(matchup.ownSlot));
    return [line, relevant.length ? Math.round(relevant.reduce((sum, matchup) => sum + matchup.edge, 0) / relevant.length) : 0];
  }));
  return { matchups, byPlayerId, lineEdges, ownSlots, opponentSlots, options };
}

/** Recommend a real two-player swap only when the combined matchups improve. */
export function recommendMatchupSwap(model) {
  const candidates = model?.matchups ?? [];
  let best = null;
  for (let index = 0; index < candidates.length; index += 1) {
    for (let other = index + 1; other < candidates.length; other += 1) {
      const first = candidates[index];
      const second = candidates[other];
      if (first.line !== second.line) continue;
      const firstPlayer = model.ownSlots.get(first.ownSlot)?.player;
      const secondPlayer = model.ownSlots.get(second.ownSlot)?.player;
      const firstOpponent = model.opponentSlots.get(first.opponentSlot)?.player;
      const secondOpponent = model.opponentSlots.get(second.opponentSlot)?.player;
      if (!firstPlayer || !secondPlayer || !firstOpponent || !secondOpponent) continue;
      const firstAfter = comparePlayers(secondPlayer, firstOpponent, first.ownSlot, model.options);
      const secondAfter = comparePlayers(firstPlayer, secondOpponent, second.ownSlot, model.options);
      const improvement = firstAfter.edge + secondAfter.edge - first.edge - second.edge;
      const traitImprovement = firstAfter.traitEdge + secondAfter.traitEdge - first.traitEdge - second.traitEdge;
      if ((improvement >= 6 || (traitImprovement >= 2 && improvement >= 2)) && (!best || improvement > best.improvement)) {
        best = {
          firstSlot: first.ownSlot, secondSlot: second.ownSlot,
          firstPlayer: first.ownName, secondPlayer: second.ownName,
          improvement, traitImprovement, target: first.edge < second.edge ? first : second,
        };
      }
    }
  }
  return best;
}