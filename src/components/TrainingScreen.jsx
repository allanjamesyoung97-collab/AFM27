import { useEffect, useState } from "react";
import { players } from "../data/players.js";
import { getAttributeSeasonForecast, getAvailableIndividualTrainingFocuses, getCareerPlayer, getPlayerDevelopmentForecast, getTeamFormRate, trainingAttributeLabels } from "../engine/developmentEngine.js";
import { trainingCategories, getTrainingCategoryById } from "../data/trainingCategories.js";
import { trainingPrograms, getTrainingProgramById, getPlayerEndurance, getFitnessColor, getInjuryCategoryColor } from "../engine/fitnessEngine.js";
import PotentialStars from "./PotentialStars.jsx";
import { calculateTrainingAttributeProgress } from "../engine/trainingEngine.js";
import { TRAINABLE_POSITIONS, positionTrainingDuration } from "../engine/positionDevelopmentEngine.js";

const attributeGroups = [
  ["Technical", ["kicking", "handball", "marking", "goalSense", "tackling", "spoiling", "groundBallGet", "contestedBall", "runCarry"]],
  ["Physical", ["speed", "acceleration", "agility", "endurance", "strength", "verticalLeap", "durability"]],
  ["Football IQ", ["vision", "decisionMaking", "positioning", "composure", "creativity", "gameAwareness", "ruckCraft"]],
  ["Mental", ["leadership", "workRate", "professionalism", "determination", "teamwork", "competitiveness", "discipline"]],
];

const trainingPlans = [
  { id: "BALANCED", name: "Balanced", detail: "Normal training load with no match fatigue adjustment." },
  { id: "SKILLS", name: "Skills focus", detail: "Technical work. No direct fatigue adjustment in the current match model." },
  { id: "FITNESS", name: "Fitness block", detail: "Higher workload adds 2 fatigue points to your club in the next simulated match." },
  { id: "DEFENCE", name: "Defensive focus", detail: "Team defensive preparation. No direct fatigue adjustment in the current match model." },
  { id: "ATTACK", name: "Attacking focus", detail: "Team attacking preparation. No direct fatigue adjustment in the current match model." },
  { id: "RECOVERY", name: "Recovery week", detail: "Reduced workload removes up to 2 fatigue points in the next simulated match." },
];

const tabs = [
  ["OVERVIEW", "OVERVIEW"],
  ["SQUAD_TRAINING", "SQUAD TRAINING"],
  ["DEVELOPMENT", "DEVELOPMENT"],
  ["PLAN", "TEAM PLAN"],
];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const points = (match, side) => match?.[`${side}Score`] ?? 0;
const otherSide = (side) => side === "home" ? "away" : "home";

