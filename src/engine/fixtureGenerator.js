import {
  clubs,
  clubVenues
} from "../data/clubData.js";
import { leagueClubsForYear } from "../data/clubs.js";

const DOUBLE_UP_ROUNDS = [
  // Round 18 - Traditional Rivalries

  [
    ["Collingwood", "Carlton"],
    ["Adelaide", "Port Adelaide"],
    ["West Coast", "Fremantle"],
    ["Sydney", "GWS"],
    ["Richmond", "Essendon"],
    ["Melbourne", "Western Bulldogs"],
    ["Geelong", "Hawthorn"],
    ["St Kilda", "North Melbourne"],
    ["Brisbane", "Gold Coast"]
  ],

  // Round 19 - Top Clubs

  [
    ["Collingwood", "Brisbane"],
    ["Fremantle", "Sydney"],
    ["Geelong", "Western Bulldogs"],
    ["Hawthorn", "Carlton"],
    ["Melbourne", "Adelaide"],
    ["GWS", "Port Adelaide"],
    ["Gold Coast", "St Kilda"],
    ["Essendon", "North Melbourne"],
    ["Richmond", "West Coast"]
  ],

  // Round 20 - Interstate Matchups

  [
    ["Adelaide", "West Coast"],
    ["Port Adelaide", "Fremantle"],
    ["Brisbane", "Sydney"],
    ["Gold Coast", "GWS"],
    ["Collingwood", "Richmond"],
    ["Carlton", "Essendon"],
    ["Melbourne", "Geelong"],
    ["Hawthorn", "Western Bulldogs"],
    ["St Kilda", "North Melbourne"]
  ],

  // Round 21 - Historic Rivalries

  [
    ["Collingwood", "Essendon"],
    ["Carlton", "Richmond"],
    ["Melbourne", "Hawthorn"],
    ["Geelong", "Western Bulldogs"],
    ["Sydney", "West Coast"],
    ["Fremantle", "Adelaide"],
    ["Port Adelaide", "Brisbane"],
    ["Gold Coast", "GWS"],
    ["North Melbourne", "St Kilda"]
  ],

  // Round 22 - Finals Race

  [
    ["Collingwood", "Sydney"],
    ["Brisbane", "Geelong"],
    ["Fremantle", "Hawthorn"],
    ["Carlton", "Western Bulldogs"],
    ["Melbourne", "GWS"],
    ["Adelaide", "Gold Coast"],
    ["Port Adelaide", "St Kilda"],
    ["Essendon", "Richmond"],
    ["North Melbourne", "West Coast"]
  ],

  // Round 23 - Season Finale

  [
    ["Collingwood", "Geelong"],
    ["Brisbane", "Fremantle"],
    ["Sydney", "Western Bulldogs"],
    ["Hawthorn", "Melbourne"],
    ["Carlton", "Port Adelaide"],
    ["Adelaide", "GWS"],
    ["Gold Coast", "West Coast"],
    ["Essendon", "St Kilda"],
    ["Richmond", "North Melbourne"]
  ]
];

export function generateFixture(seasonYear = 2027) {
  const teams = leagueClubsForYear(seasonYear).map((club) => club.name);
  const rounds = generateRoundRobin(seasonYear, teams);
  const doubleUpRounds = teams.length === 18
    ? generateDoubleUpRounds(seasonYear)
    : generateExpansionDoubleUpRounds(seasonYear, teams);

  return [
    ...rounds,
    ...doubleUpRounds
  ];
}

function generateRoundRobin(seasonYear, teamNames = clubs.map((club) => club.name)) {
  const teams = [...teamNames];
  if (teams.length % 2) teams.push(null);
  const seasonOffset = ((seasonYear - 2027) % teams.length + teams.length) % teams.length;
  const seasonOrder = [...teams.slice(seasonOffset), ...teams.slice(0, seasonOffset)];

  const rotation =
    [...seasonOrder];

  const rounds = [];

  for (let round = 1; round < rotation.length; round++) {
    const matches = [];

    for (let i = 0; i < rotation.length / 2; i++) {
      let home;
      let away;

      if (round % 2 === 0) {
        home =
          rotation[
            rotation.length -
              1 -
              i
          ];

        away =
          rotation[i];
      } else {
        home =
          rotation[i];

        away =
          rotation[
            rotation.length -
              1 -
              i
          ];
      }

      if (!home || !away) continue;
      matches.push({
        home,
        away,
        venue:
            venueForClub(home, seasonYear, round),
        date:
          getRoundDate(
            round,
            seasonYear
          )
      });
    }

    rounds.push({
      round,
      matches
    });

    rotateTeams(
      rotation
    );
  }

  return rounds;
}

function generateDoubleUpRounds(seasonYear) {
  const teamNames = clubs.map((club) => club.name);
  const yearOffset = ((seasonYear - 2027) % teamNames.length + teamNames.length) % teamNames.length;
  const reverseHomeAway = (seasonYear - 2027) % 2 !== 0;

  return DOUBLE_UP_ROUNDS.map(
    (
      roundFixtures,
      index
    ) => ({
      round: 18 + index,

      matches:
        roundFixtures.map(
          (fixture) => {
            const shiftClub = (clubName) => {
              const teamIndex = teamNames.indexOf(clubName);
              return teamNames[(teamIndex + yearOffset) % teamNames.length];
            };
            const shiftedHome = shiftClub(fixture[0]);
            const shiftedAway = shiftClub(fixture[1]);
            const home = reverseHomeAway ? shiftedAway : shiftedHome;
            const away = reverseHomeAway ? shiftedHome : shiftedAway;

            return {
              home,
              away,
              venue: clubVenues[home],
              date: getRoundDate(18 + index, seasonYear),
            };
          }
        )
    })
  );
}

function generateExpansionDoubleUpRounds(seasonYear, teams) {
  const rounds = generateRoundRobin(seasonYear + 1, teams).slice(0, 5);
  return rounds.map((round, index) => ({
    round: 20 + index,
    matches: round.matches.map((match) => ({
      home: index % 2 ? match.away : match.home,
      away: index % 2 ? match.home : match.away,
      venue: venueForClub(index % 2 ? match.away : match.home, seasonYear, 20 + index),
      date: getRoundDate(20 + index, seasonYear),
    })),
  }));
}

function venueForClub(clubName, year, round) {
  if (clubName !== "Tasmania") return clubVenues[clubName];
  if (Number(year) >= 2031) return "Macquarie Point Stadium";
  return Number(round) % 2 ? "York Park" : "Bellerive Oval";
}

function rotateTeams(
  rotation
) {
  const fixed =
    rotation[0];

  const remaining =
    rotation.slice(1);

  remaining.unshift(
    remaining.pop()
  );

  rotation.splice(
    0,
    rotation.length,
    fixed,
    ...remaining
  );
}

function getRoundDate(
  round,
  seasonYear
) {
  const startDate =
    new Date(
      Date.UTC(seasonYear, 2, 18, 12)
    );

  startDate.setDate(
    startDate.getDate() +
      (round - 1) * 7
  );

  return startDate.toLocaleDateString(
    "en-AU",
    {
      day: "numeric",
      month: "short",
      year: "numeric"
    }
  );
}
