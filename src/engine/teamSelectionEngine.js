import { canPlayInSlot, positionGroups } from "../data/positionGroups.js";
import { createTeamSelectionState } from "../state/createTeamSelectionState.js";
import { getSlotSuitability } from "./positionSuitability.js";

export function getTeamSelectionStatus(selection, players = [], playerFitness = {}) {
  const slots = Object.entries(positionGroups);
  const selectedSide = selection?.selectedSide ?? {};
  const selectedNames = slots.map(([slot]) => selectedSide[slot]);
  const filled = selectedNames.filter(Boolean).length;
  const uniqueNames = new Set(selectedNames.filter(Boolean));
  const playersByName = new Map(players.map((player) => [player.name, player]));
  const injuredSelected = [...new Set(selectedNames.filter(Boolean))].filter((name) => {
    const player = playersByName.get(name);
    const injury = playerFitness?.[player?.id]?.injury;
    return (injury && Number(injury.weeksRemaining ?? 0) > 0) || Number(playerFitness?.[player?.id]?.suspension?.matchesRemaining ?? 0) > 0;
  });
  const positionsValid = slots.every(([slot]) => {
    const name = selectedSide[slot];
    if (!name) return false;
    const player = playersByName.get(name);
    if (!player) return false;
    const injury = playerFitness?.[player.id]?.injury;
    if (injury && Number(injury.weeksRemaining ?? 0) > 0) return false;
    if (Number(playerFitness?.[player.id]?.suspension?.matchesRemaining ?? 0) > 0) return false;
    return true;
  });

  return {
    complete: slots.length === 23 && filled === slots.length && uniqueNames.size === slots.length && positionsValid,
    filled,
    required: slots.length,
    injuredSelected,
  };
}

export function getTeamSheetRoundKey(seasonState = {}) {
  const year = seasonState.seasonYear ?? 2027;
  if (seasonState.calendarSelectionFixtureId && !["OFFSEASON", "POST_SEASON"].includes(seasonState.phase)) return seasonState.calendarSelectionFixtureId;
  if (seasonState.phase === "WILDCARD") return `${year}:WILDCARD`;
  if (seasonState.phase === "FINALS") return `${year}:FINALS:${(seasonState.finalsWeek ?? 0) + 1}`;
  if (seasonState.phase === "POST_SEASON") return `${year}:POST_SEASON`;
  return `${year}:ROUND:${seasonState.round ?? 1}`;
}

export function getTeamSheetRoundLabel(seasonState = {}) {
  const phase = seasonState.phase ?? "HOME_AND_AWAY";
  if (phase === "WILDCARD") return "WILDCARD FINALS";
  if (phase === "FINALS") {
    const labels = ["FINALS WEEK 1", "FINALS WEEK 2", "PRELIMINARY FINALS", "GRAND FINAL"];
    return `FINALS · ${labels[seasonState.finalsWeek ?? 0] ?? "FINALS"}`;
  }
  if (phase === "POST_SEASON") return "POST-SEASON";
  const total = seasonState.fixture?.length ?? 23;
  return `ROUND ${String(seasonState.round ?? 1).padStart(2, "0")} OF ${total}`;
}

export function createTeamSheetHistoryEntry(selection, seasonState = {}, clubName) {
  const roundKey = getTeamSheetRoundKey(seasonState);
  const phase = seasonState.phase ?? "HOME_AND_AWAY";
  const round = Number(seasonState.round ?? 1);
  const fixtureRound = phase === "HOME_AND_AWAY"
    ? (seasonState.fixture ?? []).find((entry) => Number(entry.round) === round)
    : null;
  const fixtureMatch = fixtureRound?.matches?.find((match) =>
    (match.homeTeam ?? match.home) === clubName || (match.awayTeam ?? match.away) === clubName,
  );
  const homeTeam = fixtureMatch?.homeTeam ?? fixtureMatch?.home;
  const awayTeam = fixtureMatch?.awayTeam ?? fixtureMatch?.away;
  const opponent = fixtureMatch && (homeTeam === clubName ? awayTeam : homeTeam);

  return {
    roundKey,
    seasonYear: Number(seasonState.seasonYear ?? 2027),
    roundLabel: getTeamSheetRoundLabel(seasonState),
    opponent: opponent ?? null,
    venue: fixtureMatch?.venue ?? null,
    homeAway: fixtureMatch ? (homeTeam === clubName ? "HOME" : "AWAY") : null,
    selectedSide: { ...(selection?.selectedSide ?? {}) },
    emergencies: [...(selection?.emergencies ?? [])],
    captain: selection?.captain ?? null,
    captainId: selection?.captainId ?? null,
    viceCaptain: selection?.viceCaptain ?? null,
    viceCaptainId: selection?.viceCaptainId ?? null,
    confirmedAt: new Date().toISOString(),
  };
}

export function appendTeamSheetHistory(selection, entry) {
  const history = selection?.selectionHistory ?? [];
  return {
    ...selection,
    selectionHistory: [...history.filter((item) => item.roundKey !== entry.roundKey), entry],
  };
}

export function createAssistantTeamSelection(players = [], previousSelection, getScore = (player) => player.overall ?? 0) {
  const available = [...players];
  const selectedSide = {};

  for (const [slot] of Object.entries(positionGroups)) {
    const naturalCandidates = available.filter((player) => canPlayInSlot(player, slot));
    const candidates = (naturalCandidates.length ? naturalCandidates : available)
      .sort((a, b) => getSlotSuitability(b, slot).overall - getSlotSuitability(a, slot).overall
        || getScore(b) - getScore(a));
    const selected = candidates[0];
    selectedSide[slot] = selected?.name ?? null;
    if (selected) available.splice(available.indexOf(selected), 1);
  }

  return {
    ...createTeamSelectionState(),
    ...previousSelection,
    selectionResponsibility: "ASSISTANT",
    selectedSide,
  };
}