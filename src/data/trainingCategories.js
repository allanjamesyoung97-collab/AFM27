// Training categories for the calendar-based training system.
// Each category has effects on player development, fatigue, match readiness, morale, and injury risk.

export const trainingCategories = [
  {
    id: "RECOVERY",
    name: "Recovery",
    icon: "heart",
    description: "Light pool sessions, massage, and active recovery. Reduces fatigue and injury risk.",
    effects: { development: -1, fatigue: -15, readiness: +10, morale: +5, injuryRisk: -8 },
    attributeTargets: [],
    intensity: 1,
  },
  {
    id: "MATCH_REVIEW",
    name: "Match Review",
    icon: "film",
    description: "Video analysis of previous match. Improves decision-making and game understanding.",
    effects: { development: +2, fatigue: -5, readiness: +5, morale: +2, injuryRisk: -2 },
    attributeTargets: ["decisionMaking", "vision", "gameAwareness", "positioning", "composure"],
    intensity: 2,
  },
  {
    id: "SKILLS",
    name: "Skills",
    icon: "target",
    description: "Kicking, handballing, and marking drills. Core technical development.",
    effects: { development: +4, fatigue: +5, readiness: +5, morale: +3, injuryRisk: 0 },
    attributeTargets: ["kicking", "handball", "marking", "groundBallGet"],
    intensity: 3,
  },
  {
    id: "BALL_MOVEMENT",
    name: "Ball Movement",
    icon: "zap",
    description: "Transition drills, corridor movement, and link-up play. Enhances attacking flow.",
    effects: { development: +3, fatigue: +8, readiness: +8, morale: +4, injuryRisk: +2 },
    attributeTargets: ["speed", "acceleration", "runAndCarry", "kicking", "vision", "decisionMaking", "gameAwareness"],
    intensity: 4,
  },
  {
    id: "CONTESTED_BALL",
    name: "Contested Ball",
    icon: "swords",
    description: "Clearances, tackling, and inside work. High-impact physical preparation.",
    effects: { development: +4, fatigue: +12, readiness: +6, morale: +5, injuryRisk: +4 },
    attributeTargets: ["tackling", "strength", "groundBallGet", "contestedBall", "verticalLeap", "ruckCraft", "competitiveness"],
    intensity: 5,
  },
  {
    id: "DEFENSIVE_STRUCTURE",
    name: "Defensive Structure",
    icon: "shield",
    description: "Zone defence, pressing, and team defensive shape. Organises the backline.",
    effects: { development: +3, fatigue: +7, readiness: +7, morale: +2, injuryRisk: +1 },
    attributeTargets: ["spoiling", "marking", "positioning", "gameAwareness", "teamwork", "discipline"],
    intensity: 4,
  },
  {
    id: "FORWARD_STRUCTURE",
    name: "Forward Structure",
    icon: "flag",
    description: "Forward patterns, leading, and goal-square craft. Sharpens attacking shape.",
    effects: { development: +3, fatigue: +7, readiness: +7, morale: +4, injuryRisk: +1 },
    attributeTargets: ["goalSense", "marking", "kicking", "composure", "creativity", "positioning"],
    intensity: 4,
  },
  {
    id: "FITNESS",
    name: "Fitness",
    icon: "activity",
    description: "Running volumes and time trials. Builds the aerobic base.",
    effects: { development: +2, fatigue: +15, readiness: -5, morale: -2, injuryRisk: +3 },
    attributeTargets: ["speed", "acceleration", "agility", "endurance", "durability"],
    intensity: 5,
  },
  {
    id: "CONDITIONING",
    name: "Conditioning",
    icon: "dumbbell",
    description: "Strength and power work in the gym. Builds physical resilience.",
    effects: { development: +3, fatigue: +10, readiness: 0, morale: +1, injuryRisk: -3 },
    attributeTargets: ["strength", "verticalLeap", "endurance", "durability", "ruckCraft"],
    intensity: 4,
  },
  {
    id: "LEADERSHIP",
    name: "Leadership",
    icon: "users",
    description: "Leadership group sessions, mentoring, and culture building.",
    effects: { development: +1, fatigue: -3, readiness: +3, morale: +10, injuryRisk: 0 },
    attributeTargets: ["leadership", "teamwork", "composure", "professionalism", "discipline"],
    intensity: 2,
  },
  {
    id: "GOAL_KICKING",
    name: "Goal Kicking",
    icon: "crosshair",
    description: "Set-shot practice and finishing under pressure. Converts chances.",
    effects: { development: +3, fatigue: +4, readiness: +6, morale: +3, injuryRisk: 0 },
    attributeTargets: ["goalSense", "kicking", "composure"],
    intensity: 3,
  },
  {
    id: "SET_PLAYS",
    name: "Set Plays",
    icon: "clipboard",
    description: "Centre bounces, stoppage setups, and kick-in structures.",
    effects: { development: +2, fatigue: +5, readiness: +8, morale: +2, injuryRisk: 0 },
    attributeTargets: ["decisionMaking", "positioning", "ruckCraft", "gameAwareness", "teamwork"],
    intensity: 3,
  },
  {
    id: "MATCH_SIMULATION",
    name: "Match Simulation",
    icon: "whistle",
    description: "Full-contact match practice at game intensity. Peak readiness preparation.",
    effects: { development: +5, fatigue: +18, readiness: +15, morale: +6, injuryRisk: +6 },
    attributeTargets: ["gameAwareness", "decisionMaking", "endurance", "groundBallGet", "competitiveness"],
    intensity: 6,
  },
  {
    id: "CAPTAINS_RUN",
    name: "Captain's Run",
    icon: "star",
    description: "Final light session before match day. Sharpens and activates the group.",
    effects: { development: 0, fatigue: -8, readiness: +12, morale: +5, injuryRisk: -4 },
    attributeTargets: [],
    intensity: 2,
  },
];

