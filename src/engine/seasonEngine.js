import { simulateMatch } from "./matchEngine.js";
import { attachMatchStatistics, getPlayingPosition } from "./statisticsEngine.js";
import { DEFAULT_TACTICS, recommendTactics } from "./tacticsEngine.js";
import { getCareerClub } from "./contractEngine.js";
import { buildMatchupModel, getMatchupSlotFamily } from "./matchupEngine.js";
import { getPlayerTraitIds } from "../data/footballData.js";
import { evaluateTraitContext } from "./traitEngine.js";
import { createAssistantTeamSelection } from "./teamSelectionEngine.js";
import { lineMatchEffects, selectedSideStrength } from "./tacticalMatchModel.js";

const fatiguePenaltyFor = (match, side, fatigueByClub) => {
  const team = match[side];
  const teamPenalty = fatigueByClub?.[team]?.ratingPenalty;
  if (Number.isFinite(teamPenalty)) return teamPenalty;
  const explicitPenalty = match[`${side}FatiguePenalty`];
  return Number.isFinite(explicitPenalty) ? explicitPenalty : 0;
};

const mergeTraitEffects = (own = {}, opponent = {}) => {
  const merged = Object.fromEntries(Object.entries(own).map(([id, effects]) => [id, { ...effects }]));
  for (const [id, effects] of Object.entries(opponent)) {
    const current = merged[id] ?? {};
    merged[id] = { ...current };
    for (const [key, value] of Object.entries(effects)) merged[id][key] = Math.max(-.1, Math.min(.1, Number(current[key] ?? 0) + value));
  }
  return merged;
};

function simulationLineup(team, players, suppliedLineup) {
  const byId = new Map(players.map((player) => [String(player.id), player]));
  const supplied = Array.isArray(suppliedLineup) ? suppliedLineup : [];
  const fieldEntries = supplied.filter((entry) => entry?.position && !String(entry.position).startsWith("INT"));
  if (fieldEntries.length >= 18) return fieldEntries.map((entry) => ({
    position: entry.position,
    player: byId.get(String((entry.player ?? entry)?.id)) ?? entry.player ?? entry,
  })).filter((entry) => entry.player);
  const selection = createAssistantTeamSelection(players);
  return Object.entries(selection.selectedSide ?? {}).map(([position, name]) => ({
    position,
    player: players.find((player) => player.name === name),
  })).filter((entry) => entry.player);
}

