import { createElitePlayer, createStarPlayer, createYoungPlayer, createVeteranPlayer, createPlayer } from "../engine/playerFactory.js";

// AFL player list snapshot: 6 October 2026. Positions and roster names are based on AFL club player cards.
// Potential and game tiers are gameplay estimates, not official AFL ratings.

const carltonPlayersWithoutContractStatus = [
  createYoungPlayer({
    id: 2201,
    name: "Lachlan Cowan",
    club: "Carlton",
    age: 21,
    positions: ["HB", "BP"],
    overall: 79,
    potential: 85
  }),
  createYoungPlayer({
    id: 2202,
    name: "Jesse Motlop",
    club: "Carlton",
    age: 22,
    positions: ["HF", "FF"],
    overall: 78,
    potential: 84
  }),
  createPlayer({
    id: 51336,
    name: "Joel Amartey",
    club: "Carlton",
    age: 27,
    positions: ["KPF"],
    tier: "Best22",
    potential: 84
  }),
  createYoungPlayer({
    id: 2203,
    name: "Oliver Hollands",
    club: "Carlton",
    age: 22,
    positions: ["MID", "WING"],
    overall: 77,
    potential: 84
  }),
  createPlayer({
    id: 2204,
    name: "Adam Cerra",
    club: "Carlton",
    age: 26,
    positions: ["HB", "MID"],
    overall: 82,
    potential: 83
  }),
  createYoungPlayer({
    id: 2206,
    name: "Jagga Smith",
    club: "Carlton",
    age: 20,
    positions: ["MID", "WING"],
    overall: 85,
    potential: 93
  }),
  createElitePlayer({
    id: 2208,
    name: "Patrick Cripps",
    club: "Carlton",
    age: 31,
    positions: ["MID", "WING"],
    overall: 91,
    potential: 91
  }),
  createStarPlayer({
    id: 2209,
    name: "Harry McKay",
    club: "Carlton",
    age: 28,
    positions: ["KPF"],
    overall: 85,
    potential: 86
  }),
  createPlayer({
    id: 2210,
    name: "Mitch McGovern",
    club: "Carlton",
    age: 31,
    positions: ["KPD"],
    tier: "Best22",
    overall: 81,
    potential: 81
  }),
  createPlayer({
    id: 2211,
    name: "Ben Ainsworth",
    club: "Carlton",
    age: 28,
    positions: ["HF", "FF"],
    overall: 82,
    potential: 83
  }),
  createPlayer({
    id: 2212,
    name: "Blake Acres",
    club: "Carlton",
    age: 30,
    positions: ["MID", "WING"],
    overall: 81,
    potential: 81
  }),
  createPlayer({
    id: 2213,
    name: "Oliver Florent",
    club: "Carlton",
    age: 28,
    positions: ["HB", "BP"],
    tier: "Best22",
    overall: 82,
    potential: 82
  }),
  createYoungPlayer({
    id: 2214,
    name: "Billy Wilson",
    club: "Carlton",
    age: 21,
    positions: ["HB", "BP"],
   overall: 76,
    potential: 84
  }),
  createYoungPlayer({
    id: 2215,
    name: "Ben Camporeale",
    club: "Carlton",
    age: 20,
    positions: ["MID", "WING"],
    tier: "Rookie",
    potential: 85
  }),
  createPlayer({
    id: 2216,
    name: "Brodie Kemp",
    club: "Carlton",
    age: 25,
    positions: ["KPF", "KPD"],
    overall: 81,
    potential: 83
  }),
  createStarPlayer({
    id: 2217,
    name: "Sam Walsh",
    club: "Carlton",
    age: 26,
    positions: ["MID", "WING"],
    overall: 89,
    potential: 91
  }),
  createPlayer({
    id: 2218,
    name: "Will Hayward",
    club: "Carlton",
    age: 27,
    positions: ["HF", "FF"],
    tier: "Best22",
    overall: 83,
    potential: 84
  }),
  createYoungPlayer({
    id: 2220,
    name: "Lucas Camporeale",
    club: "Carlton",
    age: 20,
    positions: ["MID", "WING"],
    tier: "Rookie",
    potential: 83
  }),
  createYoungPlayer({
    id: 2221,
    name: "Harry O'Farrell",
    club: "Carlton",
    age: 20,
    positions: ["HB", "BP"],
    tier: "Rookie",
    potential: 82
  }),
  createStarPlayer({
    id: 2222,
    name: "Jacob Weitering",
    club: "Carlton",
    age: 28,
    positions: ["KPD"],
    overall: 90,
    potential: 90
  }),
  createPlayer({
    id: 2223,
    name: "Nic Newman",
    club: "Carlton",
    age: 33,
    positions: ["HB", "BP"],
    overall: 83,
    potential: 83
  }),
  createPlayer({
    id: 2224,
    name: "Liam Reidy",
    club: "Carlton",
    age: 26,
    positions: ["RUC"],
    tier: "Depth",
    potential: 81
  }),
  createPlayer({
    id: 2225,
    name: "Nick Haynes",
    club: "Carlton",
    age: 34,
    positions: ["HB", "BP"],
    overall: 80,
    potential: 80
  }),
  createPlayer({
    id: 2226,
    name: "Marc Pittonet",
    club: "Carlton",
    age: 30,
    positions: ["RUC"],
    overall: 82,
    potential: 82
  }),
  createYoungPlayer({
    id: 2227,
    name: "Harry Charleson",
    club: "Carlton",
    age: 20,
    positions: ["HB", "BP"],
    tier: "Rookie",
    potential: 79
  }),
  createPlayer({
    id: 2228,
    name: "George Hewett",
    club: "Carlton",
    age: 30,
    positions: ["MID", "WING"],
    overall: 83,
    potential: 83
  }),
  createYoungPlayer({
    id: 2229,
    name: "Jack Ison",
    club: "Carlton",
    age: 19,
    positions: ["HF", "FF"],
    overall: 74,
    potential: 84
  }),
  createPlayer({
    id: 50606,
    name: "Lachie Whitfield",
    club: "Carlton",
    age: 32,
    positions: ["HB", "BP"],
    overall: 84,
    potential: 84
  }),
  createPlayer({
    id: 2230,
    name: "Campbell Chesser",
    club: "Carlton",
    age: 23,
    positions: ["MID", "WING"],
    tier: "Depth",
    overall: 74,
    potential: 81
  }),
  createYoungPlayer({
    id: 2231,
    name: "Matthew Carroll",
    club: "Carlton",
    age: 20,
    positions: ["MID", "WING"],
    tier: "Rookie",
    potential: 83
  }),
  createPlayer({
    id: 2232,
    name: "Lewis Young",
    club: "Carlton",
    age: 27,
    positions: ["KPD"],
    tier: "Depth",
    potential: 77
  }),
  createYoungPlayer({
    id: 2233,
    name: "Rob Monahan",
    club: "Carlton",
    age: 22,
    positions: ["HB", "BP"],
    tier: "Rookie",
    potential: 78
  }),
  createYoungPlayer({
    id: 2234,
    name: "Harry Dean",
    club: "Carlton",
    age: 18,
    positions: ["KPD"],
    overall: 85,
    potential: 92
  }),
  createYoungPlayer({
    id: 2235,
    name: "Cooper Lord",
    club: "Carlton",
    age: 21,
    positions: ["MID", "WING"],
    overall: 77,
    potential: 84
  }),

  createYoungPlayer({
    id: 2238,
    name: "Talor Byrne",
    club: "Carlton",
    age: 18,
    positions: ["HF", "FF"],
    overall: 78,
    potential: 86
  }),

  createYoungPlayer({
    id: 2240,
    name: "Matt Duffy",
    club: "Carlton",
    age: 22,
    positions: ["HB", "BP"],
    tier: "Rookie",
    potential: 80
  }),
  createPlayer({
    id: 2241,
    name: "Adam Saad",
    club: "Carlton",
    age: 32,
    positions: ["HB", "BP"],
    tier: "Depth",
    potential: 80
  }),
  createYoungPlayer({
    id: 2242,
    name: "Ashton Moir",
    club: "Carlton",
    age: 21,
    positions: ["HF", "FF"],
    tier: "Rookie",
    potential: 84
  }),
  createPlayer({
    id: 2243,
    name: "Francis Evans",
    club: "Carlton",
    age: 25,
    positions: ["HF", "FF"],
    overall: 79,
    potential: 82
  }),
  createPlayer({
    id: 2244,
    name: "Flynn Young",
    club: "Carlton",
    age: 24,
    positions: ["HF", "FF"],
    tier: "Depth",
    potential: 81
  }),
  createPlayer({
    id: 2245,
    name: "Matthew Cottrell",
    club: "Carlton",
    age: 26,
    positions: ["HF", "FF"],
    tier: "Depth",
    potential: 83
  }),
  createPlayer({
    id: 2246,
    name: "Wade Derksen",
    club: "Carlton",
    age: 25,
    positions: ["HB", "BP"],
    tier: "Depth",
    potential: 79
  })
];

