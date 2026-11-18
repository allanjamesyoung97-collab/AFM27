import { getScoringRateModifiers, getTacticalRatingBonus } from "./tacticsEngine.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function simulateMatch(
  homeTeam,
  awayTeam,
  homeStrength,
  awayStrength,
  homeTactics,
  awayTactics,
  { homePlayers = [], awayPlayers = [], random = Math.random, homeTraitImpact = {}, awayTraitImpact = {} } = {},
) {
  const randomAround = (mean, spread) => mean + (random() - 0.5) * spread;
  const homePlanBonus = getTacticalRatingBonus(homeTactics, homePlayers);
  const awayPlanBonus = getTacticalRatingBonus(awayTactics, awayPlayers);
  const homeMatchup = homeTraitImpact.matchup ?? {};
  const awayMatchup = awayTraitImpact.matchup ?? {};
  const strengthGap = (homeStrength + homePlanBonus + Number(homeTraitImpact.contest ?? 0))
    - (awayStrength + awayPlanBonus + Number(awayTraitImpact.contest ?? 0));
  const homeRates = getScoringRateModifiers(homeTactics, homePlayers);
  const awayRates = getScoringRateModifiers(awayTactics, awayPlayers);
  const homeMatchupRate = clamp(Number(homeMatchup.scoring ?? 1) * Number(homeMatchup.entries ?? 1) / Number(awayMatchup.containment ?? 1), .82, 1.2);
  const awayMatchupRate = clamp(Number(awayMatchup.scoring ?? 1) * Number(awayMatchup.entries ?? 1) / Number(homeMatchup.containment ?? 1), .82, 1.2);

  // AFL match totals typically land around 80–110 points per side. These
  // distributions keep scores in that range while allowing close and high-scoring games.
  let homeGoals = Math.round(clamp(randomAround(13.2 + strengthGap * 0.11 + ((homeRates.goals * (1 + Number(homeTraitImpact.scoring ?? 0) - Number(awayTraitImpact.defence ?? 0)) * homeMatchupRate) - 1) * 7, 7), 5, 23));
  let awayGoals = Math.round(clamp(randomAround(13.2 - strengthGap * 0.11 + ((awayRates.goals * (1 + Number(awayTraitImpact.scoring ?? 0) - Number(homeTraitImpact.defence ?? 0)) * awayMatchupRate) - 1) * 7, 7), 5, 23));
  const homeBehinds = Math.round(clamp(randomAround(9.5 + (homeRates.behinds - 1) * 7, 9), 2, 19));
  const awayBehinds = Math.round(clamp(randomAround(9.5 + (awayRates.behinds - 1) * 7, 9), 2, 19));

  // A clutch trait can swing a close finish; the roll stays small and never
  // applies when the game is already decided.
  if (Math.abs((homeGoals * 6 + homeBehinds) - (awayGoals * 6 + awayBehinds)) <= 12) {
    if (random() < Number(homeTraitImpact.clutch ?? 0)) homeGoals = Math.min(23, homeGoals + 1);
    if (random() < Number(awayTraitImpact.clutch ?? 0)) awayGoals = Math.min(23, awayGoals + 1);
  }

  return {
    homeTeam,
    awayTeam,
    homeGoals,
    homeBehinds,
    awayGoals,
    awayBehinds,
    homeScore: homeGoals * 6 + homeBehinds,
    awayScore: awayGoals * 6 + awayBehinds,
  };
}
