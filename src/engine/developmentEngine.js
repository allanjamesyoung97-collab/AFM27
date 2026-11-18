import { getCareerContract, getCareerClub } from "./contractEngine.js";
import { capOverallAtPotential, getPlayerPotential } from "./potentialRules.js";
import { getCurrentCareerPersonality } from "../data/playerPersonalities.js";

const BASE_GROWTH_PER_SEASON = 2;
const MINIMUM_OVERALL = 40;

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

const teamTrainingMultipliers = {
  BALANCED: 1,
  SKILLS: 1.08,
  FITNESS: 0.94,
  DEFENCE: 1.04,
  ATTACK: 1.04,
  RECOVERY: 0.78,
};

const individualTrainingMultipliers = {
  Balanced: 1,
  Skills: 1.08,
  "Match Review": 1,
  "Ball Movement": 1.08,
  "Contested Ball": 1.06,
  Fitness: 1.05,
  Defence: 1.15,
  "Defensive Structure": 1.08,
  "Forward Craft": 1.12,
  "Forward Structure": 1.08,
  Conditioning: 1.04,
  "Goal Kicking": 1.04,
  Leadership: 1.02,
  "Set Plays": 1,
  "Match Simulation": 1.1,
  "Ruck Craft": 1.08,
  Attack: 1.12,
  Recovery: 0.85,
  "Position Training": 0.9,
};

export const individualTrainingFocuses = [
  "Balanced",
  "Skills",
  "Match Review",
  "Ball Movement",
  "Contested Ball",
  "Fitness",
  "Defensive Structure",
  "Forward Structure",
  "Conditioning",
  "Goal Kicking",
  "Leadership",
  "Set Plays",
  "Match Simulation",
  "Ruck Craft",
  "Recovery",
];

export const individualTrainingFocusAttributes = {
  Balanced: [],
  Skills: ["kicking", "handball", "marking", "groundBallGet", "decisionMaking"],
  "Match Review": ["decisionMaking", "vision", "gameAwareness", "positioning", "composure"],
  "Ball Movement": ["kicking", "handball", "vision", "decisionMaking", "gameAwareness", "speed", "runAndCarry", "creativity"],
  "Contested Ball": ["tackling", "strength", "groundBallGet", "contestedBall", "verticalLeap", "ruckCraft", "competitiveness", "workRate"],
  Fitness: ["speed", "acceleration", "agility", "endurance", "durability", "strength", "verticalLeap"],
  Defence: ["marking", "tackling", "spoiling", "positioning", "gameAwareness", "discipline", "durability", "teamwork"],
  "Defensive Structure": ["spoiling", "marking", "positioning", "gameAwareness", "teamwork", "discipline", "tackling"],
  "Forward Craft": ["goalSense", "marking", "kicking", "composure", "creativity", "positioning", "vision"],
  Attack: ["goalSense", "marking", "kicking", "composure", "creativity", "positioning", "vision"],
  "Forward Structure": ["goalSense", "marking", "kicking", "composure", "creativity", "positioning", "vision"],
  Conditioning: ["strength", "verticalLeap", "endurance", "durability", "ruckCraft"],
  "Goal Kicking": ["goalSense", "kicking", "composure", "creativity"],
  Leadership: ["leadership", "teamwork", "composure", "professionalism", "discipline", "determination"],
  "Set Plays": ["decisionMaking", "positioning", "ruckCraft", "gameAwareness", "teamwork"],
  "Match Simulation": ["gameAwareness", "decisionMaking", "endurance", "groundBallGet", "competitiveness", "composure"],
  "Ruck Craft": ["ruckCraft", "verticalLeap", "strength", "positioning", "gameAwareness", "tackling"],
  Recovery: [],
};

export const trainingAttributeLabels = {
  kicking: "Kicking", handball: "Handball", marking: "Marking", goalSense: "Goal sense",
  tackling: "Tackling", spoiling: "Spoiling", speed: "Speed", acceleration: "Acceleration",
  agility: "Agility", endurance: "Endurance", strength: "Strength", verticalLeap: "Vertical leap",
  vision: "Vision", decisionMaking: "Decision making", positioning: "Positioning", composure: "Composure",
  leadership: "Leadership", creativity: "Creativity", workRate: "Work rate", professionalism: "Professionalism",
  determination: "Determination", teamwork: "Teamwork", competitiveness: "Competitiveness", discipline: "Discipline",
  gameAwareness: "Game awareness", durability: "Durability", ruckCraft: "Ruck craft", groundBallGet: "Ground ball get",
  contestedBall: "Contested ball", runAndCarry: "Run & carry",
};

