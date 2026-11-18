import { createElitePlayer, createStarPlayer, createYoungPlayer, createVeteranPlayer, createPlayer } from "../engine/playerFactory.js";

// AFL player list snapshot: 6 October 2026. Positions and roster names are based on AFL club player cards.
// Potential and game tiers are gameplay estimates, not official AFL ratings.

const westernbulldogsPlayersWithoutContractStatus = [
  createYoungPlayer({
    id: 51502,
    name: "Lachlan Carmichael",
    club: "Western Bulldogs",
    age: 19,
    positions: ["HB", "BP"],
    tier: "Rookie",
    potential: 80
  }),
  createElitePlayer({
    id: 51009,
    name: "Zak Butters",
    club: "Western Bulldogs",
    age: 26,
    positions: ["MID", "WING"],
    potential: 94
  }),
  createPlayer({
    id: 50039,
    name: "Jordon Butts",
    club: "Western Bulldogs",
    age: 25,
    positions: ["KPD"],
    overall: 79,
    potential: 86
  }),
  createPlayer({
    id: 51503,
    name: "Cody Weightman",
    club: "Western Bulldogs",
    age: 25,
    positions: ["HF", "FF"],
    tier: "Best22",
    overall: 83,
    potential: 86
  }),
  createElitePlayer({
    id: 51504,
    name: "Marcus Bontempelli",
    club: "Western Bulldogs",
    age: 30,
    positions: ["MID", "WING"],
    overall: 95,
    potential: 96
  }),
  createYoungPlayer({
    id: 51505,
    name: "Jedd Busslinger",
    club: "Western Bulldogs",
    age: 22,
    positions: ["KPD"],
    tier: "Rookie",
    overall: 74,
    potential: 82
  }),
  createYoungPlayer({
    id: 51506,
    name: "Cooper Hynes",
    club: "Western Bulldogs",
    age: 20,
    positions: ["MID", "WING"],
    tier: "Rookie",
    overall: 74,
    potential: 83
  }),
  createPlayer({
    id: 51507,
    name: "Rory Lobb",
    club: "Western Bulldogs",
    age: 33,
    positions: ["RUC", "KPD", "KPF"],
    tier: "Best22",
    overall: 79,
    potential: 79
  }),
  createPlayer({
    id: 51508,
    name: "Matthew Kennedy",
    club: "Western Bulldogs",
    age: 29,
    positions: ["MID", "WING"],
    tier: "Best22",
    overall: 84,
    potential: 84
  }),
  createYoungPlayer({
    id: 51509,
    name: "Ryley Sanders",
    club: "Western Bulldogs",
    age: 21,
    positions: ["MID", "WING"],
    tier: "Best22",
    overall: 80,
    potential: 86
  }),
  createPlayer({
    id: 51510,
    name: "Sam Darcy",
    club: "Western Bulldogs",
    age: 23,
    positions: ["KPF"],
    tier: "Best22",
    overall: 86,
    potential: 90
  }),
  createYoungPlayer({
    id: 51511,
    name: "Lachie Jaques",
    club: "Western Bulldogs",
    age: 20,
    positions: ["HB", "BP"],
    tier: "Rookie",
    potential: 80
  }),
  createPlayer({
    id: 51512,
    name: "Harvey Gallagher",
    club: "Western Bulldogs",
    age: 23,
    positions: ["MID", "WING"],
    potential: 83
  }),
  createPlayer({
    id: 51514,
    name: "Rhylee West",
    club: "Western Bulldogs",
    age: 26,
    positions: ["HF", "FF"],
    tier: "Best22",
    overall: 82,
    potential: 85
  }),
  createYoungPlayer({
    id: 51515,
    name: "Will Darcy",
    club: "Western Bulldogs",
    age: 19,
    positions: ["KPF"],
    tier: "Rookie",
    potential: 82
  }),
  createYoungPlayer({
    id: 51516,
    name: "Jordan Croft",
    club: "Western Bulldogs",
    age: 21,
    positions: ["KPF"],
    tier: "Rookie",
    potential: 82
  }),
  createPlayer({
    id: 51517,
    name: "Nick Coffield",
    club: "Western Bulldogs",
    age: 26,
    positions: ["HB", "BP"],
    tier: "Depth",
    potential: 80
  }),
  createPlayer({
    id: 51518,
    name: "James O'Donnell",
    club: "Western Bulldogs",
    age: 24,
    positions: ["KPD"],
    tier: "Best22",
    potential: 86
  }),
  createPlayer({
    id: 51519,
    name: "Connor Budarick",
    club: "Western Bulldogs",
    age: 25,
    positions: ["HB", "BP"],
    tier: "Best22",
    potential: 82
  }),
  createStarPlayer({
    id: 51520,
    name: "Ed Richards",
    club: "Western Bulldogs",
    age: 27,
    positions: ["MID", "WING"],
    potential: 92
  }),
  createYoungPlayer({
    id: 51522,
    name: "Caleb May",
    club: "Western Bulldogs",
    age: 21,
    positions: ["RUC"],
    tier: "Rookie",
    potential: 80
  }),
  createPlayer({
    id: 51523,
    name: "Laitham Vandermeer",
    club: "Western Bulldogs",
    age: 27,
    positions: ["HF", "FF"],
    tier: "Depth",
    overall: 77,
    potential: 81
  }),
  createPlayer({
    id: 51524,
    name: "Buku Khamis",
    club: "Western Bulldogs",
    age: 26,
    positions: ["HB", "BP"],
    tier: "Depth",
    potential: 82
  }),
  createYoungPlayer({
    id: 51525,
    name: "Louis Emmett",
    club: "Western Bulldogs",
    age: 19,
    positions: ["RUC"],
    tier: "Rookie",
    potential: 78
  }),
  createYoungPlayer({
    id: 2239,
    name: "Hudson O'Keeffe",
    club: "Western Bulldogs",
    age: 21,
    positions: ["RUC"],
    tier: "Rookie",
    potential: 82
  }),
  createYoungPlayer({
    id: 51526,
    name: "Josh Dolan",
    club: "Western Bulldogs",
    age: 19,
    positions: ["HF", "FF"],
    tier: "Rookie",
    potential: 81
  }),
  createYoungPlayer({
    id: 51527,
    name: "Joel Freijah",
    club: "Western Bulldogs",
    age: 20,
    positions: ["MID", "WING"],
    tier: "Rookie",
    overall: 81,
    potential: 87
  }),
  createPlayer({
    id: 51528,
    name: "Will Lewis",
    club: "Western Bulldogs",
    age: 27,
    positions: ["KPF"],
    tier: "Depth",
    potential: 81
  }),
  createPlayer({
    id: 51529,
    name: "Lachlan Bramble",
    club: "Western Bulldogs",
    age: 28,
    positions: ["HB", "BP"],
    tier: "Depth",
    potential: 80
  }),
  createPlayer({
    id: 51530,
    name: "Lachlan McNeil",
    club: "Western Bulldogs",
    age: 25,
    positions: ["MID", "WING"],
    tier: "Depth",
    potential: 81
  }),
  createPlayer({
    id: 51531,
    name: "Bailey Dale",
    club: "Western Bulldogs",
    age: 30,
    positions: ["HB", "BP"],
    tier: "Best22",
    overall: 85,
    potential: 85
  }),
  createPlayer({
    id: 51532,
    name: "Arthur Jones",
    club: "Western Bulldogs",
    age: 23,
    positions: ["HF", "FF"],
    tier: "Best22",
    potential: 85
  }),
  createStarPlayer({
    id: 51533,
    name: "Aaron Naughton",
    club: "Western Bulldogs",
    age: 26,
    positions: ["KPF"],
    overall: 86,
    potential: 89
  }),
  createPlayer({
    id: 51534,
    name: "Bailey Williams",
    club: "Western Bulldogs",
    age: 28,
    positions: ["HB", "BP"],
    tier: "Best22",
    potential: 83
  }),
  createYoungPlayer({
    id: 51535,
    name: "Luke Kennedy",
    club: "Western Bulldogs",
    age: 19,
    positions: ["HF", "FF"],
    tier: "Rookie",
    potential: 82
  }),
  createPlayer({
    id: 51536,
    name: "Luke Cleary",
    club: "Western Bulldogs",
    age: 24,
    positions: ["HB", "BP"],
    tier: "Depth",
    potential: 80
  }),
  createPlayer({
    id: 51537,
    name: "Michael Sellwood",
    club: "Western Bulldogs",
    age: 23,
    positions: ["HB", "BP"],
    tier: "Best22",
    overall: 81,
    potential: 85
  }),
  createPlayer({
    id: 51538,
    name: "Riley Garcia",
    club: "Western Bulldogs",
    age: 25,
    positions: ["MID", "WING"],
    tier: "Depth",
    potential: 81
  }),
  createYoungPlayer({
    id: 51539,
    name: "Lachlan Smith",
    club: "Western Bulldogs",
    age: 21,
    positions: ["RUC"],
    tier: "Rookie",
    potential: 79
  }),
  createYoungPlayer({
    id: 51540,
    name: "Zac Walker",
    club: "Western Bulldogs",
    age: 20,
    positions: ["HB", "BP"],
    tier: "Rookie",
    potential: 78
  }),
  createPlayer({
    id: 51541,
    name: "Sam Davidson",
    club: "Western Bulldogs",
    age: 24,
    positions: ["MID", "WING"],
    tier: "Depth",
    potential: 82
  }),
  createPlayer({
    id: 51542,
    name: "Ryan Gardner",
    club: "Western Bulldogs",
    age: 29,
    positions: ["KPD"],
    tier: "Depth",
    potential: 82
  }),
  createPlayer({
    id: 51543,
    name: "Tim English",
    club: "Western Bulldogs",
    age: 29,
    positions: ["RUC"],
    tier: "Best22",
    overall: 85,
    potential: 87
  }),
];

