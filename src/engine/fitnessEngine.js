// Fitness & Injury Engine
// Handles per-player fitness loss from matches, injury generation,
// recovery between matches, and workload tracking.
//
// Player fitness state is stored in a map keyed by player ID:
//   { [playerId]: { fitness: 0-100, endurance, injury: null | {...}, workload: 0-100, recentTOG: 0-100, trainingProgram: "FULL_TRAINING" } }
import { getPlayerTraitIds, getPlayerTraitTier } from "../data/footballData.js";

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

// --- Injury definitions ---

export const injuryTypes = [
  { name: "General Soreness", category: "MINOR", minWeeks: 0, maxWeeks: 1, baseRecovery: 3 },
  { name: "Cork", category: "MINOR", minWeeks: 0, maxWeeks: 1, baseRecovery: 4 },
  { name: "Ankle Sprain", category: "SHORT", minWeeks: 1, maxWeeks: 2, baseRecovery: 6 },
  { name: "Hamstring Strain (Grade 1)", category: "SHORT", minWeeks: 1, maxWeeks: 3, baseRecovery: 8 },
  { name: "Groin Strain", category: "SHORT", minWeeks: 2, maxWeeks: 3, baseRecovery: 9 },
  { name: "Concussion", category: "MEDIUM", minWeeks: 1, maxWeeks: 2, baseRecovery: 12 },
  { name: "Calf Strain", category: "MEDIUM", minWeeks: 3, maxWeeks: 5, baseRecovery: 14 },
  { name: "Hamstring Strain (Grade 2)", category: "MEDIUM", minWeeks: 3, maxWeeks: 6, baseRecovery: 16 },
  { name: "Knee Sprain (MCL)", category: "MEDIUM", minWeeks: 3, maxWeeks: 6, baseRecovery: 18 },
  { name: "Shoulder Dislocation", category: "LONG", minWeeks: 6, maxWeeks: 12, baseRecovery: 24 },
  { name: "Stress Fracture", category: "LONG", minWeeks: 8, maxWeeks: 14, baseRecovery: 28 },
  { name: "ACL Tear", category: "LONG", minWeeks: 10, maxWeeks: 16, baseRecovery: 36 },
  { name: "Achilles Tendon Injury", category: "LONG", minWeeks: 8, maxWeeks: 16, baseRecovery: 32 },
];

const minorInjuries = injuryTypes.filter((i) => i.category === "MINOR");
const shortInjuries = injuryTypes.filter((i) => i.category === "SHORT");
const mediumInjuries = injuryTypes.filter((i) => i.category === "MEDIUM");
const longInjuries = injuryTypes.filter((i) => i.category === "LONG");

// --- Endurance ---

export function getPlayerEndurance(player) {
  const fromAttrs = Number(player?.attributes?.endurance);
  if (Number.isFinite(fromAttrs)) return clamp(Math.round(fromAttrs), 1, 99);
  return 60;
}

// --- Time on Ground defaults ---

export function getDefaultTimeOnGround(player) {
  const overall = Number(player?.overall ?? 0);
  const positions = player?.positions ?? [];
  const tier = player?.ratingsSeed?.tier ?? "Depth";
  const isKP = positions.some((p) => p === "KPF" || p === "KPD");

  if (isKP && overall >= 83) return 90;
  if (overall >= 88) return 85;
  if (overall >= 80) return 80;
  if (overall >= 73) return 70;
  if (tier === "Rookie" || overall < 65) return 45;
  if (tier === "Depth" || overall < 73) return 55;
  return 70;
}

export function getDefaultTOGForSquad(players) {
  const result = {};
  for (const player of players) {
    result[player.id] = getDefaultTimeOnGround(player);
  }
  return result;
}

// Normalize TOG so squad total = 100% * squadSize (each player's share of total on-field minutes).
// 18 players on field at any time out of a squad; TOG% is individual.
// We ensure the average TOG across selected players is reasonable.
export function normalizeTOG(togMap, playerIds) {
  const entries = playerIds.map((id) => [id, Number(togMap[id] ?? 70)]);
  const total = entries.reduce((sum, [, v]) => sum + v, 0);
  if (total === 0) {
    const even = Math.round(100 / entries.length);
    return Object.fromEntries(entries.map(([id]) => [id, even]));
  }
  const factor = (100 * entries.length) / total;
  const normalized = entries.map(([id, v]) => [id, clamp(Math.round(v * factor), 10, 100)]);
  return Object.fromEntries(normalized);
}

