import { nextUserFixture } from "../engine/worldSimulationEngine.js";
import { useEffect, useState } from "react";
import { calculateTraitMatchImpacts, simulateSeasonRound } from "../engine/seasonEngine.js";
import { generateFixture } from "../engine/fixtureGenerator.js";
import ClubBadge from "./ClubBadge.jsx";
import { clubs } from "../data/clubs.js";
import { getClubBestTeam } from "../engine/clubStrengthEngine.js";
import { getCareerPlayer } from "../engine/developmentEngine.js";
import { attachMatchStatistics, buildStatisticsSummary, getPlayingPosition } from "../engine/statisticsEngine.js";
import { FINALS_WEEK_LABELS, getFinalsMatchups, getFinalsStandings, getWildcardMatchups } from "../engine/finalsEngine.js";
import { simulateMatch } from "../engine/matchEngine.js";
import { resolveKnockoutTie } from "../engine/finalsResultEngine.js";
import { getCareerClub } from "../engine/contractEngine.js";
import { createAssistantTeamSelection } from "../engine/teamSelectionEngine.js";
import { selectedSideStrength } from "../engine/tacticalMatchModel.js";
import { recommendTactics } from "../engine/tacticsEngine.js";
import SeasonFinale from "./SeasonFinale.jsx";
import FinalsBracket from "./FinalsBracket.jsx";
import { buildFinalsBracket } from "../engine/finalsBracket.js";

const finalsWeekLabels = FINALS_WEEK_LABELS;

const teamAbbreviations = {
  Adelaide: "ADE", "Adelaide Crows": "ADE",
  Brisbane: "BL", "Brisbane Lions": "BL",
  Carlton: "CAR",
  Collingwood: "COL",
  Essendon: "ESS", "Essendon Bombers": "ESS",
  Fremantle: "FRE", "Fremantle Dockers": "FRE",
  Geelong: "GEE", "Geelong Cats": "GEE",
  "Gold Coast": "GC", "Gold Coast Suns": "GC",
  GWS: "GWS", "Greater Western Sydney": "GWS", "GWS Giants": "GWS",
  Hawthorn: "HAW",
  Melbourne: "MEL",
  "North Melbourne": "NM", "North Melbourne Kangaroos": "NM",
  "Port Adelaide": "PA", "Port Adelaide Power": "PA",
  Richmond: "RICH",
  "St Kilda": "STK", "St Kilda Saints": "STK",
  Sydney: "SYD", "Sydney Swans": "SYD",
  "West Coast": "WCE", "West Coast Eagles": "WCE",
  "Western Bulldogs": "WB",
};

const teamCode = (club) => teamAbbreviations[club] ?? club?.slice(0, 3).toUpperCase() ?? "";

export { scheduleFixtureAcrossWeekend } from "../engine/fixtureScheduler.js";
import { scheduleFixtureAcrossWeekend, parseFixtureDate } from "../engine/fixtureScheduler.js";

