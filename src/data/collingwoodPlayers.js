import {
  createElitePlayer,
  createStarPlayer,
  createYoungPlayer,
  createVeteranPlayer,
  createPlayer
} from "../engine/playerFactory.js";

const collingwoodPlayersWithoutContractStatus = [
  createElitePlayer({
    id: 1001,
    name: "Nick Daicos",
    club: "Collingwood",
    age: 23,
    positions: ["MID", "WING"],
    overall: 96,
    potential: 99,
  }),

  createStarPlayer({
    id: 1002,
    name: "Jordan De Goey",
    club: "Collingwood",
    age: 30,
    positions: ["MID", "WING", "HF"],
    overall: 85,
    potential: 85
  }),

  createStarPlayer({
    id: 1003,
    name: "Darcy Moore",
    club: "Collingwood",
    age: 30,
    positions: ["KPD"],
    overall: 84,
    potential: 85
  }),

  createStarPlayer({
    id: 1004,
    name: "Josh Daicos",
    club: "Collingwood",
    age: 27,
    positions: ["WING", "HB", "MID"],
    overall: 86,
    potential: 88
  }),

  createStarPlayer({
    id: 1005,
    name: "Dan Houston",
    club: "Collingwood",
    age: 29,
    positions: ["HB", "BP"],
    overall: 84,
    potential: 85
  }),

  createStarPlayer({
    id: 1006,
    name: "Jack Crisp",
    club: "Collingwood",
    age: 33,
    positions: ["MID", "WING"],
    overall: 82,
    potential: 82
  }),

  createStarPlayer({
    id: 1007,
    name: "Darcy Cameron",
    club: "Collingwood",
    age: 31,
    positions: ["RUC"],
    overall: 84,
    potential: 84
  }),

  createPlayer({
    id: 1008,
    name: "Brayden Maynard",
    club: "Collingwood",
    age: 30,
    positions: ["BP", "HB"],
    overall: 86,
    potential: 86
  }),


  createPlayer({
    id: 1011,
    name: "Jamie Elliott",
    club: "Collingwood",
    age: 34,
    positions: ["HF", "FF"],
    tier: "Best22",
    potential: 84
  }),

  createPlayer({
    id: 1013,
    name: "Lachie Schultz",
    club: "Collingwood",
    age: 28,
    positions: ["HF", "FF"],
    overall: 83,
    potential: 85
  }),

  createPlayer({
    id: 1014,
    name: "Harry Perryman",
    club: "Collingwood",
    age: 27,
    positions: ["HB", "MID"],
    tier: "Best22",
    overall: 82,
    potential: 84
  }),

  createPlayer({
    id: 1015,
    name: "Patrick Lipinski",
    club: "Collingwood",
    age: 28,
    positions: ["MID", "HF", "WING"],
    tier: "Best22",
    overall: 81,
    potential: 84
  }),

  createPlayer({
    id: 1016,
    name: "Daniel McStay",
    club: "Collingwood",
    age: 31,
    positions: ["KPF"],
    tier: "Best22",
    overall: 82,
    potential: 82
  }),

  createPlayer({
    id: 1017,
    name: "Isaac Quaynor",
    club: "Collingwood",
    age: 26,
    positions: ["BP", "HB"],
    tier: "Best22",
    overall: 83,
    potential: 85
  }),

  createPlayer({
    id: 1099,
    name: "Lachie Neale",
    club: "Collingwood",
    age: 33,
    positions: ["MID", "WING"],
    tier: "Best22",
    overall: 88,
    potential: 88
  }),

  createPlayer({
    id: 1018,
    name: "Billy Frampton",
    club: "Collingwood",
    age: 29,
    positions: ["KPD"],
    tier: "Best22",
    overall: 81,
    potential: 81
  }),

  createPlayer({
    id: 1019,
    name: "Tim Membrey",
    club: "Collingwood",
    age: 32,
    positions: ["KPF"],
    tier: "Best22",
    overall: 79,
    potential: 79
  }),

  createPlayer({
    id: 1020,
    name: "Beau McCreery",
    club: "Collingwood",
    age: 25,
    positions: ["HF", "FF"],
    overall: 80,
    potential: 84
  }),

  createPlayer({
    id: 1021,
    name: "Jeremy Howe",
    club: "Collingwood",
    age: 36,
    positions: ["KPD"],
    tier: "Best22",
    overall: 82,
    potential: 82
  }),

  createYoungPlayer({
    id: 1022,
    name: "Reef McInnes",
    club: "Collingwood",
    age: 23,
    positions: ["KPD"],
    potential: 86
  }),

  // REVISED YOUNG PLAYERS SECTION
// Replace IDs 1023-1045 in collingwoodPlayers.js with the following

createYoungPlayer({
  id: 1023,
  name: "Edward Allan",
  club: "Collingwood",
  age: 22,
  positions: ["MID", "WING"],
  tier: "Rookie",
  overall: 76,
  potential: 86
}),

createYoungPlayer({
  id: 1024,
  name: "Harry DeMattia",
  club: "Collingwood",
  age: 21,
  positions: ["MID"],
  tier: "Rookie",
  potential: 81
}),

createYoungPlayer({
  id: 1026,
  name: "Oscar Steene",
  club: "Collingwood",
  age: 23,
  positions: ["RUC"],
  tier: "Best22",
  overall: 78,
  potential: 88
}),

createYoungPlayer({
  id: 1027,
  name: "Tew Jiath",
  club: "Collingwood",
  age: 21,
  positions: ["HB"],
  tier: "Rookie",
  overall: 71,
  potential: 80
}),

createYoungPlayer({
  id: 1029,
  name: "Charlie West",
  club: "Collingwood",
  age: 20,
  positions: ["KPF"],
  tier: "Rookie",
  overall: 74,
  potential: 86
}),

createYoungPlayer({
  id: 1031,
  name: "Harvey Harrison",
  club: "Collingwood",
  age: 22,
  positions: ["HF"],
  tier: "Rookie",
  overall: 76,
  potential: 85
}),

createYoungPlayer({
  id: 1032,
  name: "Sam Swadling",
  club: "Collingwood",
  age: 19,
  positions: ["MID", "WING", "HB"],
  overall: 81,
  potential: 91
}),

createYoungPlayer({
  id: 1033,
  name: "Ned Long",
  club: "Collingwood",
  age: 23,
  positions: ["MID"],
  tier: "Rookie",
  overall: 79,
  potential: 82
}),

createYoungPlayer({
  id: 1035,
  name: "Noah Howes",
  club: "Collingwood",
  age: 20,
  positions: ["KPD"],
  tier: "Rookie",
  potential: 80
}),

createYoungPlayer({
  id: 1036,
  name: "William Hayes",
  club: "Collingwood",
  age: 20,
  positions: ["HF"],
  tier: "Rookie",
  overall: 77,
  potential: 82
}),

createStarPlayer({
  id: 50622,
  name: "Jesse Hogan",
  club: "Collingwood",
  age: 31,
  positions: ["KPF"],
  overall: 84,
  potential: 85
}),

createYoungPlayer({
  id: 1037,
  name: "Angus Anderson",
  club: "Collingwood",
  age: 23,
  positions: ["HF"],
  tier: "Rookie",
  overall: 79,
  potential: 85
}),

createYoungPlayer({
  id: 1038,
  name: "Jai Saxena",
  club: "Collingwood",
  age: 18,
  positions: ["FF"],
  tier: "Rookie",
  potential: 82
}),

createPlayer({
  id: 1039,
  name: "Roan Steele",
  club: "Collingwood",
  age: 24,
  positions: ["MID", "WING"],
  tier: "Rookie",
  overall: 78,
  potential: 82
}),

createYoungPlayer({
  id: 1040,
  name: "Zac McCarthy",
  club: "Collingwood",
  age: 18,
  positions: ["KPF"],
  tier: "Rookie",
  potential: 83
}),

createYoungPlayer({
  id: 1042,
  name: "Liam Puncher",
  club: "Collingwood",
  age: 19,
  positions: ["KPD"],
  tier: "Rookie",
  overall: 76,
  potential: 81
}),

createYoungPlayer({
  id: 1043,
  name: "Harrison Coe",
  club: "Collingwood",
  age: 20,
  positions: ["RUC"],
  tier: "Rookie",
  potential: 80
}),

createYoungPlayer({
  id: 1044,
  name: "Jack Buller",
  club: "Collingwood",
  age: 25,
  positions: ["KPF"],
  tier: "Rookie",
  overall: 74,
  potential: 79
}),
createYoungPlayer({
  id: 2237,
  name: "Flynn Riley",
  club: "Collingwood",
  age: 22,
  positions: ["RUC"],
  tier: "Rookie",
  potential: 81
}),
createYoungPlayer({
  id: 1045,
  name: "Tyan Prindable",
  club: "Collingwood",
  age: 19,
  positions: ["MID"],
  tier: "Rookie",
  potential: 83
}),
];