// Final contract years and free-agency statuses are transcribed from AFL Contracts.docx.
// Players without a source entry have no known final year or remaining term.
const contractDetails = {
  "Lachlan Carmichael": [2027, "Unknown"],
  "Cody Weightman": [2027, "Restricted Free Agent"],
  "Marcus Bontempelli": [2029, "Unrestricted Free Agent"],
  "Jedd Busslinger": [2028, "Non-Free Agent"],
  "Cooper Hynes": [2029, "Non-Free Agent"],
  "Rory Lobb": [2027, "Non-Free Agent"],
  "Matthew Kennedy": [2027, "Unrestricted Free Agent"],
  "Ryley Sanders": [2028, "Non-Free Agent"],
  "Sam Darcy": [2029, "Restricted Free Agent"],
  "Lachie Jaques": [2028, "Non-Free Agent"],
  "Rhylee West": [2030, "Unrestricted Free Agent"],
  "Will Darcy": [2027, "Unknown"],
  "Jordan Croft": [2029, "Non-Free Agent"],
  "Nick Coffield": [2026, "Non-Free Agent"],
  "James O'Donnell": [2029, "Non-Free Agent"],
  "Connor Budarick": [2028, "Non-Free Agent"],
  "Ed Richards": [2030, "Unrestricted Free Agent"],
  "Caleb May": [2027, "Non-Free Agent"],
  "Laitham Vandermeer": [2028, "Unrestricted Free Agent"],
  "Buku Khamis": [2031, "Unrestricted Free Agent"],
  "Louis Emmett": [2027, "Unknown"],
  "Josh Dolan": [2028, "Non-Free Agent"],
  "Joel Freijah": [2029, "Non-Free Agent"],
  "Will Lewis": [2026, "Unknown"],
  "Lachlan Bramble": [2028, "Unrestricted Free Agent"],
  "Lachlan McNeil": [2026, "Unrestricted Free Agent"],
  "Bailey Dale": [2029, "Unrestricted Free Agent"],
  "Arthur Jones": [2029, "Restricted Free Agent"],
  "Aaron Naughton": [2032, "Unrestricted Free Agent"],
  "Bailey Williams": [2027, "Unrestricted Free Agent"],
  "Luke Kennedy": [2027, "Non-Free Agent"],
  "Luke Cleary": [2027, "Non-Free Agent"],
  "Michael Sellwood": [2028, "Non-Free Agent"],
  "Riley Garcia": [2027, "Restricted Free Agent"],
  "Sam Davidson": [2028, "Non-Free Agent"],
  "Ryan Gardner": [2026, "Unrestricted Free Agent"],
  "Tim English": [2029, "Unrestricted Free Agent"],
  "Zak Butters": [2035, "Unrestricted Free Agent"],
  "Jordon Butts": [2032, "Non-Free Agent"],
  "Hudson O": [2028, "Non-Free Agent"],
};

export const westernbulldogsPlayers = westernbulldogsPlayersWithoutContractStatus.map((player) => {
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