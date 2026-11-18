import { createElitePlayer, createStarPlayer, createYoungPlayer, createVeteranPlayer, createPlayer } from "../engine/playerFactory.js";

// AFL player list snapshot: 6 October 2026. Positions and roster names are based on AFL club player cards.
// Potential and game tiers are gameplay estimates, not official AFL ratings.

const geelongPlayersWithoutContractStatus = [
  createYoungPlayer({
    id: 50402,
    name: "Jay Polkinghorne",
    club: "Geelong",
    age: 20,
    positions: ["HF", "FF"],
    overall: 74,
    potential: 83
  }),
  createElitePlayer({
    id: 50403,
    name: "Bailey Smith",
    club: "Geelong",
    age: 25,
    positions: ["MID", "WING"],
    overall: 91,
    potential: 93
  }),
  createPlayer({
    id: 50404,
    name: "Tanner Bruhn",
    club: "Geelong",
    age: 24,
    positions: ["HB", "BP"],
    tier: "Best22",
    potential: 86
  }),
  createElitePlayer({
    id: 50405,
    name: "Jeremy Cameron",
    club: "Geelong",
    age: 33,
    positions: ["KPF"],
    overall: 89,
    potential: 86
  }),
  createPlayer({
    id: 50406,
    name: "Toby Conway",
    club: "Geelong",
    age: 23,
    positions: ["RUC"],
    tier: "Depth",
    potential: 82
  }),
  createPlayer({
    id: 50407,
    name: "Shaun Mannagh",
    club: "Geelong",
    age: 29,
    positions: ["HF", "FF"],
    tier: "Best22",
    potential: 85
  }),
  createElitePlayer({
    id: 50409,
    name: "Max Holmes",
    club: "Geelong",
    age: 24,
    positions: ["MID", "WING"],
    overall: 89,
    potential: 92
  }),
  createPlayer({
    id: 50410,
    name: "Mitch Knevitt",
    club: "Geelong",
    age: 23,
    positions: ["MID", "WING"],
    tier: "Depth",
    potential: 82
  }),
  createYoungPlayer({
    id: 50411,
    name: "Mitchell Edwards",
    club: "Geelong",
    age: 21,
    positions: ["RUC"],
    overall: 74,
    potential: 82
  }),
  createYoungPlayer({
    id: 50413,
    name: "Jhye Clark",
    club: "Geelong",
    age: 22,
    positions: ["HB", "BP"],
    overall: 75,
    potential: 81
  }),
  createYoungPlayer({
    id: 50414,
    name: "Connor O'Sullivan",
    club: "Geelong",
    age: 21,
    positions: ["KPD"],
    tier: "Rookie",
    overall: 82,
    potential: 88
  }),
  createYoungPlayer({
    id: 50415,
    name: "George Stevens",
    club: "Geelong",
    age: 21,
    positions: ["MID", "WING"],
    tier: "Rookie",
    potential: 82
  }),
  createPlayer({
    id: 50416,
    name: "Sam De Koning",
    club: "Geelong",
    age: 25,
    positions: ["KPD"],
    tier: "Best22",
    potential: 86
  }),
  createPlayer({
    id: 50417,
    name: "Lawson Humphries",
    club: "Geelong",
    age: 23,
    positions: ["HB", "BP"],
    tier: "Best22",
    overall: 82,
    potential: 87
  }),
  createStarPlayer({
    id: 51219,
    name: "Rowan Marshall",
    club: "Geelong",
    age: 30,
    positions: ["RUC"],
    overall: 85,
    potential: 85
  }),
  createPlayer({
    id: 50419,
    name: "Jack Martin",
    club: "Geelong",
    age: 31,
    positions: ["HF", "FF"],
    tier: "Best22",
    potential: 81
  }),
  createYoungPlayer({
    id: 50420,
    name: "Jacob Molier",
    club: "Geelong",
    age: 19,
    positions: ["KPF"],
    tier: "Rookie",
    potential: 80
  }),
  createPlayer({
    id: 50421,
    name: "Oliver Wiltshire",
    club: "Geelong",
    age: 24,
    positions: ["HF", "FF"],
    overall: 76,
    potential: 82
  }),
  createYoungPlayer({
    id: 50422,
    name: "Hunter Holmes",
    club: "Geelong",
    age: 19,
    positions: ["MID", "WING"],
    tier: "Rookie",
    potential: 84
  }),
  createYoungPlayer({
    id: 50423,
    name: "Lennox Hofmann",
    club: "Geelong",
    age: 20,
    positions: ["HB", "BP"],
    tier: "Rookie",
    potential: 79
  }),
  createPlayer({
    id: 50424,
    name: "Jed Bews",
    club: "Geelong",
    age: 32,
    positions: ["HB", "BP"],
    tier: "Depth",
    potential: 80
  }),
  createYoungPlayer({
    id: 50425,
    name: "Jesse Mellor",
    club: "Geelong",
    age: 19,
    positions: ["HF", "FF"],
    tier: "Rookie",
    potential: 80
  }),
  createYoungPlayer({
    id: 50426,
    name: "Harley Barker",
    club: "Geelong",
    age: 19,
    positions: ["MID", "WING"],
    tier: "Rookie",
    potential: 80
  }),
  createYoungPlayer({
    id: 50427,
    name: "Nicholas Driscoll",
    club: "Geelong",
    age: 19,
    positions: ["HF", "FF"],
    tier: "Rookie",
    potential: 80
  }),
  createPlayer({
    id: 50428,
    name: "Oliver Dempsey",
    club: "Geelong",
    age: 23,
    positions: ["MID", "WING"],
    overall: 84,
    potential: 89
  }),
  createPlayer({
    id: 50429,
    name: "James Worpel",
    club: "Geelong",
    age: 27,
    positions: ["MID", "WING"],
    overall: 78,
    potential: 84
  }),
  createPlayer({
    id: 50430,
    name: "Tom Atkins",
    club: "Geelong",
    age: 31,
    positions: ["MID", "WING"],
    overall: 81,
    potential: 81
  }),
  createYoungPlayer({
    id: 50431,
    name: "Keighton Matofai-Forbes",
    club: "Geelong",
    age: 20,
    positions: ["HB", "BP"],
    tier: "Rookie",
    potential: 80
  }),
  createPlayer({
    id: 50432,
    name: "Gryan Miers",
    club: "Geelong",
    age: 27,
    positions: ["HF", "FF"],
    tier: "Best22",
    potential: 87
  }),
  createPlayer({
    id: 50433,
    name: "Shannon Neale",
    club: "Geelong",
    age: 24,
    positions: ["KPF"],
    overall: 86,
    potential: 89
  }),
  createPlayer({
    id: 50434,
    name: "Oisin Mullin",
    club: "Geelong",
    age: 26,
    positions: ["MID", "WING"],
    overall: 79,
    potential: 82
  }),
  createVeteranPlayer({
    id: 50435,
    name: "Patrick Dangerfield",
    club: "Geelong",
    age: 36,
    positions: ["HF", "FF"]
  }),
  createPlayer({
    id: 50436,
    name: "Oliver Henry",
    club: "Geelong",
    age: 24,
    positions: ["HF", "FF"],
    overall: 82,
    potential: 86
  }),
  createYoungPlayer({
    id: 50437,
    name: "Joe Pike",
    club: "Geelong",
    age: 21,
    positions: ["RUC"],
    tier: "Rookie",
    potential: 82
  }),
  createPlayer({
    id: 50438,
    name: "Jack Henry",
    club: "Geelong",
    age: 28,
    positions: ["HB", "BP"],
    tier: "Depth",
    potential: 83
  }),
  createPlayer({
    id: 50439,
    name: "Zach Guthrie",
    club: "Geelong",
    age: 28,
    positions: ["HB", "BP"],
    overall: 79,
    potential: 83
  }),
  createPlayer({
    id: 50440,
    name: "Cillian Burke",
    club: "Geelong",
    age: 23,
    positions: ["HB", "BP"],
    overall: 71,
    potential: 81
  }),
  createPlayer({
    id: 50441,
    name: "Mark O'Connor",
    club: "Geelong",
    age: 29,
    positions: ["HB", "BP"],
    tier: "Depth",
    potential: 82
  }),
  createStarPlayer({
    id: 50604,
    name: "Toby Greene",
    club: "Geelong",
    age: 33,
    positions: ["MID", "WING"],
    overall: 87,
    potential: 87
  }),
  createStarPlayer({
    id: 50442,
    name: "Tom Stewart",
    club: "Geelong",
    age: 33,
    positions: ["HB", "BP"],
    overall: 89,
    potential: 87
  }),
  createPlayer({
    id: 50443,
    name: "Brad Close",
    club: "Geelong",
    age: 28,
    positions: ["HF", "FF"],
    overall: 80,
    potential: 83
  }),
  createVeteranPlayer({
    id: 50444,
    name: "Mark Blicavs",
    club: "Geelong",
    age: 35,
    positions: ["MID", "WING"]
  })
];

