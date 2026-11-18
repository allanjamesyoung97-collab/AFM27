import { useEffect, useMemo, useState } from "react";
import { players } from "../data/players.js";
import "./SquadScreen.css";
import PlayerProfile from "./PlayerProfile.jsx";
import SquadTraitsPage from "./SquadTraitsPage.jsx";
import ClubAdministrationScreen from "./ClubAdministrationScreen.jsx";
import {selectionStrategies} from "../data/selectionStrategies";
import {positionGroups} from "../data/positionGroups";
import { getCareerPlayer } from "../engine/developmentEngine.js";
import { getFitnessColor, getAvailablePlayers } from "../engine/fitnessEngine.js";
import PotentialStars from "./PotentialStars.jsx";
import { formatContractDuration } from "../engine/contractEngine.js";
import { appendTeamSheetHistory, createTeamSheetHistoryEntry, getTeamSelectionStatus, getTeamSheetRoundKey, getTeamSheetRoundLabel } from "../engine/teamSelectionEngine.js";
import { getSlotSuitability } from "../engine/positionSuitability.js";
import { selectTeamPreset } from "../engine/selectionPresetEngine.js";
import { getFinalsMatchups, getWildcardMatchups } from "../engine/finalsEngine.js";
import { LEADERSHIP_LIMITS, activeLeadershipGroup, autoLeadershipGroup, leadershipGroupQuality, leadershipMatchEffect, leadershipSeason, rankLeadershipCandidates } from "../engine/leadershipGroupEngine.js";