export function getIndividualTrainingAttributes(focus, player = null) {
  const attributes = individualTrainingFocusAttributes[focus] ?? [];
  return attributes.filter((attribute) => attribute !== "ruckCraft" || player?.positions?.some((position) => ["RUC", "RUCK"].includes(position)));
}

export function getAvailableIndividualTrainingFocuses(player) {
  const isRuck = player?.positions?.some((position) => ["RUC", "RUCK"].includes(position));
  return individualTrainingFocuses.filter((focus) => focus !== "Ruck Craft" || isRuck);
}

/** Build attribute changes from the season's actual exposure, staff, performance and training. */
export function getAttributeSeasonForecast(player, options = {}) {
  const attributes = player?.attributes ?? {};
  const requestedFocus = options.focus ?? player?.development?.trainingFocus ?? "Balanced";
  const focus = requestedFocus === "Position Training" ? "Balanced" : requestedFocus;
  const eligible = Object.keys(attributes).filter((attribute) =>
    Number.isFinite(Number(attributes[attribute]))
      && (attribute !== "ruckCraft" || player?.positions?.some((position) => ["RUC", "RUCK"].includes(position))),
  );
  const seasonMinutes = Math.max(0, Number(options.minutesPlayed ?? 0));
  const matchesPlayed = Math.max(0, Number(options.matchesPlayed ?? 0));
  const exposure = clamp(seasonMinutes / (23 * 80), 0, 1);
  const ageBand = getAgeDevelopmentBand(Number(options.age ?? player?.age), player);
  const ageFactor = ageBand.multiplier;
  const overallChange = Number(options.overallChange ?? 0);
  const coachingMultiplier = clamp(Number(options.coachingMultiplier ?? 1), 0.75, 1.3);
  const teamPlanMultiplier = teamTrainingMultipliers[options.teamPlan] ?? 1;
  const performanceRating = clamp(Number(options.performanceRating ?? 50), 0, 100);
  const trainingProgress = options.trainingProgress ?? {};
  const staffAttributeBonuses = options.staffAttributeBonuses ?? {};
  const savedProgress = options.savedProgress ?? {};
  const trainingVolume = Object.values(trainingProgress).reduce((sum, amount) => sum + Math.max(0, Number(amount ?? 0)), 0);
  const performanceFactor = 0.75 + performanceRating / 250;
  const focusScale = focus === "Balanced" || focus === "Recovery" ? 1 : 1.12;
  const growthBudget = ageFactor > 0
    ? ((Math.max(0, overallChange) * 2.7 * (0.55 + 0.45 * Math.sqrt(exposure)) * ageFactor * coachingMultiplier * performanceFactor)
      + Math.min(5, trainingVolume * 0.42) * ageFactor * coachingMultiplier) * focusScale * teamPlanMultiplier
    : 0;
  const declineBudget = overallChange < 0
    ? Math.abs(overallChange) * (1.25 + Math.max(0, Number(options.age ?? player?.age) - 32) * 0.08)
    : 0;
  const focusedAttributes = getIndividualTrainingAttributes(focus, player);
  const candidates = growthBudget > 0
    ? focus === "Balanced" || focus === "Recovery"
      ? eligible
      : eligible.filter((attribute) => focusedAttributes.includes(attribute))
    : eligible.filter((attribute) => ["speed", "acceleration", "agility", "endurance", "strength", "verticalLeap", "durability"].includes(attribute));
  const growthWeights = candidates.map((attribute) => {
    const current = Number(attributes[attribute] ?? 65);
    const headroom = Math.max(0, 99 - current) / 99;
    const practiced = Math.max(0, Number(trainingProgress[attribute] ?? 0));
    const focusWeight = focus !== "Balanced" && focusedAttributes.includes(attribute) ? 2.2 : 1;
    const practiceWeight = focus === "Balanced" ? 1.2 : 5;
    const staffSpecialism = clamp(1 + Number(staffAttributeBonuses[attribute] ?? 0), 0.8, 1.35);
    return (0.8 + headroom * 0.7 + practiced * practiceWeight) * focusWeight * staffSpecialism;
  });
  const weightTotal = growthWeights.reduce((sum, weight) => sum + weight, 0) || 1;
  const result = {};

  candidates.forEach((attribute, index) => {
    const current = Number(attributes[attribute] ?? 0);
    const baseChange = growthBudget > 0
      ? growthBudget * growthWeights[index] / weightTotal
      : 0;
    const physicalDeclineWeight = ["speed", "acceleration", "agility", "endurance", "strength", "verticalLeap", "durability"].includes(attribute) ? 3 : 0.25;
    const declineWeightTotal = candidates.reduce((sum, key) => sum + (["speed", "acceleration", "agility", "endurance", "strength", "verticalLeap", "durability"].includes(key) ? 3 : 0.25), 0) || 1;
    const change = growthBudget > 0
      ? baseChange
      : declineBudget > 0 ? -declineBudget * physicalDeclineWeight / declineWeightTotal : 0;
    const carry = Number(savedProgress[attribute] ?? 0);
    const capped = change > 0 ? Math.min(change, Math.max(0, 99 - current)) : Math.max(change, 1 - current);
    const netGrowth = clamp(capped + carry, 1 - current, 99 - current);
    result[attribute] = {
      current,
      growth: netGrowth,
      projected: clamp(current + netGrowth, 1, 99),
      carry,
      training: Number(trainingProgress[attribute] ?? 0),
    };
  });

  return {
    attributes: result,
    growthBudget,
    declineBudget,
    exposure,
    seasonMinutes: Math.round(seasonMinutes),
    matchesPlayed,
    ageBand: ageBand.label,
    ageFactor,
    coachingMultiplier,
    teamPlanMultiplier,
    performanceRating,
    performanceFactor,
    trainingVolume,
    focus,
  };
}

