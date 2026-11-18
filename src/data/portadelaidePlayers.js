import { createElitePlayer, createStarPlayer, createYoungPlayer, createVeteranPlayer, createPlayer } from "../engine/playerFactory.js";

// AFL player list snapshot: 6 October 2026. Positions and roster names are based on AFL club player cards.
// Potential and game tiers are gameplay estimates, not official AFL ratings.

const portadelaidePlayersWithoutContractStatus = [
  createStarPlayer({
    id: 51001,
    name: "Connor Rozee",
    club: "Port Adelaide",
    age: 26,
    positions: ["MID", "WING", "HB"],
    overall: 85,
    potential: 91
  }),
  createPlayer({
    id: 51002,
    name: "Sam Powell-Pepper",
    club: "Port Adelaide",
    age: 28,
    positions: ["HF", "FF"],
    overall: 81,
    potential: 82
  }),
  createPlayer({
    id: 50010,
    name: "Luke Pedlar",
    club: "Port Adelaide",
    age: 24,
    positions: ["HF", "FF"],
    overall: 78,
    potential: 79
  }),
  createPlayer({
    id: 51003,
    name: "Jackson Mead",
    club: "Port Adelaide",
    age: 25,
    positions: ["MID", "WING"],
    overall: 75,
    potential: 82
  }),
  createPlayer({
    id: 51004,
    name: "Todd Marshall",
    club: "Port Adelaide",
    age: 27,
    positions: ["KPF"],
    tier: "Best22",
    potential: 82
  }),
  createYoungPlayer({
    id: 51005,
    name: "Joe Berry",
    club: "Port Adelaide",
    age: 20,
    positions: ["HF", "FF"],
    overall: 74,
    potential: 85
  }),
  createPlayer({
    id: 51006,
    name: "Kane Farrell",
    club: "Port Adelaide",
    age: 27,
    positions: ["HB", "BP"],
    overall: 83,
    potential: 86
  }),
  createPlayer({
    id: 51007,
    name: "Jase Burgoyne",
    club: "Port Adelaide",
    age: 23,
    positions: ["MID", "WING"],
    overall: 80,
    potential: 83
  }),
  createPlayer({
    id: 51008,
    name: "Josh Sinn",
    club: "Port Adelaide",
    age: 23,
    positions: ["HB", "BP"],
    overall: 74,
    potential: 82
  }),
 
  createYoungPlayer({
    id: 51010,
    name: "Christian Moraes",
    club: "Port Adelaide",
    age: 19,
    positions: ["HF", "FF"],
    tier: "Rookie",
    potential: 82
  }),
  createPlayer({
    id: 51011,
    name: "Jack Lukosius",
    club: "Port Adelaide",
    age: 26,
    positions: ["MID", "WING"],
    overall: 78,
    potential: 82
  }),
  createPlayer({
    id: 51013,
    name: "Miles Bergman",
    club: "Port Adelaide",
    age: 24,
    positions: ["HB", "BP"],
    overall: 82,
    potential: 88
  }),
  createPlayer({
    id: 51014,
    name: "Jacob Wehr",
    club: "Port Adelaide",
    age: 28,
    positions: ["MID", "WING"],
    tier: "Depth",
    potential: 83
  }),
  createPlayer({
    id: 51015,
    name: "Ollie Wines",
    club: "Port Adelaide",
    age: 31,
    positions: ["MID", "WING"],
    tier: "Best22",
    potential: 84
  }),
  createYoungPlayer({
    id: 51016,
    name: "Jack Whitlock",
    club: "Port Adelaide",
    age: 20,
    positions: ["KPF"],
    overall: 78,
    potential: 86
  }),
  createStarPlayer({
    id: 51017,
    name: "Jason Horne-Francis",
    club: "Port Adelaide",
    age: 23,
    positions: ["MID", "WING"],
    overall: 86,
    potential: 91
  }),
  createStarPlayer({
    id: 51018,
    name: "Mitch Georgiades",
    club: "Port Adelaide",
    age: 25,
    positions: ["HF", "FF"],
    overall: 86,
    potential: 88
  }),
  createPlayer({
    id: 51019,
    name: "Aliir Aliir",
    club: "Port Adelaide",
    age: 32,
    positions: ["KPD"],
    tier: "Best22",
    potential: 82
  }),
  createYoungPlayer({
    id: 51020,
    name: "Logan Evans",
    club: "Port Adelaide",
    age: 20,
    positions: ["HB", "BP"],
    overall: 77,
    potential: 84
  }),
  createPlayer({
    id: 51021,
    name: "Will Brodie",
    club: "Port Adelaide",
    age: 28,
    positions: ["MID", "WING"],
    tier: "Depth",
    potential: 83
  }),
  createPlayer({
    id: 51022,
    name: "Jordon Sweet",
    club: "Port Adelaide",
    age: 28,
    positions: ["RUC"],
    overall: 81,
    potential: 83
  }),
  createPlayer({
    id: 51023,
    name: "Brandon Zerk-Thatcher",
    club: "Port Adelaide",
    age: 28,
    positions: ["KPD"],
    tier: "Depth",
    potential: 83
  }),
  createYoungPlayer({
    id: 51024,
    name: "Tom Cochrane",
    club: "Port Adelaide",
    age: 20,
    positions: ["HF", "FF"],
    tier: "Rookie",
    potential: 83
  }),
  createPlayer({
    id: 51025,
    name: "Esava Ratugolea",
    club: "Port Adelaide",
    age: 28,
    positions: ["KPD"],
    overall: 79,
    potential: 80
  }),
  createPlayer({
    id: 51026,
    name: "Willem Drew",
    club: "Port Adelaide",
    age: 28,
    positions: ["MID", "WING"],
    tier: "Best22",
    potential: 84
  }),
  createYoungPlayer({
    id: 51027,
    name: "Tom Anastasopoulos",
    club: "Port Adelaide",
    age: 21,
    positions: ["HF", "FF"],
    tier: "Rookie",
    potential: 82
  }),
  createPlayer({
    id: 51028,
    name: "Ollie Lord",
    club: "Port Adelaide",
    age: 24,
    positions: ["KPF"],
    tier: "Depth",
    potential: 83
  }),
  createPlayer({
    id: 51029,
    name: "Ewan Mackinlay",
    club: "Port Adelaide",
    age: 23,
    positions: ["MID", "WING"],
    tier: "Depth",
    potential: 87
  }),
  createYoungPlayer({
    id: 51030,
    name: "Harrison Ramm",
    club: "Port Adelaide",
    age: 19,
    positions: ["KPD"],
    tier: "Rookie",
    potential: 84
  }),
  createPlayer({
    id: 51031,
    name: "Darcy Byrne-Jones",
    club: "Port Adelaide",
    age: 31,
    positions: ["HB", "BP"],
    overall: 79,
    potential: 79
  }),
  createPlayer({
    id: 51032,
    name: "Lachie Jones",
    club: "Port Adelaide",
    age: 24,
    positions: ["HB", "BP"],
    overall: 79,
    potential: 86
  }),
  createPlayer({
    id: 51033,
    name: "Joe Richards",
    club: "Port Adelaide",
    age: 26,
    positions: ["HF", "FF", "WING"],
    overall: 81,
    potential: 85
  }),
  createYoungPlayer({
    id: 51034,
    name: "Will Lorenz",
    club: "Port Adelaide",
    age: 21,
    positions: ["HB", "BP"],
    tier: "Rookie",
    potential: 82
  }),
  createPlayer({
    id: 51035,
    name: "Jack Watkins",
    club: "Port Adelaide",
    age: 25,
    positions: ["MID", "WING"],
    tier: "Depth",
    potential: 86
  }),
  createPlayer({
    id: 51036,
    name: "Dante Visentini",
    club: "Port Adelaide",
    age: 23,
    positions: ["RUC"],
    tier: "Depth",
    potential: 83
  }),
  createYoungPlayer({
    id: 51037,
    name: "Mitch Zadow",
    club: "Port Adelaide",
    age: 22,
    positions: ["HF", "FF"],
    tier: "Rookie",
    potential: 81
  }),
  createYoungPlayer({
    id: 51038,
    name: "Benny Barrett",
    club: "Port Adelaide",
    age: 20,
    positions: ["HF", "FF"],
    tier: "Rookie",
    potential: 83
  }),
  createYoungPlayer({
    id: 51039,
    name: "Balyn O'Brien",
    club: "Port Adelaide",
    age: 19,
    positions: ["HB", "BP"],
    tier: "Rookie",
    potential: 82
  }),
  createYoungPlayer({
    id: 51040,
    name: "Jacob Moss",
    club: "Port Adelaide",
    age: 21,
    positions: ["KPF"],
    tier: "Rookie",
    potential: 82
  }),
  createYoungPlayer({
    id: 51041,
    name: "Josh Lai",
    club: "Port Adelaide",
    age: 21,
    positions: ["HB", "BP"],
    tier: "Rookie",
    potential: 82
  }),
  createPlayer({
    id: 51042,
    name: "Corey Durdin",
    club: "Port Adelaide",
    age: 24,
    positions: ["HF", "FF"],
    overall: 78,
    potential: 81
  }),
  createYoungPlayer({
    id: 51043,
    name: "Xavier Walsh",
    club: "Port Adelaide",
    age: 21,
    positions: ["KPF"],
    tier: "Rookie",
    potential: 82
  }),
  createYoungPlayer({
    id: 51044,
    name: "Xavier Bamert",
    club: "Port Adelaide",
    age: 19,
    positions: ["HF", "FF"],
    tier: "Rookie",
    potential: 81
  }),
  createYoungPlayer({
    id: 51045,
    name: "Alex Van Wyk",
    club: "Port Adelaide",
    age: 22,
    positions: ["RUC"],
    tier: "Rookie",
    potential: 81
  }),
  createPlayer({
    id: 51046,
    name: "Mani Liddy",
    club: "Port Adelaide",
    age: 24,
    positions: ["MID", "WING"],
    tier: "Depth",
    potential: 83
  })
];

