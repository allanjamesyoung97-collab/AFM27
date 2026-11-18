export function calculateTradeValue(
  player
) {
  const overall =
    player.overall ?? 60;

  const potential =
    player.development
      ?.potential ??
    overall;

  let ageModifier = 1;

  if (player.age <= 20) {
    ageModifier = 1.3;
  } else if (
    player.age <= 23
  ) {
    ageModifier = 1.2;
  } else if (
    player.age <= 28
  ) {
    ageModifier = 1;
  } else if (
    player.age <= 32
  ) {
    ageModifier = 0.85;
  } else {
    ageModifier = 0.7;
  }

  const upside =
    Math.max(
      0,
      potential - overall
    );

  return Math.round(
    overall * 10 +
      upside * 8
  ) * ageModifier;
}