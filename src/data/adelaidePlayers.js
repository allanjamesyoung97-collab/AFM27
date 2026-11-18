import { createElitePlayer, createStarPlayer, createYoungPlayer, createVeteranPlayer, createPlayer } from "../engine/playerFactory.js";

// AFL player list snapshot: 6 October 2026. Positions and roster names are based on AFL club player cards.
// Potential and game tiers are gameplay estimates, not official AFL ratings.

const adelaidePlayersWithoutContractStatus = [
  createPlayer({
    id: 50001,
    name: "Chayce Jones",
    club: "Adelaide",
    age: 26,
    positions: ["HB", "BP"],
    overall: 77,
    potential: 78
  }),
  createPlayer({
    id: 50002,
    name: "Ben Keays",
    club: "Adelaide",
    age: 29,
    positions: ["HF", "FF"],
    overall: 82,
    potential: 82
  }),
  createPlayer({
    id: 50003,
    name: "Sam Berry",
    club: "Adelaide",
    age: 24,
    positions: ["MID", "WING"],
    tier: "Best22",
    potential: 86
  }),
  createPlayer({
    id: 50004,
    name: "Callum Ah Chee",
    club: "Adelaide",
    age: 28,
    positions: ["HF", "FF"],
    tier: "Best22",
    overall: 82,
    potential: 83
  }),
  createYoungPlayer({
    id: 50005,
    name: "Sid Draper",
    club: "Adelaide",
    age: 20,
    positions: ["MID", "WING"],
    tier: "Rookie",
    potential: 83
  }),
  createYoungPlayer({
    id: 50006,
    name: "Daniel Curtin",
    club: "Adelaide",
    age: 21,
    positions: ["MID", "WING"],
    tier: "Rookie",
overall: 80,
    potential: 86
  }),
  createStarPlayer({
    id: 50007,
    name: "Riley Thilthorpe",
    club: "Adelaide",
    age: 24,
    positions: ["KPF"],
    overall: 88,
    potential: 91
  }),
  createPlayer({
    id: 50008,
    name: "Josh Rachele",
    club: "Adelaide",
    age: 23,
    positions: ["HF", "FF"],
    tier: "Best22",
    potential: 89
  }),
  createPlayer({
    id: 50009,
    name: "Nick Murray",
    club: "Adelaide",
    age: 25,
    positions: ["KPD"],
    overall: 78,
    potential: 81
  }),

  createYoungPlayer({
    id: 50011,
    name: "Charlie Edwards",
    club: "Adelaide",
    age: 21,
    positions: ["MID", "WING"],
    tier: "Rookie",
    potential: 82
  }),
  createElitePlayer({
    id: 50012,
    name: "Jordan Dawson",
    club: "Adelaide",
    age: 29,
    positions: ["MID", "WING"],
    overall: 90,
    potential: 93
  }),
  createPlayer({
    id: 50014,
    name: "Jake Soligo",
    club: "Adelaide",
    age: 23,
    positions: ["MID", "WING"],
    tier: "Best22",
    overall: 82,
    potential: 87
  }),
  createPlayer({
    id: 50015,
    name: "Brayden Cook",
    club: "Adelaide",
    age: 24,
    positions: ["MID", "WING"],
    tier: "Best22",
    potential: 86
  }),
  createYoungPlayer({
    id: 50016,
    name: "Max Michalanney",
    club: "Adelaide",
    age: 22,
    positions: ["HB", "BP"],
    overall: 77,
    potential: 81
  }),
  createYoungPlayer({
    id: 50017,
    name: "Tyler Welsh",
    club: "Adelaide",
    age: 20,
    positions: ["HF", "FF"],
    tier: "Rookie",
    potential: 83
  }),
  createPlayer({
    id: 50018,
    name: "Zac Taylor",
    club: "Adelaide",
    age: 23,
    positions: ["HF", "FF"],
    overall: 79,
    potential: 83
  }),
  createPlayer({
    id: 50019,
    name: "Mitchell Hinge",
    club: "Adelaide",
    age: 28,
    positions: ["HB", "BP"],
    overall: 80,
    potential: 81
  }),
  createYoungPlayer({
    id: 50020,
    name: "Hugh Bond",
    club: "Adelaide",
    age: 22,
    positions: ["HB", "BP"],
    tier: "Rookie",
    potential: 81
  }),
  createYoungPlayer({
    id: 50021,
    name: "Oscar Ryan",
    club: "Adelaide",
    age: 21,
    positions: ["HB", "BP"],
    tier: "Rookie",
    potential: 82
  }),
  createStarPlayer({
    id: 50022,
    name: "Izak Rankine",
    club: "Adelaide",
    age: 26,
    positions: ["MID", "WING"],
    potential: 91
  }),
  createPlayer({
    id: 50023,
    name: "Josh Worrell",
    club: "Adelaide",
    age: 25,
    positions: ["KPD"],
    overall: 82,
    potential: 86
  }),
  createPlayer({
    id: 50024,
    name: "James Peatling",
    club: "Adelaide",
    age: 26,
    positions: ["MID", "WING"],
    overall: 82,
    potential: 85
  }),
  createYoungPlayer({
    id: 50025,
    name: "Mitchell Marsh",
    club: "Adelaide",
    age: 19,
    positions: ["HF", "FF"],
    tier: "Rookie",
    potential: 84
  }),
  createPlayer({
    id: 50026,
    name: "Luke Nankervis",
    club: "Adelaide",
    age: 23,
    positions: ["HB", "BP"],
    tier: "Depth",
    potential: 84
  }),
  createPlayer({
    id: 50027,
    name: "Alex Neal-Bullen",
    club: "Adelaide",
    age: 30,
    positions: ["HF", "FF"],
    tier: "Depth",
    overall: 82,
    potential: 82
  }),
  createPlayer({
    id: 50028,
    name: "Rory Laird",
    club: "Adelaide",
    age: 31,
    positions: ["HB", "BP"],
    tier: "Depth",
    overall: 82,
    potential: 82
  }),
  createPlayer({
    id: 50029,
    name: "Wayne Milera",
    club: "Adelaide",
    age: 29,
    positions: ["HB", "BP"],
    overall: 83,
    potential: 83
  }),
  createYoungPlayer({
    id: 50030,
    name: "Billy Dowling",
    club: "Adelaide",
    age: 22,
    positions: ["MID", "WING"],
    tier: "Rookie",
    potential: 81
  }),
  createPlayer({
    id: 50031,
    name: "Darcy Fogarty",
    club: "Adelaide",
    age: 27,
    positions: ["HF", "FF"],
    overall: 84,
    potential: 84
  }),
  createYoungPlayer({
    id: 50032,
    name: "Indy Cotton",
    club: "Adelaide",
    age: 19,
    positions: ["KPD"],
    tier: "Rookie",
    potential: 84
  }),
  createYoungPlayer({
    id: 50033,
    name: "Archie Ludowyke",
    club: "Adelaide",
    age: 18,
    positions: ["KPF"],
    tier: "Rookie",
    potential: 85
  }),
  createPlayer({
    id: 50034,
    name: "James Borlase",
    club: "Adelaide",
    age: 24,
    positions: ["HB", "BP"],
    tier: "Depth",
    potential: 86
  }),
  createPlayer({
    id: 50035,
    name: "Finnbar Maley",
    club: "Adelaide",
    age: 23,
    positions: ["KPF"],
    tier: "Depth",
    potential: 80
  }),
  createPlayer({
    id: 50036,
    name: "Lachlan Sholl",
    club: "Adelaide",
    age: 26,
    positions: ["MID", "WING"],
    tier: "Depth",
    potential: 80
  }),
  createYoungPlayer({
    id: 50037,
    name: "Toby Murray",
    club: "Adelaide",
    age: 22,
    positions: ["RUC"],
    tier: "Rookie",
    potential: 81
  }),
  createPlayer({
    id: 50038,
    name: "Hugo Hall-Kahan",
    club: "Adelaide",
    age: 23,
    positions: ["HB", "BP"],
    tier: "Depth",
    potential: 83
  }),

  createPlayer({
    id: 50040,
    name: "Lachlan McAndrew",
    club: "Adelaide",
    age: 26,
    positions: ["RUC"],
    overall: 83,
    potential: 85
  }),
  createPlayer({
    id: 50041,
    name: "Reilly O'Brien",
    club: "Adelaide",
    age: 31,
    positions: ["RUC"],
    tier: "Depth",
    potential: 81
  }),
  createPlayer({
    id: 50042,
    name: "Isaac Cumming",
    club: "Adelaide",
    age: 28,
    positions: ["MID", "WING"],
    overall: 83,
    potential: 84
  }),
  createPlayer({
    id: 50043,
    name: "Mark Keane",
    club: "Adelaide",
    age: 26,
    positions: ["KPD"],
    overall: 81,
    potential: 85
  })
];

