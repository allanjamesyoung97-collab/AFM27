import { createElitePlayer, createStarPlayer, createYoungPlayer, createVeteranPlayer, createPlayer } from "../engine/playerFactory.js";

// AFL player list snapshot: 6 October 2026. Positions and roster names are based on AFL club player cards.
// Potential and game tiers are gameplay estimates, not official AFL ratings.

const hawthornPlayersWithoutContractStatus = [
  createPlayer({
    id: 50701,
    name: "Harry Morrison",
    club: "Hawthorn",
    age: 27,
    positions: ["MID", "WING"],
    overall: 78,
    potential: 78
  }),
  createPlayer({
    id: 50930,
    name: "Josh Goater",
    club: "Hawthorn",
    age: 23,
    positions: ["HB", "BP"],
    overall: 73,
    potential: 80
  }),
  createElitePlayer({
    id: 50207,
    name: 'Zach Merrett',
    club: 'Hawthorn',
    age: 31,
    positions: ['MID', 'WING'],
    overall: 91,
    potential: 91,
  }),
  createPlayer({
    id: 50702,
    name: "Mitch Lewis",
    club: "Hawthorn",
    age: 27,
    positions: ["KPF"],
    tier: "Best22",
    potential: 84
  }),
  createElitePlayer({
    id: 50703,
    name: "Jai Newcombe",
    club: "Hawthorn",
    age: 25,
    positions: ["MID", "WING"],
    overall: 88,
    potential: 92
  }),
  createPlayer({
    id: 50704,
    name: "Jarman Impey",
    club: "Hawthorn",
    age: 31,
    positions: ["HB", "BP"],
    tier: "Best22",
    potential: 84
  }),
  createStarPlayer({
    id: 50705,
    name: "Nick Watson",
    club: "Hawthorn",
    age: 21,
    positions: ["HF", "FF"],
    overall: 87,
    potential: 91
  }),
  createStarPlayer({
    id: 50706,
    name: "James Sicily",
    club: "Hawthorn",
    age: 31,
    positions: ["HB", "BP"],
    overall: 88,
    potential: 88
  }),
  createPlayer({
    id: 50707,
    name: "Ned Reeves",
    club: "Hawthorn",
    age: 27,
    positions: ["RUC"],
    overall: 76,
    potential: 79
  }),
  createStarPlayer({
    id: 50708,
    name: "Dylan Moore",
    club: "Hawthorn",
    age: 27,
    positions: ["HF", "FF"],
    overall: 86,
    potential: 88
  }),
  createPlayer({
    id: 50709,
    name: "Connor Macdonald",
    club: "Hawthorn",
    age: 23,
    positions: ["HF", "FF"],
    overall: 82,
    potential: 87
  }),
  createPlayer({
    id: 50710,
    name: "Karl Amon",
    club: "Hawthorn",
    age: 31,
    positions: ["HB", "BP"],
    tier: "Best22",
    potential: 81
  }),
  createPlayer({
    id: 50711,
    name: "Conor Nash",
    club: "Hawthorn",
    age: 28,
    positions: ["MID", "WING"],
    overall: 79,
    potential: 80
  }),
  createStarPlayer({
    id: 50712,
    name: "Will Day",
    club: "Hawthorn",
    age: 25,
    positions: ["MID", "WING"],
    overall: 87,
    potential: 88
  }),
  createYoungPlayer({
    id: 50713,
    name: "Calsher Dear",
    club: "Hawthorn",
    age: 21,
    positions: ["KPF"],
    overall: 73,
    potential: 84
  }),
  createPlayer({
    id: 50714,
    name: "Jack Scrimshaw",
    club: "Hawthorn",
    age: 28,
    positions: ["KPD"],
    overall: 78,
    potential: 79
  }),
  createPlayer({
    id: 50715,
    name: "Blake Hardwick",
    club: "Hawthorn",
    age: 29,
    positions: ["HB", "BP"],
    overall: 83,
    potential: 84
  }),
  createPlayer({
    id: 50716,
    name: "Massimo D'Ambrosio",
    club: "Hawthorn",
    age: 23,
    positions: ["MID", "WING"],
   overall: 82,
    potential: 87
  }),
  createPlayer({
    id: 50717,
    name: "Lloyd Meek",
    club: "Hawthorn",
    age: 28,
    positions: ["RUC"],
    tier: "Best22",
    potential: 85
  }),
  createPlayer({
    id: 50718,
    name: "Mabior Chol",
    club: "Hawthorn",
    age: 29,
    positions: ["KPF"],
    overall: 79,
    potential: 82
  }),
  createPlayer({
    id: 50719,
    name: "Jack Gunston",
    club: "Hawthorn",
    age: 34,
    positions: ["KPF"],
    overall: 84,
    potential: 84
  }),
  createPlayer({
    id: 50720,
    name: "Finn Maginness",
    club: "Hawthorn",
    age: 25,
    positions: ["MID", "WING"],
    tier: "Depth",
    potential: 82
  }),
  createYoungPlayer({
    id: 50721,
    name: "Noah Mraz",
    club: "Hawthorn",
    age: 20,
    positions: ["KPD"],
    tier: "Rookie",
    overall: 74,
    potential: 86
  }),
  createYoungPlayer({
    id: 50722,
    name: "Cameron Nairn",
    club: "Hawthorn",
    age: 18,
    positions: ["MID", "WING"],
    tier: "Rookie",
    potential: 82
  }),
  createPlayer({
    id: 50723,
    name: "Josh Weddle",
    club: "Hawthorn",
    age: 22,
    positions: ["HB", "BP"],
    tier: "Best22",
    potential: 88
  }),
  createPlayer({
    id: 50724,
    name: "Josh Battle",
    club: "Hawthorn",
    age: 28,
    positions: ["KPD"],
    tier: "Best22",
    potential: 85
  }),
  createPlayer({
    id: 50725,
    name: "Josh Ward",
    club: "Hawthorn",
    age: 23,
    positions: ["MID", "WING"],
    tier: "Best22",
    potential: 87
  }),
  createYoungPlayer({
    id: 50726,
    name: "Bodie Ryan",
    club: "Hawthorn",
    age: 21,
    positions: ["HB", "BP"],
    tier: "Rookie",
    potential: 82
  }),
  createYoungPlayer({
    id: 50727,
    name: "William McCabe",
    club: "Hawthorn",
    age: 21,
    positions: ["MID", "WING"],
    tier: "Rookie",
    potential: 82
  }),
  createYoungPlayer({
    id: 50728,
    name: "Cam Mackenzie",
    club: "Hawthorn",
    age: 22,
    positions: ["MID", "WING"],
    tier: "Best22",
    potential: 85
  }),
  createYoungPlayer({
    id: 50729,
    name: "Aidan Schubert",
    club: "Hawthorn",
    age: 18,
    positions: ["KPF"],
    tier: "Rookie",
    potential: 82
  }),
  createPlayer({
    id: 50730,
    name: "Sam Butler",
    club: "Hawthorn",
    age: 23,
    positions: ["MID", "WING"],
    tier: "Depth",
    potential: 82
  }),
  createYoungPlayer({
    id: 50731,
    name: "Matthew LeRay",
    club: "Hawthorn",
    age: 19,
    positions: ["KPD"],
    overall: 67,
    potential: 80
  }),
  createYoungPlayer({
    id: 50732,
    name: "Cody Anderson",
    club: "Hawthorn",
    age: 20,
    positions: ["HF", "FF"],
    tier: "Rookie",
    potential: 80
  }),
  createPlayer({
    id: 50733,
    name: "Jack Ginnivan",
    club: "Hawthorn",
    age: 23,
    positions: ["HF", "FF"],
    overall: 83,
    potential: 87
  }),
  createYoungPlayer({
    id: 50734,
    name: "Jack Dalton",
    club: "Hawthorn",
    age: 19,
    positions: ["HF", "FF"],
    tier: "Rookie",
    potential: 81
  }),
  createStarPlayer({
    id: 50531,
    name: "Ben King",
    club: "Gold Coast",
    age: 26,
    positions: ["KPF"],
    overall: 88,
    potential: 91
  }),
  createYoungPlayer({
    id: 50735,
    name: "Oliver Greeves",
    club: "Hawthorn",
    age: 19,
    positions: ["HF", "FF"],
    tier: "Rookie",
    potential: 80
  }),
  createPlayer({
    id: 50736,
    name: "James Blanck",
    club: "Hawthorn",
    age: 25,
    positions: ["KPD"],
    tier: "Depth",
    potential: 79
  }),
  createStarPlayer({
    id: 50737,
    name: "Tom Barrass",
    club: "Hawthorn",
    age: 30,
    positions: ["KPD"],
    overall: 84,
    potential: 86
  }),
  createPlayer({
    id: 50738,
    name: "Max Ramsden",
    club: "Hawthorn",
    age: 23,
    positions: ["KPF"],
    tier: "Depth",
    potential: 82
  }),
  createPlayer({
    id: 50739,
    name: "Flynn Perez",
    club: "Hawthorn",
    age: 25,
    positions: ["HB", "BP"],
    tier: "Depth",
    potential: 81
  }),
  createYoungPlayer({
    id: 50740,
    name: "Max Beattie",
    club: "Hawthorn",
    age: 22,
    positions: ["HF", "FF"],
    tier: "Rookie",
    potential: 81
  }),
  createYoungPlayer({
    id: 50741,
    name: "Matt Hill",
    club: "Hawthorn",
    age: 22,
    positions: ["HF", "FF"],
    tier: "Rookie",
    potential: 81
  }),
  createYoungPlayer({
    id: 50742,
    name: "Bailey Macdonald",
    club: "Hawthorn",
    age: 22,
    positions: ["HB", "BP"],
    tier: "Rookie",
    potential: 81
  }),
  createPlayer({
    id: 50743,
    name: "Jaime Uhr-Henry",
    club: "Hawthorn",
    age: 23,
    positions: ["RUC"],
    overall: 67,
    potential: 73
  }),
  createYoungPlayer({
    id: 50744,
    name: "Henry Hustwaite",
    club: "Hawthorn",
    age: 22,
    positions: ["MID", "WING"],
    tier: "Rookie",
    potential: 81
  })
];

