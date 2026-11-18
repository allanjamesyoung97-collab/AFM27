import { createElitePlayer, createStarPlayer, createYoungPlayer, createVeteranPlayer, createPlayer } from "../engine/playerFactory.js";

// AFL player list snapshot: 6 October 2026. Positions and roster names are based on AFL club player cards.
// Potential and game tiers are gameplay estimates, not official AFL ratings.

const melbournePlayersWithoutContractStatus = [
  createPlayer({
    id: 50802,
    name: "Jacob van Rooyen",
    club: "Melbourne",
    age: 23,
    positions: ["KPF"],
    tier: "Best22",
    overall: 84,
    potential: 87
  }),
  createPlayer({
    id: 50803,
    name: "Christian Salem",
    club: "Melbourne",
    age: 31,
    positions: ["HB", "BP"],
    tier: "Best22",
    overall: 80,
    potential: 81
  }),
  createYoungPlayer({
    id: 50804,
    name: "Harvey Langford",
    club: "Melbourne",
    age: 20,
    positions: ["MID", "WING"],
    tier: "Rookie",
    overall: 82,
    potential: 88
  }),
  createYoungPlayer({
    id: 50805,
    name: "Xavier Lindsay",
    club: "Melbourne",
    age: 20,
    positions: ["HB", "BP"],
    tier: "Rookie",
    potential: 85
  }),
  createYoungPlayer({
    id: 50806,
    name: "Caleb Windsor",
    club: "Melbourne",
    age: 21,
    positions: ["MID", "WING"],
    tier: "Rookie",
    overall: 80,
    potential: 88
  }),
  createPlayer({
    id: 50807,
    name: "Jack Viney",
    club: "Melbourne",
    age: 32,
    positions: ["MID", "WING"],
    tier: "Best22",
    overall: 81,
    potential: 80
  }),
  createPlayer({
    id: 50808,
    name: "Jake Lever",
    club: "Melbourne",
    age: 30,
    positions: ["KPD"],
    tier: "Best22",
    potential: 85
  }),
  createPlayer({
    id: 50809,
    name: "Jack Steele",
    club: "Melbourne",
    age: 30,
    positions: ["MID", "WING"],
    tier: "Best22",
    overall: 84,
    potential: 84
  }),
  createPlayer({
    id: 50810,
    name: "Daniel Turner",
    club: "Melbourne",
    age: 24,
    positions: ["KPD"],
    tier: "Best22",
    overall: 81,
    potential: 86
  }),
  createElitePlayer({
    id: 50811,
    name: "Max Gawn",
    club: "Melbourne",
    age: 33,
    positions: ["RUC"],
    potential: 95
  }),
  createYoungPlayer({
    id: 50812,
    name: "Koltyn Tholstrup",
    club: "Melbourne",
    age: 21,
    positions: ["HB", "BP"],
    tier: "Rookie",
    overall: 78,
    potential: 84
  }),
  createPlayer({
    id: 50813,
    name: "Jai Culley",
    club: "Melbourne",
    age: 23,
    positions: ["MID", "WING"],
    tier: "Best22",
    potential: 85
  }),
  createPlayer({
    id: 50814,
    name: "Changkuoth Jiath",
    club: "Melbourne",
    age: 27,
    positions: ["HB", "BP"],
    tier: "Best22",
    overall: 80,
    potential: 84
  }),
  createPlayer({
    id: 50815,
    name: "Ed Langdon",
    club: "Melbourne",
    age: 30,
    positions: ["MID", "WING"],
    tier: "Best22",
    overall: 80,
    potential: 82
  }),
  createPlayer({
    id: 50816,
    name: "Bailey Laurie",
    club: "Melbourne",
    age: 24,
    positions: ["HF", "FF"],
    tier: "Best22",
    overall: 81,
    potential: 83
  }),
  createPlayer({
    id: 50817,
    name: "Jake Bowey",
    club: "Melbourne",
    age: 24,
    positions: ["HB", "BP"],
    tier: "Best22",
    overall: 84,
    potential: 86
  }),
  createYoungPlayer({
    id: 50819,
    name: "Xavier Taylor",
    club: "Melbourne",
    age: 19,
    positions: ["HB", "BP"],
    tier: "Rookie",
    potential: 81
  }),
  createYoungPlayer({
    id: 50820,
    name: "Thomas Matthews",
    club: "Melbourne",
    age: 19,
    positions: ["HF", "FF"],
    tier: "Rookie",
    potential: 78
  }),
  createYoungPlayer({
    id: 50821,
    name: "Matthew Jefferson",
    club: "Melbourne",
    age: 22,
    positions: ["KPF"],
    tier: "Rookie",
    potential: 81
  }),
  createPlayer({
    id: 50822,
    name: "Blake Howes",
    club: "Melbourne",
    age: 23,
    positions: ["HB", "BP"],
    tier: "Best22",
    overall: 76,
    potential: 84
  }),
  createPlayer({
    id: 50824,
    name: "Trent Rivers",
    club: "Melbourne",
    age: 25,
    positions: ["HB", "BP"],
    tier: "Best22",
    potential: 86
  }),
  createYoungPlayer({
    id: 50826,
    name: "Jed Adams",
    club: "Melbourne",
    age: 22,
    positions: ["KPD"],
    tier: "Rookie",
    potential: 81
  }),
  createPlayer({
    id: 50827,
    name: "Max Heath",
    club: "Melbourne",
    age: 23,
    positions: ["RUC"],
    overall: 71,
    potential: 76
  }),
  createPlayer({
    id: 50828,
    name: "Brody Mihocek",
    club: "Melbourne",
    age: 33,
    positions: ["HF", "FF"],
    tier: "Depth",
    overall: 80,
    potential: 80
  }),
  createPlayer({
    id: 50830,
    name: "Harry Sharp",
    club: "Melbourne",
    age: 23,
    positions: ["HF", "FF"],
    tier: "Depth",
    potential: 87
  }),
  createPlayer({
    id: 50831,
    name: "Bayley Fritsch",
    club: "Melbourne",
    age: 29,
    positions: ["HF", "FF"],
    tier: "Depth",
    overall: 82,
    potential: 83
  }),
  createPlayer({
    id: 50832,
    name: "Tom Sparrow",
    club: "Melbourne",
    age: 26,
    positions: ["MID", "WING"],
overall: 81,
    potential: 81
  }),
  createYoungPlayer({
    id: 50833,
    name: "Latrelle Pickett",
    club: "Melbourne",
    age: 20,
    positions: ["HF", "FF"],
    tier: "Rookie",
    potential: 83
  }),
  createYoungPlayer({
    id: 50834,
    name: "Kalani White",
    club: "Melbourne",
    age: 19,
    positions: ["KPF"],
    tier: "Rookie",
    potential: 79
  }),
  createPlayer({
    id: 50835,
    name: "Harrison Petty",
    club: "Melbourne",
    age: 26,
    positions: ["KPF"],
    overall: 81,
    potential: 83
  }),
  createStarPlayer({
    id: 50836,
    name: "Kysaiah Pickett",
    club: "Melbourne",
    age: 25,
    positions: ["MID", "HF", "WING"],
    potential: 91
  }),
  createPlayer({
    id: 50837,
    name: "Kade Chandler",
    club: "Melbourne",
    age: 26,
    positions: ["HF", "FF"],
    tier: "Depth",
    overall: 82,
    potential: 85
  }),
  createPlayer({
    id: 50838,
    name: "Oscar Berry",
    club: "Melbourne",
    age: 24,
    positions: ["KPD"],
    tier: "Depth",
    potential: 80
  }),
  createYoungPlayer({
    id: 50839,
    name: "Ricky Mentha",
    club: "Melbourne",
    age: 20,
    positions: ["HB", "BP"],
    tier: "Rookie",
    potential: 80
  }),
  createYoungPlayer({
    id: 50840,
    name: "Riley Onley",
    club: "Melbourne",
    age: 19,
    positions: ["KPD"],
    tier: "Rookie",
    potential: 80
  }),
  createPlayer({
    id: 50841,
    name: "Paddy Cross",
    club: "Melbourne",
    age: 23,
    positions: ["MID", "WING"],
    tier: "Depth",
    potential: 81
  }),
  createPlayer({
    id: 50842,
    name: "Aidan Johnson",
    club: "Melbourne",
    age: 26,
    positions: ["RUC"],
    tier: "Depth",
    potential: 81
  }),
  createPlayer({
    id: 50843,
    name: "Jack Henderson",
    club: "Melbourne",
    age: 27,
    positions: ["MID", "WING"],
    tier: "Depth",
    potential: 80
  }),
  createYoungPlayer({
    id: 50844,
    name: "Luker Kentfield",
    club: "Melbourne",
    age: 21,
    positions: ["KPF"],
    tier: "Rookie",
    potential: 82
  }),
  createYoungPlayer({
    id: 50845,
    name: "Andy Moniz-Wakefield",
    club: "Melbourne",
    age: 22,
    positions: ["HF", "FF"],
    tier: "Rookie",
    potential: 81
  }),
  createPlayer({
    id: 50846,
    name: "Lukas Cooke",
    club: "Melbourne",
    age: 23,
    positions: ["KPD"],
    tier: "Depth",
    potential: 80
  }),
  createPlayer({
    id: 50847,
    name: "Joel Fitzgerald",
    club: "Melbourne",
    age: 23,
    positions: ["MID", "WING"],
    tier: "Depth",
    potential: 80
  }),
  createYoungPlayer({
    id: 50848,
    name: "Max Mapley",
    club: "Melbourne",
    age: 20,
    positions: ["RUC"],
    tier: "Rookie",
    potential: 81
  })
];

