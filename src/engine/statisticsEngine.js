import { players } from "../data/players.js";
import { historicalPlayerStats } from "../data/historicalPlayerStats.js";
import { getCareerClub } from "./contractEngine.js";
import { readAttribute } from "./midfieldAttributes.js";
import { createAssistantTeamSelection } from "./teamSelectionEngine.js";
import { getTacticalPhaseProfile } from "./tacticsEngine.js";
import { awardBrownlowVotes } from "./brownlowEngine.js";
import { getSlotSuitability } from "./positionSuitability.js";
import { distributePlayerGoals, getGoalScoringWeight } from "./goalScoringEngine.js";

export const PLAYER_STAT_KEYS = [
  "disposals", "kicks", "handballs", "marks", "tackles", "goals", "behinds",
  "hitouts", "clearances", "inside50s", "rebound50s", "intercepts",
  "disposalEfficiency", "timeOnGround",
  "freeKicksFor", "freeKicksAgainst",
];

const roundTo = (value, digits = 0) => Number(value.toFixed(digits));
const rand = (min, max) => min + Math.random() * (max - min);

/** Resolve a player's single role for this match from their team-sheet slot. */
export function getPlayingPosition(player, slot = null) {
  if (slot) return getSlotSuitability(player, slot).role;
  return player?.positions?.[0] ?? "UTIL";
}

const matchPosition = (player) => player?.matchPosition ?? player?.playingPosition ?? player?.positions?.[0] ?? "UTIL";
// Relative share of a side's disposals by playing position. Tuned so a typical side produces roughly:
// midfielders 25-30, wings 20-24, half-backs 18-22, small/half-forwards 14-17, key defenders 10-13,
// key forwards 8-11 and ruckmen 10-13 disposals a game.
const DISPOSAL_ROLE_WEIGHT = {
  MID: 1.5, FOL: 1.5, WING: 1.3, HB: 1.15, BP: 0.9, FB: 0.9, KPD: 0.67, CHB: 0.7,
  HF: 0.88, FP: 0.8, FF: 0.62, KPF: 0.52, CHF: 0.75, RUC: 0.62, RUCK: 0.62, UTIL: 0.8,
};
const isRuck = (player) => ["RUC", "RUCK"].includes(matchPosition(player));
const isKeyDefender = (player) => ["KPD", "BP", "HB"].includes(matchPosition(player));
const isMid = (player) => ["MID", "WING", "FOL"].includes(matchPosition(player));
const isForward = (player) => ["KPF", "FF", "HF", "FP"].includes(matchPosition(player));
const normalizePlayerName = (name) => String(name ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]/g, "");
const normalizeClubName = (name) => {
  const key = String(name ?? "").trim().toLowerCase().replace(/[^a-z]/g, "");
  if (["gws", "gwsgiants", "greaterwesternsydney", "greaterwesternsydneygiants"].includes(key)) return "GWS";
  return name;
};
const HISTORICAL_CLUB_CODES = {
  Adelaide: "AD", Brisbane: "BL", Carlton: "CA", Collingwood: "CW",
  Essendon: "ES", Fremantle: "FR", Geelong: "GE", "Gold Coast": "GC",
  "GWS Giants": "GW", GWS: "GW", Hawthorn: "HW", Melbourne: "ME",
  "North Melbourne": "NM", "Port Adelaide": "PA", Richmond: "RI",
  "St Kilda": "SK", Sydney: "SY", "West Coast": "WC",
  "Western Bulldogs": "WB",
};

export function getHistoricalCareerStats(playerOrName) {
  const player = typeof playerOrName === "object" && playerOrName !== null ? playerOrName : null;
  const playerName = player?.name ?? playerOrName;
  const nameKey = normalizePlayerName(playerName);
  const matches = historicalPlayerStats.filter((entry) => normalizePlayerName(entry.name) === nameKey);
  if (matches.length <= 1) return matches[0] ?? null;

  const clubCode = HISTORICAL_CLUB_CODES[player?.club];
  const clubMatches = clubCode
    ? matches.filter((entry) => entry.teamCode?.split("/").includes(clubCode))
    : [];
  if (clubMatches.length === 1) return clubMatches[0];
  return null;
}