function teamTraitImpact(ownLineup, opponentLineup, ownTactics, opponentTactics, playerFitness = {}) {
  const model = buildMatchupModel(ownLineup, opponentLineup, { tactics: ownTactics, opponentTactics, playerFitness });
  let scoring = 0;
  let contest = 0;
  let defence = 0;
  let clutch = 0;
  const playerEffects = {};
  const opponentEffects = {};
  const counted = new Set();
  for (const pair of model.matchups) {
    const player = model.ownSlots.get(pair.ownSlot)?.player;
    const opponent = model.opponentSlots.get(pair.opponentSlot)?.player;
    if (!player || !opponent || counted.has(String(player.id))) continue;
    counted.add(String(player.id));
    const phases = ["stoppage", "contest", "groundBall", "transition", "forwardEntry", "aerialContest", "defensiveContest", "scoring"];
    let playerScoring = 0;
    let playerContest = 0;
    let playerDefence = 0;
    const effects = {};
    for (const phase of phases) {
      const { active, modifiers } = evaluateTraitContext(player, {
        phase, opponent, roleFamily: pair.line, opponentRoleFamily: getMatchupSlotFamily(pair.opponentSlot), tactics: ownTactics,
        opponentTactics, fitness: playerFitness[player.id]?.fitness ?? 100,
        matchSharpness: playerFitness[player.id]?.matchSharpness ?? 75,
        opponentFitness: playerFitness[opponent.id]?.fitness ?? 100,
        opponentMatchSharpness: playerFitness[opponent.id]?.matchSharpness ?? 75,
        setShot: phase === "scoring",
      });
      if (!active.length) continue;
      const scoringCandidate = modifiers.scoringRate + modifiers.inside50 * .12 + modifiers.mark * .08;
      const contestCandidate = modifiers.clearance * 8 + modifiers.contested * 4 + modifiers.tackle * 2;
      if (Math.abs(scoringCandidate) > Math.abs(playerScoring)) playerScoring = scoringCandidate;
      if (Math.abs(contestCandidate) > Math.abs(playerContest)) playerContest = contestCandidate;
      playerDefence = Math.max(playerDefence, -modifiers.opponentScoringRate);
      for (const [key, value] of Object.entries(modifiers)) {
        if (Math.abs(value) > Math.abs(effects[key] ?? 0)) effects[key] = value;
      }
    }
    scoring = Math.max(-.1, Math.min(.1, scoring + playerScoring));
    contest = Math.max(-2, Math.min(2, contest + playerContest));
    defence = Math.min(.1, defence + playerDefence);
    if (getPlayerTraitIds(player).includes("CLUTCH_PERFORMER")) {
      const late = evaluateTraitContext(player, { phase: "scoring", opponent, roleFamily: pair.line,
        opponentRoleFamily: getMatchupSlotFamily(pair.opponentSlot),
        tactics: ownTactics, opponentTactics, fitness: playerFitness[player.id]?.fitness ?? 100,
        matchSharpness: playerFitness[player.id]?.matchSharpness ?? 75,
        opponentFitness: playerFitness[opponent.id]?.fitness ?? 100,
        opponentMatchSharpness: playerFitness[opponent.id]?.matchSharpness ?? 75,
        minute: 78, scoreMargin: 0 });
      clutch = Math.min(.12, clutch + late.modifiers.scoringRate);
    }
    if (Object.values(effects).some((value) => value !== 0)) playerEffects[String(player.id)] = effects;
    const opposing = {};
    for (const [source, target] of [["opponentEffectiveDisposal", "effectiveDisposal"], ["opponentMark", "mark"],
      ["opponentScoringRate", "scoringRate"], ["opponentClearance", "clearance"]]) {
      if (effects[source]) opposing[target] = effects[source];
    }
    if (Object.keys(opposing).length) opponentEffects[String(opponent.id)] = opposing;
  }
  if ([...model.ownSlots.values()].some((entry) => getPlayerTraitIds(entry.player).includes("FIELD_GENERAL"))) {
    for (const entry of model.ownSlots.values()) {
      const id = String(entry.player.id);
      playerEffects[id] = { ...(playerEffects[id] ?? {}),
        effectiveDisposal: Math.min(.08, Number(playerEffects[id]?.effectiveDisposal ?? 0) + .01) };
    }
  }
  return { scoring, contest, defence, clutch, playerEffects, opponentEffects, matchup: lineMatchEffects(model) };
}

export function calculateTraitMatchImpacts(homeLineup, awayLineup, homeTactics, awayTactics, playerFitness = {}) {
  return {
    home: teamTraitImpact(homeLineup, awayLineup, homeTactics, awayTactics, playerFitness),
    away: teamTraitImpact(awayLineup, homeLineup, awayTactics, homeTactics, playerFitness),
  };
}

