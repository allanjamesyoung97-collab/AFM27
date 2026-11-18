import { parseFixtureDate } from "./calendarEngine.js";
import { CAP_GROWTH_RATE } from "./salaryCap.js";

export const AFL_FINALS_PRIZE_MONEY_2026 = Object.freeze({
  wildcardLoser: 55_000,
  eliminationFinalLoser: 75_000,
  semiFinalLoser: 100_000,
  preliminaryFinalLoser: 300_000,
  grandFinalLoser: 600_000,
  grandFinalWinner: 1_100_000,
});

// The supplied schedule is in 2026 dollars. Use the game's 5% annual economy
// growth so the 2027 season starts one year above that reference amount.
export function getFinalsPrizeAwards(match, result, seasonYear = 2027) {
  const growth = (1 + CAP_GROWTH_RATE) ** (Number(seasonYear) - 2026);
  let awards = [];
  const loser = result?.winner === result?.homeTeam ? result?.awayTeam
    : result?.winner === result?.awayTeam ? result?.homeTeam : null;

  if (match?.stage === "WILDCARD" && loser) {
    awards = [{ club: loser, type: "Wildcard loser", baseAmount: AFL_FINALS_PRIZE_MONEY_2026.wildcardLoser }];
  } else if (match?.stage === "FINALS" && loser) {
    if (String(match.code).startsWith("EF")) awards = [{ club: loser, type: "Elimination final loser", baseAmount: AFL_FINALS_PRIZE_MONEY_2026.eliminationFinalLoser }];
    else if (String(match.code).startsWith("SF")) awards = [{ club: loser, type: "Semi-final loser", baseAmount: AFL_FINALS_PRIZE_MONEY_2026.semiFinalLoser }];
    else if (String(match.code).startsWith("PF")) awards = [{ club: loser, type: "Preliminary final loser", baseAmount: AFL_FINALS_PRIZE_MONEY_2026.preliminaryFinalLoser }];
    else if (match.code === "GF") {
      awards = [
        { club: loser, type: "Grand final loser", baseAmount: AFL_FINALS_PRIZE_MONEY_2026.grandFinalLoser },
        { club: result.winner, type: "Grand final winner", baseAmount: AFL_FINALS_PRIZE_MONEY_2026.grandFinalWinner },
      ];
    }
  }

  return awards.map((award) => ({
    ...award,
    amount: Math.round(award.baseAmount * growth),
    seasonYear: Number(seasonYear),
  }));
}

export const FINALS_WEEK_LABELS = [
  "Finals Week 1",
  "Finals Week 2",
  "Preliminary Finals",
  "Grand Final",
];

export function getFinalsStandings(ladder = []) {
  return [...ladder].sort((a, b) =>
    (Number(b.points ?? 0) - Number(a.points ?? 0)) ||
    (Number(b.percentage ?? 0) - Number(a.percentage ?? 0)),
  );
}

export function dateAtWeek(fixture, weekOffset) {
  const dates = (fixture ?? []).flatMap((round) => (round.matches ?? [])
    .map((match) => parseFixtureDate(match.date))
    .filter(Boolean));
  const lastHomeAndAwayDate = dates.length
    ? new Date(Math.max(...dates.map((date) => date.getTime())))
    : new Date(2027, 8, 4);
  lastHomeAndAwayDate.setHours(0, 0, 0, 0);
  lastHomeAndAwayDate.setDate(lastHomeAndAwayDate.getDate() + weekOffset * 7);
  return lastHomeAndAwayDate;
}

export function getWildcardMatchups(ladder = [], fixture = []) {
  const standings = getFinalsStandings(ladder);
  if (standings.length < 10) return [];
  return [
    { code: "WC_7_10", stage: "WILDCARD", label: "Wildcard Final 1", home: standings[6].club, away: standings[9].club, date: dateAtWeek(fixture, 1) },
    { code: "WC_8_9", stage: "WILDCARD", label: "Wildcard Final 2", home: standings[7].club, away: standings[8].club, date: dateAtWeek(fixture, 1) },
  ];
}

function findResult(history = [], code) {
  return history.flatMap((week) => week.results ?? []).find((result) => result.code === code);
}

const winner = (match) => match?.winner;
const loser = (match) => !match?.winner ? null : match.winner === match.homeTeam ? match.awayTeam : match.homeTeam;

export function getFinalsMatchups({ ladder = [], fixture = [], wildcardSeeds, finalsWeek = 0, finalsHistory = [] } = {}) {
  const standings = getFinalsStandings(ladder);
  if (!wildcardSeeds || standings.length < 6) return [];
  const qf1 = findResult(finalsHistory, "QF1");
  const qf2 = findResult(finalsHistory, "QF2");
  const ef1 = findResult(finalsHistory, "EF1");
  const ef2 = findResult(finalsHistory, "EF2");
  const sf1 = findResult(finalsHistory, "SF1");
  const sf2 = findResult(finalsHistory, "SF2");
  const pf1 = findResult(finalsHistory, "PF1");
  const pf2 = findResult(finalsHistory, "PF2");

  const byWeek = [
    [
      { code: "QF1", label: "Qualifying Final 1", home: standings[0]?.club, away: standings[3]?.club },
      { code: "QF2", label: "Qualifying Final 2", home: standings[1]?.club, away: standings[2]?.club },
      { code: "EF1", label: "Elimination Final 1", home: standings[4]?.club, away: wildcardSeeds.eight },
      { code: "EF2", label: "Elimination Final 2", home: standings[5]?.club, away: wildcardSeeds.seven },
    ],
    [
      { code: "SF1", label: "Semi-final 1", home: loser(qf1), away: winner(ef1) },
      { code: "SF2", label: "Semi-final 2", home: loser(qf2), away: winner(ef2) },
    ],
    [
      { code: "PF1", label: "Preliminary Final 1", home: winner(qf1), away: winner(sf2) },
      { code: "PF2", label: "Preliminary Final 2", home: winner(qf2), away: winner(sf1) },
    ],
    [{ code: "GF", label: "Grand Final", home: winner(pf1), away: winner(pf2) }],
  ];
  return (byWeek[finalsWeek] ?? [])
    .filter((match) => match.home && match.away)
    .map((match) => ({ ...match, stage: "FINALS", date: dateAtWeek(fixture, finalsWeek + 2) }));
}