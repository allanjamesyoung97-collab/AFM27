import { useEffect, useMemo, useState } from "react";
import { getCareerPlayer } from "../engine/developmentEngine.js";
import { getCareerClub } from "../engine/contractEngine.js";
import { createAssistantTeamSelection } from "../engine/teamSelectionEngine.js";
import { DEFAULT_TACTICS, getTacticalRatingBonus, getTacticalRatings, getTacticalStyleFit, normalizeTactics, recommendTactics, TACTIC_SLIDERS, TACTIC_STYLES } from "../engine/tacticsEngine.js";
import { isRuckEligible } from "../engine/playerRatingGenerator.js";
import { getPlayingPosition } from "../engine/statisticsEngine.js";
import { buildMatchupModel } from "../engine/matchupEngine.js";
import { buildMatchupAnalytics, MATCHUP_ANALYTICS_ATTRIBUTES } from "../engine/matchupAnalyticsEngine.js";
import { getClubBestTeam } from "../engine/clubStrengthEngine.js";
import OppositionReport from "./OppositionReport.jsx";

const ratingLabels = [["attack", "Attack"], ["defence", "Defence"], ["transition", "Transition"], ["possession", "Possession"], ["pressure", "Pressure"], ["territory", "Territory"], ["stoppage", "Stoppage"]];
const coreGroups = {
  Technical: ["kicking", "handball", "marking", "goalSense", "tackling", "spoiling", "groundBallGet", "contestedBall", "runCarry", "ruckCraft"],
  Physical: ["speed", "acceleration", "agility", "endurance", "strength", "verticalLeap", "durability"],
  "Football IQ": ["vision", "decisionMaking", "positioning", "composure", "leadership", "creativity", "gameAwareness"],
  Mental: ["workRate", "professionalism", "determination", "teamwork", "competitiveness", "discipline"],
};
const attributeLabels = {
  kicking: "Kicking", handball: "Handball", marking: "Marking", goalSense: "Goal Sense", tackling: "Tackling", spoiling: "Spoiling", groundBallGet: "Ground Ball Get", contestedBall: "Contested Ball", runCarry: "Run & Carry", ruckCraft: "Ruck Craft",
  speed: "Speed", acceleration: "Acceleration", agility: "Agility", endurance: "Endurance", strength: "Strength", verticalLeap: "Vertical Leap", durability: "Durability",
  vision: "Vision", decisionMaking: "Decision Making", positioning: "Positioning", composure: "Composure", leadership: "Leadership", creativity: "Creativity", gameAwareness: "Game Awareness",
  workRate: "Work Rate", professionalism: "Professionalism", determination: "Determination", teamwork: "Teamwork", competitiveness: "Competitiveness", discipline: "Discipline",
};
const positionGroups = {
  Attackers: ["KPF", "FF", "HF"],
  Midfielders: ["MID", "WING"],
  Defenders: ["KPD", "BP", "HB"],
  Rucks: ["RUC"],
};
const unitGroups = { ATT: ["KPF", "FF", "HF"], MID: ["MID", "WING", "RUC"], DEF: ["KPD", "BP", "HB"] };
const average = (items) => items.length ? items.reduce((sum, value) => sum + value, 0) / items.length : 0;
const coreAverage = (players, keys) => {
  const values = players.flatMap((player) => keys
    .filter((key) => key !== "ruckCraft" || isRuckEligible(player))
    .map((key) => Number(player.attributes?.[key]))
    .filter(Number.isFinite));
  return average(values);
};
const hasPosition = (player, codes) => player.positions?.some((position) => codes.includes(position));