export default function SeasonScreen({ onSimulateCalendarStage, appearance, club, seasonState, onSeasonStateChange, onPlayMatch, onResumeMatch, playedMatchRound = null, onSimulatedMatch, trainingPlan = "BALANCED", playerFitness = {}, tactics, teamSheetConfirmed = false, teamSelection, selectionResponsibility = "COACH", onPrepareTeamSheet, onAdvanceToNextSeason, onOpenDraftBoard, onOpenBoard, onCalendarProgress, onCalendarProgressToDate, currentDate, players: playerPool, onOpenClub, navigationTab = null, navigationSequence = 0 }) {
  const selectedClubName = typeof club === "string" ? club : club?.name ?? club?.club;
  const appearanceMode = appearance ?? (
    typeof document !== "undefined" && document.documentElement.dataset.appearance === "light"
      ? "light"
      : "dark"
  );
  const lightMode = appearanceMode === "light";
  const finalsSeriesTheme = ["WILDCARD", "FINALS"].includes(seasonState?.phase);
  const palette = {
    text: lightMode ? "#0f172a" : "#f8fafc",
    muted: finalsSeriesTheme ? (lightMode ? "#766534" : "#c8bd94") : lightMode ? "#64748b" : "#94a3b8",
    card: finalsSeriesTheme ? (lightMode ? "#fffaf0" : "#1b170b") : lightMode ? "#ffffff" : "#0f172a",
    surface: finalsSeriesTheme ? (lightMode ? "#eee5c7" : "#29220f") : lightMode ? "#e2e8f0" : "#1e293b",
    border: finalsSeriesTheme ? "#9b7b2b" : lightMode ? "#cbd5e1" : "#334155",
    accent: finalsSeriesTheme ? "#d6b44a" : "#ea580c",
    accentText: finalsSeriesTheme ? "#211a08" : "#ffffff",
  };

  const [activeTab, setActiveTab] = useState("NEXT_ROUND");
  useEffect(() => { if (navigationTab) setActiveTab(navigationTab); }, [navigationSequence, navigationTab]);
  const [selectedReportMatch, setSelectedReportMatch] = useState(null);
  const [reportTab, setReportTab] = useState("MATCH_STATS");
  const [reportSort, setReportSort] = useState({ key: "disposals", direction: "desc" });
  const {
    seasonYear,
    round,
    ladder,
    roundHistory,
    selectedResultsRound,
    fixture,
    phase,
    offseasonStep = 0,
    wildcardResults,
    wildcardSeeds,
    finalsWeek,
    finalsHistory,
    premier,
    seasonArchive,
  } = seasonState;
  const updateSeasonState = (key) => (nextValue) => {
    onSeasonStateChange((previous) => ({
      ...previous,
      [key]: typeof nextValue === "function" ? nextValue(previous[key]) : nextValue,
    }));
  };
  const setSeasonYear = updateSeasonState("seasonYear");
  const setSeasonHasStarted = updateSeasonState("seasonHasStarted");
  const setRound = updateSeasonState("round");
  const setLadder = updateSeasonState("ladder");
  const setRoundHistory = updateSeasonState("roundHistory");
  const setSelectedResultsRound = updateSeasonState("selectedResultsRound");
  const setFixture = updateSeasonState("fixture");
  const setPhase = updateSeasonState("phase");
  const setWildcardResults = updateSeasonState("wildcardResults");
  const setWildcardSeeds = updateSeasonState("wildcardSeeds");
  const setFinalsWeek = updateSeasonState("finalsWeek");
  const setFinalsHistory = updateSeasonState("finalsHistory");
  const setPremier = updateSeasonState("premier");
  const setSeasonArchive = updateSeasonState("seasonArchive");
  const setOffseasonStep = updateSeasonState("offseasonStep");
  const nextBoardYear = Number(seasonYear) + (phase === "OFFSEASON" && seasonState.seasonHasStarted ? 1 : 0);
  const boardObjectivesFinalized = Number(seasonState.clubAdministration?.boardObjectives?.seasonYear) === nextBoardYear
    && Boolean(seasonState.clubAdministration?.boardObjectives?.negotiated);
  const hasStartedCurrentSeason = seasonState.seasonHasStarted ?? (
    Number(seasonYear) > 2027 ||
    (seasonArchive?.length ?? 0) > 0 ||
    (roundHistory?.length ?? 0) > 0
  );
  // The daily calendar advances seasonYear during the Jan 1 rollover, so in
  // calendar-driven PRESEASON the fixture and seasonYear already refer to the
  // season being started. Legacy/manual season states still need the increment.
  const seasonToStart = seasonState.calendarClock
    ? Number(seasonYear)
    : Number(seasonYear) + (hasStartedCurrentSeason ? 1 : 0);

  const standings = getFinalsStandings(ladder);
  const nextRound = fixture.find((item) => item.round === round);
  const nextClubMatch = seasonState.calendarClock ? nextUserFixture(seasonState, selectedClubName) : nextRound?.matches.find((match) =>
    (match.homeTeam ?? match.home) === selectedClubName ||
    (match.awayTeam ?? match.away) === selectedClubName
  ) ?? nextRound?.matches[0];
  const today = parseFixtureDate(currentDate) ?? new Date();
  const isDraftNight = phase === "OFFSEASON" && today.getMonth() === 10 && today.getDate() >= 25;
  const matchDate = parseFixtureDate(nextClubMatch?.date);
  const roundLastDate = nextRound?.matches
    .map((match) => parseFixtureDate(match.date))
    .filter(Boolean)
    .sort((a, b) => b.getTime() - a.getTime())[0];
  const dateKey = (date) => date ? new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() : 0;
  const canPlayNextMatch = !matchDate || dateKey(today) >= dateKey(matchDate);
  const canSimulateRound = !roundLastDate || dateKey(today) >= dateKey(roundLastDate);
  const wildcardMatches = phase === "WILDCARD" ? getWildcardMatchups(ladder, fixture) : [];
  const finalsMatches = phase === "FINALS" ? getFinalsMatchups({ ladder, fixture, wildcardSeeds, finalsWeek, finalsHistory }) : [];
  const wildcardMatchesWithResults = wildcardMatches.map((match) => ({
    ...match,
    ...(wildcardResults ?? []).find((result) => result.code === match.code),
  }));
  const finalsMatchesWithResults = finalsMatches.map((match) => ({
    ...match,
    ...(finalsHistory ?? []).flatMap((week) => week.results ?? []).find((result) => result.code === match.code),
  }));
  const latestStageDate = (matches) => matches.map((match) => parseFixtureDate(match.date)).filter(Boolean).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  const wildcardStageDate = latestStageDate(wildcardMatches);
  const finalsStageDate = latestStageDate(finalsMatches);
  const canPlayWildcardStage = !wildcardStageDate || dateKey(today) >= dateKey(wildcardStageDate);
  const canPlayFinalsStage = !finalsStageDate || dateKey(today) >= dateKey(finalsStageDate);
  const nextRoundFixtures = phase === "HOME_AND_AWAY"
    ? nextRound?.matches ?? []
    : phase === "WILDCARD"
      ? wildcardMatches
      : phase === "FINALS"
        ? finalsMatches
        : [];
  const nextRoundTitle = phase === "HOME_AND_AWAY"
    ? `Round ${round}`
    : phase === "WILDCARD"
      ? "Wildcard Finals"
      : phase === "FINALS"
        ? finalsWeekLabels[finalsWeek]
        : phase === "OFFSEASON"
          ? "Offseason"
          : phase === "PRESEASON"
            ? "Preseason"
            : "Season Complete";

  function simulateKnockoutMatches(matches) {
    return matches.map((match) => {
      const homeSeed = seedFor(match.home);
      const awaySeed = seedFor(match.away);
      const homeRating = Math.max(0, 11 - homeSeed) * 1.5 + 3;
      const awayRating = Math.max(0, 11 - awaySeed) * 1.5;
      const selectedClubLineup = selectedClubName && (selectedClubName === match.home || selectedClubName === match.away)
        ? Object.entries(teamSelection?.selectedSide ?? {}).flatMap(([position, playerName]) => {
            const player = playerPool.find((candidate) => candidate.name === playerName);
            return player ? [{ player, position, matchPosition: getPlayingPosition(player, position) }] : [];
          }) : null;
      const playersFor = (team) => {
        if (team === selectedClubName && selectedClubLineup?.length) return selectedClubLineup;
        const roster = (playerPool ?? []).filter((player) => getCareerClub(player, seasonState.playerContracts) === team);
        const sheet = createAssistantTeamSelection(roster);
        return Object.entries(sheet.selectedSide ?? {}).flatMap(([position, playerName]) => {
          const player = roster.find((candidate) => candidate.name === playerName);
          return player ? [{ player, position, matchPosition: getPlayingPosition(player, position) }] : [];
        });
      };
      const homePlayers = playersFor(match.home);
      const awayPlayers = playersFor(match.away);
      const homeTactics = match.home === selectedClubName ? tactics : recommendTactics(homePlayers, { seed: match.home, opponentStyle: match.away === selectedClubName ? tactics?.style : null });
      const awayTactics = match.away === selectedClubName ? tactics : recommendTactics(awayPlayers, { seed: match.away, opponentStyle: match.home === selectedClubName ? tactics?.style : null });
      const traitImpacts = calculateTraitMatchImpacts(homePlayers, awayPlayers, homeTactics, awayTactics, playerFitness);
      const played = simulateMatch(
        match.home,
        match.away,
        selectedSideStrength(homeRating, homePlayers, playerFitness),
        selectedSideStrength(awayRating, awayPlayers, playerFitness),
        homeTactics,
        awayTactics,
        { homePlayers, awayPlayers, homeTraitImpact: traitImpacts.home, awayTraitImpact: traitImpacts.away },
      );
      const decided = resolveKnockoutTie(played);
      return attachMatchStatistics({
        ...match,
        ...decided,
        tacticalPlans: { [match.home]: homeTactics, [match.away]: awayTactics },
        matchupEffects: { home: traitImpacts.home.matchup, away: traitImpacts.away.matchup },
        homeTeam: match.home,
        awayTeam: match.away,
        winner: decided.homeScore > decided.awayScore ? match.home : match.away,
      }, {
        awardCoachesVotes: false,
        contractsByPlayer: seasonState.playerContracts,
        playerPool,
        lineupsByClub: { [match.home]: homePlayers, [match.away]: awayPlayers },
        traitModifiersByPlayer: { home: traitImpacts.home.playerEffects, away: traitImpacts.away.playerEffects },
      });
    });
  }

  function seedFor(team) {
    const rank = standings.findIndex((club) => club.club === team) + 1;
    return rank || 10;
  }

  function advanceRound() {
    if (onSimulateCalendarStage) { onSimulateCalendarStage(roundLastDate); return; }
    if (phase !== "HOME_AND_AWAY" || !nextRound || playedMatchRound === round || roundHistory.some((entry) => entry.round === round)) return;
    if (!canSimulateRound) return;
    if (!teamSheetConfirmed && !onPrepareTeamSheet?.()) return;
    const trainingFatigueAdjustment = trainingPlan === "RECOVERY"
      ? -2
      : trainingPlan === "FITNESS"
        ? 2
        : 0;
    const fatigueForClub = (team, restDays, scheduledPenalty) => {
      const selectedNames = team === selectedClubName ? new Set(Object.values(teamSelection?.selectedSide ?? {})) : null;
      const squad = playerPool.filter((player) => getCareerClub(player, seasonState.playerContracts) === team && (!selectedNames?.size || selectedNames.has(player.name)));
      const condition = squad.length
        ? squad.reduce((sum, player) => {
            const state = playerFitness?.[player.id] ?? {};
            return sum + (Number(state.fitness ?? 100) - 80) * 0.035
              - Math.max(0, Number(state.workload ?? 0) - 60) * 0.025
              + (Number(state.readiness ?? 50) - 50) * 0.018
              + (Number(state.morale ?? 50) - 50) * 0.012;
          }, 0) / squad.length
        : 0;
      const trainingAdjustment = team === selectedClubName ? trainingFatigueAdjustment : 0;
      return {
        restDays,
        ratingPenalty: Math.max(-2, Math.min(5, (scheduledPenalty ?? 0) + trainingAdjustment - Math.max(-3, Math.min(3, condition)))),
      };
    };
    const fatigueByClub = Object.fromEntries(nextRound.matches.flatMap((match) => [
      [match.homeTeam ?? match.home, fatigueForClub(match.homeTeam ?? match.home, match.homeRestDays, match.homeFatiguePenalty)],
      [match.awayTeam ?? match.away, fatigueForClub(match.awayTeam ?? match.away, match.awayRestDays, match.awayFatiguePenalty)],
    ]));
    const roundData = simulateSeasonRound(ladder, nextRound, {
      fatigueByClub,
      tacticsByClub: selectedClubName ? { [selectedClubName]: tactics } : {},
      contractsByPlayer: seasonState.playerContracts,
      lineupsByClub: selectedClubName
        ? { [selectedClubName]: Object.entries(teamSelection?.selectedSide ?? {}).flatMap(([position, playerName]) => {
            const player = playerPool.find((candidate) => candidate.name === playerName);
            return player ? [{ player, position }] : [];
          }) }
        : {},
      playerPool,
      playerFitness,
    });
    const resultsWithConditions = roundData.results.map((result) => {
      const playedHome = result.homeTeam ?? result.home;
      const playedAway = result.awayTeam ?? result.away;
      const scheduledMatch = nextRound.matches.find((match) =>
        (match.homeTeam ?? match.home) === playedHome && (match.awayTeam ?? match.away) === playedAway
      );
      return scheduledMatch ? {
        ...result,
        date: result.date ?? scheduledMatch.date,
        venue: result.venue ?? scheduledMatch.venue,
        homeRestDays: scheduledMatch.homeRestDays,
        awayRestDays: scheduledMatch.awayRestDays,
        homeFatiguePenalty: result.homeFatiguePenalty ?? scheduledMatch.homeFatiguePenalty,
        awayFatiguePenalty: result.awayFatiguePenalty ?? scheduledMatch.awayFatiguePenalty,
      } : result;
    });
    setLadder(roundData.ladder);
    setRoundHistory((previous) => [...previous, { round, results: resultsWithConditions }]);
    setSelectedResultsRound(`ROUND_${round}`);
    const managerResult = resultsWithConditions.find((result) =>
      (result.homeTeam ?? result.home) === selectedClubName ||
      (result.awayTeam ?? result.away) === selectedClubName
    );
    if (managerResult) onSimulatedMatch?.(managerResult, resultsWithConditions);
    if (round >= fixture.length) {
      setRound(round + 1);
      setPhase("WILDCARD");
      setActiveTab("FINALS");
    } else {
      setRound((current) => current + 1);
    }
  }

  function playWildcardRound() {
    if (onSimulateCalendarStage) { onSimulateCalendarStage(wildcardStageDate); return; }
    if (wildcardMatches.length !== 2) return;
    const knownResults = wildcardResults ?? [];
    const remainingMatches = wildcardMatches.filter((match) => !knownResults.some((result) => result.code === match.code));
    const userHasUnplayedMatch = remainingMatches.some((match) => match.home === selectedClubName || match.away === selectedClubName);
    if (userHasUnplayedMatch && !teamSheetConfirmed && !onPrepareTeamSheet?.()) return;
    const played = [...knownResults, ...simulateKnockoutMatches(remainingMatches)];
    setWildcardResults(played);
    setSelectedResultsRound("WILDCARD");
    const winners = played
      .map((match) => ({ team: match.winner, seed: seedFor(match.winner) }))
      .sort((a, b) => a.seed - b.seed);
    setWildcardSeeds({ seven: winners[0].team, eight: winners[1].team });
    setFinalsWeek(0);
    setPhase("FINALS");
  }

  function playFinalsWeek() {
    if (onSimulateCalendarStage) { onSimulateCalendarStage(finalsStageDate); return; }
    if (!finalsMatches.length) return;
    const previousWeek = (finalsHistory ?? []).find((week) => week.week === finalsWeek + 1);
    const knownResults = previousWeek?.results ?? [];
    const remainingMatches = finalsMatches.filter((match) => !knownResults.some((result) => result.code === match.code));
    const userHasUnplayedMatch = remainingMatches.some((match) => match.home === selectedClubName || match.away === selectedClubName);
    if (userHasUnplayedMatch && !teamSheetConfirmed && !onPrepareTeamSheet?.()) return;
    const played = [...knownResults, ...simulateKnockoutMatches(remainingMatches)];
    setFinalsHistory((previous) => [
      ...(previous ?? []).filter((week) => week.week !== finalsWeek + 1),
      { week: finalsWeek + 1, label: finalsWeekLabels[finalsWeek], results: played },
    ].sort((a, b) => a.week - b.week));
    setSelectedResultsRound(["QF", "SF", "PF", "GF"][finalsWeek]);
    if (finalsWeek === 3) {
      setPremier(played[0].winner);
      setPhase("POST_SEASON");
      setActiveTab("RESULTS");
    } else {
      setFinalsWeek((current) => current + 1);
    }
  }

  function enterOffseason() {
    if (premier) {
      const archivedMatches = [...roundHistory.flatMap((entry) => entry.results ?? []), ...wildcardResults, ...finalsHistory.flatMap((week) => week.results ?? [])];
      const aflca = buildStatisticsSummary(archivedMatches).aflca;
      setSeasonArchive((previous) => [...previous, {
        year: seasonYear,
        premier,
        roundHistory,
        wildcardResults,
        finalsHistory,
        aflcaWinner: aflca[0] ?? null,
        aflcaTopTen: aflca.slice(0, 10),
        aflcaLeaderboard: aflca,
        ladder,
        finalLadder: ladder,
        tribunalCases: (seasonState.tribunalCases ?? []).filter(item => String(item.fixtureId ?? "").startsWith(`${seasonYear}:`)),
      }]);
    }
    onAdvanceToNextSeason?.();
    setPhase("OFFSEASON");
    setOffseasonStep(0);
    setActiveTab("NEXT_ROUND");
  }

  function advanceOffseason() {
    if ((offseasonStep ?? 0) === 2 && !seasonState.draftState?.completed) {
      onOpenDraftBoard?.();
      return;
    }
    const nextStep = (offseasonStep ?? 0) + 1;
    if (nextStep >= 4) {
      if (!boardObjectivesFinalized) { onOpenBoard?.(); return; }
      setPhase("PRESEASON");
      setActiveTab("NEXT_ROUND");
    } else {
      setOffseasonStep(nextStep);
    }
  }

  function startNextSeason() {
    setSeasonYear(seasonToStart);
    setSeasonHasStarted(true);
    setRound(1);
    setLadder(cloneInitialLadder());
    setRoundHistory([]);
    setSelectedResultsRound("ROUND_1");
    setFixture(scheduleFixtureAcrossWeekend(generateFixture(seasonToStart)));
    setWildcardResults([]);
    setWildcardSeeds(null);
    setFinalsWeek(0);
    setFinalsHistory([]);
    setPremier(null);
    setPhase("HOME_AND_AWAY");
    setOffseasonStep(0);
    setActiveTab("NEXT_ROUND");
  }

  const progress = phase === "POST_SEASON" || phase === "OFFSEASON" || phase === "PRESEASON"
    ? 100
    : phase === "FINALS"
      ? Math.round(86 + (finalsWeek / 4) * 12)
      : phase === "WILDCARD"
        ? 85
        : Math.round(((round - 1) / fixture.length) * 85);

  const tabs = ["NEXT_ROUND", "LADDER", "STRENGTH", "RESULTS", "FINALS"];
  const tabStyle = (tab) => ({
    flex: "1 1 120px",
    padding: "10px 12px",
    border: `1px solid ${palette.border}`,
    borderRadius: 10,
    cursor: "pointer",
    background: activeTab === tab ? palette.accent : palette.surface,
    color: activeTab === tab ? palette.accentText : palette.text,
    fontWeight: 700,
  });
  const cardStyle = {
    color: palette.text,
    background: palette.card,
    padding: 16,
    borderRadius: 16,
    border: `1px solid ${palette.border}`,
  };

  const displayMatch = (match, key, { showReport = false } = {}) => {
    const hasScores = match.homeScore !== null && match.homeScore !== undefined && match.awayScore !== null && match.awayScore !== undefined;
    const isCompleted = hasScores && Number.isFinite(Number(match.homeScore)) && Number.isFinite(Number(match.awayScore));
    const parsedMatchDate = parseFixtureDate(match.date);
    const matchDateLabel = parsedMatchDate
      ? parsedMatchDate.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
      : typeof match.date === "string" ? match.date.replace(/\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s?[AP]M)?\s*$/i, "") : null;
    return <div key={key ?? match.code ?? match.label} style={{ padding: "12px 0", borderBottom: `1px solid ${palette.border}` }}>
      <div style={{ display: "grid", gridTemplateColumns: "30px 44px 32px 24px 32px 44px 30px", alignItems: "center", justifyContent: "center", gap: 5, width: "100%", textAlign: "center" }}>
        {match.homeTeam || match.home ? <ClubBadge club={match.homeTeam ?? match.home} size={30} /> : <span />}
        <button type="button" title={match.homeTeam ?? match.home} onClick={() => onOpenClub?.(match.homeTeam ?? match.home)} style={{ border: 0, padding: 0, background: "none", color: "inherit", fontWeight: 800, cursor: "pointer", textDecoration: "underline" }}>{teamCode(match.homeTeam ?? match.home)}</button>
        <strong>{match.homeScore ?? ""}</strong>
        <span style={{ color: palette.muted }}>vs</span>
        <strong>{match.awayScore ?? ""}</strong>
        <button type="button" title={match.awayTeam ?? match.away} onClick={() => onOpenClub?.(match.awayTeam ?? match.away)} style={{ border: 0, padding: 0, background: "none", color: "inherit", fontWeight: 800, cursor: "pointer", textDecoration: "underline" }}>{teamCode(match.awayTeam ?? match.away)}</button>
        {match.awayTeam || match.away ? <ClubBadge club={match.awayTeam ?? match.away} size={30} /> : <span />}
      </div>
      {(match.label || match.venue || match.date || match.extraTime) && (
        <div style={{ marginTop: 8, color: palette.muted, fontSize: 13, textAlign: "center" }}>
          {[
            match.label,
            match.venue,
            matchDateLabel,
            match.extraTime ? "Decided after extra time" : null,
          ].filter(Boolean).join(" · ")}
        </div>
      )}
      {showReport && isCompleted && <div style={{ display: "flex", justifyContent: "center", marginTop: 9 }}><button type="button" onClick={() => { setSelectedReportMatch(attachMatchStatistics(match)); setReportTab("MATCH_STATS"); }} style={{ border: 0, background: "transparent", color: "#38bdf8", fontWeight: 800, cursor: "pointer", padding: "4px 10px" }}>View match report →</button></div>}
    </div>;
  };

  const reportTeamStats = [
    ["Disposals", "disposals"], ["Kicks", "kicks"], ["Handballs", "handballs"],
    ["Marks", "marks"], ["Tackles", "tackles"], ["Clearances", "clearances"],
    ["Inside 50s", "inside50s"], ["Rebound 50s", "rebound50s"], ["Intercepts", "intercepts"], ["Hitouts", "hitouts"],
    ["Free kicks for", "freeKicksFor"], ["Free kicks against", "freeKicksAgainst"],
    ["Contested possessions", "contestedPossessions"], ["Uncontested possessions", "uncontestedPossessions"],
    ["Disposal efficiency", "disposalEfficiency", "%"], ["Goal accuracy", "goalAccuracy", "%"],
  ];
  const reportPlayerStats = [
    ["D", "disposals"], ["K", "kicks"], ["HB", "handballs"], ["M", "marks"],
    ["T", "tackles"], ["G", "goals"], ["B", "behinds"], ["HO", "hitouts"],
    ["CLR", "clearances"], ["I50", "inside50s"], ["R50", "rebound50s"], ["INT", "intercepts"],
    ["DE%", "disposalEfficiency"], ["TOG%", "timeOnGround"],
  ];
  const reportPlayerRows = selectedReportMatch
    ? [...(selectedReportMatch.playerStats?.home ?? []), ...(selectedReportMatch.playerStats?.away ?? [])].sort((a, b) => {
        const { key, direction } = reportSort;
        const left = a[key] ?? "";
        const right = b[key] ?? "";
        const comparison = typeof left === "string" || typeof right === "string"
          ? String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: "base" })
          : (Number(left) || 0) - (Number(right) || 0);
        return comparison * (direction === "asc" ? 1 : -1);
      })
    : [];

  const phaseAction = seasonState.calendarClock && ["HOME_AND_AWAY", "PRESEASON"].includes(phase)
    ? { label: !nextClubMatch || !canPlayNextMatch ? "PROGRESS" : teamSheetConfirmed ? "SIMULATE MATCH DAY" : "CONFIRM TEAM SHEET FIRST", action: !nextClubMatch || !canPlayNextMatch ? onCalendarProgress : teamSheetConfirmed ? () => onSimulateCalendarStage?.(matchDate) : onPrepareTeamSheet }
    : phase === "HOME_AND_AWAY" && playedMatchRound === round
    ? { label: "RETURN TO MATCH", action: onResumeMatch }
    : phase === "HOME_AND_AWAY"
    ? { label: !canSimulateRound ? (teamSheetConfirmed ? "PROGRESS TO ROUND END" : "CONFIRM TEAM SHEET FIRST") : teamSheetConfirmed ? "SIMULATE ROUND" : selectionResponsibility === "ASSISTANT" ? "ASSISTANT CONFIRM & SIMULATE ROUND" : "CONFIRM TEAM SHEET TO SIMULATE", action: !canSimulateRound ? () => teamSheetConfirmed && onCalendarProgressToDate?.(roundLastDate) : advanceRound, disabled: !canSimulateRound && !teamSheetConfirmed }
    : phase === "WILDCARD" && String(playedMatchRound ?? "").startsWith("WILDCARD-")
      ? { label: "RETURN TO MATCH", action: onResumeMatch }
    : phase === "WILDCARD"
      ? { label: !canPlayWildcardStage ? "PROGRESS TO WILDCARD MATCH DAY" : (wildcardResults ?? []).length ? "COMPLETE WILDCARD ROUND" : "SIMULATE WILDCARD ROUND", action: !canPlayWildcardStage ? () => onCalendarProgressToDate?.(wildcardStageDate) : playWildcardRound }
      : phase === "FINALS" && String(playedMatchRound ?? "").startsWith("FINALS-")
        ? { label: "RETURN TO MATCH", action: onResumeMatch }
      : phase === "FINALS"
        ? { label: !canPlayFinalsStage ? `PROGRESS TO ${finalsWeekLabels[finalsWeek]?.toUpperCase() ?? "FINALS"}` : `SIMULATE ${finalsWeekLabels[finalsWeek]?.toUpperCase() ?? "FINALS"}`, action: !canPlayFinalsStage ? () => onCalendarProgressToDate?.(finalsStageDate) : playFinalsWeek }
      : phase === "POST_SEASON"
        ? { label: "GO TO OFFSEASON", action: enterOffseason }
        : null;

  const resultRounds = [
    ...fixture.map((roundData) => ({ id: `ROUND_${roundData.round}`, label: String(roundData.round) })),
    { id: "WILDCARD", label: "WF" },
    { id: "QF", label: "QE" },
    { id: "SF", label: "SF" },
    { id: "PF", label: "PF" },
    { id: "GF", label: "GF" },
  ];

  let selectedResults = [];
  let selectedResultsTitle = "";
  let selectedResultsUpcoming = false;
  if (selectedResultsRound.startsWith("ROUND_")) {
    const selectedRoundNumber = Number(selectedResultsRound.slice("ROUND_".length));
    const completedRound = roundHistory.find((item) => item.round === selectedRoundNumber);
    const scheduledRound = fixture.find((item) => item.round === selectedRoundNumber);
    selectedResults = completedRound?.results ?? scheduledRound?.matches ?? [];
    selectedResultsTitle = `Round ${selectedRoundNumber}`;
    selectedResultsUpcoming = !completedRound;
  } else if (selectedResultsRound === "WILDCARD") {
    selectedResults = wildcardResults.length ? wildcardResults : wildcardMatches;
    selectedResultsTitle = "Wildcard Finals";
    selectedResultsUpcoming = wildcardResults.length === 0;
  } else {
    const finalsIndex = { QF: 0, SF: 1, PF: 2, GF: 3 }[selectedResultsRound];
    const completedFinalsWeek = finalsHistory.find((week) => week.week === finalsIndex + 1);
    selectedResults = completedFinalsWeek?.results ?? (finalsWeek === finalsIndex && phase === "FINALS" ? finalsMatches : []);
    selectedResultsTitle = finalsWeekLabels[finalsIndex];
    selectedResultsUpcoming = !completedFinalsWeek;
  }

  const resultsByDate = selectedResults.reduce((groups, match) => {
    const parsedDate = parseFixtureDate(match.date);
    const date = parsedDate
      ? parsedDate.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
      : (typeof match.date === "string" ? match.date.replace(/\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s?[AP]M)?\s*$/i, "") : null) || selectedResultsTitle;
    if (!groups[date]) groups[date] = [];
    groups[date].push(match);
    return groups;
  }, {});

  // The Grand Final presentation is a mandatory season transition. It also
  // appears for older saves that already reached POST_SEASON before the page
  // was wired into the Season Hub.
  const hasGrandFinalResult = (finalsHistory ?? []).some((week) => Number(week.week) === 4 && week.results?.length);
  const finalePresentation = seasonState.grandFinalPresentation?.seasonYear === Number(seasonYear)
    ? seasonState.grandFinalPresentation
    : { seasonYear: Number(seasonYear), view: "PREMIERSHIP" };
  if (phase === "POST_SEASON" && (hasGrandFinalResult || premier)) {
    return <SeasonFinale
      season={seasonState}
      view={finalePresentation.view ?? "PREMIERSHIP"}
      onViewChange={(view) => onSeasonStateChange((previous) => ({
        ...previous,
        grandFinalPresentation: { ...finalePresentation, view },
      }))}
      onProceed={enterOffseason}
    />;
  }

  return (
    <main style={{ color: palette.text }}>
      {finalsSeriesTheme && <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, padding: "11px 15px", border: "1px solid #9b7b2b", borderRadius: 12, background: lightMode ? "#fff9e8" : "linear-gradient(100deg, #29220f, #171307)", color: "#d6b44a", fontWeight: 900, letterSpacing: 2, boxShadow: "0 0 22px rgba(214,180,74,.12)" }}><span aria-hidden="true">🏆</span><span>FINALS SERIES · PREMIERSHIP ON THE LINE</span></div>}
      <h2>Season Hub</h2>

      <section style={{ ...cardStyle, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <h3 style={{ marginTop: 0 }}>Season {seasonYear}</h3>
            <p style={{ marginBottom: 0, color: palette.muted }}>
              {phase === "HOME_AND_AWAY" && `Home & Away · Round ${Math.min(round, fixture.length)} of ${fixture.length}`}
              {phase === "WILDCARD" && "Wildcard Finals"}
              {phase === "FINALS" && finalsWeekLabels[finalsWeek]}
              {phase === "POST_SEASON" && "Post-season review"}
              {phase === "OFFSEASON" && `Offseason · ${offseasonStep < 2 ? "Trade Period" : offseasonStep === 2 ? "Draft" : offseasonStep === 3 ? "Contracts" : "Complete"}`}
              {phase === "PRESEASON" && "Preseason — ready to start the new season"}
            </p>
          </div>
          <strong style={{ fontSize: "1.7rem", color: "#22c55e" }}>{progress}%</strong>
        </div>
        <div style={{ height: 9, margin: "14px 0", background: palette.surface, borderRadius: 8, overflow: "hidden" }}>
          <div style={{ width: `${progress}%`, height: "100%", background: finalsSeriesTheme ? palette.accent : "#22c55e", boxShadow: finalsSeriesTheme ? "0 0 12px rgba(214,180,74,.5)" : "none" }} />
        </div>
        {phaseAction && (
          <button type="button" disabled={phaseAction.disabled} onClick={phaseAction.action} style={{ width: "100%", padding: 12, border: 0, borderRadius: 10, background: phaseAction.disabled ? "#64748b" : palette.accent, color: phaseAction.disabled ? "white" : palette.accentText, fontWeight: 800, cursor: phaseAction.disabled ? "not-allowed" : "pointer", boxShadow: finalsSeriesTheme && !phaseAction.disabled ? "0 4px 16px rgba(214,180,74,.2)" : "none" }}>
            {phaseAction.label}
          </button>
        )}
        {phase === "POST_SEASON" && (
          <div style={{ marginTop: 8, color: palette.text, fontWeight: 700 }}>🏆 {premier} are the {seasonYear} premiers</div>
        )}
        {phase === "OFFSEASON" && !boardObjectivesFinalized && <div role="status" style={{ marginTop: 12, padding: 12, border: "1px solid #f59e0b", borderRadius: 8 }}>
          Finalise next season’s board objectives before preseason. <button type="button" onClick={onOpenBoard} style={{ border: 0, background: "none", color: "#f59e0b", fontWeight: 800, textDecoration: "underline", cursor: "pointer" }}>Open Board</button>
        </div>}
        {phase === "OFFSEASON" && (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
            {[
              { step: 0, label: "Trade Period — Week 1" },
              { step: 1, label: "Trade Period — Week 2" },
              { step: 2, label: "Draft Night" },
              { step: 3, label: "Finalise Contracts" },
            ].map((item) => (
              <div key={item.step} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: (offseasonStep ?? 0) > item.step ? "#22c55e" : (offseasonStep ?? 0) === item.step ? "#ea580c" : palette.muted, fontWeight: 800 }}>
                  {(offseasonStep ?? 0) > item.step ? "✓" : (offseasonStep ?? 0) === item.step ? "▶" : "○"}
                </span>
                <span style={{ color: (offseasonStep ?? 0) === item.step ? palette.text : palette.muted }}>{item.label}</span>
              </div>
            ))}
            <button type="button" onClick={onCalendarProgress ?? advanceOffseason} style={{ width: "100%", marginTop: 8, padding: 12, border: 0, borderRadius: 10, color: "white", background: "#16a34a", fontWeight: 800, cursor: "pointer" }}>
              {isDraftNight && !seasonState.draftState?.completed ? "Open Draft Board" : "Progress"}
            </button>
          </div>
        )}
        {phase === "PRESEASON" && (
          <button type="button" onClick={onCalendarProgress ?? startNextSeason} style={{ width: "100%", marginTop: 8, padding: 12, border: 0, borderRadius: 10, color: "white", background: "#16a34a", fontWeight: 800, cursor: "pointer" }}>
              Start Season {seasonToStart}
          </button>
        )}
      </section>

      {["HOME_AND_AWAY", "PRESEASON"].includes(phase) && nextClubMatch && (
        <section style={{ ...cardStyle, marginBottom: 16 }}>
          <h3>{selectedClubName ? `Next Match · ${selectedClubName}` : "Next Match"}</h3>
          {nextClubMatch && displayMatch(nextClubMatch, "next-club-match")}
          {nextClubMatch && playedMatchRound === round && onResumeMatch && (
            <button type="button" onClick={onResumeMatch} style={{ width: "100%", marginTop: 10, padding: 12, border: 0, borderRadius: 10, background: "#0f766e", color: "#fff", fontWeight: 800, cursor: "pointer" }}>
              RESUME GAME
            </button>
          )}
          {nextClubMatch && playedMatchRound !== round && onPlayMatch && (
            <button
              type="button"
              disabled={!canPlayNextMatch}
              onClick={() => onPlayMatch({ ...nextClubMatch, round: nextClubMatch.round ?? round })}
              style={{ width: "100%", marginTop: 10, padding: 12, border: 0, borderRadius: 10, background: canPlayNextMatch ? palette.accent : "#64748b", color: canPlayNextMatch ? palette.accentText : "#fff", fontWeight: 800, cursor: canPlayNextMatch ? "pointer" : "not-allowed" }}
            >
              {canPlayNextMatch ? "PLAY GAME" : "MATCH DAY HAS NOT ARRIVED"}
            </button>
          )}
        </section>
      )}

      {(phase === "WILDCARD" || phase === "FINALS") && (
        <section style={{ ...cardStyle, marginBottom: 16 }}>
          <h3>{phase === "WILDCARD" ? "Wildcard Finals" : finalsWeekLabels[finalsWeek]}</h3>
          {(phase === "WILDCARD" ? wildcardMatchesWithResults : finalsMatchesWithResults).map((match) => {
            const matchAlreadyPlayed = match.homeScore != null && match.awayScore != null;
            const isUserMatch = match.home === selectedClubName || match.away === selectedClubName;
            return <div key={match.code}>
            {displayMatch(match, match.code)}
            {!matchAlreadyPlayed && isUserMatch && onPlayMatch && (
              <button type="button" disabled={dateKey(today) < dateKey(parseFixtureDate(match.date))} onClick={() => onPlayMatch({ ...match, homeTeam: match.home, awayTeam: match.away, round: `${match.stage}-${match.code}` })} style={{ width: "100%", marginTop: 8, padding: 11, border: 0, borderRadius: 9, background: dateKey(today) < dateKey(parseFixtureDate(match.date)) ? "#64748b" : palette.accent, color: dateKey(today) < dateKey(parseFixtureDate(match.date)) ? "#fff" : palette.accentText, fontWeight: 800, cursor: dateKey(today) < dateKey(parseFixtureDate(match.date)) ? "not-allowed" : "pointer" }}>{dateKey(today) < dateKey(parseFixtureDate(match.date)) ? `MATCH DAY · ${parseFixtureDate(match.date)?.toLocaleDateString("en-AU", { day: "numeric", month: "short" })}` : "PLAY FINALS GAME"}</button>
            )}
          </div>;
          })}
          {phase === "WILDCARD" && <p style={{ color: palette.muted, marginBottom: 0 }}>The top six have a bye. These matches decide the final two finals seeds.</p>}
        </section>
      )}

      <nav aria-label="Season sections" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        {tabs.map((tab) => (
          <button key={tab} type="button" style={tabStyle(tab)} aria-pressed={activeTab === tab} onClick={() => setActiveTab(tab)}>
          {tab === "NEXT_ROUND" ? "NEXT ROUND" : tab === "STRENGTH" ? "TEAM STRENGTH" : tab.replaceAll("_", " ")}
          </button>
        ))}
      </nav>

      {activeTab === "NEXT_ROUND" && (
        <section style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>{nextRoundTitle}</h3>
          {nextRoundFixtures.map((match, index) => displayMatch(match, match.code ?? `${nextRoundTitle}-${index}`))}
          {!nextRoundFixtures.length && (
            <p style={{ color: palette.muted, marginBottom: 0 }}>
              {phase === "POST_SEASON" ? "The season is complete. Start the offseason to begin trade period and draft preparations." : phase === "OFFSEASON" ? "The offseason is in progress. Use Progress above to advance through trade period, draft, and contracts." : phase === "PRESEASON" ? "Preseason is complete. Start the new season from the preseason panel above." : "Fixtures will appear when the next stage is ready."}
            </p>
          )}
        </section>
      )}

      {activeTab === "LADDER" && (
        <section style={{ ...cardStyle, padding: 0, overflowX: "auto" }}>
          <div style={{ minWidth: 680 }}>
            <div style={{ display: "grid", gridTemplateColumns: "42px 42px 2fr 50px 50px 70px 80px", gap: 6, padding: 12, background: palette.surface, fontWeight: 800 }}>
              <span>#</span><span /><span>Club</span><span>P</span><span>W</span><span>Pts</span><span>%</span>
            </div>
            {standings.map((club, index) => (
              <div key={club.club} style={{ display: "grid", gridTemplateColumns: "42px 42px 2fr 50px 50px 70px 80px", gap: 6, alignItems: "center", padding: 12, borderTop: `1px solid ${palette.border}`, background: index < 6 ? "rgba(34,197,94,0.08)" : index < 10 ? "rgba(234,88,22,0.08)" : "transparent" }}>
                <span>{index + 1}</span>
                <ClubBadge club={club.club} size={30} />
                <button type="button" onClick={() => onOpenClub?.(club.club)} style={{ border: 0, padding: 0, background: "none", color: "inherit", font: "inherit", fontWeight: 800, textAlign: "left", cursor: "pointer", textDecoration: "underline" }}>{club.club}</button>
                <span>{(club.wins ?? 0) + (club.losses ?? 0) + (club.draws ?? 0)}</span>
                <span>{club.wins ?? 0}</span>
                <span>{club.points ?? 0}</span>
                <span>{club.percentage ?? 0}</span>
              </div>
            ))}
          </div>
          <p style={{ padding: "0 14px", color: palette.muted }}>
            Top 6: bye into finals · 7th–10th: wildcard round · 11th–18th: season complete
          </p>
        </section>
      )}

      {activeTab === "RESULTS" && (
        <section>
          <nav
            aria-label="Select results round"
            style={{
              display: "flex",
              gap: 4,
              overflowX: "auto",
              padding: "8px 8px 16px",
              margin: "0 -10px 14px",
              width: "calc(100% + 20px)",
              maxWidth: "calc(100vw - 24px)",
              boxSizing: "border-box",
              border: `1px solid ${palette.border}`,
              borderRadius: 12,
              background: palette.card,
              scrollbarWidth: "thin",
            }}
          >
            {resultRounds.map((item) => {
              const selected = selectedResultsRound === item.id;
              const isGrandFinal = item.id === "GF";
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setSelectedResultsRound(item.id)}
                  style={{
                    flex: "0 0 auto",
                    minWidth: item.label.length > 2 ? 54 : 42,
                    padding: "10px 12px",
                    border: 0,
                    borderRadius: 999,
                    background: selected
                      ? isGrandFinal ? "#16a34a" : "#0645ad"
                      : "transparent",
                    color: selected ? "#fff" : palette.text,
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <section style={cardStyle}>
            <h3 style={{ marginTop: 0 }}>{selectedResultsTitle}</h3>
            {selectedResultsUpcoming && (
              <p style={{ color: palette.muted, marginTop: 0 }}>
                {selectedResults.length
                  ? "Scheduled matches — results will appear here after the round is simulated."
                  : "Results for this stage will appear here when it becomes available."}
              </p>
            )}
            {Object.entries(resultsByDate).map(([date, matches]) => (
              <div key={date} style={{ marginBottom: 18 }}>
                {date !== selectedResultsTitle && <h4 style={{ marginBottom: 4 }}>{date}</h4>}
                {matches.map((match, index) => displayMatch(match, match.code ?? `${date}-${index}`, { showReport: true }))}
              </div>
            ))}
            {!selectedResults.length && !selectedResultsUpcoming && (
              <p style={{ color: palette.muted }}>No matches are available for this selection.</p>
            )}
          </section>
        </section>
      )}

      {activeTab === "STRENGTH" && (
        <section style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>Team Strength</h3>
          <p style={{ color: palette.muted }}>Projected best 23 from each club’s current playing list.</p>
          <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
            <thead><tr>{["Club", "Best Team OVR", "DEF", "MID", "FWD", "RUC"].map(label => <th key={label} style={{ padding: 9, textAlign: label === "Club" ? "left" : "right", borderBottom: `1px solid ${palette.border}` }}>{label}</th>)}</tr></thead>
            <tbody>{clubs.map(item => {
              const roster = playerPool.filter(player => getCareerClub(player, seasonState.playerContracts) === item.name).map(player => getCareerPlayer(player, seasonState.playerDevelopment, seasonYear, seasonState.playerContracts));
              return { club: item, ...getClubBestTeam(roster) };
            }).sort((a, b) => Number(b.bestTeamOverall ?? 0) - Number(a.bestTeamOverall ?? 0)).map(row => <tr key={row.club.id}>
              <td style={{ padding: 9, borderBottom: `1px solid ${palette.border}` }}><button type="button" onClick={() => onOpenClub?.(row.club.name)} style={{ border: 0, padding: 0, background: "none", color: "inherit", fontWeight: 800, cursor: "pointer", textDecoration: "underline" }}>{row.club.name}</button></td>
              {["bestTeamOverall", "def", "mid", "fwd", "ruc"].map(key => <td key={key} style={{ padding: 9, textAlign: "right", borderBottom: `1px solid ${palette.border}` }}>{row[key] ?? "—"}</td>)}
            </tr>)}</tbody>
          </table></div>
        </section>
      )}

      {activeTab === "FINALS" && (
        <section style={cardStyle}>
          {phase === "HOME_AND_AWAY" && <p style={{ color: palette.muted, marginTop: 0 }}>The bracket updates with the ladder until the home-and-away season finishes. Wildcard winners are ranked by ladder position: the higher-ranked winner takes seed 7 and the other takes seed 8.</p>}
          {phase === "WILDCARD" && <p style={{ color: palette.muted, marginTop: 0 }}>The top six are resting while 7th–10th play for the last two finals places.</p>}
          <FinalsBracket
            bracket={buildFinalsBracket({ ladder, fixture, wildcardSeeds, wildcardResults, finalsHistory, seasonYear, premier })}
            clubName={selectedClubName}
            codeFor={teamCode}
            phase={phase}
            onOpenReport={(result) => { setSelectedReportMatch(attachMatchStatistics(result)); setReportTab("MATCH_STATS"); }}
            onOpenClub={onOpenClub}
          />
          {phase === "POST_SEASON" && <p style={{ color: palette.muted, marginBottom: 0 }}>The finals series is complete. {premier} won the premiership.</p>}
        </section>
      )}

      {selectedReportMatch && (
        <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedReportMatch(null); }} style={{ position: "fixed", inset: 0, zIndex: 1000, display: "grid", placeItems: "center", padding: 18, background: "rgba(2,6,23,.78)" }}>
          <section role="dialog" aria-modal="true" aria-labelledby="match-report-title" style={{ width: "min(900px, 94vw)", maxHeight: "78vh", overflow: "auto", color: palette.text, background: palette.card, border: `1px solid ${palette.border}`, borderRadius: 16, padding: 16, boxShadow: "0 24px 80px rgba(0,0,0,.45)" }}>
            <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, borderBottom: `1px solid ${palette.border}`, paddingBottom: 14 }}>
              <div>
                <div style={{ color: palette.muted, fontSize: 12, letterSpacing: 1, fontWeight: 800 }}>{selectedReportMatch.label || `ROUND ${selectedReportMatch.round ?? ""}`} · MATCH REPORT</div>
                <h2 id="match-report-title" style={{ margin: "6px 0 0", fontSize: "clamp(18px, 3vw, 26px)" }}>{selectedReportMatch.homeTeam ?? selectedReportMatch.home} {selectedReportMatch.homeScore} — {selectedReportMatch.awayScore} {selectedReportMatch.awayTeam ?? selectedReportMatch.away}</h2>
          <div style={{ color: palette.muted, marginTop: 4 }}>{[selectedReportMatch.venue, (() => { const date = parseFixtureDate(selectedReportMatch.date); return date ? date.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : null; })()].filter(Boolean).join(" · ")}</div>
              </div>
              <button type="button" aria-label="Close match report" onClick={() => setSelectedReportMatch(null)} style={{ flex: "0 0 auto", width: 38, height: 38, border: `1px solid ${palette.border}`, borderRadius: 10, background: palette.surface, color: palette.text, fontSize: 22, cursor: "pointer" }}>×</button>
            </header>
            <nav aria-label="Match report sections" style={{ display: "flex", gap: 8, margin: "12px 0" }}>
              {[["MATCH_STATS", "Match stats"], ["PLAYER_STATS", "Player stats"]].map(([key, label]) => <button key={key} type="button" aria-pressed={reportTab === key} onClick={() => setReportTab(key)} style={{ padding: "10px 16px", border: `1px solid ${reportTab === key ? "#ea580c" : palette.border}`, borderRadius: 10, background: reportTab === key ? "#ea580c" : palette.surface, color: palette.text, fontWeight: 800, cursor: "pointer" }}>{label}</button>)}
            </nav>
            {reportTab === "MATCH_STATS" ? (
              <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 460 }}><thead><tr>{["Statistic", selectedReportMatch.homeTeam ?? selectedReportMatch.home, selectedReportMatch.awayTeam ?? selectedReportMatch.away].map((label) => <th key={label} style={{ textAlign: label === "Statistic" ? "left" : "center", padding: 11, borderBottom: `1px solid ${palette.border}`, color: palette.muted }}>{label}</th>)}</tr></thead><tbody>{reportTeamStats.map(([label, key, suffix]) => <tr key={key}><td style={{ padding: 11, borderBottom: `1px solid ${palette.border}`, fontWeight: 650 }}>{label}</td>{["home", "away"].map((side) => <td key={side} style={{ padding: 11, borderBottom: `1px solid ${palette.border}`, textAlign: "center", fontWeight: 800 }}>{selectedReportMatch.teamStats?.[side]?.[key] ?? "—"}{suffix && selectedReportMatch.teamStats?.[side]?.[key] != null ? suffix : ""}</td>)}</tr>)}</tbody></table></div>
            ) : (
              <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900, fontSize: 12 }}><thead><tr>{[["Player", "playerName"], ["Club", "club"], ["Pos", "matchPosition"], ...reportPlayerStats].map(([label, key]) => <th key={key} aria-sort={reportSort.key === key ? (reportSort.direction === "asc" ? "ascending" : "descending") : "none"} style={{ padding: "7px 5px", borderBottom: `1px solid ${palette.border}`, color: palette.muted, textAlign: key === "playerName" ? "left" : "center", whiteSpace: "nowrap" }}><button type="button" onClick={() => setReportSort((current) => current.key === key ? { key, direction: current.direction === "asc" ? "desc" : "asc" } : { key, direction: ["playerName", "club", "matchPosition"].includes(key) ? "asc" : "desc" })} style={{ padding: 0, border: 0, background: "transparent", color: "inherit", font: "inherit", fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}>{label}{reportSort.key === key ? (reportSort.direction === "asc" ? " ↑" : " ↓") : ""}</button></th>)}</tr></thead><tbody>{reportPlayerRows.map((stat) => <tr key={`${stat.club}-${stat.playerId}`}><td style={{ padding: "7px 5px", borderBottom: `1px solid ${palette.border}`, fontWeight: 750, whiteSpace: "nowrap" }}>{stat.playerName}</td><td style={{ padding: "7px 5px", borderBottom: `1px solid ${palette.border}`, textAlign: "center" }}>{teamCode(stat.club)}</td><td style={{ padding: "7px 5px", borderBottom: `1px solid ${palette.border}`, textAlign: "center" }}>{stat.matchPosition ?? stat.positions?.join("/") ?? "—"}</td>{reportPlayerStats.map(([label, key]) => <td key={label} style={{ padding: "7px 5px", borderBottom: `1px solid ${palette.border}`, textAlign: "center" }}>{stat[key] ?? 0}</td>)}</tr>)}</tbody></table>{!reportPlayerRows.length && <p style={{ color: palette.muted }}>Player statistics are unavailable for this match.</p>}</div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}