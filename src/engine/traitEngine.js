import { getPlayerTraitIds, getPlayerTraitTier, getPositionFamily, TRAIT_DEFINITIONS } from "../data/footballData.js";
import { getPlayerHeightCm } from "../data/playerHeights.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finiteOr = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const modifierLimits = {
  effectiveDisposal: .08, inside50: .08, scoringRate: .05, mark: .08,
  intercept: .08, contested: .08, clearance: .08, tackle: .08,
  hitout: .08, opponentEffectiveDisposal: .08, opponentMark: .08,
  opponentScoringRate: .05, opponentClearance: .08, freeKickAgainst: .08,
  fatigue: .06, injuryRisk: 1.5,
};
const neutralModifiers = () => Object.fromEntries(Object.keys(modifierLimits).map((key) => [key, 0]));
const rating = (player, attribute) => {
  const value = Number(player?.attributes?.[attribute]);
  return Number.isFinite(value) && value > 0 ? value : finiteOr(player?.overall, 65);
};
const mean = (values) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
const styleId = (tactics) => String(tactics?.style ?? tactics?.teamStyle ?? "");
const height = (player) => Number(getPlayerHeightCm(player) ?? 0);

// A matchup changes the strength of an eligible trait, not the player's base attributes.
// The same table is used by live play, simulated matches and matchup advice.
export const TRAIT_MATCHUP_RULES = Object.freeze([
  { trait: "HIGH_FLYER", against: "SPOILING_SPECIALIST", roles: ["forward"], phase: "aerialContest", factor: .3, edge: -3, reason: "spoiling largely neutralises their aerial marking" },
  { trait: "HIGH_FLYER", against: "LOCKDOWN_DEFENDER", roles: ["forward"], phase: "aerialContest", factor: .7, edge: -2, reason: "close checking limits their leap" },
  { trait: "HIGH_FLYER", against: "BALL_WATCHER", roles: ["forward"], phase: "aerialContest", factor: 1.3, edge: 3, reason: "a ball-watching defender leaves aerial space" },
  { trait: "HIGH_FLYER", against: "LEADING_TARGET", roles: ["defence"], phase: "aerialContest", factor: 1.2, edge: 2, reason: "their aerial range covers the leading target" },
  { trait: "LEADING_TARGET", against: "LOCKDOWN_DEFENDER", roles: ["forward"], phase: "forwardEntry", factor: .65, edge: -2, reason: "tight positioning closes the lead" },
  { trait: "LEADING_TARGET", against: "BALL_WATCHER", roles: ["forward"], phase: "forwardEntry", factor: 1.3, edge: 3, reason: "they can lead into space behind the defender" },
  { trait: "CRUMBING_INSTINCT", against: "SPOILING_SPECIALIST", roles: ["forward"], phase: "groundBall", factor: 1.25, edge: 2, reason: "spoiled balls create ground-level chances" },
  { trait: "X_FACTOR", against: "TAGGING_SPECIALIST", roles: ["midfield"], phase: "transition", factor: .3, edge: -3, reason: "a specialist tag largely removes their space" },
  { trait: "X_FACTOR", against: "LOCKDOWN_DEFENDER", roles: ["forward"], phase: "transition", factor: .7, edge: -2, reason: "close checking limits their space" },
  { trait: "X_FACTOR", against: "ONE_PACE_MIDFIELDER", roles: ["midfield"], phase: "transition", factor: 1.3, edge: 3, reason: "their pace exposes a slower opponent" },
  { trait: "OUTSIDE_RUNNER", against: "ONE_PACE_MIDFIELDER", roles: ["midfield"], phase: "transition", factor: 1.25, edge: 2, reason: "repeat running exposes a slower opponent" },
  { trait: "REBOUND_LAUNCHER", against: "DEFENSIVE_FORWARD", roles: ["defence"], phase: "transition", factor: .35, edge: -3, reason: "forward pressure largely shuts down their rebound" },
  { trait: "TAP_SPECIALIST", against: "RUCK_LIABILITY", roles: ["ruck"], phase: "stoppage", factor: 1.25, edge: 3, reason: "weak opposing ruck craft gives them first use" },
]);