function selectPlayingList(clubName, suppliedLineup, contractsByPlayer = {}, playerPool = players) {
  if (Array.isArray(suppliedLineup) && suppliedLineup.length) {
    return suppliedLineup.map((entry) => {
      if (typeof entry === "string") {
        const player = playerPool.find((candidate) => candidate.name === entry && normalizeClubName(getCareerClub(candidate, contractsByPlayer)) === normalizeClubName(clubName));
        return player ? { ...player, matchPosition: getPlayingPosition(player) } : null;
      }
      const player = entry?.player ?? entry;
      return player ? { ...player, matchPosition: entry?.matchPosition ?? entry?.playingPosition ?? getPlayingPosition(player, entry?.position ?? entry?.slot) } : null;
    }).filter(Boolean);
  }
  const available = playerPool.filter((player) => normalizeClubName(getCareerClub(player, contractsByPlayer)) === normalizeClubName(clubName));
  const team = createAssistantTeamSelection(available);
  return Object.entries(team.selectedSide).flatMap(([slot, playerName]) => {
    const player = available.find((candidate) => candidate.name === playerName);
    return player ? [{ ...player, matchPosition: getPlayingPosition(player, slot) }] : [];
  });
}

function removeLegacySquadRows(rows) {
  // Old saves sometimes stored one aggregate "squad" row. It cannot be
  // accurately converted into individual player performances, so keep it out
  // of player tables instead of inventing distributions across the list.
  return (rows ?? []).filter((row) => row && row.playerId !== `${row.club}-team` && !/ squad$/i.test(row.playerName ?? ""));
}

function normalizeLegacyMatch(match) {
  if (!match?.playerStats) return match;
  const home = removeLegacySquadRows(match.playerStats.home);
  const away = removeLegacySquadRows(match.playerStats.away);
  if (home === match.playerStats.home && away === match.playerStats.away) return match;
  return { ...match, playerStats: { ...match.playerStats, home, away } };
}

function distribute(total, weights) {
  if (!weights.length) return [];
  const sum = weights.reduce((a, b) => a + b, 0) || weights.length;
  const raw = weights.map((weight) => total * weight / sum);
  const values = raw.map(Math.floor);
  let remainder = total - values.reduce((a, b) => a + b, 0);
  const order = raw.map((value, index) => ({ index, fraction: value - values[index] }))
    .sort((a, b) => b.fraction - a.fraction);
  for (let i = 0; i < remainder; i += 1) values[order[i % order.length].index] += 1;
  return values;
}

