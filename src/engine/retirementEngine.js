import { getPlayerAgeForSeason } from "./developmentEngine.js";

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

function stableRoll(playerId, seasonYear) {
  const key = `${playerId}:${seasonYear}:retirement`;
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

function appearancesByPlayer(seasonState = {}) {
  const results = [
    ...(seasonState.roundHistory ?? []).flatMap((round) => round.results ?? []),
    ...(seasonState.wildcardResults ?? []),
    ...(seasonState.finalsHistory ?? []).flatMap((week) => week.results ?? []),
  ];
  const appearances = new Map();
  for (const match of results) {
    for (const stat of [...(match.playerStats?.home ?? []), ...(match.playerStats?.away ?? [])]) {
      if (stat.playerId == null || Number(stat.timeOnGround ?? 0) <= 0) continue;
      const id = String(stat.playerId);
      appearances.set(id, (appearances.get(id) ?? 0) + 1);
    }
  }
  return appearances;
}

function ageRisk(age) {
  if (age < 30) return 0;
  if (age === 30) return 0.5;
  if (age === 31) return 1.5;
  if (age === 32) return 4;
  if (age === 33) return 10;
  if (age === 34) return 22;
  if (age === 35) return 40;
  if (age === 36) return 61;
  if (age === 37) return 79;
  if (age === 38) return 91;
  return 97;
}

export function evaluateRetirement(player, { contract = {}, appearances = 0, fitness = {}, seasonYear = 2027 } = {}) {
  const age = getPlayerAgeForSeason(player, seasonYear);
  if (age == null || !Number.isFinite(Number(age))) {
    return { shouldRetire: false, risk: 0, roll: 1, age: null, reason: null };
  }

  let risk = ageRisk(Number(age));
  if (appearances >= 15) risk -= 4;
  else if (appearances >= 8) risk -= 1;
  else if (appearances <= 5) risk += 7;

  const overall = Number(player.overall ?? 60);
  if (overall >= 85) risk -= 2;
  else if (overall <= 65) risk += 3;

  const attributes = player.attributes ?? {};
  const durability = Number(attributes.durability);
  if (Number.isFinite(durability)) {
    if (durability < 45) risk += 6;
    else if (durability < 60) risk += 2;
    else if (durability >= 85) risk -= 2;
  }

  const currentInjuryWeeks = Number(fitness?.injury?.weeksRemaining ?? 0);
  if (currentInjuryWeeks >= 6) risk += 5;
  const pastInjuries = Number(fitness?.injuryHistory ?? 0);
  if (pastInjuries >= 6) risk += 8;
  else if (pastInjuries >= 3) risk += 4;
  const professionalism = Number(attributes.professionalism ?? player.personality?.professionalism);
  if (Number.isFinite(professionalism) && professionalism >= 80) risk -= 2;

  const yearsRemaining = Number(contract.yearsRemaining ?? player.contract?.yearsRemaining ?? 0);
  if (yearsRemaining > 0) risk *= 0.18;
  risk = clamp(risk, 0, 99);

  const roll = stableRoll(player.id, seasonYear);
  let reason = "Age and career stage";
  if (appearances <= 5 && age >= 32) reason = "Reduced senior opportunities";
  else if ((durability < 45 || currentInjuryWeeks >= 6) && age >= 32) reason = "Durability and injury load";

  return {
    shouldRetire: roll * 100 < risk,
    risk: Math.round(risk),
    roll,
    age: Number(age),
    reason,
    appearances,
  };
}

export function decideSeasonRetirements(players, contractsByPlayer = {}, seasonState = {}, playerFitness = {}, seasonYear = 2027, playerDevelopment = {}) {
  const appearances = appearancesByPlayer(seasonState);
  return players.flatMap((player) => {
    const id = String(player.id);
    const contract = contractsByPlayer[id] ?? {};
    if (contract.retired || contract.delisted) return [];
    const development = playerDevelopment[id] ?? {};
    const currentPlayer = {
      ...player,
      overall: development.overall ?? player.overall,
      attributes: { ...(player.attributes ?? {}), ...(development.attributeRatings ?? {}) },
    };
    const decision = evaluateRetirement(currentPlayer, {
      contract,
      appearances: appearances.get(id) ?? 0,
      fitness: playerFitness?.[id],
      seasonYear,
    });
    return decision.shouldRetire ? [{ player: currentPlayer, ...decision }] : [];
  });
}
