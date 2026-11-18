// Contract Value Engine — calculates a player's market value.
// Combines ability, age, form, reputation, position, greed, and market competition.

import { getClubAttraction } from "../data/clubAttraction.js";
import { getEconomyFactor, getMaximumSalary, getMinimumSalary } from "./salaryCap.js";

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

// Age modifier: players peak financially at 25-29.
export function getAgeModifier(age) {
  if (age <= 20) return 0.75;
  if (age <= 24) return 0.95;
  if (age <= 29) return 1.10;
  if (age <= 32) return 0.95;
  return 0.80;
}

// Form modifier based on previous season performance rating (0-100, 50 = average).
export function getFormModifier(formRating = 50) {
  if (formRating >= 85) return 1.30;
  if (formRating >= 70) return 1.15;
  if (formRating >= 55) return 1.0;
  if (formRating >= 40) return 0.92;
  return 0.80;
}

// Reputation modifier: premierships, All-Australians, B&F, Brownlow votes.
export function getReputationModifier(player) {
  const stats = player.careerStats ?? {};
  let rep = 0;
  rep += (stats.premierships ?? 0) * 0.05;
  rep += (stats.allAustralians ?? 0) * 0.04;
  rep += (stats.bestAndFairests ?? 0) * 0.02;
  rep += (stats.brownlowVotes ?? 0) * 0.001;
  return clamp(1 + rep, 1.0, 1.35);
}

// Position modifier: midfielders and key position players command more.
const positionModifiers = {
  MID: 1.15,
  WING: 1.05,
  KPF: 1.10,
  KPD: 1.08,
  RUC: 1.06,
  HF: 1.0,
  FF: 1.0,
  HB: 0.95,
  BP: 0.92,
};

export function getPositionModifier(player) {
  const pos = player.positions?.[0] ?? "MID";
  return positionModifiers[pos] ?? 1.0;
}

// Greed modifier: multiplies the financial demand.
export function getGreedModifier(greed) {
  if (greed <= 20) return 0.85;
  if (greed <= 40) return 0.95;
  if (greed <= 60) return 1.0;
  if (greed <= 80) return 1.20;
  return 1.35;
}

// Market competition: more interested clubs = higher demand.
export function getMarketCompetitionModifier(interestedClubCount = 1) {
  if (interestedClubCount <= 1) return 1.0;
  if (interestedClubCount === 2) return 1.08;
  if (interestedClubCount === 3) return 1.15;
  if (interestedClubCount <= 5) return 1.30;
  if (interestedClubCount <= 7) return 1.40;
  return 1.50;
}

// Base AFL salary derived from ability rating (overall).
//
// Pay is convex in ability: it rises about 7% for every overall point, so a 96 earns
// roughly four times a 77 and depth players sit close to the minimum. The curve is
// anchored on the median AFL player and MARKET_VALUE_SCALE is calibrated so a typical
// club's whole list, paid at market value, costs about one salary cap (the cap grows 5% a
// season and market values grow with it, see getEconomyFactor).
const ANCHOR_OVERALL = 77;
const ANCHOR_SALARY = 400_000;
const SALARY_GROWTH_PER_POINT = 0.07;
export const MARKET_VALUE_SCALE = 0.93;

export function calculateBaseSalary(player) {
  const ability = player.overall ?? 60;
  const age = player.age ?? 25;

  const ageMod = getAgeModifier(age);
  const repMod = getReputationModifier(player);
  const formMod = getFormModifier(player.formRating ?? 50);
  const posMod = getPositionModifier(player);

  const abilitySalary = ANCHOR_SALARY * Math.exp(SALARY_GROWTH_PER_POINT * (ability - ANCHOR_OVERALL));
  const rawSalary = abilitySalary * ageMod * repMod * formMod * posMod * MARKET_VALUE_SCALE;

  return Math.round(rawSalary / 1000) * 1000;
}

// Full market value: base salary * greed * market competition, in the dollars of the
// requested season (options.seasonYear, default the first season), kept between the
// minimum and maximum salary.
export function calculateMarketValue(player, options = {}) {
  const { interestedClubs = 1, formRating = null, seasonYear } = options;

  const playerWithForm = formRating != null ? { ...player, formRating } : player;
  const base = calculateBaseSalary(playerWithForm);

  const greed = player.personality?.greed ?? 50;
  const greedMod = getGreedModifier(greed);
  const marketMod = getMarketCompetitionModifier(interestedClubs);

  const unclamped = Math.round((base * greedMod * marketMod * getEconomyFactor(seasonYear)) / 1000) * 1000;
  const marketValue = Math.max(getMinimumSalary(seasonYear), Math.min(getMaximumSalary(seasonYear), unclamped));

  return {
    baseSalary: base,
    marketValue,
    ageModifier: getAgeModifier(player.age ?? 25),
    formModifier: getFormModifier(player.formRating ?? 50),
    reputationModifier: getReputationModifier(player),
    positionModifier: getPositionModifier(player),
    greedModifier: greedMod,
    marketCompetitionModifier: marketMod,
    interestedClubs,
  };
}

// Estimated salary demand for a player at a given club.
// Factors in the club's own attraction — players may accept less at a contender.
// Discounts are proportional to market value, so they hold at any salary scale.
export function estimateSalaryDemand(player, clubName, interestedClubs = 1, seasonYear) {
  const { marketValue } = calculateMarketValue(player, { interestedClubs, seasonYear });

  const attraction = getClubAttraction(clubName);
  const successBonus = attraction.premiershipWindow - 65; // -15 to +25ish

  const loyalty = player.personality?.loyalty ?? 50;
  const successDiscount = marketValue * successBonus * 0.003;
  const loyaltyDiscount = marketValue * (loyalty - 50) * 0.0008;

  const demand = Math.round((marketValue - successDiscount - loyaltyDiscount) / 1000) * 1000;

  return Math.max(getMinimumSalary(seasonYear), demand);
}