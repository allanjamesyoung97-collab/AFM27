// Training Engine
// Applies training session effects to player fitness, development,
// match readiness, morale, injury risk, and fatigue.
// Also handles assistant-coach delegation logic.

import { trainingCategories, getTrainingCategoryById } from "../data/trainingCategories.js";
import { trainingPrograms, getTrainingProgramById, getPlayerEndurance, calculateRecovery } from "./fitnessEngine.js";
import { getIndividualTrainingAttributes } from "./developmentEngine.js";
import { trainingMoraleChange } from "./moraleEngine.js";

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export function calculateTrainingAttributeProgress(player, focus, categoryId, options = {}) {
  const category = getTrainingCategoryById(categoryId);
  const program = getTrainingProgramById(options.trainingProgram ?? "FULL_TRAINING");
  const developmentGain = Math.max(0, Number(category.effects.development ?? 0))
    * Number(program.developmentMultiplier ?? 1)
    * Number(options.facilityDevelopmentBonus ?? 1);
  if (!developmentGain || focus === "Recovery" || focus === "Position Training") return {};

  const eligibleAttributes = Object.keys(player.attributes ?? {}).filter((attribute) =>
    Number.isFinite(Number(player.attributes[attribute]))
      && (attribute !== "ruckCraft" || player.positions?.some((position) => ["RUC", "RUCK"].includes(position))),
  );
  const individualTargets = getIndividualTrainingAttributes(focus, player);
  const categoryTargets = (category.attributeTargets ?? []).filter((attribute) => eligibleAttributes.includes(attribute));
  // Balanced work touches the player's whole profile. Focused plans concentrate the same work
  // on their relevant attributes, with the selected session type strengthening matching skills.
  const targets = focus === "Balanced"
    ? eligibleAttributes
    : individualTargets.filter((attribute) => eligibleAttributes.includes(attribute));
  if (!targets.length) return {};

  const weights = targets.map((attribute) => {
    const matchesSession = categoryTargets.includes(attribute);
    return focus === "Balanced" ? (matchesSession ? 2.2 : 0.75) : matchesSession ? 2 : 1;
  });
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const totalProgress = developmentGain * 0.03 * (focus === "Balanced" ? 1 : 1.2);
  return Object.fromEntries(targets.map((attribute, index) => [attribute, totalProgress * weights[index] / totalWeight]));
}

// --- Apply a single training session to all players in a squad ---