// --- Fitness loss from a match ---

export function calculateFitnessLoss(player, fitnessState, togPercent) {
  const endurance = getPlayerEndurance(player);
  const age = Number(player?.age ?? 25);
  const currentFitness = clamp(fitnessState?.fitness ?? 100, 0, 100);
  const isCarryingInjury = Boolean(fitnessState?.injury);
  const tog = clamp(togPercent ?? 70, 0, 100);

  // Base loss scales with time on ground
  const togFactor = tog / 100;
  let baseLoss = 10 * togFactor + 3;

  // Endurance: high endurance reduces loss
  const enduranceFactor = 1.4 - (endurance / 100) * 0.8;
  baseLoss *= enduranceFactor;

  // Age: older players lose more
  const ageFactor = age >= 32 ? 1.3 : age >= 30 ? 1.15 : age >= 28 ? 1.05 : age <= 21 ? 0.85 : 1;
  baseLoss *= ageFactor;

  // Already low fitness: compounding fatigue
  const lowFitnessFactor = currentFitness < 60 ? 1.15 : currentFitness < 40 ? 1.3 : 1;
  baseLoss *= lowFitnessFactor;

  const traits = getPlayerTraitIds(player);
  if (traits.includes("DURABLE_PROFESSIONAL")) baseLoss *= getPlayerTraitTier(player, "DURABLE_PROFESSIONAL") === "plus" ? .91 : .95;
  if (traits.includes("CONTESTED_BULL")) baseLoss *= 1.03;
  if (traits.includes("FOLLOW_UP_RUCK")) baseLoss *= 1.03;

  // Carrying injury: more fatigue
  if (isCarryingInjury) baseLoss *= 1.2;

  return clamp(Math.round(baseLoss * 10) / 10, 0, 30);
}

// --- Injury probability ---

export function calculateInjuryRisk(player, fitnessState, togPercent, facilityBonuses = {}) {
  const endurance = getPlayerEndurance(player);
  const age = Number(player?.age ?? 25);
  const currentFitness = clamp(fitnessState?.fitness ?? 100, 0, 100);
  const workload = clamp(fitnessState?.workload ?? 0, 0, 100);
  const tog = clamp(togPercent ?? 70, 0, 100);
  const isCarryingInjury = Boolean(fitnessState?.injury);

  // Base risk per match (~2% for a healthy young player at 70% TOG)
  let risk = 1.5;

  // Age factor
  if (age >= 34) risk += 2.5;
  else if (age >= 30) risk += 1.5;
  else if (age >= 28) risk += 0.7;
  else if (age <= 20) risk -= 0.3;

  // Low endurance factor
  const endurancePenalty = (60 - endurance) * 0.04;
  if (endurancePenalty > 0) risk += endurancePenalty;

  // Durability represents long-term physical resilience, separate from current fitness.
  const durability = clamp(Number(player?.attributes?.durability ?? 65), 1, 99);
  risk += (65 - durability) * 0.035;

  const traits = getPlayerTraitIds(player, fitnessState);
  if (traits.includes("HIGH_FLYER")) risk += .55 * Math.max(.5, tog / 80) * (durability >= 86 ? .7 : 1);
  if (traits.includes("INJURY_PRONE")) risk += .7 * Math.max(.5, tog / 80);
  if (traits.includes("DURABLE_PROFESSIONAL")) risk -= getPlayerTraitTier(player, "DURABLE_PROFESSIONAL") === "plus" ? .45 : .3;

  // Low fitness factor
  if (currentFitness < 50) risk += (50 - currentFitness) * 0.06;
  else if (currentFitness < 70) risk += (70 - currentFitness) * 0.02;

  // High workload (recent accumulated load)
  if (workload > 70) risk += (workload - 70) * 0.05;
  else if (workload > 50) risk += (workload - 50) * 0.02;

  // High TOG
  if (tog > 85) risk += (tog - 85) * 0.08;
  else if (tog > 75) risk += (tog - 75) * 0.03;

  // Training load adjustments carry into match-day injury risk.
  risk += clamp(Number(fitnessState?.injuryRiskAdjust ?? 0), -2, 2);

  // Carrying injury increases re-injury risk
  if (isCarryingInjury) risk += 1.5;

  risk *= 1 - clamp(Number(facilityBonuses.injuryRiskReduction ?? 0), 0, 0.5);
  return clamp(Math.round(risk * 100) / 100, 0.2, 25);
}