export default function SquadScreen({ club, appearance, seasonState, currentDate, playerFitness = {}, teamSelection, onTeamSelectionChange, onSeasonStateChange, focusTeamSelection = false, initialTab, navigationSequence = 0, onTeamSelectionFocused, players: playerPool = players, onPlayerContractsChange, onPlayerDevelopmentChange, onAdministrationStateChange }) {
  const documentAppearance = typeof document !== "undefined"
    ? document.documentElement.dataset.appearance
    : undefined;
  const resolvedAppearance = appearance ?? documentAppearance ?? "dark";
  const theme = resolvedAppearance === "light"
    ? { text: "#172033", muted: "#64748b", panel: "#ffffff", border: "#d7deea", surface: "#eef2f8", input: "#ffffff" }
    : { text: "#f8fafc", muted: "#94a3b8", panel: "#0f172a", border: "#334155", surface: "#1e293b", input: "#0f172a" };
  const squadPlayers = useMemo(() => {
    const careerPlayers = playerPool.map((player) => getCareerPlayer(
      player,
      seasonState?.playerDevelopment,
      seasonState?.seasonYear ?? 2027,
      seasonState?.playerContracts,
    ));
    return club ? careerPlayers.filter((player) => player.club === club.name) : careerPlayers;
  }, [playerPool, club?.name, seasonState?.playerDevelopment, seasonState?.playerContracts, seasonState?.seasonYear]);

  const getCurrentFitness = (player) => Math.round(playerFitness?.[player.id]?.fitness ?? 100);
  const unavailableReason = (player) => {
    const state = playerFitness?.[player.id] ?? {};
    if (Number(state.suspension?.matchesRemaining ?? 0) > 0) return `SUSPENDED · ${state.suspension.matchesRemaining} match${state.suspension.matchesRemaining === 1 ? "" : "es"}`;
    if (Number(state.injury?.weeksRemaining ?? 0) > 0) return `OUT INJURED · ${state.injury.weeksRemaining}w`;
    return "";
  };
  const isPlayerInjured = (player) => Boolean(unavailableReason(player));

  const [selectedPlayer, setSelectedPlayer] =
    useState(null);

  const [searchTerm, setSearchTerm] =
    useState("");

  const [playerPoolCollapsed, setPlayerPoolCollapsed] =
  useState(false);

  const [positionFilter, setPositionFilter] =
    useState("ALL");

  const [viewMode, setViewMode] =
    useState("ALL");
  const [listSubpage, setListSubpage] = useState("PLAYERS");
    const squadTabs = ["LIST", "SELECTION", "CONTRACTS", "LEADERSHIP", "HISTORY"];
    const leadershipGroup = activeLeadershipGroup(seasonState);
    const leadershipCandidates = useMemo(() => rankLeadershipCandidates(squadPlayers, seasonState?.playerContracts), [squadPlayers, seasonState?.playerContracts]);
    const leadershipQuality = leadershipGroupQuality(leadershipGroup, squadPlayers, seasonState?.playerContracts);
    const leadershipPhase = String(seasonState?.phase ?? "").trim().toUpperCase();
    const leadershipEditable = ["OFFSEASON", "POST_SEASON", "PRESEASON"].includes(leadershipPhase);
    const leaderName = (id) => squadPlayers.find((player) => String(player.id) === String(id))?.name ?? "Unknown player";
    // Match-day effect of the current group against the side named on the team sheet.
    const namedSideIds = new Set(Object.values(teamSelection?.selectedSide ?? {}).filter(Boolean)
      .map((name) => squadPlayers.find((player) => player.name === name)?.id).filter((id) => id != null).map(String));
    const leadershipMatchRating = leadershipMatchEffect(leadershipGroup, squadPlayers, seasonState?.playerContracts, namedSideIds);
    function saveLeadershipGroup(next) {
      const group = {
        seasonYear: leadershipSeason(seasonState),
        captains: (next.captains ?? []).slice(0, LEADERSHIP_LIMITS.captains),
        viceCaptains: (next.viceCaptains ?? []).slice(0, LEADERSHIP_LIMITS.viceCaptains),
      };
      if (!onSeasonStateChange) return;
      onSeasonStateChange((previous) => {
        const previousGroup = previous.leadershipGroup;
        const history = previousGroup?.seasonYear
          && Number(previousGroup.seasonYear) !== Number(group.seasonYear)
          ? { ...(previous.leadershipGroupHistory ?? {}), [previousGroup.seasonYear]: previousGroup }
          : previous.leadershipGroupHistory;
        return { ...previous, leadershipGroup: group, leadershipGroupHistory: history };
      });
      // The team sheet keeps the leaders' ids as well as their names, so a rename or a duplicate name cannot break the link.
      const captainId = group.captains[0] ?? null;
      const viceCaptainId = group.viceCaptains[0] ?? null;
      onTeamSelectionChange?.((previous) => ({ ...previous,
        captain: captainId != null ? leaderName(captainId) : null,
        captainId,
        viceCaptain: viceCaptainId != null ? leaderName(viceCaptainId) : null,
        viceCaptainId,
      }));
    }
    function toggleLeader(id, role) {
      if (!leadershipEditable) return;
      const key = role === "CAPTAIN" ? "captains" : "viceCaptains";
      const other = key === "captains" ? "viceCaptains" : "captains";
      const current = leadershipGroup[key] ?? [];
      const selected = current.some((value) => String(value) === String(id));
      const next = selected
        ? current.filter((value) => String(value) !== String(id))
        : [...current, id].slice(-LEADERSHIP_LIMITS[key]);
      // One group is computed and saved once, so the saved group and the team sheet cannot disagree.
      saveLeadershipGroup({
        captains: key === "captains" ? next : (leadershipGroup.captains ?? []).filter((value) => String(value) !== String(id)),
        viceCaptains: key === "viceCaptains" ? next : (leadershipGroup.viceCaptains ?? []).filter((value) => String(value) !== String(id)),
      });
    }

    const [activeTab,
      setActiveTab] =
      useState(() => focusTeamSelection ? "SELECTION" : initialTab ?? "LIST");
    useEffect(() => {
      if (initialTab === "LIST_TRAITS") {
        setActiveTab("LIST");
        setListSubpage("TRAITS");
      } else if (initialTab) {
        setActiveTab(initialTab === "NEGOTIATION" ? "CONTRACTS" : initialTab);
        if (initialTab === "LIST") setListSubpage("PLAYERS");
      }
    }, [navigationSequence, initialTab]);
    const [historyRoundKey, setHistoryRoundKey] = useState(null);

    const setTeamSelection = onTeamSelectionChange;

    const [
      selectionStrategy,
      setSelectionStrategy
    ] = useState(
      "BEST_AVAILABLE"
    );

    const [draggedPlayerId, setDraggedPlayerId] = useState(null);
    const [dragOverPosition, setDragOverPosition] = useState(null);
    const [manualPlacementPlayerId, setManualPlacementPlayerId] = useState(null);
    const [manualPlacementMessage, setManualPlacementMessage] = useState("");
    const [selectedSwapSlot, setSelectedSwapSlot] = useState(null);

    const morale = Math.max(0, Math.min(100, Number(seasonState?.clubMorale?.[club?.name] ?? 50)));
    const playerCultureSignals = squadPlayers.map((player) => {
      const development = seasonState?.playerDevelopment?.[String(player.id)] ?? {};
      const happiness = Number(development.happiness ?? development.morale);
      return Number.isFinite(happiness) ? Math.max(0, Math.min(100, happiness)) : null;
    }).filter(Number.isFinite);
    const staff = seasonState?.clubAdministration?.staff ?? [];
    const staffLeadership = staff.map((person) => Number(person.rating)).filter(Number.isFinite);
    const playerCulture = playerCultureSignals.length
      ? playerCultureSignals.reduce((sum, value) => sum + value, 0) / playerCultureSignals.length
      : morale;
    const leadershipSupport = staffLeadership.length
      ? staffLeadership.reduce((sum, value) => sum + value, 0) / staffLeadership.length
      : 50;
    const culture = Math.round(Math.max(0, Math.min(100, playerCulture * 0.6 + morale * 0.2 + leadershipSupport * 0.1 + leadershipQuality * 0.1)));
    
    function getMoraleStatus(
      morale
    ) {
      if (morale < 20) return "Extremely upset";
      if (morale < 40) return "Upset";
      if (morale < 60) return "Content";
      if (morale < 80) return "Happy";
      return "Very happy";
    }
    
    function getCultureStatus(
      culture
    ) {
        if (culture >= 90)
          return "Elite";
    
        if (culture >= 80)
          return "Strong";
    
        if (culture >= 70)
          return "Positive";
    
        if (culture >= 60)
          return "Developing";
    
        if (culture >= 50)
          return "Average";
    
        return "Weak";
    }

  const cardStyle = {
    background: theme.panel,
    border: `1px solid ${theme.border}`,
    borderRadius: "16px",
    padding: "20px"
  };

  const tabStyle = (
    currentTab
  ) => ({
    padding: "10px 14px",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    background:
      activeTab === currentTab
        ? "#ea580c"
        : theme.surface,
    color: activeTab === currentTab ? "white" : theme.text,
    fontWeight: "bold"
  });

  const filters = [
    "ALL",
    "MID",
    "HF",
    "FF",
    "WING",
    "HB",
    "BP",
    "KPF",
    "KPD",
    "RUC"
  ];

  const getOverallColour = (
    overall
  ) => {
    if (overall >= 90)
      return "#22c55e";

    if (overall >= 80)
      return "#3b82f6";

    if (overall >= 70)
      return "#f59e0b";

    return "#ef4444";
  };

  const getDevelopmentStatus =
    player => {
      const overall =
        player.overall ?? 0;

      const potential =
        player.development
          ?.potential ?? overall;

      const gap =
        potential - overall;

      if (gap >= 10) {
        return {
          text: "▲ High Growth",
          color: "#22c55e"
        };
      }

      if (gap >= 5) {
        return {
          text: "▲ Developing",
          color: "#3b82f6"
        };
      }

      if (player.age >= 31) {
        return {
          text: "▼ Veteran",
          color: "#f59e0b"
        };
      }

      return {
        text: "▬ Established",
        color: "#94a3b8"
      };
    };

  const filteredPlayers =
    useMemo(() => {
      let result = [...squadPlayers];

      if (searchTerm) {
        result = result.filter(
          player =>
            player.name
              .toLowerCase()
              .includes(
                searchTerm.toLowerCase()
              )
        );
      }

      if (
        positionFilter !==
        "ALL"
      ) {
        result = result.filter(
          player =>
            player.positions?.includes(
              positionFilter
            )
        );
      }

      if (
        viewMode ===
        "BEST22"
      ) {
        result = result.filter(
          player =>
            (player.overall ?? 0) >=
            78
        );
      }

      if (
        viewMode ===
        "CONTRACTS"
      ) {
        result = result.filter(
          player =>
            (
              player.contract
                ?.yearsRemaining ??
              99
            ) <= 1
        );
      }

      return result.sort(
        (a, b) =>
          (b.overall ?? 0) -
          (a.overall ?? 0)
      );
    }, [
      searchTerm,
      positionFilter,
      viewMode,
      squadPlayers
    ]);

  const averageOverall =
    Math.round(
      squadPlayers.reduce(
        (sum, player) =>
          sum +
          (player.overall ?? 0),
        0
      ) / squadPlayers.length
    );

  const elitePlayers =
    squadPlayers.filter(
      player =>
        (player.overall ?? 0) >= 85
    ).length;
    function autoSelectTeam() {
      if (teamSheetLocked) return;
      const opponentName = currentRoundMatch
        ? (managerIsHome ? currentRoundMatch.awayTeam ?? currentRoundMatch.away : currentRoundMatch.homeTeam ?? currentRoundMatch.home)
        : null;
      const opponentPlayers = opponentName
        ? playerPool.filter((player) => player.club === opponentName).map((player) => getCareerPlayer(
            player, seasonState?.playerDevelopment, seasonState?.seasonYear ?? 2027, seasonState?.playerContracts,
          ))
        : [];
      const { selectedSide } = selectTeamPreset({
        players: squadPlayers,
        strategy: selectionStrategy,
        playerFitness,
        opponentPlayers,
      });
      setTeamSelection((previous) => ({ ...previous, selectedSide, confirmedForRound: null }));
      setSelectedSwapSlot(null);
    }

    function clearSelections() {
      if (teamSheetLocked) return;
      setTeamSelection(previous => ({
        ...previous,
        confirmedForRound: null,
        selectedSide: Object.fromEntries(
          Object.keys(previous.selectedSide).map(position => [position, null])
        )
      }));
      setDraggedPlayerId(null);
      setDragOverPosition(null);
      setSelectedSwapSlot(null);
    }

    function saveCustomSelection(slotIndex) {
      if (teamSheetLocked) return;
      const savedSelection = {
        selectedSide: { ...teamSelection.selectedSide },
        emergencies: [...(teamSelection.emergencies ?? [null, null, null])],
        captain: teamSelection.captain ?? null,
        captainId: teamSelection.captainId ?? null,
        viceCaptain: teamSelection.viceCaptain ?? null,
        viceCaptainId: teamSelection.viceCaptainId ?? null,
      };
      setTeamSelection(previous => {
        const customSelections = [...(previous.customSelections ?? [null, null])];
        customSelections[slotIndex] = savedSelection;
        return { ...previous, customSelections };
      });
    }

    function loadCustomSelection(slotIndex) {
      if (teamSheetLocked) return;
      const savedSelection = teamSelection.customSelections?.[slotIndex];
      if (!savedSelection) return;

      const { selectedSide } = selectTeamPreset({
        players: squadPlayers,
        strategy: "BEST_AVAILABLE",
        playerFitness,
        lockedSide: savedSelection.selectedSide,
      });
      const selectedNames = new Set(Object.values(selectedSide).filter(Boolean));
      const availableNames = new Set(getAvailablePlayers(squadPlayers, playerFitness).map((player) => player.name));
      const emergencies = [...new Set((savedSelection.emergencies ?? [])
        .filter((name) => name && availableNames.has(name) && !selectedNames.has(name)))].slice(0, 3);
      const captain = selectedNames.has(savedSelection.captain) ? savedSelection.captain : null;
      const viceCaptain = selectedNames.has(savedSelection.viceCaptain) ? savedSelection.viceCaptain : null;
      setTeamSelection(previous => ({
        ...previous,
        selectedSide,
        emergencies: [...emergencies, ...Array(Math.max(0, 3 - emergencies.length)).fill(null)],
        captain,
        captainId: captain ? savedSelection.captainId ?? null : null,
        viceCaptain,
        viceCaptainId: viceCaptain ? savedSelection.viceCaptainId ?? null : null,
        confirmedForRound: null,
      }));
      setSelectedSwapSlot(null);
    }

  const contractRisks =
    squadPlayers.filter(
      player =>
        (
          player.contract
            ?.yearsRemaining ??
          99
        ) <= 1
    ).length;
  const selectedPlayerNames = Object.values(teamSelection.selectedSide).filter(Boolean);
  const teamSheetStatus = getTeamSelectionStatus(teamSelection, squadPlayers, playerFitness);
  const currentRound = seasonState?.round ?? 1;
  const currentRoundKey = getTeamSheetRoundKey(seasonState);
  const teamSheetLocked = teamSelection.confirmedForRound === currentRoundKey && teamSheetStatus.complete;
  const currentRoundLabel = getTeamSheetRoundLabel(seasonState);
  const phaseMatches = seasonState?.phase === "WILDCARD"
    ? getWildcardMatchups(seasonState?.ladder ?? [], seasonState?.fixture ?? [])
    : seasonState?.phase === "FINALS"
      ? getFinalsMatchups({
          ladder: seasonState?.ladder ?? [],
          fixture: seasonState?.fixture ?? [],
          wildcardSeeds: seasonState?.wildcardSeeds,
          finalsWeek: seasonState?.finalsWeek ?? 0,
          finalsHistory: seasonState?.finalsHistory ?? [],
        })
      : seasonState?.fixture?.find((roundData) => Number(roundData.round) === Number(currentRound))?.matches ?? [];
  const currentRoundMatch = phaseMatches.find((match) =>
    (match.homeTeam ?? match.home) === club?.name || (match.awayTeam ?? match.away) === club?.name);
  const managerIsHome = currentRoundMatch ? (currentRoundMatch.homeTeam ?? currentRoundMatch.home) === club?.name : true;
  const teamSelectionHistory = [...(teamSelection.selectionHistory ?? [])];
  if (teamSelection.confirmedForRound === currentRoundKey && !teamSelectionHistory.some((entry) => entry.roundKey === teamSelection.confirmedForRound)) {
    teamSelectionHistory.push(createTeamSheetHistoryEntry(teamSelection, seasonState, club?.name));
  }
  const selectedHistoryEntry = teamSelectionHistory.find((entry) => entry.roundKey === historyRoundKey)
    ?? teamSelectionHistory[teamSelectionHistory.length - 1]
    ?? null;
  const selectedHistoryIndex = selectedHistoryEntry ? teamSelectionHistory.findIndex((entry) => entry.roundKey === selectedHistoryEntry.roundKey) : -1;
  const previousHistoryEntry = selectedHistoryIndex > 0 ? teamSelectionHistory[selectedHistoryIndex - 1] : null;
  const currentHistoryNames = new Set(Object.values(selectedHistoryEntry?.selectedSide ?? {}).filter(Boolean));
  const previousHistoryNames = new Set(Object.values(previousHistoryEntry?.selectedSide ?? {}).filter(Boolean));
  const selectedHistoryIn = selectedHistoryEntry
    ? Object.entries(selectedHistoryEntry.selectedSide ?? {}).filter(([, name]) => name && !previousHistoryNames.has(name))
    : [];
  const selectedHistoryOut = previousHistoryEntry
    ? Object.entries(previousHistoryEntry.selectedSide ?? {}).filter(([, name]) => name && !currentHistoryNames.has(name))
    : [];
  const availableSelectionPlayers = squadPlayers
    .slice()
    .sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0));

  function assignPlayerToPosition(playerId, position) {
    if (teamSheetLocked) return;
    const player = squadPlayers.find(candidate => candidate.id === playerId);

    if (!player || isPlayerInjured(player)) {
      if (player && isPlayerInjured(player)) setManualPlacementMessage(`${player.name} is unavailable for selection: ${unavailableReason(player)}.`);
      return;
    }

    setTeamSelection(previous => {
      const selectedSide = Object.fromEntries(
        Object.entries(previous.selectedSide).map(([slot, name]) => [
          slot,
          name === player.name ? null : name
        ])
      );
      selectedSide[position] = player.name;

      return {
        ...previous,
        selectedSide,
        confirmedForRound: null,
      };
    });
    setDraggedPlayerId(null);
    setDragOverPosition(null);
    setManualPlacementPlayerId(null);
    setSelectedSwapSlot(null);
    setManualPlacementMessage("");
  }

  function handlePositionClick(position) {
    if (teamSheetLocked) return;
    if (manualPlacementPlayerId != null) {
      assignPlayerToPosition(manualPlacementPlayerId, position);
      return;
    }
    if (!selectedSwapSlot) {
      if (teamSelection.selectedSide[position]) setSelectedSwapSlot(position);
      return;
    }
    if (selectedSwapSlot === position) {
      setSelectedSwapSlot(null);
      return;
    }
    setTeamSelection(previous => {
      const source = previous.selectedSide?.[selectedSwapSlot];
      if (!source) return previous;
      return {
        ...previous,
        selectedSide: {
          ...previous.selectedSide,
          [selectedSwapSlot]: previous.selectedSide[position] ?? null,
          [position]: source,
        },
        confirmedForRound: null,
      };
    });
    setSelectedSwapSlot(null);
  }

    function selectPlayerFromList(player) {
    const preferredPositions = player.positions ?? [];
    const openPosition = preferredPositions
      .map((preferredPosition) => Object.entries(positionGroups).find(([position, validPositions]) =>
        !teamSelection.selectedSide[position] && validPositions.includes(preferredPosition)
      )?.[0])
      .find(Boolean);

    const openInterchange = Object.keys(teamSelection.selectedSide).find(position =>
      position.startsWith("INT") && !teamSelection.selectedSide[position]
    );

    assignPlayerToPosition(player.id, openPosition ?? openInterchange ?? "INT1");
  }

  function startManualPlacement(player) {
    if (teamSheetLocked || isPlayerInjured(player)) return;
    setManualPlacementMessage("");
    setManualPlacementPlayerId((currentId) => currentId === player.id ? null : player.id);
  }

  function removePlayerFromPosition(position) {
    if (teamSheetLocked) return;
    setSelectedSwapSlot(null);
    setTeamSelection(previous => ({
      ...previous,
      confirmedForRound: null,
      selectedSide: {
        ...previous.selectedSide,
        [position]: null
      }
    }));
  }

  function handlePlayerDragStart(event, playerId) {
    if (teamSheetLocked) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(playerId));
    setDraggedPlayerId(playerId);
  }

  function handlePlayerPointerDown(event, playerId) {
    if (teamSheetLocked || event.button !== 0) return;
    if (event.target.closest("button, input, select, textarea")) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDraggedPlayerId(playerId);
  }

  function handlePlayerPointerUp(event, playerId) {
    if (draggedPlayerId == null) return;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest(".team-position-slot");
    const position = target?.dataset?.position;
    if (position) assignPlayerToPosition(playerId, position);
    else {
      setDraggedPlayerId(null);
      setDragOverPosition(null);
    }
  }

  function handleFieldPointerMove(event) {
    if (draggedPlayerId == null) return;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest(".team-position-slot");
    setDragOverPosition(target?.dataset?.position ?? null);
  }

  function handlePositionDrop(event, position) {
    event.preventDefault();
    if (teamSheetLocked) return;
    const playerId = Number(event.dataTransfer.getData("text/plain"));
    assignPlayerToPosition(playerId, position);
  }

  function playerForPosition(position) {
    const playerName = teamSelection.selectedSide[position];
    return squadPlayers.find(player => player.name === playerName);
  }

  function renderPositionSlot(position, label) {
    const player = playerForPosition(position);
    const injured = player ? isPlayerInjured(player) : false;
    const isDragOver = dragOverPosition === position;
    const isManualPlacementTarget = manualPlacementPlayerId != null;
    const isSwapTarget = selectedSwapSlot != null && selectedSwapSlot !== position;
    // Preview: what the player currently "in hand" would rate if placed on this tile.
    const heldPlayer = selectedSwapSlot != null
      ? playerForPosition(selectedSwapSlot)
      : manualPlacementPlayerId != null
        ? squadPlayers.find(candidate => candidate.id === manualPlacementPlayerId)
        : null;
    const heldPreview = heldPlayer && selectedSwapSlot !== position ? getSlotSuitability(heldPlayer, position) : null;

    return (
      <div
        data-position={position}
        onPointerMove={handleFieldPointerMove}
        onDragOver={event => {
          if (teamSheetLocked) return;
          event.preventDefault();
          setDragOverPosition(position);
        }}
        onDragLeave={() => setDragOverPosition(null)}
        onDrop={event => handlePositionDrop(event, position)}
        onClick={() => handlePositionClick(position)}
        onKeyDown={event => {
          if (event.target !== event.currentTarget) return;
          if (event.key === "Escape") { setSelectedSwapSlot(null); setManualPlacementPlayerId(null); }
          if (event.key === "Enter" || event.key === " ") { event.preventDefault(); handlePositionClick(position); }
        }}
        className={`team-position-slot ${isDragOver ? "is-drag-over" : ""} ${isManualPlacementTarget ? "is-manual-placement-target" : ""} ${selectedSwapSlot === position ? "is-swap-source" : ""} ${isSwapTarget ? "is-swap-target" : ""}`}
        role="button"
        tabIndex={teamSheetLocked ? -1 : 0}
        aria-label={`${label}: ${player?.name ?? "empty"}${selectedSwapSlot ? "; choose to swap or move" : "; select to move"}`}
        aria-pressed={selectedSwapSlot === position}
        aria-disabled={teamSheetLocked}
      >
        <span className="team-position-label">{label}</span>
        {heldPreview && (
          <span
            className={`team-slot-preview is-${heldPreview.fit}`}
            title={`${heldPlayer.name} at ${label}: ${heldPreview.overall} (${heldPreview.fit} fit)`}
            aria-label={`${heldPlayer.name} would rate ${heldPreview.overall} here`}
          >
            {heldPreview.overall}
          </span>
        )}
        {player ? (
          <div className={`team-player-card ${injured ? "is-injured" : ""}`}>
            {injured && <span className="team-player-injury-icon" title={unavailableReason(player)} aria-label={unavailableReason(player)}>✚</span>}
            <button
              className="remove-player-button"
              type="button"
              aria-label={`Remove ${player.name}`}
              disabled={teamSheetLocked}
              onClick={event => {
                event.stopPropagation();
                removePlayerFromPosition(position);
              }}
            >
              ×
            </button>
            <span className="team-player-first-name">{player.name.split(" ")[0]}</span>
            <strong>{player.name.split(" ").slice(1).join(" ")}</strong>
            <span className="team-player-rating" title={`${getSlotSuitability(player, position).fit} fit · listed OVR ${player.overall ?? 0}`}>{getSlotSuitability(player, position).overall}</span>
            <div className="team-player-fitness" aria-label={`Fitness ${getCurrentFitness(player)}`}>
              <span style={{ width: `${getCurrentFitness(player)}%`, background: getFitnessColor(getCurrentFitness(player)) }} />
              <strong>{getCurrentFitness(player)}</strong>
            </div>
          </div>
        ) : (
          <div className="empty-team-player">{selectedSwapSlot || manualPlacementPlayerId != null ? "Move player here" : "Empty position"}</div>
        )}
      </div>
    );
  }

  // MUST BE AFTER ALL HOOKS
  if (selectedPlayer) {
    return (
      <PlayerProfile
        player={selectedPlayer}
        playerFitness={playerFitness}
        appearance={resolvedAppearance}
        seasonState={seasonState}
        currentDate={currentDate}
        onTraitsChange={(activeTraits) => {
          setSelectedPlayer((current) => current?.id === selectedPlayer.id ? { ...current, activeTraits } : current);
          onPlayerDevelopmentChange?.(selectedPlayer.id, activeTraits);
        }}
        onBack={() =>
          setSelectedPlayer(null)
        }
      />
    );
  }

  return (
    <main
      className={`squad-screen ${resolvedAppearance === "light" ? "theme-light" : "theme-dark"}`}
      style={{
        color: theme.text,
        "--squad-text": theme.text,
        "--squad-muted": theme.muted,
        "--squad-panel": theme.panel,
        "--squad-border": theme.border,
        "--squad-surface": theme.surface,
        "--squad-input": theme.input
      }}
    >
      <h2>{club ? `${club.name} Squad` : "Squad"}</h2>
     
<div
style={{
display: "flex",
gap: "10px",
flexWrap: "wrap",
marginBottom: "20px"
}}
>
  {squadTabs.map(
    currentTab => (
      <button
        key={currentTab}
        style={tabStyle(
          currentTab
        )}
        onClick={() => {
          setActiveTab(currentTab);
          if (currentTab === "SELECTION") onTeamSelectionFocused?.();
        }}
      >
        {{ LIST: "PLAYER LIST", SELECTION: "TEAM SELECTION", CONTRACTS: "CONTRACTS", LEADERSHIP: "LEADERSHIP GROUP", HISTORY: "TEAM SELECTION HISTORY" }[currentTab]}
      </button>
    )
  )}
</div>

{activeTab === "LIST" && (
  <>
    <nav aria-label="Player list pages" style={{ display: "flex", gap: 8, marginBottom: 16 }}>
      {[["PLAYERS", "Players"], ["TRAITS", "Traits"]].map(([key, label]) => <button key={key} type="button" aria-current={listSubpage === key ? "page" : undefined} onClick={() => setListSubpage(key)} style={{ padding: "9px 15px", borderRadius: 9, border: `1px solid ${listSubpage === key ? "#ea580c" : theme.border}`, background: listSubpage === key ? "#ea580c" : theme.surface, color: listSubpage === key ? "#fff" : theme.text, fontWeight: 750, cursor: "pointer" }}>{label}</button>)}
    </nav>
    {listSubpage === "TRAITS" ? <SquadTraitsPage players={squadPlayers} theme={theme} onOpenPlayer={setSelectedPlayer} /> : <>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", marginBottom: "20px" }}>
      {[
        ["Squad Size", squadPlayers.length],
        ["Average Overall", averageOverall],
        ["Elite Players", elitePlayers],
        ["Contract Risks (≤1 year)", contractRisks],
        ["Club Morale", getMoraleStatus(morale)],
        ["Club Culture", `${culture} · ${getCultureStatus(culture)}`]
      ].map(([label, value]) => (
        <div key={label} style={cardStyle}>
          <div style={{ color: theme.muted, marginBottom: "8px" }}>{label}</div>
          <strong style={{ fontSize: "1.5rem" }}>{value}</strong>
        </div>
      ))}
    </div>

    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "16px" }}>
      <button type="button" onClick={() => setViewMode("ALL")} style={{ background: viewMode === "ALL" ? "#ea580c" : theme.surface, color: viewMode === "ALL" ? "white" : theme.text, border: `1px solid ${theme.border}`, borderRadius: 8, padding: "9px 12px" }}>Full List</button>
      <button type="button" onClick={() => setViewMode("BEST22")} style={{ background: viewMode === "BEST22" ? "#ea580c" : theme.surface, color: viewMode === "BEST22" ? "white" : theme.text, border: `1px solid ${theme.border}`, borderRadius: 8, padding: "9px 12px" }}>Best 22</button>
      <button type="button" onClick={() => setViewMode("CONTRACTS")} style={{ background: viewMode === "CONTRACTS" ? "#ea580c" : theme.surface, color: viewMode === "CONTRACTS" ? "white" : theme.text, border: `1px solid ${theme.border}`, borderRadius: 8, padding: "9px 12px" }}>Contract Watch</button>
    </div>

    <input
      type="text"
      placeholder="Search players..."
      value={searchTerm}
      onChange={(event) => setSearchTerm(event.target.value)}
      style={{ width: "100%", padding: "12px", marginBottom: "16px", borderRadius: "12px", border: `1px solid ${theme.border}`, background: theme.input, color: theme.text }}
    />

    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "20px" }}>
      {filters.map((filter) => (
        <button
          key={filter}
          type="button"
          onClick={() => setPositionFilter(filter)}
          style={{ padding: "8px 12px", borderRadius: "8px", border: `1px solid ${theme.border}`, cursor: "pointer", background: positionFilter === filter ? "#ea580c" : theme.surface, color: positionFilter === filter ? "white" : theme.text }}
        >
          {filter}
        </button>
      ))}
    </div>

    <div style={{ display: "grid", gap: "12px" }}>
      {filteredPlayers.map((player) => {
        const development = getDevelopmentStatus(player);
        return (
          <div
            key={player.id}
            onClick={() => setSelectedPlayer(player)}
            style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: "16px", padding: "18px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px" }}
          >
            <div>
              <h3 style={{ margin: "0 0 8px 0" }}>{player.name}</h3>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
                {(player.positions || []).map((position) => (
                  <span key={position} style={{ background: theme.surface, padding: "4px 8px", borderRadius: "8px", fontSize: "0.8rem" }}>{position}</span>
                ))}
              </div>
              <div style={{ color: theme.muted, fontSize: "0.9rem" }}>
                Age: {player.age} · POT: <PotentialStars player={player} /> · Contract: {formatContractDuration(player.contract?.yearsRemaining, { currentDate, seasonYear: seasonState?.seasonYear })}
              </div>
              <div style={{ color: development.color, marginTop: "6px", fontSize: "0.85rem" }}>{development.text}</div>
            </div>
            <div style={{ textAlign: "center", flexShrink: 0 }}>
              <div style={{ color: theme.muted, marginBottom: "4px" }}>OVR</div>
              <div style={{ background: getOverallColour(player.overall ?? 0), color: "white", borderRadius: "12px", padding: "12px", minWidth: "70px", fontWeight: "bold", fontSize: "1.2rem" }}>{player.overall ?? 0}</div>
            </div>
          </div>
        );
      })}
      {filteredPlayers.length === 0 && <div style={cardStyle}>No players match these filters.</div>}
    </div>
    </>}
  </>
)}

