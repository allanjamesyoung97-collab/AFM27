import { createElitePlayer, createStarPlayer, createYoungPlayer, createVeteranPlayer, createPlayer } from "../engine/playerFactory.js";

// AFL player list snapshot: 6 October 2026. Positions and roster names are based on AFL club player cards.
// Potential and game tiers are gameplay estimates, not official AFL ratings.

const fremantlePlayersWithoutContractStatus = [
  createPlayer({
    id: 50302,
    name: "Jaeger O'Meara",
    club: "Fremantle",
    age: 32,
    positions: ["MID", "WING"],
    tier: "Best22",
    overall: 80,
    potential: 80
  }),
  createElitePlayer({
    id: 50303,
    name: "Caleb Serong",
    club: "Fremantle",
    age: 25,
    positions: ["MID", "WING"],
    overall: 90,
    potential: 93
  }),
  createPlayer({
    id: 50304,
    name: "Sean Darcy",
    club: "Fremantle",
    age: 28,
    positions: ["RUC"],
    overall: 79,
    potential: 80
  }),
  createPlayer({
    id: 50305,
    name: "Heath Chapman",
    club: "Fremantle",
    age: 24,
    positions: ["KPD"],
    tier: "Best22",
    potential: 86
  }),
  createPlayer({
    id: 50306,
    name: "Jordan Clark",
    club: "Fremantle",
    age: 25,
    positions: ["HB", "BP"],
    tier: "Best22",
    overall: 84,
    potential: 86
  }),
  createStarPlayer({
    id: 50307,
    name: "Andrew Brayshaw",
    club: "Fremantle",
    age: 26,
    positions: ["MID", "WING"],
    overall: 88,
    potential: 90
  }),
  createStarPlayer({
    id: 50308,
    name: "Luke Jackson",
    club: "Fremantle",
    age: 25,
    positions: ["RUC"],
    overall: 90,
    potential: 91
  }),
  createStarPlayer({
    id: 50309,
    name: "Shai Bolton",
    club: "Fremantle",
    age: 27,
    positions: ["MID", "WING"],
    overall: 87,
    potential: 91
  }),
  createYoungPlayer({
    id: 50310,
    name: "Tobyn Murray",
    club: "Fremantle",
    age: 21,
    positions: ["HF", "FF"],
    tier: "Rookie",
    potential: 82
  }),
  createYoungPlayer({
    id: 50311,
    name: "Hugh Davies",
    club: "Fremantle",
    age: 22,
    positions: ["KPD"],
    tier: "Rookie",
    potential: 81
  }),
  createPlayer({
    id: 50312,
    name: "Luke Ryan",
    club: "Fremantle",
    age: 30,
    positions: ["HB", "BP"],
    tier: "Best22",
    potential: 82
  }),
  createPlayer({
    id: 50313,
    name: "Jeremy Sharp",
    club: "Fremantle",
    age: 25,
    positions: ["MID", "WING"],
    tier: "Best22",
    overall: 77,
    potential: 80
  }),
  createYoungPlayer({
    id: 50314,
    name: "Adam Sweid",
    club: "Fremantle",
    age: 19,
    positions: ["MID", "WING"],
    tier: "Rookie",
    potential: 81
  }),
  createStarPlayer({
    id: 50315,
    name: "Murphy Reid",
    club: "Fremantle",
    age: 20,
    positions: ["HF", "FF"],
    tier: "Rookie",
    overall: 84,
    potential: 89
  }),
  createPlayer({
    id: 50316,
    name: "Judd McVee",
    club: "Fremantle",
    age: 23,
    positions: ["HB", "BP"],
    overall: 81,
    potential: 87
  }),
  createVeteranPlayer({
    id: 50317,
    name: "Mason Cox",
    club: "Fremantle",
    age: 35,
    overall: 77,
    positions: ["RUC"]
  }),
  createYoungPlayer({
    id: 50318,
    name: "Leon Kickett",
    club: "Fremantle",
    age: 19,
    positions: ["HF", "FF"],
    tier: "Rookie",
    potential: 82
  }),
  createPlayer({
    id: 50319,
    name: "Patrick Voss",
    club: "Fremantle",
    age: 23,
    positions: ["KPF"],
    overall: 84,
    potential: 88
  }),
  createPlayer({
    id: 50320,
    name: "Oscar McDonald",
    club: "Fremantle",
    age: 30,
    positions: ["KPD"],
    tier: "Best22",
    potential: 82
  }),
  createYoungPlayer({
    id: 50321,
    name: "Charlie Nicholls",
    club: "Fremantle",
    age: 20,
    positions: ["KPF"],
    tier: "Rookie",
    potential: 83
  }),
  createPlayer({
    id: 50322,
    name: "Karl Worner",
    club: "Fremantle",
    age: 24,
    positions: ["HB", "BP"],
    overall: 81,
    potential: 86
  }),
  createPlayer({
    id: 50323,
    name: "Jye Amiss",
    club: "Fremantle",
    age: 23,
    positions: ["KPF"],
    overall: 86,
    potential: 89
  }),
  createStarPlayer({
    id: 50324,
    name: "Alex Pearce",
    club: "Fremantle",
    age: 31,
    positions: ["KPD"],
    overall: 88,
    potential: 88
  }),
  createStarPlayer({
    id: 50325,
    name: "Hayden Young",
    club: "Fremantle",
    age: 25,
    positions: ["MID", "WING"],
    overall: 89,
    potential: 91
  }),
  createYoungPlayer({
    id: 50326,
    name: "Toby Whan",
    club: "Fremantle",
    age: 19,
    positions: ["MID", "WING"],
    tier: "Rookie",
    potential: 79
  }),
  createYoungPlayer({
    id: 50327,
    name: "Neil Erasmus",
    club: "Fremantle",
    age: 22,
    positions: ["MID", "WING"],
    overall: 78,
    potential: 81
  }),
  createYoungPlayer({
    id: 50328,
    name: "Cooper Simpson",
    club: "Fremantle",
    age: 21,
    positions: ["HB", "BP"],
    tier: "Rookie",
    potential: 82
  }),
  createPlayer({
    id: 50329,
    name: "Nathan O'Driscoll",
    club: "Fremantle",
    age: 24,
    positions: ["MID", "WING"],
    overall: 76,
    potential: 86
  }),
  createPlayer({
    id: 50330,
    name: "Brandon Walker",
    club: "Fremantle",
    age: 23,
    positions: ["HB", "BP"],
    tier: "Depth",
    potential: 84
  }),
  createPlayer({
    id: 50331,
    name: "Michael Frederick",
    club: "Fremantle",
    age: 26,
    positions: ["HF", "FF"],
    overall: 81,
    potential: 85
  }),
  createYoungPlayer({
    id: 50332,
    name: "Ollie Murphy",
    club: "Fremantle",
    age: 21,
    positions: ["KPD"],
    tier: "Rookie",
    potential: 82
  }),
  createPlayer({
    id: 50333,
    name: "Corey Wagner",
    club: "Fremantle",
    age: 29,
    positions: ["MID", "WING"],
    overall: 76,
    potential: 82
  }),
  createStarPlayer({
    id: 50334,
    name: "Josh Treacy",
    club: "Fremantle",
    age: 24,
    positions: ["KPF"],
    overall: 87,
    potential: 89
  }),
  createPlayer({
    id: 50335,
    name: "Brennan Cox",
    club: "Fremantle",
    age: 28,
    positions: ["KPD"],
    overall: 84,
    potential: 84
  }),
  createYoungPlayer({
    id: 50336,
    name: "Joshua Draper",
    club: "Fremantle",
    age: 22,
    positions: ["KPD"],
    tier: "Rookie",
    potential: 81
  }),
  createYoungPlayer({
    id: 50337,
    name: "Jaren Carr",
    club: "Fremantle",
    age: 22,
    positions: ["MID", "WING"],
    tier: "Rookie",
    potential: 81
  }),
  createYoungPlayer({
    id: 50339,
    name: "Ryda Luke",
    club: "Fremantle",
    age: 19,
    positions: ["HF", "FF"],
    tier: "Rookie",
    potential: 84
  }),
  createPlayer({
    id: 50340,
    name: "Bailey Banfield",
    club: "Fremantle",
    age: 28,
    positions: ["HB", "BP"],
    tier: "Depth",
    potential: 83
  }),
  createYoungPlayer({
    id: 50341,
    name: "Aiden Riddle",
    club: "Fremantle",
    age: 20,
    positions: ["RUC"],
    tier: "Rookie",
    potential: 83
  }),
  createPlayer({
    id: 50342,
    name: "Isaiah Dudley",
    club: "Fremantle",
    age: 23,
    positions: ["HF", "FF"],
    overall: 82,
    potential: 85
  }),
  createPlayer({
    id: 50343,
    name: "Matthew Johnson",
    club: "Fremantle",
    age: 23,
    positions: ["MID", "WING"],
    overall: 81,
    potential: 87
  }),
  createYoungPlayer({
    id: 50344,
    name: "Christopher Scerri",
    club: "Fremantle",
    age: 20,
    positions: ["HF", "FF"],
    tier: "Rookie",
    potential: 83
  }),
  createPlayer({
    id: 50345,
    name: "Dominic Bedendo",
    club: "Fremantle",
    age: 24,
    positions: ["WING"],
    tier: "Depth",
    overall: 66,
    potential: 70
  })
];