function makeSideStats(club, opponent, match, side, lineup, contractsByPlayer = {}, playerPool = players, random = Math.random, traitModifiersByPlayer = {}) {
  const rand = (min, max) => min + random() * (max - min);
  const list = selectPlayingList(club, lineup, contractsByPlayer, playerPool);
  const roster = list;
  const sideKey = side === "home" ? "home" : "away";
  const score = Number(match[`${sideKey}Score`] ?? 0);
  const goals = match[`${sideKey}Goals`] ?? Math.floor(score / 6);
  const behinds = match[`${sideKey}Behinds`] ?? score % 6;
  const tacticalProfile = getTacticalPhaseProfile(match.tacticalPlans?.[club], roster);
  const matchupProfile = match.matchupEffects?.[sideKey] ?? {};
  const oppositionProfile = getTacticalPhaseProfile(match.tacticalPlans?.[opponent]);
  const planStyle = String(match.tacticalPlans?.[club]?.style ?? "");
  const disposals = Math.round(rand(365, 415) * tacticalProfile.retention);
  const participation = (player) => Number.isFinite(Number(player.matchTimeOnGround))
    ? Math.max(0, Math.min(100, Number(player.matchTimeOnGround))) / 100
    : rand(0.64, 0.96);
  const playerLoad = Object.fromEntries(roster.map((player) => [String(player.id), participation(player)]));
  const skill = (player, key) => { const value = readAttribute(player, key); return Number.isFinite(value) ? value : Number(player.overall ?? 65); };
  const trait = (player, key) => Number(traitModifiersByPlayer[String(player.id)]?.[key] ?? 0);
  const weights = roster.map((player) => {
    const roleFactor = DISPOSAL_ROLE_WEIGHT[matchPosition(player)] ?? (isMid(player) ? 1.35 : isRuck(player) ? 0.8 : 0.72);
    const awarenessFactor = 0.9 + skill(player, "gameAwareness") / 650;
    return roleFactor * (0.75 + (player.overall ?? 60) / 150) * awarenessFactor
      * (1 + trait(player, "effectiveDisposal") * 0.6 + trait(player, "contested") * 0.25)
      * rand(0.78, 1.22) * playerLoad[String(player.id)];
  });
  const playerDisposals = distribute(disposals, weights);
  const playerGoals = distributePlayerGoals(goals, roster, (player) => getGoalScoringWeight(player, {
    role: matchPosition(player),
    participation: playerLoad[String(player.id)],
    scoringRate: trait(player, "scoringRate") + trait(player, "mark") * 0.1,
  }), random);
  const playerBehinds = distribute(behinds, roster.map((player, index) => playerGoals[index] * 0.6 + 0.35));
  const playerStats = roster.map((player, index) => {
    const d = playerDisposals[index];
    const kicks = Math.round(d * rand(0.48, 0.62));
    const handballs = d - kicks;
    const ruck = isRuck(player);
    const defence = isKeyDefender(player);
    return {
      playerId: player.id,
      playerName: player.name,
      club,
      opponent,
      positions: [matchPosition(player)],
      listedPositions: player.positions ?? [],
      matchPosition: matchPosition(player),
      disposals: d,
      kicks,
      handballs,
      marks: Math.max(0, Math.round(d * rand(0.16, 0.32) * (0.82 + skill(player, "marking") / 360) * (1 + trait(player, "mark")))),
      tackles: Math.max(0, Math.round((rand(1.2, 4.8) + (isMid(player) ? 1 : 0)) * (0.8 + skill(player, "tackling") / 325) * (0.85 + skill(player, "groundBallGet") / 430) * tacticalProfile.pressure * (1 + trait(player, "tackle")) * playerLoad[String(player.id)])),
      goals: playerGoals[index],
      behinds: playerBehinds[index],
      hitouts: ruck ? Math.round(rand(20, 42) * (0.72 + skill(player, "ruckCraft") / 235) * (1 + trait(player, "hitout")) * playerLoad[String(player.id)]) : Math.round(rand(0, 2) * playerLoad[String(player.id)]),
      clearances: Math.round((rand(0.5, 5.5) + (isMid(player) ? 1.2 : 0) + (ruck ? 1 : 0)) * (0.82 + skill(player, "contestedBall") / 360) * tacticalProfile.stoppage * (matchupProfile.stoppage ?? 1) * (1 + trait(player, "clearance")) * playerLoad[String(player.id)]),
      inside50s: Math.round((rand(0, 7) + (isMid(player) ? 1 : 0)) * (0.88 + skill(player, "runCarry") / 700) * tacticalProfile.forwardEntry * (matchupProfile.entries ?? 1) * (1 + trait(player, "inside50")) * playerLoad[String(player.id)]),
      rebound50s: Math.round((rand(0, 5) + (defence ? 2 : 0)) * (0.88 + skill(player, "runCarry") / 700) * tacticalProfile.transition * (matchupProfile.transition ?? 1) * playerLoad[String(player.id)]),
      intercepts: Math.round((rand(0, 5) + (defence ? 2 : 0)) * (0.8 + skill(player, "gameAwareness") / 325) * tacticalProfile.defence * (matchupProfile.containment ?? 1) * (1 + trait(player, "intercept")) * playerLoad[String(player.id)]),
      turnovers: Math.max(0, Math.round(d * Math.max(0.08, Math.min(0.32, 0.19 + (65 - skill(player, "gameAwareness")) * 0.0015 + (1 - tacticalProfile.retention) * 0.22 + (oppositionProfile.pressure + oppositionProfile.defence - 2) * 0.2)))),
      disposalEfficiency: roundTo(Math.max(45, Math.min(95, rand(62, 88) + (skill(player, "gameAwareness") - 65) * 0.1 + (tacticalProfile.retention - 1) * 16 + trait(player, "effectiveDisposal") * 25)), 1),
      timeOnGround: roundTo(player.matchTimeOnGround ?? playerLoad[String(player.id)] * 100, 1),
      contestedPossessions: Math.round(d * Math.max(0.2, Math.min(0.75, rand(0.35, 0.62) + (skill(player, "contestedBall") - 65) * 0.002 + trait(player, "contested")))),
      freeKicksFor: Math.max(0, Math.round(rand(0, 1.2) * playerLoad[String(player.id)])),
      freeKicksAgainst: Math.max(0, Math.round(rand(0, 0.8) * (1 + (65 - skill(player, "discipline")) / 70 + trait(player, "freeKickAgainst") * 3) * playerLoad[String(player.id)])),
    };
  });
  const totalDisposals = playerStats.reduce((sum, stat) => sum + stat.disposals, 0);
  const totalEffective = playerStats.reduce((sum, stat) => sum + stat.disposals * stat.disposalEfficiency / 100, 0);
  const totalKicks = playerStats.reduce((sum, stat) => sum + stat.kicks, 0);
  const totalHandballs = playerStats.reduce((sum, stat) => sum + stat.handballs, 0);
  const totalContested = playerStats.reduce((sum, stat) => sum + stat.contestedPossessions, 0);
  const totalScoringShots = goals + behinds;
  const styleFocus = planStyle === "CONTEST_CLEARANCE" ? "stoppages" : planStyle === "POSSESSION_CONTROL" ? "possession retention" : planStyle === "FORWARD_HALF_PRESSURE" ? "forward-half pressure" : planStyle === "TERRITORY_FOOTBALL" ? "territory" : planStyle === "SLINGSHOT" || planStyle === "FAST_TRANSITION" ? "transition" : planStyle === "DEFENCE_FIRST" ? "defensive shape" : "balanced phases";
  return {
    playerStats,
    teamStats: {
      disposals: totalDisposals,
      kicks: totalKicks,
      handballs: totalHandballs,
      marks: playerStats.reduce((sum, stat) => sum + stat.marks, 0),
      tackles: playerStats.reduce((sum, stat) => sum + stat.tackles, 0),
      clearances: playerStats.reduce((sum, stat) => sum + stat.clearances, 0),
      inside50s: playerStats.reduce((sum, stat) => sum + stat.inside50s, 0),
      rebound50s: playerStats.reduce((sum, stat) => sum + stat.rebound50s, 0),
      intercepts: playerStats.reduce((sum, stat) => sum + stat.intercepts, 0),
      turnovers: playerStats.reduce((sum, stat) => sum + stat.turnovers, 0),
      hitouts: playerStats.reduce((sum, stat) => sum + stat.hitouts, 0),
      freeKicksFor: playerStats.reduce((sum, stat) => sum + stat.freeKicksFor, 0),
      freeKicksAgainst: playerStats.reduce((sum, stat) => sum + stat.freeKicksAgainst, 0),
      contestedPossessions: totalContested,
      uncontestedPossessions: Math.max(0, totalDisposals - totalContested),
      disposalEfficiency: totalDisposals ? roundTo(totalEffective / totalDisposals * 100, 1) : 0,
      goalAccuracy: totalScoringShots ? roundTo(goals / totalScoringShots * 100, 1) : 0,
      tacticalFocus: styleFocus,
    },
  };
}

