import { dateAtWeek, getFinalsStandings } from "./finalsEngine.js";

// Builds the whole finals series as a bracket, including matches whose teams
// are not known yet. Known teams come from the ladder, wildcard seeds and any
// results already played; unknown teams carry a placeholder such as "Loser QF1".
export function buildFinalsBracket({ ladder = [], fixture = [], wildcardSeeds = null, wildcardResults = [], finalsHistory = [], seasonYear = 2027, premier = null } = {}) {
  const ranked = getFinalsStandings(ladder).map((row) => row.club);
  const results = new Map([...(wildcardResults ?? []), ...(finalsHistory ?? []).flatMap((week) => week.results ?? [])]
    .map((result) => [result.code, result]));
  const seeds = new Map(ranked.slice(0, 10).map((club, index) => [club, index + 1]));
  if (wildcardSeeds?.seven) seeds.set(wildcardSeeds.seven, 7);
  if (wildcardSeeds?.eight) seeds.set(wildcardSeeds.eight, 8);

  const winnerOf = (code) => results.get(code)?.winner ?? null;
  const loserOf = (code) => {
    const result = results.get(code);
    if (!result?.winner) return null;
    return result.winner === result.homeTeam ? result.awayTeam : result.homeTeam;
  };
  const ladderRank = new Map(ranked.map((club, index) => [club, index + 1]));
  const node = (code, title, weekOffset, home, away) => {
    // Wildcard finals show ladder positions; later finals show finals seeds
    // (wildcard winners become seed 7 and 8).
    const seedMap = code.startsWith("WC_") ? ladderRank : seeds;
    const side = (club, placeholder) => ({ club: club ?? null, seed: club ? seedMap.get(club) ?? null : null, placeholder });
    const result = results.get(code);
    const played = Boolean(result) && Number.isFinite(Number(result.homeScore)) && Number.isFinite(Number(result.awayScore));
    return {
      code, title,
      date: result?.date ?? dateAtWeek(fixture, weekOffset),
      venue: result?.venue ?? null,
      home: side(result?.homeTeam ?? home[0], home[1]),
      away: side(result?.awayTeam ?? away[0], away[1]),
      homeScore: played ? Number(result.homeScore) : null,
      awayScore: played ? Number(result.awayScore) : null,
      winner: result?.winner ?? null,
      loser: loserOf(code),
      extraTime: Boolean(result?.extraTime),
      played,
      result: result ?? null,
    };
  };

  const wildcard = [
    node("WC_7_10", "Wildcard Final 1", 1, [ranked[6]], [ranked[9]]),
    node("WC_8_9", "Wildcard Final 2", 1, [ranked[7]], [ranked[8]]),
  ];
  const week1 = [
    node("QF1", "Qualifying Final 1", 2, [ranked[0]], [ranked[3]]),
    node("EF1", "Elimination Final 1", 2, [ranked[4]], [wildcardSeeds?.eight, "Seed 8"]),
    node("EF2", "Elimination Final 2", 2, [ranked[5]], [wildcardSeeds?.seven, "Seed 7"]),
    node("QF2", "Qualifying Final 2", 2, [ranked[1]], [ranked[2]]),
  ];
  const semis = [
    node("SF1", "Semi Final 1", 3, [loserOf("QF1"), "Loser QF1"], [winnerOf("EF1"), "Winner EF1"]),
    node("SF2", "Semi Final 2", 3, [loserOf("QF2"), "Loser QF2"], [winnerOf("EF2"), "Winner EF2"]),
  ];
  const prelims = [
    node("PF1", "Preliminary Final 1", 4, [winnerOf("QF1"), "Winner QF1"], [winnerOf("SF2"), "Winner SF2"]),
    node("PF2", "Preliminary Final 2", 4, [winnerOf("QF2"), "Winner QF2"], [winnerOf("SF1"), "Winner SF1"]),
  ];
  const grandFinal = node("GF", "Grand Final", 5, [winnerOf("PF1"), "Winner PF1"], [winnerOf("PF2"), "Winner PF2"]);

  const dates = [...wildcard, ...week1, ...semis, ...prelims, grandFinal].map((match) => match.date).filter((date) => date instanceof Date);
  return {
    seasonYear,
    wildcard, week1, semis, prelims, grandFinal,
    premier: winnerOf("GF") ?? premier ?? null,
    firstDate: dates.length ? new Date(Math.min(...dates.map((date) => date.getTime()))) : null,
    lastDate: dates.length ? new Date(Math.max(...dates.map((date) => date.getTime()))) : null,
  };
}