// --- Injury generation ---

export function generateInjury(player, fitnessState, togPercent, facilityBonuses = {}, random = Math.random) {
  const risk = calculateInjuryRisk(player, fitnessState, togPercent, facilityBonuses);
  const roll = random() * 100;

  if (roll > risk) return null;

  const currentFitness = clamp(fitnessState?.fitness ?? 100, 0, 100);
  const age = Number(player?.age ?? 25);
  const workload = clamp(fitnessState?.workload ?? 0, 0, 100);

  // Determine severity bucket — lower fitness, higher workload, older age shift toward worse injuries
  let severityRoll = random();
  const severityAdjust =
    (currentFitness < 50 ? 0.15 : 0) +
    (workload > 70 ? 0.1 : 0) +
    (age >= 32 ? 0.1 : 0) +
    (age >= 35 ? 0.05 : 0);
  severityRoll = clamp(severityRoll + severityAdjust, 0, 1);

  let pool;
  if (severityRoll < 0.45) pool = minorInjuries;
  else if (severityRoll < 0.75) pool = shortInjuries;
  else if (severityRoll < 0.92) pool = mediumInjuries;
  else pool = longInjuries;

  const injury = pool[Math.floor(random() * pool.length)];
  const weeksRemaining = injury.minWeeks + Math.floor(random() * (injury.maxWeeks - injury.minWeeks + 1));

  return {
    name: injury.name,
    category: injury.category,
    weeksRemaining,
    // Use the rolled duration as the recovery baseline so the displayed
    // countdown and the progress bar stay in sync.
    baselineWeeks: weeksRemaining,
    recovery: 0,
    sustainedRound: null,
  };
}

// --- Fitness recovery ---

export function calculateRecovery(player, fitnessState, daysRest, trainingIntensity = 2, facilityBonuses = {}) {
  const endurance = getPlayerEndurance(player);
  const age = Number(player?.age ?? 25);
  const currentFitness = clamp(fitnessState?.fitness ?? 100, 0, 100);
  const isCarryingInjury = Boolean(fitnessState?.injury);
  const program = fitnessState?.trainingProgram ?? "FULL_TRAINING";

  // Base recovery per day
  let dailyRecovery = 3;

  // Endurance: high endurance recovers faster
  dailyRecovery *= 0.7 + (endurance / 100) * 0.6;

  // Age: older players recover slower
  if (age >= 34) dailyRecovery *= 0.6;
  else if (age >= 30) dailyRecovery *= 0.75;
  else if (age >= 28) dailyRecovery *= 0.85;
  else if (age <= 21) dailyRecovery *= 1.15;

  // Injury slows recovery
  if (isCarryingInjury) dailyRecovery *= 0.3;

  // Training program affects recovery
  if (program === "REST") dailyRecovery *= 1.6;
  else if (program === "RECOVERY_TRAINING") dailyRecovery *= 1.3;
  else if (program === "LIGHT_TRAINING") dailyRecovery *= 1.1;
  else if (program === "FULL_TRAINING") dailyRecovery *= 0.85;

  // Training intensity from the category (1-6 scale)
  // Higher intensity = less recovery
  dailyRecovery *= 1.1 - trainingIntensity * 0.05;
  dailyRecovery *= Number(facilityBonuses.medicalRecoveryMultiplier ?? 1);

  // Already high fitness: diminishing returns
  if (currentFitness > 85) dailyRecovery *= 0.5;
  else if (currentFitness > 70) dailyRecovery *= 0.75;

  const totalRecovery = dailyRecovery * Math.max(0, daysRest);
  return clamp(Math.round(totalRecovery * 10) / 10, 0, 100);
}

// --- Workload tracking ---