export default function TacticsScreen({ appearance = "dark", club, tactics, onTacticsChange, players: playerPool = [], teamSelection = {}, seasonState = {}, playerFitness = {}, navigationTab = null, navigationSequence = 0 }) {
  const lightMode = appearance === "light";
  const [activeTab, setActiveTab] = useState("GAME_PLAN");
  const [analyticsTab, setAnalyticsTab] = useState("TEAM");
  useEffect(() => {
    if (navigationTab === "ANALYTICS_TEAM" || navigationTab === "ANALYTICS_PLAYER") {
      setActiveTab("ANALYTICS");
      setAnalyticsTab(navigationTab === "ANALYTICS_PLAYER" ? "PLAYER" : "TEAM");
    } else if (navigationTab) setActiveTab(navigationTab);
  }, [navigationSequence, navigationTab]);
  const [teamScope, setTeamScope] = useState("TOTAL_CLUB");
  const [playerViewScope, setPlayerViewScope] = useState("BEST_23");
  const [playerViewGroup, setPlayerViewGroup] = useState("ALL");
  const [playerViewAttribute, setPlayerViewAttribute] = useState("ALL");
  const [selectedPlayerIds, setSelectedPlayerIds] = useState(null);
  const [matrixCategory, setMatrixCategory] = useState(null);
  const [matchupLine, setMatchupLine] = useState("forward");
  const [matchupAttribute, setMatchupAttribute] = useState("speed");
  const plan = useMemo(() => normalizeTactics(tactics ?? DEFAULT_TACTICS), [tactics]);
  const ratings = getTacticalRatings(plan);
  const roster = useMemo(() => playerPool
    .map((player) => getCareerPlayer(player, seasonState.playerDevelopment, seasonState.seasonYear, seasonState.playerContracts))
    .filter((player) => getCareerClub(player, seasonState.playerContracts) === club?.name),
  [playerPool, seasonState.playerDevelopment, seasonState.playerContracts, seasonState.seasonYear, club?.name]);
  const baseClubRating = getClubBestTeam(roster).bestTeamOverall ?? 0;
  const upcomingMatch = useMemo(() => {
    const phase = seasonState.phase ?? "HOME_AND_AWAY";
    if (phase === "WILDCARD") {
      const standings = [...(seasonState.ladder ?? [])].sort((a, b) => (Number(b.points) - Number(a.points)) || (Number(b.percentage) - Number(a.percentage)));
      const wildcardMatches = standings.length >= 10 ? [
        { home: standings[6].club, away: standings[9].club, round: "Wildcard 1" },
        { home: standings[7].club, away: standings[8].club, round: "Wildcard 2" },
      ] : [];
      return wildcardMatches.find((match) => match.home === club?.name || match.away === club?.name) ?? null;
    }
    if (phase === "FINALS") {
      const standings = [...(seasonState.ladder ?? [])].sort((a, b) => (Number(b.points) - Number(a.points)) || (Number(b.percentage) - Number(a.percentage)));
      const priorResults = (seasonState.finalsHistory ?? []).flatMap((week) => week.results ?? []);
      const byCode = (code) => priorResults.find((match) => match.code === code);
      const winner = (match) => match?.winner;
      const loser = (match) => match?.winner === match?.homeTeam ? match?.awayTeam : match?.homeTeam;
      const seeds = seasonState.wildcardSeeds;
      let finals = [];
      if (seeds && Number(seasonState.finalsWeek ?? 0) === 0) finals = [
        { home: standings[0]?.club, away: standings[3]?.club, round: "Qualifying Final" },
        { home: standings[1]?.club, away: standings[2]?.club, round: "Qualifying Final" },
        { home: standings[4]?.club, away: seeds.eight, round: "Elimination Final" },
        { home: standings[5]?.club, away: seeds.seven, round: "Elimination Final" },
      ];
      if (Number(seasonState.finalsWeek ?? 0) === 1) finals = [
        { home: loser(byCode("QF1")), away: winner(byCode("EF1")), round: "Semi-final" },
        { home: loser(byCode("QF2")), away: winner(byCode("EF2")), round: "Semi-final" },
      ];
      if (Number(seasonState.finalsWeek ?? 0) === 2) finals = [
        { home: winner(byCode("QF1")), away: winner(byCode("SF2")), round: "Preliminary Final" },
        { home: winner(byCode("QF2")), away: winner(byCode("SF1")), round: "Preliminary Final" },
      ];
      if (Number(seasonState.finalsWeek ?? 0) === 3) finals = [
        { home: winner(byCode("PF1")), away: winner(byCode("PF2")), round: "Grand Final" },
      ];
      return finals.find((match) => match.home === club?.name || match.away === club?.name) ?? null;
    }
    const completedRounds = new Set((seasonState.roundHistory ?? []).map((entry) => Number(entry.round)));
    return [...(seasonState.fixture ?? [])]
      .filter((round) => Number(round.round) >= Number(seasonState.round ?? 1) && !completedRounds.has(Number(round.round)))
      .sort((a, b) => Number(a.round) - Number(b.round))
      .flatMap((round) => (round.matches ?? []).map((match) => ({ ...match, round: round.round })))
      .find((match) => (match.homeTeam ?? match.home) === club?.name || (match.awayTeam ?? match.away) === club?.name) ?? null;
  }, [seasonState.phase, seasonState.ladder, seasonState.wildcardSeeds, seasonState.finalsWeek, seasonState.finalsHistory, seasonState.fixture, seasonState.roundHistory, seasonState.round, club?.name]);
  const opponentName = upcomingMatch
    ? (upcomingMatch.homeTeam ?? upcomingMatch.home) === club?.name
      ? (upcomingMatch.awayTeam ?? upcomingMatch.away)
      : (upcomingMatch.homeTeam ?? upcomingMatch.home)
    : null;
  const opponentRoster = useMemo(() => playerPool
    .map((player) => getCareerPlayer(player, seasonState.playerDevelopment, seasonState.seasonYear, seasonState.playerContracts))
    .filter((player) => getCareerClub(player, seasonState.playerContracts) === opponentName),
  [playerPool, seasonState.playerDevelopment, seasonState.playerContracts, seasonState.seasonYear, opponentName]);
  const isAvailable = (player) => Number(playerFitness?.[player.id]?.injury?.weeksRemaining ?? 0) <= 0
    && Number(playerFitness?.[player.id]?.suspension?.matchesRemaining ?? 0) <= 0;
  const opponentAvailable = useMemo(() => opponentRoster.filter(isAvailable), [opponentRoster, playerFitness]);
  const predictedOpponentTeam = useMemo(() => createAssistantTeamSelection(opponentAvailable), [opponentAvailable]);
  const predictedOpponentLineup = useMemo(() => Object.entries(predictedOpponentTeam.selectedSide ?? {})
    .map(([position, playerName]) => {
      const player = opponentAvailable.find((candidate) => candidate.name === playerName);
      return player ? { position, player, matchPosition: getPlayingPosition(player, position) } : null;
    })
    .filter(Boolean), [predictedOpponentTeam, opponentAvailable]);
  const opponentIsHome = upcomingMatch ? (upcomingMatch.homeTeam ?? upcomingMatch.home) === opponentName : null;
  const ladderRankOf = (name) => { const index = (seasonState.ladder ?? []).findIndex((entry) => entry.club === name); return index >= 0 ? index + 1 : null; };
  const lineupAverage = (lineup) => average(lineup.map((entry) => Number(entry.player?.overall ?? 0)).filter((value) => value > 0));
  const opponentStyle = useMemo(() => {
    if (!predictedOpponentLineup.length) return null;
    const ownLineup = Object.entries(createAssistantTeamSelection(roster.filter(isAvailable)).selectedSide ?? {})
      .flatMap(([position, playerName]) => { const player = roster.find((candidate) => candidate.name === playerName); return player ? [{ position, player }] : []; });
    // The opposition reads your approach as well: the plan below is what their selectors would pick against it.
    const opponentPlan = recommendTactics(predictedOpponentLineup, {
      seed: opponentName,
      opponentStyle: plan.style,
      context: {
        round: seasonState.round, isHome: opponentIsHome,
        ladderRank: ladderRankOf(opponentName), opponentRank: ladderRankOf(club?.name),
        strengthGap: lineupAverage(predictedOpponentLineup) - lineupAverage(ownLineup),
      },
    });
    const style = TACTIC_STYLES.find((item) => item.id === opponentPlan.style);
    return style ? { style, fit: getTacticalStyleFit(style.id, predictedOpponentLineup), plan: opponentPlan } : null;
  }, [predictedOpponentLineup, opponentName, plan.style, seasonState.round, seasonState.ladder, opponentIsHome, roster, playerFitness]);
  const opponentUnavailable = useMemo(() => opponentRoster.filter((player) => !isAvailable(player))
    .sort((a, b) => Number(b.overall ?? 0) - Number(a.overall ?? 0))
    .map((player) => {
      const weeks = Number(playerFitness?.[player.id]?.injury?.weeksRemaining ?? 0);
      const games = Number(playerFitness?.[player.id]?.suspension?.matchesRemaining ?? 0);
      return { player, reason: weeks > 0 ? `Injured · ${weeks} wk${weeks === 1 ? "" : "s"}` : `Suspended · ${games}` };
    }), [opponentRoster, playerFitness]);
  // Profile the side that will actually take the field, not every available player.
  const opponentSide = predictedOpponentLineup.map((entry) => entry.player);
  const opponentCoreProfile = Object.entries(coreGroups).map(([name, keys]) => ({ name, value: coreAverage(opponentSide, keys) }))
    .sort((a, b) => b.value - a.value);
  const selectedNames = Object.values(teamSelection?.selectedSide ?? {}).filter(Boolean);
  const availableRoster = useMemo(() => roster.filter(isAvailable), [roster, playerFitness]);
  const confirmedPlayers = teamSelection?.confirmedForRound
    ? roster.filter((player) => selectedNames.includes(player.name))
    : [];
  const analyticsPlayers = teamScope === "LAST_TEAM" ? confirmedPlayers : roster;
  const leaguePlayers = useMemo(() => playerPool
    .map((player) => getCareerPlayer(player, seasonState.playerDevelopment, seasonState.seasonYear, seasonState.playerContracts))
    .filter((player) => getCareerClub(player, seasonState.playerContracts)),
  [playerPool, seasonState.playerDevelopment, seasonState.playerContracts, seasonState.seasonYear]);
  const tacticalFitPlayers = useMemo(() => selectedNames.length
    ? Object.entries(teamSelection.selectedSide ?? {}).flatMap(([position, playerName]) => {
        const player = roster.find((candidate) => candidate.name === playerName);
        return player ? [{ player, position, matchPosition: getPlayingPosition(player, position) }] : [];
      })
    : Object.entries(createAssistantTeamSelection(availableRoster).selectedSide ?? {}).flatMap(([position, playerName]) => {
        const player = availableRoster.find((candidate) => candidate.name === playerName);
        return player ? [{ player, position, matchPosition: getPlayingPosition(player, position) }] : [];
      }), [teamSelection?.selectedSide, roster, availableRoster]);
  const projectedMatchupModel = useMemo(() => buildMatchupModel(tacticalFitPlayers, predictedOpponentLineup, {
    tactics: plan, opponentTactics: opponentStyle?.plan, playerFitness,
  }), [tacticalFitPlayers, predictedOpponentLineup, plan, opponentStyle, playerFitness]);
  const projectedMatchupAnalytics = useMemo(() => buildMatchupAnalytics(projectedMatchupModel, {
    tactics: plan, opponentTactics: opponentStyle?.plan, playerFitness,
  }), [projectedMatchupModel, plan, opponentStyle, playerFitness]);
  // How your own squad profiles against theirs, and the plan your squad would pick against their expected style.
  const ownSide = tacticalFitPlayers.map((entry) => entry.player);
  const ownGroupProfile = Object.entries(coreGroups).map(([name, keys]) => ({ name, value: coreAverage(ownSide, keys) }));
  const opponentGroupProfile = Object.entries(coreGroups).map(([name, keys]) => ({ name, value: coreAverage(opponentSide, keys) }));
  const counterPlan = useMemo(() => {
    if (!opponentStyle || !tacticalFitPlayers.length) return null;
    return recommendTactics(tacticalFitPlayers, {
      seed: club?.name,
      opponentStyle: opponentStyle.plan.style,
      context: {
        round: seasonState.round, isHome: opponentIsHome === null ? null : !opponentIsHome,
        ladderRank: ladderRankOf(club?.name), opponentRank: ladderRankOf(opponentName),
        strengthGap: lineupAverage(tacticalFitPlayers) - lineupAverage(predictedOpponentLineup),
      },
    });
  }, [opponentStyle, tacticalFitPlayers, club?.name, opponentName, opponentIsHome, seasonState.round, seasonState.ladder, predictedOpponentLineup]);
  const styleFit = getTacticalStyleFit(plan.style, tacticalFitPlayers);
  const ratingBonus = getTacticalRatingBonus(plan, tacticalFitPlayers);
  const tacticalClubRating = Number((baseClubRating + ratingBonus).toFixed(1));
  const palette = {
    text: lightMode ? "#0f172a" : "#f8fafc", muted: lightMode ? "#64748b" : "#94a3b8",
    card: lightMode ? "#ffffff" : "#0f172a", surface: lightMode ? "#f1f5f9" : "#111c30",
    border: lightMode ? "#cbd5e1" : "#334155", accent: "#ea580c", green: lightMode ? "#047857" : "#34d399",
    blue: lightMode ? "#2563eb" : "#60a5fa", purple: lightMode ? "#7c3aed" : "#c084fc",
  };
  const cardStyle = { color: palette.text, background: palette.card, border: `1px solid ${palette.border}`, borderRadius: 16, padding: 18, marginBottom: 14 };
  const buttonStyle = (selected) => ({ padding: "9px 13px", borderRadius: 10, border: `1px solid ${selected ? palette.accent : palette.border}`, color: selected ? "#fff" : palette.text, background: selected ? palette.accent : palette.surface, fontWeight: 750, cursor: "pointer" });
  const tabStyle = (selected) => ({ padding: "10px 14px", border: "none", borderRadius: 10, color: selected ? "#fff" : palette.text, background: selected ? palette.accent : (lightMode ? "#eef2f8" : "#1e293b"), fontWeight: "bold", cursor: "pointer" });
  const setStyle = (style) => onTacticsChange((previous) => normalizeTactics({ ...normalizeTactics(previous), style }));
  const setSlider = (id, value) => onTacticsChange((previous) => {
    const current = normalizeTactics(previous);
    return normalizeTactics({ ...current, sliders: { ...current.sliders, [id]: Number(value) } });
  });
  const leagueClubs = useMemo(() => [...new Set(playerPool.map((player) => getCareerClub(player, seasonState.playerContracts)).filter(Boolean))], [playerPool, seasonState.playerContracts]);
  const leagueUnitAverage = (unit) => average(leagueClubs.map((clubName) => average(playerPool
    .map((player) => getCareerPlayer(player, seasonState.playerDevelopment, seasonState.seasonYear, seasonState.playerContracts))
    .filter((player) => getCareerClub(player, seasonState.playerContracts) === clubName && hasPosition(player, unitGroups[unit]))
    .map((player) => Number(player.overall ?? 0)).filter((value) => value > 0))).filter((value) => value > 0));
  const best23Names = new Set(Object.values(createAssistantTeamSelection(roster).selectedSide ?? {}));
  const best23Players = roster.filter((player) => best23Names.has(player.name));
  const teamAttributeComparison = Object.entries(coreGroups).map(([category, keys]) => ({
    category,
    team: coreAverage(analyticsPlayers, keys),
    league: coreAverage(leaguePlayers, keys),
  }));
  const positionDepth = Object.entries(positionGroups).map(([group, codes]) => {
    const eligible = roster.filter((player) => hasPosition(player, codes));
    const available = eligible.filter((player) => !(playerFitness?.[player.id]?.injury && Number(playerFitness[player.id].injury.weeksRemaining ?? 0) > 0));
    const best23Count = eligible.filter((player) => best23Names.has(player.name)).length;
    return { group, count: eligible.length, available: available.length, best23: best23Count, average: average(eligible.map((player) => Number(player.overall ?? 0)).filter((value) => value > 0)) };
  });
  const bestVsClubComparison = [
    ...Object.entries(unitGroups).map(([unit, codes]) => ({ label: `${unit} overall`, best: average(best23Players.filter((player) => hasPosition(player, codes)).map((player) => Number(player.overall ?? 0)).filter((value) => value > 0)), club: average(roster.filter((player) => hasPosition(player, codes)).map((player) => Number(player.overall ?? 0)).filter((value) => value > 0)) })),
    ...Object.entries(coreGroups).map(([category, keys]) => ({ label: category, best: coreAverage(best23Players, keys), club: coreAverage(roster, keys) })),
  ];
  const playerViewCandidates = roster
    .filter((player) => playerViewScope !== "BEST_23" || best23Names.has(player.name))
    .filter((player) => playerViewGroup === "ALL" || hasPosition(player, positionGroups[playerViewGroup] ?? []))
    .slice()
    .sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? "")));
  const selectedIds = new Set(selectedPlayerIds ?? playerViewCandidates.map((player) => String(player.id)));
  const chartPlayers = playerViewCandidates.filter((player) => selectedIds.has(String(player.id)));
  useEffect(() => {
    if (!matrixCategory) return undefined;
    const closeOnEscape = (event) => { if (event.key === "Escape") setMatrixCategory(null); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [matrixCategory]);
  const attributeValue = (player, key) => {
    if (key === "ruckCraft" && !isRuckEligible(player)) return null;
    const value = player.attributes?.[key];
    return value !== null && value !== undefined && Number.isFinite(Number(value)) ? Number(value) : null;
  };
  const chartColors = ["#38bdf8", "#fb923c", "#a78bfa", "#34d399", "#f472b6", "#facc15", "#2dd4bf", "#fb7185", "#818cf8", "#a3e635", "#e879f9", "#22d3ee"];
  const renderAttributeChart = ([category, keys]) => {
    const attributes = keys.filter((key) => playerViewAttribute === "ALL" || key === playerViewAttribute);
    const allValues = attributes.flatMap((key) => leaguePlayers.map((player) => attributeValue(player, key)).filter((value) => value !== null));
    const leagueAverage = average(allValues);
    const width = 840;
    const height = 260;
    const left = 42;
    const right = 14;
    const top = 22;
    const bottom = 48;
    const graphWidth = width - left - right;
    const graphHeight = height - top - bottom;
    const xFor = (index) => attributes.length <= 1 ? left + graphWidth / 2 : left + (index / (attributes.length - 1)) * graphWidth;
    const yFor = (value) => top + ((100 - value) / 100) * graphHeight;
    const colorFor = (player) => chartColors[chartPlayers.findIndex((item) => String(item.id) === String(player.id)) % chartColors.length];

    return <section key={category} style={{ background: palette.card, border: `1px solid ${palette.border}`, borderRadius: 14, padding: 14, minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h4 style={{ margin: 0 }}>{category}</h4>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: palette.muted, fontSize: 12 }}>League average <strong style={{ color: "#fbbf24" }}>{allValues.length ? leagueAverage.toFixed(1) : "—"}</strong></span>
          <button type="button" onClick={() => setMatrixCategory(category)} aria-label={`Open ${category} data matrix`} title={`View ${category} data as a matrix`} style={{ display: "grid", placeItems: "center", width: 32, height: 32, padding: 0, borderRadius: 8, border: `1px solid ${palette.border}`, color: palette.text, background: palette.surface, cursor: "pointer" }}>
            <svg aria-hidden="true" width="17" height="17" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="14" height="14" rx="2"/><path d="M2 6.5h14M2 11h14M6.5 2v14M11 2v14"/></svg>
          </button>
        </div>
      </div>
      {!attributes.length ? <p style={{ color: palette.muted, marginBottom: 0, fontSize: 13 }}>Choose an attribute from this category to view its chart.</p> : <>
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${category} player attributes compared with league average`} style={{ width: "100%", display: "block", marginTop: 8, overflow: "visible" }}>
          {[0, 25, 50, 75, 100].map((tick) => <g key={tick}>
            <line x1={left} x2={width - right} y1={yFor(tick)} y2={yFor(tick)} stroke={palette.border} strokeWidth="1" />
            <text x={left - 9} y={yFor(tick) + 4} fill={palette.muted} fontSize="10" textAnchor="end">{tick}</text>
          </g>)}
          <line x1={left} x2={width - right} y1={yFor(leagueAverage)} y2={yFor(leagueAverage)} stroke="#fbbf24" strokeWidth="2" strokeDasharray="3 6" />
          {chartPlayers.map((player) => {
            const points = attributes.map((key, index) => ({ key, x: xFor(index), value: attributeValue(player, key) })).filter((point) => point.value !== null);
            if (!points.length) return null;
            return <g key={player.id}>
              {points.length > 1 && <polyline points={points.map((point) => `${point.x},${yFor(point.value)}`).join(" ")} fill="none" stroke={colorFor(player)} strokeWidth="2" strokeOpacity="0.8" />}
              {points.map((point) => <circle key={point.key} cx={point.x} cy={yFor(point.value)} r="4" fill={colorFor(player)} stroke={palette.card} strokeWidth="1.5"><title>{player.name} · {attributeLabels[point.key]}: {point.value}</title></circle>)}
            </g>;
          })}
          {attributes.map((key, index) => <text key={key} x={xFor(index)} y={height - 15} fill={palette.muted} fontSize={attributes.length > 5 ? "9" : "10"} textAnchor="middle">{attributeLabels[key] ?? key}</text>)}
        </svg>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", color: palette.muted, fontSize: 11, marginTop: 4 }}>
          <span><i style={{ display: "inline-block", width: 16, borderTop: "2px dashed #fbbf24", marginRight: 5, verticalAlign: "middle" }} />League average</span>
          <span>{chartPlayers.length} selected player{chartPlayers.length === 1 ? "" : "s"}</span>
        </div>
      </>}
    </section>;
  };
  const bar = (label, value, color, suffix = "") => (
    <div key={label} style={{ display: "grid", gridTemplateColumns: "110px minmax(60px, 1fr) 42px", gap: 10, alignItems: "center", margin: "10px 0" }}>
      <span style={{ color: palette.muted, fontSize: 13 }}>{label}</span>
      <div style={{ height: 10, background: palette.surface, borderRadius: 99, overflow: "hidden" }}><div style={{ height: "100%", width: `${Math.max(0, Math.min(100, value))}%`, background: color, borderRadius: 99 }} /></div>
      <strong style={{ textAlign: "right", fontSize: 13 }}>{Math.round(value)}{suffix}</strong>
    </div>
  );

  return (
    <main style={{ color: palette.text }}>
      <div style={{ color: palette.muted, fontSize: 12, fontWeight: 800, letterSpacing: 2 }}>COACHING CENTRE · {club?.name ?? "YOUR CLUB"}</div>
      <h2 style={{ margin: "6px 0 4px" }}>Tactics</h2>
      <p style={{ color: palette.muted, marginTop: 0, marginBottom: 18 }}>Set your match identity and understand the strengths and gaps across your squad.</p>
      <nav aria-label="Tactics sections" style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
        <button type="button" style={tabStyle(activeTab === "GAME_PLAN")} onClick={() => setActiveTab("GAME_PLAN")}>Game Plan</button>
        <button type="button" style={tabStyle(activeTab === "ANALYTICS")} onClick={() => setActiveTab("ANALYTICS")}>Analytics</button>
        <button type="button" style={tabStyle(activeTab === "OPPOSITION")} onClick={() => setActiveTab("OPPOSITION")}>Opposition</button>
      </nav>

      {activeTab === "GAME_PLAN" && <>
        <section style={cardStyle} aria-label="Core tactical styles">
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
            <div><h3 style={{ margin: "0 0 5px" }}>Core style</h3><p style={{ color: palette.muted, margin: 0, fontSize: 13 }}>Style fit reflects the squad’s technical, physical, football IQ and mental attributes.</p></div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <div style={{ padding: "8px 11px", borderRadius: 10, color: palette.muted, background: palette.surface, fontWeight: 700 }}>Best 23 average {baseClubRating}</div>
              <div style={{ padding: "8px 11px", borderRadius: 10, color: palette.green, background: palette.surface, fontWeight: 800 }}>With tactics {tacticalClubRating} ({ratingBonus > 0 ? "+" : ""}{ratingBonus})</div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 235px), 1fr))", gap: 10, marginTop: 16 }}>
            {TACTIC_STYLES.map((style) => {
              const selected = plan.style === style.id;
              const fit = getTacticalStyleFit(style.id, roster);
              return <button key={style.id} type="button" aria-pressed={selected} onClick={() => setStyle(style.id)} style={{ minHeight: 130, padding: 14, textAlign: "left", border: `1px solid ${selected ? palette.accent : palette.border}`, borderRadius: 12, color: palette.text, background: selected ? (lightMode ? "#fff7ed" : "#431b11") : palette.surface, cursor: "pointer" }}>
                <strong style={{ display: "block", marginBottom: 6 }}>{style.name}{selected ? " · Active" : ""}</strong>
                <span style={{ color: palette.muted, fontSize: 13, lineHeight: 1.45, display: "block" }}>{style.description}</span>
                <span style={{ color: palette.blue, fontSize: 12, display: "block", marginTop: 8 }}>Best suited to: {style.suitedTo}</span>
                <span style={{ color: fit.ratingBonus >= 0 ? palette.green : "#f87171", fontSize: 12, fontWeight: 800, display: "block", marginTop: 5 }}>{fit.label} · {fit.score}% attribute fit</span>
              </button>;
            })}
          </div>
        </section>
        <section style={cardStyle} aria-label="Tactical sliders">
          <h3 style={{ margin: "0 0 5px" }}>Team instructions</h3><p style={{ color: palette.muted, margin: "0 0 18px", fontSize: 13 }}>Adjust how the team executes its chosen style.</p>
          <div style={{ display: "grid", gap: 18 }}>{TACTIC_SLIDERS.map((slider) => <label key={slider.id} style={{ display: "grid", gridTemplateColumns: "minmax(72px, 1fr) minmax(100px, 3fr) minmax(72px, 1fr)", alignItems: "center", gap: 12 }}>
            <span style={{ color: plan.sliders[slider.id] < 45 ? palette.accent : palette.muted, textAlign: "right", fontSize: 13, fontWeight: plan.sliders[slider.id] < 45 ? 800 : 600 }}>{slider.left}</span>
            <input aria-label={`${slider.left} to ${slider.right}`} type="range" min="0" max="100" value={plan.sliders[slider.id]} onChange={(event) => setSlider(slider.id, event.target.value)} style={{ width: "100%", accentColor: palette.accent }} />
            <span style={{ color: plan.sliders[slider.id] > 55 ? palette.accent : palette.muted, fontSize: 13, fontWeight: plan.sliders[slider.id] > 55 ? 800 : 600 }}>{slider.right} <small style={{ color: palette.muted, fontWeight: 500 }}>({plan.sliders[slider.id]})</small></span>
          </label>)}</div>
        </section>
        <section style={cardStyle} aria-label="Tactical ratings preview"><h3 style={{ margin: "0 0 5px" }}>Club match profile</h3><p style={{ color: palette.muted, margin: "0 0 14px", fontSize: 13 }}>How this plan adjusts the club’s match ratings.</p><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(115px, 1fr))", gap: 9 }}>{ratingLabels.map(([key, label]) => <div key={key} style={{ padding: 12, borderRadius: 10, background: palette.surface, border: `1px solid ${palette.border}` }}><div style={{ color: palette.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.7 }}>{label}</div><strong style={{ display: "block", marginTop: 5, fontSize: 20, color: ratings[key] >= 2 ? palette.green : ratings[key] <= -2 ? "#f87171" : palette.text }}>{ratings[key] > 0 ? "+" : ""}{ratings[key]}</strong></div>)}</div></section>
      </>}

      {activeTab === "ANALYTICS" && <>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
          {[ ["TEAM", "Team view"], ["PLAYER", "Player view"], ["INSIGHTS", "Insights"] ].map(([key, label]) => <button key={key} type="button" style={tabStyle(analyticsTab === key)} onClick={() => setAnalyticsTab(key)}>{label}</button>)}
        </div>
        {analyticsTab === "TEAM" && <>
          <section style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}><div><h3 style={{ margin: 0 }}>Team profile · {club?.name}</h3><p style={{ color: palette.muted, margin: "5px 0 0", fontSize: 13 }}>Compare unit ratings and core attributes with the league.</p></div><div style={{ display: "flex", gap: 6 }}><button type="button" style={buttonStyle(teamScope === "TOTAL_CLUB")} onClick={() => setTeamScope("TOTAL_CLUB")}>Total Club</button><button type="button" style={buttonStyle(teamScope === "LAST_TEAM")} onClick={() => setTeamScope("LAST_TEAM")}>Last Team</button></div></div>
            {teamScope === "LAST_TEAM" && !teamSelection?.confirmedForRound && <p style={{ color: palette.accent, margin: "14px 0 0", fontSize: 13 }}>No confirmed team sheet yet. Confirm a team in Squad to view Last Team data.</p>}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 18 }}>
              {Object.entries(unitGroups).map(([unit, codes]) => { const values = analyticsPlayers.filter((player) => hasPosition(player, codes)).map((player) => Number(player.overall ?? 0)).filter((value) => value > 0); const value = average(values); const league = leagueUnitAverage(unit); return <div key={unit} style={{ background: palette.surface, border: `1px solid ${palette.border}`, borderRadius: 12, padding: 14 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}><strong>{unit}</strong><span style={{ color: palette.muted, fontSize: 12 }}>Team avg · League avg</span></div><div style={{ display: "flex", gap: 10, alignItems: "baseline", margin: "10px 0 5px" }}><b style={{ fontSize: 27, color: palette.blue }}>{value ? value.toFixed(1) : "—"}</b><span style={{ color: palette.muted }}>vs {league ? league.toFixed(1) : "—"}</span></div><div style={{ height: 9, background: lightMode ? "#dbe3ef" : "#263449", borderRadius: 99 }}><div style={{ height: "100%", width: `${Math.min(value, 100)}%`, borderRadius: 99, background: palette.blue }} /></div><small style={{ color: palette.muted, display: "block", marginTop: 6 }}>{values.length} players included · {league ? `${value >= league ? "+" : ""}${(value - league).toFixed(1)} vs league` : "No league data"}</small></div>; })}
            </div>
          </section>
          <section style={cardStyle} aria-label="Next opponent matchup analytics">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", flexWrap: "wrap", gap: 12 }}>
              <div><h3 style={{ margin: "0 0 5px" }}>Line matchups · {opponentName ?? "next opponent"}</h3><p style={{ color: palette.muted, margin: 0, fontSize: 13 }}>Projected on-field pairs use the same role, height, attribute and contextual trait calculations as Match Centre. The opponent team is predicted until confirmed.</p></div>
              <label style={{ color: palette.muted, fontSize: 12, fontWeight: 750 }}>Compare attribute<br /><select value={matchupAttribute} onChange={(event) => setMatchupAttribute(event.target.value)} style={{ marginTop: 5, minWidth: 150, padding: "7px 9px", borderRadius: 8, border: `1px solid ${palette.border}`, background: palette.surface, color: palette.text }}>{MATCHUP_ANALYTICS_ATTRIBUTES.map((key) => <option key={key} value={key}>{attributeLabels[key] ?? key}</option>)}</select></label>
            </div>
            {!opponentName || !projectedMatchupModel.matchups.length ? <p style={{ color: palette.muted, marginBottom: 0 }}>Line comparisons appear when both teams have a projected on-field lineup.</p> : <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 215px), 1fr))", gap: 10, marginTop: 16 }}>
                {[["forward", "Forward line"], ["midfield", "Midfield"], ["defence", "Defence"]].map(([key, label]) => {
                  const line = projectedMatchupAnalytics.lines[key];
                  const attribute = line.attributes.find((item) => item.key === matchupAttribute);
                  return <button key={key} type="button" aria-pressed={matchupLine === key} onClick={() => setMatchupLine(key)} style={{ textAlign: "left", padding: 13, borderRadius: 12, border: `1px solid ${matchupLine === key ? palette.accent : palette.border}`, background: palette.surface, color: palette.text, cursor: "pointer" }}>
                    <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><strong>{label}</strong><b style={{ color: line.edge >= 5 ? palette.green : line.edge <= -5 ? "#f87171" : palette.muted }}>{line.edge > 0 ? "+" : ""}{line.edge}</b></span>
                    <span style={{ color: palette.muted, display: "block", fontSize: 12, margin: "8px 0 6px" }}>{attribute?.count ? `${attribute.own.toFixed(1)} vs ${attribute.opponent.toFixed(1)} · ${attribute.gap > 0 ? "+" : ""}${attribute.gap.toFixed(1)}` : "No paired rating"}</span>
                    <span style={{ display: "flex", height: 7, borderRadius: 99, overflow: "hidden", background: palette.border }}><i style={{ width: `${attribute?.count ? attribute.own / (attribute.own + attribute.opponent) * 100 : 50}%`, background: palette.blue }} /><i style={{ flex: 1, background: "#fbbf24" }} /></span>
                    <small style={{ color: palette.muted, display: "block", marginTop: 7 }}>{line.pairs.length}/6 pairs · {line.traitCount} contextual trait opportunities</small>
                  </button>;
                })}
              </div>
              <div style={{ marginTop: 18 }}><strong style={{ display: "block", marginBottom: 9 }}>{matchupLine === "forward" ? "Forward line" : matchupLine === "midfield" ? "Midfield" : "Defence"} · attribute gaps</strong><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 235px), 1fr))", gap: 8 }}>
                {projectedMatchupAnalytics.lines[matchupLine].attributes.filter((item) => item.count).map((item) => <div key={item.key} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "8px 10px", borderRadius: 8, background: palette.surface, fontSize: 12 }}><span>{item.label}</span><span style={{ fontVariantNumeric: "tabular-nums" }}><b style={{ color: palette.blue }}>{item.own.toFixed(1)}</b><span style={{ color: palette.muted }}> / </span><b style={{ color: "#fbbf24" }}>{item.opponent.toFixed(1)}</b><span style={{ color: item.gap >= 3 ? palette.green : item.gap <= -3 ? "#f87171" : palette.muted }}> ({item.gap > 0 ? "+" : ""}{item.gap.toFixed(1)})</span></span></div>)}
              </div></div>
              <div style={{ marginTop: 15, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 235px), 1fr))", gap: 8 }}>
                {projectedMatchupAnalytics.lines[matchupLine].pairs.map((pair) => <div key={pair.ownSlot} style={{ padding: "9px 10px", border: `1px solid ${palette.border}`, borderRadius: 9, fontSize: 12 }}><span style={{ color: palette.muted }}>{pair.ownSlot} vs {pair.opponentSlot}</span><strong style={{ display: "block", margin: "3px 0" }}>{pair.ownName} · {pair.opponentName}</strong><span style={{ color: pair.edge >= 5 ? palette.green : pair.edge <= -5 ? "#f87171" : palette.muted }}>{pair.edge > 0 ? "+" : ""}{pair.edge} · {pair.label}</span>{pair.traitInteractions?.own?.map((rule) => <small key={`${rule.trait}:${rule.against}`} style={{ display: "block", color: rule.factor < 1 ? "#f87171" : palette.green, marginTop: 4 }}>{rule.factor < 1 ? "Countered" : "Exploit"}: {rule.reason}</small>)}{pair.traitInteractions?.opponent?.map((rule) => <small key={`opponent:${rule.trait}:${rule.against}`} style={{ display: "block", color: rule.factor < 1 ? palette.green : "#f87171", marginTop: 4 }}>{rule.factor < 1 ? "You counter" : "They exploit"}: {rule.reason}</small>)}{(projectedMatchupAnalytics.traitOpportunitiesByPlayer[pair.ownPlayerId] ?? []).map((trait) => <small key={trait.id} style={{ display: "block", color: palette.purple, marginTop: 4 }}>{trait.label}: {trait.phases.join(", ")}</small>)}</div>)}
              </div>
            </>}
          </section>
          <section style={cardStyle}><h3 style={{ margin: "0 0 5px" }}>Core attribute profile</h3><p style={{ color: palette.muted, margin: "0 0 14px", fontSize: 13 }}>Averages across the selected team group.</p>{Object.entries(coreGroups).map(([name, keys], index) => bar(name, coreAverage(analyticsPlayers, keys), [palette.blue, palette.green, palette.purple, palette.accent][index]))}</section>
          <section style={cardStyle} aria-label="Team attributes compared with league">
            <div style={{ marginBottom: 14 }}><h3 style={{ margin: "0 0 5px" }}>Attribute profile vs league</h3><p style={{ color: palette.muted, margin: 0, fontSize: 13 }}>Compare the selected squad view with the average rating of league-listed players.</p></div>
            <div style={{ display: "grid", gap: 13 }}>
              {teamAttributeComparison.map(({ category, team, league }) => <div key={category} style={{ display: "grid", gridTemplateColumns: "minmax(85px, 135px) minmax(0, 1fr) 82px", gap: 10, alignItems: "center" }}>
                <strong style={{ fontSize: 13 }}>{category}</strong>
                <div style={{ display: "grid", gap: 5 }}>
                  <div title={`Team ${team.toFixed(1)}`} style={{ height: 9, borderRadius: 99, background: lightMode ? "#e2e8f0" : "#263449", overflow: "hidden" }}><div style={{ width: `${Math.min(team, 100)}%`, height: "100%", borderRadius: 99, background: palette.blue }} /></div>
                  <div title={`League ${league.toFixed(1)}`} style={{ height: 5, borderRadius: 99, background: lightMode ? "#e2e8f0" : "#263449", overflow: "hidden" }}><div style={{ width: `${Math.min(league, 100)}%`, height: "100%", borderRadius: 99, background: "#fbbf24" }} /></div>
                </div>
                <span style={{ textAlign: "right", fontSize: 12, fontVariantNumeric: "tabular-nums" }}><b style={{ color: palette.blue }}>{team ? team.toFixed(1) : "—"}</b><span style={{ color: palette.muted }}> / {league ? league.toFixed(1) : "—"}</span></span>
              </div>)}
            </div>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", color: palette.muted, fontSize: 12, marginTop: 14 }}><span><i style={{ display: "inline-block", width: 13, height: 7, borderRadius: 9, background: palette.blue, marginRight: 5 }} />{teamScope === "TOTAL_CLUB" ? "Total club" : "Last team"}</span><span><i style={{ display: "inline-block", width: 13, height: 5, borderRadius: 9, background: "#fbbf24", marginRight: 5 }} />League average</span></div>
          </section>
          <section style={cardStyle} aria-label="Position depth chart">
            <div style={{ marginBottom: 14 }}><h3 style={{ margin: "0 0 5px" }}>Position depth</h3><p style={{ color: palette.muted, margin: 0, fontSize: 13 }}>List coverage, currently available players and Best 23 selections by position group. Players may qualify for more than one group.</p></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 210px), 1fr))", gap: 10 }}>
              {positionDepth.map(({ group, count, available, best23, average: groupAverage }) => <article key={group} style={{ padding: 13, borderRadius: 12, background: palette.surface, border: `1px solid ${palette.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}><strong>{group}</strong><span style={{ color: count <= 2 ? "#f87171" : palette.blue, fontWeight: 800 }}>{available} available</span></div>
                <div style={{ height: 8, background: lightMode ? "#dbe3ef" : "#263449", borderRadius: 99, margin: "11px 0 8px", overflow: "hidden" }}><div style={{ width: `${Math.min(count / 8 * 100, 100)}%`, height: "100%", background: count <= 2 ? "#f87171" : palette.green, borderRadius: 99 }} /></div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, color: palette.muted, fontSize: 12 }}><span>{count} listed · {best23} Best 23</span><span>Avg {groupAverage ? groupAverage.toFixed(1) : "—"}</span></div>
              </article>)}
            </div>
          </section>
          <section style={cardStyle} aria-label="Best 23 compared with total club">
            <div style={{ marginBottom: 14 }}><h3 style={{ margin: "0 0 5px" }}>Best 23 vs Total Club</h3><p style={{ color: palette.muted, margin: 0, fontSize: 13 }}>See how the selected best 23 compares with the full list across unit ratings and core attributes.</p></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: "10px 22px" }}>
              {bestVsClubComparison.map(({ label, best, club: total }) => <div key={label} style={{ display: "grid", gridTemplateColumns: "minmax(90px, 125px) minmax(0, 1fr) 74px", alignItems: "center", gap: 9 }}>
                <span style={{ color: palette.muted, fontSize: 12 }}>{label}</span>
                <div style={{ height: 9, background: lightMode ? "#e2e8f0" : "#263449", borderRadius: 99, overflow: "hidden" }}><div style={{ width: `${Math.min(best, 100)}%`, height: "100%", borderRadius: 99, background: palette.purple }} /></div>
                <span style={{ textAlign: "right", fontSize: 12, fontVariantNumeric: "tabular-nums" }}><b style={{ color: palette.purple }}>{best ? best.toFixed(1) : "—"}</b><span style={{ color: palette.muted }}> / {total ? total.toFixed(1) : "—"}</span></span>
              </div>)}
            </div>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", color: palette.muted, fontSize: 12, marginTop: 14 }}><span><i style={{ display: "inline-block", width: 13, height: 7, borderRadius: 9, background: palette.purple, marginRight: 5 }} />Best 23</span><span>Full list shown as comparison value</span></div>
          </section>
        </>}
        {analyticsTab === "PLAYER" && <>
          <section style={cardStyle} aria-label="Player analytics filters">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "end", justifyContent: "space-between" }}>
              <div><h3 style={{ margin: 0 }}>Player attribute comparison</h3><p style={{ color: palette.muted, margin: "5px 0 0", fontSize: 13 }}>Select a squad group, position and attribute, then choose which players appear in the category charts.</p></div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
                <label style={{ display: "grid", gap: 4, color: palette.muted, fontSize: 12 }}>Squad<select value={playerViewScope} onChange={(event) => { setPlayerViewScope(event.target.value); setSelectedPlayerIds(null); }} style={{ minWidth: 135, padding: 8, borderRadius: 8, color: palette.text, background: palette.surface, border: `1px solid ${palette.border}` }}><option value="BEST_23">Best 23</option><option value="ALL_PLAYERS">All players</option></select></label>
                <label style={{ display: "grid", gap: 4, color: palette.muted, fontSize: 12 }}>Position category<select value={playerViewGroup} onChange={(event) => { setPlayerViewGroup(event.target.value); setSelectedPlayerIds(null); }} style={{ minWidth: 145, padding: 8, borderRadius: 8, color: palette.text, background: palette.surface, border: `1px solid ${palette.border}` }}><option value="ALL">All positions</option>{Object.keys(positionGroups).map((group) => <option key={group}>{group}</option>)}</select></label>
                <label style={{ display: "grid", gap: 4, color: palette.muted, fontSize: 12 }}>Attribute<select value={playerViewAttribute} onChange={(event) => setPlayerViewAttribute(event.target.value)} style={{ minWidth: 155, padding: 8, borderRadius: 8, color: palette.text, background: palette.surface, border: `1px solid ${palette.border}` }}><option value="ALL">All attributes</option>{Object.entries(coreGroups).flatMap(([category, keys]) => keys.map((key) => <option key={key} value={key}>{category} · {attributeLabels[key]}</option>))}</select></label>
              </div>
            </div>
            <div style={{ borderTop: `1px solid ${palette.border}`, margin: "16px 0 12px" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
              <div><strong>Players</strong><span style={{ color: palette.muted, fontSize: 12, marginLeft: 8 }}>{selectedIds.size} of {playerViewCandidates.length} selected · A–Z</span></div>
              <button type="button" onClick={() => setSelectedPlayerIds(selectedIds.size === playerViewCandidates.length ? [] : playerViewCandidates.map((player) => String(player.id)))} style={{ ...buttonStyle(selectedIds.size !== playerViewCandidates.length), padding: "7px 11px" }}>{selectedIds.size === playerViewCandidates.length ? "Clear all" : "Select all"}</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 250px), 1fr))", gap: "2px 16px", maxHeight: 250, overflowY: "auto", padding: "2px 4px 2px 0" }}>
              {playerViewCandidates.map((player) => {
                const id = String(player.id);
                const checked = selectedIds.has(id);
                const color = chartColors[chartPlayers.findIndex((item) => String(item.id) === id) % chartColors.length];
                return <label key={id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 8px", borderRadius: 8, cursor: "pointer", color: palette.text, background: checked ? palette.surface : "transparent" }}>
                  <input type="checkbox" checked={checked} onChange={() => setSelectedPlayerIds((current) => {
                    const next = new Set(current ?? playerViewCandidates.map((item) => String(item.id)));
                    if (next.has(id)) next.delete(id); else next.add(id);
                    return [...next];
                  })} style={{ accentColor: palette.accent }} />
                  <span style={{ width: 9, height: 9, borderRadius: 99, flex: "0 0 auto", background: checked ? color : palette.border }} />
                  <span style={{ minWidth: 0 }}><strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13 }}>{player.name}</strong><small style={{ color: palette.muted }}>{(player.positions ?? []).join(" / ")} · {player.overall ?? "—"} OVR</small></span>
                </label>;
              })}
              {!playerViewCandidates.length && <p style={{ color: palette.muted }}>No players match these filters.</p>}
            </div>
          </section>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 390px), 1fr))", gap: 12 }}>
            {Object.entries(coreGroups).map(renderAttributeChart)}
          </div>
          {matrixCategory && <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setMatrixCategory(null); }} style={{ position: "fixed", inset: 0, zIndex: 1000, display: "grid", placeItems: "center", padding: 16, background: "rgba(2, 6, 23, 0.78)" }}>
            <section role="dialog" aria-modal="true" aria-labelledby="player-attribute-matrix-title" style={{ width: "min(1100px, 100%)", maxHeight: "min(85vh, 800px)", overflow: "hidden", display: "flex", flexDirection: "column", color: palette.text, background: palette.card, border: `1px solid ${palette.border}`, borderRadius: 16, boxShadow: "0 24px 80px rgba(0,0,0,.45)" }}>
              <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: `1px solid ${palette.border}` }}>
                <div><h3 id="player-attribute-matrix-title" style={{ margin: 0 }}>{matrixCategory} · Player matrix</h3><p style={{ margin: "4px 0 0", color: palette.muted, fontSize: 13 }}>{chartPlayers.length} selected players · values use the current squad and position filters</p></div>
                <button type="button" onClick={() => setMatrixCategory(null)} aria-label="Close matrix" style={{ ...buttonStyle(false), padding: "7px 11px", fontSize: 18, lineHeight: 1 }}>×</button>
              </header>
              {(() => {
                const matrixAttributes = (coreGroups[matrixCategory] ?? []).filter((key) => playerViewAttribute === "ALL" || key === playerViewAttribute);
                return <div style={{ overflow: "auto", padding: 16 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: Math.max(560, 200 + matrixAttributes.length * 110) }}>
                    <thead><tr style={{ background: palette.surface, textAlign: "left" }}><th scope="col" style={{ position: "sticky", top: 0, left: 0, zIndex: 2, padding: "10px 12px", background: palette.surface, borderBottom: `1px solid ${palette.border}` }}>Player</th>{matrixAttributes.map((key) => <th key={key} scope="col" style={{ position: "sticky", top: 0, zIndex: 1, padding: "10px 12px", whiteSpace: "nowrap", textAlign: "right", background: palette.surface, borderBottom: `1px solid ${palette.border}` }}>{attributeLabels[key]}</th>)}</tr></thead>
                    <tbody>
                      {chartPlayers.map((player) => <tr key={player.id}>
                        <th scope="row" style={{ position: "sticky", left: 0, padding: "9px 12px", textAlign: "left", whiteSpace: "nowrap", background: palette.card, borderBottom: `1px solid ${palette.border}` }}>{player.name}</th>
                        {matrixAttributes.map((key) => { const value = attributeValue(player, key); return <td key={key} style={{ padding: "9px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: value === null ? palette.muted : palette.text, borderBottom: `1px solid ${palette.border}` }}>{value === null ? "—" : value}</td>; })}
                      </tr>)}
                      <tr style={{ background: palette.surface }}><th scope="row" style={{ position: "sticky", left: 0, padding: "10px 12px", textAlign: "left", whiteSpace: "nowrap", background: palette.surface, borderTop: `1px solid ${palette.border}` }}>League average</th>{matrixAttributes.map((key) => { const values = leaguePlayers.map((player) => attributeValue(player, key)).filter((value) => value !== null); return <td key={key} style={{ padding: "10px 12px", textAlign: "right", fontWeight: 750, color: "#fbbf24", fontVariantNumeric: "tabular-nums", borderTop: `1px solid ${palette.border}` }}>{values.length ? average(values).toFixed(1) : "—"}</td>; })}</tr>
                    </tbody>
                  </table>
                  {!chartPlayers.length && <p style={{ color: palette.muted, textAlign: "center", margin: "18px 0 4px" }}>No players are selected for this matrix. Select players in the list to add their values.</p>}
                </div>;
              })()}
            </section>
          </div>}
        </>}
        {analyticsTab === "INSIGHTS" && <>
          <section style={cardStyle}><h3 style={{ margin: "0 0 5px" }}>Squad insights</h3><p style={{ color: palette.muted, margin: "0 0 14px", fontSize: 13 }}>Attribute-led observations to help shape development and match selection.</p><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>{Object.entries(coreGroups).map(([label, keys]) => { const score = coreAverage(roster, keys); const sorted = [...roster].map((player) => ({ player, score: coreAverage([player], keys) })).sort((a, b) => b.score - a.score); return <article key={label} style={{ padding: 14, borderRadius: 12, background: palette.surface, border: `1px solid ${palette.border}` }}><div style={{ color: palette.muted, fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>{label} profile</div><strong style={{ fontSize: 26, display: "block", margin: "5px 0", color: score >= 75 ? palette.green : palette.blue }}>{score ? score.toFixed(1) : "—"}</strong><div style={{ height: 8, background: lightMode ? "#dbe3ef" : "#263449", borderRadius: 99 }}><div style={{ height: "100%", width: `${score}%`, background: palette.accent, borderRadius: 99 }} /></div><p style={{ color: palette.muted, fontSize: 13, marginBottom: 0 }}>{sorted[0]?.player.name ? `Standout: ${sorted[0].player.name} (${Math.round(sorted[0].score)})` : "No player ratings available."}</p></article>; })}</div></section>
          <section style={cardStyle}><h3 style={{ margin: "0 0 8px" }}>Best 22 style fit</h3><p style={{ color: palette.muted, margin: "0 0 12px", fontSize: 13 }}>Based on the 22 highest-rated players, their listed positions, and the attributes each style relies on. Players in roles suited to a style count more heavily.</p>{TACTIC_STYLES.map((style) => { const fit = getTacticalStyleFit(style.id, roster); return <div key={style.id} style={{ display: "grid", gridTemplateColumns: "minmax(130px, 1fr) minmax(100px, 2fr) 100px", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${palette.border}` }}><strong style={{ fontSize: 13 }}>{style.name}</strong><div style={{ height: 8, background: palette.surface, borderRadius: 99 }}><div style={{ height: "100%", width: `${fit.score}%`, background: fit.ratingBonus >= 0 ? palette.green : "#f87171", borderRadius: 99 }} /></div><span style={{ color: palette.muted, fontSize: 12, textAlign: "right" }}>{fit.score}% · {fit.label}</span></div>; })}</section>
        </>}
      </>}

      {activeTab === "OPPOSITION" && <>
        {!upcomingMatch || !opponentName ? <section style={cardStyle}><h3 style={{ marginTop: 0 }}>No upcoming opponent</h3><p style={{ color: palette.muted, marginBottom: 0 }}>An opposition scouting report will appear when your next fixture is scheduled.</p></section> : (
          <OppositionReport
            palette={palette}
            cardStyle={cardStyle}
            club={club}
            opponentName={opponentName}
            upcomingMatch={upcomingMatch}
            seasonState={seasonState}
            isHome={opponentIsHome}
            isMatchDay={Boolean(seasonState.calendarClock?.date && upcomingMatch.date && String(upcomingMatch.date).slice(0, 10) === seasonState.calendarClock.date)}
            predictedLineup={predictedOpponentLineup}
            unavailable={opponentUnavailable}
            opponentStyle={opponentStyle}
            counterPlan={counterPlan}
            currentPlan={plan}
            onApplyCounter={(counter) => onTacticsChange(normalizeTactics({ style: counter.style, sliders: counter.sliders }))}
            ownGroupProfile={ownGroupProfile}
            opponentGroupProfile={opponentGroupProfile}
            matchupModel={projectedMatchupModel}
            matchupAnalytics={projectedMatchupAnalytics}
          />
        )}
      </>}
    </main>
  );
}