// Final contract years and free-agency statuses are transcribed from AFL Contracts.docx.
// Players without a source entry have no known final year or remaining term.
const contractDetails = {
  "Connor Rozee": [2032, "Unrestricted Free Agent"],
  "Sam Powell-Pepper": [2029, "Unrestricted Free Agent"],
  "Todd Marshall": [2029, "Unrestricted Free Agent"],
  "Joe Berry": [2027, "Non-Free Agent"],
  "Kane Farrell": [2030, "Unrestricted Free Agent"],
  "Jase Burgoyne": [2029, "Restricted Free Agent"],
  "Josh Sinn": [2027, "Non-Free Agent"],
  "Christian Moraes": [2027, "Non-Free Agent"],
  "Jack Lukosius": [2030, "Non-Free Agent"],
  "Miles Bergman": [2027, "Restricted Free Agent"],
  "Jacob Wehr": [2028, "Unrestricted Free Agent"],
  "Ollie Wines": [2027, "Unrestricted Free Agent"],
  "Luke Pedlar": [2028, "Non-Free Agent"],
  "Jack Whitlock": [2032, "Restricted Free Agent"],
  "Jason Horne-Francis": [2028, "Non-Free Agent"],
  "Mitch Georgiades": [2029, "Unrestricted Free Agent"],
  "Aliir Aliir": [2027, "Non-Free Agent"],
  "Logan Evans": [2028, "Non-Free Agent"],
  "Will Brodie": [2027, "Non-Free Agent"],
  "Jordon Sweet": [2030, "Non-Free Agent"],
  "Brandon Zerk-Thatcher": [2029, "Non-Free Agent"],
  "Tom Cochrane": [2027, "Non-Free Agent"],
  "Esava Ratugolea": [2028, "Non-Free Agent"],
  "Willem Drew": [2028, "Unrestricted Free Agent"],
  "Tom Anastasopoulos": [2026, "Non-Free Agent"],
  "Ollie Lord": [2026, "Non-Free Agent"],
  "Ewan Mackinlay": [2028, "Non-Free Agent"],
  "Harrison Ramm": [2027, "Non-Free Agent"],
  "Darcy Byrne-Jones": [2027, "Unrestricted Free Agent"],
  "Lachie Jones": [2028, "Restricted Free Agent"],
  "Joe Richards": [2027, "Non-Free Agent"],
  "Jack Watkins": [2027, "Non-Free Agent"],
  "Dante Visentini": [2027, "Non-Free Agent"],
  "Mitch Zadow": [2027, "Non-Free Agent"],
  "Balyn O": [2027, "Non-Free Agent"],
  "Josh Lai": [2027, "Non-Free Agent"],
  "Corey Durdin": [2027, "Non-Free Agent"],
  "Xavier Bamert": [2026, "Unknown"],
  "Alex Van Wyk": [2027, "Non-Free Agent"],
};

export const portadelaidePlayers = portadelaidePlayersWithoutContractStatus.map((player) => {
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