export function simulateSeasonRound(
  ladder,
  fixtureRound,
  { fatigueByClub = {}, tacticsByClub = {}, playedResult = null, lineupsByClub = {}, contractsByPlayer = {}, playerPool, playerFitness = {}, leadershipByClub = {}, random = Math.random } = {},
) {
  const rawResults = fixtureRound.matches.map((match) => {
    const home = match.homeTeam ?? match.home;
    const away = match.awayTeam ?? match.away;

    if (playedResult) {
      const playedHome = playedResult.homeTeam ?? playedResult.home;
      const playedAway = playedResult.awayTeam ?? playedResult.away;
      const isThisMatch =
        (playedHome === home && playedAway === away) ||
        (playedHome === away && playedAway === home);

      if (isThisMatch) {
        const normalized = playedHome === home
          ? playedResult
          : {
              ...playedResult,
              homeTeam: playedResult.awayTeam,
              awayTeam: playedResult.homeTeam,
              homeGoals: playedResult.awayGoals,
              homeBehinds: playedResult.awayBehinds,
              awayGoals: playedResult.homeGoals,
              awayBehinds: playedResult.homeBehinds,
              homeScore: playedResult.awayScore,
              awayScore: playedResult.homeScore,
            };

        const homeFatiguePenalty = fatiguePenaltyFor(match, "home", fatigueByClub);
        const awayFatiguePenalty = fatiguePenaltyFor(match, "away", fatigueByClub);
        return {
          ...normalized,
          tacticalPlans: {
            ...(normalized.tacticalPlans ?? {}),
            [home]: tacticsByClub[home] ?? normalized.tacticalPlans?.[home] ?? DEFAULT_TACTICS,
            [away]: tacticsByClub[away] ?? normalized.tacticalPlans?.[away] ?? DEFAULT_TACTICS,
          },
          date: match.date,
          venue: match.venue,
          homeRestDays: match.homeRestDays,
          awayRestDays: match.awayRestDays,
          homeFatiguePenalty,
          awayFatiguePenalty,
        };
      }
    }

    const homeFatiguePenalty = fatiguePenaltyFor(match, "home", fatigueByClub);
    const awayFatiguePenalty = fatiguePenaltyFor(match, "away", fatigueByClub);
    const playersFor = (team) => {
      const clubPlayers = (playerPool ?? []).filter((player) => getCareerClub(player, contractsByPlayer) === team);
      const selectedLineup = lineupsByClub[team];
      if (!Array.isArray(selectedLineup) || !selectedLineup.length) return clubPlayers;
      return selectedLineup.map((entry) => {
        if (typeof entry === "string") return clubPlayers.find((player) => player.name === entry);
        const selectedPlayer = entry?.player ?? entry;
        const player = clubPlayers.find((candidate) => String(candidate.id) === String(selectedPlayer?.id)
          || candidate.name === selectedPlayer?.name);
        return player ? { ...player, matchPosition: entry?.matchPosition ?? getPlayingPosition(player, entry?.position ?? entry?.slot) } : null;
      }).filter(Boolean);
    };
    const homePlayers = playersFor(home);
    const awayPlayers = playersFor(away);
    const homeLineup = simulationLineup(home, homePlayers, lineupsByClub[home]);
    const awayLineup = simulationLineup(away, awayPlayers, lineupsByClub[away]);
    const squadFor = (team) => (playerPool ?? []).filter((player) => getCareerClub(player, contractsByPlayer) === team);
    const homeStrength = selectedSideStrength(-homeFatiguePenalty, homeLineup, playerFitness,
      { leadershipGroup: leadershipByClub[home], squadPlayers: squadFor(home), contracts: contractsByPlayer });
    const awayStrength = selectedSideStrength(-awayFatiguePenalty, awayLineup, playerFitness,
      { leadershipGroup: leadershipByClub[away], squadPlayers: squadFor(away), contracts: contractsByPlayer });
    const round = fixtureRound.round ?? match.round ?? null;
    const rankOf = (team) => { const index = (ladder ?? []).findIndex((entry) => entry.club === team); return index >= 0 ? index + 1 : null; };
    const clubCount = (ladder ?? []).length || 18;
    const situation = (isHome, ownStrength, otherStrength, team, other) => ({
      round, isHome, clubCount, ladderRank: rankOf(team), opponentRank: rankOf(other),
      strengthGap: Number((ownStrength - otherStrength).toFixed(2)),
    });
    let homeTactics = tacticsByClub[home] ?? normalizedTacticPlan(homeLineup, home, tacticsByClub[away], situation(true, homeStrength, awayStrength, home, away));
    let awayTactics = tacticsByClub[away] ?? normalizedTacticPlan(awayLineup, away, tacticsByClub[home], situation(false, awayStrength, homeStrength, away, home));
    if (!tacticsByClub[home]) homeTactics = normalizedTacticPlan(homeLineup, home, awayTactics, situation(true, homeStrength, awayStrength, home, away));
    if (!tacticsByClub[away]) awayTactics = normalizedTacticPlan(awayLineup, away, homeTactics, situation(false, awayStrength, homeStrength, away, home));
    const traitImpacts = calculateTraitMatchImpacts(
      homeLineup,
      awayLineup,
      homeTactics, awayTactics, playerFitness,
    );
    const result = simulateMatch(
      home,
      away,
      homeStrength,
      awayStrength,
      homeTactics,
      awayTactics,
      { homePlayers: homeLineup, awayPlayers: awayLineup, random, homeTraitImpact: traitImpacts.home, awayTraitImpact: traitImpacts.away },
    );

    return {
      ...result,
      _traitEffects: {
        home: mergeTraitEffects(traitImpacts.home.playerEffects, traitImpacts.away.opponentEffects),
        away: mergeTraitEffects(traitImpacts.away.playerEffects, traitImpacts.home.opponentEffects),
      },
      tacticalPlans: { [home]: homeTactics, [away]: awayTactics },
      matchupEffects: { home: traitImpacts.home.matchup, away: traitImpacts.away.matchup },
      date: match.date,
      venue: match.venue,
      homeRestDays: match.homeRestDays,
      awayRestDays: match.awayRestDays,
      homeFatiguePenalty,
      awayFatiguePenalty,
    };
  });

  // One shared enrichment path keeps simulated and played results structurally
  // identical, and ensures AFLCA ballots are stored with the match record.
  const results = rawResults.map((result, index) => {
    const stage = fixtureRound.matches[index]?.stage ?? 'LEAGUE';
    const enriched = attachMatchStatistics({ ...result, stage }, {
      lineupsByClub, contractsByPlayer, playerPool, random,
      awardCoachesVotes: stage === 'LEAGUE',
      traitModifiersByPlayer: result._traitEffects,
    });
    const { _traitEffects, ...stored } = enriched;
    return stored;
  });

  const updatedLadder = ladder.map((club) => ({
    ...club,
    form: [...(club.form ?? [])],
  }));

  const previousPositions = {};
  ladder.forEach((club, index) => {
    previousPositions[club.club] = index + 1;
  });

  results.forEach((match) => {
    const homeClub = updatedLadder.find((club) => club.club === match.homeTeam);
    const awayClub = updatedLadder.find((club) => club.club === match.awayTeam);
    if (!homeClub || !awayClub) return;

    homeClub.pointsFor += match.homeScore;
    homeClub.pointsAgainst += match.awayScore;
    awayClub.pointsFor += match.awayScore;
    awayClub.pointsAgainst += match.homeScore;

    if (match.homeScore > match.awayScore) {
      homeClub.wins += 1;
      homeClub.points += 4;
      awayClub.losses += 1;
      homeClub.form.unshift("W");
      awayClub.form.unshift("L");
    } else if (match.awayScore > match.homeScore) {
      awayClub.wins += 1;
      awayClub.points += 4;
      homeClub.losses += 1;
      awayClub.form.unshift("W");
      homeClub.form.unshift("L");
    } else {
      homeClub.draws += 1;
      awayClub.draws += 1;
      homeClub.points += 2;
      awayClub.points += 2;
      homeClub.form.unshift("D");
      awayClub.form.unshift("D");
    }

    homeClub.form = homeClub.form.slice(0, 5);
    awayClub.form = awayClub.form.slice(0, 5);
  });

  updatedLadder.forEach((club) => {
    club.percentage = club.pointsAgainst === 0
      ? 100
      : Number(((club.pointsFor / club.pointsAgainst) * 100).toFixed(1));
  });

  updatedLadder.sort((a, b) =>
    (b.points - a.points) ||
    (b.percentage - a.percentage) ||
    (b.wins - a.wins)
  );

  updatedLadder.forEach((club, index) => {
    const currentPosition = index + 1;
    const previousPosition = previousPositions[club.club];
    club.previousPosition = previousPosition;
    if (previousPosition == null) club.movement = "-";
    else if (currentPosition < previousPosition) club.movement = "↑";
    else if (currentPosition > previousPosition) club.movement = "↓";
    else club.movement = "→";
  });

  return { ladder: updatedLadder, results };
}

// `club` seeds the coach's personality, so a club keeps the same approach across opponents;
// `situation` lets the plan react to this week's opponent, venue, ladder position and strength gap.
function normalizedTacticPlan(roster, club, opponentPlan, situation = {}) {
  const selected = Array.isArray(roster) && roster.length ? roster : [];
  return recommendTactics(selected, { opponentStyle: opponentPlan?.style ?? null, seed: club, context: situation });
}