export function updateWorkload(fitnessState, togPercent, facilityBonuses = {}) {
  const current = clamp(fitnessState?.workload ?? 0, 0, 100);
  const tog = clamp(togPercent ?? 70, 0, 100);
  // Add load from this match, then apply natural decay
  const addedLoad = tog * 0.4 * clamp(Number(facilityBonuses.fatigueAccumulationMultiplier ?? 1), 0.5, 1.5);
  return clamp(current * 0.7 + addedLoad, 0, 100);
}

// --- Full match application ---

export function applyMatchToPlayers(players, togMap, playerFitness, options = {}) {
  const next = { ...playerFitness };
  const { simulateAll = false, facilityBonuses = {}, playedPlayerIds = null, random = Math.random, date = null, matchId = null, club = null } = options;
  const selectedIds = playedPlayerIds == null ? null : new Set(playedPlayerIds.map(String));

  for (const player of players) {
    const id = player.id;
    const state = next[id] ?? { fitness: 100, workload: 0, injury: null, trainingProgram: "FULL_TRAINING" };
    if (selectedIds && !selectedIds.has(String(id))) {
      next[id] = state;
      continue;
    }
    const tog = togMap?.[id] ?? getDefaultTimeOnGround(player);

    // Skip if already injured (injured players don't play)
    if (state.injury && state.injury.weeksRemaining > 0) {
      next[id] = state;
      continue;
    }

    // Calculate fitness loss
    const fitnessLoss = calculateFitnessLoss(player, state, tog);
    const newFitness = clamp(state.fitness - fitnessLoss, 0, 100);

    // Roll for injury
    const injury = generateInjury(player, { ...state, fitness: newFitness }, tog, facilityBonuses, random);
    const newWorkload = updateWorkload(state, tog, facilityBonuses);

    const injuryEvents = injury ? [...(state.injuryEvents ?? []), { id: `${matchId ?? "match"}:${id}:${date ?? "unknown"}`, date, matchId, club: club ?? player.club ?? null, name: injury.name, category: injury.category, weeks: injury.weeksRemaining }] : state.injuryEvents;
    next[id] = {
      ...state,
      fitness: Math.round(newFitness * 10) / 10,
      workload: Math.round(newWorkload * 10) / 10,
      recentTOG: tog,
      matchSharpness: Math.round(clamp(Number(state.matchSharpness ?? 65) + (100 - Number(state.matchSharpness ?? 65)) * 0.28 * tog / 80, 0, 100)),
      injury: injury ?? state.injury,
      injuryHistory: Number(state.injuryHistory ?? 0) + (injury ? 1 : 0),
      injuryEvents,
      careerInjuryWeeks: Number(state.careerInjuryWeeks ?? 0) + Number(injury?.weeksRemaining ?? 0),
    };
  }

  return next;
}

// --- Recovery cycle (between matches) ---

export function applyRecoveryCycle(players, playerFitness, daysRest, trainingIntensity = 2, facilityBonuses = {}) {
  const next = { ...playerFitness };

  for (const player of players) {
    const id = player.id;
    const state = next[id] ?? { fitness: 100, workload: 0, injury: null, trainingProgram: "FULL_TRAINING" };

    const recovery = calculateRecovery(player, state, daysRest, trainingIntensity, facilityBonuses);
    const restoration = Number(facilityBonuses.postMatchFitnessRestoration ?? 0);
    const newFitness = clamp(state.fitness + recovery + restoration, 0, 100);

    // Workload decays during rest
    const newWorkload = clamp(state.workload * Math.pow(0.85, daysRest), 0, 100);

    // Injury recovery
    let newInjury = state.injury;
    if (newInjury && newInjury.weeksRemaining > 0) {
      const recoveryRate = (daysRest / 7) * Number(facilityBonuses.injuryRecoveryMultiplier ?? 1);
      const recoveryPercent = clamp(
        (newInjury.recovery ?? 0) + recoveryRate * 100 / Math.max(1, newInjury.baselineWeeks ?? newInjury.weeksRemaining ?? 1),
        0, 100
      );
      const weeksAfterRecovery = Math.max(
        0,
        Math.ceil((newInjury.baselineWeeks ?? newInjury.weeksRemaining) * (1 - recoveryPercent / 100)),
      );
      newInjury = {
        ...newInjury,
        weeksRemaining: weeksAfterRecovery,
        recovery: Math.round(recoveryPercent),
      };
    }

    next[id] = {
      ...state,
      fitness: Math.round(newFitness * 10) / 10,
      workload: Math.round(newWorkload * 10) / 10,
      matchSharpness: Math.round(clamp(Number(state.matchSharpness ?? 65) - daysRest * (newInjury?.weeksRemaining > 0 ? 0.8 : 0.22), 0, 100) * 10) / 10,
      injury: newInjury,
    };
  }

  return next;
}

