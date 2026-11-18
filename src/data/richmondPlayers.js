import { createElitePlayer, createStarPlayer, createYoungPlayer, createVeteranPlayer, createPlayer } from "../engine/playerFactory.js";

// AFL player list snapshot: 6 October 2026. Positions and roster names are based on AFL club player cards.
// Potential and game tiers are gameplay estimates, not official AFL ratings.

const richmondPlayersWithoutContractStatus = [
  createPlayer({
    id: 51101,
    name: "Nick Vlastuin",
    club: "Richmond",
    age: 32,
    positions: ["HB", "BP"],
    overall: 84,
    potential: 84
  }),
  createPlayer({
    id: 51102,
    name: "Jacob Hopper",
    club: "Richmond",
    age: 29,
    positions: ["MID", "WING"],
    overall: 82,
    potential: 82
  }),
  createPlayer({
    id: 51104,
    name: "Sam Lalor",
    club: "Richmond",
    age: 20,
    positions: ["MID", "WING", "HF"],
    overall: 83,
    potential: 89
  }),
  createPlayer({
    id: 51105,
    name: "Jack Ross",
    club: "Richmond",
    age: 26,
    positions: ["MID", "WING"],
    tier: "Best22",
    overall: 82,
    potential: 83
  }),
  createPlayer({
    id: 51106,
    name: "Sam Banks",
    club: "Richmond",
    age: 23,
    positions: ["HB", "BP"],
    overall: 80,
    potential: 85
  }),
  createPlayer({
    id: 51107,
    name: "Rhyan Mansell",
    club: "Richmond",
    age: 26,
    positions: ["HF", "FF"],
    overall: 81,
    potential: 83
  }),
  createYoungPlayer({
    id: 51108,
    name: "Jonty Faull",
    club: "Richmond",
    age: 20,
    positions: ["KPF"],
    tier: "Rookie",
    potential: 83
  }),
  createYoungPlayer({
    id: 51109,
    name: "Taj Hotton",
    club: "Richmond",
    age: 20,
    positions: ["MID", "WING"],
    overall: 77,
    potential: 87
  }),
  createYoungPlayer({
    id: 51110,
    name: "Luke Trainor",
    club: "Richmond",
    age: 20,
    positions: ["KPD"],
    overall: 74,
    potential: 85
  }),
  createPlayer({
    id: 51111,
    name: "Ben Miller",
    club: "Richmond",
    age: 27,
    positions: ["KPD"],
    overall: 80,
    potential: 81
  }),
  createPlayer({
    id: 51112,
    name: "Hugo Ralphsmith",
    club: "Richmond",
    age: 24,
    positions: ["MID", "WING"],
    overall: 79,
    potential: 81
  }),
  createStarPlayer({
    id: 51113,
    name: "Tim Taranto",
    club: "Richmond",
    age: 28,
    positions: ["MID", "WING"],
    overall: 85,
    potential: 86
  }),
  createPlayer({
    id: 51114,
    name: "Jayden Short",
    club: "Richmond",
    age: 30,
    positions: ["HB", "BP"],
    overall: 82,
    potential: 82
  }),
  createYoungPlayer({
    id: 51115,
    name: "Josh Smillie",
    club: "Richmond",
    age: 20,
    positions: ["MID", "WING"],
    overall: 72,
    potential: 83
  }),
  createPlayer({
    id: 51116,
    name: "Maurice Rioli",
    club: "Richmond",
    age: 24,
    positions: ["HF", "FF"],
    overall: 77,
    potential: 81
  }),
  createPlayer({
    id: 51117,
    name: "Josh Gibcus",
    club: "Richmond",
    age: 23,
    positions: ["KPD"],
    overall: 79,
    potential: 85
  }),
  createPlayer({
    id: 51118,
    name: "Tom Lynch",
    club: "Richmond",
    age: 33,
    positions: ["KPF"],
    overall: 82,
    potential: 82
  }),
  createPlayer({
    id: 51119,
    name: "Noah Balta",
    club: "Richmond",
    age: 26,
    positions: ["KPD"],
    tier: "Best22",
    potential: 85
  }),
  createYoungPlayer({
    id: 51120,
    name: "Sam Cumming",
    club: "Richmond",
    age: 19,
    positions: ["MID", "WING"],
    overall: 77,
    potential: 86
  }),
  createYoungPlayer({
    id: 51121,
    name: "Judson Clarke",
    club: "Richmond",
    age: 22,
    positions: ["MID", "WING"],
    tier: "Rookie",
    potential: 81
  }),
  createYoungPlayer({
    id: 51122,
    name: "Sam Grlj",
    club: "Richmond",
    age: 19,
    positions: ["HB", "BP"],
    overall: 76,
    potential: 84
  }),
  createPlayer({
    id: 51123,
    name: "Toby Nankervis",
    club: "Richmond",
    age: 32,
    positions: ["RUC"],
    overall: 82,
    potential: 82
  }),
  createYoungPlayer({
    id: 51124,
    name: "Zane Peucker",
    club: "Richmond",
    age: 18,
    positions: ["HF", "FF"],
    tier: "Rookie",
    potential: 81
  }),
  createYoungPlayer({
    id: 51125,
    name: "Noah Roberts-Thomson",
    club: "Richmond",
    age: 19,
    positions: ["HF", "FF"],
    tier: "Rookie",
    potential: 80
  }),
  createYoungPlayer({
    id: 51126,
    name: "Kane McAuliffe",
    club: "Richmond",
    age: 21,
    positions: ["MID", "WING"],
    tier: "Rookie",
    potential: 82
  }),
  createYoungPlayer({
    id: 51127,
    name: "Jasper Alger",
    club: "Richmond",
    age: 19,
    positions: ["HF", "FF"],
    tier: "Rookie",
    potential: 82
  }),
  createPlayer({
    id: 51128,
    name: "Tom Brown",
    club: "Richmond",
    age: 23,
    positions: ["KPD"],
    overall: 75,
    potential: 84
  }),
  createPlayer({
    id: 51129,
    name: "Samson Ryan",
    club: "Richmond",
    age: 25,
    positions: ["RUC"],
    tier: "Depth",
    potential: 79
  }),
  createYoungPlayer({
    id: 51130,
    name: "Patrick Retschko",
    club: "Richmond",
    age: 20,
    positions: ["MID", "WING"],
    overall: 74,
    potential: 83
  }),
  createYoungPlayer({
    id: 51131,
    name: "Harry Armstrong",
    club: "Richmond",
    age: 20,
    positions: ["KPF"],
    tier: "Rookie",
    potential: 83
  }),
  createPlayer({
    id: 51133,
    name: "James Trezise",
    club: "Richmond",
    age: 24,
    positions: ["HB", "BP"],
    tier: "Depth",
    potential: 86
  }),
  createYoungPlayer({
    id: 51134,
    name: "Tom Sims",
    club: "Richmond",
    age: 20,
    positions: ["KPF"],
    tier: "Rookie",
    potential: 83
  }),
  createPlayer({
    id: 51135,
    name: "Tyler Sonsie",
    club: "Richmond",
    age: 23,
    positions: ["MID", "WING"],
    tier: "Depth",
    potential: 84
  }),
  createYoungPlayer({
    id: 51136,
    name: "Kye Annand",
    club: "Richmond",
    age: 22,
    positions: ["KPD"],
    tier: "Rookie",
    potential: 81
  }),
  createPlayer({
    id: 51137,
    name: "Mykelti Lefau",
    club: "Richmond",
    age: 28,
    positions: ["KPF"],
    overall: 81,
    potential: 81
  }),
  createYoungPlayer({
    id: 51138,
    name: "Liam Fawcett",
    club: "Richmond",
    age: 21,
    positions: ["KPF"],
    tier: "Rookie",
    potential: 82
  }),
  createYoungPlayer({
    id: 51139,
    name: "Seth Campbell",
    club: "Richmond",
    age: 20,
    positions: ["HF", "FF"],
    overall: 82,
    potential: 87
  }),
  createYoungPlayer({
    id: 51140,
    name: "Tom Burton",
    club: "Richmond",
    age: 19,
    positions: ["HF", "FF"],
    tier: "Rookie",
    potential: 80
  }),
  createYoungPlayer({
    id: 51141,
    name: "Patrick Carr",
    club: "Richmond",
    age: 21,
    positions: ["RUC"],
    tier: "Rookie",
    potential: 79
  }),
  createPlayer({
    id: 51142,
    name: "Oliver Hayes-Brown",
    club: "Richmond",
    age: 26,
    positions: ["RUC"],
    overall: 70,
    potential: 79
  }),
  createYoungPlayer({
    id: 51143,
    name: "Steely Green",
    club: "Richmond",
    age: 22,
    positions: ["HF", "FF"],
    overall: 75,
    potential: 81
  }),
  createYoungPlayer({
    id: 51144,
    name: "Kaleb Smith",
    club: "Richmond",
    age: 21,
    positions: ["HB", "BP"],
    tier: "Rookie",
    potential: 82
  }),
  createPlayer({
    id: 51145,
    name: "Campbell Gray",
    club: "Richmond",
    age: 23,
    positions: ["KPD"],
    overall: 72,
    potential: 82
  })
];

