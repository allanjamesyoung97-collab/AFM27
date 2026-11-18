import { createElitePlayer, createStarPlayer, createYoungPlayer, createVeteranPlayer, createPlayer } from "../engine/playerFactory.js";

// AFL player list snapshot: 6 October 2026. Positions and roster names are based on AFL club player cards.
// Potential and game tiers are gameplay estimates, not official AFL ratings.

const gwsgiantsPlayersWithoutContractStatus = [
  createYoungPlayer({
    id: 50601,
    name: "Harvey Thomas",
    club: "GWS",
    age: 21,
    positions: ["MID", "WING", "HF"],
    overall: 80,
    potential: 85
  }),
  createYoungPlayer({
    id: 50602,
    name: "Darcy Jones",
    club: "GWS",
    age: 22,
    positions: ["HF", "FF"],
    tier: "Rookie",
    potential: 84
  }),
  createPlayer({
    id: 50603,
    name: "Stephen Coniglio",
    club: "GWS",
    age: 32,
    positions: ["MID", "WING"],
    tier: "Best22",
    potential: 82
  }),
  createYoungPlayer({
    id: 50605,
    name: "Aaron Cadman",
    club: "GWS",
    age: 22,
    positions: ["KPF"],
    overall: 81,
    potential: 86
  }),

  createPlayer({
    id: 50607,
    name: "Lachie Ash",
    club: "GWS",
    age: 25,
    positions: ["HB", "BP"],
    overall: 87,
    potential: 89
  }),
  createPlayer({
    id: 50608,
    name: "Ryan Angwin",
    club: "GWS",
    age: 23,
    positions: ["MID", "WING"],
    overall: 77,
    potential: 84
  }),
  createStarPlayer({
    id: 50609,
    name: "Clayton Oliver",
    club: "GWS",
    age: 29,
    positions: ["MID", "WING"],
    overall: 89,
    potential: 89
  }),
  createYoungPlayer({
    id: 50610,
    name: "Phoenix Gothard",
    club: "GWS",
    age: 21,
    positions: ["HF", "FF"],
    tier: "Rookie",
    potential: 82
  }),
  createPlayer({
    id: 50611,
    name: "Tom Green",
    club: "GWS",
    age: 25,
    positions: ["MID", "WING"],
    overall: 90,
    potential: 92
  }),
  createYoungPlayer({
    id: 50612,
    name: "Oliver Hannaford",
    club: "GWS",
    age: 20,
    positions: ["HF", "FF"],
    tier: "Rookie",
    potential: 78
  }),
  createPlayer({
    id: 50613,
    name: "Toby Bedford",
    club: "GWS",
    age: 26,
    positions: ["MID", "WING"],
    overall: 82,
    potential: 85
  }),
  createElitePlayer({
    id: 50614,
    name: "Sam Taylor",
    club: "GWS",
    age: 27,
    positions: ["KPD"],
    tier: "Best22",
    overall: 90,
    potential: 91
  }),
  createPlayer({
    id: 50615,
    name: "Brent Daniels",
    club: "GWS",
    age: 27,
    positions: ["MID", "WING"],
    tier: "Best22",
    potential: 84
  }),
  createStarPlayer({
    id: 50616,
    name: "Finn Callaghan",
    club: "GWS",
    age: 23,
    positions: ["MID", "WING"],
    tier: "Best22",
    potential: 89
  }),
  createPlayer({
    id: 50617,
    name: "Conor Stone",
    club: "GWS",
    age: 24,
    positions: ["MID", "WING"],
    overall: 79,
    potential: 86
  }),
  createYoungPlayer({
    id: 50618,
    name: "Harrison Oliver",
    club: "GWS",
    age: 20,
    positions: ["HB", "BP"],
    tier: "Rookie",
    potential: 83
  }),
  createPlayer({
    id: 50619,
    name: "Jake Stringer",
    club: "GWS",
    age: 32,
    positions: ["HF", "FF"],
    tier: "Best22",
    potential: 83
  }),
  createPlayer({
    id: 50620,
    name: "Leek Aleer",
    club: "GWS",
    age: 25,
    positions: ["KPD"],
    overall: 79,
    potential: 83
  }),
  createPlayer({
    id: 50621,
    name: "Josh Kelly",
    club: "GWS",
    age: 31,
    positions: ["MID", "WING"],
    tier: "Best22",
    potential: 84
  }),

  createYoungPlayer({
    id: 50623,
    name: "Harry Rowston",
    club: "GWS",
    age: 22,
    positions: ["MID", "WING"],
    tier: "Rookie",
    potential: 81
  }),
  createPlayer({
    id: 50624,
    name: "Jayden Laverde",
    club: "GWS",
    age: 30,
    positions: ["KPD"],
    tier: "Depth",
    potential: 82
  }),
  createPlayer({
    id: 50625,
    name: "Jake Riccardi",
    club: "GWS",
    age: 26,
    positions: ["KPF"],
    tier: "Depth",
    potential: 82
  }),
  createPlayer({
    id: 50626,
    name: "Harry Himmelberg",
    club: "GWS",
    age: 30,
    positions: ["KPD"],
    tier: "Best22",
    potential: 84
  }),
  createYoungPlayer({
    id: 50627,
    name: "Jack Ough",
    club: "GWS",
    age: 19,
    positions: ["MID", "WING"],
    tier: "Rookie",
    potential: 81
  }),
  createYoungPlayer({
    id: 50628,
    name: "Cody Angove",
    club: "GWS",
    age: 20,
    positions: ["HF", "FF"],
    tier: "Rookie",
    potential: 83
  }),
  createYoungPlayer({
    id: 50629,
    name: "James Leake",
    club: "GWS",
    age: 21,
    positions: ["HB", "BP"],
    tier: "Rookie",
    potential: 82
  }),
  createYoungPlayer({
    id: 50630,
    name: "Toby McMullin",
    club: "GWS",
    age: 22,
    positions: ["HB", "BP"],
    tier: "Rookie",
    potential: 81
  }),
  createPlayer({
    id: 50631,
    name: "Kieren Briggs",
    club: "GWS",
    age: 27,
    positions: ["RUC"],
    tier: "Best22",
    potential: 85
  }),
  createPlayer({
    id: 50632,
    name: "Xavier O'Halloran",
    club: "GWS",
    age: 26,
    positions: ["MID", "WING"],
    tier: "Depth",
    potential: 82
  }),
  createYoungPlayer({
    id: 50633,
    name: "Oskar Taylor",
    club: "GWS",
    age: 19,
    positions: ["HB", "BP"],
    tier: "Rookie",
    potential: 84
  }),
  createYoungPlayer({
    id: 50634,
    name: "Max Gruzewski",
    club: "GWS",
    age: 22,
    positions: ["HF", "FF"],
    overall: 81,
    potential: 85
  }),
  createYoungPlayer({
    id: 50635,
    name: "Logan Smith",
    club: "GWS",
    age: 20,
    positions: ["RUC"],
    tier: "Rookie",
    potential: 81
  }),
  createYoungPlayer({
    id: 50636,
    name: "Joe Fonti",
    club: "GWS",
    age: 21,
    positions: ["HB", "BP"],
    overall: 75,
    potential: 82
  }),
  createYoungPlayer({
    id: 50637,
    name: "Josaia Delana",
    club: "GWS",
    age: 20,
    positions: ["HF", "FF"],
    tier: "Rookie",
    potential: 79
  }),
  createPlayer({
    id: 50638,
    name: "Connor Idun",
    club: "GWS",
    age: 26,
    positions: ["KPD"],
    tier: "Best22",
    potential: 85
  }),
  createYoungPlayer({
    id: 50639,
    name: "Nicholas Madden",
    club: "GWS",
    age: 22,
    positions: ["RUC"],
    tier: "Rookie",
    potential: 81
  }),
  createYoungPlayer({
    id: 50640,
    name: "Nathan Wardius",
    club: "GWS",
    age: 21,
    positions: ["HF", "FF"],
    tier: "Rookie",
    potential: 82
  }),
  createYoungPlayer({
    id: 50641,
    name: "Riley Hamilton",
    club: "GWS",
    age: 20,
    positions: ["HF", "FF"],
    tier: "Rookie",
    potential: 81
  }),
  createPlayer({
    id: 50642,
    name: "Jack Buckley",
    club: "GWS",
    age: 28,
    positions: ["KPD"],
    tier: "Depth",
    potential: 83
  }),
  createYoungPlayer({
    id: 50643,
    name: "Finnegan Davis",
    club: "GWS",
    age: 19,
    positions: ["HB", "BP"],
    tier: "Rookie",
    potential: 80
  }),
  createPlayer({
    id: 50644,
    name: "Callum Brown",
    club: "GWS",
    age: 26,
    positions: ["HF", "FF"],
    overall: 79,
    potential: 85
  })
];

