import { createElitePlayer, createStarPlayer, createYoungPlayer, createVeteranPlayer, createPlayer } from "../engine/playerFactory.js";

// AFL player list snapshot: 6 October 2026. Positions and roster names are based on AFL club player cards.
// Potential and game tiers are gameplay estimates, not official AFL ratings.

const westcoastPlayersWithoutContractStatus = [
  createYoungPlayer({
    id: 51401,
    name: "Willem Duursma",
    club: "West Coast",
    age: 19,
    positions: ["MID", "WING"],
    overall: 82,
    potential: 89
  }),
  createPlayer({
    id: 51402,
    name: "Jake Waterman",
    club: "West Coast",
    age: 28,
    positions: ["HF", "FF"],
    overall: 85,
    potential: 86
  }),
  createPlayer({
    id: 51403,
    name: "Liam Baker",
    club: "West Coast",
    age: 28,
    positions: ["HB", "BP"],
    overall: 83,
    potential: 83
  }),
  createPlayer({
    id: 51404,
    name: "Brandon Starcevich",
    club: "West Coast",
    age: 27,
    positions: ["HB", "BP"],
    tier: "Best22",
    overall: 81,
    potential: 84
  }),
  createYoungPlayer({
    id: 51405,
    name: "Josh Lindsay",
    club: "West Coast",
    age: 19,
    positions: ["HB", "BP"],
    tier: "Rookie",
    potential: 83
  }),
  createStarPlayer({
    id: 51406,
    name: "Elliot Yeo",
    club: "West Coast",
    age: 33,
    positions: ["MID", "WING"],
    overall: 82,
    potential: 82
  }),
  createYoungPlayer({
    id: 51407,
    name: "Reuben Ginbey",
    club: "West Coast",
    age: 22,
    positions: ["HB", "BP"],
    overall: 76,
    potential: 85
  }),
  createYoungPlayer({
    id: 51408,
    name: "Elijah Hewett",
    club: "West Coast",
    age: 22,
    positions: ["MID", "WING"],
    tier: "Rookie",
    potential: 84
  }),
  createStarPlayer({
    id: 51409,
    name: "Harley Reid",
    club: "West Coast",
    age: 21,
    positions: ["MID", "WING"],
    overall: 85,
    potential: 90
  }),
  createPlayer({
    id: 51410,
    name: "Tyler Brockman",
    club: "West Coast",
    age: 23,
    positions: ["HF", "FF"],
    tier: "Best22",
    potential: 86
  }),
  createStarPlayer({
    id: 51411,
    name: "Tim Kelly",
    club: "West Coast",
    age: 32,
    positions: ["MID", "WING"],
    overall: 84,
    potential: 84
  }),
  createYoungPlayer({
    id: 51412,
    name: "Sam Allen",
    club: "West Coast",
    age: 19,
    positions: ["MID", "WING"],
    tier: "Rookie",
    potential: 82
  }),
  createYoungPlayer({
    id: 51413,
    name: "Noah Long",
    club: "West Coast",
    age: 22,
    positions: ["HF", "FF"],
    tier: "Rookie",
    potential: 83
  }),
  createPlayer({
    id: 51414,
    name: "Liam Duggan",
    club: "West Coast",
    age: 29,
    positions: ["HB", "BP"],
  overall: 81,
    potential: 81
  }),
  createPlayer({
    id: 51416,
    name: "Matthew Owies",
    club: "West Coast",
    age: 29,
    positions: ["HF", "FF"],
    overall: 78,
    potential: 78
  }),
  createPlayer({
    id: 51417,
    name: "Jack Graham",
    club: "West Coast",
    age: 28,
    positions: ["MID", "WING"],
    tier: "Best22",
    overall: 80,
    potential: 80
  }),
  createPlayer({
    id: 51418,
    name: "Tom McCarthy",
    club: "West Coast",
    age: 26,
    positions: ["HB", "BP"],
    overall: 82,
    potential: 85
  }),
  createPlayer({
    id: 51419,
    name: "Brady Hough",
    club: "West Coast",
    age: 23,
    positions: ["HB", "BP"],
    tier: "Best22",
    potential: 84
  }),
  createPlayer({
    id: 51420,
    name: "Tylar Young",
    club: "West Coast",
    age: 28,
    positions: ["KPD"],
    overall: 76,
    potential: 78
  }),
  createYoungPlayer({
    id: 51421,
    name: "Cooper Duff-Tytler",
    club: "West Coast",
    age: 19,
    positions: ["KPF"],
    overall: 75,
    potential: 86
  }),
  createYoungPlayer({
    id: 51422,
    name: "Archer Reid",
    club: "West Coast",
    age: 21,
    positions: ["KPF"],
    tier: "Rookie",
    potential: 82
  }),
  createYoungPlayer({
    id: 51423,
    name: "Ryan Maric",
    club: "West Coast",
    age: 22,
    positions: ["MID", "WING"],
    overall: 76,
    potential: 81
  }),
  createYoungPlayer({
    id: 51424,
    name: "Harvey Johnston",
    club: "West Coast",
    age: 21,
    positions: ["HF", "FF"],
    tier: "Rookie",
    potential: 82
  }),
  createPlayer({
    id: 51425,
    name: "Matt Flynn",
    club: "West Coast",
    age: 29,
    positions: ["RUC"],
    tier: "Depth",
    potential: 82
  }),
  createYoungPlayer({
    id: 51426,
    name: "Bo Allan",
    club: "West Coast",
    age: 20,
    positions: ["MID", "WING"],
    tier: "Rookie",
    potential: 83
  }),
  createYoungPlayer({
    id: 51427,
    name: "Tom Gross",
    club: "West Coast",
    age: 20,
    positions: ["HF", "FF"],
    tier: "Rookie",
    potential: 83
  }),
  createPlayer({
    id: 51428,
    name: "Tom Cole",
    club: "West Coast",
    age: 29,
    positions: ["HF", "FF", "KPD"],
    tier: "Depth",
    potential: 82
  }),
  createYoungPlayer({
    id: 51429,
    name: "Clay Hall",
    club: "West Coast",
    age: 21,
    positions: ["MID", "WING"],
    tier: "Rookie",
    potential: 82
  }),
  createYoungPlayer({
    id: 51430,
    name: "Harry Barnett",
    club: "West Coast",
    age: 22,
    positions: ["RUC"],
    tier: "Rookie",
    potential: 81
  }),
  createYoungPlayer({
    id: 51431,
    name: "Lucca Grego",
    club: "West Coast",
    age: 20,
    positions: ["HB", "BP"],
    tier: "Rookie",
    potential: 80
  }),
  createPlayer({
    id: 51432,
    name: "Bailey J. Williams",
    club: "West Coast",
    age: 26,
    positions: ["RUC"],
    overall: 82,
    potential: 85
  }),
  createYoungPlayer({
    id: 51433,
    name: "Rhett Bazzo",
    club: "West Coast",
    age: 22,
    positions: ["KPD"],
    tier: "Rookie",
    potential: 81
  }),
  createYoungPlayer({
    id: 51434,
    name: "Jack Williams",
    club: "West Coast",
    age: 22,
    positions: ["KPF"],
    tier: "Rookie",
    potential: 81
  }),
  createYoungPlayer({
    id: 51435,
    name: "Jobe Shanahan",
    club: "West Coast",
    age: 20,
    positions: ["KPF"],
    overall: 78,
    potential: 87
  }),
  createYoungPlayer({
    id: 51436,
    name: "Tylah Williams",
    club: "West Coast",
    age: 19,
    positions: ["HF", "FF"],
    tier: "Rookie",
    potential: 78
  }),
  createYoungPlayer({
    id: 51437,
    name: "Malakai Champion",
    club: "West Coast",
    age: 20,
    positions: ["HF", "FF"],
    tier: "Rookie",
    potential: 80
  }),
  createYoungPlayer({
    id: 51438,
    name: "Hamish Davis",
    club: "West Coast",
    age: 20,
    positions: ["MID", "WING"],
    tier: "Rookie",
    potential: 78
  }),
  createYoungPlayer({
    id: 51439,
    name: "Fred Rodriguez",
    club: "West Coast",
    age: 19,
    positions: ["HB", "BP"],
    tier: "Rookie",
    potential: 80
  }),
  createPlayer({
    id: 51440,
    name: "Deven Robertson",
    club: "West Coast",
    age: 25,
    positions: ["MID", "WING"],
    tier: "Depth",
    potential: 83
  }),
  createPlayer({
    id: 51441,
    name: "Sandy Brock",
    club: "West Coast",
    age: 23,
    positions: ["KPD"],
    tier: "Depth",
    potential: 84
  }),
  createPlayer({
    id: 51442,
    name: "Harry Edwards",
    club: "West Coast",
    age: 26,
    positions: ["KPD"],
    tier: "Depth",
    potential: 85
  }),
  createYoungPlayer({
    id: 51443,
    name: "Tyrell Dewar",
    club: "West Coast",
    age: 22,
    positions: ["HB", "BP"],
    overall: 76,
    potential: 83
  }),
  createPlayer({
    id: 51444,
    name: "Jack Hutchinson",
    club: "West Coast",
    age: 24,
    positions: ["HF", "FF"],
    tier: "Depth",
    potential: 82
  }),
  createPlayer({
    id: 51445,
    name: "Finlay Macrae",
    club: "West Coast",
    age: 24,
    positions: ["MID", "WING"],
    tier: "Depth",
    potential: 81
  }),
  createYoungPlayer({
    id: 51446,
    name: "Jacob Newton",
    club: "West Coast",
    age: 20,
    positions: ["HF", "FF"],
    tier: "Rookie",
    potential: 80
  }),
  createPlayer({
    id: 51447,
    name: "Milan Murdock",
    club: "West Coast",
    age: 26,
    positions: ["HF", "FF"],
    tier: "Depth",
    potential: 81
  }),
  createPlayer({
    id: 51448,
    name: "Harry Schoenberg",
    club: "West Coast",
    age: 25,
    positions: ["HF", "FF"],
    tier: "Depth",
    potential: 82
  }),
  createYoungPlayer({
    id: 51449,
    name: "Jake Miles-Wrency",
    club: "West Coast",
    age: 20,
    positions: ["KPD"],
    tier: "Rookie",
    potential: 80
  }),
  createYoungPlayer({
    id: 51450,
    name: "Oliver Francou",
    club: "West Coast",
    age: 20,
    positions: ["MID", "WING"],
    tier: "Rookie",
    potential: 80
  }),
  createPlayer({
    id: 51451,
    name: "Marcus Herbert",
    club: "West Coast",
    age: 24,
    positions: ["HB", "BP"],
    tier: "Best22",
    potential: 86
  })
];

