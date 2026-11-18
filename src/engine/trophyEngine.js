import { clubHistory } from "../data/clubHistory/clubHistory.js";
import { players as basePlayers } from "../data/players.js";
import { getCareerClub } from "./contractEngine.js";

export const TROPHIES = [
  { id: "overtaking-mick", title: "Overtaking Mick", icon: "🏟️", category: "Coaching", tier: "Legendary", description: "Coach 719 senior games.", target: 719, metric: "games" },
  { id: "long-haul", title: "The Long Haul", icon: "🕰️", category: "Coaching", tier: "Legendary", description: "Coach 1,000 senior games.", target: 1000, metric: "games" },
  { id: "first-flag", title: "First Flag", icon: "🏆", category: "Coaching", tier: "Notable", description: "Win your first premiership as senior coach.", target: 1, metric: "flags" },
  { id: "three-peat", title: "Three-Peat", icon: "🥇", category: "Coaching", tier: "Legendary", description: "Win three premierships in a row.", target: 3, metric: "streak" },
  { id: "dynasty", title: "Dynasty", icon: "👑", category: "Coaching", tier: "Legendary", description: "Win five premierships in seven seasons.", target: 5, metric: "fiveInSeven" },
  { id: "ultimate-record", title: "The Ultimate Record", icon: "📜", category: "Coaching", tier: "Legendary", description: "Win six premierships as senior coach.", target: 6, metric: "ultimate-record" },
  { id: "finals-fixture", title: "Finals Fixture", icon: "📅", category: "Coaching", tier: "Rare", description: "Reach finals in ten consecutive seasons.", target: 10, metric: "finalsStreak" },
  { id: "september-specialist", title: "September Specialist", icon: "🌟", category: "Coaching", tier: "Rare", description: "Win 20 finals.", target: 20, metric: "finalsWins" },
  { id: "comeback", title: "The Comeback", icon: "📈", category: "Coaching", tier: "Rare", description: "Win a premiership within five seasons of finishing last.", target: 1, metric: "comeback" },
  { id: "break-drought", title: "Break the Drought", icon: "😇", category: "Club history", tier: "Club-specific", description: "Win a premiership with St Kilda.", target: 1, metric: "st-kilda" },
  { id: "end-wait", title: "End the Wait", icon: "⏳", category: "Club history", tier: "Rare", description: "Win a flag after your club has gone 20 or more years without one.", target: 1, metric: "drought20" },
  { id: "first-club-flag", title: "First in Club History", icon: "🚩", category: "Club history", tier: "Club-specific", description: "Win the first premiership in your club's history.", target: 1, metric: "firstClubFlag" },
  { id: "back-on-top", title: "Back on Top", icon: "🔝", category: "Club history", tier: "Rare", description: "Win a flag after your club has gone 30 or more years without one.", target: 1, metric: "drought30" },
  { id: "perfect-season", title: "The Perfect Season", icon: "💯", category: "Club history", tier: "Legendary", description: "Win every home-and-away match and the premiership.", target: 1, metric: "perfect" },
  { id: "wooden-spoon-to-winners", title: "From Wooden Spoon to Winners", icon: "🪜", category: "Club history", tier: "Legendary", description: "Win a flag within five seasons of finishing last.", target: 1, metric: "comeback" },
  { id: "defend-crown", title: "Defend the Crown", icon: "🛡️", category: "Club history", tier: "Rare", description: "Retain the premiership in consecutive seasons.", target: 2, metric: "streak" },
  { id: "home-ground-heroes", title: "Home Ground Heroes", icon: "🏠", category: "Club history", tier: "Rare", description: "Win the premiership after finishing outside the top four.", target: 1, metric: "outsideTopFourFlag" },
  { id: "local-legend", title: "Local Legend", icon: "🏅", category: "Club history", tier: "Rare", description: "Win three premierships with the same club.", target: 3, metric: "flags" },
  { id: "club-immortal", title: "Club Immortal", icon: "♾️", category: "Club history", tier: "Legendary", description: "Win five premierships with the same club.", target: 5, metric: "flags" },
  { id: "grand-final-glory", title: "Grand Final Glory", icon: "🎆", category: "Finals", tier: "Notable", description: "Win a Grand Final.", target: 1, metric: "flags" },
  { id: "three-grand-finals", title: "Three Grand Finals", icon: "🎟️", category: "Finals", tier: "Rare", description: "Win three Grand Finals.", target: 3, metric: "flags" },
  { id: "big-stage", title: "The Big Stage", icon: "🎯", category: "Finals", tier: "Rare", description: "Win a Grand Final by six points or fewer.", target: 1, metric: "closeGrandFinal" },
  { id: "greatest-comeback", title: "The Greatest Comeback", icon: "⚡", category: "Finals", tier: "Legendary", description: "Win a final after trailing by 40 or more points.", target: 1, metric: "comebackFinal" },
  { id: "rivalry-renewed", title: "Rivalry Renewed", icon: "🔥", category: "Finals", tier: "Rare", description: "Beat a traditional rival in a Grand Final.", target: 1, metric: "rivalGrandFinal" },
  { id: "four-quarters", title: "Four Quarters", icon: "⏱️", category: "Finals", tier: "Rare", description: "Win a Grand Final after trailing at half-time.", target: 1, metric: "halfTimeGrandFinal" },
  { id: "september-sweep", title: "September Sweep", icon: "🧹", category: "Finals", tier: "Rare", description: "Beat three top-eight teams on the way to a premiership.", target: 1, metric: "septemberSweep" },
  { id: "hard-way", title: "The Hard Way", icon: "🧗", category: "Finals", tier: "Legendary", description: "Win the premiership after playing every final.", target: 1, metric: "hardWay" },
  { id: "recruiter", title: "The Recruiter", icon: "🧲", category: "Player development", tier: "Rare", description: "Draft a player who later wins the Brownlow Medal.", target: 1, metric: "draftBrownlow" },
  { id: "built-from-within", title: "Built from Within", icon: "🧱", category: "Player development", tier: "Rare", description: "Win a flag with at least half the side drafted by your club.", target: 1, metric: "homeGrownFlag" },
  { id: "great-find", title: "The Great Find", icon: "💎", category: "Player development", tier: "Rare", description: "Develop a late draft pick into a 90-plus overall player.", target: 1, metric: "latePickElite" },
  { id: "rookie-to-star", title: "From Rookie to Star", icon: "🌱", category: "Player development", tier: "Rare", description: "Develop a rookie-listed player into a premiership regular.", target: 1, metric: "rookieFlag" },
  { id: "generational-talent", title: "Generational Talent", icon: "🌠", category: "Player development", tier: "Legendary", description: "Develop a player who wins a Brownlow Medal and a premiership.", target: 1, metric: "brownlowFlag" },
  { id: "club-champion", title: "A Club Champion", icon: "🏵️", category: "Player development", tier: "Rare", description: "Have a player win three club best-and-fairests.", target: 3, metric: "bestAndFairests" },
  { id: "golden-generation", title: "The Golden Generation", icon: "✨", category: "Player development", tier: "Rare", description: "Develop five players who reach 90 overall.", target: 5, metric: "elitePlayers" },
  { id: "draft-masterclass", title: "Draft Day Masterclass", icon: "📝", category: "Player development", tier: "Rare", description: "Draft three future premiership players in one national draft.", target: 3, metric: "draftClassFlags" },
];

