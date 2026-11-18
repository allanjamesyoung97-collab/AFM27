import { protectKicker, runningProfile } from "../engine/footballMotion.js";
import { describePlay, OVAL_SLOTS, planOvalMovement, planCentrePassageStep, chooseSpatialPossession, distanceToGoal, METRES_PER_X, METRES_PER_Y } from "../engine/matchPresentation.js";
import { useEffect, useMemo, useRef, useState } from "react";
import "./MatchCentre.css";
import LiveMatchOval from "./LiveMatchOval.jsx";
import { players } from "../data/players.js";
import { clubs } from "../data/clubs.js";
import ClubBadge from "./ClubBadge.jsx";
import { supabase } from "../lib/supabase.js";
import { DEFAULT_TACTICS, getTacticalDefenceBonus, getTacticalRatingBonus, getTacticalPhaseProfile, getTacticalRatings, normalizeTactics, recommendTactics, TACTIC_SLIDERS, TACTIC_STYLES } from "../engine/tacticsEngine.js";
import { getDefaultTimeOnGround, getFitnessColor, getPlayerEndurance } from "../engine/fitnessEngine.js";
import { balanceMatchTimePlan, createMatchTimePlan, getMatchTimeBudget } from "../engine/matchTimeBudget.js";
import { attachMatchStatistics, getPlayingPosition } from "../engine/statisticsEngine.js";
import { applyActionStatChanges, captureActionStatChanges } from "../engine/liveMatchActionStats.js";
import { actionTiming, GOAL_CELEBRATION_MS, MATCH_ACTION_INTERVAL_MS, MATCH_SHOT_INTERVAL_MS, MATCH_SHOT_ANIMATION_MS, MATCH_PLAYBACK_BASE_SPEED, MAX_GOAL_PRESENTATION_SPEED, MAX_LIVE_PRESENTATION_SPEED, MIN_ACTION_DELAY_MS, nextMatchActionSeconds } from "../engine/liveMatchPacing.js";
import { resolveLiveShot } from "../engine/liveShotEngine.js";
import { getGoalScoringWeight } from "../engine/goalScoringEngine.js";
import { weightedPlayer } from "../engine/livePlayerSelection.js";
import { getCareerPlayer } from "../engine/developmentEngine.js";
import { createAssistantTeamSelection } from "../engine/teamSelectionEngine.js";
import { buildMatchupModel, getMatchupSlotFamily, recommendMatchupSwap, resolveActiveSlots } from "../engine/matchupEngine.js";
import { getSlotSuitability } from "../engine/positionSuitability.js";
import { buildMatchupAnalytics } from "../engine/matchupAnalyticsEngine.js";
import { evaluateTraitContext } from "../engine/traitEngine.js";
import { captureMatchAdvice, evaluateMatchAdvice } from "../engine/matchAdviceEngine.js";
import { getPlayerTraitIds, getTraitDefinition } from "../data/footballData.js";
import { lineMatchEffects, selectedSideStrength } from "../engine/tacticalMatchModel.js";
import { auditPlayedMatch } from "../engine/matchEventAudit.js";


const formatMatchDate = (value) => {
  if (!value) return "Today";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
};

const quarterLabels = ["Q1", "Q2", "Q3", "Q4"];
const matchPhaseToTraitPhase = ["stoppage", "groundBall", "transition", "forwardEntry", "aerialContest", "scoring"];
const QUARTER_SECONDS = 20 * 60;
const MIN_FIELD_PLAYERS = 18;
const matchSpeeds = [1, 2, 4, 8];
const fieldRows = [
  ["Forward line", ["FP1", "FF", "FP2"]],
  ["Half-forward line", ["HF1", "CHF", "HF2"]],
  ["Midfield", ["W1", "C", "W2"]],
  ["Followers", ["RR", "R", "ROV"]],
  ["Half-back line", ["HB1", "CHB", "HB2"]],
  ["Back line", ["BP1", "FB", "BP2"]],
];
const benchSlots = ["INT1", "INT2", "INT3", "INT4", "INT5"];
const statColumns = [
  ["AF", "fantasyPoints"], ["D", "disposals"], ["G.B", "scoreLine"],
  ["K", "kicks"], ["H", "handballs"], ["M", "marks"], ["T", "tackles"], ["CP", "contestedPossessions"],
];
const clubCodes = {
  Adelaide: "ADL", Brisbane: "BRI", Carlton: "CAR", Collingwood: "COL",
  Essendon: "ESS", Fremantle: "FRE", Geelong: "GEE", "Gold Coast": "GCS",
  GWS: "GWS", Hawthorn: "HAW", Melbourne: "MEL", "North Melbourne": "NTH",
  "Port Adelaide": "PTA", Richmond: "RIC", "St Kilda": "STK", Sydney: "SYD",
  "West Coast": "WCE", "Western Bulldogs": "WBD",
};
const clubCodeFor = (clubName) => clubCodes[clubName]
  ?? clubs.find((team) => team.name === clubName)?.abbreviation?.slice(0, 3).toUpperCase()
  ?? String(clubName ?? "???").slice(0, 3).toUpperCase();
const abbreviatedPlayerName = (name = "") => {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? `${parts[0][0]}. ${parts.at(-1)}` : (parts[0] ?? "Unknown");
};
const teamStatGroups = [
  ["Disposals", [["Disposals", "disposals"], ["Kicks", "kicks"], ["Handballs", "handballs"], ["Inside 50s", "inside50s"], ["Disposal efficiency", "disposalEfficiency", "%"]]],
  ["Scoring", [["Goals · Behinds", "scoreLine"], ["Goal efficiency", "goalEfficiency", "%"], ["Free kicks", "freeKicks"]]],
  ["Stoppages", [["Hit-outs", "hitouts"], ["Clearances", "clearances"], ["Centre clearances", "centreClearances"], ["Stoppage clearances", "stoppageClearances"]]],
  ["Possessions", [["Contested possessions", "contestedPossessions"], ["Uncontested possessions", "uncontestedPossessions"], ["Turnovers", "turnovers"], ["Intercepts", "intercepts"]]],
  ["Marks", [["Marks", "marks"], ["Marks inside 50", "marksInside50"], ["Contested marks", "contestedMarks"]]],
  ["Defence", [["Tackles", "tackles"], ["Tackles inside 50", "tacklesInside50"], ["Bounces", "bounces"], ["One percenters", "onePercenters"]]],
];
const playerInstructions = [
  "No instruction",
  "Tag their best player",
  "Pressure their exit",
  "Push higher",
  "Hold position",
  "Protect the corridor",
  "Stay goal side",
  "Run into space",
  "Contest hard",
  "Crumb the contest",
  "Spoil the contest",
  "Lead up at the ball",
  "Attack the aerial contest",
  "Rotate through the midfield",
];
const instructionDescriptions = {
  "Tag their best player": "When this player is involved in a defensive contest, the opponent is more likely to turn the ball over.",
  "Pressure their exit": "Closes down an opposing ball user, lowering their effective disposals and increasing tackle pressure.",
  "Push higher": "Adds this player's tackles and forward-half entries when they win the ball.",
  "Hold position": "Improves this player's intercept and one-percent effort chances.",
  "Protect the corridor": "Improves intercepts and one-percenters, and makes the team harder to score against.",
  "Stay goal side": "Improves this player's tackle and intercept chances while defending.",
  "Run into space": "Increases this player's effective use, bounces and inside-50 entries.",
  "Contest hard": "Increases this player's contested possessions, clearances and tackles.",
  "Crumb the contest": "Keeps this player near aerial spills and improves contested possessions, inside-50 entries and scoring pressure.",
  "Spoil the contest": "Attacks the opponent's marking chance and increases one-percent efforts.",
  "Lead up at the ball": "Increases this player's marks and forward-50 marks, and modestly improves scoring pressure.",
  "Attack the aerial contest": "Improves this player's marking and ruck contest impact.",
  "Rotate through the midfield": "Makes this player more likely to be involved in possession phases.",
};
const instructionEffects = {
  "Tag their best player": { defensive: 0.025, tackle: 0.12, tag: 0.075, target: "opposition" },
  "Pressure their exit": { opponentEffectiveDisposal: -0.035, tackle: 0.09, defensive: 0.015 },
  "Push higher": { inside50: 0.12, tackle: 0.08, defensive: -0.008 },
  "Hold position": { intercept: 0.13, onePercenter: 0.12, defensive: 0.012 },
  "Protect the corridor": { intercept: 0.16, onePercenter: 0.1, defensive: 0.03 },
  "Stay goal side": { intercept: 0.08, tackle: 0.13, defensive: 0.02 },
  "Run into space": { inside50: 0.17, bounce: 0.12, effective: 0.035 },
  "Contest hard": { contested: 0.17, clearance: 0.12, tackle: 0.1 },
  "Crumb the contest": { contested: 0.09, inside50: 0.06, attack: 0.02 },
  "Spoil the contest": { opponentMark: -0.045, onePercenter: 0.13 },
  "Lead up at the ball": { mark: 0.15, markInside50: 0.12, attack: 0.025 },
  "Attack the aerial contest": { mark: 0.12, hitout: 0.1, contested: 0.04 },
  "Rotate through the midfield": { usage: 1.35, contested: 0.06 },
};
function getAssistantAdvice(match, managerSide, selectedLineup) {
  if (!match || !["LIVE", "PAUSED", "QUARTER_BREAK"].includes(match.status)) return null;
  const tactics = normalizeTactics(match.tactics);
  const instructions = match.instructions && typeof match.instructions === "object" ? match.instructions : {};
  const lineup = Array.isArray(selectedLineup) ? selectedLineup : [];
  const own = match.teamStats?.[managerSide];
  const opposition = match.teamStats?.[managerSide === "home" ? "away" : "home"];
  if (!own || !opposition || (match.elapsedSeconds ?? 0) < 240) return null;
  const players = match.playerStats?.[managerSide] ?? [];
  const highTurnoverPlayer = players
    .filter((row) => Number(row.disposals) >= 8 && Number(row.turnovers) >= 4 && Number(row.turnovers) / Number(row.disposals) >= 0.4)
    .sort((a, b) => Number(b.turnovers) - Number(a.turnovers))[0];
  const available = lineup.filter((entry) => entry?.player && entry.position && (entry.onField || !entry.position.startsWith("INT")));
  const findTarget = (group) => {
    const candidates = available.filter((entry) => group.test(entry.matchPosition ?? entry.position));
    return candidates.sort((a, b) => Number(b.player.overall ?? 0) - Number(a.player.overall ?? 0))[0]?.player;
  };
  const makePlayerAdvice = (condition, { key, metric, title, evidence, instruction, group }) => {
    if (!condition) return null;
    const player = findTarget(group);
    return player ? { key, metric, title, evidence, actionLabel: `${player.name}: ${instruction}`, action: { type: "instruction", playerId: player.id, instruction } } : null;
  };

  const advice = [
      Number(own.disposals) >= 24 && Number(own.disposalEfficiency) <= Number(opposition.disposalEfficiency) - 8 &&
      { key: "disposal-risk", metric: "disposalEfficiency", title: "Reduce disposal risk", evidence: `Your disposal efficiency is ${own.disposalEfficiency}% against ${opposition.disposalEfficiency}%.`, actionLabel: "Shift toward safety", action: { type: "slider", key: "riskSafety", value: Math.min(85, tactics.sliders.riskSafety + 15) } },
    own.inside50s >= 8 && own.goalEfficiency <= 30 && own.goalEfficiency <= opposition.goalEfficiency - 8 &&
      makePlayerAdvice(true, { key: "forward-lead", metric: "goalConversion", title: "Create a forward lead", evidence: `${own.inside50s} inside 50s have produced ${own.goalEfficiency}% goal efficiency.`, instruction: "Lead up at the ball", group: /FP|FF|HF|CHF|FWD|FORWARD/i }),
    own.clearances <= opposition.clearances - 4 &&
      makePlayerAdvice(true, { key: "stoppage-contest", metric: "clearanceShare", title: "Compete harder at stoppages", evidence: `You trail clearances ${own.clearances}–${opposition.clearances}.`, instruction: "Contest hard", group: /RR|ROV|RUC|RUCK|MID|CENTRE|WING/i }),
    opposition.inside50s >= own.inside50s + 8 &&
      makePlayerAdvice(true, { key: "defensive-corridor", metric: "inside50Share", title: "Protect the defensive corridor", evidence: `The opposition leads inside 50s ${opposition.inside50s}–${own.inside50s}.`, instruction: "Protect the corridor", group: /BP|FB|HB|CHB|BACK|DEF/i }),
      Number(own.turnovers) >= Number(opposition.turnovers) + 8 && Number(own.disposals) >= 24 &&
      { key: "turnover-control", metric: "turnoverRate", title: "Keep possession under pressure", evidence: `Your side has conceded ${own.turnovers} turnovers against ${opposition.turnovers}.`, actionLabel: "Shift toward possession", action: { type: "slider", key: "possessionTerritory", value: Math.max(15, tactics.sliders.possessionTerritory - 15) } },
    highTurnoverPlayer &&
      { key: `pressured-player:${highTurnoverPlayer.playerId}`, metric: "playerTurnovers", title: "Support a pressured ball user", evidence: `${highTurnoverPlayer.playerName} has ${highTurnoverPlayer.turnovers} turnovers from ${highTurnoverPlayer.disposals} disposals.`, actionLabel: `${highTurnoverPlayer.playerName}: Run into space`, action: { type: "instruction", playerId: highTurnoverPlayer.playerId, instruction: "Run into space" } },
  ].filter(Boolean);
  return advice.find((item) => {
    if ((match.adviceActions ?? []).some((record) => record.key === item.key && Number(match.elapsedSeconds) - Number(record.appliedAtSeconds) < 12 * 60)) return false;
    if (item.action.type === "instruction") return instructions[item.action.playerId] !== item.action.instruction;
    return Number.isFinite(Number(item.action.value)) && Number(item.action.value) !== Number(tactics.sliders[item.action.key]);
  }) ?? null;
}

function makeInitialState(homeTeam, awayTeam, homeStrength, awayStrength, tactics = DEFAULT_TACTICS) {
  return {
    homeTeam,
    awayTeam,
    homeScore: 0,
    awayScore: 0,
    homeGoals: 0,
    homeBehinds: 0,
    awayGoals: 0,
    awayBehinds: 0,
    quarter: 0,
    minute: 0,
    elapsedSeconds: 0,
    secondsRemaining: QUARTER_SECONDS,
    possession: 50,
    momentum: 0,
    intensity: 58,
    tactics: normalizeTactics(tactics),
    instructions: {},
    adviceActions: [],
    rotations: {},
    events: [{ id: 1, minute: 0, quarter: "PREVIEW", text: "The teams are in the rooms. Finalise your match plan." }],
    actions: [],
    scoreEvents: [],
    homeStrength,
    awayStrength,
    status: "PREVIEW",
  };
}

const emptyPlayerStat = (player, club, slot) => ({
  playerId: player.id,
  playerName: player.name,
  club,
  matchPosition: getPlayingPosition(player, slot),
  positions: [getPlayingPosition(player, slot)],
  disposals: 0, kicks: 0, handballs: 0, marks: 0, tackles: 0,
  goals: 0, behinds: 0, hitouts: 0, contestedPossessions: 0,
  inside50s: 0, rebound50s: 0, intercepts: 0, clearances: 0,
  marksInside50: 0, contestedMarks: 0, tacklesInside50: 0,
  turnovers: 0, freeKicksFor: 0, freeKicksAgainst: 0,
  bounces: 0, onePercenters: 0, centreClearances: 0, stoppageClearances: 0,
  effectiveDisposals: 0, timeOnGround: 0, minutesPlayed: 0,
});