// Final contract years and free-agency statuses are transcribed from AFL Contracts.docx.
// Players without a source entry have no known final year or remaining term.
const contractDetails = {
  "Willem Duursma": [2028, "Unknown"],
  "Jake Waterman": [2029, "Unrestricted Free Agent"],
  "Liam Baker": [2029, "Non-Free Agent"],
  "Brandon Starcevich": [2031, "Non-Free Agent"],
  "Josh Lindsay": [2028, "Unknown"],
  "Elliot Yeo": [2027, "Unrestricted Free Agent"],
  "Reuben Ginbey": [2030, "Restricted Free Agent"],
  "Elijah Hewett": [2030, "Restricted Free Agent"],
  "Harley Reid": [2028, "Non-Free Agent"],
  "Tim Kelly": [2027, "Restricted Free Agent"],
  "Sam Allen": [2028, "Non-Free Agent"],
  "Noah Long": [2027, "Non-Free Agent"],
  "Liam Duggan": [2028, "Unrestricted Free Agent"],
  "Matthew Owies": [2027, "Non-Free Agent"],
  "Jack Graham": [2028, "Non-Free Agent"],
  "Tom McCarthy": [2028, "Non-Free Agent"],
  "Brady Hough": [2028, "Non-Free Agent"],
  "Tylar Young": [2028, "Non-Free Agent"],
  "Cooper Duff-Tytler": [2028, "Unknown"],
  "Archer Reid": [2030, "Non-Free Agent"],
  "Ryan Maric": [2028, "Non-Free Agent"],
  "Matt Flynn": [2027, "Non-Free Agent"],
  "Bo Allan": [2028, "Non-Free Agent"],
  "Tom Gross": [2027, "Non-Free Agent"],
  "Tom Cole": [2027, "Unrestricted Free Agent"],
  "Clay Hall": [2026, "Non-Free Agent"],
  "Lucca Grego": [2027, "Non-Free Agent"],
  "Bailey J. Williams": [2032, "Unrestricted Free Agent"],
  "Rhett Bazzo": [2029, "Restricted Free Agent"],
  "Jack Williams": [2026, "Non-Free Agent"],
  "Jobe Shanahan": [2028, "Non-Free Agent"],
  "Tylah Williams": [2027, "Unknown"],
  "Malakai Champion": [2026, "Non-Free Agent"],
  "Hamish Davis": [2027, "Non-Free Agent"],
  "Fred Rodriguez": [2026, "Unknown"],
  "Deven Robertson": [2027, "Unrestricted Free Agent"],
  "Sandy Brock": [2027, "Unrestricted Free Agent"],
  "Harry Edwards": [2027, "Restricted Free Agent"],
  "Tyrell Dewar": [2028, "Non-Free Agent"],
  "Jack Hutchinson": [2029, "Non-Free Agent"],
  "Finlay Macrae": [2027, "Unrestricted Free Agent"],
  "Jacob Newton": [2027, "Non-Free Agent"],
  "Milan Murdock": [2028, "Non-Free Agent"],
  "Harry Schoenberg": [2026, "Unrestricted Free Agent"],
  "Oliver Francou": [2027, "Non-Free Agent"],
  "Marcus Herbert": [2028, "Non-Free Agent"],
};

export const westcoastPlayers = westcoastPlayersWithoutContractStatus.map((player) => {
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