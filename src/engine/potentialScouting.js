const POTENTIAL_DESCRIPTORS = [
  { maxDifference: 1, label: "Peaked" },
  { maxDifference: 4, label: "Near Ceiling" },
  { maxDifference: 8, label: "Emerging Talent" },
  { maxDifference: 11, label: "High Upside" },
  { maxDifference: Infinity, label: "Big Potential" },
];

const POTENTIAL_STARS = [
  { minimum: 91, rating: 5 },
  { minimum: 85, rating: 4.5 },
  { minimum: 81, rating: 4 },
  { minimum: 76, rating: 3.5 },
  { minimum: 70, rating: 3 },
  { minimum: -Infinity, rating: 2.5 },
];

export function getPotentialStarRating(potential) {
  if (potential == null || potential === "") return null;
  const potentialRating = Number(potential);
  if (!Number.isFinite(potentialRating)) return null;
  return POTENTIAL_STARS.find(({ minimum }) => potentialRating >= minimum)?.rating ?? 2.5;
}

function formatStars(rating) {
  if (rating == null) return "—";
  const fullStars = Math.floor(rating);
  return `${"★".repeat(fullStars)}${rating % 1 ? "☆" : ""}`;
}

export function getPotentialDescriptor(potential, overall) {
  // Potential is shown as its absolute rating; the player's current overall does
  // not change the star grade. Keep the second argument for existing callers.
  return formatStars(getPotentialStarRating(potential));
}

export function getPlayerPotentialDescriptor(player) {
  return getPotentialDescriptor(
    player?.development?.potential ?? player?.potential,
    player?.overall,
  );
}

export function getPotentialDescriptorRank(potential, overall) {
  if (potential == null || overall == null || potential === "" || overall === "") return -1;
  const potentialRating = Number(potential);
  const overallRating = Number(overall);
  if (!Number.isFinite(potentialRating) || !Number.isFinite(overallRating)) return -1;
  const difference = potentialRating - overallRating;
  return POTENTIAL_DESCRIPTORS.findIndex(({ maxDifference }) => difference <= maxDifference);
}