// Interchange rules for the live match: players only rotate at natural breaks.
// `maxChanges` is the number of swaps allowed in this window and `protectedIds`
// are players who must stay on (the ball carrier, a set-shot taker, their opponent).
function selectRotationsForMinutes(lineup, rows, previousRotations, elapsedMinutes, plannedTimeOnGround = {}, substitutions = [], { maxChanges = 5, protectedIds = new Set() } = {}) {
  if (!lineup.length) return {};
  const statsById = new Map(rows.map((row) => [String(row.playerId), row]));
  const scoreById = new Map(lineup.map((entry) => {
    const id = String(entry.player.id);
    const plannedPercent = Number(plannedTimeOnGround[id] ?? getDefaultTimeOnGround(entry.player));
    const targetMinutes = Math.max(0, Math.min(100, plannedPercent)) * 0.8;
    const played = Number(statsById.get(id)?.minutesPlayed ?? 0);
    const paceDeficit = targetMinutes * elapsedMinutes / 80 - played;
    const incumbentBonus = (previousRotations?.[id] ?? (entry.position.startsWith("INT") ? "BENCH" : "ON")) === "ON" ? 0.5 : 0;
    return [id, paceDeficit + incumbentBonus];
  }));
  const rotations = Object.fromEntries(lineup.map(({ player, position }) => {
    const id = String(player.id);
    return [id, previousRotations?.[id] ?? (position.startsWith("INT") ? "BENCH" : "ON")];
  }));
  const withCurrentStatus = () => lineup.map((entry) => ({
    ...entry,
    onField: rotations[String(entry.player.id)] === "ON",
  }));

  // Recover old saves with fewer than 18 active statuses. The assignment
  // chooses the strongest available cover and moves others as necessary.
  const currentIds = new Set([...resolveActiveSlots(withCurrentStatus(), substitutions).values()]
    .map((entry) => String(entry.player.id)));
  for (const id of Object.keys(rotations)) rotations[id] = currentIds.has(id) ? "ON" : "BENCH";

  // Trade minutes for role fit when rotating. The full assignment can shift
  // other players into their secondary roles to cover the incoming player.
  for (let change = 0; change < maxChanges; change += 1) {
    const activeSlots = resolveActiveSlots(withCurrentStatus(), substitutions);
    const activeIds = new Set([...activeSlots.values()].map((entry) => String(entry.player.id)));
    let bestMove = null;
    for (const [slot, currentEntry] of activeSlots) {
      const currentId = String(currentEntry.player.id);
      if (protectedIds.has(currentId)) continue;
      for (const candidate of lineup) {
        const candidateId = String(candidate.player.id);
        if (activeIds.has(candidateId)) continue;
        const currentFit = getSlotSuitability(currentEntry.player, slot).overall;
        const candidateFit = getSlotSuitability(candidate.player, slot).overall;
        // If the reserve is a poor positional fit, keep the incumbent on the
        // ground until a more suitable rotation is available.
        if (candidateFit < Math.max(50, currentFit - 8)) continue;
        const ratingChange = candidateFit - currentFit;
        const improvement = (scoreById.get(candidateId) ?? 0) - (scoreById.get(currentId) ?? 0)
          + ratingChange * 0.12;
        if (improvement > 2 && (!bestMove || improvement > bestMove.improvement)) {
          bestMove = { slot, currentId, candidateId, improvement };
        }
      }
    }
    if (!bestMove) break;
    rotations[bestMove.currentId] = "BENCH";
    rotations[bestMove.candidateId] = "ON";
  }
  const assignedIds = new Set([...resolveActiveSlots(withCurrentStatus(), substitutions).values()]
    .map((entry) => String(entry.player.id)));
  return Object.fromEntries(Object.keys(rotations).map((id) => [id, assignedIds.has(id) ? "ON" : "BENCH"]));
}

function summarizeTeamStats(rows, match = {}, side = "home") {
  const sum = (key) => rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);
  const disposals = sum("disposals");
  const shots = sum("goals") + sum("behinds");
  const homePossession = match.possession ?? 50;
  const possession = side === "home" ? homePossession : 100 - homePossession;
  const secondsInFront = match.timeInFront?.[side] ?? 0;
  const lastGoal = (match.scoreEvents ?? []).filter((event) => event.club === (side === "home" ? match.homeTeam : match.awayTeam)).at(-1);
  return {
    disposals,
    kicks: sum("kicks"),
    handballs: sum("handballs"),
    marks: sum("marks"),
    tackles: sum("tackles"),
    goals: sum("goals"),
    behinds: sum("behinds"),
    hitouts: sum("hitouts"),
    clearances: sum("clearances"),
    centreClearances: sum("centreClearances"),
    stoppageClearances: sum("stoppageClearances"),
    inside50s: sum("inside50s"),
    rebound50s: sum("rebound50s"),
    intercepts: sum("intercepts"),
    contestedPossessions: sum("contestedPossessions"),
    uncontestedPossessions: Math.max(0, disposals - sum("contestedPossessions")),
    turnovers: sum("turnovers"),
    freeKicks: sum("freeKicksFor"),
    marksInside50: sum("marksInside50"),
    contestedMarks: sum("contestedMarks"),
    tacklesInside50: sum("tacklesInside50"),
    bounces: sum("bounces"),
    onePercenters: sum("onePercenters"),
    disposalEfficiency: disposals ? Math.round(sum("effectiveDisposals") / disposals * 100) : 0,
    goalEfficiency: shots ? Math.round(sum("goals") / shots * 100) : 0,
    goalAccuracy: shots ? Math.round(sum("goals") / shots * 100) : 0,
    scoreLine: `${sum("goals")}.${sum("behinds")}`,
    timeInPossession: `${Math.round(possession)}%`,
    timeInFront: `${Math.floor(secondsInFront / 60)}:${String(secondsInFront % 60).padStart(2, "0")}`,
    lastGoal: lastGoal ? `${lastGoal.quarter} ${lastGoal.clock}` : "—",
    biggestLead: match.biggestLead?.[side] ?? 0,
    interchangesMade: side === (match.managerSide ?? "home") ? (match.substitutions ?? []).length : 0,
  };
}

function createMatchStats(lineup) {
  return lineup.map(({ player, position, matchPosition }) => ({
    player,
    onField: !position.startsWith("INT"),
    ...emptyPlayerStat(player, player.club, position),
    matchPosition: matchPosition ?? getPlayingPosition(player, position),
    positions: [matchPosition ?? getPlayingPosition(player, position)],
  }));
}

function makeScoreEvent({ quarter, secondsRemaining, type, club, player, homeScore, awayScore }) {
  return {
    id: `${Date.now()}-${Math.random()}`,
    quarter: `Q${quarter}`,
    clock: formatQuarterClock(QUARTER_SECONDS - secondsRemaining),
    type,
    club,
    playerId: player.player?.id ?? player.playerId,
    playerName: player.player?.name ?? player.playerName,
    homeScore,
    awayScore,
  };
}

function fantasyPoints(stat) {
  return 3 * stat.kicks + 2 * stat.handballs + 3 * stat.marks + 4 * stat.tackles
    + 6 * stat.goals + stat.behinds + stat.hitouts + stat.freeKicksFor - 3 * stat.freeKicksAgainst;
}

function formatQuarterClock(seconds) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