// Final contract years and free-agency statuses are transcribed from AFL Contracts.docx.
// Players without a source entry have no known final year or remaining term.
const contractDetails = {
  "Ben Keays": [2027, "Unrestricted Free Agent"],
  "Sam Berry": [2027, "Non-Free Agent"],
  "Callum Ah Chee": [2030, "Non-Free Agent"],
  "Sid Draper": [2027, "Non-Free Agent"],
  "Daniel Curtin": [2029, "Non-Free Agent"],
  "Riley Thilthorpe": [2028, "Restricted Free Agent"],
  "Josh Rachele": [2029, "Restricted Free Agent"],
  "Nick Murray": [2028, "Restricted Free Agent"],
  "Charlie Edwards": [2027, "Non-Free Agent"],
  "Jordan Dawson": [2029, "Restricted Free Agent"],
  "Jake Soligo": [2029, "Restricted Free Agent"],
  "Brayden Cook": [2028, "Restricted Free Agent"],
  "Max Michalanney": [2030, "Restricted Free Agent"],
  "Zac Taylor": [2028, "Non-Free Agent"],
  "Mitchell Hinge": [2027, "Non-Free Agent"],
  "Hugh Bond": [2027, "Non-Free Agent"],
  "Oscar Ryan": [2027, "Non-Free Agent"],
  "Izak Rankine": [2032, "Unrestricted Free Agent"],
  "Josh Worrell": [2033, "Unrestricted Free Agent"],
  "James Peatling": [2028, "Non-Free Agent"],
  "Mitchell Marsh": [2028, "Non-Free Agent"],
  "Luke Nankervis": [2027, "Non-Free Agent"],
  "Alex Neal-Bullen": [2028, "Unrestricted Free Agent"],
  "Rory Laird": [2027, "Unrestricted Free Agent"],
  "Wayne Milera": [2028, "Unrestricted Free Agent"],
  "Billy Dowling": [2027, "Non-Free Agent"],
  "Darcy Fogarty": [2031, "Unrestricted Free Agent"],
  "Indy Cotton": [2027, "Unknown"],
  "Archie Ludowyke": [2028, "Non-Free Agent"],
  "James Borlase": [2029, "Unrestricted Free Agent"],
  "Finnbar Maley": [2027, "Non-Free Agent"],
  "Toby Murray": [2027, "Non-Free Agent"],
  "Hugo Hall-Kahan": [2028, "Unrestricted Free Agent"],
  "Lachlan McAndrew": [2027, "Unrestricted Free Agent"],
  "Reilly O": [2028, "Unrestricted Free Agent"],
  "Isaac Cumming": [2030, "Non-Free Agent"],
  "Mark Keane": [2028, "Non-Free Agent"],
};

export const adelaidePlayers = adelaidePlayersWithoutContractStatus.map((player) => {
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