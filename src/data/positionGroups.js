export const positionGroups = {
  BP1: ["BP", "KPD"],
  FB: ["KPD"],
  BP2: ["BP", "KPD"],

  HB1: ["HB"],
  CHB: ["KPD"],
  HB2: ["HB"],

  W1: ["WING"],
  C: ["MID"],
  W2: ["WING"],

  HF1: ["HF"],
  CHF: ["KPF"],
  HF2: ["HF"],

  FP1: ["FF", "HF"],
  FF: ["KPF", "FF"],
  FP2: ["FF", "HF"],

  R: ["RUC"],
  RR: ["MID"],
  ROV: ["MID"],

  INT1: [],
  INT2: [],
  INT3: [],
  INT4: [],
  INT5: []
};

const positionAliases = Object.freeze({ RUCK: "RUC", KPB: "KPD" });

export function normalizePositionCode(position) {
  const code = String(position ?? "").trim().toUpperCase();
  return positionAliases[code] ?? code;
}

/** True only when a player's listed roles include a role accepted by this slot. */
export function canPlayInSlot(player, slot) {
  const accepted = positionGroups[slot];
  if (!accepted) return false;
  if (String(slot).startsWith("INT")) return true;
  const positions = (player?.positions ?? []).map(normalizePositionCode);
  return accepted.some((position) => positions.includes(normalizePositionCode(position)));
}

export function getEligiblePositionForSlot(player, slot) {
  const accepted = positionGroups[slot] ?? [];
  const positions = (player?.positions ?? []).map(normalizePositionCode);
  return accepted.map(normalizePositionCode).find((position) => positions.includes(position))
    ?? positions[0]
    ?? "UTIL";
}
