import { createElitePlayer, createStarPlayer, createYoungPlayer, createVeteranPlayer, createPlayer } from "../engine/playerFactory.js";

// AFL player list snapshot: 6 October 2026. Positions and roster names are based on AFL club player cards.
// Potential and game tiers are gameplay estimates, not official AFL ratings.

const goldcoastPlayersWithoutContractStatus = [
  createYoungPlayer({
    id: 50501,
    name: "Mac Andrew",
    club: "Gold Coast",
    age: 22,
    positions: ["KPD"],
    tier: "Best22",
    potential: 88
  }),
  createPlayer({
    id: 50502,
    name: "John Noble",
    club: "Gold Coast",
    age: 29,
    positions: ["HB", "BP"],
    overall: 83,
    potential: 84
  }),
  createStarPlayer({
    id: 50503,
    name: "Christian Petracca",
    club: "Gold Coast",
    age: 30,
    positions: ["MID", "WING"],
    potential: 90
  }),
  createYoungPlayer({
    id: 50504,
    name: "Jed Walter",
    club: "Gold Coast",
    age: 21,
    positions: ["KPF"],
    tier: "Best22",
    potential: 88
  }),
  createPlayer({
    id: 50505,
    name: "Alex Davies",
    club: "Gold Coast",
    age: 24,
    positions: ["MID", "WING"],
    tier: "Depth",
    potential: 84
  }),


  createVeteranPlayer({
    id: 1009,
    name: "Scott Pendlebury",
    club: "Gold Coast",
    age: 38,
    overall: 81,
    positions: ["MID"]
  }),

  createPlayer({
    id: 50506,
    name: "Bodhi Uwland",
    club: "Gold Coast",
    age: 23,
    positions: ["HB", "BP"],
    tier: "Best22",
    overall: 85,
    potential: 88
  }),
  createYoungPlayer({
    id: 50508,
    name: "Leonardo Lombard",
    club: "Gold Coast",
    age: 20,
    positions: ["HF", "FF"],
    overall: 76,
    potential: 85
  }),
  createPlayer({
    id: 50509,
    name: "Jamarra Ugle-Hagan",
    club: "Gold Coast",
    age: 24,
    positions: ["KPF"],
    tier: "Depth",
    potential: 81
  }),
  createPlayer({
    id: 50510,
    name: "Charlie Ballard",
    club: "Gold Coast",
    age: 27,
    positions: ["KPD"],
    overall: 74,
    potential: 84
  }),
  createStarPlayer({
    id: 50511,
    name: "Touk Miller",
    club: "Gold Coast",
    age: 30,
    positions: ["MID", "WING"],
    overall: 85,
    potential: 86
  }),
  createPlayer({
    id: 50512,
    name: "Elliott Himmelberg",
    club: "Gold Coast",
    age: 28,
    positions: ["KPF"],
    tier: "Depth",
    potential: 79
  }),
  createPlayer({
    id: 50513,
    name: "Lachie Weller",
    club: "Gold Coast",
    age: 30,
    positions: ["MID", "WING"],
    overall: 76,
    potential: 79
  }),
  createElitePlayer({
    id: 50514,
    name: "Noah Anderson",
    club: "Gold Coast",
    age: 25,
    positions: ["MID", "WING"],
    overall: 90,
    potential: 93
  }),
  createPlayer({
    id: 50515,
    name: "Joel Jeffrey",
    club: "Gold Coast",
    age: 24,
    positions: ["HB", "BP"],
    overall: 81,
    potential: 86
  }),
  createPlayer({
    id: 50516,
    name: "Daniel Rioli",
    club: "Gold Coast",
    age: 29,
    positions: ["HB", "BP"],
    tier: "Best22",
    overall: 83,
    potential: 84
  }),
  createElitePlayer({
    id: 50517,
    name: "Matt Rowell",
    club: "Gold Coast",
    age: 25,
    positions: ["MID", "WING"],
    overall: 89,
    potential: 92
  }),
  createYoungPlayer({
    id: 50518,
    name: "Bailey Humphrey",
    club: "Gold Coast",
    age: 22,
    positions: ["HF", "FF"],
    overall: 82,
    potential: 87
  }),
  createYoungPlayer({
    id: 50519,
    name: "Ethan Read",
    club: "Gold Coast",
    age: 21,
    positions: ["KPF"],
    overall: 77,
    potential: 85
  }),
  createPlayer({
    id: 50520,
    name: "Ben Long",
    club: "Gold Coast",
    age: 29,
    positions: ["HF", "FF"],
    overall: 82,
    potential: 82
  }),
  createPlayer({
    id: 50521,
    name: "Ned Moyle",
    club: "Gold Coast",
    age: 24,
    positions: ["RUC"],
    overall: 80,
    potential: 86
  }),
  createPlayer({
    id: 50522,
    name: "Sam Collins",
    club: "Gold Coast",
    age: 32,
    positions: ["KPD"],
    overall: 85,
    potential: 85
  }),
  createYoungPlayer({
    id: 50523,
    name: "Will Graham",
    club: "Gold Coast",
    age: 21,
    positions: ["MID", "WING"],
    tier: "Rookie",
    potential: 82
  }),
  createPlayer({
    id: 50524,
    name: "Wil Powell",
    club: "Gold Coast",
    age: 27,
    positions: ["HB", "BP"],
    overall: 79,
    potential: 84
  }),
  createPlayer({
    id: 50525,
    name: "Jarrod Witts",
    club: "Gold Coast",
    age: 34,
    positions: ["RUC"],
    tier: "Depth",
    potential: 79
  }),
  createYoungPlayer({
    id: 50526,
    name: "Jake Rogers",
    club: "Gold Coast",
    age: 21,
    positions: ["HF", "FF"],
    tier: "Rookie",
    potential: 82
  }),
  createYoungPlayer({
    id: 50527,
    name: "Dylan Patterson",
    club: "Gold Coast",
    age: 19,
    positions: ["HF", "FF"],
    tier: "Rookie",
    potential: 84
  }),
  createYoungPlayer({
    id: 50528,
    name: "Cooper Bell",
    club: "Gold Coast",
    age: 19,
    positions: ["KPF"],
    tier: "Rookie",
    potential: 81
  }),
  createYoungPlayer({
    id: 50529,
    name: "Zeke Uwland",
    club: "Gold Coast",
    age: 19,
    positions: ["MID", "WING"],
    overall: 79,
    potential: 87
  }),
  createPlayer({
    id: 50530,
    name: "Sam Clohesy",
    club: "Gold Coast",
    age: 23,
    positions: ["MID", "WING"],
    tier: "Depth",
    potential: 87
  }),
  createYoungPlayer({
    id: 50532,
    name: "Jai Murray",
    club: "Gold Coast",
    age: 19,
    positions: ["MID", "WING"],
    tier: "Rookie",
    potential: 84
  }),
  createPlayer({
    id: 50533,
    name: "Zak Evans",
    club: "Gold Coast",
    age: 26,
    positions: ["MID", "WING"],
    tier: "Depth",
    potential: 85
  }),
  createYoungPlayer({
    id: 50534,
    name: "Max Knobel",
    club: "Gold Coast",
    age: 22,
    positions: ["RUC"],
    tier: "Rookie",
    potential: 81
  }),
  createYoungPlayer({
    id: 50535,
    name: "Beau Addinsall",
    club: "Gold Coast",
    age: 19,
    positions: ["MID", "WING"],
    tier: "Rookie",
    potential: 82
  }),
  createYoungPlayer({
    id: 50536,
    name: "Lachlan Gulbin",
    club: "Gold Coast",
    age: 19,
    positions: ["HF", "FF"],
    tier: "Rookie",
    potential: 81
  }),
  createYoungPlayer({
    id: 50537,
    name: "Avery Thomas",
    club: "Gold Coast",
    age: 19,
    positions: ["HB", "BP"],
    tier: "Rookie",
    potential: 81
  }),
  createYoungPlayer({
    id: 50538,
    name: "Asher Eastham",
    club: "Gold Coast",
    age: 20,
    positions: ["HF", "FF"],
    tier: "Rookie",
    potential: 83
  }),
  createYoungPlayer({
    id: 50539,
    name: "Koby Coulson",
    club: "Gold Coast",
    age: 19,
    positions: ["MID", "WING"],
    tier: "Rookie",
    potential: 81
  }),
  createPlayer({
    id: 50540,
    name: "Ben Jepson",
    club: "Gold Coast",
    age: 24,
    positions: ["MID", "WING"],
    tier: "Depth",
    potential: 79
  }),
  createPlayer({
    id: 50541,
    name: "Caleb Lewis",
    club: "Gold Coast",
    age: 23,
    positions: ["KPF"],
    tier: "Depth",
    potential: 78
  }),
  createPlayer({
    id: 50542,
    name: "Caleb Graham",
    club: "Gold Coast",
    age: 26,
    positions: ["KPD"],
    tier: "Depth",
    potential: 81
  }),
  createPlayer({
    id: 50543,
    name: "Oscar Adams",
    club: "Gold Coast",
    age: 23,
    positions: ["KPD"],
    tier: "Depth",
    potential: 81
  }),
  createPlayer({
    id: 50544,
    name: "Jy Farrar",
    club: "Gold Coast",
    age: 29,
    positions: ["HF", "FF"],
    tier: "Depth",
    potential: 82
  })
];