{activeTab === "SELECTION" && (
  <div className="selection-layout">
<aside
  className={`selection-sidebar ${
    playerPoolCollapsed
      ? "collapsed"
      : ""
  }`}
>
  <div className="selection-sidebar-header">
        <div>
          <span className="eyebrow">SQUAD MANAGEMENT</span>
          <h3>Player Pool</h3>
        </div>
        <div
  style={{
    display: "flex",
    alignItems: "center",
    gap: "10px"
  }}
>
  <button
    type="button"
    className="collapse-button"
    onClick={() =>
      setPlayerPoolCollapsed(
        previous => !previous
      )
    }
  >
    {playerPoolCollapsed
      ? "❯"
      : "❮"}
  </button>

  {!playerPoolCollapsed && (
  <span className="selection-count">
    {selectedPlayerNames.length}/23
  </span>
)}
</div>
      </div>
      {!playerPoolCollapsed && (
        <>
          <div className="selection-filter-row">
        {filters.map(filter => (
          <button
            className={`selection-filter ${positionFilter === filter ? "active" : ""}`}
            key={filter}
            type="button"
            onClick={() => setPositionFilter(filter)}
          >
            {filter}
          </button>
        ))}
      </div>
      <input
        className="selection-search"
        type="search"
        placeholder="Search players"
        value={searchTerm}
        onChange={event => setSearchTerm(event.target.value)}
      />
      <div className="available-player-list">
        {availableSelectionPlayers
          .filter(player => !searchTerm || player.name.toLowerCase().includes(searchTerm.toLowerCase()))
          .filter(player => positionFilter === "ALL" || player.positions?.includes(positionFilter))
          .map(player => {
            const isSelected = selectedPlayerNames.includes(player.name);
            const injured = isPlayerInjured(player);
            return (
              <div
                className={`available-player ${isSelected ? "is-selected" : ""} ${injured ? "is-injured" : ""} ${draggedPlayerId === player.id ? "is-dragging" : ""}`}
                draggable={!teamSheetLocked && !injured}
                aria-disabled={teamSheetLocked || injured}
                key={player.id}
                onDragStart={event => handlePlayerDragStart(event, player.id)}
                onPointerDown={event => !injured && handlePlayerPointerDown(event, player.id)}
                onPointerUp={event => handlePlayerPointerUp(event, player.id)}
                onDragEnd={() => {
                  setDraggedPlayerId(null);
                  setDragOverPosition(null);
                }}
                onClick={() => !injured && setSelectedPlayer(player)}
              >
                <span className="available-player-details">
                  <strong style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 5 }}>{player.name}{injured && <span className="selection-injury-icon" title={unavailableReason(player)} aria-label={unavailableReason(player)}>✚</span>}</strong>
                  <small>{player.positions?.join(" / ")} · Age {player.age}</small>
                  {injured && <small className="selection-injury-status">{unavailableReason(player)}</small>}
                </span>
                <span className="available-player-rating">{player.overall ?? 0}</span>
                <button
                  className="select-player-button"
                  type="button"
                  disabled={isSelected || teamSheetLocked || injured}
                  onClick={event => {
                    event.stopPropagation();
                    if (!isSelected) {
                      selectPlayerFromList(player);
                    }
                  }}
                >
                  {isSelected ? "Placed" : "Auto"}
                </button>
                <button
                  className={`manual-player-button ${manualPlacementPlayerId === player.id ? "is-active" : ""}`}
                  type="button"
                  disabled={isSelected || teamSheetLocked || injured}
                  aria-pressed={manualPlacementPlayerId === player.id}
                  onClick={event => {
                    event.stopPropagation();
                    startManualPlacement(player);
                  }}
                >
                  Manual
                </button>
              </div>
            );
          })}
      </div>
      <p className="drag-hint" role="status">
        {manualPlacementMessage || (manualPlacementPlayerId != null
          ? `Click a highlighted field position to place ${squadPlayers.find(player => player.id === manualPlacementPlayerId)?.name ?? "the player"}.`
          : "Use Auto to place a player in a preferred position, or Manual to choose a field position.")}
      </p>

        </>
      )}
    </aside>

    <section className="team-sheet-panel">
      <div className="team-sheet-header">
        <div>
          <span className="eyebrow">{currentRoundLabel}{seasonState?.phase === "HOME_AND_AWAY" ? ` · ${managerIsHome ? "HOME" : "AWAY"}` : ""}</span>
          <h3>Team Selection</h3>
          <span style={{ color: theme.muted, fontSize: 12, fontWeight: 700 }}>
            TEAM SHEET {teamSheetStatus.filled}/23 · {teamSheetLocked ? `CONFIRMED · LOCKED` : teamSheetStatus.injuredSelected.length ? `${teamSheetStatus.injuredSelected.length} unavailable player${teamSheetStatus.injuredSelected.length === 1 ? "" : "s"} must be removed` : teamSheetStatus.complete ? "READY TO CONFIRM" : `${23 - teamSheetStatus.filled} spots remaining or invalid selections`}
          </span>
        </div>
        <div className="team-sheet-actions">
          <select
            value={selectionStrategy}
            onChange={event => setSelectionStrategy(event.target.value)}
            aria-label="Selection strategy"
            disabled={teamSheetLocked}
          >
            {selectionStrategies.map(strategy => (
              <option key={strategy.id} value={strategy.id}>{strategy.name}</option>
            ))}
          </select>
          {selectionStrategy === "MATCH_OPPONENT" && !currentRoundMatch && (
            <small role="status" style={{ color: theme.muted }}>No upcoming opponent is set; this preset will use Best Available.</small>
          )}
          <div className="team-sheet-button-stack">
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              {[0, 1].map(slotIndex => {
                const saved = Boolean(teamSelection.customSelections?.[slotIndex]);
                return (
                  <div key={slotIndex} style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <button
                      type="button"
                      onClick={() => saveCustomSelection(slotIndex)}
                      disabled={teamSheetLocked}
                      aria-label={`Save current team selection to custom slot ${slotIndex + 1}`}
                      style={{ border: `1px solid ${theme.border}`, borderRadius: 7, padding: "6px 8px", color: theme.text, background: theme.surface, fontSize: 11, fontWeight: 700, cursor: teamSheetLocked ? "not-allowed" : "pointer" }}
                    >Save Slot {slotIndex + 1}</button>
                    <button
                      type="button"
                      onClick={() => loadCustomSelection(slotIndex)}
                      disabled={!saved || teamSheetLocked}
                      aria-label={`Load custom team selection slot ${slotIndex + 1}`}
                      style={{ border: `1px solid ${theme.border}`, borderRadius: 7, padding: "6px 8px", color: saved ? theme.text : theme.muted, background: theme.panel, fontSize: 11, fontWeight: 700, cursor: saved && !teamSheetLocked ? "pointer" : "not-allowed", opacity: saved ? 1 : 0.55 }}
                    >{saved ? `Load Slot ${slotIndex + 1}` : `Slot ${slotIndex + 1} Empty`}</button>
                  </div>
                );
              })}
            </div>
            <button className="auto-select-button" type="button" onClick={autoSelectTeam} disabled={teamSheetLocked}>Auto Select</button>
            <button
              className="clear-selections-button"
              type="button"
              onClick={clearSelections}
              disabled={teamSheetLocked}
              style={{ background: "#fff", color: "#172033", border: "1px solid #cbd5e1", borderRadius: 7, fontSize: "0.68rem", fontWeight: 700, padding: "5px 8px", cursor: "pointer" }}
            >
              Clear Selections
            </button>
            {!teamSheetLocked ? <button
              type="button"
              onClick={() => {
                if (teamSheetStatus.complete && teamSheetStatus.injuredSelected.length === 0) {
                  setTeamSelection(previous => {
                    const confirmed = { ...previous, confirmedForRound: currentRoundKey };
                    return appendTeamSheetHistory(confirmed, createTeamSheetHistoryEntry(confirmed, seasonState, club?.name));
                  });
                }
              }}
              disabled={!teamSheetStatus.complete || teamSheetStatus.injuredSelected.length > 0}
              style={{ border: 0, borderRadius: 8, padding: "9px 12px", color: "white", background: teamSheetStatus.complete && !teamSheetStatus.injuredSelected.length ? "#16a34a" : "#475569", fontWeight: 800, cursor: teamSheetStatus.complete && !teamSheetStatus.injuredSelected.length ? "pointer" : "not-allowed", opacity: teamSheetStatus.complete && !teamSheetStatus.injuredSelected.length ? 1 : 0.6 }}
            >Confirm Team Sheet</button> : <span role="status" style={{ color: "#16a34a", fontWeight: 800, padding: "9px 12px" }}>Team Sheet Confirmed</span>}
          </div>
        </div>
      </div>

      <div className="team-swap-hint" role="status">
        {selectedSwapSlot ? <>
          <span><strong>{teamSelection.selectedSide[selectedSwapSlot]}</strong> selected at {selectedSwapSlot}. Choose another tile to swap, or an empty tile to move.</span>
          <button type="button" onClick={() => setSelectedSwapSlot(null)}>Cancel</button>
        </> : <span>To change positions, select a player tile, then select another tile to swap or an empty tile to move.</span>}
      </div>

      <div className="football-ground">
        <span className="ground-title">{(club?.name ?? "CLUB").toUpperCase()} · BEST 22</span>
        <svg className="ground-markings" viewBox="0 0 1000 1200" preserveAspectRatio="none" aria-hidden="true">
          <g fill="none" stroke="rgba(220, 242, 228, 0.68)" strokeWidth="4" vectorEffect="non-scaling-stroke">
            <path d="M150 190 Q500 620 850 190" />
            <path d="M150 1010 Q500 580 850 1010" />
            <rect x="285" y="420" width="430" height="360" />
            <circle cx="500" cy="600" r="58" />
          </g>
        </svg>
        <div className="ground-row ground-forward-row">
          {renderPositionSlot("FP1", "FP")}
          {renderPositionSlot("FF", "FF")}
          {renderPositionSlot("FP2", "FP")}
        </div>
        <div className="ground-row ground-half-forward-row">
          {renderPositionSlot("HF1", "HFF")}
          {renderPositionSlot("CHF", "CHF")}
          {renderPositionSlot("HF2", "HFF")}
        </div>
        <div className="ground-row ground-midfield-row">
          {renderPositionSlot("W1", "W")}
          {renderPositionSlot("C", "C")}
          {renderPositionSlot("W2", "W")}
        </div>
        <div className="ground-row ground-ruck-row">
          {renderPositionSlot("RR", "RR")}
          {renderPositionSlot("R", "R")}
          {renderPositionSlot("ROV", "ROV")}
        </div>
        <div className="ground-row ground-half-back-row">
          {renderPositionSlot("HB1", "HBF")}
          {renderPositionSlot("CHB", "CHB")}
          {renderPositionSlot("HB2", "HBF")}
        </div>
        <div className="ground-row ground-back-row">
          {renderPositionSlot("BP1", "BP")}
          {renderPositionSlot("FB", "FB")}
          {renderPositionSlot("BP2", "BP")}
        </div>
      </div>

      <div className="interchange-panel">
        <div>
          <span className="eyebrow">INTERCHANGE</span>
          <strong>{Object.keys(teamSelection.selectedSide).filter(position => position.startsWith("INT") && teamSelection.selectedSide[position]).length}/5 players</strong>
        </div>
        <div className="interchange-slots">
          {Object.keys(teamSelection.selectedSide)
            .filter(position => position.startsWith("INT"))
            .map(position => renderPositionSlot(position, position.replace("INT", "")))}
        </div>
      </div>
    </section>
  </div>
)}