export function getPlayerAgeForSeason(player, seasonYear = 2027) {
  const baseAge = Number(player?.age);
  if (!Number.isFinite(baseAge)) return null;
  // The listed age is authoritative for the career's opening 2027 season.
  // Generated players carry their own ageYear; neither birthdays nor draft
  // history should change the age of an existing AFL player mid-season.
  // Older saves anchored draftees to draft day; their first playing season
  // is the following year, except for mid-season selections.
  const draftAgeYear = !player?.ageIsSeasonSnapshot && player?.draft?.year != null && Number.isFinite(Number(player.draft.year))
    ? Number(player.draft.year) + (player.draft.kind === "MID_SEASON" ? 0 : 1)
    : null;
  const ageYear = Number(
    draftAgeYear
      ?? player?.ageYear
      ?? player?.ageAsOfYear
      ?? 2027,
  );
  return baseAge + Math.max(0, Number(seasonYear) - ageYear);
}

export function getDevelopmentArchetype(player) {
  const positions = player?.positions ?? (player?.position ? [player.position] : []);
  if (positions.some(position => ['KPF', 'KPD', 'RUC', 'RUCK'].includes(position))) return 'KEY_POSITION';
  if (positions.some(position => ['MID', 'WING', 'C', 'RR', 'ROV'].includes(position))) return 'MIDFIELDER';
  if (positions.some(position => ['FP', 'HFF', 'FWD'].includes(position)) && Number(player?.height ?? 180) < 188) return 'SMALL_FORWARD';
  return 'GENERAL';
}