// Final contract years and free-agency statuses are transcribed from AFL Contracts.docx.
// Players without a source entry have no known final year or remaining term.
const contractDetails = {
  "Nick Vlastuin": [2027, "Unrestricted Free Agent"],
  "Jacob Hopper": [2029, "Non-Free Agent"],
  "Sam Lalor": [2029, "Non-Free Agent"],
  "Jack Ross": [2028, "Unrestricted Free Agent"],
  "Sam Banks": [2027, "Non-Free Agent"],
  "Rhyan Mansell": [2027, "Restricted Free Agent"],
  "Jonty Faull": [2029, "Non-Free Agent"],
  "Taj Hotton": [2029, "Non-Free Agent"],
  "Luke Trainor": [2027, "Non-Free Agent"],
  "Ben Miller": [2029, "Unrestricted Free Agent"],
  "Hugo Ralphsmith": [2027, "Non-Free Agent"],
  "Tim Taranto": [2029, "Non-Free Agent"],
  "Jayden Short": [2027, "Unrestricted Free Agent"],
  "Josh Smillie": [2027, "Non-Free Agent"],
  "Maurice Rioli": [2027, "Non-Free Agent"],
  "Josh Gibcus": [2029, "Restricted Free Agent"],
  "Tom Lynch": [2027, "Restricted Free Agent"],
  "Noah Balta": [2032, "Unrestricted Free Agent"],
  "Sam Cumming": [2028, "Unknown"],
  "Judson Clarke": [2026, "Non-Free Agent"],
  "Sam Grlj": [2028, "Unknown"],
  "Toby Nankervis": [2027, "Unrestricted Free Agent"],
  "Zane Peucker": [2027, "Unknown"],
  "Noah Roberts-Thomson": [2027, "Unknown"],
  "Kane McAuliffe": [2027, "Non-Free Agent"],
  "Jasper Alger": [2027, "Non-Free Agent"],
  "Tom Brown": [2027, "Non-Free Agent"],
  "Samson Ryan": [2027, "Non-Free Agent"],
  "Patrick Retschko": [2028, "Non-Free Agent"],
  "Harry Armstrong": [2029, "Non-Free Agent"],
  "James Trezise": [2026, "Non-Free Agent"],
  "Tom Sims": [2027, "Non-Free Agent"],
  "Tyler Sonsie": [2026, "Non-Free Agent"],
  "Kye Annand": [2027, "Non-Free Agent"],
  "Mykelti Lefau": [2028, "Non-Free Agent"],
  "Seth Campbell": [2029, "Non-Free Agent"],
  "Tom Burton": [2026, "Unknown"],
  "Patrick Carr": [2027, "Unknown"],
  "Oliver Hayes-Brown": [2026, "Non-Free Agent"],
  "Steely Green": [2026, "Non-Free Agent"],
  "Campbell Gray": [2027, "Non-Free Agent"],
};

export const richmondPlayers = richmondPlayersWithoutContractStatus.map((player) => {
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