import { createElitePlayer, createStarPlayer, createYoungPlayer, createVeteranPlayer, createPlayer } from "../engine/playerFactory.js";

// AFL player list snapshot: 6 October 2026. Positions and roster names are based on AFL club player cards.
// Potential and game tiers are gameplay estimates, not official AFL ratings.

const brisbanePlayersWithoutContractStatus = [
  createPlayer({
    id: 50101,
    name: "Kai Lohmann",
    club: "Brisbane",
    age: 23,
    positions: ["HF", "FF"],
    tier: "Best22",
    potential: 87
  }),
  createPlayer({
    id: 50102,
    name: "Sam Draper",
    club: "Brisbane",
    age: 28,
    positions: ["RUC"],
    tier: "Best22",
    potential: 83
  }),
  createYoungPlayer({
    id: 50103,
    name: "Jaspa Fletcher",
    club: "Brisbane",
    age: 22,
    positions: ["HB", "BP"],
    tier: "Rookie",
    overall: 82,
    potential: 87
  }),
  createPlayer({
    id: 50104,
    name: "Oscar Allen",
    club: "Brisbane",
    age: 27,
    positions: ["KPF"],
    tier: "Best22",
    overall: 82,
    potential: 84
  }),
  createStarPlayer({
    id: 50105,
    name: "Josh Dunkley",
    club: "Brisbane",
    age: 29,
    positions: ["MID", "WING"],
    overall: 87,
    potential: 87
  }),
  createStarPlayer({
    id: 50106,
    name: "Hugh McCluggage",
    club: "Brisbane",
    age: 28,
    positions: ["MID", "WING"],
    overall: 87,
    potential: 87
  }),
  createPlayer({
    id: 50107,
    name: "Jarrod Berry",
    club: "Brisbane",
    age: 28,
    positions: ["MID", "WING"],
    tier: "Best22",
    potential: 83
  }),
  createStarPlayer({
    id: 50108,
    name: "Will Ashcroft",
    club: "Brisbane",
    age: 22,
    positions: ["MID", "WING"],
    overall: 91,
    potential: 95
  }),
  createYoungPlayer({
    id: 50110,
    name: "Levi Ashcroft",
    club: "Brisbane",
    age: 19,
    positions: ["MID", "WING"],
    tier: "Rookie",
    overall: 80,
    potential: 88
  }),
  createPlayer({
    id: 50111,
    name: "Lincoln McCarthy",
    club: "Brisbane",
    age: 32,
    positions: ["HF", "FF"],
    tier: "Best22",
    overall: 80,
    potential: 80
  }),
  createPlayer({
    id: 50112,
    name: "Tom Doedee",
    club: "Brisbane",
    age: 29,
    positions: ["HB", "BP"],
    tier: "Best22",
    overall: 80,
    potential: 82
  }),
  createYoungPlayer({
    id: 50113,
    name: "Logan Morris",
    club: "Brisbane",
    age: 21,
    positions: ["KPF"],
    tier: "Best22",
    overall: 85,
    potential: 93
  }),
  createYoungPlayer({
    id: 50114,
    name: "Daniel Annable",
    club: "Brisbane",
    age: 19,
    positions: ["MID", "WING"],
    tier: "Rookie",
    potential: 84
  }),
  createVeteranPlayer({
    id: 50115,
    name: "Dayne Zorko",
    club: "Brisbane",
    age: 37,
    overall: 88,
    positions: ["HB", "BP"]
  }),
  createPlayer({
    id: 50116,
    name: "Cam Rayner",
    club: "Brisbane",
    age: 26,
    positions: ["HF", "FF"],
    tier: "Best22",
    overall: 83,
    potential: 85
  }),
  createPlayer({
    id: 50117,
    name: "Luke Beecken",
    club: "Brisbane",
    age: 25,
    positions: ["HB", "BP"],
    tier: "depth",
    potential: 81
  }),
  createPlayer({
    id: 50118,
    name: "Keidean Coleman",
    club: "Brisbane",
    age: 26,
    positions: ["HB", "BP"],
    tier: "Best22",
    overall: 81,
    potential: 85
  }),
  createYoungPlayer({
    id: 50119,
    name: "Luke Lloyd",
    club: "Brisbane",
    age: 21,
    positions: ["KPD"],
    tier: "Rookie",
    potential: 82
  }),
  createYoungPlayer({
    id: 50120,
    name: "Sam Marshall",
    club: "Brisbane",
    age: 20,
    positions: ["MID", "WING"],
    tier: "Rookie",
    potential: 83
  }),
  createYoungPlayer({
    id: 50121,
    name: "Zane Zakostelsky",
    club: "Brisbane",
    age: 20,
    positions: ["KPD"],
    tier: "Rookie",
    potential: 79
  }),
  createYoungPlayer({
    id: 50122,
    name: "Ty Gallop",
    club: "Brisbane",
    age: 20,
    positions: ["KPD"],
    tier: "Rookie",
    overall: 74,
    potential: 83
  }),
  createPlayer({
    id: 50123,
    name: "Charlie Cameron",
    club: "Brisbane",
    age: 32,
    positions: ["HF", "FF"],
    tier: "Best22",
    overall: 85,
    potential: 85
  }),
  createYoungPlayer({
    id: 50124,
    name: "Koby Evans",
    club: "Brisbane",
    age: 19,
    positions: ["HF", "FF"],
    tier: "Rookie",
    potential: 84
  }),
  createPlayer({
    id: 50125,
    name: "Henry Smith",
    club: "Brisbane",
    age: 24,
    positions: ["RUC"],
    tier: "Depth",
    potential: 86
  }),
  createPlayer({
    id: 50126,
    name: "Conor McKenna",
    club: "Brisbane",
    age: 30,
    positions: ["HF", "FF"],
    tier: "Depth",
    overall: 78,
    potential: 82
  }),
  createPlayer({
    id: 50127,
    name: "Darcy Gardiner",
    club: "Brisbane",
    age: 31,
    positions: ["HB", "BP"],
    tier: "Depth",
    potential: 81
  }),
  createYoungPlayer({
    id: 50128,
    name: "Will McLachlan",
    club: "Brisbane",
    age: 21,
    positions: ["HF", "FF"],
    tier: "Rookie",
    potential: 82
  }),
  createPlayer({
    id: 50129,
    name: "James Tunstill",
    club: "Brisbane",
    age: 23,
    positions: ["MID", "WING"],
    tier: "Depth",
    potential: 87
  }),
  createPlayer({
    id: 50130,
    name: "Eric Hipwood",
    club: "Brisbane",
    age: 29,
    positions: ["KPF"],
    tier: "Depth",
    potential: 82
  }),
  createElitePlayer({
    id: 50131,
    name: "Harris Andrews",
    club: "Brisbane",
    age: 29,
    positions: ["KPD"],
    overall: 91,
    potential: 95
  }),
  createPlayer({
    id: 50132,
    name: "Darcy Fort",
    club: "Brisbane",
    age: 33,
    positions: ["RUC"],
    tier: "Depth",
    potential: 79
  }),
  createPlayer({
    id: 50133,
    name: "Zac Bailey",
    club: "Brisbane",
    age: 27,
    positions: ["MID", "WING"],
    tier: "Best22",
    overall: 87,
    potential: 90
  }),
  createYoungPlayer({
    id: 50134,
    name: "Shadeau Brain",
    club: "Brisbane",
    age: 22,
    positions: ["HB", "BP"],
    tier: "Rookie",
    potential: 81
  }),
  createPlayer({
    id: 50135,
    name: "Ryan Lester",
    club: "Brisbane",
    age: 34,
    positions: ["HB", "BP"],
    overall: 79,
    potential: 79
  }),
  createYoungPlayer({
    id: 50136,
    name: "Reece Torrent",
    club: "Brisbane",
    age: 21,
    positions: ["MID", "WING"],
    tier: "Rookie",
    potential: 82
  }),
  createYoungPlayer({
    id: 50137,
    name: "Cody Curtin",
    club: "Brisbane",
    age: 19,
    positions: ["KPF"],
    tier: "Rookie",
    potential: 84
  }),
  createPlayer({
    id: 50138,
    name: "Bruce Reville",
    club: "Brisbane",
    age: 25,
    positions: ["MID", "WING"],
    tier: "Depth",
    potential: 78
  }),
  createYoungPlayer({
    id: 50139,
    name: "Ben Murphy",
    club: "Brisbane",
    age: 19,
    positions: ["HF", "FF"],
    tier: "Rookie",
    potential: 84
  }),
  createPlayer({
    id: 50140,
    name: "Jack Payne",
    club: "Brisbane",
    age: 26,
    positions: ["KPD"],
    tier: "Depth",
    potential: 85
  }),
  createPlayer({
    id: 50141,
    name: "Darragh Joyce",
    club: "Brisbane",
    age: 29,
    positions: ["KPD"],
    tier: "Depth",
    overall: 72,
    potential: 78
  }),
  createYoungPlayer({
    id: 50142,
    name: "Tai Hayes",
    club: "Brisbane",
    age: 21,
    positions: ["MID", "WING"],
    tier: "Rookie",
    potential: 82
  }),
  createPlayer({
    id: 50143,
    name: "Noah Answerth",
    club: "Brisbane",
    age: 27,
    positions: ["HB", "BP"],
    tier: "Depth",
    potential: 84
  }),
  createYoungPlayer({
    id: 50144,
    name: "Darcy Wilmot",
    club: "Brisbane",
    age: 21,
    positions: ["HB", "BP"],
    tier: "Rookie",
    overall: 81,
    potential: 88
  })
];