function performanceScore(stat) {
  if (!stat) return 0;
  const position = stat.matchPosition ?? stat.positions?.[0] ?? "UTIL";
  const weight = (key, multiplier = 1) => (stat[key] ?? 0) * multiplier;
  // Role weights allow defensive interceptors and rucks to score well without
  // requiring the disposal totals expected from a midfielder.
  return weight("disposals", 0.55) + weight("goals", 5) + weight("clearances", 2.3)
    + weight("tackles", 1.25) + weight("marks", 0.8) + weight("inside50s", 0.8)
    + weight("intercepts", ["KPD", "BP", "HB"].includes(position) ? 3.6 : 1.2)
    + weight("rebound50s", ["KPD", "BP", "HB"].includes(position) ? 2.4 : 0.8)
    + weight("hitouts", ["RUC", "RUCK"].includes(position) ? 0.5 : 0.03)
    + weight("contestedPossessions", 0.45);
}

function awardVotes(match) {
  // A match can contain old generated "squad" rows or duplicate rows after a
  // save migration. Never let those become a single undefined leaderboard entry.
  const allPlayers = [...(match.playerStats?.home ?? []), ...(match.playerStats?.away ?? [])]
    .filter((stat) => stat && stat.playerName && stat.club)
    .map((stat) => ({
      ...stat,
      playerId: stat.playerId ?? `${normalizeClubName(stat.club)}:${normalizePlayerName(stat.playerName)}`,
    }))
    .filter((stat, index, rows) => rows.findIndex((candidate) => String(candidate.playerId) === String(stat.playerId)) === index);
  const margin = (match.homeScore ?? 0) - (match.awayScore ?? 0);
  const winner = margin > 0 ? match.homeTeam : margin < 0 ? match.awayTeam : null;
  const ranked = allPlayers.slice().sort((a, b) => performanceScore(b) - performanceScore(a) || String(a.playerName).localeCompare(String(b.playerName)));
  // Coaches assess the same game from their own perspective. A modest winner
  // bonus reflects match impact while the stat score remains the main driver.
  const ballot = (coachClub) => allPlayers
    .map((stat) => ({ ...stat, score: performanceScore(stat) + (winner && stat.club === winner ? 1.5 : 0) + (stat.club === coachClub ? 0.15 : 0) }))
    .sort((a, b) => b.score - a.score || String(a.playerName).localeCompare(String(b.playerName)) || String(a.playerId).localeCompare(String(b.playerId)))
    .slice(0, 5)
    .map((stat, index) => ({ playerId: stat.playerId, playerName: stat.playerName, club: stat.club, votes: 5 - index }));
  const homeCoach = ballot(match.homeTeam);
  const awayCoach = ballot(match.awayTeam);
  const totals = new Map();
  for (const vote of [...homeCoach, ...awayCoach]) totals.set(vote.playerId, { playerId: vote.playerId, playerName: vote.playerName, club: vote.club, votes: (totals.get(vote.playerId)?.votes ?? 0) + vote.votes });
  return { version: 2, homeCoach, awayCoach, totals: [...totals.values()].sort((a, b) => b.votes - a.votes), bestPlayer: ranked[0] ? { playerId: ranked[0].playerId, playerName: ranked[0].playerName, club: ranked[0].club } : null };
}