{activeTab === "CONTRACTS" && (
  <ClubAdministrationScreen
    club={club}
    players={playerPool}
    appearance={resolvedAppearance}
    seasonState={seasonState}
    currentDate={currentDate}
    playerContracts={seasonState?.playerContracts ?? {}}
    clubAdministration={seasonState?.clubAdministration}
    initialTab="CONTRACTS"
    activeTab="CONTRACTS"
    hideTabs
    title="Contracts"
    availableTabs={["CONTRACTS"]}
    onPlayerContractsChange={onPlayerContractsChange}
    onAdministrationStateChange={onAdministrationStateChange}
  />
)}

{activeTab === "LEADERSHIP" && (
  <section style={{ ...cardStyle, display: "grid", gap: 18 }}>
    <div>
      <h2 style={{ margin: 0 }}>Leadership Group · {leadershipSeason(seasonState)}</h2>
      <p style={{ color: theme.muted, marginBottom: 0 }}>Choose one captain and up to two vice captains. The group steadies the squad after losses, helps contract negotiations and adds or costs rating points on match day.</p>
      <p style={{ color: leadershipEditable ? "#22c55e" : "#f59e0b", marginBottom: 0 }}>{leadershipEditable ? "Selections are open until the season begins." : "Selections are locked for this season."}</p>
    </div>
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      <div style={{ ...cardStyle, flex: "1 1 220px", padding: 14, background: theme.surface }}><strong>Captain</strong><div>{leadershipGroup.captains?.length ? leadershipGroup.captains.map(leaderName).join(" · ") : "None selected"}</div></div>
      <div style={{ ...cardStyle, flex: "1 1 220px", padding: 14, background: theme.surface }}><strong>Vice captains</strong><div>{leadershipGroup.viceCaptains?.length ? leadershipGroup.viceCaptains.map(leaderName).join(" · ") : "None selected"}</div></div>
      <div style={{ ...cardStyle, flex: "0 1 150px", padding: 14, background: theme.surface }}><strong>Group quality</strong><div>{leadershipQuality}/100</div></div>
      <div style={{ ...cardStyle, flex: "0 1 190px", padding: 14, background: theme.surface }}><strong>Match effect</strong><div style={{ color: leadershipMatchRating > 0 ? "#22c55e" : leadershipMatchRating < 0 ? "#ef4444" : theme.text }}>{leadershipMatchRating > 0 ? "+" : ""}{leadershipMatchRating.toFixed(1)} rating</div><small style={{ color: theme.muted }}>{(leadershipGroup.captains?.length ?? 0) + (leadershipGroup.viceCaptains?.length ?? 0) === 0 ? "No leaders chosen" : "Based on the current team sheet"}</small></div>
    </div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
      <div><strong>Assistant recommendations</strong><div style={{ color: theme.muted }}>Leadership, professionalism, teamwork, composure, age, contract security and promises determine suitability.</div></div>
      {leadershipEditable && <button type="button" onClick={() => saveLeadershipGroup(autoLeadershipGroup(squadPlayers, seasonState?.playerContracts))} style={{ ...tabStyle("LEADERSHIP"), whiteSpace: "nowrap" }}>Use assistant picks</button>}
    </div>
    <div style={{ display: "grid", gap: 7 }}>
      {leadershipCandidates.map(({ player, score, reasons }, index) => (
        <div key={player.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, padding: 11, borderRadius: 9, border: `1px solid ${theme.border}`, background: theme.surface }}>
          <div style={{ flex: "1 1 200px" }}><strong>{player.name}</strong> <span style={{ color: theme.muted }}>· {Math.round(player.age)}y · OVR {Math.round(player.overall ?? 0)}</span><div style={{ color: theme.muted, fontSize: 12 }}>{index < 3 ? "Assistant pick · " : ""}{reasons.join(" · ")}</div></div>
          <strong>{score}</strong>
          <div style={{ display: "flex", gap: 5 }}>
            {["CAPTAIN", "VICE"].map((role) => {
              const selected = (leadershipGroup[role === "CAPTAIN" ? "captains" : "viceCaptains"] ?? []).some((id) => String(id) === String(player.id));
              return <button key={role} type="button" disabled={!leadershipEditable} onClick={() => toggleLeader(player.id, role)} style={{ padding: "7px 9px", borderRadius: 8, border: `1px solid ${selected ? "#ea580c" : theme.border}`, background: selected ? "#ea580c" : theme.panel, color: selected ? "white" : theme.text, cursor: leadershipEditable ? "pointer" : "default" }}>{role === "CAPTAIN" ? "Captain" : "Vice"}</button>;
            })}
          </div>
        </div>
      ))}
    </div>
  </section>
)}

