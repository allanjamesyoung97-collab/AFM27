import { createElitePlayer, createStarPlayer, createYoungPlayer, createVeteranPlayer, createPlayer } from "../engine/playerFactory.js";

// AFL player list snapshot: 6 October 2026. Positions and roster names are based on AFL club player cards.
// Potential and game tiers are gameplay estimates, not official AFL ratings.

const sydneyPlayersWithoutContractStatus = [
  createStarPlayer({
    id: 51301,
    name: "Chad Warner",
    club: "Sydney",
    age: 25,
    positions: ["MID", "WING"],
    overall: 90,
    potential: 91
  }),
  createPlayer({
    id: 51302,
    name: "Hayden McLean",
    club: "Sydney",
    age: 27,
    positions: ["KPF"],
    overall: 80,
    potential: 84
  }),
  createStarPlayer({
    id: 51304,
    name: "Brodie Grundy",
    club: "Sydney",
    age: 32,
    positions: ["RUC"],
    overall: 88,
    potential: 88
  }),
  createElitePlayer({
    id: 51305,
    name: "Isaac Heeney",
    club: "Sydney",
    age: 30,
    positions: ["MID", "WING"],
    overall: 92,
    potential: 95
  }),
  createPlayer({
    id: 51306,
    name: "Logan McDonald",
    club: "Sydney",
    age: 24,
    positions: ["KPF"],
    overall: 81,
    potential: 86
  }),
  createPlayer({
    id: 51307,
    name: "Harry Cunningham",
    club: "Sydney",
    age: 32,
    positions: ["HB", "BP"],
    overall: 78,
    potential: 78
  }),
  createPlayer({
    id: 51308,
    name: "James Rowbottom",
    club: "Sydney",
    age: 26,
    positions: ["MID", "WING"],
    tier: "Best22",
    potential: 85
  }),
  createYoungPlayer({
    id: 51309,
    name: "Jesse Dattoli",
    club: "Sydney",
    age: 20,
    positions: ["HF", "FF"],
    tier: "Rookie",
    potential: 82
  }),
  createPlayer({
    id: 51310,
    name: "Malcolm Rosas",
    club: "Sydney",
    age: 25,
    positions: ["HF", "FF"],
    overall: 83,
    potential: 85
  }),
  createStarPlayer({
    id: 51311,
    name: "Tom Papley",
    club: "Sydney",
    age: 30,
    positions: ["HF", "FF"],
    overall: 85,
    potential: 85
  }),
  createYoungPlayer({
    id: 51312,
    name: "Angus Sheldrick",
    club: "Sydney",
    age: 22,
    positions: ["MID", "WING"],
    overall: 77,
    potential: 85
  }),
  createPlayer({
    id: 51313,
    name: "Jai Serong",
    club: "Sydney",
    age: 23,
    positions: ["MID", "WING"],
    overall: 79,
    potential: 85
  }),
  createPlayer({
    id: 51314,
    name: "Callum Mills",
    club: "Sydney",
    age: 29,
    positions: ["HB", "BP"],
    overall: 86,
    potential: 86
  }),
  createPlayer({
    id: 51315,
    name: "Sam Wicks",
    club: "Sydney",
    age: 27,
    positions: ["HB", "BP"],
    overall: 80,
    potential: 82
  }),
  createPlayer({
    id: 51316,
    name: "Braeden Campbell",
    club: "Sydney",
    age: 24,
    positions: ["HF", "FF"],
    overall: 79,
    potential: 83
  }),
  createPlayer({
    id: 51317,
    name: "James Jordon",
    club: "Sydney",
    age: 25,
    positions: ["MID", "WING"],
    tier: "Best22",
    overall: 78,
    potential: 80
  }),
  createYoungPlayer({
    id: 51318,
    name: "Jevan Phillipou",
    club: "Sydney",
    age: 19,
    positions: ["HF", "FF"],
    tier: "Rookie",
    potential: 82
  }),
  createPlayer({
    id: 51319,
    name: "Peter Ladhams",
    club: "Sydney",
    age: 28,
    positions: ["RUC"],
    overall: 74,
    potential: 78
  }),
  createYoungPlayer({
    id: 51320,
    name: "Riak Andrew",
    club: "Sydney",
    age: 20,
    positions: ["KPD"],
    tier: "Rookie",
    potential: 80
  }),
  createElitePlayer({
    id: 51321,
    name: "Errol Gulden",
    club: "Sydney",
    age: 24,
    positions: ["MID", "WING"],
    overall: 92,
    potential: 95
  }),

  createYoungPlayer({
    id: 51323,
    name: "Ned Bowman",
    club: "Sydney",
    age: 20,
    positions: ["HB", "BP"],
    tier: "Rookie",
    potential: 80
  }),
  createVeteranPlayer({
    id: 51324,
    name: "Dane Rampe",
    club: "Sydney",
    age: 36,
    positions: ["HB", "BP"],
    overall: 80,
    potential: 79
  }),
  createPlayer({
    id: 51325,
    name: "Billy Cootee",
    club: "Sydney",
    age: 23,
    positions: ["HF", "FF"],
    tier: "Depth",
    potential: 82
  }),
  createPlayer({
    id: 51326,
    name: "Riley Bice",
    club: "Sydney",
    age: 26,
    positions: ["HB", "BP"],
    tier: "Best22",
    overall: 82,
    potential: 85
  }),
  createPlayer({
    id: 51327,
    name: "Justin McInerney",
    club: "Sydney",
    age: 26,
    positions: ["MID", "WING"],
    tier: "Best22",
    overall: 84,
    potential: 85
  }),
  createPlayer({
    id: 51328,
    name: "William Edwards",
    club: "Sydney",
    age: 23,
    positions: ["KPD"],
    tier: "Depth",
    potential: 82
  }),
  createPlayer({
    id: 51329,
    name: "Joel Hamling",
    club: "Sydney",
    age: 33,
    positions: ["KPD"],
    tier: "Depth",
    potential: 79
  }),
  createPlayer({
    id: 51330,
    name: "Tom McCartin",
    club: "Sydney",
    age: 25,
    positions: ["KPD"],
    tier: "Best22",
    potential: 86
  }),
  createYoungPlayer({
    id: 51331,
    name: "Max King",
    club: "Sydney",
    age: 19,
    positions: ["HF", "FF"],
    tier: "Rookie",
    potential: 80
  }),
  createYoungPlayer({
    id: 51332,
    name: "Harry Kyle",
    club: "Sydney",
    age: 19,
    positions: ["HB", "BP"],
    tier: "Rookie",
    potential: 81
  }),
  createYoungPlayer({
    id: 51333,
    name: "Caiden Cleary",
    club: "Sydney",
    age: 21,
    positions: ["HF", "FF"],
    tier: "Rookie",
    potential: 82
  }),
  createPlayer({
    id: 51334,
    name: "Matt Roberts",
    club: "Sydney",
    age: 23,
    positions: ["MID", "WING"],
    overall: 79,
    potential: 87
  }),
  createElitePlayer({
    id: 51335,
    name: "Charlie Curnow",
    club: "Sydney",
    age: 29,
    positions: ["KPF"],
    overall: 89,
    potential: 92
  }),
  createYoungPlayer({
    id: 51337,
    name: "Corey Warner",
    club: "Sydney",
    age: 22,
    positions: ["HF", "FF"],
    tier: "Rookie",
    overall: 80,
    potential: 84
  }),
  createYoungPlayer({
    id: 51338,
    name: "Liam Hetherton",
    club: "Sydney",
    age: 19,
    positions: ["KPF"],
    tier: "Rookie",
    potential: 80
  }),
  createYoungPlayer({
    id: 51339,
    name: "Tom Hanily",
    club: "Sydney",
    age: 21,
    positions: ["HF", "FF"],
    tier: "Rookie",
    potential: 82
  }),
  createYoungPlayer({
    id: 51340,
    name: "Patrick Snell",
    club: "Sydney",
    age: 21,
    positions: ["KPD"],
    tier: "Rookie",
    potential: 80
  }),
  createYoungPlayer({
    id: 51341,
    name: "Noah Chamberlain",
    club: "Sydney",
    age: 19,
    positions: ["MID", "WING"],
    tier: "Rookie",
    potential: 80
  }),
  createPlayer({
    id: 51342,
    name: "Lewis Melican",
    club: "Sydney",
    age: 29,
    positions: ["KPD"],
    tier: "Depth",
    potential: 82
  }),
  createPlayer({
    id: 51343,
    name: "Jake Lloyd",
    club: "Sydney",
    age: 33,
    positions: ["HF", "FF"],
    overall: 79,
    potential: 79
  }),
  createYoungPlayer({
    id: 51344,
    name: "William Green",
    club: "Sydney",
    age: 21,
    positions: ["RUC"],
    tier: "Rookie",
    potential: 79
  })
];