const safeArray = value => Array.isArray(value) ? value : [];
const seasonMatches = season => [
  ...safeArray(season?.roundHistory).flatMap(round => safeArray(round.results)),
  ...safeArray(season?.wildcardResults),
  ...safeArray(season?.finalsHistory).flatMap(week => safeArray(week.results)),
];
const allSeasons = season => [...safeArray(season?.seasonArchive), {
  year: season?.seasonYear, premier: season?.premier, roundHistory: season?.roundHistory,
  wildcardResults: season?.wildcardResults, finalsHistory: season?.finalsHistory,
  ladder: season?.ladder, aflcaWinner: season?.aflcaWinner,
}].filter(item => item.year != null);
const clubInMatch = (match, club) => [match.homeTeam, match.awayTeam, match.home, match.away].includes(club);
const resultWinner = match => match.winner ?? (Number(match.homeScore ?? match.homePoints) > Number(match.awayScore ?? match.awayPoints) ? match.homeTeam ?? match.home : (Number(match.awayScore ?? match.awayPoints) > Number(match.homeScore ?? match.homePoints) ? match.awayTeam ?? match.away : null));
const scoreFor = (match, club) => (match.homeTeam ?? match.home) === club ? Number(match.homeScore ?? match.homePoints ?? 0) : Number(match.awayScore ?? match.awayPoints ?? 0);
const finalsOf = season => [...safeArray(season?.wildcardResults), ...safeArray(season?.finalsHistory).flatMap(week => safeArray(week.results))];