// --- Advance injuries by N rounds (for simulated rounds) ---

export function advanceInjuries(playerFitness, roundsElapsed = 1, facilityBonuses = {}) {
  const next = { ...playerFitness };
  for (const [id, state] of Object.entries(next)) {
    if (state.injury && state.injury.weeksRemaining > 0) {
      const effectiveRounds = roundsElapsed * Number(facilityBonuses.injuryRecoveryMultiplier ?? 1);
      const recoveryPercent = clamp(
        (state.injury.recovery ?? 0) + (effectiveRounds / state.injury.baselineWeeks) * 100,
        0, 100
      );
      const weeks = Math.max(
        0,
        Math.ceil((state.injury.baselineWeeks ?? state.injury.weeksRemaining) * (1 - recoveryPercent / 100)),
      );
      next[id] = {
        ...state,
        injury: {
          ...state.injury,
          weeksRemaining: weeks,
          recovery: Math.round(recoveryPercent),
        },
      };
    }
  }
  return next;
}

// --- Helpers for UI ---

export function getFitnessColor(fitness) {
  if (fitness >= 80) return "#22c55e";
  if (fitness >= 60) return "#84cc16";
  if (fitness >= 40) return "#f59e0b";
  return "#ef4444";
}

export function getInjuryCategoryColor(category) {
  switch (category) {
    case "MINOR": return "#84cc16";
    case "SHORT": return "#f59e0b";
    case "MEDIUM": return "#f97316";
    case "LONG": return "#dc2626";
    default: return "#94a3b8";
  }
}

export function getAvailablePlayers(players, playerFitness) {
  return players.filter((player) => {
    const state = playerFitness?.[player.id];
    if (Number(state?.suspension?.matchesRemaining ?? 0) > 0) return false;
    if (!state?.injury) return true;
    return state.injury.weeksRemaining <= 0;
  });
}

export function getInjuredPlayers(players, playerFitness) {
  return players
    .map((player) => {
      const state = playerFitness?.[player.id];
      if (!state?.injury || state.injury.weeksRemaining <= 0) return null;
      return { player, ...state.injury, fitness: state.fitness };
    })
    .filter(Boolean);
}

// --- Initialize fitness state for a squad ---

export function initializeFitnessState(players) {
  const state = {};
  for (const player of players) {
    state[player.id] = {
      fitness: 100,
      workload: 0,
      injury: null,
      recentTOG: getDefaultTimeOnGround(player),
      matchSharpness: 65,
      morale: 50,
      reservesAssignment: "RESERVES",
      trainingProgram: "FULL_TRAINING",
    };
  }
  return state;
}

// --- Individual training programs ---

export const trainingPrograms = [
  { id: "FULL_TRAINING", name: "Full Training", description: "Maximises development but increases fatigue and injury risk.", recoveryMultiplier: 0.85, developmentMultiplier: 1.0, fatigueAdd: 2, injuryRiskAdd: 0 },
  { id: "LIGHT_TRAINING", name: "Light Training", description: "Reduced load. Slightly less development, better recovery.", recoveryMultiplier: 1.1, developmentMultiplier: 0.7, fatigueAdd: 0, injuryRiskAdd: -0.3 },
  { id: "RECOVERY_TRAINING", name: "Recovery Training", description: "Focuses on restoring fitness while maintaining match readiness.", recoveryMultiplier: 1.3, developmentMultiplier: 0.4, fatigueAdd: -3, injuryRiskAdd: -0.5 },
  { id: "REST", name: "Rest", description: "No training. Maximum fitness recovery but sacrifices development.", recoveryMultiplier: 1.6, developmentMultiplier: 0.1, fatigueAdd: -5, injuryRiskAdd: -1.0 },
];

export function getTrainingProgramById(id) {
  return trainingPrograms.find((p) => p.id === id) ?? trainingPrograms[0];
}