// Final contract years and free-agency statuses are transcribed from AFL Contracts.docx.
// Players without a source entry have no known final year or remaining term.
const contractDetails = {
  "Kai Lohmann": [2027, "Non-Free Agent"],
  "Sam Draper": [2030, "Non-Free Agent"],
  "Jaspa Fletcher": [2030, "Restricted Free Agent"],
  "Oscar Allen": [2031, "Non-Free Agent"],
  "Josh Dunkley": [2030, "Restricted Free Agent"],
  "Hugh McCluggage": [2031, "Unrestricted Free Agent"],
  "Jarrod Berry": [2029, "Unrestricted Free Agent"],
  "Will Ashcroft": [2030, "Restricted Free Agent"],
  "Levi Ashcroft": [2030, "Non-Free Agent"],
  "Lincoln McCarthy": [2026, "Restricted Free Agent"],
  "Tom Doedee": [2027, "Non-Free Agent"],
  "Logan Morris": [2029, "Non-Free Agent"],
  "Daniel Annable": [2028, "Unknown"],
  "Dayne Zorko": [2027, "Unrestricted Free Agent"],
  "Cam Rayner": [2031, "Unrestricted Free Agent"],
  "Luke Beecken": [2026, "Non-Free Agent"],
  "Keidean Coleman": [2027, "Restricted Free Agent"],
  "Luke Lloyd": [2026, "Non-Free Agent"],
  "Sam Marshall": [2027, "Non-Free Agent"],
  "Zane Zakostelsky": [2028, "Non-Free Agent"],
  "Ty Gallop": [2029, "Non-Free Agent"],
  "Charlie Cameron": [2028, "Unrestricted Free Agent"],
  "Koby Evans": [2027, "Unknown"],
  "Henry Smith": [2028, "Restricted Free Agent"],
  "Conor McKenna": [2026, "Non-Free Agent"],
  "Darcy Gardiner": [2027, "Unrestricted Free Agent"],
  "Will McLachlan": [2026, "Non-Free Agent"],
  "James Tunstill": [2027, "Non-Free Agent"],
  "Eric Hipwood": [2029, "Unrestricted Free Agent"],
  "Harris Andrews": [2029, "Unrestricted Free Agent"],
  "Darcy Fort": [2027, "Non-Free Agent"],
  "Zac Bailey": [2034, "Unrestricted Free Agent"],
  "Shadeau Brain": [2027, "Non-Free Agent"],
  "Ryan Lester": [2027, "Unrestricted Free Agent"],
  "Reece Torrent": [2027, "Non-Free Agent"],
  "Cody Curtin": [2029, "Non-Free Agent"],
  "Bruce Reville": [2029, "Non-Free Agent"],
  "Ben Murphy": [2027, "Unknown"],
  "Jack Payne": [2029, "Unrestricted Free Agent"],
  "Darragh Joyce": [2026, "Unrestricted Free Agent"],
  "Tai Hayes": [2027, "Unknown"],
  "Noah Answerth": [2028, "Unrestricted Free Agent"],
  "Darcy Wilmot": [2029, "Restricted Free Agent"],
};

export const brisbanePlayers = brisbanePlayersWithoutContractStatus.map((player) => {
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