export function applyTrainingSession(players, playerFitness, categoryId, options = {}) {
  const category = getTrainingCategoryById(categoryId);
  const effects = category.effects;
  const facilityDevelopmentBonus = Number(options.facilityBonuses?.trainingDevelopmentMultiplier ?? 1);
  const next = { ...playerFitness };

  for (const player of players) {
    const id = player.id;
    const state = next[id] ?? { fitness: 100, workload: 0, injury: null, trainingProgram: "FULL_TRAINING" };
    const program = getTrainingProgramById(state.trainingProgram ?? "FULL_TRAINING");

    // Skip injured players from full training — they do recovery work
    if (state.injury && state.injury.weeksRemaining > 0) {
      // Injured players get recovery benefit only
      const recoveryAmount = effects.fatigue < 0 ? Math.abs(effects.fatigue) * 0.3 : 0;
      next[id] = {
        ...state,
        fitness: clamp(state.fitness + recoveryAmount, 0, 100),
      };
      continue;
    }

    // Players on REST don't participate in training sessions
    if (state.trainingProgram === "REST") {
      const restRecovery = 5 + (100 - state.fitness) * 0.05;
      next[id] = {
        ...state,
        fitness: clamp(state.fitness + restRecovery, 0, 100),
        workload: clamp(state.workload * 0.85, 0, 100),
      };
      continue;
    }

    // Program multipliers
    const fatigueMult = program.recoveryMultiplier;
    const developmentMult = program.developmentMultiplier;

    // Apply fatigue effect (negative fatigue = recovery, positive = adds load)
    const fatigueChange = effects.fatigue * fatigueMult;
    // Fatigue increase lowers fitness; fatigue decrease raises fitness
    const fitnessChange = -fatigueChange * 0.5;
    const newFitness = clamp(state.fitness + fitnessChange, 0, 100);

    // Workload impact
    const workloadChange = effects.fatigue > 0 ? effects.fatigue * 0.15 : effects.fatigue * 0.1;
    const newWorkload = clamp(state.workload + workloadChange, 0, 100);

    // Store development contribution for season-end calculation
    const developmentGain = effects.development * developmentMult * facilityDevelopmentBonus;
    const playerDevelopment = options.playerDevelopment?.[id] ?? {};
    const individualFocus = playerDevelopment.positionTraining?.target && !playerDevelopment.positionTraining.complete
      ? "Position Training"
      : playerDevelopment.trainingFocus ?? player.development?.trainingFocus ?? "Balanced";
    const attributeTrainingProgress = { ...(state.attributeTrainingProgress ?? {}) };
    if (developmentGain > 0) {
      // A session adds a small, visible amount of progress to its actual skill targets.
      // Progress is banked across sessions, then converted into attribute points at rollover.
      const perAttributeProgress = calculateTrainingAttributeProgress(player, individualFocus, categoryId, {
        trainingProgram: state.trainingProgram,
        facilityDevelopmentBonus,
      });
      Object.entries(perAttributeProgress).forEach(([attribute, progress]) => {
        attributeTrainingProgress[attribute] = Number(attributeTrainingProgress[attribute] ?? 0) + progress;
      });
    }

    // Readiness and morale accumulate
    const readiness = clamp((state.readiness ?? 50) + effects.readiness * 0.3, 0, 100);
    // Unrounded: rounding each session erased every effect smaller than 2.5 and let morale ratchet upward.
    const morale = trainingMoraleChange(state.morale, effects.morale);

    // Injury risk adjustment
    const injuryRiskAdjust = effects.injuryRisk * 0.1 + program.injuryRiskAdd;

    next[id] = {
      ...state,
      fitness: Math.round(newFitness * 10) / 10,
      workload: Math.round(newWorkload * 10) / 10,
      readiness: Math.round(readiness),
      morale,
      injuryRiskAdjust: clamp(injuryRiskAdjust, -2, 2),
      lastTrainingCategory: categoryId,
      developmentContribution: (state.developmentContribution ?? 0) + developmentGain,
      attributeTrainingProgress,
    };
  }

  return next;
}

// --- Assistant coach AI: decide training category for a given day ---

export function assistantChooseTraining(players, playerFitness, options = {}) {
  const {
    daysToNextMatch = 7,
    lastMatchFatigue = 0,
    upcomingOpponentStrength = 80,
  } = options;

  // Assess squad state
  const availablePlayers = players.filter((p) => {
    const state = playerFitness?.[p.id];
    return !state?.injury || state.injury.weeksRemaining <= 0;
  });

  const avgFitness = availablePlayers.length
    ? availablePlayers.reduce((sum, p) => sum + (playerFitness?.[p.id]?.fitness ?? 100), 0) / availablePlayers.length
    : 100;

  const avgWorkload = availablePlayers.length
    ? availablePlayers.reduce((sum, p) => sum + (playerFitness?.[p.id]?.workload ?? 0), 0) / availablePlayers.length
    : 0;

  const injuredCount = players.filter((p) => {
    const state = playerFitness?.[p.id];
    return state?.injury && state.injury.weeksRemaining > 0;
  }).length;

  // Day after match: recovery
  if (daysToNextMatch >= 6) return "RECOVERY";

  // 5 days out: match review
  if (daysToNextMatch === 5) return "MATCH_REVIEW";

  // Low fitness or high workload: lighter sessions
  if (avgFitness < 55 || avgWorkload > 75) return "RECOVERY";
  if (avgFitness < 65 || avgWorkload > 60) return "SKILLS";

  // Many injuries: focus on conditioning and recovery
  if (injuredCount >= 5) return "CONDITIONING";

  // 2 days out: captain's run
  if (daysToNextMatch === 2) return "CAPTAINS_RUN";

  // Mid-week: pick based on opponent
  if (daysToNextMatch >= 3 && daysToNextMatch <= 4) {
    if (upcomingOpponentStrength > 85) return "CONTESTED_BALL";
    if (avgFitness > 75) return "BALL_MOVEMENT";
    return "SKILLS";
  }

  // Default
  return "SKILLS";
}