// Final contract years and free-agency statuses are transcribed from AFL Contracts.docx.
// Players without a source entry have no known final year or remaining term.
const contractDetails = {
  "Chad Warner": [2027, "Restricted Free Agent"],
  "Hayden McLean": [2027, "Restricted Free Agent"],
  "Brodie Grundy": [2027, "Unrestricted Free Agent"],
  "Isaac Heeney": [2028, "Unrestricted Free Agent"],
  "Logan McDonald": [2028, "Restricted Free Agent"],
  "Harry Cunningham": [2026, "Unrestricted Free Agent"],
  "James Rowbottom": [2028, "Unrestricted Free Agent"],
  "Jesse Dattoli": [2027, "Non-Free Agent"],
  "Malcolm Rosas": [2028, "Non-Free Agent"],
  "Tom Papley": [2028, "Unrestricted Free Agent"],
  "Angus Sheldrick": [2027, "Non-Free Agent"],
  "Jai Serong": [2028, "Non-Free Agent"],
  "Callum Mills": [2029, "Unrestricted Free Agent"],
  "Sam Wicks": [2028, "Unrestricted Free Agent"],
  "Braeden Campbell": [2028, "Restricted Free Agent"],
  "James Jordon": [2027, "Non-Free Agent"],
  "Jevan Phillipou": [2027, "Unknown"],
  "Peter Ladhams": [2027, "Non-Free Agent"],
  "Riak Andrew": [2027, "Non-Free Agent"],
  "Errol Gulden": [2028, "Restricted Free Agent"],
  "Ned Bowman": [2027, "Non-Free Agent"],
  "Dane Rampe": [2026, "Unrestricted Free Agent"],
  "Billy Cootee": [2027, "Unknown"],
  "Riley Bice": [2028, "Non-Free Agent"],
  "Justin McInerney": [2031, "Unrestricted Free Agent"],
  "William Edwards": [2030, "Restricted Free Agent"],
  "Joel Hamling": [2026, "Unrestricted Free Agent"],
  "Tom McCartin": [2027, "Unrestricted Free Agent"],
  "Max King": [2027, "Unknown"],
  "Harry Kyle": [2028, "Unknown"],
  "Caiden Cleary": [2027, "Non-Free Agent"],
  "Matt Roberts": [2027, "Non-Free Agent"],
  "Charlie Curnow": [2030, "Unrestricted Free Agent"],
  "Corey Warner": [2027, "Non-Free Agent"],
  "Liam Hetherton": [2027, "Unknown"],
  "Tom Hanily": [2027, "Non-Free Agent"],
  "Patrick Snell": [2027, "Non-Free Agent"],
  "Noah Chamberlain": [2027, "Unknown"],
  "Lewis Melican": [2028, "Unrestricted Free Agent"],
  "Jake Lloyd": [2027, "Unrestricted Free Agent"],
  "William Green": [2027, "Non-Free Agent"],
};

export const sydneyPlayers = sydneyPlayersWithoutContractStatus.map((player) => {
  const contract = player.contract ?? {};
  const [finalYear, status] = contractDetails[player.name] ?? [null, "Unknown"];

  return {
    ...player,
    contract: {
      ...contract,
      finalYear,
      status,
      yearsRemaining: finalYear == null
        ? null
        : Math.max(0, finalYear - 2026),
    },
  };
});