const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

const shotProfiles = [
  { maxDistance: 15, goal: 0.66, behind: 0.25 },
  { maxDistance: 30, goal: 0.55, behind: 0.32 },
  { maxDistance: 40, goal: 0.43, behind: 0.34 },
  { maxDistance: 50, goal: 0.32, behind: 0.34 },
  { maxDistance: 60, goal: 0.17, behind: 0.30 },
  { maxDistance: Infinity, goal: 0.05, behind: 0.24 },
];

/** Resolve one shot attempt. Distance and shot quality affect the result once. */
export function resolveLiveShot(score, {
  distance = 40,
  angle = 0,
  pressure = 0,
  goalSense = 65,
  scoringModifier = 1,
  strengthEdge = 0,
  instructionEffect = 0,
} = {}, random = Math.random) {
  const metres = Math.max(0, Number(distance) || 0);
  const profile = shotProfiles.find((item) => metres <= item.maxDistance) ?? shotProfiles.at(-1);
  const quality = clamp(Number(scoringModifier) || 1, 0.75, 1.25);
  const skillAdjustment = clamp((Number(goalSense) - 65) * 0.0025, -0.12, 0.12);
  const contestAdjustment = clamp(Number(strengthEdge) || 0, -20, 20) * 0.002;
  const instructionAdjustment = clamp(Number(instructionEffect) || 0, -0.08, 0.08);
  const goalChance = clamp(profile.goal * quality * (1-clamp(Math.abs(angle),0,Math.PI/2)*.35) * (1-clamp(pressure,0,1)*.4) + skillAdjustment + contestAdjustment + instructionAdjustment, 0.01, 0.78);
  // Poorer shots turn into behinds or misses; improved shot quality mainly
  // converts misses into goals rather than creating additional scoring events.
  const behindChance = Math.min(profile.behind, 1 - goalChance);
  const roll = random();

  if (roll < goalChance) return { ...score, goals: score.goals + 1, total: score.total + 6, text: "Goal" };
  if (roll < goalChance + behindChance) return { ...score, behinds: score.behinds + 1, total: score.total + 1, text: "Behind" };
  return { ...score, text: "Miss" };
}