// Final contract years and free-agency statuses are transcribed from AFL Contracts.docx.
// Players without a source entry have no known final year or remaining term.
const contractDetails = {
  "Dominic Bedendo": [2028, "Non-Free Agent"],
  "Jaeger O": [2027, "Non-Free Agent"],
  "Caleb Serong": [2034, "Unrestricted Free Agent"],
  "Sean Darcy": [2030, "Unrestricted Free Agent"],
  "Heath Chapman": [2027, "Non-Free Agent"],
  "Jordan Clark": [2028, "Non-Free Agent"],
  "Andrew Brayshaw": [2031, "Unrestricted Free Agent"],
  "Luke Jackson": [2029, "Non-Free Agent"],
  "Shai Bolton": [2029, "Non-Free Agent"],
  "Tobyn Murray": [2027, "Unknown"],
  "Hugh Davies": [2029, "Non-Free Agent"],
  "Luke Ryan": [2027, "Unrestricted Free Agent"],
  "Jeremy Sharp": [2027, "Unrestricted Free Agent"],
  "Adam Sweid": [2028, "Non-Free Agent"],
  "Murphy Reid": [2032, "Restricted Free Agent"],
  "Judd McVee": [2030, "Non-Free Agent"],
  "Mason Cox": [2027, "Unrestricted Free Agent"],
  "Leon Kickett": [2027, "Non-Free Agent"],
  "Patrick Voss": [2030, "Unrestricted Free Agent"],
  "Oscar McDonald": [2027, "Unrestricted Free Agent"],
  "Charlie Nicholls": [2027, "Non-Free Agent"],
  "Karl Worner": [2027, "Non-Free Agent"],
  "Jye Amiss": [2029, "Restricted Free Agent"],
  "Alex Pearce": [2027, "Unrestricted Free Agent"],
  "Hayden Young": [2033, "Unrestricted Free Agent"],
  "Toby Whan": [2028, "Non-Free Agent"],
  "Neil Erasmus": [2028, "Non-Free Agent"],
  "Cooper Simpson": [2027, "Non-Free Agent"],
  "Nathan O": [2026, "Non-Free Agent"],
  "Brandon Walker": [2027, "Non-Free Agent"],
  "Michael Frederick": [2029, "Unrestricted Free Agent"],
  "Corey Wagner": [2028, "Unrestricted Free Agent"],
  "Josh Treacy": [2030, "Unrestricted Free Agent"],
  "Brennan Cox": [2030, "Unrestricted Free Agent"],
  "Joshua Draper": [2027, "Non-Free Agent"],
  "Jaren Carr": [2026, "Non-Free Agent"],
  "Aiden Riddle": [2028, "Non-Free Agent"],
  "Isaiah Dudley": [2029, "Non-Free Agent"],
  "Matthew Johnson": [2030, "Restricted Free Agent"],
  "Christopher Scerri": [2028, "Non-Free Agent"],
};

export const fremantlePlayers = fremantlePlayersWithoutContractStatus.map((player) => {
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