export function getAgeDevelopmentBand(age, player) {
  if (!Number.isFinite(Number(age))) return { label: "Age unavailable", multiplier: 0 };
  const archetype = getDevelopmentArchetype(player);
  if (archetype === 'KEY_POSITION') {
    if (age <= 20) return { label: 'Key position · foundation', multiplier: 0.55 };
    if (age <= 23) return { label: 'Key position · building', multiplier: 0.85 };
    if (age <= 27) return { label: 'Key position · prime growth', multiplier: 1.05 };
    if (age <= 30) return { label: 'Key position · established', multiplier: 0.35 };
    if (age <= 32) return { label: 'Key position · veteran decline', multiplier: -0.35 };
    return { label: 'Key position · decline', multiplier: -0.8 };
  }
  if (archetype === 'MIDFIELDER' || archetype === 'SMALL_FORWARD') {
    const early = archetype === 'MIDFIELDER' ? 'Midfield' : 'Small forward';
    if (age <= 22) return { label: `${early} · early growth`, multiplier: 1.12 };
    if (age <= 25) return { label: `${early} · prime growth`, multiplier: 0.78 };
    if (age <= 28) return { label: `${early} · established`, multiplier: 0.3 };
    if (age <= 30) return { label: `${early} · veteran decline`, multiplier: -0.4 };
    return { label: `${early} · decline`, multiplier: -1 };
  }
  if (age < 17) return { label: "Early development", multiplier: 0.75 };
  if (age <= 23) return { label: "Peak development", multiplier: 1 };
  if (age <= 27) return { label: "Late development", multiplier: 0.6 };
  if (age <= 29) return { label: "Established", multiplier: 0 };
  if (age <= 31) return { label: "Veteran decline", multiplier: -0.35 };
  return { label: "Age-related decline", multiplier: -1 };
}

export function getTeamFormRate(clubName, roundHistory = []) {
  const recentMatches = roundHistory
    .flatMap((roundEntry) => (roundEntry.results ?? []).map((match) => ({ ...match, round: roundEntry.round })))
    .filter((match) => (match.homeTeam ?? match.home) === clubName || (match.awayTeam ?? match.away) === clubName)
    .sort((a, b) => a.round - b.round)
    .slice(-5);

  if (!recentMatches.length) return 0.5;

  const formPoints = recentMatches.reduce((total, match) => {
    const isHome = (match.homeTeam ?? match.home) === clubName;
    const ownScore = isHome ? match.homeScore : match.awayScore;
    const opponentScore = isHome ? match.awayScore : match.homeScore;
    if (!Number.isFinite(ownScore) || !Number.isFinite(opponentScore)) return total + 0.5;
    if (ownScore > opponentScore) return total + 1;
    if (ownScore === opponentScore) return total + 0.5;
    return total;
  }, 0);

  return formPoints / recentMatches.length;
}

function getDevelopmentModifiers(player, playerState, context) {
  const teamPlan = context.trainingPlanByClub?.[player.club] ?? "BALANCED";
  const individualFocus = playerState.positionTraining?.target && !playerState.positionTraining.complete
    ? "Position Training" : playerState.trainingFocus ?? player.development?.trainingFocus ?? "Balanced";
  const teamTraining = teamTrainingMultipliers[teamPlan] ?? 1;
  const individualTraining = individualTrainingMultipliers[individualFocus] ?? 1;
  const happiness = clamp(Number(playerState.happiness ?? player.development?.happiness ?? 50), 0, 100);
  const formRate = clamp(Number(context.teamFormByClub?.[player.club] ?? 0.5), 0, 1);
  const morale = clamp(Number(context.clubMorale?.[player.club] ?? 50), 0, 100);
  const facilityMultiplier = Number(
    context.facilityBonusesByClub?.[player.club]?.trainingDevelopmentMultiplier ??
    context.facilityBonuses?.trainingDevelopmentMultiplier ??
    1,
  );
  const performanceRating = clamp(Number(context.playerPerformanceById?.[player.id] ?? 50), 0, 100);
  const performanceMultiplier = 0.9 + performanceRating / 500;
  const minutesPlayed = Math.max(0, Number(context.playerMinutesPlayedById?.[player.id] ?? 0));
  const seasonExposure = clamp(minutesPlayed / (23 * 80), 0, 1);
  const gameExposureMultiplier = 0.72 + Math.sqrt(seasonExposure) * 0.56;
  const completedTrainingContribution = Math.max(0, Number(context.trainingContributionByPlayer?.[player.id] ?? 0));
  const sessionMultiplier = 1 + Math.min(0.15, completedTrainingContribution / 100);
  const combined = clamp(
    teamTraining * individualTraining * (0.75 + happiness * 0.005) * (0.85 + formRate * 0.3) * (0.8 + morale * 0.004) * facilityMultiplier * performanceMultiplier * sessionMultiplier * gameExposureMultiplier,
    0.7,
    1.3,
  );

  return { teamPlan, individualFocus, happiness, formRate, morale, performanceRating, minutesPlayed, seasonExposure, gameExposureMultiplier, completedTrainingContribution, sessionMultiplier, combined };
}