export function getTraitMatchupInteractions(player, opponent, roleFamily, opponentRoleFamily) {
  if (!player || !opponent || !roleFamily) return [];
  const ownTraits = new Set(getPlayerTraitIds(player));
  const opposingTraits = new Set(getPlayerTraitIds(opponent));
  const interactions = TRAIT_MATCHUP_RULES.filter((rule) => {
    if (!ownTraits.has(rule.trait) || !opposingTraits.has(rule.against) || !rule.roles.includes(roleFamily)) return false;
    const source = TRAIT_DEFINITIONS[rule.trait];
    const target = TRAIT_DEFINITIONS[rule.against];
    if (!source?.eligiblePositionFamilies.includes(roleFamily)
      || (opponentRoleFamily && !target?.eligiblePositionFamilies.includes(opponentRoleFamily))) return false;
    const opposingAerialGap = rule.against === "SPOILING_SPECIALIST"
      ? mean([rating(opponent, "marking"), rating(opponent, "verticalLeap")])
        - mean([rating(player, "marking"), rating(player, "verticalLeap")])
        + (height(player) && height(opponent) ? (height(opponent) - height(player)) * .18 : 0)
      : 0;
    return rule.against !== "SPOILING_SPECIALIST" || opposingAerialGap >= -8;
  }).map((rule) => ({ ...rule, label: `${TRAIT_DEFINITIONS[rule.trait].label} vs ${TRAIT_DEFINITIONS[rule.against].label}` }));
  if (ownTraits.has("UNDERSIZED_MID") && roleFamily === "midfield"
    && opponentRoleFamily === "midfield" && !opposingTraits.has("UNDERSIZED_MID")) {
    interactions.push({
      trait: "UNDERSIZED_MID", against: "MIDFIELDER_WITHOUT_UNDERSIZED_MID",
      roles: ["midfield"], phase: "stoppage", factor: 1, edge: -4,
      label: "Undersized Mid matchup", reason: "the opposing midfielder has the height or strength to win more clearance contests",
    });
  }
  return interactions;
}