// Final contract years and free-agency statuses are transcribed from AFL Contracts.docx.
// Players without a source entry have no known final year or remaining term.
const contractDetails = {
  "Lachlan Cowan": [2028, "Non-Free Agent"],
  "Jesse Motlop": [2027, "Non-Free Agent"],
  "Joel Amartey": [2031, "Unrestricted Free Agent"],
  "Oliver Hollands": [2029, "Non-Free Agent"],
  "Adam Cerra": [2030, "Restricted Free Agent"],
  "Jagga Smith": [2030, "Non-Free Agent"],
  "Patrick Cripps": [2027, "Unrestricted Free Agent"],
  "Harry McKay": [2030, "Unrestricted Free Agent"],
  "Mitch McGovern": [2027, "Restricted Free Agent"],
  "Ben Ainsworth": [2029, "Unrestricted Free Agent"],
  "Blake Acres": [2027, "Non-Free Agent"],
  "Oliver Florent": [2030, "Unrestricted Free Agent"],
  "Billy Wilson": [2028, "Non-Free Agent"],
  "Brodie Kemp": [2027, "Restricted Free Agent"],
  "Sam Walsh": [2034, "Unrestricted Free Agent"],
  "Will Hayward": [2030, "Unrestricted Free Agent"],
  "Harry O": [2027, "Non-Free Agent"],
  "Jacob Weitering": [2031, "Unrestricted Free Agent"],
  "Nic Newman": [2027, "Restricted Free Agent"],
  "Liam Reidy": [2028, "Non-Free Agent"],
  "Nick Haynes": [2027, "Unrestricted Free Agent"],
  "Marc Pittonet": [2027, "Restricted Free Agent"],
  "George Hewett": [2027, "Non-Free Agent"],
  "Jack Ison": [2028, "Non-Free Agent"],
  "Campbell Chesser": [2027, "Non-Free Agent"],
  "Matthew Carroll": [2027, "Unrestricted Free Agent"],
  "Lachie Whitfield": [2029, "Unrestricted Free Agent"],
  "Rob Monahan": [2026, "Non-Free Agent"],
  "Harry Dean": [2028, "Unknown"],
  "Cooper Lord": [2029, "Non-Free Agent"],
  "Talor Byrne": [2028, "Non-Free Agent"],
  "Adam Saad": [2027, "Non-Free Agent"],
  "Ashton Moir": [2027, "Non-Free Agent"],
  "Francis Evans": [2028, "Unrestricted Free Agent"],
  "Matthew Cottrell": [2027, "Unrestricted Free Agent"],
  "Wade Derksen": [2028, "Unrestricted Free Agent"],
};

export const carltonPlayers = carltonPlayersWithoutContractStatus.map((player) => {
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