export function getPlayerDevelopmentForecast(player, playerState = {}, context = {}) {
  const age = getPlayerAgeForSeason(player, context.seasonYear ?? 2027);
  const ageBand = getAgeDevelopmentBand(age, player);
  const potential = getPlayerPotential({ ...player, development: { ...player?.development, potential: playerState.potential ?? player?.development?.potential } }, player?.overall);
  // Keep the internal value fractional. Calendar ticks apply small daily changes;
  // rounding here would repeatedly erase that progress before it reaches a full point.
  const savedOverall = Number(playerState.overall ?? player.overall ?? 0);
  const overallExact = clamp(Number.isFinite(savedOverall) ? savedOverall : MINIMUM_OVERALL, MINIMUM_OVERALL, potential);
  const overall = Math.round(overallExact);
  const modifiers = getDevelopmentModifiers(player, playerState, context);

  if (age == null || ageBand.multiplier === 0) {
    return { change: 0, age, ageBand: ageBand.label, potential, overall, ...modifiers };
  }

  if (ageBand.multiplier > 0) {
    const headroom = Math.max(0, potential - overallExact);
    const expected = Math.round(BASE_GROWTH_PER_SEASON * ageBand.multiplier * modifiers.combined);
    return { change: Math.min(headroom, expected), age, ageBand: ageBand.label, potential, overall, ...modifiers };
  }

  const ageDecline = 0.5 + Math.max(0, age - 32) * 0.25;
  const decline = Math.max(1, Math.round(ageDecline * modifiers.combined));
  return { change: -Math.min(Math.max(0, overallExact - MINIMUM_OVERALL), decline), age, ageBand: ageBand.label, potential, overall, ...modifiers };
}

export function getCareerPlayer(player, playerDevelopment = {}, seasonYear = 2027, playerContracts = {}) {
  const saved = playerDevelopment?.[player.id] ?? {};
  const resolvedAge = getPlayerAgeForSeason(player, seasonYear) ?? player.age;
  const potential = getPlayerPotential({ ...player, development: { ...player?.development, potential: saved.potential ?? player?.development?.potential } }, player?.overall);
  const attributes = Object.fromEntries(Object.entries({ ...(player.attributes ?? {}), ...(saved.attributeRatings ?? {}) }).map(([key, value]) => [key, Number.isFinite(Number(value)) ? Math.round(Number(value)) : value]));
  return {
    ...player,
    positions: [...new Set([...(player.positions ?? []), ...(saved.learnedPositions ?? []), ...(saved.positionTraining?.complete && saved.positionTraining.target ? [saved.positionTraining.target] : [])])],
    positionTraining: saved.positionTraining ?? null,
    club: getCareerClub(player, playerContracts),
    age: resolvedAge,
    personality: getCurrentCareerPersonality({ ...player, age: resolvedAge }),
    ageYear: seasonYear,
    ageIsSeasonSnapshot: true,
    overall: capOverallAtPotential({ potential }, saved.overall ?? player.overall ?? 0, potential),
    attributes,
    activeTraits: Array.isArray(saved.activeTraits) ? saved.activeTraits : undefined,
    contract: getCareerContract(player, playerContracts),
    development: {
      ...player.development,
      seasonAge: resolvedAge,
      seasonAgeYear: seasonYear,
      potential,
      growthThisSeason: Number(saved.growthThisSeason ?? player.development?.growthThisSeason ?? 0),
      trainingFocus: saved.positionTraining?.target && !saved.positionTraining.complete ? "Position Training" : saved.trainingFocus === "Position Training" ? "Balanced" : saved.trainingFocus ?? player.development?.trainingFocus ?? "Balanced",
      happiness: Number(saved.happiness ?? player.development?.happiness ?? 50),
    },
  };
}