function buildMatchReview(match) {
  const home = match.teamStats?.home ?? {};
  const away = match.teamStats?.away ?? {};
  const homeWon = Number(match.homeScore ?? 0) > Number(match.awayScore ?? 0);
  const awayWon = Number(match.awayScore ?? 0) > Number(match.homeScore ?? 0);
  const winner = homeWon ? match.homeTeam : awayWon ? match.awayTeam : null;
  const factors = [
    ["clearances", "clearances", 1.1], ["inside50s", "inside 50s", 1.1], ["tackles", "tackles", 0.9],
    ["disposals", "disposals", 0.6], ["marks", "marks", 0.7], ["hitouts", "hitouts", 0.8],
    ["goalAccuracy", "goal accuracy", 0.7],
  ].map(([key, label, weight]) => ({
    key,
    label,
    home: Number(home[key] ?? 0),
    away: Number(away[key] ?? 0),
    weight,
  })).filter((item) => item.home !== item.away)
    .sort((a, b) => Math.abs(b.home - b.away) / Math.max(1, (b.home + b.away) / 2) * b.weight - Math.abs(a.home - a.away) / Math.max(1, (a.home + a.away) / 2) * a.weight);
  const decisive = factors[0];
  const leader = decisive ? (decisive.home > decisive.away ? match.homeTeam : match.awayTeam) : null;
  const leaderValue = decisive ? Math.max(decisive.home, decisive.away) : 0;
  const otherValue = decisive ? Math.min(decisive.home, decisive.away) : 0;
  const best = match.coachesVotes?.bestPlayer ?? null;
  const players = [...(match.playerStats?.home ?? []), ...(match.playerStats?.away ?? [])]
    .filter((player) => player?.playerName)
    .sort((a, b) => performanceScore(b) - performanceScore(a) || a.playerName.localeCompare(b.playerName))
    .slice(0, 3)
    .map((player) => ({ name: player.playerName, club: player.club, score: roundTo(performanceScore(player), 1) }));
  const factorText = decisive
    ? `${leader} led ${decisive.label} ${leaderValue}–${otherValue}.`
    : "The key statistical measures were level.";
  const outcomeText = winner
    ? `${winner} won by ${Math.abs(Number(match.homeScore ?? 0) - Number(match.awayScore ?? 0))} points.`
    : "The match finished level.";
  const tacticsText = Object.entries(match.tacticalPlans ?? {})
    .map(([club, plan]) => `${club}: ${String(plan?.style ?? "Adaptive Hybrid").replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())}`)
    .join(" · ");
  const focusStat = (style) => style === "CONTEST_CLEARANCE" ? ["clearances", "clearances"]
    : style === "POSSESSION_CONTROL" ? ["disposalEfficiency", "disposal efficiency"]
      : style === "FORWARD_HALF_PRESSURE" ? ["tackles", "tackles"]
        : style === "TERRITORY_FOOTBALL" ? ["inside50s", "inside 50s"]
          : style === "SLINGSHOT" || style === "FAST_TRANSITION" ? ["rebound50s", "rebound 50s"]
            : style === "DEFENCE_FIRST" ? ["intercepts", "intercepts"] : ["contestedPossessions", "contested possessions"];
  const tacticalOutcomes = Object.entries(match.tacticalPlans ?? {}).map(([club, plan]) => {
    const ownSide = club === match.homeTeam ? "home" : "away";
    const oppSide = ownSide === "home" ? "away" : "home";
    const [key, label] = focusStat(plan?.style);
    const ownValue = Number(match.teamStats?.[ownSide]?.[key] ?? 0);
    const opponentValue = Number(match.teamStats?.[oppSide]?.[key] ?? 0);
    const percentage = key === "disposalEfficiency";
    return {
      club,
      focus: label,
      ownValue,
      opponentValue,
      achieved: ownValue > opponentValue,
      summary: `${club} targeted ${label} and recorded ${ownValue}${percentage ? "%" : ""} against ${opponentValue}${percentage ? "%" : ""} for the opposition.`,
    };
  });
  return {
    winner,
    outcomeText,
    decisiveFactor: decisive ? { ...decisive, leader } : null,
    factorText,
    summary: `${outcomeText} ${factorText}`,
    tacticalSummary: tacticsText,
    tacticalOutcomes,
    bestPlayer: best ? { name: best.playerName, club: best.club, votes: best.votes } : players[0] ?? null,
    topPerformers: players,
    tacticalPlans: match.tacticalPlans ?? null,
  };
}