export function trophyProgress(season = {}, clubName = season.managerClubName) {
  const years = allSeasons(season).filter(item => item.premier);
  const flags = years.filter(item => item.premier === clubName);
  const clubHistoryRecord = clubHistory?.[clubName];
  const historicalYears = safeArray(clubHistoryRecord?.honours?.premiershipYears).map(Number);
  const careerSeasons = allSeasons(season);
  const history = careerSeasons.flatMap(item => seasonMatches(item));
  const clubGames = history.filter(match => clubInMatch(match, clubName));
  const clubFinals = careerSeasons.flatMap(item => finalsOf(item)).filter(match => clubInMatch(match, clubName));
  const finalsWins = clubFinals.filter(match => resultWinner(match) === clubName).length;
  const flagYears = flags.map(item => Number(item.year)).sort((a, b) => a - b);
  let flagStreak = 0;
  for (let i = flagYears.length - 1; i > 0 && flagYears[i] === flagYears[i - 1] + 1; i--) flagStreak++;
  if (flagYears.length) flagStreak++;
  const fiveInSeven = flagYears.some(year => flagYears.filter(candidate => candidate >= year && candidate <= year + 6).length >= 5);
  let finalsStreak = 0;
  for (let i = careerSeasons.length - 1; i >= 0; i--) {
    if (finalsOf(careerSeasons[i]).some(match => clubInMatch(match, clubName))) finalsStreak++;
    else break;
  }
  const firstCareerYear = Math.min(...careerSeasons.map(item => Number(item.year)).filter(Number.isFinite), Number(season.seasonYear ?? 2027));
  const lastHistoricalFlag = historicalYears.length ? Math.max(...historicalYears) : 0;
  const drought = lastHistoricalFlag ? firstCareerYear - lastHistoricalFlag : Number.POSITIVE_INFINITY;
  const careerPlayers = [...basePlayers, ...safeArray(season.generatedPlayers)];
  const development = season.playerDevelopment ?? {};
  const rosterForClub = careerPlayers.filter(player => getCareerClub(player, season.playerContracts ?? {}) === clubName);
  const playerOverall = player => Number(development[String(player.id)]?.overall ?? player.overall ?? 0);
  const bestAndFairests = Math.max(0, ...rosterForClub.map(player => Number(development[String(player.id)]?.bestAndFairests ?? player.careerStats?.bestAndFairests ?? 0)));
  const elitePlayers = rosterForClub.filter(player => playerOverall(player) >= 90).length;
  const draftedByClub = safeArray(season.draftHistory).filter(draft => !draft.kind || draft.kind === "NATIONAL").flatMap(draft => safeArray(draft.picks)).filter(pick => pick.playerId && pick.club === clubName);
  const draftedIds = new Set(draftedByClub.map(pick => String(pick.playerId)));
  const flagSeasonRows = flags.map(item => {
    const finalWeek = safeArray(item.finalsHistory).find(week => Number(week.week) === 4);
    const finalMatch = safeArray(finalWeek?.results).find(match => resultWinner(match) === clubName);
    const players = [...safeArray(finalMatch?.playerStats?.home), ...safeArray(finalMatch?.playerStats?.away)].filter(player => player.club === clubName);
    return { item, finalMatch, players };
  });
  const currentIsFlag = season.premier === clubName;
  const currentAndArchived = careerSeasons;
  const currentFinals = finalsOf(season).filter(match => clubInMatch(match, clubName));
  const grandFinalResults = safeArray(season.finalsHistory).filter(week => Number(week.week) === 4).flatMap(week => safeArray(week.results));
  const grandFinalWon = currentIsFlag;
  const progress = {
    games: clubGames.length,
    flags: flags.length,
    streak: flagStreak,
    fiveInSeven: fiveInSeven ? 5 : Math.min(4, Math.max(0, ...flagYears.map(year => flagYears.filter(candidate => candidate >= year && candidate <= year + 6).length))),
    finalsStreak,
    finalsWins,
    comeback: careerSeasons.some((item, index) => item.premier === clubName && careerSeasons.slice(Math.max(0, index - 5), index).some(prior => prior.ladder?.find(row => row.club === clubName || row.name === clubName)?.position >= 18)),
    "st-kilda": clubName === "St Kilda" && flags.length > 0,
    drought20: flags.length > 0 && drought >= 20,
    firstClubFlag: flags.length > 0 && safeArray(clubHistoryRecord?.honours?.premiershipYears).length === 0,
    drought30: flags.length > 0 && drought >= 30,
    perfect: currentIsFlag && currentAndArchived.some(item => item.premier === clubName && safeArray(item.roundHistory).length > 0 && safeArray(item.roundHistory).flatMap(round => safeArray(round.results)).filter(match => clubInMatch(match, clubName)).length >= 22 && safeArray(item.roundHistory).flatMap(round => safeArray(round.results)).filter(match => clubInMatch(match, clubName)).every(match => resultWinner(match) === clubName)),
    outsideTopFourFlag: flags.some(item => Number(item.finalLadder?.find(row => row.club === clubName || row.name === clubName)?.position ?? item.ladder?.find(row => row.club === clubName || row.name === clubName)?.position ?? 4) > 4),
    closeGrandFinal: grandFinalWon && grandFinalResults.some(match => Math.abs(scoreFor(match, clubName) - Number((match.homeTeam ?? match.home) === clubName ? match.awayScore : match.homeScore)) <= 6),
    comebackFinal: currentFinals.some(match => resultWinner(match) === clubName && Number(match.largestDeficit ?? match.maxLeadAgainst ?? 0) >= 40),
    rivalGrandFinal: false,
    halfTimeGrandFinal: currentIsFlag && currentFinals.some(match => match.halfTimeLeader && match.halfTimeLeader !== clubName),
    septemberSweep: currentIsFlag && currentFinals.filter(match => resultWinner(match) === clubName).length >= 3,
    hardWay: currentIsFlag && currentFinals.length >= 4,
    draftBrownlow: draftedByClub.some(pick => flagSeasonRows.some(({ item }) => String(item.brownlowWinner?.playerId ?? item.brownlowWinnerId) === String(pick.playerId))),
    homeGrownFlag: flagSeasonRows.some(({ players }) => players.length > 0 && players.filter(player => draftedIds.has(String(player.playerId))).length / players.length >= 0.5),
    latePickElite: draftedByClub.some(pick => Number(pick.pick) >= 31 && playerOverall(rosterForClub.find(player => String(player.id) === String(pick.playerId)) ?? {}) >= 90),
    rookieFlag: flagSeasonRows.some(({ players }) => players.some(player => season.playerContracts?.[String(player.playerId)]?.rookie)),
    brownlowFlag: flagSeasonRows.some(({ players, item }) => players.some(player => String(player.playerId) === String(item.brownlowWinner?.playerId ?? item.brownlowWinnerId))),
    bestAndFairests,
    elitePlayers,
    draftClassFlags: Math.max(0, ...safeArray(season.draftHistory).map(draft => safeArray(draft.picks).filter(pick => pick.club === clubName && pick.playerId && flagSeasonRows.some(row => row.players.some(player => String(player.playerId) === String(pick.playerId)))).length)),
    ultimateRecord: flags.length >= 6,
  };
  const rivalry = {
    "Collingwood": "Carlton", "Carlton": "Collingwood", "Essendon": "Collingwood", "Richmond": "Collingwood",
    "St Kilda": "Collingwood", "Geelong": "Hawthorn", "Hawthorn": "Geelong", "Sydney": "GWS Giants",
    "GWS Giants": "Sydney", "Adelaide": "Port Adelaide", "Port Adelaide": "Adelaide", "Brisbane Lions": "Gold Coast Suns",
    "Gold Coast Suns": "Brisbane Lions", "Fremantle": "West Coast Eagles", "West Coast Eagles": "Fremantle",
    "Western Bulldogs": "Essendon", "North Melbourne": "Essendon", "Melbourne": "Collingwood",
  }[clubName];
  progress.rivalGrandFinal = Boolean(currentIsFlag && rivalry && grandFinalResults.some(match => clubInMatch(match, rivalry) && resultWinner(match) === clubName));
  const metrics = { ...progress, "ultimate-record": flags.length };
  return TROPHIES.map(trophy => {
    let value = metrics[trophy.metric] ?? 0;
    if (typeof value === "boolean") value = value ? trophy.target : 0;
    const unlocked = Number(value) >= trophy.target;
    return { ...trophy, progress: Math.min(trophy.target, Number(value) || 0), unlocked };
  });
}