// Final contract years and free-agency statuses are transcribed from AFL Contracts.docx.
// Players without a source entry have no known final year or remaining term.
const contractDetails = {
  "Mac Andrew": [2030, "Restricted Free Agent"],
  "John Noble": [2028, "Non-Free Agent"],
  "Christian Petracca": [2029, "Unrestricted Free Agent"],
  "Jed Walter": [2029, "Non-Free Agent"],
  "Alex Davies": [2027, "Non-Free Agent"],
  "Scott Pendlebury": [2028, "Non-Free Agent"],
  "Bodhi Uwland": [2030, "Restricted Free Agent"],
  "Leonardo Lombard": [2030, "Non-Free Agent"],
  "Jamarra Ugle-Hagan": [2026, "Non-Free Agent"],
  "Charlie Ballard": [2029, "Unrestricted Free Agent"],
  "Touk Miller": [2030, "Unrestricted Free Agent"],
  "Elliott Himmelberg": [2027, "Non-Free Agent"],
  "Lachie Weller": [2029, "Unrestricted Free Agent"],
  "Noah Anderson": [2027, "Restricted Free Agent"],
  "Joel Jeffrey": [2028, "Restricted Free Agent"],
  "Daniel Rioli": [2029, "Non-Free Agent"],
  "Matt Rowell": [2027, "Restricted Free Agent"],
  "Bailey Humphrey": [2030, "Restricted Free Agent"],
  "Ethan Read": [2028, "Non-Free Agent"],
  "Ben Long": [2029, "Non-Free Agent"],
  "Ned Moyle": [2028, "Restricted Free Agent"],
  "Sam Collins": [2028, "Unrestricted Free Agent"],
  "Will Graham": [2027, "Non-Free Agent"],
  "Wil Powell": [2029, "Unrestricted Free Agent"],
  "Jarrod Witts": [2028, "Unrestricted Free Agent"],
  "Jake Rogers": [2029, "Non-Free Agent"],
  "Dylan Patterson": [2028, "Unknown"],
  "Zeke Uwland": [2028, "Unknown"],
  "Sam Clohesy": [2028, "Non-Free Agent"],
  "Jai Murray": [2028, "Unknown"],
  "Zak Evans": [2026, "Non-Free Agent"],
  "Max Knobel": [2027, "Non-Free Agent"],
  "Beau Addinsall": [2028, "Unknown"],
  "Lachlan Gulbin": [2029, "Non-Free Agent"],
  "Avery Thomas": [2028, "Non-Free Agent"],
  "Koby Coulson": [2028, "Non-Free Agent"],
  "Ben Jepson": [2026, "Unrestricted Free Agent"],
  "Caleb Lewis": [2028, "Non-Free Agent"],
  "Oscar Adams": [2028, "Unrestricted Free Agent"],
  "Jy Farrar": [2027, "Restricted Free Agent"],
};

export const goldcoastPlayers = goldcoastPlayersWithoutContractStatus.map((player) => {
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