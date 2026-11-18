import { positionGroups } from "../data/positionGroups.js";

const STARTING_LINES = {
  DEF: ["BP1", "FB", "BP2", "HB1", "CHB", "HB2"],
  MID: ["W1", "C", "W2", "RR", "ROV"],
  FWD: ["HF1", "CHF", "HF2", "FP1", "FF", "FP2"],
  RUC: ["R"],
  INT: ["INT1", "INT2", "INT3", "INT4", "INT5"],
};

export const BEST_TEAM_LINES = [
  { key: "FWD", label: "Forwards", slots: STARTING_LINES.FWD },
  { key: "MID", label: "Midfielders", slots: STARTING_LINES.MID },
  { key: "RUC", label: "Ruckmen", slots: STARTING_LINES.RUC },
  { key: "DEF", label: "Defenders", slots: STARTING_LINES.DEF },
  { key: "INT", label: "Interchange", slots: STARTING_LINES.INT },
];

function averageOverall(players) {
  const ratings = players.map((player) => Number(player?.overall)).filter(Number.isFinite);
  return ratings.length ? Number((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length).toFixed(1)) : null;
}

function averageAge(players) {
  const ages = players.map((player) => Number(player?.age)).filter((age) => Number.isFinite(age) && age > 0);
  return ages.length ? Number((ages.reduce((sum, age) => sum + age, 0) / ages.length).toFixed(1)) : null;
}

export function getClubStrengthProfile(clubPlayers = []) {
  const bestTeam = getClubBestTeam(clubPlayers);
  const bestTeamPlayers = bestTeam.lines
    ? Object.values(bestTeam.lines).flatMap((line) => line.map(({ player }) => player).filter(Boolean))
    : [];
  return {
    ...bestTeam,
    squadOverall: averageOverall(clubPlayers),
    squadAge: averageAge(clubPlayers),
    bestTeamAge: bestTeamPlayers.length
      ? Number((bestTeamPlayers.reduce((sum, player) => sum + Number(player.age ?? 0), 0) / bestTeamPlayers.length).toFixed(1))
      : null,
  };
}

export function getClubBestTeam(clubPlayers = []) {
  const available = [...clubPlayers];
  const selectedSide = {};
  // Fill scarce roles first, so a versatile defender is not used at BP while
  // leaving a key defender or ruck slot vacant.
  const orderedSlots = Object.entries(positionGroups).sort((a, b) => {
    const eligibleCount = ([, codes]) => codes.length
      ? clubPlayers.filter((player) => player.positions?.some((position) => codes.includes(position))).length
      : Number.POSITIVE_INFINITY;
    return eligibleCount(a) - eligibleCount(b);
  });
  for (const [slot, codes] of orderedSlots) {
    const candidates = available.filter((player) => !codes.length || player.positions?.some((position) => codes.includes(position)));
    candidates.sort((a, b) => Number(b.overall ?? 0) - Number(a.overall ?? 0));
    selectedSide[slot] = candidates[0] ?? null;
    if (candidates[0]) available.splice(available.indexOf(candidates[0]), 1);
  }
  const lines = Object.fromEntries(Object.entries(STARTING_LINES).map(([key, slots]) => [
    key,
    slots.map((slot) => ({ slot, player: selectedSide[slot] })),
  ]));
  const bestTeamPlayers = Object.values(lines).flatMap((line) => line.map(({ player }) => player).filter(Boolean));

  return {
    lines,
    selectedCount: bestTeamPlayers.length,
    bestTeamOverall: averageOverall(bestTeamPlayers),
    mid: averageOverall(lines.MID.map(({ player }) => player).filter(Boolean)),
    fwd: averageOverall(lines.FWD.map(({ player }) => player).filter(Boolean)),
    def: averageOverall(lines.DEF.map(({ player }) => player).filter(Boolean)),
    ruc: averageOverall(lines.RUC.map(({ player }) => player).filter(Boolean)),
  };
}
