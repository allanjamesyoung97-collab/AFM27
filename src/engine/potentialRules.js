const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

export function getPlayerPotential(player, fallback = null) {
  const candidates = [player?.development?.potential, player?.potential, fallback, player?.overall];
  const value = candidates.find(candidate => candidate !== null && candidate !== undefined && candidate !== '' && Number.isFinite(Number(candidate)));
  return clamp(Math.round(Number(value ?? 60)), 40, 99);
}

export function capOverallAtPotential(player, overall, fallbackPotential = null) {
  const numeric = Number(overall);
  const safeOverall = Number.isFinite(numeric) ? Math.round(numeric) : 40;
  return clamp(safeOverall, 40, getPlayerPotential(player, fallbackPotential));
}

export function capPlayerAtPotential(player, overall = player?.overall) {
  const potential = getPlayerPotential(player, overall);
  const cappedOverall = capOverallAtPotential(player, overall, potential);
  return {
    ...player,
    overall: cappedOverall,
    potential,
    development: { ...player?.development, potential },
  };
}