export function getTrainingCategoryById(id) {
  return trainingCategories.find((cat) => cat.id === id) ?? trainingCategories[0];
}

// Default assistant-managed weekly schedule (based on professional AFL club workloads).
// Maps day-of-week (0=Sunday ... 6=Saturday) to a training category.
export const assistantWeeklySchedule = [
  { day: 1, categoryId: "RECOVERY", label: "Recovery" },           // Monday
  { day: 2, categoryId: "MATCH_REVIEW", label: "Match Review" },   // Tuesday
  { day: 3, categoryId: "SKILLS", label: "Skills" },               // Wednesday
  { day: 4, categoryId: "BALL_MOVEMENT", label: "Ball Movement" }, // Thursday
  { day: 5, categoryId: "CAPTAINS_RUN", label: "Captain's Run" },  // Friday
  // Saturday = Match Day (handled by fixture)
  // Sunday = Rest day
];

// Delegation settings — which football department functions the assistant handles.
export const delegationOptions = [
  { id: "training", label: "Training", description: "Assistant coaches schedule and run all training sessions." },
  { id: "contractNegotiations", label: "Contract Negotiations", description: "Assistant handles new contract offers to out-of-contract players." },
  { id: "contractRenewals", label: "Contract Renewals", description: "Assistant renews expiring contracts at fair market value." },
  { id: "tradeNegotiations", label: "Trade Negotiations", description: "Assistant responds to incoming trade offers automatically." },
  { id: "listManagement", label: "List Management", description: "Assistant handles list changes and delisting decisions." },
  { id: "draft", label: "Draft Selections", description: "Authorise the assistant to make and pass draft selections within list and salary limits." },
  { id: "draftPreparation", label: "Draft Preparation", description: "Assistant manages draft scouting and selections." },
  { id: "playerDevelopment", label: "Player Development Plans", description: "Assistant sets individual training focus for all players." },
  { id: "injuryManagement", label: "Injury Management", description: "Assistant makes recovery and return-to-play recommendations." },
  { id: "administrativeDuties", label: "Administrative Duties", description: "Assistant reviews and approves suitable staff appointments automatically." },
];

export const defaultDelegationSettings = Object.fromEntries(
  delegationOptions.map((opt) => [opt.id, ["training", "playerDevelopment", "injuryManagement"].includes(opt.id)])
);