// --- Assistant coach: set individual training programs based on player state ---

export function assistantSetTrainingPrograms(players, playerFitness, options = {}) {
  const next = { ...playerFitness };
  const daysToMatch = Number(options.daysToMatch ?? 7);
  const matchSquad = new Set(options.matchSquadNames ?? []);

  for (const player of players) {
    const id = player.id;
    const state = next[id] ?? { fitness: 100, workload: 0, injury: null, trainingProgram: "FULL_TRAINING" };
    const age = Number(player.age ?? 25);
    const endurance = getPlayerEndurance(player);
    const fitness = state.fitness ?? 100;
    const workload = state.workload ?? 0;
    const hasInjury = state.injury && state.injury.weeksRemaining > 0;
    const likelyStarter = matchSquad.size ? matchSquad.has(player.name) : Boolean(options.topPlayerIds?.includes(String(id)));
    const projectedFitness = fitness + Math.max(0, daysToMatch - 1) * (age >= 30 ? 1.7 : 2.2);

    let program = "FULL_TRAINING";

    if (hasInjury) {
      program = "RECOVERY_TRAINING";
    } else if (likelyStarter && daysToMatch <= 3 && projectedFitness < 80) {
      program = fitness < 67 ? "REST" : "RECOVERY_TRAINING";
    } else if (likelyStarter && daysToMatch <= 4 && (fitness < 82 || workload > 55)) {
      program = "LIGHT_TRAINING";
    } else if (age >= 32 && fitness < 70) {
      program = "REST";
    } else if (age >= 30 && (fitness < 75 || workload > 70)) {
      program = "LIGHT_TRAINING";
    } else if (fitness < 50) {
      program = "REST";
    } else if (fitness < 60) {
      program = "RECOVERY_TRAINING";
    } else if (endurance < 55 && workload > 60) {
      program = "LIGHT_TRAINING";
    } else if (age <= 23 && fitness > 75 && workload < 60) {
      program = "FULL_TRAINING";
    } else if (workload > 75) {
      program = "LIGHT_TRAINING";
    }

    next[id] = { ...state, trainingProgram: program };
  }

  return next;
}

// --- Get training session summary for UI ---

export function getTrainingSessionSummary(players, playerFitness, categoryId) {
  const category = getTrainingCategoryById(categoryId);
  const available = players.filter((p) => {
    const state = playerFitness?.[p.id];
    return !state?.injury || state.injury.weeksRemaining <= 0;
  });

  const avgFitness = available.length
    ? Math.round(available.reduce((sum, p) => sum + (playerFitness?.[p.id]?.fitness ?? 100), 0) / available.length)
    : 100;

  const restedCount = available.filter((p) => playerFitness?.[p.id]?.trainingProgram === "REST").length;
  const injuredCount = players.filter((p) => {
    const state = playerFitness?.[p.id];
    return state?.injury && state.injury.weeksRemaining > 0;
  }).length;

  return {
    categoryName: category.name,
    intensity: category.intensity,
    effects: category.effects,
    description: category.description,
    squadSize: available.length,
    avgFitness,
    restedCount,
    injuredCount,
  };
}

// --- Get all training categories for UI ---

export function getAllTrainingCategories() {
  return trainingCategories;
}