{activeTab === "HISTORY" && (
  <section style={{ ...cardStyle, display: "grid", gap: 16 }}>
    <div>
      <h2 style={{ margin: 0 }}>Team Selection History</h2>
      <p style={{ margin: "6px 0 0", color: theme.muted }}>Confirmed team sheets are saved by round, including changes from the previous selection.</p>
    </div>
    {!teamSelectionHistory.length ? (
      <div style={{ padding: 18, borderRadius: 12, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.muted }}>
        No team sheets have been recorded yet. Confirm a team sheet to start your history.
      </div>
    ) : <>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", paddingBottom: 12, borderBottom: `1px solid ${theme.border}` }}>
        {[...teamSelectionHistory].reverse().map((entry) => <button key={entry.roundKey} type="button" onClick={() => setHistoryRoundKey(entry.roundKey)} style={{ ...tabStyle(selectedHistoryEntry?.roundKey === entry.roundKey), padding: "7px 10px" }}>{entry.roundLabel} · {entry.seasonYear}</button>)}
      </div>
      {selectedHistoryEntry && <>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div><span style={{ color: "#ea580c", fontWeight: 800, fontSize: 12, letterSpacing: 1.2 }}>{selectedHistoryEntry.roundLabel} · {selectedHistoryEntry.seasonYear}</span><h3 style={{ margin: "5px 0 0" }}>{selectedHistoryEntry.opponent ? `${club?.name} ${selectedHistoryEntry.homeAway === "HOME" ? "vs" : "at"} ${selectedHistoryEntry.opponent}` : "Confirmed team sheet"}</h3></div>
          <span style={{ color: theme.muted, fontSize: 13 }}>{selectedHistoryEntry.venue ?? "Venue not recorded"}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <div style={{ padding: 14, borderRadius: 12, border: `1px solid ${theme.border}`, background: theme.surface }}><strong style={{ color: "#16a34a" }}>IN · {selectedHistoryIn.length}</strong><div style={{ display: "grid", gap: 6, marginTop: 10 }}>{selectedHistoryIn.length ? selectedHistoryIn.map(([position, name]) => <div key={`${position}-${name}`} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><span>{name}</span><small style={{ color: theme.muted }}>{position}</small></div>) : <span style={{ color: theme.muted }}>No changes from the previous team.</span>}</div></div>
          <div style={{ padding: 14, borderRadius: 12, border: `1px solid ${theme.border}`, background: theme.surface }}><strong style={{ color: "#ef4444" }}>OUT · {selectedHistoryOut.length}</strong><div style={{ display: "grid", gap: 6, marginTop: 10 }}>{selectedHistoryOut.length ? selectedHistoryOut.map(([position, name]) => <div key={`${position}-${name}`} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><span>{name}</span><small style={{ color: theme.muted }}>{position}</small></div>) : <span style={{ color: theme.muted }}>{previousHistoryEntry ? "No changes from the previous team." : "No earlier team sheet to compare."}</span>}</div></div>
        </div>
        <div>
          <h3 style={{ margin: "4px 0 10px" }}>Selected lineup</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 10 }}>
            {[["Forward line", ["FP1", "FF", "FP2", "HF1", "CHF", "HF2"]], ["Midfield", ["W1", "C", "W2", "R", "RR", "ROV"]], ["Back line", ["HB1", "CHB", "HB2", "BP1", "FB", "BP2"]], ["Interchange", ["INT1", "INT2", "INT3", "INT4", "INT5"]]].map(([group, positions]) => <div key={group} style={{ padding: 12, border: `1px solid ${theme.border}`, borderRadius: 12, background: theme.surface }}>
              <h4 style={{ margin: "0 0 8px", color: theme.muted, textTransform: "uppercase", letterSpacing: 1, fontSize: 12 }}>{group}</h4>
              <div style={{ display: "grid", gap: 6 }}>{positions.map((position) => {
                const name = selectedHistoryEntry.selectedSide?.[position];
                const player = squadPlayers.find((item) => item.name === name);
                return <div key={position} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: 8, background: theme.panel, border: `1px solid ${theme.border}` }}><span><small style={{ color: theme.muted, marginRight: 7 }}>{position}</small><strong>{name ?? "—"}</strong></span>{player && <small style={{ color: theme.muted, whiteSpace: "nowrap" }}>{player.overall ?? "—"} OVR</small>}</div>;
              })}</div>
            </div>)}
          </div>
        </div>
      </>}
    </>}
  </section>
)}

    </main>
  );
}