function hasCompleteVotes(votes, match) {
  if (votes?.version !== 2 || !Array.isArray(votes.homeCoach) || !Array.isArray(votes.awayCoach) || !Array.isArray(votes.totals)) return false;
  const eligibleIds = new Set([...(match.playerStats?.home ?? []), ...(match.playerStats?.away ?? [])]
    .filter((stat) => stat?.playerName && stat?.club)
    .map((stat) => String(stat.playerId ?? `${normalizeClubName(stat.club)}:${normalizePlayerName(stat.playerName)}`)));
  const ballotIsValid = (ballot) => ballot.length === 5
    && new Set(ballot.map((vote) => String(vote.playerId))).size === 5
    && ballot.every((vote, index) => Number(vote.votes) === 5 - index && eligibleIds.has(String(vote.playerId)));
  if (!ballotIsValid(votes.homeCoach) || !ballotIsValid(votes.awayCoach)) return false;
  const calculated = new Map();
  for (const vote of [...votes.homeCoach, ...votes.awayCoach]) calculated.set(String(vote.playerId), (calculated.get(String(vote.playerId)) ?? 0) + Number(vote.votes));
  return calculated.size === votes.totals.length && votes.totals.every((vote) => calculated.get(String(vote.playerId)) === Number(vote.votes));
}