// Final contract years and free-agency statuses are transcribed from AFL Contracts.docx.
// Players without a source entry have no known final year or remaining term.
const contractDetails = {
  "Nick Daicos": [2029, "Restricted Free Agent"],
  "Jordan De Goey": [2027, "Unrestricted Free Agent"],
  "Darcy Moore": [2028, "Unrestricted Free Agent"],
  "Josh Daicos": [2030, "Unrestricted Free Agent"],
  "Flynn Riley": [2029, "Non-Free Agent"],
  "Dan Houston": [2030, "Non-Free Agent"],
  "Jack Crisp": [2027, "Unrestricted Free Agent"],
  "Darcy Cameron": [2029, "Unrestricted Free Agent"],
  "Brayden Maynard": [2029, "Unrestricted Free Agent"],
  "Jamie Elliott": [2027, "Unrestricted Free Agent"],
  "Lachie Schultz": [2027, "Unrestricted Free Agent"],
  "Lachie Neale": [2029, "Non-Free Agent"],
  "Harry Perryman": [2030, "Non-Free Agent"],
  "Patrick Lipinski": [2027, "Non-Free Agent"],
  "Daniel McStay": [2028, "Non-Free Agent"],
  "Isaac Quaynor": [2029, "Unrestricted Free Agent"],
  "Billy Frampton": [2028, "Non-Free Agent"],
  "Tim Membrey": [2027, "Unrestricted Free Agent"],
  "Beau McCreery": [2027, "Non-Free Agent"],
  "Jeremy Howe": [2027, "Unrestricted Free Agent"],
  "Reef McInnes": [2027, "Non-Free Agent"],
  "Edward Allan": [2030, "Restricted Free Agent"],
  "Harry DeMattia": [2027, "Non-Free Agent"],
  "Oscar Steene": [2027, "Non-Free Agent"],
  "Tew Jiath": [2027, "Non-Free Agent"],
  "Charlie West": [2028, "Non-Free Agent"],
  "Harvey Harrison": [2027, "Non-Free Agent"],
  "Sam Swadling": [2027, "Unknown"],
  "Ned Long": [2027, "Unrestricted Free Agent"],
  "Noah Howes": [2026, "Non-Free Agent"],
  "William Hayes": [2028, "Non-Free Agent"],
  "Angus Anderson": [2027, "Unknown"],
  "Jai Saxena": [2027, "Non-Free Agent"],
  "Roan Steele": [2027, "Non-Free Agent"],
  "Zac McCarthy": [2027, "Unknown"],
  "Liam Puncher": [2028, "Non-Free Agent"],
  "Harrison Coe": [2026, "Unknown"],
  "Jesse Hogan": [2028, "Non-Free Agent"],
  "Jack Buller": [2027, "Non-Free Agent"],
  "Tyan Prindable": [2027, "Unknown"],
};

export const collingwoodPlayers = collingwoodPlayersWithoutContractStatus.map((player) => {
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