export default function TrainingScreen({
  appearance = "dark",
  players: playerPool = players,
  club,
  seasonState,
  trainingPlan = "BALANCED",
  onTrainingPlanChange = () => {},
  onPlayerTrainingFocusChange = () => {},
  onPlayerPositionTrainingChange = () => {},
  playerFitness = {},
  onPlayerProgramChange = () => {},
  onReserveAssignmentChange = () => {},
  teamSelection = {},
  assistantManagedTraining = true,
  onTrainingModeChange = () => {},
  facilityBonuses = {},
  trainingEvents = [],
  currentDate = new Date(),
  navigationTab = null,
  navigationSequence = 0,
}) {
  const [activeTab, setActiveTab] = useState("OVERVIEW");
  useEffect(() => { if (navigationTab) setActiveTab(navigationTab); }, [navigationSequence, navigationTab]);
  const lightMode = appearance === "light";
  const palette = {
    text: lightMode ? "#0f172a" : "#f8fafc",
    muted: lightMode ? "#64748b" : "#94a3b8",
    card: lightMode ? "#ffffff" : "#0f172a",
    panel: lightMode ? "#f1f5f9" : "#111c30",
    border: lightMode ? "#cbd5e1" : "#334155",
    tile: lightMode ? "#e2e8f0" : "#1e293b",
    accent: "#ea580c",
    green: lightMode ? "#047857" : "#34d399",
    red: lightMode ? "#b91c1c" : "#f87171",
    blue: "#3b82f6",
  };
  const clubName = club?.name ?? "Unknown club";
  const seniorNames = new Set(Object.values(teamSelection?.selectedSide ?? {}).filter(Boolean));
  const playerDevelopment = seasonState?.playerDevelopment ?? {};
  const squad = playerPool
    .map((player) => getCareerPlayer(player, playerDevelopment, seasonState?.seasonYear ?? 2027, seasonState?.playerContracts))
    .filter((player) => player.club === clubName)
    .slice()
    .sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0));
  const roundHistory = seasonState?.roundHistory ?? [];
  const clubMatches = roundHistory
    .flatMap((roundEntry) => (roundEntry.results ?? []).map((match) => ({ ...match, round: roundEntry.round })))
    .filter((match) =>
      (match.homeTeam ?? match.home) === clubName ||
      (match.awayTeam ?? match.away) === clubName
    )
    .sort((a, b) => a.round - b.round);
  const lastMatch = clubMatches[clubMatches.length - 1] ?? null;
  const nextRound = seasonState?.phase === "HOME_AND_AWAY"
    ? seasonState.fixture?.find((fixtureRound) => fixtureRound.round === seasonState.round)
    : null;
  const nextMatch = nextRound?.matches?.find((match) =>
    (match.homeTeam ?? match.home) === clubName ||
    (match.awayTeam ?? match.away) === clubName
  ) ?? null;
  const nextSide = nextMatch
    ? (nextMatch.homeTeam ?? nextMatch.home) === clubName ? "home" : "away"
    : null;
  const opponent = nextSide ? nextMatch[nextSide === "home" ? "awayTeam" : "homeTeam"] ?? nextMatch[otherSide(nextSide)] : null;
  const selectedPlan = trainingPlans.find((plan) => plan.id === trainingPlan) ?? trainingPlans[0];
  const planFatigueAdjustment = trainingPlan === "RECOVERY" ? -2 : trainingPlan === "FITNESS" ? 2 : 0;
  const scheduledFatiguePenalty = nextSide ? nextMatch[`${nextSide}FatiguePenalty`] ?? 0 : 0;
  const projectedMatchPenalty = Math.max(0, scheduledFatiguePenalty + planFatigueAdjustment);

  const getFitness = (playerId) => {
    const state = playerFitness?.[playerId];
    return state ? clamp(state.fitness ?? 100, 0, 100) : 100;
  };
  const getWorkload = (playerId) => {
    const state = playerFitness?.[playerId];
    return state ? clamp(state.workload ?? 0, 0, 100) : 0;
  };
  const getInjury = (playerId) => {
    const state = playerFitness?.[playerId];
    return state?.injury ?? null;
  };
  const getProgram = (playerId) => {
    const state = playerFitness?.[playerId];
    return state?.trainingProgram ?? "FULL_TRAINING";
  };

  const fitnessValues = squad.map((p) => getFitness(p.id));
  const averageFitness = fitnessValues.length
    ? Math.round(fitnessValues.reduce((a, b) => a + b, 0) / fitnessValues.length)
    : 100;
  const injuredPlayers = squad.filter((p) => {
    const inj = getInjury(p.id);
    return inj && inj.weeksRemaining > 0;
  });
  const restedPlayers = squad.filter((p) => getProgram(p.id) === "REST");
  const unavailablePlayers = injuredPlayers;

  const teamFormRate = getTeamFormRate(clubName, roundHistory);
  const clubMorale = Number(seasonState?.clubMorale?.[clubName] ?? 50);
  const developmentContext = {
    seasonYear: seasonState?.seasonYear ?? 2027,
    trainingPlanByClub: { [clubName]: trainingPlan },
    teamFormByClub: { [clubName]: teamFormRate },
    clubMorale: { [clubName]: clubMorale },
    facilityBonuses,
  };
  const completedTrainingIds = new Set(seasonState?.completedTrainingEventIds ?? []);
  const remainingTrainingEvents = trainingEvents.filter((event) => {
    if (event.type !== "TRAINING" || completedTrainingIds.has(event.id) || !event.date) return false;
    const eventDate = new Date(event.date);
    const today = new Date(currentDate);
    eventDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return eventDate >= today;
  });
  const seasonMatches = [
    ...roundHistory.flatMap((entry) => entry.results ?? []),
    ...(seasonState?.wildcardResults ?? []),
    ...(seasonState?.finalsHistory ?? []).flatMap((week) => week.results ?? []),
  ];
  const playerSeasonUsage = {};
  seasonMatches.forEach((match) => {
    [...(match.playerStats?.home ?? []), ...(match.playerStats?.away ?? [])].forEach((stat) => {
      if (!stat.playerId || Number(stat.timeOnGround ?? 0) <= 0) return;
      const record = playerSeasonUsage[String(stat.playerId)] ?? { minutes: 0, games: 0, performance: 0 };
      record.minutes += Number(stat.timeOnGround) / 100 * 80;
      record.games += 1;
      const positions = stat.positions ?? [];
      const keyDefender = positions.includes("KPD");
      record.performance += Number(stat.disposals ?? 0) * 0.55
        + Number(stat.goals ?? 0) * 5
        + Number(stat.clearances ?? 0) * 2.3
        + Number(stat.tackles ?? 0) * 1.25
        + Number(stat.marks ?? 0) * 0.8
        + Number(stat.inside50s ?? 0) * 0.8
        + Number(stat.intercepts ?? 0) * (keyDefender ? 3.6 : 1.2)
        + Number(stat.rebound50s ?? 0) * (keyDefender ? 2.4 : 0.8)
        + Number(stat.hitouts ?? 0) * (positions.some((position) => ["RUC", "RUCK"].includes(position)) ? 0.5 : 0.03);
      playerSeasonUsage[String(stat.playerId)] = record;
    });
  });
  for (const [key, reserveUsage] of Object.entries(seasonState?.calendarUsage ?? {})) {
    const [usageYear, playerId] = key.split(':');
    if (Number(usageYear) !== Number(seasonState?.seasonYear) || !Number(reserveUsage?.reserveMinutes)) continue;
    const record = playerSeasonUsage[playerId] ?? { minutes: 0, games: 0, performance: 0, reserveGames: 0 };
    record.minutes += Number(reserveUsage.reserveMinutes) * 0.55;
    record.reserveGames = Number(reserveUsage.reservesGames ?? 0);
    playerSeasonUsage[playerId] = record;
  }
  const developingPlayers = squad
    .map((player) => {
      const savedDevelopment = playerDevelopment[player.id] ?? {};
      const focus = savedDevelopment.positionTraining?.target && !savedDevelopment.positionTraining.complete
        ? "Position Training" : savedDevelopment.trainingFocus === "Position Training" ? "Balanced" : savedDevelopment.trainingFocus ?? player.development?.trainingFocus ?? "Balanced";
      const fitnessState = playerFitness?.[player.id] ?? {};
      const attributeTrainingProgress = { ...(fitnessState.attributeTrainingProgress ?? {}) };
      for (const event of remainingTrainingEvents) {
        const perSession = calculateTrainingAttributeProgress(player, focus, event.data?.category?.id, {
          trainingProgram: fitnessState.trainingProgram,
          facilityDevelopmentBonus: facilityBonuses?.trainingDevelopmentMultiplier ?? 1,
        });
        Object.entries(perSession).forEach(([attribute, amount]) => {
          attributeTrainingProgress[attribute] = Number(attributeTrainingProgress[attribute] ?? 0) + Number(amount ?? 0);
        });
      }
      const usage = playerSeasonUsage[String(player.id)] ?? { minutes: 0, games: 0, performance: 0 };
      const performanceRating = usage.games
        ? Math.max(0, Math.min(100, Math.round((usage.performance / usage.games - 10) * 3)))
        : 50;
      const forecast = getPlayerDevelopmentForecast(player, savedDevelopment, {
        ...developmentContext,
        playerPerformanceById: { [player.id]: performanceRating },
        playerMinutesPlayedById: { [player.id]: usage.minutes },
      });
      const attributeDevelopment = getAttributeSeasonForecast(player, {
        focus,
        age: forecast.age,
        overallChange: forecast.change,
        teamPlan: trainingPlan,
        minutesPlayed: usage.minutes,
        matchesPlayed: usage.games + Number(usage.reserveGames ?? 0),
        performanceRating,
        coachingMultiplier: facilityBonuses?.trainingDevelopmentMultiplier ?? 1,
        trainingProgress: attributeTrainingProgress,
        savedProgress: savedDevelopment.attributeProgress ?? {},
        staffAttributeBonuses: facilityBonuses?.staffAttributeBonuses ?? {},
      });
      const attributeForecast = attributeDevelopment.attributes;
      return {
        ...player,
        potential: forecast.potential,
        headroom: Math.max(0, forecast.potential - Number(player.overall ?? 0)),
        forecast,
        trainingFocus: focus,
        attributeForecast,
        attributeDevelopment,
      };
    })
    .sort((a, b) => b.headroom - a.headroom || (b.overall ?? 0) - (a.overall ?? 0));

  const cardStyle = {
    color: palette.text,
    background: palette.card,
    border: `1px solid ${palette.border}`,
    borderRadius: 16,
    padding: 18,
  };
  const tileStyle = {
    background: palette.panel,
    border: `1px solid ${palette.border}`,
    borderRadius: 12,
    padding: 14,
  };
  const mutedStyle = { color: palette.muted };
  const getLastResult = () => {
    if (!lastMatch) return "No matches simulated yet";
    const side = (lastMatch.homeTeam ?? lastMatch.home) === clubName ? "home" : "away";
    const opposition = side === "home" ? lastMatch.awayTeam ?? lastMatch.away : lastMatch.homeTeam ?? lastMatch.home;
    const clubScore = points(lastMatch, side);
    const opponentScore = points(lastMatch, otherSide(side));
    const outcome = clubScore > opponentScore ? "W" : clubScore < opponentScore ? "L" : "D";
    return `R${lastMatch.round} · ${outcome} ${clubScore}–${opponentScore} vs ${opposition}`;
  };

  const playerPosition = (player) => Array.isArray(player.positions) ? player.positions.join(" / ") : player.positions ?? "—";
  const progressBar = (value, color = palette.green) => (
    <div style={{ height: 8, borderRadius: 999, overflow: "hidden", background: palette.tile }}>
      <div style={{ width: `${clamp(value, 0, 100)}%`, height: "100%", background: color }} />
    </div>
  );
  const sectionHeader = (title, subtitle) => (
    <div style={{ marginBottom: 16 }}>
      <h3 style={{ margin: "0 0 5px" }}>{title}</h3>
      {subtitle && <div style={{ ...mutedStyle, fontSize: 13 }}>{subtitle}</div>}
    </div>
  );

  const programColor = (programId) => {
    switch (programId) {
      case "FULL_TRAINING": return palette.accent;
      case "LIGHT_TRAINING": return palette.blue;
      case "RECOVERY_TRAINING": return palette.green;
      case "REST": return palette.muted;
      default: return palette.muted;
    }
  };

  return (
    <main style={{ color: palette.text, fontFamily: "Arial, sans-serif" }}>
      <div style={{ ...mutedStyle, fontSize: 12, fontWeight: 800, letterSpacing: 2 }}>PLAYER PERFORMANCE</div>
      <h2 style={{ margin: "6px 0 4px" }}>Training Centre</h2>
      <p style={{ ...mutedStyle, margin: "0 0 18px" }}>
        {clubName} · Season {seasonState?.seasonYear ?? "—"} · {seasonState?.phase === "HOME_AND_AWAY" ? `Round ${Math.min(seasonState.round, seasonState.fixture?.length ?? 23)} of ${seasonState.fixture?.length ?? 23}` : seasonState?.phase === "POST_SEASON" ? "Post-season" : seasonState?.phase ?? "Pre-season"}
      </p>

      <nav aria-label="Training centre sections" style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={activeTab === id}
            onClick={() => setActiveTab(id)}
            style={{
              padding: "10px 14px",
              border: "none",
              borderRadius: 10,
              color: activeTab === id ? "#ffffff" : palette.text,
              background: activeTab === id ? palette.accent : (lightMode ? "#eef2f8" : "#1e293b"),
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >{label}</button>
        ))}
      </nav>

      {activeTab === "OVERVIEW" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(165px, 1fr))", gap: 12, marginBottom: 12 }}>
            <div style={cardStyle}><div style={mutedStyle}>SQUAD SIZE</div><strong style={{ display: "block", fontSize: 28, marginTop: 8 }}>{squad.length}</strong><div style={{ ...mutedStyle, fontSize: 12 }}>players in club list</div></div>
            <div style={cardStyle}><div style={mutedStyle}>AVG FITNESS</div><strong style={{ display: "block", fontSize: 28, marginTop: 8, color: getFitnessColor(averageFitness) }}>{averageFitness}%</strong><div style={{ marginTop: 9 }}>{progressBar(averageFitness, getFitnessColor(averageFitness))}</div></div>
            <div style={cardStyle}><div style={mutedStyle}>MATCHES PLAYED</div><strong style={{ display: "block", fontSize: 28, marginTop: 8 }}>{clubMatches.length}</strong><div style={{ ...mutedStyle, fontSize: 12 }}>this season</div></div>
            <div style={cardStyle}><div style={mutedStyle}>INJURED</div><strong style={{ display: "block", fontSize: 28, marginTop: 8, color: injuredPlayers.length ? palette.red : palette.green }}>{injuredPlayers.length}</strong><div style={{ ...mutedStyle, fontSize: 12 }}>{restedPlayers.length} on rest</div></div>
            <div style={cardStyle}><div style={mutedStyle}>AVG WORKLOAD</div><strong style={{ display: "block", fontSize: 28, marginTop: 8 }}>{Math.round(squad.reduce((sum, player) => sum + getWorkload(player.id), 0) / Math.max(1, squad.length))}%</strong><div style={{ ...mutedStyle, fontSize: 12 }}>current training load</div></div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 12 }}>
            <section style={cardStyle}>
              {sectionHeader("Next match", "Preparation uses the selected club's real fixture.")}
              {nextMatch ? (
                <>
                  <strong style={{ fontSize: 20 }}>{clubName} vs {opponent}</strong>
                  <p style={mutedStyle}>{nextMatch.date ?? "Date to be confirmed"}{nextMatch.venue ? ` · ${nextMatch.venue}` : ""}</p>
                  <div style={tileStyle}>
                    <div style={mutedStyle}>Projected fatigue effect in match engine</div>
                    <strong style={{ display: "block", marginTop: 5 }}>−{projectedMatchPenalty} rating</strong>
                    <div style={{ ...mutedStyle, fontSize: 12, marginTop: 4 }}>{selectedPlan.name}: {selectedPlan.detail}</div>
                    <div style={{ ...mutedStyle, fontSize: 12, marginTop: 4 }}>Rest before match: {nextMatch[`${nextSide}RestDays`] ?? "—"} days · Schedule fatigue: {scheduledFatiguePenalty} · Plan adjustment: {planFatigueAdjustment > 0 ? "+" : ""}{planFatigueAdjustment}</div>
                  </div>
                </>
              ) : <p style={mutedStyle}>There are no remaining home-and-away fixtures for this club.</p>}
            </section>
            <section style={cardStyle}>
              {sectionHeader("Latest result", "Read directly from the season simulation results.")}
              <strong style={{ fontSize: 18 }}>{getLastResult()}</strong>
              {lastMatch && <p style={mutedStyle}>{lastMatch.date ?? ""}{lastMatch.venue ? ` · ${lastMatch.venue}` : ""}</p>}
              {lastMatch && <div style={tileStyle}>
                <div>Recovery interval: {(((lastMatch.homeTeam ?? lastMatch.home) === clubName ? lastMatch.homeRestDays : lastMatch.awayRestDays) ?? "—")} days</div>
                <div>Recorded fatigue penalty: {((lastMatch.homeTeam ?? lastMatch.home) === clubName ? lastMatch.homeFatiguePenalty : lastMatch.awayFatiguePenalty) ?? 0}</div>
                <div style={{ ...mutedStyle, fontSize: 12, marginTop: 4 }}>Match-engine penalties: {lastMatch.homeFatiguePenalty ?? 0} home · {lastMatch.awayFatiguePenalty ?? 0} away</div>
              </div>}
            </section>
          </div>
        </>
      )}

      {activeTab === "SQUAD_TRAINING" && (
        <section style={cardStyle}>
          {sectionHeader("Squad fitness and training", "Review availability and workload, then set an individual program and development focus for every player.")}
          <div style={{ ...tileStyle, display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 14, fontSize: 12 }}>
            {trainingPrograms.map((prog) => (
              <div key={prog.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: programColor(prog.id) }} />
                <strong style={{ color: palette.text }}>{prog.name}</strong>
              </div>
            ))}
          </div>
          {squad.length ? squad.map((player) => {
            const fit = getFitness(player.id);
            const wl = getWorkload(player.id);
            const inj = getInjury(player.id);
            const prog = getProgram(player.id);
            const end = getPlayerEndurance(player);
            const isCarryingInjury = inj && inj.weeksRemaining > 0;
            return (
              <article key={player.id ?? player.name} style={{ ...tileStyle, marginBottom: 8, display: "grid", gridTemplateColumns: "minmax(140px, 1.5fr) repeat(5, 60px) minmax(180px, 1.4fr)", alignItems: "center", gap: 12 }}>
                <div>
                  <strong>{player.name}</strong>
                  <div style={{ fontSize: 11, color: palette.muted, marginTop: 2 }}>Age {player.age ?? "—"} · {playerPosition(player)} · OVR {player.overall ?? "—"}</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: palette.muted }}>FIT</div>
                  <strong style={{ color: getFitnessColor(fit) }}>{Math.round(fit)}%</strong>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: palette.muted }}>END</div>
                  <strong>{end}</strong>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: palette.muted }}>LOAD</div>
                  <strong style={{ color: wl > 70 ? palette.red : wl > 50 ? "#f59e0b" : palette.green }}>{Math.round(wl)}%</strong>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: palette.muted }}>SHARP</div>
                  <strong style={{ color: Number(playerFitness[player.id]?.matchSharpness ?? 65) < 65 ? palette.red : palette.green }}>{Math.round(Number(playerFitness[player.id]?.matchSharpness ?? 65))}%</strong>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: palette.muted }}>STATUS</div>
                  <strong style={{ color: isCarryingInjury ? getInjuryCategoryColor(inj.category) : palette.green, fontSize: 11 }}>{isCarryingInjury ? `${inj.weeksRemaining}w out` : prog === "REST" ? "Resting" : "Available"}</strong>
                </div>
                <div>
                  <select
                    value={prog}
                    disabled={isCarryingInjury}
                    onChange={(event) => onPlayerProgramChange(player.id, event.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${palette.border}`, background: palette.panel, color: palette.text, fontSize: 13, fontWeight: 700, cursor: isCarryingInjury ? "not-allowed" : "pointer" }}
                  >
                    {trainingPrograms.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}
                  </select>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 8px", fontSize: 10, color: palette.muted, marginTop: 4 }}>
                    <span>Growth ×{getTrainingProgramById(prog).developmentMultiplier.toFixed(2)}</span>
                    <span>Load ×{getTrainingProgramById(prog).recoveryMultiplier.toFixed(2)}</span>
                    <span>Injury {getTrainingProgramById(prog).injuryRiskAdd > 0 ? "+" : ""}{getTrainingProgramById(prog).injuryRiskAdd.toFixed(1)}</span>
                  </div>
                  <select
                    aria-label={`Individual training focus for ${player.name}`}
                    value={playerDevelopment[player.id]?.positionTraining?.target && !playerDevelopment[player.id]?.positionTraining?.complete ? "Position Training" : playerDevelopment[player.id]?.trainingFocus === "Position Training" ? "Balanced" : playerDevelopment[player.id]?.trainingFocus ?? player.development?.trainingFocus ?? "Balanced"}
                    disabled={isCarryingInjury}
                    onChange={(event) => onPlayerTrainingFocusChange(player.id, event.target.value)}
                    style={{ width: "100%", marginTop: 7, padding: "7px 9px", borderRadius: 8, border: `1px solid ${palette.border}`, background: palette.panel, color: palette.text, fontSize: 12, fontWeight: 700, cursor: isCarryingInjury ? "not-allowed" : "pointer" }}
                  >
                    {playerDevelopment[player.id]?.positionTraining?.target && !playerDevelopment[player.id]?.positionTraining?.complete && <option value="Position Training">Position Training</option>}
                    {getAvailableIndividualTrainingFocuses(player).map((focus) => <option key={focus} value={focus}>{focus} focus</option>)}
                  </select>
                  {isCarryingInjury && <div style={{ fontSize: 10, color: getInjuryCategoryColor(inj.category), marginTop: 3 }}>{inj.name} — recovery mode</div>}
                  {!seniorNames.has(player.name) && <label style={{ display: "block", fontSize: 11, color: palette.muted, marginTop: 8 }}>
                    Outside senior 23 · next match
                    <select aria-label={`Reserves assignment for ${player.name}`}
                      value={playerFitness[player.id]?.reservesAssignment ?? "RESERVES"}
                      disabled={isCarryingInjury || Number(playerFitness[player.id]?.suspension?.matchesRemaining ?? 0) > 0}
                      onChange={(event) => onReserveAssignmentChange(player.id, event.target.value)}
                      style={{ width: "100%", marginTop: 3, padding: "7px 9px", borderRadius: 8, border: `1px solid ${palette.border}`, background: palette.panel, color: palette.text }}>
                      <option value="RESERVES">Play reserves · sharpness up, fitness down</option>
                      <option value="REST">Rest · fitness up, sharpness down</option>
                    </select>
                  </label>}
                </div>
              </article>
            );
          }) : <p style={mutedStyle}>No players available.</p>}
        </section>
      )}

      {activeTab === "DEVELOPMENT" && (
        <section style={cardStyle}>
          {sectionHeader("Player development", "Age drives each player's growth curve. Training focus, happiness, team form and morale adjust the projection. Growth is applied when you start the next season.")}
          <div style={{ ...tileStyle, display: "flex", flexWrap: "wrap", gap: 18, marginBottom: 12, fontSize: 13 }}>
            <span>Team form factor: <strong>{Math.round(teamFormRate * 100)}%</strong></span>
            <span>Club morale: <strong>{clubMorale}/100</strong></span>
            <span>Team plan: <strong>{selectedPlan.name}</strong></span>
          </div>
          {developingPlayers.length ? developingPlayers.map((player) => (
            <article key={player.id ?? player.name} style={{ ...tileStyle, marginBottom: 9 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
                <strong>{player.name}</strong>
                <span style={{ color: player.forecast.change < 0 ? palette.red : palette.green }}>
                  {player.forecast.change > 0 ? "+" : ""}{player.forecast.change} OVR projected
                </span>
              </div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", ...mutedStyle, fontSize: 13, margin: "7px 0 9px" }}>
                <span>Age {player.age ?? "—"} · {player.forecast.ageBand}</span>
                <span>OVR {player.overall ?? "—"}</span>
                <span>POT: <PotentialStars potential={player.potential} /></span>
                <span>Previous season {Math.round(Number(player.development?.growthThisSeason ?? 0)) > 0 ? "+" : ""}{Math.round(Number(player.development?.growthThisSeason ?? 0))}</span>
                <span>Happiness {Math.round(Number(player.development?.happiness ?? 50))}/100</span>
                <span>{playerPosition(player)}</span>
                <span>Game time {player.attributeDevelopment.seasonMinutes} min · {Math.round(player.attributeDevelopment.exposure * 100)}% exposure</span>
                <span>Development staff ×{player.attributeDevelopment.coachingMultiplier.toFixed(2)}</span>
                <span>Performance {Math.round(player.attributeDevelopment.performanceRating)}/100</span>
                <span>Minutes factor ×{player.forecast.gameExposureMultiplier.toFixed(2)}</span>
              </div>
              <label style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 11, color: palette.muted, fontSize: 13 }}>
                Training focus
                <select
                  value={playerDevelopment[player.id]?.positionTraining?.target && !playerDevelopment[player.id]?.positionTraining?.complete ? "Position Training" : playerDevelopment[player.id]?.trainingFocus === "Position Training" ? "Balanced" : playerDevelopment[player.id]?.trainingFocus ?? player.development?.trainingFocus ?? "Balanced"}
                  onChange={(event) => onPlayerTrainingFocusChange(player.id, event.target.value)}
                  style={{ padding: "7px 9px", borderRadius: 8, border: `1px solid ${palette.border}`, background: palette.panel, color: palette.text }}
                >
                  {playerDevelopment[player.id]?.positionTraining?.target && !playerDevelopment[player.id]?.positionTraining?.complete && <option value="Position Training">Position Training</option>}
                  {getAvailableIndividualTrainingFocuses(player).map((focus) => <option key={focus} value={focus}>{focus}</option>)}
                </select>
              </label>
              <label style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 10, color: palette.muted, fontSize: 13 }}>
                Learn position
                <select value={playerDevelopment[player.id]?.positionTraining?.complete ? "" : playerDevelopment[player.id]?.positionTraining?.target ?? ""}
                  onChange={(event) => onPlayerPositionTrainingChange(player.id, event.target.value, positionTrainingDuration(player, event.target.value))}
                  style={{ padding: "7px 9px", borderRadius: 8, border: `1px solid ${palette.border}`, background: palette.panel, color: palette.text }}>
                  <option value="">No new position</option>
                  {TRAINABLE_POSITIONS.filter((position) => !(player.positions ?? []).includes(position)).map((position) =>
                    <option key={position} value={position}>{position} · about {Math.ceil(positionTrainingDuration(player, position) / 7)} weeks</option>)}
                </select>
              </label>
              {playerDevelopment[player.id]?.positionTraining?.target && !playerDevelopment[player.id]?.positionTraining?.complete && (
                <div style={{ marginTop: 7, fontSize: 12, color: palette.muted }}>
                  {playerDevelopment[player.id].positionTraining.target} familiarity: {Math.round(100 * Number(playerDevelopment[player.id].positionTraining.progress ?? 0))}%
                  <progress value={Number(playerDevelopment[player.id].positionTraining.progress ?? 0)} max={1} style={{ display: "block", width: "100%", marginTop: 5 }} />
                </div>
              )}
              {playerDevelopment[player.id]?.positionTraining?.complete && (
                <div style={{ marginTop: 7, fontSize: 12, color: palette.green }}>
                  Learned {playerDevelopment[player.id].positionTraining.target} · now available in team selection
                </div>
              )}
              <details style={{ marginTop: 12, borderTop: `1px solid ${palette.border}`, paddingTop: 10 }}>
                <summary style={{ cursor: "pointer", color: palette.text, fontSize: 12, fontWeight: 700, display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8 }}>
                  <span>Season attribute forecast · {remainingTrainingEvents.length} scheduled sessions</span>
                  <span style={{ color: palette.green }}>{Object.values(player.attributeForecast).filter((item) => item.growth >= 0.05).length} improving · {Object.values(player.attributeForecast).filter((item) => item.growth <= -0.05).length} declining</span>
                </summary>
                <p style={{ ...mutedStyle, fontSize: 11, margin: "8px 0 12px", lineHeight: 1.5 }}>
                  {player.trainingFocus === "Position Training"
                    ? "Individual training time is assigned to learning the new position. Changing to an attribute focus stops that position plan."
                    : player.trainingFocus === "Balanced"
                    ? "Balanced spreads each scheduled session across the player's full attribute profile. Choosing a focus concentrates growth, while the session type gives matching attributes an extra boost."
                    : player.trainingFocus === "Recovery"
                      ? "Recovery sessions protect readiness and fitness; they do not add skill growth. Other scheduled session types still contribute to their listed attributes."
                      : `${player.trainingFocus} focus concentrates the forecast on relevant attributes. Session types that match the focus add extra progress.`}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 10, fontSize: 10 }}>
                  <span style={{ ...tileStyle, padding: "5px 8px" }}>Attribute growth budget <strong style={{ color: palette.green }}>+{player.attributeDevelopment.growthBudget.toFixed(2)}</strong></span>
                  <span style={{ ...tileStyle, padding: "5px 8px" }}>Age <strong>{player.attributeDevelopment.ageBand} ×{player.attributeDevelopment.ageFactor.toFixed(2)}</strong></span>
                  <span style={{ ...tileStyle, padding: "5px 8px" }}>Match exposure <strong>{Math.round(player.attributeDevelopment.exposure * 100)}%</strong></span>
                  <span style={{ ...tileStyle, padding: "5px 8px" }}>Coach quality <strong>×{player.attributeDevelopment.coachingMultiplier.toFixed(2)}</strong></span>
                  <span style={{ ...tileStyle, padding: "5px 8px" }}>Performance <strong>{Math.round(player.attributeDevelopment.performanceRating)}/100</strong></span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 245px), 1fr))", gap: 10 }}>
                  {attributeGroups.map(([group, attributes]) => {
                    const rows = attributes.filter((attribute) => Object.hasOwn(player.attributes ?? {}, attribute) && Object.hasOwn(player.attributeForecast, attribute));
                    if (!rows.length) return null;
                    const groupGrowth = rows.reduce((sum, attribute) => sum + player.attributeForecast[attribute].growth, 0);
                    return (
                      <div key={group} style={{ ...tileStyle, padding: 11 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline", marginBottom: 9 }}>
                          <strong style={{ fontSize: 12 }}>{group}</strong>
                          <span style={{ color: groupGrowth < 0 ? palette.red : palette.green, fontSize: 11, fontWeight: 700 }}>{groupGrowth > 0 ? "+" : ""}{groupGrowth.toFixed(1)} forecast</span>
                        </div>
                        <div style={{ display: "grid", gap: 8 }}>
                          {rows.map((attribute) => {
                            const projection = player.attributeForecast[attribute];
                            const currentWidth = Math.max(0, Math.min(100, projection.current));
                            const projectedWidth = Math.max(0, Math.min(100, projection.projected));
                            const growthWidth = Math.abs(projectedWidth - currentWidth);
                            const growthLeft = projection.growth < 0 ? projectedWidth : currentWidth;
                            return (
                              <div key={attribute}>
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 6, fontSize: 10, marginBottom: 3 }}>
                                  <span style={mutedStyle}>{trainingAttributeLabels[attribute] ?? attribute}</span>
                                  <strong>{projection.current} <span style={{ color: projection.growth < 0 ? palette.red : palette.green }}>{projection.growth > 0 ? "+" : ""}{projection.growth.toFixed(1)}</span></strong>
                                </div>
                                <div aria-label={`${trainingAttributeLabels[attribute]} ${projection.current}, projected growth ${projection.growth.toFixed(1)}`} style={{ position: "relative", height: 7, borderRadius: 99, background: lightMode ? "#dbe3ed" : "#0a1220", overflow: "hidden" }}>
                                  <span style={{ display: "block", width: `${currentWidth}%`, height: "100%", borderRadius: 99, background: palette.blue }} />
                                  <span style={{ position: "absolute", left: `${growthLeft}%`, top: 0, height: "100%", width: `${growthWidth}%`, minWidth: Math.abs(projection.growth) > 0 ? 2 : 0, borderRadius: "0 99px 99px 0", background: projection.growth < 0 ? palette.red : palette.green, opacity: 0.9 }} />
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, marginTop: 2, ...mutedStyle }}>
                                  <span>Current {projection.current}</span><span>Season end {projection.projected.toFixed(1)}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </details>
            </article>
          )) : <p style={mutedStyle}>No player development records are available.</p>}
        </section>
      )}

      {activeTab === "PLAN" && (
        <section style={cardStyle}>
          {sectionHeader("Weekly team plan", "Your plan is saved with this career and feeds the club's fatigue adjustment in the next simulated match.")}
          <div style={{ ...tileStyle, marginBottom: 14, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
            <strong>Training mode:</strong>
            <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
              <input type="radio" checked={assistantManagedTraining} onChange={() => onTrainingModeChange(true)} style={{ accentColor: palette.accent }} />
              Delegated (assistant coaches manage loads)
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
              <input type="radio" checked={!assistantManagedTraining} onChange={() => onTrainingModeChange(false)} style={{ accentColor: palette.accent }} />
              User managed (you schedule sessions)
            </label>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 230px), 1fr))", gap: 10 }}>
            {trainingPlans.map((plan) => {
              const selected = plan.id === trainingPlan;
              return (
                <button key={plan.id} type="button" aria-pressed={selected} onClick={() => onTrainingPlanChange(plan.id)} style={{ textAlign: "left", padding: 15, border: `1px solid ${selected ? palette.accent : palette.border}`, borderRadius: 12, color: palette.text, background: selected ? (lightMode ? "#fff7ed" : "#431b11") : palette.panel, cursor: "pointer" }}>
                  <strong style={{ display: "block", marginBottom: 6 }}>{plan.name}{selected ? " · Active" : ""}</strong>
                  <span style={{ color: palette.muted, fontSize: 13, lineHeight: 1.45 }}>{plan.detail}</span>
                </button>
              );
            })}
          </div>
          <p style={{ ...mutedStyle, fontSize: 12, margin: "14px 0 0" }}>The team plan affects player growth at season rollover as well as match fatigue. Individual programs and focus are saved per player. When delegated, assistant coaches automatically adjust individual programs based on player age, fitness, injuries and upcoming fixtures.</p>
          <details style={{ marginTop: 16, borderTop: `1px solid ${palette.border}`, paddingTop: 12 }}>
            <summary style={{ cursor: "pointer", fontWeight: 700 }}>Training type effects reference</summary>
            <p style={{ ...mutedStyle, fontSize: 12, margin: "8px 0 12px" }}>Each scheduled session affects fitness, development, match readiness, morale, injury risk and fatigue.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: 10 }}>
              {trainingCategories.map((cat) => (
                <div key={cat.id} style={{ ...tileStyle, borderLeft: `4px solid ${cat.intensity >= 5 ? palette.red : cat.intensity >= 3 ? palette.accent : palette.green}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><strong>{cat.name}</strong><span style={{ fontSize: 11, color: palette.muted }}>Intensity {cat.intensity}/6</span></div>
                  <p style={{ ...mutedStyle, fontSize: 12, margin: "6px 0 10px", lineHeight: 1.45 }}>{cat.description}</p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))", gap: 6, fontSize: 11 }}>
                    <div style={{ color: palette.muted }}>Development <strong style={{ color: cat.effects.development > 0 ? palette.green : palette.red }}>{cat.effects.development > 0 ? "+" : ""}{cat.effects.development}</strong></div>
                    <div style={{ color: palette.muted }}>Fatigue <strong style={{ color: cat.effects.fatigue > 0 ? palette.red : palette.green }}>{cat.effects.fatigue > 0 ? "+" : ""}{cat.effects.fatigue}</strong></div>
                    <div style={{ color: palette.muted }}>Readiness <strong style={{ color: cat.effects.readiness > 0 ? palette.green : palette.red }}>{cat.effects.readiness > 0 ? "+" : ""}{cat.effects.readiness}</strong></div>
                    <div style={{ color: palette.muted }}>Morale <strong style={{ color: cat.effects.morale > 0 ? palette.green : palette.red }}>{cat.effects.morale > 0 ? "+" : ""}{cat.effects.morale}</strong></div>
                    <div style={{ color: palette.muted }}>Injury risk <strong style={{ color: cat.effects.injuryRisk > 0 ? palette.red : palette.green }}>{cat.effects.injuryRisk > 0 ? "+" : ""}{cat.effects.injuryRisk}</strong></div>
                  </div>
                  <div style={{ marginTop: 9, fontSize: 11, lineHeight: 1.5, color: palette.muted }}><strong style={{ color: palette.text }}>Attributes developed: </strong>{(cat.attributeTargets ?? []).length ? cat.attributeTargets.map((attribute) => `${trainingAttributeLabels[attribute] ?? attribute}${attribute === "ruckCraft" ? " (ruckmen)" : ""}`).join(" · ") : "No direct attribute growth"}</div>
                </div>
              ))}
            </div>
          </details>
        </section>
      )}
    </main>
  );
}
