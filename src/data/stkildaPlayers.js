import { createElitePlayer, createStarPlayer, createYoungPlayer, createVeteranPlayer, createPlayer } from "../engine/playerFactory.js";

// AFL player list snapshot: 6 October 2026. Positions and roster names are based on AFL club player cards.
// Potential and game tiers are gameplay estimates, not official AFL ratings.

const stkildaPlayersWithoutContractStatus = [
  createPlayer({
    id: 51201,
    name: "Jack Higgins",
    club: "St Kilda",
    age: 27,
    positions: ["HF", "FF"],
    overall: 82,
    potential: 82
  }),
  createPlayer({
    id: 51202,
    name: "Marcus Windhager",
    club: "St Kilda",
    age: 23,
    positions: ["MID", "WING"],
    overall: 82,
    potential: 85
  }),
  createPlayer({
    id: 51203,
    name: "Jack Silvagni",
    club: "St Kilda",
    age: 28,
    positions: ["KPD"],
    tier: "Best22",
    potential: 83
  }),
  createYoungPlayer({
    id: 51204,
    name: "Lance Collard",
    club: "St Kilda",
    age: 21,
    positions: ["HB", "BP"],
    tier: "Rookie",
    potential: 82
  }),
  createYoungPlayer({
    id: 51205,
    name: "Tobie Travaglia",
    club: "St Kilda",
    age: 19,
    positions: ["HB", "BP"],
    tier: "Rookie",
    potential: 78
  }),
  createPlayer({
    id: 51206,
    name: "Jack Macrae",
    club: "St Kilda",
    age: 32,
    positions: ["MID", "WING"],
    overall: 80,
    potential: 80
  }),
  createElitePlayer({
    id: 51207,
    name: "Nasiah Wanganeen-Milera",
    club: "St Kilda",
    age: 23,
    positions: ["MID", "WING", "HB"],
    overall: 93,
    potential: 96
  }),
  createPlayer({
    id: 51208,
    name: "Bradley Hill",
    club: "St Kilda",
    age: 33,
    positions: ["HB", "BP"],
    overall: 82,
    potential: 82
  }),
  createPlayer({
    id: 51209,
    name: "Sam Flanders",
    club: "St Kilda",
    age: 25,
    positions: ["MID", "WING"],
    overall: 82,
    potential: 86
  }),
  createPlayer({
    id: 51210,
    name: "Mitch Owens",
    club: "St Kilda",
    age: 23,
    positions: ["HF", "FF"],
    overall: 82,
    potential: 87
  }),
  createPlayer({
    id: 51211,
    name: "Hunter Clark",
    club: "St Kilda",
    age: 27,
    positions: ["HB", "BP"],
    overall: 78,
    potential: 80
  }),
  createPlayer({
    id: 51212,
    name: "Max King",
    club: "St Kilda",
    age: 26,
    positions: ["HF", "FF"],
    tier: "Best22",
    potential: 86
  }),
  createPlayer({
    id: 51213,
    name: "Ryan Byrnes",
    club: "St Kilda",
    age: 25,
    positions: ["MID", "WING"],
    overall: 78,
    potential: 80
  }),
  createPlayer({
    id: 51214,
    name: "Liam Stocker",
    club: "St Kilda",
    age: 26,
    positions: ["HB", "BP"],
    overall: 74,
    potential: 77
  }),
  createPlayer({
    id: 51215,
    name: "Paddy Dow",
    club: "St Kilda",
    age: 26,
    positions: ["MID", "WING"],
    overall: 73,
    potential: 75
  }),
  createPlayer({
    id: 51216,
    name: "Dan Butler",
    club: "St Kilda",
    age: 30,
    positions: ["HF", "FF"],
    overall: 80,
    potential: 80
  }),
  createYoungPlayer({
    id: 51217,
    name: "Isaac Keeler",
    club: "St Kilda",
    age: 22,
    positions: ["KPF"],
    tier: "Rookie",
    potential: 81
  }),
  createPlayer({
    id: 51218,
    name: "Jack Carroll",
    club: "St Kilda",
    age: 23,
    positions: ["HB", "BP"],
    overall: 78,
    potential: 81
  }),

  createPlayer({
    id: 51221,
    name: "Tom De Koning",
    club: "St Kilda",
    age: 27,
    positions: ["RUC"],
    overall: 83,
    potential: 85
  }),
  createYoungPlayer({
    id: 51222,
    name: "Darcy Wilson",
    club: "St Kilda",
    age: 21,
    positions: ["MID", "WING"],
    overall: 78,
    potential: 84
  }),
  createPlayer({
    id: 51223,
    name: "Liam Henry",
    club: "St Kilda",
    age: 25,
    positions: ["HF", "FF"],
    overall: 80,
    potential: 86
  }),
  createYoungPlayer({
    id: 51224,
    name: "Angus Hastie",
    club: "St Kilda",
    age: 21,
    positions: ["HB", "BP"],
    tier: "Rookie",
    potential: 79
  }),
  createYoungPlayer({
    id: 51225,
    name: "Mattaes Phillipou",
    club: "St Kilda",
    age: 20,
    positions: ["MID", "WING"],
    overall: 80,
    potential: 86
  }),
  createYoungPlayer({
    id: 51226,
    name: "Alix Tauru",
    club: "St Kilda",
    age: 19,
    positions: ["KPD"],
    overall: 74,
    potential: 84
  }),
  createYoungPlayer({
    id: 51227,
    name: "James Barrat",
    club: "St Kilda",
    age: 19,
    positions: ["KPD"],
    tier: "Rookie",
    potential: 80
  }),
  createYoungPlayer({
    id: 51228,
    name: "Alex Dodson",
    club: "St Kilda",
    age: 20,
    positions: ["RUC"],
    tier: "Rookie",
    potential: 83
  }),
  createPlayer({
    id: 51229,
    name: "Liam Ryan",
    club: "St Kilda",
    age: 30,
    positions: ["HF", "FF"],
    overall: 82,
    potential: 82
  }),
  createPlayer({
    id: 51230,
    name: "Mason Wood",
    club: "St Kilda",
    age: 33,
    positions: ["MID", "WING"],
    overall: 81,
    potential: 82
  }),
  createYoungPlayer({
    id: 51231,
    name: "Patrick Said",
    club: "St Kilda",
    age: 20,
    positions: ["MID", "WING"],
    tier: "Rookie",
    potential: 80
  }),
  createYoungPlayer({
    id: 51232,
    name: "Hugo Garcia",
    club: "St Kilda",
    age: 21,
    positions: ["MID", "WING"],
    overall: 82,
    potential: 88
  }),
  createPlayer({
    id: 51233,
    name: "Jack Sinclair",
    club: "St Kilda",
    age: 31,
    positions: ["HB", "BP"],
    tier: "Best22",
    potential: 85
  }),
  createYoungPlayer({
    id: 51234,
    name: "Charlie Banfield",
    club: "St Kilda",
    age: 19,
    positions: ["MID", "WING"],
    tier: "Rookie",
    potential: 80
  }),
  createYoungPlayer({
    id: 51235,
    name: "Kye Fincher",
    club: "St Kilda",
    age: 18,
    positions: ["MID", "WING"],
    tier: "Rookie",
    potential: 80
  }),
  createYoungPlayer({
    id: 51236,
    name: "Hugh Boxshall",
    club: "St Kilda",
    age: 20,
    positions: ["MID", "WING"],
    tier: "Rookie",
    potential: 83
  }),
  createYoungPlayer({
    id: 51237,
    name: "Campbell Lake",
    club: "St Kilda",
    age: 22,
    positions: ["HF", "FF"],
    tier: "Rookie",
    potential: 81
  }),
  createPlayer({
    id: 51238,
    name: "Max Hall",
    club: "St Kilda",
    age: 24,
    positions: ["MID", "WING"],
    overall: 84,
    potential: 90
  }),
  createYoungPlayer({
    id: 51239,
    name: "Kobe McDonald",
    club: "St Kilda",
    age: 18,
    positions: ["KPD"],
    tier: "Rookie",
    potential: 82
  }),
  createPlayer({
    id: 51240,
    name: "Cooper Sharman",
    club: "St Kilda",
    age: 26,
    positions: ["KPF"],
    overall: 79,
    potential: 85
  }),
  createStarPlayer({
    id: 51241,
    name: "Callum Wilkie",
    club: "St Kilda",
    age: 30,
    positions: ["KPD"],
    overall: 89,
    potential: 89
  }),
  createPlayer({
    id: 51242,
    name: "Liam O'Connell",
    club: "St Kilda",
    age: 23,
    positions: ["HB", "BP"],
    tier: "Depth",
    potential: 83
  }),
  createYoungPlayer({
    id: 51243,
    name: "Eamonn Armstrong",
    club: "St Kilda",
    age: 20,
    positions: ["HB", "BP"],
    tier: "Rookie",
    potential: 81
  }),
  createYoungPlayer({
    id: 51244,
    name: "Anthony Caminiti",
    club: "St Kilda",
    age: 22,
    positions: ["KPD", "KPF"],
    overall: 77,
    potential: 84
  })
];