// Final contract years and free-agency statuses are transcribed from AFL Contracts.docx.
// Players without a source entry have no known final year or remaining term.
const contractDetails = {
  "Jay Polkinghorne": [2027, "Non-Free Agent"],
  "Bailey Smith": [2030, "Non-Free Agent"],
  "Tanner Bruhn": [2027, "Non-Free Agent"],
  "Jeremy Cameron": [2028, "Restricted Free Agent"],
  "Toby Conway": [2027, "Non-Free Agent"],
  "Shaun Mannagh": [2029, "Non-Free Agent"],
  "Max Holmes": [2028, "Restricted Free Agent"],
  "Mitch Knevitt": [2026, "Non-Free Agent"],
  "Mitchell Edwards": [2030, "Non-Free Agent"],
  "Jhye Clark": [2028, "Non-Free Agent"],
  "Connor O": [2028, "Non-Free Agent"],
  "Sam De Koning": [2027, "Restricted Free Agent"],
  "Lawson Humphries": [2028, "Non-Free Agent"],
  "Jack Martin": [2027, "Unrestricted Free Agent"],
  "Jacob Molier": [2027, "Non-Free Agent"],
  "Oliver Wiltshire": [2027, "Non-Free Agent"],
  "Hunter Holmes": [2027, "Unknown"],
  "Lennox Hofmann": [2027, "Non-Free Agent"],
  "Jesse Mellor": [2027, "Unknown"],
  "Harley Barker": [2027, "Unknown"],
  "Nicholas Driscoll": [2027, "Non-Free Agent"],
  "Oliver Dempsey": [2029, "Restricted Free Agent"],
  "James Worpel": [2029, "Unrestricted Free Agent"],
  "Tom Atkins": [2027, "Restricted Free Agent"],
  "Gryan Miers": [2028, "Unrestricted Free Agent"],
  "Shannon Neale": [2030, "Unrestricted Free Agent"],
  "Rowan Marshall": [2029, "Non-Free Agent"],
  "Oisin Mullin": [2027, "Non-Free Agent"],
  "Patrick Dangerfield": [2027, "Unrestricted Free Agent"],
  "Oliver Henry": [2027, "Non-Free Agent"],
  "Joe Pike": [2027, "Non-Free Agent"],
  "Jack Henry": [2029, "Unrestricted Free Agent"],
  "Zach Guthrie": [2028, "Unrestricted Free Agent"],
  "Cillian Burke": [2027, "Non-Free Agent"],
  "Mark O": [2028, "Unrestricted Free Agent"],
  "Tom Stewart": [2027, "Unrestricted Free Agent"],
  "Brad Close": [2028, "Restricted Free Agent"],
  "Mark Blicavs": [2027, "Unrestricted Free Agent"],
  "Toby Greene": [2029, "Unrestricted Free Agent"],
};

export const geelongPlayers = geelongPlayersWithoutContractStatus.map((player) => {
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