/** Repair old or incomplete home-and-away vote records without changing valid ballots. */
export function ensureMatchCoachesVotes(match) {
  const normalized = normalizeLegacyMatch(match);
  if (!normalized?.playerStats?.home?.length || !normalized?.playerStats?.away?.length) return normalized;
  const result = hasCompleteVotes(normalized.coachesVotes, normalized)
    ? normalized
    : { ...normalized, coachesVotes: awardVotes(normalized) };
  return result.matchReview ? result : { ...result, matchReview: buildMatchReview(result) };
}

export function attachMatchStatistics(match, { lineupsByClub = {}, contractsByPlayer = {}, awardCoachesVotes = true, playerPool = players, random = Math.random, traitModifiersByPlayer = {} } = {}) {
  if (match.playerStats?.home?.length && match.teamStats?.home) {
    if (!awardCoachesVotes) return { ...match, coachesVotes: null, matchReview: buildMatchReview(match) };
    const enriched = ensureMatchCoachesVotes(match);
    return { ...enriched, brownlowVotes: enriched.brownlowVotes ?? awardBrownlowVotes(enriched) };
  }
  const homeTeam = match.homeTeam ?? match.home;
  const awayTeam = match.awayTeam ?? match.away;
  const home = makeSideStats(homeTeam, awayTeam, match, "home", lineupsByClub[homeTeam], contractsByPlayer, playerPool, random, traitModifiersByPlayer.home ?? {});
  const away = makeSideStats(awayTeam, homeTeam, match, "away", lineupsByClub[awayTeam], contractsByPlayer, playerPool, random, traitModifiersByPlayer.away ?? {});
  const enriched = {
    ...match,
    homeTeam,
    awayTeam,
    playerStats: { home: home.playerStats, away: away.playerStats },
    teamStats: { home: home.teamStats, away: away.teamStats },
  };
  enriched.coachesVotes = awardCoachesVotes ? awardVotes(enriched) : null;
  enriched.brownlowVotes = awardCoachesVotes ? awardBrownlowVotes(enriched) : null;
  enriched.matchReview = buildMatchReview(enriched);
  return enriched;
}

export function collectSeasonMatches(seasonState, { includeFinals = true } = {}) {
  const matches = (seasonState?.roundHistory ?? []).flatMap((entry) => (entry.results ?? []).map((result) => ensureMatchCoachesVotes({ ...result, seasonYear: seasonState.seasonYear, stage: "HOME_AND_AWAY", round: entry.round })));
  if (includeFinals) {
    for (const week of seasonState?.finalsHistory ?? []) matches.push(...(week.results ?? []).map((result) => normalizeLegacyMatch({ ...result, seasonYear: seasonState.seasonYear, stage: "FINALS", round: week.label })));
    matches.push(...(seasonState?.wildcardResults ?? []).map((result) => normalizeLegacyMatch({ ...result, seasonYear: seasonState.seasonYear, stage: "WILDCARD", round: "Wildcard" })));
  }
  for (const archive of seasonState?.seasonArchive ?? []) {
    matches.push(...(archive.roundHistory ?? []).flatMap((entry) => (entry.results ?? []).map((result) => ensureMatchCoachesVotes({ ...result, seasonYear: archive.year, stage: "HOME_AND_AWAY", round: entry.round }))));
    if (includeFinals) matches.push(...(archive.wildcardResults ?? []).map((result) => normalizeLegacyMatch({ ...result, seasonYear: archive.year, stage: "WILDCARD", round: "Wildcard" })));
    if (includeFinals) for (const week of archive.finalsHistory ?? []) matches.push(...(week.results ?? []).map((result) => normalizeLegacyMatch({ ...result, seasonYear: archive.year, stage: "FINALS", round: week.label })));
  }
  // A save can contain the same season in both the live history and its
  // archive, or contain a round twice after a resumed simulation. Count each
  // fixture once, including when the two copies have different fixture IDs.
  const unique = new Map();
  for (const match of matches) {
    const clubs = [match.homeTeam ?? match.home, match.awayTeam ?? match.away]
      .map((club) => String(club ?? "").trim()).sort().join(":");
    const key = clubs && match.seasonYear != null && match.round != null
      ? `${match.seasonYear}:${match.stage}:${match.round}:${clubs}`
      : String(match.fixtureId ?? match.id ?? `${match.seasonYear}:${match.date}:${clubs}`);
    const previous = unique.get(key);
    if (!previous || (!previous.playerStats?.home?.length && match.playerStats?.home?.length)) unique.set(key, match);
  }
  return [...unique.values()];
}