export function applySeasonDevelopment(players, playerDevelopment = {}, context = {}) {
  const nextDevelopment = { ...playerDevelopment };
  const seasonYear = Number(context.seasonYear ?? 2027);

  players.forEach((player) => {
    const key = player.id;
    const previous = playerDevelopment?.[key] ?? {};
    if (Number(previous.dailyDevelopmentSeason) === seasonYear) return;
    const careerPlayer = getCareerPlayer(player, playerDevelopment, seasonYear);
    const forecast = getPlayerDevelopmentForecast(careerPlayer, previous, context);
    const currentOverall = capOverallAtPotential(careerPlayer, previous.overall ?? player.overall ?? 0, forecast.potential);
    const nextOverall = clamp(currentOverall + forecast.change, MINIMUM_OVERALL, forecast.potential);
    const attributeRatings = { ...(previous.attributeRatings ?? player.attributes ?? {}) };
    const seasonTrainingProgress = context.attributeTrainingProgressByPlayer?.[key] ?? {};
    const attributeForecast = getAttributeSeasonForecast(careerPlayer, {
      focus: forecast.individualFocus,
      age: forecast.age,
      overallChange: forecast.change,
      minutesPlayed: context.playerMinutesPlayedById?.[key] ?? 0,
      matchesPlayed: context.playerGamesPlayedById?.[key] ?? 0,
      performanceRating: context.playerPerformanceById?.[key] ?? 50,
      coachingMultiplier: context.facilityBonusesByClub?.[player.club]?.trainingDevelopmentMultiplier ?? 1,
      teamPlan: context.trainingPlanByClub?.[player.club] ?? "BALANCED",
      trainingProgress: seasonTrainingProgress,
      savedProgress: previous.attributeProgress ?? {},
      staffAttributeBonuses: context.facilityBonusesByClub?.[player.club]?.staffAttributeBonuses ?? context.facilityBonuses?.staffAttributeBonuses ?? {},
    });
    const accumulatedAttributeProgress = { ...(previous.attributeProgress ?? {}) };
    Object.entries(attributeForecast.attributes).forEach(([attribute, projection]) => {
      if (!Number.isFinite(Number(attributeRatings[attribute]))) return;
      const total = Number(projection.growth ?? 0);
      // Apply the nearest whole rating point so a forecast of +0.6 is visible at rollover;
      // the signed remainder carries forward instead of silently rounding every year down.
      const wholeChange = Math.round(total);
      attributeRatings[attribute] = clamp(Number(attributeRatings[attribute]) + wholeChange, 1, 99);
      accumulatedAttributeProgress[attribute] = total - wholeChange;
    });

    nextDevelopment[key] = {
      ...previous,
      overall: nextOverall,
      attributeRatings,
      attributeProgress: accumulatedAttributeProgress,
      lastAttributeDevelopment: {
        growthBudget: Number(attributeForecast.growthBudget.toFixed(2)),
        declineBudget: Number(attributeForecast.declineBudget.toFixed(2)),
        exposure: Number(attributeForecast.exposure.toFixed(3)),
        minutesPlayed: attributeForecast.seasonMinutes,
        matchesPlayed: attributeForecast.matchesPlayed,
        ageBand: attributeForecast.ageBand,
        coachingMultiplier: Number(attributeForecast.coachingMultiplier.toFixed(2)),
        performanceRating: Math.round(attributeForecast.performanceRating),
        trainingVolume: Number(attributeForecast.trainingVolume.toFixed(2)),
      },
      potential: forecast.potential,
      growthThisSeason: Number((nextOverall - currentOverall).toFixed(1)),
      trainingFocus: forecast.individualFocus,
      happiness: forecast.happiness,
      lastAgeBand: forecast.ageBand,
      lastSeason: seasonYear,
    };
  });

  return nextDevelopment;
}

export function updateClubMorale(clubMorale = {}, results = []) {
  const nextMorale = { ...clubMorale };

  results.forEach((match) => {
    const home = match.homeTeam ?? match.home;
    const away = match.awayTeam ?? match.away;
    if (!home || !away || !Number.isFinite(match.homeScore) || !Number.isFinite(match.awayScore)) return;

    const homeDelta = match.homeScore > match.awayScore ? 2 : match.homeScore < match.awayScore ? -2 : 0.5;
    const awayDelta = match.homeScore > match.awayScore ? -2 : match.homeScore < match.awayScore ? 2 : 0.5;
    nextMorale[home] = clamp(Number(nextMorale[home] ?? 50) + homeDelta, 0, 100);
    nextMorale[away] = clamp(Number(nextMorale[away] ?? 50) + awayDelta, 0, 100);
  });

  return nextMorale;
}