/** Evaluate a player's traits for one phase against the current opponent. */
export function evaluateTraitContext(player, context = {}) {
  const phase = context.phase;
  const opponent = context.opponent;
  const roleFamily = context.roleFamily ?? getPositionFamily(context.matchPosition)
    ?? (player?.positions ?? []).map(getPositionFamily).find(Boolean);
  const fitness = clamp(finiteOr(context.fitness, 100), 0, 100);
  const sharpness = clamp(finiteOr(context.matchSharpness, 75), 0, 100);
  const active = [];
  const modifiers = neutralModifiers();
  const interactions = [];
  if (!player || !opponent || !roleFamily || fitness < 58 || sharpness < 40) return { active, modifiers, interactions };
  const opponentFitness = clamp(finiteOr(context.opponentFitness, 100), 0, 100);
  const opponentSharpness = clamp(finiteOr(context.opponentMatchSharpness, 75), 0, 100);
  const matchupRules = opponentFitness >= 58 && opponentSharpness >= 40
    ? getTraitMatchupInteractions(player, opponent, roleFamily, context.opponentRoleFamily)
    : [];

  for (const id of getPlayerTraitIds(player)) {
    const definition = TRAIT_DEFINITIONS[id];
    if (!definition?.phases.includes(phase) || !definition.eligiblePositionFamilies.includes(roleFamily)) continue;
    const own = (key) => rating(player, key);
    const other = (key) => rating(opponent, key);
    const gap = (key) => own(key) - other(key);
    const aerialGap = ["HIGH_FLYER", "SPOILING_SPECIALIST", "LOCKDOWN_DEFENDER", "INTERCEPT_DEFENDER"].includes(id)
      ? mean([own("marking"), own("verticalLeap")]) - mean([other("marking"), other("verticalLeap")])
        + (height(player) && height(opponent) ? (height(player) - height(opponent)) * .18 : 0)
      : 0;
    let situation = definition.description;

    if (id === "CLUTCH_PERFORMER") {
      if (Number(context.minute ?? 0) < 75 || Math.abs(Number(context.scoreMargin ?? 999)) > 12 || fitness < 80 || own("endurance") < 75) continue;
      situation = "final five minutes of a close match, with enough fitness to execute";
    } else if (id === "X_FACTOR") {
      const edge = Math.max(gap("speed"), own("creativity") - other("gameAwareness"));
      const fast = ["FAST_TRANSITION", "SLINGSHOT"].includes(styleId(context.tactics));
      if (edge < (fast ? -1 : 3) || (styleId(context.opponentTactics) === "DEFENCE_FIRST" && edge < 6)) continue;
      situation = fast ? "transition space supports a pace or creativity edge" : "pace or creativity advantage over the direct opponent";
    } else if (id === "HIGH_FLYER") {
      if (aerialGap + (roleFamily === "defence" && height(opponent) >= 190 ? 2 : 0) < -3) continue;
      situation = height(opponent) >= 190 ? "aerial opportunity against a tall direct opponent" : "marking and leap advantage in the aerial contest";
    } else if (id === "CONTESTED_BULL") {
      const contestGap = mean([own("groundBallGet"), own("strength"), own("contestedBall")])
        - mean([other("groundBallGet"), other("strength"), other("contestedBall")]);
      if (contestGap + (styleId(context.tactics) === "CONTEST_CLEARANCE" ? 3 : 0) < -2) continue;
      situation = "strength and ground-ball ability hold up at the contest";
    } else if (id === "SET_SHOT_SPECIALIST") {
      if (!context.setShot) continue;
      situation = "set shot with enough composure and kicking to execute";
    } else if (["SPOILING_SPECIALIST", "LOCKDOWN_DEFENDER", "INTERCEPT_DEFENDER"].includes(id)) {
      if (aerialGap < -8 && id !== "LOCKDOWN_DEFENDER") continue;
      situation = height(opponent) >= 190 ? "defending a tall aerial target" : "positioning and reading of the direct opponent";
    } else if (id === "LEADING_TARGET") {
      if (Math.max(gap("acceleration"), gap("positioning")) < -5) continue;
      situation = "lead creates separation from the direct defender";
    } else if (id === "TAP_SPECIALIST") {
      if (gap("ruckCraft") < -7) continue;
      situation = "ruck craft holds up against the opposing ruckman";
    } else if (id === "TAGGING_SPECIALIST") {
      if (!(opponent.positions ?? []).some((position) => getPositionFamily(position) === "midfield")) continue;
      situation = "direct midfield opponent is being closely checked";
    } else if (id === "UNDERSIZED_MID") {
      const opponentIsMidfielder = context.opponentRoleFamily === "midfield"
        || (opponent.positions ?? []).some((position) => getPositionFamily(position) === "midfield");
      if (!opponentIsMidfielder || getPlayerTraitIds(opponent).includes("UNDERSIZED_MID")) continue;
      situation = "clearance contest against a midfielder without the Undersized Mid trait";
    } else if (id === "RISKY_CREATOR") {
      situation = "ambitious disposal offers territory but carries turnover risk";
    } else if (id === "HOT_HEAD") {
      situation = "high contest intensity brings free-kick and report risk";
    }

    const required = definition.attributeDrivers.map((attribute) => own(attribute));
    const deficit = Object.entries(definition.assignmentMaximums ?? {}).map(([key, maximum]) => maximum - own(key));
    const base = definition.category === "drawback"
      ? .75 + mean(deficit) * .018
      : .72 + (mean(required) - 78) * .015;
    const tier = getPlayerTraitTier(player, id);
    const traitRules = matchupRules.filter((rule) => rule.trait === id && rule.phase === phase);
    const matchupFactor = clamp(traitRules.reduce((factor, rule) => factor * rule.factor, 1), .25, 1.4);
    const potency = clamp(base * clamp((fitness - 50) / 35, .45, 1)
      * clamp((sharpness - 30) / 45, .55, 1)
      * (tier === "plus" ? 1.15 : 1) * matchupFactor, .15, 1.4);
    for (const [key, value] of Object.entries(definition.effects)) {
      if (key in modifiers) {
        const riskFactor = key === "effectiveDisposal" && ["RISKY_CREATOR", "REBOUND_LAUNCHER"].includes(id)
          ? clamp((95 - own("decisionMaking")) / 20, .2, 1.3) : 1;
        modifiers[key] += value * potency * riskFactor;
      }
    }
    active.push({ id, label: `${definition.label}${tier === "plus" ? "+" : ""}`, phase, situation, potency: Number(potency.toFixed(2)), matchupFactor, interactions: traitRules });
    for (const rule of traitRules) if (!interactions.some((item) => item.trait === rule.trait && item.against === rule.against)) interactions.push(rule);
  }

  for (const [key, limit] of Object.entries(modifierLimits)) modifiers[key] = Number(clamp(modifiers[key], -limit, limit).toFixed(4));
  return { active, modifiers, interactions };
}

/** Explain opportunities without pretending that future phases are guaranteed. */
export function describeTraitOpportunities(player, opponent, context = {}) {
  const opportunities = [];
  for (const phase of ["stoppage", "contest", "groundBall", "transition", "forwardEntry", "aerialContest", "defensiveContest", "scoring"]) {
    const result = evaluateTraitContext(player, { ...context, opponent, phase });
    for (const activation of result.active) {
      const previous = opportunities.find((item) => item.id === activation.id);
      if (previous) {
        previous.phases.push(phase);
        if (activation.interactions.length) {
          previous.interactions = activation.interactions;
          previous.matchupFactor = activation.matchupFactor;
        }
      }
      else opportunities.push({ ...activation, phases: [phase] });
    }
  }
  return opportunities;
}