export function aggregatePlayerStats(matches, playerId, seasonYear = null) {
  const totals = Object.fromEntries(PLAYER_STAT_KEYS.map((key) => [key, 0]));
  let games = 0;
  const seasons = new Set();
  const clubMatches = {};
  const coachesVotes = [];
  for (const match of matches ?? []) {
    if (seasonYear != null && Number(match.seasonYear) !== Number(seasonYear)) continue;
    const stat = [...(match.playerStats?.home ?? []), ...(match.playerStats?.away ?? [])]
      .find((item) => String(item.playerId) === String(playerId) && Number(item.timeOnGround ?? 1) > 0);
    if (!stat) continue;
    games += 1;
    seasons.add(match.seasonYear);
    for (const key of PLAYER_STAT_KEYS) totals[key] += Number(stat[key]) || 0;
    clubMatches[stat.club] = (clubMatches[stat.club] ?? 0) + 1;
    const votes = match.coachesVotes?.totals?.find((item) => String(item.playerId) === String(playerId))?.votes ?? 0;
    if (votes) coachesVotes.push({ seasonYear: match.seasonYear, round: match.round, votes });
  }
  return { games, totals, averages: Object.fromEntries(PLAYER_STAT_KEYS.map((key) => [key, games ? roundTo(totals[key] / games, 1) : 0])), clubMatches, coachesVotes };
}

export function buildStatisticsSummary(matches) {
  const playersById = new Map();
  const teamTotals = {};
  const voteTotals = new Map();
  for (const match of matches ?? []) {
    for (const side of ["home", "away"]) {
      const club = side === "home" ? match.homeTeam : match.awayTeam;
      const stats = match.teamStats?.[side];
      if (club && stats) {
        const entry = teamTotals[club] ?? { club, matches: 0 };
        entry.matches += 1;
        for (const [key, value] of Object.entries(stats)) entry[key] = (entry[key] ?? 0) + (Number(value) || 0);
        teamTotals[club] = entry;
      }
      for (const stat of match.playerStats?.[side] ?? []) {
        const entry = playersById.get(String(stat.playerId)) ?? { playerId: stat.playerId, playerName: stat.playerName, club: stat.club, games: 0 };
        entry.games += 1;
        for (const key of PLAYER_STAT_KEYS) entry[key] = (entry[key] ?? 0) + (Number(stat[key]) || 0);
        playersById.set(String(stat.playerId), entry);
      }
    }
    const validVotes = match.stage !== "FINALS" && match.stage !== "WILDCARD" && hasCompleteVotes(match.coachesVotes, match);
    if (validVotes) {
      for (const stat of [...(match.playerStats?.home ?? []), ...(match.playerStats?.away ?? [])]) {
        const key = String(stat.playerId);
        const entry = voteTotals.get(key) ?? { playerId: stat.playerId, playerName: stat.playerName, club: stat.club, votes: 0, games: 0 };
        entry.games += 1;
        voteTotals.set(key, entry);
      }
    }
    for (const vote of validVotes ? match.coachesVotes.totals : []) {
      const entry = voteTotals.get(String(vote.playerId)) ?? { ...vote, votes: 0, games: 0 };
      entry.votes += vote.votes;
      voteTotals.set(String(vote.playerId), entry);
    }
  }
  return {
    players: [...playersById.values()],
    teams: Object.values(teamTotals),
    aflca: [...voteTotals.values()].map((entry) => ({ ...entry, averageVotes: entry.games ? roundTo(entry.votes / entry.games, 2) : 0 })).sort((a, b) => b.votes - a.votes),
  };
}