// Final contract years and free-agency statuses are transcribed from AFL Contracts.docx.
// Players without a source entry have no known final year or remaining term.
const contractDetails = {
  "Jacob van Rooyen": [2029, "Restricted Free Agent"],
  "Christian Salem": [2027, "Unrestricted Free Agent"],
  "Harvey Langford": [2029, "Non-Free Agent"],
  "Xavier Lindsay": [2027, "Non-Free Agent"],
  "Caleb Windsor": [2028, "Non-Free Agent"],
  "Jack Viney": [2028, "Unrestricted Free Agent"],
  "Jake Lever": [2028, "Unrestricted Free Agent"],
  "Jack Steele": [2028, "Non-Free Agent"],
  "Daniel Turner": [2030, "Unrestricted Free Agent"],
  "Max Gawn": [2027, "Unrestricted Free Agent"],
  "Koltyn Tholstrup": [2031, "Restricted Free Agent"],
  "Jai Culley": [2028, "Unrestricted Free Agent"],
  "Changkuoth Jiath": [2028, "Non-Free Agent"],
  "Ed Langdon": [2028, "Restricted Free Agent"],
  "Bailey Laurie": [2027, "Non-Free Agent"],
  "Jake Bowey": [2028, "Restricted Free Agent"],
  "Xavier Taylor": [2028, "Unknown"],
  "Thomas Matthews": [2027, "Unknown"],
  "Matthew Jefferson": [2028, "Non-Free Agent"],
  "Blake Howes": [2027, "Non-Free Agent"],
  "Trent Rivers": [2027, "Restricted Free Agent"],
  "Jed Adams": [2027, "Non-Free Agent"],
  "Max Heath": [2028, "Non-Free Agent"],
  "Brody Mihocek": [2027, "Non-Free Agent"],
  "Harry Sharp": [2030, "Non-Free Agent"],
  "Bayley Fritsch": [2029, "Unrestricted Free Agent"],
  "Tom Sparrow": [2031, "Unrestricted Free Agent"],
  "Latrelle Pickett": [2028, "Unknown"],
  "Harrison Petty": [2027, "Unrestricted Free Agent"],
  "Kysaiah Pickett": [2034, "Unrestricted Free Agent"],
  "Kade Chandler": [2031, "Unrestricted Free Agent"],
  "Oscar Berry": [2027, "Unknown"],
  "Ricky Mentha": [2027, "Non-Free Agent"],
  "Paddy Cross": [2027, "Non-Free Agent"],
  "Luker Kentfield": [2027, "Non-Free Agent"],
  "Lukas Cooke": [2027, "Non-Free Agent"],
  "Joel Fitzgerald": [2027, "Non-Free Agent"],
  "Max Mapley": [2027, "Non-Free Agent"],
};

export const melbournePlayers = melbournePlayersWithoutContractStatus.map((player) => {
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