// Final contract years and free-agency statuses are transcribed from AFL Contracts.docx.
// Players without a source entry have no known final year or remaining term.
const contractDetails = {
  "Jack Higgins": [2029, "Unrestricted Free Agent"],
  "Marcus Windhager": [2029, "Restricted Free Agent"],
  "Jack Silvagni": [2030, "Unrestricted Free Agent"],
  "Lance Collard": [2027, "Non-Free Agent"],
  "Tobie Travaglia": [2027, "Non-Free Agent"],
  "Jack Macrae": [2027, "Unrestricted Free Agent"],
  "Nasiah Wanganeen-Milera": [2027, "Non-Free Agent"],
  "Bradley Hill": [2027, "Restricted Free Agent"],
  "Sam Flanders": [2031, "Non-Free Agent"],
  "Mitch Owens": [2029, "Restricted Free Agent"],
  "Hunter Clark": [2027, "Unrestricted Free Agent"],
  "Max King": [2032, "Unrestricted Free Agent"],
  "Ryan Byrnes": [2027, "Unrestricted Free Agent"],
  "Liam Stocker": [2027, "Unrestricted Free Agent"],
  "Dan Butler": [2027, "Restricted Free Agent"],
  "Jack Carroll": [2026, "Unrestricted Free Agent"],
  "Tom De Koning": [2033, "Restricted Free Agent"],
  "Darcy Wilson": [2028, "Non-Free Agent"],
  "Liam Henry": [2027, "Non-Free Agent"],
  "Angus Hastie": [2027, "Non-Free Agent"],
  "Mattaes Phillipou": [2028, "Non-Free Agent"],
  "Alix Tauru": [2027, "Non-Free Agent"],
  "James Barrat": [2027, "Non-Free Agent"],
  "Alex Dodson": [2028, "Non-Free Agent"],
  "Liam Ryan": [2028, "Non-Free Agent"],
  "Mason Wood": [2027, "Unrestricted Free Agent"],
  "Hugo Garcia": [2029, "Non-Free Agent"],
  "Jack Sinclair": [2027, "Unrestricted Free Agent"],
  "Charlie Banfield": [2027, "Unknown"],
  "Kye Fincher": [2027, "Unknown"],
  "Hugh Boxshall": [2028, "Non-Free Agent"],
  "Campbell Lake": [2027, "Non-Free Agent"],
  "Max Hall": [2027, "Non-Free Agent"],
  "Kobe McDonald": [2027, "Unknown"],
  "Cooper Sharman": [2028, "Restricted Free Agent"],
  "Callum Wilkie": [2029, "Unrestricted Free Agent"],
  "Liam O": [2027, "Non-Free Agent"],
  "Eamonn Armstrong": [2027, "Non-Free Agent"],
  "Anthony Caminiti": [2027, "Non-Free Agent"],
};

export const stkildaPlayers = stkildaPlayersWithoutContractStatus.map((player) => {
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