export default function MatchCentre({ club = clubs[0], opponent = clubs[1], fixture, appearance = "dark", finalsSeries = false, tactics = DEFAULT_TACTICS, onTacticsChange, onBack, onComplete, playerFitness = {}, timeOnGround = {}, onTimeOnGroundChange, teamSelection, teamSheetConfirmed = false, initialMatchState, onMatchStateChange, playerDevelopment = {}, playerContracts = {}, seasonYear = 2027, players: playerPool = players }) {
  const lightMode = appearance === "light";
  const homeIsManager = (fixture?.homeTeam ?? fixture?.home) === club.name;
  const homeTeam = homeIsManager ? club : opponent;
  const awayTeam = homeIsManager ? opponent : club;
  // Live match ratings come from the players selected for each side.
  const homeStrength = 0;
  const awayStrength = 0;
  const [match, setMatch] = useState(() => {
    const defaults = makeInitialState(homeTeam.name, awayTeam.name, homeStrength, awayStrength, tactics);
    if (initialMatchState?.homeTeam !== homeTeam.name || initialMatchState?.awayTeam !== awayTeam.name) return defaults;
    return {
      ...defaults,
      ...initialMatchState,
      tactics: normalizeTactics(initialMatchState.tactics ?? tactics),
      instructions: initialMatchState.instructions && typeof initialMatchState.instructions === "object" ? initialMatchState.instructions : {},
      adviceActions: Array.isArray(initialMatchState.adviceActions) ? initialMatchState.adviceActions : [],
      rotations: initialMatchState.rotations && typeof initialMatchState.rotations === "object" ? initialMatchState.rotations : {},
      events: Array.isArray(initialMatchState.events) ? initialMatchState.events : defaults.events,
      scoreEvents: Array.isArray(initialMatchState.scoreEvents) ? initialMatchState.scoreEvents : [],
    };
  });
  const matchRef = useRef(match);
  matchRef.current = match;
  const advanceMatchRef = useRef(null);
  const lastAdvanceAtRef = useRef(0);
  const [speed, setSpeed] = useState(1);
  const playbackSpeed = Math.min(MAX_LIVE_PRESENTATION_SPEED, Math.max(1, speed * MATCH_PLAYBACK_BASE_SPEED));
  const [skippingToBreak, setSkippingToBreak] = useState(false);
  const [centreReadyId, setCentreReadyId] = useState(null);
  const [revealedShotId, setRevealedShotId] = useState(null);
  const shotId = match.visualAction?.phase === 5 ? match.visualAction.id : null;
  const shotPending = shotId != null && revealedShotId !== shotId;
  useEffect(() => {
    if (shotId == null || match.status === "PAUSED" || match.status === "PREVIEW") return undefined;
    const timer = window.setTimeout(() => setRevealedShotId(shotId),
      MATCH_SHOT_ANIMATION_MS * .85 / playbackSpeed);
    return () => window.clearTimeout(timer);
  }, [shotId, match.status, playbackSpeed]);
  const [activeTab, setActiveTab] = useState("OVERVIEW");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [pendingSubOutId, setPendingSubOutId] = useState(null);
  const [selectedStatPlayerId, setSelectedStatPlayerId] = useState(null);
  const [playerStatsClubFilter, setPlayerStatsClubFilter] = useState("ALL");
  const [playerStatsSort, setPlayerStatsSort] = useState({ key: "fantasyPoints", direction: "desc" });
  const [pendingMatchSlot, setPendingMatchSlot] = useState(null);
  const [lineupNotice, setLineupNotice] = useState("");

  const clubPlayers = useMemo(() => playerPool
    .map((player) => getCareerPlayer(player, playerDevelopment, seasonYear, playerContracts))
    .filter((player) => player.club === club.name), [playerPool, club.name, playerDevelopment, playerContracts, seasonYear]);
  const opponentPlayers = useMemo(() => playerPool
    .map((player) => getCareerPlayer(player, playerDevelopment, seasonYear, playerContracts))
    .filter((player) => player.club === opponent.name), [playerPool, opponent.name, playerDevelopment, playerContracts, seasonYear]);
  const opponentAvailablePlayers = useMemo(() => opponentPlayers.filter((player) => {
    const injury = playerFitness?.[player.id]?.injury;
    return (!injury || Number(injury.weeksRemaining ?? 0) <= 0) && Number(playerFitness?.[player.id]?.suspension?.matchesRemaining ?? 0) <= 0;
  }), [opponentPlayers, playerFitness]);
  const assistantOpponentSheet = useMemo(() => createAssistantTeamSelection(opponentAvailablePlayers), [opponentAvailablePlayers]);
  const selectedLineup = useMemo(() => {
    // Older saved matches can contain a partial liveSlots object. Merge it over
    // the confirmed team sheet instead of letting that partial object replace
    // the full selection, then fill any remaining gaps from the healthy list.
    const savedSlots = teamSelection?.selectedSide ?? {};
    const liveSlots = match.liveSlots ?? {};
    const mergedSlots = { ...savedSlots };
    for (const [slot, playerName] of Object.entries(liveSlots)) {
      if (playerName) mergedSlots[slot] = playerName;
    }

    const byName = new Map(clubPlayers.map((player) => [player.name, player]));
    const rows = [];
    const usedIds = new Set();
    for (const [position, playerName] of Object.entries(mergedSlots)) {
      const player = byName.get(playerName);
      if (!player || usedIds.has(String(player.id))) continue;
      usedIds.add(String(player.id));
      rows.push({ position, player });
    }

    const fieldPositions = fieldRows.flatMap(([, positions]) => positions);
    const preferredPositions = [...fieldPositions, ...benchSlots];
    const occupied = new Set(rows.map((entry) => entry.position));
    const openPositions = preferredPositions.filter((position) => !occupied.has(position));
    const eligible = clubPlayers
      .filter((player) => {
        const fitness = playerFitness?.[player.id];
        return !usedIds.has(String(player.id))
          && (!fitness?.injury || Number(fitness.injury.weeksRemaining ?? 0) <= 0)
          && Number(fitness?.suspension?.matchesRemaining ?? 0) <= 0;
      })
      .sort((a, b) => Number(b.overall ?? 0) - Number(a.overall ?? 0));

    for (const player of eligible) {
      if (rows.length >= 23) break;
      let position = openPositions.shift();
      if (!position) {
        let index = 6;
        while (occupied.has(`INT${index}`)) index += 1;
        position = `INT${index}`;
      }
      occupied.add(position);
      usedIds.add(String(player.id));
      rows.push({ position, player });
    }

    return rows.map((entry) => ({ ...entry,
      lockedPosition: match.manualSlotLocks?.[entry.player.id],
      matchPosition: match.livePositions?.[entry.player.id] ?? getPlayingPosition(entry.player, entry.position),
      onField: (match.rotations?.[entry.player.id] ?? (entry.position.startsWith("INT") ? "BENCH" : "ON")) === "ON",
    }));
  }, [clubPlayers, teamSelection, match.liveSlots, match.livePositions, match.manualSlotLocks, match.rotations, playerFitness]);
  const opponentLineup = useMemo(() => Object.entries(assistantOpponentSheet.selectedSide ?? {})
    .filter(([, playerName]) => Boolean(playerName))
    .map(([position, playerName]) => ({ position, player: opponentAvailablePlayers.find((candidate) => candidate.name === playerName) }))
    .filter((entry) => entry.player)
    .map((entry) => ({ ...entry, matchPosition: getPlayingPosition(entry.player, entry.position), onField: (match.rotations?.[entry.player.id] ?? (entry.position.startsWith("INT") ? "BENCH" : "ON")) === "ON" })), [assistantOpponentSheet, opponentAvailablePlayers, match.rotations]);
  const recommendedOpponentTactics = useMemo(() => recommendTactics(opponentLineup, { seed: opponent.name }), [opponentLineup, opponent.name]);
  const matchupModel = useMemo(() => buildMatchupModel(selectedLineup, opponentLineup, {
    ownSubstitutions: match.substitutions?.slice(match.matchupSubstitutionStart ?? 0),
    playerFitness, tactics: match.tactics, opponentTactics: recommendedOpponentTactics,
  }), [selectedLineup, opponentLineup, match.substitutions, match.matchupSubstitutionStart, playerFitness, match.tactics, recommendedOpponentTactics]);
  const matchupSwap = useMemo(() => recommendMatchupSwap(matchupModel), [matchupModel]);
  const matchupAnalytics = useMemo(() => buildMatchupAnalytics(matchupModel, {
    tactics: match.tactics, opponentTactics: recommendedOpponentTactics, playerFitness,
  }), [matchupModel, match.tactics, recommendedOpponentTactics, playerFitness]);
  const traitOpportunitiesByPlayer = matchupAnalytics.traitOpportunitiesByPlayer;
  const homeLineup = homeIsManager ? selectedLineup : opponentLineup;
  const awayLineup = homeIsManager ? opponentLineup : selectedLineup;
  const squad = useMemo(() => selectedLineup.map((entry) => entry.player), [selectedLineup]);
  const togPlayers = useMemo(() => selectedLineup.map((entry) => entry.player), [selectedLineup]);
  const togPlayerIds = togPlayers.map((player) => String(player.id)).join(",");
  const [togMap, setTogMap] = useState(() => createMatchTimePlan(togPlayers, timeOnGround, getDefaultTimeOnGround));
  const previousTogPlayerIds = useRef(togPlayerIds);
  useEffect(() => {
    if (previousTogPlayerIds.current === togPlayerIds) return;
    previousTogPlayerIds.current = togPlayerIds;
    setTogMap((current) => createMatchTimePlan(togPlayers, current, getDefaultTimeOnGround));
  }, [togPlayerIds]);
  const togBudget = getMatchTimeBudget(togPlayers, togMap);
  const matchContextRef = useRef({ selectedLineup, homeLineup, awayLineup, clubPlayers, togMap });
  matchContextRef.current = { selectedLineup, homeLineup, awayLineup, clubPlayers, togMap };
  const playerStatsRows = useMemo(() => {
    const rows = [...(match.playerStats?.home ?? []), ...(match.playerStats?.away ?? [])]
      .filter((stat) => playerStatsClubFilter === "ALL" || clubCodeFor(stat.club) === playerStatsClubFilter);
    const valueFor = (stat, key) => {
      if (key === "playerName") return stat.playerName ?? "";
      if (key === "club") return clubCodeFor(stat.club);
      if (key === "fantasyPoints") return fantasyPoints(stat);
      if (key === "scoreLine") return (Number(stat.goals) || 0) * 100 + (Number(stat.behinds) || 0);
      return Number(stat[key]) || 0;
    };
    return rows.sort((a, b) => {
      const left = valueFor(a, playerStatsSort.key);
      const right = valueFor(b, playerStatsSort.key);
      const comparison = typeof left === "string" ? left.localeCompare(right) : left - right;
      return comparison * (playerStatsSort.direction === "asc" ? 1 : -1);
    });
  }, [match.playerStats, playerStatsClubFilter, playerStatsSort]);
  const palette = {
    text: lightMode ? "#0f172a" : "#f8fafc",
    muted: lightMode ? "#64748b" : "#94a3b8",
    card: finalsSeries ? (lightMode ? "#fffaf0" : "#1b170b") : lightMode ? "#ffffff" : "#0b1324",
    surface: finalsSeries ? (lightMode ? "#eee5c7" : "#29220f") : lightMode ? "#f1f5f9" : "#111c30",
    border: finalsSeries ? "#9b7b2b" : lightMode ? "#cbd5e1" : "#24334d",
    green: finalsSeries ? "#b8952f" : "#0f766e",
    orange: finalsSeries ? "#d6b44a" : "#f97316",
  };

  useEffect(() => {
    onMatchStateChange?.(match);
  }, [match, onMatchStateChange]);

  // Development only: at full time, check that the final score and box score
  // agree with the recorded action log. Read-only; it never changes the match.
  // The latest result is also left on window.__lastMatchAudit for inspection.
  const auditedMatchKey = useRef(null);
  useEffect(() => {
    if (!import.meta.env.DEV || match.status !== "FULL_TIME") return;
    const key = `${match.homeTeam}|${match.awayTeam}|${match.actions?.length ?? 0}`;
    if (auditedMatchKey.current === key) return;
    auditedMatchKey.current = key;
    const audit = auditPlayedMatch(match);
    window.__lastMatchAudit = audit;
    const label = `Match audit: ${match.homeTeam} v ${match.awayTeam} (${audit.eventCount} events)`;
    if (audit.ok) console.info(`${label} - score and stats match the event log.`);
    else console.warn(`${label} - ${audit.problemCount} problem(s):\n${audit.problems.join("\n")}`);
  }, [match]);

  useEffect(() => {
    if (match.status !== "FULL_TIME") return;
    if (match.playerStats?.home?.length && match.coachesVotes && match.matchReview) return;
    const managerLineup = selectedLineup.map(({ player, position }) => ({
      ...player,
      matchPosition: getPlayingPosition(player, position),
      matchTimeOnGround: match.matchTimeOnGround?.[String(player.id)] ?? togMap[player.id] ?? 0,
    }));
    setMatch((current) => current.status === "FULL_TIME" && (!current.matchReview || !current.coachesVotes)
      ? attachMatchStatistics(current, { lineupsByClub: { [club.name]: managerLineup }, contractsByPlayer: playerContracts, playerPool })
      : current);
  }, [match.status, match.playerStats, match.matchTimeOnGround, selectedLineup, togMap, club.name, playerContracts, playerPool]);

  useEffect(() => {
    if (match.status === "FULL_TIME" && match.matchReview) setActiveTab("REPORT");
  }, [match.status, match.matchReview]);

  useEffect(() => {
    // This legacy session endpoint has no account-owned row schema yet. Keep it
    // disabled in release until its table and RLS policies are migrated.
    if (!supabase || import.meta.env.VITE_ENABLE_REMOTE_MATCH_SESSIONS !== "true" || match.status === "PREVIEW") return;
    let cancelled = false;
    let saveInFlight = false;
    const saveCurrentMatch = async () => {
      if (saveInFlight) return;
      saveInFlight = true;
      setSaving(true);
      setSaveError("");
      const fixtureKey = `${seasonYear}-${fixture?.id ?? [
        seasonYear,
        fixture?.round ?? "friendly",
        homeTeam.name,
        awayTeam.name,
        fixture?.date ?? "undated",
      ].join("-")}`;
      try {
        const { error } = await supabase.from("playable_match_sessions").upsert({
          id: `${club.id}-${fixtureKey}`,
          club_id: club.id,
          match_payload: matchRef.current,
          updated_at: new Date().toISOString(),
        });
        if (error) throw error;
      } catch (error) {
        if (!cancelled) setSaveError(error instanceof Error ? error.message : "Unable to save this match.");
      } finally {
        saveInFlight = false;
        if (!cancelled) setSaving(false);
      }
    };

    if (match.status === "LIVE") {
      const saveInterval = window.setInterval(saveCurrentMatch, 10000);
      return () => {
        cancelled = true;
        window.clearInterval(saveInterval);
      };
    }

    saveCurrentMatch();
    return () => { cancelled = true; };
  }, [club.id, fixture?.id, fixture?.round, fixture?.date, homeTeam.name, awayTeam.name, seasonYear, match.status]);

  useEffect(() => {
    if (match.status !== "LIVE") {
      return undefined;
    }

    if (match.visualAction?.kind === "setup") {
      // The next bounce waits until the oval has actually completed its reset.
      // A fallback keeps a background tab from stopping the match indefinitely.
      if (centreReadyId !== match.visualAction.id) {
        const wait = activeTab === "OVERVIEW" ? 45000 : actionTiming(match.visualAction).duration / playbackSpeed;
        const fallback = window.setTimeout(() => setCentreReadyId(match.visualAction.id), wait);
        return () => window.clearTimeout(fallback);
      }
      const bounce = window.setTimeout(() => advanceMatchRef.current?.(), 0);
      return () => window.clearTimeout(bounce);
    }
    const presentationSpeed = playbackSpeed;
    const baseDelay = match.visualAction?.score === "Goal"
      ? GOAL_CELEBRATION_MS / Math.min(MAX_GOAL_PRESENTATION_SPEED, presentationSpeed)
      : Math.max(MIN_ACTION_DELAY_MS, actionTiming(match.visualAction).duration / presentationSpeed);
    // Subtract the time already spent simulating and rendering this action so the
    // cadence stays even instead of drifting by the compute time every tick.
    const spent = Math.min(120, Math.max(0, performance.now() - lastAdvanceAtRef.current));
    const timer = window.setTimeout(() => advanceMatchRef.current?.(), baseDelay);
    return () => window.clearTimeout(timer);
  }, [match.status, playbackSpeed, match.visualAction?.id, match.visualAction?.score, centreReadyId, activeTab]);

  useEffect(() => {
    if (match.status !== "LIVE" && match.status !== "PAUSED") return undefined;
    const handleSpace = (event) => {
      if (event.code !== "Space" || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      if (target?.isContentEditable || target?.closest?.("input, textarea, select, button, [contenteditable='true']")) return;
      event.preventDefault();
      setMatch((current) => current.status === "LIVE" ? { ...current, status: "PAUSED" }
        : current.status === "PAUSED" ? { ...current, status: "LIVE" } : current);
    };
    window.addEventListener("keydown", handleSpace);
    return () => window.removeEventListener("keydown", handleSpace);
  }, [match.status]);

  const updateMatch = (updater) => setMatch((current) => ({ ...current, ...(typeof updater === "function" ? updater(current) : updater) }));

  function startMatch() {
    if (!teamSheetConfirmed) return;
    if (selectedLineup.length < MIN_FIELD_PLAYERS) {
      setLineupNotice(`A match requires at least ${MIN_FIELD_PLAYERS} available players. Only ${selectedLineup.length} are eligible.`);
      setActiveTab("LINEUP");
      return;
    }
    if (opponentLineup.length < MIN_FIELD_PLAYERS) {
      setLineupNotice(`${opponent.name} cannot field ${MIN_FIELD_PLAYERS} available players for this match.`);
      setActiveTab("LINEUP");
      return;
    }
    if (togBudget.remaining !== 0) {
      setActiveTab("MATCH_TIME");
      return;
    }
    const lineups = {
      home: createMatchStats(homeLineup),
      away: createMatchStats(awayLineup),
    };
    updateMatch({
      status: "LIVE", quarter: 1, minute: 0, elapsedSeconds: 0, secondsRemaining: QUARTER_SECONDS,
      plannedTimeOnGround: togMap,
      traitActivations: {},
      liveSlots: Object.fromEntries(selectedLineup.map(({ position, player }) => [position, player.name])), managerSide: homeIsManager ? "home" : "away",
      rotations: Object.fromEntries([...homeLineup, ...awayLineup].map(({ player, position }) => [String(player.id), position.startsWith("INT") ? "BENCH" : "ON"])),
      playerStats: lineups,
      teamStats: { home: summarizeTeamStats(lineups.home), away: summarizeTeamStats(lineups.away) },
      timeInFront: { home: 0, away: 0 }, biggestLead: { home: 0, away: 0 }, scoreEvents: [],
      tacticalPlans: { [club.name]: match.tactics, [opponent.name]: recommendedOpponentTactics },
      oppositionTactics: recommendedOpponentTactics,
      events: [{ id: Date.now(), minute: 0, quarter: "Q1", text: `The first bounce is in. ${TACTIC_STYLES.find((style) => style.id === match.tactics.style)?.name ?? "Your match plan"} is active.` }],
    });
  }
  function pauseMatch() {
    updateMatch({ status: "PAUSED" });
  }

  function resumeMatch() {
    setMatch((current) => current.status === "PAUSED" ? { ...current, status: "LIVE" } : current);
  }

  function continueAfterQuarter() {
    setMatch((current) => current.status === "QUARTER_BREAK" ? {
      ...current,
      status: "LIVE",
      quarter: current.quarter + 1,
      secondsRemaining: QUARTER_SECONDS,
      ballSequence: null,
      spatialQuarter: null,
      spatialBall: [50, 50],
      events: [...current.events, { id: Date.now(), minute: current.minute, quarter: `Q${current.quarter + 1}`, text: `Centre bounce to start ${quarterLabels[current.quarter]}.` }].slice(-40),
    } : current);
  }

  function advanceInstantly(targetQuarter, fullGame = false) {
    let next = matchRef.current;
    let guard = 0;
    while (next.status !== "FULL_TIME" && guard++ < 2000) {
      if (next.status === "QUARTER_BREAK") {
        if (!fullGame) break;
        next = {
          ...next,
          status: "LIVE",
          quarter: next.quarter + 1,
          secondsRemaining: QUARTER_SECONDS,
          ballSequence: null,
          spatialQuarter: null,
          spatialBall: [50, 50],
          events: [...next.events, { id: Date.now(), minute: next.minute, quarter: `Q${next.quarter + 1}`, text: `Centre bounce to start ${quarterLabels[next.quarter]}.` }].slice(-40),
        };
        continue;
      }
      if (next.status !== "LIVE") break;
      next = resolveMatchAdvance(next);
    }
    // Resolve the whole skipped segment against local state, then render once.
    // This keeps each simulation action (and all its scoring/events) intact while
    // avoiding a synchronous React render after every action in the loop.
    setMatch(next);
    setSkippingToBreak(false);
  }

  function skipToNextBreak() {
    if (match.status !== "LIVE" || skippingToBreak) return;
    setSkippingToBreak(true);
    window.setTimeout(() => advanceInstantly(match.quarter), 0);
  }

  function simulateGameInstantly() {
    if (match.status !== "PREVIEW") return;
    startMatch();
    window.setTimeout(() => advanceInstantly(4, true), 0);
  }

  function resolveMatchAdvance(current) {
      if (current.status !== "LIVE") return current;
      const context = matchContextRef.current;
      const elapsedThisPhase = nextMatchActionSeconds(current.secondsRemaining);
      const ratedLineup = (entries, substitutions = []) => [...resolveActiveSlots(entries.map((entry) => ({
        ...entry,
        onField: (current.rotations?.[String(entry.player.id)] ?? (entry.position.startsWith("INT") ? "BENCH" : "ON")) === "ON",
      })), substitutions)].map(([position, entry]) => ({ ...entry, position, onField: true }));
      const managerSubstitutions = (current.substitutions ?? []).slice(current.matchupSubstitutionStart ?? 0);
      const managerStrength = selectedSideStrength(homeIsManager ? current.homeStrength : current.awayStrength,
        ratedLineup(context.selectedLineup, managerSubstitutions), playerFitness);
      const oppositionStrength = selectedSideStrength(homeIsManager ? current.awayStrength : current.homeStrength,
        ratedLineup(homeIsManager ? context.awayLineup : context.homeLineup), playerFitness);
      const managerTacticalRatings = getTacticalRatings(current.tactics);
      const oppositionTactics = current.oppositionTactics ?? recommendedOpponentTactics;
      const opponentRatings = getTacticalRatings(oppositionTactics);
      const managerStrengthGap = managerStrength - oppositionStrength;
      // Keep possession independent from score and momentum so an early lead
      // cannot turn into a self-reinforcing scoring run.
      const managerPossessionChance = Math.min(0.65, Math.max(0.35,
        0.5 + (managerTacticalRatings.possession - opponentRatings.possession) * 0.006 + (managerTacticalRatings.pressure - opponentRatings.pressure) * 0.002 + managerStrengthGap * 0.002,
      ));
      const phases = ["Stoppage", "Clearance", "Transition", "Forward entry", "Forward contest", "Shot"];
      const ballSequence = current.ballSequence ?? null;
      const isManagerSide = ballSequence
        ? (homeIsManager ? ballSequence.attackSide === "home" : ballSequence.attackSide === "away")
        : Math.random() < managerPossessionChance;
      let phaseIndex = ballSequence ? Number(ballSequence.phaseIndex ?? 0) : 0;

      const isHome = isManagerSide ? homeIsManager : !homeIsManager;
      const baseScore = isHome
        ? { goals: current.homeGoals, behinds: current.homeBehinds, total: current.homeScore }
        : { goals: current.awayGoals, behinds: current.awayBehinds, total: current.awayScore };
      const attackingStrength = isManagerSide ? managerStrength : oppositionStrength;
      const defendingStrength = isManagerSide ? oppositionStrength : managerStrength;
      const scoringTactics = isManagerSide ? current.tactics : oppositionTactics;
      const attackPlan = scoringTactics;
      const defensePlan = isManagerSide ? oppositionTactics : current.tactics;
      const attackSide = isHome ? "home" : "away";
      const defendSide = isHome ? "away" : "home";
      const lineupFor = (side) => side === "home" ? context.homeLineup : context.awayLineup;
      const liveLineupFor = (side) => lineupFor(side).map((entry) => ({
        ...entry,
        onField: (current.rotations?.[String(entry.player.id)] ?? (entry.position.startsWith("INT") ? "BENCH" : "ON")) === "ON",
      }));
      const attackEntries = ratedLineup(lineupFor(attackSide), isManagerSide ? managerSubstitutions : []);
      const defenseEntries = ratedLineup(lineupFor(defendSide), isManagerSide ? [] : managerSubstitutions);
      const liveMatchups = buildMatchupModel(attackEntries, defenseEntries, {
        ownSubstitutions: isManagerSide ? current.substitutions?.slice(current.matchupSubstitutionStart ?? 0) : [],
        opponentSubstitutions: isManagerSide ? [] : current.substitutions?.slice(current.matchupSubstitutionStart ?? 0),
        playerFitness, tactics: attackPlan, opponentTactics: defensePlan,
      });
      const lineEffects = lineMatchEffects(liveMatchups);
      const attackProfile = getTacticalPhaseProfile(attackPlan, attackEntries);
      const defenseProfile = getTacticalPhaseProfile(defensePlan, defenseEntries);
      const sourceStats = current.playerStats ?? {
        home: createMatchStats(context.homeLineup),
        away: createMatchStats(context.awayLineup),
      };
      const playerStats = {
        home: sourceStats.home.map((row) => ({ ...row })),
        away: sourceStats.away.map((row) => ({ ...row })),
      };
      const elapsedMinutes = Math.min(80, (Number(current.elapsedSeconds ?? 0) + elapsedThisPhase) / 60);
      for (const side of ["home", "away"]) {
        const liveEntries = liveLineupFor(side);
        const sideSubstitutions = side === (current.managerSide ?? "home")
          ? (current.substitutions ?? []).slice(current.matchupSubstitutionStart ?? 0)
          : [];
        const activeById = new Map([...resolveActiveSlots(liveEntries, sideSubstitutions)]
          .map(([slot, entry]) => [String(entry.player.id), { slot, player: entry.player }]));
        playerStats[side].forEach((row) => {
          const assignment = activeById.get(String(row.playerId));
          row.onField = Boolean(assignment);
          if (assignment) {
            row.fieldSlot = assignment.slot;
            row.matchPosition = getPlayingPosition(assignment.player, assignment.slot);
            row.positions = [row.matchPosition];
          }
        });
      }
      const actorRows = playerStats[attackSide];
      const defenderRows = playerStats[defendSide];
      const instructionFor = (row) => instructionEffects[current.instructions?.[String(row.playerId)] ?? current.instructions?.[row.playerId]] ?? {};
      const reversed = current.quarter % 2 === 0;
      const attacksLeft = attackSide === "home" ? reversed : !reversed;
      const spatialEntries = ["home", "away"].flatMap(side => [...resolveActiveSlots(liveLineupFor(side))].map(([slot, entry]) => ({ side, slot, player: entry.player })));
      const spatialPositions = new Map(spatialEntries.map(entry => {
        const id = String(entry.player.id), anchor = OVAL_SLOTS[entry.slot] ?? [50,50];
        const flip = entry.side === "home" ? reversed : !reversed;
        return [id, current.spatialQuarter === current.quarter && current.spatialPositions?.[id] || { x: flip ? 100-anchor[0] : anchor[0], y: anchor[1] }];
      }));
      if (current.needsBallUpSetup) {
        const ballUpOrigin = current.spatialBall ?? [50,50];
        const formation = planOvalMovement(spatialEntries, spatialPositions, ballUpOrigin, {reset:true,ballUp:true}, OVAL_SLOTS, reversed);
        const duration = Math.max(1500,...formation.map(p => {
          const from=spatialPositions.get(p.id) ?? p;
          return 900+Math.hypot((p.x-from.x)*METRES_PER_X,(p.y-from.y)*METRES_PER_Y)/Math.max(5,p.maxSpeed)*1000;
        }));
        return {...current, needsBallUpSetup:false, spatialQuarter:current.quarter,
          spatialPositions:Object.fromEntries(formation.map(p=>[p.id,p])),
          visualAction:{id:`ball-up-${current.quarter}-${current.elapsedSeconds}`,kind:'setup',phase:-1,duration,target:ballUpOrigin,text:'Ball-up: rucks and nearby players set around the mark.'}};
      }
      if (current.needsCentreSetup || current.spatialQuarter !== current.quarter) {
        const formation = planOvalMovement(spatialEntries, spatialPositions, [50,50], {reset:true}, OVAL_SLOTS, reversed);
        const duration = Math.max(2500,...formation.map(p => {
          const from=spatialPositions.get(p.id) ?? p;
          return 2000+Math.hypot((p.x-from.x)*METRES_PER_X,(p.y-from.y)*METRES_PER_Y)/Math.max(5,p.maxSpeed)*1000;
        }));
        return {...current, needsCentreSetup:false, spatialQuarter:current.quarter, spatialBall:[50,50],
          spatialPositions:Object.fromEntries(formation.map(p=>[p.id,p])),
          visualAction:{id:`setup-${current.quarter}-${current.elapsedSeconds}`,kind:'setup',phase:-1,duration,target:[50,50],text:'Centre bounce: six in each 50, four in the square and two wings.'}};
      }
      const origin = current.spatialQuarter === current.quarter ? current.spatialBall ?? [50,50] : [50,50];
      const previousCarrier = ballSequence
        ? actorRows.find(row => row.onField && String(row.playerId) === String(current.visualAction?.playerId))
        : null;
      const possession = phaseIndex <= 3
        ? planCentrePassageStep(actorRows, spatialPositions, origin, attacksLeft, phaseIndex, previousCarrier?.playerId, defenderRows)
        : chooseSpatialPossession(actorRows, spatialPositions, origin, attacksLeft, previousCarrier?.playerId, Math.random, attackPlan, phaseIndex);
      const receiver = possession?.player;
      // The carrier makes a disposal; the receiver earns a mark. Keep the
      // handoff tied to the same two players shown on the oval.
      const actor = phaseIndex === 4 ? receiver : previousCarrier ?? receiver;
      const possessionTarget = phaseIndex === 5 ? origin : possession?.target ?? origin;
      if (phaseIndex >= 4 && distanceToGoal(possessionTarget, attacksLeft) > 55) phaseIndex = 2;
      const phaseName = phases[phaseIndex] ?? phases[0];

      const directOpponentId = liveMatchups.byPlayerId[String(actor?.playerId)]?.opponentPlayerId;
      const defenderDistance = (row) => {
        const point = spatialPositions.get(String(row.playerId));
        return point ? Math.hypot((point.x - possessionTarget[0]) * METRES_PER_X, (point.y - possessionTarget[1]) * METRES_PER_Y) : Infinity;
      };
      const matchedDefender = defenderRows.find((row) => row.onField && String(row.playerId) === directOpponentId);
      const defender = matchedDefender && defenderDistance(matchedDefender) <= 22
        ? matchedDefender
        : defenderRows.filter((row) => row.onField).sort((a, b) => defenderDistance(a) - defenderDistance(b))[0];
      if (!actor || !defender) return { ...current, status: "PAUSED" };
      const skill = (row, key) => Number(row?.player?.attributes?.[key] ?? row?.player?.overall ?? 65)
        + (Number(playerFitness?.[row?.playerId]?.matchSharpness ?? 65) - 70) * 0.08;
      const traitContextFor = (row, directOpponent, traitPhase, teamPlan, opposingPlan, roleFamily, extra = {}) => {
        const ownPair = liveMatchups.byPlayerId[String(row?.playerId)];
        const opponentPair = ownPair ? null : liveMatchups.matchups.find((pair) => pair.opponentPlayerId === String(row?.playerId));
        return evaluateTraitContext(row?.player, {
        phase: traitPhase,
        opponent: directOpponent?.player,
        roleFamily,
        opponentRoleFamily: getMatchupSlotFamily(ownPair?.opponentSlot ?? opponentPair?.ownSlot),
        tactics: teamPlan,
        opponentTactics: opposingPlan,
        fitness: playerFitness?.[row?.playerId]?.fitness,
        matchSharpness: playerFitness?.[row?.playerId]?.matchSharpness,
        opponentFitness: playerFitness?.[directOpponent?.playerId]?.fitness,
        opponentMatchSharpness: playerFitness?.[directOpponent?.playerId]?.matchSharpness,
        minute: elapsedMinutes,
        scoreMargin: Number(current.homeScore ?? 0) - Number(current.awayScore ?? 0),
        ...extra,
      });
      };
      const traitPhase = matchPhaseToTraitPhase[phaseIndex] ?? "stoppage";
      const actorTrait = traitContextFor(actor, defender, traitPhase, attackPlan, defensePlan, liveMatchups.byPlayerId[String(actor?.playerId)]?.line);
      const defenderSlot = liveMatchups.matchups.find((pair) => pair.opponentPlayerId === String(defender?.playerId))?.opponentSlot;
      const defenderTrait = traitContextFor(defender, actor, phaseIndex >= 3 ? "defensiveContest" : traitPhase, defensePlan, attackPlan, getMatchupSlotFamily(defenderSlot));
      const actorInstruction = instructionFor(actor);
      const defenderInstruction = instructionFor(defender);
      const fieldGeneralSupport = attackEntries.some((entry) => entry.onField !== false
        && String(entry.player?.id) !== String(actor?.playerId)
        && Number(playerFitness?.[entry.player?.id]?.fitness ?? 100) >= 65
        && getPlayerTraitIds(entry.player).includes("FIELD_GENERAL")) ? .01 : 0;
      const instructionAttackEffect = isManagerSide ? Number(actorInstruction.attack ?? 0) : 0;
      const instructionDefenceEffect = !isManagerSide ? Number(defenderInstruction.defensive ?? 0) : 0;
      const instructionEffect = instructionAttackEffect - instructionDefenceEffect;
      const tacticRating = getTacticalRatingBonus(attackPlan, attackEntries) * 0.42 - getTacticalDefenceBonus(defensePlan, defenseEntries) * 0.28;
      const disposalDistance = Math.hypot((possessionTarget[0]-origin[0])*METRES_PER_X, (possessionTarget[1]-origin[1])*METRES_PER_Y);
      const isKick = disposalDistance > 18 || Math.random() < Math.max(0.35, Math.min(0.82, 0.55 + (skill(actor, "kicking") - skill(actor, "handball")) * 0.008));
      const disposalMade = phaseIndex >= 1 && phaseIndex <= 3 && !possession?.carrying;
      const enteredForward50 = disposalMade && distanceToGoal(origin, attacksLeft) > 50 && distanceToGoal(possessionTarget, attacksLeft) <= 50;
      if (disposalMade) { actor.disposals += 1; if (isKick) actor.kicks += 1; else actor.handballs += 1; }
      const contested = (phaseIndex <= 1 || phaseIndex === 4) && Math.random() < Math.max(0.3, Math.min(0.72, 0.43 + (skill(actor, "groundBallGet") - 65) * 0.003 + (actorInstruction.contested ?? 0) + actorTrait.modifiers.contested));
      if (contested) actor.contestedPossessions += 1;

      const disposalSkill = isKick ? skill(actor, "kicking") : skill(actor, "handball");
      const tagPressure = !isManagerSide ? (defenderInstruction.tag ?? 0) : 0;
      const effectiveDisposal = disposalMade && Math.random() < Math.max(0.45, Math.min(0.94, 0.68 + (disposalSkill - 65) * 0.006 + (skill(actor, "gameAwareness") - 65) * 0.002 + (actorInstruction.effective ?? 0) + actorTrait.modifiers.effectiveDisposal + defenderTrait.modifiers.opponentEffectiveDisposal + (defenderInstruction.opponentEffectiveDisposal ?? 0) + fieldGeneralSupport - tagPressure));
      if (enteredForward50) actor.inside50s += 1;
      if (phaseIndex <= 1 && Math.random() < Math.max(0.07, Math.min(0.38, (0.13 + (skill(actor, "groundBallGet") - 65) * 0.002 + (skill(actor, "gameAwareness") - 65) * 0.001 + (actorInstruction.clearance ?? 0) + actorTrait.modifiers.clearance + defenderTrait.modifiers.opponentClearance) * attackProfile.stoppage * lineEffects.stoppage))) actor.clearances += 1;
      if (phaseIndex === 0 && Math.random() < 0.3) actor.centreClearances += 1;
      if (phaseIndex <= 1 && Math.random() < 0.3) actor.stoppageClearances += 1;
      if (possession?.carrying && Math.random() < Math.min(0.4, 0.16 + (actorInstruction.bounce ?? 0))) actor.bounces += 1;
      // These events were tuned for the old, sparse action clock. At the
      // faster pace their per-action probabilities must be lower so match
      // totals do not multiply with the number of visible possessions.
      const freeKick = phaseIndex === 0 && Math.random() < 0.035;
      if (freeKick) { actor.freeKicksFor += 1; defender.freeKicksAgainst += 1; }

      if (phaseIndex <= 2 && Math.random() < Math.min(0.5, 0.2 + (defenderInstruction.tackle ?? 0) + defenderTrait.modifiers.tackle)) defender.tackles += 1;
      if (phaseIndex >= 2 && Math.random() < Math.min(0.35, 0.14 + (defenderInstruction.onePercenter ?? 0))) defender.onePercenters += 1;
      if (Math.random() < 0.025) defender.tacklesInside50 += 1;

      if (phaseIndex === 0 && Math.random() < 0.75) {
        const ruck = weightedPlayer(actorRows, (row) => row.onField && /RUCK|R\b/i.test(row.matchPosition ?? ""));
        const ruckOpponentId = liveMatchups.byPlayerId[String(ruck?.playerId)]?.opponentPlayerId;
        const ruckOpponent = defenderRows.find((row) => String(row.playerId) === ruckOpponentId);
        const ruckTrait = traitContextFor(ruck, ruckOpponent, "stoppage", attackPlan, defensePlan, "ruck");
        if (ruck && /RUCK|R\b/i.test(ruck.matchPosition ?? "") && Math.random() < Math.max(0.25, Math.min(0.75, 0.45 + (skill(ruck, "ruckCraft") - 65) * 0.004 + (instructionFor(ruck).hitout ?? 0) + ruckTrait.modifiers.hitout))) ruck.hitouts += 1;
      }
      const attackingEntries = attackEntries;
      const averageGoalSense = attackingEntries.length
        ? attackingEntries.reduce((sum, entry) => sum + Number(entry.player.attributes?.goalSense ?? entry.player.overall ?? 65), 0) / attackingEntries.length
        : 65;
      const scoringQuality = Math.max(0.78, Math.min(1.22, 1 + (averageGoalSense - 65) * 0.006));
      const phaseChance = phaseIndex === 2
        ? (0.86 + actorTrait.modifiers.effectiveDisposal) * attackProfile.transition * lineEffects.transition / (defenseProfile.pressure * defenseProfile.defence)
        : phaseIndex === 3 ? (0.74 + actorTrait.modifiers.inside50) * attackProfile.forwardEntry * lineEffects.entries / (defenseProfile.pressure * defenseProfile.defence)
          : phaseIndex === 4 ? (0.95 + actorTrait.modifiers.mark) * attackProfile.scoring * lineEffects.scoring / (defenseProfile.pressure * defenseProfile.defence)
            : 1;
      // Resolve a turnover often enough to keep contests meaningful, while
      // avoiding the old 58% failure ceiling that stranded most attacks before
      // they reached a forward entry or shot.
      let phaseTurnover = phaseIndex > 0 && phaseIndex < 5 && Math.random() > Math.max(0.55, Math.min(0.92, phaseChance));
      // A forward entry must still be won in the air. A missed mark ends this
      // possession chain instead of awarding the target a mark and set shot.
      if (phaseIndex === 4 && !phaseTurnover) {
        const markChance = Math.max(.2, Math.min(.62,
          .4 + Math.max(-.2,Math.min(.2,Number(ballSequence?.arrivalEdge ?? 0)*.12)) + (skill(receiver, "marking") - skill(defender, "spoiling")) * .003
          + actorTrait.modifiers.mark + defenderTrait.modifiers.opponentMark));
        phaseTurnover = Math.random() >= markChance;
      }
      if (phaseTurnover && disposalMade) actor.turnovers += 1;
      else if (effectiveDisposal) actor.effectiveDisposals += 1;
      const markTaken = phaseIndex === 4 && !phaseTurnover;
      if (phaseTurnover && Math.random() < Math.max(0.08, Math.min(0.42, 0.17 + (skill(defender, "gameAwareness") - 65) * 0.002 + (defenderInstruction.intercept ?? 0) + defenderTrait.modifiers.intercept))) defender.intercepts += 1;
      if (phaseIndex === 5) { actor.kicks += 1; actor.disposals += 1; }
      const scorerCandidate = phaseIndex === 5 ? actor : null;
      const scorerOpponentId = liveMatchups.byPlayerId[String(scorerCandidate?.playerId)]?.opponentPlayerId;
      const scorerOpponent = defenderRows.find((row) => row.onField && String(row.playerId) === scorerOpponentId);
      const scorerTrait = traitContextFor(scorerCandidate, scorerOpponent, "scoring", attackPlan, defensePlan, liveMatchups.byPlayerId[String(scorerCandidate?.playerId)]?.line, { setShot: Number(scorerCandidate?.marksInside50 ?? 0) > 0 });
      const scorerDefenceTrait = traitContextFor(scorerOpponent, scorerCandidate, "defensiveContest", defensePlan, attackPlan, getMatchupSlotFamily(liveMatchups.matchups.find((pair) => pair.opponentPlayerId === String(scorerOpponent?.playerId))?.opponentSlot));
      const shotDistance = Math.round(distanceToGoal(possessionTarget, attacksLeft));
      const scoringModifier = scoringQuality
        * (1 + scorerTrait.modifiers.scoringRate + scorerDefenceTrait.modifiers.opponentScoringRate)
        * attackProfile.scoring * lineEffects.scoring
        * defenseProfile.pressure ** -0.35 * defenseProfile.defence ** -0.35;
      const scored = phaseIndex === 5
        ? resolveLiveShot(baseScore, {
          distance: shotDistance,
          angle: Math.atan2(Math.abs((possessionTarget[1]-50)*METRES_PER_Y), Math.max(.1,Math.abs(possessionTarget[0]-(attacksLeft?5:95))*METRES_PER_X)),
          pressure: current.visualAction?.mark || current.visualAction?.freeKick ? 0 : Math.max(0,1-defenderDistance(defender)/12),
          goalSense: skill(actor, "goalSense"),
          scoringModifier,
          strengthEdge: attackingStrength - defendingStrength + tacticRating,
          instructionEffect,
        })
        : { ...baseScore, text: phaseTurnover ? "Turnover" : phaseName };
      if (markTaken) {
        actor.marks += 1;
        if (contested) actor.contestedMarks += 1;
        if (shotDistance <= 50) actor.marksInside50 += 1;
      }
      const scoreEvents = [...(current.scoreEvents ?? [])];
      if (scored.total > baseScore.total) {
        const isGoal = scored.text === "Goal";
        const scorer = scorerCandidate ?? actor;
        if (isGoal) scorer.goals += 1; else scorer.behinds += 1;
        scoreEvents.push(makeScoreEvent({
          quarter: current.quarter,
          secondsRemaining: current.secondsRemaining,
          type: scored.text,
          club: isHome ? current.homeTeam : current.awayTeam,
          player: scorer,
          homeScore: isHome ? scored.total : current.homeScore,
          awayScore: isHome ? current.awayScore : scored.total,
        }));
      }
      const nextHomeScore = isHome ? scored.total : current.homeScore;
      const nextAwayScore = isHome ? current.awayScore : scored.total;
      const lead = nextHomeScore - nextAwayScore;
      const timeInFront = { ...(current.timeInFront ?? { home: 0, away: 0 }) };
      if (lead > 0) timeInFront.home += elapsedThisPhase;
      else if (lead < 0) timeInFront.away += elapsedThisPhase;
      const biggestLead = { ...(current.biggestLead ?? { home: 0, away: 0 }) };
      biggestLead.home = Math.max(biggestLead.home, lead);
      biggestLead.away = Math.max(biggestLead.away, -lead);
      const elapsedSeconds = current.elapsedSeconds + elapsedThisPhase;
      const quarterEnded = elapsedThisPhase >= current.secondsRemaining;
      const finished = quarterEnded && current.quarter >= 4;
      for (const side of ["home", "away"]) {
        const liveEntries = liveLineupFor(side);
        const sideSubstitutions = side === (current.managerSide ?? "home")
          ? (current.substitutions ?? []).slice(current.matchupSubstitutionStart ?? 0)
          : [];
        const activeIds = new Set([...resolveActiveSlots(liveEntries, sideSubstitutions).values()]
          .map((entry) => String(entry.player.id)));
        for (const row of playerStats[side]) {
          if (activeIds.has(String(row.playerId))) row.minutesPlayed = Number(row.minutesPlayed ?? 0) + elapsedThisPhase / 60;
          row.timeOnGround = Math.round(Number(row.minutesPlayed ?? 0) / 80 * 100);
        }
      }
      // Interchange windows: quarter breaks, the set shot after a mark, stoppages
      // (a new chain starting from a ball-up or restart), or play near the bench
      // side of the ground. Never mid-chain away from the bench and never during
      // the kick itself. Bench side is the bottom of the oval (high y).
      const benchSideBall = phaseIndex <= 3 && possessionTarget[1] >= 65;
      const maxRotationChanges = finished || phaseIndex === 5 ? 0
        : quarterEnded ? 5
          : markTaken ? 4
            : phaseIndex === 0 ? 3
              : benchSideBall ? 1 : 0;
      const protectedIds = new Set([actor?.playerId, receiver?.playerId, defender?.playerId, ballSequence?.shooterId, current.visualAction?.playerId]
        .filter((id) => id !== undefined && id !== null).map(String));
      const rotationOptions = { maxChanges: maxRotationChanges, protectedIds };
      const nextRotations = maxRotationChanges === 0 ? current.rotations : {
        ...(current.rotations ?? {}),
        ...selectRotationsForMinutes(lineupFor("home"), playerStats.home, current.rotations, elapsedMinutes, homeIsManager ? (current.plannedTimeOnGround ?? context.togMap) : {}, homeIsManager ? (current.substitutions ?? []).slice(current.matchupSubstitutionStart ?? 0) : [], rotationOptions),
        ...selectRotationsForMinutes(lineupFor("away"), playerStats.away, current.rotations, elapsedMinutes, !homeIsManager ? (current.plannedTimeOnGround ?? context.togMap) : {}, !homeIsManager ? (current.substitutions ?? []).slice(current.matchupSubstitutionStart ?? 0) : [], rotationOptions),
      };
      const matchTimeOnGround = Object.fromEntries([...playerStats.home, ...playerStats.away].map((row) => [String(row.playerId), row.timeOnGround]));
      const homePossessionSeconds = (current.homePossessionSeconds ?? 0) + (isHome ? elapsedThisPhase : 0);
      const homePossession = elapsedSeconds ? homePossessionSeconds / elapsedSeconds * 100 : 50;
      const nextQuarter = current.quarter;
      const secondsRemaining = quarterEnded ? 0 : current.secondsRemaining - elapsedThisPhase;
      const nextMinute = Math.floor(elapsedSeconds / 60);
      const tacticalRatings = managerTacticalRatings;
      const momentumShift = scored.total > baseScore.total ? (isHome ? 2 : -2) : 0;
      const managerPossession = elapsedSeconds > 0
        ? (current.possession * current.elapsedSeconds + (isManagerSide ? 100 : 0) * elapsedThisPhase) / elapsedSeconds
        : 50;
      const scoringClub = isHome ? current.homeTeam : current.awayTeam;
      const styleName = TACTIC_STYLES.find((style) => style.id === scoringTactics.style)?.name ?? "game plan";
      const traitActivations = { ...(current.traitActivations ?? {}) };
      const countedTraits = new Set();
      for (const [row, evaluation] of [[actor, actorTrait], [defender, defenderTrait], [scorerCandidate, scorerTrait]]) {
        for (const activation of evaluation.active) {
          const key = `${row.playerId}:${activation.id}`;
          if (countedTraits.has(key)) continue;
          countedTraits.add(key);
          traitActivations[key] = (traitActivations[key] ?? 0) + 1;
        }
      }
      const actionKind = phaseIndex === 5 ? "shot" : markTaken ? "mark" : phaseTurnover ? "turnover" : phaseIndex === 0 ? "gather" : possession?.carrying ? "carry" : isKick ? "kick" : "handball";
      const eventText = freeKick ? `${actor.playerName} wins a free kick. The opposition clears the protected zone.` : describePlay({ phase: phaseIndex, kind: actionKind, actor: (scorerCandidate ?? actor).playerName,
        receiver: receiver?.playerName ?? actor.playerName, inside50: enteredForward50,
        defender: defender.playerName, score: phaseIndex === 5 ? scored.text : null,
        turnover: phaseTurnover, distance: shotDistance, seed: elapsedSeconds });
      // A lost contest or a missed shot does not reset to a random stoppage: the defender who won the ball
      // rebounds with it, and a behind goes back to the defending side's kick-in. Only a goal returns to the centre.
      const neutralBallUp = phaseTurnover && Math.random() >= (/^(?:FB|CHB|KPD)$/.test(String(defender.fieldSlot ?? "").toUpperCase().replace(/[12]$/, "")) ? 0.4 : 0.8);
      const nextBallSequence = phaseIndex === 5
        ? (scored.text === "Goal" ? null : { attackSide: defendSide, phaseIndex: 0 })
        : phaseTurnover
          ? (neutralBallUp ? null : { attackSide: defendSide, phaseIndex: 2 })
          : { attackSide, phaseIndex: freeKick ? 2 : possession?.nextPhase ?? (possession?.repeatPhase ? phaseIndex : (markTaken && shotDistance > 38 && Math.random() < 0.35 ? 3 : phaseIndex + 1)), ...(phaseIndex === 3 && receiver ? {arrivalEdge: defenderDistance(defender)/runningProfile(defender.player).maxSpeed - Math.hypot((spatialPositions.get(String(receiver.playerId)).x-possessionTarget[0])*METRES_PER_X,(spatialPositions.get(String(receiver.playerId)).y-possessionTarget[1])*METRES_PER_Y)/runningProfile(receiver.player).maxSpeed} : {}), ...(markTaken ? { shooterId: actor.playerId, distance: shotDistance } : {}) };
      const visualCarrier = phaseTurnover ? defender : phaseIndex === 5 ? actor : receiver ?? actor;
      const protectedZone = markTaken || freeKick
        ? { kickerId:actor.playerId, markerId:defender.playerId, side:attackSide, origin:possessionTarget, direction:attacksLeft ? -1 : 1 }
        : (current.visualAction?.mark || current.visualAction?.freeKick) ? current.visualAction.protectedZone : null;
      const spatialAction = { kind:actionKind, travelDistance:disposalDistance, distance:shotDistance, freeKick, protectedZone, id: elapsedSeconds, playerId: visualCarrier?.playerId, opponentId: defender?.playerId, side: phaseTurnover ? defendSide : attackSide, mark: markTaken || freeKick, phase: phaseIndex, seconds: elapsedThisPhase };
      // Plan movement for the lineup that will be on the ground next. A player
      // coming on takes over the exact spot of the player he replaces, so no
      // gap opens in the structure and possession logic sees a full side.
      const nextSpatialEntries = ["home", "away"].flatMap(side => [...resolveActiveSlots(lineupFor(side).map((entry) => ({
        ...entry,
        onField: (nextRotations?.[String(entry.player.id)] ?? (entry.position.startsWith("INT") ? "BENCH" : "ON")) === "ON",
      })))].map(([slot, entry]) => ({ side, slot, player: entry.player })));
      const nextIds = new Set(nextSpatialEntries.map((entry) => String(entry.player.id)));
      const previousBySlot = new Map(spatialEntries.map((entry) => [`${entry.side}:${entry.slot}`, String(entry.player.id)]));
      const handoverPositions = new Map(spatialPositions);
      for (const entry of nextSpatialEntries) {
        const id = String(entry.player.id);
        if (spatialPositions.has(id)) continue;
        const outgoingId = previousBySlot.get(`${entry.side}:${entry.slot}`);
        const outgoingPoint = outgoingId && !nextIds.has(outgoingId) ? spatialPositions.get(outgoingId) : null;
        if (outgoingPoint) handoverPositions.set(id, { ...outgoingPoint });
      }
      const spatialPoints = protectKicker(planOvalMovement(nextSpatialEntries, handoverPositions, possessionTarget, spatialAction, OVAL_SLOTS, reversed), protectedZone);
      const actionRecord = {
        id: elapsedSeconds, quarter: current.quarter, second: elapsedSeconds,
        side: attackSide, actorId: actor.playerId, receiverId: receiver?.playerId ?? null, defenderId: defender.playerId,
        kind: actionKind, freeKick, protectedZone,
        from: origin, to: possessionTarget, distance: Math.round(Math.hypot((possessionTarget[0]-origin[0])*METRES_PER_X, (possessionTarget[1]-origin[1])*METRES_PER_Y)),
        score: phaseIndex === 5 ? scored.text : null,
        statChanges: captureActionStatChanges(sourceStats, playerStats),
        text: eventText,
      };
      // The resolved action is the source of every counting stat. The working
      // rows above only stage the outcome while match rules are being resolved.
      const recordedPlayerStats = applyActionStatChanges(sourceStats, actionRecord, playerStats);
      const teamStats = {
        home: summarizeTeamStats(recordedPlayerStats.home, { ...current, scoreEvents, timeInFront, biggestLead, possession: homePossession, managerSide: current.managerSide }, "home"),
        away: summarizeTeamStats(recordedPlayerStats.away, { ...current, scoreEvents, timeInFront, biggestLead, possession: homePossession, managerSide: current.managerSide }, "away"),
      };
      const next = {
        ...current,
        actions: [...(current.actions ?? []), actionRecord],
        spatialQuarter: current.quarter,
        spatialPositions: Object.fromEntries(spatialPoints.map(point => [point.id, point])),
        needsCentreSetup: scored.text === "Goal",
        needsBallUpSetup: neutralBallUp,
        spatialBall: scored.text === "Goal" ? [50,50] : scored.text === "Behind" ? [attacksLeft ? 8 : 92,50] : possessionTarget,
        minute: Math.min(80, nextMinute),
        elapsedSeconds: Math.min(80 * 60, elapsedSeconds),
        secondsRemaining,
        quarter: nextQuarter,
        homeGoals: isHome ? scored.goals : current.homeGoals,
        homeBehinds: isHome ? scored.behinds : current.homeBehinds,
        homeScore: isHome ? scored.total : current.homeScore,
        awayGoals: isHome ? current.awayGoals : scored.goals,
        awayBehinds: isHome ? current.awayBehinds : scored.behinds,
        awayScore: isHome ? current.awayScore : scored.total,
        possession: managerPossession,
        momentum: Math.max(-15, Math.min(15, current.momentum * 0.9 + momentumShift)),
        intensity: Math.max(30, Math.min(90, current.intensity + (tacticalRatings.pressure > 1 ? 1 : tacticalRatings.pressure < -1 ? -1 : 0))),
        status: finished ? "FULL_TIME" : quarterEnded ? "QUARTER_BREAK" : "LIVE",
        rotations: nextRotations,
        ...(finished ? { matchTimeOnGround } : {}),
        playerStats: recordedPlayerStats,
        teamStats,
        scoreEvents,
        timeInFront,
        biggestLead,
        homePossessionSeconds,
        ballSequence: nextBallSequence,
        visualAction: { kind: actionKind, travelDistance: actionRecord.distance, freeKick, protectedZone, target: possessionTarget, carrying: possession?.carrying, id: actionRecord.id, phase: phaseIndex, distance: shotDistance, mark: markTaken, turnover: phaseTurnover, side: phaseTurnover ? defendSide : attackSide, playerId: visualCarrier?.playerId, opponentId: defender?.playerId, score: actionRecord.score, scorerName: (scorerCandidate ?? actor)?.playerName, scoringClub, text: eventText },
        traitActivations,
        events: [...current.events, ...(quarterEnded ? [{ id: Date.now() - 1, minute: nextMinute, quarter: `Q${current.quarter}`, text: `End of ${quarterLabels[current.quarter - 1]}` }] : []), { id: Date.now(), minute: Math.min(80, nextMinute), quarter: `Q${current.quarter}`, text: eventText, clock: formatQuarterClock(secondsRemaining), side: attackSide }].slice(-40),
      };
      return next;
  }
  function advanceMatch() {
    lastAdvanceAtRef.current = performance.now();
    setMatch((current) => resolveMatchAdvance(current));
  }
  advanceMatchRef.current = advanceMatch;

  function updateTactics(nextPlan, liveAdjustment = null) {
    const normalized = normalizeTactics(nextPlan);
    const styleName = TACTIC_STYLES.find((style) => style.id === normalized.style)?.name ?? "Adaptive Hybrid";
    updateMatch((current) => ({
      tactics: normalized,
      tacticalPlans: { ...(current.tacticalPlans ?? {}), [club.name]: normalized },
      ...(current.status === "LIVE" || current.status === "PAUSED"
        ? { events: [...current.events, { id: Date.now(), minute: current.minute, quarter: `Q${current.quarter}`, text: liveAdjustment ?? `Coach changes the plan to ${styleName}. The next phase will reflect the new approach.` }].slice(-10) }
        : {}),
    }));
    if (match.status === "PREVIEW") onTacticsChange?.(normalized);
  }
  function setStyle(style) {
    const name = TACTIC_STYLES.find((item) => item.id === style)?.name ?? "Adaptive Hybrid";
    updateTactics({ ...match.tactics, style }, `Coach switches to ${name}. The next phase will reflect the new approach.`);
  }
  function setSlider(key, value) {
    const slider = TACTIC_SLIDERS.find((item) => item.id === key);
    const numeric = Number(value);
    const direction = numeric < 50 ? slider?.left : slider?.right;
    updateTactics({ ...match.tactics, sliders: { ...match.tactics.sliders, [key]: numeric } }, `Coach shifts the ${slider?.left ?? "tactical"} / ${slider?.right ?? "tactical"} balance toward ${direction ?? "the middle"} (${numeric}).`);
  }
  function setInstruction(playerId, instruction) {
    const player = clubPlayers.find((candidate) => String(candidate.id) === String(playerId));
    updateMatch((current) => ({
      instructions: { ...(current.instructions ?? {}), [playerId]: instruction === "No instruction" ? "" : instruction },
      ...(current.status === "LIVE" && instruction !== "No instruction"
        ? { events: [...current.events, { id: Date.now(), minute: current.minute, quarter: `Q${current.quarter}`, text: `Instruction changed for ${player?.name ?? "a player"}: ${instruction}.` }].slice(-10) }
        : {}),
    }));
  }
  function applyAssistantAdvice(advice) {
    if (!advice?.action || match.status === "FULL_TIME" || (advice.action.type === "swap" && !teamSheetConfirmed)) return;
    const record = captureMatchAdvice(match, homeIsManager ? "home" : "away", advice, matchupModel);
    updateMatch((current) => ({ adviceActions: [...(current.adviceActions ?? []), record].slice(-20) }));
    if (advice.action.type === "slider") setSlider(advice.action.key, advice.action.value);
    if (advice.action.type === "instruction") setInstruction(advice.action.playerId, advice.action.instruction);
    if (advice.action.type === "swap") swapMatchSlots(advice.action.firstSlot, advice.action.secondSlot);
  }
  function makeSubstitution(benchPlayerId) {
    if (!pendingSubOutId || pendingSubOutId === benchPlayerId) return;
    const outgoing = selectedLineup.find((entry) => String(entry.player.id) === String(pendingSubOutId))?.player;
    const incoming = selectedLineup.find((entry) => String(entry.player.id) === String(benchPlayerId))?.player;
    if (!outgoing || !incoming) return;
    const activeSlots = matchupModel.ownSlots;
    const outgoingSlot = [...activeSlots].find(([, entry]) => String(entry.player.id) === String(outgoing.id))?.[0];
    if (!outgoingSlot) {
      setLineupNotice("Select a player currently on the field before making a substitution.");
      return;
    }
    setLineupNotice("");
    updateMatch((current) => ({
      rotations: { ...current.rotations, [outgoing.id]: "BENCH", [incoming.id]: "ON" },
      substitutions: [...(current.substitutions ?? []), { minute: current.minute, quarter: current.quarter, slot: outgoingSlot, outgoingId: outgoing.id, incomingId: incoming.id, outgoing: outgoing.name, incoming: incoming.name }],
      playerStats: current.playerStats ? {
        ...current.playerStats,
        [homeIsManager ? "home" : "away"]: current.playerStats[homeIsManager ? "home" : "away"].map((row) => String(row.playerId) === String(incoming.id)
          ? { ...row, matchPosition: getPlayingPosition(incoming, outgoingSlot), positions: [getPlayingPosition(incoming, outgoingSlot)] }
          : row),
      } : current.playerStats,
      events: [...current.events, { id: Date.now(), minute: current.minute, quarter: `Q${current.quarter}`, text: `Substitution: ${incoming.name} on for ${outgoing.name}.` }].slice(-10),
    }));
    setPendingSubOutId(null);
  }
  function swapMatchSlots(firstSlot, secondSlot) {
    if (!teamSheetConfirmed || match.status === "FULL_TIME" || !firstSlot || !secondSlot || firstSlot === secondSlot) return;
    const liveSlots = { ...(match.liveSlots ?? teamSelection?.selectedSide ?? {}) };
    // Commit prior substitutions into the sheet before a positional switch.
    for (const [fieldSlot, entry] of matchupModel.ownSlots) {
      if (liveSlots[fieldSlot] === entry.player.name) continue;
      const oldSlot = Object.keys(liveSlots).find((slot) => liveSlots[slot] === entry.player.name);
      if (oldSlot) [liveSlots[fieldSlot], liveSlots[oldSlot]] = [liveSlots[oldSlot], liveSlots[fieldSlot]];
    }
    if (!liveSlots[firstSlot] || !liveSlots[secondSlot]) return;
    const playerByName = new Map(clubPlayers.map((player) => [player.name, player]));
    const firstPlayer = playerByName.get(liveSlots[firstSlot]);
    const secondPlayer = playerByName.get(liveSlots[secondSlot]);
    if (!firstPlayer || !secondPlayer) {
      setLineupNotice("Select two players on your team sheet to switch positions.");
      return;
    }
    setLineupNotice("");
    [liveSlots[firstSlot], liveSlots[secondSlot]] = [liveSlots[secondSlot], liveSlots[firstSlot]];
    updateMatch((current) => {
      const livePositions = { ...(current.livePositions ?? {}) };
      const rotations = { ...(current.rotations ?? {}) };
      for (const [position, playerName] of Object.entries(liveSlots)) {
        const player = playerByName.get(playerName);
        if (player) {
          livePositions[player.id] = getPlayingPosition(player, position);
          rotations[player.id] = position.startsWith("INT") ? "BENCH" : "ON";
        }
      }
      const playerStats = current.playerStats ? {
        ...current.playerStats,
        [homeIsManager ? "home" : "away"]: current.playerStats[homeIsManager ? "home" : "away"].map((row) => ({
          ...row,
          ...(livePositions[row.playerId] ? { matchPosition: livePositions[row.playerId], positions: [livePositions[row.playerId]] } : {}),
        })),
      } : current.playerStats;
      return {
        liveSlots, livePositions, rotations, playerStats,
        manualSlotLocks: { ...(current.manualSlotLocks ?? {}), [firstPlayer.id]: secondSlot, [secondPlayer.id]: firstSlot },
        matchupSubstitutionStart: (current.substitutions ?? []).length,
      };
    });
  }
  function chooseMatchSlot(slot) {
    if (!teamSheetConfirmed || match.status === "FULL_TIME") return;
    if (!pendingMatchSlot) {
      setPendingMatchSlot(slot);
      return;
    }
    if (pendingMatchSlot === slot) {
      setPendingMatchSlot(null);
      return;
    }
    swapMatchSlots(pendingMatchSlot, slot);
    setPendingMatchSlot(null);
  }
  function setTOG(playerId, value) {
    const newTog = { ...togMap, [playerId]: Number(value) };
    setTogMap(newTog);
    updateMatch({ plannedTimeOnGround: newTog });
    onTimeOnGroundChange?.(newTog);
  }
  function balanceTOG() {
    const balanced = balanceMatchTimePlan(togPlayers, togMap, getDefaultTimeOnGround);
    setTogMap(balanced);
    updateMatch({ plannedTimeOnGround: balanced });
    onTimeOnGroundChange?.(balanced);
  }

  const managerScore = homeIsManager ? match.homeScore : match.awayScore;
  const opponentScore = homeIsManager ? match.awayScore : match.homeScore;
  const managerPossession = homeIsManager ? match.possession : 100 - match.possession;
  const managerMomentum = homeIsManager ? match.momentum : -match.momentum;
  const matchupAdvice = matchupSwap && teamSheetConfirmed && match.status !== "FULL_TIME" ? {
      key: `matchup-switch:${matchupSwap.firstSlot}:${matchupSwap.secondSlot}:${matchupModel.ownSlots.get(matchupSwap.firstSlot)?.player?.id}:${matchupModel.ownSlots.get(matchupSwap.secondSlot)?.player?.id}`,
      metric: "matchup",
      improvement: matchupSwap.improvement,
      title: "Exploit a matchup",
      evidence: `${matchupSwap.target.ownName} faces ${matchupSwap.target.opponentName} at ${matchupSwap.target.ownSlot} (${matchupSwap.target.label.toLowerCase()}). ${matchupSwap.traitImprovement >= 2 ? `The switch improves your trait matchups by ${matchupSwap.traitImprovement} points.` : matchupSwap.target.traitInteractions?.own?.[0]?.reason ?? matchupSwap.target.traitInteractions?.opponent?.[0]?.reason ?? "Their attributes and roles favour a change."} Swapping ${matchupSwap.firstPlayer} and ${matchupSwap.secondPlayer} improves the combined matchup ratings by ${matchupSwap.improvement} points.`,
      actionLabel: `Swap ${matchupSwap.firstPlayer} and ${matchupSwap.secondPlayer}`,
      action: { type: "swap", firstSlot: matchupSwap.firstSlot, secondSlot: matchupSwap.secondSlot },
    } : null;
  const recentAdvice = (key) => (match.adviceActions ?? []).some((record) => record.key === key && Number(match.elapsedSeconds) - Number(record.appliedAtSeconds) < 12 * 60);
  const assistant = getAssistantAdvice(match, homeIsManager ? "home" : "away", selectedLineup)
    ?? (matchupAdvice && !recentAdvice(matchupAdvice.key) ? matchupAdvice : null);
  const adviceOutcomes = (match.adviceActions ?? []).map((record) => ({ record, result: evaluateMatchAdvice(record, match, matchupModel) }));

  const cardStyle = { background: palette.card, border: `1px solid ${palette.border}`, borderRadius: 16 };
  const buttonStyle = { border: `1px solid ${palette.border}`, borderRadius: 9, padding: "9px 12px", color: palette.text, background: palette.surface, cursor: "pointer", fontWeight: 700 };
  const clubScore = (team, goals, behinds, score, isManager) => (
    <div className={`match-team ${isManager ? "match-team-manager" : ""}`}>
      <ClubBadge club={team.name} size={54} />
      <div className="match-team-name"><span>{isManager ? "YOUR CLUB" : "OPPOSITION"}</span><strong>{team.name}</strong><small>{goals}.{behinds} · {score} points</small></div>
    </div>
  );
  const renderFieldBoard = (team, entries, side, editable) => {
    const activeSlots = editable ? matchupModel.ownSlots : matchupModel.opponentSlots;
    const slots = new Map(activeSlots);
    const activeIds = new Set([...activeSlots.values()].map((entry) => String(entry.player.id)));
    const bench = entries.filter((entry) => !activeIds.has(String(entry.player.id)));
    benchSlots.forEach((slot, index) => slots.set(slot, bench[index]));
    return <section key={side} className="match-field-panel" style={{ ...cardStyle, padding: 14 }}>
      <div className="section-title"><div><span className="eyebrow">{side === "home" ? "HOME" : "AWAY"}</span><h3>{team.name}</h3></div><span className="quarter-chip">{(editable ? matchupModel.ownSlots : matchupModel.opponentSlots).size} on field</span></div>
      {editable && <p className="helper-text">Select two position cards to swap players. The opposition lineup is based on its strongest available squad.</p>}
      {editable && lineupNotice && <p role="status" className="helper-text" style={{ color: palette.orange }}>{lineupNotice}</p>}
      <div className="match-field-oval">
        {fieldRows.map(([rowLabel, positions]) => <div className="match-field-row" key={rowLabel}>
          {positions.map((position) => {
            const entry = slots.get(position);
            const selected = pendingMatchSlot === position && editable;
            return <button key={position} type="button" className={`match-field-player${selected ? " is-selected" : ""}`} onClick={() => editable && chooseMatchSlot(position)} disabled={!entry || !editable} style={{ cursor: editable && entry ? "pointer" : "default" }}>
              <span className="match-field-position">{position}</span>
              {entry ? <><strong>{entry.player.name}</strong><small>{getPlayingPosition(entry.player, position)} · OVR {getSlotSuitability(entry.player, position).overall}{getSlotSuitability(entry.player, position).fit !== "natural" ? ` · ${getSlotSuitability(entry.player, position).fit}` : ""}</small>{editable && matchupModel.byPlayerId[String(entry.player.id)] && <small>{matchupModel.byPlayerId[String(entry.player.id)].label} · {matchupModel.byPlayerId[String(entry.player.id)].edge > 0 ? "+" : ""}{matchupModel.byPlayerId[String(entry.player.id)].edge}</small>}</> : <><strong>—</strong><small>{position}</small></>}
            </button>;
          })}
        </div>)}
      </div>
      <div className="match-bench-list"><strong>Interchange</strong>{benchSlots.map((position) => {
        const entry = slots.get(position);
        return <button key={position} type="button" className={`match-bench-player${pendingMatchSlot === position && editable ? " is-selected" : ""}`} onClick={() => editable && chooseMatchSlot(position)} disabled={!entry || !editable || match.status !== "PREVIEW"}>{entry?.player.name ?? "—"}<small>{position}</small></button>;
      })}</div>
    </section>;
  };
  const pendingScore = shotPending && ["Goal", "Behind"].includes(match.visualAction?.score);
  const pendingPoints = pendingScore ? (match.visualAction.score === "Goal" ? 6 : 1) : 0;
  const pendingHome = pendingScore && match.visualAction.side === "home";
  const shownHomeScore = match.homeScore - (pendingHome ? pendingPoints : 0);
  const shownAwayScore = match.awayScore - (pendingScore && !pendingHome ? pendingPoints : 0);
  const shownHomeGoals = match.homeGoals - (pendingHome && match.visualAction.score === "Goal" ? 1 : 0);
  const shownAwayGoals = match.awayGoals - (pendingScore && !pendingHome && match.visualAction.score === "Goal" ? 1 : 0);
  const shownHomeBehinds = match.homeBehinds - (pendingHome && match.visualAction.score === "Behind" ? 1 : 0);
  const shownAwayBehinds = match.awayBehinds - (pendingScore && !pendingHome && match.visualAction.score === "Behind" ? 1 : 0);
  const shownScoreEvents = pendingScore ? (match.scoreEvents ?? []).slice(0, -1) : match.scoreEvents ?? [];
  const scoreTimeline = [{ homeScore: 0, awayScore: 0 }, ...shownScoreEvents];
  const scoreChart = (key) => scoreTimeline.map((event, index) => {
    const x = 18 + index / Math.max(1, scoreTimeline.length - 1) * 564;
    const maxScore = Math.max(6, shownHomeScore, shownAwayScore);
    const y = 98 - (Number(event[key] ?? 0) / maxScore) * 82;
    return `${x},${y}`;
  }).join(" ");

  return (
    <main className={`match-centre${finalsSeries ? " is-finals-series" : ""}`} style={{ color: palette.text }}>
      <div className="match-header-row">
        <div><div className="eyebrow" style={{ color: palette.orange }}>MATCH DAY · ROUND {fixture?.round ?? 1}</div><h2 style={{ margin: "4px 0" }}>{homeTeam.name} v {awayTeam.name}</h2><p style={{ color: saveError ? "#f87171" : palette.muted, margin: 0 }}>{fixture?.venue ?? club.venue} · {formatMatchDate(fixture?.date)}{saving ? " · saving" : saveError ? ` · save failed: ${saveError}` : ""}</p></div>
        <button type="button" onClick={onBack} style={buttonStyle}>Exit match to season hub</button>
      </div>

      <section className="live-score-card" style={cardStyle}>
        <div className="score-topline"><span className={`live-pill ${match.status === "LIVE" ? "is-live" : ""}`}>{match.status === "PREVIEW"
  ? "PRE-MATCH"
  : match.status === "FULL_TIME"
  ? "FULL TIME"
  : match.status === "QUARTER_BREAK"
  ? "QUARTER BREAK"
  : match.status === "PAUSED"
  ? "PAUSED"
  : "LIVE"}</span><strong>{formatQuarterClock(match.secondsRemaining)}</strong><span>{quarterLabels[(match.quarter || 1) - 1] ?? "Q4"}</span></div>
        <div className="score-teams">{clubScore(homeTeam, shownHomeGoals, shownHomeBehinds, shownHomeScore, homeIsManager)}<div className="score-total"><strong>{shownHomeScore}</strong><span>—</span><strong>{shownAwayScore}</strong></div>{clubScore(awayTeam, shownAwayGoals, shownAwayBehinds, shownAwayScore, !homeIsManager)}</div>
        {match.status === "LIVE" && <button type="button" className="primary-match-button" onClick={skipToNextBreak} disabled={skippingToBreak} style={{margin:'12px auto 0',display:'block'}}>{skippingToBreak ? "Skipping…" : "Skip to Next Break"}</button>}
        {match.status === "PREVIEW" && <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 14 }}><span style={{ color: palette.muted, fontSize: 13, fontWeight: 700 }}>MATCH SPEED</span>{matchSpeeds.map((value) => <button key={value} type="button" aria-pressed={speed === value} onClick={() => setSpeed(value)} style={{ ...buttonStyle, minWidth: 48, borderColor: speed === value ? palette.green : palette.border, color: speed === value ? "#fff" : palette.text, background: speed === value ? palette.green : palette.surface }}>{value}×</button>)}<button type="button" className="primary-match-button" onClick={startMatch} disabled={!teamSheetConfirmed || selectedLineup.length < MIN_FIELD_PLAYERS || togBudget.remaining !== 0} style={{ opacity: teamSheetConfirmed && selectedLineup.length >= MIN_FIELD_PLAYERS && togBudget.remaining === 0 ? 1 : 0.55, cursor: teamSheetConfirmed && selectedLineup.length >= MIN_FIELD_PLAYERS && togBudget.remaining === 0 ? "pointer" : "not-allowed" }}>Start match</button><button type="button" className="primary-match-button" onClick={simulateGameInstantly} disabled={!teamSheetConfirmed || selectedLineup.length < MIN_FIELD_PLAYERS || togBudget.remaining !== 0} style={{background:palette.surface}}>Sim Game</button></div>}
        {match.status === "PREVIEW" && togBudget.remaining !== 0 && <p role="status" style={{ color: palette.orange, textAlign: "center", fontWeight: 700 }}>Match time needs balancing. <button type="button" onClick={() => setActiveTab("MATCH_TIME")} style={buttonStyle}>Adjust player minutes</button></p>}
        {match.status === "PREVIEW" && !teamSheetConfirmed && <p role="status" style={{ color: palette.orange, textAlign: "center", fontWeight: 700 }}>Confirm the complete team sheet for this round before starting the match.</p>}
        {match.status === "LIVE" && (
  <div
    style={{
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginTop: 14,
    }}
  >
    <span
      style={{
        color: palette.muted,
        fontSize: 13,
        fontWeight: 700,
      }}
    >
      MATCH SPEED
    </span>

    {matchSpeeds.map(value => (
      <button
        key={value}
        type="button"
        aria-pressed={speed === value}
        onClick={() => setSpeed(value)}
        style={{
          ...buttonStyle,
          minWidth: 48,
          borderColor:
            speed === value
              ? palette.green
              : palette.border,
          color:
            speed === value
              ? "#fff"
              : palette.text,
          background:
            speed === value
              ? palette.green
              : palette.surface,
        }}
      >
        {value}×
      </button>
    ))}

    <button
      type="button"
      className="primary-match-button"
      onClick={pauseMatch}
    >
      Pause
    </button>
  </div>
)}
{match.status === "PAUSED" && (
  <div
    style={{
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginTop: 14,
    }}
  >
    <button
      type="button"
      className="primary-match-button"
      onClick={resumeMatch}
    >
      Resume Match
    </button>
  </div>
)}
        {match.status === "QUARTER_BREAK" && <div role="status" style={{ display: "grid", justifyItems: "center", gap: 10, marginTop: 14 }}>
          <strong>{["QUARTER TIME", "HALF TIME", "THREE QUARTER TIME"][match.quarter - 1]} · {homeTeam.name} {match.homeScore} – {awayTeam.name} {match.awayScore}</strong>
          <button type="button" className="primary-match-button" onClick={continueAfterQuarter}>Centre bounce · Start {quarterLabels[match.quarter]}</button>
        </div>}
        {match.status === "FULL_TIME" && <button type="button" className="primary-match-button" onClick={() => onComplete?.(match)}>Return result to season</button>}
      </section>
      
      <nav className="match-tabs" aria-label="Match controls">{["OVERVIEW", "LINEUP", "MATCHUPS", "TACTICS", "INSTRUCTIONS", "MATCH_TIME", "PLAYER_STATS", "TEAM_STATS", ...(match.status === "FULL_TIME" && match.matchReview ? ["REPORT"] : [])].map((tab) => <button key={tab} type="button" aria-pressed={activeTab === tab} onClick={() => setActiveTab(tab)} style={{ ...buttonStyle, background: activeTab === tab ? palette.green : palette.surface, color: activeTab === tab ? "#fff" : palette.text }}>{tab === "MATCH_TIME" ? "MATCH TIME" : tab === "PLAYER_STATS" ? "PLAYER STATS" : tab === "TEAM_STATS" ? "TEAM STATS" : tab === "REPORT" ? "MATCH REPORT" : tab}</button>)}</nav>

      <div className="match-layout">
        <section className="match-main-column">
          {activeTab === "OVERVIEW" && <LiveMatchOval match={match} speed={playbackSpeed} shotPending={shotPending} onCentreReady={setCentreReadyId} homeSlots={homeIsManager ? matchupModel.ownSlots : matchupModel.opponentSlots} awaySlots={homeIsManager ? matchupModel.opponentSlots : matchupModel.ownSlots} />}
          {activeTab === "OVERVIEW" && <div className="overview-grid"><section style={{ ...cardStyle, padding: 18 }}><div className="section-title"><div><span className="eyebrow">COACH'S BOX</span><h3>Match pulse</h3></div><span className="quarter-chip">{match.status === "PREVIEW" ? "Ready" : `Q${match.quarter}`}</span></div><div className="pulse-grid"><div><span>Momentum</span><strong>{managerMomentum > 5 ? "Ours" : managerMomentum < -5 ? "Opposition" : "Even"}</strong></div><div><span>Intensity</span><strong>{match.intensity}%</strong></div><div><span>Clearances</span><strong>{match.teamStats?.[homeIsManager ? "home" : "away"]?.clearances ?? 0}</strong></div><div><span>Inside 50s</span><strong>{match.teamStats?.[homeIsManager ? "home" : "away"]?.inside50s ?? 0}</strong></div></div></section><section style={{ ...cardStyle, padding: 18 }}><div className="section-title"><div><span className="eyebrow">SCORE FEED</span><h3>Scoring timeline</h3></div></div><div className="score-chart-wrap"><svg className="score-chart" viewBox="0 0 600 120" role="img" aria-label={`Score timeline: ${match.homeTeam} ${shownHomeScore}, ${match.awayTeam} ${shownAwayScore}`}><line x1="18" y1="100" x2="582" y2="100" /><line x1="159" y1="12" x2="159" y2="104" /><line x1="300" y1="12" x2="300" y2="104" /><line x1="441" y1="12" x2="441" y2="104" /><polyline points={scoreChart("homeScore")} className="home-score-line" /><polyline points={scoreChart("awayScore")} className="away-score-line" /></svg><div className="score-chart-legend"><span>{match.homeTeam} · {shownHomeScore}</span><span>{match.awayTeam} · {shownAwayScore}</span></div></div><div className="event-list">{shownScoreEvents.length ? shownScoreEvents.slice().reverse().map((event) => <button key={event.id} type="button" className="score-feed-row" onClick={() => { setSelectedStatPlayerId(event.playerId); setActiveTab("PLAYER_STATS"); }}><span>{event.quarter} {event.clock}</span><b>{event.type.toUpperCase()}</b><strong>{event.club}</strong><span>— {event.playerName}</span></button>) : <p className="helper-text">Scoring plays will appear here during the match. Select a score to open the player statistics.</p>}</div></section></div>}
          {activeTab === "LINEUP" && <div className="match-lineup-grid">
            {renderFieldBoard(homeTeam, homeLineup, "home", homeIsManager)}
            {renderFieldBoard(awayTeam, awayLineup, "away", !homeIsManager)}
            <section className="match-lineup-actions" style={{ ...cardStyle, padding: 16 }}>
              <strong>Interchange management</strong>
              <p className="helper-text">Select a player to come off, then a player from the interchange. The side will rearrange to keep 18 on the field.</p>
              {pendingSubOutId && <p role="status" style={{ color: palette.orange }}>Choose a replacement for {selectedLineup.find((entry) => String(entry.player.id) === String(pendingSubOutId))?.player.name}.</p>}
              <div className="match-sub-list">{selectedLineup.map(({ position, player }) => {
                const fitness = Math.round(playerFitness?.[player.id]?.fitness ?? 100);
                const canSub = match.status === "LIVE" || match.status === "PAUSED";
                const onField = [...matchupModel.ownSlots.values()].some((entry) => String(entry.player.id) === String(player.id));
                const outgoingSlot = pendingSubOutId ? [...matchupModel.ownSlots].find(([, entry]) => String(entry.player.id) === String(pendingSubOutId))?.[0] : null;
                const directRating = outgoingSlot ? getSlotSuitability(player, outgoingSlot).overall : null;
                return <div className="match-sub-row" key={position}>
                  <span><strong>{player.name}</strong><small>{position} · FIT {fitness}%{!onField && directRating !== null ? ` · direct fit ${directRating}` : ""}</small></span>
                  {canSub && (onField
                    ? <button type="button" onClick={() => { setLineupNotice(""); setPendingSubOutId(String(player.id)); }} style={buttonStyle}>{String(pendingSubOutId) === String(player.id) ? "Selected" : "Sub off"}</button>
                    : <button type="button" disabled={!pendingSubOutId || !outgoingSlot} onClick={() => makeSubstitution(String(player.id))} style={{ ...buttonStyle, opacity: pendingSubOutId && outgoingSlot ? 1 : 0.5 }}>Sub on</button>)}
                </div>;
              })}</div>
            </section>
          </div>}
          {activeTab === "MATCHUPS" && <section style={{ ...cardStyle, padding: 18 }}>
            <div className="section-title"><div><span className="eyebrow">ON-FIELD OPPONENTS</span><h3>Matchups</h3></div><span className="quarter-chip">{matchupModel.matchups.length} pairs</span></div>
            <p className="helper-text">Ratings compare role, attributes, height and opposing traits. A counter can suppress a trait; the right opponent can amplify it. Fitness, sharpness and tactics still determine whether it activates.</p>
            <div className="matchup-line-summary">{[["Forward line", "forward"], ["Midfield", "midfield"], ["Defence", "defence"]].map(([label, line]) => {
              const summary = matchupAnalytics.lines[line];
              const pace = summary.attributes.find((item) => item.key === "speed");
              const stamina = summary.attributes.find((item) => item.key === "endurance");
              return <span key={line}><strong>{label}</strong> {summary.edge > 0 ? "+" : ""}{summary.edge}<small style={{ display: "block" }}>Speed {pace?.count ? `${pace.gap > 0 ? "+" : ""}${pace.gap.toFixed(1)}` : "—"} · Endurance {stamina?.count ? `${stamina.gap > 0 ? "+" : ""}${stamina.gap.toFixed(1)}` : "—"}</small></span>;
            })}</div>
            {matchupAdvice && !recentAdvice(matchupAdvice.key) && <div className="matchup-suggestion"><div><strong>Suggested switch</strong><p>Swap {matchupSwap.firstPlayer} and {matchupSwap.secondPlayer} to improve their combined matchups by {matchupSwap.improvement} points.</p></div><button type="button" onClick={() => applyAssistantAdvice(matchupAdvice)} disabled={!teamSheetConfirmed} style={buttonStyle}>Make switch</button></div>}
            <div className="matchup-list">{matchupModel.matchups.map((pair) => {
              const opportunities = traitOpportunitiesByPlayer[pair.ownPlayerId] ?? [];
              return <article className="matchup-row" key={pair.ownSlot}>
                <span className="matchup-slot">{pair.ownSlot} · {pair.opponentSlot}</span>
                <div><strong>{pair.ownName}</strong><small>v {pair.opponentName}</small></div>
                <div><b className={pair.edge <= -5 ? "matchup-negative" : pair.edge >= 5 ? "matchup-positive" : ""}>{pair.edge > 0 ? "+" : ""}{pair.edge} · {pair.label}</b><small>{pair.reasons.join(" · ")}</small>
                  {pair.ownTraits.length > 0 && <small>Traits: {pair.ownTraits.map((id) => getTraitDefinition(id)?.label ?? id).join(", ")}</small>}
                  {pair.traitInteractions?.own?.map((rule) => <small key={`${rule.trait}:${rule.against}`} className={rule.factor < 1 ? "matchup-negative" : "matchup-positive"}>{rule.factor < 1 ? "COUNTERED" : "EXPLOIT"} · {rule.label} · {rule.reason}</small>)}
                  {pair.traitInteractions?.opponent?.map((rule) => <small key={`opponent:${rule.trait}:${rule.against}`} className={rule.factor < 1 ? "matchup-positive" : "matchup-negative"}>{rule.factor < 1 ? "YOU COUNTER" : "THEY EXPLOIT"} · {rule.label} · {rule.reason}</small>)}
                  {opportunities.map((item) => <small className="matchup-trait-opportunity" key={item.id}>{item.label}: {item.phases.join(", ")} · {item.matchupFactor < .8 ? "countered in its key phase" : item.matchupFactor > 1 ? "amplified by this opponent" : item.situation} · influence applied {match.traitActivations?.[`${pair.ownPlayerId}:${item.id}`] ?? 0} times</small>)}
                  {pair.ownTraits.length > 0 && !opportunities.length && <small>Traits currently contained by role, opponent or condition.</small>}
                </div>
              </article>;
            })}</div>
            {!matchupModel.matchups.length && <p className="helper-text">Matchups appear once both team sheets have players on the field.</p>}
          </section>}
          {activeTab === "PLAYER_STATS" && <section style={{ ...cardStyle, padding: 18 }}><div className="section-title"><div><span className="eyebrow">LIVE MATCH DATA</span><h3>Player stats</h3></div><span className="quarter-chip">{match.status === "FULL_TIME" ? "Full time" : `Q${match.quarter || 1}`}</span></div><div className="player-stats-toolbar" role="group" aria-label="Filter player stats by club">{[{ label: "ALL", value: "ALL" }, { label: clubCodeFor(homeTeam.name), value: clubCodeFor(homeTeam.name) }, { label: clubCodeFor(awayTeam.name), value: clubCodeFor(awayTeam.name) }].map((filter) => <button key={filter.value} type="button" aria-pressed={playerStatsClubFilter === filter.value} onClick={() => setPlayerStatsClubFilter(filter.value)}>{filter.label}</button>)}</div><div style={{ overflowX: "auto" }}><table className="match-data-table"><colgroup><col className="player-stats-name-column" /><col className="player-stats-club-column" />{statColumns.map(([heading]) => <col key={heading} />)}</colgroup><thead><tr>{[["Player", "playerName"], ["Club", "club"], ...statColumns].map(([heading, key]) => <th key={key} aria-sort={playerStatsSort.key === key ? (playerStatsSort.direction === "asc" ? "ascending" : "descending") : "none"}><button type="button" className="player-stats-sort" onClick={() => setPlayerStatsSort((current) => current.key === key ? { key, direction: current.direction === "asc" ? "desc" : "asc" } : { key, direction: key === "playerName" || key === "club" ? "asc" : "desc" })}>{heading}{playerStatsSort.key === key ? (playerStatsSort.direction === "asc" ? " ↑" : " ↓") : ""}</button></th>)}</tr></thead><tbody>{playerStatsRows.map((stat) => <tr key={`${stat.club}-${stat.playerId}`} className={String(selectedStatPlayerId) === String(stat.playerId) ? "is-highlighted" : ""}><td><strong>{abbreviatedPlayerName(stat.playerName)}</strong><small>{stat.matchPosition}</small></td><td>{clubCodeFor(stat.club)}</td>{statColumns.map(([heading, key]) => <td key={key}>{key === "fantasyPoints" ? fantasyPoints(stat) : key === "scoreLine" ? `${stat.goals}.${stat.behinds}` : stat[key] ?? 0}</td>)}</tr>)}</tbody></table></div></section>}
          {activeTab === "TEAM_STATS" && <section style={{ ...cardStyle, padding: 18 }}><div className="section-title"><div><span className="eyebrow">LIVE MATCH DATA</span><h3>Team stats</h3></div><span className="quarter-chip">{match.status === "FULL_TIME" ? "Full time" : `Q${match.quarter || 1}`}</span></div><div className="team-stats-groups">{teamStatGroups.map(([group, fields]) => <section key={group} className="team-stats-group"><h4>{group}</h4>{fields.map(([label, key, suffix]) => <div className="team-stat-row" key={key}><strong>{match.teamStats?.home?.[key] ?? 0}{suffix ?? ""}</strong><span>{label}</span><strong>{match.teamStats?.away?.[key] ?? 0}{suffix ?? ""}</strong></div>)}</section>)}<section className="team-stats-group"><h4>Match flow</h4>{[["Time in possession", "timeInPossession"], ["Time in front", "timeInFront"], ["Last score", "lastGoal"], ["Biggest lead", "biggestLead"], ["Interchanges made", "interchangesMade"]].map(([label, key]) => <div className="team-stat-row" key={key}><strong>{match.teamStats?.home?.[key] ?? "—"}</strong><span>{label}</span><strong>{match.teamStats?.away?.[key] ?? "—"}</strong></div>)}</section></div>{match.status === "FULL_TIME" && <><h3>AFLCA Coaches Votes</h3>{match.coachesVotes?.totals?.length ? <ol>{match.coachesVotes.totals.map((vote) => <li key={vote.playerId}>{vote.playerName} ({vote.club}) · {vote.votes} votes</li>)}</ol> : <p className="helper-text">Coaches votes are recorded for home-and-away matches.</p>}</>}</section>}
          {activeTab === "REPORT" && match.matchReview && <section style={{ ...cardStyle, padding: 20 }}><span className="eyebrow">POST-MATCH REVIEW</span><h3 style={{ fontSize: 24, margin: "8px 0" }}>{match.matchReview.outcomeText}</h3><p style={{ color: palette.muted, fontSize: 16 }}>{match.matchReview.factorText}</p>{match.matchReview.tacticalSummary && <p><strong>Game plans:</strong> {match.matchReview.tacticalSummary}</p>}{match.matchReview.tacticalOutcomes?.length > 0 && <><h4>Game plan review</h4><div className="tactical-review-grid">{match.matchReview.tacticalOutcomes.map((outcome) => <article key={outcome.club} className="tactical-review-card"><strong>{outcome.club}</strong><span>Target: {outcome.focus}</span><b>{outcome.ownValue}{outcome.focus === "disposal efficiency" ? "%" : ""} <small>vs {outcome.opponentValue}{outcome.focus === "disposal efficiency" ? "%" : ""}</small></b><em>{outcome.achieved ? "Target achieved" : "Target not achieved"}</em></article>)}</div></>}{match.matchReview.bestPlayer && <p><strong>Best on ground:</strong> {match.matchReview.bestPlayer.name} ({match.matchReview.bestPlayer.club}){match.matchReview.bestPlayer.votes ? ` · ${match.matchReview.bestPlayer.votes} coaches votes` : ""}</p>}<h4>Top performances</h4><ol>{(match.matchReview.topPerformers ?? []).map((player) => <li key={`${player.club}-${player.name}`}>{player.name} ({player.club}) · impact {player.score}</li>)}</ol>{match.substitutions?.length > 0 && <><h4>Interchanges</h4><ul>{match.substitutions.map((sub, index) => <li key={`${sub.minute}-${index}`}>Q{sub.quarter} · {sub.minute}' — {sub.incoming} on for {sub.outgoing}</li>)}</ul></>}</section>}
          {activeTab === "REPORT" && adviceOutcomes.length > 0 && <section className="match-advice-history" style={{ ...cardStyle, padding: 20 }}>
            <span className="eyebrow">COACHING DECISIONS</span>
            <h3>Calls and observed outcomes</h3>
            <p className="helper-text">These are the statistics observed after each call. A change in a small sample does not prove the call caused it.</p>
            {adviceOutcomes.map(({ record, result }) => <article className="match-advice-outcome" key={record.id}>
              <div><strong>{record.title}</strong><span>{record.actionLabel} · Q{Math.min(4, Math.floor(record.appliedAtSeconds / 1200) + 1)} {Math.floor(record.appliedAtSeconds % 1200 / 60)}'</span></div>
              <b data-status={result.status}>{result.status === "tracking" ? "Tracking" : result.status === "limited" ? "Limited evidence" : result.status === "improved" ? "Improved" : result.status === "worsened" ? "Worsened" : result.status === "observed" ? "Observed" : "Mixed"}</b>
              <p>{result.detail}</p>
            </article>)}
          </section>}
          {activeTab === "TACTICS" && <section style={{ ...cardStyle, padding: 18 }}><div className="section-title"><div><span className="eyebrow">LIVE TEAM PLAN</span><h3>Adjust your match approach</h3></div><span className="quarter-chip">{TACTIC_STYLES.find((style) => style.id === match.tactics.style)?.name}</span></div><label style={{ display: "grid", gap: 7, color: palette.muted, fontWeight: 700, fontSize: 13 }}>Core style<select value={match.tactics.style} onChange={(event) => setStyle(event.target.value)} style={{ ...buttonStyle, width: "100%", padding: 11 }}>{TACTIC_STYLES.map((style) => <option key={style.id} value={style.id}>{style.name}</option>)}</select></label><div style={{ display: "grid", gap: 16, marginTop: 18 }}>{TACTIC_SLIDERS.map((slider) => <label key={slider.id} style={{ display: "grid", gridTemplateColumns: "minmax(58px, 1fr) minmax(90px, 3fr) minmax(68px, 1fr)", alignItems: "center", gap: 10 }}><span style={{ color: palette.muted, textAlign: "right", fontSize: 12 }}>{slider.left}</span><input aria-label={`${slider.left} to ${slider.right}`} type="range" min="0" max="100" value={match.tactics.sliders[slider.id]} onChange={(event) => setSlider(slider.id, event.target.value)} style={{ width: "100%", accentColor: palette.orange }} /><span style={{ color: palette.muted, fontSize: 12 }}>{slider.right} <b style={{ color: palette.text }}>{match.tactics.sliders[slider.id]}</b></span></label>)}</div><p className="helper-text">Changes affect live scoring and carry back to your club’s default tactics. Team styles also affect the tactical rating in season simulation.</p></section>}
          {activeTab === "INSTRUCTIONS" && <section style={{ ...cardStyle, padding: 18 }}><div className="section-title"><div><span className="eyebrow">PLAYER INSTRUCTIONS</span><h3>Assign individual roles</h3></div></div><p className="helper-text">Each role changes the named player’s involvement or stat chances during the live match. Effects apply only while they are on the field.</p><div className="player-list">{squad.map((player) => { const instruction = match.instructions?.[player.id] || "No instruction"; return <div key={player.id} className="player-row"><div><strong>{player.name}</strong><span>{player.positions?.join(" · ")} · OVR {player.overall ?? "—"}</span></div><div style={{ display: "grid", gap: 5, minWidth: 210 }}><select aria-label={`Instruction for ${player.name}`} value={instruction} onChange={(event) => setInstruction(player.id, event.target.value)} style={{ ...buttonStyle, maxWidth: 260 }}>{playerInstructions.map((item) => <option key={item}>{item}</option>)}</select>{instruction !== "No instruction" && <small className="helper-text" style={{ maxWidth: 300 }}>{instructionDescriptions[instruction]}</small>}</div></div>; })}</div></section>}
          {activeTab === "MATCH_TIME" && (
            <section style={{ ...cardStyle, padding: 18 }}>
              <div className="section-title"><div><span className="eyebrow">TIME ON GROUND</span><h3>Manage player minutes</h3></div><span className="quarter-chip">{togBudget.total} / {togBudget.required}% allocated</span></div>
              <p className="helper-text">There are 18 field positions across 80 minutes, giving the squad 1,800 percentage points of match time. A 75% target is 60 minutes. Adjust another player when you change a target.</p>
              <p role="status" style={{ color: togBudget.remaining === 0 ? palette.green : palette.orange, fontWeight: 700 }}>{togBudget.remaining === 0 ? "Match time balanced" : togBudget.remaining > 0 ? `Increase other players' targets by ${togBudget.remaining} percentage points.` : `Reduce other players' targets by ${-togBudget.remaining} percentage points.`}</p>
              {togBudget.remaining !== 0 && togPlayers.length >= MIN_FIELD_PLAYERS && <button type="button" onClick={balanceTOG} style={{ ...buttonStyle, marginBottom: 10 }}>Balance targets automatically</button>}
              <div style={{ display: "grid", gap: 6, marginTop: 12 }}>
                {togPlayers.map((player) => {
                  const tog = togMap[player.id] ?? 70;
                  const fitness = playerFitness?.[player.id]?.fitness ?? 100;
                  const endurance = getPlayerEndurance(player);
                  const isKP = (player.positions ?? []).some((p) => p === "KPF" || p === "KPD");
                  const isHighTOG = tog >= 85;
                  return (
                    <div key={player.id} style={{ display: "grid", gridTemplateColumns: "minmax(120px, 1.5fr) 3fr 50px", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: `1px solid ${palette.border}` }}>
                      <div>
                        <strong style={{ fontSize: 13 }}>{player.name}</strong>
                        <div style={{ fontSize: 11, color: palette.muted }}>{player.positions?.join(" / ")} · OVR {player.overall ?? "—"} · END {endurance}</div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 2 }}>
                          <span style={{ fontSize: 10, color: getFitnessColor(fitness) }}>FIT {Math.round(fitness)}%</span>
                          {isKP && tog >= 90 && <span style={{ fontSize: 10, color: palette.green }}>KP default</span>}
                        </div>
                      </div>
                      <input aria-label={`Time on ground for ${player.name}`} type="range" min="10" max="100" value={tog} onChange={(e) => setTOG(player.id, e.target.value)} style={{ width: "100%", accentColor: isHighTOG ? palette.orange : palette.green }} />
                      <div style={{ textAlign: "right" }}>
                        <strong style={{ color: isHighTOG ? palette.orange : palette.text }}>{tog}%</strong>
                        {isHighTOG && <div style={{ fontSize: 9, color: palette.orange }}>High load</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: palette.surface, fontSize: 12, color: palette.muted }}>
                <strong style={{ color: palette.text }}>How it works:</strong> Higher TOG % increases match impact and statistical output but also fatigue and injury risk. Lower TOG % preserves fitness and supports recovery. Key Position players with OVR 83+ default to 90%.
              </div>
            </section>
          )}
        </section>
        <aside className="match-sidebar">
          {assistant ? <section className="assistant-card" style={{ ...cardStyle, padding: 18 }}>
            <div className="assistant-kicker">ASSISTANT ADVICE · {assistant.metric === "matchup" ? "MATCHUP" : "LIVE STATS"}</div>
            <h3>{assistant.title}</h3><p>{assistant.evidence}</p>
            <button type="button" onClick={() => applyAssistantAdvice(assistant)} style={{ ...buttonStyle, marginTop: 12, width: "100%" }}>Apply: {assistant.actionLabel}</button>
          </section> : <section style={{ ...cardStyle, padding: 18 }}>
            <div className="assistant-kicker">ASSISTANT ADVICE</div>
            <h3>{match.status === "FULL_TIME" ? "Match complete" : "No urgent adjustment"}</h3>
            <p className="helper-text">{match.status === "FULL_TIME" ? "Review the match report and team statistics for the main performance drivers." : "No team or player statistic has crossed an adjustment threshold yet."}</p>
          </section>}
          {adviceOutcomes.length > 0 && <section className="assistant-outcomes" style={{ ...cardStyle, padding: 18 }}>
            <span className="eyebrow">YOUR CALLS</span>
            <h3>What happened next</h3>
            {adviceOutcomes.slice(-3).reverse().map(({ record, result }) => <div className="assistant-outcome" key={record.id}>
              <strong>{record.title}</strong><small>{record.actionLabel}</small>
              <p>{result.detail}</p>
            </div>)}
          </section>}
          <section style={{ ...cardStyle, padding: 18 }}>
            <span className="eyebrow">QUICK COMMANDS</span><h3>Make a call</h3>
            <div className="quick-commands"><button type="button" onClick={() => setStyle("FAST_TRANSITION")}>Fast transition</button><button type="button" onClick={() => setStyle("DEFENCE_FIRST")}>Protect the lead</button><button type="button" onClick={() => setStyle("TERRITORY_FOOTBALL")}>Push territory</button><button type="button" onClick={() => setSlider("pressureStructure", 20)}>Raise pressure</button></div>
          </section>
        </aside>
      </div>
    </main>
  );
}