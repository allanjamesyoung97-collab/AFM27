// Combined squad list for screens that expect the `players` export.
import { adelaidePlayers } from "./adelaidePlayers.js";
import { brisbanePlayers } from "./brisbanePlayers.js";
import { carltonPlayers } from "./carltonPlayers.js";
import { collingwoodPlayers } from "./collingwoodPlayers.js";
import { essendonPlayers } from "./essendonPlayers.js";
import { fremantlePlayers } from "./fremantlePlayers.js";
import { geelongPlayers } from "./geelongPlayers.js";
import { goldcoastPlayers } from "./goldcoastPlayers.js";
import { gwsgiantsPlayers } from "./gwsgiantsPlayers.js";
import { hawthornPlayers } from "./hawthornPlayers.js";
import { melbournePlayers } from "./melbournePlayers.js";
import { northmelbournePlayers } from "./northmelbournePlayers.js";
import { portadelaidePlayers } from "./portadelaidePlayers.js";
import { richmondPlayers } from "./richmondPlayers.js";
import { stkildaPlayers } from "./stkildaPlayers.js";
import { sydneyPlayers } from "./sydneyPlayers.js";
import { westcoastPlayers } from "./westcoastPlayers.js";
import { westernbulldogsPlayers } from "./westernbulldogsPlayers.js";
import { getPlayerJumperNumber } from "./aflJumperNumbers.js";

const rosterSnapshot = [
  ...adelaidePlayers,
  ...brisbanePlayers,
  ...carltonPlayers,
  ...collingwoodPlayers,
  ...essendonPlayers,
  ...fremantlePlayers,
  ...geelongPlayers,
  ...goldcoastPlayers,
  ...gwsgiantsPlayers,
  ...hawthornPlayers,
  ...melbournePlayers,
  ...northmelbournePlayers,
  ...portadelaidePlayers,
  ...richmondPlayers,
  ...stkildaPlayers,
  ...sydneyPlayers,
  ...westcoastPlayers,
  ...westernbulldogsPlayers,
];

// End-of-2026 trade-period destinations from the AFL's club-by-club summary.
// Keeping this as a single roster overlay makes every screen and new career
// use the same club assignment without duplicating player records.
const tradePeriodDestinations2026 = {
  "Harry Cunningham": "Adelaide",
  "Jordon Butts": "Western Bulldogs",
  "Keidean Coleman": "Essendon",
  "Sam Marshall": "St Kilda",
  "Will McLachlan": "Melbourne",
  "Lachie Neale": "Collingwood",
  "Lachie Whitfield": "Carlton",
  "Joel Amartey": "Carlton",
  "Flynn Riley": "Collingwood",
  "Scott Pendlebury": "Gold Coast",
  "Jack Bowes": "Essendon",
  "Jordan Ridley": "Geelong",
  "Zach Merrett": "Hawthorn",
  "Dominic Bedendo": "Fremantle",
  "Nathan O'Driscoll": "Richmond",
  "Toby Greene": "Geelong",
  "Rowan Marshall": "Geelong",
  "Ben King": "Hawthorn",
  "Sam Butler": "Gold Coast",
  "Aidan Schubert": "Gold Coast",
  "Kieren Briggs": "Richmond",
  "Jesse Hogan": "Collingwood",
  "Nick Blakey": "North Melbourne",
  "Zane Duursma": "Melbourne",
  "Luke Pedlar": "Port Adelaide",
  "Finn Maginness": "Western Bulldogs",
  "Bodie Ryan": "Melbourne",
  "Jack Viney": "West Coast",
  "Trent Rivers": "West Coast",
  "Zak Butters": "Western Bulldogs",
  "Hudson O'Keeffe": "Western Bulldogs",
  "Josh Goater": "Hawthorn",
};

export const tradePeriodPlayerMoves2026 = Object.entries(tradePeriodDestinations2026)
  .flatMap(([playerName, toClub]) => {
    const player = rosterSnapshot.find((entry) => entry.name === playerName);
    return player && player.club !== toClub
      ? [{ playerId: player.id, playerName, fromClub: player.club, toClub }]
      : [];
  });

const delistedPlayers2026 = new Set(["Jake Stringer"]);

const playersWithCurrentClubs = rosterSnapshot.map((player) => {
    if (delistedPlayers2026.has(player.name)) {
      return {
        ...player,
        club: "-",
        rosterStatus: "DELISTED",
        contract: { ...player.contract, yearsRemaining: 0, status: "Delisted Free Agent" },
      };
    }
    const club = tradePeriodDestinations2026[player.name];
    return club && club !== player.club ? { ...player, club } : player;
  });

export const allAflPlayers = playersWithCurrentClubs.map((player) => ({
  ...player,
  jumperNumber: getPlayerJumperNumber(player),
}));

// Existing app screens import `players` from this module.
export const players = allAflPlayers;
