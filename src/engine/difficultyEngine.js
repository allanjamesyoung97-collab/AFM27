export const DIFFICULTY_MODES = Object.freeze({
  BEGINNER: {
    id: "BEGINNER",
    label: "Beginner",
    description: "A little more financial breathing room and a more forgiving board review.",
    incomeMultiplier: 1.04,
    expenseMultiplier: 0.96,
    boardReviewModifier: 8,
  },
  EXPERIENCED: {
    id: "EXPERIENCED",
    label: "Experienced",
    description: "The intended balance: standard club finances and board expectations.",
    incomeMultiplier: 1,
    expenseMultiplier: 1,
    boardReviewModifier: 0,
  },
  PRO: {
    id: "PRO",
    label: "Pro",
    description: "Tighter finances and less forgiving board reviews put more pressure on management.",
    incomeMultiplier: 0.96,
    expenseMultiplier: 1.04,
    boardReviewModifier: -8,
  },
});

export function getDifficultySettings(mode) {
  return DIFFICULTY_MODES[mode] ?? DIFFICULTY_MODES.EXPERIENCED;
}

export function normalizeDifficulty(mode) {
  return Object.hasOwn(DIFFICULTY_MODES, mode) ? mode : "EXPERIENCED";
}