// Final contract years and free-agency statuses are transcribed from AFL Contracts.docx.
// Players without a source entry have no known final year or remaining term.
const contractDetails = {
  "Harry Morrison": [2027, "Unrestricted Free Agent"],
  "Mitch Lewis": [2030, "Unrestricted Free Agent"],
  "Jai Newcombe": [2032, "Unrestricted Free Agent"],
  "Jarman Impey": [2029, "Unrestricted Free Agent"],
  "Nick Watson": [2029, "Non-Free Agent"],
  "James Sicily": [2027, "Unrestricted Free Agent"],
  "Ned Reeves": [2029, "Unrestricted Free Agent"],
  "Dylan Moore": [2030, "Unrestricted Free Agent"],
  "Connor Macdonald": [2029, "Restricted Free Agent"],
  "Karl Amon": [2027, "Non-Free Agent"],
  "Conor Nash": [2029, "Unrestricted Free Agent"],
  "Will Day": [2027, "Restricted Free Agent"],
  "Calsher Dear": [2028, "Non-Free Agent"],
  "Jack Scrimshaw": [2027, "Restricted Free Agent"],
  "Blake Hardwick": [2029, "Unrestricted Free Agent"],
  "Massimo D": [2028, "Non-Free Agent"],
  "Lloyd Meek": [2029, "Non-Free Agent"],
  "Mabior Chol": [2027, "Unrestricted Free Agent"],
  "Jack Gunston": [2027, "Unrestricted Free Agent"],
  "Finn Maginness": [2027, "Restricted Free Agent"],
  "Noah Mraz": [2028, "Non-Free Agent"],
  "Cameron Nairn": [2028, "Unknown"],
  "Josh Goater": [2027, "Non-Free Agent"],
  "Josh Weddle": [2030, "Restricted Free Agent"],
  "Josh Battle": [2030, "Non-Free Agent"],
  "Josh Ward": [2029, "Restricted Free Agent"],
  "William McCabe": [2027, "Non-Free Agent"],
  "Cam Mackenzie": [2028, "Non-Free Agent"],
  "Aidan Schubert": [2029, "Non-Free Agent"],
  "Sam Butler": [2027, "Non-Free Agent"],
  "Matthew LeRay": [2027, "Unknown"],
  "Jack Ginnivan": [2027, "Non-Free Agent"],
  "Jack Dalton": [2027, "Unknown"],
  "Zach Merrett": [2030, "Unrestricted Free Agent"],
  "Oliver Greeves": [2027, "Non-Free Agent"],
  "Tom Barrass": [2028, "Unrestricted Free Agent"],
  "Max Ramsden": [2026, "Non-Free Agent"],
  "Ben King": [2034, "Restricted Free Agent"],
  "Flynn Perez": [2026, "Unrestricted Free Agent"],
  "Max Beattie": [2027, "Non-Free Agent"],
  "Matt Hill": [2028, "Non-Free Agent"],
  "Bailey Macdonald": [2029, "Non-Free Agent"],
};

export const hawthornPlayers = hawthornPlayersWithoutContractStatus.map((player) => {
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