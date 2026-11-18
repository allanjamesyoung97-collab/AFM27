export function createDevelopment(
  potential = 80
) {
  return {
    potential,
    growthThisSeason: 0,
    trainingFocus: "Balanced"
  };
}