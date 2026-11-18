import { checkClubCommitments } from "./transactionRules.js";
import { getCareerClub } from "./contractEngine.js";
import { getClubBestTeam } from "./clubStrengthEngine.js";

export const LEGENDS_DRAFT_MAX_LIST = 44;

function randomOrder(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

export function createLegendsDraftState(clubs, userClubName, pool, { pickCount = pool?.length ?? 0, luckyDip = false } = {}) {
  const clubNames = clubs.map((club) => typeof club === "string" ? club : club.name).filter(Boolean);
  if (!clubNames.includes(userClubName)) return { error: "Your club is missing from the draft order." };
  if (!pool.length) return { error: "There are no eligible legends available for this draft." };
  const count = Math.max(1, Math.min(pool.length, Math.floor(Number(pickCount) || pool.length)));
  const firstRound = randomOrder(clubNames);
  const order = [];
  while (order.length < count) {
    const round = Math.floor(order.length / clubNames.length);
    const roundOrder = round % 2 ? [...firstRound].reverse() : firstRound;
    order.push(...roundOrder.slice(0, count - order.length));
  }
  return {
    status: "ACTIVE",
    order,
    pickIndex: 0,
    picks: [],
    luckyDip,
    startedAt: Date.now(),
  };
}

export function getLegendsDraftClub(draft) {
  if (!draft || draft.status !== "ACTIVE") return null;
  return draft.order[draft.pickIndex] ?? null;
}

function rosterFor(state, players, clubName) {
  return players.filter((player) => getCareerClub(player, state.playerContracts ?? {}) === clubName
    && !state.playerContracts?.[String(player.id)]?.delisted
    && !state.playerContracts?.[String(player.id)]?.retired);
}

function replacementFor(state, players, clubName) {
  const roster = rosterFor(state, players, clubName);
  if (roster.length < LEGENDS_DRAFT_MAX_LIST) return { roster, outgoing: null };
  const best = getClubBestTeam(roster);
  const protectedIds = new Set(Object.values(best.lines ?? {}).flat().map((item) => item.player?.id).filter(Boolean).map(String));
  const candidates = roster.filter((player) => !protectedIds.has(String(player.id)))
    .sort((a, b) => Number(a.overall ?? 0) - Number(b.overall ?? 0));
  return { roster, outgoing: candidates[0] ?? null };
}

export function canSelectLegend(state, players, clubName, legend) {
  if (!legend) return { ok: false, reason: "That legend is no longer available." };
  const { roster, outgoing } = replacementFor(state, players, clubName);
  if (roster.length > LEGENDS_DRAFT_MAX_LIST) {
    return { ok: false, reason: `${clubName} already has more than ${LEGENDS_DRAFT_MAX_LIST} listed players. Bring the list under the cap before drafting a legend.` };
  }
  if (roster.length >= LEGENDS_DRAFT_MAX_LIST && !outgoing) {
    return { ok: false, reason: `${clubName} has a full list and no player outside its Best 23 can be released safely.` };
  }
  const contract = state.playerContracts?.[String(legend.id)] ?? legend.contract ?? {};
  const proposedContracts = {
    ...(state.playerContracts ?? {}),
    [String(legend.id)]: { ...contract, club: clubName, delisted: false, retired: false },
  };
  if (outgoing) proposedContracts[String(outgoing.id)] = {
    ...(proposedContracts[String(outgoing.id)] ?? {}),
    club: clubName,
    delisted: true,
  };
  const capPlayers = players.some((player) => String(player.id) === String(legend.id)) ? players : [...players, legend];
  const cap = checkClubCommitments(
    capPlayers,
    proposedContracts,
    clubName,
    state.seasonYear ?? 2027,
    0,
    clubName === state.managerClubName ? state.clubAdministration : state.leagueAdministration?.[clubName],
  );
  if (!cap.ok) return { ok: false, reason: cap.reason };
  return { ok: true, outgoing };
}

export function addLegendToClub(state, players, legend, clubName) {
  const eligibility = canSelectLegend(state, players, clubName, legend);
  if (!eligibility.ok) return { error: eligibility.reason };
  const contracts = { ...(state.playerContracts ?? {}) };
  if (eligibility.outgoing) contracts[String(eligibility.outgoing.id)] = {
    ...(contracts[String(eligibility.outgoing.id)] ?? {}),
    club: clubName,
    delisted: true,
  };
  const existingContract = contracts[String(legend.id)] ?? legend.contract ?? {};
  contracts[String(legend.id)] = { ...existingContract, club: clubName, delisted: false, retired: false };
  const allExisting = [...(state.generatedPlayers ?? [])];
  const inGenerated = allExisting.some((player) => String(player.id) === String(legend.id));
  const assignedLegend = { ...legend, club: clubName };
  const generatedPlayers = inGenerated
    ? allExisting.map((player) => String(player.id) === String(legend.id) ? assignedLegend : player)
    : [...allExisting, assignedLegend];
  return {
    state: {
      ...state,
      generatedPlayers,
      playerContracts: contracts,
      legendDraftPool: (state.legendDraftPool ?? []).filter((item) => String(item.id) !== String(legend.id)),
    },
    outgoing: eligibility.outgoing,
  };
}

export function selectLegendsDraftPlayer(state, players, clubName, legendId) {
  const currentClub = getLegendsDraftClub(state.legendDraft);
  if (currentClub !== clubName) return { error: "It is not this club's turn." };
  const legend = (state.legendDraftPool ?? []).find((player) => String(player.id) === String(legendId));
  const eligibility = canSelectLegend(state, players, clubName, legend);
  if (!eligibility.ok) return { error: eligibility.reason };
  const contracts = { ...(state.playerContracts ?? {}) };
  if (eligibility.outgoing) contracts[String(eligibility.outgoing.id)] = {
    ...(contracts[String(eligibility.outgoing.id)] ?? {}),
    club: clubName,
    delisted: true,
  };
  const previousLegendContract = contracts[String(legend.id)] ?? legend.contract ?? {};
  contracts[String(legend.id)] = {
    ...previousLegendContract,
    club: clubName,
    delisted: false,
    retired: false,
  };
  const pick = {
    pick: state.legendDraft.pickIndex + 1,
    club: clubName,
    playerId: legend.id,
    playerName: legend.name,
    replacedPlayerId: eligibility.outgoing?.id ?? null,
  };
  const picks = [...state.legendDraft.picks, pick];
  const pickIndex = state.legendDraft.pickIndex + 1;
  const completed = pickIndex >= state.legendDraft.order.length || (state.legendDraftPool ?? []).length <= 1;
  return {
    state: {
      ...state,
      generatedPlayers: (state.generatedPlayers ?? []).some((player) => String(player.id) === String(legend.id))
        ? (state.generatedPlayers ?? []).map((player) => String(player.id) === String(legend.id) ? { ...player, club: clubName } : player)
        : [...(state.generatedPlayers ?? []), { ...legend, club: clubName }],
      playerContracts: contracts,
      legendDraftPool: (state.legendDraftPool ?? []).filter((player) => String(player.id) !== String(legend.id)),
      legendDraft: {
        ...state.legendDraft,
        picks,
        pickIndex,
        status: completed ? "COMPLETE" : "ACTIVE",
        completedAt: completed ? Date.now() : null,
      },
    },
  };
}

export function passLegendsDraftPick(state, clubName) {
  if (getLegendsDraftClub(state.legendDraft) !== clubName) return state;
  const pickIndex = state.legendDraft.pickIndex + 1;
  const completed = pickIndex >= state.legendDraft.order.length || !(state.legendDraftPool ?? []).length;
  return {
    ...state,
    legendDraft: {
      ...state.legendDraft,
      pickIndex,
      status: completed ? "COMPLETE" : "ACTIVE",
      completedAt: completed ? Date.now() : null,
      passes: [...(state.legendDraft.passes ?? []), { pick: pickIndex, club: clubName }],
    },
  };
}

function aiScore(state, players, clubName, legend) {
  const { roster } = replacementFor(state, players, clubName);
  const before = getClubBestTeam(roster).bestTeamOverall ?? 0;
  const current = canSelectLegend(state, players, clubName, legend);
  if (!current.ok) return Number.NEGATIVE_INFINITY;
  const afterRoster = [...roster.filter((player) => String(player.id) !== String(current.outgoing?.id)), legend];
  const after = getClubBestTeam(afterRoster).bestTeamOverall ?? before;
  return after * 10 + Number(legend.overall ?? 0) * 0.1 + Number(legend.potential ?? legend.overall ?? 0) * 0.03;
}

export function processLegendsDraftAI(state, players, userClubName) {
  let next = state;
  let guard = 0;
  while (next.legendDraft?.status === "ACTIVE" && (next.legendDraft.luckyDip || getLegendsDraftClub(next.legendDraft) !== userClubName) && guard < 1000) {
    guard += 1;
    const clubName = getLegendsDraftClub(next.legendDraft);
    const currentPlayers = [...new Map([...players, ...(next.generatedPlayers ?? [])].map((player) => [String(player.id), player])).values()];
    const available = (next.legendDraftPool ?? []).map((legend) => ({ legend, score: aiScore(next, currentPlayers, clubName, legend) }))
      .filter((entry) => Number.isFinite(entry.score));
    if (next.legendDraft.luckyDip) {
      const randomised = randomOrder(available);
      available.splice(0, available.length, ...randomised);
    } else available.sort((a, b) => b.score - a.score);
    if (!available.length) next = passLegendsDraftPick(next, clubName);
    else {
      const result = selectLegendsDraftPlayer(next, currentPlayers, clubName, available[0].legend.id);
      next = result.state ?? passLegendsDraftPick(next, clubName);
    }
  }
  return next;
}
