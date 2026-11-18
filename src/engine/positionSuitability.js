import { positionGroups, normalizePositionCode } from "../data/positionGroups.js";
import { calculateOverall } from "./playerRatingGenerator.js";
import { INSIDE_MIDFIELD_SLOTS, OUTSIDE_MIDFIELD_SLOTS, readAttribute } from "./midfieldAttributes.js";

const ROLE_FAMILIES = Object.freeze({
  BP: "defence", HB: "defence", KPD: "defence",
  MID: "midfield", WING: "midfield",
  HF: "forward", FF: "forward", KPF: "forward",
  RUC: "ruck",
});
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

// Inside slots reward contested ball over run and carry; wing slots reward the reverse.
const MIDFIELD_SLOT_WEIGHT = 0.45;
function midfieldSlotAdjustment(player, slot) {
  const contested = readAttribute(player, "contestedBall");
  const carry = readAttribute(player, "runCarry");
  if (!Number.isFinite(contested) || !Number.isFinite(carry)) return 0;
  const lean = (contested - carry) / 2;
  if (INSIDE_MIDFIELD_SLOTS.includes(slot)) return lean * MIDFIELD_SLOT_WEIGHT;
  if (OUTSIDE_MIDFIELD_SLOTS.includes(slot)) return -lean * MIDFIELD_SLOT_WEIGHT;
  return 0;
}

/** A match rating for the role actually occupied, rather than the player's list OVR. */
export function getSlotSuitability(player, slot) {
  const listed = (player?.positions ?? []).map(normalizePositionCode);
  const rawBaseOverall = Number(player?.overall ?? 60);
  const baseOverall = Number.isFinite(rawBaseOverall) ? rawBaseOverall : 60;
  const accepted = positionGroups[slot];
  if (!accepted?.length) return { role: listed[0] ?? "UTIL", overall: Math.round(baseOverall), fit: "natural" };

  const primaryRole = listed[0] ?? "MID";
  const attributes = player?.attributes;
  const hasAttributes = attributes && Object.keys(attributes).length > 0;
  const primaryRating = hasAttributes ? calculateOverall(attributes, primaryRole) : baseOverall;
  const potential = Number(player?.potential ?? player?.development?.potential ?? 99);
  // Positional fit can lower a player's rating, but it must never inflate them
  // above their actual list overall (or their potential ceiling).
  const potentialCeiling = Number.isFinite(potential) && potential > 0 ? Math.min(99, potential) : 99;
  const maximum = Math.min(baseOverall, potentialCeiling);
  const choices = accepted.map((position) => {
    const role = normalizePositionCode(position);
    const natural = listed.includes(role);
    const sameLine = listed.some((listedRole) => ROLE_FAMILIES[listedRole] === ROLE_FAMILIES[role]);
    const trainingProgress = player?.positionTraining?.target === role ? Math.max(0, Math.min(1, Number(player.positionTraining.progress ?? 0))) : 0;
    const familiarityPenalty = natural ? 0 : (sameLine ? 3 : role === "RUC" ? 15 : 10) * (1 - trainingProgress);
    const roleRating = hasAttributes ? calculateOverall(attributes, role) : baseOverall;
    const overall = Math.round(clamp(
      baseOverall + (roleRating - primaryRating) * 0.85 - familiarityPenalty + midfieldSlotAdjustment(player, slot),
      Math.min(30, maximum),
      maximum
    ));
    return { role, overall, fit: natural ? "natural" : sameLine ? "secondary" : "unfamiliar" };
  });
  return choices.sort((a, b) => b.overall - a.overall)[0];
}