// Final contract years and free-agency statuses are transcribed from AFL Contracts.docx.
// Players without a source entry have no known final year or remaining term.
const contractDetails = {
  "Harvey Thomas": [2028, "Non-Free Agent"],
  "Darcy Jones": [2028, "Non-Free Agent"],
  "Stephen Coniglio": [2027, "Unrestricted Free Agent"],
  
  "Aaron Cadman": [2030, "Restricted Free Agent"],
  "Lachie Ash": [2027, "Restricted Free Agent"],
  "Ryan Angwin": [2028, "Restricted Free Agent"],
  "Clayton Oliver": [2030, "Unrestricted Free Agent"],
  "Phoenix Gothard": [2028, "Non-Free Agent"],
  "Tom Green": [2027, "Restricted Free Agent"],
  "Oliver Hannaford": [2027, "Non-Free Agent"],
  "Toby Bedford": [2029, "Non-Free Agent"],
  "Sam Taylor": [2032, "Unrestricted Free Agent"],
  "Brent Daniels": [2031, "Unrestricted Free Agent"],
  "Finn Callaghan": [2029, "Restricted Free Agent"],
  "Conor Stone": [2026, "Unrestricted Free Agent"],
  "Harrison Oliver": [2027, "Non-Free Agent"],
  "Jake Stringer": [2027, "Non-Free Agent"],
  "Leek Aleer": [2027, "Non-Free Agent"],
  "Josh Kelly": [2029, "Unrestricted Free Agent"],
  
  "Harry Rowston": [2028, "Non-Free Agent"],
  "Jayden Laverde": [2028, "Unrestricted Free Agent"],
  "Jake Riccardi": [2030, "Unrestricted Free Agent"],
  "Harry Himmelberg": [2029, "Unrestricted Free Agent"],
  "Jack Ough": [2028, "Non-Free Agent"],
  "Cody Angove": [2028, "Non-Free Agent"],
  "James Leake": [2028, "Non-Free Agent"],
  "Toby McMullin": [2028, "Non-Free Agent"],
  "Kieren Briggs": [2031, "Non-Free Agent"],
  "Xavier O": [2028, "Unrestricted Free Agent"],
  "Oskar Taylor": [2028, "Unknown"],
  "Max Gruzewski": [2028, "Non-Free Agent"],
  "Logan Smith": [2028, "Non-Free Agent"],
  "Joe Fonti": [2027, "Non-Free Agent"],
  "Josaia Delana": [2028, "Non-Free Agent"],
  "Connor Idun": [2032, "Unrestricted Free Agent"],
  "Nicholas Madden": [2030, "Restricted Free Agent"],
  "Nathan Wardius": [2027, "Non-Free Agent"],
  "Riley Hamilton": [2027, "Unknown"],
  "Jack Buckley": [2030, "Unrestricted Free Agent"],
  "Finnegan Davis": [2027, "Unknown"],
  "Callum Brown": [2028, "Unrestricted Free Agent"],
};

export const gwsgiantsPlayers = gwsgiantsPlayersWithoutContractStatus.map((player) => {
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